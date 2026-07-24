# PHASE-C-MILESTONE-01 — CODEX Implementation Prompt

## Role and objective

You are the primary implementation owner for Phase C Milestone 1:
Authentication and Durable Persistence Prerequisites.

Implement `FOUND-03A`–`FOUND-03D` and `FOUND-04A`–`FOUND-04D` as one coherent,
independently reviewable capability. Do not implement mapping, Action Gateway
transport, SDK behavior, demo gameplay, or Phase D.

Work in the accumulated uncommitted Phase C working tree. Do not commit or
push.

## Reading order

1. `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md`
2. ADR-012 in `docs/execution/DECISIONS.md`
3. `docs/execution/CURRENT_TASK.md`
4. `docs/execution/PROJECT_STATUS.md`
5. Phase C and deferred-foundation rows in `docs/execution/ROADMAP.md`
6. System Design §§8.4, 10, 11.6, 11.7, 11.9, 13 authentication, 14 game
   handshake, 15 storage, 18 lifecycle/recovery/CORS/error handling, 19 tests,
   21 repository structure, and 22 technology
7. `docs/execution/KNOWN_ISSUES.md`
8. `apps/server`, `packages/contracts`, `packages/shared`, workspace configs,
   package exports, and current tests

## Preflight

Run and record:

```text
git status
git rev-parse --short HEAD
git log -5 --oneline
node --version
pnpm --version
pnpm --filter @crowdcircuit/server test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Stop if the Phase B baseline is dirty unexpectedly, execution documents do not
match Git, or a dependency/tool choice would materially change the approved
architecture.

Before adding SQLite/Drizzle packages, verify current official compatibility
with Node.js v24 and this TypeScript/ESM workspace. Use primary documentation.
Do not guess package APIs or versions. If no maintained Drizzle-supported local
SQLite driver fits the repository constraints, return BLOCKED_DECISION.

## Allowed paths

- `packages/auth-core/**` (new package approved by System Design §21)
- `apps/server/src/auth/**`
- `apps/server/src/persistence/**`
- `apps/server/src/**` only for minimal composition/export changes
- `apps/server/test/**`
- `apps/server/package.json`
- root `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, and workspace config
  only as required for the new package/dependencies/project references
- focused migration files under an explicit server-owned migration directory
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-01.md`
- `docs/orchestration/reviews/PHASE-C-MILESTONE-01-CODEX-SELF-REVIEW.md`
- current execution documents only for accurate milestone status

Do not modify Phase B production behavior or approved public LIVE/action/voice
contracts.

## Required authentication implementation

- Create `@crowdcircuit/auth-core` with real lint, typecheck, test, build, and
  package-name declaration scripts.
- Runtime secret:
  - CSPRNG, minimum 32 bytes;
  - in memory only;
  - injectable random source for tests;
  - explicit disposal/reference clearing;
  - never included in logs/errors/persistence.
- Pairing codes:
  - role-specific `game | voice-output` codes;
  - default 60-second TTL;
  - sufficient entropy;
  - atomic single use;
  - expiry and revocation;
  - client binding where the approved request supplies client ID;
  - deterministic clock/random injection.
- Sessions:
  - opaque random role tokens held in an in-memory registry;
  - default 12-hour maximum bounded by runtime lifetime;
  - role/client validation, expiry, individual/all-client revocation;
  - safe eight-character fingerprint for diagnostics only;
  - no cross-role use and no raw-token logging.
- Server boundary:
  - loopback-only default;
  - explicit production same-origin and development-origin allowlist;
  - no wildcard credentialed CORS;
  - reusable HTTP and future Socket.IO authorization primitives;
  - token input designed for handshake auth fields, never query strings.
- Add focused HTTP pairing/session tests only where the approved server API
  requires them. Do not create Socket.IO transport yet.

## Required persistence implementation

- SQLite plus Drizzle foundation owned by the server runtime.
- Deterministic transactional migrations with an explicit schema version.
- Empty-database initialization, idempotent reopen, rollback on failure, and
  rejection of unsupported newer schema versions.
- Implement the core tables assigned by `FOUND-04B`, using JSON columns only
  with validated/JSON-safe boundaries.
- Freeze repository interfaces for:
  - configuration tables required by Phase C;
  - bounded event/action diagnostics;
  - durable action log and attempt history.
- Durable action data must support:
  - unique action ID and idempotent lookup;
  - event, mapping, game, status, priority, TTL, timestamps;
  - pending/in-flight/terminal states needed by the approved state machine;
  - retry count and attempt history;
  - receipt, result, expiry, failure, and reconciliation metadata;
  - atomic compare-and-transition behavior.
- Provide a transaction/repository operation that commits action creation
  before returning authorization for first send.
- Persistence failure must fail closed. There is no volatile fallback.
- Startup reconciliation:
  - inspect every non-terminal durable action;
  - mark the approved restart diagnostic outcome based on last durable state;
  - never auto-replay gameplay from a previous runtime;
  - preserve enough history for diagnostics.
- Add deterministic retention/cleanup for rolling event/action records. Never
  delete active records.
- Implement in-memory fakes only in tests, behind exactly the same frozen
  repository interfaces and semantics.
- Use temporary real SQLite files for migration, transaction, concurrency, and
  restart integration tests. Do not write test databases into the repository.

## Contract invariants

- ADR-012 is mandatory: no caller may perform a first send before durable
  action creation commits.
- Durable records are the source of truth for retry and reconciliation.
- Runtime secrets and raw tokens are never durable.
- Approved `@crowdcircuit/contracts` wire schemas remain unchanged.
- No `any`, `z.any()`, unsafe assertion, unchecked JSON cast, or native error
  leakage across public boundaries.
- Public input/output types and runtime validation align.
- Fixed-shape inputs reject extra properties where applicable.
- Timestamps, TTLs, counters, schema versions, and limits are finite and
  correctly integer/positive/nonnegative as designed.
- Secrets, tokens, pairing codes, and credentials are redacted from errors and
  logs.

## Required tests

### Authentication positive

- secret entropy/length and deterministic injected source;
- create, consume, validate, revoke, expire pairing code;
- issue and validate role/client session;
- fingerprint stability without raw-token disclosure;
- explicit allowed loopback/same-origin/dev origin.

### Authentication negative and concurrency

- wrong role/client, expired/reused/revoked code;
- concurrent code consume has exactly one winner;
- expired/revoked/wrong-role token;
- token in query input rejected by the intended boundary;
- wildcard/unlisted/null origin rejected unless explicitly approved;
- invalid clock/random output and collisions fail conservatively;
- logs/errors contain no secret, code, or raw token.

### Persistence and migration

- new database migrates to exact current version;
- reopen is idempotent;
- migration rollback leaves prior version/data intact;
- unsupported newer version fails;
- unique action ID and idempotent lookup;
- legal transitions commit atomically;
- illegal/stale transitions fail with no partial mutation;
- attempt history and retry metadata remain ordered;
- persistence unavailable or commit failure yields no send authorization;
- concurrent create/transition behavior is deterministic;
- JSON-invalid/nonfinite/undefined/class/function/symbol/BigInt input rejected;
- retention is bounded and preserves active records;
- restart reconciliation covers every non-terminal state and never replays.

### Interface parity

Run the same repository behavior suite against the real SQLite repository and
test fake. Differences in state semantics are failures.

### Declaration tests

Using package-name imports, prove intended auth/repository APIs compile and
invalid roles, statuses, transitions, timestamps, schema versions, and input
shapes fail. Verify no internal migration/test/fake symbols leak from package
roots unless explicitly designed as public test utilities.

## Required smoke

Record exact evidence for:

```text
fresh temporary database
→ migrations
→ runtime secret
→ one-time game pairing
→ role-session validation
→ durable action creation
→ simulated persistence failure proving no send authorization
→ simulated restart
→ old session invalidation
→ non-terminal action reconciliation
→ clean shutdown
```

Report schema version, rows before/after restart, transition history, cleanup,
and secret-leak scan.

## Forbidden scope

- Mapping rules or budgets (`BE-05`, `BE-06`)
- Socket.IO/game transport (`BE-07`)
- SDK implementation (`BE-08`)
- Phaser/demo gameplay (`BE-09`)
- Active-game switching
- Dashboard UI
- Voice/TTS/Phase D
- Cloud auth, accounts, passwords, refresh tokens
- Production in-memory action journal
- Commit or push

## Verification

Run all new package/server checks:

```text
pnpm --filter @crowdcircuit/auth-core lint
pnpm --filter @crowdcircuit/auth-core typecheck
pnpm --filter @crowdcircuit/auth-core test
pnpm --filter @crowdcircuit/auth-core build
pnpm --filter @crowdcircuit/auth-core test:declarations

pnpm --filter @crowdcircuit/server lint
pnpm --filter @crowdcircuit/server typecheck
pnpm --filter @crowdcircuit/server test
pnpm --filter @crowdcircuit/server build
```

Run affected contracts/shared checks if changed, migration/recovery integration
tests, then:

```text
CI=true pnpm lint
CI=true pnpm typecheck
CI=true pnpm test
CI=true pnpm build
git diff --check HEAD --
git status
```

Inspect emitted JavaScript/declarations and the dependency graph. Confirm no
source/test path, secret, database file, migration scratch file, or Phase D
artifact entered dist.

## Documentation and handoff

Create:

- `docs/orchestration/reviews/PHASE-C-MILESTONE-01-CODEX-SELF-REVIEW.md`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-01.md`

Update current execution documents to Milestone 1 complete only after every
acceptance gate passes. Keep Milestone 2 blocked until the focused self-review
approves Milestone 1. Record exact commands, test counts, migration version,
runtime versions, changed files, known limitations, and Git evidence.

## Final response

Return:

1. Authentication architecture and security invariants
2. Persistence schema, migration, and repository design
3. Persist-before-send enforcement point
4. Recovery/reconciliation behavior
5. Files changed
6. Runtime, migration, declaration, and failure tests
7. Focused verification results
8. Repository verification results
9. Artifact/dependency inspection
10. Smoke evidence
11. Self-review verdict
12. Handoff paths
13. Final Git status

Do not commit or push.
