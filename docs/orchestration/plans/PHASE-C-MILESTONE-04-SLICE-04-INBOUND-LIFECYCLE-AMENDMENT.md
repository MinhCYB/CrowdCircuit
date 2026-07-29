# Phase C Milestone 4 Slice 4 — Inbound Lifecycle Amendment

**Baseline:** `37be23c4f345bee5f7be1ca2a640125514e3f09c`  
**Scope:** documentation-only corrective architecture  
**Status:** APPROVED_FOR_IMPLEMENTATION

## Objective and lifecycle position

Slice 4 connects strict `game.action.received` and `game.action.result`
messages to the Milestone 3 durable lifecycle. It follows approved Slices 1–3
and must finish before Slice 5. It adds no SDK behavior or wire contract.

## Inherited Slice 1–3 invariants

- Strict correlation fields, bounded wire errors, authentication,
  current-generation fencing, and delivery routing remain authoritative.
- The durable action precedes send and remains lifecycle truth. The action is
  the source of `gameId`; consumed send authorization is the source of
  historical attempt identity.
- Attempt numbers are exact and distinct; there is no latest-attempt fallback.
- Provider handles and Socket.IO types remain private.
- Retry, TTL, reconciliation, retention, and accepted ADR-028 history remain
  unchanged.

## Historical attempt-binding source

Add to `apps/server/src/persistence/types.ts`:

```ts
export interface DurableAttemptBinding {
  readonly actionId: string;
  readonly attemptNumber: number;
  readonly clientId: string;
  readonly gameInstanceId: string;
}

findAttemptBinding(
  actionId: string,
  attemptNumber: number,
): DurableAttemptBinding | null;
```

The source is the immutable consumed `action_send_authorizations` row, keyed by
exact `(actionId, attemptNumber)`. Retries create distinct attempts/bindings.
The existing unique constraint prevents duplicates; no schema or migration is
needed. Missing binding is `ATTEMPT_NOT_FOUND`. This lookup alone never
authorizes: the gateway freshly loads the action. If retention removed the
parent action, an orphan binding is `ACTION_NOT_FOUND`.

## Current-session proof

Inbound authorization reuses
`GameSessionRegistryReadPort.getSession(clientId, gameId, gameInstanceId)` and
never outbound `lookupDestination()`. The proof is authenticated socket
`clientId` + socket-held registered game/instance/generation +
`registry.getSession(...)` + payload `sessionGeneration`. A message is current
only if the returned entry matches the socket client/game/instance, its
`connectionGeneration` equals the socket's registered generation, and the
payload generation equals that same generation. The current replacement may
therefore acknowledge a historical attempt bound to the same
client/game/instance, while the replaced socket is rejected. No registry
change is authorized.

## Exact inbound lifecycle interfaces

Add only provider-neutral types to `apps/server/src/game/ports.ts`:

```ts
export interface InboundGameSession {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string;
  readonly sessionGeneration: ConnectionGeneration;
}

export interface InboundActionLifecyclePort {
  handleReceipt(
    session: InboundGameSession,
    message: GameActionReceivedMessage,
  ): InboundLifecycleResult;
  handleResult(
    session: InboundGameSession,
    message: GameActionResultMessage,
  ): InboundLifecycleResult;
}

export type InboundLifecycleResult =
  | { readonly status: "accepted"; readonly record: DurableActionRecord }
  | { readonly status: "idempotent"; readonly record: DurableActionRecord }
  | {
      readonly status: "rejected";
      readonly code:
        | "ACTION_NOT_FOUND"
        | "ACTION_BINDING_MISMATCH"
        | "ATTEMPT_NOT_FOUND"
        | "ACTION_NOT_ACCEPTING_RECEIPT"
        | "ACTION_NOT_ACCEPTING_RESULT"
        | "RESULT_CONFLICT";
    };
```

`ActionGateway` implements the narrow port. `socket-server.ts` owns strict
parsing, session proof, exception containment, and `game.error`. No provider
type enters these interfaces.

## Exact bounded error mapping

| Condition | Wire error |
|---|---|
| malformed strict message | `INVALID_MESSAGE` |
| unregistered sender | `REGISTRATION_REQUIRED` |
| stale/replaced socket or generation mismatch | `SESSION_STALE` |
| unknown/retention-cleaned action | `ACTION_NOT_FOUND` |
| unknown exact attempt | `ATTEMPT_NOT_FOUND` |
| cross-client, cross-game, or cross-instance | `ACTION_BINDING_MISMATCH` |
| nonaccepting receipt state | `ACTION_NOT_ACCEPTING_RECEIPT` |
| nonaccepting result state | `ACTION_NOT_ACCEPTING_RESULT` |
| conflicting terminal result | `RESULT_CONFLICT` |
| repository/database failure | `INTERNAL_ERROR` |
| optimistic stale transition | reread and classify; never expose persistence code |

Only already-approved contract codes are used.

## Receipt state table

Classification follows fresh parent-action load and exact binding authorization.

| Durable state/condition | Outcome |
|---|---|
| `in_flight` | accepted → `received` |
| `received`, `completed`, `failed` | idempotent |
| `pending` | `ATTEMPT_NOT_FOUND` (a consumed binding cannot legally coexist with pending) |
| `expired`, `delivery_failed`, `delivery_unknown_restart`, `aborted_restart` | `ACTION_NOT_ACCEPTING_RECEIPT` |
| missing binding | `ATTEMPT_NOT_FOUND` |
| identity mismatch | `ACTION_BINDING_MISMATCH` |

Receipt idempotency is explicit and is not inferred from arbitrary terminal
state.

## Canonical durable-result mapping

```ts
export type DurableGameResult =
  | {
      readonly status: "completed";
      readonly durationMs: number;
      readonly details?: JsonValue;
    }
  | {
      readonly status: "failed";
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly retryable: boolean;
      };
    };
```

Completed storage: `failureCode = null`;
`resultDetails = { durationMs, details: details ?? null }`.
Failed storage: `failureCode = error.code`;
`resultDetails = { message: error.message, retryable: error.retryable }`.
No schema change.

## Result state table

| Durable state | Incoming result | Outcome |
|---|---|---|
| `received` | completed/failed | accepted → matching terminal state |
| `completed` | identical completed | idempotent |
| `failed` | identical failed | idempotent |
| `completed` | different completed or failed | `RESULT_CONFLICT` |
| `failed` | different failed or completed | `RESULT_CONFLICT` |
| `in_flight` | any | `ACTION_NOT_ACCEPTING_RESULT` |
| `pending` | any | `ATTEMPT_NOT_FOUND`; pending cannot have a consumed binding |
| `expired`, `delivery_failed`, `delivery_unknown_restart`, `aborted_restart` | any | `ACTION_NOT_ACCEPTING_RESULT` |
| missing binding | any | `ATTEMPT_NOT_FOUND` |
| identity mismatch | any | `ACTION_BINDING_MISMATCH` |

## Restart-safe equality algorithm

Compare canonical semantic JSON, not raw text. Recursively sort object keys,
preserve array order, and normalize absent completed `details` to `null`.
Completed equality includes status, duration, and normalized details; failed
equality includes status, code, message, and retryable. Equality must survive
SQLite serialize/parse and restart. No hash/column is added. Existing strict
contract bounds apply. Failure message has no explicit maximum, a non-blocking
future-hardening item outside Slice 4.

## Optimistic concurrency classification

Load action and exact binding; authorize; classify; attempt one optimistic
transition. On `STALE_TRANSITION`, reread once and classify committed
state/result as idempotent, conflict, or nonaccepting. Never attempt a second
transition in the inbound call. Required races: duplicate receipt and identical
results produce one accepted/one idempotent; conflicting same-status and
completed-versus-failed produce one accepted/one `RESULT_CONFLICT`;
receipt-versus-result yields `ACTION_NOT_ACCEPTING_RESULT` if result observes
`in_flight`; retry/expiry winners classify to the final nonaccepting state.
The reread is classification, not retry or replay.

## Trusted timestamp rule

Strict parsing validates client `receivedAt`, but the injected server clock
alone controls durable timestamps, TTL, ordering, and transition time. Client
time is not persisted in Slice 4 and may be used only in bounded telemetry.

## Silent-success rule

Accepted and idempotent paths are silent. No success event/ack is added. Only
rejection emits bounded `game.error`; durable transition commits before any
observable success-side behavior.

## Result-before-receipt behavior

When durable state is still `in_flight`, return
`ACTION_NOT_ACCEPTING_RESULT`. Slice 4 performs no buffering, delayed
reprocessing, transport retry, or gameplay replay. Slice 5 exclusively owns
any SDK retention/resend behavior; this amendment does not claim that behavior
already exists.

## Production composition decision

**Composition B — Slice 4 owns first production durable composition.**

`apps/server/src/index.ts`/`main()` is the only production composition root;
all other `buildApp()` and `attachGameSocketServer()` callers are tests.
Production currently constructs no durable repository or `ActionGateway`.

Exact signatures:

```ts
export interface BuildAppOptions {
  readonly authRuntime?: AuthRuntime;
  readonly originPolicy?: OriginPolicy;
  readonly loggerStream?: Writable;
  readonly durableDatabasePath?: string;
  readonly runtimeId?: string;
  readonly clock?: ActionGatewayClock;
  readonly actionRepositoryFactory?: (
    databasePath: string,
  ) => SqliteDurableActionRepository;
}

export function attachGameSocketServer(options: {
  // existing fields and test seams...
  readonly inboundActionLifecycle: InboundActionLifecyclePort;
}): GameSocketRuntime;
```

`buildApp()` resolves path from `options.durableDatabasePath ??
process.env["DATABASE_PATH"] ?? "crowdcircuit.sqlite"`, runtime ID from
`options.runtimeId ?? randomUUID()`, and clock from `options.clock ?? { now:
Date.now }`. The optional factory is a test seam; production uses
`SqliteDurableActionRepository.open({ filename: databasePath })`.

`buildApp()` creates one `GameSessionRegistry`, opens one repository, calls
`repository.reconcilePreviousRuntime(runtimeId, clock.now())` before socket
attachment, constructs `SocketIoActionDeliveryAdapter(registry)`, then
`new ActionGateway(repository, delivery, clock, runtimeId)`, and injects only
the gateway as `InboundActionLifecyclePort`. The same registry enters the
socket runtime. Partial startup closes created resources. Fastify `preClose`
closes sockets first; `onClose` closes the repository exactly once, then an
owned auth runtime. Composition tests use temporary storage/factories.
`persistence/index.ts` changes only if a new amendment type needs export.

## Exact ownership allowlist

Production: `apps/server/src/game/ports.ts` (inbound types/port only);
`apps/server/src/game/socket-server.ts` (handlers/session proof/errors);
`apps/server/src/delivery/gateway.ts` (replace/narrow `markReceived` and
`markResult`, authorization/classification/equality/one reread);
`apps/server/src/persistence/types.ts` (binding/lookup);
`apps/server/src/persistence/repository.ts` (consumed lookup);
`apps/server/src/index.ts` (Composition B only); and
`apps/server/src/persistence/index.ts` only for required export adjustment.

Tests: new `apps/server/test/game-action-inbound.test.ts`;
`game-socket-transport.test.ts`; `action-gateway-core.test.ts`;
`persistence.test.ts`; `index.test.ts` only for composition;
`declaration-consumer.ts`; declaration config only if required.

## Complete test matrix

Require valid receipt/completed/failed; malformed/unregistered/stale/replaced;
current replacement acknowledging historical attempt and old socket rejected;
cross-client/game/instance with `clientId !== gameId`; unknown action/exact
attempt; no latest fallback; duplicate receipt and identical results;
reordered keys and absent/null normalization; same-status/cross-status
conflict; result before receipt; late/expired/reconciled result; multiple
attempts; new retry owner not reauthorizing historical attempt; server clock;
repository failure; concurrent identical/conflicting input; orphan binding as
`ACTION_NOT_FOUND`; silent success; bounded errors; declarations/provider
isolation; Slice 1–3 regressions; and Composition B path/runtime/clock,
reconciliation-before-use, partial-startup cleanup, and shutdown-order tests.

## Frozen/prohibited scope

Frozen: `packages/contracts/**`, `packages/game-sdk-js/**`,
`apps/server/src/delivery/socket-io/**`, schema/migrations, manifests/lockfile,
registry implementation/policies, Slice 1–3 closure records, retry/TTL policy
except the required startup reconciliation call, and Slice 5. No new ADR or
separate delegation-amendment artifact. Do not erase ADR-028 history.

## Verification matrix

All implementation changes stay in the allowlist. Run focused server lint,
typecheck, tests, build, declarations, and Slice 1–3 regressions under the
required runtime. Verify provider isolation, bounded errors/state/races,
startup reconciliation, close ownership, silent success, and no
contract/schema/migration/package changes.

## Amendment status

Every review finding has one explicit schema-compatible answer. Implementation
has not begun.

**APPROVED_FOR_IMPLEMENTATION**
