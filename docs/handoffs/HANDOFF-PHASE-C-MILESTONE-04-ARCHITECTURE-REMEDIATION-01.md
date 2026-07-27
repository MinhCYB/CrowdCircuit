# Handoff: Phase C Milestone 4 Architecture Remediation 01

**Date:** 2026-07-27
**Baseline commit:** `d4092f4`
**Claude Architecture Review 01:** REQUEST_CHANGES (historical)
**Remediation status:** COMPLETE
**Claude Architecture Re-Review 02:** APPROVE_WITH_SMALL_FIX (historical)
**Final Architecture Fix Verification:** APPROVE
**Architecture status:** APPROVED_AND_COMPLETE (ADR-025 through ADR-030 ACCEPTED)
**Implementation status:** Ready to begin Slice 1 per approved delegation plan

## Findings remediated

- M-1: Section 19 now contains an explicit acceptance matrix covering every
  required test category, its required style, and the failure property it MUST
  prove.
- M-2: Proposed ADR-028 now records the exact cross-generation stale-attempt
  receipt rule, rationale, security assumptions, invalidating future changes,
  stale-session and cross-client rejection, duplicate idempotency, and stricter
  result handling.
- L-1: Proposed ADR-025 now maps missing token and current auth-core error codes
  to stable wire errors, with middleware-owned missing/query-token detection
  and no raw error/token exposure.
- L-2: Proposed ADR-027 now owns deterministic null-instance selection,
  invocation, meaning, tie behavior, generation fencing, non-load-balancing
  intent, and explicit-instance no-fallback behavior. The resolved question was
  removed from Section 24.
- L-3: Proposed ADR-025 now governs client-visible versus internal errors,
  stable codes, token/secret redaction, fingerprint handling, structured
  lifecycle correlation, high-cardinality metric limits, and the non-durable
  meaning of process-local session counts.

## Exact sections changed

- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md`:
  status; Section 5 proposed ADR-025, ADR-027, and ADR-028 decisions; Sections
  7, 10, and 11 normative cross-references; Section 19 acceptance matrix;
  Section 24 open questions; Section 25 verdict.
- `docs/orchestration/plans/PHASE-C-MILESTONE-04-DELEGATION-PLAN.md`: status,
  exclusive sequential slice ownership, and acceptance ownership.
- `docs/execution/CURRENT_TASK.md`, `docs/execution/PROJECT_STATUS.md`,
  `docs/execution/ROADMAP.md`, and
  `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md`: architecture
  remediation and re-review status synchronization.
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-ARCHITECTURE.md`: re-review
  status and resolved null-instance question.

## ADR candidate disposition

ADR-025 through ADR-030 remain PROPOSED. None is accepted or appended to
`docs/execution/DECISIONS.md`. ADR-025, ADR-027, and ADR-028 contain the
remediated decisions; ADR-026, ADR-029, and ADR-030 are unchanged in
disposition.

## Test-strategy additions

The matrix explicitly assigns real Socket.IO integration, pure registry unit,
adapter unit/integration, repository integration, fake-clock,
multi-client race/concurrency, and declaration/public-contract styles. It
covers duplicate registration/receipt/result, stale attempts, spoof rejection,
multiple instances, all required exhaustion cases, malformed/oversized
payloads, both resolve/send races, and the required integration/unit layers.

## Delegation and ownership

Implementation remains sequential. Contracts own stable wire schemas;
auth/registry owns missing-versus-invalid mapping; the delivery adapter owns
deterministic destination selection and resolve/send races; receipt/result owns
attempt and identity fencing plus idempotency; final integration owns the full
exhaustion, malformed/oversized, real Socket.IO, restart/reconnect,
multiple-instance, fake-clock, repository, and concurrency matrix. Active
agents SHALL NOT have overlapping file ownership. Milestone 5 remains blocked.

## Remaining open questions

No product-blocking question remains. Independent re-review must confirm the
registration token removal, lifecycle correlation fields, and selected numeric
bounds/heartbeat timing. Any requested change returns to architecture review.

## Final status

- Phase C: IN_PROGRESS
- Milestone 3: APPROVED_AND_COMPLETE
- Claude Architecture Review 01: REQUEST_CHANGES (historical)
- Architecture remediation 01: COMPLETE
- Claude Architecture Re-Review 02: APPROVE_WITH_SMALL_FIX (historical)
- Final Architecture Fix Verification: APPROVE
- Milestone 4 architecture: APPROVED_AND_COMPLETE (decision state: RESOLVED)
- Milestone 4 implementation: ready to begin `Slice 1 — Shared contracts and additive scaffolding` per approved delegation plan
- Milestone 5: BLOCKED_BY_PREVIOUS_MILESTONE
- Phase D: untouched

## Verification performed

The baseline branch, full and short HEAD, clean tree, recent log, Node.js
version, and pnpm version were checked before editing. Documentation diff
whitespace, changed/untracked inventory, scope, local-path leakage, stale
status, ADR disposition, open-question consistency, implementation readiness,
and Milestone 5/Phase D status are checked at handoff.

No production code, tests, manifests, lockfiles, migrations, schemas, generated
files, or `docs/execution/DECISIONS.md` were changed. No staging, commit, or
push was performed.
