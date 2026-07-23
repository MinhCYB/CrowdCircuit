import { describe, it, expect } from "vitest";
import { EventNormalizer } from "../src/index.js";
import { MockConnector } from "@crowdcircuit/connector-mock";
import {
  GiftSentEventSchema,
  ChatCommentEventSchema,
  SocialFollowEventSchema,
  EngagementLikeEventSchema,
  LiveEventEnvelopeSchema,
  type GiftSentEvent,
  type ChatCommentEvent,
  type SocialFollowEvent,
  type EngagementLikeEvent,
} from "@crowdcircuit/contracts";
import type { RawConnectorEvent } from "@crowdcircuit/connector-core";

describe("EventNormalizer Positive Tests", () => {
  const normalizer = new EventNormalizer();
  const fixedNow = "2026-07-23T12:00:00.000Z";
  const options = {
    connectorId: "conn_test_001",
    now: () => fixedNow,
    idGenerator: (() => {
      let seq = 0;
      return () => `evt_norm_seq_${++seq}`;
    })(),
  };

  it("normalizes a valid gift raw event into GiftSentEvent with exact nullable mapping and neutral streak representation", async () => {
    const mockConnector = new MockConnector({ clock: () => fixedNow });
    await mockConnector.connect();
    const rawGift = mockConnector.emitMockGift({
      giftId: "gift_dragon",
      giftName: "Dragon",
      giftImage: "https://example.com/dragon.png",
      diamondValue: 500,
      repeatCount: 2,
      totalCount: 10,
      streakable: true,
      sender: {
        userId: "usr_alice",
        uniqueId: "alice_live",
        nickname: "Alice",
        avatarUrl: "https://example.com/alice.jpg",
        roles: ["subscriber", "moderator"],
      },
    });

    const result = normalizer.normalize(rawGift, options);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const event = result.event as GiftSentEvent;
    expect(event.specVersion).toBe("0.1");
    expect(event.eventType).toBe("gift.sent");
    expect(event.source).toBe("mock");
    expect(event.occurredAt).toBe(fixedNow);
    expect(event.receivedAt).toBe(fixedNow);
    expect(event.metadata).toEqual({
      connectorId: "conn_test_001",
      isReplay: false,
      rawStored: false,
    });
    expect(event.room).toEqual({
      roomId: "room_mock_001",
      streamerUniqueId: "streamer_mock_001",
    });
    expect(event.user).toEqual({
      id: "usr_alice",
      uniqueId: "alice_live",
      displayName: "Alice",
      avatarUrl: "https://example.com/alice.jpg",
      roles: ["subscriber", "moderator"],
    });
    expect(event.payload).toEqual({
      gift: {
        id: "gift_dragon",
        name: "Dragon",
        imageUrl: "https://example.com/dragon.png",
        diamondValue: 500,
        streakable: true,
      },
      quantity: 2,
      totalQuantity: 10,
      streak: {
        id: null,
        status: "single",
      },
      estimatedDiamondTotal: 1000,
    });

    // Verify Zod schema validation
    expect(GiftSentEventSchema.safeParse(event).success).toBe(true);
    expect(LiveEventEnvelopeSchema.safeParse(event).success).toBe(true);
  });

  it("normalizes a gift with fractional diamondValue (1.5) and null imageUrl", () => {
    const rawGift: RawConnectorEvent = {
      kind: "gift",
      source: "mock",
      roomId: "room_001",
      streamerUniqueId: "streamer_001",
      occurredAt: fixedNow,
      rawPayload: {
        giftId: "gift_custom",
        giftName: "Custom Gift",
        giftImage: null,
        diamondValue: 1.5,
        repeatCount: 2,
        totalCount: 2,
        streakable: false,
      },
    };

    const result = normalizer.normalize(rawGift, options);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const event = result.event as GiftSentEvent;
    expect(event.payload.gift.imageUrl).toBeNull();
    expect(event.payload.gift.diamondValue).toBe(1.5);
    expect(event.payload.gift.streakable).toBe(false);
    expect(event.payload.streak).toEqual({ id: null, status: "single" });
    expect(event.payload.estimatedDiamondTotal).toBe(3.0);
  });

  it("normalizes a valid comment raw event into ChatCommentEvent", async () => {
    const mockConnector = new MockConnector({ clock: () => fixedNow });
    await mockConnector.connect();
    const rawComment = mockConnector.emitMockComment({
      commentText: "  GG Play well!  ",
      sender: {
        userId: "usr_bob",
        uniqueId: "bob_gamer",
        nickname: "Bob The Builder",
      },
    });

    const result = normalizer.normalize(rawComment, options);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const event = result.event as ChatCommentEvent;
    expect(event.eventType).toBe("chat.comment");
    expect(event.payload.text).toBe("  GG Play well!  ");
    expect(event.payload.textNormalized).toBe("gg play well!");
    expect(event.payload.mentions).toEqual([]);

    expect(ChatCommentEventSchema.safeParse(event).success).toBe(true);
    expect(LiveEventEnvelopeSchema.safeParse(event).success).toBe(true);
  });

  it("normalizes a valid follow raw event into SocialFollowEvent", async () => {
    const mockConnector = new MockConnector({ clock: () => fixedNow });
    await mockConnector.connect();
    const rawFollow = mockConnector.emitMockFollow({
      sender: {
        userId: "usr_charlie",
        uniqueId: "charlie_new",
        nickname: "Charlie",
      },
    });

    const result = normalizer.normalize(rawFollow, options);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const event = result.event as SocialFollowEvent;
    expect(event.eventType).toBe("social.follow");
    expect(event.payload).toEqual({});

    expect(SocialFollowEventSchema.safeParse(event).success).toBe(true);
    expect(LiveEventEnvelopeSchema.safeParse(event).success).toBe(true);
  });

  it("normalizes a valid like raw event into EngagementLikeEvent with null milestone always", async () => {
    const mockConnector = new MockConnector({ clock: () => fixedNow });
    await mockConnector.connect();
    const rawLike = mockConnector.emitMockLike({
      likeCount: 25,
      totalLikes: 500,
    });

    const result = normalizer.normalize(rawLike, options);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const event = result.event as EngagementLikeEvent;
    expect(event.eventType).toBe("engagement.like");
    expect(event.payload).toEqual({
      delta: 25,
      total: 500,
      milestone: null,
    });

    expect(EngagementLikeEventSchema.safeParse(event).success).toBe(true);
    expect(LiveEventEnvelopeSchema.safeParse(event).success).toBe(true);
  });

  it("never propagates raw milestone values (always milestone: null in Milestone 1)", () => {
    const rawLikeWithMilestone: RawConnectorEvent = {
      kind: "like",
      source: "mock",
      roomId: "room_001",
      streamerUniqueId: "streamer_001",
      occurredAt: fixedNow,
      rawPayload: {
        likeCount: 1,
        totalLikes: 100,
        milestone: 5000, // RAW MILESTONE SUPPLIED
      },
    };

    const result = normalizer.normalize(rawLikeWithMilestone, options);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const event = result.event as EngagementLikeEvent;
    expect(event.payload.milestone).toBeNull(); // PROVES MILESTONE 1 NEVER PROPAGATES RAW MILESTONES
  });

  it("normalizes a like with zero totalLikes (0) as a valid non-negative integer", () => {
    const rawLikeZeroTotal: RawConnectorEvent = {
      kind: "like",
      source: "mock",
      roomId: "room_001",
      streamerUniqueId: "streamer_001",
      occurredAt: fixedNow,
      rawPayload: {
        likeCount: 5,
        totalLikes: 0,
      },
    };

    const result = normalizer.normalize(rawLikeZeroTotal, options);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const event = result.event as EngagementLikeEvent;
    expect(event.payload.delta).toBe(5);
    expect(event.payload.total).toBe(0);
    expect(event.payload.milestone).toBeNull();
  });

  it("handles absent or null user sender strictly without fabricating facts", () => {
    const rawNoSender: RawConnectorEvent = {
      kind: "chat",
      source: "mock",
      roomId: null,
      streamerUniqueId: "streamer_001",
      occurredAt: fixedNow,
      rawPayload: {
        commentText: "System notification",
      },
    };

    const result = normalizer.normalize(rawNoSender, options);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.event.room.roomId).toBeNull();
    expect(result.event.user).toBeNull();
  });

  it("generates unique event IDs across multiple emissions", () => {
    const raw1: RawConnectorEvent = {
      kind: "follow",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: {},
    };
    const raw2: RawConnectorEvent = {
      kind: "follow",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: {},
    };

    const res1 = normalizer.normalize(raw1);
    const res2 = normalizer.normalize(raw2);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    if (res1.success && res2.success) {
      expect(res1.event.eventId).not.toBe(res2.event.eventId);
    }
  });
});

describe("EventNormalizer Negative Tests", () => {
  const normalizer = new EventNormalizer();

  it("rejects missing streamerUniqueId with MISSING_REQUIRED_FIELD", () => {
    const result = normalizer.normalize({
      kind: "chat",
      source: "mock",
      rawPayload: { commentText: "hello" },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("MISSING_REQUIRED_FIELD");
    expect(result.error.message).toContain("streamerUniqueId");
  });

  it("rejects invalid sender property types and invalid roles container/elements without fabricating user facts", () => {
    const invalidNickname = normalizer.normalize({
      kind: "chat",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { commentText: "hi", sender: { nickname: 123 } },
    });
    expect(invalidNickname.success).toBe(false);
    if (!invalidNickname.success) expect(invalidNickname.error.code).toBe("INVALID_DATA_TYPE");

    const invalidAvatar = normalizer.normalize({
      kind: "chat",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { commentText: "hi", sender: { nickname: "Bob", avatarUrl: 99 } },
    });
    expect(invalidAvatar.success).toBe(false);
    if (!invalidAvatar.success) expect(invalidAvatar.error.code).toBe("INVALID_DATA_TYPE");

    const invalidRolesType = normalizer.normalize({
      kind: "chat",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { commentText: "hi", sender: { nickname: "Bob", roles: "NOT_AN_ARRAY" } },
    });
    expect(invalidRolesType.success).toBe(false);
    if (!invalidRolesType.success) expect(invalidRolesType.error.code).toBe("INVALID_DATA_TYPE");

    const invalidRolesElement = normalizer.normalize({
      kind: "chat",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { commentText: "hi", sender: { nickname: "Bob", roles: [1, "viewer"] } },
    });
    expect(invalidRolesElement.success).toBe(false);
    if (!invalidRolesElement.success) expect(invalidRolesElement.error.code).toBe("INVALID_DATA_TYPE");
  });

  it("rejects missing or non-boolean gift streakability", () => {
    const missingStreakable = normalizer.normalize({
      kind: "gift",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { giftId: "rose", giftName: "Rose", repeatCount: 1, totalCount: 1 },
    });
    expect(missingStreakable.success).toBe(false);
    if (!missingStreakable.success) expect(missingStreakable.error.code).toBe("MISSING_REQUIRED_FIELD");

    const nonBoolStreakable = normalizer.normalize({
      kind: "gift",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { giftId: "rose", giftName: "Rose", repeatCount: 1, totalCount: 1, streakable: "true" },
    });
    expect(nonBoolStreakable.success).toBe(false);
    if (!nonBoolStreakable.success) expect(nonBoolStreakable.error.code).toBe("INVALID_DATA_TYPE");
  });

  it("rejects positive and negative Infinity across all gift and like numeric fields", () => {
    const checkInvalid = (kind: string, rawPayload: Record<string, unknown>) => {
      const res = normalizer.normalize({
        kind,
        source: "mock",
        streamerUniqueId: "streamer_001",
        rawPayload,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("INVALID_DATA_TYPE");
      }
    };

    // Gift repeatCount Infinity / -Infinity
    checkInvalid("gift", { giftId: "r", giftName: "R", streakable: true, repeatCount: Infinity, totalCount: 1 });
    checkInvalid("gift", { giftId: "r", giftName: "R", streakable: true, repeatCount: -Infinity, totalCount: 1 });

    // Gift totalCount Infinity / -Infinity
    checkInvalid("gift", { giftId: "r", giftName: "R", streakable: true, repeatCount: 1, totalCount: Infinity });
    checkInvalid("gift", { giftId: "r", giftName: "R", streakable: true, repeatCount: 1, totalCount: -Infinity });

    // Gift diamondValue Infinity / -Infinity
    checkInvalid("gift", { giftId: "r", giftName: "R", streakable: true, repeatCount: 1, totalCount: 1, diamondValue: Infinity });
    checkInvalid("gift", { giftId: "r", giftName: "R", streakable: true, repeatCount: 1, totalCount: 1, diamondValue: -Infinity });

    // Like likeCount Infinity / -Infinity
    checkInvalid("like", { likeCount: Infinity });
    checkInvalid("like", { likeCount: -Infinity });

    // Like totalLikes Infinity / -Infinity
    checkInvalid("like", { likeCount: 5, totalLikes: Infinity });
    checkInvalid("like", { likeCount: 5, totalLikes: -Infinity });
  });

  it("rejects fractional quantities and like deltas", () => {
    const fracQuantity = normalizer.normalize({
      kind: "gift",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { giftId: "rose", giftName: "Rose", streakable: true, repeatCount: 1.5, totalCount: 1 },
    });
    expect(fracQuantity.success).toBe(false);
    if (!fracQuantity.success) expect(fracQuantity.error.code).toBe("INVALID_DATA_TYPE");

    const fracLikeDelta = normalizer.normalize({
      kind: "like",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: { likeCount: 2.5 },
    });
    expect(fracLikeDelta.success).toBe(false);
    if (!fracLikeDelta.success) expect(fracLikeDelta.error.code).toBe("INVALID_DATA_TYPE");
  });
});
