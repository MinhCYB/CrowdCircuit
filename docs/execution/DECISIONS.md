# Project Decisions

This file records implementation decisions discovered during development that are not already fully specified in the System Design.

## Existing architecture decisions

### ADR-001 — Modular monolith

**Status:** Accepted

CrowdCircuit v0.1 runs as a local modular monolith. Do not introduce microservices or an external message broker without a documented revision.

### ADR-002 — In-process event bus

**Status:** Accepted

Use a typed in-process event bus. Kafka, RabbitMQ and Redis are outside MVP scope.

### ADR-003 — Socket.IO for realtime integration

**Status:** Accepted

Use Socket.IO for admin, game and voice-output realtime channels in v0.1.

### ADR-004 — Versioned contracts

**Status:** Accepted

`LiveEventEnvelope`, `GameActionEnvelope` and `VoiceIntent` are versioned contracts owned by `@crowdcircuit/contracts`.

### ADR-005 — Local-first deployment

**Status:** Accepted

Bind admin APIs to loopback by default. No cloud dependency is required except connector/TTS providers that need internet access.

### ADR-006 — Browser game first

**Status:** Accepted

The first vertical slice uses Phaser and the JavaScript Game SDK.

### ADR-007 — Game owns gameplay state

**Status:** Accepted

CrowdCircuit sends actions but does not become the source of truth for gameplay state.

### ADR-009 — Generic LiveEventEnvelope Schema Factory and JSON-Safe Payload Strategy

**Date:** 2026-07-23  
**Status:** Accepted  
**Task:** FOUND-02B (Renumbered in PATCH-FOUND-02B-01)

### Context

FOUND-02B requires establishing a generic `LiveEventEnvelope` base and runtime Zod schemas before specific event payloads (e.g. `gift.sent`, `chat.comment`) are defined in FOUND-02C. We must avoid `any` and `z.unknown()` while ensuring base envelopes require a JSON-safe payload and FOUND-02C can build a discriminated union without breaking the base envelope contract.

Note: System Design section 10 previously defined ADR-008 (Ephemeral local credentials). The FOUND-02B decision has been renumbered to ADR-009 in PATCH-FOUND-02B-01 to avoid ID conflict.

### Decision

Use recursive `JsonValueSchema` as the base payload schema with a required-parameter generic schema factory `createLiveEventEnvelopeSchema(payloadSchema, eventTypeSchema)` in `@crowdcircuit/contracts`.

### Alternatives considered

- Using `z.any()` for payload: Rejected because it bypasses TypeScript type safety and allows non-JSON types.
- Using `z.unknown()` for base payload: Rejected in PATCH-FOUND-02B-01 because `z.unknown()` allows non-JSON types (functions, BigInts, Date, Map/Set, NaN/Infinity) and permits missing payload properties.
- Hardcoding `JsonValueSchema` without factory function: Rejected because downstream payload specialization in FOUND-02C would require duplicating envelope schema structure.

### Consequences

- Positive: Safe runtime validation, zero use of `any`, clean forward compatibility for FOUND-02C discriminated union.
- Base payload is JSON-safe.
- Specialized schemas remain responsible for domain-level constraints.
- Recursive JSON validation has runtime cost.
- Unknown arbitrary JavaScript values are intentionally rejected.

### Affected packages

- `packages/contracts`

### ADR-010 — Public Voice Output callback wire literals

**Date:** 2026-07-23
**Status:** Accepted
**Task:** FOUND-02E

### Context

The System Design uses two similar naming families:

- Section 11.14 describes callbacks sent by the external Voice Output client as `playback.started` and `playback.finished`.
- Internal application event/handler examples use names such as `voice.playback.started` and `voice.playback.finished`.

FOUND-02E must define the public Voice Output wire protocol without conflating it with potential internal application events.

### Decision

The public Voice Output callback wire literals are:

- `playback.started`
- `playback.finished`
- `playback.interrupted`
- `playback.failed`

The interrupted and failed variants extend the same external callback family consistently.

The `voice.playback.*` family is reserved for potential internal application events or handler names and must not be used as the public Voice Output callback protocol.

### Alternatives considered

- Use `voice.playback.*` for both public callbacks and internal events: Rejected because it conflates the external Voice Output protocol with internal application event naming.
- Support both literal families publicly: Rejected because aliases would create an ambiguous wire contract and unnecessary compatibility surface.

### Consequences

- Public Voice Output messages follow the external playback terminology in System Design section 11.14.
- Internal event naming remains independently evolvable.
- Runtime schemas, public types, declaration tests, and handoff documentation must expose only the `playback.*` callback family.

### Affected packages

- `packages/contracts`

### ADR-011 — Injectable TikTok provider boundary

**Date:** 2026-07-23
**Status:** Accepted
**Task:** Phase B Milestone 3

### Context

The available `tiktok-live-connector` package is unofficial,
reverse-engineered, described as not production-ready, and AGPL licensed.
Phase B requires a replaceable TikTok adapter but does not require adopting
that provider as a runtime dependency.

### Decision

`@crowdcircuit/connector-tiktok` owns a narrow injectable provider port.
Provider-specific clients are composed outside the connector package. Provider
objects, credentials, and dependency types do not cross CrowdCircuit's public
connector boundary.

### Consequences

- Connector lifecycle, mapping, cleanup, and reconnect policy are deterministic
  and testable without network access.
- No unofficial TikTok provider package is bundled.
- Concrete provider composition and real-network smoke testing remain separate
  integration and release work.

### Affected packages

- `packages/connector-tiktok`
- `packages/connector-core`

### ADR-012 — Durable action record before first transport send

**Date:** 2026-07-24
**Status:** Accepted
**Task:** Phase C planning

### Context

System Design §11.9 requires an action log to be persisted before an action is
sent. The original roadmap allowed the Action Gateway transport to begin after
authentication and mapping work without explicitly depending on the durable
persistence foundation. That ordering could permit an in-memory implementation
whose restart and reconciliation semantics differ from the required system.

### Decision

- Persist-before-send is a hard Phase C correctness invariant.
- Every action must be committed to durable SQLite storage before its first
  transport send.
- Retry, receipt, completion, failure, expiry, and startup reconciliation use
  the durable action record as their source of truth.
- A process restart must not silently lose a persisted non-terminal action.
  Startup reconciliation applies the approved terminal diagnostic outcome
  rather than replaying gameplay from a previous runtime.
- `FOUND-03A`–`FOUND-03D` and `FOUND-04A`–`FOUND-04D` are incorporated into
  Phase C Milestone 1 and must complete before Action Gateway transport work.
- No temporary in-memory mainline implementation with different public
  semantics is allowed.
- Deterministic in-memory fakes are permitted only in tests behind the same
  frozen repository interfaces.

### Consequences

- `BE-07A` depends on `FOUND-03D`, `FOUND-04D`, and `BE-05E`.
- Later delivery, retry, result, SDK, and integration work inherits the
  authentication and durable-state gates.
- Persistence failures prevent the first send and produce an observable,
  testable failure; they do not fall back to volatile state.
- Phase C cannot claim a playable delivery slice until restart reconciliation
  and recovery evidence pass.

### Affected packages

- `apps/server`
- `packages/auth-core` (to be created from the approved repository design)
- `packages/mapping-engine`
- `packages/game-sdk-js`
- `games/zombie-survival`

## ADR-013 — Deterministic mapping candidate identity seed

**Date:** 2026-07-25
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-02 / M2-D1

### Context

Mapping needs replay-stable idempotency input without taking ownership of the
durable Action Gateway's final action identity.

### Decision

- Mapping does not allocate the final `actionId`.
- Mapping emits a deterministic, explicitly versioned idempotency seed derived
  from `gameProfileId`, `ruleId`, normalized `eventId`, candidate ordinal, and
  canonical resolved action output.
- Canonical action output includes action type and canonical JSON-safe params.
- Timestamp, randomness, and UUID do not participate.
- Different rules producing identical output remain distinct.
- Re-evaluating the same event/rule/output produces the same seed.
- Configuration version does not participate directly when the matched rule
  and resolved output are unchanged.
- Milestone 3 allocates and durably persists the final `actionId`.

### Consequences

Mapping replay is stable without coupling the public boundary to final action
ID generation or a configuration revision.

### Affected packages

- `packages/mapping-engine`
- `apps/server`

## ADR-014 — Stable user identity and shared anonymous budget

**Date:** 2026-07-25
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-02 / M2-D2

### Decision

Stable budget identity precedence is:

1. nonempty `user.id`;
2. otherwise nonempty `user.uniqueId`;
3. otherwise a shared anonymous identity.

The anonymous bucket key is scoped by `gameProfileId`, `ruleId`, and the
constant anonymous identity. Userless aggregates and events without stable
identity use this bucket. Anonymous traffic remains subject to its per-user
scope, per-rule limits, and the per-game global budget.

Display name, avatar, provider payload, and unstable metadata never become
identity inputs.

### Consequences

Anonymous traffic cannot bypass rate limits, and CrowdCircuit does not
fabricate identity from unstable facts.

### Affected packages

- `packages/mapping-engine`
- `packages/contracts`

## ADR-015 — Sliding windows and atomic multi-scope admission

**Date:** 2026-07-25
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-02 / M2-D3

### Decision

- Per-user/anonymous and per-rule minute limits use exact sliding windows.
- Rule cooldown uses the last accepted timestamp.
- The per-game global limit remains the approved token bucket.
- All time comes from an injected trusted processing clock, never event time.
- Clock rollback fails closed.

Evaluation order is:

1. validate profile and event;
2. match rule event types and conditions;
3. sort matches deterministically;
4. resolve `first`, `all`, or `exclusive_group`;
5. resolve candidate action output and identity;
6. for each selected candidate, atomically evaluate user/anonymous sliding
   window, rule cooldown, rule sliding window, and game token bucket;
7. commit every corresponding mutation only when admitted.

A rejected, dropped, or deferred candidate consumes no capacity. Rules removed
by match-mode resolution consume no capacity. Global rejection consumes no
user or rule capacity. Persistence/transaction failure rolls back every scope.
Selected candidates are evaluated in deterministic order. Exact window
boundaries are permanent regression cases.

### Consequences

Admission is deterministic and cannot leave partial budget mutations.

### Affected packages

- `packages/mapping-engine`
- `apps/server`

## ADR-016 — Durable mapping budget state

**Date:** 2026-07-25
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-02 / M2-D4

### Decision

Rule cooldown, per-rule sliding-window, per-user/anonymous sliding-window, and
per-game token-bucket state are durable.

Restart does not reset limits. Downtime is ordinary elapsed wall-clock time;
expired entries age out and global tokens refill by elapsed time up to burst.
Production has no in-memory fallback. Test fakes implement the same repository
and atomic semantics. Budget consumption is not refunded after a later,
separate Action Gateway persistence failure.

### Consequences

Restart cannot be used to bypass limits, while testability remains available
behind the frozen repository interface.

### Affected packages

- `apps/server`
- `packages/mapping-engine`

## ADR-017 — Deferred result boundary and Milestone 3 queue ownership

**Date:** 2026-07-25
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-02 / M2-D5

### Decision

Milestone 2 retains no queue, sends nothing, and persists no candidate queue.
It returns typed accepted, rejected, dropped, or deferred results. For
`queue_with_ttl`, a deferred result includes the resolved candidate, absolute
expiry, and reason.

Milestone 3 exclusively owns durable queue insertion, delivery ordering, queue
persistence, retry, TTL expiry processing, backpressure, and transport send.

### Consequences

Mapping can express overflow outcomes without creating a second, volatile
action lifecycle.

### Affected packages

- `packages/mapping-engine`
- `apps/server`

## ADR-018 — Bounded durable mapping state

**Date:** 2026-07-25
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-02 / M2-D6

### Decision

- Capacity and retention settings are validated per profile with conservative
  repository defaults.
- Cleanup uses trusted time, lazy pruning, and deterministic bounded sweeps.
- Cleanup removes the oldest inactive state deterministically and never evicts
  live budget state.
- Exhausted capacity after cleanup returns a typed fail-closed rejection.
- Diagnostics history is not retained unless explicitly bounded.
- Milestone 2 has no queue state.
- Exact defaults are selected during implementation, documented with rationale,
  and tested using configurable smaller limits; illustrative review numbers
  are not architectural defaults.

### Consequences

Budget persistence has explicit growth bounds without inventing premature
numeric constants.

### Affected packages

- `apps/server`
- `packages/mapping-engine`

## New decision template



```md
## ADR-XXX — Title

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Superseded  
**Task:** TASK-ID

### Context

Why a decision is needed.

### Decision

What was chosen.

### Alternatives considered

- Alternative A
- Alternative B

### Consequences

- Positive
- Negative

### Affected packages

- package/path
```
