import type { GameActionEnvelope } from "@crowdcircuit/contracts";
import type { MappingCandidate, MappingResult } from "@crowdcircuit/mapping-engine";
import type {
  BudgetAdmissionSnapshot,
  DurableActionRecord,
  DurableActionRepository,
} from "../persistence/types.js";
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

  markReceived(actionId: string, at = this.clock.now()): DurableActionRecord {
    const current = this.repository.findById(actionId);
    if (current === null) throw new Error("Action does not exist");
    if (
      current.status === "received" ||
      current.status === "completed" ||
      current.status === "failed"
    ) {
      return current;
    }
    return this.repository.transition({
      actionId,
      expectedVersion: current.version,
      expectedStatuses: ["in_flight"],
      nextStatus: "received",
      at,
    });
  }

  markResult(
    actionId: string,
    status: "completed" | "failed",
    at = this.clock.now(),
  ): DurableActionRecord {
    const current = this.repository.findById(actionId);
    if (current === null) throw new Error("Action does not exist");
    if (current.status === "completed" || current.status === "failed") {
      return current;
    }
    return this.repository.transition({
      actionId,
      expectedVersion: current.version,
      expectedStatuses: ["received"],
      nextStatus: status,
      at,
    });
  }

  async #sendResolved(
    record: DurableActionRecord,
    envelope: GameActionEnvelope,
    destination: DeliveryDestination,
    now: number,
  ): Promise<DurableActionRecord> {
    const authorization = record.status === "pending"
      ? this.repository.authorizePending(
          record.actionId, record.version, this.runtimeId, destination.gameInstanceId,
        )
      : this.repository.authorizeRetry(
          record.actionId, record.version, this.runtimeId, destination.gameInstanceId,
        );
    const attempt = this.repository.recordAttempt(
      authorization,
      { role: "game", clientId: destination.clientId, gameInstanceId: destination.gameInstanceId },
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
