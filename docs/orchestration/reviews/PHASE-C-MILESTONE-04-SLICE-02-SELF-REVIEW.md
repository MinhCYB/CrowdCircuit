# Phase C Milestone 4 Slice 2 — Self-Review (Re-review)

**Status:** APPROVED_AND_COMPLETE
**Baseline:** `fab8e1007cbcc89ddf9b99fcd4a25b98296a970c` (`fab8e10`)
**Implementation commit:** `b83cc6fa82f3e23b6869aa2041dbaa9b6b00edf3` (`b83cc6f`)
**Remediation commit:** `abd0f985fa3de66d7f2e507b5ace8416c712050d` (`abd0f98`)
**Owner:** CODEX

## Review chain

| Step | Verdict |
|---|---|
| CODEX self-review | READY_FOR_INDEPENDENT_REVIEW |
| First independent review | REQUEST_CHANGES (M-1 blocking; L-1, L-2, L-3 low) |
| CODEX remediation | COMPLETE |
| CODEX re-review self-assessment | READY_FOR_INDEPENDENT_RE_REVIEW |
| Node 22 procedural re-review | REQUEST_CHANGES (environment caveat; no code finding) |
| Node 24 final independent verification | APPROVE |
| Slice 2 status | APPROVED_AND_COMPLETE |

Final independent review:
`docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-02-INDEPENDENT-REVIEW-02.md`

Closure handoff:
`docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-02-CLOSURE.md`

## First independent review verdict

REQUEST_CHANGES — implementation assessed as architecturally correct; blocking
finding was missing focused transport-layer test coverage.

## Remediation summary

### M-1 — Transport-layer test coverage (blocking, remediated)

Added `apps/server/test/game-socket-transport.test.ts` (14 new tests) covering
all required transport behaviors:

- Registration deadline: emits `REGISTRATION_TIMEOUT`, disconnects unregistered
  socket, correct `retryable` flag, server-generated `correlationId`, no registry
  entry after timeout, deadline timer cleared on close.
- Heartbeat rate limiting: burst-4 token bucket exhaustion produces `RATE_LIMITED`
  with correct `retryable: true`; advancing the injected clock by 1 second refills
  2 tokens; verified without any real-time sleep.
- Invalid/unknown message bound: `INVALID_MESSAGE` per unknown event; forced
  disconnect at the accepted limit; sliding-window expiry correctly expires old
  entries; no payload echo in error response.
- Unsupported protocol: bad `specVersion` produces `UNSUPPORTED_PROTOCOL` with
  `retryable: false` and nonempty `correlationId`; no registry mutation.
- Same-owner cross-connection replacement: new client receives `game.registered`
  before old client receives `SESSION_REPLACED`; old client disconnects; registry
  points to new generation; stale old-client disconnect cannot remove new session;
  new heartbeat remains valid after replacement.
- Different-owner conflict: second client receives `INSTANCE_OWNED_BY_OTHER_CLIENT`
  with `retryable: false`; first client remains current; no partial mutation or
  counter drift.
- Pre-registration guards: `game.heartbeat`, `game.action.received`,
  `game.action.result` each produce `REGISTRATION_REQUIRED` without consuming the
  `INVALID_MESSAGE` quota; no registry entry created; no receipt/result lifecycle
  behavior introduced.
- Shutdown disposal: `close()` disconnects all namespace sockets, clears sweep and
  registration-deadline timers, closes and empties the registry, is idempotent,
  and leaves no open handles.

Testability seam added to `attachGameSocketServer`: an optional manual
registration-deadline scheduler plus `registrationDeadlineMs` and
`invalidMessageWindowMs` overrides. Production uses the same Node.js timeout,
5-second deadline, and 10-second invalid-message window as before. The clock
injection point was already present. The accepted five-message disconnect limit
is not configurable. No new runtime dependency was added, no public wire
contract changed, and no Socket.IO type is exposed through package-root
declarations.

### L-1 — Non-string handshake token (low, remediated)

Extended `apps/server/test/game-auth.test.ts` `it.each` table with four new cases:
numeric (`123`), object (`{ nested: true }`), boolean (`true`), and array (`["a",
"b"]`) tokens. All map to `AUTH_REQUIRED` via the exact-shape typeof guard. The
existing unit seam confirms no `authorizeSession` call occurs for these shapes.

### L-2 — Local credential-channel mapping (low, documented here)

The `authenticateGameHandshake` function in `apps/server/src/game/auth/index.ts`
gates the following HTTP credential channels before any token validation:

- `Authorization` header credential → `AUTH_FORBIDDEN`
- `Cookie` header credential → `AUTH_FORBIDDEN`

These channels are detected by `hasCredentialHeader`, which checks
`handshake.headers["authorization"]` and `handshake.headers["cookie"]`. Either
header being present (any non-undefined value) triggers an immediate
`GameAuthenticationError("AUTH_FORBIDDEN", false)` before `authorizeSession` is
called.

This mapping is covered by the unit test at
`apps/server/test/game-auth.test.ts` lines in the
`"rejects a forbidden credential/origin channel"` it.each table.

Note: `docs/execution/DECISIONS.md` was not modified (per remediation
instructions).

### L-3 — Trailing spaces in Markdown (low, cleaned)

Intentional Markdown hard-break trailing spaces removed from this file and the
handoff document. `git diff --check HEAD --` returns zero actual errors.

## Auth channel mapping

```
auth.token missing or wrong shape → AUTH_REQUIRED
auth.token non-string (numeric/object/boolean/array) → AUTH_REQUIRED
auth.token empty string → AUTH_REQUIRED
auth.token too long (>256 chars) → AUTH_INVALID
auth.token invalid credential → AUTH_INVALID
auth.token expired credential → AUTH_EXPIRED
auth.token revoked credential → AUTH_REVOKED
auth.token wrong role → AUTH_FORBIDDEN
Authorization header credential → AUTH_FORBIDDEN
Cookie header credential → AUTH_FORBIDDEN
query.token present → QUERY_TOKEN_FORBIDDEN
non-loopback origin → ORIGIN_FORBIDDEN
```

## Delivered (Slice 2)

- `/game` Socket.IO namespace on the existing Fastify server.
- Handshake-only `auth.token`; origin/loopback, query-token, header, and cookie
  rejection; stable redacted authentication errors.
- Process-local registry with runtime and monotonic connection generations,
  atomic same-owner replacement, other-owner rejection, compare-and-remove
  disconnect fencing, heartbeat fencing, and deterministic lookup.
- Registration deadline and attempt bound, heartbeat and invalid-message rate
  bounds, bounded stale sweep, and pre-close lifecycle disposal.

Registry identity is `clientId + gameId + gameInstanceId +
serverRuntimeGeneration + connectionGeneration`. Socket ID and the opaque
connection handle remain internal. Snapshots contain no token, fingerprint,
headers, cookies, or socket object.

Exact limits: 256 total; 4 per client; 1 per game/instance; 5,000 ms
registration deadline; 10,000 ms heartbeat interval; 30,000 ms stale
threshold; 5,000 ms sweep interval; 128 removals per sweep; heartbeat 2/s,
burst 4; 4 invalid registration attempts; 5 invalid/unknown messages per 10s;
65,536-byte payload; Socket.IO ping 10s / timeout 20s.

Dependencies: runtime `socket.io` and test-only `socket.io-client` were added at
`^4.8.3`; `pnpm-lock.yaml` changed accordingly. No persistence, migration,
queue, cache, or timer library was added.

## Exact changed files (remediation diff from b83cc6f)

Modified:

- `apps/server/src/game/socket-server.ts` — internal deterministic deadline
  scheduler and timing overrides; production defaults unchanged
- `apps/server/test/game-auth.test.ts` — 4 new non-string token cases in it.each
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/ROADMAP.md`
- `docs/orchestration/plans/PHASE-C-MILESTONE-04-DELEGATION-PLAN.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-02-SELF-REVIEW.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-04-SLICE-02.md`

Added:

- `apps/server/test/game-socket-transport.test.ts` — 14 focused transport tests

No lockfile change. No new runtime dependency. No persistence or migration.
No Slice 3+ behavior.

## Exact test counts (fresh)

server: 135/135 (14 test files)

- `game-auth.test.ts`: 13 tests (+4 non-string token cases)
- `game-registry.test.ts`: 7 tests (unchanged)
- `game-socket.test.ts`: 5 tests (unchanged)
- `game-socket-transport.test.ts`: 14 tests (new)

contracts: 185/185 (7 test files, unchanged)

repository: 433/433; all PASS

## Deferred

Slice 3 delivery adapter; Slice 4 registered receipt/result behavior;
Slice 5 SDK runtime; Slice 6 final exhaustion/restart/integration matrix. No
approved game-catalog port or SDK compatibility range exists, so this slice
does not invent `GAME_NOT_FOUND` or `UNSUPPORTED_SDK` policy.

No staging, commit, or push occurred.
