# Current Task

**Task ID:** PHASE-C-MILESTONE-04-SLICE-04
**Parent Task:** Phase C — Game Vertical Slice (Milestone 4)
**Status:** READY_TO_BEGIN
**Primary owner:** CODEX
**Priority:** P0

## Objective

Implement Phase C Milestone 4 Slice 4 inbound receipt/result lifecycle under
the approved focused amendment.

## State

- Phase C: IN_PROGRESS
- Milestone 3: APPROVED_AND_COMPLETE
- Milestone 4 architecture: APPROVED_AND_COMPLETE (ADR-025 through ADR-030 ACCEPTED)
- Milestone 4 implementation: IN_PROGRESS
- Slice 1 (Shared contracts & additive scaffolding): APPROVED_AND_COMPLETE
- Slice 2 (Server authentication and registry): APPROVED_AND_COMPLETE
- Slice 3 implementation commit `6617f9f`: REQUEST_CHANGES
- Slice 3 client-routing correction architecture: APPROVED_FOR_REMEDIATION
- Slice 3 remediation commit `de0b589`: APPROVED
- Slice 3 overall: APPROVED_AND_COMPLETE
- Slice 4 initial implementation attempt: ARCHITECTURE_GAP
- Slice 4 architecture review: REQUEST_CHANGES
- Slice 4 focused amendment: APPROVED_FOR_IMPLEMENTATION
- Slice 4 implementation: READY_TO_BEGIN; implementation has not begun
- Slice 5 through Slice 6: blocked by the approved sequential flow
- Milestone 5: BLOCKED_BY_PREVIOUS_MILESTONE
- Phase D: untouched

## Required reading

1. `docs/orchestration/plans/PHASE-C-MILESTONE-04-DELEGATION-PLAN.md`
2. `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-03-INDEPENDENT-REREVIEW-01.md`
3. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-03.md`
4. `docs/execution/DECISIONS.md` (especially ADR-028)

## Hard boundaries

- Slice 4 is limited to the exact production/test allowlist in the approved
  focused amendment.
- Preserve Milestone 3 durable lifecycle authority and ADR-028 authorization,
  idempotency, conflict, retry, TTL, and restart semantics.
- Stop with `ARCHITECTURE_GAP` if current durable attempts cannot authorize
  cross-client messages without a persistence/schema change.
- Do not begin Slice 5, Slice 6, Milestone 5, or Phase D.
- Milestone 5 remains BLOCKED_BY_PREVIOUS_MILESTONE.

## Slice 2 Closure Summary

Slice 2 (Server authentication and registry) is APPROVED_AND_COMPLETE.
Implementation commit: `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3`.
Remediation commit: `abd0f985fa3de66d7f2e507b5ace8416c712050d`.
All four review findings (M-1, L-1, L-2, L-3) are RESOLVED. Final Node 24
verification: 433/433 tests passing.
