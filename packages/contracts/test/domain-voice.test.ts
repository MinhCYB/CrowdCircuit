import { describe, it, expect } from "vitest";
import {
  VoiceIntentSchema,
  VoiceIntentKindSchema,
  VoiceInterruptPolicySchema,
  VoicePlayMessageSchema,
  VoicePlaybackStartedMessageSchema,
  VoicePlaybackFinishedMessageSchema,
  VoicePlaybackInterruptedMessageSchema,
  VoicePlaybackFailedMessageSchema,
  VoicePlaybackCallbackMessageSchema,
  VoicePlaybackErrorSchema,
} from "../src/index.js";

describe("FOUND-02E VoiceIntent and Voice Protocol Schemas", () => {
  const validIntent = {
    specVersion: "0.1",
    intentId: "intent_101",
    eventId: "evt_gift_1",
    kind: "thank_gift",
    priority: 80,
    templateGroup: "gift.default",
    variables: { name: "PlayerOne", count: 5, multiplier: 1.5 },
    voiceProfileId: "profile_vi_vn",
    dedupeKey: "dedupe_123",
    expiresAt: "2026-07-23T05:00:00.000Z",
  };

  describe("VoiceIntentSchema & Kind", () => {
    it("parses valid complete VoiceIntent", () => {
      const parsed = VoiceIntentSchema.parse(validIntent);
      expect(parsed).toEqual(validIntent);
    });

    it("parses all four valid VoiceIntent kinds", () => {
      const kinds = ["thank_gift", "welcome_follow", "game_commentary", "system"] as const;
      for (const kind of kinds) {
        expect(VoiceIntentKindSchema.parse(kind)).toBe(kind);
        expect(
          VoiceIntentSchema.parse({ ...validIntent, kind }).kind
        ).toBe(kind);
      }
    });

    it("rejects unsupported VoiceIntent kind", () => {
      expect(() => VoiceIntentKindSchema.parse("invalid_kind")).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({ ...validIntent, kind: "invalid_kind" as unknown })
      ).toThrow();
    });

    it("accepts zero, positive, and negative integer priorities", () => {
      expect(VoiceIntentSchema.parse({ ...validIntent, priority: 0 }).priority).toBe(0);
      expect(VoiceIntentSchema.parse({ ...validIntent, priority: 100 }).priority).toBe(100);
      expect(VoiceIntentSchema.parse({ ...validIntent, priority: -50 }).priority).toBe(-50);
    });

    it("rejects fractional, NaN, positive infinity, or negative infinity priorities", () => {
      expect(() => VoiceIntentSchema.parse({ ...validIntent, priority: 1.5 })).toThrow();
      expect(() => VoiceIntentSchema.parse({ ...validIntent, priority: Number.NaN })).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({ ...validIntent, priority: Number.POSITIVE_INFINITY })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({ ...validIntent, priority: Number.NEGATIVE_INFINITY })
      ).toThrow();
    });

    it("accepts null for required nullable eventId and dedupeKey", () => {
      const nullsIntent = {
        ...validIntent,
        eventId: null,
        dedupeKey: null,
      };
      const parsed = VoiceIntentSchema.parse(nullsIntent);
      expect(parsed.eventId).toBeNull();
      expect(parsed.dedupeKey).toBeNull();
    });

    it("enforces required nullable eventId and dedupeKey: omission and undefined fail, null succeeds", () => {
      // eventId
      const omittedEventId = { ...validIntent };
      delete (omittedEventId as Record<string, unknown>).eventId;
      expect(() => VoiceIntentSchema.parse(omittedEventId)).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({ ...validIntent, eventId: undefined })
      ).toThrow();
      expect(
        VoiceIntentSchema.parse({ ...validIntent, eventId: null }).eventId
      ).toBeNull();

      // dedupeKey
      const omittedDedupeKey = { ...validIntent };
      delete (omittedDedupeKey as Record<string, unknown>).dedupeKey;
      expect(() => VoiceIntentSchema.parse(omittedDedupeKey)).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({ ...validIntent, dedupeKey: undefined })
      ).toThrow();
      expect(
        VoiceIntentSchema.parse({ ...validIntent, dedupeKey: null }).dedupeKey
      ).toBeNull();
    });

    it("rejects empty required string identifiers", () => {
      expect(() => VoiceIntentSchema.parse({ ...validIntent, intentId: "" })).toThrow();
      expect(() => VoiceIntentSchema.parse({ ...validIntent, eventId: "" })).toThrow();
      expect(() => VoiceIntentSchema.parse({ ...validIntent, templateGroup: "" })).toThrow();
      expect(() => VoiceIntentSchema.parse({ ...validIntent, voiceProfileId: "" })).toThrow();
      expect(() => VoiceIntentSchema.parse({ ...validIntent, dedupeKey: "" })).toThrow();
    });

    it("accepts empty records, null-prototype records, strings, finite integers, finite fractionals, and mixed scalar records for variables", () => {
      expect(
        VoiceIntentSchema.parse({ ...validIntent, variables: {} }).variables
      ).toEqual({});

      const nullProto = Object.create(null);
      nullProto.name = "PlayerOne";
      nullProto.count = 5;
      expect(
        VoiceIntentSchema.parse({ ...validIntent, variables: nullProto }).variables
      ).toBeDefined();

      expect(
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { a: "str", b: 42, c: 3.14 },
        }).variables
      ).toEqual({ a: "str", b: 42, c: 3.14 });
    });

    it("rejects non-plain containers directly as the variables value (class instances, Date, Map, Set, Array, null, functions)", () => {
      class EmptyClass {}
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: new EmptyClass() as unknown as Record<string, string | number>,
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: new Date() as unknown as Record<string, string | number>,
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: new Map() as unknown as Record<string, string | number>,
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: new Set() as unknown as Record<string, string | number>,
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: [1, 2] as unknown as Record<string, string | number>,
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: null as unknown as Record<string, string | number>,
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: (() => 123) as unknown as Record<string, string | number>,
        })
      ).toThrow();
    });

    it("rejects non-scalar, non-finite, or invalid variable values (nested, array, boolean, null, undefined, function, symbol, BigInt, NaN, infinities, Date, Map, Set, Class)", () => {
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: { nested: true } as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: [1, 2] as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: true as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: null as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: undefined as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: (() => 1) as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: Symbol("test") as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: BigInt(10) as unknown as number },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: Number.NaN },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: Number.POSITIVE_INFINITY },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: Number.NEGATIVE_INFINITY },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: new Date() as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: new Map() as unknown as string },
        })
      ).toThrow();
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: new Set() as unknown as string },
        })
      ).toThrow();

      class CustomClass {}
      expect(() =>
        VoiceIntentSchema.parse({
          ...validIntent,
          variables: { bad: new CustomClass() as unknown as string },
        })
      ).toThrow();
    });

    it("rejects invalid expiresAt ISO datetime string", () => {
      expect(() =>
        VoiceIntentSchema.parse({ ...validIntent, expiresAt: "invalid-iso-date" })
      ).toThrow();
    });

    it("rejects extra keys on VoiceIntent (strict)", () => {
      expect(() =>
        VoiceIntentSchema.parse({ ...validIntent, extraKey: "not-allowed" })
      ).toThrow();
    });
  });

  describe("VoiceInterruptPolicySchema", () => {
    it("parses all three valid interrupt policy values", () => {
      const policies = [
        "never_interrupt",
        "interrupt_lower_priority",
        "interrupt_any",
      ] as const;
      for (const policy of policies) {
        expect(VoiceInterruptPolicySchema.parse(policy)).toBe(policy);
      }
    });

    it("rejects invalid interrupt policy values", () => {
      expect(() => VoiceInterruptPolicySchema.parse("always")).toThrow();
      expect(() => VoiceInterruptPolicySchema.parse("never")).toThrow();
    });
  });

  describe("VoicePlayMessageSchema & Safe audioUrl Validation", () => {
    const validPlayLocal = {
      type: "voice.play",
      jobId: "job_201",
      audioUrl: "/media/tts/voice_123.mp3",
      subtitle: "Cảm ơn Minh đã tặng 5 bông hồng!",
      volume: 1,
    };

    const validPlayUrl = {
      type: "voice.play",
      jobId: "job_202",
      audioUrl: "https://example.com/tts/voice_123.mp3",
      subtitle: "Welcome follow!",
      volume: 0.8,
    };

    it("parses valid voice.play with local audio path and absolute http/https URLs", () => {
      expect(VoicePlayMessageSchema.parse(validPlayLocal)).toEqual(validPlayLocal);
      expect(VoicePlayMessageSchema.parse(validPlayUrl)).toEqual(validPlayUrl);

      const httpPlay = {
        ...validPlayLocal,
        audioUrl: "http://localhost:3100/audio.mp3",
      };
      expect(VoicePlayMessageSchema.parse(httpPlay)).toEqual(httpPlay);

      const nestedLocalPlay = {
        ...validPlayLocal,
        audioUrl: "/a/b/c.mp3",
      };
      expect(VoicePlayMessageSchema.parse(nestedLocalPlay)).toEqual(nestedLocalPlay);
    });

    it("accepts volume boundaries 0 and 1, plus values between", () => {
      expect(VoicePlayMessageSchema.parse({ ...validPlayLocal, volume: 0 }).volume).toBe(0);
      expect(VoicePlayMessageSchema.parse({ ...validPlayLocal, volume: 1 }).volume).toBe(1);
      expect(VoicePlayMessageSchema.parse({ ...validPlayLocal, volume: 0.5 }).volume).toBe(0.5);
    });

    it("rejects volume below 0, above 1, NaN, positive infinity, or negative infinity", () => {
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, volume: -0.1 })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, volume: 1.1 })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, volume: Number.NaN })).toThrow();
      expect(() =>
        VoicePlayMessageSchema.parse({
          ...validPlayLocal,
          volume: Number.POSITIVE_INFINITY,
        })
      ).toThrow();
      expect(() =>
        VoicePlayMessageSchema.parse({
          ...validPlayLocal,
          volume: Number.NEGATIVE_INFINITY,
        })
      ).toThrow();
    });

    it("rejects empty jobId, audioUrl, or subtitle", () => {
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, jobId: "" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, subtitle: "" })).toThrow();
    });

    it("rejects unsafe, non-http/https schemes, relative paths, traversal segments, protocol-relative URLs, backslashes, and credentials", () => {
      // Empty and non-path
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "not-a-path" })).toThrow();

      // Relative path without leading /
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "media/tts/voice.mp3" })).toThrow();

      // Unsafe schemes
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "javascript:alert(1)" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "data:audio/mpeg;base64,AA==" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "file:///C:/secret.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "ftp://example.com/a.mp3" })).toThrow();

      // Protocol-relative
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "//evil.example/a.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/%2fevil.example/a.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/%2F%2Fevil.example/a.mp3" })).toThrow();

      // Dot traversal segments (literal & single percent-encoded)
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/../secret.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/./voice.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/%2e%2e/b.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/%2E%2E/b.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/..%2fb.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/%2f..%2fb.mp3" })).toThrow();

      // Control characters (literal & encoded)
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a\nb.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a%0ab.mp3" })).toThrow();

      // Backslashes (literal & encoded)
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/path\\file.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/path%5cfile.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/path%5Cfile.mp3" })).toThrow();

      // Malformed percent encoding
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/%2" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/%2g" })).toThrow();

      // Encoded query and fragment delimiters
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/%3fb.mp3" })).toThrow();
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "/a/%23b.mp3" })).toThrow();

      // Malformed absolute URLs
      expect(() => VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "http://" })).toThrow();

      // Credentials in URL
      expect(() =>
        VoicePlayMessageSchema.parse({ ...validPlayLocal, audioUrl: "https://user:pass@example.com/audio.mp3" })
      ).toThrow();
    });

    it("rejects extra keys on voice.play message (strict)", () => {
      expect(() =>
        VoicePlayMessageSchema.parse({ ...validPlayLocal, extraKey: "bad" })
      ).toThrow();
    });
  });

  describe("Playback Callbacks and Union (ADR-010 public playback.* literals)", () => {
    const started = {
      type: "playback.started",
      jobId: "job_201",
    };

    const finished = {
      type: "playback.finished",
      jobId: "job_201",
    };

    const interrupted = {
      type: "playback.interrupted",
      jobId: "job_201",
    };

    const failed = {
      type: "playback.failed",
      jobId: "job_201",
      error: {
        code: "AUDIO_PLAYBACK_ERROR",
        message: "Audio element failed to decode source",
      },
    };

    it("parses all four public callback variant schemas with playback.* literals", () => {
      expect(VoicePlaybackStartedMessageSchema.parse(started)).toEqual(started);
      expect(VoicePlaybackFinishedMessageSchema.parse(finished)).toEqual(finished);
      expect(VoicePlaybackInterruptedMessageSchema.parse(interrupted)).toEqual(interrupted);
      expect(VoicePlaybackFailedMessageSchema.parse(failed)).toEqual(failed);
    });

    it("parses and discriminates all public callback variants through VoicePlaybackCallbackMessageSchema", () => {
      const parsedStarted = VoicePlaybackCallbackMessageSchema.parse(started);
      const parsedFinished = VoicePlaybackCallbackMessageSchema.parse(finished);
      const parsedInterrupted = VoicePlaybackCallbackMessageSchema.parse(interrupted);
      const parsedFailed = VoicePlaybackCallbackMessageSchema.parse(failed);

      expect(parsedStarted.type).toBe("playback.started");
      expect(parsedFinished.type).toBe("playback.finished");
      expect(parsedInterrupted.type).toBe("playback.interrupted");
      if (parsedFailed.type === "playback.failed") {
        expect(parsedFailed.error.code).toBe("AUDIO_PLAYBACK_ERROR");
        expect(parsedFailed.error.message).toBe("Audio element failed to decode source");
      } else {
        throw new Error("Expected playback.failed discriminator");
      }
    });

    it("rejects legacy or reserved voice.playback.* literals in public callback schemas", () => {
      expect(() =>
        VoicePlaybackCallbackMessageSchema.parse({
          type: "voice.playback.started",
          jobId: "job_201",
        })
      ).toThrow();

      expect(() =>
        VoicePlaybackStartedMessageSchema.parse({
          type: "voice.playback.started",
          jobId: "job_201",
        })
      ).toThrow();
    });

    it("rejects empty jobId across callback variants", () => {
      expect(() =>
        VoicePlaybackStartedMessageSchema.parse({ ...started, jobId: "" })
      ).toThrow();
      expect(() =>
        VoicePlaybackFinishedMessageSchema.parse({ ...finished, jobId: "" })
      ).toThrow();
      expect(() =>
        VoicePlaybackInterruptedMessageSchema.parse({ ...interrupted, jobId: "" })
      ).toThrow();
      expect(() =>
        VoicePlaybackFailedMessageSchema.parse({ ...failed, jobId: "" })
      ).toThrow();
    });

    it("rejects empty error code or message in failed callback", () => {
      expect(() =>
        VoicePlaybackFailedMessageSchema.parse({
          ...failed,
          error: { code: "", message: "msg" },
        })
      ).toThrow();

      expect(() =>
        VoicePlaybackFailedMessageSchema.parse({
          ...failed,
          error: { code: "ERR", message: "" },
        })
      ).toThrow();
    });

    it("rejects extra keys on error object in failed callback (strict)", () => {
      expect(() =>
        VoicePlaybackErrorSchema.parse({
          code: "ERR",
          message: "msg",
          extra: 123,
        })
      ).toThrow();
    });

    it("rejects wrong message type discriminator or missing required fields", () => {
      expect(() =>
        VoicePlaybackCallbackMessageSchema.parse({
          type: "playback.unknown",
          jobId: "job_201",
        })
      ).toThrow();

      expect(() =>
        VoicePlaybackStartedMessageSchema.parse({
          type: "playback.started",
        })
      ).toThrow();

      expect(() =>
        VoicePlaybackFailedMessageSchema.parse({
          type: "playback.failed",
          jobId: "job_201",
        })
      ).toThrow();
    });

    it("rejects extra keys or mismatched fields across callback variants (strict)", () => {
      expect(() =>
        VoicePlaybackStartedMessageSchema.parse({ ...started, extra: 1 })
      ).toThrow();
      expect(() =>
        VoicePlaybackFinishedMessageSchema.parse({ ...finished, extra: 1 })
      ).toThrow();
      expect(() =>
        VoicePlaybackInterruptedMessageSchema.parse({ ...interrupted, extra: 1 })
      ).toThrow();
      expect(() =>
        VoicePlaybackFailedMessageSchema.parse({ ...failed, extra: 1 })
      ).toThrow();

      // Started callback rejects error field
      expect(() =>
        VoicePlaybackStartedMessageSchema.parse({
          ...started,
          error: { code: "ERR", message: "bad" },
        })
      ).toThrow();
    });
  });
});
