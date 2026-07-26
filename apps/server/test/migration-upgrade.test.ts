import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase, MIGRATIONS } from "../src/persistence/migrations.js";

const directories: string[] = [];
const temporaryDatabase = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-migration-"));
  directories.push(directory);
  return join(directory, "test.sqlite");
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Real Schema v1 to v2 Upgrade Regression", () => {
  it("migrates v1 database with seeded Milestone 1 data safely to v2 and maintains idempotency", () => {
    const filename = temporaryDatabase();

    // Step 1: Apply ONLY v1 migration (Milestone 1)
    const dbV1 = new DatabaseSync(filename);
    const v1Migrations = MIGRATIONS.filter((m) => m.version === 1);
    const appliedV1 = migrateDatabase(dbV1, v1Migrations);

    expect(appliedV1).toBe(1);

    // Step 2: Verify schema_versions records version 1 only
    const versionsV1 = dbV1.prepare("SELECT version, migration_id FROM schema_versions ORDER BY version").all();
    expect(versionsV1).toEqual([
      { version: 1, migration_id: "phase-c-foundation" },
    ]);

    // Step 3: Verify mapping-budget tables do not exist yet
    const tablesV1 = dbV1
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mapping_budget_%'")
      .all();
    expect(tablesV1).toEqual([]);

    // Step 4: Seed representative Milestone 1 data
    const seedRuntimeOwner = { singleton_id: 1, owner_id: "owner_m1_seed", reconciled_at: 1000 };
    const seedGameProfile = { profile_id: "prof_v1", game_id: "game_v1", profile_json: '{"name":"v1"}', updated_at: 1000 };
    const seedEventMapping = { mapping_id: "map_v1", game_id: "game_v1", mapping_json: '{"rules":[]}', updated_at: 1000 };
    const seedActionLog = {
      action_id: "act_v1",
      idempotency_key: "idemp_v1",
      event_id: "evt_v1",
      mapping_id: "map_v1",
      game_id: "game_v1",
      action_type: "SPAWN",
      params_json: '{"count":1}',
      status: "in_flight",
      priority: 10,
      ttl_ms: 5000,
      retry_count: 1,
      created_at: 1000,
      updated_at: 1100,
      expires_at: 6000,
      received_at: null,
      completed_at: null,
      failure_code: null,
      result_json: null,
      reconciliation_reason: null,
      runtime_id: "runtime_v1",
      version: 2,
    };
    const seedActionAttempt = {
      action_id: "act_v1",
      attempt_number: 1,
      runtime_id: "runtime_v1",
      attempted_at: 1100,
      outcome: "send_started",
      failure_code: null,
    };
    const seedAuth = {
      authorization_id: "auth_v1",
      action_id: "act_v1",
      expected_version: 1,
      attempt_number: 1,
      runtime_id: "runtime_v1",
      runtime_owner_id: "owner_m1_seed",
      role: "game",
      client_id: "game_v1",
      expires_at: 6000,
      consumed_at: 1100,
      revoked_at: null,
    };

    dbV1
      .prepare("INSERT INTO runtime_ownership (singleton_id, owner_id, reconciled_at) VALUES (?, ?, ?)")
      .run(seedRuntimeOwner.singleton_id, seedRuntimeOwner.owner_id, seedRuntimeOwner.reconciled_at);

    dbV1
      .prepare("INSERT INTO game_profiles (profile_id, game_id, profile_json, updated_at) VALUES (?, ?, ?, ?)")
      .run(seedGameProfile.profile_id, seedGameProfile.game_id, seedGameProfile.profile_json, seedGameProfile.updated_at);

    dbV1
      .prepare("INSERT INTO event_mappings (mapping_id, game_id, mapping_json, updated_at) VALUES (?, ?, ?, ?)")
      .run(seedEventMapping.mapping_id, seedEventMapping.game_id, seedEventMapping.mapping_json, seedEventMapping.updated_at);

    dbV1
      .prepare(
        `INSERT INTO action_logs (
          action_id, idempotency_key, event_id, mapping_id, game_id, action_type,
          params_json, status, priority, ttl_ms, retry_count, created_at, updated_at,
          expires_at, received_at, completed_at, failure_code, result_json, reconciliation_reason, runtime_id, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        seedActionLog.action_id,
        seedActionLog.idempotency_key,
        seedActionLog.event_id,
        seedActionLog.mapping_id,
        seedActionLog.game_id,
        seedActionLog.action_type,
        seedActionLog.params_json,
        seedActionLog.status,
        seedActionLog.priority,
        seedActionLog.ttl_ms,
        seedActionLog.retry_count,
        seedActionLog.created_at,
        seedActionLog.updated_at,
        seedActionLog.expires_at,
        seedActionLog.received_at,
        seedActionLog.completed_at,
        seedActionLog.failure_code,
        seedActionLog.result_json,
        seedActionLog.reconciliation_reason,
        seedActionLog.runtime_id,
        seedActionLog.version,
      );

    dbV1
      .prepare("INSERT INTO action_attempts (action_id, attempt_number, runtime_id, attempted_at, outcome, failure_code) VALUES (?, ?, ?, ?, ?, ?)")
      .run(seedActionAttempt.action_id, seedActionAttempt.attempt_number, seedActionAttempt.runtime_id, seedActionAttempt.attempted_at, seedActionAttempt.outcome, seedActionAttempt.failure_code);

    dbV1
      .prepare(
        `INSERT INTO action_send_authorizations (
          authorization_id, action_id, expected_version, attempt_number, runtime_id, runtime_owner_id, role, client_id, expires_at, consumed_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        seedAuth.authorization_id,
        seedAuth.action_id,
        seedAuth.expected_version,
        seedAuth.attempt_number,
        seedAuth.runtime_id,
        seedAuth.runtime_owner_id,
        seedAuth.role,
        seedAuth.client_id,
        seedAuth.expires_at,
        seedAuth.consumed_at,
        seedAuth.revoked_at,
      );

    // Step 5: Capture exact representative rows
    const capturedOwner = dbV1.prepare("SELECT * FROM runtime_ownership WHERE singleton_id = 1").get();
    const capturedProfile = dbV1.prepare("SELECT * FROM game_profiles WHERE profile_id = 'prof_v1'").get();
    const capturedMapping = dbV1.prepare("SELECT * FROM event_mappings WHERE mapping_id = 'map_v1'").get();
    const capturedAction = dbV1.prepare("SELECT * FROM action_logs WHERE action_id = 'act_v1'").get();
    const capturedAttempt = dbV1.prepare("SELECT * FROM action_attempts WHERE action_id = 'act_v1'").get();
    const capturedAuth = dbV1.prepare("SELECT * FROM action_send_authorizations WHERE authorization_id = 'auth_v1'").get();

    dbV1.close();

    // Step 6 & 7: Reopen and apply full migration manifest up to v2
    const dbV2 = new DatabaseSync(filename);
    const appliedV2 = migrateDatabase(dbV2, MIGRATIONS);

    expect(appliedV2).toBe(2);

    // Step 8: Verify v2 recorded, mapping-budget tables & indexes exist, v1 data unchanged
    const versionsV2 = dbV2.prepare("SELECT version, migration_id FROM schema_versions ORDER BY version").all();
    expect(versionsV2).toEqual([
      { version: 1, migration_id: "phase-c-foundation" },
      { version: 2, migration_id: "phase-c-mapping-budgets" },
    ]);

    const budgetTables = dbV2
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mapping_budget_%' ORDER BY name")
      .all()
      .map((row) => Reflect.get(row, "name"));

    expect(budgetTables).toEqual([
      "mapping_budget_cooldowns",
      "mapping_budget_game_tokens",
      "mapping_budget_profiles",
      "mapping_budget_rule_events",
      "mapping_budget_user_buckets",
      "mapping_budget_user_events",
    ]);

    const budgetIndexes = dbV2
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'mapping_budget_%' ORDER BY name")
      .all()
      .map((row) => Reflect.get(row, "name"));

    expect(budgetIndexes).toContain("mapping_budget_user_events_window_idx");
    expect(budgetIndexes).toContain("mapping_budget_rule_events_window_idx");
    expect(budgetIndexes).toContain("mapping_budget_user_buckets_cleanup_idx");

    // Verify Milestone 1 rows remain byte-for-byte / field-for-field unchanged
    expect(dbV2.prepare("SELECT * FROM runtime_ownership WHERE singleton_id = 1").get()).toEqual(capturedOwner);
    expect(dbV2.prepare("SELECT * FROM game_profiles WHERE profile_id = 'prof_v1'").get()).toEqual(capturedProfile);
    expect(dbV2.prepare("SELECT * FROM event_mappings WHERE mapping_id = 'map_v1'").get()).toEqual(capturedMapping);
    expect(dbV2.prepare("SELECT * FROM action_logs WHERE action_id = 'act_v1'").get()).toEqual(capturedAction);
    expect(dbV2.prepare("SELECT * FROM action_attempts WHERE action_id = 'act_v1'").get()).toEqual(capturedAttempt);
    expect(dbV2.prepare("SELECT * FROM action_send_authorizations WHERE authorization_id = 'auth_v1'").get()).toEqual(capturedAuth);

    dbV2.close();

    // Step 9: Reopen again and prove migration idempotency
    const dbIdempotent = new DatabaseSync(filename);
    expect(() => migrateDatabase(dbIdempotent, MIGRATIONS)).not.toThrow();
    expect(dbIdempotent.prepare("SELECT MAX(version) AS version FROM schema_versions").get()).toEqual({ version: 2 });
    dbIdempotent.close();
  });
});
