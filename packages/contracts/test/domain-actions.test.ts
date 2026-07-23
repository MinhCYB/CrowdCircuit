import { describe, it, expect } from "vitest";
import {
  GameActionEnvelopeSchema,
  GameRegisterMessageSchema,
  GameRegisteredMessageSchema,
  GameHeartbeatMessageSchema,
  GameActionDeliveryMessageSchema,
  GameActionReceivedMessageSchema,
  GameActionCompletedResultSchema,
  GameActionFailedResultSchema,
  GameActionResultMessageSchema,
  GameActionErrorSchema,
} from "../src/index.js";

describe("FOUND-02D GameActionEnvelope and Action Lifecycle Schemas", () => {
  const validActor = {
    viewerId: "usr_123",
    displayName: "Player One",
    avatarUrl: "https://example.com/avatar.png",
  };

  const validTrigger = {
    eventId: "evt_gift_1",
    eventType: "gift.sent",
    mappingId: "map_rose_spawn",
  };

  const validEnvelope = {
    specVersion: "0.1",
    actionId: "act_101",
    actionType: "SPAWN_ZOMBIE",
    gameId: "zombie-survival",
    gameInstanceId: "inst_456",
    params: { amount: 5, ownerName: "Player One", nested: { ok: true } },
    actor: validActor,
    trigger: validTrigger,
    priority: 80,
    ttlMs: 10000,
    createdAt: "2026-07-23T04:00:00.000Z",
  };

  describe("GameActionEnvelopeSchema", () => {
    it("parses valid complete GameActionEnvelope", () => {
      const parsed = GameActionEnvelopeSchema.parse(validEnvelope);
      expect(parsed).toEqual(validEnvelope);
    });

    it("parses valid envelope with nullable gameInstanceId, actor, viewerId, and avatarUrl", () => {
      const nullablesEnvelope = {
        ...validEnvelope,
        gameInstanceId: null,
        actor: {
          viewerId: null,
          displayName: "Anonymous Player",
          avatarUrl: null,
        },
      };
      const parsed = GameActionEnvelopeSchema.parse(nullablesEnvelope);
      expect(parsed.gameInstanceId).toBeNull();
      expect(parsed.actor?.viewerId).toBeNull();
      expect(parsed.actor?.avatarUrl).toBeNull();
    });

    it("parses valid envelope with null actor", () => {
      const nullActorEnvelope = {
        ...validEnvelope,
        actor: null,
      };
      const parsed = GameActionEnvelopeSchema.parse(nullActorEnvelope);
      expect(parsed.actor).toBeNull();
    });

    it("accepts zero and negative priority integers", () => {
      expect(
        GameActionEnvelopeSchema.parse({ ...validEnvelope, priority: 0 }).priority
      ).toBe(0);
      expect(
        GameActionEnvelopeSchema.parse({ ...validEnvelope, priority: -10 }).priority
      ).toBe(-10);
    });

    it("rejects non-integer, NaN, positive infinity, or negative infinity priority", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, priority: 1.5 })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, priority: Number.NaN })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          priority: Number.POSITIVE_INFINITY,
        })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          priority: Number.NEGATIVE_INFINITY,
        })
      ).toThrow();
    });

    it("rejects zero, negative, fractional, NaN, positive infinity, or negative infinity ttlMs", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, ttlMs: 0 })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, ttlMs: -100 })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, ttlMs: 100.5 })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, ttlMs: Number.NaN })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          ttlMs: Number.POSITIVE_INFINITY,
        })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          ttlMs: Number.NEGATIVE_INFINITY,
        })
      ).toThrow();
    });

    it("rejects empty string IDs and types", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, actionId: "" })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, actionType: "" })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, gameId: "" })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, gameInstanceId: "" })
      ).toThrow();
    });

    it("rejects invalid avatarUrl format when non-null", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, avatarUrl: "not-a-valid-url" },
        })
      ).toThrow();
    });

    it("rejects empty actor displayName or viewerId string", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, displayName: "" },
        })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, viewerId: "" },
        })
      ).toThrow();
    });

    it("rejects empty trigger string fields", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          trigger: { ...validTrigger, eventId: "" },
        })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          trigger: { ...validTrigger, eventType: "" },
        })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          trigger: { ...validTrigger, mappingId: "" },
        })
      ).toThrow();
    });

    it("rejects invalid createdAt ISO string", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          createdAt: "invalid-date",
        })
      ).toThrow();
    });

    it("rejects extra keys on envelope, actor, and trigger (strict)", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          extraField: "bad",
        })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, extraActorKey: 123 },
        })
      ).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          trigger: { ...validTrigger, extraTriggerKey: 123 },
        })
      ).toThrow();
    });

    it("enforces required nullable properties: omission and undefined fail, null succeeds", () => {
      // gameInstanceId
      const omittedInstance = { ...validEnvelope };
      delete (omittedInstance as Record<string, unknown>).gameInstanceId;
      expect(() => GameActionEnvelopeSchema.parse(omittedInstance)).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          gameInstanceId: undefined,
        })
      ).toThrow();
      expect(
        GameActionEnvelopeSchema.parse({ ...validEnvelope, gameInstanceId: null })
          .gameInstanceId
      ).toBeNull();

      // actor
      const omittedActor = { ...validEnvelope };
      delete (omittedActor as Record<string, unknown>).actor;
      expect(() => GameActionEnvelopeSchema.parse(omittedActor)).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({ ...validEnvelope, actor: undefined })
      ).toThrow();
      expect(
        GameActionEnvelopeSchema.parse({ ...validEnvelope, actor: null }).actor
      ).toBeNull();

      // actor.viewerId
      const omittedViewerId = {
        ...validEnvelope,
        actor: { displayName: "Player", avatarUrl: null },
      };
      expect(() => GameActionEnvelopeSchema.parse(omittedViewerId)).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, viewerId: undefined },
        })
      ).toThrow();
      expect(
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, viewerId: null },
        }).actor?.viewerId
      ).toBeNull();

      // actor.avatarUrl
      const omittedAvatarUrl = {
        ...validEnvelope,
        actor: { viewerId: "usr_1", displayName: "Player" },
      };
      expect(() => GameActionEnvelopeSchema.parse(omittedAvatarUrl)).toThrow();
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, avatarUrl: undefined },
        })
      ).toThrow();
      expect(
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          actor: { ...validActor, avatarUrl: null },
        }).actor?.avatarUrl
      ).toBeNull();
    });

    it("rejects non-JSON params (undefined, BigInt, Symbol, function, Date, Map, Set, NaN, Class)", () => {
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: undefined },
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: BigInt(100) },
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: Symbol("test") },
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: () => 123 },
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: new Date() },
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: new Map() },
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: new Set() },
        })
      ).toThrow();

      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: Number.NaN },
        })
      ).toThrow();

      class CustomClass {}
      expect(() =>
        GameActionEnvelopeSchema.parse({
          ...validEnvelope,
          params: { bad: new CustomClass() },
        })
      ).toThrow();
    });
  });

  describe("Registration, Registered, and Heartbeat Messages", () => {
    it("parses valid game.register message", () => {
      const msg = {
        type: "game.register",
        gameId: "zombie-survival",
        instanceId: "inst_999",
        sdkVersion: "0.1.0",
        token: "opaque-token-123",
      };
      expect(GameRegisterMessageSchema.parse(msg)).toEqual(msg);
    });

    it("rejects game.register with empty string fields (gameId, instanceId, sdkVersion, token)", () => {
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          gameId: "",
          instanceId: "inst",
          sdkVersion: "0.1",
          token: "tok",
        })
      ).toThrow();
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          gameId: "g",
          instanceId: "",
          sdkVersion: "0.1",
          token: "tok",
        })
      ).toThrow();
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          gameId: "g",
          instanceId: "inst",
          sdkVersion: "",
          token: "tok",
        })
      ).toThrow();
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          gameId: "g",
          instanceId: "inst",
          sdkVersion: "0.1",
          token: "",
        })
      ).toThrow();
    });

    it("rejects game.register with missing required fields or extra keys", () => {
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          gameId: "g",
          instanceId: "inst",
          sdkVersion: "0.1",
        })
      ).toThrow();

      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          gameId: "g",
          instanceId: "inst",
          sdkVersion: "0.1",
          token: "tok",
          extra: 1,
        })
      ).toThrow();
    });

    it("parses valid game.registered message", () => {
      const msg = {
        type: "game.registered",
        heartbeatIntervalMs: 5000,
      };
      expect(GameRegisteredMessageSchema.parse(msg)).toEqual(msg);
    });

    it("rejects invalid heartbeatIntervalMs (zero, negative, fractional, NaN, positive infinity, negative infinity)", () => {
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          heartbeatIntervalMs: 0,
        })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          heartbeatIntervalMs: -1000,
        })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          heartbeatIntervalMs: 5000.5,
        })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          heartbeatIntervalMs: Number.NaN,
        })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          heartbeatIntervalMs: Number.POSITIVE_INFINITY,
        })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          heartbeatIntervalMs: Number.NEGATIVE_INFINITY,
        })
      ).toThrow();
    });

    it("rejects game.registered with missing fields or extra keys", () => {
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
        })
      ).toThrow();

      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          heartbeatIntervalMs: 5000,
          extra: 1,
        })
      ).toThrow();
    });

    it("parses valid minimal game.heartbeat message", () => {
      const msg = { type: "game.heartbeat" };
      expect(GameHeartbeatMessageSchema.parse(msg)).toEqual(msg);
    });

    it("rejects missing fields, extra keys, or wrong type on game.heartbeat", () => {
      expect(() => GameHeartbeatMessageSchema.parse({})).toThrow();
      expect(() =>
        GameHeartbeatMessageSchema.parse({
          type: "game.heartbeat",
          timestamp: 12345,
        })
      ).toThrow();
      expect(() =>
        GameHeartbeatMessageSchema.parse({
          type: "game.ping",
        })
      ).toThrow();
    });
  });

  describe("Action Delivery and Receipt Messages", () => {
    it("parses valid game.action delivery message", () => {
      const delivery = {
        type: "game.action",
        data: validEnvelope,
      };
      expect(GameActionDeliveryMessageSchema.parse(delivery)).toEqual(delivery);
    });

    it("rejects game.action with missing fields, extra keys, or invalid data", () => {
      expect(() =>
        GameActionDeliveryMessageSchema.parse({
          type: "game.action",
        })
      ).toThrow();
      expect(() =>
        GameActionDeliveryMessageSchema.parse({
          type: "game.action",
          data: { ...validEnvelope, actionId: "" },
        })
      ).toThrow();
      expect(() =>
        GameActionDeliveryMessageSchema.parse({
          type: "game.action",
          data: validEnvelope,
          extraKey: 1,
        })
      ).toThrow();
    });

    it("parses valid game.action.received receipt message", () => {
      const receipt = {
        type: "game.action.received",
        actionId: "act_101",
        receivedAt: "2026-07-23T04:00:00.250Z",
      };
      expect(GameActionReceivedMessageSchema.parse(receipt)).toEqual(receipt);
    });

    it("rejects receipt with empty actionId, missing fields, or extra keys", () => {
      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          actionId: "",
          receivedAt: "2026-07-23T04:00:00.250Z",
        })
      ).toThrow();

      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          actionId: "act_101",
        })
      ).toThrow();

      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          actionId: "act_101",
          receivedAt: "2026-07-23T04:00:00.250Z",
          extraKey: "bad",
        })
      ).toThrow();
    });

    it("rejects receipt containing completion/result fields or invalid timestamp", () => {
      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          actionId: "act_101",
          receivedAt: "2026-07-23T04:00:00.250Z",
          status: "completed", // Result field not allowed on receipt!
        })
      ).toThrow();

      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          actionId: "act_101",
          receivedAt: "invalid-iso",
        })
      ).toThrow();
    });
  });

  describe("Action Result Union (completed / failed)", () => {
    it("parses valid completed result with zero or positive durationMs and optional details", () => {
      const zeroDuration = {
        type: "game.action.result",
        actionId: "act_101",
        status: "completed",
        durationMs: 0,
      };
      expect(GameActionCompletedResultSchema.parse(zeroDuration)).toEqual(
        zeroDuration
      );

      const withDetails = {
        type: "game.action.result",
        actionId: "act_101",
        status: "completed",
        durationMs: 1450,
        details: { spawnedEntities: 5, wave: 2 },
      };
      expect(GameActionCompletedResultSchema.parse(withDetails)).toEqual(
        withDetails
      );
    });

    it("rejects empty actionId on completed result", () => {
      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "",
          status: "completed",
          durationMs: 100,
        })
      ).toThrow();
    });

    it("rejects invalid durationMs on completed result (negative, fractional, NaN, positive infinity, negative infinity)", () => {
      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: -50,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 120.5,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: Number.NaN,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: Number.POSITIVE_INFINITY,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: Number.NEGATIVE_INFINITY,
        })
      ).toThrow();
    });

    it("rejects completed result with missing fields or extra keys", () => {
      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          status: "completed",
          durationMs: 100,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          extraKey: 123,
        })
      ).toThrow();
    });

    it("rejects completed result containing failed-only fields (error)", () => {
      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          error: { code: "ERR", message: "fail", retryable: false },
        })
      ).toThrow();
    });

    it("parses valid failed result with complete error object", () => {
      const failed = {
        type: "game.action.result",
        actionId: "act_101",
        status: "failed",
        error: {
          code: "ENTITY_CAP_REACHED",
          message: "Maximum zombies spawned for active wave",
          retryable: false,
        },
      };
      expect(GameActionFailedResultSchema.parse(failed)).toEqual(failed);
    });

    it("rejects empty actionId on failed result", () => {
      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          actionId: "",
          status: "failed",
          error: { code: "ERR", message: "msg", retryable: false },
        })
      ).toThrow();
    });

    it("rejects failed result with invalid error object, empty strings, missing fields, or extra keys", () => {
      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "failed",
          error: { code: "", message: "msg", retryable: false },
        })
      ).toThrow();

      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "failed",
          error: { code: "ERR", message: "", retryable: false },
        })
      ).toThrow();

      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "failed",
          error: { code: "ERR", message: "msg", retryable: "no" as unknown as boolean },
        })
      ).toThrow();

      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "failed",
        })
      ).toThrow();

      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "failed",
          error: { code: "ERR", message: "msg", retryable: false },
          extraKey: 1,
        })
      ).toThrow();
    });

    it("rejects GameActionErrorSchema with missing fields or extra keys", () => {
      expect(() =>
        GameActionErrorSchema.parse({ code: "ERR", message: "msg" })
      ).toThrow();

      expect(() =>
        GameActionErrorSchema.parse({
          code: "ERR",
          message: "msg",
          retryable: false,
          extraKey: 1,
        })
      ).toThrow();
    });

    it("rejects failed result containing completed-only fields (durationMs)", () => {
      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "failed",
          durationMs: 100,
          error: { code: "ERR", message: "msg", retryable: false },
        })
      ).toThrow();
    });

    it("parses and discriminates result union correctly", () => {
      const completedInput = {
        type: "game.action.result",
        actionId: "act_101",
        status: "completed",
        durationMs: 250,
      };

      const failedInput = {
        type: "game.action.result",
        actionId: "act_102",
        status: "failed",
        error: { code: "TIMEOUT", message: "Action timed out", retryable: true },
      };

      const parsedCompleted = GameActionResultMessageSchema.parse(completedInput);
      const parsedFailed = GameActionResultMessageSchema.parse(failedInput);

      if (parsedCompleted.status === "completed") {
        expect(parsedCompleted.durationMs).toBe(250);
      } else {
        throw new Error("Expected completed status");
      }

      if (parsedFailed.status === "failed") {
        expect(parsedFailed.error.code).toBe("TIMEOUT");
        expect(parsedFailed.error.retryable).toBe(true);
      } else {
        throw new Error("Expected failed status");
      }
    });

    it("rejects invalid status discriminator on result union", () => {
      expect(() =>
        GameActionResultMessageSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "pending",
        })
      ).toThrow();
    });

    it("rejects non-JSON details on completed result (undefined, BigInt, Symbol, function, Date, Map, Set, NaN, Infinities, Class)", () => {
      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: undefined },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: [undefined] },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: BigInt(10) },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: Symbol("test") },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: () => 123 },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: new Date() },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: new Map() },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: new Set() },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: Number.NaN },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: Number.POSITIVE_INFINITY },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
          details: { bad: Number.NEGATIVE_INFINITY },
        })
      ).toThrow();

      class CustomClass {}
      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...validEnvelope,
          details: { bad: new CustomClass() },
        })
      ).toThrow();
    });
  });
});
