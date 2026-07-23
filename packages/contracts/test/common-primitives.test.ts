import { describe, expect, it } from "vitest";
import {
  EventMetadataSchema,
  EventSourceSchema,
  IsoDateTimeSchema,
  RoomRefSchema,
  SPEC_VERSION,
  SpecVersionSchema,
  UserRefSchema,
} from "../src/index.js";

describe("@crowdcircuit/contracts common primitives", () => {
  describe("SpecVersion", () => {
    it("exports SPEC_VERSION as '0.1'", () => {
      expect(SPEC_VERSION).toBe("0.1");
    });

    it("parses valid specVersion '0.1'", () => {
      expect(SpecVersionSchema.parse("0.1")).toBe("0.1");
    });

    it("rejects invalid specVersion values", () => {
      expect(() => SpecVersionSchema.parse("0.2")).toThrow();
      expect(() => SpecVersionSchema.parse("1.0")).toThrow();
      expect(() => SpecVersionSchema.parse("")).toThrow();
    });
  });

  describe("EventSource", () => {
    it("parses valid sources: tiktok, tikfinity, mock", () => {
      expect(EventSourceSchema.parse("tiktok")).toBe("tiktok");
      expect(EventSourceSchema.parse("tikfinity")).toBe("tikfinity");
      expect(EventSourceSchema.parse("mock")).toBe("mock");
    });

    it("rejects invalid sources", () => {
      expect(() => EventSourceSchema.parse("youtube")).toThrow();
      expect(() => EventSourceSchema.parse("twitch")).toThrow();
      expect(() => EventSourceSchema.parse("")).toThrow();
    });
  });

  describe("IsoDateTime", () => {
    it("parses valid ISO datetime strings", () => {
      const validIso = "2026-07-20T03:00:00.000Z";
      expect(IsoDateTimeSchema.parse(validIso)).toBe(validIso);
    });

    it("rejects invalid datetime strings or epoch numbers", () => {
      expect(() => IsoDateTimeSchema.parse("2026-99-99")).toThrow();
      expect(() => IsoDateTimeSchema.parse("not-a-date")).toThrow();
      expect(() => IsoDateTimeSchema.parse(1784705000000)).toThrow();
    });
  });

  describe("RoomRef", () => {
    it("parses valid room reference with non-null roomId", () => {
      const room = { roomId: "room_999", streamerUniqueId: "gamer_1" };
      expect(RoomRefSchema.parse(room)).toEqual(room);
    });

    it("parses valid room reference with null roomId", () => {
      const room = { roomId: null, streamerUniqueId: "gamer_1" };
      expect(RoomRefSchema.parse(room)).toEqual(room);
    });

    it("rejects room reference with missing or empty streamerUniqueId", () => {
      expect(() => RoomRefSchema.parse({ roomId: "room_1", streamerUniqueId: "" })).toThrow();
      expect(() => RoomRefSchema.parse({ roomId: "room_1" })).toThrow();
    });
  });

  describe("UserRef", () => {
    it("parses valid user reference with all fields populated", () => {
      const user = {
        id: "usr_101",
        uniqueId: "john_doe",
        displayName: "John Doe",
        avatarUrl: "https://example.com/avatar.jpg",
        roles: ["subscriber", "moderator"],
      };
      expect(UserRefSchema.parse(user)).toEqual(user);
    });

    it("parses user reference with nullable fields set to null", () => {
      const user = {
        id: null,
        uniqueId: null,
        displayName: "Anonymous Viewer",
        avatarUrl: null,
        roles: [],
      };
      expect(UserRefSchema.parse(user)).toEqual(user);
    });

    it("handles nullable user container correctly", () => {
      expect(UserRefSchema.nullable().parse(null)).toBeNull();
    });
  });

  describe("EventMetadata", () => {
    it("parses valid event metadata", () => {
      const metadata = {
        connectorId: "tiktok-live-connector",
        connectorVersion: "1.0.0",
        sequenceId: "seq_12345",
        isReplay: false,
        rawStored: true,
      };
      expect(EventMetadataSchema.parse(metadata)).toEqual(metadata);
    });

    it("parses metadata without optional fields", () => {
      const metadata = {
        connectorId: "mock-connector",
        isReplay: true,
        rawStored: false,
      };
      expect(EventMetadataSchema.parse(metadata)).toEqual(metadata);
    });

    it("rejects metadata missing required boolean or connectorId", () => {
      expect(() =>
        EventMetadataSchema.parse({
          connectorId: "",
          isReplay: false,
          rawStored: true,
        })
      ).toThrow();
    });
  });
});
