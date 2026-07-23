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
  GameActionEnvelopeSchema,
  GameActionActorSchema,
  GameActionTriggerSchema,
  GameRegisterMessageSchema,
  GameRegisteredMessageSchema,
  GameHeartbeatMessageSchema,
  GameActionDeliveryMessageSchema,
  GameActionMessageSchema,
  GameActionReceivedMessageSchema,
  GameActionCompletedResultSchema,
  GameActionFailedResultSchema,
  GameActionResultMessageSchema,
  GameActionResultSchema,
  GameActionErrorSchema,
  VoiceIntentSchema,
  VoiceIntentKindSchema,
  VoiceInterruptPolicySchema,
  VoicePlayMessageSchema,
  VoicePlaybackStartedMessageSchema,
  VoicePlaybackFinishedMessageSchema,
  VoicePlaybackInterruptedMessageSchema,
  VoicePlaybackFailedMessageSchema,
  VoicePlaybackCallbackMessageSchema,
  VoicePlaybackMessageSchema,
  VoicePlaybackErrorSchema,
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
  type GameActionEnvelope,
  type BaseGameActionEnvelope,
  type GameActionActor,
  type GameActionTrigger,
  type GameRegisterMessage,
  type GameRegisteredMessage,
  type GameHeartbeatMessage,
  type GameActionDeliveryMessage,
  type GameActionMessage,
  type GameActionReceivedMessage,
  type GameActionCompletedResult,
  type GameActionFailedResult,
  type GameActionResultMessage,
  type GameActionResult,
  type GameActionError,
  type VoiceIntent,
  type VoiceIntentKind,
  type VoiceIntentVariables,
  type VoiceInterruptPolicy,
  type VoicePlayMessage,
  type VoicePlaybackStartedMessage,
  type VoicePlaybackFinishedMessage,
  type VoicePlaybackInterruptedMessage,
  type VoicePlaybackFailedMessage,
  type VoicePlaybackCallbackMessage,
  type VoicePlaybackMessage,
  type VoicePlaybackError,
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

// 3. Strict EmptyPayload compile-time input & output checks
type EmptyInput = z.input<typeof EmptyPayloadSchema>;
type EmptyOutput = z.output<typeof EmptyPayloadSchema>;

const validEmptyInput: EmptyInput = {};
const validEmptyOutput: EmptyOutput = {};

// @ts-expect-error - Invented property rejected on EmptyPayload input
const invalidEmptyInput: EmptyInput = { foo: 1 };

// @ts-expect-error - Invented property rejected on EmptyPayload output
const invalidEmptyOutput: EmptyOutput = { foo: 1 };

// 4. Empty-payload specialized envelope input checks
type LiveConnectedInput = z.input<typeof LiveConnectedEventSchema>;
type SubscriptionCreatedInput = z.input<typeof SubscriptionCreatedEventSchema>;

const validConnectedInput: LiveConnectedInput = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: {},
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// @ts-expect-error - Omission of required payload on LiveConnectedEventSchema input fails
const missingConnectedInputPayload: LiveConnectedInput = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const invalidConnectedInputPayloadKey: LiveConnectedInput = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  // @ts-expect-error - Invented property on LiveConnectedEventSchema input payload fails
  payload: { extraToken: "bad" },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const validSubInput: SubscriptionCreatedInput = {
  specVersion: "0.1",
  eventId: "evt_sub_1",
  eventType: "subscription.created",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: {},
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// @ts-expect-error - Omission of required payload on SubscriptionCreatedEventSchema input fails
const missingSubInputPayload: SubscriptionCreatedInput = {
  specVersion: "0.1",
  eventId: "evt_sub_1",
  eventType: "subscription.created",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const invalidSubInputPayloadKey: SubscriptionCreatedInput = {
  specVersion: "0.1",
  eventId: "evt_sub_1",
  eventType: "subscription.created",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  // @ts-expect-error - Invented property on SubscriptionCreatedEventSchema input payload fails
  payload: { rawToken: "bad" },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 5. Empty-payload specialized envelope output checks
type LiveConnectedOutput = z.output<typeof LiveConnectedEventSchema>;
type SubscriptionCreatedOutput = z.output<typeof SubscriptionCreatedEventSchema>;

const validConnectedOutput: LiveConnectedOutput = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: {},
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const invalidConnectedOutputPayloadKey: LiveConnectedOutput = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  // @ts-expect-error - Invented property on LiveConnectedEventSchema output payload fails
  payload: { extraToken: "bad" },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const validSubOutput: SubscriptionCreatedOutput = {
  specVersion: "0.1",
  eventId: "evt_sub_1",
  eventType: "subscription.created",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: {},
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const invalidSubOutputPayloadKey: SubscriptionCreatedOutput = {
  specVersion: "0.1",
  eventId: "evt_sub_1",
  eventType: "subscription.created",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  // @ts-expect-error - Invented property on SubscriptionCreatedEventSchema output payload fails
  payload: { rawToken: "bad" },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 6. Union input and output check
type LiveEventInput = z.input<typeof LiveEventEnvelopeSchema>;
type LiveEventOutput = z.output<typeof LiveEventEnvelopeSchema>;

const invalidUnionConnectedInput: LiveEventInput = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  // @ts-expect-error - Invented property on LiveEventEnvelopeSchema input union branch fails
  payload: { extraConnectorToken: "bad" },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const invalidUnionConnectedOutput: LiveEventOutput = {
  specVersion: "0.1",
  eventId: "evt_conn_1",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  // @ts-expect-error - Invented property on LiveEventEnvelopeSchema output union branch fails
  payload: { extraConnectorToken: "bad" },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 7. Invalid gift field types fail compile-time checks
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

// 8. Required nullable gift properties cannot be omitted or assigned undefined
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

const giftOmittedDiamondValue: GiftSentPayload = {
  // @ts-expect-error - Omission of required nullable gift.diamondValue fails
  gift: { id: "rose", name: "Rose", imageUrl: null, streakable: true },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  estimatedDiamondTotal: 1,
};

const giftUndefinedDiamondValue: GiftSentPayload = {
  gift: {
    id: "rose",
    name: "Rose",
    imageUrl: null,
    // @ts-expect-error - undefined is not assignable to number | null
    diamondValue: undefined,
    streakable: true,
  },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  estimatedDiamondTotal: 1,
};

const giftOmittedStreakId: GiftSentPayload = {
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  quantity: 1,
  totalQuantity: 1,
  // @ts-expect-error - Omission of required nullable streak.id fails
  streak: { status: "single" },
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

// @ts-expect-error - Omission of required nullable estimatedDiamondTotal fails
const giftOmittedEstimatedTotal: GiftSentPayload = {
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
};

const giftUndefinedEstimatedTotal: GiftSentPayload = {
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  // @ts-expect-error - undefined is not assignable to number | null
  estimatedDiamondTotal: undefined,
};

// 9. Valid null assignments for required nullable gift properties compile cleanly
const validNullGiftPayload: GiftSentPayload = {
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: null, streakable: false },
  quantity: 1,
  totalQuantity: 1,
  streak: { id: null, status: "single" },
  estimatedDiamondTotal: null,
};

// 10. Invalid comment field types fail compile-time checks
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

// 11. Invalid like field types fail compile-time checks
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

// 12. Required nullable like properties cannot be omitted or assigned undefined
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

// @ts-expect-error - Omission of required nullable milestone fails
const likeOmittedMilestone: LikePayload = {
  delta: 10,
  total: 100,
};

const likeUndefinedMilestone: LikePayload = {
  delta: 10,
  total: 100,
  // @ts-expect-error - undefined is not assignable to number | null
  milestone: undefined,
};

// 13. Specialized envelope interface type usages
const connEventSample: LiveConnectedEvent = {
  specVersion: "0.1",
  eventId: "evt_conn_sample",
  eventType: "live.connected",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: {},
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

const subEventSample: SubscriptionCreatedEvent = {
  specVersion: "0.1",
  eventId: "evt_sub_sample",
  eventType: "subscription.created",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: {},
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 14. Payload mismatch is rejected by TypeScript compiler
const invalidCommentPayload: ChatCommentEvent["payload"] = {
  // @ts-expect-error - Gift payload cannot be assigned to ChatCommentEvent payload
  gift: { id: "rose", name: "Rose", imageUrl: null, diamondValue: 1, streakable: true },
  text: "hello",
  textNormalized: "hello",
  mentions: [],
};

// 15. Mismatched specialized envelope eventType is rejected
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

// 16. EngagementLikeEvent type verification
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

// 17. Base factory and envelope checks (RESTORED LIVE DECLARATION REGRESSIONS)
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

// RESTORED REGRESSION CHECK 1: createLiveEventEnvelopeSchema rejects non-string eventType schema
// @ts-expect-error - z.number() is not a string schema for eventType
createLiveEventEnvelopeSchema(SamplePayloadSchema, z.number());

// RESTORED REGRESSION CHECK 2: Invalid generic specialized LIVE event payload assignment fails
const invalidPayload: InferredSpecialized["payload"] = {
  giftName: "Rose",
  // @ts-expect-error - amount must be a number, not string
  amount: "ten",
};

// RESTORED REGRESSION CHECK 3: BaseLiveEventEnvelope rejects missing payload
// @ts-expect-error - payload property is required on BaseLiveEventEnvelope
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

// ============================================================================
// FOUND-02D Action Contracts Declaration Verification
// ============================================================================

// 18. GameActionEnvelope declaration type checks
const baseLiveEnvSample: BaseLiveEventEnvelope = connEventSample;

const validActionEnvelope: GameActionEnvelope<{ spawnCount: number }> = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: "inst_100",
  params: { spawnCount: 5 },
  actor: {
    viewerId: "usr_1",
    displayName: "Player 1",
    avatarUrl: "https://example.com/a.png",
  },
  trigger: {
    eventId: "evt_1",
    eventType: "gift.sent",
    mappingId: "map_1",
  },
  priority: 50,
  ttlMs: 10000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const baseActionEnvSample: BaseGameActionEnvelope = validActionEnvelope;

// TASK A: Public generic constraints reject non-JSON types at compile time
// @ts-expect-error - Date does not satisfy JsonValue constraint
export type _InvalidDateEnvelope = GameActionEnvelope<Date>;
// @ts-expect-error - Function does not satisfy JsonValue constraint
export type _InvalidFunctionEnvelope = GameActionEnvelope<() => void>;
// @ts-expect-error - Map does not satisfy JsonValue constraint
export type _InvalidMapEnvelope = GameActionEnvelope<Map<string, unknown>>;
// @ts-expect-error - Set does not satisfy JsonValue constraint
export type _InvalidSetEnvelope = GameActionEnvelope<Set<string>>;
// @ts-expect-error - bigint does not satisfy JsonValue constraint
export type _InvalidBigIntEnvelope = GameActionEnvelope<bigint>;
// @ts-expect-error - symbol does not satisfy JsonValue constraint
export type _InvalidSymbolEnvelope = GameActionEnvelope<symbol>;

class CustomClassArg {}
// @ts-expect-error - Class instance does not satisfy JsonValue constraint
export type _InvalidClassEnvelope = GameActionEnvelope<CustomClassArg>;

// @ts-expect-error - Date does not satisfy JsonValue constraint
export type _InvalidDateDelivery = GameActionDeliveryMessage<Date>;
// @ts-expect-error - Function does not satisfy JsonValue constraint
export type _InvalidFunctionDelivery = GameActionDeliveryMessage<() => void>;

// TASK B: Required nullable properties cannot be omitted or assigned undefined
// @ts-expect-error - gameInstanceId required nullable property cannot be omitted
const actionOmittedInstanceId: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  params: { amount: 1 },
  actor: null,
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionUndefinedInstanceId: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  // @ts-expect-error - undefined is not assignable to string | null
  gameInstanceId: undefined,
  params: { amount: 1 },
  actor: null,
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionNullInstanceId: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: { amount: 1 },
  actor: null,
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

// @ts-expect-error - actor required nullable property cannot be omitted
const actionOmittedActor: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionUndefinedActor: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  // @ts-expect-error - undefined is not assignable to actor
  actor: undefined,
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionNullActor: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  actor: null,
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionOmittedActorViewerId: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  // @ts-expect-error - actor.viewerId required nullable property cannot be omitted
  actor: {
    displayName: "Player 1",
    avatarUrl: null,
  },
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionUndefinedActorViewerId: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  actor: {
    // @ts-expect-error - undefined is not assignable to string | null
    viewerId: undefined,
    displayName: "Player 1",
    avatarUrl: null,
  },
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionNullActorViewerId: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  actor: {
    viewerId: null,
    displayName: "Player 1",
    avatarUrl: null,
  },
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionOmittedActorAvatarUrl: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  // @ts-expect-error - actor.avatarUrl required nullable property cannot be omitted
  actor: {
    viewerId: "usr_1",
    displayName: "Player 1",
  },
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionUndefinedActorAvatarUrl: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  actor: {
    viewerId: "usr_1",
    displayName: "Player 1",
    // @ts-expect-error - undefined is not assignable to string | null
    avatarUrl: undefined,
  },
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const actionNullActorAvatarUrl: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "act_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: null,
  params: {},
  actor: {
    viewerId: "usr_1",
    displayName: "Player 1",
    avatarUrl: null,
  },
  trigger: { eventId: "e", eventType: "t", mappingId: "m" },
  priority: 10,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

// 19. Registration, Registered, and Heartbeat declaration types
const regMsg: GameRegisterMessage = {
  type: "game.register",
  gameId: "zombie-survival",
  instanceId: "inst_1",
  sdkVersion: "0.1",
  token: "secret",
};

const regResp: GameRegisteredMessage = {
  type: "game.registered",
  heartbeatIntervalMs: 5000,
};

const hbMsg: GameHeartbeatMessage = {
  type: "game.heartbeat",
};

const invalidRegType: GameRegisterMessage = {
  // @ts-expect-error - Wrong type discriminator rejected
  type: "game.registered",
  gameId: "zombie",
  instanceId: "inst",
  sdkVersion: "0.1",
  token: "tok",
};

// 20. Action delivery wrapper declaration types
const deliveryMsg: GameActionDeliveryMessage<{ spawnCount: number }> = {
  type: "game.action",
  data: validActionEnvelope,
};

const invalidDeliveryType: GameActionDeliveryMessage = {
  // @ts-expect-error - Wrong delivery wrapper discriminator rejected
  type: "game.action.received",
  data: validActionEnvelope,
};

// 21. Action receipt declaration types
const receiptMsg: GameActionReceivedMessage = {
  type: "game.action.received",
  actionId: "act_001",
  receivedAt: "2026-07-23T04:00:00.250Z",
};

const invalidReceiptWithResultFields: GameActionReceivedMessage = {
  type: "game.action.received",
  actionId: "act_001",
  receivedAt: "2026-07-23T04:00:00.250Z",
  // @ts-expect-error - Receipt does not accept completion/result fields
  status: "completed",
};

// 22. Action result union declaration types & narrowing
const completedResult: GameActionCompletedResult = {
  type: "game.action.result",
  actionId: "act_001",
  status: "completed",
  durationMs: 1250,
  details: { wave: 1 },
};

const failedResult: GameActionFailedResult = {
  type: "game.action.result",
  actionId: "act_001",
  status: "failed",
  error: {
    code: "CAP_EXCEEDED",
    message: "Zombie cap reached",
    retryable: false,
  },
};

function processActionResult(res: GameActionResultMessage): string {
  if (res.status === "completed") {
    const duration: number = res.durationMs;
    return `Completed in ${duration}ms`;
  } else {
    const errCode: string = res.error.code;
    return `Failed with ${errCode}`;
  }
}

// Completed result rejects failed-only fields
const invalidCompletedWithFailedFields: GameActionCompletedResult = {
  type: "game.action.result",
  actionId: "act_001",
  status: "completed",
  durationMs: 1000,
  // @ts-expect-error - Completed result rejects error field
  error: { code: "ERR", message: "fail", retryable: false },
};

// Failed result rejects completed-only fields
const invalidFailedWithCompletedFields: GameActionFailedResult = {
  type: "game.action.result",
  actionId: "act_001",
  status: "failed",
  // @ts-expect-error - Failed result rejects durationMs field
  durationMs: 1000,
  error: { code: "ERR", message: "fail", retryable: false },
};

// 23. z.input and z.output alignment for GameActionEnvelopeSchema & GameActionResultMessageSchema
type EnvelopeInput = z.input<typeof GameActionEnvelopeSchema>;
type EnvelopeOutput = z.output<typeof GameActionEnvelopeSchema>;

type ResultUnionInput = z.input<typeof GameActionResultMessageSchema>;
type ResultUnionOutput = z.output<typeof GameActionResultMessageSchema>;

const validEnvInput: EnvelopeInput = {
  specVersion: "0.1",
  actionId: "act_1",
  actionType: "JUMP",
  gameId: "platformer",
  gameInstanceId: null,
  params: { height: 10 },
  actor: null,
  trigger: { eventId: "e1", eventType: "like", mappingId: "m1" },
  priority: 1,
  ttlMs: 5000,
  createdAt: "2026-07-23T04:00:00.000Z",
};

const validEnvOutput: EnvelopeOutput = validEnvInput;

const validResInput: ResultUnionInput = {
  type: "game.action.result",
  actionId: "act_1",
  status: "completed",
  durationMs: 100,
};

const validResOutput: ResultUnionOutput = validResInput;

type _ActorAlias = GameActionActor;
type _TriggerAlias = GameActionTrigger;
type _ActionMsgAlias = GameActionMessage;
type _ResultAlias = GameActionResult;
type _ErrorAlias = GameActionError;

// ============================================================================
// FOUND-02E Voice Contracts Declaration Verification
// ============================================================================

// 24. VoiceIntent kinds and interrupt policies exact literals
const validVoiceKinds: VoiceIntentKind[] = [
  "thank_gift",
  "welcome_follow",
  "game_commentary",
  "system",
];

// @ts-expect-error - Invalid voice intent kind rejected at compile time
const invalidVoiceKind: VoiceIntentKind = "random_chat";

const validInterruptPolicies: VoiceInterruptPolicy[] = [
  "never_interrupt",
  "interrupt_lower_priority",
  "interrupt_any",
];

// @ts-expect-error - Invalid interrupt policy rejected at compile time
const invalidInterruptPolicy: VoiceInterruptPolicy = "always";

// 25. VoiceIntent type checks and required nullables
const validVoiceIntent: VoiceIntent = {
  specVersion: "0.1",
  intentId: "intent_1",
  eventId: "evt_1",
  kind: "thank_gift",
  priority: 80,
  templateGroup: "gift.default",
  variables: { name: "Player 1", count: 5 },
  voiceProfileId: "profile_1",
  dedupeKey: "dedupe_1",
  expiresAt: "2026-07-23T05:00:00.000Z",
};

const validNullablesVoiceIntent: VoiceIntent = {
  specVersion: "0.1",
  intentId: "intent_2",
  eventId: null,
  kind: "system",
  priority: 100,
  templateGroup: "system.alert",
  variables: {},
  voiceProfileId: "profile_1",
  dedupeKey: null,
  expiresAt: "2026-07-23T05:00:00.000Z",
};

// @ts-expect-error - Required nullable eventId cannot be omitted
const voiceOmittedEventId: VoiceIntent = {
  specVersion: "0.1",
  intentId: "intent_1",
  kind: "thank_gift",
  priority: 80,
  templateGroup: "gift.default",
  variables: {},
  voiceProfileId: "p1",
  dedupeKey: null,
  expiresAt: "2026-07-23T05:00:00.000Z",
};

const voiceUndefinedEventId: VoiceIntent = {
  specVersion: "0.1",
  intentId: "intent_1",
  // @ts-expect-error - undefined is not assignable to string | null
  eventId: undefined,
  kind: "thank_gift",
  priority: 80,
  templateGroup: "gift.default",
  variables: {},
  voiceProfileId: "p1",
  dedupeKey: null,
  expiresAt: "2026-07-23T05:00:00.000Z",
};

// @ts-expect-error - Required nullable dedupeKey cannot be omitted
const voiceOmittedDedupeKey: VoiceIntent = {
  specVersion: "0.1",
  intentId: "intent_1",
  eventId: null,
  kind: "thank_gift",
  priority: 80,
  templateGroup: "gift.default",
  variables: {},
  voiceProfileId: "p1",
  expiresAt: "2026-07-23T05:00:00.000Z",
};

const voiceUndefinedDedupeKey: VoiceIntent = {
  specVersion: "0.1",
  intentId: "intent_1",
  eventId: null,
  kind: "thank_gift",
  priority: 80,
  templateGroup: "gift.default",
  variables: {},
  voiceProfileId: "p1",
  // @ts-expect-error - undefined is not assignable to string | null
  dedupeKey: undefined,
  expiresAt: "2026-07-23T05:00:00.000Z",
};

// 26. VoiceIntent variables type checks (string | number values only)
const validVariables: VoiceIntentVariables = {
  name: "Player 1",
  count: 10,
  ratio: 1.5,
};

const invalidVariablesBoolean: VoiceIntentVariables = {
  name: "Player 1",
  // @ts-expect-error - boolean is not assignable to string | number
  active: true,
};

const invalidVariablesNested: VoiceIntentVariables = {
  name: "Player 1",
  // @ts-expect-error - object is not assignable to string | number
  details: { level: 5 },
};

// 27. VoicePlayMessage declaration checks
const validVoicePlay: VoicePlayMessage = {
  type: "voice.play",
  jobId: "job_1",
  audioUrl: "/media/tts/voice_1.mp3",
  subtitle: "Cảm ơn Minh!",
  volume: 0.8,
};

const invalidVoicePlayType: VoicePlayMessage = {
  // @ts-expect-error - Wrong type discriminator rejected
  type: "playback.started",
  jobId: "job_1",
  audioUrl: "/media/tts/voice_1.mp3",
  subtitle: "Cảm ơn Minh!",
  volume: 0.8,
};

// 28. VoicePlaybackCallbackMessage discriminated union type narrowing (ADR-010 playback.* literals)
const playbackStarted: VoicePlaybackStartedMessage = {
  type: "playback.started",
  jobId: "job_1",
};

const invalidLegacyPlaybackStarted: VoicePlaybackStartedMessage = {
  // @ts-expect-error - Legacy voice.playback.* literal rejected by public callback contract
  type: "voice.playback.started",
  jobId: "job_1",
};

const playbackFinished: VoicePlaybackFinishedMessage = {
  type: "playback.finished",
  jobId: "job_1",
};

const playbackInterrupted: VoicePlaybackInterruptedMessage = {
  type: "playback.interrupted",
  jobId: "job_1",
};

const playbackFailed: VoicePlaybackFailedMessage = {
  type: "playback.failed",
  jobId: "job_1",
  error: {
    code: "PLAYBACK_ERROR",
    message: "Failed to play audio",
  },
};

function processPlaybackCallback(msg: VoicePlaybackCallbackMessage): string {
  if (msg.type === "playback.started") {
    return `Started ${msg.jobId}`;
  } else if (msg.type === "playback.finished") {
    return `Finished ${msg.jobId}`;
  } else if (msg.type === "playback.interrupted") {
    return `Interrupted ${msg.jobId}`;
  } else {
    const errCode: string = msg.error.code;
    return `Failed ${msg.jobId} with ${errCode}`;
  }
}

// Started callback rejects failed-only fields
const invalidStartedWithError: VoicePlaybackStartedMessage = {
  type: "playback.started",
  jobId: "job_1",
  // @ts-expect-error - Started callback rejects error field
  error: { code: "ERR", message: "fail" },
};

// 29. z.input and z.output alignment for VoiceIntentSchema and VoicePlaybackCallbackMessageSchema
type VoiceIntentInput = z.input<typeof VoiceIntentSchema>;
type VoiceIntentOutput = z.output<typeof VoiceIntentSchema>;

type CallbackUnionInput = z.input<typeof VoicePlaybackCallbackMessageSchema>;
type CallbackUnionOutput = z.output<typeof VoicePlaybackCallbackMessageSchema>;

const validIntentInput: VoiceIntentInput = {
  specVersion: "0.1",
  intentId: "intent_inp",
  eventId: null,
  kind: "welcome_follow",
  priority: 50,
  templateGroup: "follow.default",
  variables: { user: "Alice" },
  voiceProfileId: "profile_1",
  dedupeKey: null,
  expiresAt: "2026-07-23T05:00:00.000Z",
};

const validIntentOutput: VoiceIntentOutput = validIntentInput;

const validCallbackInput: CallbackUnionInput = {
  type: "playback.started",
  jobId: "job_inp",
};

const validCallbackOutput: CallbackUnionOutput = validCallbackInput;

type _VoicePlaybackMsgAlias = VoicePlaybackMessage;
type _VoicePlaybackErrAlias = VoicePlaybackError;

console.log(
  "Declaration consumer type checks passed.",
  validLiterals,
  invalidLiteral,
  processEvent,
  validEmptyInput,
  validEmptyOutput,
  invalidEmptyInput,
  invalidEmptyOutput,
  validConnectedInput,
  missingConnectedInputPayload,
  invalidConnectedInputPayloadKey,
  validSubInput,
  missingSubInputPayload,
  invalidSubInputPayloadKey,
  validConnectedOutput,
  invalidConnectedOutputPayloadKey,
  validSubOutput,
  invalidSubOutputPayloadKey,
  invalidUnionConnectedInput,
  invalidUnionConnectedOutput,
  invalidGiftPayloadTypes,
  giftOmittedImageUrl,
  giftUndefinedImageUrl,
  giftOmittedDiamondValue,
  giftUndefinedDiamondValue,
  giftOmittedStreakId,
  giftUndefinedStreakId,
  giftOmittedEstimatedTotal,
  giftUndefinedEstimatedTotal,
  validNullGiftPayload,
  invalidCommentText,
  invalidCommentMention,
  invalidLikeDelta,
  invalidLikeTotal,
  invalidLikeMilestone,
  likeOmittedTotal,
  likeUndefinedTotal,
  likeOmittedMilestone,
  likeUndefinedMilestone,
  connEventSample,
  subEventSample,
  invalidCommentPayload,
  invalidGiftEvent,
  likeEvent,
  samplePayload,
  sampleEventType,
  genericEnvelope,
  invalidPayload,
  missingPayloadEnvelope,
  parsedBase,
  baseLiveEnvSample,
  baseActionEnvSample,
  validActionEnvelope,
  actionOmittedInstanceId,
  actionUndefinedInstanceId,
  actionNullInstanceId,
  actionOmittedActor,
  actionUndefinedActor,
  actionNullActor,
  actionOmittedActorViewerId,
  actionUndefinedActorViewerId,
  actionNullActorViewerId,
  actionOmittedActorAvatarUrl,
  actionUndefinedActorAvatarUrl,
  actionNullActorAvatarUrl,
  regMsg,
  regResp,
  hbMsg,
  invalidRegType,
  deliveryMsg,
  invalidDeliveryType,
  receiptMsg,
  invalidReceiptWithResultFields,
  completedResult,
  failedResult,
  processActionResult,
  invalidCompletedWithFailedFields,
  invalidFailedWithCompletedFields,
  validEnvInput,
  validEnvOutput,
  validResInput,
  validResOutput,
  validVoiceKinds,
  invalidVoiceKind,
  validInterruptPolicies,
  invalidInterruptPolicy,
  validVoiceIntent,
  validNullablesVoiceIntent,
  voiceOmittedEventId,
  voiceUndefinedEventId,
  voiceOmittedDedupeKey,
  voiceUndefinedDedupeKey,
  validVariables,
  invalidVariablesBoolean,
  invalidVariablesNested,
  validVoicePlay,
  invalidVoicePlayType,
  playbackStarted,
  invalidLegacyPlaybackStarted,
  playbackFinished,
  playbackInterrupted,
  playbackFailed,
  processPlaybackCallback,
  invalidStartedWithError,
  validIntentInput,
  validIntentOutput,
  validCallbackInput,
  validCallbackOutput,
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
  GameActionEnvelopeSchema,
  GameActionActorSchema,
  GameActionTriggerSchema,
  GameRegisterMessageSchema,
  GameRegisteredMessageSchema,
  GameHeartbeatMessageSchema,
  GameActionDeliveryMessageSchema,
  GameActionMessageSchema,
  GameActionReceivedMessageSchema,
  GameActionCompletedResultSchema,
  GameActionFailedResultSchema,
  GameActionResultMessageSchema,
  GameActionResultSchema,
  GameActionErrorSchema,
  VoiceIntentSchema,
  VoiceIntentKindSchema,
  VoiceInterruptPolicySchema,
  VoicePlayMessageSchema,
  VoicePlaybackStartedMessageSchema,
  VoicePlaybackFinishedMessageSchema,
  VoicePlaybackInterruptedMessageSchema,
  VoicePlaybackFailedMessageSchema,
  VoicePlaybackCallbackMessageSchema,
  VoicePlaybackMessageSchema,
  VoicePlaybackErrorSchema
);
