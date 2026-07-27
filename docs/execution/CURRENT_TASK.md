# Current Task

**Task ID:** PHASE-C-MILESTONE-03-REMEDIATION-01
**Parent Task:** Phase C — Game Vertical Slice
**Status:** READY_FOR_INDEPENDENT_RE_REVIEW
**Primary owner:** CODEX
**Priority:** P0

## Objective

Remediate findings H-1, H-2, M-1, M-2, M-3 from Claude Independent Review 01 for the durable Action Gateway lifecycle and delivery orchestration (`BE-07B`–`BE-07D`).

Milestone 3 covers deterministic `actionId` derivation, durable idempotency claims, deferred candidate persistence and full budget re-admission promotion, persist-before-send delivery orchestration, retry scheduling, live TTL expiry, restart reconciliation, and transport-neutral delivery port boundaries.

## State

- Phase C: IN_PROGRESS
- Milestone 3: IN_PROGRESS
- Milestone 3 architecture: RESOLVED (ADR-019 through ADR-024 accepted)
- Milestone 3 Slice 1 (GEMINI-01): APPROVED_AND_COMPLETE
- Milestone 3 Slice 2 (CODEX core): READY_FOR_INDEPENDENT_RE_REVIEW
- Claude Independent Review 01: REQUEST_CHANGES
- Remediation: COMPLETE_PENDING_RE_REVIEW
- Milestones 4–5: BLOCKED_BY_PREVIOUS_MILESTONE
- Phase D: untouched

## Required reading

1. `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md`
2. `docs/orchestration/plans/PHASE-C-MILESTONE-03-DELEGATION-PLAN.md`
3. `docs/orchestration/reviews/PHASE-C-MILESTONE-03-CODEX-CORE-INDEPENDENT-REVIEW-01.md`
4. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-CODEX-CORE-REMEDIATION-01.md`
5. ADR-019 through ADR-024 in `docs/execution/DECISIONS.md`

## Hard boundaries

- Do not implement transport, Socket.IO, SDK, demo game, voice, or Phase D.
- Do not begin Milestones 4–5.
- Follow ADR-019 through ADR-024 for action identity, deferred storage, lifecycle statuses, persist-before-send, delivery port, and trusted time.

## Core implementation state

The CODEX-owned Milestone 3 core remediation is complete and verified in the uncommitted working tree. It includes additive coverage for live TTL worker expiry, promotion negative paths, restart reconciliation of received/deferred states, migration v4 deferred row survival, and corrected review provenance documentation. Full Milestone 3 independent approval remains pending Claude re-review.
