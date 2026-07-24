# Handoff — Phase C Milestone 1

**Generated:** 2026-07-24  
**Baseline HEAD:** `86f1a32`  
**State:** uncommitted accumulated working tree  
**Milestone status:** READY_FOR_FOCUSED_REVIEW

## Delivered capability

### Authentication

- New `@crowdcircuit/auth-core` package.
- CSPRNG runtime secret, minimum 32 bytes, explicit disposal.
- One-time `game | voice-output` pairing codes with role/client binding,
  default 60-second TTL, expiry, revocation, collision handling, and atomic
  synchronous consume.
- Opaque `admin | game | voice-output` sessions with default 12-hour ceiling,
  role/client validation, expiry, per-token/client revocation, restart
  invalidation, and safe eight-character fingerprints.
- Explicit origin allowlist and loopback policy.
- Reusable HTTP/future-Socket.IO authorization primitive that rejects
  query-string credentials.
- Deterministic clock/random seams and typed, non-secret-bearing errors.

### Persistence

- Node.js `node:sqlite` runtime with Drizzle schema/configuration.
- Deterministic schema version 1 and ordered transactional migrations.
- Configuration tables for app settings, connectors, manifests, game profiles,
  and mappings.
- Bounded event diagnostics plus durable action and attempt tables.
- Package-visible repository interfaces for configuration, event diagnostics,
  durable actions, transitions, retention, migration, and reconciliation.
- JSON-safe validation for all JSON columns.

### Durable action and recovery semantics

- `createBeforeFirstSend` returns send authorization only after commit.
- Persistence failure is fail-closed; no volatile production fallback exists.
- Action states: pending, in-flight, received, completed, failed, expired,
  delivery-failed, delivery-unknown-restart, and aborted-restart.
- Unique action and idempotency keys, optimistic version checks, legal
  transitions, durable retry attempt ordering, result/failure metadata.
- Restart reads durable nonterminal state and classifies it without blind
  replay. Repeated reconciliation is idempotent.
- Retention removes only terminal action rows and bounded event history.

## Smoke evidence

The focused integration smoke performs:

`temporary SQLite → migrate v1 → runtime secret → one-time game pairing →
role session → durable action creation → runtime disposal/session invalidation
→ reopen database → reconcile old pending action as aborted_restart → verify
zero attempts/replays → clean shutdown`

The persistence-failure test confirms repository initialization failure yields
no send authorization. Migration tests cover fresh start, reopen, rollback,
newer version rejection, and corrupted stored JSON.

## Verification

- Node.js v24.15.0
- pnpm 11.9.0
- auth-core: 8 tests, declaration checks pass
- server: 19 tests, declaration checks pass
- repository: 262 tests across 18 files
- repository lint/typecheck/build: pass
- `git diff --check HEAD --`: pass

Emitted auth/server JavaScript and declarations were inspected. They contain no
raw secret/token fixture, database artifact, test/source path, absolute
workspace path, or internal fake.

## Dependency evidence

Official Drizzle documentation identifies `node:sqlite` support in the current
Drizzle release-candidate line. Node.js v24.15.0 documents `node:sqlite` as a
release-candidate API. The server therefore uses the maintained platform
driver rather than adding a third-party native SQLite addon.

## Deferred by scope

- Mapping rules and budgets
- Action Gateway transport/retry timers
- Socket.IO game namespace
- JavaScript SDK behavior
- Demo gameplay
- Phase D voice behavior and voice persistence

## Review instruction

Review the complete working-tree diff against `86f1a32`. Do not require a
commit. Verify real SQLite files, declaration consumers, emitted artifacts,
failure-before-authorization, restart classification, and absence of Milestone
2 behavior.

Git status in this handoff describes the repository at handoff-generation time
and must be refreshed by the reviewer.
