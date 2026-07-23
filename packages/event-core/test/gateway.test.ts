import { describe, expect, it, vi } from "vitest";
import { MockConnector } from "@crowdcircuit/connector-mock";
import { LiveEventEnvelopeSchema } from "@crowdcircuit/contracts";
import {
  EventIntegrityPipeline,
  EventNormalizer,
  HeadlessEventGateway,
  type PipelineEmission,
} from "../src/index.js";

const timestamp = "2026-07-23T12:00:00.000Z";

describe("HeadlessEventGateway Phase B acceptance", () => {
  it("runs an ordered mock-to-normalized-to-integrity vertical slice", async () => {
    let nowMs = 0;
    let eventSequence = 0;
    const connector = new MockConnector({ clock: () => timestamp });
    const gateway = new HeadlessEventGateway({
      normalizer: new EventNormalizer(),
      normalizerOptions: {
        now: () => timestamp,
        idGenerator: () => `gateway_event_${++eventSequence}`,
      },
      pipeline: new EventIntegrityPipeline({
        deduplicator: { now: () => nowMs },
        giftStreaks: {
          now: () => nowMs,
          inactivityMs: 100,
          maxLifetimeMs: 500,
        },
        likes: {
          now: () => nowMs,
          emitIntervalMs: 100,
          milestones: [10],
        },
      }),
    });
    const emissions: PipelineEmission[] = [];
    const errors: string[] = [];
    gateway.onEvent((emission) => emissions.push(emission));
    gateway.onNormalizationError((error) => errors.push(error.code));

    await gateway.start(connector);
    connector.emitMockComment({ commentText: "Hello" });
    connector.emitMockGift({
      giftId: "rose",
      giftName: "Rose",
      repeatCount: 1,
      totalCount: 1,
      streakable: true,
    });
    connector.emitMockLike({ likeCount: 4, totalLikes: 8 });
    connector.emitMockLike({ likeCount: 3, totalLikes: 11 });
    connector.emitMockEvent({
      kind: "unsupported",
      source: "mock",
      streamerUniqueId: "streamer",
      rawPayload: {},
    });
    await gateway.drain();

    expect(emissions.map((item) => item.reason)).toEqual([
      "passthrough",
      "gift_single",
      "milestone",
    ]);
    expect(errors).toEqual(["UNSUPPORTED_EVENT_KIND"]);
    for (const emission of emissions) {
      expect(LiveEventEnvelopeSchema.safeParse(emission.event).success).toBe(
        true
      );
    }

    nowMs = 100;
    gateway.tick();
    await gateway.drain();
    expect(
      emissions.some(
        (item) =>
          item.event.eventType === "gift.sent" &&
          item.reason === "inactivity_timeout"
      )
    ).toBe(false);

    await gateway.stop();
    expect(gateway.isRunning()).toBe(false);
    expect(gateway.getStats()).toEqual({
      rawReceived: 5,
      normalizationRejected: 1,
      dedupeRejected: 0,
      normalizedAccepted: 4,
      emitted: 3,
    });
  });

  it("preserves ordering and isolates downstream listeners", async () => {
    let sequence = 0;
    const connector = new MockConnector({ clock: () => timestamp });
    const gateway = new HeadlessEventGateway({
      normalizerOptions: {
        now: () => timestamp,
        idGenerator: () => `ordered_${++sequence}`,
      },
    });
    const ordered: string[] = [];
    gateway.onEvent(() => {
      throw new Error("downstream failure");
    });
    gateway.onEvent((emission) => ordered.push(emission.event.eventId));
    await gateway.start(connector);

    connector.emitMockComment({ commentText: "one" });
    connector.emitMockComment({ commentText: "two" });
    connector.emitMockFollow();
    await gateway.drain();

    expect(ordered).toEqual(["ordered_1", "ordered_2", "ordered_3"]);
    await gateway.stop();
  });

  it("flushes open gift and like state on disconnect", async () => {
    let sequence = 0;
    const connector = new MockConnector({ clock: () => timestamp });
    const gateway = new HeadlessEventGateway({
      normalizerOptions: {
        now: () => timestamp,
        idGenerator: () => `flush_${++sequence}`,
      },
    });
    const listener = vi.fn();
    gateway.onEvent(listener);
    await gateway.start(connector);
    connector.emitMockGift({
      streakable: true,
      giftStreak: { streakId: "flush_streak", lifecycle: "start" },
    });
    connector.emitMockLike({ likeCount: 2, totalLikes: 2 });
    await gateway.drain();
    await gateway.stop();

    const reasons = listener.mock.calls.map(
      (call: [PipelineEmission]) => call[0].reason
    );
    expect(reasons).toContain("gift_start");
    expect(reasons.filter((reason) => reason === "disconnect_flush")).toHaveLength(
      2
    );
  });

  it("deduplicates raw gift, comment, and social replay before aggregation", async () => {
    let sequence = 0;
    const connector = new MockConnector({ clock: () => timestamp });
    const gateway = new HeadlessEventGateway({
      normalizerOptions: {
        now: () => timestamp,
        idGenerator: () => `replay_${++sequence}`,
      },
    });
    const emissions: PipelineEmission[] = [];
    gateway.onEvent((emission) => emissions.push(emission));
    await gateway.start(connector);

    const gift = connector.emitMockGift({
      connectorEventId: "gift_event",
      giftStreak: { streakId: "streak_1", lifecycle: "start" },
    });
    connector.emitMockEvent(gift);
    const update = connector.emitMockGift({
      connectorEventId: "gift_update",
      giftStreak: { streakId: "streak_1", lifecycle: "update" },
      totalCount: 2,
    });
    connector.emitMockEvent(update);
    const comment = connector.emitMockComment({
      connectorEventId: "comment_event",
      commentText: "same",
    });
    connector.emitMockEvent(comment);
    const follow = connector.emitMockFollow({
      sequenceId: "follow_sequence",
    });
    connector.emitMockEvent(follow);
    await gateway.drain();

    expect(emissions.map((item) => item.reason)).toEqual([
      "gift_start",
      "gift_update",
      "passthrough",
      "passthrough",
    ]);
    expect(gateway.getStats().dedupeRejected).toBe(4);
    await gateway.stop();
  });

  it("permits the same legitimate comment outside its replay window and resets on disconnect", async () => {
    let now = 0;
    let sequence = 0;
    const connector = new MockConnector({ clock: () => timestamp });
    const gateway = new HeadlessEventGateway({
      normalizerOptions: {
        now: () => timestamp,
        idGenerator: () => `window_${++sequence}`,
      },
      rawDeduplicatorOptions: {
        now: () => now,
        commentTtlMs: 100,
      },
    });
    const emissions: PipelineEmission[] = [];
    gateway.onEvent((emission) => emissions.push(emission));
    await gateway.start(connector);
    const first = connector.emitMockComment({ commentText: "repeatable" });
    connector.emitMockEvent({ ...first });
    await gateway.drain();
    now = 100;
    connector.emitMockEvent({ ...first });
    await gateway.drain();
    expect(emissions).toHaveLength(2);
    expect(gateway.getStats().dedupeRejected).toBe(1);
    await gateway.stop();

    const secondConnector = new MockConnector({ clock: () => timestamp });
    await gateway.start(secondConnector);
    secondConnector.emitMockEvent({ ...first });
    await gateway.drain();
    expect(emissions).toHaveLength(3);
    await gateway.stop();
  });

  it("runs explicit mock streak start/update/end without cross-streak merging", async () => {
    let sequence = 0;
    const connector = new MockConnector({ clock: () => timestamp });
    const gateway = new HeadlessEventGateway({
      normalizerOptions: {
        now: () => timestamp,
        idGenerator: () => `streak_${++sequence}`,
      },
    });
    const emissions: PipelineEmission[] = [];
    gateway.onEvent((emission) => emissions.push(emission));
    await gateway.start(connector);
    connector.emitMockGift({
      giftStreak: { streakId: "provider_a", lifecycle: "start" },
      totalCount: 1,
    });
    connector.emitMockGift({
      giftStreak: { streakId: "provider_b", lifecycle: "start" },
      totalCount: 1,
    });
    connector.emitMockGift({
      giftStreak: { streakId: "provider_a", lifecycle: "update" },
      totalCount: 2,
    });
    connector.emitMockGift({
      giftStreak: { streakId: "provider_a", lifecycle: "end" },
      totalCount: 3,
    });
    await gateway.drain();
    expect(emissions.map((item) => item.reason)).toEqual([
      "gift_start",
      "gift_start",
      "gift_update",
      "connector_end",
    ]);
    expect(
      emissions.map((item) => item.event.payload).filter(
        (payload) => "streak" in payload
      )
    ).toHaveLength(4);
    await gateway.stop();
  });

  it("keeps ordinary similar and userless gifts separate and malformed input does not contaminate identity", async () => {
    let sequence = 0;
    const connector = new MockConnector({ clock: () => timestamp });
    const gateway = new HeadlessEventGateway({
      normalizerOptions: {
        now: () => timestamp,
        idGenerator: () => `safe_${++sequence}`,
      },
    });
    const emissions: PipelineEmission[] = [];
    gateway.onEvent((emission) => emissions.push(emission));
    await gateway.start(connector);

    connector.emitMockGift({ giftId: "rose", totalCount: 1 });
    connector.emitMockGift({ giftId: "rose", totalCount: 1 });
    connector.emitMockEvent({
      kind: "gift",
      source: "mock",
      roomId: "room",
      streamerUniqueId: "streamer",
      rawPayload: {
        giftId: "rose",
        giftName: "Rose",
        diamondValue: 1,
        repeatCount: 1,
        totalCount: 1,
        streakable: true,
        sender: null,
      },
    });
    expect(() =>
      connector.emitMockEvent({
        kind: "chat",
        source: "mock",
        identity: { connectorEventId: "reusable_after_failure" },
        rawPayload: { commentText: "bad", sender: undefined },
      })
    ).toThrow("Unsupported undefined");
    connector.emitMockComment({
      connectorEventId: "reusable_after_failure",
      commentText: "valid",
    });
    await gateway.drain();

    expect(emissions.map((item) => item.reason)).toEqual([
      "gift_single",
      "gift_single",
      "gift_single",
      "passthrough",
    ]);
    expect(gateway.getStats().dedupeRejected).toBe(0);
    await gateway.stop();
  });

  it("finalizes evidence-backed streaks on connector END and clears bounded state", async () => {
    const connector = new MockConnector({ clock: () => timestamp });
    const pipeline = new EventIntegrityPipeline();
    const gateway = new HeadlessEventGateway({ pipeline });
    const reasons: string[] = [];
    gateway.onEvent((emission) => reasons.push(emission.reason));
    await gateway.start(connector);
    connector.emitMockGift({
      giftStreak: { streakId: "ended_stream_streak", lifecycle: "start" },
    });
    await gateway.drain();
    connector.emitMockStreamEnded();
    await gateway.drain();
    expect(reasons).toEqual(["gift_start", "shutdown_flush"]);
    expect(pipeline.giftStreaks.size).toBe(0);
    expect(pipeline.deduplicator.size).toBe(0);
  });
});
