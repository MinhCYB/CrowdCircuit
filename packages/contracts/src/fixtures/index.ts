import type {
  GiftSentEvent,
  ChatCommentEvent,
  EngagementLikeEvent,
  SocialFollowEvent,
} from "../events/envelope.js";
import type { GameActionEnvelope } from "../actions/envelope.js";
import type {
  GameActionReceivedMessage,
  GameActionCompletedResult,
  GameActionFailedResult,
} from "../actions/lifecycle.js";
import type { VoiceIntent } from "../voice/intent.js";
import type {
  VoicePlayMessage,
  VoicePlaybackStartedMessage,
  VoicePlaybackFinishedMessage,
  VoicePlaybackInterruptedMessage,
  VoicePlaybackFailedMessage,
} from "../voice/protocol.js";
import { deepFreeze } from "./freezer.js";

const CANONICAL_ROOM = {
  roomId: "room_canonical_001" as const,
  streamerUniqueId: "streamer_canonical_001" as const,
};

const CANONICAL_USER = {
  id: "usr_canonical_001" as const,
  uniqueId: "viewer_canonical_001" as const,
  displayName: "Canonical Viewer" as const,
  avatarUrl: "https://example.com/avatar.jpg" as const,
  roles: ["viewer" as const],
};

const CANONICAL_METADATA = {
  connectorId: "connector_mock_001" as const,
  isReplay: false as const,
  rawStored: true as const,
};

/**
 * Immutable canonical fixture for gift.sent LiveEvent.
 */
export const CANONICAL_GIFT_SENT_EVENT = deepFreeze({
  specVersion: "0.1",
  eventId: "evt_gift_canonical_001",
  eventType: "gift.sent",
  source: "tiktok",
  room: CANONICAL_ROOM,
  user: CANONICAL_USER,
  payload: {
    gift: {
      id: "gift_rose",
      name: "Rose",
      imageUrl: "https://example.com/rose.png",
      diamondValue: 10,
      streakable: true,
    },
    quantity: 1,
    totalQuantity: 1,
    streak: {
      id: "streak_canonical_001",
      status: "single",
    },
    estimatedDiamondTotal: 10,
  },
  occurredAt: "2026-07-23T12:00:00.000Z",
  receivedAt: "2026-07-23T12:00:00.100Z",
  metadata: CANONICAL_METADATA,
} as const satisfies GiftSentEvent);

/**
 * Immutable canonical fixture for chat.comment LiveEvent.
 */
export const CANONICAL_CHAT_COMMENT_EVENT = deepFreeze({
  specVersion: "0.1",
  eventId: "evt_chat_canonical_001",
  eventType: "chat.comment",
  source: "tiktok",
  room: CANONICAL_ROOM,
  user: CANONICAL_USER,
  payload: {
    text: "Hello CrowdCircuit!",
    textNormalized: "hello crowdcircuit!",
    mentions: [],
  },
  occurredAt: "2026-07-23T12:00:01.000Z",
  receivedAt: "2026-07-23T12:00:01.100Z",
  metadata: CANONICAL_METADATA,
} as const satisfies ChatCommentEvent);

/**
 * Immutable canonical fixture for engagement.like LiveEvent.
 */
export const CANONICAL_ENGAGEMENT_LIKE_EVENT = deepFreeze({
  specVersion: "0.1",
  eventId: "evt_like_canonical_001",
  eventType: "engagement.like",
  source: "tiktok",
  room: CANONICAL_ROOM,
  user: CANONICAL_USER,
  payload: {
    delta: 50,
    total: 1000,
    milestone: 1000,
  },
  occurredAt: "2026-07-23T12:00:02.000Z",
  receivedAt: "2026-07-23T12:00:02.100Z",
  metadata: CANONICAL_METADATA,
} as const satisfies EngagementLikeEvent);

/**
 * Immutable canonical fixture for social.follow LiveEvent.
 */
export const CANONICAL_SOCIAL_FOLLOW_EVENT = deepFreeze({
  specVersion: "0.1",
  eventId: "evt_follow_canonical_001",
  eventType: "social.follow",
  source: "tiktok",
  room: CANONICAL_ROOM,
  user: CANONICAL_USER,
  payload: {},
  occurredAt: "2026-07-23T12:00:03.000Z",
  receivedAt: "2026-07-23T12:00:03.100Z",
  metadata: CANONICAL_METADATA,
} as const satisfies SocialFollowEvent);

/**
 * Immutable canonical fixture for GameActionEnvelope.
 */
export const CANONICAL_GAME_ACTION_ENVELOPE = deepFreeze({
  specVersion: "0.1",
  actionId: "act_canonical_001",
  actionType: "SPAWN_ZOMBIE",
  gameId: "zombie-survival",
  gameInstanceId: "inst_canonical_001",
  params: { spawnCount: 5 },
  actor: {
    viewerId: "usr_canonical_001",
    displayName: "Canonical Viewer",
    avatarUrl: "https://example.com/avatar.jpg",
  },
  trigger: {
    eventId: "evt_gift_canonical_001",
    eventType: "gift.sent",
    mappingId: "map_canonical_001",
  },
  priority: 80,
  ttlMs: 5000,
  createdAt: "2026-07-23T12:00:04.000Z",
} as const satisfies GameActionEnvelope<{ spawnCount: number }>);

/**
 * Immutable canonical fixture for game.action.received receipt message.
 */
export const CANONICAL_GAME_ACTION_RECEIVED_MESSAGE = deepFreeze({
  type: "game.action.received",
  actionId: "act_canonical_001",
  receivedAt: "2026-07-23T12:00:04.100Z",
} as const satisfies GameActionReceivedMessage);

/**
 * Immutable canonical fixture for completed game.action.result message.
 */
export const CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE = deepFreeze({
  type: "game.action.result",
  actionId: "act_canonical_001",
  status: "completed",
  durationMs: 50,
  details: { spawned: 5 },
} as const satisfies GameActionCompletedResult);

/**
 * Immutable canonical fixture for failed game.action.result message.
 */
export const CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE = deepFreeze({
  type: "game.action.result",
  actionId: "act_canonical_001",
  status: "failed",
  error: {
    code: "SPAWN_LIMIT_EXCEEDED",
    message: "Maximum active zombies reached",
    retryable: false,
  },
} as const satisfies GameActionFailedResult);

/**
 * Immutable canonical fixture for VoiceIntent.
 */
export const CANONICAL_VOICE_INTENT = deepFreeze({
  specVersion: "0.1",
  intentId: "intent_canonical_001",
  eventId: "evt_gift_canonical_001",
  kind: "thank_gift",
  priority: 80,
  templateGroup: "gift.default",
  variables: { name: "Canonical Viewer", count: 1 },
  voiceProfileId: "profile_vi_vn",
  dedupeKey: "dedupe_canonical_001",
  expiresAt: "2026-07-23T12:05:00.000Z",
} as const satisfies VoiceIntent);

/**
 * Immutable canonical fixture for voice.play message.
 */
export const CANONICAL_VOICE_PLAY_MESSAGE = deepFreeze({
  type: "voice.play",
  jobId: "job_canonical_001",
  audioUrl: "/media/tts/canonical_voice_001.mp3",
  subtitle: "Cảm ơn Canonical Viewer đã tặng Rose!",
  volume: 0.9,
} as const satisfies VoicePlayMessage);

/**
 * Immutable canonical fixture for playback.started callback message.
 */
export const CANONICAL_VOICE_PLAYBACK_STARTED_MESSAGE = deepFreeze({
  type: "playback.started",
  jobId: "job_canonical_001",
} as const satisfies VoicePlaybackStartedMessage);

/**
 * Immutable canonical fixture for playback.finished callback message.
 */
export const CANONICAL_VOICE_PLAYBACK_FINISHED_MESSAGE = deepFreeze({
  type: "playback.finished",
  jobId: "job_canonical_001",
} as const satisfies VoicePlaybackFinishedMessage);

/**
 * Immutable canonical fixture for playback.interrupted callback message.
 */
export const CANONICAL_VOICE_PLAYBACK_INTERRUPTED_MESSAGE = deepFreeze({
  type: "playback.interrupted",
  jobId: "job_canonical_001",
} as const satisfies VoicePlaybackInterruptedMessage);

/**
 * Immutable canonical fixture for playback.failed callback message.
 */
export const CANONICAL_VOICE_PLAYBACK_FAILED_MESSAGE = deepFreeze({
  type: "playback.failed",
  jobId: "job_canonical_001",
  error: {
    code: "AUDIO_PLAYBACK_ERROR",
    message: "Audio element failed to decode source",
  },
} as const satisfies VoicePlaybackFailedMessage);
