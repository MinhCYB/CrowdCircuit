import { describe, expect, it } from "vitest";
import {
  CANONICAL_CHAT_COMMENT_EVENT,
  CANONICAL_GIFT_SENT_EVENT,
} from "@crowdcircuit/contracts/fixtures";
import {
  MappingEngine,
  MappingProfileSchema,
  type BudgetAdmissionRequest,
  type BudgetAdmissionResult,
  type DurableBudgetRepository,
  type MappingProfile,
  type MappingRule,
} from "@crowdcircuit/mapping-engine";
import {
  ANONYMOUS_USER_EMPTY_EVENT,
  ANONYMOUS_USER_NULL_EVENT,
  BASE_PROFILE,
  FIXTURE_MANIFEST,
  GIFT_STREAK_UPDATE_EVENT,
  IDENTICAL_OUTPUT_RULE_A,
  IDENTICAL_OUTPUT_RULE_B,
  IDENTIFIED_BY_ID_EVENT,
  IDENTIFIED_BY_UNIQUE_ID_EVENT,
  INVALID_PROFILE_CASES,
  LIKE_AGGREGATE_EVENT_1,
  LIKE_AGGREGATE_EVENT_2,
  TIE_RULE_EARLIER,
  TIE_RULE_LATER,
  VALID_COMMENT_RULE,
  VALID_GIFT_RULE,
} from "./fixtures/phase-c-milestone-02.js";

class TestLocalDurableBudgetRepository implements DurableBudgetRepository {
  readonly userWindows = new Map<string, number[]>();
  readonly ruleWindows = new Map<string, number[]>();
  readonly ruleCooldowns = new Map<string, number>();
  readonly activeUserBucketKeys = new Set<string>();

  globalTokens: number | null = null;
  lastRefillTime: number | null = null;
  lastSeenTime: number = 0;

  failWithReason: BudgetAdmissionResult | null = null;

  admit(request: BudgetAdmissionRequest): BudgetAdmissionResult {
    if (this.failWithReason) {
      return this.failWithReason;
    }

    const {
      now,
      candidate,
      userLimitPerMinute,
      ruleLimitPerMinute,
      cooldownMs,
      globalBudget,
      capacity,
    } = request;

    if (now < this.lastSeenTime) {
      return { admitted: false, reason: "CLOCK_ROLLBACK" };
    }
    this.lastSeenTime = now;

    const userKey = candidate.userBudgetKey;
    const ruleId = candidate.ruleId;
    const windowStart = now - 60_000;
    const retentionCutoff = now - capacity.inactiveRetentionMs;

    for (const key of Array.from(this.activeUserBucketKeys)) {
      const timestamps = this.userWindows.get(key) ?? [];
      const valid = timestamps.filter((t) => t > retentionCutoff);
      if (valid.length === 0) {
        this.userWindows.delete(key);
        this.activeUserBucketKeys.delete(key);
      } else {
        this.userWindows.set(key, valid);
      }
    }

    if (
      !this.activeUserBucketKeys.has(userKey) &&
      this.activeUserBucketKeys.size >= capacity.maxUserBuckets
    ) {
      return { admitted: false, reason: "CAPACITY_EXHAUSTED" };
    }

    const userTimestamps = (this.userWindows.get(userKey) ?? []).filter(
      (t) => t > windowStart,
    );
    if (userTimestamps.length >= userLimitPerMinute) {
      return { admitted: false, reason: "USER_LIMIT" };
    }

    const lastCooldown = this.ruleCooldowns.get(ruleId);
    if (lastCooldown !== undefined && cooldownMs > 0) {
      if (now < lastCooldown + cooldownMs) {
        return { admitted: false, reason: "RULE_COOLDOWN" };
      }
    }

    const ruleTimestamps = (this.ruleWindows.get(ruleId) ?? []).filter(
      (t) => t > windowStart,
    );
    if (ruleTimestamps.length >= ruleLimitPerMinute) {
      return { admitted: false, reason: "RULE_LIMIT" };
    }

    if (this.globalTokens === null) {
      this.globalTokens = globalBudget.burst;
      this.lastRefillTime = now;
    } else {
      const elapsedSec = (now - (this.lastRefillTime ?? now)) / 1000;
      this.globalTokens = Math.min(
        globalBudget.burst,
        this.globalTokens + elapsedSec * globalBudget.maxPerSecond,
      );
      this.lastRefillTime = now;
    }

    if (this.globalTokens < 1) {
      return { admitted: false, reason: "GLOBAL_LIMIT" };
    }

    this.activeUserBucketKeys.add(userKey);
    this.userWindows.set(userKey, [...userTimestamps, now]);
    this.ruleWindows.set(ruleId, [...ruleTimestamps, now]);
    this.ruleCooldowns.set(ruleId, now);
    this.globalTokens -= 1;

    return { admitted: true };
  }
}

describe("Milestone 2 Black-Box Specification Tests", () => {
  describe("A. Deterministic Identity", () => {
    it("identical input produces identical candidate order and seeds", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });
      const input = {
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
        dryRun: true,
      };

      const res1 = engine.evaluate(input);
      const res2 = engine.evaluate(input);

      expect(res1).toEqual(res2);
      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.results.map((r) => r.candidate.idempotencySeed)).toEqual(
          res2.results.map((r) => r.candidate.idempotencySeed),
        );
      }
    });

    it("two different rules with identical action output produce different seeds", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });
      const profile: MappingProfile = {
        ...BASE_PROFILE,
        rules: [IDENTICAL_OUTPUT_RULE_A, IDENTICAL_OUTPUT_RULE_B],
      };

      const res = engine.evaluate({
        profile,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
        dryRun: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results).toHaveLength(2);
        const seedA = res.results[0]?.candidate.idempotencySeed;
        const seedB = res.results[1]?.candidate.idempotencySeed;
        expect(seedA).not.toBe(seedB);
      }
    });

    it("same eventId with different canonical output produces different seeds", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });
      const likeRule: MappingRule = {
        id: "rule_like_01",
        name: "Like Rule",
        enabled: true,
        priority: 10,
        exclusiveGroup: null,
        eventType: "engagement.like",
        conditions: [],
        transform: {
          actionType: "CHEER",
          parameters: { message: "likes delta {{payload.delta}}" },
        },
        controls: {
          cooldownMs: 0,
          maxActionsPerMinute: 100,
          maxActionsPerUserPerMinute: 50,
          aggregationWindowMs: 0,
          actionPriority: 50,
          ttlMs: 5000,
        },
        createdAt: "2026-07-25T00:00:00.000Z",
      };
      const profile: MappingProfile = { ...BASE_PROFILE, rules: [likeRule] };

      const res1 = engine.evaluate({
        profile,
        manifest: FIXTURE_MANIFEST,
        event: LIKE_AGGREGATE_EVENT_1,
        dryRun: true,
      });
      const res2 = engine.evaluate({
        profile,
        manifest: FIXTURE_MANIFEST,
        event: LIKE_AGGREGATE_EVENT_2,
        dryRun: true,
      });

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      if (res1.success && res2.success) {
        expect(res1.results[0]?.candidate.idempotencySeed).not.toBe(
          res2.results[0]?.candidate.idempotencySeed,
        );
      }
    });

    it("does not emit any final actionId on candidate object", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });
      const res = engine.evaluate({
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
        dryRun: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const candidate = res.results[0]?.candidate;
        expect(candidate).toBeDefined();
        expect(candidate).not.toHaveProperty("actionId");
      }
    });
  });

  describe("B. Deterministic Ordering", () => {
    it("orders by priority DESC, specificity DESC, createdAt ASC, ruleId ASC", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });
      const profile: MappingProfile = {
        ...BASE_PROFILE,
        rules: [TIE_RULE_LATER, TIE_RULE_EARLIER],
      };

      const res = engine.evaluate({
        profile,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
        dryRun: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results.map((r) => r.candidate.ruleId)).toEqual([
          "rule_tie_a",
          "rule_tie_b",
        ]);
      }
    });

    it("rule input array order does not alter output order", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const profileNormal: MappingProfile = {
        ...BASE_PROFILE,
        rules: [TIE_RULE_EARLIER, TIE_RULE_LATER],
      };
      const profileReversed: MappingProfile = {
        ...BASE_PROFILE,
        rules: [TIE_RULE_LATER, TIE_RULE_EARLIER],
      };

      const res1 = engine.evaluate({
        profile: profileNormal,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
        dryRun: true,
      });
      const res2 = engine.evaluate({
        profile: profileReversed,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
        dryRun: true,
      });

      expect(res1).toEqual(res2);
    });
  });

  describe("C. Match-Mode Behavior", () => {
    it("first selects one rule before budget admission", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });
      const firstProfile: MappingProfile = {
        ...BASE_PROFILE,
        matchMode: "first",
        rules: [VALID_GIFT_RULE, { ...VALID_GIFT_RULE, id: "rule_gift_02" }],
      };

      const res = engine.evaluate({
        profile: firstProfile,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results).toHaveLength(1);
        expect(repo.userWindows.get("prof_milestone_02\u001frule_gift_01\u001fid:usr_canonical_001")?.length).toBe(1);
      }
    });

    it("exclusive_group selects at most one match per group and discarded rules consume no budget", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });
      const groupRules: MappingRule[] = [
        { ...VALID_GIFT_RULE, id: "g1_r1", priority: 100, exclusiveGroup: "group_spawn" },
        { ...VALID_GIFT_RULE, id: "g1_r2", priority: 50, exclusiveGroup: "group_spawn" },
      ];
      const groupProfile: MappingProfile = {
        ...BASE_PROFILE,
        matchMode: "exclusive_group",
        rules: groupRules,
      };

      const res = engine.evaluate({
        profile: groupProfile,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results).toHaveLength(1);
        expect(res.results[0]?.candidate.ruleId).toBe("g1_r1");
        expect(repo.ruleWindows.has("g1_r2")).toBe(false);
      }
    });
  });

  describe("D. Anonymous Budgeting", () => {
    it("null user and empty user use identical shared anonymous bucket", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      engine.evaluate({
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: ANONYMOUS_USER_NULL_EVENT,
      });
      const keyNull = Array.from(repo.activeUserBucketKeys)[0];

      repo.activeUserBucketKeys.clear();
      repo.userWindows.clear();

      engine.evaluate({
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: ANONYMOUS_USER_EMPTY_EVENT,
      });
      const keyEmpty = Array.from(repo.activeUserBucketKeys)[0];

      expect(keyNull).toBe(keyEmpty);
      expect(keyNull).toBe("prof_milestone_02\u001frule_comment_01\u001fanonymous");
    });

    it("identified users use individual buckets and not the anonymous bucket", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      engine.evaluate({
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: IDENTIFIED_BY_ID_EVENT,
      });
      const keyId = Array.from(repo.activeUserBucketKeys)[0];

      engine.evaluate({
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: IDENTIFIED_BY_UNIQUE_ID_EVENT,
      });
      const keyUnique = Array.from(repo.activeUserBucketKeys)[1];

      expect(keyId).toBe("prof_milestone_02\u001frule_comment_01\u001fid:usr_specific_999");
      expect(keyUnique).toBe("prof_milestone_02\u001frule_comment_01\u001funique:viewer_unique_999");
    });

    it("display name and avatar changes never alter identity bucket", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const eventA = {
        ...CANONICAL_CHAT_COMMENT_EVENT,
        user: { ...CANONICAL_CHAT_COMMENT_EVENT.user!, displayName: "Name A", avatarUrl: "https://a.png" },
      };
      const eventB = {
        ...CANONICAL_CHAT_COMMENT_EVENT,
        user: { ...CANONICAL_CHAT_COMMENT_EVENT.user!, displayName: "Name B", avatarUrl: "https://b.png" },
      };

      engine.evaluate({ profile: BASE_PROFILE, manifest: FIXTURE_MANIFEST, event: eventA });
      engine.evaluate({ profile: BASE_PROFILE, manifest: FIXTURE_MANIFEST, event: eventB });

      expect(repo.activeUserBucketKeys.size).toBe(1);
      expect(Array.from(repo.activeUserBucketKeys)[0]).toBe("prof_milestone_02\u001frule_comment_01\u001fid:usr_canonical_001");
    });
  });

  describe("E. Atomic Admission & Budget Boundaries", () => {
    it("admitted candidate consumes every budget scope", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const res = engine.evaluate({
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: CANONICAL_GIFT_SENT_EVENT,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results[0]?.status).toBe("accepted");
        expect(repo.userWindows.get("prof_milestone_02\u001frule_gift_01\u001fid:usr_canonical_001")).toHaveLength(1);
        expect(repo.ruleWindows.get("rule_gift_01")).toHaveLength(1);
        expect(repo.ruleCooldowns.get("rule_gift_01")).toBe(1_000);
        expect(repo.globalTokens).toBe(49);
      }
    });

    it("rejection at user limit changes no rule or global budget state", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const lowUserLimitRule: MappingRule = {
        ...VALID_GIFT_RULE,
        controls: { ...VALID_GIFT_RULE.controls, maxActionsPerUserPerMinute: 1 },
      };
      const profile: MappingProfile = { ...BASE_PROFILE, rules: [lowUserLimitRule] };

      engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      expect(repo.ruleWindows.get("rule_gift_01")).toHaveLength(1);
      expect(repo.globalTokens).toBe(49);

      const second = engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      expect(second.success).toBe(true);
      if (second.success) {
        expect(second.results[0]?.status).toBe("rejected");
      }
      expect(repo.ruleWindows.get("rule_gift_01")).toHaveLength(1);
      expect(repo.globalTokens).toBe(49);
    });

    it("cooldown rejection changes no later budget state", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const cooldownRule: MappingRule = {
        ...VALID_GIFT_RULE,
        controls: { ...VALID_GIFT_RULE.controls, cooldownMs: 10_000 },
      };
      const profile: MappingProfile = { ...BASE_PROFILE, rules: [cooldownRule] };

      engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      expect(repo.ruleWindows.get("rule_gift_01")).toHaveLength(1);
      expect(repo.globalTokens).toBe(49);

      const second = engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      expect(second.success).toBe(true);
      if (second.success) {
        expect(second.results[0]?.status).toBe("rejected");
        if (second.results[0]?.status === "rejected") {
          expect(second.results[0].reason).toBe("RULE_COOLDOWN");
        }
      }
      expect(repo.ruleWindows.get("rule_gift_01")).toHaveLength(1);
      expect(repo.globalTokens).toBe(49);
    });
  });

  describe("F. Sliding-Window Boundaries & Trusted Clock", () => {
    it("exact sliding-window boundary allows entry at t = start + 60,001ms", () => {
      const repo = new TestLocalDurableBudgetRepository();

      const strictUserLimitRule: MappingRule = {
        ...VALID_COMMENT_RULE,
        controls: { ...VALID_COMMENT_RULE.controls, maxActionsPerUserPerMinute: 1 },
      };
      const profile: MappingProfile = { ...BASE_PROFILE, rules: [strictUserLimitRule] };

      let currentTime = 1_000;
      const engine = new MappingEngine(repo, { now: () => currentTime });

      const r1 = engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_CHAT_COMMENT_EVENT });
      expect(r1.success && r1.results[0]?.status === "accepted").toBe(true);

      const r2 = engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_CHAT_COMMENT_EVENT });
      expect(r2.success && r2.results[0]?.status === "rejected").toBe(true);

      currentTime = 61_001; // exact window expiry
      const r3 = engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_CHAT_COMMENT_EVENT });
      expect(r3.success && r3.results[0]?.status === "accepted").toBe(true);
    });

    it("clock rollback fails closed", () => {
      const repo = new TestLocalDurableBudgetRepository();
      let currentTime = 10_000;
      const engine = new MappingEngine(repo, { now: () => currentTime });

      engine.evaluate({ profile: BASE_PROFILE, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });

      currentTime = 5_000; // clock rollback
      const res = engine.evaluate({ profile: BASE_PROFILE, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results[0]?.status).toBe("rejected");
        if (res.results[0]?.status === "rejected") {
          expect(res.results[0].reason).toBe("CLOCK_ROLLBACK");
        }
      }
    });

    it("event timestamps do not affect window evaluation", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const oldEvent = {
        ...CANONICAL_GIFT_SENT_EVENT,
        occurredAt: "2000-01-01T00:00:00.000Z",
        receivedAt: "2000-01-01T00:00:00.100Z",
      };

      const res = engine.evaluate({ profile: BASE_PROFILE, manifest: FIXTURE_MANIFEST, event: oldEvent });
      expect(res.success && res.results[0]?.status === "accepted").toBe(true);
      expect(repo.ruleCooldowns.get("rule_gift_01")).toBe(1_000);
    });
  });

  describe("G. Restart Durability & Token Refill", () => {
    it("durable budget state persists across engine instances", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine1 = new MappingEngine(repo, { now: () => 1_000 });

      engine1.evaluate({ profile: BASE_PROFILE, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });

      const engine2 = new MappingEngine(repo, { now: () => 1_500 });
      const res = engine2.evaluate({ profile: BASE_PROFILE, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(repo.userWindows.get("prof_milestone_02\u001frule_gift_01\u001fid:usr_canonical_001")).toHaveLength(2);
      }
    });

    it("global token bucket refills proportionally up to burst cap", () => {
      const repo = new TestLocalDurableBudgetRepository();
      let currentTime = 1_000;
      const engine = new MappingEngine(repo, { now: () => currentTime });

      const giftRuleHighLimits: MappingRule = {
        ...VALID_GIFT_RULE,
        controls: {
          ...VALID_GIFT_RULE.controls,
          maxActionsPerMinute: 100,
          maxActionsPerUserPerMinute: 100,
        },
      };

      const profile: MappingProfile = {
        ...BASE_PROFILE,
        globalActionBudget: {
          maxPerSecond: 10,
          burst: 10,
          overflowPolicy: "reject_newest",
          deferredTtlMs: null,
        },
        rules: [giftRuleHighLimits],
      };

      for (let i = 0; i < 10; i++) {
        engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      }
      expect(repo.globalTokens).toBe(0);

      currentTime = 1_500; // 0.5s elapsed -> refills 5 tokens
      engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      expect(repo.globalTokens).toBe(4);
    });
  });

  describe("H. Deferred Result Boundary", () => {
    it("queue_with_ttl returns typed deferred result with exact absolute expiry and no transport send", () => {
      const repo = new TestLocalDurableBudgetRepository();
      repo.globalTokens = 0; // force global limit rejection

      const now = 10_000;
      const engine = new MappingEngine(repo, { now: () => now });

      const profile: MappingProfile = {
        ...BASE_PROFILE,
        globalActionBudget: {
          maxPerSecond: 1,
          burst: 1,
          overflowPolicy: "queue_with_ttl",
          deferredTtlMs: 5_000,
        },
      };

      const res = engine.evaluate({ profile, manifest: FIXTURE_MANIFEST, event: CANONICAL_GIFT_SENT_EVENT });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results[0]?.status).toBe("deferred");
        if (res.results[0]?.status === "deferred") {
          expect(res.results[0].expiresAt).toBe(15_000);
          expect(res.results[0].reason).toBe("GLOBAL_LIMIT");
        }
      }
    });
  });

  describe("I. Bounded-State Behavior", () => {
    it("exhaustion fails closed with CAPACITY_EXHAUSTED when user buckets exceed capacity", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const smallCapacityProfile: MappingProfile = {
        ...BASE_PROFILE,
        capacity: {
          maxUserBuckets: 2,
          inactiveRetentionMs: 600_000,
          sweepLimit: 10,
        },
      };

      const eventUser1 = { ...CANONICAL_CHAT_COMMENT_EVENT, user: { ...CANONICAL_CHAT_COMMENT_EVENT.user!, id: "usr_1" } };
      const eventUser2 = { ...CANONICAL_CHAT_COMMENT_EVENT, user: { ...CANONICAL_CHAT_COMMENT_EVENT.user!, id: "usr_2" } };
      const eventUser3 = { ...CANONICAL_CHAT_COMMENT_EVENT, user: { ...CANONICAL_CHAT_COMMENT_EVENT.user!, id: "usr_3" } };

      engine.evaluate({ profile: smallCapacityProfile, manifest: FIXTURE_MANIFEST, event: eventUser1 });
      engine.evaluate({ profile: smallCapacityProfile, manifest: FIXTURE_MANIFEST, event: eventUser2 });

      const res3 = engine.evaluate({ profile: smallCapacityProfile, manifest: FIXTURE_MANIFEST, event: eventUser3 });
      expect(res3.success).toBe(true);
      if (res3.success) {
        expect(res3.results[0]?.status).toBe("rejected");
        if (res3.results[0]?.status === "rejected") {
          expect(res3.results[0].reason).toBe("CAPACITY_EXHAUSTED");
        }
      }
    });
  });

  describe("J. Phase B Normalized-Event Compatibility & Invalid Config", () => {
    it("maps Phase B gift streak update correctly without inventing new semantics", () => {
      const repo = new TestLocalDurableBudgetRepository();
      const engine = new MappingEngine(repo, { now: () => 1_000 });

      const res = engine.evaluate({
        profile: BASE_PROFILE,
        manifest: FIXTURE_MANIFEST,
        event: GIFT_STREAK_UPDATE_EVENT,
        dryRun: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results[0]?.candidate.params).toEqual({
          amount: 5,
          owner: "Canonical Viewer",
        });
      }
    });

    it("rejects all invalid profile schemas defined in fixtures", () => {
      for (const [key, invalidProfile] of Object.entries(INVALID_PROFILE_CASES)) {
        const parseResult = MappingProfileSchema.safeParse(invalidProfile);
        expect(parseResult.success, `Expected ${key} to fail validation`).toBe(false);
      }
    });
  });
});
