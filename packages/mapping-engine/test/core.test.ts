import { describe, expect, it } from "vitest";
import {
  CANONICAL_CHAT_COMMENT_EVENT,
  CANONICAL_ENGAGEMENT_LIKE_EVENT,
  CANONICAL_GIFT_SENT_EVENT,
} from "@crowdcircuit/contracts/fixtures";
import {
  canonicalJson,
  MappingEngine,
  MappingProfileSchema,
  createCandidateSeed,
  type BudgetAdmissionRequest,
  type BudgetAdmissionResult,
  type DurableBudgetRepository,
  type MappingProfile,
} from "@crowdcircuit/mapping-engine";

class RecordingBudget implements DurableBudgetRepository {
  readonly requests: BudgetAdmissionRequest[] = [];
  result: BudgetAdmissionResult = { admitted: true };

  admit(request: BudgetAdmissionRequest): BudgetAdmissionResult {
    this.requests.push(request);
    return this.result;
  }
}

const manifest = {
  gameId: "zombie",
  actions: {
    SPAWN: {
      parameters: { amount: "number", owner: "string" },
      allowAdditionalParameters: false,
    },
    CHEER: {
      parameters: { message: "string" },
      allowAdditionalParameters: false,
    },
  },
};

const rule = (
  id: string,
  priority: number,
  createdAt: string,
  actionType = "SPAWN",
) => ({
  id,
  name: id,
  enabled: true,
  priority,
  exclusiveGroup: null,
  eventType: "gift.sent",
  conditions: [{ field: "payload.gift.id", operator: "eq", value: "gift_rose" }],
  transform: {
    actionType,
    parameters:
      actionType === "SPAWN"
        ? { amount: "{{payload.quantity}}", owner: "{{user.displayName}}" }
        : { message: "gift from {{user.displayName}}" },
  },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 10,
    maxActionsPerUserPerMinute: 5,
    aggregationWindowMs: 0,
    actionPriority: 60,
    ttlMs: 5_000,
  },
  createdAt,
});

const profile = (rules: readonly ReturnType<typeof rule>[]): MappingProfile => ({
  gameProfileId: "profile",
  gameId: "zombie",
  matchMode: "all",
  globalActionBudget: {
    maxPerSecond: 30,
    burst: 50,
    overflowPolicy: "drop_low_priority",
    deferredTtlMs: null,
  },
  capacity: {
    maxUserBuckets: 10,
    inactiveRetentionMs: 60_000,
    sweepLimit: 2,
  },
  rules: [...rules],
});

describe("mapping public configuration", () => {
  it("rejects duplicate rules, invalid regex, unsafe limits, and short retention", () => {
    const duplicate = profile([
      rule("same", 1, "2026-01-01T00:00:00.000Z"),
      rule("same", 2, "2026-01-01T00:00:01.000Z"),
    ]);
    expect(MappingProfileSchema.safeParse(duplicate).success).toBe(false);
    expect(
      MappingProfileSchema.safeParse({
        ...profile([]),
        rules: [
          {
            ...rule("regex", 1, "2026-01-01T00:00:00.000Z"),
            conditions: [{ field: "payload.text", operator: "regex", value: "[" }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      MappingProfileSchema.safeParse({
        ...profile([]),
        globalActionBudget: {
          maxPerSecond: Number.NaN,
          burst: 1,
          overflowPolicy: "drop_low_priority",
          deferredTtlMs: null,
        },
      }).success,
    ).toBe(false);
    expect(
      MappingProfileSchema.safeParse({
        ...profile([{
          ...rule("cool", 1, "2026-01-01T00:00:00.000Z"),
          controls: {
            ...rule("base", 1, "2026-01-01T00:00:00.000Z").controls,
            cooldownMs: 120_000,
          },
        }]),
        capacity: { maxUserBuckets: 1, inactiveRetentionMs: 60_000, sweepLimit: 1 },
      }).success,
    ).toBe(false);
  });
});

describe("deterministic mapping", () => {
  it("implements every approved condition operator", () => {
    const cases = [
      { field: "payload.textNormalized", operator: "eq", value: "hello crowdcircuit!" },
      { field: "payload.textNormalized", operator: "neq", value: "goodbye" },
      { field: "payload.textNormalized", operator: "contains", value: "crowd" },
      { field: "payload.textNormalized", operator: "startsWith", value: "hello" },
      { field: "payload.textNormalized", operator: "regex", value: "^hello" },
      { field: "payload.textNormalized", operator: "in", value: ["hello crowdcircuit!", "other"] },
      { field: "payload.delta", operator: "gt", value: 49 },
      { field: "payload.delta", operator: "gte", value: 50 },
      { field: "payload.delta", operator: "lt", value: 51 },
      { field: "payload.delta", operator: "lte", value: 50 },
    ] as const;
    for (const condition of cases) {
      const budget = new RecordingBudget();
      const engine = new MappingEngine(budget, { now: () => 1_000 });
      const isNumeric = ["gt", "gte", "lt", "lte"].includes(condition.operator);
      const configuredRule = {
        ...rule("operator", 1, "2026-01-01T00:00:00.000Z", "CHEER"),
        eventType: isNumeric ? "engagement.like" : "chat.comment",
        conditions: [condition],
        transform: { actionType: "CHEER", parameters: { message: "matched" } },
      };
      const result = engine.evaluate({
        profile: profile([configuredRule]),
        manifest,
        event: isNumeric
          ? CANONICAL_ENGAGEMENT_LIKE_EVENT
          : CANONICAL_CHAT_COMMENT_EVENT,
        dryRun: true,
      });
      expect(result.success, condition.operator).toBe(true);
      if (result.success) expect(result.results, condition.operator).toHaveLength(1);
    }
  });

  it("orders rules deterministically and distinguishes identical outputs by rule", () => {
    const budget = new RecordingBudget();
    const engine = new MappingEngine(budget, { now: () => 1_000 });
    const input = {
      profile: profile([
        rule("later", 10, "2026-01-02T00:00:00.000Z"),
        rule("earlier-b", 10, "2026-01-01T00:00:00.000Z"),
        rule("earlier-a", 10, "2026-01-01T00:00:00.000Z"),
      ]),
      manifest,
      event: CANONICAL_GIFT_SENT_EVENT,
    };
    const first = engine.evaluate(input);
    const second = engine.evaluate(input);
    expect(first).toEqual(second);
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.results.map((result) => result.candidate.ruleId)).toEqual([
      "earlier-a",
      "earlier-b",
      "later",
    ]);
    expect(new Set(first.results.map((result) => result.candidate.idempotencySeed)).size).toBe(3);
  });

  it("applies first and exclusive-group before budget admission", () => {
    const budget = new RecordingBudget();
    const engine = new MappingEngine(budget, { now: () => 1_000 });
    const firstProfile = { ...profile([
      rule("a", 2, "2026-01-01T00:00:00.000Z"),
      rule("b", 1, "2026-01-01T00:00:00.000Z"),
    ]), matchMode: "first" };
    expect(engine.evaluate({ profile: firstProfile, manifest, event: CANONICAL_GIFT_SENT_EVENT }).success).toBe(true);
    expect(budget.requests).toHaveLength(1);

    budget.requests.length = 0;
    const groupedRules = [
      { ...rule("a", 2, "2026-01-01T00:00:00.000Z"), exclusiveGroup: "spawn" },
      { ...rule("b", 1, "2026-01-01T00:00:00.000Z"), exclusiveGroup: "spawn" },
    ];
    const grouped = { ...profile(groupedRules), matchMode: "exclusive_group" };
    expect(engine.evaluate({ profile: grouped, manifest, event: CANONICAL_GIFT_SENT_EVENT }).success).toBe(true);
    expect(budget.requests).toHaveLength(1);
  });

  it("resolves comment templates and does not consume budget during dry run", () => {
    const budget = new RecordingBudget();
    const engine = new MappingEngine(budget, { now: () => 1_000 });
    const commentRule = {
      ...rule("comment", 1, "2026-01-01T00:00:00.000Z", "CHEER"),
      eventType: "chat.comment",
      conditions: [{ field: "payload.textNormalized", operator: "startsWith", value: "hello" }],
      transform: { actionType: "CHEER", parameters: { message: "{{payload.text}}" } },
    };
    const result = engine.evaluate({
      profile: profile([commentRule]),
      manifest,
      event: CANONICAL_CHAT_COMMENT_EVENT,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(budget.requests).toHaveLength(0);
    if (!result.success) return;
    expect(result.results[0]?.candidate.params).toEqual({ message: "Hello CrowdCircuit!" });
  });

  it("uses a shared anonymous key without fabricating identity", () => {
    const budget = new RecordingBudget();
    const engine = new MappingEngine(budget, { now: () => 1_000 });
    const likeRule = {
      ...rule("like", 1, "2026-01-01T00:00:00.000Z", "CHEER"),
      eventType: "engagement.like",
      conditions: [],
      transform: { actionType: "CHEER", parameters: { message: "likes" } },
    };
    const event = { ...CANONICAL_ENGAGEMENT_LIKE_EVENT, user: null };
    engine.evaluate({ profile: profile([likeRule]), manifest, event });
    expect(budget.requests[0]?.candidate.userBudgetKey).toBe(
      canonicalJson({
        gameProfileId: "profile",
        identity: { kind: "anonymous", value: null },
        keyFormatVersion: 1,
        ruleId: "like",
      }),
    );
  });

  it("accepts normalized gift streak updates without adding streak semantics", () => {
    const budget = new RecordingBudget();
    const engine = new MappingEngine(budget, { now: () => 1_000 });
    const event = {
      ...CANONICAL_GIFT_SENT_EVENT,
      payload: {
        ...CANONICAL_GIFT_SENT_EVENT.payload,
        quantity: 2,
        totalQuantity: 3,
        streak: {
          id: "streak_canonical_001",
          status: "update",
        },
      },
    };
    const result = engine.evaluate({
      profile: profile([rule("gift", 1, "2026-01-01T00:00:00.000Z")]),
      manifest,
      event,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.results[0]?.candidate.params).toEqual({
        amount: 2,
        owner: "Canonical Viewer",
      });
    }
  });

  it("maps global overflow to dropped, rejected, or deferred without queueing", () => {
    const budget = new RecordingBudget();
    budget.result = { admitted: false, reason: "GLOBAL_LIMIT" };
    let now = 10_000;
    const engine = new MappingEngine(budget, { now: () => now });
    for (const overflowPolicy of [
      "drop_low_priority",
      "reject_newest",
      "queue_with_ttl",
    ] as const) {
      const configured = {
        ...profile([rule("gift", 1, "2026-01-01T00:00:00.000Z")]),
        globalActionBudget: {
          maxPerSecond: 1,
          burst: 1,
          overflowPolicy,
          deferredTtlMs: overflowPolicy === "queue_with_ttl" ? 5_000 : null,
        },
      };
      const result = engine.evaluate({
        profile: configured,
        manifest,
        event: CANONICAL_GIFT_SENT_EVENT,
      });
      expect(result.success).toBe(true);
      if (!result.success) continue;
      expect(result.results[0]?.status).toBe(
        overflowPolicy === "drop_low_priority"
          ? "dropped"
          : overflowPolicy === "reject_newest"
            ? "rejected"
            : "deferred",
      );
      if (result.results[0]?.status === "deferred") {
        expect(result.results[0].expiresAt).toBe(now + 5_000);
      }
      now += 1;
    }
  });

  it("rejects invalid manifest output and keeps seed stable without timestamps", () => {
    const budget = new RecordingBudget();
    const engine = new MappingEngine(budget, { now: () => 1 });
    const result = engine.evaluate({
      profile: profile([rule("gift", 1, "2026-01-01T00:00:00.000Z")]),
      manifest: { ...manifest, actions: {} },
      event: CANONICAL_GIFT_SENT_EVENT,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.results).toHaveLength(0);
    const seedInput = {
      seedFormatVersion: 1,
      gameProfileId: "p",
      ruleId: "r",
      eventId: "e",
      candidateOrdinal: 0,
      actionType: "A",
      params: { b: 2, a: 1 },
    } as const;
    expect(createCandidateSeed(seedInput)).toBe(
      createCandidateSeed({ ...seedInput, params: { a: 1, b: 2 } }),
    );
  });
});
