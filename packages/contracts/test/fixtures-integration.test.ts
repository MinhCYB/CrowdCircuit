import { describe, it, expect } from "vitest";
import {
  // Canonical fixtures from package root / fixtures
  CANONICAL_GIFT_SENT_EVENT,
  CANONICAL_CHAT_COMMENT_EVENT,
  CANONICAL_ENGAGEMENT_LIKE_EVENT,
  CANONICAL_SOCIAL_FOLLOW_EVENT,
  CANONICAL_GAME_ACTION_ENVELOPE,
  CANONICAL_GAME_ACTION_RECEIVED_MESSAGE,
  CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE,
  CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE,
  CANONICAL_VOICE_INTENT,
  CANONICAL_VOICE_PLAY_MESSAGE,
  CANONICAL_VOICE_PLAYBACK_STARTED_MESSAGE,
  CANONICAL_VOICE_PLAYBACK_FINISHED_MESSAGE,
  CANONICAL_VOICE_PLAYBACK_INTERRUPTED_MESSAGE,
  CANONICAL_VOICE_PLAYBACK_FAILED_MESSAGE,
  // Runtime Zod schemas
  GiftSentEventSchema,
  ChatCommentEventSchema,
  EngagementLikeEventSchema,
  SocialFollowEventSchema,
  LiveEventEnvelopeSchema,
  GameActionEnvelopeSchema,
  GameActionReceivedMessageSchema,
  GameActionResultMessageSchema,
  VoiceIntentSchema,
  VoicePlayMessageSchema,
  VoicePlaybackStartedMessageSchema,
  VoicePlaybackFinishedMessageSchema,
  VoicePlaybackInterruptedMessageSchema,
  VoicePlaybackFailedMessageSchema,
  VoicePlaybackCallbackMessageSchema,
} from "../src/index.js";
import { deepFreeze } from "../src/fixtures/freezer.js";

describe("FOUND-02F Canonical Fixtures and Cross-Contract Integration", () => {
  describe("Positive Canonical Fixtures Verification", () => {
    it("parses CANONICAL_GIFT_SENT_EVENT with payload and envelope schemas", () => {
      const parsedPayload = GiftSentEventSchema.parse(CANONICAL_GIFT_SENT_EVENT);
      const parsedEnvelope = LiveEventEnvelopeSchema.parse(CANONICAL_GIFT_SENT_EVENT);

      expect(parsedPayload.eventType).toBe("gift.sent");
      expect(parsedEnvelope.eventType).toBe("gift.sent");
      expect(parsedPayload).toEqual(CANONICAL_GIFT_SENT_EVENT);
    });

    it("parses CANONICAL_CHAT_COMMENT_EVENT with payload and envelope schemas", () => {
      const parsedPayload = ChatCommentEventSchema.parse(CANONICAL_CHAT_COMMENT_EVENT);
      const parsedEnvelope = LiveEventEnvelopeSchema.parse(CANONICAL_CHAT_COMMENT_EVENT);

      expect(parsedPayload.eventType).toBe("chat.comment");
      expect(parsedEnvelope.eventType).toBe("chat.comment");
      expect(parsedPayload).toEqual(CANONICAL_CHAT_COMMENT_EVENT);
    });

    it("parses CANONICAL_ENGAGEMENT_LIKE_EVENT with payload and envelope schemas", () => {
      const parsedPayload = EngagementLikeEventSchema.parse(CANONICAL_ENGAGEMENT_LIKE_EVENT);
      const parsedEnvelope = LiveEventEnvelopeSchema.parse(CANONICAL_ENGAGEMENT_LIKE_EVENT);

      expect(parsedPayload.eventType).toBe("engagement.like");
      expect(parsedEnvelope.eventType).toBe("engagement.like");
      expect(parsedPayload).toEqual(CANONICAL_ENGAGEMENT_LIKE_EVENT);
    });

    it("parses CANONICAL_SOCIAL_FOLLOW_EVENT with payload and envelope schemas", () => {
      const parsedPayload = SocialFollowEventSchema.parse(CANONICAL_SOCIAL_FOLLOW_EVENT);
      const parsedEnvelope = LiveEventEnvelopeSchema.parse(CANONICAL_SOCIAL_FOLLOW_EVENT);

      expect(parsedPayload.eventType).toBe("social.follow");
      expect(parsedEnvelope.eventType).toBe("social.follow");
      expect(parsedPayload).toEqual(CANONICAL_SOCIAL_FOLLOW_EVENT);
    });

    it("parses CANONICAL_GAME_ACTION_ENVELOPE with GameActionEnvelopeSchema", () => {
      const parsed = GameActionEnvelopeSchema.parse(CANONICAL_GAME_ACTION_ENVELOPE);
      expect(parsed.actionId).toBe("act_canonical_001");
      expect(parsed.actionType).toBe("SPAWN_ZOMBIE");
      expect(parsed).toEqual(CANONICAL_GAME_ACTION_ENVELOPE);
    });

    it("parses CANONICAL_GAME_ACTION_RECEIVED_MESSAGE with GameActionReceivedMessageSchema", () => {
      const parsed = GameActionReceivedMessageSchema.parse(CANONICAL_GAME_ACTION_RECEIVED_MESSAGE);
      expect(parsed.type).toBe("game.action.received");
      expect(parsed).toEqual(CANONICAL_GAME_ACTION_RECEIVED_MESSAGE);
    });

    it("parses CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE and CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE", () => {
      const parsedCompleted = GameActionResultMessageSchema.parse(
        CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE
      );
      const parsedFailed = GameActionResultMessageSchema.parse(
        CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE
      );

      expect(parsedCompleted.status).toBe("completed");
      expect(parsedFailed.status).toBe("failed");
    });

    it("parses CANONICAL_VOICE_INTENT with VoiceIntentSchema", () => {
      const parsed = VoiceIntentSchema.parse(CANONICAL_VOICE_INTENT);
      expect(parsed.intentId).toBe("intent_canonical_001");
      expect(parsed.kind).toBe("thank_gift");
      expect(parsed).toEqual(CANONICAL_VOICE_INTENT);
    });

    it("parses CANONICAL_VOICE_PLAY_MESSAGE with VoicePlayMessageSchema", () => {
      const parsed = VoicePlayMessageSchema.parse(CANONICAL_VOICE_PLAY_MESSAGE);
      expect(parsed.type).toBe("voice.play");
      expect(parsed.audioUrl).toBe("/media/tts/canonical_voice_001.mp3");
      expect(parsed).toEqual(CANONICAL_VOICE_PLAY_MESSAGE);
    });

    it("parses all four public playback callback canonical fixtures individually and through VoicePlaybackCallbackMessageSchema union", () => {
      expect(
        VoicePlaybackStartedMessageSchema.parse(CANONICAL_VOICE_PLAYBACK_STARTED_MESSAGE)
      ).toEqual(CANONICAL_VOICE_PLAYBACK_STARTED_MESSAGE);

      expect(
        VoicePlaybackFinishedMessageSchema.parse(CANONICAL_VOICE_PLAYBACK_FINISHED_MESSAGE)
      ).toEqual(CANONICAL_VOICE_PLAYBACK_FINISHED_MESSAGE);

      expect(
        VoicePlaybackInterruptedMessageSchema.parse(CANONICAL_VOICE_PLAYBACK_INTERRUPTED_MESSAGE)
      ).toEqual(CANONICAL_VOICE_PLAYBACK_INTERRUPTED_MESSAGE);

      expect(
        VoicePlaybackFailedMessageSchema.parse(CANONICAL_VOICE_PLAYBACK_FAILED_MESSAGE)
      ).toEqual(CANONICAL_VOICE_PLAYBACK_FAILED_MESSAGE);

      // Union parsing for all four callback variants
      const parsedStartedUnion = VoicePlaybackCallbackMessageSchema.parse(
        CANONICAL_VOICE_PLAYBACK_STARTED_MESSAGE
      );
      const parsedFinishedUnion = VoicePlaybackCallbackMessageSchema.parse(
        CANONICAL_VOICE_PLAYBACK_FINISHED_MESSAGE
      );
      const parsedInterruptedUnion = VoicePlaybackCallbackMessageSchema.parse(
        CANONICAL_VOICE_PLAYBACK_INTERRUPTED_MESSAGE
      );
      const parsedFailedUnion = VoicePlaybackCallbackMessageSchema.parse(
        CANONICAL_VOICE_PLAYBACK_FAILED_MESSAGE
      );

      expect(parsedStartedUnion.type).toBe("playback.started");
      expect(parsedFinishedUnion.type).toBe("playback.finished");
      expect(parsedInterruptedUnion.type).toBe("playback.interrupted");
      expect(parsedFailedUnion.type).toBe("playback.failed");
    });
  });

  describe("Internal Freezer Implementation & Cycle Safety", () => {
    it("freezes cyclic object graphs without exceeding maximum call stack size", () => {
      const nodeA: Record<string, unknown> = { id: "a" };
      const nodeB: Record<string, unknown> = { id: "b", parent: nodeA };
      nodeA.child = nodeB;

      expect(() => deepFreeze(nodeA)).not.toThrow();
      expect(Object.isFrozen(nodeA)).toBe(true);
      expect(Object.isFrozen(nodeB)).toBe(true);
      expect(() => {
        (nodeA as Record<string, unknown>).id = "modified";
      }).toThrow(TypeError);
      expect(() => {
        (nodeB as Record<string, unknown>).id = "modified";
      }).toThrow(TypeError);
    });

    it("recursively freezes mutable descendants of an already shallow-frozen parent", () => {
      const child = { count: 10 };
      const parent = Object.freeze({ child });

      expect(Object.isFrozen(parent)).toBe(true);
      expect(Object.isFrozen(child)).toBe(false);

      deepFreeze(parent);

      expect(Object.isFrozen(parent)).toBe(true);
      expect(Object.isFrozen(child)).toBe(true);
      expect(() => {
        (child as Record<string, unknown>).count = 20;
      }).toThrow(TypeError);
      expect(child.count).toBe(10);
    });
  });

  describe("Runtime Deep Immutability Regression Probes", () => {
    it("prevents mutation of top-level fixture fields", () => {
      expect(() => {
        (CANONICAL_GIFT_SENT_EVENT as Record<string, unknown>).specVersion = "0.2";
      }).toThrow(TypeError);

      expect(CANONICAL_GIFT_SENT_EVENT.specVersion).toBe("0.1");
      expect(GiftSentEventSchema.parse(CANONICAL_GIFT_SENT_EVENT)).toEqual(
        CANONICAL_GIFT_SENT_EVENT
      );
    });

    it("prevents mutation of nested gift payload fields", () => {
      expect(() => {
        (CANONICAL_GIFT_SENT_EVENT.payload.gift as Record<string, unknown>).name =
          "Modified Rose";
      }).toThrow(TypeError);

      expect(CANONICAL_GIFT_SENT_EVENT.payload.gift.name).toBe("Rose");
      expect(GiftSentEventSchema.parse(CANONICAL_GIFT_SENT_EVENT)).toEqual(
        CANONICAL_GIFT_SENT_EVENT
      );
    });

    it("prevents mutation of nested arrays (user roles)", () => {
      expect(() => {
        (CANONICAL_GIFT_SENT_EVENT.user!.roles as string[]).push("admin");
      }).toThrow(TypeError);

      expect(() => {
        (CANONICAL_GIFT_SENT_EVENT.user!.roles as string[])[0] = "admin";
      }).toThrow(TypeError);

      expect(CANONICAL_GIFT_SENT_EVENT.user!.roles).toEqual(["viewer"]);
      expect(GiftSentEventSchema.parse(CANONICAL_GIFT_SENT_EVENT)).toEqual(
        CANONICAL_GIFT_SENT_EVENT
      );
    });

    it("prevents mutation of action params", () => {
      expect(() => {
        (CANONICAL_GAME_ACTION_ENVELOPE.params as Record<string, unknown>).spawnCount = 99;
      }).toThrow(TypeError);

      expect(CANONICAL_GAME_ACTION_ENVELOPE.params.spawnCount).toBe(5);
      expect(GameActionEnvelopeSchema.parse(CANONICAL_GAME_ACTION_ENVELOPE)).toEqual(
        CANONICAL_GAME_ACTION_ENVELOPE
      );
    });

    it("prevents mutation of action actor", () => {
      expect(() => {
        (CANONICAL_GAME_ACTION_ENVELOPE.actor as Record<string, unknown>).displayName =
          "Hacked";
      }).toThrow(TypeError);

      expect(CANONICAL_GAME_ACTION_ENVELOPE.actor.displayName).toBe("Canonical Viewer");
      expect(GameActionEnvelopeSchema.parse(CANONICAL_GAME_ACTION_ENVELOPE)).toEqual(
        CANONICAL_GAME_ACTION_ENVELOPE
      );
    });

    it("prevents mutation of action trigger", () => {
      expect(() => {
        (CANONICAL_GAME_ACTION_ENVELOPE.trigger as Record<string, unknown>).eventId =
          "hacked";
      }).toThrow(TypeError);

      expect(CANONICAL_GAME_ACTION_ENVELOPE.trigger.eventId).toBe("evt_gift_canonical_001");
      expect(GameActionEnvelopeSchema.parse(CANONICAL_GAME_ACTION_ENVELOPE)).toEqual(
        CANONICAL_GAME_ACTION_ENVELOPE
      );
    });

    it("prevents mutation of voice variables", () => {
      expect(() => {
        (CANONICAL_VOICE_INTENT.variables as Record<string, unknown>).count = 99;
      }).toThrow(TypeError);

      expect(CANONICAL_VOICE_INTENT.variables.count).toBe(1);
      expect(VoiceIntentSchema.parse(CANONICAL_VOICE_INTENT)).toEqual(
        CANONICAL_VOICE_INTENT
      );
    });

    it("prevents mutation of completed-result details", () => {
      expect(() => {
        (
          CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE.details as Record<
            string,
            unknown
          >
        ).spawned = 99;
      }).toThrow(TypeError);

      expect(
        (CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE.details as { spawned: number }).spawned
      ).toBe(5);
      expect(
        GameActionResultMessageSchema.parse(
          CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE
        )
      ).toEqual(CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE);
    });

    it("prevents mutation of failed-result error fields", () => {
      expect(() => {
        (
          CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE.error as Record<
            string,
            unknown
          >
        ).message = "changed";
      }).toThrow(TypeError);

      expect(CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE.error.message).toBe(
        "Maximum active zombies reached"
      );
      expect(
        GameActionResultMessageSchema.parse(CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE)
      ).toEqual(CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE);
    });
  });

  describe("Negative Near-Miss Integration Coverage", () => {
    it("rejects incorrect specVersion across event, action, and voice contracts", () => {
      expect(() =>
        GiftSentEventSchema.parse({ ...CANONICAL_GIFT_SENT_EVENT, specVersion: "0.2" })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...CANONICAL_GAME_ACTION_ENVELOPE,
          specVersion: "1.0",
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({ ...CANONICAL_VOICE_INTENT, specVersion: "0.0" })
      ).toThrow();
    });

    it("rejects wrong event, action, voice, or playback callback discriminators", () => {
      expect(() =>
        LiveEventEnvelopeSchema.parse({
          ...CANONICAL_GIFT_SENT_EVENT,
          eventType: "unknown_event" as unknown,
        })
      ).toThrow();

      expect(() =>
        GameActionReceivedMessageSchema.parse({
          ...CANONICAL_GAME_ACTION_RECEIVED_MESSAGE,
          type: "game.action.sent" as unknown,
        })
      ).toThrow();

      expect(() =>
        VoicePlayMessageSchema.parse({
          ...CANONICAL_VOICE_PLAY_MESSAGE,
          type: "voice.playback" as unknown,
        })
      ).toThrow();

      expect(() =>
        VoicePlaybackCallbackMessageSchema.parse({
          type: "voice.playback.started" as unknown,
          jobId: "job_001",
        })
      ).toThrow();
    });

    it("rejects invalid or empty identifiers across contract families", () => {
      expect(() =>
        GiftSentEventSchema.parse({ ...CANONICAL_GIFT_SENT_EVENT, eventId: "" })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...CANONICAL_GAME_ACTION_ENVELOPE,
          actionId: "",
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({ ...CANONICAL_VOICE_INTENT, intentId: "" })
      ).toThrow();

      expect(() =>
        VoicePlayMessageSchema.parse({ ...CANONICAL_VOICE_PLAY_MESSAGE, jobId: "" })
      ).toThrow();
    });

    it("rejects invalid ISO datetime timestamps across contract families", () => {
      expect(() =>
        GiftSentEventSchema.parse({
          ...CANONICAL_GIFT_SENT_EVENT,
          occurredAt: "not-a-date",
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...CANONICAL_GAME_ACTION_ENVELOPE,
          createdAt: "2026/07/23",
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...CANONICAL_VOICE_INTENT,
          expiresAt: "invalid-iso",
        })
      ).toThrow();
    });

    it("rejects omission of required nullable fields across contract families", () => {
      // GameActionEnvelope actor.avatarUrl
      const omittedAvatarUrl = {
        ...CANONICAL_GAME_ACTION_ENVELOPE,
        actor: { viewerId: "usr_1", displayName: "Viewer" },
      };
      expect(() => GameActionEnvelopeSchema.parse(omittedAvatarUrl)).toThrow();

      // VoiceIntent eventId
      const omittedVoiceEventId = { ...CANONICAL_VOICE_INTENT };
      delete (omittedVoiceEventId as Record<string, unknown>).eventId;
      expect(() => VoiceIntentSchema.parse(omittedVoiceEventId)).toThrow();
    });

    it("rejects explicit undefined for required nullable fields across contract families", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...CANONICAL_GAME_ACTION_ENVELOPE,
          actor: {
            viewerId: "usr_1",
            displayName: "Viewer",
            avatarUrl: undefined as unknown as null,
          },
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...CANONICAL_VOICE_INTENT,
          eventId: undefined as unknown as null,
        })
      ).toThrow();
    });

    it("rejects invented extra keys on strict fixed-shape objects", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...CANONICAL_GAME_ACTION_ENVELOPE,
          extraField: 123,
        })
      ).toThrow();

      expect(() =>
        VoiceIntentSchema.parse({
          ...CANONICAL_VOICE_INTENT,
          unexpected: true,
        })
      ).toThrow();

      expect(() =>
        VoicePlayMessageSchema.parse({
          ...CANONICAL_VOICE_PLAY_MESSAGE,
          unauthorizedParam: "bad",
        })
      ).toThrow();
    });

    it("rejects non-JSON action parameters or result details", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...CANONICAL_GAME_ACTION_ENVELOPE,
          params: { bad: (() => 123) as unknown as string },
        })
      ).toThrow();

      expect(() =>
        GameActionResultMessageSchema.parse({
          type: "game.action.result",
          actionId: "act_1",
          status: "completed",
          durationMs: 50,
          details: { bad: Symbol("test") as unknown as string },
        })
      ).toThrow();
    });

    it("rejects invalid voice variables (non-scalar values or class instance containers)", () => {
      expect(() =>
        VoiceIntentSchema.parse({
          ...CANONICAL_VOICE_INTENT,
          variables: { bad: true as unknown as string },
        })
      ).toThrow();

      class CustomClass {}
      expect(() =>
        VoiceIntentSchema.parse({
          ...CANONICAL_VOICE_INTENT,
          variables: new CustomClass() as unknown as Record<string, string>,
        })
      ).toThrow();
    });

    it("rejects unsafe voice audio paths (traversal, non-http schemes, backslashes)", () => {
      expect(() =>
        VoicePlayMessageSchema.parse({
          ...CANONICAL_VOICE_PLAY_MESSAGE,
          audioUrl: "/a/%2e%2e/b.mp3",
        })
      ).toThrow();

      expect(() =>
        VoicePlayMessageSchema.parse({
          ...CANONICAL_VOICE_PLAY_MESSAGE,
          audioUrl: "javascript:alert(1)",
        })
      ).toThrow();

      expect(() =>
        VoicePlayMessageSchema.parse({
          ...CANONICAL_VOICE_PLAY_MESSAGE,
          audioUrl: "/path\\file.mp3",
        })
      ).toThrow();
    });

    it("rejects invalid playback callback discriminators", () => {
      expect(() =>
        VoicePlaybackCallbackMessageSchema.parse({
          type: "playback.unknown" as unknown,
          jobId: "job_001",
        })
      ).toThrow();
    });
  });
});
