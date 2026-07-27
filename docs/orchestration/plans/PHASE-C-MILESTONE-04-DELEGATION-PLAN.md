# Phase C Milestone 4 — Delegation Plan

**Date:** 2026-07-27
**Architecture status:** APPROVED_AND_COMPLETE (ADR-025 through ADR-030 ACCEPTED)
**Implementation status:** Ready to begin Slice 1
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

Exclusive files:

- `packages/contracts/src/actions/**`
- contract fixtures/tests/declarations;
- additive server registry/adapter interfaces with no behavior;
- additive SDK public type scaffolding;
- package manifests/lockfile only for approved Socket.IO dependencies.

Deliver:

- handshake-auth-compatible registration contract;
- versioned registered/error/action/receipt/result correlation fields;
- stable wire auth/error schemas and declaration/public-contract tests;
- typed server registry/adapter ports;
- declaration consumers and schema fixtures.

Must not implement authentication middleware, registry mutation, delivery,
receipt/result controllers, SDK networking, durable writes, or timers.

Review gate: Claude verifies exact wire schemas, package boundaries, dependency
direction, and zero lifecycle implementation.

Recommended user commit checkpoint: reviewed additive contract slice.

## Slice 2 — Server authentication and registry

Owner: CODEX.

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

Review gate: Claude focuses on auth mapping, registry bounds, stale-session
fencing, cleanup, and file ownership.

Recommended user commit checkpoint: reviewed server transport slice.

## Slice 3 — Delivery adapter

Owner: CODEX.

Exclusive files:

- `apps/server/src/delivery/socket-io/**`;
- adapter-focused tests not owned by another slice.

Deliver:

- deterministic ADR-027 null-instance selection;
- explicit-instance no-fallback behavior;
- destination generation fencing;
- disappearance and replacement between resolve and send;
- backpressure and emit-failure behavior with no durable mutation.

Review gate: Claude verifies deterministic routing, resolve/send race
coverage, and adapter isolation.

Recommended user commit checkpoint: reviewed delivery adapter slice.

## Slice 4 — Receipt/result integration

Owner: CODEX.

Exclusive files:

- server game inbound controllers;
- narrowly required `ActionGateway` public methods;
- server integration tests.

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
