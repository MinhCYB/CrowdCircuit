# Handoff: Phase C Milestone 2 Remediation 01

## Executive Summary
This handoff document details the completion of the 7 remediation findings (H-1, H-2, M-1, M-2, M-3, M-4, M-5) for CrowdCircuit Phase C Milestone 2 on branch `review/phase-c`.

All production mapping engine logic, database migration scripts, Drizzle schemas, and test suites are 100% passing across the workspace under Node.js v24.15.0 and pnpm 11.9.0.

## Execution & Milestone Status
- **Phase C Status**: `IN_PROGRESS`
- **Milestone 2 Status**: `READY_FOR_FOCUSED_REVIEW`
- **Remediation 01 Status**: `COMPLETE`
- **Milestones 3–5**: `BLOCKED_BY_PREVIOUS_MILESTONE`
- **Phase D**: untouched

## Resolved Remediation Scope

### 1. Genuine SQLite Multi-Connection Concurrency (H-1)
- Artifact: `apps/server/test/budget-concurrency.test.ts` & `apps/server/test/budget-concurrency-worker.ts`
- Scenarios Tested:
  1. Final per-user window slot (`USER_LIMIT`)
  2. Shared anonymous bucket (`USER_LIMIT`)
  3. Rule cooldown (`RULE_COOLDOWN`)
  4. Final per-rule sliding-window slot (`RULE_LIMIT`)
  5. Final global token (`GLOBAL_LIMIT`)
  6. Final tracked-user capacity slot (`CAPACITY_EXHAUSTED`)
- Verification: Tested with worker threads opening independent `node:sqlite` DB handles against a shared file. Verified atomic admissions, single-winner outcomes, correct typed failure reasons, and zero row duplicate/partial state corruptions.

### 2. Real Schema v1 to v2 Upgrade Regression (H-2)
- Artifact: `apps/server/test/migration-upgrade.test.ts`
- Verification: Applied v1 migration, populated representative Milestone 1 database rows across all tables, reopened and applied v2 migration manifest, confirmed all v1 records remained intact, verified new budget tables/indexes, and confirmed migration idempotency on subsequent re-execution.

### 3. Ordinal Rule Ordering (M-1)
- Artifact: `packages/mapping-engine/src/engine.ts` (`compareOrdinal`)
- Verification: Uses deterministic ECMAScript ordinal string comparison over UTF-16 code units (`left < right ? -1 : left > right ? 1 : 0`). Ensures deterministic evaluation order for non-ASCII rule IDs independent of host environment locale settings.

### 4. Collision-Safe Structured Budget Keys (M-2)
- Artifact: `packages/mapping-engine/src/engine.ts` (`userBudgetKey`)
- Verification: Encodes budget keys as structured canonical JSON containing `keyFormatVersion: USER_BUDGET_KEY_FORMAT_VERSION` (`const USER_BUDGET_KEY_FORMAT_VERSION = 1 as const`), `gameProfileId`, `ruleId`, and structured `identity` (`id`, `uniqueId`, or `anonymous`). `USER_BUDGET_KEY_FORMAT_VERSION` is private and decoupled from `MAPPING_SEED_FORMAT_VERSION`. Eliminates collisions across control characters, separators (`\u001f`), colons, slashes, and Unicode.

### 5. Own-Property Data Descriptor Path Resolution (M-3)
- Artifact: `packages/mapping-engine/src/engine.ts` (`readPath`)
- Verification: Enforces `Object.hasOwn` and verifies `Object.getOwnPropertyDescriptor` data descriptors (`get === undefined && set === undefined && "value" in descriptor`). Prevents execution of own or inherited getters and blocks prototype traversal (`__proto__`, `constructor`, `prototype`).

### 6. Drizzle Index Parity (M-4)
- Artifact: `apps/server/src/persistence/schema.ts`
- Verification: Schema index declarations match raw migration v2 SQL DDL index names and column order:
  - `mapping_budget_user_events_window_idx`
  - `mapping_budget_rule_events_window_idx`
  - `mapping_budget_user_buckets_cleanup_idx`

### 7. Declaration Check Script Wiring (M-5)
- Artifact: `packages/mapping-engine/package.json`
- Verification: Added `"test:declarations"` script running both `test/tsconfig.declarations.json` and `test/tsconfig.phase-c-milestone-02.json`.

## Working Tree State
- Branch: `review/phase-c`
- HEAD: `ab4a1cd`
- Status: Dirty working tree (remediation changes intact, uncommitted as instructed). No commits or pushes performed.
- Milestone 3 Status: `BLOCKED_BY_PREVIOUS_MILESTONE` (Not started).

## Verification Command Results
- `pnpm --filter @crowdcircuit/mapping-engine lint` (PASS)
- `pnpm --filter @crowdcircuit/mapping-engine typecheck` (PASS)
- `pnpm --filter @crowdcircuit/mapping-engine test` (PASS - 42 tests)
- `pnpm --filter @crowdcircuit/mapping-engine build` (PASS)
- `pnpm --filter @crowdcircuit/mapping-engine test:declarations` (PASS)
- `pnpm --filter @crowdcircuit/server lint` (PASS)
- `pnpm --filter @crowdcircuit/server typecheck` (PASS)
- `pnpm --filter @crowdcircuit/server test` (PASS - 60 tests)
- `pnpm --filter @crowdcircuit/server build` (PASS)
- `pnpm --filter @crowdcircuit/server test:declarations` (PASS)
- `pnpm lint` (PASS)
- `pnpm typecheck` (PASS)
- `pnpm test` (PASS - 348 tests across 23 test files)
- `pnpm build` (PASS)

