import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { PersistenceError } from "./types.js";

export interface Migration {
  readonly version: number;
  readonly id: string;
  readonly sql: string;
}

export const CURRENT_SCHEMA_VERSION = 1;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    id: "phase-c-foundation",
    sql: `
CREATE TABLE app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE connector_profiles (connector_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE game_manifests (game_id TEXT PRIMARY KEY, manifest_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE game_profiles (profile_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, profile_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE event_mappings (mapping_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, mapping_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE event_logs (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, event_json TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE action_logs (
  action_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_id TEXT,
  mapping_id TEXT,
  game_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  ttl_ms INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  received_at INTEGER,
  completed_at INTEGER,
  failure_code TEXT,
  result_json TEXT,
  reconciliation_reason TEXT,
  runtime_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE action_attempts (
  action_id TEXT NOT NULL REFERENCES action_logs(action_id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  runtime_id TEXT NOT NULL,
  attempted_at INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  failure_code TEXT,
  PRIMARY KEY (action_id, attempt_number)
);
CREATE TABLE action_send_authorizations (
  authorization_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES action_logs(action_id) ON DELETE CASCADE,
  expected_version INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  runtime_id TEXT NOT NULL,
  runtime_owner_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'game'),
  client_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  revoked_at INTEGER,
  UNIQUE (action_id, attempt_number)
);
CREATE TABLE runtime_ownership (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  owner_id TEXT NOT NULL,
  reconciled_at INTEGER
);
CREATE INDEX action_logs_status_idx ON action_logs(status);
CREATE INDEX action_logs_created_at_idx ON action_logs(created_at);
CREATE INDEX event_logs_created_at_idx ON event_logs(created_at);
`,
  },
];

function validateMigrations(migrations: readonly Migration[]): void {
  if (migrations.length === 0) {
    throw new PersistenceError(
      "INVALID_MIGRATION_MANIFEST",
      "Migration sequence is invalid",
    );
  }
  const ids = new Set<string>();
  let expected = 1;
  for (const migration of migrations) {
    if (
      !Number.isSafeInteger(migration.version) ||
      migration.version <= 0 ||
      migration.version !== expected ||
      migration.id.length === 0 ||
      ids.has(migration.id) ||
      migration.sql.trim().length === 0
    ) {
      throw new PersistenceError(
        "INVALID_MIGRATION_MANIFEST",
        "Migration sequence is invalid",
      );
    }
    ids.add(migration.id);
    expected += 1;
  }
}

function checksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export function migrateDatabase(
  database: DatabaseSync,
  migrations: readonly Migration[] = MIGRATIONS,
): number {
  validateMigrations(migrations);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(
      `CREATE TABLE IF NOT EXISTS schema_versions (
        version INTEGER PRIMARY KEY,
        migration_id TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )`,
    );
    const history = database
      .prepare(
        "SELECT version, migration_id, checksum FROM schema_versions ORDER BY version",
      )
      .all();
    for (let index = 0; index < history.length; index += 1) {
      const row = history[index];
      const version = Reflect.get(row, "version");
      const migrationId = Reflect.get(row, "migration_id");
      const storedChecksum = Reflect.get(row, "checksum");
      const approved = migrations[index];
      if (
        typeof version !== "number" ||
        version !== index + 1 ||
        approved === undefined ||
        migrationId !== approved.id ||
        storedChecksum !== checksum(approved.sql)
      ) {
        throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Schema history is incompatible");
      }
    }
    const current = history.length;
    const supported = migrations.length;
    if (current > supported) {
      throw new PersistenceError("SCHEMA_INCOMPATIBLE", "Database schema is newer than supported");
    }
    for (const migration of migrations) {
      if (migration.version <= current) continue;
      database.exec("BEGIN IMMEDIATE");
      try {
        database.exec(migration.sql);
        database
          .prepare(
            "INSERT INTO schema_versions(version, migration_id, checksum, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(migration.version, migration.id, checksum(migration.sql), Date.now());
        database.exec("COMMIT");
      } catch {
        database.exec("ROLLBACK");
        throw new PersistenceError("MIGRATION_FAILED", "Database migration failed");
      }
    }
    return supported;
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    throw new PersistenceError("DATABASE_UNAVAILABLE", "Database initialization failed");
  }
}
