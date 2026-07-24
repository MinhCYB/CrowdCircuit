# Phase C — Game Vertical Slice Milestone Plan

## Status and objective

**Phase status:** IN_PROGRESS  
**Milestone 1:** DONE  
**Milestone 2:** READY_TO_START (implementation blocked pending recorded semantic decisions)  
**Milestones 3–5:** BLOCKED_BY_PREVIOUS_MILESTONE  
**Phase D:** untouched

Deliver the first durable, authenticated, end-to-end game-action vertical
slice:

`approved LIVE event → deterministic mapping → durable action record →
authenticated delivery → receipt/result → JavaScript SDK → Zombie Survival`

Phase C includes roadmap items `FOUND-03A`–`FOUND-03D`,
`FOUND-04A`–`FOUND-04D`, and `BE-05A`–`BE-09C`. The foundation items are
incorporated prerequisites, not an undefined external phase.

## Frozen phase decisions

- ADR-012 requires durable recording before the first action transport send.
- Durable action state is the source of truth for retry and reconciliation.
- In-memory repository implementations are test fakes only.
- Restart never silently loses a persisted non-terminal action and never
  automatically replays gameplay from a previous runtime.
- Authentication uses ephemeral runtime secrets, one-time pairing codes,
  opaque role-scoped sessions, loopback/origin controls, and Socket.IO
  handshake auth—not query-string tokens.
- `received` is distinct from `completed | failed`; delivery retry stops after
  receipt.
- Delivery is at-least-once with client idempotency, not exactly-once gameplay.
- The game remains authoritative for gameplay completion.
- Phase D voice functionality is excluded.

## Dependency graph

```text
M1: FOUND-03A..D + FOUND-04A..D
  ↓
M2: BE-05A..E + BE-06A..B
  ↓
M3: transport-independent durable BE-07 lifecycle core
  ↓
M4: BE-07A..D transport + BE-08A..C SDK
  ↓
M5: BE-09A..C + recovery/integration/phase acceptance
```

Hard roadmap correction:

```text
BE-07A ← FOUND-03D + FOUND-04D + BE-05E
BE-07B ← BE-07A + FOUND-04D
BE-07C ← BE-07B + FOUND-04D
BE-07D ← BE-07C + FOUND-03D + FOUND-04D
BE-08A ← BE-07D + FOUND-03D
```

## Ownership

| Milestone | Primary owner | Reason | Review owner | Escalation rule |
|---|---|---|---|---|
| 1 — Authentication and durable persistence | CODEX | Security, migrations, repositories, recovery, and lifecycle-sensitive state | Codex focused self-review; fresh Codex final reviewer at phase gate | No delegation of architecture; any unresolved security/storage decision becomes BLOCKED_DECISION |
| 2 — Mapping and action budgets | CODEX | Deterministic business rules, ordering, limits, bounded state, and action construction | Codex focused self-review | Gemini may add frozen fixtures/tests; one rework maximum, then Codex takes over |
| 3 — Durable Action Gateway lifecycle | CODEX | Persist-before-send, state machine, retry, TTL, reconciliation, and idempotency | Codex focused self-review | Substantive lifecycle/data-integrity finding stays with Codex |
| 4 — Authenticated delivery and SDK | CODEX | Socket.IO security, cross-package integration, concurrency, ACK/result semantics, and SDK idempotency | Codex focused self-review | Gemini may add frozen test fixtures/docs; one rework maximum, then Codex takes over |
| 5 — Demo game and Phase acceptance | CODEX | Full vertical-slice integration, recovery, lifecycle, and acceptance authority | Fresh independent Codex session | Gemini may implement isolated frozen game presentation or additive tests; one rework maximum |

Every milestone has exactly one primary implementation owner.

## Milestone 1 — Authentication and durable persistence prerequisites

**Status:** DONE  
**Primary owner:** CODEX

### Objective and roadmap coverage

Complete `FOUND-03A`–`FOUND-03D` and `FOUND-04A`–`FOUND-04D` as one
independently reviewable security/storage capability.

### Likely packages and files

- New `packages/auth-core` package described by System Design §21.
- `apps/server` authentication composition and persistence modules.
- SQLite/Drizzle migration and repository infrastructure.
- Root workspace/project references and lockfile.
- Focused runtime and package-name declaration consumers.

### Public API and schema impact

- Freeze provider-independent runtime-secret, pairing-code, role-session, token
  validation/revocation, clock, random-source, and repository interfaces.
- Freeze database initialization/migration and action-log repository interfaces.
- Define deterministic schema-version metadata and durable action status,
  attempt, timestamp, failure, and reconciliation data required by existing
  action contracts and System Design §§11.9, 15, and 18.
- Do not change approved LIVE, action-envelope, result, or voice wire schemas
  unless a separately reviewed contract defect makes that unavoidable.

### In scope

- CSPRNG runtime secret of at least 32 bytes, held only in memory.
- One-time role-specific pairing codes, default 60-second TTL, atomic consume,
  expiry, revocation, collision handling, and injected clock/random sources.
- Opaque in-memory role sessions, default 12-hour ceiling bounded by process
  lifetime, token fingerprinting, revocation, and restart invalidation.
- Admin same-origin/loopback bootstrap boundary and explicit development
  origins; no wildcard credentialed CORS.
- HTTP and future Socket.IO-compatible role authorization primitives.
- SQLite initialization and transactional deterministic migrations.
- Core tables from `FOUND-04B`, including game/mapping configuration and
  action logs required by Phase C.
- Action-log repository with unique action ID, pending/in-flight/terminal
  states, retry metadata, attempt history sufficient for diagnostics, and
  compare-and-transition operations.
- Transaction boundary guaranteeing durable create before a caller may send.
- Startup reconciliation of non-terminal actions to approved restart outcomes;
  no automatic cross-runtime gameplay replay.
- Repository fakes behind the identical frozen interface.
- Retention/bounded-growth policy for event/action diagnostics.
- Explicit fail-closed behavior when database initialization, migration,
  transaction, or durable write is unavailable.

### Out of scope

- Socket.IO namespace and action transport.
- Mapping evaluation, game SDK, demo game, UI, cloud authentication, accounts,
  password login, refresh tokens, Phase D voice, and production packaging.
- Persisting raw runtime tokens or the runtime secret.
- A volatile fallback for production action state.

### Runtime and failure acceptance

- Migration from an empty database is deterministic and idempotent.
- Reopening a current database performs no destructive rewrite.
- Unknown/newer schema versions fail explicitly.
- Migration failure rolls back without a partially advanced version.
- Duplicate action IDs cannot create two durable actions.
- Illegal action transitions fail atomically.
- Failed persistence prevents send authorization.
- A simulated restart invalidates sessions and reconciles every persisted
  non-terminal action without replaying it.
- Pairing reuse, expiry, wrong role, wrong client, malformed input, invalid
  origin, token leakage, and revoked/expired tokens fail conservatively.
- Concurrent pairing consumption has exactly one winner.
- Cleanup and retention are deterministic and never delete active records.

### Declaration/package acceptance

- Package-root imports resolve for auth-core and every intentionally public
  repository interface.
- Package-name declaration tests cover valid use and invalid roles, statuses,
  transition arguments, timestamps, and repository inputs.
- Emitted declarations contain package names, no source/test paths, and no
  internal verification symbols.
- Emitted JavaScript contains no secret/test fixture and has no import from
  source paths.

### Focused verification

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
git diff --check HEAD --
```

Also run migration/repository integration tests against temporary real SQLite
files and inspect emitted auth/server declarations and JavaScript.

### Required smoke evidence

Fresh database → migrate → create/consume pairing code → validate role session
→ durably create action record → simulate restart → invalidate session →
reconcile the non-terminal action. Record schema version, transition sequence,
no-send-on-write-failure evidence, and final database state.

### Completion gate

Focused CODEX self-review finds no open security, data-integrity, migration,
recovery, package, or declaration finding. Milestone handoff is complete.

## Milestone 2 — Mapping and action-budget capability

**Status:** READY_TO_START (implementation blocked pending recorded semantic decisions)  
**Primary owner:** CODEX  
**Roadmap:** `BE-05A`–`BE-05E`, `BE-06A`–`BE-06B`

### Objective

Turn an approved normalized LIVE event and frozen game profile/manifest into
zero or more deterministic, validated action candidates under rule and global
budgets.

### Packages likely to change

- `packages/mapping-engine`
- `packages/contracts` only if an independently reviewed public-contract gap is
  proven
- `apps/server` composition/repository adapters
- fixtures and declaration consumers

### In scope

- Rule model; approved operators; safe field selection; parameter templates.
- Deterministic specificity and ordering:
  priority DESC, specificity DESC, createdAt ASC, rule ID ASC.
- `all`, `first`, and `exclusive_group` match modes.
- Cooldown, per-rule/per-minute and per-user limits.
- Per-game token bucket with bounded `drop_low_priority`, `queue_with_ttl`, and
  `reject_newest` policies; no unbounded queue.
- Manifest action/parameter validation and JSON-safe output.
- Dry-run explaining matches, ordering, parameter resolution, and rejection.
- Injected clock and deterministic identifiers.

### Out of scope

- Transport, persistence-send orchestration, SDK, demo gameplay, UI forms,
  voice rules, active-game switching, and Phase D.

### Acceptance

- Gift and comment examples map correctly.
- All operators have positive, negative, wrong-type, missing-path, and hostile
  regex/input tests.
- Equal-priority results are stable across input order.
- Missing/null template values follow one documented conservative policy and
  never stringify unexpected objects.
- Invalid manifests/actions/rules fail without partial budget consumption.
- Cooldowns and limits are scoped correctly and bounded.
- Overflow never drops a received action and never grows without limit.
- Package-name declarations and built artifacts expose only frozen interfaces.

### Focused verification and smoke

Run mapping-engine lint/typecheck/test/build/declarations plus affected
server/contracts checks. Smoke one gift and one comment through the Phase B
gateway into mapping dry-run and accepted action candidates, recording
deterministic order, budget state, and rejection explanations.

### Completion gate

Focused CODEX review approves rule semantics, ordering, parameter safety,
budgets, bounded state, declarations, and Phase B regressions.

## Milestone 3 — Durable Action Gateway lifecycle

**Status:** BLOCKED_BY_PREVIOUS_MILESTONE  
**Primary owner:** CODEX  
**Roadmap:** transport-independent core of `BE-07B`–`BE-07D`

### Objective

Implement the durable action state machine and transport-neutral delivery
orchestration before introducing Socket.IO.

### Packages likely to change

- `apps/server` action service/repository composition
- `packages/mapping-engine` frozen action candidates
- `packages/contracts`
- deterministic repository/transport fakes in tests

### In scope

- CREATED → SENT → RECEIVED → COMPLETED/FAILED plus EXPIRED,
  DELIVERY_FAILED, delivery-unknown/restart outcomes.
- Transactional durable create before first send authorization.
- Attempt recording, same-action-ID retries, default receipt timeout, maximum
  two retries, TTL, and completion diagnostics.
- Retry stops after receipt; failed gameplay result is not automatically
  replayed.
- Idempotent duplicate receipt/result handling.
- Restart reconciliation uses durable records and never silently drops or
  auto-replays prior-runtime gameplay.
- Persistence and transport failures remain distinguishable.

### Out of scope

- Socket.IO, real game sessions, SDK, demo game, UI, Phase D, and active-game
  switching.

### Acceptance

- No transport fake observes first send before durable commit.
- Commit failure produces zero sends.
- Crash points around create/send/receipt reconcile deterministically.
- Duplicate callbacks and late/out-of-order results cannot regress terminal
  state.
- Timers use injected clocks; pending work and retention are bounded.
- Real SQLite integration and same-interface in-memory fake produce the same
  state semantics.
- Package/declaration and emitted-artifact checks pass.

### Focused verification and smoke

Run server, contracts, persistence, and mapping checks. Use a deterministic
transport fake to prove persist → send → retry → receipt → completion and
persist → simulated restart → reconciliation, including exact durable rows and
attempt history.

### Completion gate

Focused CODEX review approves persistence ordering, state transitions,
idempotency, retry/TTL, reconciliation, failure isolation, and artifacts.

## Milestone 4 — Authenticated game-session delivery and SDK vertical slice

**Status:** BLOCKED_BY_PREVIOUS_MILESTONE  
**Primary owner:** CODEX  
**Roadmap:** `BE-07A`–`BE-07D`, `BE-08A`–`BE-08C`

### Objective

Connect the durable Action Gateway to authenticated Socket.IO game sessions and
the JavaScript SDK without changing the lifecycle semantics proven in
Milestone 3.

### Packages likely to change

- `apps/server`
- `packages/auth-core`
- `packages/game-sdk-js`
- `packages/contracts`
- integration fixtures

### In scope

- `/game` namespace, explicit origin policy, handshake token in auth field,
  game-role enforcement, registration and heartbeat.
- Manifest/game/instance association and one active session policy as specified.
- `game.action`, `game.action.received`, and discriminated result messages.
- SDK connection/registration, validation, handler dispatch, immediate receipt
  after local enqueue, completion/failure reporting, heartbeat, debug/test mode.
- SDK bounded LRU action IDs: duplicates do not rerun gameplay but repeat
  receipt ACK.
- Reconnect uses current-runtime credentials; expired/restarted sessions
  require approved re-pair behavior.

### Out of scope

- Demo visuals/gameplay, dashboard UI, active-game switching, voice, remote
  exposure, query-string tokens, and exactly-once claims.

### Acceptance

- Wrong role, expired/revoked token, invalid origin, malformed registration,
  incompatible SDK, duplicate instance, missing heartbeat, malformed action,
  and spoofed result are rejected.
- Credentials never enter query strings, logs, persisted rows, or errors.
- Delivery uses the Milestone 3 durable record; receipt stops retry.
- Duplicate delivery invokes the SDK handler once and receipt more than once.
- Long gameplay completion does not trigger delivery retry after receipt.
- Disconnect/reconnect, cleanup, listener isolation, and bounded SDK state are
  deterministic.
- Root package declarations and JavaScript export only intended SDK APIs.

### Focused verification and smoke

Run auth-core, server, contracts, and game-sdk-js
lint/typecheck/test/build/declarations. Use a real local Socket.IO server/client
test to prove pair → authenticate → register → durable action → delivery →
receipt → completion, plus reconnect duplicate suppression and secret-leak
inspection.

### Completion gate

Focused CODEX review approves transport security, durable state coupling,
ordering, cleanup, SDK idempotency, wire alignment, declarations, and dist.

## Milestone 5 — Demo game, recovery, and Phase C acceptance

**Status:** BLOCKED_BY_PREVIOUS_MILESTONE  
**Primary owner:** CODEX  
**Roadmap:** `BE-09A`–`BE-09C` and Phase C acceptance

### Objective

Deliver and independently validate the first playable Zombie Survival vertical
slice without introducing Phase D functionality.

### Packages likely to change

- `games/zombie-survival`
- `packages/game-sdk-js`
- `packages/mapping-engine`
- `apps/server`
- approved fixture/configuration files

### In scope

- Phaser game shell and manifest.
- Frozen `SPAWN_ZOMBIE`, `SPAWN_BOSS`, and approved comment/team action handlers
  required by the design examples.
- Rose mock → normalized gift → deterministic mapping → durable action →
  authenticated SDK delivery → receipt → visible game behavior → completion.
- Comment `team đỏ` → join-red-team path where supported by the approved
  manifest.
- Restart/reconciliation, reconnect idempotency, TTL, retry, persistence
  unavailable, burst/budget, malformed input, and cleanup acceptance.
- Full documentation reconciliation and fresh independent phase review.

### Out of scope

- Phase D voice/TTS/audio, production dashboard pages, game switching from
  Phase E, cloud deployment, monetization, and additional gameplay.

### Acceptance

- Playable smoke produces observable deterministic game state.
- Persisted-before-send evidence is correlated to the delivered action ID.
- A received action is never replayed because completion is slow.
- Reconnect duplicates do not double-apply gameplay.
- Restart marks old non-terminal actions per recovery policy and does not
  silently lose or replay them.
- Invalid manifest/action/auth/persistence inputs fail without partial gameplay.
- Build artifacts are clean and dependency direction remains acyclic.

### Focused verification and smoke

Run all affected package checks, then full repository lint/typecheck/test/build,
all declaration consumers, migration/recovery integration tests, emitted
JavaScript/declaration inspection, and one documented end-to-end smoke with
durable row, transport sequence, SDK callbacks, and final game state.

### Completion gate

Create milestone handoff and self-review, then use a fresh Codex session for
independent final Phase C acceptance. Only APPROVE marks Phase C DONE and
authorizes the preferred single Phase C commit.

## Review and working-tree workflow

For a CODEX-owned milestone:

```text
CODEX implementation
→ focused self-review
→ focused verification
→ milestone handoff
→ continue when acceptance is satisfied
```

For any frozen subtask assigned to Gemini:

```text
Codex frozen implementation prompt
→ Gemini implementation
→ Codex focused review
→ at most one Gemini rework
→ Codex takeover if substantive findings remain
```

Across Phase C:

- Use one accumulated uncommitted working tree.
- Do not commit at routine milestone boundaries.
- Create milestone handoffs and focused review reports.
- Run full repository verification when materially useful and at phase end.
- Use a fresh Codex session for independent final acceptance.
- Prefer one final Phase C commit after approval. No intermediate rollback
  checkpoint is currently justified.

## Phase C completion checklist

- [x] `FOUND-03A`–`FOUND-03D` and `FOUND-04A`–`FOUND-04D` are accepted.
- [ ] `BE-05A`–`BE-09C` are accepted.
- [ ] Complete event-to-playable-game vertical slice passes.
- [ ] Durable action commit precedes every first transport send.
- [ ] Retry and reconciliation use the durable record.
- [ ] Restart preserves diagnostic truth without automatic gameplay replay.
- [ ] Runtime secrets/tokens are ephemeral, role-scoped, masked, and never
  persisted or logged.
- [ ] Public APIs and wire contracts remain stable and runtime-aligned.
- [ ] Negative, malformed, timeout, concurrency, persistence-unavailable,
  unauthorized, disconnect, retry, and recovery paths pass.
- [ ] Lifecycle cleanup and bounded caches/queues/retention pass.
- [ ] Tests use injected time/random/transport/storage where applicable.
- [ ] Package-name declaration consumers pass for every public package.
- [ ] Emitted JavaScript/declarations contain no source/test/absolute-path leak.
- [ ] Dependency direction is acyclic and package exports are intentional.
- [ ] No Phase D functionality exists.
- [ ] End-to-end evidence includes durable row, action ID, transport attempts,
  receipt, result, SDK idempotency, and final game state.
- [ ] Execution docs, decisions, known issues, handoffs, and roadmap match Git.
- [ ] Final `git diff --check`, full verification, and Git inventory pass.
- [ ] Fresh independent Phase C review returns APPROVE.
