import {
  EngagementLikeEventSchema,
  GiftSentEventSchema,
  LiveEventEnvelopeSchema,
  type EngagementLikeEvent,
  type GiftSentEvent,
  type LiveEvent,
} from "@crowdcircuit/contracts";
import type {
  GiftStreakEvidence,
  RawConnectorEvent,
} from "@crowdcircuit/connector-core";

export interface EventDeduplicatorOptions {
  now?: () => number;
  maxKeys?: number;
  giftTtlMs?: number;
  commentTtlMs?: number;
  socialTtlMs?: number;
}

/**
 * Event-specific bounded TTL deduplicator.
 *
 * Likes deliberately bypass deduplication because each delta contributes to
 * aggregation. Comments use only stable event IDs and therefore identical
 * comments with distinct IDs remain distinct.
 */
export class EventDeduplicator {
  private readonly now: () => number;
  private readonly maxKeys: number;
  private readonly giftTtlMs: number;
  private readonly commentTtlMs: number;
  private readonly socialTtlMs: number;
  private readonly seen = new Map<string, number>();

  constructor(options: EventDeduplicatorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxKeys = Math.max(1, Math.floor(options.maxKeys ?? 50_000));
    this.giftTtlMs = Math.max(1, options.giftTtlMs ?? 300_000);
    this.commentTtlMs = Math.max(1, options.commentTtlMs ?? 300);
    this.socialTtlMs = Math.max(1, options.socialTtlMs ?? 5_000);
  }

  public accept(event: LiveEvent): boolean {
    if (event.eventType === "engagement.like") return true;

    const now = this.now();
    this.prune(now);
    const key = `${event.eventType}:${event.eventId}`;
    const previousExpiry = this.seen.get(key);
    if (previousExpiry !== undefined && previousExpiry > now) {
      return false;
    }

    this.seen.delete(key);
    this.seen.set(key, now + this.ttlFor(event));
    while (this.seen.size > this.maxKeys) {
      const oldest = this.seen.keys().next();
      if (oldest.done) break;
      this.seen.delete(oldest.value);
    }
    return true;
  }

  public clear(): void {
    this.seen.clear();
  }

  public get size(): number {
    this.prune(this.now());
    return this.seen.size;
  }

  private ttlFor(event: LiveEvent): number {
    if (event.eventType === "gift.sent") return this.giftTtlMs;
    if (event.eventType === "chat.comment") return this.commentTtlMs;
    return this.socialTtlMs;
  }

  private prune(now: number): void {
    for (const [key, expiry] of this.seen) {
      if (expiry <= now) this.seen.delete(key);
    }
  }
}

export interface RawEventDeduplicatorOptions {
  now?: () => number;
  maxKeys?: number;
  giftTtlMs?: number;
  commentTtlMs?: number;
  socialTtlMs?: number;
}

/**
 * Deduplicates accepted raw events using connector identity first and a
 * conservative event-specific fingerprint only when sufficient facts exist.
 */
export class RawEventDeduplicator {
  private readonly now: () => number;
  private readonly maxKeys: number;
  private readonly giftTtlMs: number;
  private readonly commentTtlMs: number;
  private readonly socialTtlMs: number;
  private readonly seen = new Map<string, number>();

  constructor(options: RawEventDeduplicatorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxKeys = Math.max(1, Math.floor(options.maxKeys ?? 50_000));
    this.giftTtlMs = Math.max(1, options.giftTtlMs ?? 300_000);
    this.commentTtlMs = Math.max(1, options.commentTtlMs ?? 300);
    this.socialTtlMs = Math.max(1, options.socialTtlMs ?? 5_000);
  }

  public accept(raw: RawConnectorEvent, event: LiveEvent): boolean {
    if (event.eventType === "engagement.like") return true;
    const key = this.keyFor(raw, event);
    if (key === null) return true;

    const now = this.now();
    this.prune(now);
    const previousExpiry = this.seen.get(key);
    if (previousExpiry !== undefined && previousExpiry > now) return false;

    this.seen.delete(key);
    this.seen.set(key, now + this.ttlFor(event));
    while (this.seen.size > this.maxKeys) {
      const oldest = this.seen.keys().next();
      if (oldest.done) break;
      this.seen.delete(oldest.value);
    }
    return true;
  }

  public clear(): void {
    this.seen.clear();
  }

  public get size(): number {
    this.prune(this.now());
    return this.seen.size;
  }

  private keyFor(raw: RawConnectorEvent, event: LiveEvent): string | null {
    const connectorEventId = raw.identity?.connectorEventId;
    if (connectorEventId) {
      return `${raw.source}:${event.eventType}:event:${connectorEventId}`;
    }
    const sequenceId = raw.identity?.sequenceId;
    if (sequenceId) {
      return `${raw.source}:${event.eventType}:sequence:${sequenceId}`;
    }

    const room = event.room.roomId ?? event.room.streamerUniqueId;
    const user = event.user?.id ?? event.user?.uniqueId;
    if (event.eventType === "chat.comment") {
      if (!room || !user || !raw.occurredAt) return null;
      return [
        raw.source,
        event.eventType,
        room,
        user,
        event.payload.textNormalized,
        raw.occurredAt,
      ].join(":");
    }
    if (event.eventType === "gift.sent") {
      const evidence = isGiftStreakEvidence(raw.giftStreak)
        ? raw.giftStreak
        : undefined;
      if (!room || !raw.occurredAt || evidence === undefined) return null;
      return [
        raw.source,
        event.eventType,
        room,
        evidence.streakId,
        evidence.lifecycle,
        evidence.sequenceId ?? "",
        event.payload.gift.id,
        event.payload.totalQuantity,
        raw.occurredAt,
      ].join(":");
    }
    if (event.eventType === "social.follow") {
      if (!room || !user || !raw.occurredAt) return null;
      return [raw.source, event.eventType, room, user, raw.occurredAt].join(":");
    }
    return null;
  }

  private ttlFor(event: LiveEvent): number {
    if (event.eventType === "gift.sent") return this.giftTtlMs;
    if (event.eventType === "chat.comment") return this.commentTtlMs;
    return this.socialTtlMs;
  }

  private prune(now: number): void {
    for (const [key, expiry] of this.seen) {
      if (expiry <= now) this.seen.delete(key);
    }
  }
}

export type GiftFlushReason =
  | "connector_end"
  | "inactivity_timeout"
  | "max_lifetime"
  | "disconnect_flush"
  | "shutdown_flush"
  | "capacity";

export interface GiftStreakEmission {
  event: GiftSentEvent;
  reason: "single" | "start" | "update" | GiftFlushReason;
}

export interface GiftStreakAggregatorOptions {
  now?: () => number;
  inactivityMs?: number;
  maxLifetimeMs?: number;
  maxOpenStreaks?: number;
}

interface GiftStreakState {
  key: string;
  streakId: string;
  openedAt: number;
  updatedAt: number;
  latest: GiftSentEvent;
}

/**
 * Bounded deterministic gift-streak state.
 *
 * The normalizer intentionally does not interpret provider streak state.
 * This aggregator creates an internal streak only for normalized gifts whose
 * approved contract says `streakable: true`. Finalization is explicit through
 * tick or flush and emits exactly once.
 */
export class GiftStreakAggregator {
  private readonly now: () => number;
  private readonly inactivityMs: number;
  private readonly maxLifetimeMs: number;
  private readonly maxOpenStreaks: number;
  private readonly states = new Map<string, GiftStreakState>();

  constructor(options: GiftStreakAggregatorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.inactivityMs = Math.max(1, options.inactivityMs ?? 3_000);
    this.maxLifetimeMs = Math.max(
      this.inactivityMs,
      options.maxLifetimeMs ?? 30_000
    );
    this.maxOpenStreaks = Math.max(
      1,
      Math.floor(options.maxOpenStreaks ?? 5_000)
    );
  }

  public process(
    event: GiftSentEvent,
    evidence?: GiftStreakEvidence
  ): GiftStreakEmission[] {
    if (!event.payload.gift.streakable || evidence === undefined) {
      return [{ event, reason: "single" }];
    }

    const now = this.now();
    const expired = this.tick(now);
    const key = this.keyFor(event, evidence);
    const existing = this.states.get(key);
    if (evidence.lifecycle === "end") {
      if (!existing) return [...expired, { event, reason: "single" }];
      this.states.delete(key);
      existing.latest = event;
      return [...expired, this.finalize(existing, "connector_end")];
    }
    if (evidence.lifecycle === "update") {
      if (!existing) return [...expired, { event, reason: "single" }];
      existing.updatedAt = now;
      existing.latest = event;
      this.states.delete(key);
      this.states.set(key, existing);
      return [
        ...expired,
        {
          event: this.withStreak(event, existing.streakId, "update"),
          reason: "update",
        },
      ];
    }

    if (existing) {
      existing.updatedAt = now;
      existing.latest = event;
      return [
        ...expired,
        {
          event: this.withStreak(event, evidence.streakId, "update"),
          reason: "update",
        },
      ];
    }

    const capacityEmissions: GiftStreakEmission[] = [];
    if (this.states.size >= this.maxOpenStreaks) {
      const oldest = this.states.values().next();
      if (!oldest.done) {
        this.states.delete(oldest.value.key);
        capacityEmissions.push(this.finalize(oldest.value, "capacity"));
      }
    }

    const state: GiftStreakState = {
      key,
      streakId: evidence.streakId,
      openedAt: now,
      updatedAt: now,
      latest: event,
    };
    this.states.set(key, state);
    return [
      ...expired,
      ...capacityEmissions,
      {
        event: this.withStreak(event, state.streakId, "start"),
        reason: "start",
      },
    ];
  }

  public tick(at = this.now()): GiftStreakEmission[] {
    const emissions: GiftStreakEmission[] = [];
    for (const [key, state] of this.states) {
      const lifetimeExpired = at - state.openedAt >= this.maxLifetimeMs;
      const inactive = at - state.updatedAt >= this.inactivityMs;
      if (!lifetimeExpired && !inactive) continue;
      this.states.delete(key);
      emissions.push(
        this.finalize(
          state,
          lifetimeExpired ? "max_lifetime" : "inactivity_timeout"
        )
      );
    }
    return emissions;
  }

  public flush(
    reason: "disconnect_flush" | "shutdown_flush"
  ): GiftStreakEmission[] {
    const emissions = Array.from(this.states.values(), (state) =>
      this.finalize(state, reason)
    );
    this.states.clear();
    return emissions;
  }

  public get size(): number {
    return this.states.size;
  }

  private keyFor(
    event: GiftSentEvent,
    evidence: GiftStreakEvidence
  ): string {
    return [
      event.source,
      event.room.roomId ?? event.room.streamerUniqueId,
      evidence.streakId,
    ].join(":");
  }

  private withStreak(
    event: GiftSentEvent,
    streakId: string,
    status: "start" | "update" | "end"
  ): GiftSentEvent {
    return GiftSentEventSchema.parse({
      ...event,
      payload: {
        ...event.payload,
        streak: { id: streakId, status },
        estimatedDiamondTotal:
          event.payload.gift.diamondValue === null
            ? null
            : event.payload.gift.diamondValue * event.payload.totalQuantity,
      },
    });
  }

  private finalize(
    state: GiftStreakState,
    reason: GiftFlushReason
  ): GiftStreakEmission {
    return {
      event: this.withStreak(state.latest, state.streakId, "end"),
      reason,
    };
  }
}

export type LikeFlushReason =
  | "interval"
  | "milestone"
  | "disconnect_flush"
  | "shutdown_flush"
  | "capacity";

export interface LikeAggregationEmission {
  event: EngagementLikeEvent;
  reason: LikeFlushReason;
}

export interface LikeAggregatorOptions {
  now?: () => number;
  emitIntervalMs?: number;
  milestones?: readonly number[];
  maxRooms?: number;
}

interface LikeState {
  key: string;
  accumulatedDelta: number;
  latest: EngagementLikeEvent;
  previousTotal: number;
  lastEmitAt: number;
}

export class LikeAggregator {
  private readonly now: () => number;
  private readonly emitIntervalMs: number;
  private readonly milestones: readonly number[];
  private readonly maxRooms: number;
  private readonly states = new Map<string, LikeState>();

  constructor(options: LikeAggregatorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.emitIntervalMs = Math.max(1, options.emitIntervalMs ?? 1_000);
    this.milestones = [...(options.milestones ?? [1_000, 2_000, 5_000])]
      .filter(
        (value) =>
          Number.isFinite(value) && Number.isInteger(value) && value >= 0
      )
      .sort((left, right) => left - right);
    this.maxRooms = Math.max(1, Math.floor(options.maxRooms ?? 5_000));
  }

  public process(event: EngagementLikeEvent): LikeAggregationEmission[] {
    const now = this.now();
    const intervalEmissions = this.tick(now);
    const key = event.room.roomId ?? event.room.streamerUniqueId;
    let state = this.states.get(key);

    if (!state) {
      const capacityEmissions: LikeAggregationEmission[] = [];
      if (this.states.size >= this.maxRooms) {
        const oldest = this.states.values().next();
        if (!oldest.done) {
          this.states.delete(oldest.value.key);
          capacityEmissions.push(this.emit(oldest.value, "capacity", null, now));
        }
      }
      const total = event.payload.total ?? event.payload.delta;
      state = {
        key,
        accumulatedDelta: event.payload.delta,
        latest: event,
        previousTotal: Math.max(0, total - event.payload.delta),
        lastEmitAt: now,
      };
      this.states.set(key, state);
      const milestone = this.crossedMilestone(state.previousTotal, total);
      if (milestone !== null) {
        return [
          ...intervalEmissions,
          ...capacityEmissions,
          this.emit(state, "milestone", milestone, now),
        ];
      }
      return [...intervalEmissions, ...capacityEmissions];
    }

    const priorTotal =
      state.latest.payload.total ??
      state.previousTotal + state.accumulatedDelta;
    state.accumulatedDelta += event.payload.delta;
    state.latest = event;
    this.states.delete(key);
    this.states.set(key, state);
    const currentTotal = event.payload.total ?? priorTotal + event.payload.delta;
    const milestone = this.crossedMilestone(priorTotal, currentTotal);
    if (milestone !== null) {
      return [
        ...intervalEmissions,
        this.emit(state, "milestone", milestone, now),
      ];
    }
    return intervalEmissions;
  }

  public tick(at = this.now()): LikeAggregationEmission[] {
    const emissions: LikeAggregationEmission[] = [];
    for (const state of this.states.values()) {
      if (
        state.accumulatedDelta > 0 &&
        at - state.lastEmitAt >= this.emitIntervalMs
      ) {
        emissions.push(this.emit(state, "interval", null, at));
      }
    }
    return emissions;
  }

  public flush(
    reason: "disconnect_flush" | "shutdown_flush"
  ): LikeAggregationEmission[] {
    const emissions: LikeAggregationEmission[] = [];
    const now = this.now();
    for (const state of this.states.values()) {
      if (state.accumulatedDelta > 0) {
        emissions.push(this.emit(state, reason, null, now));
      }
    }
    this.states.clear();
    return emissions;
  }

  public get size(): number {
    return this.states.size;
  }

  private emit(
    state: LikeState,
    reason: LikeFlushReason,
    milestone: number | null = null,
    emittedAt = this.now()
  ): LikeAggregationEmission {
    const delta = state.accumulatedDelta;
    const total =
      state.latest.payload.total ??
      state.previousTotal + state.accumulatedDelta;
    state.accumulatedDelta = 0;
    state.previousTotal = total;
    state.lastEmitAt = emittedAt;
    return {
      event: EngagementLikeEventSchema.parse({
        ...state.latest,
        payload: { delta, total, milestone },
      }),
      reason,
    };
  }

  private crossedMilestone(previous: number, current: number): number | null {
    let crossed: number | null = null;
    for (const milestone of this.milestones) {
      if (previous < milestone && current >= milestone) crossed = milestone;
    }
    return crossed;
  }
}

export interface EventIntegrityPipelineOptions {
  deduplicator?: EventDeduplicatorOptions;
  giftStreaks?: GiftStreakAggregatorOptions;
  likes?: LikeAggregatorOptions;
}

export interface EventProcessingContext {
  giftStreak?: GiftStreakEvidence;
}

export function isGiftStreakEvidence(
  value: unknown
): value is GiftStreakEvidence {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const streakId = Reflect.get(value, "streakId");
  const lifecycle = Reflect.get(value, "lifecycle");
  const sequenceId = Reflect.get(value, "sequenceId");
  return (
    typeof streakId === "string" &&
    streakId.length > 0 &&
    (lifecycle === "start" ||
      lifecycle === "update" ||
      lifecycle === "end") &&
    (sequenceId === undefined ||
      (typeof sequenceId === "string" && sequenceId.length > 0))
  );
}

export interface PipelineEmission {
  event: LiveEvent;
  reason:
    | "passthrough"
    | "gift_start"
    | "gift_single"
    | "gift_update"
    | GiftFlushReason
    | LikeFlushReason;
}

function toPipelineGiftEmission(
  emission: GiftStreakEmission
): PipelineEmission {
  let reason: PipelineEmission["reason"];
  if (emission.reason === "start") {
    reason = "gift_start";
  } else if (emission.reason === "single") {
    reason = "gift_single";
  } else if (emission.reason === "update") {
    reason = "gift_update";
  } else {
    reason = emission.reason;
  }
  return { event: emission.event, reason };
}

/**
 * Headless event-integrity stage used after EventNormalizer.
 */
export class EventIntegrityPipeline {
  public readonly deduplicator: EventDeduplicator;
  public readonly giftStreaks: GiftStreakAggregator;
  public readonly likes: LikeAggregator;

  constructor(options: EventIntegrityPipelineOptions = {}) {
    this.deduplicator = new EventDeduplicator(options.deduplicator);
    this.giftStreaks = new GiftStreakAggregator(options.giftStreaks);
    this.likes = new LikeAggregator(options.likes);
  }

  public process(
    event: LiveEvent,
    context: EventProcessingContext = {}
  ): PipelineEmission[] {
    const parsed = LiveEventEnvelopeSchema.parse(event);
    if (!this.deduplicator.accept(parsed)) return [];

    if (parsed.eventType === "gift.sent") {
      return this.giftStreaks
        .process(parsed, context.giftStreak)
        .map(toPipelineGiftEmission);
    }
    if (parsed.eventType === "engagement.like") {
      return this.likes.process(parsed);
    }
    return [{ event: parsed, reason: "passthrough" }];
  }

  public tick(): PipelineEmission[] {
    return [
      ...this.giftStreaks.tick().map(toPipelineGiftEmission),
      ...this.likes.tick(),
    ];
  }

  public flush(
    reason: "disconnect_flush" | "shutdown_flush"
  ): PipelineEmission[] {
    const emissions: PipelineEmission[] = [
      ...this.giftStreaks.flush(reason).map(toPipelineGiftEmission),
      ...this.likes.flush(reason),
    ];
    this.deduplicator.clear();
    return emissions;
  }
}
