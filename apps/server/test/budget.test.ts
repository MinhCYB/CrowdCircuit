import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BudgetAdmissionRequest } from "@crowdcircuit/mapping-engine";
import { SqliteDurableActionRepository } from "@crowdcircuit/server";

const directories: string[] = [];
const databaseFile = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-budget-"));
  directories.push(directory);
  return join(directory, "budget.sqlite");
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const request = (
  now: number,
  userKey = "profile\u001frule\u001fid:user",
  overrides: Partial<BudgetAdmissionRequest> = {},
): BudgetAdmissionRequest => ({
  candidate: {
    idempotencySeed: `seed-${now}-${userKey}`,
    seedInput: {
      seedFormatVersion: 1,
      gameProfileId: "profile",
      ruleId: "rule",
      eventId: `event-${now}`,
      candidateOrdinal: 0,
      actionType: "SPAWN",
      params: { amount: 1 },
    },
    gameProfileId: "profile",
    gameId: "game",
    ruleId: "rule",
    eventId: `event-${now}`,
    eventType: "gift.sent",
    candidateOrdinal: 0,
    actionType: "SPAWN",
    params: { amount: 1 },
    actor: null,
    userBudgetKey: userKey,
    priority: 1,
    actionPriority: 1,
    ttlMs: 5_000,
  },
  now,
  userLimitPerMinute: 1,
  ruleLimitPerMinute: 100,
  cooldownMs: 0,
  globalBudget: {
    maxPerSecond: 100,
    burst: 100,
    overflowPolicy: "reject_newest",
    deferredTtlMs: null,
  },
  capacity: {
    maxUserBuckets: 10,
    inactiveRetentionMs: 60_000,
    sweepLimit: 2,
  },
  ...overrides,
});

describe("durable atomic budget repository", () => {
  it("uses exact sliding-window boundaries", () => {
    const repository = SqliteDurableActionRepository.open({ filename: databaseFile() });
    expect(repository.admit(request(100_000))).toEqual({ admitted: true });
    expect(repository.admit(request(159_999))).toEqual({
      admitted: false,
      reason: "USER_LIMIT",
    });
    expect(repository.admit(request(160_000))).toEqual({ admitted: true });
    repository.close();
  });

  it("does not consume user or rule capacity on final global rejection", () => {
    const repository = SqliteDurableActionRepository.open({ filename: databaseFile() });
    const limited = {
      maxPerSecond: 1,
      burst: 1,
      overflowPolicy: "reject_newest",
      deferredTtlMs: null,
    } as const;
    expect(repository.admit(request(100_000, "first", { globalBudget: limited }))).toEqual({
      admitted: true,
    });
    expect(repository.admit(request(100_000, "second", { globalBudget: limited }))).toEqual({
      admitted: false,
      reason: "GLOBAL_LIMIT",
    });
    expect(repository.admit(request(101_000, "second", { globalBudget: limited }))).toEqual({
      admitted: true,
    });
    repository.close();
  });

  it("preserves limits across restart and fences the stale runtime", () => {
    const filename = databaseFile();
    const first = SqliteDurableActionRepository.open({ filename });
    expect(first.admit(request(100_000))).toEqual({ admitted: true });
    const second = SqliteDurableActionRepository.open({ filename });
    second.reconcilePreviousRuntime("runtime-2", 100_001);
    expect(second.admit(request(100_001))).toEqual({
      admitted: false,
      reason: "USER_LIMIT",
    });
    expect(first.admit(request(160_000))).toEqual({
      admitted: false,
      reason: "PERSISTENCE_UNAVAILABLE",
    });
    first.close();
    second.close();
  });

  it("fails closed on clock rollback", () => {
    const repository = SqliteDurableActionRepository.open({ filename: databaseFile() });
    expect(repository.admit(request(100_000))).toEqual({ admitted: true });
    expect(repository.admit(request(99_999, "other"))).toEqual({
      admitted: false,
      reason: "CLOCK_ROLLBACK",
    });
    repository.close();
  });

  it("rejects all-live capacity and admits after deterministic expiry cleanup", () => {
    const repository = SqliteDurableActionRepository.open({ filename: databaseFile() });
    const capacity = {
      maxUserBuckets: 1,
      inactiveRetentionMs: 60_000,
      sweepLimit: 1,
    };
    expect(repository.admit(request(100_000, "first", { capacity }))).toEqual({
      admitted: true,
    });
    expect(repository.admit(request(100_001, "second", { capacity }))).toEqual({
      admitted: false,
      reason: "CAPACITY_EXHAUSTED",
    });
    expect(repository.admit(request(160_001, "second", { capacity }))).toEqual({
      admitted: true,
    });
    repository.close();
  });

  it("rolls back every scope when the transaction commit path fails", () => {
    let fail = true;
    const repository = SqliteDurableActionRepository.open({
      filename: databaseFile(),
      transactionFault(operation) {
        if (operation === "budget" && fail) {
          fail = false;
          throw new Error("simulated");
        }
      },
    });
    expect(repository.admit(request(100_000))).toEqual({
      admitted: false,
      reason: "PERSISTENCE_UNAVAILABLE",
    });
    expect(repository.admit(request(100_000))).toEqual({ admitted: true });
    repository.close();
  });
});
