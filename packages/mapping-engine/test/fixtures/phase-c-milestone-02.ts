import type { LiveEventEnvelope } from "@crowdcircuit/contracts";
import {
  CANONICAL_CHAT_COMMENT_EVENT,
  CANONICAL_ENGAGEMENT_LIKE_EVENT,
  CANONICAL_GIFT_SENT_EVENT,
} from "@crowdcircuit/contracts/fixtures";
import type {
  ConditionOperator,
  GameActionManifest,
  MappingProfile,
  MappingRule,
  MatchMode,
} from "@crowdcircuit/mapping-engine";

export const FIXTURE_MANIFEST: GameActionManifest = {
  gameId: "zombie-survival",
  actions: {
    SPAWN: {
      parameters: { amount: "number", owner: "string" },
      allowAdditionalParameters: false,
    },
    CHEER: {
      parameters: { message: "string" },
      allowAdditionalParameters: false,
    },
    BOOST: {
      parameters: { multiplier: "number" },
      allowAdditionalParameters: false,
    },
  },
};

export const VALID_COMMENT_RULE: MappingRule = {
  id: "rule_comment_01",
  name: "Cheer on hello comment",
  enabled: true,
  priority: 10,
  exclusiveGroup: null,
  eventType: "chat.comment",
  conditions: [
    { field: "payload.textNormalized", operator: "startsWith", value: "hello" },
  ],
  transform: {
    actionType: "CHEER",
    parameters: { message: "{{payload.text}}" },
  },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 10,
    maxActionsPerUserPerMinute: 5,
    aggregationWindowMs: 0,
    actionPriority: 50,
    ttlMs: 5000,
  },
  createdAt: "2026-07-25T00:00:00.000Z",
};

export const VALID_GIFT_RULE: MappingRule = {
  id: "rule_gift_01",
  name: "Spawn zombie on rose gift",
  enabled: true,
  priority: 20,
  exclusiveGroup: null,
  eventType: "gift.sent",
  conditions: [
    { field: "payload.gift.id", operator: "eq", value: "gift_rose" },
  ],
  transform: {
    actionType: "SPAWN",
    parameters: { amount: "{{payload.quantity}}", owner: "{{user.displayName}}" },
  },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 20,
    maxActionsPerUserPerMinute: 10,
    aggregationWindowMs: 0,
    actionPriority: 80,
    ttlMs: 5000,
  },
  createdAt: "2026-07-25T00:00:00.000Z",
};

export const GIFT_STREAK_UPDATE_EVENT: LiveEventEnvelope = {
  ...CANONICAL_GIFT_SENT_EVENT,
  eventId: "evt_gift_streak_001",
  payload: {
    ...CANONICAL_GIFT_SENT_EVENT.payload,
    quantity: 5,
    totalQuantity: 15,
    streak: {
      id: "streak_canonical_001",
      status: "update",
    },
  },
};

export const LIKE_AGGREGATE_EVENT_1: LiveEventEnvelope = {
  ...CANONICAL_ENGAGEMENT_LIKE_EVENT,
  eventId: "evt_like_agg_001",
  user: null,
  payload: { delta: 100, total: 500, milestone: 500 },
};

export const LIKE_AGGREGATE_EVENT_2: LiveEventEnvelope = {
  ...CANONICAL_ENGAGEMENT_LIKE_EVENT,
  eventId: "evt_like_agg_001",
  user: null,
  payload: { delta: 200, total: 700, milestone: 700 },
};

export const IDENTICAL_OUTPUT_RULE_A: MappingRule = {
  id: "rule_identical_alpha",
  name: "Identical Alpha Rule",
  enabled: true,
  priority: 10,
  exclusiveGroup: null,
  eventType: "gift.sent",
  conditions: [
    { field: "payload.gift.id", operator: "eq", value: "gift_rose" },
  ],
  transform: { actionType: "CHEER", parameters: { message: "Rose gift!" } },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 10,
    maxActionsPerUserPerMinute: 5,
    aggregationWindowMs: 0,
    actionPriority: 50,
    ttlMs: 5000,
  },
  createdAt: "2026-07-25T00:00:00.000Z",
};

export const IDENTICAL_OUTPUT_RULE_B: MappingRule = {
  id: "rule_identical_beta",
  name: "Identical Beta Rule",
  enabled: true,
  priority: 10,
  exclusiveGroup: null,
  eventType: "gift.sent",
  conditions: [
    { field: "payload.gift.id", operator: "eq", value: "gift_rose" },
  ],
  transform: { actionType: "CHEER", parameters: { message: "Rose gift!" } },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 10,
    maxActionsPerUserPerMinute: 5,
    aggregationWindowMs: 0,
    actionPriority: 50,
    ttlMs: 5000,
  },
  createdAt: "2026-07-25T00:00:01.000Z",
};

export const TIE_RULE_EARLIER: MappingRule = {
  id: "rule_tie_a",
  name: "Tie Rule Earlier",
  enabled: true,
  priority: 10,
  exclusiveGroup: null,
  eventType: "gift.sent",
  conditions: [
    { field: "payload.gift.id", operator: "eq", value: "gift_rose" },
  ],
  transform: { actionType: "CHEER", parameters: { message: "Earlier tie" } },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 10,
    maxActionsPerUserPerMinute: 5,
    aggregationWindowMs: 0,
    actionPriority: 50,
    ttlMs: 5000,
  },
  createdAt: "2026-07-25T00:00:00.000Z",
};

export const TIE_RULE_LATER: MappingRule = {
  id: "rule_tie_b",
  name: "Tie Rule Later",
  enabled: true,
  priority: 10,
  exclusiveGroup: null,
  eventType: "gift.sent",
  conditions: [
    { field: "payload.gift.id", operator: "eq", value: "gift_rose" },
  ],
  transform: { actionType: "CHEER", parameters: { message: "Later tie" } },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 10,
    maxActionsPerUserPerMinute: 5,
    aggregationWindowMs: 0,
    actionPriority: 50,
    ttlMs: 5000,
  },
  createdAt: "2026-07-25T00:00:01.000Z",
};

export const ANONYMOUS_USER_NULL_EVENT: LiveEventEnvelope = {
  ...CANONICAL_CHAT_COMMENT_EVENT,
  eventId: "evt_anon_null_001",
  user: null,
};

export const ANONYMOUS_USER_EMPTY_EVENT: LiveEventEnvelope = {
  ...CANONICAL_CHAT_COMMENT_EVENT,
  eventId: "evt_anon_empty_001",
  user: {
    id: null,
    uniqueId: null,
    displayName: "Anonymous Viewer",
    avatarUrl: null,
    roles: [],
  },
};

export const IDENTIFIED_BY_ID_EVENT: LiveEventEnvelope = {
  ...CANONICAL_CHAT_COMMENT_EVENT,
  eventId: "evt_id_only_001",
  user: {
    id: "usr_specific_999",
    uniqueId: null,
    displayName: "Identified By Id",
    avatarUrl: null,
    roles: [],
  },
};

export const IDENTIFIED_BY_UNIQUE_ID_EVENT: LiveEventEnvelope = {
  ...CANONICAL_CHAT_COMMENT_EVENT,
  eventId: "evt_unique_only_001",
  user: {
    id: null,
    uniqueId: "viewer_unique_999",
    displayName: "Identified By UniqueId",
    avatarUrl: null,
    roles: [],
  },
};

export const BASE_PROFILE: MappingProfile = {
  gameProfileId: "prof_milestone_02",
  gameId: "zombie-survival",
  matchMode: "all",
  globalActionBudget: {
    maxPerSecond: 30,
    burst: 50,
    overflowPolicy: "drop_low_priority",
    deferredTtlMs: null,
  },
  capacity: {
    maxUserBuckets: 100,
    inactiveRetentionMs: 60000,
    sweepLimit: 50,
  },
  rules: [VALID_COMMENT_RULE, VALID_GIFT_RULE],
};

export const INVALID_PROFILE_CASES = {
  duplicateRuleId: {
    ...BASE_PROFILE,
    gameProfileId: "p_dup",
    rules: [VALID_GIFT_RULE, { ...VALID_GIFT_RULE, name: "Duplicate Rule ID" }],
  },
  invalidRegex: {
    ...BASE_PROFILE,
    gameProfileId: "p_regex",
    rules: [
      {
        ...VALID_COMMENT_RULE,
        id: "rule_bad_regex",
        conditions: [{ field: "payload.text", operator: "regex", value: "[" }],
      },
    ],
  },
  unsupportedOperator: {
    ...BASE_PROFILE,
    gameProfileId: "p_op",
    rules: [
      {
        ...VALID_COMMENT_RULE,
        id: "rule_bad_op",
        conditions: [
          {
            field: "payload.text",
            operator: "invalid_op" as unknown as ConditionOperator,
            value: "val",
          },
        ],
      },
    ],
  },
  invalidLimits: {
    ...BASE_PROFILE,
    gameProfileId: "p_lim",
    globalActionBudget: {
      maxPerSecond: Number.NaN,
      burst: -1,
      overflowPolicy: "drop_low_priority",
      deferredTtlMs: null,
    },
  },
  invalidCapacity: {
    ...BASE_PROFILE,
    gameProfileId: "p_cap",
    capacity: {
      maxUserBuckets: -5,
      inactiveRetentionMs: 60000,
      sweepLimit: 0,
    },
  },
  invalidRetentionShort: {
    ...BASE_PROFILE,
    gameProfileId: "p_ret",
    capacity: {
      maxUserBuckets: 10,
      inactiveRetentionMs: 30000, // less than 60,000ms minimum window
      sweepLimit: 10,
    },
  },
  malformedMatchMode: {
    ...BASE_PROFILE,
    gameProfileId: "p_mm",
    matchMode: "invalid_match_mode" as unknown as MatchMode,
  },
  queueWithTtlMissingTtl: {
    ...BASE_PROFILE,
    gameProfileId: "p_qttl",
    globalActionBudget: {
      maxPerSecond: 30,
      burst: 50,
      overflowPolicy: "queue_with_ttl",
      deferredTtlMs: null,
    },
  },
} as const;
