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
  GameProtocolErrorCodeSchema,
  GameProtocolErrorMessageSchema,
  AttemptNumberSchema,
  SessionGenerationSchema,
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

  describe("Numeric Correlation Primitives", () => {
    it("validates attemptNumber as positive safe integer across complete matrix", () => {
      expect(AttemptNumberSchema.parse(1)).toBe(1);
      expect(AttemptNumberSchema.parse(100)).toBe(100);
      expect(AttemptNumberSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);

      expect(() => AttemptNumberSchema.parse(Number.MAX_SAFE_INTEGER + 1)).toThrow();
      expect(() => AttemptNumberSchema.parse(0)).toThrow();
      expect(() => AttemptNumberSchema.parse(-1)).toThrow();
      expect(() => AttemptNumberSchema.parse(1.5)).toThrow();
      expect(() => AttemptNumberSchema.parse(Number.NaN)).toThrow();
      expect(() => AttemptNumberSchema.parse(Number.POSITIVE_INFINITY)).toThrow();
      expect(() => AttemptNumberSchema.parse(Number.NEGATIVE_INFINITY)).toThrow();
      expect(() => AttemptNumberSchema.parse("1" as unknown as number)).toThrow();
      expect(() => AttemptNumberSchema.parse(true as unknown as number)).toThrow();
    });

    it("validates sessionGeneration as non-negative safe integer across complete matrix", () => {
      expect(SessionGenerationSchema.parse(0)).toBe(0);
      expect(SessionGenerationSchema.parse(1)).toBe(1);
      expect(SessionGenerationSchema.parse(42)).toBe(42);
      expect(SessionGenerationSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);

      expect(() => SessionGenerationSchema.parse(Number.MAX_SAFE_INTEGER + 1)).toThrow();
      expect(() => SessionGenerationSchema.parse(-1)).toThrow();
      expect(() => SessionGenerationSchema.parse(0.5)).toThrow();
      expect(() => SessionGenerationSchema.parse(Number.NaN)).toThrow();
      expect(() => SessionGenerationSchema.parse(Number.POSITIVE_INFINITY)).toThrow();
      expect(() => SessionGenerationSchema.parse(Number.NEGATIVE_INFINITY)).toThrow();
      expect(() => SessionGenerationSchema.parse("0" as unknown as number)).toThrow();
      expect(() => SessionGenerationSchema.parse(false as unknown as number)).toThrow();
    });

    it("validates durationMs in GameActionCompletedResultSchema across complete matrix", () => {
      const baseCompleted = {
        type: "game.action.result",
        specVersion: "0.1",
        actionId: "act_101",
        attemptNumber: 1,
        sessionGeneration: 1,
        status: "completed",
      };

      expect(
        GameActionCompletedResultSchema.parse({
          ...baseCompleted,
          durationMs: 0,
        }).durationMs
      ).toBe(0);

      expect(
        GameActionCompletedResultSchema.parse({
          ...baseCompleted,
          durationMs: Number.MAX_SAFE_INTEGER,
        }).durationMs
      ).toBe(Number.MAX_SAFE_INTEGER);

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseCompleted,
          durationMs: Number.MAX_SAFE_INTEGER + 1,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({ ...baseCompleted, durationMs: -1 })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({ ...baseCompleted, durationMs: 100.5 })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseCompleted,
          durationMs: Number.NaN,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseCompleted,
          durationMs: Number.POSITIVE_INFINITY,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseCompleted,
          durationMs: Number.NEGATIVE_INFINITY,
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseCompleted,
          durationMs: "150" as unknown as number,
        })
      ).toThrow();
    });

    it("validates heartbeatIntervalMs in GameRegisteredMessageSchema across complete matrix", () => {
      const baseReg = {
        type: "game.registered",
        specVersion: "0.1",
        clientId: "cli_100",
        gameId: "zombie-survival",
        gameInstanceId: "inst_999",
        sessionGeneration: 1,
      };

      expect(
        GameRegisteredMessageSchema.parse({
          ...baseReg,
          heartbeatIntervalMs: Number.MAX_SAFE_INTEGER,
        }).heartbeatIntervalMs
      ).toBe(Number.MAX_SAFE_INTEGER);

      expect(() =>
        GameRegisteredMessageSchema.parse({
          ...baseReg,
          heartbeatIntervalMs: Number.MAX_SAFE_INTEGER + 1,
        })
      ).toThrow();

      expect(() =>
        GameRegisteredMessageSchema.parse({ ...baseReg, heartbeatIntervalMs: 0 })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({ ...baseReg, heartbeatIntervalMs: -100 })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({ ...baseReg, heartbeatIntervalMs: 100.5 })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({ ...baseReg, heartbeatIntervalMs: Number.NaN })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          ...baseReg,
          heartbeatIntervalMs: Number.POSITIVE_INFINITY,
        })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          ...baseReg,
          heartbeatIntervalMs: Number.NEGATIVE_INFINITY,
        })
      ).toThrow();
      expect(() =>
        GameRegisteredMessageSchema.parse({
          ...baseReg,
          heartbeatIntervalMs: "1000" as unknown as number,
        })
      ).toThrow();
    });
  });

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
    it("parses valid game.register message without token", () => {
      const msg = {
        type: "game.register",
        specVersion: "0.1",
        gameId: "zombie-survival",
        instanceId: "inst_999",
        sdkVersion: "0.1.0",
      };
      expect(GameRegisterMessageSchema.parse(msg)).toEqual(msg);
    });

    it("strictly rejects game.register message containing a token field", () => {
      const msgWithToken = {
        type: "game.register",
        specVersion: "0.1",
        gameId: "zombie-survival",
        instanceId: "inst_999",
        sdkVersion: "0.1.0",
        token: "opaque-token-123",
      };
      expect(() => GameRegisterMessageSchema.parse(msgWithToken)).toThrow();
    });

    it("rejects game.register with empty string fields or missing specVersion", () => {
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          specVersion: "0.1",
          gameId: "",
          instanceId: "inst",
          sdkVersion: "0.1",
        })
      ).toThrow();
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          specVersion: "0.1",
          gameId: "g",
          instanceId: "",
          sdkVersion: "0.1",
        })
      ).toThrow();
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          specVersion: "0.1",
          gameId: "g",
          instanceId: "inst",
          sdkVersion: "",
        })
      ).toThrow();
      expect(() =>
        GameRegisterMessageSchema.parse({
          type: "game.register",
          specVersion: "0.2",
          gameId: "g",
          instanceId: "inst",
          sdkVersion: "0.1",
        })
      ).toThrow();
    });

    it("parses valid game.registered message with all required fields", () => {
      const msg = {
        type: "game.registered",
        specVersion: "0.1",
        clientId: "cli_100",
        gameId: "zombie-survival",
        gameInstanceId: "inst_999",
        sessionGeneration: 1,
        heartbeatIntervalMs: 5000,
      };
      expect(GameRegisteredMessageSchema.parse(msg)).toEqual(msg);
    });

    it("rejects game.registered with missing fields, negative sessionGeneration, or invalid heartbeatIntervalMs", () => {
      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          specVersion: "0.1",
          clientId: "cli_100",
          gameId: "zombie-survival",
          gameInstanceId: "inst_999",
          sessionGeneration: -1,
          heartbeatIntervalMs: 5000,
        })
      ).toThrow();

      expect(() =>
        GameRegisteredMessageSchema.parse({
          type: "game.registered",
          specVersion: "0.1",
          clientId: "cli_100",
          gameId: "zombie-survival",
          gameInstanceId: "inst_999",
          sessionGeneration: 1,
          heartbeatIntervalMs: 0,
        })
      ).toThrow();
    });

    it("parses valid minimal game.heartbeat message with specVersion", () => {
      const msg = { type: "game.heartbeat", specVersion: "0.1" };
      expect(GameHeartbeatMessageSchema.parse(msg)).toEqual(msg);
    });

    it("rejects missing specVersion, extra keys, or wrong type on game.heartbeat", () => {
      expect(() => GameHeartbeatMessageSchema.parse({})).toThrow();
      expect(() =>
        GameHeartbeatMessageSchema.parse({
          type: "game.heartbeat",
          specVersion: "0.1",
          timestamp: 12345,
        })
      ).toThrow();
      expect(() =>
        GameHeartbeatMessageSchema.parse({
          type: "game.ping",
          specVersion: "0.1",
        })
      ).toThrow();
    });
  });

  describe("Action Delivery and Receipt Messages", () => {
    it("parses valid game.action delivery message with attemptNumber and sessionGeneration", () => {
      const delivery = {
        type: "game.action",
        specVersion: "0.1",
        attemptNumber: 1,
        sessionGeneration: 1,
        data: validEnvelope,
      };
      expect(GameActionDeliveryMessageSchema.parse(delivery)).toEqual(delivery);
    });

    it("rejects extra keys on game.action delivery message (strict)", () => {
      expect(() =>
        GameActionDeliveryMessageSchema.parse({
          type: "game.action",
          specVersion: "0.1",
          attemptNumber: 1,
          sessionGeneration: 1,
          data: validEnvelope,
          extraField: "bad",
        })
      ).toThrow();
    });

    it("rejects game.action with missing attemptNumber/sessionGeneration or non-positive attemptNumber", () => {
      expect(() =>
        GameActionDeliveryMessageSchema.parse({
          type: "game.action",
          specVersion: "0.1",
          attemptNumber: 0,
          sessionGeneration: 1,
          data: validEnvelope,
        })
      ).toThrow();

      expect(() =>
        GameActionDeliveryMessageSchema.parse({
          type: "game.action",
          specVersion: "0.1",
          attemptNumber: 1,
          sessionGeneration: -1,
          data: validEnvelope,
        })
      ).toThrow();

      expect(() =>
        GameActionDeliveryMessageSchema.parse({
          type: "game.action",
          specVersion: "0.1",
          data: validEnvelope,
        })
      ).toThrow();
    });

    it("parses valid game.action.received receipt message", () => {
      const receipt = {
        type: "game.action.received",
        specVersion: "0.1",
        actionId: "act_101",
        attemptNumber: 1,
        sessionGeneration: 1,
        receivedAt: "2026-07-23T04:00:00.250Z",
      };
      expect(GameActionReceivedMessageSchema.parse(receipt)).toEqual(receipt);
    });

    it("rejects receipt with missing correlation fields or zero attemptNumber", () => {
      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          specVersion: "0.1",
          actionId: "act_101",
          attemptNumber: 0,
          sessionGeneration: 1,
          receivedAt: "2026-07-23T04:00:00.250Z",
        })
      ).toThrow();

      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          specVersion: "0.1",
          actionId: "act_101",
          receivedAt: "2026-07-23T04:00:00.250Z",
        })
      ).toThrow();
    });

    it("rejects extra keys on game.action.received receipt message (strict)", () => {
      expect(() =>
        GameActionReceivedMessageSchema.parse({
          type: "game.action.received",
          specVersion: "0.1",
          actionId: "act_101",
          attemptNumber: 1,
          sessionGeneration: 1,
          receivedAt: "2026-07-23T04:00:00.250Z",
          extraField: "bad",
        })
      ).toThrow();
    });
  });

  describe("Action Result Union (completed / failed)", () => {
    it("parses valid completed result with specVersion, attemptNumber, sessionGeneration", () => {
      const completed = {
        type: "game.action.result",
        specVersion: "0.1",
        actionId: "act_101",
        attemptNumber: 1,
        sessionGeneration: 1,
        status: "completed",
        durationMs: 150,
        details: { spawnedEntities: 5 },
      };
      expect(GameActionCompletedResultSchema.parse(completed)).toEqual(completed);
    });

    it("parses valid failed result with specVersion, attemptNumber, sessionGeneration", () => {
      const failed = {
        type: "game.action.result",
        specVersion: "0.1",
        actionId: "act_101",
        attemptNumber: 1,
        sessionGeneration: 1,
        status: "failed",
        error: {
          code: "ENTITY_CAP_REACHED",
          message: "Maximum zombies spawned",
          retryable: false,
        },
      };
      expect(GameActionFailedResultSchema.parse(failed)).toEqual(failed);
    });

    it("parses and discriminates result union correctly", () => {
      const completedInput = {
        type: "game.action.result",
        specVersion: "0.1",
        actionId: "act_101",
        attemptNumber: 1,
        sessionGeneration: 1,
        status: "completed",
        durationMs: 250,
      };

      const failedInput = {
        type: "game.action.result",
        specVersion: "0.1",
        actionId: "act_102",
        attemptNumber: 1,
        sessionGeneration: 1,
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
          specVersion: "0.1",
          actionId: "act_101",
          attemptNumber: 1,
          sessionGeneration: 1,
          status: "pending",
        })
      ).toThrow();
    });

    it("rejects non-JSON details on completed result (undefined, BigInt, Symbol, function, Date, Map, Set, NaN, Infinities, Class)", () => {
      const baseResult = {
        type: "game.action.result",
        specVersion: "0.1",
        actionId: "act_101",
        attemptNumber: 1,
        sessionGeneration: 1,
        status: "completed",
        durationMs: 100,
      };

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: undefined },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: [undefined] },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: BigInt(10) },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: Symbol("test") },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: () => 123 },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: new Date() },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: new Map() },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: new Set() },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: Number.NaN },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: Number.POSITIVE_INFINITY },
        })
      ).toThrow();

      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: Number.NEGATIVE_INFINITY },
        })
      ).toThrow();

      class CustomClass {}
      expect(() =>
        GameActionCompletedResultSchema.parse({
          ...baseResult,
          details: { bad: new CustomClass() },
        })
      ).toThrow();
    });

    it("rejects extra keys on game.action.result completed result (strict)", () => {
      expect(() =>
        GameActionCompletedResultSchema.parse({
          type: "game.action.result",
          specVersion: "0.1",
          actionId: "act_101",
          attemptNumber: 1,
          sessionGeneration: 1,
          status: "completed",
          durationMs: 150,
          extraField: "bad",
        })
      ).toThrow();
    });

    it("rejects extra keys on game.action.result failed result (strict)", () => {
      expect(() =>
        GameActionFailedResultSchema.parse({
          type: "game.action.result",
          specVersion: "0.1",
          actionId: "act_101",
          attemptNumber: 1,
          sessionGeneration: 1,
          status: "failed",
          error: {
            code: "ENTITY_CAP_REACHED",
            message: "Maximum zombies spawned",
            retryable: false,
          },
          extraField: "bad",
        })
      ).toThrow();
    });

    it("rejects result messages missing attemptNumber or sessionGeneration", () => {
      expect(() =>
        GameActionResultMessageSchema.parse({
          type: "game.action.result",
          specVersion: "0.1",
          actionId: "act_101",
          status: "completed",
          durationMs: 100,
        })
      ).toThrow();
    });
  });

  describe("Stable Wire Protocol Error Messages (game.error)", () => {
    const acceptedCodes = [
      "AUTH_REQUIRED",
      "AUTH_INVALID",
      "AUTH_EXPIRED",
      "AUTH_REVOKED",
      "AUTH_FORBIDDEN",
      "QUERY_TOKEN_FORBIDDEN",
      "ORIGIN_FORBIDDEN",
      "REGISTRATION_REQUIRED",
      "REGISTRATION_TIMEOUT",
      "INVALID_REGISTRATION",
      "UNSUPPORTED_PROTOCOL",
      "UNSUPPORTED_SDK",
      "GAME_NOT_FOUND",
      "ALREADY_REGISTERED",
      "INSTANCE_OWNED_BY_OTHER_CLIENT",
      "SESSION_CAPACITY",
      "INVALID_MESSAGE",
      "RATE_LIMITED",
      "SESSION_STALE",
      "SESSION_REPLACED",
      "ACTION_NOT_FOUND",
      "ACTION_BINDING_MISMATCH",
      "ATTEMPT_NOT_FOUND",
      "ACTION_NOT_ACCEPTING_RECEIPT",
      "ACTION_NOT_ACCEPTING_RESULT",
      "RESULT_CONFLICT",
      "INTERNAL_ERROR",
    ] as const;

    it("validates GameActionErrorSchema strict shape", () => {
      const err = { code: "ERR", message: "msg", retryable: false };
      expect(GameActionErrorSchema.parse(err)).toEqual(err);
      expect(() => GameActionErrorSchema.parse({ code: "ERR" })).toThrow();
    });

    it("parses every accepted protocol error code in GameProtocolErrorCodeSchema", () => {
      for (const code of acceptedCodes) {
        expect(GameProtocolErrorCodeSchema.parse(code)).toBe(code);
      }
      expect(acceptedCodes).toHaveLength(27);
    });

    it("parses valid game.error message with actionId", () => {
      const err = {
        type: "game.error",
        specVersion: "0.1",
        code: "ACTION_NOT_ACCEPTING_RESULT",
        retryable: false,
        correlationId: "corr_123",
        actionId: "act_101",
      };
      expect(GameProtocolErrorMessageSchema.parse(err)).toEqual(err);
    });

    it("parses valid game.error message without actionId", () => {
      const err = {
        type: "game.error",
        specVersion: "0.1",
        code: "AUTH_INVALID",
        retryable: false,
        correlationId: "corr_456",
      };
      expect(GameProtocolErrorMessageSchema.parse(err)).toEqual(err);
    });

    it("rejects unknown error codes or forbidden raw fields (stack, message, token, rawError, details, socketId)", () => {
      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "UNKNOWN_ERR_CODE",
          retryable: false,
          correlationId: "corr_1",
        })
      ).toThrow();

      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "INTERNAL_ERROR",
          retryable: false,
          correlationId: "corr_1",
          stack: "Error: raw stack trace",
        })
      ).toThrow();

      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "AUTH_INVALID",
          retryable: false,
          correlationId: "corr_1",
          token: "secret",
        })
      ).toThrow();

      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "AUTH_INVALID",
          retryable: false,
          correlationId: "corr_1",
          message: "raw error message",
        })
      ).toThrow();

      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "AUTH_INVALID",
          retryable: false,
          correlationId: "corr_1",
          details: { secret: true },
        })
      ).toThrow();

      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "AUTH_INVALID",
          retryable: false,
          correlationId: "corr_1",
          socketId: "soc_123",
        })
      ).toThrow();
    });

    it("rejects game.error with empty or missing correlationId/actionId", () => {
      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "AUTH_INVALID",
          retryable: false,
          correlationId: "",
        })
      ).toThrow();

      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "AUTH_INVALID",
          retryable: false,
        })
      ).toThrow();

      expect(() =>
        GameProtocolErrorMessageSchema.parse({
          type: "game.error",
          specVersion: "0.1",
          code: "AUTH_INVALID",
          retryable: false,
          correlationId: "corr_1",
          actionId: "",
        })
      ).toThrow();
    });
  });
});
