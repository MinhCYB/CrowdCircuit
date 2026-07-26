# Phase C Milestone 2 Remediation 01 - Self-Review

## Summary

This self-review document records the completion of all 7 findings identified in the Phase C Milestone 2 review against frozen architectural decisions ADR-013 through ADR-018.

## Execution Status

- **Phase C Status**: `IN_PROGRESS`
- **Milestone 2 Status**: `READY_FOR_FOCUSED_REVIEW`
- **Remediation 01 Status**: `COMPLETE`
- **Milestones 3–5**: `BLOCKED_BY_PREVIOUS_MILESTONE`
- **Phase D**: untouched

## Remediation Audit Matrix

| Issue ID | Description | Resolution Status | Primary Verification Artifact |
|---|---|---|---|
| **H-1** | Genuine Multi-Connection Concurrency Evidence | **RESOLVED** | `apps/server/test/budget-concurrency.test.ts` |
| **H-2** | Schema v1 to v2 Upgrade Regression Test | **RESOLVED** | `apps/server/test/migration-upgrade.test.ts` |
| **M-1** | Locale-Independent Ordinal Rule Ordering | **RESOLVED** | `packages/mapping-engine/src/engine.ts` (`compareOrdinal`) |
| **M-2** | Collision-Safe Versioned Budget Key Encoding | **RESOLVED** | `packages/mapping-engine/src/engine.ts` (`userBudgetKey`) |
| **M-3** | Safe Path Resolution Without Getter/Prototype Traversal | **RESOLVED** | `packages/mapping-engine/src/engine.ts` (`readPath`) |
| **M-4** | Drizzle Schema & Migration Index Parity | **RESOLVED** | `apps/server/src/persistence/schema.ts` |
| **M-5** | Declaration Script Wiring | **RESOLVED** | `packages/mapping-engine/package.json` (`test:declarations`) |

## Detailed Verification Details

### H-1: Genuine Concurrency Testing
Implemented six worker thread concurrency tests in `apps/server/test/budget-concurrency.test.ts` using separate `node:sqlite` connections to a shared SQLite database file:
1. `final per-user window slot` (`USER_LIMIT`)
2. `shared anonymous bucket` (`USER_LIMIT`)
3. `rule cooldown` (`RULE_COOLDOWN`)
4. `final per-rule sliding-window slot` (`RULE_LIMIT`)
5. `final global token` (`GLOBAL_LIMIT`)
6. `final tracked-user capacity slot` (`CAPACITY_EXHAUSTED`)

Each test asserts:
- Exactly 1 winner admitted, 1 loser rejected with expected typed reason.
- Durable table counts reflect exactly 1 admitted transaction.
- No partial user/rule/cooldown/global mutations, duplicate rows, or negative token balances.

### H-2: Schema v1 to v2 Upgrade
Implemented `apps/server/test/migration-upgrade.test.ts`:
- Applies migration v1 to fresh SQLite database.
- Verifies `schema_versions` records v1 and budget tables do not exist.
- Inserts representative Milestone 1 rows into `runtime_ownership`, `game_profiles`, `event_mappings`, `action_logs`, `action_attempts`, `action_send_authorizations`.
- Closes and reopens database; applies full migration manifest (upgrades to v2).
- Verifies `schema_versions` records v2, all mapping-budget tables and indexes exist, and Milestone 1 rows remain byte-for-byte identical.
- Reopens again to confirm migration idempotency.

### M-1: Environment-Independent Ordinal Ordering
Implemented `compareOrdinal(left: string, right: string): number` using deterministic ECMAScript ordinal string comparison over UTF-16 code units (`left < right ? -1 : left > right ? 1 : 0`).
Determines rule ordering by:
1. `priority` (DESC)
2. `specificity` (DESC)
3. `createdAt` (ASC, ordinal string comparison)
4. `id` (ASC, ordinal string comparison)

### M-2: Collision-Safe Budget Key Encoding
Structured canonical JSON format for `userBudgetKey` using private, module-local constant `const USER_BUDGET_KEY_FORMAT_VERSION = 1 as const`:
```json
{
  "gameProfileId": "prof_1",
  "identity": { "kind": "id", "value": "usr_1" },
  "keyFormatVersion": 1,
  "ruleId": "rule_1"
}
```
`USER_BUDGET_KEY_FORMAT_VERSION` is decoupled from `MAPPING_SEED_FORMAT_VERSION` so that future candidate-seed format changes do not implicitly alter durable budget keys.
Supports `kind`: `"id" | "uniqueId" | "anonymous"`.
Safely handles control characters (`\u001f`), colons, slashes, Unicode, whitespace, and literal string `"anonymous"`.

### M-3: Own-Property-Only Path Resolution
`readPath` enforces strict property access rules:
- Rejects forbidden segments (`__proto__`, `prototype`, `constructor`).
- Requires `Object.hasOwn(current, segment)`.
- Inspects `Object.getOwnPropertyDescriptor(current, segment)`.
- Rejects any descriptor with `get !== undefined`, `set !== undefined`, or missing `"value"`.
- Returns `undefined` for all accessor/inherited/absent properties without executing custom functions.

### M-4: Exact Drizzle Index Parity
All three typed Drizzle indexes in `apps/server/src/persistence/schema.ts` match raw SQLite migration v2 DDL:
1. `mapping_budget_user_events_window_idx` on `mapping_budget_user_events(profile_id, rule_id, user_key, admitted_at)`
2. `mapping_budget_rule_events_window_idx` on `mapping_budget_rule_events(profile_id, rule_id, admitted_at)`
3. `mapping_budget_user_buckets_cleanup_idx` on `mapping_budget_user_buckets(profile_id, last_active_at, rule_id, user_key)`

### M-5: Declaration Check Script Wiring
Wired `"test:declarations"` in `packages/mapping-engine/package.json`:
`"test:declarations": "tsc -p test/tsconfig.declarations.json --noEmit && tsc -p test/tsconfig.phase-c-milestone-02.json --noEmit"`

## Conclusion
All Phase C Milestone 2 remediation findings are fully verified and ready for focused review.

