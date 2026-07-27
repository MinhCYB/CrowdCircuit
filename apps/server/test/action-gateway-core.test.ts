import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import type { MappingCandidate } from "@crowdcircuit/mapping-engine";
import { afterEach, describe, expect, it } from "vitest";
import {
  ActionGateway,
  computeActionId,
  MAX_SEND_ATTEMPTS,
  PersistenceError,
  SqliteDurableActionRepository,
  type BudgetAdmissionSnapshot,
} from "../src/index.js";
import { FakeActionDeliveryPort } from "./support/fake-action-delivery-port.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function repository(transactionFault?: () => void) {
  const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-m3-"));
  directories.push(directory);
  return SqliteDurableActionRepository.open({
    filename: join(directory, "database.sqlite"),
    transactionFault: transactionFault === undefined
      ? undefined
      : (operation, phase) => {
          if (operation === "budget" && phase === "before_commit") transactionFault();
        },
  });
}

const candidate: MappingCandidate = {
  idempotencySeed: "m2:v1:core-candidate",
  seedInput: {
    seedFormatVersion: 1,
    gameProfileId: "profile",
    ruleId: "rule",
    eventId: "event",
    candidateOrdinal: 0,
    actionType: "SPAWN",
    params: { count: 1 },
  },
  gameProfileId: "profile",
  gameId: "game",
  ruleId: "rule",
  eventId: "event",
  eventType: "gift.sent",
  candidateOrdinal: 0,
  actionType: "SPAWN",
  params: { count: 1 },
  actor: null,
  userBudgetKey: "viewer",
  priority: 7,
  actionPriority: 9,
  ttlMs: 30_000,
};

const snapshot: BudgetAdmissionSnapshot = {
  gameProfileId: "profile",
  ruleId: "rule",
  userBudgetKey: "viewer",
  userLimit: { limitPerMinute: 2 },
  cooldownMs: 0,
  ruleLimit: { limitPerMinute: 2 },
  globalToken: { maxPerSecond: 1, burst: 1 },
  capacityConfig: {
    maxUserBuckets: 8,
    inactiveRetentionMs: 60_000,
    sweepLimit: 8,
  },
};

describe("Phase C Milestone 3 core", () => {
  it("derives versioned deterministic 128-bit action IDs", () => {
    expect(computeActionId(candidate.idempotencySeed)).toMatch(/^act_[0-9a-f]{32}$/);
    expect(computeActionId(candidate.idempotencySeed)).toBe(
      computeActionId(candidate.idempotencySeed),
    );
    expect(computeActionId(`${candidate.idempotencySeed}:other`)).not.toBe(
      computeActionId(candidate.idempotencySeed),
    );
  });

  it("creates durably but allocates no attempt or authorization when no destination exists", async () => {
    const store = repository();
    const port = new FakeActionDeliveryPort();
    let now = 1_000;
    const gateway = new ActionGateway(store, port, { now: () => now }, "runtime");
    const ingested = gateway.ingest({ status: "accepted", candidate });
    expect(ingested.status).toBe("action");
    if (ingested.status !== "action") throw new Error("action expected");

    const scheduled = await gateway.deliver(ingested.record, ingested.candidate);
    expect(store.listAttempts(ingested.record.actionId)).toEqual([]);
    expect(port.sentDeliveries).toEqual([]);
    expect(scheduled.status).toBe("pending");
    expect(scheduled.nextAttemptAt).toBe(2_000);
    now += 1;
    store.close();
  });

  it("commits send_started before invoking the port and persists transport failures", async () => {
    const store = repository();
    const port = new FakeActionDeliveryPort();
    port.queueResolution({
      status: "available",
      destination: { clientId: "game", gameInstanceId: "instance" },
    });
    port.queueOutcome({ status: "transport_error", error: "offline" });
    const gateway = new ActionGateway(store, port, { now: () => 1_000 }, "runtime");
    const ingested = gateway.ingest({ status: "accepted", candidate });
    if (ingested.status !== "action") throw new Error("action expected");

    const scheduled = await gateway.deliver(ingested.record, ingested.candidate);
    expect(port.sentDeliveries).toHaveLength(1);
    expect(store.listAttempts(ingested.record.actionId)).toEqual([
      expect.objectContaining({
        attemptNumber: 1,
        outcome: "send_started",
        gameInstanceId: "instance",
      }),
    ]);
    expect(scheduled.status).toBe("in_flight");
    expect(scheduled.failureCode).toBe("transport_error");
    store.close();
  });

  it("uses three total attempts, binds every fresh destination, and stops after receipt", async () => {
    const store = repository();
    const port = new FakeActionDeliveryPort();
    for (const instance of ["one", "two", "three"]) {
      port.queueResolution({
        status: "available",
        destination: { clientId: "game", gameInstanceId: instance },
      });
      port.queueOutcome({ status: "transport_error", error: "offline" });
    }
    let now = 1_000;
    const gateway = new ActionGateway(store, port, { now: () => now }, "runtime");
    const ingested = gateway.ingest({ status: "accepted", candidate });
    if (ingested.status !== "action") throw new Error("action expected");
    let current = ingested.record;
    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt += 1) {
      current = await gateway.deliver(current, ingested.candidate);
      now = current.nextAttemptAt ?? now;
    }
    expect(current.status).toBe("delivery_failed");
    expect(store.listAttempts(current.actionId).map((attempt) => attempt.gameInstanceId))
      .toEqual(["one", "two", "three"]);
    expect(port.sentDeliveries).toHaveLength(3);

    const secondCandidate = {
      ...candidate,
      idempotencySeed: `${candidate.idempotencySeed}:received`,
      seedInput: { ...candidate.seedInput, eventId: "event-received" },
      eventId: "event-received",
    };
    port.queueResolution({
      status: "available",
      destination: { clientId: "game", gameInstanceId: "received" },
    });
    port.queueOutcome({ status: "sent" });
    const second = gateway.ingest({ status: "accepted", candidate: secondCandidate });
    if (second.status !== "action") throw new Error("action expected");
    const sent = await gateway.deliver(second.record, second.candidate);
    const received = gateway.markReceived(sent.actionId, now + 1);
    expect(gateway.markReceived(sent.actionId, now + 2)).toEqual(received);
    const completed = gateway.markResult(sent.actionId, "completed", now + 3);
    expect(gateway.markResult(sent.actionId, "completed", now + 4)).toEqual(completed);
    expect(completed.status).toBe("completed");
    store.close();
  });

  it("atomically rolls back full budget admission, action creation, and promotion", () => {
    let fail = true;
    const store = repository(() => {
      if (fail) throw new Error("injected");
    });
    store.enqueueDeferredCandidate({
      candidate,
      deferredExpiresAt: 10_000,
      createdAt: 1_000,
      admissionSnapshot: snapshot,
      runtimeId: "runtime",
    });
    expect(() => store.promoteDeferredCandidate(candidate.idempotencySeed, 2_000))
      .toThrowError(PersistenceError);
    expect(store.findById(computeActionId(candidate.idempotencySeed))).toBeNull();
    expect(store.findDeferredCandidate(candidate.idempotencySeed)?.status).toBe("queued");

    fail = false;
    const result = store.promoteDeferredCandidate(candidate.idempotencySeed, 2_000);
    expect(result.status).toBe("promoted");
    expect(store.findDeferredCandidate(candidate.idempotencySeed)?.status).toBe("promoted");
    expect(store.promoteDeferredCandidate(candidate.idempotencySeed, 2_001).status)
      .toBe("already_promoted");
    store.close();
  });

  it("fails retry destination validation for over-limit and non-string runtime values", () => {
    const store = repository();
    const gateway = new ActionGateway(store, new FakeActionDeliveryPort(), { now: () => 1_000 }, "runtime");
    const ingested = gateway.ingest({ status: "accepted", candidate });
    if (ingested.status !== "action") throw new Error("action expected");
    const auth = store.authorizePending(ingested.record.actionId, 1, "runtime", null);
    store.recordAttempt(auth, { role: "game", clientId: "game", gameInstanceId: null }, 1_000, "send_started");
    const current = store.findById(ingested.record.actionId);
    if (current === null) throw new Error("action expected");

    expect(() => store.authorizeRetry(current.actionId, current.version, "runtime", "x".repeat(257)))
      .toThrowError(PersistenceError);
    expect(() => Reflect.apply(store.authorizeRetry, store, [
      current.actionId,
      current.version,
      "runtime",
      42,
    ])).toThrowError(PersistenceError);
    expect(current.retryCount).toBeLessThan(MAX_SEND_ATTEMPTS);
    store.close();
  });

  it("serializes atomic promotion across independent SQLite handles and worker threads", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-m3-race-"));
    directories.push(directory);
    const filename = join(directory, "database.sqlite");
    const sharedOwnerRandom = () => new Uint8Array(32).fill(73);
    const setup = SqliteDurableActionRepository.open({ filename, runtimeOwnerRandom: sharedOwnerRandom });
    setup.enqueueDeferredCandidate({
      candidate,
      deferredExpiresAt: 10_000,
      createdAt: 1_000,
      admissionSnapshot: snapshot,
      runtimeId: "runtime",
    });
    setup.close();

    const workerUrl = new URL("./deferred-promotion-concurrency-worker.ts", import.meta.url);
    const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
    const workers = Array.from({ length: 6 }, () => new Worker(workerUrl, {
      execArgv: ["--import", tsxLoader],
      workerData: { filename, idempotencySeed: candidate.idempotencySeed, now: 2_000 },
    }));
    await Promise.all(workers.map((worker) => new Promise<void>((resolve, reject) => {
      worker.once("error", reject);
      worker.once("message", (message) => {
        if (Reflect.get(Object(message), "type") === "ready") resolve();
      });
    })));
    const results = await Promise.all(workers.map((worker) => new Promise<unknown>((resolve, reject) => {
      worker.once("error", reject);
      worker.once("message", resolve);
      worker.postMessage({ type: "go" });
    })));
    await Promise.all(workers.map((worker) => worker.terminate()));

    expect(results.filter((result) => Reflect.get(Object(result), "status") === "promoted"))
      .toHaveLength(1);
    expect(results.filter((result) => Reflect.get(Object(result), "status") === "already_promoted"))
      .toHaveLength(5);
    const database = new DatabaseSync(filename);
    expect(Reflect.get(database.prepare("SELECT COUNT(*) AS count FROM action_logs").get() ?? {}, "count"))
      .toBe(1);
    expect(Reflect.get(database.prepare("SELECT COUNT(*) AS count FROM mapping_budget_user_events").get() ?? {}, "count"))
      .toBe(1);
    database.close();
  });
});
