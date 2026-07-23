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
  type LiveConnectedEvent,
  type SubscriptionCreatedEvent,
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
    const payload: GiftSentPayload = event.payload;
    const giftName: string = payload.gift.name;
    const quantity: number = payload.quantity;
    return `${giftName} x ${quantity}`;
  } else if (event.eventType === "chat.comment") {
    const payload: ChatCommentPayload = event.payload;
    const commentText: string = payload.text;
    return commentText;
  } else if (event.eventType === "engagement.like") {
    const payload: LikePayload = event.payload;
    const delta: number = payload.delta;
    return delta;
  } else {
    const emptyPayload: EmptyPayload = event.payload;
    return emptyPayload;
  }
}

// 3. Strict EmptyPayload compile-time checks
const validEmptyPayload: EmptyPayload = {};

// @ts-expect-error - Invented property rejected on EmptyPayload
const invalidEmptyPayload: EmptyPayload = { inventedField: "bad" };

// 4. Empty-payload specialized event schemas reject invented fields
// @ts-expect-error - Invented field rejected on LiveConnectedEvent payload
const invalidConnectedEventPayload: LiveConnectedEvent["payload"] = { extraToken: "bad" };

// @ts-expect-error - Invented field rejected on SubscriptionCreatedEvent payload
const invalidSubEventPayload: SubscriptionCreatedEvent["payload"] = { rawToken: "bad" };

// 5. Discriminated union empty-payload branch rejects invented fields
const invalidConnectedUnionEvent: LiveEvent = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  // @ts-expect-error - Invented property rejected on empty payload union branch
  payload: { extraConnectorToken: "bad" },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 6. Invalid gift field types fail compile-time checks
const invalidGiftPayloadTypes: GiftSentPayload = {
  gift: {
    id: "rose",
    name: "Rose",
    // @ts-expect-error - imageUrl must be string or null, not number
    imageUrl: 123,
    // @ts-expect-error - diamondValue must be number or null, not string
    diamondValue: "one_hundred",
    streakable: true,
  },
  // @ts-expect-error - quantity must be number, not string
  quantity: "one",
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  estimatedDiamondTotal: null,
};

// 7. Required nullable gift properties cannot be omitted or assigned undefined
const giftOmittedImageUrl: GiftSentPayload = {
  // @ts-expect-error - Omission of required nullable gift.imageUrl fails
  gift: { id: "rose", name: "Rose", diamondValue: 1, streakable: true },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  estimatedDiamondTotal: 1,
};

const giftUndefinedImageUrl: GiftSentPayload = {
  gift: {
    id: "rose",
    name: "Rose",
    // @ts-expect-error - undefined is not assignable to string | null
    imageUrl: undefined,
    diamondValue: 1,
    streakable: true,
  },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  estimatedDiamondTotal: 1,
};

const giftUndefinedStreakId: GiftSentPayload = {
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  quantity: 1,
  totalQuantity: 1,
  // @ts-expect-error - undefined is not assignable to string | null
  streak: { id: undefined, status: "single" },
  estimatedDiamondTotal: 1,
};

const giftUndefinedEstimatedTotal: GiftSentPayload = {
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  // @ts-expect-error - undefined is not assignable to number | null
  estimatedDiamondTotal: undefined,
};

// 8. Valid null assignments for required nullable gift properties compile cleanly
const validNullGiftPayload: GiftSentPayload = {
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: null, streakable: false },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  estimatedDiamondTotal: null,
};

// 9. Invalid comment field types fail compile-time checks
const invalidCommentText: ChatCommentPayload = {
  // @ts-expect-error - text must be string, not number
  text: 123,
  textNormalized: "123",
  mentions: [],
};

const invalidCommentMention: ChatCommentPayload = {
  text: "hi",
  textNormalized: "hi",
  // @ts-expect-error - mentions array element must be string, not number
  mentions: [123],
};

// 10. Invalid like field types fail compile-time checks
const invalidLikeDelta: LikePayload = {
  // @ts-expect-error - delta must be number, not string
  delta: "ten",
  total: null,
  milestone: null,
};

const invalidLikeTotal: LikePayload = {
  delta: 1,
  // @ts-expect-error - total must be number | null, not string
  total: "one_hundred",
  milestone: null,
};

const invalidLikeMilestone: LikePayload = {
  delta: 1,
  total: null,
  // @ts-expect-error - milestone must be number | null, not boolean
  milestone: true,
};

// 11. Required nullable like properties cannot be omitted or assigned undefined
// @ts-expect-error - Omission of required nullable total fails
const likeOmittedTotal: LikePayload = {
  delta: 10,
  milestone: null,
};

const likeUndefinedTotal: LikePayload = {
  delta: 10,
  // @ts-expect-error - undefined is not assignable to number | null
  total: undefined,
  milestone: null,
};

// 12. Payload mismatch is rejected by TypeScript compiler
const invalidCommentPayload: ChatCommentEvent["payload"] = {
  // @ts-expect-error - Gift payload cannot be assigned to ChatCommentEvent payload
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  text: "hello",
  textNormalized: "hello",
  mentions: [],
};

// 13. Mismatched specialized envelope eventType is rejected
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

// 14. EngagementLikeEvent type verification
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

// 15. Base factory and envelope checks still pass
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
  validEmptyPayload,
  invalidEmptyPayload,
  invalidConnectedEventPayload,
  invalidSubEventPayload,
  invalidConnectedUnionEvent,
  invalidGiftPayloadTypes,
  giftOmittedImageUrl,
  giftUndefinedImageUrl,
  giftUndefinedStreakId,
  giftUndefinedEstimatedTotal,
  validNullGiftPayload,
  invalidCommentText,
  invalidCommentMention,
  invalidLikeDelta,
  invalidLikeTotal,
  invalidLikeMilestone,
  likeOmittedTotal,
  likeUndefinedTotal,
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
