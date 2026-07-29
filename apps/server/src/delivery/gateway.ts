import type {
  GameActionEnvelope,
  GameActionReceivedMessage,
  GameActionResultMessage,
  JsonValue,
} from "@crowdcircuit/contracts";
import type { MappingCandidate, MappingResult } from "@crowdcircuit/mapping-engine";
import type {
  BudgetAdmissionSnapshot,
  DurableActionRecord,
  DurableActionRepository,
} from "../persistence/types.js";
import { PersistenceError } from "../persistence/types.js";
import type {
  InboundGameSession,
  InboundLifecycleResult,
} from "../game/ports.js";
import type { ActionDeliveryPort, DeliveryDestination } from "./port.js";
import { computeActionId } from "./action-id.js";

export const RECEIPT_TIMEOUT_MS = 5_000;
export const RETRY_BACKOFF_MS = [1_000, 2_000] as const;
export const NO_DESTINATION_RECHECK_MS = 1_000;
export const MAX_SEND_ATTEMPTS = 3;

export interface ActionGatewayClock {
  now(): number;
}

export interface CandidateAdmissionContext {
  readonly snapshot: BudgetAdmissionSnapshot;
}

export type CandidateIngestionResult =
  | { readonly status: "action"; readonly record: DurableActionRecord; readonly candidate: MappingCandidate }
  | { readonly status: "deferred" }
  | { readonly status: "ignored" };

function toEnvelope(record: DurableActionRecord, candidate: MappingCandidate): GameActionEnvelope {
  return {
    specVersion: "0.1",
    actionId: record.actionId,
    actionType: record.actionType,
    gameId: record.gameId,
    gameInstanceId: null,
    params: record.params,
    actor: candidate.actor,
    trigger: {
      eventId: candidate.eventId,
      eventType: candidate.eventType,
      mappingId: candidate.ruleId,
    },
    priority: record.priority,
    ttlMs: record.ttlMs,
    createdAt: new Date(record.createdAt).toISOString(),
  };
}

function durableResult(message: GameActionResultMessage): {
  readonly failureCode: string | null;
  readonly resultDetails: JsonValue;
} {
  return message.status === "completed"
    ? {
        failureCode: null,
        resultDetails: {
          durationMs: message.durationMs,
          details: message.details ?? null,
        },
      }
    : {
        failureCode: message.error.code,
        resultDetails: {
          message: message.error.message,
          retryable: message.error.retryable,
        },
      };
}

function canonicalJson(value: JsonValue): string {
  const normalize = (input: JsonValue): JsonValue => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(
        Object.keys(input).sort().map((key) => [key, normalize(input[key] ?? null)]),
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function sameDurableResult(
  record: DurableActionRecord,
  message: GameActionResultMessage,
): boolean {
  if (record.status !== message.status || record.resultDetails === null) return false;
  const expected = durableResult(message);
  return (
    record.failureCode === expected.failureCode &&
    canonicalJson(record.resultDetails) === canonicalJson(expected.resultDetails)
  );
}

export class ActionGateway {
  constructor(
    private readonly repository: DurableActionRepository,
    private readonly delivery: ActionDeliveryPort,
    private readonly clock: ActionGatewayClock,
    private readonly runtimeId: string,
  ) {}

  ingest(
    result: MappingResult,
    admission?: CandidateAdmissionContext,
  ): CandidateIngestionResult {
    if (result.status === "rejected" || result.status === "dropped") {
      return { status: "ignored" };
    }
    const now = this.clock.now();
    if (result.status === "deferred") {
      if (admission === undefined) {
        throw new TypeError("Deferred ingestion requires an immutable admission snapshot");
      }
      this.repository.enqueueDeferredCandidate({
        candidate: result.candidate,
        deferredExpiresAt: result.expiresAt,
        createdAt: now,
        admissionSnapshot: admission.snapshot,
        runtimeId: this.runtimeId,
      });
      return { status: "deferred" };
    }
    const candidate = result.candidate;
    const created = this.repository.createPending({
      actionId: computeActionId(candidate.idempotencySeed),
      idempotencyKey: candidate.idempotencySeed,
      eventId: candidate.eventId,
      mappingId: candidate.ruleId,
      gameId: candidate.gameId,
      actionType: candidate.actionType,
      params: candidate.params,
      priority: candidate.actionPriority,
      ttlMs: candidate.ttlMs,
      createdAt: now,
      expiresAt: now + candidate.ttlMs,
      runtimeId: this.runtimeId,
      nextAttemptAt: now,
    });
    return { status: "action", record: created.record, candidate };
  }

  async deliver(record: DurableActionRecord, candidate: MappingCandidate): Promise<DurableActionRecord> {
    const now = this.clock.now();
    if (now >= record.expiresAt) {
      this.repository.expireDue(now, 1);
      return this.repository.findById(record.actionId) ?? record;
    }
    const envelope = toEnvelope(record, candidate);
    const resolution = await this.delivery.resolveDestination(envelope);
    if (resolution.status === "no_destination") {
      return this.repository.scheduleNextAttempt(
        record.actionId,
        record.version,
        now,
        Math.min(record.expiresAt, now + NO_DESTINATION_RECHECK_MS),
        "no_destination",
      );
    }
    return this.#sendResolved(record, envelope, resolution.destination, now);
  }

  handleReceipt(
    session: InboundGameSession,
    message: GameActionReceivedMessage,
  ): InboundLifecycleResult {
    const current = this.#authorizeInbound(session, message.actionId, message.attemptNumber);
    if ("status" in current) return current;
    const classified = this.#classifyReceipt(current.record);
    if (classified !== null) return classified;
    try {
      return {
        status: "accepted",
        record: this.repository.transition({
          actionId: message.actionId,
          expectedVersion: current.record.version,
          expectedStatuses: ["in_flight"],
          nextStatus: "received",
          at: this.clock.now(),
        }),
      };
    } catch (error) {
      if (!(error instanceof PersistenceError) || error.code !== "STALE_TRANSITION") throw error;
      const reread = this.repository.findById(message.actionId);
      return reread === null
        ? { status: "rejected", code: "ACTION_NOT_FOUND" }
        : this.#classifyReceipt(reread) ??
            { status: "rejected", code: "ACTION_NOT_ACCEPTING_RECEIPT" };
    }
  }

  handleResult(
    session: InboundGameSession,
    message: GameActionResultMessage,
  ): InboundLifecycleResult {
    const current = this.#authorizeInbound(session, message.actionId, message.attemptNumber);
    if ("status" in current) return current;
    const classified = this.#classifyResult(current.record, message);
    if (classified !== null) return classified;
    const durable = durableResult(message);
    try {
      return {
        status: "accepted",
        record: this.repository.transition({
          actionId: message.actionId,
          expectedVersion: current.record.version,
          expectedStatuses: ["received"],
          nextStatus: message.status,
          at: this.clock.now(),
          failureCode: durable.failureCode,
          resultDetails: durable.resultDetails,
        }),
      };
    } catch (error) {
      if (!(error instanceof PersistenceError) || error.code !== "STALE_TRANSITION") throw error;
      const reread = this.repository.findById(message.actionId);
      return reread === null
        ? { status: "rejected", code: "ACTION_NOT_FOUND" }
        : this.#classifyResult(reread, message) ??
            { status: "rejected", code: "ACTION_NOT_ACCEPTING_RESULT" };
    }
  }

  #authorizeInbound(
    session: InboundGameSession,
    actionId: string,
    attemptNumber: number,
  ):
    | { readonly record: DurableActionRecord }
    | Extract<InboundLifecycleResult, { status: "rejected" }> {
    const record = this.repository.findById(actionId);
    if (record === null) return { status: "rejected", code: "ACTION_NOT_FOUND" };
    const binding = this.repository.findAttemptBinding(actionId, attemptNumber);
    if (binding === null) return { status: "rejected", code: "ATTEMPT_NOT_FOUND" };
    if (
      record.gameId !== session.gameId ||
      binding.clientId !== session.clientId ||
      binding.gameInstanceId !== session.gameInstanceId
    ) {
      return { status: "rejected", code: "ACTION_BINDING_MISMATCH" };
    }
    return { record };
  }

  #classifyReceipt(record: DurableActionRecord): InboundLifecycleResult | null {
    if (record.status === "in_flight") return null;
    if (
      record.status === "received" ||
      record.status === "completed" ||
      record.status === "failed"
    ) return { status: "idempotent", record };
    return {
      status: "rejected",
      code: record.status === "pending"
        ? "ATTEMPT_NOT_FOUND"
        : "ACTION_NOT_ACCEPTING_RECEIPT",
    };
  }

  #classifyResult(
    record: DurableActionRecord,
    message: GameActionResultMessage,
  ): InboundLifecycleResult | null {
    if (record.status === "received") return null;
    if (record.status === "completed" || record.status === "failed") {
      return sameDurableResult(record, message)
        ? { status: "idempotent", record }
        : { status: "rejected", code: "RESULT_CONFLICT" };
    }
    return {
      status: "rejected",
      code: record.status === "pending"
        ? "ATTEMPT_NOT_FOUND"
        : "ACTION_NOT_ACCEPTING_RESULT",
    };
  }

  async #sendResolved(
    record: DurableActionRecord,
    envelope: GameActionEnvelope,
    destination: DeliveryDestination,
    now: number,
  ): Promise<DurableActionRecord> {
    const binding = {
      clientId: destination.clientId,
      gameInstanceId: destination.gameInstanceId,
    };
    const authorization = record.status === "pending"
      ? this.repository.authorizePending(
          record.actionId, record.version, this.runtimeId, binding,
        )
      : this.repository.authorizeRetry(
          record.actionId, record.version, this.runtimeId, binding,
        );
    const attempt = this.repository.recordAttempt(
      authorization,
      { role: "game", ...binding },
      now,
      "send_started",
    );
    const committed = this.repository.findById(record.actionId);
    if (committed === null) throw new Error("Committed action disappeared");
    const outcome = await this.delivery.send({
      envelope: { ...envelope, gameInstanceId: destination.gameInstanceId },
      attemptNumber: attempt.attemptNumber,
      destination,
    });
    const afterSend = this.repository.findById(record.actionId);
    if (afterSend === null) throw new Error("Durable action disappeared");
    if (outcome.status === "sent") {
      return this.repository.scheduleNextAttempt(
        afterSend.actionId,
        afterSend.version,
        now,
        Math.min(afterSend.expiresAt, now + RECEIPT_TIMEOUT_MS),
        "receipt_timeout",
      );
    }
    return this.#scheduleFailure(afterSend, now, "transport_error");
  }

  #scheduleFailure(record: DurableActionRecord, now: number, failureCode: string): DurableActionRecord {
    if (record.retryCount >= MAX_SEND_ATTEMPTS) {
      return this.repository.transition({
        actionId: record.actionId,
        expectedVersion: record.version,
        expectedStatuses: ["in_flight"],
        nextStatus: "delivery_failed",
        at: now,
        failureCode: "delivery_attempts_exhausted",
      });
    }
    const delay = RETRY_BACKOFF_MS[Math.max(0, record.retryCount - 1)] ?? RETRY_BACKOFF_MS[1];
    return this.repository.scheduleNextAttempt(
      record.actionId,
      record.version,
      now,
      Math.min(record.expiresAt, now + delay),
      failureCode,
    );
  }
}

export class ActionLifecycleWorker {
  constructor(
    private readonly repository: DurableActionRepository,
    private readonly clock: ActionGatewayClock,
    private readonly sweepLimit = 128,
  ) {}

  tick(): number {
    return this.repository.expireDue(this.clock.now(), this.sweepLimit);
  }
}
