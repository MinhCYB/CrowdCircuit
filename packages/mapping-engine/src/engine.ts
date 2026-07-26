import {
  JsonValueSchema,
  LiveEventEnvelopeSchema,
  type JsonValue,
  type LiveEvent,
} from "@crowdcircuit/contracts";
import { canonicalJson, createCandidateSeed } from "./canonical.js";
import {
  GameActionManifestSchema,
  MAPPING_SEED_FORMAT_VERSION,
  MappingProfileSchema,
  type DurableBudgetRepository,
  type BudgetAdmissionResult,
  type CandidateIdentityInput,
  type EventCondition,
  type GameActionManifest,
  type ManifestParameterType,
  type MappingCandidate,
  type MappingDiagnostic,
  type MappingEvaluation,
  type MappingProfile,
  type MappingResult,
  type MappingRule,
  type TrustedClock,
  type EvaluateMappingInput,
} from "./model.js";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function readPath(root: object, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    if (FORBIDDEN_SEGMENTS.has(segment)) return undefined;
    if (!Object.hasOwn(current, segment)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(current, segment);
    if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || !("value" in descriptor)) {
      return undefined;
    }
    current = descriptor.value;
  }
  return current;
}

function equalJson(left: unknown, right: JsonValue): boolean {
  const parsed = JsonValueSchema.safeParse(left);
  return parsed.success && canonicalJson(parsed.data) === canonicalJson(right);
}

function conditionMatches(event: LiveEvent, condition: EventCondition): boolean {
  const actual = readPath(event, condition.field);
  switch (condition.operator) {
    case "eq":
      return equalJson(actual, condition.value);
    case "neq":
      return !equalJson(actual, condition.value);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (typeof actual !== "number" || typeof condition.value !== "number") return false;
      if (condition.operator === "gt") return actual > condition.value;
      if (condition.operator === "gte") return actual >= condition.value;
      if (condition.operator === "lt") return actual < condition.value;
      return actual <= condition.value;
    }
    case "contains":
      return (
        (typeof actual === "string" &&
          typeof condition.value === "string" &&
          actual.includes(condition.value)) ||
        (Array.isArray(actual) &&
          actual.some((item) => equalJson(item, condition.value)))
      );
    case "startsWith":
      return (
        typeof actual === "string" &&
        typeof condition.value === "string" &&
        actual.startsWith(condition.value)
      );
    case "regex":
      return (
        typeof actual === "string" &&
        typeof condition.value === "string" &&
        new RegExp(condition.value, "u").test(actual)
      );
    case "in":
      return Array.isArray(condition.value) && condition.value.some((item) => equalJson(actual, item));
  }
}

/**
 * Approved +100 specificity condition fields.
 * - payload.gift.id: Exact gift ID condition (+100)
 * - payload.textNormalized: Exact command text condition (+100)
 * Adding another +100 path requires an explicit policy update and regression case.
 */
const SPECIFICITY_EXACT_FIELDS = new Set([
  "payload.gift.id",
  "payload.textNormalized",
]);

function specificity(rule: MappingRule): number {
  return rule.conditions.reduce((score, condition) => {
    if (
      condition.operator === "eq" &&
      SPECIFICITY_EXACT_FIELDS.has(condition.field)
    ) {
      return score + 100;
    }
    if (condition.operator === "eq") return score + 50;
    if (["gt", "gte", "lt", "lte"].includes(condition.operator)) return score + 30;
    if (condition.operator === "contains" || condition.operator === "startsWith") {
      return score + 20;
    }
    if (condition.operator === "regex") return score + 10;
    return score;
  }, 0);
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareRules(left: MappingRule, right: MappingRule): number {
  return (
    right.priority - left.priority ||
    specificity(right) - specificity(left) ||
    compareOrdinal(left.createdAt, right.createdAt) ||
    compareOrdinal(left.id, right.id)
  );
}

function selectRules(profile: MappingProfile, rules: readonly MappingRule[]): readonly MappingRule[] {
  if (profile.matchMode === "first") return rules.slice(0, 1);
  if (profile.matchMode === "all") return rules;
  const groups = new Set<string>();
  return rules.filter((rule) => {
    const group = rule.exclusiveGroup ?? `ungrouped:${rule.id}`;
    if (groups.has(group)) return false;
    groups.add(group);
    return true;
  });
}

function resolveTemplate(value: JsonValue, event: LiveEvent): JsonValue | undefined {
  if (typeof value === "string") {
    const exact = /^\{\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}$/.exec(value);
    if (exact !== null) {
      const resolved = readPath(event, exact[1] ?? "");
      const parsed = JsonValueSchema.safeParse(resolved);
      return parsed.success ? parsed.data : undefined;
    }
    let invalid = false;
    const resolved = value.replace(
      /\{\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}/g,
      (_whole, path: string) => {
        const field = readPath(event, path);
        if (
          field === undefined ||
          (typeof field === "object" && field !== null)
        ) {
          invalid = true;
          return "";
        }
        return field === null ? "null" : String(field);
      },
    );
    return invalid ? undefined : resolved;
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const output: JsonValue[] = [];
    for (const item of value) {
      const resolved = resolveTemplate(item, event);
      if (resolved === undefined) return undefined;
      output.push(resolved);
    }
    return output;
  }
  const output: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort()) {
    const resolved = resolveTemplate(Reflect.get(value, key), event);
    if (resolved === undefined) return undefined;
    output[key] = resolved;
  }
  return output;
}

function parameterMatches(value: JsonValue, type: ManifestParameterType): boolean {
  if (type === "json") return true;
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === type;
}

function manifestAllows(
  manifest: GameActionManifest,
  actionType: string,
  params: JsonValue,
): boolean {
  const action = manifest.actions[actionType];
  if (action === undefined) return false;
  if (typeof params !== "object" || params === null || Array.isArray(params)) return false;
  const definitions = action.parameters;
  for (const key of Object.keys(definitions)) {
    if (!Object.hasOwn(params, key)) return false;
    const expected = definitions[key];
    const value = params[key];
    if (expected === undefined || value === undefined || !parameterMatches(value, expected)) {
      return false;
    }
  }
  return (
    action.allowAdditionalParameters ||
    Object.keys(params).every((key) => Object.hasOwn(definitions, key))
  );
}

const USER_BUDGET_KEY_FORMAT_VERSION = 1 as const;

function userBudgetKey(event: LiveEvent, gameProfileId: string, ruleId: string): string {
  const identity =
    event.user !== null &&
    typeof event.user.id === "string" &&
    event.user.id.length > 0
      ? { kind: "id" as const, value: event.user.id }
      : event.user !== null &&
          typeof event.user.uniqueId === "string" &&
          event.user.uniqueId.length > 0
        ? { kind: "uniqueId" as const, value: event.user.uniqueId }
        : { kind: "anonymous" as const, value: null };
  return canonicalJson({
    keyFormatVersion: USER_BUDGET_KEY_FORMAT_VERSION,
    gameProfileId,
    ruleId,
    identity,
  });
}

export class MappingEngine {
  readonly #repository: DurableBudgetRepository;
  readonly #clock: TrustedClock;

  constructor(repository: DurableBudgetRepository, clock: TrustedClock) {
    this.#repository = repository;
    this.#clock = clock;
  }

  /**
   * Evaluates a normalized live event against a mapping profile and game manifest.
   *
   * Dry-run mode note:
   * - Dry-run (`dryRun: true`) proves profile/manifest validation, condition matching,
   *   rule ordering, and action template parameter resolution.
   * - It does NOT evaluate or prove durable budget admission success.
   * - Dry-run consumes zero budget capacity and persists no budget state.
   */
  evaluate(input: EvaluateMappingInput): MappingEvaluation {
    const profile = MappingProfileSchema.safeParse(input.profile);
    if (!profile.success) {
      return {
        success: false,
        results: [],
        diagnostics: [{ code: "PROFILE_INVALID", ruleId: null, message: "Mapping profile is invalid" }],
      };
    }
    const event = LiveEventEnvelopeSchema.safeParse(input.event);
    if (!event.success) {
      return {
        success: false,
        results: [],
        diagnostics: [{ code: "EVENT_INVALID", ruleId: null, message: "Normalized event is invalid" }],
      };
    }
    const manifest = GameActionManifestSchema.safeParse(input.manifest);
    if (!manifest.success || manifest.data.gameId !== profile.data.gameId) {
      return {
        success: false,
        results: [],
        diagnostics: [{ code: "MANIFEST_INVALID", ruleId: null, message: "Game manifest is invalid" }],
      };
    }
    return this.#evaluateValid(profile.data, manifest.data, event.data, input.dryRun === true);
  }

  #evaluateValid(
    profile: MappingProfile,
    manifest: GameActionManifest,
    event: LiveEvent,
    dryRun: boolean,
  ): MappingEvaluation {
    const diagnostics: MappingDiagnostic[] = [];
    const matched = profile.rules
      .filter((rule) => rule.enabled && rule.eventType === event.eventType)
      .filter((rule) => {
        const matches = rule.conditions.every((condition) => conditionMatches(event, condition));
        if (!matches) {
          diagnostics.push({
            code: "CONDITION_NOT_MATCHED",
            ruleId: rule.id,
            message: "Rule conditions did not match",
          });
        }
        return matches;
      })
      .sort(compareRules);
    const selected = selectRules(profile, matched);
    const selectedIds = new Set(selected.map((rule) => rule.id));
    for (const rule of matched) {
      if (!selectedIds.has(rule.id)) {
        diagnostics.push({
          code: "MATCH_MODE_DISCARDED",
          ruleId: rule.id,
          message: "Rule was discarded by match-mode resolution",
        });
      }
    }
    const results: MappingResult[] = [];
    for (let ordinal = 0; ordinal < selected.length; ordinal += 1) {
      const rule = selected[ordinal];
      if (rule === undefined) continue;
      const params = resolveTemplate(rule.transform.parameters, event);
      if (params === undefined || !manifestAllows(manifest, rule.transform.actionType, params)) {
        diagnostics.push({
          code: params === undefined ? "TEMPLATE_INVALID" : "MANIFEST_INVALID",
          ruleId: rule.id,
          message: "Resolved action does not satisfy the manifest",
        });
        continue;
      }
      const seedInput = {
        seedFormatVersion: MAPPING_SEED_FORMAT_VERSION,
        gameProfileId: profile.gameProfileId,
        ruleId: rule.id,
        eventId: event.eventId,
        candidateOrdinal: ordinal,
        actionType: rule.transform.actionType,
        params,
      } satisfies CandidateIdentityInput;
      const candidate: MappingCandidate = {
        idempotencySeed: createCandidateSeed(seedInput),
        seedInput,
        gameProfileId: profile.gameProfileId,
        gameId: profile.gameId,
        ruleId: rule.id,
        eventId: event.eventId,
        eventType: event.eventType,
        candidateOrdinal: ordinal,
        actionType: rule.transform.actionType,
        params,
        actor:
          event.user === null
            ? null
            : {
                viewerId: event.user.id ?? event.user.uniqueId,
                displayName: event.user.displayName,
                avatarUrl: event.user.avatarUrl,
              },
        userBudgetKey: userBudgetKey(event, profile.gameProfileId, rule.id),
        priority: rule.priority,
        actionPriority: rule.controls.actionPriority,
        ttlMs: rule.controls.ttlMs,
      };
      if (dryRun) {
        results.push({ status: "accepted", candidate });
        continue;
      }
      const now = this.#clock.now();
      let admission: BudgetAdmissionResult;
      try {
        admission = this.#repository.admit({
          candidate,
          now,
          userLimitPerMinute: rule.controls.maxActionsPerUserPerMinute,
          ruleLimitPerMinute: rule.controls.maxActionsPerMinute,
          cooldownMs: rule.controls.cooldownMs,
          globalBudget: profile.globalActionBudget,
          capacity: profile.capacity,
        });
      } catch {
        admission = { admitted: false, reason: "PERSISTENCE_UNAVAILABLE" };
      }
      if (admission.admitted) {
        results.push({ status: "accepted", candidate });
      } else if (admission.reason === "GLOBAL_LIMIT") {
        if (profile.globalActionBudget.overflowPolicy === "drop_low_priority") {
          results.push({ status: "dropped", candidate, reason: "GLOBAL_LIMIT" });
        } else if (profile.globalActionBudget.overflowPolicy === "queue_with_ttl") {
          results.push({
            status: "deferred",
            candidate,
            expiresAt: now + (profile.globalActionBudget.deferredTtlMs ?? 0),
            reason: "GLOBAL_LIMIT",
          });
        } else {
          results.push({ status: "rejected", candidate, reason: "GLOBAL_LIMIT" });
        }
      } else {
        results.push({ status: "rejected", candidate, reason: admission.reason });
      }
      if (!admission.admitted) {
        diagnostics.push({
          code: "BUDGET_REJECTED",
          ruleId: rule.id,
          message: `Budget admission failed: ${admission.reason}`,
        });
      }
    }
    return { success: true, results, diagnostics };
  }
}
