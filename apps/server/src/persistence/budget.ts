import type { DatabaseSync } from "node:sqlite";
import type {
  BudgetAdmissionRequest,
  BudgetAdmissionResult,
} from "@crowdcircuit/mapping-engine";
import { PersistenceError } from "./types.js";

function isTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validate(input: BudgetAdmissionRequest): void {
  if (
    !isTimestamp(input.now) ||
    !Number.isSafeInteger(input.userLimitPerMinute) ||
    input.userLimitPerMinute <= 0 ||
    !Number.isSafeInteger(input.ruleLimitPerMinute) ||
    input.ruleLimitPerMinute <= 0 ||
    !isTimestamp(input.cooldownMs) ||
    !Number.isFinite(input.globalBudget.maxPerSecond) ||
    input.globalBudget.maxPerSecond <= 0 ||
    !Number.isFinite(input.globalBudget.burst) ||
    input.globalBudget.burst <= 0 ||
    !Number.isSafeInteger(input.capacity.maxUserBuckets) ||
    input.capacity.maxUserBuckets <= 0 ||
    !Number.isSafeInteger(input.capacity.inactiveRetentionMs) ||
    input.capacity.inactiveRetentionMs < 60_000 ||
    !Number.isSafeInteger(input.capacity.sweepLimit) ||
    input.capacity.sweepLimit <= 0
  ) {
    throw new PersistenceError("INVALID_INPUT", "Budget admission input is invalid");
  }
  for (const value of [
    input.candidate.gameProfileId,
    input.candidate.ruleId,
    input.candidate.userBudgetKey,
  ]) {
    if (value.length === 0 || value.length > 1024) {
      throw new PersistenceError("INVALID_INPUT", "Budget identity is invalid");
    }
  }
}

function numberField(row: object | undefined, field: string): number | undefined {
  if (row === undefined) return undefined;
  const value = Reflect.get(row, field);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function rollback(database: DatabaseSync): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Preserve the original typed failure.
  }
}

export function admitMappingBudget(
  database: DatabaseSync,
  input: BudgetAdmissionRequest,
  requireActiveOwner: () => void,
  transactionFault: (() => void) | null,
): BudgetAdmissionResult {
  try {
    database.exec("BEGIN IMMEDIATE");
    const result = admitMappingBudgetInTransaction(database, input, requireActiveOwner);
    if (!result.admitted) {
      rollback(database);
      return result;
    }
    transactionFault?.();
    requireActiveOwner();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    rollback(database);
    if (
      error instanceof PersistenceError &&
      error.code !== "RUNTIME_SUPERSEDED" &&
      error.code !== "DATABASE_UNAVAILABLE"
    ) {
      throw error;
    }
    return { admitted: false, reason: "PERSISTENCE_UNAVAILABLE" };
  }
}

/** @internal Executes complete admission inside a caller-owned write transaction. */
export function admitMappingBudgetInTransaction(
  database: DatabaseSync,
  input: BudgetAdmissionRequest,
  requireActiveOwner: () => void,
): BudgetAdmissionResult {
  validate(input);
  const profileId = input.candidate.gameProfileId;
  const ruleId = input.candidate.ruleId;
  const userKey = input.candidate.userBudgetKey;
  const windowStart = input.now - 60_000;
  const inactiveBefore = input.now - input.capacity.inactiveRetentionMs;
  requireActiveOwner();

    const profile = database
      .prepare("SELECT last_observed_at FROM mapping_budget_profiles WHERE profile_id = ?")
      .get(profileId);
    const lastObserved = numberField(profile, "last_observed_at");
    if (profile !== undefined && lastObserved === undefined) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Budget clock state is invalid");
    }
    if (lastObserved !== undefined && input.now < lastObserved) {
      return { admitted: false, reason: "CLOCK_ROLLBACK" };
    }

    const bucket = database
      .prepare(
        `SELECT last_active_at FROM mapping_budget_user_buckets
         WHERE profile_id = ? AND rule_id = ? AND user_key = ?`,
      )
      .get(profileId, ruleId, userKey);
    const bucketLastActive = numberField(bucket, "last_active_at");
    if (bucket !== undefined && bucketLastActive === undefined) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Budget bucket is invalid");
    }
    const bucketIsActive =
      bucketLastActive !== undefined && bucketLastActive >= inactiveBefore;
    if (!bucketIsActive) {
      const activeCount = numberField(
        database
          .prepare(
            `SELECT COUNT(*) AS count FROM mapping_budget_user_buckets
             WHERE profile_id = ? AND last_active_at >= ?`,
          )
          .get(profileId, inactiveBefore),
        "count",
      );
      if (activeCount === undefined) {
        throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Budget capacity state is invalid");
      }
      if (activeCount >= input.capacity.maxUserBuckets) {
        return { admitted: false, reason: "CAPACITY_EXHAUSTED" };
      }
    }

    const userCount = numberField(
      database
        .prepare(
          `SELECT COUNT(*) AS count FROM mapping_budget_user_events
           WHERE profile_id = ? AND rule_id = ? AND user_key = ? AND admitted_at > ?`,
        )
        .get(profileId, ruleId, userKey, windowStart),
      "count",
    );
    if (userCount === undefined) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "User budget state is invalid");
    }
    if (userCount >= input.userLimitPerMinute) {
      return { admitted: false, reason: "USER_LIMIT" };
    }

    const cooldownRow = database
      .prepare(
        `SELECT last_accepted_at FROM mapping_budget_cooldowns
         WHERE profile_id = ? AND rule_id = ?`,
      )
      .get(profileId, ruleId);
    const lastAccepted = numberField(cooldownRow, "last_accepted_at");
    if (cooldownRow !== undefined && lastAccepted === undefined) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Cooldown state is invalid");
    }
    if (lastAccepted !== undefined && input.now - lastAccepted < input.cooldownMs) {
      return { admitted: false, reason: "RULE_COOLDOWN" };
    }

    const ruleCount = numberField(
      database
        .prepare(
          `SELECT COUNT(*) AS count FROM mapping_budget_rule_events
           WHERE profile_id = ? AND rule_id = ? AND admitted_at > ?`,
        )
        .get(profileId, ruleId, windowStart),
      "count",
    );
    if (ruleCount === undefined) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Rule budget state is invalid");
    }
    if (ruleCount >= input.ruleLimitPerMinute) {
      return { admitted: false, reason: "RULE_LIMIT" };
    }

    const tokenRow = database
      .prepare("SELECT tokens, refilled_at FROM mapping_budget_game_tokens WHERE profile_id = ?")
      .get(profileId);
    const storedTokens = numberField(tokenRow, "tokens");
    const refilledAt = numberField(tokenRow, "refilled_at");
    if (tokenRow !== undefined && (storedTokens === undefined || refilledAt === undefined)) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Token bucket state is invalid");
    }
    if (refilledAt !== undefined && input.now < refilledAt) {
      return { admitted: false, reason: "CLOCK_ROLLBACK" };
    }
    const tokens =
      storedTokens === undefined || refilledAt === undefined
        ? input.globalBudget.burst
        : Math.min(
            input.globalBudget.burst,
            storedTokens +
              ((input.now - refilledAt) / 1000) * input.globalBudget.maxPerSecond,
          );
    if (tokens < 1) {
      return { admitted: false, reason: "GLOBAL_LIMIT" };
    }

    database
      .prepare(
        `INSERT INTO mapping_budget_profiles(profile_id, last_observed_at)
         VALUES (?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET last_observed_at = excluded.last_observed_at`,
      )
      .run(profileId, input.now);
    database
      .prepare(
        `INSERT INTO mapping_budget_user_buckets(profile_id, rule_id, user_key, last_active_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(profile_id, rule_id, user_key)
         DO UPDATE SET last_active_at = excluded.last_active_at`,
      )
      .run(profileId, ruleId, userKey, input.now);
    database
      .prepare(
        `INSERT INTO mapping_budget_user_events(profile_id, rule_id, user_key, admitted_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(profileId, ruleId, userKey, input.now);
    database
      .prepare(
        `INSERT INTO mapping_budget_rule_events(profile_id, rule_id, admitted_at)
         VALUES (?, ?, ?)`,
      )
      .run(profileId, ruleId, input.now);
    database
      .prepare(
        `INSERT INTO mapping_budget_cooldowns(profile_id, rule_id, last_accepted_at)
         VALUES (?, ?, ?)
         ON CONFLICT(profile_id, rule_id)
         DO UPDATE SET last_accepted_at = excluded.last_accepted_at`,
      )
      .run(profileId, ruleId, input.now);
    database
      .prepare(
        `INSERT INTO mapping_budget_game_tokens(profile_id, tokens, refilled_at)
         VALUES (?, ?, ?)
         ON CONFLICT(profile_id)
         DO UPDATE SET tokens = excluded.tokens, refilled_at = excluded.refilled_at`,
      )
      .run(profileId, tokens - 1, input.now);

    const inactive = database
      .prepare(
        `SELECT rule_id, user_key FROM mapping_budget_user_buckets
         WHERE profile_id = ? AND last_active_at < ?
         ORDER BY last_active_at ASC, rule_id ASC, user_key ASC
         LIMIT ?`,
      )
      .all(profileId, inactiveBefore, input.capacity.sweepLimit);
    for (const row of inactive) {
      const oldRule = Reflect.get(row, "rule_id");
      const oldUser = Reflect.get(row, "user_key");
      if (typeof oldRule !== "string" || typeof oldUser !== "string") {
        throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Cleanup state is invalid");
      }
      database
        .prepare(
          `DELETE FROM mapping_budget_user_events
           WHERE profile_id = ? AND rule_id = ? AND user_key = ?`,
        )
        .run(profileId, oldRule, oldUser);
      database
        .prepare(
          `DELETE FROM mapping_budget_user_buckets
           WHERE profile_id = ? AND rule_id = ? AND user_key = ?`,
        )
        .run(profileId, oldRule, oldUser);
    }
    database
      .prepare(
        "DELETE FROM mapping_budget_rule_events WHERE profile_id = ? AND admitted_at <= ?",
      )
      .run(profileId, windowStart);
    database
      .prepare(
        "DELETE FROM mapping_budget_user_events WHERE profile_id = ? AND admitted_at <= ?",
      )
      .run(profileId, windowStart);

  return { admitted: true };
}
