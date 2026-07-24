import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import {
  PersistenceError,
  SqliteDurableActionRepository,
  type ActionAttempt,
  type ActionTransition,
  type CreateDurableAction,
  type DurableActionRecord,
  type DurableActionRepository,
  type DurableCreateResult,
  type ReconciliationResult,
  type RetentionPolicy,
  type SendAuthorization,
} from "@crowdcircuit/server";
import {
  CURRENT_SCHEMA_VERSION,
  migrateDatabase,
} from "../src/persistence/migrations.js";
import {
  issueSendAuthorization,
  readSendAuthorization,
  type AuthorizationDetails,
} from "../src/persistence/authorization.js";

const directories: string[] = [];
const temporaryDatabase = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-"));
  directories.push(directory);
  return join(directory, "test.sqlite");
};

const concurrentCreates = async (
  filename: string,
  left: CreateDurableAction,
  right: CreateDurableAction,
): Promise<readonly unknown[]> => {
  const workerUrl = new URL("./repository-concurrency-worker.ts", import.meta.url);
  const tsxLoader = pathToFileURL(
    createRequire(import.meta.url).resolve("tsx"),
  ).href;
  const workers = [left, right].map(
    (input) =>
      new Worker(workerUrl, {
        execArgv: ["--import", tsxLoader],
        workerData: { filename, action: input },
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
      new Promise<unknown>((resolve, reject) => {
        worker.once("error", reject);
        worker.once("message", resolve);
        worker.postMessage({ type: "go" });
      }),
  );
  const resolved = await Promise.all(results);
  await Promise.all(workers.map((worker) => worker.terminate()));
  return resolved;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const action = (
  actionId = "action-1",
  runtimeId = "runtime-1",
  createdAt = 1_000,
): CreateDurableAction => ({
  actionId,
  idempotencyKey: `idempotency-${actionId}`,
  eventId: "event-1",
  mappingId: "mapping-1",
  gameId: "game-1",
  actionType: "SPAWN_ZOMBIE",
  params: { count: 1, tags: ["gift"] },
  priority: 10,
  ttlMs: 5_000,
  createdAt,
  expiresAt: createdAt + 5_000,
  runtimeId,
});

let fakeRepositorySequence = 0;

interface FakeAuthorizationState {
  readonly details: AuthorizationDetails;
  consumed: boolean;
}

interface FakeDurableState {
  readonly records: Map<string, DurableActionRecord>;
  readonly attempts: Map<string, ActionAttempt[]>;
  readonly authorizations: Map<string, FakeAuthorizationState>;
  activeOwnerId: string | null;
}

const createFakeDurableState = (): FakeDurableState => ({
  records: new Map(),
  attempts: new Map(),
  authorizations: new Map(),
  activeOwnerId: null,
});

class DeterministicFakeRepository implements DurableActionRepository {
  readonly records: Map<string, DurableActionRecord>;
  readonly attempts: Map<string, ActionAttempt[]>;
  readonly authorizations: Map<string, FakeAuthorizationState>;
  readonly state: FakeDurableState;
  sequence = 0;
  readonly repositoryOwner = {};
  readonly runtimeOwnerId = `fake-owner-${++fakeRepositorySequence}`;
  closed = false;
  reconciliationComplete: boolean;
  failAttempt = false;
  failReconciliationAt: number | null = null;

  constructor(state: FakeDurableState = createFakeDurableState()) {
    this.state = state;
    this.records = state.records;
    this.attempts = state.attempts;
    this.authorizations = state.authorizations;
    this.reconciliationComplete = state.activeOwnerId === null;
    state.activeOwnerId = this.runtimeOwnerId;
  }

  createBeforeFirstSend(input: CreateDurableAction): DurableCreateResult {
    this.assertOwner(true);
    const existing = this.records.get(input.actionId);
    if (existing !== undefined) {
      if (existing.idempotencyKey !== input.idempotencyKey) {
        throw new PersistenceError("DUPLICATE_ACTION", "Action ID already exists");
      }
      return {
        record: existing,
        sendAuthorization: null,
        created: false,
        reason: this.authorizations.get(`${existing.actionId}:1`)?.consumed
          ? "already_consumed"
          : "already_authorized",
      };
    }
    for (const record of this.records.values()) {
      if (record.idempotencyKey === input.idempotencyKey) {
        throw new PersistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key already exists");
      }
    }
    const record: DurableActionRecord = {
      ...input,
      status: "pending",
      retryCount: 0,
      version: 1,
      updatedAt: input.createdAt,
      receivedAt: null,
      completedAt: null,
      failureCode: null,
      resultDetails: null,
      reconciliationReason: null,
    };
    this.records.set(record.actionId, record);
    const details = this.authorizationDetails(record, 1);
    this.authorizations.set(`${record.actionId}:1`, { details, consumed: false });
    return {
      record,
      sendAuthorization: issueSendAuthorization(details),
      created: true,
    };
  }

  findById(actionId: string): DurableActionRecord | null {
    return this.records.get(actionId) ?? null;
  }

  authorizeRetry(actionId: string, expectedVersion: number, runtimeId: string): SendAuthorization {
    this.assertOwner(true);
    const record = this.records.get(actionId);
    if (
      record === undefined ||
      record.status !== "in_flight" ||
      record.version !== expectedVersion ||
      record.runtimeId !== runtimeId
    ) {
      throw new PersistenceError("STALE_TRANSITION", "Retry authorization is stale");
    }
    const details = this.authorizationDetails(record, record.retryCount + 1);
    const key = `${record.actionId}:${details.attemptNumber}`;
    if (this.authorizations.has(key)) {
      throw new PersistenceError("ALREADY_AUTHORIZED", "Retry is already authorized");
    }
    this.authorizations.set(key, { details, consumed: false });
    return issueSendAuthorization(details);
  }

  revokeSendAuthorization(actionId: string, attemptNumber: number, _at: number): boolean {
    this.assertOwner(true);
    const authorization = this.authorizations.get(`${actionId}:${attemptNumber}`);
    if (authorization === undefined || authorization.consumed) return false;
    authorization.consumed = true;
    return true;
  }

  findByIdempotencyKey(key: string): DurableActionRecord | null {
    for (const record of this.records.values()) {
      if (record.idempotencyKey === key) return record;
    }
    return null;
  }

  transition(input: ActionTransition): DurableActionRecord {
    this.assertOwner(true);
    const current = this.records.get(input.actionId);
    if (
      current === undefined ||
      current.version !== input.expectedVersion ||
      !input.expectedStatuses.includes(current.status)
    ) {
      throw new PersistenceError("STALE_TRANSITION", "Action state changed");
    }
    const legal: Readonly<Record<string, readonly string[]>> = {
      pending: ["in_flight", "expired", "aborted_restart"],
      in_flight: ["received", "delivery_failed", "expired", "delivery_unknown_restart"],
      received: ["completed", "failed", "expired", "delivery_unknown_restart"],
    };
    if (!(legal[current.status] ?? []).includes(input.nextStatus)) {
      throw new PersistenceError("ILLEGAL_TRANSITION", "Action transition is not allowed");
    }
    const next: DurableActionRecord = {
      ...current,
      status: input.nextStatus,
      version: current.version + 1,
      updatedAt: input.at,
      receivedAt: input.nextStatus === "received" ? input.at : current.receivedAt,
      completedAt:
        input.nextStatus === "completed" || input.nextStatus === "failed"
          ? input.at
          : current.completedAt,
      failureCode: input.failureCode ?? null,
      resultDetails: input.resultDetails ?? null,
    };
    this.records.set(next.actionId, next);
    return next;
  }

  recordAttempt(
    authorization: SendAuthorization,
    binding: { readonly role: "game"; readonly clientId: string },
    attemptedAt: number,
    outcome: ActionAttempt["outcome"],
    failureCode: string | null = null,
  ): ActionAttempt {
    this.assertOwner(true);
    const details = readSendAuthorization(authorization, this.repositoryOwner);
    if (details === null) {
      throw new PersistenceError("INVALID_AUTHORIZATION", "Send authorization is invalid");
    }
    const durableAuthorization = this.authorizations.get(
      `${details.actionId}:${details.attemptNumber}`,
    );
    const record = this.records.get(details.actionId);
    if (
      durableAuthorization === undefined ||
      durableAuthorization.consumed ||
      record === undefined ||
      (record.status !== "pending" && record.status !== "in_flight") ||
      record.version !== details.expectedVersion ||
      record.runtimeId !== details.runtimeId ||
      details.role !== binding.role ||
      details.clientId !== binding.clientId ||
      attemptedAt >= details.expiresAt
    ) {
      throw new PersistenceError("INVALID_AUTHORIZATION", "Send authorization is invalid");
    }
    const attempt: ActionAttempt = {
      actionId: record.actionId,
      attemptNumber: details.attemptNumber,
      runtimeId: record.runtimeId,
      attemptedAt,
      outcome,
      failureCode,
    };
    const nextRecord: DurableActionRecord = {
      ...record,
      status: "in_flight",
      retryCount: attempt.attemptNumber,
      updatedAt: attemptedAt,
      failureCode: outcome === "send_failed" ? failureCode : null,
      version: record.version + 1,
    };
    if (this.failAttempt) {
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Injected fake attempt failure");
    }
    durableAuthorization.consumed = true;
    this.attempts.set(record.actionId, [...(this.attempts.get(record.actionId) ?? []), attempt]);
    this.records.set(record.actionId, nextRecord);
    return attempt;
  }

  listAttempts(actionId: string): readonly ActionAttempt[] {
    return this.attempts.get(actionId) ?? [];
  }

  listNonterminal(): readonly DurableActionRecord[] {
    return [...this.records.values()].filter(
      (record) =>
        record.status === "pending" ||
        record.status === "in_flight" ||
        record.status === "received",
    ).sort((left, right) => left.createdAt - right.createdAt || left.actionId.localeCompare(right.actionId));
  }

  reconcilePreviousRuntime(runtimeId: string, now: number): readonly ReconciliationResult[] {
    this.assertOwner(false);
    const results: ReconciliationResult[] = [];
    const staged: DurableActionRecord[] = [];
    for (const record of this.listNonterminal()) {
      if (record.runtimeId === runtimeId) continue;
      const status =
        now >= record.expiresAt
          ? "expired"
          : record.status === "pending"
            ? "aborted_restart"
            : "delivery_unknown_restart";
      staged.push({
        ...record,
        status,
        updatedAt: now,
        version: record.version + 1,
        reconciliationReason: "restart",
      });
      results.push({ actionId: record.actionId, previousStatus: record.status, status });
      if (
        this.failReconciliationAt !== null &&
        staged.length - 1 === this.failReconciliationAt
      ) {
        throw new PersistenceError(
          "DATABASE_UNAVAILABLE",
          "Injected fake reconciliation failure",
        );
      }
    }
    for (const record of staged) {
      this.records.set(record.actionId, record);
    }
    this.reconciliationComplete = true;
    return results;
  }

  cleanup(_policy: RetentionPolicy): number {
    this.assertOwner(true);
    return 0;
  }

  close(): void {
    this.closed = true;
    this.reconciliationComplete = false;
  }

  private assertOwner(requireReconciled: boolean): void {
    if (this.closed || this.state.activeOwnerId !== this.runtimeOwnerId) {
      throw new PersistenceError(
        "RUNTIME_SUPERSEDED",
        "Runtime ownership was superseded",
      );
    }
    if (requireReconciled && !this.reconciliationComplete) {
      throw new PersistenceError(
        "INVALID_AUTHORIZATION",
        "Runtime reconciliation is required",
      );
    }
  }

  private authorizationDetails(
    record: CreateDurableAction | DurableActionRecord,
    attemptNumber: number,
  ): AuthorizationDetails {
    this.sequence += 1;
    return {
      authorizationId: `fake-${this.sequence}`,
      actionId: record.actionId,
      expectedVersion: "version" in record ? record.version : 1,
      attemptNumber,
      runtimeId: record.runtimeId,
      role: "game",
      clientId: record.gameId,
      expiresAt: record.expiresAt,
      runtimeOwnerId: this.runtimeOwnerId,
      repositoryOwner: this.repositoryOwner,
    };
  }
}

function repositoryBehavior(factory: () => DurableActionRepository): void {
  it("persists before returning send authorization and is idempotent", () => {
    const repository = factory();
    const first = repository.createBeforeFirstSend(action());
    expect(first.created).toBe(true);
    expect(repository.findById(first.sendAuthorization.actionId)).toEqual(first.record);
    expect(repository.createBeforeFirstSend(action())).toMatchObject({
      created: false,
      sendAuthorization: null,
      reason: "already_authorized",
    });
    repository.close();
  });

  it("rejects forged, copied, wrongly bound, and reused authorizations", () => {
    const repository = factory();
    const created = repository.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    const forged = Object.freeze({ actionId: created.record.actionId });
    const copied = Object.freeze({ ...created.sendAuthorization });
    const cloned = structuredClone(created.sendAuthorization);
    for (const candidate of [forged, copied, cloned]) {
      expect(() =>
        repository.recordAttempt(
          candidate,
          { role: "game", clientId: "game-1" },
          1_100,
          "send_started",
        ),
      ).toThrow(PersistenceError);
    }
    expect(() =>
      repository.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "wrong-game" },
        1_100,
        "send_started",
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_AUTHORIZATION" }));
    repository.recordAttempt(
      created.sendAuthorization,
      { role: "game", clientId: "game-1" },
      1_100,
      "send_started",
    );
    expect(() =>
      repository.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_101,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    expect(repository.createBeforeFirstSend(action())).toMatchObject({
      created: false,
      sendAuthorization: null,
      reason: "already_consumed",
    });
    repository.close();
  });

  it("rejects conflicting payload under one idempotency key", () => {
    const repository = factory();
    repository.createBeforeFirstSend(action());
    expect(() =>
      repository.createBeforeFirstSend({
        ...action("different-action"),
        idempotencyKey: "idempotency-action-1",
      }),
    ).toThrow(PersistenceError);
    repository.close();
  });

  it("rejects revoked, expired, and stale send capabilities", () => {
    const repository = factory();
    const revoked = repository.createBeforeFirstSend(action("revoked"));
    if (!revoked.created) throw new Error("expected creation");
    expect(repository.revokeSendAuthorization("revoked", 1, 1_100)).toBe(true);
    expect(() =>
      repository.recordAttempt(
        revoked.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_101,
        "send_started",
      ),
    ).toThrow(PersistenceError);

    const expired = repository.createBeforeFirstSend(action("expired"));
    if (!expired.created) throw new Error("expected creation");
    expect(() =>
      repository.recordAttempt(
        expired.sendAuthorization,
        { role: "game", clientId: "game-1" },
        6_000,
        "send_started",
      ),
    ).toThrow(PersistenceError);

    const stale = repository.createBeforeFirstSend(action("stale"));
    if (!stale.created) throw new Error("expected creation");
    repository.transition({
      actionId: "stale",
      expectedVersion: 1,
      expectedStatuses: ["pending"],
      nextStatus: "expired",
      at: 1_100,
    });
    expect(() =>
      repository.recordAttempt(
        stale.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_101,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    repository.close();
  });

  it("records ordered attempts and enforces optimistic legal transitions", () => {
    const repository = factory();
    const created = repository.createBeforeFirstSend(action());
    const attempt = repository.recordAttempt(
      created.sendAuthorization,
      { role: "game", clientId: "game-1" },
      1_100,
      "send_started",
    );
    expect(attempt.attemptNumber).toBe(1);
    const afterFirst = repository.findById("action-1");
    const retryAuthorization = repository.authorizeRetry(
      "action-1",
      afterFirst?.version ?? 0,
      "runtime-1",
    );
    const retry = repository.recordAttempt(
      retryAuthorization,
      { role: "game", clientId: "game-1" },
      1_150,
      "send_failed",
      "timeout",
    );
    expect(retry.attemptNumber).toBe(2);
    expect(repository.listAttempts("action-1")).toEqual([attempt, retry]);
    const sent = repository.findById("action-1");
    expect(sent?.status).toBe("in_flight");
    expect(() =>
      repository.transition({
        actionId: "action-1",
        expectedVersion: 1,
        expectedStatuses: ["pending"],
        nextStatus: "completed",
        at: 1_200,
      }),
    ).toThrow(PersistenceError);
    const received = repository.transition({
      actionId: "action-1",
      expectedVersion: sent?.version ?? 0,
      expectedStatuses: ["in_flight"],
      nextStatus: "received",
      at: 1_200,
    });
    expect(
      repository.transition({
        actionId: "action-1",
        expectedVersion: received.version,
        expectedStatuses: ["received"],
        nextStatus: "completed",
        at: 1_300,
      }).status,
    ).toBe("completed");
    repository.close();
  });

  it("reconciles old-runtime work without replay and is idempotent", () => {
    const repository = factory();
    const pending = repository.createBeforeFirstSend(action("pending", "old"));
    const inflight = repository.createBeforeFirstSend(action("flight", "old"));
    repository.recordAttempt(
      inflight.sendAuthorization,
      { role: "game", clientId: "game-1" },
      1_100,
      "send_started",
    );
    const results = repository.reconcilePreviousRuntime("new", 1_200);
    expect(results).toEqual([
      { actionId: inflight.record.actionId, previousStatus: "in_flight", status: "delivery_unknown_restart" },
      { actionId: pending.record.actionId, previousStatus: "pending", status: "aborted_restart" },
    ]);
    expect(repository.reconcilePreviousRuntime("new", 1_300)).toEqual([]);
    repository.close();
  });
}

describe("SQLite durable action repository parity", () => {
  describe("real SQLite", () => repositoryBehavior(() => SqliteDurableActionRepository.open({
    filename: temporaryDatabase(),
  })));
  describe("deterministic fake", () => repositoryBehavior(() => new DeterministicFakeRepository()));

  it("fake rejects cross-owner and closed-owner capabilities", () => {
    const issuer = new DeterministicFakeRepository();
    const other = new DeterministicFakeRepository();
    const created = issuer.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    expect(() =>
      other.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    issuer.close();
    expect(() =>
      issuer.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    ).toThrow(PersistenceError);
  });

  it("fake rolls back failed attempt and middle reconciliation mutations", () => {
    const repository = new DeterministicFakeRepository();
    const created = repository.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    repository.failAttempt = true;
    expect(() =>
      repository.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    expect(repository.findById("action-1")).toMatchObject({
      status: "pending",
      version: 1,
    });
    expect(repository.listAttempts("action-1")).toEqual([]);
    repository.failAttempt = false;
    repository.createBeforeFirstSend(action("action-2", "old"));
    repository.failReconciliationAt = 1;
    expect(() => repository.reconcilePreviousRuntime("new", 1_200)).toThrow(
      PersistenceError,
    );
    expect(repository.findById("action-1")).toMatchObject({
      status: "pending",
      version: 1,
    });
    expect(repository.findById("action-2")).toMatchObject({
      status: "pending",
      version: 1,
    });
  });

  it("fake rejects every owner-scoped write from a superseded runtime", () => {
    const state = createFakeDurableState();
    const first = new DeterministicFakeRepository(state);
    const created = first.createBeforeFirstSend(action("old", "runtime-a"));
    if (!created.created) throw new Error("expected creation");
    const second = new DeterministicFakeRepository(state);
    const expectSuperseded = (operation: () => unknown): void => {
      expect(operation).toThrowError(
        expect.objectContaining({ code: "RUNTIME_SUPERSEDED" }),
      );
    };
    expectSuperseded(() =>
      first.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    );
    expectSuperseded(() => first.revokeSendAuthorization("old", 1, 1_100));
    expectSuperseded(() =>
      first.transition({
        actionId: "old",
        expectedVersion: 1,
        expectedStatuses: ["pending"],
        nextStatus: "expired",
        at: 1_100,
      }),
    );
    expectSuperseded(() => first.authorizeRetry("old", 1, "runtime-a"));
    expectSuperseded(() => first.reconcilePreviousRuntime("runtime-a", 1_100));
    expectSuperseded(() =>
      first.cleanup({ terminalBefore: 2_000, maximumTerminalRecords: 0 }),
    );
    expect(state.records.get("old")).toMatchObject({ status: "pending", version: 1 });
    expect(state.attempts.get("old")).toBeUndefined();
    expect(state.authorizations.get("old:1")).toMatchObject({ consumed: false });

    second.reconcilePreviousRuntime("runtime-b", 1_200);
    const active = second.createBeforeFirstSend(action("active", "runtime-b", 1_300));
    if (!active.created) throw new Error("expected active creation");
    expectSuperseded(() => first.revokeSendAuthorization("active", 1, 1_400));
    expect(
      second.recordAttempt(
        active.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_400,
        "send_started",
      ),
    ).toMatchObject({ actionId: "active", attemptNumber: 1 });
  });
});

describe("SQLite migration, recovery, and failure boundaries", () => {
  it("migrates a new database and reopens idempotently", () => {
    const filename = temporaryDatabase();
    const first = SqliteDurableActionRepository.open({ filename });
    first.close();
    const database = new DatabaseSync(filename);
    const row = database.prepare("SELECT MAX(version) AS version FROM schema_versions").get();
    expect(Reflect.get(row ?? {}, "version")).toBe(CURRENT_SCHEMA_VERSION);
    database.close();
    expect(() => SqliteDurableActionRepository.open({ filename }).close()).not.toThrow();
  });

  it("rolls back a failed migration without advancing its version", () => {
    const database = new DatabaseSync(temporaryDatabase());
    expect(() =>
      migrateDatabase(database, [
        { version: 1, id: "stable", sql: "CREATE TABLE stable_data (id INTEGER PRIMARY KEY);" },
        { version: 2, id: "broken", sql: "CREATE TABLE broken (" },
      ]),
    ).toThrowError(expect.objectContaining({ code: "MIGRATION_FAILED" }));
    const rows = database.prepare("SELECT version FROM schema_versions ORDER BY version").all();
    expect(rows.map((row) => Reflect.get(row, "version"))).toEqual([1]);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name = 'stable_data'").get()).toBeDefined();
    database.close();
  });

  it("rejects unsupported newer schema state", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(
      `CREATE TABLE schema_versions (
        version INTEGER PRIMARY KEY,
        migration_id TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
      INSERT INTO schema_versions VALUES (999, 'unknown', 'unknown', 0);`,
    );
    expect(() => migrateDatabase(database)).toThrowError(
      expect.objectContaining({ code: "SCHEMA_INCOMPATIBLE" }),
    );
    database.close();
  });

  it("rejects migration gaps, duplicates, reordered versions, and missing identities before mutation", () => {
    const invalidManifests = [
      [
        { version: 1, id: "one", sql: "SELECT 1;" },
        { version: 3, id: "three", sql: "SELECT 3;" },
      ],
      [{ version: 3, id: "three", sql: "SELECT 3;" }],
      [
        { version: 1, id: "one", sql: "SELECT 1;" },
        { version: 2, id: "two", sql: "SELECT 2;" },
        { version: 4, id: "four", sql: "SELECT 4;" },
      ],
      [
        { version: 1, id: "one", sql: "SELECT 1;" },
        { version: 2, id: "two", sql: "SELECT 2;" },
        { version: 2, id: "duplicate", sql: "SELECT 2;" },
      ],
      [
        { version: 1, id: "one", sql: "SELECT 1;" },
        { version: 3, id: "three", sql: "SELECT 3;" },
        { version: 2, id: "two", sql: "SELECT 2;" },
      ],
      [
        { version: 1, id: "same", sql: "SELECT 1;" },
        { version: 2, id: "same", sql: "SELECT 2;" },
      ],
    ];
    for (const manifest of invalidManifests) {
      const database = new DatabaseSync(":memory:");
      expect(() => migrateDatabase(database, manifest)).toThrowError(
        expect.objectContaining({ code: "INVALID_MIGRATION_MANIFEST" }),
      );
      expect(
        database.prepare("SELECT name FROM sqlite_master WHERE name = 'schema_versions'").get(),
      ).toBeUndefined();
      database.close();
    }
  });

  it("rejects an empty migration manifest before mutating fresh or initialized databases", () => {
    const filename = temporaryDatabase();
    const fresh = new DatabaseSync(filename);
    const foreignKeysBefore = fresh.prepare("PRAGMA foreign_keys").get();
    expect(() => migrateDatabase(fresh, [])).toThrowError(
      expect.objectContaining({ code: "INVALID_MIGRATION_MANIFEST" }),
    );
    expect(
      fresh.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(),
    ).toEqual([]);
    expect(fresh.prepare("PRAGMA foreign_keys").get()).toEqual(foreignKeysBefore);
    expect(migrateDatabase(fresh)).toBe(CURRENT_SCHEMA_VERSION);
    const before = fresh
      .prepare("SELECT version, migration_id, checksum FROM schema_versions")
      .all();
    expect(() => migrateDatabase(fresh, [])).toThrowError(
      expect.objectContaining({ code: "INVALID_MIGRATION_MANIFEST" }),
    );
    expect(
      fresh.prepare("SELECT version, migration_id, checksum FROM schema_versions").all(),
    ).toEqual(before);
    expect(fresh.prepare("SELECT 1 AS usable").get()).toMatchObject({ usable: 1 });
    fresh.close();
  });

  it("rejects changed migration identity or checksum in recorded history", () => {
    const database = new DatabaseSync(":memory:");
    const manifest = [
      { version: 1, id: "one", sql: "CREATE TABLE one (id INTEGER);" },
      { version: 2, id: "two", sql: "CREATE TABLE two (id INTEGER);" },
    ];
    expect(migrateDatabase(database, manifest)).toBe(2);
    expect(() =>
      migrateDatabase(database, [
        manifest[0],
        { version: 2, id: "changed", sql: manifest[1]?.sql ?? "" },
      ]),
    ).toThrowError(expect.objectContaining({ code: "SCHEMA_INCOMPATIBLE" }));
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM schema_versions").get(),
    ).toMatchObject({ count: 2 });
    database.close();
  });

  it("rejects corrupted durable action rows", () => {
    const filename = temporaryDatabase();
    const repository = SqliteDurableActionRepository.open({ filename });
    repository.createBeforeFirstSend(action());
    repository.close();
    const database = new DatabaseSync(filename);
    database.prepare("UPDATE action_logs SET params_json = ? WHERE action_id = ?").run(
      "{not-json",
      "action-1",
    );
    database.close();
    const reopened = SqliteDurableActionRepository.open({ filename });
    expect(() => reopened.findById("action-1")).toThrow(PersistenceError);
    reopened.close();
  });

  it("fails closed before a send authorization exists", () => {
    expect(() =>
      SqliteDurableActionRepository.open({ filename: temporaryDatabase(), failAfterOpen: true }),
    ).toThrow(PersistenceError);
  });

  it("rolls back both action and authorization when capability creation fails", () => {
    const repository = SqliteDurableActionRepository.open({
      filename: temporaryDatabase(),
      authorizationRandom: () => new Uint8Array(1),
    });
    expect(() => repository.createBeforeFirstSend(action())).toThrow(PersistenceError);
    expect(repository.findById("action-1")).toBeNull();
    repository.close();
  });

  it("rolls back create at every production commit-path fault boundary", () => {
    for (const phase of ["after_statements", "before_commit", "commit_path"] as const) {
      const filename = temporaryDatabase();
      const repository = SqliteDurableActionRepository.open({
        filename,
        transactionFault: (operation, currentPhase) => {
          if (operation === "create" && currentPhase === phase) {
            throw new Error(`injected-${phase}`);
          }
        },
      });
      expect(() => repository.createBeforeFirstSend(action())).toThrow(PersistenceError);
      expect(repository.findById("action-1")).toBeNull();
      repository.close();
      const evidence = new DatabaseSync(filename);
      expect(evidence.prepare("SELECT COUNT(*) AS count FROM action_logs").get()).toMatchObject({
        count: 0,
      });
      expect(
        evidence
          .prepare("SELECT COUNT(*) AS count FROM action_send_authorizations")
          .get(),
      ).toMatchObject({ count: 0 });
      expect(
        evidence.prepare("SELECT COUNT(*) AS count FROM action_attempts").get(),
      ).toMatchObject({ count: 0 });
      evidence.close();
    }
  });

  it("rolls back attempt consumption and action advancement at the commit boundary", () => {
    const filename = temporaryDatabase();
    const repository = SqliteDurableActionRepository.open({
      filename,
      transactionFault: (operation, phase) => {
        if (operation === "attempt" && phase === "commit_path") {
          throw new Error("injected-attempt-commit");
        }
      },
    });
    const created = repository.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    expect(() =>
      repository.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    expect(repository.findById("action-1")).toMatchObject({
      status: "pending",
      version: 1,
      retryCount: 0,
    });
    expect(repository.listAttempts("action-1")).toEqual([]);
    const authorization = new DatabaseSync(filename);
    expect(
      authorization
        .prepare(
          "SELECT consumed_at, revoked_at FROM action_send_authorizations WHERE action_id = 'action-1'",
        )
        .get(),
    ).toMatchObject({ consumed_at: null, revoked_at: null });
    authorization.close();
    repository.close();
  });

  it("serializes competing consumption calls within the single repository owner", async () => {
    const repository = SqliteDurableActionRepository.open({
      filename: temporaryDatabase(),
    });
    const created = repository.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    const outcomes = await Promise.allSettled([
      Promise.resolve().then(() =>
        repository.recordAttempt(
          created.sendAuthorization,
          { role: "game", clientId: "game-1" },
          1_100,
          "send_started",
        ),
      ),
      Promise.resolve().then(() =>
        repository.recordAttempt(
          created.sendAuthorization,
          { role: "game", clientId: "game-1" },
          1_101,
          "send_started",
        ),
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(repository.listAttempts("action-1")).toHaveLength(1);
    expect(repository.findById("action-1")).toMatchObject({
      status: "in_flight",
      version: 2,
      retryCount: 1,
    });
    repository.close();
  });

  it("rolls back reconciliation ownership metadata immediately before commit", () => {
    const filename = temporaryDatabase();
    const original = SqliteDurableActionRepository.open({ filename });
    original.createBeforeFirstSend(action("a", "old"));
    original.createBeforeFirstSend(action("b", "old"));
    original.close();
    const failing = SqliteDurableActionRepository.open({
      filename,
      transactionFault: (operation, phase) => {
        if (operation === "reconcile" && phase === "commit_path") {
          throw new Error("injected-reconcile-commit");
        }
      },
    });
    expect(() => failing.reconcilePreviousRuntime("new", 1_200)).toThrow(
      PersistenceError,
    );
    expect(failing.findById("a")).toMatchObject({ status: "pending", version: 1 });
    expect(failing.findById("b")).toMatchObject({ status: "pending", version: 1 });
    expect(() => failing.createBeforeFirstSend(action("c", "new"))).toThrow(
      PersistenceError,
    );
    failing.close();
    const recovered = SqliteDurableActionRepository.open({ filename });
    expect(recovered.reconcilePreviousRuntime("newer", 1_300)).toHaveLength(2);
    expect(recovered.reconcilePreviousRuntime("newer", 1_400)).toEqual([]);
    recovered.close();
  });

  it("binds first-send capability to its active repository owner", () => {
    const filename = temporaryDatabase();
    const first = SqliteDurableActionRepository.open({ filename });
    const created = first.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    const second = SqliteDurableActionRepository.open({ filename });
    expect(() =>
      second.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    expect(() =>
      first.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    expect(second.reconcilePreviousRuntime("runtime-2", 1_200)).toHaveLength(1);
    expect(() =>
      second.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_201,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    first.close();
    second.close();
  });

  it("rejects every owner-scoped stale-runtime write without durable mutation", () => {
    const filename = temporaryDatabase();
    const first = SqliteDurableActionRepository.open({ filename });
    const pending = first.createBeforeFirstSend(action("pending", "runtime-a"));
    const inFlight = first.createBeforeFirstSend(action("flight", "runtime-a"));
    const received = first.createBeforeFirstSend(action("received", "runtime-a"));
    if (!pending.created || !inFlight.created || !received.created) {
      throw new Error("expected creation");
    }
    first.recordAttempt(
      inFlight.sendAuthorization,
      { role: "game", clientId: "game-1" },
      1_100,
      "send_started",
    );
    first.recordAttempt(
      received.sendAuthorization,
      { role: "game", clientId: "game-1" },
      1_100,
      "send_started",
    );
    first.transition({
      actionId: "received",
      expectedVersion: 2,
      expectedStatuses: ["in_flight"],
      nextStatus: "received",
      at: 1_150,
    });

    const second = SqliteDurableActionRepository.open({ filename });
    const before = new DatabaseSync(filename);
    const actionEvidence = before
      .prepare(
        `SELECT action_id, status, version, reconciliation_reason
         FROM action_logs ORDER BY action_id`,
      )
      .all();
    const authorizationEvidence = before
      .prepare(
        `SELECT action_id, attempt_number, consumed_at, revoked_at
         FROM action_send_authorizations ORDER BY action_id, attempt_number`,
      )
      .all();
    const attemptEvidence = before
      .prepare(
        `SELECT action_id, attempt_number, outcome
         FROM action_attempts ORDER BY action_id, attempt_number`,
      )
      .all();
    const ownerEvidence = before
      .prepare("SELECT owner_id, reconciled_at FROM runtime_ownership")
      .get();
    before.close();

    const expectSuperseded = (operation: () => unknown): void => {
      expect(operation).toThrowError(
        expect.objectContaining({ code: "RUNTIME_SUPERSEDED" }),
      );
    };
    for (let repeat = 0; repeat < 2; repeat += 1) {
      expectSuperseded(() =>
        first.recordAttempt(
          pending.sendAuthorization,
          { role: "game", clientId: "game-1" },
          1_200 + repeat,
          "send_started",
        ),
      );
      expectSuperseded(() =>
        first.revokeSendAuthorization("pending", 1, 1_200 + repeat),
      );
      for (const [actionId, version, status] of [
        ["pending", 1, "pending"],
        ["flight", 2, "in_flight"],
        ["received", 3, "received"],
      ] as const) {
        expectSuperseded(() =>
          first.transition({
            actionId,
            expectedVersion: version,
            expectedStatuses: [status],
            nextStatus: "expired",
            at: 1_200 + repeat,
          }),
        );
      }
      expectSuperseded(() => first.authorizeRetry("flight", 2, "runtime-a"));
      expectSuperseded(() =>
        first.reconcilePreviousRuntime("runtime-a", 1_200 + repeat),
      );
      expectSuperseded(() =>
        first.cleanup({ terminalBefore: 2_000, maximumTerminalRecords: 0 }),
      );
    }

    const unchanged = new DatabaseSync(filename);
    expect(
      unchanged
        .prepare(
          `SELECT action_id, status, version, reconciliation_reason
           FROM action_logs ORDER BY action_id`,
        )
        .all(),
    ).toEqual(actionEvidence);
    expect(
      unchanged
        .prepare(
          `SELECT action_id, attempt_number, consumed_at, revoked_at
           FROM action_send_authorizations ORDER BY action_id, attempt_number`,
        )
        .all(),
    ).toEqual(authorizationEvidence);
    expect(
      unchanged
        .prepare(
          `SELECT action_id, attempt_number, outcome
           FROM action_attempts ORDER BY action_id, attempt_number`,
        )
        .all(),
    ).toEqual(attemptEvidence);
    expect(
      unchanged.prepare("SELECT owner_id, reconciled_at FROM runtime_ownership").get(),
    ).toEqual(ownerEvidence);
    unchanged.close();

    expect(second.reconcilePreviousRuntime("runtime-b", 1_300)).toHaveLength(3);
    const active = second.createBeforeFirstSend(action("active", "runtime-b", 1_400));
    if (!active.created) throw new Error("expected active creation");
    expectSuperseded(() => first.revokeSendAuthorization("active", 1, 1_500));
    expectSuperseded(() =>
      first.transition({
        actionId: "active",
        expectedVersion: 1,
        expectedStatuses: ["pending"],
        nextStatus: "expired",
        at: 1_500,
      }),
    );
    expect(
      second.recordAttempt(
        active.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_500,
        "send_started",
      ),
    ).toMatchObject({ actionId: "active", attemptNumber: 1 });
    expect(second.findById("active")).toMatchObject({
      status: "in_flight",
      version: 2,
    });
    first.close();
    second.close();
  });

  it("serializes matching and conflicting duplicate creates across two connections", async () => {
    for (const conflicting of [false, true]) {
      const filename = temporaryDatabase();
      SqliteDurableActionRepository.open({ filename }).close();
      const right = conflicting
        ? { ...action(), actionType: "SPAWN_BOSS" }
        : action();
      const results = await concurrentCreates(filename, action(), right);
      expect(
        results.filter(
          (result) =>
            typeof result === "object" &&
            result !== null &&
            Reflect.get(result, "created") === true &&
            Reflect.get(result, "hasAuthorization") === true,
        ),
      ).toHaveLength(1);
      const database = new DatabaseSync(filename);
      expect(database.prepare("SELECT COUNT(*) AS count FROM action_logs").get()).toMatchObject({
        count: 1,
      });
      expect(
        database
          .prepare("SELECT COUNT(*) AS count FROM action_send_authorizations")
          .get(),
      ).toMatchObject({ count: 1 });
      database.close();
    }
  });

  it("rejects an unconsumed capability after close and reopen", () => {
    const filename = temporaryDatabase();
    const first = SqliteDurableActionRepository.open({ filename });
    const created = first.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    first.close();
    const reopened = SqliteDurableActionRepository.open({ filename });
    expect(() =>
      reopened.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_100,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    reopened.reconcilePreviousRuntime("runtime-2", 1_200);
    expect(() =>
      reopened.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_201,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    const replacement = reopened.createBeforeFirstSend(action("action-2", "runtime-2", 1_300));
    if (!replacement.created) throw new Error("expected replacement creation");
    expect(
      reopened.recordAttempt(
        replacement.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_400,
        "send_started",
      ),
    ).toMatchObject({ actionId: "action-2", attemptNumber: 1 });
    reopened.close();
    const repeated = SqliteDurableActionRepository.open({ filename });
    expect(() =>
      repeated.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_500,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    repeated.close();
  });

  it("does not revive a consumed capability after repository restart", () => {
    const filename = temporaryDatabase();
    const first = SqliteDurableActionRepository.open({ filename });
    const created = first.createBeforeFirstSend(action());
    if (!created.created) throw new Error("expected creation");
    first.recordAttempt(
      created.sendAuthorization,
      { role: "game", clientId: "game-1" },
      1_100,
      "send_started",
    );
    first.close();
    const reopened = SqliteDurableActionRepository.open({ filename });
    expect(() =>
      reopened.recordAttempt(
        created.sendAuthorization,
        { role: "game", clientId: "game-1" },
        1_101,
        "send_started",
      ),
    ).toThrow(PersistenceError);
    reopened.close();
  });

  it("rolls back the whole reconciliation batch when any record fails", () => {
    for (const failingId of ["a", "b", "c"]) {
      const filename = temporaryDatabase();
      const initial = SqliteDurableActionRepository.open({ filename });
      for (const id of ["a", "b", "c"]) {
        initial.createBeforeFirstSend(action(id, "old"));
      }
      initial.close();
      const triggerDatabase = new DatabaseSync(filename);
      triggerDatabase.exec(
        `CREATE TRIGGER fail_reconciliation BEFORE UPDATE ON action_logs
         WHEN OLD.action_id = '${failingId}' AND NEW.reconciliation_reason IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'injected'); END;`,
      );
      triggerDatabase.close();

      const failing = SqliteDurableActionRepository.open({ filename });
      expect(() => failing.reconcilePreviousRuntime("new", 1_200)).toThrow(PersistenceError);
      for (const id of ["a", "b", "c"]) {
        expect(failing.findById(id)).toMatchObject({
          status: "pending",
          version: 1,
          reconciliationReason: null,
        });
        expect(failing.listAttempts(id)).toEqual([]);
      }
      failing.close();

      const repair = new DatabaseSync(filename);
      expect(
        repair
          .prepare(
            "SELECT COUNT(*) AS count FROM action_send_authorizations WHERE revoked_at IS NOT NULL",
          )
          .get(),
      ).toMatchObject({ count: 0 });
      repair.exec("DROP TRIGGER fail_reconciliation");
      repair.close();
      const recovered = SqliteDurableActionRepository.open({ filename });
      expect(recovered.reconcilePreviousRuntime("new", 1_200)).toHaveLength(3);
      expect(recovered.reconcilePreviousRuntime("new", 1_300)).toEqual([]);
      recovered.close();
      const evidence = new DatabaseSync(filename);
      expect(
        evidence
          .prepare(
            "SELECT COUNT(*) AS count FROM action_send_authorizations WHERE revoked_at IS NOT NULL",
          )
          .get(),
      ).toMatchObject({ count: 3 });
      evidence.close();
    }
  });

  it("rejects duplicate IDs, idempotency conflicts, and invalid JSON values", () => {
    const repository = SqliteDurableActionRepository.open({ filename: temporaryDatabase() });
    repository.createBeforeFirstSend(action("a"));
    expect(() =>
      repository.createBeforeFirstSend({ ...action("a"), idempotencyKey: "different" }),
    ).toThrow(PersistenceError);
    expect(() =>
      repository.createBeforeFirstSend({ ...action("b"), idempotencyKey: "idempotency-a" }),
    ).toThrow(PersistenceError);
    for (const params of [
      undefined,
      Number.NaN,
      Infinity,
      BigInt(1),
      Symbol("x"),
      () => 1,
      new Date(),
      new Map(),
      new Set(),
      new (class Example {})(),
    ]) {
      expect(() =>
        repository.createBeforeFirstSend({
          ...action(`bad-${String(params)}`),
          params,
        }),
      ).toThrow();
    }
    repository.close();
  });

  it("retention removes bounded terminal records but preserves active work", () => {
    const repository = SqliteDurableActionRepository.open({ filename: temporaryDatabase() });
    const active = repository.createBeforeFirstSend(action("active"));
    const terminal = repository.createBeforeFirstSend(action("terminal"));
    const attempt = repository.recordAttempt(
      terminal.sendAuthorization,
      { role: "game", clientId: "game-1" },
      1_100,
      "send_started",
    );
    expect(attempt.attemptNumber).toBe(1);
    const inflight = repository.findById("terminal");
    const received = repository.transition({
      actionId: "terminal",
      expectedVersion: inflight?.version ?? 0,
      expectedStatuses: ["in_flight"],
      nextStatus: "received",
      at: 1_200,
    });
    repository.transition({
      actionId: "terminal",
      expectedVersion: received.version,
      expectedStatuses: ["received"],
      nextStatus: "completed",
      at: 1_300,
    });
    expect(repository.cleanup({ terminalBefore: 2_000, maximumTerminalRecords: 0 })).toBe(1);
    expect(repository.findById(active.record.actionId)).not.toBeNull();
    repository.close();
  });

  it("stores JSON-safe configuration and bounded event diagnostics", () => {
    const repository = SqliteDurableActionRepository.open({ filename: temporaryDatabase() });
    repository.putConfiguration({
      kind: "game_manifest",
      id: "game-1",
      gameId: null,
      value: { actions: ["SPAWN_ZOMBIE"] },
      updatedAt: 1_000,
    });
    expect(repository.getConfiguration("game_manifest", "game-1")).toEqual({
      kind: "game_manifest",
      id: "game-1",
      gameId: null,
      value: { actions: ["SPAWN_ZOMBIE"] },
      updatedAt: 1_000,
    });
    expect(() =>
      repository.putConfiguration({
        kind: "app_setting",
        id: "bad",
        gameId: null,
        value: new Date(),
        updatedAt: 1_000,
      }),
    ).toThrow(PersistenceError);
    repository.appendEvent({
      eventId: "e1",
      eventType: "LIVE_COMMENT",
      event: { text: "one" },
      createdAt: 1_000,
    });
    repository.appendEvent({
      eventId: "e2",
      eventType: "LIVE_COMMENT",
      event: { text: "two" },
      createdAt: 2_000,
    });
    expect(repository.getEvent("e1")?.event).toEqual({ text: "one" });
    expect(repository.cleanupEvents(0, 1)).toBe(1);
    expect(repository.getEvent("e1")).toBeNull();
    expect(repository.getEvent("e2")).not.toBeNull();
    repository.close();
  });
});
