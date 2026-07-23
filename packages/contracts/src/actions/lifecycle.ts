import { z } from "zod";
import { IsoDateTimeSchema } from "../common/primitives.js";
import { JsonValueSchema, type JsonValue } from "../common/json.js";
import {
  GameActionEnvelopeSchema,
  type GameActionEnvelope,
} from "./envelope.js";

/**
 * Strict runtime Zod schema for game registration message (game.register).
 * Sent by Game SDK client to register with the Action Gateway.
 */
export const GameRegisterMessageSchema = z
  .object({
    type: z.literal("game.register"),
    gameId: z.string().min(1),
    instanceId: z.string().min(1),
    sdkVersion: z.string().min(1),
    token: z.string().min(1),
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
    heartbeatIntervalMs: z.number().int().positive(),
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
    actionId: z.string().min(1),
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
    actionId: z.string().min(1),
    status: z.literal("completed"),
    durationMs: z.number().int().min(0),
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
    actionId: z.string().min(1),
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
