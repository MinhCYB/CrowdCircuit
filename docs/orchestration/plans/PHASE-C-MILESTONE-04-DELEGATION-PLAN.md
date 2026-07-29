# Phase C Milestone 4 — Delegation Plan

**Date:** 2026-07-28
**Architecture status:** APPROVED_AND_COMPLETE (ADR-025 through ADR-030 ACCEPTED)
**Implementation status:** IN_PROGRESS (Slices 1–3: APPROVED_AND_COMPLETE; Slice 4 initial attempt: ARCHITECTURE_GAP; review: REQUEST_CHANGES; amendment: APPROVED_FOR_IMPLEMENTATION; implementation: READY_TO_BEGIN)
**Primary implementation owner:** CODEX

## Strategy

Implementation is sequential. No two agents edit the same files concurrently.
Every slice begins from the prior reviewed checkpoint. The user owns all Git
operations; commit checkpoints below are recommendations and do not authorize
an agent to stage, commit, or push.

## Slice 0 — Architecture approval gate

Owner: Claude independent reviewer.

Status: APPROVED_AND_COMPLETE (Claude Independent Review 02: APPROVE).

Review evidence:
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-INDEPENDENT-REVIEW-02.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-ARCHITECTURE-CLOSURE.md`

All architecture decisions (ADR-025 through ADR-030) are ACCEPTED in `docs/execution/DECISIONS.md`. Implementation is authorized to proceed to Slice 1.

Recommended user commit checkpoint: accepted architecture and ADRs.

## Slice 1 — Shared contracts and additive scaffolding

Owner: Gemini, under a frozen prompt.

Status: APPROVED_AND_COMPLETE (Claude Independent Re-Review 02: APPROVE).

Review evidence:
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-01-SELF-REVIEW.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-01.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-01-INDEPENDENT-REVIEW-02.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-01-CLOSURE.md`

All review findings (M-1, L-1, L-2, L-3, L-4) RESOLVED. Final commit: `3809337e900b02ade7a47176b823b7d4868151e7`.

Recommended user commit checkpoint: reviewed additive contract slice.

## Slice 2 — Server authentication and registry

Owner: CODEX.

Status: APPROVED_AND_COMPLETE (Node 24 final verification: APPROVE).

Exclusive files:

- `apps/server/src/game/auth/**` and `apps/server/src/game/registry/**`;
- server composition and focused tests.

Deliver:

- `/game` namespace middleware;
- origin/query/token validation, including missing-token versus auth-core
  invalid/expired/revoked/forbidden mapping;
- registration and generation-fenced registry;
- heartbeat/rate/capacity enforcement;
- shutdown cleanup;
- pure registry unit tests and focused real Socket.IO auth/registration tests.

Do not edit SDK implementation files during this slice.

Review evidence:

- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-02-SELF-REVIEW.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-02.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-02-INDEPENDENT-REVIEW-02.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-02-CLOSURE.md`

All review findings (M-1, L-1, L-2, L-3) RESOLVED.
Implementation commit: `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3`.
Remediation commit: `abd0f985fa3de66d7f2e507b5ace8416c712050d`.
Final Node 24 verification: 433/433 repository tests; all gates pass.

Review gate: Claude focuses on auth mapping, registry bounds, stale-session
fencing, cleanup, and file ownership.

Recommended user commit checkpoint: reviewed server transport slice.

## Slice 3 — Delivery adapter

Implementation commit `6617f9f`: REQUEST_CHANGES.

Client-routing correction architecture: APPROVED_FOR_REMEDIATION.

Remediation commit `de0b589`: APPROVED.

Overall status: APPROVED_AND_COMPLETE.

Owner: CODEX.

Authoritative amendment:

- `docs/orchestration/plans/PHASE-C-MILESTONE-04-SLICE-03-CLIENT-ROUTING-AMENDMENT.md`
- `docs/orchestration/plans/PHASE-C-MILESTONE-04-SLICE-03-DELIVERY-BRIDGE-AMENDMENT.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-03-GAP-ARCHITECTURE-REVIEW-01.md`

Exact implementation ownership:

- `apps/server/src/delivery/socket-io/**` for the adapter;
- `apps/server/src/game/ports.ts` only for transport-neutral fence/result
  interfaces required across internal modules; no Socket.IO imports,
  auth/registration/heartbeat changes, or raw handle export;
- `apps/server/src/game/registry/index.ts` only for eligible-only lookup,
  exact-fence `sendIfCurrent`, closed/auth/current-generation/writability
  checks, bounded result mapping, and the minimum shared eligibility
  predicate; no registration/replacement/heartbeat/cleanup-policy changes;
- `apps/server/src/game/socket-server.ts` only to extend the private
  `GameConnectionHandle` with action-specific synchronous `sendAction`, wire
  it to the private socket, check connected/writable/backpressure state, and
  redact synchronous emit exceptions; no target selection, inbound
  receipt/result behavior, or public Socket.IO export;
- registry unit tests, adapter unit tests, real Socket.IO delivery integration
  tests, and declaration tests.

Corrective ownership additionally permits only the exact delivery gateway,
persistence type/repository, and test migrations listed in the client-routing
amendment. No broad persistence co-ownership is granted. Everything else,
including schema/migrations, remains frozen.

Deliver:

- deterministic ADR-027 null-instance selection;
- explicit-instance no-fallback behavior;
- destination generation fencing;
- disappearance and replacement between resolve and send;
- backpressure and emit-failure behavior with no durable mutation.

Review gate: Claude verifies deterministic routing, resolve/send race
coverage, and adapter isolation.

Final review evidence:

- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-03-INDEPENDENT-REREVIEW-01.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-03-SELF-REVIEW.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-03.md`

Recommended user commit checkpoint: reviewed delivery adapter slice.

## Slice 4 — Receipt/result integration

Owner: CODEX.

Status: READY_TO_BEGIN. The initial attempt stopped at `ARCHITECTURE_GAP`;
implementation has not begun.

Architecture review: `REQUEST_CHANGES`.

Authoritative focused amendment and review:

- `docs/orchestration/plans/PHASE-C-MILESTONE-04-SLICE-04-INBOUND-LIFECYCLE-AMENDMENT.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-04-ARCHITECTURE-REVIEW-01.md`

Exclusive production and test files are the exact ownership allowlist in the
focused amendment; it supersedes the earlier broad Slice 4 wording.

Deliver:

- current-generation and durable-attempt binding validation;
- ADR-028 stale-attempt receipt acceptance from the current replacement
  generation, stale-session rejection, cross-client/game-instance rejection,
  and duplicate receipt/result idempotency;
- conflicting/late result rejection;
- retry/TTL/restart integration evidence.

Stop if current durable attempts cannot authorize cross-client messages without
a persistence/schema change. Return `ARCHITECTURE_GAP`.

Review gate: Claude verifies Milestone 3 remains authoritative.

Recommended user commit checkpoint: reviewed inbound lifecycle slice.

## Slice 5 — JavaScript SDK

Owner: CODEX. Gemini may add frozen fixtures and declaration-negative tests
only after the core SDK implementation is complete.

Exclusive files:

- `packages/game-sdk-js/**`;
- SDK-specific fixtures/tests.

Deliver:

- connect/auth/register/reconnect lifecycle;
- strict action validation;
- bounded queue and handler concurrency;
- enqueue-before-receipt;
- duplicate action suppression with repeated receipt/cached result;
- heartbeat, result reporting, listener isolation, and disposal.

Review gate: Claude verifies idempotency, cleanup, bounds, declarations, and no
game/demo behavior.

Recommended user commit checkpoint: reviewed SDK slice.

## Slice 6 — Milestone integration and closure

Owner: CODEX.

Deliver:

- real pair → authenticate → register → durable action → emit → receipt →
  completion smoke;
- malformed and oversized payloads; registration, invalid-message, and
  receipt/result rate exhaustion; session/SDK capacity exhaustion; real
  Socket.IO server/client tests; restart/reconnect; multiple instances per
  client; repository integration; fake-clock; and multi-client race/concurrency
  acceptance;
- full affected-package and repository verification;
- self-review and handoff.

Final independent gate: fresh Claude review. Milestone 4 remains incomplete
until this gate approves it.

## Exact stop conditions

Return `SPEC_CONFLICT` if accepted ADRs conflict.

Return `ARCHITECTURE_GAP` if:

- destination generation cannot be carried without leaking Socket.IO types;
- cross-client receipt/result authorization cannot use existing durable data;
- persist-before-send would require adapter-owned durable mutation;
- restart handling would replay previous-runtime gameplay;
- safe shutdown cannot stop all registry/timer work.

Return `BLOCKED_DECISION` if approval does not resolve handshake credentials,
instance ownership/replacement, attempt correlation, heartbeat timing, or
capacity policy.

No slice may start Milestone 5 or Phase D. One Gemini rework maximum applies;
substantive remaining findings return to CODEX.
