import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const schemaVersions = sqliteTable("schema_versions", {
  version: integer("version").primaryKey(),
  migrationId: text("migration_id").notNull(),
  checksum: text("checksum").notNull(),
  appliedAt: integer("applied_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const connectorProfiles = sqliteTable("connector_profiles", {
  connectorId: text("connector_id").primaryKey(),
  profileJson: text("profile_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const gameManifests = sqliteTable("game_manifests", {
  gameId: text("game_id").primaryKey(),
  manifestJson: text("manifest_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const gameProfiles = sqliteTable("game_profiles", {
  profileId: text("profile_id").primaryKey(),
  gameId: text("game_id").notNull(),
  profileJson: text("profile_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const eventMappings = sqliteTable("event_mappings", {
  mappingId: text("mapping_id").primaryKey(),
  gameId: text("game_id").notNull(),
  mappingJson: text("mapping_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const eventLogs = sqliteTable("event_logs", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  eventJson: text("event_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const actionLogs = sqliteTable(
  "action_logs",
  {
    actionId: text("action_id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    eventId: text("event_id"),
    mappingId: text("mapping_id"),
    gameId: text("game_id").notNull(),
    actionType: text("action_type").notNull(),
    paramsJson: text("params_json").notNull(),
    status: text("status").notNull(),
    priority: integer("priority").notNull(),
    ttlMs: integer("ttl_ms").notNull(),
    retryCount: integer("retry_count").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    receivedAt: integer("received_at"),
    completedAt: integer("completed_at"),
    failureCode: text("failure_code"),
    resultJson: text("result_json"),
    reconciliationReason: text("reconciliation_reason"),
    runtimeId: text("runtime_id").notNull(),
    version: integer("version").notNull(),
    nextAttemptAt: integer("next_attempt_at"),
  },
  (table) => [
    uniqueIndex("action_logs_idempotency_key_unique").on(table.idempotencyKey),
    index("action_logs_retry_schedule_idx").on(table.status, table.nextAttemptAt),
  ],
);

export const actionAttempts = sqliteTable(
  "action_attempts",
  {
    actionId: text("action_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    runtimeId: text("runtime_id").notNull(),
    attemptedAt: integer("attempted_at").notNull(),
    outcome: text("outcome").notNull(),
    failureCode: text("failure_code"),
    gameInstanceId: text("game_instance_id"),
  },
  (table) => [
    uniqueIndex("action_attempts_action_number_unique").on(
      table.actionId,
      table.attemptNumber,
    ),
  ],
);

export const actionSendAuthorizations = sqliteTable(
  "action_send_authorizations",
  {
    authorizationId: text("authorization_id").primaryKey(),
    actionId: text("action_id").notNull(),
    expectedVersion: integer("expected_version").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    runtimeId: text("runtime_id").notNull(),
    runtimeOwnerId: text("runtime_owner_id").notNull(),
    role: text("role").notNull(),
    clientId: text("client_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
    revokedAt: integer("revoked_at"),
    gameInstanceId: text("game_instance_id"),
  },
  (table) => [
    uniqueIndex("action_send_authorizations_action_attempt_unique").on(
      table.actionId,
      table.attemptNumber,
    ),
  ],
);

export const runtimeOwnership = sqliteTable("runtime_ownership", {
  singletonId: integer("singleton_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  reconciledAt: integer("reconciled_at"),
});

export const mappingBudgetProfiles = sqliteTable("mapping_budget_profiles", {
  profileId: text("profile_id").primaryKey(),
  lastObservedAt: integer("last_observed_at").notNull(),
});

export const mappingBudgetUserBuckets = sqliteTable(
  "mapping_budget_user_buckets",
  {
    profileId: text("profile_id").notNull(),
    ruleId: text("rule_id").notNull(),
    userKey: text("user_key").notNull(),
    lastActiveAt: integer("last_active_at").notNull(),
  },
  (table) => [
    uniqueIndex("mapping_budget_user_bucket_unique").on(
      table.profileId,
      table.ruleId,
      table.userKey,
    ),
    index("mapping_budget_user_buckets_cleanup_idx").on(
      table.profileId,
      table.lastActiveAt,
      table.ruleId,
      table.userKey,
    ),
  ],
);

export const mappingBudgetUserEvents = sqliteTable(
  "mapping_budget_user_events",
  {
    sequence: integer("sequence").primaryKey({ autoIncrement: true }),
    profileId: text("profile_id").notNull(),
    ruleId: text("rule_id").notNull(),
    userKey: text("user_key").notNull(),
    admittedAt: integer("admitted_at").notNull(),
  },
  (table) => [
    index("mapping_budget_user_events_window_idx").on(
      table.profileId,
      table.ruleId,
      table.userKey,
      table.admittedAt,
    ),
  ],
);

export const mappingBudgetRuleEvents = sqliteTable(
  "mapping_budget_rule_events",
  {
    sequence: integer("sequence").primaryKey({ autoIncrement: true }),
    profileId: text("profile_id").notNull(),
    ruleId: text("rule_id").notNull(),
    admittedAt: integer("admitted_at").notNull(),
  },
  (table) => [
    index("mapping_budget_rule_events_window_idx").on(
      table.profileId,
      table.ruleId,
      table.admittedAt,
    ),
  ],
);

export const mappingBudgetCooldowns = sqliteTable(
  "mapping_budget_cooldowns",
  {
    profileId: text("profile_id").notNull(),
    ruleId: text("rule_id").notNull(),
    lastAcceptedAt: integer("last_accepted_at").notNull(),
  },
  (table) => [
    uniqueIndex("mapping_budget_cooldown_unique").on(table.profileId, table.ruleId),
  ],
);

export const mappingBudgetGameTokens = sqliteTable("mapping_budget_game_tokens", {
  profileId: text("profile_id").primaryKey(),
  tokens: real("tokens").notNull(),
  refilledAt: integer("refilled_at").notNull(),
});

export const mappingBudgetDeferredCandidates = sqliteTable(
  "mapping_budget_deferred_candidates",
  {
    idempotencySeed: text("idempotency_seed").primaryKey(),
    gameProfileId: text("game_profile_id").notNull(),
    gameId: text("game_id").notNull(),
    ruleId: text("rule_id").notNull(),
    eventId: text("event_id").notNull(),
    candidateOrdinal: integer("candidate_ordinal").notNull(),
    actionType: text("action_type").notNull(),
    paramsJson: text("params_json").notNull(),
    actorJson: text("actor_json"),
    priority: integer("priority").notNull(),
    actionPriority: integer("action_priority").notNull(),
    candidateTtlMs: integer("candidate_ttl_ms").notNull(),
    deferredExpiresAt: integer("deferred_expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    admissionSnapshotJson: text("admission_snapshot_json").notNull(),
    status: text("status").notNull().default("queued"),
    owningRuntimeId: text("owning_runtime_id").notNull(),
    promotedActionId: text("promoted_action_id"),
    promotedAt: integer("promoted_at"),
  },
  (table) => [
    index("mapping_budget_deferred_promotion_idx").on(
      table.gameId,
      table.status,
      table.priority,
      table.createdAt,
    ),
  ],
);
