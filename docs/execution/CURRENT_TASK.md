# Current Task

**Task ID:** PHASE-C-MILESTONE-02
**Parent Task:** Phase C — Game Vertical Slice
**Status:** READY_FOR_FOCUSED_REVIEW
**Primary owner:** CODEX
**Priority:** P0

## Objective

Deliver deterministic event-to-action mapping and bounded action-budget
capability for roadmap items `BE-05A`–`BE-05E` and `BE-06A`–`BE-06B`.

Milestone 2 covers mapping configuration and validation, deterministic
evaluation of approved Phase B normalized events, action candidate
construction, rule/user/game budgets, dry-run diagnostics, and the frozen
output boundary consumed later by the durable Action Gateway.

## State

- Phase A: DONE
- Phase B: DONE at commit `86f1a32`
- Phase C: IN_PROGRESS
- Milestone 1: DONE
- `FOUND-03A`–`FOUND-03D`: DONE
- `FOUND-04A`–`FOUND-04D`: DONE
- Milestone 2: READY_FOR_FOCUSED_REVIEW
- Remediation 01: COMPLETE
- M2-D1 through M2-D6: RESOLVED by ADR-013 through ADR-018
- Milestones 3–5: BLOCKED_BY_PREVIOUS_MILESTONE
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

The CODEX-owned production core is implemented in the uncommitted working tree:

- strict mapping/profile/manifest schemas and package-name declarations;
- deterministic operators, specificity, ordering, match modes, templates,
  candidate output, and ADR-013 identity;
- schema version 2 durable cooldown, sliding-window, anonymous/user, and
  per-game token-bucket state;
- runtime-owner-fenced atomic admission with rollback, restart preservation,
  clock-rollback rejection, bounded capacity, and deterministic cleanup;
- typed accepted, rejected, dropped, and deferred boundary results;
- no queue, transport, final `actionId`, or Milestone 3 implementation.

The frozen additive task is
`docs/orchestration/prompts/PHASE-C-MILESTONE-02-GEMINI-01.md`.
Milestone 2 is not yet `DONE` or `READY_FOR_FOCUSED_REVIEW`.

## Milestone 1 closure

The latest independent verdict supplied by the product owner is `APPROVE`.
Milestone 1's authentication and durable persistence prerequisites are closed.
Historical `REQUEST CHANGES` reviews remain preserved. No separate persisted
independent approval report existed in the working tree at administrative
closure, so this document does not invent one.
