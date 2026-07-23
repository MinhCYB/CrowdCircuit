import { describe, expect, it } from "vitest";
import {
  ChatCommentEventSchema,
  ChatCommentPayloadSchema,
  EngagementLikeEventSchema,
  GiftSentEventSchema,
  GiftSentPayloadSchema,
  LikePayloadSchema,
  LiveConnectedEventSchema,
  LiveDisconnectedEventSchema,
  LiveEndedEventSchema,
  LiveEventEnvelopeSchema,
  LiveEventTypeSchema,
  SocialFollowEventSchema,
  SocialShareEventSchema,
  SubscriptionCreatedEventSchema,
  ViewerJoinedEventSchema,
  type BaseLiveEventEnvelope,
} from "../src/index.js";

describe("FOUND-02C LIVE Event Contracts", () => {
  const baseEnvelopeFields: Omit<BaseLiveEventEnvelope, "eventType" | "payload"> = {
    specVersion: "0.1",
    eventId: "evt_test_1001",
    source: "tiktok",
    room: {
      roomId: "71234567890",
      streamerUniqueId: "streamer_one",
    },
    user: {
      id: "usr_555",
      uniqueId: "viewer_pro",
      displayName: "Viewer Pro",
      avatarUrl: "https://example.com/avatar.png",
      roles: ["subscriber"],
    },
    occurredAt: "2026-07-20T03:00:00.000Z",
    receivedAt: "2026-07-20T03:00:00.010Z",
    metadata: {
      connectorId: "tiktok-live-connector",
      connectorVersion: "0.1.0",
      isReplay: false,
      rawStored: false,
    },
  };

  describe("LiveEventTypeSchema", () => {
    it("validates all 10 supported v0.1 event types", () => {
      const validTypes = [
        "live.connected",
        "live.disconnected",
        "live.ended",
        "viewer.joined",
        "chat.comment",
        "social.follow",
        "social.share",
        "engagement.like",
        "gift.sent",
        "subscription.created",
      ];

      for (const eventType of validTypes) {
        expect(LiveEventTypeSchema.parse(eventType)).toBe(eventType);
      }
    });

    it("rejects unknown event types", () => {
      const invalidTypes = ["live.paused", "custom.event", "", "GIFT.SENT"];
      for (const invalid of invalidTypes) {
        expect(() => LiveEventTypeSchema.parse(invalid)).toThrow();
      }
    });
  });

  describe("Positive Runtime Tests", () => {
    it("parses all 10 event types through specialized schemas and discriminated union", () => {
      const sampleEvents = [
        {
          schema: LiveConnectedEventSchema,
          data: { ...baseEnvelopeFields, eventType: "live.connected" as const, payload: {} },
        },
        {
          schema: LiveDisconnectedEventSchema,
          data: { ...baseEnvelopeFields, eventType: "live.disconnected" as const, payload: {} },
        },
        {
          schema: LiveEndedEventSchema,
          data: { ...baseEnvelopeFields, eventType: "live.ended" as const, payload: {} },
        },
        {
          schema: ViewerJoinedEventSchema,
          data: { ...baseEnvelopeFields, eventType: "viewer.joined" as const, payload: {} },
        },
        {
          schema: ChatCommentEventSchema,
          data: {
            ...baseEnvelopeFields,
            eventType: "chat.comment" as const,
            payload: { text: "Hello stream!", textNormalized: "hello stream!", mentions: [] },
          },
        },
        {
          schema: SocialFollowEventSchema,
          data: { ...baseEnvelopeFields, eventType: "social.follow" as const, payload: {} },
        },
        {
          schema: SocialShareEventSchema,
          data: { ...baseEnvelopeFields, eventType: "social.share" as const, payload: {} },
        },
        {
          schema: EngagementLikeEventSchema,
          data: {
            ...baseEnvelopeFields,
            eventType: "engagement.like" as const,
            payload: { delta: 10, total: 100, milestone: null },
          },
        },
        {
          schema: GiftSentEventSchema,
          data: {
            ...baseEnvelopeFields,
            eventType: "gift.sent" as const,
            payload: {
              gift: {
                id: "rose",
                name: "Rose",
                imageUrl: "https://example.com/rose.png",
                diamondValue: 1,
                streakable: true,
              },
              quantity: 1,
              totalQuantity: 5,
              streak: { id: "str_101", status: "update" as const },
              estimatedDiamondTotal: 5,
            },
          },
        },
        {
          schema: SubscriptionCreatedEventSchema,
          data: { ...baseEnvelopeFields, eventType: "subscription.created" as const, payload: {} },
        },
      ];

      for (const { schema, data } of sampleEvents) {
        // Specialized schema parse
        const parsedSpecialized = schema.parse(data);
        expect(parsedSpecialized.eventType).toBe(data.eventType);

        // Union parse
        const parsedUnion = LiveEventEnvelopeSchema.parse(data);
        expect(parsedUnion.eventType).toBe(data.eventType);
      }
    });

    it("parses single/non-streakable gift with nullable fields set to null", () => {
      const payload = {
        gift: {
          id: "special_gift",
          name: "Special Gift",
          imageUrl: null,
          diamondValue: null,
          streakable: false,
        },
        quantity: 1,
        totalQuantity: 1,
        streak: {
          id: null,
          status: "single" as const,
        },
        estimatedDiamondTotal: null,
      };

      const parsed = GiftSentPayloadSchema.parse(payload);
      expect(parsed.gift.imageUrl).toBeNull();
      expect(parsed.gift.diamondValue).toBeNull();
      expect(parsed.streak.id).toBeNull();
      expect(parsed.estimatedDiamondTotal).toBeNull();
    });

    it("accepts all valid gift streak statuses: single, start, update, end", () => {
      const statuses = ["single", "start", "update", "end"] as const;
      for (const status of statuses) {
        const payload = {
          gift: {
            id: "rose",
            name: "Rose",
            imageUrl: "https://example.com/rose.png",
            diamondValue: 1,
            streakable: true,
          },
          quantity: 2,
          totalQuantity: 10,
          streak: { id: "str_1", status },
          estimatedDiamondTotal: 10,
        };
        const parsed = GiftSentPayloadSchema.parse(payload);
        expect(parsed.streak.status).toBe(status);
      }
    });

    it("parses valid chat comment payload with mentions", () => {
      const payload = {
        text: "@streamer hello!",
        textNormalized: "@streamer hello!",
        mentions: ["streamer"],
      };
      const parsed = ChatCommentPayloadSchema.parse(payload);
      expect(parsed.mentions).toEqual(["streamer"]);
    });

    it("parses valid engagement like payload with total and milestone", () => {
      const payload = {
        delta: 50,
        total: 1000,
        milestone: 1000,
      };
      const parsed = LikePayloadSchema.parse(payload);
      expect(parsed.delta).toBe(50);
      expect(parsed.total).toBe(1000);
      expect(parsed.milestone).toBe(1000);
    });
  });

  describe("Negative Runtime Tests", () => {
    it("rejects event paired with mismatched payload", () => {
      const mismatchedEvent = {
        ...baseEnvelopeFields,
        eventType: "chat.comment",
        payload: {
          gift: {
            id: "rose",
            name: "Rose",
            imageUrl: "https://example.com/rose.png",
            diamondValue: 1,
            streakable: true,
          },
          quantity: 1,
          totalQuantity: 1,
          streak: { id: null, status: "single" },
          estimatedDiamondTotal: 1,
        },
      };

      expect(() => ChatCommentEventSchema.parse(mismatchedEvent)).toThrow();
      expect(() => LiveEventEnvelopeSchema.parse(mismatchedEvent)).toThrow();
    });

    it("rejects extra connector-specific fields in strict payloads", () => {
      const giftWithExtra = {
        gift: {
          id: "rose",
          name: "Rose",
          imageUrl: "https://example.com/rose.png",
          diamondValue: 1,
          streakable: true,
          rawTikTokGiftObject: { id: 999 }, // extra field
        },
        quantity: 1,
        totalQuantity: 1,
        streak: { id: null, status: "single" },
        estimatedDiamondTotal: 1,
      };
      expect(() => GiftSentPayloadSchema.parse(giftWithExtra)).toThrow();

      const commentWithExtra = {
        text: "hi",
        textNormalized: "hi",
        mentions: [],
        rawMessageId: "msg_999", // extra field
      };
      expect(() => ChatCommentPayloadSchema.parse(commentWithExtra)).toThrow();

      const emptyWithExtra = {
        rawServerToken: "secret", // extra field in empty payload
      };
      expect(() => LiveConnectedEventSchema.parse({ ...baseEnvelopeFields, eventType: "live.connected", payload: emptyWithExtra })).toThrow();
    });

    it("rejects gift with empty ID or empty name", () => {
      const invalidGiftId = {
        gift: { id: "", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
        quantity: 1,
        totalQuantity: 1,
        streak: { id: null, status: "single" },
        estimatedDiamondTotal: 1,
      };
      expect(() => GiftSentPayloadSchema.parse(invalidGiftId)).toThrow();

      const invalidGiftName = {
        gift: { id: "rose", name: "", imageUrl: null, diamondValue: 1, streakable: true },
        quantity: 1,
        totalQuantity: 1,
        streak: { id: null, status: "single" },
        estimatedDiamondTotal: 1,
      };
      expect(() => GiftSentPayloadSchema.parse(invalidGiftName)).toThrow();
    });

    it("rejects gift with invalid non-null image URL", () => {
      const invalidUrl = {
        gift: { id: "rose", name: "Rose", imageUrl: "not-a-url", diamondValue: 1, streakable: true },
        quantity: 1,
        totalQuantity: 1,
        streak: { id: null, status: "single" },
        estimatedDiamondTotal: 1,
      };
      expect(() => GiftSentPayloadSchema.parse(invalidUrl)).toThrow();
    });

    it("rejects non-positive, fractional, NaN, or infinite gift quantities", () => {
      const invalidQuantities = [0, -1, 1.5, NaN, Infinity];
      for (const qty of invalidQuantities) {
        const payload = {
          gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
          quantity: qty,
          totalQuantity: 1,
          streak: { id: null, status: "single" },
          estimatedDiamondTotal: 1,
        };
        expect(() => GiftSentPayloadSchema.parse(payload)).toThrow();
      }
    });

    it("rejects invalid streak status", () => {
      const payload = {
        gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
        quantity: 1,
        totalQuantity: 1,
        streak: { id: null, status: "invalid_status" },
        estimatedDiamondTotal: 1,
      };
      expect(() => GiftSentPayloadSchema.parse(payload)).toThrow();
    });

    it("rejects empty comment text or textNormalized", () => {
      expect(() => ChatCommentPayloadSchema.parse({ text: "", textNormalized: "hi", mentions: [] })).toThrow();
      expect(() => ChatCommentPayloadSchema.parse({ text: "hi", textNormalized: "", mentions: [] })).toThrow();
    });

    it("rejects non-positive, fractional, NaN, or negative like numbers", () => {
      expect(() => LikePayloadSchema.parse({ delta: 0, total: null, milestone: null })).toThrow();
      expect(() => LikePayloadSchema.parse({ delta: -5, total: null, milestone: null })).toThrow();
      expect(() => LikePayloadSchema.parse({ delta: 1.5, total: null, milestone: null })).toThrow();
      expect(() => LikePayloadSchema.parse({ delta: 10, total: -1, milestone: null })).toThrow();
      expect(() => LikePayloadSchema.parse({ delta: 10, total: null, milestone: 1.5 })).toThrow();
    });
  });
});
