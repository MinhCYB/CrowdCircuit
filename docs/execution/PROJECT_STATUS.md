# Project Status

**Last updated:** 2026-07-29
**Last completed phase:** Phase B — Event Pipeline
**Phase B commit:** `86f1a32` (`feat: complete Phase B event pipeline`)
**Current phase:** Phase C — Game Vertical Slice
**Phase C status:** IN_PROGRESS
**Current milestone:** PHASE-C-MILESTONE-04 — IN_PROGRESS (Slices 1–3: APPROVED_AND_COMPLETE; Slice 4: READY_FOR_INDEPENDENT_REVIEW)
**Milestone 3 architecture status:** RESOLVED (ADR-019 through ADR-024 accepted)
**Milestone 3 status:** APPROVED_AND_COMPLETE
**Milestone 4 architecture status:** RESOLVED (ADR-025 through ADR-030 accepted)
**Milestone 4 architecture:** APPROVED_AND_COMPLETE
**Milestone 4 implementation:** IN_PROGRESS
**Milestone 4 Slice 1 (Shared contracts & scaffolding):** APPROVED_AND_COMPLETE (final commit: `3809337e900b02ade7a47176b823b7d4868151e7`)
**Milestone 4 Slice 2 (Server authentication and registry):** APPROVED_AND_COMPLETE (implementation: `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3`; remediation: `abd0f985fa3de66d7f2e507b5ace8416c712050d`)
**Milestone 4 Slice 3 implementation commit `6617f9f`:** REQUEST_CHANGES
**Milestone 4 Slice 3 client-routing correction architecture:** APPROVED_FOR_REMEDIATION
**Milestone 4 Slice 3 remediation commit `de0b589`:** APPROVED
**Milestone 4 Slice 3 overall:** APPROVED_AND_COMPLETE
**Milestone 4 Slice 4 initial implementation attempt:** ARCHITECTURE_GAP
**Milestone 4 Slice 4 architecture review:** REQUEST_CHANGES
**Milestone 4 Slice 4 focused amendment:** APPROVED_FOR_IMPLEMENTATION
**Milestone 4 Slice 4 implementation:** READY_FOR_INDEPENDENT_REVIEW
**Milestone 4 Slice 4 implementation commit `0dde422`:** REQUEST_CHANGES
**Milestone 4 Slice 4 Composition B remediation:** READY_FOR_INDEPENDENT_REVIEW
**Milestone 4 Slice 5 through Slice 6:** blocked by the approved sequential flow
**Slice 4 implementation baseline:** HEAD `59c7d3d7450ca426fb1038e736e4a64794768604`

The Composition B remediation addresses exactly the independent review's
database-path fallback, partial-construction cleanup, and missing composition
tests. Verification passes with server 172/172, contracts 185/185, and
repository 470/470 tests. No protocol, schema, contracts, or SDK change was
made. Next action: independently re-review the Slice 4 Composition B
remediation. Slice 5 and Milestone 5 remain blocked; Phase D is untouched.

## Runtime baseline

- Node.js v24.15.0
- pnpm 11.9.0
- TypeScript 5.9.3
- Zod 3.24.2
- Vitest 4.1.10

## Phase C milestones

1. Authentication and durable persistence prerequisites — DONE
2. Mapping and action-budget capability — APPROVED_AND_COMPLETE
3. Durable Action Gateway lifecycle — APPROVED_AND_COMPLETE
4. Authenticated game-session delivery and SDK vertical slice — IN_PROGRESS (Architecture: APPROVED_AND_COMPLETE; Slices 1–3: APPROVED_AND_COMPLETE; Slice 4: READY_FOR_INDEPENDENT_REVIEW)
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

## Milestone 2 architecture

M2-D1 through M2-D6 are resolved by ADR-013 through ADR-018:

- deterministic versioned candidate seed; final `actionId` belongs to
  Milestone 3;
- stable user-ID precedence with a shared rule/profile-scoped anonymous bucket;
- exact sliding user/rule windows and atomic multi-scope admission;
- durable cooldown, window, and global-token state across restart;
- typed deferred mapping results with durable queue ownership in Milestone 3;
- validated bounded state, deterministic cleanup, and fail-closed exhaustion.

The CODEX-owned Milestone 2 core is implemented and verified. The frozen
Gemini additive fixture/test/declaration/documentation task is
`READY_TO_START`. Milestone 2 remains incomplete until that additive work and
focused review finish.

## Planning artifacts

- `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md`
- `docs/orchestration/plans/PHASE-C-MILESTONE-02-DELEGATION-PLAN.md`
- `docs/orchestration/prompts/PHASE-C-MILESTONE-01-CODEX.md`
- `docs/orchestration/prompts/PHASE-C-MILESTONE-02-CODEX.md`
- `docs/orchestration/prompts/PHASE-C-MILESTONE-02-GEMINI-01.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-02-CODEX-CORE-SELF-REVIEW.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02-CODEX-CORE.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-01-COMPLETE.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-01-FINAL-APPROVAL-RECORD.md`
- ADR-012 in `docs/execution/DECISIONS.md`
- ADR-013 through ADR-018 in `docs/execution/DECISIONS.md`

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
