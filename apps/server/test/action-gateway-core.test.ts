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
  ActionLifecycleWorker,
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
      destination: {
        clientId: "client-distinct", gameId: "game",
        gameInstanceId: "instance", sessionGeneration: 1, destinationGeneration: "gen-1",
      },
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
        destination: {
          clientId: `client-${instance}`, gameId: "game",
          gameInstanceId: instance, sessionGeneration: 1, destinationGeneration: `gen-${instance}`,
        },
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
      destination: {
        clientId: "client-received", gameId: "game",
        gameInstanceId: "received", sessionGeneration: 1, destinationGeneration: "gen-received",
      },
    });
    port.queueOutcome({ status: "sent" });
    const second = gateway.ingest({ status: "accepted", candidate: secondCandidate });
    if (second.status !== "action") throw new Error("action expected");
    const sent = await gateway.deliver(second.record, second.candidate);
    now += 1;
    const inboundSession = {
      clientId: "client-received",
      gameId: "game",
      gameInstanceId: "received",
      sessionGeneration: 1,
    };
    const receipt = {
      type: "game.action.received" as const,
      specVersion: "0.1" as const,
      actionId: sent.actionId,
      attemptNumber: 1,
      sessionGeneration: 1,
      receivedAt: new Date(0).toISOString(),
    };
    const received = gateway.handleReceipt(inboundSession, receipt);
    expect(received.status).toBe("accepted");
    expect(gateway.handleReceipt(inboundSession, receipt).status).toBe("idempotent");
    const result = {
      type: "game.action.result" as const,
      specVersion: "0.1" as const,
      actionId: sent.actionId,
      attemptNumber: 1,
      sessionGeneration: 1,
      status: "completed" as const,
      durationMs: 12,
      details: null,
    };
    const completed = gateway.handleResult(inboundSession, result);
    expect(completed.status).toBe("accepted");
    expect(gateway.handleResult(inboundSession, result).status).toBe("idempotent");
    if (completed.status !== "accepted") throw new Error("accepted result expected");
    expect(completed.record.status).toBe("completed");
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
    const binding = { clientId: "client-routing", gameInstanceId: "instance-routing" };
    const auth = store.authorizePending(ingested.record.actionId, 1, "runtime", binding);
    store.recordAttempt(auth, { role: "game", ...binding }, 1_000, "send_started");
    const current = store.findById(ingested.record.actionId);
    if (current === null) throw new Error("action expected");

    expect(() => store.authorizeRetry(current.actionId, current.version, "runtime", {
      clientId: "client-routing",
      gameInstanceId: "x".repeat(257),
    }))
      .toThrowError(PersistenceError);
    expect(() => Reflect.apply(store.authorizeRetry, store, [
      current.actionId,
      current.version,
      "runtime",
      { clientId: "client-routing", gameInstanceId: 42 },
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

  describe("H-2 — Live TTL Worker Coverage", () => {
    it("expires pending actions at exact boundary (expiresAt === now)", () => {
      const store = repository();
      const created = store.createPending({
        actionId: "act_ttl_1",
        idempotencyKey: "seed_ttl_1",
        eventId: "evt_1",
        mappingId: "rule_1",
        gameId: "game_1",
        actionType: "SPAWN",
        params: {},
        priority: 5,
        ttlMs: 1000,
        createdAt: 1000,
        expiresAt: 2000,
        runtimeId: "runtime",
        nextAttemptAt: 1000,
      });
      expect(created.record.status).toBe("pending");

      // Before boundary
      expect(store.expireDue(1999, 128)).toBe(0);
      expect(store.findById("act_ttl_1")?.status).toBe("pending");

      // Exact boundary
      expect(store.expireDue(2000, 128)).toBe(1);
      const expired = store.findById("act_ttl_1");
      expect(expired?.status).toBe("expired");
      expect(expired?.failureCode).toBe("ttl_expired");
      expect(expired?.version).toBe(2);
      store.close();
    });

    it("expires queued deferred candidates at exact boundary and prevents later promotion", () => {
      const store = repository();
      store.enqueueDeferredCandidate({
        candidate,
        deferredExpiresAt: 2000,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "runtime",
      });
      expect(store.findDeferredCandidate(candidate.idempotencySeed)?.status).toBe("queued");

      // Before boundary
      expect(store.expireDue(1999, 128)).toBe(0);

      // Exact boundary
      expect(store.expireDue(2000, 128)).toBe(1);
      expect(store.findDeferredCandidate(candidate.idempotencySeed)?.status).toBe("expired");

      // Cannot later be promoted
      const promotion = store.promoteDeferredCandidate(candidate.idempotencySeed, 2001);
      expect(promotion.status).toBe("expired");
      store.close();
    });

    it("enforces bounded sweep limits and processes remainder in subsequent calls", () => {
      const store = repository();
      for (let i = 0; i < 5; i += 1) {
        store.createPending({
          actionId: `act_sweep_${i}`,
          idempotencyKey: `seed_sweep_act_${i}`,
          eventId: `evt_${i}`,
          mappingId: "rule",
          gameId: "game",
          actionType: "SPAWN",
          params: {},
          priority: 1,
          ttlMs: 1000,
          createdAt: 1000,
          expiresAt: 2000,
          runtimeId: "runtime",
        });
        store.enqueueDeferredCandidate({
          candidate: { ...candidate, idempotencySeed: `seed_sweep_def_${i}` },
          deferredExpiresAt: 2000,
          createdAt: 1000,
          admissionSnapshot: snapshot,
          runtimeId: "runtime",
        });
      }

      // First sweep with sweepLimit = 3 (processes up to 3 actions and 3 deferred candidates = 6 total)
      const swept1 = store.expireDue(2000, 3);
      expect(swept1).toBe(6);

      // Second sweep processes remainder (2 actions and 2 deferred candidates = 4 total)
      const swept2 = store.expireDue(2000, 3);
      expect(swept2).toBe(4);

      // Subsequent sweep returns 0
      expect(store.expireDue(2000, 3)).toBe(0);
      store.close();
    });

    it("is idempotent on re-sweep with zero additional mutation or version churn", () => {
      const store = repository();
      store.createPending({
        actionId: "act_idempotent_sweep",
        idempotencyKey: "seed_idempotent_sweep",
        eventId: "evt",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 1000,
        createdAt: 1000,
        expiresAt: 2000,
        runtimeId: "runtime",
      });
      const worker = new ActionLifecycleWorker(store, { now: () => 2000 }, 128);

      expect(worker.tick()).toBe(1);
      const expiredVersion = store.findById("act_idempotent_sweep")?.version;

      // Second sweep via tick and expireDue
      expect(worker.tick()).toBe(0);
      expect(store.expireDue(2000, 128)).toBe(0);
      expect(store.findById("act_idempotent_sweep")?.version).toBe(expiredVersion);
      store.close();
    });

    it("prioritizes TTL expiry over delivery or retry without issuing authorizations or attempts", async () => {
      const store = repository();
      const port = new FakeActionDeliveryPort();
      port.queueResolution({
        status: "available",
        destination: {
          clientId: "client-distinct", gameId: "game",
          gameInstanceId: "instance", sessionGeneration: 1, destinationGeneration: "gen-1",
        },
      });
      const gateway = new ActionGateway(store, port, { now: () => 2000 }, "runtime");

      const created = store.createPending({
        actionId: "act_ttl_deliver",
        idempotencyKey: "seed_ttl_deliver",
        eventId: "evt",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 1000,
        createdAt: 1000,
        expiresAt: 2000,
        runtimeId: "runtime",
      });

      const delivered = await gateway.deliver(created.record, candidate);
      expect(delivered.status).toBe("expired");
      expect(store.listAttempts("act_ttl_deliver")).toEqual([]);
      expect(port.sentDeliveries).toEqual([]);
      store.close();
    });

    it("handles mixed action and deferred candidate sweeps deterministically via ActionLifecycleWorker", () => {
      const store = repository();
      store.createPending({
        actionId: "act_mixed",
        idempotencyKey: "seed_mixed_act",
        eventId: "evt",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 1000,
        createdAt: 1000,
        expiresAt: 2000,
        runtimeId: "runtime",
      });
      store.enqueueDeferredCandidate({
        candidate: { ...candidate, idempotencySeed: "seed_mixed_def" },
        deferredExpiresAt: 2000,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "runtime",
      });

      const worker = new ActionLifecycleWorker(store, { now: () => 2000 }, 128);
      expect(worker.tick()).toBe(2);
      expect(store.findById("act_mixed")?.status).toBe("expired");
      expect(store.findDeferredCandidate("seed_mixed_def")?.status).toBe("expired");
      store.close();
    });
  });

  describe("M-1 — Promotion Negative-Path Coverage", () => {
    it("returns expired status when promoting an expired candidate with zero action or budget mutation", () => {
      const store = repository();
      store.enqueueDeferredCandidate({
        candidate,
        deferredExpiresAt: 2000,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "runtime",
      });

      const result = store.promoteDeferredCandidate(candidate.idempotencySeed, 2005);
      expect(result.status).toBe("expired");

      const deferred = store.findDeferredCandidate(candidate.idempotencySeed);
      expect(deferred?.status).toBe("expired");
      expect(deferred?.promotedActionId).toBeNull();
      expect(deferred?.promotedAt).toBeNull();
      expect(store.findById(computeActionId(candidate.idempotencySeed))).toBeNull();
      store.close();
    });

    it("returns not_admitted when budget re-admission fails and rolls back atomically", () => {
      const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-m3-neg-"));
      directories.push(directory);
      const filename = join(directory, "database.sqlite");
      const store = SqliteDurableActionRepository.open({ filename });

      const strictSnapshot: BudgetAdmissionSnapshot = {
        ...snapshot,
        userLimit: { limitPerMinute: 1 },
      };
      store.enqueueDeferredCandidate({
        candidate,
        deferredExpiresAt: 10000,
        createdAt: 1000,
        admissionSnapshot: strictSnapshot,
        runtimeId: "runtime",
      });

      // Pre-fill user events table to consume the 1-per-minute user limit before promotion
      const db = new DatabaseSync(filename);
      db.prepare(
        "INSERT INTO mapping_budget_user_events (profile_id, rule_id, user_key, admitted_at) VALUES (?, ?, ?, ?)",
      ).run(candidate.gameProfileId, candidate.ruleId, candidate.userBudgetKey, 2000);
      db.close();

      const result = store.promoteDeferredCandidate(candidate.idempotencySeed, 2000);
      expect(result).toEqual({ status: "not_admitted", reason: "USER_LIMIT" });

      // Transaction rollback assertions: deferred candidate remains queued, action is not created
      const deferred = store.findDeferredCandidate(candidate.idempotencySeed);
      expect(deferred?.status).toBe("queued");
      expect(deferred?.promotedActionId).toBeNull();
      expect(deferred?.promotedAt).toBeNull();
      expect(store.findById(computeActionId(candidate.idempotencySeed))).toBeNull();

      // Assert user events count remains exactly 1 (the pre-filled row)
      const dbAfter = new DatabaseSync(filename);
      const userEventCount = dbAfter
        .prepare("SELECT COUNT(*) AS count FROM mapping_budget_user_events")
        .get() as { count: number };
      expect(userEventCount.count).toBe(1);
      dbAfter.close();
      store.close();
    });

    it("returns not_found for nonexistent idempotency seed with zero mutation", () => {
      const store = repository();
      const result = store.promoteDeferredCandidate("nonexistent:seed", 2000);
      expect(result).toEqual({ status: "not_found" });
      store.close();
    });

    it("fails closed with RUNTIME_SUPERSEDED when runtime ownership is superseded", () => {
      const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-m3-stale-"));
      directories.push(directory);
      const filename = join(directory, "database.sqlite");
      const store1 = SqliteDurableActionRepository.open({ filename });
      store1.enqueueDeferredCandidate({
        candidate,
        deferredExpiresAt: 10000,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "runtime_1",
      });

      const store2 = SqliteDurableActionRepository.open({ filename });
      store2.reconcilePreviousRuntime("runtime_2", 1500);

      expect(() => store1.promoteDeferredCandidate(candidate.idempotencySeed, 2000)).toThrowError(
        expect.objectContaining({ code: "RUNTIME_SUPERSEDED" }),
      );

      const candidateAfter = store2.findDeferredCandidate(candidate.idempotencySeed);
      expect(candidateAfter?.status).toBe("queued");
      expect(candidateAfter?.owningRuntimeId).toBe("runtime_2");
      expect(store2.findById(computeActionId(candidate.idempotencySeed))).toBeNull();
      store1.close();
      store2.close();
    });
  });

  describe("M-2 — Restart Reconciliation Coverage", () => {
    it("retains received actions, reassigns runtime owner, avoids retry scheduling, and is idempotent", () => {
      const store = repository();
      const created = store.createPending({
        actionId: "act_recv_rec",
        idempotencyKey: "seed_recv_rec",
        eventId: "evt",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 10000,
        createdAt: 1000,
        expiresAt: 11000,
        runtimeId: "old_runtime",
      });

      const auth = store.authorizePending(created.record.actionId, 1, "old_runtime", {
        clientId: "game",
        gameInstanceId: "inst",
      });
      store.recordAttempt(auth, { role: "game", clientId: "game", gameInstanceId: "inst" }, 1100, "send_started");
      const inflight = store.findById(created.record.actionId);
      store.transition({
        actionId: created.record.actionId,
        expectedVersion: inflight?.version ?? 1,
        expectedStatuses: ["in_flight"],
        nextStatus: "received",
        at: 1200,
      });

      const results = store.reconcilePreviousRuntime("new_runtime", 1500);
      expect(results).toEqual([
        { actionId: "act_recv_rec", previousStatus: "received", status: "received" },
      ]);

      const record = store.findById("act_recv_rec");
      expect(record?.status).toBe("received");
      expect(record?.runtimeId).toBe("new_runtime");
      expect(record?.reconciliationReason).toBe("received_reassigned_after_restart");
      expect(store.listDeliverable(2000, 10)).toEqual([]);

      expect(store.reconcilePreviousRuntime("new_runtime", 1600)).toEqual([]);
      store.close();
    });

    it("reassigns unexpired queued deferred candidate runtime owner while leaving status queued and promotion metadata null", () => {
      const store = repository();
      store.enqueueDeferredCandidate({
        candidate,
        deferredExpiresAt: 10000,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "old_runtime",
      });

      store.reconcilePreviousRuntime("new_runtime", 1500);

      const deferred = store.findDeferredCandidate(candidate.idempotencySeed);
      expect(deferred?.status).toBe("queued");
      expect(deferred?.owningRuntimeId).toBe("new_runtime");
      expect(deferred?.promotedActionId).toBeNull();
      expect(deferred?.promotedAt).toBeNull();
      store.close();
    });

    it("expires queued deferred candidates whose expiry timestamp has elapsed during restart reconciliation", () => {
      const store = repository();
      store.enqueueDeferredCandidate({
        candidate,
        deferredExpiresAt: 1500,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "old_runtime",
      });

      store.reconcilePreviousRuntime("new_runtime", 2000);

      const deferred = store.findDeferredCandidate(candidate.idempotencySeed);
      expect(deferred?.status).toBe("expired");
      expect(store.promoteDeferredCandidate(candidate.idempotencySeed, 2001).status).toBe("expired");
      store.close();
    });

    it("reconciles a mixed restart set of pending, in_flight, received, expired actions, and deferred candidates", () => {
      const store = repository();

      // 1. Pending action
      store.createPending({
        actionId: "act_pending",
        idempotencyKey: "seed_pending",
        eventId: "evt1",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 10000,
        createdAt: 1000,
        expiresAt: 11000,
        runtimeId: "old_runtime",
      });

      // 2. In_flight action
      store.createPending({
        actionId: "act_flight",
        idempotencyKey: "seed_flight",
        eventId: "evt2",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 10000,
        createdAt: 1000,
        expiresAt: 11000,
        runtimeId: "old_runtime",
      });
      const authFlight = store.authorizePending("act_flight", 1, "old_runtime", {
        clientId: "game",
        gameInstanceId: "inst",
      });
      store.recordAttempt(authFlight, { role: "game", clientId: "game", gameInstanceId: "inst" }, 1100, "send_started");

      // 3. Received action
      store.createPending({
        actionId: "act_received",
        idempotencyKey: "seed_received",
        eventId: "evt3",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 10000,
        createdAt: 1000,
        expiresAt: 11000,
        runtimeId: "old_runtime",
      });
      const authReceived = store.authorizePending("act_received", 1, "old_runtime", {
        clientId: "game",
        gameInstanceId: "inst",
      });
      store.recordAttempt(authReceived, { role: "game", clientId: "game", gameInstanceId: "inst" }, 1100, "send_started");
      const recordReceived = store.findById("act_received");
      store.transition({
        actionId: "act_received",
        expectedVersion: recordReceived?.version ?? 1,
        expectedStatuses: ["in_flight"],
        nextStatus: "received",
        at: 1200,
      });

      // 4. Expired action
      store.createPending({
        actionId: "act_expired",
        idempotencyKey: "seed_expired",
        eventId: "evt4",
        mappingId: "rule",
        gameId: "game",
        actionType: "SPAWN",
        params: {},
        priority: 1,
        ttlMs: 500,
        createdAt: 1000,
        expiresAt: 1500,
        runtimeId: "old_runtime",
      });
      store.expireDue(1500, 10);

      // 5. Unexpired queued deferred candidate
      store.enqueueDeferredCandidate({
        candidate: { ...candidate, idempotencySeed: "seed_unexpired_deferred" },
        deferredExpiresAt: 10000,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "old_runtime",
      });

      // 6. Expired queued deferred candidate
      store.enqueueDeferredCandidate({
        candidate: { ...candidate, idempotencySeed: "seed_expired_deferred" },
        deferredExpiresAt: 1500,
        createdAt: 1000,
        admissionSnapshot: snapshot,
        runtimeId: "old_runtime",
      });

      const results = store.reconcilePreviousRuntime("new_runtime", 2000);

      expect(results).toEqual([
        { actionId: "act_flight", previousStatus: "in_flight", status: "delivery_unknown_restart" },
        { actionId: "act_pending", previousStatus: "pending", status: "pending" },
        { actionId: "act_received", previousStatus: "received", status: "received" },
      ]);

      expect(store.findById("act_pending")).toMatchObject({ status: "pending", runtimeId: "new_runtime" });
      expect(store.findById("act_flight")).toMatchObject({ status: "delivery_unknown_restart", runtimeId: "new_runtime" });
      expect(store.findById("act_received")).toMatchObject({ status: "received", runtimeId: "new_runtime" });
      expect(store.findById("act_expired")).toMatchObject({ status: "expired", runtimeId: "old_runtime" });

      expect(store.findDeferredCandidate("seed_unexpired_deferred")).toMatchObject({ status: "queued", owningRuntimeId: "new_runtime" });
      expect(store.findDeferredCandidate("seed_expired_deferred")).toMatchObject({ status: "expired", owningRuntimeId: "old_runtime" });

      expect(store.reconcilePreviousRuntime("new_runtime", 2100)).toEqual([]);
      store.close();
    });
  });
});
