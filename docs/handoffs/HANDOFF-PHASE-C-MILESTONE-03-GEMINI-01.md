# Handoff: Phase C Milestone 3 Slice 1 (GEMINI-01) — Additive Schema & Interface Slice

**Date**: 2026-07-26  
**From**: Additive Implementation Agent (GEMINI-01)  
**To**: Concurrency-Sensitive Core Implementation Agent (CODEX-CORE) / Independent Reviewer  
**Baseline Commit**: `e70e97b` (`docs: resolve Phase C milestone 3 architecture`)  
**Status**: REMEDIATED_AND_READY_FOR_RE_REVIEW (independent review: PENDING)

---

## 1. Context & Completed Work

Milestone 3 Slice 1 (GEMINI-01) delivers the complete additive schema foundation, transport port interface, test fake, and public package contracts for Phase C Milestone 3:

1. **SQLite Migration Version 3**:
   - Added table `mapping_budget_deferred_candidates` with primary key `idempotency_seed`.
   - Enforced raw DDL CHECK constraints on status, candidate TTL, created/expires timestamps, and promotion metadata consistency.
   - Added composite promotion index `mapping_budget_deferred_promotion_idx(game_id, status, priority, created_at)`.
   - Added nullable column `next_attempt_at` and index `action_logs_retry_schedule_idx(status, next_attempt_at)` to `action_logs`.
   - Added nullable column `game_instance_id` to `action_send_authorizations` and `action_attempts`.

2. **Drizzle Schema Parity**:
   - Declared `mappingBudgetDeferredCandidates` table in `apps/server/src/persistence/schema.ts`.
   - Added `nextAttemptAt` and `action_logs_retry_schedule_idx` to `actionLogs`.
   - Added `gameInstanceId` to `actionSendAuthorizations` and `actionAttempts`.

3. **Budget Admission Snapshot Types**:
   - Declared `BudgetAdmissionSnapshot`, `BudgetUserWindowSnapshot`, `BudgetRuleWindowSnapshot`, `BudgetGlobalTokenSnapshot`, and `BudgetCapacitySnapshot` interfaces in `apps/server/src/persistence/types.ts`. All 5 scope fields (`userLimit`, `cooldownMs`, `ruleLimit`, `globalToken`, `capacityConfig`) are strictly mandatory and non-nullable.

4. **Destination Binding & Authorization**:
   - Extended `AuthorizationDetails`, `CreateDurableAction`, `ActionAttempt`, and `DurableActionRepository` methods to accept and validate `gameInstanceId`.
   - `DurableActionRepository.authorizeRetry` explicitly requires `gameInstanceId: string | null` (no optional or previous destination fallback).
   - Verified that `recordAttempt` validates supplied `binding.gameInstanceId` against authorization `details.gameInstanceId` and fails closed on mismatch with `INVALID_AUTHORIZATION`.

5. **Transport-Neutral Action Delivery Port**:
   - Created `ActionDeliveryPort` in `apps/server/src/delivery/port.ts` (`DeliveryDestination`, `DeliveryResolution`, `PreparedActionDelivery`, `ActionDeliveryOutcome`).
   - Created `FakeActionDeliveryPort` in `apps/server/test/support/fake-action-delivery-port.ts` for deterministic test scripting.

6. **Public Exports & Declaration Consumers**:
   - Exported snapshot and delivery port types from `@crowdcircuit/server`.
   - Added comprehensive type assertions in `apps/server/test/declaration-consumer.ts`.

7. **Verification & Tests**:
   - Verified v1 → v2 → v3 real migration upgrade regression and DDL constraints in `migration-upgrade.test.ts`.
   - Added unit tests for `gameInstanceId`, `nextAttemptAt`, and `FakeActionDeliveryPort`.
   - Ran complete monorepo test suite (362 tests passed, 0 failed).

---

## 2. Handoff Contract to Next Agent (CODEX-CORE)

The concurrency-sensitive core implementation agent (CODEX-CORE) may now proceed with Milestone 3 Slice 2 implementation using the frozen Slice 1 primitives:

- Table `mapping_budget_deferred_candidates` is ready for deferred candidate insertion and transactional promotion.
- Column `action_logs.next_attempt_at` and index `action_logs_retry_schedule_idx` are ready for retry scheduler polling.
- `ActionDeliveryPort` interface is ready for server integration and delivery worker dispatch.
- `FakeActionDeliveryPort` is available for core delivery and retry test suites.

---

## 3. Verification Checklist

- [x] `pnpm --filter @crowdcircuit/server lint` (0 errors)
- [x] `pnpm --filter @crowdcircuit/server typecheck` (0 errors)
- [x] `pnpm --filter @crowdcircuit/server test` (74 passed)
- [x] `pnpm --filter @crowdcircuit/server build` (passed)
- [x] `pnpm --filter @crowdcircuit/server test:declarations` (0 errors)
- [x] `pnpm lint` (0 errors)
- [x] `pnpm typecheck` (0 errors)
- [x] `pnpm test` (362 passed)
- [x] `pnpm build` (passed)
- [x] `git diff --check HEAD --` (0 errors)
