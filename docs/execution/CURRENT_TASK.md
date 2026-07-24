# Current Task

**Task ID:** PHASE-C-MILESTONE-02
**Parent Task:** Phase C — Game Vertical Slice
**Status:** READY_TO_START — BLOCKED_DECISION before implementation
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
- Milestone 2: READY_TO_START, with implementation blocked until the decisions
  in `docs/orchestration/plans/PHASE-C-MILESTONE-02-DELEGATION-PLAN.md` are
  resolved and recorded
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
- Do not invent unresolved action identity, anonymous-budget, budget-window,
  restart-state, or queue-with-TTL semantics.
- Durable persist-before-send remains a Milestone 3 requirement. Milestone 2
  may define only its frozen output boundary.

## Milestone 1 closure

The latest independent verdict supplied by the product owner is `APPROVE`.
Milestone 1's authentication and durable persistence prerequisites are closed.
Historical `REQUEST CHANGES` reviews remain preserved. No separate persisted
independent approval report existed in the working tree at administrative
closure, so this document does not invent one.
