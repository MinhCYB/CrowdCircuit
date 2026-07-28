import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { GameActionActorSchema, JsonValueSchema, type JsonValue } from "@crowdcircuit/contracts";
import type {
  BudgetAdmissionRequest,
  BudgetAdmissionResult,
  DurableBudgetRepository,
} from "@crowdcircuit/mapping-engine";
import { z } from "zod";
import { migrateDatabase } from "./migrations.js";
import { admitMappingBudget, admitMappingBudgetInTransaction } from "./budget.js";
import { computeActionId } from "../delivery/action-id.js";
import {
  issueSendAuthorization,
  readSendAuthorization,
  type AuthorizationDetails,
} from "./authorization.js";
import {
  ACTION_STATUSES,
  PersistenceError,
  type ActionAttempt,
  type ActionTransition,
  type ConfigurationDocument,
  type ConfigurationKind,
  type CreateDurableAction,
  type DurableActionRecord,
  type DurableActionRepository,
  type DurableCreateResult,
  type DeliveryAttemptBinding,
  type PendingCreateResult,
  type DeferredCandidateRecord,
  type DeferredPromotionResult,
  type EnqueueDeferredCandidate,
  type ReconciliationResult,
  type NonterminalActionStatus,
  type RetentionPolicy,
  type SendAuthorization,
  type EventDiagnostic,
} from "./types.js";

const StatusSchema = z.enum(ACTION_STATUSES);
const MAX_DEFERRED_CANDIDATES_PER_GAME = 4_096;
const DEFERRED_CLEANUP_SWEEP_LIMIT = 128;
const RowSchema = z.object({
  action_id: z.string(),
  idempotency_key: z.string(),
  event_id: z.string().nullable(),
  mapping_id: z.string().nullable(),
  game_id: z.string(),
  action_type: z.string(),
  params_json: z.string(),
  status: StatusSchema,
  priority: z.number().int(),
  ttl_ms: z.number().int().positive(),
  retry_count: z.number().int().nonnegative(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
  expires_at: z.number().int().nonnegative(),
  received_at: z.number().int().nonnegative().nullable(),
  completed_at: z.number().int().nonnegative().nullable(),
  failure_code: z.string().nullable(),
  result_json: z.string().nullable(),
  reconciliation_reason: z.string().nullable(),
  runtime_id: z.string(),
  version: z.number().int().positive(),
  next_attempt_at: z.number().int().nonnegative().nullable().optional(),
});

const AttemptRowSchema = z.object({
  action_id: z.string(),
  attempt_number: z.number().int().positive(),
  runtime_id: z.string(),
  attempted_at: z.number().int().nonnegative(),
  outcome: z.enum(["send_started", "send_failed"]),
  failure_code: z.string().nullable(),
  game_instance_id: z.string().nullable().optional(),
});

const nonempty = (value: string, name: string): void => {
  if (value.length === 0 || value.length > 256) {
    throw new PersistenceError("INVALID_INPUT", `${name} is invalid`);
  }
};

const timestamp = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PersistenceError("INVALID_INPUT", `${name} is invalid`);
  }
};

function normalizeGameInstanceId(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    if (value.length === 0 || value.length > 256) {
      throw new PersistenceError("INVALID_INPUT", "Game instance ID is invalid");
    }
    return value;
  }
  throw new PersistenceError("INVALID_INPUT", "Game instance ID is invalid");
}

function parseRecord(raw: unknown): DurableActionRecord {
  const row = RowSchema.safeParse(raw);
  if (!row.success) {
    throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored action record is invalid");
  }
  let paramsUnknown: unknown;
  try {
    paramsUnknown = JSON.parse(row.data.params_json);
  } catch {
    throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored action parameters are invalid");
  }
  const params = JsonValueSchema.safeParse(paramsUnknown);
  if (!params.success) {
    throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored action parameters are invalid");
  }
  let resultDetails: JsonValue | null = null;
  if (row.data.result_json !== null) {
    let resultUnknown: unknown;
    try {
      resultUnknown = JSON.parse(row.data.result_json);
    } catch {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored action result is invalid");
    }
    const parsedResult = JsonValueSchema.safeParse(resultUnknown);
    if (!parsedResult.success) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored action result is invalid");
    }
    resultDetails = parsedResult.data;
  }
  return {
    actionId: row.data.action_id,
    idempotencyKey: row.data.idempotency_key,
    eventId: row.data.event_id,
    mappingId: row.data.mapping_id,
    gameId: row.data.game_id,
    actionType: row.data.action_type,
    params: params.data,
    status: row.data.status,
    priority: row.data.priority,
    ttlMs: row.data.ttl_ms,
    retryCount: row.data.retry_count,
    createdAt: row.data.created_at,
    updatedAt: row.data.updated_at,
    expiresAt: row.data.expires_at,
    receivedAt: row.data.received_at,
    completedAt: row.data.completed_at,
    failureCode: row.data.failure_code,
    resultDetails,
    reconciliationReason: row.data.reconciliation_reason,
    runtimeId: row.data.runtime_id,
    version: row.data.version,
    nextAttemptAt: row.data.next_attempt_at ?? null,
  };
}

function parseDeferredRecord(raw: unknown): DeferredCandidateRecord {
  const row = z.object({
    idempotency_seed: z.string().min(1),
    game_profile_id: z.string().min(1),
    game_id: z.string().min(1),
    rule_id: z.string().min(1),
    event_id: z.string().min(1),
    event_type: z.string().min(1),
    candidate_ordinal: z.number().int().nonnegative(),
    action_type: z.string().min(1),
    params_json: z.string(),
    actor_json: z.string().nullable(),
    user_budget_key: z.string().min(1),
    priority: z.number().int(),
    action_priority: z.number().int(),
    candidate_ttl_ms: z.number().int().positive(),
    deferred_expires_at: z.number().int().nonnegative(),
    created_at: z.number().int().nonnegative(),
    admission_snapshot_json: z.string(),
    status: z.enum(["queued", "promoted", "expired"]),
    owning_runtime_id: z.string().min(1),
    promoted_action_id: z.string().nullable(),
    promoted_at: z.number().int().nonnegative().nullable(),
  }).safeParse(raw);
  if (!row.success) {
    throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored deferred candidate is invalid");
  }
  try {
    const params = JsonValueSchema.parse(JSON.parse(row.data.params_json));
    const actor = row.data.actor_json === null
      ? null
      : GameActionActorSchema.parse(JSON.parse(row.data.actor_json));
    const snapshot = z.object({
      gameProfileId: z.string().min(1),
      ruleId: z.string().min(1),
      userBudgetKey: z.string().min(1),
      userLimit: z.object({ limitPerMinute: z.number().int().positive() }).strict(),
      cooldownMs: z.number().int().nonnegative(),
      ruleLimit: z.object({ limitPerMinute: z.number().int().positive() }).strict(),
      globalToken: z.object({
        maxPerSecond: z.number().finite().positive(),
        burst: z.number().finite().positive(),
      }).strict(),
      capacityConfig: z.object({
        maxUserBuckets: z.number().int().positive(),
        inactiveRetentionMs: z.number().int().min(60_000),
        sweepLimit: z.number().int().positive(),
      }).strict(),
    }).strict().parse(JSON.parse(row.data.admission_snapshot_json));
    return {
      candidate: {
        idempotencySeed: row.data.idempotency_seed,
        seedInput: {
          seedFormatVersion: 1,
          gameProfileId: row.data.game_profile_id,
          ruleId: row.data.rule_id,
          eventId: row.data.event_id,
          candidateOrdinal: row.data.candidate_ordinal,
          actionType: row.data.action_type,
          params,
        },
        gameProfileId: row.data.game_profile_id,
        gameId: row.data.game_id,
        ruleId: row.data.rule_id,
        eventId: row.data.event_id,
        eventType: row.data.event_type,
        candidateOrdinal: row.data.candidate_ordinal,
        actionType: row.data.action_type,
        params,
        actor,
        userBudgetKey: row.data.user_budget_key,
        priority: row.data.priority,
        actionPriority: row.data.action_priority,
        ttlMs: row.data.candidate_ttl_ms,
      },
      deferredExpiresAt: row.data.deferred_expires_at,
      createdAt: row.data.created_at,
      admissionSnapshot: snapshot,
      status: row.data.status,
      owningRuntimeId: row.data.owning_runtime_id,
      promotedActionId: row.data.promoted_action_id,
      promotedAt: row.data.promoted_at,
    };
  } catch {
    throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored deferred candidate is invalid");
  }
}

function validateCreate(input: CreateDurableAction): void {
  nonempty(input.actionId, "Action ID");
  nonempty(input.idempotencyKey, "Idempotency key");
  nonempty(input.gameId, "Game ID");
  normalizeGameInstanceId(input.gameInstanceId);
  nonempty(input.actionType, "Action type");
  nonempty(input.runtimeId, "Runtime ID");
  if (input.nextAttemptAt !== undefined && input.nextAttemptAt !== null) {
    if (!Number.isSafeInteger(input.nextAttemptAt) || input.nextAttemptAt < 0) {
      throw new PersistenceError("INVALID_INPUT", "Next attempt timestamp is invalid");
    }
  }
  if (!JsonValueSchema.safeParse(input.params).success) {
    throw new PersistenceError("INVALID_INPUT", "Action parameters must be JSON-safe");
  }
  if (!Number.isSafeInteger(input.priority)) {
    throw new PersistenceError("INVALID_INPUT", "Priority is invalid");
  }
  if (!Number.isSafeInteger(input.ttlMs) || input.ttlMs <= 0) {
    throw new PersistenceError("INVALID_INPUT", "TTL is invalid");
  }
  timestamp(input.createdAt, "Created timestamp");
  timestamp(input.expiresAt, "Expiry timestamp");
  if (input.expiresAt !== input.createdAt + input.ttlMs) {
    throw new PersistenceError("INVALID_INPUT", "Expiry must equal creation plus TTL");
  }
}

const LEGAL_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  pending: ["in_flight", "expired", "aborted_restart"],
  in_flight: [
    "received",
    "delivery_failed",
    "expired",
    "delivery_unknown_restart",
  ],
  received: [
    "completed",
    "failed",
    "expired",
    "delivery_unknown_restart",
  ],
};

export interface OpenActionRepositoryOptions {
  readonly filename: string;
  /** @internal */
  readonly failAfterOpen?: boolean;
  /** @internal */
  readonly authorizationRandom?: (size: number) => Uint8Array;
  /** @internal */
  readonly runtimeOwnerRandom?: (size: number) => Uint8Array;
  /** @internal */
  readonly transactionFault?: (
    operation: "create" | "attempt" | "reconcile" | "budget",
    phase: "before_commit" | "commit_path" | "after_statements",
  ) => void;
}

export class SqliteDurableActionRepository
  implements DurableActionRepository, DurableBudgetRepository
{
  readonly #database: DatabaseSync;
  readonly #authorizationRandom: (size: number) => Uint8Array;
  readonly #repositoryOwner = {};
  readonly #runtimeOwnerId: string;
  readonly #transactionFault: NonNullable<
    OpenActionRepositoryOptions["transactionFault"]
  > | null;
  #reconciliationComplete: boolean;
  #closed = false;

  private constructor(
    database: DatabaseSync,
    authorizationRandom: (size: number) => Uint8Array,
    runtimeOwnerId: string,
    reconciliationComplete: boolean,
    transactionFault: OpenActionRepositoryOptions["transactionFault"],
  ) {
    this.#database = database;
    this.#authorizationRandom = authorizationRandom;
    this.#runtimeOwnerId = runtimeOwnerId;
    this.#reconciliationComplete = reconciliationComplete;
    this.#transactionFault = transactionFault ?? null;
  }

  static open(options: OpenActionRepositoryOptions): SqliteDurableActionRepository {
    nonempty(options.filename, "Database filename");
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.filename);
      if (options.failAfterOpen === true) {
        database.close();
        database = undefined;
        throw new Error("simulated");
      }
      database.exec("PRAGMA busy_timeout = 1000");
      migrateDatabase(database);
      const ownerRandom = (options.runtimeOwnerRandom ?? randomBytes)(32);
      if (!(ownerRandom instanceof Uint8Array) || ownerRandom.byteLength !== 32) {
        throw new PersistenceError("DATABASE_UNAVAILABLE", "Runtime ownership generation failed");
      }
      const runtimeOwnerId = createHash("sha256").update(ownerRandom).digest("hex");
      database.exec("BEGIN IMMEDIATE");
      const previousOwner = database
        .prepare("SELECT owner_id FROM runtime_ownership WHERE singleton_id = 1")
        .get();
      database
        .prepare(
          `INSERT INTO runtime_ownership(singleton_id, owner_id, reconciled_at)
           VALUES (1, ?, ?)
           ON CONFLICT(singleton_id) DO UPDATE SET owner_id = excluded.owner_id,
             reconciled_at = excluded.reconciled_at`,
        )
        .run(runtimeOwnerId, previousOwner === undefined ? 0 : null);
      database.exec("COMMIT");
      return new SqliteDurableActionRepository(
        database,
        options.authorizationRandom ?? randomBytes,
        runtimeOwnerId,
        previousOwner === undefined,
        options.transactionFault,
      );
    } catch (error) {
      try {
        database?.close();
      } catch {
        // Initialization already failed; expose only the typed failure.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Database is unavailable");
    }
  }

  admit(input: BudgetAdmissionRequest): BudgetAdmissionResult {
    return admitMappingBudget(
      this.#database,
      input,
      () => this.#requireActiveOwner(true),
      this.#transactionFault === null
        ? null
        : () => this.#transactionFault?.("budget", "before_commit"),
    );
  }

  createPending(input: CreateDurableAction): PendingCreateResult {
    validateCreate(input);
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const existingById = this.#findById(input.actionId);
      const existingByKey = this.#findByIdempotencyKey(input.idempotencyKey);
      const existing = existingById ?? existingByKey;
      if (existing !== null) {
        if (!this.#sameCanonicalCreate(existing, input)) {
          throw new PersistenceError(
            existingById !== null ? "DUPLICATE_ACTION" : "IDEMPOTENCY_CONFLICT",
            "Existing durable action conflicts with the canonical request",
          );
        }
        this.#database.exec("COMMIT");
        return { created: false, record: existing, reason: "already_exists" };
      }
      this.#insertPendingAction(input);
      this.#commitTransaction("create");
      return { created: true, record: this.require(input.actionId) };
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the authoritative typed failure.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Durable action write failed");
    }
  }

  createBeforeFirstSend(input: CreateDurableAction): DurableCreateResult {
    validateCreate(input);
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const existingById = this.#findById(input.actionId);
      const idempotent = this.#findByIdempotencyKey(input.idempotencyKey);
      const existing = existingById ?? idempotent;
      if (existing !== null) {
        if (!this.#sameCreate(existing, input)) {
          throw new PersistenceError(
            existingById !== null ? "DUPLICATE_ACTION" : "IDEMPOTENCY_CONFLICT",
            "Existing durable action conflicts with the request",
          );
        }
        const authorization = this.#database
          .prepare(
            "SELECT consumed_at FROM action_send_authorizations WHERE action_id = ? AND attempt_number = 1",
          )
          .get(existing.actionId);
        this.#database.exec("COMMIT");
        return {
          record: existing,
          sendAuthorization: null,
          created: false,
          reason:
            authorization !== undefined &&
            Reflect.get(authorization, "consumed_at") === null
              ? "already_authorized"
              : "already_consumed",
        };
      }
      this.#database
        .prepare(
          `INSERT INTO action_logs (
            action_id, idempotency_key, event_id, mapping_id, game_id, action_type,
            params_json, status, priority, ttl_ms, retry_count, created_at, updated_at,
            expires_at, received_at, completed_at, failure_code, result_json,
            reconciliation_reason, runtime_id, version, next_attempt_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 1, ?)`,
        )
        .run(
          input.actionId,
          input.idempotencyKey,
          input.eventId,
          input.mappingId,
          input.gameId,
          input.actionType,
          JSON.stringify(input.params),
          input.priority,
          input.ttlMs,
          input.createdAt,
          input.createdAt,
          input.expiresAt,
          input.runtimeId,
          input.nextAttemptAt ?? null,
        );
      const details = this.#newAuthorizationDetails(input, 1);
      this.#insertAuthorization(details);
      this.#commitTransaction("create");
      const record = this.require(input.actionId);
      return {
        record,
        sendAuthorization: issueSendAuthorization(details),
        created: true,
      };
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // The original transaction failure is intentionally hidden.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Durable action write failed");
    }
  }

  authorizeRetry(
    actionId: string,
    expectedVersion: number,
    runtimeId: string,
    binding: DeliveryAttemptBinding,
  ): SendAuthorization {
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      if (binding === undefined) {
        throw new PersistenceError("INVALID_INPUT", "Delivery attempt binding is required for retry authorization");
      }
      const current = this.require(actionId);
      if (
        current.status !== "in_flight" ||
        current.version !== expectedVersion ||
        current.runtimeId !== runtimeId
      ) {
        throw new PersistenceError("STALE_TRANSITION", "Retry authorization is stale");
      }
      const details = this.#newAuthorizationDetails(
        current,
        current.retryCount + 1,
        binding,
      );
      this.#insertAuthorization(details);
      this.#commitTransaction("attempt");
      return issueSendAuthorization(details);
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the typed authorization failure.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("ALREADY_AUTHORIZED", "Retry is already authorized");
    }
  }

  authorizePending(
    actionId: string,
    expectedVersion: number,
    runtimeId: string,
    binding: DeliveryAttemptBinding,
  ): SendAuthorization {
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const current = this.require(actionId);
      if (
        current.status !== "pending" ||
        current.version !== expectedVersion ||
        current.runtimeId !== runtimeId
      ) {
        throw new PersistenceError("STALE_TRANSITION", "Initial authorization is stale");
      }
      const details = this.#newAuthorizationDetails(
        current,
        1,
        binding,
      );
      this.#insertAuthorization(details);
      this.#commitTransaction("attempt");
      return issueSendAuthorization(details);
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the typed authorization failure.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("ALREADY_AUTHORIZED", "Initial send is already authorized");
    }
  }

  revokeSendAuthorization(actionId: string, attemptNumber: number, at: number): boolean {
    nonempty(actionId, "Action ID");
    timestamp(at, "Revocation timestamp");
    if (!Number.isSafeInteger(attemptNumber) || attemptNumber <= 0) {
      throw new PersistenceError("INVALID_INPUT", "Attempt number is invalid");
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const result = this.#database
        .prepare(
          `UPDATE action_send_authorizations AS authorization SET revoked_at = ?
           WHERE authorization.action_id = ? AND authorization.attempt_number = ?
           AND authorization.runtime_owner_id = ?
           AND authorization.consumed_at IS NULL AND authorization.revoked_at IS NULL
           AND EXISTS (
             SELECT 1 FROM action_logs AS action
             WHERE action.action_id = authorization.action_id
             AND action.version = authorization.expected_version
             AND action.status IN ('pending', 'in_flight', 'received')
           )`,
        )
        .run(at, actionId, attemptNumber, this.#runtimeOwnerId);
      this.#database.exec("COMMIT");
      return result.changes === 1;
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the authoritative typed ownership/write failure.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Authorization revocation failed");
    }
  }

  findById(actionId: string): DurableActionRecord | null {
    nonempty(actionId, "Action ID");
    const row = this.#database.prepare("SELECT * FROM action_logs WHERE action_id = ?").get(actionId);
    return row === undefined ? null : parseRecord(row);
  }

  putConfiguration(document: ConfigurationDocument): void {
    nonempty(document.id, "Configuration ID");
    timestamp(document.updatedAt, "Configuration timestamp");
    const value = JsonValueSchema.safeParse(document.value);
    if (!value.success) {
      throw new PersistenceError("INVALID_INPUT", "Configuration must be JSON-safe");
    }
    const json = JSON.stringify(value.data);
    try {
      if (document.kind === "app_setting") {
        this.#upsert(
          "INSERT INTO app_settings(key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
          [document.id, json, document.updatedAt],
        );
      } else if (document.kind === "connector_profile") {
        this.#upsert(
          "INSERT INTO connector_profiles(connector_id, profile_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(connector_id) DO UPDATE SET profile_json=excluded.profile_json, updated_at=excluded.updated_at",
          [document.id, json, document.updatedAt],
        );
      } else if (document.kind === "game_manifest") {
        this.#upsert(
          "INSERT INTO game_manifests(game_id, manifest_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(game_id) DO UPDATE SET manifest_json=excluded.manifest_json, updated_at=excluded.updated_at",
          [document.id, json, document.updatedAt],
        );
      } else {
        if (document.gameId === null) {
          throw new PersistenceError("INVALID_INPUT", "Game ID is required");
        }
        nonempty(document.gameId, "Game ID");
        const table =
          document.kind === "game_profile"
            ? {
                sql: "INSERT INTO game_profiles(profile_id, game_id, profile_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id) DO UPDATE SET game_id=excluded.game_id, profile_json=excluded.profile_json, updated_at=excluded.updated_at",
              }
            : {
                sql: "INSERT INTO event_mappings(mapping_id, game_id, mapping_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(mapping_id) DO UPDATE SET game_id=excluded.game_id, mapping_json=excluded.mapping_json, updated_at=excluded.updated_at",
              };
        this.#upsert(table.sql, [document.id, document.gameId, json, document.updatedAt]);
      }
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Configuration write failed");
    }
  }

  getConfiguration(kind: ConfigurationKind, id: string): ConfigurationDocument | null {
    nonempty(id, "Configuration ID");
    const descriptor =
      kind === "app_setting"
        ? { sql: "SELECT key AS id, NULL AS game_id, value_json AS json, updated_at FROM app_settings WHERE key = ?" }
        : kind === "connector_profile"
          ? { sql: "SELECT connector_id AS id, NULL AS game_id, profile_json AS json, updated_at FROM connector_profiles WHERE connector_id = ?" }
          : kind === "game_manifest"
            ? { sql: "SELECT game_id AS id, NULL AS game_id, manifest_json AS json, updated_at FROM game_manifests WHERE game_id = ?" }
            : kind === "game_profile"
              ? { sql: "SELECT profile_id AS id, game_id, profile_json AS json, updated_at FROM game_profiles WHERE profile_id = ?" }
              : { sql: "SELECT mapping_id AS id, game_id, mapping_json AS json, updated_at FROM event_mappings WHERE mapping_id = ?" };
    const raw = this.#database.prepare(descriptor.sql).get(id);
    if (raw === undefined) return null;
    return this.#parseConfiguration(kind, raw);
  }

  appendEvent(event: EventDiagnostic): void {
    nonempty(event.eventId, "Event ID");
    nonempty(event.eventType, "Event type");
    timestamp(event.createdAt, "Event timestamp");
    const parsed = JsonValueSchema.safeParse(event.event);
    if (!parsed.success) {
      throw new PersistenceError("INVALID_INPUT", "Event diagnostic must be JSON-safe");
    }
    try {
      this.#database
        .prepare(
          "INSERT INTO event_logs(event_id, event_type, event_json, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(event.eventId, event.eventType, JSON.stringify(parsed.data), event.createdAt);
    } catch {
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Event diagnostic write failed");
    }
  }

  getEvent(eventId: string): EventDiagnostic | null {
    nonempty(eventId, "Event ID");
    const raw = this.#database
      .prepare("SELECT event_id, event_type, event_json, created_at FROM event_logs WHERE event_id = ?")
      .get(eventId);
    if (raw === undefined) return null;
    const shape = z.object({
      event_id: z.string(),
      event_type: z.string(),
      event_json: z.string(),
      created_at: z.number().int().nonnegative(),
    }).safeParse(raw);
    if (!shape.success) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored event diagnostic is invalid");
    }
    let unknownEvent: unknown;
    try {
      unknownEvent = JSON.parse(shape.data.event_json);
    } catch {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored event diagnostic is invalid");
    }
    const event = JsonValueSchema.safeParse(unknownEvent);
    if (!event.success) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored event diagnostic is invalid");
    }
    return {
      eventId: shape.data.event_id,
      eventType: shape.data.event_type,
      event: event.data,
      createdAt: shape.data.created_at,
    };
  }

  cleanupEvents(createdBefore: number, maximumRecords: number): number {
    timestamp(createdBefore, "Retention timestamp");
    if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 0) {
      throw new PersistenceError("INVALID_INPUT", "Retention limit is invalid");
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      const old = this.#database
        .prepare("DELETE FROM event_logs WHERE created_at < ?")
        .run(createdBefore).changes;
      const overflow = this.#database
        .prepare(
          `DELETE FROM event_logs WHERE event_id IN (
            SELECT event_id FROM event_logs ORDER BY created_at DESC, event_id DESC
            LIMIT -1 OFFSET ?
          )`,
        )
        .run(maximumRecords).changes;
      this.#database.exec("COMMIT");
      return Number(old) + Number(overflow);
    } catch {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Expose one typed cleanup failure.
      }
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Event cleanup failed");
    }
  }

  findByIdempotencyKey(idempotencyKey: string): DurableActionRecord | null {
    nonempty(idempotencyKey, "Idempotency key");
    const row = this.#database
      .prepare("SELECT * FROM action_logs WHERE idempotency_key = ?")
      .get(idempotencyKey);
    return row === undefined ? null : parseRecord(row);
  }

  transition(input: ActionTransition): DurableActionRecord {
    nonempty(input.actionId, "Action ID");
    timestamp(input.at, "Transition timestamp");
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion <= 0) {
      throw new PersistenceError("INVALID_INPUT", "Expected version is invalid");
    }
    if (input.expectedStatuses.length === 0) {
      throw new PersistenceError("INVALID_INPUT", "Expected status is required");
    }
    if (
      input.resultDetails !== undefined &&
      input.resultDetails !== null &&
      !JsonValueSchema.safeParse(input.resultDetails).success
    ) {
      throw new PersistenceError("INVALID_INPUT", "Result details must be JSON-safe");
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const current = this.require(input.actionId);
      if (
        current.version !== input.expectedVersion ||
        !input.expectedStatuses.includes(current.status)
      ) {
        throw new PersistenceError("STALE_TRANSITION", "Action state changed");
      }
      if (!(LEGAL_TRANSITIONS[current.status] ?? []).includes(input.nextStatus)) {
        throw new PersistenceError("ILLEGAL_TRANSITION", "Action transition is not allowed");
      }
      const receivedAt = input.nextStatus === "received" ? input.at : current.receivedAt;
      const completedAt =
        input.nextStatus === "completed" || input.nextStatus === "failed"
          ? input.at
          : current.completedAt;
      const result = this.#database
        .prepare(
          `UPDATE action_logs
           SET status = ?, updated_at = ?, received_at = ?, completed_at = ?,
               failure_code = ?, result_json = ?, version = version + 1
           WHERE action_id = ? AND version = ? AND status = ?`,
        )
        .run(
          input.nextStatus,
          input.at,
          receivedAt,
          completedAt,
          input.failureCode ?? null,
          input.resultDetails === undefined || input.resultDetails === null
            ? null
            : JSON.stringify(input.resultDetails),
          input.actionId,
          input.expectedVersion,
          current.status,
        );
      if (result.changes !== 1) {
        throw new PersistenceError("STALE_TRANSITION", "Action state changed");
      }
      this.#database.exec("COMMIT");
      return this.require(input.actionId);
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the authoritative typed ownership/transition failure.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Action transition failed");
    }
  }

  recordAttempt(
    authorization: SendAuthorization,
    binding: {
      readonly role: "game";
      readonly clientId: string;
      readonly gameInstanceId: string;
    },
    attemptedAt: number,
    outcome: ActionAttempt["outcome"],
    failureCode: string | null = null,
  ): ActionAttempt {
    timestamp(attemptedAt, "Attempt timestamp");
    const details = readSendAuthorization(authorization, this.#repositoryOwner);
    if (details === null) {
      throw new PersistenceError("INVALID_AUTHORIZATION", "Send authorization is invalid");
    }
    if (binding.role !== details.role || binding.clientId !== details.clientId) {
      throw new PersistenceError("INVALID_AUTHORIZATION", "Send authorization is invalid");
    }
    const normalizedBindingInstance = normalizeGameInstanceId(binding.gameInstanceId);
    if (normalizedBindingInstance !== details.gameInstanceId) {
      throw new PersistenceError("INVALID_AUTHORIZATION", "Send authorization is invalid");
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const current = this.#findById(details.actionId);
      if (
        current === null ||
        current.runtimeId !== details.runtimeId ||
        current.version !== details.expectedVersion ||
        current.expiresAt !== details.expiresAt ||
        attemptedAt >= details.expiresAt ||
        (current.status !== "pending" && current.status !== "in_flight")
      ) {
        throw new PersistenceError("STALE_TRANSITION", "Send authorization is stale");
      }
      const consumed = this.#database
        .prepare(
          `UPDATE action_send_authorizations SET consumed_at = ?
           WHERE authorization_id = ? AND action_id = ? AND expected_version = ?
           AND attempt_number = ? AND runtime_id = ? AND role = ? AND client_id = ?
           AND expires_at = ? AND runtime_owner_id = ?
           AND (game_instance_id IS ? OR (game_instance_id IS NULL AND ? IS NULL))
           AND consumed_at IS NULL AND revoked_at IS NULL`,
        )
        .run(
          attemptedAt,
          details.authorizationId,
          details.actionId,
          details.expectedVersion,
          details.attemptNumber,
          details.runtimeId,
          details.role,
          details.clientId,
          details.expiresAt,
          details.runtimeOwnerId,
          details.gameInstanceId,
          details.gameInstanceId,
        );
      if (consumed.changes !== 1) {
        throw new PersistenceError("INVALID_AUTHORIZATION", "Send authorization is invalid");
      }
      this.#database
        .prepare(
          `INSERT INTO action_attempts
           (action_id, attempt_number, runtime_id, attempted_at, outcome, failure_code, game_instance_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          current.actionId,
          details.attemptNumber,
          details.runtimeId,
          attemptedAt,
          outcome,
          failureCode,
          details.gameInstanceId,
        );
      const result = this.#database
        .prepare(
          `UPDATE action_logs SET status = 'in_flight', retry_count = ?,
           updated_at = ?, failure_code = ?, version = version + 1
           WHERE action_id = ? AND version = ? AND status IN ('pending', 'in_flight')`,
        )
        .run(
          details.attemptNumber,
          attemptedAt,
          outcome === "send_failed" ? failureCode : null,
          current.actionId,
          current.version,
        );
      if (result.changes !== 1) {
        throw new PersistenceError("STALE_TRANSITION", "Send authorization is stale");
      }
      this.#commitTransaction("attempt");
      return {
        actionId: current.actionId,
        attemptNumber: details.attemptNumber,
        runtimeId: details.runtimeId,
        attemptedAt,
        outcome,
        failureCode,
        gameInstanceId: details.gameInstanceId,
      };
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // The typed public failure remains authoritative.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Attempt write failed");
    }
  }

  listAttempts(actionId: string): readonly ActionAttempt[] {
    nonempty(actionId, "Action ID");
    const rows = this.#database
      .prepare("SELECT * FROM action_attempts WHERE action_id = ? ORDER BY attempt_number")
      .all(actionId);
    return rows.map((row) => {
      const parsed = AttemptRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored attempt is invalid");
      }
      return {
        actionId: parsed.data.action_id,
        attemptNumber: parsed.data.attempt_number,
        runtimeId: parsed.data.runtime_id,
        attemptedAt: parsed.data.attempted_at,
        outcome: parsed.data.outcome,
        failureCode: parsed.data.failure_code,
        gameInstanceId: parsed.data.game_instance_id ?? null,
      };
    });
  }

  listNonterminal(): readonly DurableActionRecord[] {
    return this.#database
      .prepare(
        "SELECT * FROM action_logs WHERE status IN ('pending', 'in_flight', 'received') ORDER BY created_at, action_id",
      )
      .all()
      .map(parseRecord);
  }

  enqueueDeferredCandidate(input: EnqueueDeferredCandidate): DeferredCandidateRecord {
    const { candidate, admissionSnapshot } = input;
    nonempty(input.runtimeId, "Runtime ID");
    timestamp(input.createdAt, "Deferred creation timestamp");
    timestamp(input.deferredExpiresAt, "Deferred expiry timestamp");
    if (input.deferredExpiresAt < input.createdAt) {
      throw new PersistenceError("INVALID_INPUT", "Deferred expiry is invalid");
    }
    if (
      admissionSnapshot.gameProfileId !== candidate.gameProfileId ||
      admissionSnapshot.ruleId !== candidate.ruleId ||
      admissionSnapshot.userBudgetKey !== candidate.userBudgetKey
    ) {
      throw new PersistenceError("INVALID_INPUT", "Admission snapshot identity is invalid");
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const existing = this.#findDeferredCandidate(candidate.idempotencySeed);
      if (existing !== null) {
        if (
          JSON.stringify(existing.candidate) !== JSON.stringify(candidate) ||
          JSON.stringify(existing.admissionSnapshot) !== JSON.stringify(admissionSnapshot) ||
          existing.deferredExpiresAt !== input.deferredExpiresAt
        ) {
          throw new PersistenceError("IDEMPOTENCY_CONFLICT", "Deferred candidate conflicts");
        }
        this.#database.exec("COMMIT");
        return existing;
      }
      this.#database.prepare(
        `UPDATE mapping_budget_deferred_candidates SET status = 'expired'
         WHERE idempotency_seed IN (
           SELECT idempotency_seed FROM mapping_budget_deferred_candidates
           WHERE status = 'queued' AND deferred_expires_at <= ?
           ORDER BY deferred_expires_at ASC, idempotency_seed ASC LIMIT ?
         )`,
      ).run(input.createdAt, DEFERRED_CLEANUP_SWEEP_LIMIT);
      const activeCount = this.#database.prepare(
        `SELECT COUNT(*) AS count FROM mapping_budget_deferred_candidates
         WHERE game_id = ? AND status = 'queued'`,
      ).get(candidate.gameId);
      const activeCountValue = Reflect.get(activeCount ?? {}, "count");
      if (typeof activeCountValue !== "number") {
        throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Deferred capacity state is invalid");
      }
      if (activeCountValue >= MAX_DEFERRED_CANDIDATES_PER_GAME) {
        throw new PersistenceError(
          "DEFERRED_CAPACITY_EXHAUSTED",
          "Deferred candidate capacity is exhausted",
        );
      }
      this.#database.prepare(
        `INSERT INTO mapping_budget_deferred_candidates (
          idempotency_seed, game_profile_id, game_id, rule_id, event_id, event_type,
          candidate_ordinal, action_type, params_json, actor_json, user_budget_key,
          priority, action_priority, candidate_ttl_ms, deferred_expires_at, created_at,
          admission_snapshot_json, status, owning_runtime_id, promoted_action_id, promoted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, NULL, NULL)`,
      ).run(
        candidate.idempotencySeed, candidate.gameProfileId, candidate.gameId,
        candidate.ruleId, candidate.eventId, candidate.eventType,
        candidate.candidateOrdinal, candidate.actionType, JSON.stringify(candidate.params),
        candidate.actor === null ? null : JSON.stringify(candidate.actor),
        candidate.userBudgetKey, candidate.priority, candidate.actionPriority,
        candidate.ttlMs, input.deferredExpiresAt, input.createdAt,
        JSON.stringify(admissionSnapshot), input.runtimeId,
      );
      this.#database.exec("COMMIT");
      const inserted = this.#findDeferredCandidate(candidate.idempotencySeed);
      if (inserted === null) {
        throw new PersistenceError("DATABASE_UNAVAILABLE", "Deferred candidate was not created");
      }
      return inserted;
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* preserve failure */ }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Deferred candidate write failed");
    }
  }

  findDeferredCandidate(idempotencySeed: string): DeferredCandidateRecord | null {
    nonempty(idempotencySeed, "Idempotency seed");
    return this.#findDeferredCandidate(idempotencySeed);
  }

  promoteDeferredCandidate(idempotencySeed: string, now: number): DeferredPromotionResult {
    nonempty(idempotencySeed, "Idempotency seed");
    timestamp(now, "Promotion timestamp");
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const deferred = this.#findDeferredCandidate(idempotencySeed);
      if (deferred === null) {
        this.#database.exec("COMMIT");
        return { status: "not_found" };
      }
      if (deferred.status === "expired" || now >= deferred.deferredExpiresAt) {
        if (deferred.status === "queued") {
          this.#database.prepare(
            "UPDATE mapping_budget_deferred_candidates SET status = 'expired' WHERE idempotency_seed = ? AND status = 'queued'",
          ).run(idempotencySeed);
        }
        this.#database.exec("COMMIT");
        return { status: "expired" };
      }
      if (deferred.status === "promoted") {
        const record = deferred.promotedActionId === null
          ? null
          : this.#findById(deferred.promotedActionId);
        if (record === null) {
          throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Promoted action is missing");
        }
        this.#database.exec("COMMIT");
        return { status: "already_promoted", record };
      }
      const snapshot = deferred.admissionSnapshot;
      const admission = admitMappingBudgetInTransaction(
        this.#database,
        {
          candidate: deferred.candidate,
          now,
          userLimitPerMinute: snapshot.userLimit.limitPerMinute,
          ruleLimitPerMinute: snapshot.ruleLimit.limitPerMinute,
          cooldownMs: snapshot.cooldownMs,
          globalBudget: {
            maxPerSecond: snapshot.globalToken.maxPerSecond,
            burst: snapshot.globalToken.burst,
            overflowPolicy: "reject_newest",
            deferredTtlMs: null,
          },
          capacity: snapshot.capacityConfig,
        },
        () => this.#requireActiveOwner(true),
      );
      if (!admission.admitted) {
        this.#database.exec("ROLLBACK");
        return { status: "not_admitted", reason: admission.reason };
      }
      const actionId = computeActionId(idempotencySeed);
      const create: CreateDurableAction = {
        actionId,
        idempotencyKey: idempotencySeed,
        eventId: deferred.candidate.eventId,
        mappingId: deferred.candidate.ruleId,
        gameId: deferred.candidate.gameId,
        actionType: deferred.candidate.actionType,
        params: deferred.candidate.params,
        priority: deferred.candidate.actionPriority,
        ttlMs: deferred.candidate.ttlMs,
        createdAt: now,
        expiresAt: now + deferred.candidate.ttlMs,
        runtimeId: deferred.owningRuntimeId,
        nextAttemptAt: now,
      };
      const existing = this.#findById(actionId) ?? this.#findByIdempotencyKey(idempotencySeed);
      if (existing === null) {
        this.#insertPendingAction(create);
      } else if (!this.#sameCanonicalCreate(existing, create)) {
        throw new PersistenceError("IDEMPOTENCY_CONFLICT", "Promoted action conflicts");
      }
      const record = existing ?? this.#findById(actionId);
      if (record === null) {
        throw new PersistenceError("DATABASE_UNAVAILABLE", "Promoted action was not created");
      }
      const changed = this.#database.prepare(
        `UPDATE mapping_budget_deferred_candidates
         SET status = 'promoted', promoted_action_id = ?, promoted_at = ?
         WHERE idempotency_seed = ? AND status = 'queued'`,
      ).run(record.actionId, now, idempotencySeed);
      if (changed.changes !== 1) {
        throw new PersistenceError("STALE_TRANSITION", "Deferred promotion changed");
      }
      this.#transactionFault?.("budget", "before_commit");
      this.#requireActiveOwner(true);
      this.#database.exec("COMMIT");
      return { status: "promoted", record: this.require(record.actionId) };
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* preserve failure */ }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Deferred promotion failed");
    }
  }

  listDeliverable(now: number, limit: number): readonly DurableActionRecord[] {
    timestamp(now, "Delivery timestamp");
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new PersistenceError("INVALID_INPUT", "Delivery limit is invalid");
    }
    return this.#database.prepare(
      `SELECT * FROM action_logs
       WHERE status IN ('pending', 'in_flight') AND expires_at > ?
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY priority DESC, created_at ASC, action_id ASC LIMIT ?`,
    ).all(now, now, limit).map(parseRecord);
  }

  scheduleNextAttempt(
    actionId: string,
    expectedVersion: number,
    at: number,
    nextAttemptAt: number,
    failureCode: string,
  ): DurableActionRecord {
    timestamp(at, "Schedule timestamp");
    timestamp(nextAttemptAt, "Next attempt timestamp");
    nonempty(failureCode, "Failure code");
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const changed = this.#database.prepare(
        `UPDATE action_logs SET next_attempt_at = ?, updated_at = ?,
         failure_code = ?, version = version + 1
         WHERE action_id = ? AND version = ? AND status IN ('pending', 'in_flight')`,
      ).run(nextAttemptAt, at, failureCode, actionId, expectedVersion);
      if (changed.changes !== 1) {
        throw new PersistenceError("STALE_TRANSITION", "Retry schedule changed");
      }
      this.#database.exec("COMMIT");
      return this.require(actionId);
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* preserve failure */ }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Retry scheduling failed");
    }
  }

  expireDue(now: number, sweepLimit: number): number {
    timestamp(now, "Expiry timestamp");
    if (!Number.isSafeInteger(sweepLimit) || sweepLimit <= 0) {
      throw new PersistenceError("INVALID_INPUT", "Sweep limit is invalid");
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const actions = this.#database.prepare(
        `UPDATE action_logs SET status = 'expired', updated_at = ?,
         failure_code = 'ttl_expired', version = version + 1
         WHERE action_id IN (
           SELECT action_id FROM action_logs
           WHERE status IN ('pending', 'in_flight', 'received') AND expires_at <= ?
           ORDER BY expires_at ASC, action_id ASC LIMIT ?
         )`,
      ).run(now, now, sweepLimit).changes;
      const deferred = this.#database.prepare(
        `UPDATE mapping_budget_deferred_candidates SET status = 'expired'
         WHERE idempotency_seed IN (
           SELECT idempotency_seed FROM mapping_budget_deferred_candidates
           WHERE status = 'queued' AND deferred_expires_at <= ?
           ORDER BY deferred_expires_at ASC, idempotency_seed ASC LIMIT ?
         )`,
      ).run(now, sweepLimit).changes;
      this.#database.exec("COMMIT");
      return Number(actions) + Number(deferred);
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* preserve failure */ }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Expiry sweep failed");
    }
  }

  reconcilePreviousRuntime(runtimeId: string, now: number): readonly ReconciliationResult[] {
    nonempty(runtimeId, "Runtime ID");
    timestamp(now, "Reconciliation timestamp");
    const classifications: Array<{
      readonly action: DurableActionRecord;
      readonly previousStatus: NonterminalActionStatus;
      readonly next: ReconciliationResult["status"];
      readonly reason: string;
    }> = [];
    for (const action of this.listNonterminal()) {
      if (action.runtimeId === runtimeId) continue;
      if (
        action.status !== "pending" &&
        action.status !== "in_flight" &&
        action.status !== "received"
      ) continue;
      const next: ReconciliationResult["status"] =
        now >= action.expiresAt
          ? "expired"
          : action.status === "pending"
            ? "pending"
            : action.status === "received"
              ? "received"
              : "delivery_unknown_restart";
      const reason =
        next === "expired"
          ? "expired_during_restart"
          : next === "pending"
            ? "pending_reassigned_after_restart"
            : next === "received"
              ? "received_reassigned_after_restart"
              : "delivery_state_unknown_after_restart";
      classifications.push({ action, previousStatus: action.status, next, reason });
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(false);
      for (const classification of classifications) {
        const changed = this.#database
          .prepare(
            `UPDATE action_logs SET status = ?, updated_at = ?, runtime_id = ?,
             reconciliation_reason = ?, version = version + 1
             WHERE action_id = ? AND version = ? AND status = ?`,
          )
          .run(
            classification.next,
            now,
            runtimeId,
            classification.reason,
            classification.action.actionId,
            classification.action.version,
            classification.action.status,
          );
        if (changed.changes !== 1) {
          throw new PersistenceError("STALE_TRANSITION", "Reconciliation state changed");
        }
        this.#database
          .prepare(
            `UPDATE action_send_authorizations SET revoked_at = ?
             WHERE action_id = ? AND consumed_at IS NULL AND revoked_at IS NULL`,
          )
          .run(now, classification.action.actionId);
      }
      this.#database.prepare(
        `UPDATE mapping_budget_deferred_candidates
         SET owning_runtime_id = ?
         WHERE status = 'queued' AND owning_runtime_id <> ? AND deferred_expires_at > ?`,
      ).run(runtimeId, runtimeId, now);
      this.#database.prepare(
        `UPDATE mapping_budget_deferred_candidates SET status = 'expired'
         WHERE status = 'queued' AND deferred_expires_at <= ?`,
      ).run(now);
      this.#database
        .prepare(
          `UPDATE runtime_ownership SET reconciled_at = ?
           WHERE singleton_id = 1 AND owner_id = ?`,
        )
        .run(now, this.#runtimeOwnerId);
      this.#commitTransaction("reconcile");
      this.#reconciliationComplete = true;
      return classifications.map(({ action, previousStatus, next }) => ({
        actionId: action.actionId,
        previousStatus,
        status: next,
      }));
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Expose only the typed reconciliation failure.
      }
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Reconciliation failed");
    }
  }

  cleanup(policy: RetentionPolicy): number {
    timestamp(policy.terminalBefore, "Retention timestamp");
    if (!Number.isSafeInteger(policy.maximumTerminalRecords) || policy.maximumTerminalRecords < 0) {
      throw new PersistenceError("INVALID_INPUT", "Retention limit is invalid");
    }
    const terminal = ACTION_STATUSES.filter(
      (status) => status !== "pending" && status !== "in_flight" && status !== "received",
    );
    const placeholders = terminal.map(() => "?").join(", ");
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#requireActiveOwner(true);
      const old = this.#database
        .prepare(
          `DELETE FROM action_logs WHERE status IN (${placeholders}) AND updated_at < ?`,
        )
        .run(...terminal, policy.terminalBefore).changes;
      const overflow = this.#database
        .prepare(
          `DELETE FROM action_logs WHERE action_id IN (
             SELECT action_id FROM action_logs WHERE status IN (${placeholders})
             ORDER BY updated_at DESC, action_id DESC LIMIT -1 OFFSET ?
           )`,
        )
        .run(...terminal, policy.maximumTerminalRecords).changes;
      this.#database.exec("COMMIT");
      return Number(old) + Number(overflow);
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Expose one typed cleanup failure.
      }
      if (
        error instanceof PersistenceError ||
        (typeof error === "object" &&
          error !== null &&
          Reflect.get(error, "code") === "RUNTIME_SUPERSEDED")
      ) {
        throw error;
      }
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Action cleanup failed");
    }
  }

  close(): void {
    this.#closed = true;
    this.#reconciliationComplete = false;
    this.#database.close();
  }

  private require(actionId: string): DurableActionRecord {
    const action = this.findById(actionId);
    if (action === null) {
      throw new PersistenceError("ACTION_NOT_FOUND", "Action does not exist");
    }
    return action;
  }

  #findById(actionId: string): DurableActionRecord | null {
    const row = this.#database.prepare("SELECT * FROM action_logs WHERE action_id = ?").get(actionId);
    return row === undefined ? null : parseRecord(row);
  }

  #findByIdempotencyKey(idempotencyKey: string): DurableActionRecord | null {
    const row = this.#database
      .prepare("SELECT * FROM action_logs WHERE idempotency_key = ?")
      .get(idempotencyKey);
    return row === undefined ? null : parseRecord(row);
  }

  #findDeferredCandidate(idempotencySeed: string): DeferredCandidateRecord | null {
    const row = this.#database.prepare(
      "SELECT * FROM mapping_budget_deferred_candidates WHERE idempotency_seed = ?",
    ).get(idempotencySeed);
    return row === undefined ? null : parseDeferredRecord(row);
  }

  #sameCreate(record: DurableActionRecord, input: CreateDurableAction): boolean {
    const inputNextAttempt = input.nextAttemptAt ?? null;
    return (
      record.actionId === input.actionId &&
      record.idempotencyKey === input.idempotencyKey &&
      record.eventId === input.eventId &&
      record.mappingId === input.mappingId &&
      record.gameId === input.gameId &&
      record.actionType === input.actionType &&
      JSON.stringify(record.params) === JSON.stringify(input.params) &&
      record.priority === input.priority &&
      record.ttlMs === input.ttlMs &&
      record.createdAt === input.createdAt &&
      record.expiresAt === input.expiresAt &&
      record.runtimeId === input.runtimeId &&
      record.nextAttemptAt === inputNextAttempt
    );
  }

  #sameCanonicalCreate(record: DurableActionRecord, input: CreateDurableAction): boolean {
    return (
      record.actionId === input.actionId &&
      record.idempotencyKey === input.idempotencyKey &&
      record.eventId === input.eventId &&
      record.mappingId === input.mappingId &&
      record.gameId === input.gameId &&
      record.actionType === input.actionType &&
      JSON.stringify(record.params) === JSON.stringify(input.params) &&
      record.priority === input.priority &&
      record.ttlMs === input.ttlMs
    );
  }

  #insertPendingAction(input: CreateDurableAction): void {
    this.#database
      .prepare(
        `INSERT INTO action_logs (
          action_id, idempotency_key, event_id, mapping_id, game_id, action_type,
          params_json, status, priority, ttl_ms, retry_count, created_at, updated_at,
          expires_at, received_at, completed_at, failure_code, result_json,
          reconciliation_reason, runtime_id, version, next_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 1, ?)`,
      )
      .run(
        input.actionId, input.idempotencyKey, input.eventId, input.mappingId,
        input.gameId, input.actionType, JSON.stringify(input.params), input.priority,
        input.ttlMs, input.createdAt, input.createdAt, input.expiresAt,
        input.runtimeId, input.nextAttemptAt ?? null,
      );
  }

  #newAuthorizationDetails(
    input: CreateDurableAction | DurableActionRecord,
    attemptNumber: number,
    binding?: DeliveryAttemptBinding,
  ): AuthorizationDetails {
    const random = this.#authorizationRandom(32);
    if (!(random instanceof Uint8Array) || random.byteLength !== 32) {
      throw new PersistenceError("DATABASE_UNAVAILABLE", "Authorization generation failed");
    }
    if (binding !== undefined) {
      nonempty(binding.clientId, "Client ID");
    }
    const gameInstanceId = normalizeGameInstanceId(
      binding?.gameInstanceId ?? input.gameInstanceId,
    );
    return {
      authorizationId: createHash("sha256").update(random).digest("hex"),
      actionId: input.actionId,
      expectedVersion: "version" in input ? input.version : 1,
      attemptNumber,
      runtimeId: input.runtimeId,
      role: "game",
      clientId: binding?.clientId ?? input.gameId,
      expiresAt: input.expiresAt,
      runtimeOwnerId: this.#runtimeOwnerId,
      repositoryOwner: this.#repositoryOwner,
      gameInstanceId,
    };
  }

  #insertAuthorization(details: AuthorizationDetails): void {
    this.#database
      .prepare(
        `INSERT INTO action_send_authorizations
         (authorization_id, action_id, expected_version, attempt_number,
          runtime_id, runtime_owner_id, role, client_id, expires_at,
          consumed_at, revoked_at, game_instance_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
      )
      .run(
        details.authorizationId,
        details.actionId,
        details.expectedVersion,
        details.attemptNumber,
        details.runtimeId,
        details.runtimeOwnerId,
        details.role,
        details.clientId,
        details.expiresAt,
        details.gameInstanceId,
      );
  }

  #requireActiveOwner(requireReconciled: boolean): void {
    if (this.#closed) {
      throw new PersistenceError("RUNTIME_SUPERSEDED", "Runtime ownership was superseded");
    }
    const ownership = this.#database
      .prepare(
        "SELECT owner_id, reconciled_at FROM runtime_ownership WHERE singleton_id = 1",
      )
      .get();
    if (
      ownership === undefined ||
      Reflect.get(ownership, "owner_id") !== this.#runtimeOwnerId
    ) {
      throw new PersistenceError("RUNTIME_SUPERSEDED", "Runtime ownership was superseded");
    }
    if (
      requireReconciled &&
      (!this.#reconciliationComplete ||
        Reflect.get(ownership, "reconciled_at") === null)
    ) {
      throw new PersistenceError(
        "INVALID_AUTHORIZATION",
        "Runtime reconciliation is required",
      );
    }
  }

  #commitTransaction(operation: "create" | "attempt" | "reconcile"): void {
    this.#transactionFault?.(operation, "after_statements");
    this.#transactionFault?.(operation, "before_commit");
    this.#transactionFault?.(operation, "commit_path");
    this.#database.exec("COMMIT");
  }

  #upsert(sql: string, values: readonly (string | number | null)[]): void {
    this.#database.prepare(sql).run(...values);
  }

  #parseConfiguration(kind: ConfigurationKind, raw: unknown): ConfigurationDocument {
    const shape = z.object({
      id: z.string(),
      game_id: z.string().nullable(),
      json: z.string(),
      updated_at: z.number().int().nonnegative(),
    }).safeParse(raw);
    if (!shape.success) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored configuration is invalid");
    }
    let unknownValue: unknown;
    try {
      unknownValue = JSON.parse(shape.data.json);
    } catch {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored configuration is invalid");
    }
    const value = JsonValueSchema.safeParse(unknownValue);
    if (!value.success) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Stored configuration is invalid");
    }
    return {
      kind,
      id: shape.data.id,
      gameId: shape.data.game_id,
      value: value.data,
      updatedAt: shape.data.updated_at,
    };
  }
}
