# Phase C Milestone 1 — Codex Self-Review

**Date:** 2026-07-24  
**Baseline:** `86f1a32`  
**Review target:** complete accumulated working-tree diff  
**Verdict:** APPROVE FOR INDEPENDENT FOCUSED REVIEW

## Scope reviewed

- `FOUND-03A` through `FOUND-03D`
- `FOUND-04A` through `FOUND-04D`
- New `@crowdcircuit/auth-core` package
- Server authentication composition
- SQLite/Drizzle schema version 1, migrations, repositories, retention, and
  restart reconciliation
- Package-name declarations and emitted JavaScript/declarations

Milestone 2 mapping/budget behavior, Socket.IO, SDK behavior, demo gameplay,
and Phase D voice behavior are absent.

## Security review

- Runtime secrets use the platform CSPRNG by default, require at least 32
  bytes, remain private in memory, and support explicit zeroing/disposal.
- Pairing codes are role/client-bound, one-time, expiring, revocable, and
  collision-checked. Admin is not a pairable role.
- Opaque role sessions are bounded to 12 hours and process lifetime, support
  role/client checks and revocation, and expose only an eight-character
  fingerprint for diagnostics.
- Origins require an explicit allowlist, except explicitly enabled no-origin
  loopback calls. Wildcards are rejected.
- Query-string credentials are rejected. Public failures do not include raw
  secrets, pairing codes, or session tokens.
- Clock and random sources are injectable and validated.

## Data-integrity review

- Schema version 1 is ordered, transactional, idempotent on reopen, and
  rejects newer unsupported versions.
- A migration failure rolls back the failing version without advancing schema
  metadata or removing an earlier committed version.
- Action IDs and idempotency keys are unique.
- `createBeforeFirstSend` commits the pending row before returning a
  `SendAuthorization`; write/open failure returns no authorization.
- Retry authorization is derived from the current durable action version.
- Attempts and action state advance in one transaction.
- Lifecycle transitions use expected version and expected status and reject
  stale or illegal changes.
- Stored parameters, result details, configuration, and event diagnostics use
  the approved JSON-safe runtime boundary.
- Cleanup is deterministic, bounded, and does not delete pending, in-flight,
  or received actions.
- Restart reconciliation marks every previous-runtime nonterminal record as
  expired, aborted-before-send, or delivery-unknown. It never sends or replays.
- The real SQLite implementation and deterministic test fake pass the same
  create/attempt/transition/reconciliation behavior suite.

## Verification

Focused:

- auth-core lint — PASS
- auth-core typecheck — PASS
- auth-core tests — PASS, 8 tests
- auth-core build — PASS
- auth-core declaration checks — PASS
- server lint — PASS
- server typecheck — PASS
- server tests — PASS, 19 tests
- server build — PASS
- server declaration checks — PASS

Repository:

- `pnpm lint` — PASS
- `pnpm typecheck` — PASS
- `pnpm test` — PASS, 262 tests across 18 files
- `pnpm build` — PASS
- `git diff --check HEAD --` — PASS

The prompt's literal Unix prefix `CI=true pnpm ...` is not valid PowerShell.
Using `$env:CI='true'` caused pnpm itself to refresh the local dependency tree
in this managed Windows environment and was stopped after it stalled. The
workspace was repaired with a frozen-lockfile install and the identical
lint/typecheck/test/build scripts passed without changing application
semantics.

## Artifact inspection

- Auth and server root package imports resolve from built output.
- Public declarations contain the intended roles, statuses, timestamps,
  JSON-safe values, repository inputs, and transition constraints.
- No test/source paths, absolute workspace paths, raw credentials, test
  secrets, verification symbols, or database files appear in emitted output.
- No `any`, `z.any()`, or unsafe production assertion was introduced.
- Drizzle is a server dependency; `@crowdcircuit/auth-core` and contracts are
  explicit workspace dependencies.

## Findings

No open Critical, High, Medium, or Low implementation finding.

Milestone 1 remains `READY_FOR_FOCUSED_REVIEW`, not `DONE`. Milestone 2 remains
blocked until an independent focused review approves this working tree.
