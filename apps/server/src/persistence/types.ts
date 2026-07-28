import type { JsonValue } from "@crowdcircuit/contracts";
import type { DurableBudgetRepository } from "@crowdcircuit/mapping-engine";
import type { BudgetAdmissionResult, MappingCandidate } from "@crowdcircuit/mapping-engine";
import type { SendAuthorization } from "./authorization.js";
export type { SendAuthorization } from "./authorization.js";

export const ACTION_STATUSES = [
  "pending",
  "in_flight",
  "received",
  "completed",
  "failed",
  "expired",
  "delivery_failed",
  "delivery_unknown_restart",
  "aborted_restart",
] as const;

export type DurableActionStatus = (typeof ACTION_STATUSES)[number];
export type NonterminalActionStatus = "pending" | "in_flight" | "received";
export type TerminalActionStatus = Exclude<DurableActionStatus, NonterminalActionStatus>;

export interface BudgetUserWindowSnapshot {
  readonly limitPerMinute: number;
}

export interface BudgetRuleWindowSnapshot {
  readonly limitPerMinute: number;
}

export interface BudgetGlobalTokenSnapshot {
  readonly maxPerSecond: number;
  readonly burst: number;
}

export interface BudgetCapacitySnapshot {
  readonly maxUserBuckets: number;
  readonly inactiveRetentionMs: number;
  readonly sweepLimit: number;
}

export interface BudgetAdmissionSnapshot {
  readonly gameProfileId: string;
  readonly ruleId: string;
  readonly userBudgetKey: string;
  readonly userLimit: BudgetUserWindowSnapshot;
  readonly cooldownMs: number;
  readonly ruleLimit: BudgetRuleWindowSnapshot;
  readonly globalToken: BudgetGlobalTokenSnapshot;
  readonly capacityConfig: BudgetCapacitySnapshot;
}

export interface CreateDurableAction {
  readonly actionId: string;
  readonly idempotencyKey: string;
  readonly eventId: string | null;
  readonly mappingId: string | null;
  readonly gameId: string;
  readonly gameInstanceId?: string | null;
  readonly actionType: string;
  readonly params: JsonValue;
  readonly priority: number;
  readonly ttlMs: number;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly runtimeId: string;
  readonly nextAttemptAt?: number | null;
}

export interface DurableActionRecord extends CreateDurableAction {
  readonly nextAttemptAt: number | null;
  readonly status: DurableActionStatus;
  readonly retryCount: number;
  readonly version: number;
  readonly updatedAt: number;
  readonly receivedAt: number | null;
  readonly completedAt: number | null;
  readonly failureCode: string | null;
  readonly resultDetails: JsonValue | null;
  readonly reconciliationReason: string | null;
}

export type DurableCreateResult =
  | {
      readonly created: true;
      readonly record: DurableActionRecord;
      readonly sendAuthorization: SendAuthorization;
    }
  | {
      readonly created: false;
      readonly record: DurableActionRecord;
      readonly sendAuthorization: null;
      readonly reason: "already_authorized" | "already_consumed";
    };

export type PendingCreateResult =
  | { readonly created: true; readonly record: DurableActionRecord }
  | {
      readonly created: false;
      readonly record: DurableActionRecord;
      readonly reason: "already_exists";
    };

export interface ActionAttempt {
  readonly actionId: string;
  readonly attemptNumber: number;
  readonly runtimeId: string;
  readonly attemptedAt: number;
  readonly outcome: "send_started" | "send_failed";
  readonly failureCode: string | null;
  readonly gameInstanceId: string | null;
}

export interface ActionTransition {
  readonly actionId: string;
  readonly expectedVersion: number;
  readonly expectedStatuses: readonly DurableActionStatus[];
  readonly nextStatus: DurableActionStatus;
  readonly at: number;
  readonly failureCode?: string | null;
  readonly resultDetails?: JsonValue | null;
}

export interface ReconciliationResult {
  readonly actionId: string;
  readonly previousStatus: NonterminalActionStatus;
  readonly status: "pending" | "received" | "delivery_unknown_restart" | "expired";
}

export type DeferredCandidateStatus = "queued" | "promoted" | "expired";

export interface DeferredCandidateRecord {
  readonly candidate: MappingCandidate;
  readonly deferredExpiresAt: number;
  readonly createdAt: number;
  readonly admissionSnapshot: BudgetAdmissionSnapshot;
  readonly status: DeferredCandidateStatus;
  readonly owningRuntimeId: string;
  readonly promotedActionId: string | null;
  readonly promotedAt: number | null;
}

export interface EnqueueDeferredCandidate {
  readonly candidate: MappingCandidate;
  readonly deferredExpiresAt: number;
  readonly createdAt: number;
  readonly admissionSnapshot: BudgetAdmissionSnapshot;
  readonly runtimeId: string;
}

export type DeferredPromotionResult =
  | { readonly status: "promoted"; readonly record: DurableActionRecord }
  | { readonly status: "already_promoted"; readonly record: DurableActionRecord }
  | { readonly status: "expired" }
  | { readonly status: "not_found" }
  | { readonly status: "not_admitted"; readonly reason: Exclude<BudgetAdmissionResult, { admitted: true }>["reason"] };

export interface RetentionPolicy {
  readonly terminalBefore: number;
  readonly maximumTerminalRecords: number;
}

export interface DeliveryAttemptBinding {
  readonly clientId: string;
  readonly gameInstanceId: string;
}

export interface DurableActionRepository {
  createPending(input: CreateDurableAction): PendingCreateResult;
  authorizePending(
    actionId: string,
    expectedVersion: number,
    runtimeId: string,
    binding: DeliveryAttemptBinding,
  ): SendAuthorization;
  createBeforeFirstSend(input: CreateDurableAction): DurableCreateResult;
  authorizeRetry(
    actionId: string,
    expectedVersion: number,
    runtimeId: string,
    binding: DeliveryAttemptBinding,
  ): SendAuthorization;
  revokeSendAuthorization(actionId: string, attemptNumber: number, at: number): boolean;
  findById(actionId: string): DurableActionRecord | null;
  findByIdempotencyKey(idempotencyKey: string): DurableActionRecord | null;
  transition(input: ActionTransition): DurableActionRecord;
  recordAttempt(
    authorization: SendAuthorization,
    binding: {
      readonly role: "game";
      readonly clientId: string;
      readonly gameInstanceId: string;
    },
    attemptedAt: number,
    outcome: ActionAttempt["outcome"],
    failureCode?: string | null,
  ): ActionAttempt;
  listAttempts(actionId: string): readonly ActionAttempt[];
  listNonterminal(): readonly DurableActionRecord[];
  enqueueDeferredCandidate(input: EnqueueDeferredCandidate): DeferredCandidateRecord;
  findDeferredCandidate(idempotencySeed: string): DeferredCandidateRecord | null;
  promoteDeferredCandidate(idempotencySeed: string, now: number): DeferredPromotionResult;
  expireDue(now: number, sweepLimit: number): number;
  listDeliverable(now: number, limit: number): readonly DurableActionRecord[];
  scheduleNextAttempt(
    actionId: string,
    expectedVersion: number,
    at: number,
    nextAttemptAt: number,
    failureCode: string,
  ): DurableActionRecord;
  reconcilePreviousRuntime(runtimeId: string, now: number): readonly ReconciliationResult[];
  cleanup(policy: RetentionPolicy): number;
  close(): void;
}

export type ConfigurationKind =
  | "app_setting"
  | "connector_profile"
  | "game_manifest"
  | "game_profile"
  | "event_mapping";

export interface ConfigurationDocument {
  readonly kind: ConfigurationKind;
  readonly id: string;
  readonly gameId: string | null;
  readonly value: JsonValue;
  readonly updatedAt: number;
}

export interface ConfigurationRepository {
  putConfiguration(document: ConfigurationDocument): void;
  getConfiguration(kind: ConfigurationKind, id: string): ConfigurationDocument | null;
}

export interface EventDiagnostic {
  readonly eventId: string;
  readonly eventType: string;
  readonly event: JsonValue;
  readonly createdAt: number;
}

export interface EventDiagnosticRepository {
  appendEvent(event: EventDiagnostic): void;
  getEvent(eventId: string): EventDiagnostic | null;
  cleanupEvents(createdBefore: number, maximumRecords: number): number;
}

export interface ServerPersistence
  extends DurableActionRepository,
    DurableBudgetRepository,
    ConfigurationRepository,
    EventDiagnosticRepository {}

export class PersistenceError extends Error {
  readonly code:
    | "DATABASE_UNAVAILABLE"
    | "INVALID_INPUT"
    | "DUPLICATE_ACTION"
    | "IDEMPOTENCY_CONFLICT"
    | "ACTION_NOT_FOUND"
    | "STALE_TRANSITION"
    | "ILLEGAL_TRANSITION"
    | "INVALID_AUTHORIZATION"
    | "RUNTIME_SUPERSEDED"
    | "ALREADY_AUTHORIZED"
    | "DEFERRED_CAPACITY_EXHAUSTED"
    | "INVALID_MIGRATION_MANIFEST"
    | "MIGRATION_FAILED"
    | "SCHEMA_INCOMPATIBLE";

  constructor(code: PersistenceError["code"], message: string) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
  }
}
