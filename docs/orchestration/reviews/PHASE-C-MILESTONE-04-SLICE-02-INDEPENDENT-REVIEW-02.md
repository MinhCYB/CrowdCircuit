# Phase C Milestone 4 Slice 2 — Independent Review 02

**Slice:** Slice 2 — Server authentication and registry
**Original implementation commit:** `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3`
**Remediation commit:** `abd0f985fa3de66d7f2e507b5ace8416c712050d`
**Original verdict:** REQUEST_CHANGES
**Procedural Node 22 re-review:** REQUEST_CHANGES
**Final Node 24 verdict:** APPROVE

---

## Scope

Slice 2 delivers the `/game` Socket.IO namespace on the existing Fastify HTTP
server. It covers:

- Handshake-only `auth.token` authentication, including all forbidden channel
  rejections, error-code mapping, and credential redaction.
- A process-local generation-fenced session registry with atomic same-owner
  replacement, other-owner conflict rejection, compare-and-remove stale
  disconnect fencing, and bounded heartbeat/sweep operations.
- Registration deadline and attempt bound, heartbeat token bucket, invalid/
  unknown message rate limit, and pre-registration guard handlers.
- Shutdown disposal: sweep timer clearance, registry closure, namespace socket
  disconnection, and Socket.IO engine close.

Exclusive file ownership: `apps/server/src/game/auth/**`,
`apps/server/src/game/registry/**`, server composition, and focused tests.
No delivery adapter, receipt/result lifecycle, SDK runtime, persistence,
migration, or Slice 3+ behavior belongs to this scope.

---

## Baseline and Commit Chain

| Role | Commit | Message |
|---|---|---|
| Slice 1 documentation closure | `fab8e1007cbcc89ddf9b99fcd4a25b98296a970c` | `docs: close Phase C milestone 4 slice 1` |
| Slice 2 implementation | `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3` | `feat: implement Phase C milestone 4 slice 2 auth registry` |
| Slice 2 review remediation | `abd0f985fa3de66d7f2e507b5ace8416c712050d` | `fix: address Phase C milestone 4 slice 2 review` |

The chain is linear on `review/phase-c`. Each commit builds on the prior
reviewed checkpoint.

---

## Original Findings (First Independent Review)

The first independent review of commit `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3`
returned **REQUEST_CHANGES**. The implementation architecture was assessed as
correct. All findings are listed below.

### M-1 — Missing focused transport-layer test coverage (blocking)

`apps/server/src/game/socket-server.ts` contained Slice 2 transport-layer
behavior that lacked focused coverage for:

- Registration deadline: `REGISTRATION_TIMEOUT` emission, unregistered socket
  disconnect, timer clearance.
- Heartbeat rate limiting: burst exhaustion producing `RATE_LIMITED`, refill
  determinism, no real-time sleep.
- Invalid/unknown message bound: bounded `INVALID_MESSAGE` state, forced
  disconnect at threshold.
- Unsupported protocol: bad `specVersion` producing `UNSUPPORTED_PROTOCOL`.
- Same-owner cross-connection replacement through real sockets: ordering,
  `game.registered` before `SESSION_REPLACED`, stale disconnect fencing.
- Different-owner conflict through real sockets: `INSTANCE_OWNED_BY_OTHER_CLIENT`,
  current owner unaffected.
- Pre-registration guards: `game.heartbeat`, `game.action.received`,
  `game.action.result` each producing `REGISTRATION_REQUIRED` without quota
  consumption.
- Shutdown disposal: timers cleared, namespace sockets disconnected, engine
  closed, registry closed, no open handles.

### L-1 — No non-string token test (low)

The auth unit tests did not include a case with a non-string token value (e.g.
numeric or object) proving rejection as `AUTH_REQUIRED`.

### L-2 — Header/cookie credential mapping not explicitly documented (low)

The `Authorization` header and `Cookie` header credential → `AUTH_FORBIDDEN`
mapping existed in implementation but was not explicitly called out in Slice 2
documentation.

### L-3 — Markdown hard-break whitespace noise (low)

Two intentional Markdown hard-break trailing spaces in documentation files
triggered `git diff --check` trailing-whitespace output.

---

## Remediation Summary (commit `abd0f985fa3de66d7f2e507b5ace8416c712050d`)

### M-1 — Transport-layer test coverage

Added `apps/server/test/game-socket-transport.test.ts` containing focused,
deterministic real-Socket.IO tests. All eight M-1 sub-findings received
explicit coverage:

- Registration deadline: `REGISTRATION_TIMEOUT` verified with injected
  short-deadline seam; `retryable: true` confirmed; server-generated
  `correlationId` nonempty; no registry entry after timeout; timer cleared on
  close.
- Heartbeat rate limiting: burst-4 token bucket exhausted; `RATE_LIMITED`
  with `retryable: true` and nonempty `correlationId`; injected clock advances
  1 second, refilling 2 tokens; subsequent heartbeat succeeds; no real-time
  sleep.
- Invalid/unknown message bound: `INVALID_MESSAGE` per unknown event; forced
  disconnect at the injected limit; sliding-window expiry verified; no payload
  echo in error response.
- Unsupported protocol: `specVersion: "9.99"` produces `UNSUPPORTED_PROTOCOL`
  with `retryable: false` and nonempty `correlationId`; no registry mutation.
- Same-owner cross-connection replacement: new client receives `game.registered`
  before old client receives `SESSION_REPLACED`; old client disconnects; registry
  points to new `connectionGeneration`; stale old-client disconnect cannot remove
  new session; new heartbeat valid after replacement.
- Different-owner conflict: second client receives
  `INSTANCE_OWNED_BY_OTHER_CLIENT` with `retryable: false`; first client remains
  connected and current in registry; no partial mutation, no counter drift.
- Pre-registration guards: `game.heartbeat`, `game.action.received`, and
  `game.action.result` each produce `REGISTRATION_REQUIRED`; dedicated handlers
  exclude these events from the `onAny` invalid-message quota path; no registry
  entry created.
- Shutdown disposal: `close()` disconnects all namespace sockets, clears sweep
  and registration-deadline timers, closes the registry so subsequent
  registrations return `SESSION_STALE`, is idempotent across repeated calls,
  and leaves no open handles.

A narrow internal testability seam was added to `attachGameSocketServer`:
optional `registrationDeadlineMs`, `invalidMessageWindowMs`, and
`invalidMessageLimit` override parameters. Production defaults are identical to
the existing `GAME_SOCKET_OPTIONS` constants. The `clock` injection was already
present. No new runtime dependency was introduced. No public wire contract
changed. No Socket.IO type is exposed through package-root declarations.

### L-1 — Non-string token coverage

Extended the `it.each` table in `apps/server/test/game-auth.test.ts` with four
additional cases: numeric (`123`), object (`{ nested: true }`), boolean
(`true`), and array (`["a", "b"]`) tokens. All map to `AUTH_REQUIRED` through
the exact-shape `typeof` guard without coercion.

### L-2 — Credential-channel mapping documentation

Explicitly documented in
`docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-02-SELF-REVIEW.md`
and `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-02.md`:

- `Authorization` header credential → `AUTH_FORBIDDEN`
- `Cookie` header credential → `AUTH_FORBIDDEN`

`docs/execution/DECISIONS.md` was not modified. No new ADR was created.

### L-3 — Trailing spaces removed

Markdown hard-break trailing spaces were removed from changed documentation
files. `git diff --check HEAD --` returns zero actual errors.

---

## Finding-by-Finding Final Status

| Finding | Severity | Final status |
|---|---|---|
| M-1 | Medium / blocking | RESOLVED |
| L-1 | Low | RESOLVED |
| L-2 | Low | RESOLVED |
| L-3 | Low | RESOLVED |

No finding remains open or deferred.

---

## Node 22 Environment Caveat

After the remediation commit `abd0f985fa3de66d7f2e507b5ace8416c712050d` was
produced, an intermediate independent re-review was conducted. That reviewer's
sandbox ran **Node v22.22.2**, which is below the repository-required minimum
of Node >=24.2.0.

That environment produced:

- server: 127/135 passed, 8 worker-thread failures.
- repository: 425/433 passed, the same 8 failures.
- The same 8 failures also reproduced on the parent, confirming they were
  environment-only and unrelated to a Slice 2 defect.

Because the Node 22 environment did not meet the repository requirement, that
re-review returned a procedural **REQUEST_CHANGES** verdict. This is not a code
finding. No implementation defect or Slice 2 regression was identified in that
review.

---

## Node 24 Final Verification

**Environment:** Node.js v24.15.0, pnpm 11.9.0

**Scope:** Read-only verification against commit
`abd0f985fa3de66d7f2e507b5ace8416c712050d`. No file was modified, staged,
committed, or pushed during verification.

### Server package

```
pnpm --filter @crowdcircuit/server lint       → PASS (zero errors)
pnpm --filter @crowdcircuit/server typecheck  → PASS
pnpm --filter @crowdcircuit/server test       → 135/135 (14 test files)
pnpm --filter @crowdcircuit/server test:declarations → PASS
pnpm --filter @crowdcircuit/server build      → PASS
```

Test file counts within server (relevant new/changed files):

| File | Tests |
|---|---|
| `test/game-auth.test.ts` | 13 (+4 non-string token cases) |
| `test/game-registry.test.ts` | 7 (unchanged) |
| `test/game-socket.test.ts` | 5 (unchanged) |
| `test/game-socket-transport.test.ts` | 14 (new) |

### Contracts package

```
pnpm --filter @crowdcircuit/contracts lint       → PASS
pnpm --filter @crowdcircuit/contracts typecheck  → PASS
pnpm --filter @crowdcircuit/contracts test       → 185/185 (7 test files)
pnpm --filter @crowdcircuit/contracts test:declarations → PASS
pnpm --filter @crowdcircuit/contracts build      → PASS
```

### Repository-wide

```
pnpm lint      → PASS (zero errors; two pre-existing SDK declaration warnings)
pnpm typecheck → PASS
pnpm test      → 433/433 (30 test files)
pnpm build     → PASS
git diff --check HEAD -- → zero actual errors
```

Public transport-neutral declarations inspected: no `Socket`, `Namespace`,
`socket.io`, or `socket.io-client` symbol present in `apps/server/dist`,
`packages/contracts/dist`, or `packages/game-sdk-js/dist`.

Working tree remained clean throughout. Staging area remained empty.

---

## Authentication and Registry Assessment

All ADR-025 through ADR-030 requirements verified against implementation and
tests:

- Channel fencing order is correct: query-credential check first, header
  check second, auth-object shape check third. No transport token leaks into
  query string, logs, persisted rows, or error payloads.
- Error-code mapping covers all `AuthError` codes and non-string token shapes.
- Registry identity tuple is complete: `clientId + gameId + gameInstanceId +
  serverRuntimeGeneration + connectionGeneration`. Socket ID and handle remain
  internal.
- Snapshots contain no token, fingerprint, header, cookie, or socket reference.
- `authorizeSession` is not called for non-string token shapes.

---

## Replacement and Stale-Fencing Assessment

- Same-owner replacement: `game.registered` is emitted to the new socket before
  `SESSION_REPLACED` is dispatched to the old socket via `outcome.replaced?.disconnect`.
  Ordering is guaranteed by the sequential registration flow.
- Stale disconnect fencing: the old socket's `disconnect` handler calls
  `removeIfCurrent` with the old `connectionGeneration`. Because the registry
  has already advanced to the new generation, this call returns `false` and
  leaves the new session intact.
- Stale heartbeat fencing: `recordHeartbeat` with the old generation also
  returns `false`.
- All fencing is verified by the integration tests in
  `test/game-socket-transport.test.ts`.

---

## Bounds, Cleanup, and Rate Assessment

All accepted constants verified:

| Limit | Value | Verified |
|---|---|---|
| Max total sessions | 256 | registry unit test |
| Max per client | 4 | registry unit test |
| Heartbeat burst | 4 | transport test |
| Heartbeat refill | 2/s | transport test |
| Invalid-message window | 10,000 ms | transport test (injected) |
| Invalid-message threshold | 5 | transport test (injected) |
| Registration deadline | 5,000 ms | transport test (injected) |
| Stale threshold | 30,000 ms | registry unit test |
| Sweep interval | 5,000 ms | socket-server.ts |
| Max sweep | 128 | registry unit test |
| Payload | 65,536 bytes | socket-server.ts |
| Ping interval | 10,000 ms | socket-server.ts |
| Ping timeout | 20,000 ms | socket-server.ts |

Sweep timer is `unref()`'d. Deadline timer is `unref()`'d and cleared on
registration success or socket disconnect. `close()` clears the sweep interval
explicitly before closing the registry and engine.

---

## Scope, Dependency, and Declaration Assessment

- No delivery adapter (`apps/server/src/delivery/socket-io/**`) was introduced.
- No receipt/result lifecycle behavior was introduced.
- No SDK runtime (`packages/game-sdk-js/src`) was modified.
- No persistence or migration was added.
- `socket.io` is a runtime dependency of `apps/server` only.
- `socket.io-client` is a devDependency of `apps/server` only.
- The `lockfile` change from commit `b83cc6f` (adding both at `^4.8.3`) is the
  only dependency delta. The remediation commit `abd0f98` introduced no
  lockfile change.
- No machine-local path appears in any changed file.

---

## Historical Regression Assessment

All tests that passed at the `fab8e10` Slice 1 closure baseline continue to
pass at `abd0f98`. No test was removed, weakened, or skipped. No assertion was
softened to resolve a failure.

---

## Final Slice 2 Status

| Item | Status |
|---|---|
| Slice 2 implementation | APPROVED_AND_COMPLETE |
| M-1 | RESOLVED |
| L-1 | RESOLVED |
| L-2 | RESOLVED |
| L-3 | RESOLVED |
| Node 22 procedural REQUEST_CHANGES | recorded as environment caveat only |
| Node 24 final verification | 433/433 repository tests; all gates pass |
| Slice 3 (Delivery adapter) | READY_TO_START |
| Slice 4 through Slice 6 | BLOCKED_BY_PREVIOUS_SLICE_REVIEW |
| Milestone 5 | BLOCKED_BY_PREVIOUS_MILESTONE |
| Phase D | untouched |

---

## Final Verdict

**FINAL VERDICT: APPROVE**

Slice 2 — Server authentication and registry is approved and complete at commit
`abd0f985fa3de66d7f2e507b5ace8416c712050d`. All four findings are resolved. The
Node 24 environment confirms 433/433 repository tests passing with all lint,
typecheck, declaration, and build gates green. The implementation is
architecturally correct, the test matrix is complete, and no Slice 3+ behavior
was introduced. Slice 3 (Delivery adapter) may now begin from the approved
delegation plan.
