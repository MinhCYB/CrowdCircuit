import {
  createLiveEventEnvelopeSchema,
  BaseLiveEventEnvelopeSchema,
  LiveEventEnvelopeSchema,
  GiftSentEventSchema,
  ChatCommentEventSchema,
  EngagementLikeEventSchema,
  LiveConnectedEventSchema,
  LiveDisconnectedEventSchema,
  LiveEndedEventSchema,
  ViewerJoinedEventSchema,
  SocialFollowEventSchema,
  SocialShareEventSchema,
  SubscriptionCreatedEventSchema,
  GiftSentPayloadSchema,
  ChatCommentPayloadSchema,
  LikePayloadSchema,
  EmptyPayloadSchema,
  type BaseLiveEventEnvelope,
  type LiveEventEnvelope,
  type LiveEvent,
  type LiveEventType,
  type GiftSentEvent,
  type ChatCommentEvent,
  type EngagementLikeEvent,
  type GiftSentPayload,
  type ChatCommentPayload,
  type LikePayload,
  type EmptyPayload,
} from "@crowdcircuit/contracts";
import { z } from "zod";

// 1. All 10 event literals are accepted by LiveEventType
const validLiterals: LiveEventType[] = [
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
];

// @ts-expect-error - Unsupported event literal rejected
const invalidLiteral: LiveEventType = "live.paused";

// 2. Discriminated union type narrowing
function processEvent(event: LiveEvent): string | number | EmptyPayload {
  if (event.eventType === "gift.sent") {
    // Narrowed to GiftSentEvent
    const payload: GiftSentPayload = event.payload;
    const giftName: string = payload.gift.name;
    const quantity: number = payload.quantity;
    return `${giftName} x ${quantity}`;
  } else if (event.eventType === "chat.comment") {
    // Narrowed to ChatCommentEvent
    const payload: ChatCommentPayload = event.payload;
    const commentText: string = payload.text;
    return commentText;
  } else if (event.eventType === "engagement.like") {
    // Narrowed to EngagementLikeEvent
    const payload: LikePayload = event.payload;
    const delta: number = payload.delta;
    return delta;
  } else {
    // Lifecycle / social empty payload events
    const emptyPayload: EmptyPayload = event.payload;
    return emptyPayload;
  }
}

// 3. Payload mismatch is rejected by TypeScript compiler
const invalidCommentPayload: ChatCommentEvent["payload"] = {
  // @ts-expect-error - Gift payload cannot be assigned to ChatCommentEvent payload
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  text: "hello",
  textNormalized: "hello",
  mentions: [],
};

// 4. Mismatched specialized envelope eventType is rejected
const invalidGiftEvent: GiftSentEvent = {
  specVersion: "0.1",
  eventId: "evt_1",
  // @ts-expect-error - "chat.comment" cannot be assigned to eventType "gift.sent"
  eventType: "chat.comment",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: {
    gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
    quantity: 1,
    totalQuantity: 1,
    streak: { id: null, status: "single" },
    estimatedDiamondTotal: 1,
  },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 5. EngagementLikeEvent type verification
const likeEvent: EngagementLikeEvent = {
  specVersion: "0.1",
  eventId: "evt_like_1",
  eventType: "engagement.like",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: { delta: 10, total: 100, milestone: null },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 6. Base factory and envelope checks still pass
const SamplePayloadSchema = z.object({
  giftName: z.string(),
  amount: z.number(),
});

const SpecializedEnvelopeSchema = createLiveEventEnvelopeSchema(
  SamplePayloadSchema,
  z.literal("gift.sent")
);

type InferredSpecialized = z.infer<typeof SpecializedEnvelopeSchema>;

const parsedSpecialized = SpecializedEnvelopeSchema.parse({
  specVersion: "0.1",
  eventId: "evt_spec_1",
  eventType: "gift.sent",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: { giftName: "Rose", amount: 10 },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
});

const parsedBase = BaseLiveEventEnvelopeSchema.parse(parsedSpecialized);

const samplePayload: InferredSpecialized["payload"] = {
  giftName: "Rose",
  amount: 10,
};

const sampleEventType: InferredSpecialized["eventType"] = "gift.sent";

const genericEnvelope: LiveEventEnvelope<{ giftName: string; amount: number }, "gift.sent"> = {
  specVersion: "0.1",
  eventId: "evt_1",
  eventType: "gift.sent",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: { giftName: "Rose", amount: 10 },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// @ts-expect-error - z.number() is not a string schema
createLiveEventEnvelopeSchema(SamplePayloadSchema, z.number());

const invalidPayload: InferredSpecialized["payload"] = {
  giftName: "Rose",
  // @ts-expect-error - amount must be a number, not string
  amount: "ten",
};

// @ts-expect-error - payload property is required
const missingPayloadEnvelope: BaseLiveEventEnvelope = {
  specVersion: "0.1",
  eventId: "evt_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

console.log(
  "Declaration consumer type checks passed.",
  validLiterals,
  invalidLiteral,
  processEvent,
  invalidCommentPayload,
  invalidGiftEvent,
  likeEvent,
  samplePayload,
  sampleEventType,
  genericEnvelope,
  invalidPayload,
  missingPayloadEnvelope,
  parsedBase,
  LiveEventEnvelopeSchema,
  GiftSentEventSchema,
  ChatCommentEventSchema,
  EngagementLikeEventSchema,
  LiveConnectedEventSchema,
  LiveDisconnectedEventSchema,
  LiveEndedEventSchema,
  ViewerJoinedEventSchema,
  SocialFollowEventSchema,
  SocialShareEventSchema,
  SubscriptionCreatedEventSchema,
  GiftSentPayloadSchema,
  ChatCommentPayloadSchema,
  LikePayloadSchema,
  EmptyPayloadSchema
);
