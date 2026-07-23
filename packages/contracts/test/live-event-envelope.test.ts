import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BaseLiveEventEnvelopeSchema,
  createLiveEventEnvelopeSchema,
  JsonValueSchema,
  type BaseLiveEventEnvelope,
  type LiveEventEnvelope,
} from "../src/index.js";

describe("LiveEventEnvelope base", () => {
  const validEnvelopeData: LiveEventEnvelope = {
    specVersion: "0.1",
    eventId: "evt_123456789",
    eventType: "gift.sent",
    source: "tiktok",
    room: {
      roomId: "71234567890",
      streamerUniqueId: "streamer_pro",
    },
    user: {
      id: "usr_999",
      uniqueId: "supporter_1",
      displayName: "Supporter One",
      avatarUrl: "https://example.com/pic.png",
      roles: ["gifting_level_10"],
    },
    payload: {
      sampleData: "hello",
    },
    occurredAt: "2026-07-20T03:00:00.000Z",
    receivedAt: "2026-07-20T03:00:00.050Z",
    metadata: {
      connectorId: "tiktok-live-connector",
      connectorVersion: "0.1.0",
      isReplay: false,
      rawStored: false,
    },
  };

  it("parses a valid base LiveEventEnvelope", () => {
    const parsed: BaseLiveEventEnvelope = BaseLiveEventEnvelopeSchema.parse(validEnvelopeData);
    expect(parsed).toEqual(validEnvelopeData);
    expect(parsed.specVersion).toBe("0.1");
    expect(parsed.source).toBe("tiktok");
  });

  it("parses valid envelope with null user", () => {
    const dataWithNullUser = {
      ...validEnvelopeData,
      user: null,
    };
    const parsed = BaseLiveEventEnvelopeSchema.parse(dataWithNullUser);
    expect(parsed.user).toBeNull();
  });

  it("rejects envelope with invalid specVersion", () => {
    const invalid = { ...validEnvelopeData, specVersion: "0.2" };
    expect(() => BaseLiveEventEnvelopeSchema.parse(invalid)).toThrow();
  });

  it("rejects envelope with invalid source", () => {
    const invalid = { ...validEnvelopeData, source: "youtube" };
    expect(() => BaseLiveEventEnvelopeSchema.parse(invalid)).toThrow();
  });

  it("rejects envelope with invalid timestamp", () => {
    const invalid = { ...validEnvelopeData, occurredAt: "invalid-date" };
    expect(() => BaseLiveEventEnvelopeSchema.parse(invalid)).toThrow();
  });

  it("rejects envelope missing required fields", () => {
    const { eventId: _, ...missingEventId } = validEnvelopeData;
    expect(() => BaseLiveEventEnvelopeSchema.parse(missingEventId)).toThrow();
  });

  describe("Required payload validation", () => {
    it("rejects envelope missing payload property", () => {
      const { payload: _, ...missingPayload } = validEnvelopeData;
      expect(() => BaseLiveEventEnvelopeSchema.parse(missingPayload)).toThrow();
    });

    it("rejects envelope with payload: undefined", () => {
      const invalidData = {
        ...validEnvelopeData,
        payload: undefined,
      };
      expect(() => BaseLiveEventEnvelopeSchema.parse(invalidData)).toThrow();
    });

    it("accepts valid JSON scalar payloads (null, false, 0, empty string)", () => {
      const scalars = [null, false, 0, ""];
      for (const scalar of scalars) {
        const data = { ...validEnvelopeData, payload: scalar };
        const parsed = BaseLiveEventEnvelopeSchema.parse(data);
        expect(parsed.payload).toBe(scalar);
      }
    });
  });

  describe("JSON-safe payload validation", () => {
    it("accepts nested plain objects and arrays", () => {
      const validPayloads = [
        { nested: { number: 123, array: ["a", true, null] } },
        ["item1", 42, { flag: false }],
      ];
      for (const payload of validPayloads) {
        expect(() => JsonValueSchema.parse(payload)).not.toThrow();
        const data = { ...validEnvelopeData, payload };
        expect(() => BaseLiveEventEnvelopeSchema.parse(data)).not.toThrow();
      }
    });

    it("rejects non-JSON JavaScript values", () => {
      class CustomClass {}

      const invalidPayloads = [
        () => {}, // function
        BigInt(100), // bigint
        Symbol("id"), // symbol
        NaN, // NaN
        Infinity, // Infinity
        -Infinity, // -Infinity
        new Date(), // Date object
        new Map(), // Map object
        new Set(), // Set object
        new CustomClass(), // Class instance
      ];

      for (const payload of invalidPayloads) {
        expect(() => JsonValueSchema.parse(payload)).toThrow();
        const data = { ...validEnvelopeData, payload };
        expect(() => BaseLiveEventEnvelopeSchema.parse(data)).toThrow();
      }
    });
  });

  describe("createLiveEventEnvelopeSchema factory", () => {
    const CustomPayloadSchema = z.object({
      giftName: z.string(),
      count: z.number().int().positive(),
    });

    const CustomEnvelopeSchema = createLiveEventEnvelopeSchema(
      CustomPayloadSchema,
      z.literal("gift.sent")
    );

    it("parses envelope with valid custom payload and eventType", () => {
      const validCustomData = {
        ...validEnvelopeData,
        eventType: "gift.sent",
        payload: {
          giftName: "Rose",
          count: 5,
        },
      };

      const parsed = CustomEnvelopeSchema.parse(validCustomData);
      expect(parsed.payload.giftName).toBe("Rose");
      expect(parsed.payload.count).toBe(5);
    });

    it("rejects envelope when custom payload fails validation", () => {
      const invalidCustomData = {
        ...validEnvelopeData,
        eventType: "gift.sent",
        payload: {
          giftName: "Rose",
          count: -1, // invalid: not positive
        },
      };

      expect(() => CustomEnvelopeSchema.parse(invalidCustomData)).toThrow();
    });

    it("rejects envelope when eventType does not match literal schema", () => {
      const wrongEventTypeData = {
        ...validEnvelopeData,
        eventType: "chat.comment",
        payload: {
          giftName: "Rose",
          count: 5,
        },
      };

      expect(() => CustomEnvelopeSchema.parse(wrongEventTypeData)).toThrow();
    });
  });
});
