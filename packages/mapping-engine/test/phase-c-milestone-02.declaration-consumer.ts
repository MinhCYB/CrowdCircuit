import {
  MappingEngine,
  createCandidateSeed,
  canonicalJson,
  type ActionTemplate,
  type BudgetAdmissionRequest,
  type BudgetAdmissionResult,
  type BudgetCapacity,
  type CandidateIdentityInput,
  type ConditionOperator,
  type DurableBudgetRepository,
  type EventCondition,
  type GameActionManifest,
  type GlobalActionBudget,
  type MappingCandidate,
  type MappingDiagnostic,
  type MappingEvaluation,
  type MappingProfile,
  type MappingResult,
  type MappingRule,
  type MatchMode,
  type OverflowPolicy,
  type TrustedClock,
} from "@crowdcircuit/mapping-engine";

// 1. Valid Construction
const clock: TrustedClock = { now: () => 1000 };
const repository: DurableBudgetRepository = {
  admit(_request: BudgetAdmissionRequest): BudgetAdmissionResult {
    return { admitted: true };
  },
};

const validEngine = new MappingEngine(repository, clock);

const validCapacity: BudgetCapacity = {
  maxUserBuckets: 4096,
  inactiveRetentionMs: 600000,
  sweepLimit: 128,
};

const validGlobalBudget: GlobalActionBudget = {
  maxPerSecond: 30,
  burst: 50,
  overflowPolicy: "drop_low_priority",
  deferredTtlMs: null,
};

const validProfile: MappingProfile = {
  gameProfileId: "prof_valid_01",
  gameId: "zombie-survival",
  matchMode: "all",
  globalActionBudget: validGlobalBudget,
  capacity: validCapacity,
  rules: [
    {
      id: "rule_01",
      name: "Valid Rule",
      enabled: true,
      priority: 10,
      exclusiveGroup: null,
      eventType: "gift.sent",
      conditions: [
        { field: "payload.gift.id", operator: "eq", value: "gift_rose" },
      ],
      transform: {
        actionType: "SPAWN",
        parameters: { amount: 1 },
      },
      controls: {
        cooldownMs: 0,
        maxActionsPerMinute: 60,
        maxActionsPerUserPerMinute: 10,
        aggregationWindowMs: 0,
        actionPriority: 50,
        ttlMs: 5000,
      },
      createdAt: "2026-07-25T00:00:00.000Z",
    },
  ],
};

const validManifest: GameActionManifest = {
  gameId: "zombie-survival",
  actions: {
    SPAWN: {
      parameters: { amount: "number" },
      allowAdditionalParameters: false,
    },
  },
};

const evalResult: MappingEvaluation = validEngine.evaluate({
  profile: validProfile,
  manifest: validManifest,
  event: null,
});

const seedInput: CandidateIdentityInput = {
  seedFormatVersion: 1,
  gameProfileId: "p",
  ruleId: "r",
  eventId: "e",
  candidateOrdinal: 0,
  actionType: "SPAWN",
  params: { amount: 1 },
};
const seedValue = createCandidateSeed(seedInput);
const canonicalValue = canonicalJson({ b: 2, a: 1 });

const diagnosticSample: MappingDiagnostic = {
  code: "PROFILE_INVALID",
  ruleId: null,
  message: "Invalid profile",
};

// 2. Active Rejections via @ts-expect-error

// @ts-expect-error Invalid matchMode literal
const invalidMatchMode: MatchMode = "some_invalid_mode";

// @ts-expect-error Invalid condition operator
const invalidOp: ConditionOperator = "like_regex";

// @ts-expect-error Invalid overflow policy
const invalidOverflow: OverflowPolicy = "queue_unbounded";

type RequireNoProperty<T, K extends string> = K extends keyof T ? never : true;

// @ts-expect-error Invented final actionId on MappingCandidate is forbidden
const _checkNoActionId: RequireNoProperty<MappingCandidate, "actionId"> = false;

// @ts-expect-error Invented final actionId on MappingProfile is forbidden
const _checkNoProfileActionId: RequireNoProperty<MappingProfile, "actionId"> = false;

// @ts-expect-error Invented transport/queue fields on MappingCandidate are forbidden
const _checkNoTransportField: RequireNoProperty<MappingCandidate, "transportDestination"> = false;

// @ts-expect-error Non-JSON value (BigInt) as condition value
const nonJsonCondition: EventCondition = { field: "payload.text", operator: "eq", value: 123n };

// @ts-expect-error Non-JSON value (BigInt) in action template parameters
const nonJsonTemplate: ActionTemplate = { actionType: "CHEER", parameters: { time: 123n } };

// @ts-expect-error Missing required nullable field exclusiveGroup
const missingNullableRule: MappingRule = {
  id: "rule_02",
  name: "Rule missing nullable",
  enabled: true,
  priority: 10,
  eventType: "gift.sent",
  conditions: [],
  transform: { actionType: "CHEER", parameters: {} },
  controls: {
    cooldownMs: 0,
    maxActionsPerMinute: 60,
    maxActionsPerUserPerMinute: 10,
    aggregationWindowMs: 0,
    actionPriority: 50,
    ttlMs: 5000,
  },
  createdAt: "2026-07-25T00:00:00.000Z",
};

// @ts-expect-error Wrong repository result discriminator
const invalidRepoResult: BudgetAdmissionResult = { admitted: true, reason: "GLOBAL_LIMIT" };

// @ts-expect-error Wrong mapping result status discriminator
const invalidMappingResultStatus: MappingResult = { status: "unknown_status" };

void validEngine;
void evalResult;
void seedValue;
void canonicalValue;
void diagnosticSample;
void invalidMatchMode;
void invalidOp;
void invalidOverflow;
void _checkNoActionId;
void _checkNoProfileActionId;
void _checkNoTransportField;
void nonJsonCondition;
void nonJsonTemplate;
void missingNullableRule;
void invalidRepoResult;
void invalidMappingResultStatus;
