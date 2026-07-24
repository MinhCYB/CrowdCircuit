# Phase C Milestone 1 Independent Review

Date: 2026-07-24  
Baseline: `86f1a32` (`feat: complete Phase B event pipeline`)  
Scope: complete accumulated Phase C Milestone 1 working tree  
Verdict: **REQUEST CHANGES**

## 1. Repository and working-tree evidence

The review covered the tracked diff and every untracked implementation, test, plan, handoff, and self-review file present before verification. The tracked diff against `86f1a32` contains 8 files, 475 insertions, and 114 deletions. The implementation adds `@crowdcircuit/auth-core`, server authentication routes, SQLite migrations and repositories, focused tests, and the Milestone 1 documentation set.

Fresh repository evidence:

- `git rev-parse --short HEAD`: `86f1a32`
- recent history begins `86f1a32`, `8c3f2e4`, `85a7d3b`, `76d7013`, `c4c3dae`
- Node.js: `v24.15.0`
- pnpm: `11.9.0`
- `git diff --check HEAD --`: pass, with only Git's LF-to-CRLF working-copy warnings
- no commit or push was performed
- no Milestone 2 implementation was found

The package installation needed for fresh verification created `.pnpm-store/` in the repository. Cleanup was attempted, but the pnpm SQLite index remained locked by the package manager. It is a reviewer-generated verification artifact, not part of the reviewed implementation.

## 2. Findings grouped by severity

### Critical

#### C1. `SendAuthorization` is publicly forgeable and duplicate creates can authorize multiple sends

`SendAuthorization` is an exported structural interface (`apps/server/src/persistence/types.ts:46`) and `recordAttempt` trusts its public fields. An independent SQLite probe constructed a plain object containing an existing action ID, durable version, and runtime ID; the repository accepted it and recorded an attempt.

The same probe called `createBeforeFirstSend` twice for the same action and idempotency key. The second call returned `created: false` **and another current authorization**. Both returned authorizations were then usable in sequence to create two attempts. Database uniqueness prevents a second action row, but it does not enforce the primary ADR-012 first-send authorization invariant.

This means callers can manufacture authorization or replay the duplicate-create path to obtain additional valid send opportunities. The acceptance requirements explicitly prohibit both behaviors.

Required remediation:

- make authorization an unforgeable capability whose construction is private to the durable repository;
- never return first-send authorization from a duplicate create;
- permanently test structural forgery, duplicate create replay, two-repository contention, pre/during/post-commit failure, and authorization consumption against SQLite.

### High

#### H1. Restart reconciliation is not atomic and can leave a partially reconciled batch

`reconcilePreviousRuntime` (`apps/server/src/persistence/repository.ts:581`) loads the batch and transitions records one at a time through independent transactions. An injected SQLite trigger made the second transition fail. The first action remained durably changed to `aborted_restart`, while the second remained `pending`; the method then leaked the raw SQLite error `"injected"`.

This violates the required no-partial-batch recovery boundary and leaves restart state dependent on record order and failure position.

Required remediation: perform selection, validation, all reconciliation transitions, and their durable evidence in one explicit transaction, map database failures to the typed persistence error, and add a permanent multi-record failure-injection test.

#### H2. Query-string credentials are not rejected and are logged verbatim

The auth-core helper rejects a `queryToken` only if its caller supplies that field, but the HTTP integration never inspects the request query. An independent request to:

`/api/v1/auth/admin-session?token=query-secret-must-not-log`

returned `200`. Fastify's request log contained the full URL and the supplied secret text. Thus the transport boundary accepts/ignores query credentials instead of rejecting them and leaks them into logs.

Required remediation: reject credential-like query parameters at the HTTP boundary before session creation and ensure request logging redacts query strings or credential fields. Add HTTP tests that inspect both response and captured logs.

#### H3. Invalid binding attempts consume valid pairing codes

`PairingCodeRegistry.consume` deletes the code (`packages/auth-core/src/index.ts:158`) before checking revocation, expiry, role, or client binding. An independent probe attempted the wrong role and then the correct binding; the correct redemption failed because the first request had destroyed the code.

This contradicts the explicit review requirement and permits a client that learns a code to deny the intended client its one valid redemption.

Required remediation: validate state and binding before atomically consuming the code. Preserve one-winner behavior for true concurrent valid redemption and permanently test wrong-role/wrong-client followed by valid redemption.

### Medium

#### M1. Migration metadata gaps and corruption are accepted

Migration initialization reads only `MAX(version)` (`apps/server/src/persistence/migrations.ts:81`). A database containing `schema_versions` rows 1 and 3 was accepted as current version 3 rather than rejected for missing version 2. The code therefore does not prove that applied versions are contiguous, unique as a complete ordered history, or associated with stable migration identity beyond an integer.

The independent failing-migration probe did confirm that successful DDL followed by failing DDL within one migration rolls back both schema and version metadata. That positive result does not cover corrupted existing metadata.

Required remediation: read and validate the complete version history, reject gaps/corruption explicitly, and add permanent gap, unknown-newer, reordered/identity, and concurrent-startup tests.

#### M2. Replayed admin bootstrap creates duplicate sessions

Two identical valid `GET /api/v1/auth/admin-session` requests returned different session fingerprints. The endpoint creates a fresh session on every replay and has no idempotency or replacement rule. This violates the explicit requirement that replayed requests not create duplicate sessions.

The use of `GET` for a state-creating endpoint also makes accidental replay more likely.

Required remediation: define and enforce idempotent bootstrap semantics, use an appropriate state-changing HTTP method, and test replay behavior.

#### M3. Pairing/session registries have no deterministic cleanup or bounded-growth policy

Expired records are rejected on lookup, but neither `PairingCodeRegistry` nor `RoleSessionRegistry` exposes deterministic cleanup or a capacity bound. Unredeemed expired codes and sessions that are never looked up can remain reachable for process lifetime. This fails the explicit lifecycle and bounded-growth acceptance criteria.

Required remediation: add deterministic injected-clock cleanup, configurable capacity/retention behavior, restart/reset tests, and cleanup tests for entries never looked up.

#### M4. Retention cleanup is not atomic

Action and event retention each use multiple independent delete statements (`apps/server/src/persistence/repository.ts:618` and following). A failure between age-based deletion and overflow deletion leaves a partially applied cleanup policy. Action attempts do cascade with deleted terminal actions, and nonterminal actions are excluded, but the cleanup transaction claim is not satisfied.

Required remediation: execute each logical cleanup policy in a transaction and permanently inject a failure between statements.

#### M5. The in-memory fake does not have production parity

The fake exists only in `apps/server/test/persistence.test.ts`. It exposes mutable test-only collections, omits production validation, implements cleanup as a no-op, and uses reconciliation evidence different from SQLite. The shared behavior suite covers only a subset of creation, attempts, transitions, and simple reconciliation; it does not establish cleanup, validation, failure, concurrency, or full recovery parity.

Required remediation: either remove the parity claim or provide a controlled test implementation that obeys the same semantics and run the same comprehensive behavior suite against fake and SQLite.

#### M6. Permanent tests and declaration consumers are materially narrower than the acceptance claims

Examples:

- auth HTTP tests do not cover forwarding-header bypasses, mapped IPv6, query credentials/log leakage, or bootstrap replay;
- pairing tests do not prove that a wrong binding preserves a valid code;
- the pairing “concurrency” test schedules synchronous operations through promises rather than racing independent requests;
- persistence tests do not exercise separate repository instances contending for one idempotency key;
- failure injection does not cover before, during, and after commit;
- reconciliation failure does not test batch atomicity;
- declaration tests cover basic roles/inputs but not authorization forgery, transitions, stale authorization, reconciliation results, session lifecycle, or pairing operations.

Required remediation: add permanent negative and integration evidence for the acceptance claims, with critical invariants exercised against real SQLite.

#### M7. A test artifact remains in the distributable `dist` tree

`apps/server/dist/index.test.js` and its declaration/maps are present. The current `src`-only TypeScript configuration did not freshly emit them, but builds do not clean `dist`, and the package's `files: ["dist"]` convention would include stale test artifacts. This fails the explicit emitted-artifact check.

Required remediation: clean output before build/package and add a package-content assertion.

## 3. Authentication and pairing assessment

Positive evidence:

- runtime secrets and credentials use Node's cryptographically secure random source;
- default secret/session entropy is 32 bytes; pairing codes use 18 random bytes encoded base64url;
- secret buffers are cloned and the retained runtime-secret buffer is zeroed on disposal;
- token fingerprints are one-way SHA-256-derived diagnostic values and are not accepted as credentials;
- admin, game, and voice-output roles are distinct and normal role/client/expiry/revocation checks work;
- sessions are accurately documented as process-scoped; restart creates an empty store;
- clocks and random sources are injectable;
- no production `any`, `z.any()`, unsafe assertion, or hard-coded operational secret was found.

Acceptance is nevertheless blocked by H3 and M3. Disposal can only zero the registry's retained byte buffer; JavaScript strings returned to callers cannot be erased, which is a reasonable documented language limitation. Direct `Map` token lookup is not constant-time, although high-entropy opaque tokens reduce practical exposure; the more urgent defects are transport leakage and forgeable persistence authorization.

## 4. HTTP and origin security assessment

Independent probes confirmed:

- a remote address with loopback `Host`, `X-Forwarded-For`, and `Forwarded` values received `403`;
- Fastify does not trust proxy headers by default;
- IPv4-mapped loopback `::ffff:127.0.0.1` is intentionally accepted;
- configured origins use an explicit allowlist;
- admin cookie transport is `HttpOnly` and `SameSite=Strict`;
- ordinary error bodies did not disclose generated credentials.

The boundary is not acceptable because query credentials are accepted/ignored and logged (H2), and bootstrap replay creates distinct sessions (M2). Future Socket.IO code could call `authorizeSession`, but origin enforcement remains a separate call and is not structurally inseparable from authorization; integration must ensure both checks cannot be bypassed.

Deployment behind a trusted reverse proxy is currently unsupported, which is safer than inferring trust, but that operational limitation should remain explicit.

## 5. SQLite and migration assessment

Positive evidence:

- production repository opening does not silently fall back to memory;
- `PRAGMA foreign_keys = ON` is set on the repository connection;
- migration application uses `BEGIN IMMEDIATE`, records the version before commit, rolls back on failure, and is idempotent in the ordinary contiguous case;
- an injected failing migration after a successful DDL statement left neither the new table nor its version row;
- unknown versions greater than the known migration list are rejected;
- `node:sqlite` use is largely behind repository interfaces.

Material deficiencies:

- complete stored migration history is not validated (M1);
- concurrent startup migration behavior lacks evidence;
- busy timeout and journal-mode policy are not explicit;
- schema identity has no checksum/name to detect changed or reordered SQL at an existing version;
- supported engines say Node `>=20`, while the chosen `node:sqlite` dependency needs a clearly supported runtime floor;
- failure mapping during reconciliation is incomplete.

## 6. Repository and transition assessment

The real SQLite repository enforces action IDs and idempotency keys at the database layer. Normal input parsing preserves JSON safety and safe integer timestamps. Legal transition and stale-version checks work, attempt numbers are monotonic, attempt insertion and version advancement are transactional, terminal actions cannot return to nonterminal status, and attempts have an intentional `ON DELETE CASCADE` relationship.

However, status/outcome domains are not protected with database `CHECK` constraints, some diagnostic/error fields are unbounded, and there is no real separate-connection contention test. Most importantly, the structural authorization defect C1 means otherwise valid transition machinery does not secure the send boundary.

No actual transport send was added in Milestone 1.

## 7. Persist-before-send and retry assessment

The initial insert transaction does commit before `createBeforeFirstSend` returns, and an injected open failure returns no authorization. A consumed authorization becomes stale after its successful attempt updates the durable version.

Those positives are insufficient. C1 proves that:

- authorization is a forgeable data shape, not a capability;
- a duplicate create returns a new usable authorization;
- the same logical first-send operation can therefore generate multiple attempt/send opportunities.

This is the primary ADR-012 gate and requires architectural remediation, not a small local fix.

## 8. Restart reconciliation assessment

For ordinary successful execution, the implementation maps:

- `pending` to `aborted_restart`;
- `in_flight` and `received` to `delivery_unknown_restart`;
- expired nonterminal records to `expired`;
- terminal records to no change.

Successful reconciliation is durable and a second pass is idempotent; it performs no transport or gameplay replay. A reopened-database smoke test proves persistence across repository instances for a pending record.

H1 remains disqualifying: a batch failure produces partial durable reconciliation and a raw database exception. The implementation therefore does not satisfy deterministic restart recovery under persistence failure.

## 9. Retention and fake-parity assessment

SQLite cleanup excludes nonterminal actions and cascades attempt deletion when eligible terminal actions are removed. Configurable age/count limits exist for action logs and event diagnostics.

Acceptance is not met because:

- cleanup policies are multi-statement and non-atomic (M4);
- pairing and session stores are unbounded and lack deterministic cleanup (M3);
- the fake's cleanup is a no-op and other semantics differ (M5);
- bounded-growth and cleanup-failure behavior lack permanent tests.

## 10. Package/declaration assessment

Package-name declaration consumers execute successfully, and emitted declarations do not contain absolute/source-relative paths. Intended auth and persistence APIs are reachable.

The public API is overexposed in security-significant ways:

- `SendAuthorization` is structurally forgeable;
- migration internals are exported from the server root despite no demonstrated consumer requirement;
- negative declaration coverage does not exercise privileged authorization or most lifecycle constraints;
- stale test output remains in `apps/server/dist` (M7).

## 11. Test-quality assessment

All committed focused tests pass, and server persistence tests do execute real SQLite. The recovery smoke reopens durable state rather than reusing one repository object. The migration failure branch is exercised, and the independent stronger probe confirmed rollback of a successful statement preceding a failing statement in the same migration.

Counts (`8` auth-core tests, `19` server tests, `262` repository tests) overstate acceptance coverage. M6 lists the missing permanent evidence. The independent probes exposed multiple required behaviors that the passing suites do not detect.

## 12. Scope and documentation assessment

Milestone 2 behavior was not started: no mapping budget, action transport, Socket.IO delivery, SDK delivery, or demo-game implementation was introduced. FOUND-03A through FOUND-03D and FOUND-04A through FOUND-04D remain marked `PARTIAL`, which is appropriate pending acceptance. Node and pnpm versions in the handoff match fresh output.

The self-review and handoff claims are broader than the evidence in these areas:

- persist-before-send capability integrity;
- pairing lifecycle behavior;
- replay-safe admin bootstrap;
- migration metadata validation;
- atomic restart reconciliation;
- bounded cleanup;
- fake parity;
- permanent concurrency and failure-injection coverage.

ADR-012's persist-before-send and restart-recovery policies are not yet represented safely enough for milestone closure.

## 13. Exact verification results

Focused verification:

| Scope | Lint | Typecheck/build | Tests | Declaration test |
|---|---:|---:|---:|---:|
| `@crowdcircuit/auth-core` | PASS | PASS | PASS — 8 tests / 1 file | PASS |
| `@crowdcircuit/server` | PASS | PASS | PASS — 19 tests / 4 files | PASS |
| `@crowdcircuit/contracts` | PASS | PASS, including forced build | PASS — 175 tests / 7 files | PASS |

Repository-wide verification:

- ESLint: PASS
- TypeScript project build/typecheck: PASS
- Vitest: PASS — 262 tests / 18 files
- dashboard production build: PASS — Vite 6.4.3, 28 modules transformed
- emitted JavaScript/declaration inspection: FAIL because stale `index.test.*` artifacts remain in server `dist`
- diff whitespace check: PASS with line-ending warnings only

Independent probes:

- forwarding-header loopback bypass: rejected (`403`)
- IPv4-mapped loopback: accepted as intended (`200`)
- query credential rejection/log safety: FAIL (`200`, full query secret logged)
- wrong-role pairing attempt preserving code: FAIL
- admin bootstrap replay: FAIL (two distinct session fingerprints)
- forged send authorization: FAIL (attempt accepted)
- duplicate-create send authorization: FAIL (two attempt opportunities)
- migration rollback between successful and failing statements: PASS
- corrupted/gapped schema-version history: FAIL (versions 1 and 3 accepted)
- restart batch failure atomicity: FAIL (first record transitioned, second unchanged)

## 14. Verdict

**REQUEST CHANGES**

Milestone 1 has substantive security, persistence-capability, migration-validation, transaction, recovery, retention, packaging, and permanent-test defects. C1 and H1 directly violate ADR-012's primary acceptance boundaries. These are not eligible for reviewer-applied small fixes, and Milestone 2 should remain blocked until remediation is independently re-reviewed.
