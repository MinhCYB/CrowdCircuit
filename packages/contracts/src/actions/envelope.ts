import { z } from "zod";
import { SpecVersionSchema, IsoDateTimeSchema } from "../common/primitives.js";
import { JsonValueSchema, type JsonValue } from "../common/json.js";

/**
 * Strict runtime Zod schema for GameActionEnvelope actor reference.
 * Identifies the viewer triggering the action if available.
 */
export const GameActionActorSchema = z
  .object({
    viewerId: z.string().min(1).nullable(),
    displayName: z.string().min(1),
    avatarUrl: z.string().url().nullable(),
  })
  .strict();

export type GameActionActor = z.infer<typeof GameActionActorSchema>;

/**
 * Strict runtime Zod schema for GameActionEnvelope trigger reference.
 * Traceability metadata linking the action back to the originating live event and mapping rule.
 */
export const GameActionTriggerSchema = z
  .object({
    eventId: z.string().min(1),
    eventType: z.string().min(1),
    mappingId: z.string().min(1),
  })
  .strict();

export type GameActionTrigger = z.infer<typeof GameActionTriggerSchema>;

/**
 * Strict runtime Zod schema for GameActionEnvelope.
 * Versioned, runtime-validated contract for game action delivery from CrowdCircuit to games.
 */
export const GameActionEnvelopeSchema = z
  .object({
    specVersion: SpecVersionSchema,
    actionId: z.string().min(1),
    actionType: z.string().min(1),
    gameId: z.string().min(1),
    gameInstanceId: z.string().min(1).nullable(),
    params: JsonValueSchema,
    actor: GameActionActorSchema.nullable(),
    trigger: GameActionTriggerSchema,
    priority: z.number().int(),
    ttlMs: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

/**
 * Inferred base type derived directly from GameActionEnvelopeSchema.
 */
export type BaseGameActionEnvelope = z.infer<typeof GameActionEnvelopeSchema>;

/**
 * Inferred generic public interface for GameActionEnvelope.
 * Allows strongly typed custom params while strictly constraining params to JSON-safe values.
 */
export type GameActionEnvelope<TParams extends JsonValue = JsonValue> = Omit<
  BaseGameActionEnvelope,
  "params"
> & {
  params: TParams;
};
