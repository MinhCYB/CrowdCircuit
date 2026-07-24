# Project Status

**Last updated:** 2026-07-24
**Last completed phase:** Phase B — Event Pipeline
**Phase B commit:** `86f1a32` (`feat: complete Phase B event pipeline`)
**Current phase:** Phase C — Game Vertical Slice
**Phase C status:** IN_PROGRESS
**Current milestone:** PHASE-C-MILESTONE-02 — READY_TO_START
**Working tree:** Accumulated uncommitted approved Milestone 1 implementation and Milestone 2 planning documents

## Runtime baseline

- Node.js v24.15.0
- pnpm 11.9.0
- TypeScript 5.9.3
- Zod 3.24.2
- Vitest 4.1.10

## Phase C milestones

1. Authentication and durable persistence prerequisites — DONE
2. Mapping and action-budget capability — READY_TO_START; implementation blocked pending recorded semantic decisions
3. Durable Action Gateway lifecycle — BLOCKED_BY_PREVIOUS_MILESTONE
4. Authenticated game-session delivery and SDK — BLOCKED_BY_PREVIOUS_MILESTONE
5. Demo game, recovery, and Phase C acceptance — BLOCKED_BY_PREVIOUS_MILESTONE

## Phase C scope

The phase covers `FOUND-03A`–`FOUND-03D`, `FOUND-04A`–`FOUND-04D`, and
`BE-05A`–`BE-09C`. Authentication and durable persistence are incorporated
prerequisites.

ADR-012 requires every action to be durably recorded before its first transport
send. Retry and reconciliation use that record as the source of truth.
Restarted runtimes reconcile non-terminal actions without silently losing or
automatically replaying gameplay. In-memory repositories are test fakes only.

## Dependency gate

`BE-07A` now depends on `FOUND-03D`, `FOUND-04D`, and `BE-05E`. Downstream
delivery and SDK work inherit the authentication and durable-state gates.

## Planning artifacts

- `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md`
- `docs/orchestration/plans/PHASE-C-MILESTONE-02-DELEGATION-PLAN.md`
- `docs/orchestration/prompts/PHASE-C-MILESTONE-01-CODEX.md`
- `docs/orchestration/prompts/PHASE-C-MILESTONE-02-CODEX.md`
- `docs/orchestration/prompts/PHASE-C-MILESTONE-02-GEMINI-01.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-01-COMPLETE.md`
- ADR-012 in `docs/execution/DECISIONS.md`

## Milestone 1 implementation evidence

Milestone 1 is accepted. The product-owner closure instruction records the
latest independent verdict as `APPROVE`. No separate persisted approval report
was present at closure time; the earlier `REQUEST CHANGES` reports remain
unchanged as historical evidence.

- `@crowdcircuit/auth-core` provides runtime-secret lifecycle, one-time
  pairing, role sessions, origin policy, and reusable authorization boundaries.
- Server schema version 1 uses SQLite with Drizzle-owned schema definitions and
  deterministic transactional migrations.
- Durable action creation and its opaque one-time authorization commit
  together. Duplicate creation never returns another send capability.
- Each repository claims a cryptographically random durable runtime-owner
  generation. Capabilities are valid only through their exact issuing
  repository while that generation remains current; a new owner must complete
  reconciliation before authorization operations.
- Every owner-scoped action/authorization write validates that durable owner
  under the same SQLite write transaction. Superseded repositories receive
  `RUNTIME_SUPERSEDED` before revocation, transition, retry, attempt,
  reconciliation, terminalization, or action-retention mutation.
- Retry attempts, optimistic transitions, bounded retention, and restart
  reconciliation use durable state; no production in-memory fallback exists.
- Restart reconciliation and logical retention cleanup use all-or-nothing
  transactions.
- Authentication endpoints reject every query parameter before mutation and
  log sanitized paths without credentials.
- Pairing validation does not consume a code on role, client, origin, or body
  failure. Pairing/session registries enforce deterministic capacity and
  cleanup.
- Migration metadata records and verifies contiguous version, stable ID, and
  SQL checksum history. Empty manifests fail before any database mutation.
- Pairing/session cleanup has no caller-controlled timestamp and always reads
  the injected trusted clock internally.
- Separate-worker SQLite creation races, commit-boundary fault injection, and
  staged fake rollback tests preserve concurrency and transactional evidence.
- Focused checks pass: auth-core 11 tests, server 47 tests, and both
  package-name declaration consumers.
- Repository verification passes: 293 tests across 18 files.
- Phase D voice behavior remains untouched.
