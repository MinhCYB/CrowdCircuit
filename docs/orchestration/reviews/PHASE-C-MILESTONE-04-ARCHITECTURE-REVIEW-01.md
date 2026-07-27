# Phase C Milestone 4 — Architecture Review 01

**Date:** 2026-07-27
**Task:** PHASE-C-MILESTONE-04-ARCHITECTURE
**Branch:** `review/phase-c`
**Baseline:** `a50859f42a5918f0bdd63de0e4cd55531bec4341`
**Status:** READY_FOR_INDEPENDENT_REVIEW

## 1. Context and baseline

Milestone 3 is approved and complete. Milestone 4 connects its
transport-neutral `ActionGateway` and `ActionDeliveryPort` to authenticated
Socket.IO game clients and implements the JavaScript SDK. This document is
architecture only. It adds no runtime dependency or implementation.

Baseline evidence:

```text
branch: review/phase-c
HEAD: a50859f42a5918f0bdd63de0e4cd55531bec4341
working tree before architecture work: clean
Node.js: v24.15.0
pnpm: 11.9.0
```

## 2. Existing architecture assessment

- `apps/server` uses Fastify but has no Socket.IO dependency, namespace,
  connection registry, or transport adapter.
- `@crowdcircuit/auth-core` already supplies ephemeral role sessions,
  validation, revocation, capacity limits, origin authorization, token
  fingerprints, and query-token rejection.
- Pairing returns an opaque game-role token bound to a server-issued
  `clientId`. Sessions die on server restart.
- `ActionDeliveryPort` resolves a destination and sends a
  `PreparedActionDelivery` containing the durable attempt number.
- `ActionGateway` resolves before authorization, commits `send_started` and
  `in_flight`, then calls the port. `no_destination` consumes no attempt.
- Shared contracts already define `game.register`, `game.registered`,
  `game.heartbeat`, `game.action`, `game.action.received`, and
  `game.action.result`.
- The current registration schema incorrectly carries `token` in the
  registration body even though the accepted phase plan requires handshake
  authentication. Delivery, receipt, and result schemas also lack attempt and
  session-generation correlation. These are pre-implementation contract gaps,
  not Milestone 3 lifecycle gaps.
- `@crowdcircuit/game-sdk-js` is only a version placeholder.

## 3. Invariants inherited from Milestone 3

1. Socket.IO never creates, authorizes, attempts, transitions, retries, or
   expires durable actions directly.
2. A send occurs only after destination-bound authorization consumption,
   durable `send_started`, `in_flight`, and transaction commit.
3. Every send and retry resolves a fresh live destination.
4. `nextAttemptAt`, three-attempt maximum, receipt stopping retry, TTL,
   `delivery_unknown_restart`, and terminal results remain authoritative.
5. Reconnect never creates a second action or attempt by itself.
6. Stale runtime owners, sessions, sockets, and connection generations fail
   closed.

## 4. Proposed component diagram

```mermaid
flowchart LR
  SDK["Game SDK"] <-->|"/game shared contracts"| NS["Socket.IO game namespace"]
  NS --> AUTH["Auth-core session validation"]
  NS --> REG["Process-local live-session registry"]
  ADAPTER["Socket.IO ActionDeliveryPort adapter"] --> REG
  GATEWAY["Milestone 3 ActionGateway"] --> ADAPTER
  GATEWAY --> REPO["Durable action repository"]
  NS --> INBOUND["Receipt/result controller"]
  INBOUND --> REG
  INBOUND --> GATEWAY
  REPO --> DB[("SQLite durable truth")]
```

Socket.IO types terminate at `NS`, `REG`, and `ADAPTER`. They do not enter
persistence, mapping, or shared domain repositories.

## 5. Proposed ADRs

These identifiers are provisional and remain `PROPOSED` until independent
architecture approval. No entry is appended to `DECISIONS.md` in this task.

- **ADR-025 — `/game` namespace and handshake authentication.**
- **ADR-026 — Live game-session identity, registration, and replacement.**
- **ADR-027 — Socket.IO delivery adapter and connection-generation fencing.**
- **ADR-028 — Attempt-correlated receipt/result protocol and idempotency.**
- **ADR-029 — Game-session liveness, bounds, and security limits.**
- **ADR-030 — SDK enqueue-before-receipt and bounded action deduplication.**

## 6. Namespace and event contract

Namespace: `/game`.

Client-to-server events:

- `game.register`
- `game.heartbeat`
- `game.action.received`
- `game.action.result`

Server-to-client events:

- `game.registered`
- `game.action`
- `game.error`

Every event payload is parsed with a strict shared Zod schema before use.
Unknown events are ignored once, counted as `PROTOCOL_UNKNOWN_EVENT`, and
subject to the invalid-message limiter. Invalid known payloads produce
`game.error` and no state mutation.

Required shared-contract corrections:

- Remove `token` from `GameRegisterMessage`; the token exists only at
  `socket.handshake.auth.token`.
- Add `specVersion: "0.1"` to lifecycle control messages.
- Registration retains `gameId`, `instanceId`, and `sdkVersion`.
- `game.registered` returns `clientId`, `gameId`, `gameInstanceId`,
  `sessionGeneration`, `heartbeatIntervalMs`, and server `specVersion`.
- `game.action` adds `attemptNumber` and `sessionGeneration` beside the
  existing envelope.
- Receipt adds `attemptNumber` and `sessionGeneration`.
- Result adds `attemptNumber` and `sessionGeneration`.
- Add strict `GameProtocolErrorMessageSchema` with `type`, `specVersion`,
  enumerated `code`, optional `actionId`, and `retryable`; no secret or raw
  exception text.

Socket.IO callback acknowledgements are not domain acknowledgements. The
protocol uses named messages only. A successful `emit` means the active server
runtime accepted the payload for transport; only
`game.action.received` causes the durable `received` transition.

Contract compatibility is versioned by `specVersion`. Unsupported major or
unknown versions fail registration with `UNSUPPORTED_PROTOCOL`.

## 7. Authentication model

Handshake credentials are exactly:

```text
socket.handshake.auth.token: opaque game-role session token
```

Query-string tokens, cookies, registration-body tokens, and authorization
headers are rejected for `/game`. Authentication runs in namespace middleware:

1. Validate origin against the existing explicit `OriginPolicy`.
2. Require a loopback peer unless a future deployment ADR explicitly enables
   remote access.
3. Reject any query credential.
4. parse `handshake.auth` strictly and enforce a maximum token length of 256.
5. Call `authorizeSession(registry, {token, role:"game"})`.
6. Store only returned `clientId`, expiry, and token fingerprint in socket
   context; never store or log the token.

Authentication is per connection. Registration cannot replace it. The client
may claim `gameId` and `instanceId`, but never `clientId`, role, runtime ID,
session generation, or connection generation. Those are server-derived.

Auth failures use `AUTH_REQUIRED`, `AUTH_INVALID`, `AUTH_EXPIRED`,
`AUTH_REVOKED`, `AUTH_FORBIDDEN`, `QUERY_TOKEN_FORBIDDEN`, or
`ORIGIN_FORBIDDEN`. Raw auth-core messages and tokens are not emitted.

## 8. Session identity model

One live destination is identified by:

```text
clientId (from auth session)
+ gameId (validated registration claim)
+ gameInstanceId (nonempty registration instanceId)
+ serverRuntimeGeneration
+ connectionGeneration
```

`socket.id` is metadata, never an authorization identity. Null/anonymous
`gameInstanceId` is forbidden for real Milestone 4 sessions even though the
Milestone 3 port remains nullable for transport-neutral use.

Rules:

- A client may register up to four distinct instances.
- One `(gameId, gameInstanceId)` has exactly one active socket.
- The same authenticated `clientId` reconnecting the same tuple atomically
  replaces the prior socket and increments `connectionGeneration`.
- A different `clientId` attempting the occupied tuple receives
  `INSTANCE_OWNED_BY_OTHER_CLIENT`; no replacement occurs.
- A socket registers once and cannot change identity. A second registration is
  `ALREADY_REGISTERED`.
- Registration must complete within 5000 ms of connection.
- A stale disconnect removes nothing unless its stored generation still equals
  the registry generation.
- `gameId` must resolve to a known manifest/profile association before
  registration succeeds. Active-game switching remains out of scope.

## 9. Live-session registry

The registry is process-local and keyed by canonical
`gameId + "\u0000" + gameInstanceId`. Each entry stores:

- `clientId`, `gameId`, `gameInstanceId`;
- auth fingerprint and auth expiry;
- opaque server runtime generation;
- monotonically increasing connection generation;
- socket handle (private adapter type);
- connected, registered, and last-heartbeat trusted timestamps;
- SDK and protocol versions.

Operations are atomic within the event loop: register/replace, resolve,
validate-current, heartbeat, remove-if-current, and close-all.

Limits:

- 256 active registered sessions per server runtime;
- 4 sessions per `clientId`;
- 1 session per `(gameId, gameInstanceId)`;
- no eviction of a live session to make room; reject with `SESSION_CAPACITY`;
- deterministic cleanup of disconnected/stale entries, at most 128 per sweep.

The registry is not persisted and does not own action truth. Server restart
clears it. Durable pending actions wait for a newly paired and registered
destination; in-flight/received actions follow ADR-021 reconciliation.

## 10. Delivery adapter design

`SocketIoActionDeliveryAdapter` implements the existing
`ActionDeliveryPort`.

`resolveDestination(envelope)`:

1. Select only a registered, authenticated, non-expired, live session matching
   `envelope.gameId`.
2. If `envelope.gameInstanceId` is non-null, require that exact instance.
3. Otherwise select deterministically by `gameInstanceId ASC`, then connection
   generation DESC. Milestone 4 has no active-game switching.
4. Return a transport-neutral destination extended during implementation with
   an opaque `destinationGeneration` string/number. Do not return a socket.
5. Return `no_destination` when no eligible entry exists.

`send(delivery)`:

1. Re-read the registry entry.
2. Require client ID, game instance ID, runtime generation, and connection
   generation to match the resolved destination.
3. Require the socket connected, registered, auth-unexpired, and writable.
4. Emit a strict `game.action` message containing the already committed
   `attemptNumber` and current `sessionGeneration`.
5. Return `sent` after synchronous Socket.IO enqueue succeeds.
6. If the destination vanished, was replaced, is backpressured, or emit throws,
   return `transport_error`; do not mutate durable state.

The destination generation is the minimum additive change required to close
the resolve/send race. Socket.IO objects never cross the adapter boundary.

No application-level outbound queue is added. Socket.IO enqueue is the
transport send, not durable receipt.

## 11. Receipt and result protocol

### Receipt

The SDK sends `game.action.received` only after strict envelope validation and
successful insertion into its bounded local execution queue.

Server validation:

1. Payload schema and protocol version pass.
2. Socket is the current registered connection generation.
3. Payload session generation equals the registry entry.
4. Durable action exists and matches registered `gameId`.
5. Durable attempt exists with the supplied attempt number and registered
   `gameInstanceId`.
6. Action is `in_flight`, or already `received/completed/failed`.

For the first valid receipt, call `ActionGateway.markReceived` using the
trusted server clock; client `receivedAt` is diagnostic only. Duplicate valid
receipts return no mutation. A receipt from an older durable attempt is
accepted only if it comes from the current session generation and that attempt
was bound to the same instance: it still proves the action was locally
enqueued. A stale socket/session generation is always rejected.

### Result

`game.action.result` represents gameplay completion or permanent gameplay
failure, not transport failure. The SDK sends it only after a receipt for the
same action.

Validation repeats the receipt binding checks. The action must be `received`
or already terminal. The server maps `completed`/`failed` to
`ActionGateway.markResult`. Duplicate identical terminal results are
idempotent. A conflicting second terminal result returns
`RESULT_CONFLICT` and never rewrites durable truth.

Late results after `expired`, `delivery_failed`,
`delivery_unknown_restart`, or `aborted_restart` return
`ACTION_NOT_ACCEPTING_RESULT`; no resurrection occurs. Result `details` and
error fields remain JSON-safe and size bounded.

There is no wire-level “execution started” event in Milestone 4. It is an SDK
internal state; adding one would not change retry because receipt already
stops delivery retry.

## 12. Reconnect and stale-session semantics

Replacement sequence:

1. New socket authenticates with a currently valid token.
2. It registers the same tuple.
3. Registry atomically publishes generation `N+1`.
4. Old socket receives `SESSION_REPLACED` and is disconnected.
5. Old socket events and disconnect callbacks carry generation `N`; all fail
   `validate-current` and cannot remove or mutate generation `N+1`.
6. Future delivery resolves generation `N+1`.

There is no reconnect grace lease. Registry removal is immediate and fenced.
Durable `no_destination` rechecks provide the bounded wait behavior.

SDK action deduplication survives reconnect within the same SDK object. A page
reload creates a new SDK cache; durable action IDs and repeat receipt semantics
still prevent server-side duplicate lifecycle mutation, while gameplay
exactly-once across a full client-state loss is not claimed.

## 13. Liveness, disconnect, and restart

- Socket.IO ping interval: 10 seconds.
- Socket.IO ping timeout: 20 seconds.
- SDK `game.heartbeat`: every 10 seconds after registration.
- Session stale threshold: 30 seconds since last valid heartbeat.
- Liveness sweep: every 5 seconds, at most 128 entries.
- Registration deadline: 5 seconds.

Socket.IO ping/pong detects broken transport; the custom heartbeat proves the
SDK event loop and registered protocol handler are alive. Missing the stale
threshold removes-if-current and disconnects the socket. Delivery during
reconnect returns `no_destination` or a fenced `transport_error`.

On graceful server shutdown: stop accepting connections, fence/close the
registry, disconnect namespace sockets, stop timers, then dispose auth. No
background task survives shutdown.

On restart: auth sessions and registry are empty, so clients must pair again.
Milestone 3 reconciliation remains authoritative; no old gameplay is replayed
automatically.

## 14. Backpressure and limits

- Socket.IO `maxHttpBufferSize`: 65,536 bytes.
- Registration: one accepted attempt per socket; at most 4 invalid attempts
  before disconnect.
- Heartbeat limiter: 2/second, burst 4 per socket.
- Receipt/result limiter: 20/second, burst 40 per socket.
- Invalid/unknown messages: 5 within 10 seconds, then disconnect.
- SDK execution concurrency: 32 handlers.
- SDK pending local action queue: 256 entries.
- SDK dedupe/result cache: 2048 action IDs, terminal entries retained for
  30 minutes, then deterministic LRU expiry.
- No unbounded server or SDK queue.

When the SDK queue is full it does not emit receipt; it may emit a protocol
error diagnostic, and the durable retry/TTL policy remains in control. Active
SDK entries are never evicted. If all 2048 entries are active, the SDK rejects
new enqueue without receipt.

## 15. Security model

- Namespace middleware authenticates before registration handlers run.
- Explicit origins only; wildcard credentialed CORS is forbidden.
- Default listener remains loopback. Remote exposure requires TLS termination
  and a future deployment decision; Milestone 4 does not enable it.
- Token appears only in handshake auth, is never echoed, persisted, included
  in URLs, or logged. Logs may contain only its short fingerprint.
- Client ID and role are server-derived from auth.
- Every receipt/result is checked against current socket generation, registry
  identity, durable action game, durable attempt number, and bound instance.
- Zod strict parsing and the 64 KiB transport limit precede business logic.
- Rate/capacity exhaustion fails closed and never evicts an authorized live
  session or mutates durable state.

## 16. Error taxonomy

Connection errors:

- `AUTH_REQUIRED`, `AUTH_INVALID`, `AUTH_EXPIRED`, `AUTH_REVOKED`
- `AUTH_FORBIDDEN`, `QUERY_TOKEN_FORBIDDEN`, `ORIGIN_FORBIDDEN`

Registration errors:

- `REGISTRATION_REQUIRED`, `REGISTRATION_TIMEOUT`, `INVALID_REGISTRATION`
- `UNSUPPORTED_PROTOCOL`, `UNSUPPORTED_SDK`, `GAME_NOT_FOUND`
- `ALREADY_REGISTERED`, `INSTANCE_OWNED_BY_OTHER_CLIENT`, `SESSION_CAPACITY`

Message/lifecycle errors:

- `INVALID_MESSAGE`, `RATE_LIMITED`, `SESSION_STALE`, `SESSION_REPLACED`
- `ACTION_NOT_FOUND`, `ACTION_BINDING_MISMATCH`, `ATTEMPT_NOT_FOUND`
- `ACTION_NOT_ACCEPTING_RECEIPT`, `ACTION_NOT_ACCEPTING_RESULT`
- `RESULT_CONFLICT`, `INTERNAL_ERROR`

Errors contain code, retryable, optional action ID, and correlation ID. They
never expose tokens, socket internals, SQL, stack traces, or raw payloads.

## 17. Observability

Structured events record:

- connection/auth success or failure by code and token fingerprint;
- registration/replacement/disconnect with client, game, instance, and
  generations;
- destination resolve outcome;
- transport enqueue outcome and durable action/attempt number;
- receipt/result accepted, duplicate, rejected, or conflicting;
- heartbeat expiry, rate limit, and capacity rejection.

Counters are bounded aggregate metrics. Payload bodies, action params, tokens,
and raw errors are not logged. Correlation uses action ID, attempt number, and
server-generated connection correlation ID.

## 18. Important sequences

### Connection and registration

```text
client connects /game with handshake auth token
→ origin/query/auth middleware validates
→ unregistered socket starts 5s deadline
→ game.register schema validates game/instance/versions
→ manifest association validates
→ registry register/replace publishes generation
→ game.registered returns authoritative identity and heartbeat interval
```

### First send, receipt, and result

```text
ActionGateway resolves fresh destination generation
→ durable authorization + send_started + in_flight commit
→ adapter revalidates same generation and emits game.action
→ SDK validates and enqueues locally
→ SDK emits attempt-correlated receipt
→ server validates session/action/attempt and marks received
→ handler completes or fails
→ SDK emits result
→ server validates and marks completed/failed
```

### Retry and disconnect

```text
no receipt by durable nextAttemptAt
→ gateway resolves current registry entry again
→ fresh destination-bound authorization and durable attempt commit
→ adapter revalidates generation and emits
disconnect/replacement at any point
→ remove-if-current; stale generation callbacks no-op
→ no destination consumes no attempt; TTL and max attempts remain authoritative
```

### Server restart

```text
registry/auth sessions disappear
→ durable repository reconciles previous runtime
→ clients must pair and register again
→ pending work may use new destination
→ in-flight becomes delivery_unknown_restart; received remains received
→ no automatic prior-runtime gameplay replay
```

## 19. Test strategy

Real Socket.IO server/client tests are mandatory for handshake auth, origin and
query rejection, registration, replacement, stale disconnect, namespace
isolation, destination disappearance, actual emit, receipt/result flow,
multiple independent clients, heartbeat timeout, and shutdown.

Deterministic registry/adapter fakes test generation fencing, ordering,
capacity, rate limits, resolve/send races, and cleanup with injected clocks.

Real SQLite integration tests combine Socket.IO with Milestone 3 to prove
durable commit precedes observed client delivery, receipt stops retry, stale
messages cannot mutate, TTL wins, and restart reconciliation is unchanged.

SDK tests use fake sockets and clocks for validation, enqueue-before-receipt,
handler concurrency, duplicate delivery, repeated receipt, cached result,
queue/capacity limits, reconnect listener cleanup, and disposal.

Node worker threads remain required only for persistence races inherited from
Milestone 3; the process-local registry is tested with independent real clients,
not workers.

Declaration tests cover all new shared schemas, server adapter/registry public
types, and SDK package-root APIs, including negative version, identity, and
handler signatures.

## 20. Public API and export boundary

- `@crowdcircuit/contracts`: lifecycle message schemas/types only; no Socket.IO
  types.
- `@crowdcircuit/auth-core`: existing generic session/origin APIs; change only
  if an independently reviewed narrow adapter helper is proven necessary.
- `@crowdcircuit/server`: composition options and intentionally testable
  transport/session ports; no raw namespace/socket types in package-root
  declarations.
- `@crowdcircuit/game-sdk-js`: `CrowdCircuitGameClient`, configuration,
  registration/connect/disconnect, action handler registration, receipt/result
  reporting, and disposal. Provider/socket internals stay private.

## 21. Migration and persistence impact

No migration or schema change is expected. Session registry state is
deliberately process-local. Durable attempt history already contains action ID,
attempt number, runtime ID, and game instance binding. If implementation proves
that cross-client validation cannot be performed from these existing fields,
stop with `ARCHITECTURE_GAP`; do not add a convenience migration silently.

## 22. Alternatives considered

- Token in `game.register`: rejected because handlers would exist before
  authentication and it conflicts with the accepted handshake-auth plan.
- Query token: rejected due to URL/log leakage.
- Multiple sockets per instance: rejected because destination choice and stale
  receipt authorization become ambiguous.
- Durable session registry: rejected because auth/session state is ephemeral
  and it would become a second source of truth.
- Socket.IO callback as receipt: rejected because server enqueue is not client
  local enqueue.
- Grace-period registry entries: rejected because fenced immediate replacement
  plus durable no-destination retry is simpler and deterministic.
- Unbounded outbound buffering: rejected because it bypasses backpressure and
  TTL authority.

## 23. Risks and mitigations

- Resolve/send race: destination generation is revalidated immediately before
  emit.
- Old disconnect deletes replacement: remove-if-current generation guard.
- Cross-client spoof: auth-derived client plus registry and durable attempt
  binding checks.
- Client reload loses dedupe cache: at-least-once semantics are explicit;
  durable server idempotency remains intact.
- SDK queue exhaustion: bounded queue, no premature receipt.
- Contract drift: shared Zod schema slice precedes transport implementation.
- Timer leakage: one owned lifecycle controller with explicit shutdown.

## 24. Open questions

No product-blocking question remains. Independent review must confirm:

1. The proposed breaking pre-implementation removal of `token` from
   `GameRegisterMessage`.
2. Addition of attempt/session-generation fields to lifecycle messages.
3. The selected numeric bounds and heartbeat timing.
4. Deterministic instance selection when the action envelope has null instance.

Any requested change to these items returns to architecture review before
implementation.

## 25. Final architecture verdict

**MILESTONE_4_ARCHITECTURE_READY_FOR_INDEPENDENT_REVIEW**

The current repository can implement this design without weakening Milestone
3, adding durable session state, or making a hidden product decision.
