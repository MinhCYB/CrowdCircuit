# Handoff — Phase C Milestone 2 CODEX Production Core

**Status:** CORE_READY_FOR_GEMINI_ADDITIVE
**Date:** 2026-07-25
**Branch:** `review/phase-c`
**Baseline:** `675271b`

## Delivered

- Strict provider-independent mapping/profile/rule/condition/template,
  manifest, budget, capacity, result, diagnostic, clock, and repository APIs.
- Deterministic normalized-event mapping with all approved operators,
  specificity, ordering, match modes, safe parameter resolution, manifest
  checks, and dry-run.
- ADR-013 versioned deterministic identity seed; no final `actionId`.
- ADR-014 stable user precedence and shared profile/rule anonymous bucket.
- ADR-015 exact sliding windows and single-transaction multi-scope admission.
- ADR-016 durable restart-preserved cooldown/window/token state.
- ADR-017 accepted/rejected/dropped/deferred boundary with no Milestone 2 queue.
- ADR-018 validated capacity/retention, bounded sweeps, deterministic cleanup,
  and fail-closed exhaustion.
- Phase B normalized gift/comment/like, userless aggregate, and streak-update
  boundary coverage.
- Future gateway candidate containing seed, action output, normalized actor,
  trigger facts, priority, and TTL.

## Persistence and migration

`CURRENT_SCHEMA_VERSION` is 2. Migration
`phase-c-mapping-budgets` creates durable profile clock, user buckets,
user/rule sliding entries, cooldown, and game-token tables plus bounded-query
indexes.

Admission uses the existing runtime-owned SQLite repository. It starts
`BEGIN IMMEDIATE`, verifies the current reconciled owner, evaluates every
scope, writes only an admitted candidate's capacity state, performs bounded
cleanup, verifies ownership again, and commits. Failure rolls back. A newer
runtime fences the old connection.

The SQLite busy timeout now precedes migration execution, closing a
fresh-database separate-worker race exposed during verification.

## Frozen defaults

- `maxUserBuckets`: 4,096
- `inactiveRetentionMs`: 600,000
- `sweepLimit`: 128

These defaults bound local cardinality and per-transaction cleanup while
covering the fixed minute window. Each profile may use validated smaller
values; retention must also cover its longest cooldown.

## Frozen Gemini boundary

Gemini may create only:

- `packages/mapping-engine/test/fixtures/phase-c-milestone-02.ts`
- `packages/mapping-engine/test/milestone-02.black-box.test.ts`
- `packages/mapping-engine/test/phase-c-milestone-02.declaration-consumer.ts`
- `packages/mapping-engine/test/tsconfig.phase-c-milestone-02.json`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02-GEMINI-01.md`

The exact task is:

`docs/orchestration/prompts/PHASE-C-MILESTONE-02-GEMINI-01.md`

Production files, existing tests, schemas, exports, algorithms, persistence,
package configuration, and execution documents are frozen.

## Fresh verification

- mapping-engine: 9 tests / 1 file; lint, typecheck, build, declarations passed
- server: 53 tests / 5 files; lint, typecheck, build, declarations passed
- contracts: 175 tests / 7 files; lint, typecheck, forced build, declarations passed
- event-core: 38 tests / 3 files; lint, typecheck, build, declarations passed
- repository: 308 tests / 20 files; lint, typecheck, build passed
- Node.js v24.15.0
- pnpm 11.9.0
- `git diff --check HEAD --`: passed

## Explicit exclusions

No final action ID, durable candidate queue, transport, Socket.IO, delivery
ordering, retry worker, TTL expiry worker, SDK behavior, demo game, voice, or
Milestone 3 implementation exists.

## Next action

Run the frozen Gemini additive prompt, allow at most one focused rework, then
perform an independent focused review of the complete accumulated Milestone 2
working-tree diff.

No commit or push was performed.
