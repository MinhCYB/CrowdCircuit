import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import type { BudgetAdmissionRequest, MappingCandidate } from "@crowdcircuit/mapping-engine";
import { SqliteDurableActionRepository } from "../src/persistence/repository.js";

const directories: string[] = [];
const temporaryDatabase = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-budget-"));
  directories.push(directory);
  return join(directory, "test.sqlite");
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const makeCandidate = (overrides?: Partial<MappingCandidate>): MappingCandidate => ({
  idempotencySeed: "seed_1",
  seedInput: {
    seedFormatVersion: 1,
    gameProfileId: "prof_1",
    ruleId: "rule_1",
    eventId: "evt_1",
    candidateOrdinal: 0,
    actionType: "SPAWN",
    params: {},
  },
  gameProfileId: "prof_1",
  gameId: "game_1",
  ruleId: "rule_1",
  eventId: "evt_1",
  eventType: "chat.comment",
  candidateOrdinal: 0,
  actionType: "SPAWN",
  params: {},
  actor: null,
  userBudgetKey: "key_1",
  priority: 10,
  actionPriority: 10,
  ttlMs: 5000,
  ...overrides,
});

const runConcurrentAdmission = async (
  filename: string,
  leftRequest: BudgetAdmissionRequest,
  rightRequest: BudgetAdmissionRequest,
): Promise<readonly { readonly type: string; readonly admission?: unknown; readonly code?: string }[]> => {
  const workerUrl = new URL("./budget-concurrency-worker.ts", import.meta.url);
  const tsxLoader = pathToFileURL(
    createRequire(import.meta.url).resolve("tsx"),
  ).href;
  const workers = [leftRequest, rightRequest].map(
    (request) =>
      new Worker(workerUrl, {
        execArgv: ["--import", tsxLoader],
        workerData: { filename, request },
      }),
  );
  await Promise.all(
    workers.map(
      (worker) =>
        new Promise<void>((resolve, reject) => {
          worker.once("error", reject);
          worker.once("message", (message) => {
            if (Reflect.get(Object(message), "type") === "ready") resolve();
          });
        }),
    ),
  );
  const results = workers.map(
    (worker) =>
      new Promise<{ readonly type: string; readonly admission?: unknown; readonly code?: string }>(
        (resolve, reject) => {
          worker.once("error", reject);
          worker.once("message", (msg) => resolve(msg as { readonly type: string; readonly admission?: unknown; readonly code?: string }));
          worker.postMessage({ type: "go" });
        },
      ),
  );
  const resolved = await Promise.all(results);
  await Promise.all(workers.map((worker) => worker.terminate()));
  return resolved;
};

describe("Genuine SQLite budget admission concurrency", () => {
  it("A. enforces final per-user window slot under contention", async () => {
    const filename = temporaryDatabase();
    // Initialize schema
    SqliteDurableActionRepository.open({ filename }).close();

    const request: BudgetAdmissionRequest = {
      candidate: makeCandidate({ userBudgetKey: "user_user1" }),
      now: 100_000,
      userLimitPerMinute: 1,
      ruleLimitPerMinute: 10,
      cooldownMs: 0,
      globalBudget: { maxPerSecond: 10, burst: 10, overflowPolicy: "drop_low_priority" },
      capacity: { maxUserBuckets: 100, inactiveRetentionMs: 60_000, sweepLimit: 50 },
    };

    const results = await runConcurrentAdmission(filename, request, request);
    const admissions = results.map((r) => r.admission as { admitted: boolean; reason?: string });

    const admittedCount = admissions.filter((a) => a.admitted).length;
    const userLimitCount = admissions.filter((a) => !a.admitted && a.reason === "USER_LIMIT").length;

    expect(admittedCount).toBe(1);
    expect(userLimitCount).toBe(1);

    // Direct DB inspection
    const db = new DatabaseSync(filename);
    const userEvents = db.prepare("SELECT COUNT(*) AS count FROM mapping_budget_user_events").get();
    const ruleEvents = db.prepare("SELECT COUNT(*) AS count FROM mapping_budget_rule_events").get();
    const cooldowns = db.prepare("SELECT COUNT(*) AS count FROM mapping_budget_cooldowns").get();
    const tokensRow = db.prepare("SELECT tokens FROM mapping_budget_game_tokens WHERE profile_id = ?").get("prof_1");

    expect(Reflect.get(userEvents ?? {}, "count")).toBe(1);
    expect(Reflect.get(ruleEvents ?? {}, "count")).toBe(1);
    expect(Reflect.get(cooldowns ?? {}, "count")).toBe(1);
    expect(Reflect.get(tokensRow ?? {}, "tokens")).toBe(9); // burst (10) - 1
    db.close();
  });

  it("B. enforces shared anonymous bucket under contention without duplicate rows", async () => {
    const filename = temporaryDatabase();
    SqliteDurableActionRepository.open({ filename }).close();

    const request: BudgetAdmissionRequest = {
      candidate: makeCandidate({ userBudgetKey: "anon_key" }),
      now: 100_000,
      userLimitPerMinute: 1,
      ruleLimitPerMinute: 10,
      cooldownMs: 0,
      globalBudget: { maxPerSecond: 10, burst: 10, overflowPolicy: "drop_low_priority" },
      capacity: { maxUserBuckets: 100, inactiveRetentionMs: 60_000, sweepLimit: 50 },
    };

    const results = await runConcurrentAdmission(filename, request, request);
    const admissions = results.map((r) => r.admission as { admitted: boolean; reason?: string });

    expect(admissions.filter((a) => a.admitted).length).toBe(1);
    expect(admissions.filter((a) => !a.admitted && a.reason === "USER_LIMIT").length).toBe(1);

    const db = new DatabaseSync(filename);
    const userBuckets = db.prepare("SELECT COUNT(*) AS count FROM mapping_budget_user_buckets").get();
    const userEvents = db.prepare("SELECT COUNT(*) AS count FROM mapping_budget_user_events").get();

    expect(Reflect.get(userBuckets ?? {}, "count")).toBe(1);
    expect(Reflect.get(userEvents ?? {}, "count")).toBe(1);
    db.close();
  });

  it("C. enforces rule cooldown under contention", async () => {
    const filename = temporaryDatabase();
    SqliteDurableActionRepository.open({ filename }).close();

    const request: BudgetAdmissionRequest = {
      candidate: makeCandidate({ userBudgetKey: "user_a" }),
      now: 100_000,
      userLimitPerMinute: 10,
      ruleLimitPerMinute: 10,
      cooldownMs: 5000,
      globalBudget: { maxPerSecond: 10, burst: 10, overflowPolicy: "drop_low_priority" },
      capacity: { maxUserBuckets: 100, inactiveRetentionMs: 60_000, sweepLimit: 50 },
    };

    const results = await runConcurrentAdmission(filename, request, request);
    const admissions = results.map((r) => r.admission as { admitted: boolean; reason?: string });

    expect(admissions.filter((a) => a.admitted).length).toBe(1);
    expect(admissions.filter((a) => !a.admitted && a.reason === "RULE_COOLDOWN").length).toBe(1);

    const db = new DatabaseSync(filename);
    const cooldownRow = db.prepare("SELECT last_accepted_at FROM mapping_budget_cooldowns WHERE profile_id = ? AND rule_id = ?").get("prof_1", "rule_1");
    expect(Reflect.get(cooldownRow ?? {}, "last_accepted_at")).toBe(100_000);
    db.close();
  });

  it("D. enforces final rule-window slot under contention", async () => {
    const filename = temporaryDatabase();
    SqliteDurableActionRepository.open({ filename }).close();

    const req1: BudgetAdmissionRequest = {
      candidate: makeCandidate({ userBudgetKey: "user_d1" }),
      now: 100_000,
      userLimitPerMinute: 10,
      ruleLimitPerMinute: 1,
      cooldownMs: 0,
      globalBudget: { maxPerSecond: 10, burst: 10, overflowPolicy: "drop_low_priority" },
      capacity: { maxUserBuckets: 100, inactiveRetentionMs: 60_000, sweepLimit: 50 },
    };
    const req2: BudgetAdmissionRequest = {
      ...req1,
      candidate: makeCandidate({ userBudgetKey: "user_d2" }),
    };

    const results = await runConcurrentAdmission(filename, req1, req2);
    const admissions = results.map((r) => r.admission as { admitted: boolean; reason?: string });

    expect(admissions.filter((a) => a.admitted).length).toBe(1);
    expect(admissions.filter((a) => !a.admitted && a.reason === "RULE_LIMIT").length).toBe(1);

    const db = new DatabaseSync(filename);
    const ruleEvents = db.prepare("SELECT COUNT(*) AS count FROM mapping_budget_rule_events").get();
    expect(Reflect.get(ruleEvents ?? {}, "count")).toBe(1);
    db.close();
  });

  it("E. enforces final global token under contention", async () => {
    const filename = temporaryDatabase();
    SqliteDurableActionRepository.open({ filename }).close();

    const req1: BudgetAdmissionRequest = {
      candidate: makeCandidate({ userBudgetKey: "user_e1" }),
      now: 100_000,
      userLimitPerMinute: 10,
      ruleLimitPerMinute: 10,
      cooldownMs: 0,
      globalBudget: { maxPerSecond: 1, burst: 1, overflowPolicy: "drop_low_priority" },
      capacity: { maxUserBuckets: 100, inactiveRetentionMs: 60_000, sweepLimit: 50 },
    };
    const req2: BudgetAdmissionRequest = {
      ...req1,
      candidate: makeCandidate({ userBudgetKey: "user_e2" }),
    };

    const results = await runConcurrentAdmission(filename, req1, req2);
    const admissions = results.map((r) => r.admission as { admitted: boolean; reason?: string });

    expect(admissions.filter((a) => a.admitted).length).toBe(1);
    expect(admissions.filter((a) => !a.admitted && a.reason === "GLOBAL_LIMIT").length).toBe(1);

    const db = new DatabaseSync(filename);
    const tokenRow = db.prepare("SELECT tokens FROM mapping_budget_game_tokens WHERE profile_id = ?").get("prof_1");
    expect(Reflect.get(tokenRow ?? {}, "tokens")).toBe(0);
    db.close();
  });

  it("F. enforces final tracked-user capacity slot under contention", async () => {
    const filename = temporaryDatabase();
    SqliteDurableActionRepository.open({ filename }).close();

    const req1: BudgetAdmissionRequest = {
      candidate: makeCandidate({ userBudgetKey: "user_f1" }),
      now: 100_000,
      userLimitPerMinute: 10,
      ruleLimitPerMinute: 10,
      cooldownMs: 0,
      globalBudget: { maxPerSecond: 10, burst: 10, overflowPolicy: "drop_low_priority" },
      capacity: { maxUserBuckets: 1, inactiveRetentionMs: 60_000, sweepLimit: 50 },
    };
    const req2: BudgetAdmissionRequest = {
      ...req1,
      candidate: makeCandidate({ userBudgetKey: "user_f2" }),
    };

    const results = await runConcurrentAdmission(filename, req1, req2);
    const admissions = results.map((r) => r.admission as { admitted: boolean; reason?: string });

    expect(admissions.filter((a) => a.admitted).length).toBe(1);
    expect(admissions.filter((a) => !a.admitted && a.reason === "CAPACITY_EXHAUSTED").length).toBe(1);

    const db = new DatabaseSync(filename);
    const userBuckets = db.prepare("SELECT COUNT(*) AS count FROM mapping_budget_user_buckets").get();
    expect(Reflect.get(userBuckets ?? {}, "count")).toBe(1);

    // Verify rejected identity has no row in user_buckets or user_events
    const admittedUserKey = (admissions.find((a) => a.admitted) as unknown) ? (results[0].admission && (results[0].admission as { admitted: boolean }).admitted ? "user_f1" : "user_f2") : null;
    const rejectedUserKey = admittedUserKey === "user_f1" ? "user_f2" : "user_f1";

    const rejectedBucket = db.prepare("SELECT * FROM mapping_budget_user_buckets WHERE user_key = ?").get(rejectedUserKey);
    const rejectedEvents = db.prepare("SELECT * FROM mapping_budget_user_events WHERE user_key = ?").get(rejectedUserKey);

    expect(rejectedBucket).toBeUndefined();
    expect(rejectedEvents).toBeUndefined();
    db.close();
  });
});
