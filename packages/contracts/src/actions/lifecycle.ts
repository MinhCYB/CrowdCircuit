import { z } from "zod";
import { IsoDateTimeSchema, SpecVersionSchema } from "../common/primitives.js";
import { JsonValueSchema, type JsonValue } from "../common/json.js";
import {
  GameActionEnvelopeSchema,
  type GameActionEnvelope,
} from "./envelope.js";

/**
 * Shared numeric primitive schema for action delivery attempt count.
 * Safe integer, strictly positive.
 */
export const AttemptNumberSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export type AttemptNumber = z.infer<typeof AttemptNumberSchema>;

/**
 * Shared numeric primitive schema for game-session connection generation count.
 * Safe integer, non-negative (starts at 0).
 */
export const SessionGenerationSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
export type SessionGeneration = z.infer<typeof SessionGenerationSchema>;

/**
 * Strict runtime Zod schema for game registration message (game.register).
 * Sent by Game SDK client to register with the Action Gateway.
 * Note: Handshake authentication is handled out-of-band via Socket.IO auth; token field is removed.
 */
export const GameRegisterMessageSchema = z
  .object({
    type: z.literal("game.register"),
    specVersion: SpecVersionSchema,
    gameId: z.string().min(1),
    instanceId: z.string().min(1),
    sdkVersion: z.string().min(1),
  })
  .strict();

export type GameRegisterMessage = z.infer<typeof GameRegisterMessageSchema>;

/**
 * Strict runtime Zod schema for game registered response (game.registered).
 * Sent by Action Gateway upon successful client registration.
 */
export const GameRegisteredMessageSchema = z
  .object({
    type: z.literal("game.registered"),
    specVersion: SpecVersionSchema,
    clientId: z.string().min(1),
    gameId: z.string().min(1),
    gameInstanceId: z.string().min(1),
    sessionGeneration: SessionGenerationSchema,
    heartbeatIntervalMs: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export type GameRegisteredMessage = z.infer<typeof GameRegisteredMessageSchema>;

/**
 * Strict runtime Zod schema for minimal game heartbeat message (game.heartbeat).
 * Minimal ping/pong frame for connection liveness.
 */
export const GameHeartbeatMessageSchema = z
  .object({
    type: z.literal("game.heartbeat"),
    specVersion: SpecVersionSchema,
  })
  .strict();

export type GameHeartbeatMessage = z.infer<typeof GameHeartbeatMessageSchema>;

/**
 * Strict runtime Zod schema for action delivery message wrapper (game.action).
 * Wraps a GameActionEnvelope for transmission over WebSocket protocol.
 */
export const GameActionDeliveryMessageSchema = z
  .object({
    type: z.literal("game.action"),
    specVersion: SpecVersionSchema,
    attemptNumber: AttemptNumberSchema,
    sessionGeneration: SessionGenerationSchema,
    data: GameActionEnvelopeSchema,
  })
  .strict();

export const GameActionMessageSchema = GameActionDeliveryMessageSchema;

export type BaseGameActionDeliveryMessage = z.infer<
  typeof GameActionDeliveryMessageSchema
>;
export type BaseGameActionMessage = BaseGameActionDeliveryMessage;

export type GameActionDeliveryMessage<TParams extends JsonValue = JsonValue> = Omit<
  BaseGameActionDeliveryMessage,
  "data"
> & {
  data: GameActionEnvelope<TParams>;
};
export type GameActionMessage<TParams extends JsonValue = JsonValue> =
  GameActionDeliveryMessage<TParams>;

/**
 * Strict runtime Zod schema for action receipt message (game.action.received).
 * Sent by Game SDK immediately after validating and enqueuing an action locally.
 * Delivery receipt ACK is strictly separated from gameplay completion.
 */
export const GameActionReceivedMessageSchema = z
  .object({
    type: z.literal("game.action.received"),
    specVersion: SpecVersionSchema,
    actionId: z.string().min(1),
    attemptNumber: AttemptNumberSchema,
    sessionGeneration: SessionGenerationSchema,
    receivedAt: IsoDateTimeSchema,
  })
  .strict();

export type GameActionReceivedMessage = z.infer<
  typeof GameActionReceivedMessageSchema
>;

/**
 * Strict runtime Zod schema for game action error object.
 */
export const GameActionErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  })
  .strict();

export type GameActionError = z.infer<typeof GameActionErrorSchema>;

/**
 * Strict runtime Zod schema for completed action result.
 */
export const GameActionCompletedResultSchema = z
  .object({
    type: z.literal("game.action.result"),
    specVersion: SpecVersionSchema,
    actionId: z.string().min(1),
    attemptNumber: AttemptNumberSchema,
    sessionGeneration: SessionGenerationSchema,
    status: z.literal("completed"),
    durationMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    details: JsonValueSchema.optional(),
  })
  .strict();

export type GameActionCompletedResult = z.infer<
  typeof GameActionCompletedResultSchema
>;

/**
 * Strict runtime Zod schema for failed action result.
 */
export const GameActionFailedResultSchema = z
  .object({
    type: z.literal("game.action.result"),
    specVersion: SpecVersionSchema,
    actionId: z.string().min(1),
    attemptNumber: AttemptNumberSchema,
    sessionGeneration: SessionGenerationSchema,
    status: z.literal("failed"),
    error: GameActionErrorSchema,
  })
  .strict();

export type GameActionFailedResult = z.infer<typeof GameActionFailedResultSchema>;

/**
 * Discriminated union Zod schema for game.action.result messages.
 * Discriminated on the status property ("completed" | "failed").
 */
export const GameActionResultMessageSchema = z.discriminatedUnion("status", [
  GameActionCompletedResultSchema,
  GameActionFailedResultSchema,
]);

export const GameActionResultSchema = GameActionResultMessageSchema;

export type GameActionResultMessage = z.infer<typeof GameActionResultMessageSchema>;
export type GameActionResult = GameActionResultMessage;

/**
 * Enumerated Zod schema for stable wire protocol error codes.
 */
export const GameProtocolErrorCodeSchema = z.enum([
  // Connection / Authentication
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "AUTH_EXPIRED",
  "AUTH_REVOKED",
  "AUTH_FORBIDDEN",
  "QUERY_TOKEN_FORBIDDEN",
  "ORIGIN_FORBIDDEN",

  // Registration
  "REGISTRATION_REQUIRED",
  "REGISTRATION_TIMEOUT",
  "INVALID_REGISTRATION",
  "UNSUPPORTED_PROTOCOL",
  "UNSUPPORTED_SDK",
  "GAME_NOT_FOUND",
  "ALREADY_REGISTERED",
  "INSTANCE_OWNED_BY_OTHER_CLIENT",
  "SESSION_CAPACITY",

  // Message / Lifecycle
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
]);

export type GameProtocolErrorCode = z.infer<typeof GameProtocolErrorCodeSchema>;

/**
 * Strict runtime Zod schema for protocol error response message (game.error).
 */
export const GameProtocolErrorMessageSchema = z
  .object({
    type: z.literal("game.error"),
    specVersion: SpecVersionSchema,
    code: GameProtocolErrorCodeSchema,
    retryable: z.boolean(),
    correlationId: z.string().min(1),
    actionId: z.string().min(1).optional(),
  })
  .strict();

export type GameProtocolErrorMessage = z.infer<
  typeof GameProtocolErrorMessageSchema
>;

/**
 * Transport-neutral event map for client-to-server game messages.
 */
export interface ClientToServerEvents {
  "game.register": GameRegisterMessage;
  "game.heartbeat": GameHeartbeatMessage;
  "game.action.received": GameActionReceivedMessage;
  "game.action.result": GameActionResultMessage;
}

/**
 * Transport-neutral event map for server-to-client game messages.
 */
export interface ServerToClientEvents {
  "game.registered": GameRegisteredMessage;
  "game.action": BaseGameActionDeliveryMessage;
  "game.error": GameProtocolErrorMessage;
}
