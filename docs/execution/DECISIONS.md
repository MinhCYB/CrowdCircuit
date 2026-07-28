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

## ADR-019 — Action ID Derivation and Idempotency Binding

**Date:** 2026-07-26
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-03 / M3-D1

### Context

Milestone 2 produces mapping candidate idempotency seeds (`candidate.idempotencySeed`), but does not allocate final `actionId` strings or execute durable claims. Milestone 3 requires a permanent, replay-safe binding between candidate idempotency seeds and durable action records.

### Decision

- `candidate.idempotencySeed` is the permanent durable idempotency key.
- One idempotency seed maps permanently to exactly one `actionId`.
- Terminal, failed, or expired actions never release their idempotency seed; the unique claim is permanent.
- Duplicate claim requests return the original durable record without creating a new action and issue no second `SendAuthorization`.
- `actionId` is derived deterministically from the idempotency seed using a dedicated, module-local format version:
  ```ts
  const ACTION_ID_FORMAT_VERSION = 1 as const;
  ```
  `ACTION_ID_FORMAT_VERSION` is decoupled from `MAPPING_SEED_FORMAT_VERSION` and `USER_BUDGET_KEY_FORMAT_VERSION`.
- `actionId` derivation uses a cryptographically strong digest retaining at least 128 bits of entropy (e.g. SHA-256 truncated to 26 base32/hex characters with prefix `act_`).
- The database unique constraint (`action_logs_idempotency_key_unique`) remains the authoritative concurrency guarantee; deterministic derivation alone is not treated as a substitute for database-level uniqueness.

### Consequences

- Duplicate event evaluation produces the exact same durable action ID without race conditions.
- Versioning candidate seeds, budget keys, and action IDs remain completely independent.

### Affected packages

- `apps/server`
- `packages/mapping-engine` (reference)

---

## ADR-020 — Deferred Storage and Full Budget Re-admission

**Date:** 2026-07-26
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-03 / M3-D2

### Context

Milestone 2 produces typed `deferred` mapping results (`queue_with_ttl` overflow policy) without persisting them. Milestone 3 must store deferred candidates and promote them when capacity becomes available. Because Milestone 2's atomic budget admission consumes zero capacity when returning a deferred result, promotion cannot simply check the global token bucket.

### Decision

- Deferred candidates are stored in a dedicated durable table (`mapping_budget_deferred_candidates`), completely separate from `action_logs`.
- One `idempotencySeed` has at most one active deferred record.
- Queued deferred candidates have no action lifecycle status, cannot issue `SendAuthorization`, and are never sent directly to transport.
- Deferred rows have validated, explicit capacity limits and deterministic cleanup.
- Expiry of a deferred row produces no action.
- At promotion time, Milestone 3 must re-run full atomic budget admission across all four scopes:
  1. Per-user or per-anonymous sliding window;
  2. Per-rule cooldown;
  3. Per-rule sliding window;
  4. Per-game global token bucket.
- Every deferred row persists an immutable `BudgetAdmissionSnapshot` containing all parameters required to re-run `DurableBudgetRepository.admit` under the current processing clock, without re-evaluating rule templates or reading mutable rule configurations.
- Promotion is executed as a single, atomic repository-level transaction:
  1. Verify the deferred row is queued and unexpired;
  2. Re-run full atomic budget admission;
  3. Create or recover the idempotent durable action;
  4. Mark the deferred row promoted.
- Promotion must use a dedicated repository transaction boundary or an internal transaction-aware primitive, rather than nesting high-level `createBeforeFirstSend` transactions inside another transaction.

### Consequences

- Deferred candidates cannot bypass user sliding windows, rule cooldowns, or rule limits when promoted.
- Promotion cannot leave partial budget mutations or orphaned actions on failure.

### Affected packages

- `apps/server`

---

## ADR-021 — Action Lifecycle Statuses, Retries, and Restart Recovery

**Date:** 2026-07-26
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-03 / M3-D3

### Context

Milestone 3 requires a robust delivery retry mechanism and clear crash recovery rules without introducing unnecessary state-machine complexity.

### Decision

- Retain existing `action_logs` status set (`pending`, `in_flight`, `received`, `completed`, `failed`, `expired`, `delivery_failed`, `delivery_unknown_restart`, `aborted_restart`).
- Add legal transition `in_flight -> delivery_failed` for permanent delivery exhaustion.
- Do not add `retry_wait` status. Retry scheduling is represented in memory and by durable scheduling metadata (`nextAttemptAt`, attempt count, last failure reason).
- Maximum retries: two retries (three total attempts).
- Retries reuse the same `actionId` and idempotency key, but each actual delivery attempt consumes a new `SendAuthorization` and records a unique `attempt_number`.
- Backoff is deterministic and unjittered in the MVP.
- "No connected game destination" is not an actual delivery attempt: it consumes no attempt number, consumes no `SendAuthorization`, and schedules a bounded later availability check.
- TTL always wins over retry eligibility.
- Restart reconciliation rules:
  - `pending` (never sent): revoke stale authorization, reassign to active runtime owner, remain pending if unexpired.
  - `in_flight` (without receipt): transition to `delivery_unknown_restart` unless expired; revoke open authorization.
  - `received`: remain `received`; never retry delivery; await completion or expiry.
  - `expired`: remain terminal.
  - Stale runtime owner: zero durable mutation (`RUNTIME_SUPERSEDED`).
- `aborted_restart` is reserved exclusively for unrecoverable pre-send conditions documented during implementation, not used as a blanket default for pending actions.

### Consequences

- Delivery retries are strictly bounded and restart-safe.
- State-machine complexity remains minimal.

### Affected packages

- `apps/server`

---

## ADR-022 — Send Authorization Binding and Persist-Before-Send Ordering

**Date:** 2026-07-26
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-03 / M3-D4

### Context

ADR-012 requires every action to be durably recorded before its first transport send. Milestone 3 must enforce strict persist-before-send execution order and extend authorization scope to anticipate game instance delivery.

### Decision

- Extend `SendAuthorization` and `action_send_authorizations` schema to include a nullable `gameInstanceId` binding parameter alongside `actionId`, `attemptNumber`, `expectedVersion`, `runtimeId`, `runtimeOwnerId`, `role`, `clientId`, and `expiresAt`.
- Production execution MUST follow this strict 6-step sequence:
  1. Durable action record exists;
  2. Valid `SendAuthorization` is issued;
  3. Authorization is consumed and a durable attempt with `send_started` is recorded atomically;
  4. Action transitions to `in_flight`;
  5. SQLite transaction commits;
  6. Transport-neutral port is invoked ONLY AFTER committed transaction success.
- `transport send -> recordAttempt` is forbidden.
- Transport exceptions after committed `send_started` attempt do not erase the attempt record; it remains durable retry evidence.
- Every retry attempt requires a newly issued `SendAuthorization`.

### Consequences

- Network failures can never corrupt durable delivery history.
- Authorization schema is pre-aligned for Milestone 4 game instance delivery.

### Affected packages

- `apps/server`

---

## ADR-023 — Transport-Neutral Delivery Port Boundary

**Date:** 2026-07-26
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-03 / M3-D5

### Context

Milestone 3 is strictly transport-independent. Socket.IO, `/game` namespace, and SDK connections belong to Milestone 4. Milestone 3 requires a clean port interface for delivery.

### Decision

- Milestone 3 defines a transport-neutral delivery port interface (`ActionDeliveryPort`) and a deterministic test fake (`FakeActionDeliveryPort`).
- `ActionDeliveryPort` contains zero Socket.IO dependencies or imports.
- The port interface must distinguish at least:
  - `sent` (destination available, send invoked);
  - `no_destination` (no connected client destination);
  - `transport_error` (transport exception).
- A `no_destination` outcome occurs before attempt authorization consumption and does not count as a delivery attempt.
- Receipt (`received`) and completion (`completed` / `failed`) are separate domain signals:
  - Delivery receipt ACK stops retry scheduling;
  - Gameplay completion terminates action lifecycle.

### Consequences

- Milestone 3 can be fully implemented and verified with 100% deterministic test coverage without network or transport dependencies.

### Affected packages

- `apps/server`

---

## ADR-024 — Trusted Time, Expiry, Ordering, and Bounded Capacity

**Date:** 2026-07-26
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-03 / M3-D6

### Context

Milestone 3 needs clear rules for action TTL, deferred expiry, delivery ordering, and capacity bounds.

### Decision

- All time calculations use the injected trusted processing clock.
- Action `expiresAt` is calculated once at durable action creation (`createdAt + candidate.ttlMs`).
- Deferred candidate expiry (`deferredExpiresAt`) and action expiry (`expiresAt`) are separate boundaries. A promoted candidate receives its action TTL starting at durable action creation.
- Expired actions or deferred rows never return to a live state.
- Replaying a mapping seed for an expired action returns the original expired record; it does not create a new action.
- Action delivery selection ordering:
  ```sql
  ORDER BY priority DESC, created_at ASC, action_id ASC
  ```
- Default MVP delivery model is one in-flight action per game destination.
- Deferred storage capacity is explicit, validated, bounded, and fail-closed.
- Cleanup sweeps are deterministic and bounded.
- Exact default values for receipt timeout, retry backoff intervals, deferred capacity, retention, and sweep limits are implementation-time constants documented with rationale and verified via boundary tests.

### Consequences

- All timing, ordering, and capacity behaviors are bounded, deterministic, and testable.

### Affected packages

- `apps/server`

---

## ADR-025 — /game Namespace, Handshake Authentication, Wire Mapping, Taxonomy, Redaction, and Observability

**Date:** 2026-07-27
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-04 / M4-D1
**Acceptance Evidence:** Approved in `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md` and `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-INDEPENDENT-REVIEW-02.md` at commit `df22ec931ef4cadca5e67619d51924838085d90c`.

### Context

Milestone 4 connects the transport-neutral `ActionGateway` to authenticated Socket.IO game clients. A clear namespace, authentication mechanism, wire error taxonomy, credential redaction policy, and observability model are required.

### Decision

- Socket.IO transport terminates at the `/game` namespace.
- Authentication is handshake-only via `socket.handshake.auth.token` containing an opaque game-role session token. Query-string tokens, registration-body tokens, cookies, and HTTP authorization headers are strictly rejected for `/game`.
- Namespace middleware owns pre-authorization checks: missing/empty tokens map to `AUTH_REQUIRED`, query credentials map to `QUERY_TOKEN_FORBIDDEN`, and origin policy violations map to `ORIGIN_FORBIDDEN`.
- `auth-core` error codes map to stable wire error codes: `INVALID_CREDENTIAL` → `AUTH_INVALID`, `CREDENTIAL_EXPIRED` → `AUTH_EXPIRED`, `CREDENTIAL_REVOKED` → `AUTH_REVOKED`, `FORBIDDEN` → `AUTH_FORBIDDEN`.
- Client-visible errors MUST use stable enumerated wire codes. Raw `AuthError` messages, raw tokens, socket internals, SQL, stack traces, raw payloads, and internal exceptions MUST NOT cross the wire.
- Raw credentials and tokens MUST NOT be logged. Short token fingerprints MAY be logged for authentication correlation but MUST NOT be returned to clients or used as durable identity.
- Structured diagnostics MUST correlate, when applicable, `actionId`, attempt number, authenticated `clientId`, `gameId` (where applicable), `gameInstanceId`, session generation, connection generation, server runtime generation, event type, and reason/failure code. High-cardinality values MUST remain structured log fields and MUST NOT become unbounded metric labels. Process-local session counts are operational gauges, not durable action or session truth.

### Consequences

- Transport security is enforced before connection registration. Credentials are protected against URL/log leakage.

### Rejected Alternatives

- Token in `game.register` payload: rejected because handlers would exist before authentication.
- Query-string token: rejected due to server/proxy log leakage.

### Affected Packages

- `apps/server`, `@crowdcircuit/contracts`

---

## ADR-026 — Live Game-Session Identity, Registration, and Replacement

**Date:** 2026-07-27
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-04 / M4-D2
**Acceptance Evidence:** Approved in `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md` and `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-INDEPENDENT-REVIEW-02.md` at commit `df22ec931ef4cadca5e67619d51924838085d90c`.

### Context

Game clients need an explicit session identity model, registration handshake, and deterministic socket replacement policy on reconnect.

### Decision

- A live destination is uniquely identified by `clientId` (from auth session) + `gameId` (validated registration claim) + `gameInstanceId` (nonempty registration instanceId) + `serverRuntimeGeneration` + `connectionGeneration`. `socket.id` is metadata, never an authorization identity.
- Registration occurs via `game.register` within a strict 5000 ms deadline after handshake authentication.
- A client MAY register up to 4 distinct instances per `clientId`.
- One `(gameId, gameInstanceId)` tuple has exactly one active socket entry in the process-local registry.
- Reconnecting the same `(gameId, gameInstanceId)` from the same authenticated `clientId` atomically replaces the prior socket and increments `connectionGeneration`. The old socket is disconnected with `SESSION_REPLACED`.
- An attempt by a different `clientId` to register an occupied `(gameId, gameInstanceId)` tuple is rejected with `INSTANCE_OWNED_BY_OTHER_CLIENT`; no replacement occurs.
- Disconnect callbacks from stale connection generations cannot mutate or remove newer connection generations.

### Consequences

- Connection replacement is fenced, immediate, and atomic without ambiguous race conditions.

### Rejected Alternatives

- Multiple active sockets per game instance: rejected because delivery target selection and receipt authorization become ambiguous.

### Affected Packages

- `apps/server`, `@crowdcircuit/contracts`

---

## ADR-027 — Socket.IO Delivery Adapter, Generation Fencing, and Deterministic Null-Instance Selection

**Date:** 2026-07-27
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-04 / M4-D3
**Acceptance Evidence:** Approved in `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md` and `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-INDEPENDENT-REVIEW-02.md` at commit `df22ec931ef4cadca5e67619d51924838085d90c`.

### Context

The Milestone 3 `ActionGateway` relies on `ActionDeliveryPort` to resolve a live destination and send a prepared delivery. The Socket.IO delivery adapter must route deterministically and fence against stale destinations.

### Decision

- `SocketIoActionDeliveryAdapter` implements `ActionDeliveryPort`.
- Resolution with an explicit non-null `gameInstanceId` MUST select only that live instance and MUST NOT fall back to another instance.
- Resolution with null `gameInstanceId` means “any eligible live instance for this authenticated action client and game.” Candidates across distinct live instances are ordered by `gameInstanceId` ascending. `connectionGeneration` descending is a defensive secondary ordering key only.
- Under the registry uniqueness invariant, two eligible current entries with the same `gameInstanceId` MUST NOT exist. If such a duplicate for the same `gameInstanceId` is observed, selection MUST fail closed and emit an internal invariant-violation signal rather than silently choosing one. The defensive secondary ordering key does not authorize duplicate live sessions.
- This ordering is deterministic routing, not load balancing.
- The resolved destination remains runtime-generation and connection-generation fenced through `send`. Disappearance or replacement of the resolved entry before `send` returns `transport_error` without mutating durable state.

### Consequences

- Delivery resolution is generation-fenced across connection races without leaking Socket.IO types into persistence layers.

### Normative amendment — 2026-07-28 (client-routing correction)

This amendment corrects and supersedes only ADR-027's null-instance sentence.
When `gameInstanceId` is null, resolution considers every eligible current live
instance for the requested game, regardless of authenticated owner. The
registry selects deterministically by `gameInstanceId` ascending. The
authenticated `clientId` is discovered from the selected registry entry and
becomes part of the resolved destination, durable attempt binding, and final
generation fence.

- Explicit-instance resolution uses exact `(gameId, gameInstanceId)`.
- Occupied different-client takeover remains prohibited by ADR-026.
- No caller supplies or fabricates client ownership.
- Final `sendIfCurrent` still validates the exact selected `clientId`.
- No fallback or redirect occurs during send.
- A later retry may choose a different owner only through fresh resolution and
  a new durable attempt.
- Existing attempt history remains bound to the original resolved client.

This is a normative clarification and correction to routing semantics, not a
change to ADR-026 ownership conflict or the final destination identity tuple.

### Affected Packages

- `apps/server`

---

## ADR-028 — Attempt-Correlated Receipt/Result Protocol, Reconnect-Safe Receipt Rule, and Idempotency

**Date:** 2026-07-27
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-04 / M4-D4
**Acceptance Evidence:** Approved in `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md` and `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-INDEPENDENT-REVIEW-02.md` at commit `df22ec931ef4cadca5e67619d51924838085d90c`.

### Context

Action receipts (`game.action.received`) and results (`game.action.result`) must be attempt-correlated and idempotent. Reconnecting clients must be able to acknowledge locally enqueued actions across replacement.

### Decision

- `game.action`, `game.action.received`, and `game.action.result` carry explicit `attemptNumber` and `sessionGeneration` correlation fields.
- A receipt for an older durable attempt MAY be accepted only from the current valid session generation when the durable attempt is bound to the same authenticated client, game, and game instance. A receipt from a stale session generation or another client/game instance MUST be rejected.
- This exception tolerates client replacement without losing a valid receipt for an action already locally enqueued in the client SDK. It is safe because `actionId` and attempt number form an unguessable correlation tuple, and client/game/instance identity binding is enforced.
- Results remain stricter: a gameplay result MUST satisfy the current-session and exact durable action/attempt/client/game-instance bindings. The receipt exception MUST NOT weaken result authorization.
- Duplicate valid receipts and identical terminal results are idempotent. Conflicting terminal results return `RESULT_CONFLICT` with zero durable mutation. Late results after terminal/expired/reconciliation state return `ACTION_NOT_ACCEPTING_RESULT`.

### Consequences

- Reconnect duplicate action delivery is safely acknowledged without triggering duplicate gameplay or losing durable state synchronization.

### Affected Packages

- `apps/server`, `@crowdcircuit/contracts`

---

## ADR-029 — Game-Session Liveness, Bounds, and Security Limits

**Date:** 2026-07-27
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-04 / M4-D5
**Acceptance Evidence:** Approved in `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md` and `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-INDEPENDENT-REVIEW-02.md` at commit `df22ec931ef4cadca5e67619d51924838085d90c`.

### Context

Resource exhaustion, unauthenticated connections, and hung event loops must be prevented by explicit operational bounds.

### Decision

- Session liveness requires both Socket.IO transport ping/pong (10s interval / 20s timeout) and custom SDK `game.heartbeat` (10s interval / 30s stale threshold).
- Background liveness sweep runs every 5 seconds, processing at most 128 stale entries per sweep.
- Transport payload limit (`maxHttpBufferSize`): 64 KiB (65,536 bytes).
- Server capacity limits: maximum 256 active registered sessions per server runtime; maximum 4 active sessions per `clientId`. Excess connections fail closed with `SESSION_CAPACITY` without evicting live sessions.
- Rate limiters: heartbeat (2/s, burst 4); receipt/result (20/s, burst 40); registration (1 per connection, max 4 invalid attempts before disconnect); invalid/unknown messages (5 per 10s before disconnect).

### Consequences

- All memory allocations, event loop tasks, and socket connections are bounded and fail closed under contention.

### Affected Packages

- `apps/server`

---

## ADR-030 — SDK Enqueue-Before-Receipt and Bounded Action Deduplication

**Date:** 2026-07-27
**Status:** Accepted
**Task:** PHASE-C-MILESTONE-04 / M4-D6
**Acceptance Evidence:** Approved in `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-REVIEW-01.md` and `docs/orchestration/reviews/PHASE-C-MILESTONE-04-ARCHITECTURE-INDEPENDENT-REVIEW-02.md` at commit `df22ec931ef4cadca5e67619d51924838085d90c`.

### Context

The `@crowdcircuit/game-sdk-js` client library must process delivered actions reliably, guarantee local enqueue before sending receipt, and handle duplicates safely.

### Decision

- The SDK sends `game.action.received` ONLY AFTER validating the payload schema and successfully inserting the action into its bounded local execution queue.
- Duplicate action deliveries received by the same live SDK object MUST NOT re-run gameplay handlers, but MUST re-emit receipt ACK or return cached result details to the server.
- SDK execution concurrency limit: 32 concurrent handlers.
- SDK pending local action queue limit: 256 entries.
- SDK deduplication and result cache limit: 2048 action IDs, retained for 30 minutes with deterministic LRU eviction. Active entries are never evicted.
- If the SDK local queue is full, it rejects new enqueue without emitting receipt, allowing server-side durable retry/TTL policies to remain authoritative.

### Consequences

- At-least-once transport delivery is handled idempotently in the client SDK without duplicate gameplay execution.

### Affected Packages

- `packages/game-sdk-js`
