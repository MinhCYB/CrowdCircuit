# Current Task

**Task ID:** PHASE-C-MILESTONE-03-SLICE-02
**Parent Task:** Phase C — Game Vertical Slice
**Status:** APPROVED_AND_COMPLETE
**Primary owner:** CODEX
**Priority:** P0

## Objective

Implement the durable Action Gateway lifecycle and delivery orchestration for
roadmap items `BE-07B`–`BE-07D`.

Milestone 3 covers deterministic `actionId` derivation, durable idempotency
claims, deferred candidate persistence and full budget re-admission promotion,
persist-before-send delivery orchestration, retry scheduling, live TTL expiry,
restart reconciliation, and transport-neutral delivery port boundaries.

## State

- Phase A: DONE
- Phase B: DONE at commit `86f1a32`
- Phase C: IN_PROGRESS
- Milestone 1: DONE
- `FOUND-03A`–`FOUND-03D`: DONE
- `FOUND-04A`–`FOUND-04D`: DONE
- Milestone 2: APPROVED_AND_COMPLETE (`BE-05A`–`BE-06B` complete)
- Milestone 3 architecture: RESOLVED (ADR-019 through ADR-024 accepted)
- Milestone 3 Slice 1 (GEMINI-01): APPROVED_AND_COMPLETE (independent review: APPROVE_WITH_SMALL_FIX; approved small fix: CLOSED)
- Milestone 3 Slice 2 (CODEX-CORE): APPROVED_AND_COMPLETE (independent verdict: APPROVE)
- Milestones 4–5: BLOCKED_BY_PREVIOUS_MILESTONE
- Phase D: untouched

## Required reading

1. `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md`
2. `docs/orchestration/plans/PHASE-C-MILESTONE-02-DELEGATION-PLAN.md`
3. `docs/orchestration/prompts/PHASE-C-MILESTONE-02-CODEX.md`
4. ADR-012 in `docs/execution/DECISIONS.md`
5. System Design sections 11.5 and 11.9

## Hard boundaries

- Do not implement transport, Socket.IO, SDK, demo game, voice, or Phase D.
- Do not begin Milestones 3–5.
- Follow ADR-013 through ADR-018 for action identity, anonymous budgeting,
  windowing and atomic admission, durable budget state, deferred queue
  ownership, and bounded-state cleanup.
- Durable persist-before-send remains a Milestone 3 requirement. Milestone 2
  may define only its frozen output boundary.

## Core implementation state

The CODEX-owned Milestone 3 core is implemented and verified in the
uncommitted working tree. It includes deterministic final action identity,
durable deferred storage and atomic full budget re-admission promotion,
destination-first persist-before-send delivery, bounded retry/TTL processing,
restart reconciliation, concurrency/failure-injection tests, declarations,
self-review, handoff, and an independent `APPROVE` verdict. Full Milestone 3
administrative closure remains pending.

## Milestone 1 closure

The latest independent verdict supplied by the product owner is `APPROVE`.
Milestone 1's authentication and durable persistence prerequisites are closed.
Historical `REQUEST CHANGES` reviews remain preserved. No separate persisted
independent approval report existed in the working tree at administrative
closure, so this document does not invent one.
