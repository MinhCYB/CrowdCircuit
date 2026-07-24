import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  },
  (table) => [uniqueIndex("action_logs_idempotency_key_unique").on(table.idempotencyKey)],
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
