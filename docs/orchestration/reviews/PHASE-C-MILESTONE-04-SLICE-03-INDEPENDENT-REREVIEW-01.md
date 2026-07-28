# Phase C Milestone 4 Slice 3 — Independent Re-Review 01

**Date:** 2026-07-28
**Branch:** `review/phase-c`
**Review target:** `de0b5896bdce7ee106a92bd1907ea1cac7711b0b`
**Checkpoint parent:** `b2ca5b7a1ed0b190e899626d725f11c7588939c9`

## Review target and checkpoint

This independent re-review evaluates the Slice 3 client-routing remediation at
`de0b589`. The checkpoint is the corrective architecture and documentation
amendment at `b2ca5b7`. The working baseline was clean with an empty staging
area on `review/phase-c`.

## Historical defect chain

1. `6617f9f` — original Slice 3 implementation — `REQUEST_CHANGES`.
2. `b2ca5b7` — corrective architecture/docs amendment.
3. `de0b589` — client-routing remediation — `APPROVE`.

The historical `REQUEST_CHANGES` verdict remains part of the record.

## Baseline evidence

| Check | Evidence |
|---|---|
| Branch | `review/phase-c` |
| HEAD | `de0b5896bdce7ee106a92bd1907ea1cac7711b0b` |
| Parent | `b2ca5b7a1ed0b190e899626d725f11c7588939c9` |
| Short HEAD | `de0b589` |
| Working tree | Clean |
| Staging area | Empty |
| Required implementation runtime | Node v24.15.0, pnpm 11.9.0 |

## Diff/scope inventory

The remediation stays within the approved client-routing amendment. It changes
the adapter, transport-neutral delivery/query boundaries, registry selection,
gateway authorization binding, persistence implementation over existing
columns, and the exact allowlisted tests/declaration consumers. It introduces
no schema, migration, contract, SDK, manifest, lockfile, or Slice 4+ change.

## F1 adapter-defect closure

F1 is closed. The adapter no longer fabricates `clientId` from
`envelope.gameId`. Lookup is scoped by `gameId` plus optional
`gameInstanceId`; the selected eligible registry entry supplies the
authenticated `clientId`, non-null instance, session generation, and opaque
destination fence.

## F2 authorization-defect closure

F2 is closed. Pending and retry authorization receive the resolved
client/instance binding. Durable attempt recording consumes that same binding,
and the repository no longer derives `clientId` from `input.gameId`.

## Domain-model verdict

The durable target remains `gameId` plus optional `gameInstanceId`.
`GameActionEnvelope` remains unchanged and contains no `clientId`. Runtime
client ownership is discovered only by registry resolution.

## Registry explicit/null-instance routing verdict

Explicit-instance lookup is exact `(gameId, gameInstanceId)` with no fallback.
Null-instance lookup considers all eligible current entries for the game,
regardless of owner, and orders deterministically by `gameInstanceId`.
`GameSessionDeliveryPort` owns both `lookupDestination` and `sendIfCurrent`.

## Ownership/replacement/fence verdict

Different-client takeover of an occupied instance remains rejected.
Same-client replacement semantics remain intact. Final send validation retains
the exact selected client-aware runtime, session, connection, game, and
instance generation fence; stale attempts are neither redirected nor rebound.

## Durable attempt and persist-before-send verdict

The resolved client/instance binding flows through authorization and durable
attempt recording. The attempt is committed before transport send.
Persistence failure still causes zero send, and post-resolution transport
failure leaves durable attempt evidence intact.

## Retry/history verdict

There is no retry inside the adapter. A later durable retry performs fresh
resolution and receives a new authorization and attempt. Historical attempt
bindings remain immutable even if a later retry selects a different owner.

## Migration and distinct-ID regression verdict

No schema or migration change is present. Regression coverage uses distinct
`clientId !== gameId` values across adapter, real Socket.IO, cross-owner
null-instance selection, exact lookup, final fencing, authorization binding,
and retry/history cases.

## Contracts/schema/SDK/scope verdict

Shared contracts, `GameActionEnvelope`, database schema, migrations, SDK
files, manifests, and lockfiles remain unchanged. No receipt/result behavior,
Slice 4 implementation, Milestone 5 work, or Phase D work is included.

## Verification evidence

Implementation verification on the required Node v24.15.0 / pnpm 11.9.0
runtime reported:

- server: 152/152 tests across 16 files;
- contracts: 185/185 tests across 7 files;
- repository: 450/450 tests across 32 files;
- repository lint: zero errors and two pre-existing warnings in untouched SDK
  declaration-consumer code;
- server lint, typecheck, declarations, and build passed.

These full green Node 24 counts are implementation-verification evidence; they
were not executed by the independent reviewer.

## Reviewer environment limitation

The independent reviewer used Node v22.22.2 and pnpm 11.9.0. Server lint,
typecheck, declarations, and build passed, and contracts tests passed 185/185.
Eight worker-thread test failures reproduced identically on parent commit
`b2ca5b7`; the reviewer classified them as a pre-existing Node 22 environment
artifact, not a remediation regression. This limitation is non-blocking.

## Findings table

| Severity | Count | Disposition |
|---|---:|---|
| Critical | 0 | None |
| High | 0 | None |
| Medium | 0 | None |
| Low | 0 | None required for closure |
| Observation | 1 | Node 22 worker-thread limitation reproduced on parent; non-blocking |

## Final verdict

No blocking code, architecture, invariant, scope, or test finding remains.
F1 and F2 are closed, and the accepted domain and delivery invariants remain
intact.

INDEPENDENT RE-REVIEW: APPROVE
SLICE 3 REMEDIATION COMMIT: de0b5896bdce7ee106a92bd1907ea1cac7711b0b
CLOSURE RECOMMENDATION: APPROVED_AND_COMPLETE
