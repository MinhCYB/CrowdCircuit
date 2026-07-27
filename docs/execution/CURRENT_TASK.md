# Current Task

**Task ID:** PHASE-C-MILESTONE-04-ARCHITECTURE
**Parent Task:** Phase C — Game Vertical Slice
**Status:** READY_FOR_INDEPENDENT_REVIEW
**Primary owner:** CODEX
**Priority:** P0

## Objective

Obtain independent approval for the Phase C Milestone 4 transport/session
architecture that connects the approved Milestone 3 core to authenticated
Socket.IO game clients and the JavaScript SDK.

## State

- Phase C: IN_PROGRESS
- Milestone 3: APPROVED_AND_COMPLETE
- Milestone 3 architecture: RESOLVED (ADR-019 through ADR-024 accepted)
- Milestone 4 architecture: READY_FOR_INDEPENDENT_REVIEW
- Milestone 4 implementation: BLOCKED_BY_ARCHITECTURE_REVIEW
- Milestone 5: BLOCKED_BY_PREVIOUS_MILESTONE
- Phase D: untouched

## Required reading

1. `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md`
2. `docs/orchestration/plans/PHASE-C-MILESTONE-04-DELEGATION-PLAN.md`
3. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-ARCHITECTURE.md`
4. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-CLOSURE.md`
5. ADR-019 through ADR-024 in `docs/execution/DECISIONS.md`

## Hard boundaries

- Do not implement transport, Socket.IO, SDK, demo game, voice, or Phase D
  during architecture review.
- Do not begin Milestone 4 implementation until independent architecture
  approval and accepted ADR recording are complete.
- Milestone 5 remains BLOCKED_BY_PREVIOUS_MILESTONE.

## Architecture summary

The proposed architecture defines `/game` handshake authentication,
generation-fenced live sessions, a process-local bounded registry, a
Socket.IO-backed `ActionDeliveryPort`, attempt-correlated receipt/result
messages, SDK deduplication, liveness, backpressure, security limits, and
sequential implementation/review slices. ADR-025 through ADR-030 remain
proposed pending independent review.
