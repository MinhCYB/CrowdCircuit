# Phase C Milestone 4 — Delegation Plan

**Date:** 2026-07-27
**Architecture status:** READY_FOR_INDEPENDENT_REVIEW
**Implementation status:** BLOCKED_BY_ARCHITECTURE_REVIEW
**Primary implementation owner:** CODEX

## Strategy

Implementation is sequential. No two agents edit the same files concurrently.
Every slice begins from the prior reviewed checkpoint. The user owns all Git
operations; commit checkpoints below are recommendations and do not authorize
an agent to stage, commit, or push.

## Slice 0 — Architecture approval gate

Owner: Claude independent reviewer.

Review:

- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md`
- this delegation plan;
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-ARCHITECTURE.md`.

Stop on unresolved authentication, identity, generation fencing, receipt/result,
or numeric-limit decisions. Only an approval may authorize Slice 1.

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
- typed server registry/adapter ports;
- declaration consumers and schema fixtures.

Must not implement authentication middleware, registry mutation, delivery,
receipt/result controllers, SDK networking, durable writes, or timers.

Review gate: Claude verifies exact wire schemas, package boundaries, dependency
direction, and zero lifecycle implementation.

Recommended user commit checkpoint: reviewed additive contract slice.

## Slice 2 — Server authentication, registry, and adapter core

Owner: CODEX.

Exclusive files:

- `apps/server/src/game/**`;
- `apps/server/src/delivery/**` only where the approved adapter boundary
  requires it;
- server composition and focused tests.

Deliver:

- `/game` namespace middleware;
- origin/query/token validation;
- registration and generation-fenced registry;
- heartbeat/rate/capacity enforcement;
- `SocketIoActionDeliveryAdapter`;
- shutdown cleanup;
- real Socket.IO multi-client tests.

Do not edit SDK implementation files during this slice.

Review gate: Claude focuses on auth, stale-session fencing, resolve/send race,
backpressure, cleanup, and absence of durable mutation in the adapter.

Recommended user commit checkpoint: reviewed server transport slice.

## Slice 3 — Receipt/result integration

Owner: CODEX.

Exclusive files:

- server game inbound controllers;
- narrowly required `ActionGateway` public methods;
- server integration tests.

Deliver:

- current-generation and durable-attempt binding validation;
- idempotent receipt and result handling;
- conflicting/late result rejection;
- retry/TTL/restart integration evidence.

Stop if current durable attempts cannot authorize cross-client messages without
a persistence/schema change. Return `ARCHITECTURE_GAP`.

Review gate: Claude verifies Milestone 3 remains authoritative.

Recommended user commit checkpoint: reviewed inbound lifecycle slice.

## Slice 4 — JavaScript SDK

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

## Slice 5 — Milestone integration and closure

Owner: CODEX.

Deliver:

- real pair → authenticate → register → durable action → emit → receipt →
  completion smoke;
- malformed/auth/reconnect/restart/backpressure acceptance matrix;
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
