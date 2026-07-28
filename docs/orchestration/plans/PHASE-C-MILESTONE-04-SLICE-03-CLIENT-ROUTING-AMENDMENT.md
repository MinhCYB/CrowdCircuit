# Phase C Milestone 4 Slice 3 — Client-Routing Correction Amendment

**Date:** 2026-07-28  
**Baseline:** `6617f9fffda55f39476ad49fe39732277040978b`  
**Status:** APPROVED_FOR_REMEDIATION

## Confirmed production defect

`apps/server/src/delivery/socket-io/index.ts` uses
`clientId: envelope.gameId`; `apps/server/src/persistence/repository.ts` uses
`clientId: input.gameId`. A game ID is not authenticated client identity.
Correction tests must use `clientId !== gameId`.

## Root cause

The lookup query requires a client before registry selection even though the
envelope and durable action intentionally contain no client identity. The
adapter and persistence layer consequently fabricate ownership from `gameId`.

## Durable domain target

The registry discovers the authenticated owner of the selected eligible live
session. The durable attempt binds that resolved client and non-null instance
without adding `clientId` to `GameActionEnvelope`.

## Resolution-query versus resolved-destination identity

```ts
export interface GameDestinationQuery {
  readonly gameId: string;
  readonly gameInstanceId: string | null;
}

export interface DeliveryDestination {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string;
  readonly sessionGeneration: number;
  readonly destinationGeneration: string;
}
```

The query expresses requested domain identity only. The resolved destination
gets `clientId`, non-null `gameInstanceId`, and `sessionGeneration` from the
selected authenticated registry entry. `destinationGeneration` remains opaque
and authoritative for final validation. No provider field or socket ID is
exposed. The adapter uses explicit `sessionGeneration`, not fence decoding, to
construct domain data.

## Corrected registry semantics

Explicit-instance resolution is exact `(gameId, gameInstanceId)` with no
fallback. Null-instance resolution considers every eligible current entry for
the requested game regardless of owner and selects by `gameInstanceId`
ascending, retaining the defensive generation ordering. The selected entry
supplies authenticated `clientId`. Eligibility, ADR-026 ownership conflict,
replacement, and the complete client-aware final fence remain unchanged.

`GameSessionDeliveryPort` exclusively owns delivery lookup:

```ts
export interface GameSessionDeliveryPort {
  lookupDestination(
    query: GameDestinationQuery,
  ): Promise<SessionLookupResult>;

  sendIfCurrent(
    message: GameActionDeliveryMessage,
    destinationGeneration: string,
  ): GameSessionSendResult;
}
```

`SessionLookupQuery` is replaced by `GameDestinationQuery`.
`GameSessionRegistryReadPort` retains only `getSession`,
`listSessionsForClient`, and `getActiveSessionCount`; it has no duplicate
authoritative lookup. This preserves the current transport-neutral adapter
boundary without a second registry capability object.

## Corrected durable-attempt authorization binding

```ts
export interface DeliveryAttemptBinding {
  readonly clientId: string;
  readonly gameInstanceId: string;
}

authorizePending(
  actionId: string,
  expectedVersion: number,
  runtimeId: string,
  binding: DeliveryAttemptBinding,
): SendAuthorization;

authorizeRetry(
  actionId: string,
  expectedVersion: number,
  runtimeId: string,
  binding: DeliveryAttemptBinding,
): SendAuthorization;

recordAttempt(
  authorization: SendAuthorization,
  binding: {
    readonly role: "game";
    readonly clientId: string;
    readonly gameInstanceId: string;
  },
  attemptedAt: number,
  outcome: ActionAttempt["outcome"],
  failureCode?: string | null,
): ActionAttempt;
```

`#newAuthorizationDetails` accepts the resolved binding and no longer derives
`clientId` from `input.gameId`. An authorization cannot be reused with a
different binding. Existing `client_id` and `game_instance_id` columns remain;
there is no SQL, schema, or migration change.

## Persist-before-send proof

```text
resolve by gameId + optional gameInstanceId
→ registry discovers selected authenticated client
→ construct concrete resolved destination
→ authorize pending/retry with resolved client + instance
→ record durable attempt with the same binding
→ commit
→ send with the unchanged exact client-aware generation fence
```

Resolution absence/ineligibility is `no_destination` with no attempt.
Persistence failure causes zero send. Staleness, expiry, disconnection, or
replacement after resolution produces a persisted attempt with
`transport_error`.

## Retry and owner-change semantics

The current attempt is never rebound, redirected, or retried by the adapter.
A later retry performs fresh resolution and creates a new durable attempt. It
may select a new owner only then. Old attempt history and its fence remain
bound to the original resolved client.

## Exact TypeScript signatures

The declarations above are normative and complete.

## Exact ownership expansion

- `apps/server/src/game/ports.ts`: only replace `SessionLookupQuery` with
  `GameDestinationQuery`, remove lookup from `GameSessionRegistryReadPort`,
  and keep it on `GameSessionDeliveryPort`; no Socket.IO import or
  registration/replacement change.
- `apps/server/src/game/registry/index.ts`: only remove pre-selection client
  filtering, select eligible exact/null-instance entries, and return the
  selected authenticated client; preserve conflict, replacement, eligibility,
  ordering, and final fence.
- `apps/server/src/delivery/port.ts`: only strengthen
  `DeliveryDestination`.
- `apps/server/src/delivery/socket-io/index.ts`: only remove
  `gameId → clientId`, use selected identity and explicit session generation,
  and preserve opaque-fence send behavior.
- `apps/server/src/delivery/gateway.ts`: only construct the resolved
  `DeliveryAttemptBinding` and pass it to pending/retry authorization while
  preserving record-before-send and retry policy.
- `apps/server/src/persistence/types.ts`: only add the binding and update the
  authorization signatures; no storage contract change.
- `apps/server/src/persistence/repository.ts`: only pass the binding into
  `#newAuthorizationDetails`, remove `input.gameId → clientId`, and persist
  supplied values into existing columns while preserving lifecycle, lease,
  version, and transaction semantics.

No broad persistence co-ownership is granted.

## Complete migration/test allowlist

Narrow changes are authorized in:

- `apps/server/test/socket-io-delivery-adapter.test.ts`;
- `apps/server/test/socket-io-delivery-transport.test.ts`;
- `apps/server/test/game-registry.test.ts`;
- `apps/server/test/delivery-port.test.ts`;
- `apps/server/test/declaration-consumer.ts`;
- `apps/server/test/action-gateway-core.test.ts`;
- `apps/server/test/persistence.test.ts`;
- `apps/server/test/persistence-slice1.test.ts`;
- `apps/server/test/support/fake-action-delivery-port.ts`, only if required.

The authoritative pre-edit search reports 10, 37, 15, and 3 matches
respectively in the gateway, persistence, persistence-slice1, and declaration
files: 65 total, including 62 in the three principal test files.

Required distinct-identity cases cover explicit resolution; client-free query;
returned owner; real delivery; null-instance cross-owner and reverse-order
selection; exact missing instance; expired exclusion; wrong-client fence;
same-client replacement/fresh resolution; occupied different-client rejection;
fresh retry/new-attempt owner change; matching/mismatching binding; rejection
of the old buggy binding; zero send after persistence failure; client-free
envelope; malformed/stale fence; and retained historical assertions.

## ADR-027 normative correction

The dated ADR amendment replaces the impossible authenticated-client-before-
resolution interpretation. Game-scoped eligible selection discovers the owner,
which then binds durability and final fencing. ADR-026 and the destination
identity tuple do not change.

## Frozen behavior

Frozen: `GameActionEnvelope`; shared contracts/versioning; database schema and
migrations; registration ownership; same-client replacement; different-client
occupied takeover rejection; complete generation fence; Socket.IO provider
isolation; eligible-only resolution; deterministic ordering;
persist-before-send; receipt/result lifecycle; retry/TTL policy; SDK runtime;
and Slice 4+.

## Remediation sequence

1. Record the fresh call-site inventory.
2. Correct query/destination types and lookup ownership.
3. Correct registry selection and adapter identity.
4. Add resolved durable binding and migrate allowed call sites.
5. Add the required tests.
6. Run focused and repository verification.

## Required verification

Run server lint, typecheck, tests, declarations, and build; affected repository
gates; `git diff --check HEAD --`; scope/provider scans; and confirm no schema,
migration, manifest, lockfile, SDK, receipt/result, or Slice 4+ change.

## Final amendment status

**APPROVED_FOR_REMEDIATION**
