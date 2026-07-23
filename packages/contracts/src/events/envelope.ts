import { z } from "zod";
import {
  EventMetadataSchema,
  EventSourceSchema,
  IsoDateTimeSchema,
  RoomRefSchema,
  SpecVersionSchema,
  UserRefSchema,
  type EventMetadata,
  type EventSource,
  type IsoDateTime,
  type RoomRef,
  type SpecVersion,
  type UserRef,
} from "../common/index.js";

/**
 * Extensible event type primitive schema.
 * Represents a non-empty string identifier for normalized event types.
 */
export const LiveEventTypeSchema = z.string().min(1);
export type LiveEventType = z.infer<typeof LiveEventTypeSchema>;

/**
 * Factory function to create a Zod schema for LiveEventEnvelope with a specific payload and event type schema.
 * Allows downstream tasks (e.g. FOUND-02C) to construct strongly typed event envelopes.
 */
export function createLiveEventEnvelopeSchema<
  TPayloadSchema extends z.ZodTypeAny = z.ZodUnknown,
  TEventTypeSchema extends z.ZodTypeAny = typeof LiveEventTypeSchema,
>(payloadSchema?: TPayloadSchema, eventTypeSchema?: TEventTypeSchema) {
  return z.object({
    specVersion: SpecVersionSchema,
    eventId: z.string().min(1),
    eventType: eventTypeSchema ?? LiveEventTypeSchema,
    source: EventSourceSchema,
    room: RoomRefSchema,
    user: UserRefSchema.nullable(),
    payload: payloadSchema ?? z.unknown(),
    occurredAt: IsoDateTimeSchema,
    receivedAt: IsoDateTimeSchema,
    metadata: EventMetadataSchema,
  });
}

/**
 * Base runtime Zod schema for LiveEventEnvelope with unknown payload.
 */
export const BaseLiveEventEnvelopeSchema = createLiveEventEnvelopeSchema(
  z.unknown(),
  LiveEventTypeSchema,
);

/**
 * Inferred TypeScript generic contract interface for LiveEventEnvelope.
 */
export type LiveEventEnvelope<
  TPayload = unknown,
  TEventType extends string = string,
> = {
  specVersion: SpecVersion;
  eventId: string;
  eventType: TEventType;
  source: EventSource;
  room: RoomRef;
  user: UserRef | null;
  payload: TPayload;
  occurredAt: IsoDateTime;
  receivedAt: IsoDateTime;
  metadata: EventMetadata;
};
