# Current Task

**Task ID:** PHASE-C-MILESTONE-04-SLICE-03
**Parent Task:** Phase C — Game Vertical Slice (Milestone 4)
**Status:** READY_TO_BEGIN_WITH_APPROVED_AMENDMENT
**Primary owner:** CODEX
**Priority:** P0

## Objective

Begin Slice 3 — Delivery adapter using the approved delivery-bridge amendment.
Slice 2 (Server authentication and registry) is APPROVED_AND_COMPLETE.
Implementation has not begun.

## State

- Phase C: IN_PROGRESS
- Milestone 3: APPROVED_AND_COMPLETE
- Milestone 4 architecture: APPROVED_AND_COMPLETE (ADR-025 through ADR-030 ACCEPTED)
- Milestone 4 implementation: IN_PROGRESS
- Slice 1 (Shared contracts & additive scaffolding): APPROVED_AND_COMPLETE
- Slice 2 (Server authentication and registry): APPROVED_AND_COMPLETE
- Slice 3 architecture gap: RESOLVED
- Slice 3 implementation (Delivery adapter): READY_TO_BEGIN_WITH_APPROVED_AMENDMENT
- Slice 4 through Slice 6: BLOCKED_BY_PREVIOUS_SLICE_REVIEW
- Milestone 5: BLOCKED_BY_PREVIOUS_MILESTONE
- Phase D: untouched

## Required reading

1. `docs/orchestration/plans/PHASE-C-MILESTONE-04-SLICE-03-DELIVERY-BRIDGE-AMENDMENT.md`
2. `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-03-GAP-ARCHITECTURE-REVIEW-01.md`
3. `docs/orchestration/plans/PHASE-C-MILESTONE-04-DELEGATION-PLAN.md`
4. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-02-CLOSURE.md`
5. `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-02-INDEPENDENT-REVIEW-02.md`
6. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-ARCHITECTURE-CLOSURE.md`
7. `docs/execution/DECISIONS.md` (ADR-025 through ADR-030)

## Hard boundaries

- Slice 3 scope is the exact narrow allowlist in the approved delivery-bridge
  amendment; it includes the adapter plus restricted internal bridge changes
  in `game/ports.ts`, `game/registry/index.ts`, and `game/socket-server.ts`.
- Authentication mapping, registration/replacement, heartbeat/rate, cleanup,
  inbound receipt/result, persistence, and SDK runtime remain frozen.
- Do not edit SDK implementation files during Slice 3.
- Do not begin Slice 4, Slice 5, Slice 6, Milestone 5, or Phase D.
- Milestone 5 remains BLOCKED_BY_PREVIOUS_MILESTONE.

## Slice 2 Closure Summary

Slice 2 (Server authentication and registry) is APPROVED_AND_COMPLETE.
Implementation commit: `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3`.
Remediation commit: `abd0f985fa3de66d7f2e507b5ace8416c712050d`.
All four review findings (M-1, L-1, L-2, L-3) are RESOLVED. Final Node 24
verification: 433/433 tests passing.
