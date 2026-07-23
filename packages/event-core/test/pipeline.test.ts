import { describe, expect, it } from "vitest";
import {
  ChatCommentEventSchema,
  EngagementLikeEventSchema,
  GiftSentEventSchema,
  type ChatCommentEvent,
  type EngagementLikeEvent,
  type GiftSentEvent,
} from "@crowdcircuit/contracts";
import {
  EventDeduplicator,
  EventIntegrityPipeline,
  GiftStreakAggregator,
  LikeAggregator,
  RawEventDeduplicator,
} from "../src/index.js";
import type {
  GiftStreakEvidence,
  RawConnectorEvent,
} from "@crowdcircuit/connector-core";

const timestamp = "2026-07-23T12:00:00.000Z";

function base(eventId: string) {
  return {
    specVersion: "0.1" as const,
    eventId,
    source: "mock" as const,
    room: { roomId: "room_1", streamerUniqueId: "streamer_1" },
    user: {
      id: "user_1",
      uniqueId: "viewer_1",
      displayName: "Viewer",
      avatarUrl: null,
      roles: ["viewer"],
    },
    occurredAt: timestamp,
    receivedAt: timestamp,
    metadata: {
      connectorId: "mock_1",
      isReplay: false,
      rawStored: false,
    },
  };
}

function gift(
  eventId: string,
  totalQuantity: number,
  streakable = true
): GiftSentEvent {
  return GiftSentEventSchema.parse({
    ...base(eventId),
    eventType: "gift.sent",
    payload: {
      gift: {
        id: "rose",
        name: "Rose",
        imageUrl: null,
        diamondValue: 1,
        streakable,
      },
      quantity: 1,
      totalQuantity,
      streak: { id: null, status: "single" },
      estimatedDiamondTotal: 1,
    },
  });
}

function like(
  eventId: string,
  delta: number,
  total: number | null
): EngagementLikeEvent {
  return EngagementLikeEventSchema.parse({
    ...base(eventId),
    eventType: "engagement.like",
    payload: { delta, total, milestone: null },
  });
}

function comment(eventId: string, text = "same"): ChatCommentEvent {
  return ChatCommentEventSchema.parse({
    ...base(eventId),
    eventType: "chat.comment",
    payload: { text, textNormalized: text, mentions: [] },
  });
}

function streak(
  streakId: string,
  lifecycle: GiftStreakEvidence["lifecycle"],
  sequenceId?: string
): GiftStreakEvidence {
  return {
    streakId,
    lifecycle,
    ...(sequenceId === undefined ? {} : { sequenceId }),
  };
}

describe("EventDeduplicator", () => {
  it("deduplicates stable IDs within event-specific TTL and permits expiry", () => {
    let now = 0;
    const deduper = new EventDeduplicator({
      now: () => now,
      commentTtlMs: 100,
    });
    const event = comment("comment_1");

    expect(deduper.accept(event)).toBe(true);
    expect(deduper.accept(event)).toBe(false);
    now = 100;
    expect(deduper.accept(event)).toBe(true);
  });

  it("preserves identical comments with distinct IDs and never deduplicates like deltas", () => {
    const deduper = new EventDeduplicator();
    expect(deduper.accept(comment("comment_1"))).toBe(true);
    expect(deduper.accept(comment("comment_2"))).toBe(true);
    const likeEvent = like("like_1", 1, 1);
    expect(deduper.accept(likeEvent)).toBe(true);
    expect(deduper.accept(likeEvent)).toBe(true);
  });

  it("bounds retained keys and evicts the oldest entry", () => {
    const deduper = new EventDeduplicator({ maxKeys: 2 });
    expect(deduper.accept(comment("one"))).toBe(true);
    expect(deduper.accept(comment("two"))).toBe(true);
    expect(deduper.accept(comment("three"))).toBe(true);
    expect(deduper.size).toBe(2);
    expect(deduper.accept(comment("one"))).toBe(true);
  });
});

describe("RawEventDeduplicator", () => {
  function raw(
    kind: string,
    identity?: RawConnectorEvent["identity"]
  ): RawConnectorEvent {
    return {
      kind,
      source: "mock",
      roomId: "room_1",
      streamerUniqueId: "streamer_1",
      occurredAt: timestamp,
      ...(identity === undefined ? {} : { identity }),
      rawPayload: {},
    };
  }

  it("prioritizes connector IDs and sequences across newly allocated raw objects", () => {
    const deduper = new RawEventDeduplicator();
    expect(
      deduper.accept(raw("chat", { connectorEventId: "evt_1" }), comment("a"))
    ).toBe(true);
    expect(
      deduper.accept(raw("chat", { connectorEventId: "evt_1" }), comment("b"))
    ).toBe(false);
    expect(
      deduper.accept(raw("chat", { sequenceId: "seq_1" }), comment("c"))
    ).toBe(true);
    expect(
      deduper.accept(raw("chat", { sequenceId: "seq_1" }), comment("d"))
    ).toBe(false);
  });

  it("uses a short conservative comment fingerprint and accepts insufficient identity", () => {
    let now = 0;
    const deduper = new RawEventDeduplicator({
      now: () => now,
      commentTtlMs: 100,
    });
    const safe = raw("chat");
    expect(deduper.accept(safe, comment("a"))).toBe(true);
    expect(deduper.accept({ ...safe }, comment("b"))).toBe(false);
    now = 100;
    expect(deduper.accept({ ...safe }, comment("c"))).toBe(true);

    const insufficient = { ...safe, roomId: null, streamerUniqueId: "" };
    const noUser = ChatCommentEventSchema.parse({
      ...comment("d"),
      room: { roomId: null, streamerUniqueId: "streamer_1" },
      user: null,
    });
    expect(deduper.accept(insufficient, noUser)).toBe(true);
    expect(deduper.accept(insufficient, noUser)).toBe(true);
  });

  it("bounds capacity, expires TTL, never suppresses likes, and clears deterministically", () => {
    const deduper = new RawEventDeduplicator({ maxKeys: 1 });
    expect(deduper.accept(raw("chat", { connectorEventId: "one" }), comment("a"))).toBe(true);
    expect(deduper.accept(raw("chat", { connectorEventId: "two" }), comment("b"))).toBe(true);
    expect(deduper.size).toBe(1);
    expect(deduper.accept(raw("chat", { connectorEventId: "one" }), comment("c"))).toBe(true);
    const likeEvent = like("like", 1, 1);
    expect(deduper.accept(raw("like", { connectorEventId: "like" }), likeEvent)).toBe(true);
    expect(deduper.accept(raw("like", { connectorEventId: "like" }), likeEvent)).toBe(true);
    deduper.clear();
    expect(deduper.size).toBe(0);
  });
});

describe("GiftStreakAggregator", () => {
  it("emits deterministic start/update and finalizes once on inactivity", () => {
    let now = 0;
    const aggregator = new GiftStreakAggregator({
      now: () => now,
      inactivityMs: 100,
      maxLifetimeMs: 500,
    });

    const start = aggregator.process(gift("gift_1", 1), streak("streak_1", "start"));
    expect(start).toHaveLength(1);
    expect(start[0].reason).toBe("start");
    expect(start[0].event.payload.streak.status).toBe("start");
    const streakId = start[0].event.payload.streak.id;

    now = 50;
    const update = aggregator.process(gift("gift_2", 2), streak("streak_1", "update"));
    expect(update[0].event.payload.streak).toEqual({
      id: streakId,
      status: "update",
    });

    now = 149;
    expect(aggregator.tick()).toEqual([]);
    now = 150;
    const ended = aggregator.tick();
    expect(ended).toHaveLength(1);
    expect(ended[0].reason).toBe("inactivity_timeout");
    expect(ended[0].event.payload.streak.status).toBe("end");
    expect(aggregator.tick()).toEqual([]);
  });

  it("finalizes at maximum lifetime even with recent updates", () => {
    let now = 0;
    const aggregator = new GiftStreakAggregator({
      now: () => now,
      inactivityMs: 100,
      maxLifetimeMs: 200,
    });
    aggregator.process(gift("gift_1", 1), streak("streak_1", "start"));
    now = 90;
    aggregator.process(gift("gift_2", 2), streak("streak_1", "update"));
    now = 180;
    aggregator.process(gift("gift_3", 3), streak("streak_1", "update"));
    now = 200;
    const emissions = aggregator.tick();
    expect(emissions).toHaveLength(1);
    expect(emissions[0].reason).toBe("max_lifetime");
  });

  it("flushes open streaks on disconnect and bounds open state", () => {
    let now = 0;
    const aggregator = new GiftStreakAggregator({
      now: () => now,
      maxOpenStreaks: 1,
    });
    aggregator.process(gift("gift_1", 1), streak("streak_1", "start"));
    const otherRoom = GiftSentEventSchema.parse({
      ...gift("gift_2", 1),
      room: { roomId: "room_2", streamerUniqueId: "streamer_2" },
    });
    now = 1;
    const capacity = aggregator.process(otherRoom, streak("streak_2", "start"));
    expect(capacity.some((item) => item.reason === "capacity")).toBe(true);
    expect(aggregator.size).toBe(1);

    const flushed = aggregator.flush("disconnect_flush");
    expect(flushed).toHaveLength(1);
    expect(flushed[0].reason).toBe("disconnect_flush");
    expect(flushed[0].event.payload.streak.status).toBe("end");
    expect(aggregator.size).toBe(0);
  });

  it("passes non-streakable gifts without opening state", () => {
    const aggregator = new GiftStreakAggregator();
    const result = aggregator.process(gift("gift_single", 1, false));
    expect(result[0].reason).toBe("single");
    expect(result[0].event.payload.streak.status).toBe("single");
    expect(aggregator.size).toBe(0);
  });

  it("does not synthesize streaks without evidence and handles unknown update/end conservatively", () => {
    const aggregator = new GiftStreakAggregator();
    expect(aggregator.process(gift("single", 1))[0].reason).toBe("single");
    expect(aggregator.process(gift("unknown_update", 2), streak("missing", "update"))[0].reason).toBe("single");
    expect(aggregator.process(gift("unknown_end", 2), streak("missing", "end"))[0].reason).toBe("single");
    expect(aggregator.size).toBe(0);
  });

  it("keeps provider streak identities separate and finalizes exact connector END", () => {
    const aggregator = new GiftStreakAggregator();
    aggregator.process(gift("one", 1), streak("provider_1", "start"));
    aggregator.process(gift("two", 1), streak("provider_2", "start"));
    expect(aggregator.size).toBe(2);
    const ended = aggregator.process(
      gift("end", 2),
      streak("provider_1", "end")
    );
    expect(ended.at(-1)?.reason).toBe("connector_end");
    expect(ended.at(-1)?.event.payload.streak).toEqual({
      id: "provider_1",
      status: "end",
    });
    expect(aggregator.size).toBe(1);
  });
});

describe("LikeAggregator", () => {
  it("aggregates deltas and emits once per interval", () => {
    let now = 0;
    const aggregator = new LikeAggregator({
      now: () => now,
      emitIntervalMs: 100,
      milestones: [],
    });
    expect(aggregator.process(like("like_1", 2, 2))).toEqual([]);
    now = 50;
    expect(aggregator.process(like("like_2", 3, 5))).toEqual([]);
    now = 100;
    const emissions = aggregator.tick();
    expect(emissions).toHaveLength(1);
    expect(emissions[0].reason).toBe("interval");
    expect(emissions[0].event.payload).toEqual({
      delta: 5,
      total: 5,
      milestone: null,
    });
    expect(aggregator.tick()).toEqual([]);
  });

  it("emits configured milestones exactly when crossed", () => {
    let now = 0;
    const aggregator = new LikeAggregator({
      now: () => now,
      emitIntervalMs: 1_000,
      milestones: [10, 20],
    });
    expect(aggregator.process(like("like_1", 4, 8))).toEqual([]);
    now = 1;
    const milestone = aggregator.process(like("like_2", 3, 11));
    expect(milestone).toHaveLength(1);
    expect(milestone[0].reason).toBe("milestone");
    expect(milestone[0].event.payload.milestone).toBe(10);
    expect(milestone[0].event.payload.delta).toBe(7);
  });

  it("flushes accumulated likes and bounds room state", () => {
    let now = 0;
    const aggregator = new LikeAggregator({
      now: () => now,
      maxRooms: 1,
      milestones: [],
    });
    aggregator.process(like("like_1", 1, 1));
    const otherRoom = EngagementLikeEventSchema.parse({
      ...like("like_2", 2, 2),
      room: { roomId: "room_2", streamerUniqueId: "streamer_2" },
    });
    now = 1;
    const capacity = aggregator.process(otherRoom);
    expect(capacity).toHaveLength(1);
    expect(capacity[0].reason).toBe("capacity");
    const flushed = aggregator.flush("disconnect_flush");
    expect(flushed).toHaveLength(1);
    expect(flushed[0].reason).toBe("disconnect_flush");
    expect(aggregator.size).toBe(0);
  });
});

describe("EventIntegrityPipeline integration", () => {
  it("deduplicates passthrough events and flushes gift/like state on disconnect", () => {
    let now = 0;
    const pipeline = new EventIntegrityPipeline({
      deduplicator: { now: () => now },
      giftStreaks: { now: () => now },
      likes: { now: () => now, milestones: [] },
    });

    const chat = comment("chat_1");
    expect(pipeline.process(chat)).toEqual([
      { event: chat, reason: "passthrough" },
    ]);
    expect(pipeline.process(chat)).toEqual([]);

    expect(
      pipeline.process(gift("gift_1", 1), {
        giftStreak: streak("streak_1", "start"),
      })[0].reason
    ).toBe("gift_start");
    expect(pipeline.process(like("like_1", 4, 4))).toEqual([]);

    now = 10;
    const flushed = pipeline.flush("disconnect_flush");
    expect(flushed.map((item) => item.reason).sort()).toEqual([
      "disconnect_flush",
      "disconnect_flush",
    ]);
    expect(pipeline.giftStreaks.size).toBe(0);
    expect(pipeline.likes.size).toBe(0);
    expect(pipeline.deduplicator.size).toBe(0);
  });
});
