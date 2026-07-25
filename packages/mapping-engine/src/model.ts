import {
  JsonValueSchema,
  type GameActionActor,
} from "@crowdcircuit/contracts";
import { z } from "zod";

const NonemptyIdSchema = z.string().min(1).max(256);
const SafeIntegerSchema = z.number().int().safe();
const NonnegativeSafeIntegerSchema = SafeIntegerSchema.nonnegative();
const PositiveSafeIntegerSchema = SafeIntegerSchema.positive();

export const MAPPING_SEED_FORMAT_VERSION = 1 as const;

export const ConditionOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "startsWith",
  "regex",
  "in",
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const EventConditionSchema = z
  .object({
    field: z.string().min(1).max(256).regex(/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/),
    operator: ConditionOperatorSchema,
    value: JsonValueSchema,
  })
  .strict()
  .superRefine((condition, context) => {
    if (condition.operator === "regex") {
      if (typeof condition.value !== "string") {
        context.addIssue({ code: "custom", message: "Regex value must be a string" });
      } else {
        try {
          new RegExp(condition.value, "u");
        } catch {
          context.addIssue({ code: "custom", message: "Regex is invalid" });
        }
      }
    }
    if (condition.operator === "in" && !Array.isArray(condition.value)) {
      context.addIssue({ code: "custom", message: "In value must be an array" });
    }
  });
export type EventCondition = z.infer<typeof EventConditionSchema>;

export const ActionTemplateSchema = z
  .object({
    actionType: NonemptyIdSchema,
    parameters: JsonValueSchema,
  })
  .strict();
export type ActionTemplate = z.infer<typeof ActionTemplateSchema>;

export const MappingRuleControlsSchema = z
  .object({
    cooldownMs: NonnegativeSafeIntegerSchema,
    maxActionsPerMinute: PositiveSafeIntegerSchema,
    maxActionsPerUserPerMinute: PositiveSafeIntegerSchema,
    aggregationWindowMs: z.literal(0),
    actionPriority: SafeIntegerSchema,
    ttlMs: PositiveSafeIntegerSchema,
  })
  .strict();
export type MappingRuleControls = z.infer<typeof MappingRuleControlsSchema>;

export const MappingRuleSchema = z
  .object({
    id: NonemptyIdSchema,
    name: z.string().min(1).max(256),
    enabled: z.boolean(),
    priority: SafeIntegerSchema,
    exclusiveGroup: NonemptyIdSchema.nullable(),
    eventType: NonemptyIdSchema,
    conditions: z.array(EventConditionSchema).max(32),
    transform: ActionTemplateSchema,
    controls: MappingRuleControlsSchema,
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type MappingRule = z.infer<typeof MappingRuleSchema>;

export const MatchModeSchema = z.enum(["all", "first", "exclusive_group"]);
export type MatchMode = z.infer<typeof MatchModeSchema>;

export const OverflowPolicySchema = z.enum([
  "drop_low_priority",
  "queue_with_ttl",
  "reject_newest",
]);
export type OverflowPolicy = z.infer<typeof OverflowPolicySchema>;

export const GlobalActionBudgetSchema = z
  .object({
    maxPerSecond: z.number().finite().positive(),
    burst: z.number().finite().positive(),
    overflowPolicy: OverflowPolicySchema,
    deferredTtlMs: PositiveSafeIntegerSchema.nullable(),
  })
  .strict()
  .superRefine((budget, context) => {
    if (
      budget.overflowPolicy === "queue_with_ttl" &&
      budget.deferredTtlMs === null
    ) {
      context.addIssue({
        code: "custom",
        message: "queue_with_ttl requires deferredTtlMs",
      });
    }
  });
export type GlobalActionBudget = z.infer<typeof GlobalActionBudgetSchema>;

export const BudgetCapacitySchema = z
  .object({
    maxUserBuckets: PositiveSafeIntegerSchema.default(4096),
    inactiveRetentionMs: PositiveSafeIntegerSchema.default(600_000),
    sweepLimit: PositiveSafeIntegerSchema.max(4096).default(128),
  })
  .strict();
export type BudgetCapacity = z.infer<typeof BudgetCapacitySchema>;

export const MappingProfileSchema = z
  .object({
    gameProfileId: NonemptyIdSchema,
    gameId: NonemptyIdSchema,
    matchMode: MatchModeSchema,
    globalActionBudget: GlobalActionBudgetSchema,
    capacity: BudgetCapacitySchema.default({
      maxUserBuckets: 4096,
      inactiveRetentionMs: 600_000,
      sweepLimit: 128,
    }),
    rules: z.array(MappingRuleSchema).max(4096),
  })
  .strict()
  .superRefine((profile, context) => {
    const ids = new Set<string>();
    for (const rule of profile.rules) {
      if (ids.has(rule.id)) {
        context.addIssue({ code: "custom", message: "Rule IDs must be unique" });
      }
      ids.add(rule.id);
      if (profile.capacity.inactiveRetentionMs < Math.max(60_000, rule.controls.cooldownMs)) {
        context.addIssue({
          code: "custom",
          message: "Inactive retention must cover every live budget window",
        });
      }
    }
  });
export type MappingProfile = z.infer<typeof MappingProfileSchema>;

export const ManifestParameterTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null",
  "json",
]);
export type ManifestParameterType = z.infer<typeof ManifestParameterTypeSchema>;

export const GameActionManifestSchema = z
  .object({
    gameId: NonemptyIdSchema,
    actions: z.record(
      NonemptyIdSchema,
      z
        .object({
          parameters: z.record(NonemptyIdSchema, ManifestParameterTypeSchema),
          allowAdditionalParameters: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type GameActionManifest = z.infer<typeof GameActionManifestSchema>;

export interface TrustedClock {
  now(): number;
}

export interface CandidateIdentityInput {
  readonly seedFormatVersion: typeof MAPPING_SEED_FORMAT_VERSION;
  readonly gameProfileId: string;
  readonly ruleId: string;
  readonly eventId: string;
  readonly candidateOrdinal: number;
  readonly actionType: string;
  readonly params: z.infer<typeof JsonValueSchema>;
}

export interface MappingCandidate {
  readonly idempotencySeed: string;
  readonly seedInput: CandidateIdentityInput;
  readonly gameProfileId: string;
  readonly gameId: string;
  readonly ruleId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly candidateOrdinal: number;
  readonly actionType: string;
  readonly params: z.infer<typeof JsonValueSchema>;
  readonly actor: GameActionActor | null;
  readonly userBudgetKey: string;
  readonly priority: number;
  readonly actionPriority: number;
  readonly ttlMs: number;
}

export interface BudgetAdmissionRequest {
  readonly candidate: MappingCandidate;
  readonly now: number;
  readonly userLimitPerMinute: number;
  readonly ruleLimitPerMinute: number;
  readonly cooldownMs: number;
  readonly globalBudget: GlobalActionBudget;
  readonly capacity: BudgetCapacity;
}

export type BudgetRejectionReason =
  | "USER_LIMIT"
  | "RULE_COOLDOWN"
  | "RULE_LIMIT"
  | "GLOBAL_LIMIT"
  | "CAPACITY_EXHAUSTED"
  | "CLOCK_ROLLBACK"
  | "PERSISTENCE_UNAVAILABLE";

export type BudgetAdmissionResult =
  | { readonly admitted: true }
  | { readonly admitted: false; readonly reason: BudgetRejectionReason };

export interface DurableBudgetRepository {
  admit(request: BudgetAdmissionRequest): BudgetAdmissionResult;
}

export type MappingResult =
  | { readonly status: "accepted"; readonly candidate: MappingCandidate }
  | {
      readonly status: "rejected";
      readonly candidate: MappingCandidate;
      readonly reason: BudgetRejectionReason | "MANIFEST_INVALID";
    }
  | {
      readonly status: "dropped";
      readonly candidate: MappingCandidate;
      readonly reason: "GLOBAL_LIMIT";
    }
  | {
      readonly status: "deferred";
      readonly candidate: MappingCandidate;
      readonly expiresAt: number;
      readonly reason: "GLOBAL_LIMIT";
    };

export interface MappingDiagnostic {
  readonly code:
    | "PROFILE_INVALID"
    | "EVENT_INVALID"
    | "MANIFEST_INVALID"
    | "CONDITION_NOT_MATCHED"
    | "MATCH_MODE_DISCARDED"
    | "TEMPLATE_INVALID"
    | "BUDGET_REJECTED";
  readonly ruleId: string | null;
  readonly message: string;
}

export type MappingEvaluation =
  | {
      readonly success: true;
      readonly results: readonly MappingResult[];
      readonly diagnostics: readonly MappingDiagnostic[];
    }
  | {
      readonly success: false;
      readonly results: readonly [];
      readonly diagnostics: readonly MappingDiagnostic[];
    };

export interface EvaluateMappingInput {
  readonly profile: unknown;
  readonly manifest: unknown;
  readonly event: unknown;
  readonly dryRun?: boolean;
}
