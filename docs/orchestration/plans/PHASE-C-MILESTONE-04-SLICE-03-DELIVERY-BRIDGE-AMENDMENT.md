# Phase C Milestone 4 Slice 3 — Delivery Bridge Architecture Amendment

**Date:** 2026-07-28
**Baseline:** `514813687aec465e91b42ee8fc8310408b3b1a21`
**Original implementation result:** SCOPE_BLOCKED
**Review verdict:** APPROVE_WITH_REQUIRED_CORRECTIONS
**ADR impact:** None; ADR-026 and ADR-027 semantics remain unchanged

## Problem statement

The approved Slice 3 scope allowed the delivery adapter to be created under
`apps/server/src/delivery/socket-io/**`, but did not allow the adapter to reach a
current private connection handle safely. Exposing a raw Socket.IO socket or
letting the adapter re-resolve a socket would violate the existing
transport-neutral boundary and ADR-027 generation fencing.

The required bridge belongs in the registry: destination resolution produces
an opaque complete fence, and a synchronous registry operation validates that
fence against the exact current eligible entry immediately before invoking an
action-specific method on that entry's private handle.

## Confirmed SCOPE_BLOCKED root cause

The initial implementation correctly returned `SCOPE_BLOCKED`. The delegation
plan assigned the adapter deterministic selection and generation fencing while
granting it ownership only of the adapter directory and adapter-focused tests.
The registry owned current-entry identity, authentication expiry, replacement,
closure, and the private connection handle; the socket server owned the raw
Socket.IO socket. Therefore the adapter could neither prove an atomic
resolve/send fence nor emit without crossing a frozen ownership boundary.

This is an ownership and internal-boundary gap, not an ADR conflict. No file was
modified during the proposal or review that produced this amendment.

## Accepted registry-mediated send design

`SocketIoActionDeliveryAdapter` resolves through an eligible-only registry
lookup. It encodes the returned structured fence as the public opaque
`destinationGeneration` string. On send, it passes the prepared
`GameActionDeliveryMessage` and opaque fence to a registry `sendIfCurrent`
operation.

The registry decodes the fence fail-closed, reads the current entry once,
compares every fence component, revalidates eligibility and writability, calls
`sendAction` on that exact entry handle, and maps the bounded internal result.
It never exposes or re-resolves a socket, redirects to a replacement, or owns
durable action state.

## Required corrections RC-1 through RC-4

### RC-1 — Complete send eligibility fence

Immediately before emission, `sendIfCurrent` must synchronously validate:

- exact `clientId`;
- exact `gameId`;
- exact non-null `gameInstanceId`;
- exact server runtime generation;
- exact session generation;
- exact connection generation;
- registry not closed;
- authentication not expired;
- connection current, connected, registered, and writable.

### RC-2 — Eligible-only resolution

Destination lookup must exclude already-ineligible entries, including
auth-expired entries.

- ineligible at resolution → `no_destination`;
- valid at resolution but stale/expired/disconnected/backpressured before send
  → `transport_error`.

This distinction preserves durable attempt accounting.

### RC-3 — Opaque destinationGeneration

The public boundary remains:

```ts
readonly destinationGeneration: string;
```

The adapter may use a deterministic private encoding of a structured fence.
The encoding must be unambiguous, fail closed when malformed, independent of
socket ID, tied to the selected session generation, and never refreshed from a
replacement during an old attempt.

### RC-4 — Internal provider failure reasons

Use bounded internal reasons:

```ts
type GameConnectionSendResult =
  | { readonly status: "sent" }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "disconnected"
        | "backpressured"
        | "emit_failed";
    };
```

Raw provider errors, messages, and stacks remain redacted.

## Final internal interfaces

### Structured fence

```ts
interface GameSessionSendFence {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string;
  readonly serverRuntimeGeneration: string;
  readonly sessionGeneration: number;
  readonly connectionGeneration: number;
}
```

`sessionGeneration` is the generation returned to and understood by the game
protocol. In the current registry it is allocated from the connection
generation; both fields remain explicit in the fence so their meanings cannot
be silently conflated if the internal model evolves.

### Internal provider-send result

```ts
type GameConnectionSendResult =
  | { readonly status: "sent" }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "disconnected"
        | "backpressured"
        | "emit_failed";
    };
```

### Internal registry-send result

```ts
type GameSessionSendResult =
  | { readonly status: "sent" }
  | {
      readonly status: "stale";
      readonly reason:
        | "malformed_fence"
        | "runtime_generation_mismatch"
        | "session_generation_mismatch"
        | "connection_generation_mismatch"
        | "auth_expired"
        | "entry_replaced";
    }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "registry_closed"
        | "entry_missing"
        | "disconnected"
        | "backpressured"
        | "emit_failed";
    }
  | { readonly status: "invariant_violation" };
```

The adapter maps every non-`sent` send result to the existing public
`transport_error` outcome with a sanitized bounded error value.

### Internal handle

```ts
interface GameConnectionHandle {
  readonly id: string;
  disconnect(...): void;
  sendAction(
    message: GameActionDeliveryMessage,
  ): GameConnectionSendResult;
}
```

`id` remains non-authoritative. `sendAction` is synchronous, emits only
`game.action`, catches and redacts synchronous provider exceptions, and does
not use callback acknowledgement as domain receipt. Raw `Socket` and
`Namespace` values never escape the socket server. These types remain
server-internal unless an existing module boundary requires a narrow
transport-neutral export.

## Resolve/send race proof

Consider:

1. T1: resolve eligible G1.
2. T2: replacement installs G2.
3. T3: stale G1 reaches `sendIfCurrent`.

The G1 fence cannot match the current G2 entry. The registry returns a bounded
stale or transport failure before invoking either handle. G1 receives nothing;
G2 receives nothing from the stale attempt; there is no fallback or redirect.
A later durable attempt may independently resolve G2.

The required synchronous critical section is:

```text
read current entry
→ compare complete fence
→ validate registry/auth/connection/writable eligibility
→ invoke sendAction on that exact entry handle
→ return result
```

There is no await, timer boundary, external callback, re-resolution, or
provider acknowledgement between the final fence check and enqueue. Socket.IO
enqueue is synchronous in the same JavaScript turn; actual network delivery is
asynchronous and is not domain receipt.

## Eligible-only destination resolution

For an explicit instance, resolution requires exact client, game, and
instance; an open registry; unexpired authentication; and a current connected,
registered, eligible entry. It never falls back.

For a null instance, only eligible entries participate. Candidates are ordered
by `gameInstanceId` ascending, with defensive `connectionGeneration`
descending only when needed. A duplicate current same-instance invariant fails
closed. Selection has no insertion-order dependence, socket-ID tie-break,
round-robin, or load balancing.

The adapter may resolve outside the final send operation only because
`sendIfCurrent` rechecks the exact fence and never redirects. The selected
`sessionGeneration` is used both in the opaque destination-generation encoding
and in the emitted `game.action.sessionGeneration`.

## Exact ownership amendment

### `apps/server/src/game/ports.ts`

Allowed only for transport-neutral fence/result interfaces required across
internal modules. No Socket.IO imports, auth/registration/heartbeat API
changes, or raw connection handle export are allowed.

### `apps/server/src/game/registry/index.ts`

Allowed only for eligible-only destination lookup; exact-fence
`sendIfCurrent`; closed/auth-expiry/current-generation/writability checks; and
bounded result mapping. Registration, replacement, heartbeat, and cleanup
policies cannot change except for the minimum shared eligibility predicate.

### `apps/server/src/game/socket-server.ts`

Allowed only for extending the private `GameConnectionHandle` with
action-specific `sendAction`; wiring it to the private Socket.IO socket;
connected/writable/backpressure checks; and synchronous emit-exception
redaction. It performs no target selection, inbound receipt/result behavior,
or public Socket.IO export.

### Tests

Allowed test ownership is limited to registry unit tests, adapter unit tests,
real Socket.IO delivery integration tests, and declaration tests.

## Frozen behavior outside amendment

Authentication mapping, registration ownership, replacement policy,
heartbeat/rate behavior, cleanup policy, inbound receipt/result, persistence,
and SDK runtime are frozen. Slice 4 and later, Milestone 5, and Phase D remain
blocked. There is no broad co-ownership grant.

## Failure semantics

- Ineligible or absent during eligible-only resolution returns
  `no_destination`; the gateway records no send attempt at that point.
- A destination that becomes missing, replaced, expired, disconnected, or
  backpressured after resolution returns `transport_error`; its durable attempt
  has already been recorded by the gateway.
- Malformed or mismatched fences fail closed and never emit.
- Provider emit throws are caught, reduced to `emit_failed`, and exposed only
  through a sanitized public transport error.
- The adapter does not retry, mutate receipts/results, own queues, perform
  socket lookup, or mutate persistence.
- The existing gateway remains responsible for persist/authorize and
  `recordAttempt` before send, and for retry scheduling after send outcome.

## Test matrix

| Case | Classification | Required proof |
|---|---|---|
| Current generation sends exactly once | Registry unit | One exact-handle call and `sent` |
| Auth expired before resolution → `no_destination` | Registry unit | Expired entry excluded |
| Auth expires between resolution/send → `transport_error`, no emit | Registry unit | Send fence recheck |
| Replacement between resolution/send → stale, no emit to old/new | Registry unit | No redirect |
| Later fresh resolution can send to replacement | Registry unit | New independent fence succeeds |
| Disappearance between resolution/send | Registry unit | Missing maps bounded failure, no emit |
| Runtime/session/connection mismatch | Registry unit | Each mismatch fails closed |
| Malformed opaque generation | Adapter unit | `transport_error`, no provider call |
| Explicit missing instance, no fallback | Adapter unit | `no_destination` |
| Deterministic null-instance selection | Registry unit | Ascending instance selection |
| Insertion-order independence | Registry unit | Same result for reversed insertion |
| Duplicate-current invariant fail-closed | Registry unit | Invariant result, no selection |
| Disconnected/backpressured handle | Real Socket.IO integration | Sanitized unavailable result |
| Provider emit throw with sanitized reason | Real Socket.IO integration | `emit_failed`; no raw error |
| Registry closed lookup/send fail-closed | Registry unit | No destination/no emit |
| Emitted session generation equals fenced generation | Real Socket.IO integration | Exact wire field |
| No adapter queue/socket lookup | Adapter unit | Only registry port interaction |
| Persist-before-send | Adapter unit | Gateway record exists before send |
| No send on persistence failure | Adapter unit | Provider untouched |
| No adapter retry | Adapter unit | One send delegation per invocation |
| No receipt/result mutation | Adapter unit | No inbound lifecycle call |
| Public declaration provider neutrality | Declaration tests | No Socket.IO/provider types |
| Disposal/no reference leak | Real Socket.IO integration | Closed runtime releases connection |

## Public declaration constraints

The existing public delivery boundary retains
`readonly destinationGeneration: string`. Public declarations must not expose
Socket.IO `Socket`, `Namespace`, socket ID as authority, the private
`GameConnectionHandle`, provider error objects, or provider-specific
writability types. Any cross-module type export must be narrow,
transport-neutral, and server-internal where the current module boundary
permits it.

## Implementation sequence

1. Add the narrow transport-neutral fence/result shapes needed across internal
   game modules.
2. Add the minimum shared registry eligibility predicate and eligible-only
   resolution behavior.
3. Extend the private connection handle with synchronous `sendAction`.
4. Add registry `sendIfCurrent` with complete synchronous validation and
   bounded result mapping.
5. Implement the adapter's deterministic fence encoding/decoding and public
   outcome mapping.
6. Add the classified tests above, then run only the Slice 3 verification
   authorized by its implementation task.

Implementation must not begin as part of this documentation amendment.

## Final architecture status

The ownership gap is resolved with the required constraints above. ADR-026 and
ADR-027 remain accepted and unchanged.

**APPROVED_FOR_IMPLEMENTATION_WITH_REQUIRED_CONSTRAINTS**
