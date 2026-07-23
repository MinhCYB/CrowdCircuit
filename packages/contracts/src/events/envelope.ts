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
import {
  ChatCommentPayloadSchema,
  EmptyPayloadSchema,
  GiftSentPayloadSchema,
  LikePayloadSchema,
} from "./payloads.js";

/**
 * Finite enum schema for all supported v0.1 LIVE event types.
 */
export const LiveEventTypeSchema = z.enum([
  "live.connected",
  "live.disconnected",
  "live.ended",
  "viewer.joined",
  "chat.comment",
  "social.follow",
  "social.share",
  "engagement.like",
  "gift.sent",
  "subscription.created",
]);
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

/* Specialized Event Envelope Schemas */

export const LiveConnectedEventSchema = createLiveEventEnvelopeSchema(
  EmptyPayloadSchema,
  z.literal("live.connected")
);
export type LiveConnectedEvent = z.infer<typeof LiveConnectedEventSchema>;

export const LiveDisconnectedEventSchema = createLiveEventEnvelopeSchema(
  EmptyPayloadSchema,
  z.literal("live.disconnected")
);
export type LiveDisconnectedEvent = z.infer<typeof LiveDisconnectedEventSchema>;

export const LiveEndedEventSchema = createLiveEventEnvelopeSchema(
  EmptyPayloadSchema,
  z.literal("live.ended")
);
export type LiveEndedEvent = z.infer<typeof LiveEndedEventSchema>;

export const ViewerJoinedEventSchema = createLiveEventEnvelopeSchema(
  EmptyPayloadSchema,
  z.literal("viewer.joined")
);
export type ViewerJoinedEvent = z.infer<typeof ViewerJoinedEventSchema>;

export const ChatCommentEventSchema = createLiveEventEnvelopeSchema(
  ChatCommentPayloadSchema,
  z.literal("chat.comment")
);
export type ChatCommentEvent = z.infer<typeof ChatCommentEventSchema>;

export const SocialFollowEventSchema = createLiveEventEnvelopeSchema(
  EmptyPayloadSchema,
  z.literal("social.follow")
);
export type SocialFollowEvent = z.infer<typeof SocialFollowEventSchema>;

export const SocialShareEventSchema = createLiveEventEnvelopeSchema(
  EmptyPayloadSchema,
  z.literal("social.share")
);
export type SocialShareEvent = z.infer<typeof SocialShareEventSchema>;

export const EngagementLikeEventSchema = createLiveEventEnvelopeSchema(
  LikePayloadSchema,
  z.literal("engagement.like")
);
export type EngagementLikeEvent = z.infer<typeof EngagementLikeEventSchema>;

export const GiftSentEventSchema = createLiveEventEnvelopeSchema(
  GiftSentPayloadSchema,
  z.literal("gift.sent")
);
export type GiftSentEvent = z.infer<typeof GiftSentEventSchema>;

export const SubscriptionCreatedEventSchema = createLiveEventEnvelopeSchema(
  EmptyPayloadSchema,
  z.literal("subscription.created")
);
export type SubscriptionCreatedEvent = z.infer<typeof SubscriptionCreatedEventSchema>;

/**
 * Discriminated union schema for all normalized v0.1 LIVE event envelopes.
 * Discriminates on the `eventType` property.
 */
export const LiveEventEnvelopeSchema = z.discriminatedUnion("eventType", [
  LiveConnectedEventSchema,
  LiveDisconnectedEventSchema,
  LiveEndedEventSchema,
  ViewerJoinedEventSchema,
  ChatCommentEventSchema,
  SocialFollowEventSchema,
  SocialShareEventSchema,
  EngagementLikeEventSchema,
  GiftSentEventSchema,
  SubscriptionCreatedEventSchema,
]);

/**
 * Inferred union type for all normalized v0.1 LIVE event envelopes.
 */
export type LiveEvent = z.infer<typeof LiveEventEnvelopeSchema>;
