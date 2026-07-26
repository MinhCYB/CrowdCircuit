# Handoff: Phase C Milestone 2 (Final)

## Executive Summary

Phase C Milestone 2 (**Mapping and Action-Budget Capability**) is complete and fully verified.

All core production logic, database migration manifests, schema index definitions, test suites, and declaration validation consumers have been verified under **Node.js v24.15.0** and **pnpm 11.9.0**.

- **Final Status**: `PHASE-C-MILESTONE-02: APPROVED_AND_COMPLETE`
- **Approval Basis**: Independent Code & Evidence Review plus Authoritative Node 24 Verification.

---

## Delivered Architecture & Core Capabilities

1. **Deterministic Mapping Engine & Candidate Seeds (`@crowdcircuit/mapping-engine`)**:
   - Compares rules deterministically using priority (DESC), specificity (DESC), and ECMAScript UTF-16 code-unit ordinal string comparison (`compareOrdinal`) on `createdAt` (ASC) and `id` (ASC).
   - Generates deterministic candidate idempotency seeds (`createCandidateSeed`) using versioned format `MAPPING_SEED_FORMAT_VERSION = 1`.
   - Supports `all`, `first`, and `exclusive_group` match modes.
   - Restricts field path resolution (`readPath`) strictly to own data properties (`Object.hasOwn` + `Object.getOwnPropertyDescriptor` checking `get === undefined && set === undefined && "value" in descriptor`), preventing getter execution and prototype traversal (`__proto__`, `prototype`, `constructor`).

2. **Structured Budget Key Versioning & User Precedence**:
   - Decoupled `USER_BUDGET_KEY_FORMAT_VERSION = 1 as const` from candidate seed versioning.
   - Encodes structured canonical JSON budget keys containing `keyFormatVersion: 1`, `gameProfileId`, `ruleId`, and structured `identity` (`kind: "id" | "uniqueId" | "anonymous"`).
   - Strictly enforces identity precedence: `user.id` → `user.uniqueId` → shared profile/rule-scoped anonymous bucket.
   - Structurally eliminates key aliasing across control characters, colons, slashes, and Unicode.

3. **Atomic Multi-Scope Budget Admission & Concurrency (`SqliteDurableActionRepository`)**:
   - Atomic admission across per-user sliding window, shared anonymous bucket, rule cooldown, per-rule sliding window, global token bucket, and tracked-user capacity.
   - Rollback guarantees: failure at any scope produces zero partial mutations and zero row leakages.
   - Proven via multi-connection worker thread tests (`apps/server/test/budget-concurrency.test.ts`) across 3 consecutive 100% passing runs.

4. **Durable Persistence & Migration Parity (`schema_versions` v2)**:
   - Migration manifest v2 adds `mapping_budget_user_events`, `mapping_budget_rule_events`, `mapping_budget_cooldowns`, `mapping_budget_global_tokens`, `mapping_budget_user_buckets`, and `mapping_budget_user_counts`.
   - Verified 10-step upgrade test (`apps/server/test/migration-upgrade.test.ts`): upgrades populated Milestone 1 v1 database to v2 while preserving every v1 row byte-for-byte.
   - Parity between raw SQL DDL indexes and Drizzle schema declarations (`schema.ts`).

5. **Output Boundary**:
   - Defines typed output results: `accepted`, `rejected` (with typed reason: `USER_LIMIT`, `RULE_COOLDOWN`, `RULE_LIMIT`, `GLOBAL_LIMIT`, `CAPACITY_EXHAUSTED`), `dropped`, and `deferred`.
   - Durable queue ownership, transport delivery, and final `actionId` allocation remain strictly fenced to Milestone 3.

---

## Verification Evidence & Final Counts

Under Node.js `v24.15.0` and pnpm `11.9.0`:

- `@crowdcircuit/mapping-engine`: **42 passed** (lint, typecheck, test, build, declarations all clean)
- `@crowdcircuit/server`: **60 passed** (lint, typecheck, test, build, declarations all clean)
- Genuine Concurrency Suite (`budget-concurrency.test.ts`): **3 consecutive runs passed** (6/6 tests per run)
- Migration Upgrade Suite (`migration-upgrade.test.ts`): **1/1 passed**
- Workspace Repository Total: **348 passed across 23 test files**
- Workspace Build: Clean across all 15 active projects
- Workspace Diff Check: `git diff --check HEAD --` passed with 0 formatting/whitespace issues

---

## Remaining Known Limitations

- Milestone 2 produces candidate idempotency seeds and budget admission outcomes; it does **not** allocate final `actionId` strings or execute network transport.
- Deferred mapping results are returned as typed boundary objects; durable deferred queue persistence will be implemented in Milestone 3.

---

## Milestone 3 Entry Boundary

- **Milestone 3 Status**: `READY_FOR_ARCHITECTURE_AND_DELEGATION`
- **Milestone 3 Scope**: Durable Action Gateway Lifecycle (`persist-before-send`, action state machine, delivery retries, TTL, reconciliation).
- **Closure Guarantee**: No production or test code for Milestone 3 was introduced during administrative closure. Milestone 3 planning and design may now proceed.
