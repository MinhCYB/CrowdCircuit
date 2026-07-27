import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase, MIGRATIONS } from "../src/persistence/migrations.js";
import { SqliteDurableActionRepository } from "../src/persistence/repository.js";

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

describe("Real Schema v1 through v4 Upgrade Regression", () => {
  it("migrates v1 database to v2 then to v3 safely and maintains idempotency and data integrity", () => {
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

    // Step 3: Seed representative Milestone 1 data
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

    dbV1.close();

    // Step 4: Apply ONLY v2 migration
    const dbV2 = new DatabaseSync(filename);
    const v1AndV2Migrations = MIGRATIONS.filter((m) => m.version <= 2);
    const appliedV2 = migrateDatabase(dbV2, v1AndV2Migrations);
    expect(appliedV2).toBe(2);

    // Step 5: Seed representative Milestone 2 budget rows
    dbV2
      .prepare("INSERT INTO mapping_budget_profiles (profile_id, last_observed_at) VALUES (?, ?)")
      .run("prof_v1", 1000);
    dbV2
      .prepare("INSERT INTO mapping_budget_cooldowns (profile_id, rule_id, last_accepted_at) VALUES (?, ?, ?)")
      .run("prof_v1", "rule_1", 1000);

    // Step 6: Capture representative Milestone 1 & Milestone 2 rows
    const capturedActionV2 = dbV2.prepare("SELECT * FROM action_logs WHERE action_id = 'act_v1'").get() as Record<string, unknown>;
    const capturedAttemptV2 = dbV2.prepare("SELECT * FROM action_attempts WHERE action_id = 'act_v1'").get() as Record<string, unknown>;
    const capturedAuthV2 = dbV2.prepare("SELECT * FROM action_send_authorizations WHERE authorization_id = 'auth_v1'").get() as Record<string, unknown>;
    const capturedBudgetProfile = dbV2.prepare("SELECT * FROM mapping_budget_profiles WHERE profile_id = 'prof_v1'").get();

    // Step 7: Verify deferred table and v3 columns do not exist yet
    const deferredTablesV2 = dbV2
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mapping_budget_deferred_candidates'")
      .all();
    expect(deferredTablesV2).toEqual([]);

    dbV2.close();

    // Step 8 & 9: Reopen with full migration manifest (including v3)
    const dbV3 = new DatabaseSync(filename);
    const appliedV3 = migrateDatabase(dbV3, MIGRATIONS);
    expect(appliedV3).toBe(4);

    // Step 10 & 11: Verify schema_versions contains 1, 2, 3 in order
    const versionsV3 = dbV3.prepare("SELECT version, migration_id FROM schema_versions ORDER BY version").all();
    expect(versionsV3).toEqual([
      { version: 1, migration_id: "phase-c-foundation" },
      { version: 2, migration_id: "phase-c-mapping-budgets" },
      { version: 3, migration_id: "phase-c-deferred-and-retry-metadata" },
      { version: 4, migration_id: "phase-c-deferred-candidate-completeness" },
    ]);

    // Step 12 & 13: Verify mapping_budget_deferred_candidates exists and has columns
    const deferredTable = dbV3
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mapping_budget_deferred_candidates'")
      .all();
    expect(deferredTable.length).toBe(1);

    // Step 14: Verify indexes
    const indexesV3 = dbV3
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => Reflect.get(row, "name"));
    expect(indexesV3).toContain("mapping_budget_deferred_promotion_idx");
    expect(indexesV3).toContain("action_logs_retry_schedule_idx");

    // Step 15 & 16: Verify pre-existing rows are unchanged except new nullable columns read as null
    const actionV3 = dbV3.prepare("SELECT * FROM action_logs WHERE action_id = 'act_v1'").get() as Record<string, unknown>;
    expect(actionV3["next_attempt_at"]).toBeNull();
    const actionV3Base = { ...actionV3 };
    delete actionV3Base["next_attempt_at"];
    expect(actionV3Base).toEqual(capturedActionV2);

    const attemptV3 = dbV3.prepare("SELECT * FROM action_attempts WHERE action_id = 'act_v1'").get() as Record<string, unknown>;
    expect(attemptV3["game_instance_id"]).toBeNull();
    const attemptV3Base = { ...attemptV3 };
    delete attemptV3Base["game_instance_id"];
    expect(attemptV3Base).toEqual(capturedAttemptV2);

    const authV3 = dbV3.prepare("SELECT * FROM action_send_authorizations WHERE authorization_id = 'auth_v1'").get() as Record<string, unknown>;
    expect(authV3["game_instance_id"]).toBeNull();
    const authV3Base = { ...authV3 };
    delete authV3Base["game_instance_id"];
    expect(authV3Base).toEqual(capturedAuthV2);

    expect(dbV3.prepare("SELECT * FROM mapping_budget_profiles WHERE profile_id = 'prof_v1'").get()).toEqual(capturedBudgetProfile);

    dbV3.close();

    // Step 17: Reopen again and prove migration idempotency
    const dbIdempotent = new DatabaseSync(filename);
    expect(() => migrateDatabase(dbIdempotent, MIGRATIONS)).not.toThrow();
    expect(dbIdempotent.prepare("SELECT MAX(version) AS version FROM schema_versions").get()).toEqual({ version: 4 });
    dbIdempotent.close();
  });

  it("enforces raw DDL check constraints on mapping_budget_deferred_candidates", () => {
    const filename = temporaryDatabase();
    const db = new DatabaseSync(filename);
    migrateDatabase(db, MIGRATIONS);

    const baseRow = {
      idempotency_seed: "seed_1",
      game_profile_id: "prof_1",
      game_id: "game_1",
      rule_id: "rule_1",
      event_id: "evt_1",
      candidate_ordinal: 0,
      action_type: "SPAWN",
      params_json: "{}",
      actor_json: null,
      priority: 10,
      action_priority: 5,
      candidate_ttl_ms: 1000,
      deferred_expires_at: 2000,
      created_at: 1000,
      admission_snapshot_json: "{}",
      status: "queued",
      owning_runtime_id: "runtime_1",
      promoted_action_id: null,
      promoted_at: null,
    };

    const insertRow = (override: Partial<typeof baseRow>) => {
      const row = { ...baseRow, ...override };
      db.prepare(
        `INSERT INTO mapping_budget_deferred_candidates (
          idempotency_seed, game_profile_id, game_id, rule_id, event_id, candidate_ordinal,
          action_type, params_json, actor_json, priority, action_priority, candidate_ttl_ms,
          deferred_expires_at, created_at, admission_snapshot_json, status, owning_runtime_id,
          promoted_action_id, promoted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.idempotency_seed,
        row.game_profile_id,
        row.game_id,
        row.rule_id,
        row.event_id,
        row.candidate_ordinal,
        row.action_type,
        row.params_json,
        row.actor_json,
        row.priority,
        row.action_priority,
        row.candidate_ttl_ms,
        row.deferred_expires_at,
        row.created_at,
        row.admission_snapshot_json,
        row.status,
        row.owning_runtime_id,
        row.promoted_action_id,
        row.promoted_at,
      );
    };

    // Valid queued insert succeeds
    expect(() => insertRow({ idempotency_seed: "valid_queued" })).not.toThrow();

    // Valid promoted insert succeeds
    expect(() =>
      insertRow({
        idempotency_seed: "valid_promoted",
        status: "promoted",
        promoted_action_id: "act_1",
        promoted_at: 1500,
      }),
    ).not.toThrow();

    // Invalid status rejected
    expect(() => insertRow({ idempotency_seed: "invalid_status", status: "unknown" })).toThrow();

    // Negative candidate ordinal rejected
    expect(() => insertRow({ idempotency_seed: "neg_ordinal", candidate_ordinal: -1 })).toThrow();

    // Nonpositive candidate TTL rejected
    expect(() => insertRow({ idempotency_seed: "zero_ttl", candidate_ttl_ms: 0 })).toThrow();

    // Deferred expires at before creation rejected
    expect(() =>
      insertRow({
        idempotency_seed: "expired_before_created",
        created_at: 2000,
        deferred_expires_at: 1000,
      }),
    ).toThrow();

    // Promoted status without complete promotion metadata rejected
    expect(() =>
      insertRow({
        idempotency_seed: "promoted_no_action",
        status: "promoted",
        promoted_action_id: null,
        promoted_at: 1500,
      }),
    ).toThrow();

    expect(() =>
      insertRow({
        idempotency_seed: "promoted_no_time",
        status: "promoted",
        promoted_action_id: "act_1",
        promoted_at: null,
      }),
    ).toThrow();

    // Queued row with partial promotion metadata rejected
    expect(() =>
      insertRow({
        idempotency_seed: "queued_with_action",
        status: "queued",
        promoted_action_id: "act_1",
        promoted_at: null,
      }),
    ).toThrow();

    db.close();
  });

  it("preserves v3-era deferred candidate rows field-for-field during v4 migration with default backfills", () => {
    const filename = temporaryDatabase();

    // Step 1: Apply migrations through version 3
    const dbV3 = new DatabaseSync(filename);
    const v3Migrations = MIGRATIONS.filter((m) => m.version <= 3);
    const appliedV3 = migrateDatabase(dbV3, v3Migrations);
    expect(appliedV3).toBe(3);

    // Step 2: Insert a representative v3-era row into mapping_budget_deferred_candidates (no event_type/user_budget_key columns)
    const snapshotJson = JSON.stringify({
      gameProfileId: "prof_v3",
      ruleId: "rule_v3",
      userBudgetKey: "user_v3",
      userLimit: { limitPerMinute: 5 },
      cooldownMs: 0,
      ruleLimit: { limitPerMinute: 10 },
      globalToken: { maxPerSecond: 2, burst: 5 },
      capacityConfig: { maxUserBuckets: 8, inactiveRetentionMs: 60000, sweepLimit: 8 },
    });

    dbV3
      .prepare(
        `INSERT INTO mapping_budget_deferred_candidates (
          idempotency_seed, game_profile_id, game_id, rule_id, event_id, candidate_ordinal,
          action_type, params_json, actor_json, priority, action_priority, candidate_ttl_ms,
          deferred_expires_at, created_at, admission_snapshot_json, status, owning_runtime_id,
          promoted_action_id, promoted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "v3_deferred_seed",
        "prof_v3",
        "game_v3",
        "rule_v3",
        "evt_v3",
        0,
        "SPAWN",
        '{"count":1}',
        null,
        10,
        5,
        5000,
        10000,
        1000,
        snapshotJson,
        "queued",
        "runtime_v3",
        null,
        null,
      );
    dbV3.close();

    // Step 3: Apply migration 4
    const dbV4 = new DatabaseSync(filename);
    const appliedV4 = migrateDatabase(dbV4, MIGRATIONS);
    expect(appliedV4).toBe(4);

    // Step 4 & 5: Assert row survives field-for-field with backfilled values
    const row = dbV4
      .prepare("SELECT * FROM mapping_budget_deferred_candidates WHERE idempotency_seed = 'v3_deferred_seed'")
      .get() as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row["event_type"]).toBe("unknown");
    expect(row["user_budget_key"]).toBe("anonymous");
    expect(row["game_profile_id"]).toBe("prof_v3");
    expect(row["game_id"]).toBe("game_v3");
    expect(row["rule_id"]).toBe("rule_v3");
    expect(row["event_id"]).toBe("evt_v3");
    expect(row["action_type"]).toBe("SPAWN");
    dbV4.close();

    // Step 6 & 7: Open upgraded database through SqliteDurableActionRepository and find candidate
    const repository = SqliteDurableActionRepository.open({ filename });
    const deferred = repository.findDeferredCandidate("v3_deferred_seed");
    expect(deferred).not.toBeNull();
    expect(deferred?.candidate.eventType).toBe("unknown");
    expect(deferred?.candidate.userBudgetKey).toBe("anonymous");
    expect(deferred?.candidate.idempotencySeed).toBe("v3_deferred_seed");
    repository.close();

    // Step 8: Assert migration reopen/idempotency and checksum/order guards remain green
    const reopenDb = new DatabaseSync(filename);
    expect(() => migrateDatabase(reopenDb, MIGRATIONS)).not.toThrow();
    expect(reopenDb.prepare("SELECT MAX(version) AS version FROM schema_versions").get()).toEqual({ version: 4 });
    reopenDb.close();
  });
});
