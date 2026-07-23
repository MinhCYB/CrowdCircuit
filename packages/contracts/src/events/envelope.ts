import { z } from "zod";
import {
  EventMetadataSchema,
  EventSourceSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  RoomRefSchema,
  SpecVersionSchema,
  UserRefSchema,
  type JsonValue,
} from "../common/index.js";

/**
 * Extensible event type primitive schema.
 * Represents a non-empty string identifier for normalized event types.
 */
export const LiveEventTypeSchema = z.string().min(1);
export type LiveEventType = z.infer<typeof LiveEventTypeSchema>;

/**
 * Factory function to create a Zod schema for LiveEventEnvelope with a specialized payload and event type schema.
 * Payload schema and event-type schema are required parameters.
 * Event-type schema output type is strictly constrained to string.
 */
export function createLiveEventEnvelopeSchema<
  TPayloadSchema extends z.ZodTypeAny,
  TEventTypeSchema extends z.ZodType<string, z.ZodTypeDef, unknown>,
>(payloadSchema: TPayloadSchema, eventTypeSchema: TEventTypeSchema) {
  return z.object({
    specVersion: SpecVersionSchema,
    eventId: z.string().min(1),
    eventType: eventTypeSchema,
    source: EventSourceSchema,
    room: RoomRefSchema,
    user: UserRefSchema.nullable(),
    payload: payloadSchema,
    occurredAt: IsoDateTimeSchema,
    receivedAt: IsoDateTimeSchema,
    metadata: EventMetadataSchema,
  });
}

/**
 * Base runtime Zod schema for LiveEventEnvelope with JSON-safe payload and string eventType.
 */
export const BaseLiveEventEnvelopeSchema = createLiveEventEnvelopeSchema(
  JsonValueSchema,
  LiveEventTypeSchema,
);

/**
 * Inferred base LiveEventEnvelope type derived directly from the runtime Zod schema.
 */
export type BaseLiveEventEnvelope = z.infer<typeof BaseLiveEventEnvelopeSchema>;

/**
 * Inferred TypeScript generic contract interface for LiveEventEnvelope.
 * Specialized payload and eventType types are layered over the base envelope schema inference.
 */
export type LiveEventEnvelope<
  TPayload = JsonValue,
  TEventType extends string = string,
> = Omit<BaseLiveEventEnvelope, "payload" | "eventType"> & {
  eventType: TEventType;
  payload: TPayload;
};
