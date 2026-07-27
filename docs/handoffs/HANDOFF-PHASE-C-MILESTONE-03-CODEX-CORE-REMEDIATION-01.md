# Handoff: Phase C Milestone 3 CODEX Core Remediation 01

**Date:** 2026-07-27
**Baseline:** `248c2a2` on `review/phase-c`
**Status:** READY_FOR_INDEPENDENT_RE_REVIEW (Claude Independent Review 01: REQUEST_CHANGES remediated)

## Overview

This document summarizes the additive remediation performed for Phase C Milestone 3 CODEX Core following Claude Independent Review 01 (`REQUEST_CHANGES`).

## Remediated Findings

1. **H-1: Review/Status Provenance**:
   - Renamed `docs/orchestration/reviews/PHASE-C-MILESTONE-03-CODEX-CORE-INDEPENDENT-REVIEW-01.md` to `docs/orchestration/reviews/PHASE-C-MILESTONE-03-CODEX-CORE-GEMINI-PRECOMMIT-AUDIT-01.md`.
   - Updated title and opening metadata of `GEMINI-PRECOMMIT-AUDIT-01.md` to clearly state it is supplementary pre-commit audit evidence preceding formal independent review by Claude, and not an authoritative approval gate.
   - Corrected status documents (`docs/execution/CURRENT_TASK.md`, `docs/execution/PROJECT_STATUS.md`, `docs/execution/ROADMAP.md`, `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-CODEX-CORE.md`) to reflect `READY_FOR_INDEPENDENT_RE_REVIEW` with Phase C and Milestone 3 in status `IN_PROGRESS`.
   - Purged machine-local file paths across all touched files.

2. **H-2: Live TTL Worker Coverage**:
   - Added direct deterministic unit tests in `apps/server/test/action-gateway-core.test.ts` for `DurableActionRepository.expireDue` and `ActionLifecycleWorker.tick`.
   - Verified pending action exact-boundary expiry (`expiresAt === now`).
   - Verified deferred candidate exact-boundary expiry (`deferredExpiresAt === now`) and prevention of later promotion.
   - Verified bounded sweep limits (processing up to `sweepLimit` per category) and remainder processing.
   - Verified idempotent re-sweep with zero version churn or additional mutations.
   - Verified TTL expiry prioritization over delivery/retry without issuing authorizations or attempts.
   - Verified mixed action and deferred candidate sweeps via `ActionLifecycleWorker`.

3. **M-1: Promotion Negative-Path Coverage**:
   - Added direct unit tests in `apps/server/test/action-gateway-core.test.ts` for `promoteDeferredCandidate` negative paths.
   - Verified expired candidate promotion returns `{ status: "expired" }` with zero action or budget mutation.
   - Verified budget re-admission failure returns `{ status: "not_admitted", reason: "USER_LIMIT" }` with atomic transaction rollback.
   - Verified nonexistent candidate seed returns `{ status: "not_found" }` with zero DB mutation.
   - Verified stale/superseded runtime owner fails closed with `RUNTIME_SUPERSEDED`.

4. **M-2: Restart Reconciliation Coverage**:
   - Added real SQLite reconciliation tests in `apps/server/test/action-gateway-core.test.ts` using `SqliteDurableActionRepository`.
   - Verified `received` actions remain `received`, reassign runtime owner, avoid delivery retry scheduling, and are idempotent on re-run.
   - Verified unexpired queued deferred candidates reassign runtime owner while keeping status `queued` and promotion metadata `null`.
   - Verified expired queued deferred candidates transition to `expired` during restart reconciliation and fail closed on subsequent promotion.
   - Verified mixed restart sets (pending, in_flight, received, expired actions, unexpired deferred, expired deferred) reconcile deterministically and idempotently.

5. **M-3: Migration v4 Data-Survival Coverage**:
   - Extended `apps/server/test/migration-upgrade.test.ts` with a dedicated v3-to-v4 data survival test.
   - Applied migrations 1–3, inserted a representative v3-era row into `mapping_budget_deferred_candidates` (without `event_type` and `user_budget_key` columns).
   - Applied migration 4 and asserted the row survived field-for-field with backfilled values `event_type = 'unknown'` and `user_budget_key = 'anonymous'`.
   - Opened upgraded database via `SqliteDurableActionRepository` and verified `findDeferredCandidate` decodes and returns the migrated candidate without error.
   - Confirmed migration reopen, idempotency, and checksum guards remain green.

## Files Changed

- `docs/orchestration/reviews/PHASE-C-MILESTONE-03-CODEX-CORE-GEMINI-PRECOMMIT-AUDIT-01.md` (renamed from `INDEPENDENT-REVIEW-01.md` and updated)
- `docs/execution/CURRENT_TASK.md` (updated)
- `docs/execution/PROJECT_STATUS.md` (updated)
- `docs/execution/ROADMAP.md` (updated)
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-CODEX-CORE.md` (updated status metadata)
- `apps/server/test/action-gateway-core.test.ts` (added H-2, M-1, M-2 test suites)
- `apps/server/test/migration-upgrade.test.ts` (added M-3 test case)
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-CODEX-CORE-REMEDIATION-01.md` (new handoff file)

## Production Code Changes

- **None**. Zero production source files (`apps/server/src/**`, `packages/**/src/**`) were modified. No production concurrency, transaction, retry, TTL, lifecycle, or recovery logic required modification.

## Verification Summary

- `pnpm --filter @crowdcircuit/server lint`: PASS
- `pnpm --filter @crowdcircuit/server typecheck`: PASS
- `pnpm --filter @crowdcircuit/server test`: PASS (96/96 tests across 10 files)
- `pnpm --filter @crowdcircuit/server build`: PASS
- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS (384/384 tests across 26 files)
- `pnpm build`: PASS
- `git diff --check HEAD --`: PASS (clean)

## Final Remediation Status

`READY_FOR_INDEPENDENT_RE_REVIEW` (pending Claude Independent Review re-review).
