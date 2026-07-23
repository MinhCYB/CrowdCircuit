import { describe, expect, it } from "vitest";
import {
  ChatCommentEventSchema,
  ChatCommentPayloadSchema,
  EngagementLikeEventSchema,
  EmptyPayloadSchema,
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

  const validGiftPayload = {
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
            payload: validGiftPayload,
          },
        },
        {
          schema: SubscriptionCreatedEventSchema,
          data: { ...baseEnvelopeFields, eventType: "subscription.created" as const, payload: {} },
        },
      ];

      for (const { schema, data } of sampleEvents) {
        const parsedSpecialized = schema.parse(data);
        expect(parsedSpecialized.eventType).toBe(data.eventType);

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
          ...validGiftPayload,
          streak: { id: "str_1", status },
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
        payload: validGiftPayload,
      };

      expect(() => ChatCommentEventSchema.parse(mismatchedEvent)).toThrow();
      expect(() => LiveEventEnvelopeSchema.parse(mismatchedEvent)).toThrow();
    });

    describe("Gift totalQuantity validation", () => {
      const invalidTotalQuantities = [
        { val: 0, label: "zero totalQuantity" },
        { val: -1, label: "negative integer totalQuantity" },
        { val: 1.5, label: "positive fractional totalQuantity" },
        { val: NaN, label: "NaN totalQuantity" },
        { val: Infinity, label: "Infinity totalQuantity" },
        { val: -Infinity, label: "-Infinity totalQuantity" },
      ];

      for (const { val, label } of invalidTotalQuantities) {
        it(`rejects ${label}`, () => {
          const payload = { ...validGiftPayload, totalQuantity: val };
          expect(() => GiftSentPayloadSchema.parse(payload)).toThrow();
        });
      }
    });

    describe("Strict unknown-key rejection", () => {
      it("rejects extra top-level property on GiftSentPayload", () => {
        const giftWithExtra = {
          ...validGiftPayload,
          extraTopLevelField: "unauthorized",
        };
        expect(() => GiftSentPayloadSchema.parse(giftWithExtra)).toThrow();
      });

      it("rejects extra property inside gift object", () => {
        const giftWithNestedExtra = {
          ...validGiftPayload,
          gift: {
            ...validGiftPayload.gift,
            rawTikTokGiftObject: { id: 999 },
          },
        };
        expect(() => GiftSentPayloadSchema.parse(giftWithNestedExtra)).toThrow();
      });

      it("rejects extra property inside streak object", () => {
        const giftWithStreakExtra = {
          ...validGiftPayload,
          streak: {
            ...validGiftPayload.streak,
            extraStreakMeta: "invalid",
          },
        };
        expect(() => GiftSentPayloadSchema.parse(giftWithStreakExtra)).toThrow();
      });

      it("rejects extra property on LikePayload", () => {
        const likeWithExtra = {
          delta: 10,
          total: 100,
          milestone: null,
          extraLikeKey: "invalid",
        };
        expect(() => LikePayloadSchema.parse(likeWithExtra)).toThrow();
      });

      it("rejects extra property on EmptyPayload directly", () => {
        expect(() => EmptyPayloadSchema.parse({ inventedField: "bad" })).toThrow();
      });

      it("rejects extra payload property through specialized empty event schema", () => {
        const event = {
          ...baseEnvelopeFields,
          eventType: "live.connected" as const,
          payload: { extraToken: "forbidden" },
        };
        expect(() => LiveConnectedEventSchema.parse(event)).toThrow();
      });

      it("rejects extra payload property through discriminated union for empty event", () => {
        const event = {
          ...baseEnvelopeFields,
          eventType: "social.follow" as const,
          payload: { extraFollowData: 123 },
        };
        expect(() => LiveEventEnvelopeSchema.parse(event)).toThrow();
      });
    });

    describe("Required nullable properties validation (omission & undefined failure)", () => {
      it("rejects omitted or undefined gift.imageUrl", () => {
        const omitted = {
          ...validGiftPayload,
          gift: { id: "rose", name: "Rose", diamondValue: 1, streakable: true },
        };
        expect(() => GiftSentPayloadSchema.parse(omitted)).toThrow();

        const withUndefined = {
          ...validGiftPayload,
          gift: { ...validGiftPayload.gift, imageUrl: undefined },
        };
        expect(() => GiftSentPayloadSchema.parse(withUndefined)).toThrow();
      });

      it("rejects omitted or undefined gift.diamondValue", () => {
        const omitted = {
          ...validGiftPayload,
          gift: { id: "rose", name: "Rose", imageUrl: null, streakable: true },
        };
        expect(() => GiftSentPayloadSchema.parse(omitted)).toThrow();

        const withUndefined = {
          ...validGiftPayload,
          gift: { ...validGiftPayload.gift, diamondValue: undefined },
        };
        expect(() => GiftSentPayloadSchema.parse(withUndefined)).toThrow();
      });

      it("rejects omitted or undefined streak.id", () => {
        const omitted = {
          ...validGiftPayload,
          streak: { status: "single" as const },
        };
        expect(() => GiftSentPayloadSchema.parse(omitted)).toThrow();

        const withUndefined = {
          ...validGiftPayload,
          streak: { id: undefined, status: "single" as const },
        };
        expect(() => GiftSentPayloadSchema.parse(withUndefined)).toThrow();
      });

      it("rejects omitted or undefined estimatedDiamondTotal", () => {
        const { estimatedDiamondTotal: _, ...omitted } = validGiftPayload;
        expect(() => GiftSentPayloadSchema.parse(omitted)).toThrow();

        const withUndefined = { ...validGiftPayload, estimatedDiamondTotal: undefined };
        expect(() => GiftSentPayloadSchema.parse(withUndefined)).toThrow();
      });

      it("rejects omitted or undefined LikePayload.total", () => {
        const omitted = { delta: 10, milestone: null };
        expect(() => LikePayloadSchema.parse(omitted)).toThrow();

        const withUndefined = { delta: 10, total: undefined, milestone: null };
        expect(() => LikePayloadSchema.parse(withUndefined)).toThrow();
      });

      it("rejects omitted or undefined LikePayload.milestone", () => {
        const omitted = { delta: 10, total: 100 };
        expect(() => LikePayloadSchema.parse(omitted)).toThrow();

        const withUndefined = { delta: 10, total: 100, milestone: undefined };
        expect(() => LikePayloadSchema.parse(withUndefined)).toThrow();
      });
    });

    describe("Comment mentions array element validation", () => {
      it("rejects number element in mentions array", () => {
        const payload = { text: "hi", textNormalized: "hi", mentions: [123] };
        expect(() => ChatCommentPayloadSchema.parse(payload)).toThrow();
      });

      it("rejects object element in mentions array", () => {
        const payload = { text: "hi", textNormalized: "hi", mentions: [{ name: "user" }] };
        expect(() => ChatCommentPayloadSchema.parse(payload)).toThrow();
      });

      it("rejects null or boolean elements in mentions array", () => {
        expect(() => ChatCommentPayloadSchema.parse({ text: "hi", textNormalized: "hi", mentions: [null] })).toThrow();
        expect(() => ChatCommentPayloadSchema.parse({ text: "hi", textNormalized: "hi", mentions: [true] })).toThrow();
      });
    });

    describe("Like numeric safety and boundary validation", () => {
      it("rejects zero, negative, and fractional delta", () => {
        expect(() => LikePayloadSchema.parse({ delta: 0, total: null, milestone: null })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: -5, total: null, milestone: null })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: 1.5, total: null, milestone: null })).toThrow();
      });

      it("rejects negative non-null total", () => {
        expect(() => LikePayloadSchema.parse({ delta: 10, total: -1, milestone: null })).toThrow();
      });

      it("rejects fractional non-null milestone", () => {
        expect(() => LikePayloadSchema.parse({ delta: 10, total: null, milestone: 1.5 })).toThrow();
      });

      it("rejects NaN, Infinity, and -Infinity for delta", () => {
        expect(() => LikePayloadSchema.parse({ delta: NaN, total: null, milestone: null })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: Infinity, total: null, milestone: null })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: -Infinity, total: null, milestone: null })).toThrow();
      });

      it("rejects NaN, Infinity, and -Infinity for non-null total", () => {
        expect(() => LikePayloadSchema.parse({ delta: 1, total: NaN, milestone: null })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: 1, total: Infinity, milestone: null })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: 1, total: -Infinity, milestone: null })).toThrow();
      });

      it("rejects NaN, Infinity, and -Infinity for non-null milestone", () => {
        expect(() => LikePayloadSchema.parse({ delta: 1, total: null, milestone: NaN })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: 1, total: null, milestone: Infinity })).toThrow();
        expect(() => LikePayloadSchema.parse({ delta: 1, total: null, milestone: -Infinity })).toThrow();
      });
    });

    it("rejects gift with empty ID or empty name", () => {
      const invalidGiftId = {
        ...validGiftPayload,
        gift: { ...validGiftPayload.gift, id: "" },
      };
      expect(() => GiftSentPayloadSchema.parse(invalidGiftId)).toThrow();

      const invalidGiftName = {
        ...validGiftPayload,
        gift: { ...validGiftPayload.gift, name: "" },
      };
      expect(() => GiftSentPayloadSchema.parse(invalidGiftName)).toThrow();
    });

    it("rejects gift with invalid non-null image URL", () => {
      const invalidUrl = {
        ...validGiftPayload,
        gift: { ...validGiftPayload.gift, imageUrl: "not-a-url" },
      };
      expect(() => GiftSentPayloadSchema.parse(invalidUrl)).toThrow();
    });

    it("rejects non-positive, fractional, NaN, or infinite gift quantities", () => {
      const invalidQuantities = [0, -1, 1.5, NaN, Infinity];
      for (const qty of invalidQuantities) {
        const payload = { ...validGiftPayload, quantity: qty };
        expect(() => GiftSentPayloadSchema.parse(payload)).toThrow();
      }
    });

    it("rejects invalid streak status", () => {
      const payload = {
        ...validGiftPayload,
        streak: { id: null, status: "invalid_status" },
      };
      expect(() => GiftSentPayloadSchema.parse(payload)).toThrow();
    });

    it("rejects empty comment text or textNormalized", () => {
      expect(() => ChatCommentPayloadSchema.parse({ text: "", textNormalized: "hi", mentions: [] })).toThrow();
      expect(() => ChatCommentPayloadSchema.parse({ text: "hi", textNormalized: "", mentions: [] })).toThrow();
    });
  });
});
