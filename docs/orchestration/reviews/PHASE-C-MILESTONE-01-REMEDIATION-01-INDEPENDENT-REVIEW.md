# Phase C Milestone 1 Remediation 01 Independent Review

Date: 2026-07-24  
Baseline: `86f1a32`  
Review target: complete accumulated uncommitted Phase C working tree  
Prior verdict: `REQUEST CHANGES`  
Verdict: **REQUEST CHANGES**

## 1. Repository evidence

The review covered the complete tracked and untracked working tree, the prior independent review, Remediation 01 self-review and handoff, ADR-012, Phase C planning/execution documents, all authentication and persistence sources, all focused tests, and emitted artifacts.

Fresh evidence:

- `git rev-parse --short HEAD`: `86f1a32`
- tracked diff: 11 files, 547 insertions, 155 deletions
- Node.js: `v24.15.0`
- pnpm: `11.9.0`
- `git diff --check HEAD --`: pass, with working-copy LF-to-CRLF warnings only
- no commit or push was performed
- no Milestone 2 implementation was found

The prior reviewer-created `.pnpm-store` artifact is no longer present. Independent probe files used in this review were deleted after execution. The only file intentionally added by this review is this report.

## 2. Findings by severity

### High

#### H1. Unconsumed capabilities remain valid across repository handoff and reopen

Capability identity is stored in one module-global `WeakMap` at `apps/server/src/persistence/authorization.ts:20`. The stored authorization details do not identify the issuing repository instance. `recordAttempt` at `apps/server/src/persistence/repository.ts:548` accepts any object present in that global map when the shared durable row still matches. Closing a repository at `apps/server/src/persistence/repository.ts:788` closes only SQLite and does not invalidate capabilities it issued.

Two independent SQLite probes demonstrated the defect:

1. Repository A created an action and capability. Repository B opened the same database while A remained open. Repository B accepted A's capability and durably recorded attempt 1.
2. Repository A created an action and capability, then closed. A newly opened repository accepted the old, unconsumed capability and durably recorded attempt 1 without first applying restart reconciliation.

Both probes returned `accepted` with one durable attempt. This directly fails the requested wrong-repository and repository-restart invalidation checks. It also contradicts the self-review claim that runtime acceptance requires the exact repository-issued identity: the object identity is exact, but issuance is module-global rather than repository-scoped.

An actual new operating-system process cannot retain the old JavaScript object, but a repository/service restart within one process can. ADR-012 requires the new owner to use durable reconciliation rather than an old capability. The repository currently has no ownership boundary that enforces that ordering.

Required remediation:

- bind every capability to a private issuer/repository identity checked by `recordAttempt`;
- invalidate all capabilities issued by a repository when it closes or loses runtime ownership;
- prevent a newly opened repository from consuming prior-owner authorization rows before reconciliation;
- permanently test an **unconsumed** capability against a second simultaneous repository and a reopened repository, before and after reconciliation.

### Medium

#### M1. Public cleanup accepts caller-controlled time and can delete live credentials

Both cleanup methods are public and accept an optional `now` argument:

- `PairingCodeRegistry.cleanup(now = this.#now())`
- `RoleSessionRegistry.cleanup(now = this.#now())`

This violates the stated requirement that cleanup use only the injected clock. An independent probe created a live pairing code and live role session at clock time 1,000, then called `cleanup(999999999)`. Each method removed its live credential immediately; both registry sizes changed from 1 to 0.

The public declarations expose this time override, so any consumer holding the registry can bypass the injected clock and destroy live credentials. The server runtime publicly exposes both registries through `AuthRuntime`.

Required remediation: make the time-specific sweep private, expose only `cleanup(): number`, and permanently prove that public cleanup cannot remove a credential that is live according to the injected clock.

#### M2. An empty migration manifest is accepted and mutates an empty database

`validateMigrations` at `apps/server/src/persistence/migrations.ts:76` accepts an empty array. `migrateDatabase(database, [])` then creates `schema_versions`, returns schema version `0`, and reports success.

The independent probe returned:

```text
result: 0
tables: ["schema_versions"]
```

This fails the explicit “empty database without migration 1” case and the rule that manifest rejection perform zero schema or metadata mutation.

Required remediation: reject an empty manifest before any pragma/schema mutation and add a permanent zero-mutation test.

#### M3. Permanent concurrency, commit-failure, and fake-transaction evidence remains incomplete

The two-repository duplicate-create test calls the repositories sequentially. The pairing `Promise.all` test submits two requests, but redemption itself is synchronous and does not demonstrate an independently controlled overlap point. There is no commit-failure injection immediately before/during `COMMIT`, nor an after-commit failure/retry test.

The deterministic fake's reconciliation mutates its maps record by record and has no transaction/fault mechanism. It therefore cannot prove the required all-or-nothing behavior under a middle-record failure. Its cleanup remains a no-op, so it is not full repository parity.

The production SQLite transaction boundaries appear correct for the tested paths, and real database uniqueness is present. This finding is about permanent acceptance evidence and the explicit fake-equivalence requirement, not proof of another observed SQLite partial commit.

Required remediation:

- add controlled barriers or worker/process concurrency for duplicate create and capability consumption;
- inject failures before commit, at commit, and after commit;
- give the fake transactional rollback semantics or explicitly remove it from claims requiring production-equivalent failure behavior.

#### M4. Migration manifest internals remain emitted as directly usable implementation modules

The package root does not re-export migration helpers, and the package `exports` map exposes only `"."`, which prevents normal package-name deep imports. That is a meaningful improvement.

However, the clean build still emits:

- `dist/persistence/migrations.js`
- `dist/persistence/migrations.d.ts`

Those files publicly export `MIGRATIONS` and `migrateDatabase`. This does not expose them through the supported package root, but it is broader than the remediation report's unqualified statement that migration implementation functions are no longer exported. The documentation should distinguish “not exported from the package root” from “absent from emitted output.”

This is a packaging/documentation precision issue; it is not independently release-blocking.

## 3. Authorization and duplicate-create assessment

The original critical structural-forgery and duplicate-mint defects are fixed:

- `SendAuthorization` has a private unique-symbol member in declarations;
- object literals, shallow copies, frozen copies, JSON reconstruction, structured cloning, random objects, and prototype substitutes are not present in the internal `WeakMap`;
- the package root exports no issuance/read helper or brand symbol;
- the database stores a SHA-256 authorization identifier derived from 32 random bytes, not a raw bearer value;
- action and first authorization rows are inserted in one SQLite transaction before the capability is returned;
- generation failure rolls back the action and authorization;
- a duplicate create returns `sendAuthorization: null`;
- conflicting action/idempotency payloads fail;
- durable unique constraints enforce action ID, idempotency key, and action/attempt authorization uniqueness;
- consumption checks action, expected version, attempt number, runtime ID, game role, client/game ID, expiry, revocation, consumption, and nonterminal state;
- authorization consumption, attempt insertion, action version advancement, and status advancement occur in one transaction;
- reuse, revoked, expired, stale, terminal, and wrongly bound capabilities fail.

H1 remains material: runtime identity is not repository-owner identity. A valid unconsumed object crosses repository boundaries and bypasses the intended reconciliation gate.

The existing restart test consumes the capability before reopening, so durable consumption—not repository invalidation—causes rejection. It does not exercise the failing unconsumed case.

## 4. Reconciliation assessment

The original partial-batch defect is fixed for SQLite.

Independent source inspection and permanent tests establish:

- classification occurs before mutation;
- all action updates and outstanding-authorization revocations execute inside one `BEGIN IMMEDIATE` transaction;
- first, middle, and final action-update trigger failures roll back all statuses, versions, reconciliation reasons, attempts, and authorization revocations;
- repaired execution reconciles the full batch once;
- a second run is idempotent;
- pending becomes `aborted_restart`;
- in-flight/received become `delivery_unknown_restart`;
- expired nonterminal actions become `expired`;
- terminal records remain unchanged;
- no transport or gameplay replay exists.

The remaining acceptance problem is the boundary before reconciliation: H1 allows a retained unconsumed prior-owner capability to advance the action through a reopened repository. The new repository must reject it independently of caller startup ordering.

The fake does not offer equivalent failure-atomic reconciliation evidence (M3).

## 5. HTTP credential and logging assessment

The original query-string and logging defect is fixed.

Independent probes verified:

- `token`, `access_token`, `auth`, `authorization`, `session`, `sessionToken`, `code`, `pairingCode`, and an unrelated query key all receive `403` on authentication endpoints;
- the policy intentionally rejects every query parameter, matching the implementation and remediation documentation;
- absolute-form authentication URLs with a query are rejected;
- captured logs contain none of the probe secrets;
- request serialization records method and path without the query string;
- cookie and Authorization headers plus pairing/token body fields are redacted;
- authentication errors return typed codes without credentials;
- the hook runs before route mutation.

Regression checks also pass:

- bootstrap is POST-only and reuses the current dashboard admin session;
- remote socket peers cannot become loopback through Host, `X-Forwarded-For`, or `Forwarded`;
- IPv4, IPv6, and IPv4-mapped loopback rules remain explicit;
- Fastify trusted-proxy behavior was not enabled;
- origins use an explicit allowlist;
- wrong origins create no session or pairing mutation.

## 6. Pairing concurrency assessment

The original invalid-binding consumption defect is fixed.

The operation order is now:

1. retrieve the record;
2. sweep using registry time;
3. validate existence, expiry, revocation, and consumption;
4. validate role and client;
5. run the synchronous session exchange;
6. mark the pairing consumed.

HTTP origin and body validation occur before `redeem`. Wrong role, wrong client, wrong origin, malformed body, and session-capacity failure therefore preserve the code. Failures use the same public invalid-credential response for binding mismatches. Two submitted valid pair requests yield one `200`, one `401`, and one session.

Because redemption contains no asynchronous yield, the synchronous in-process critical section does give one winner. The test is not a multi-threaded race, but there is no internal await point to interleave once redemption begins. M3 still applies to broader “genuine concurrency” acceptance evidence.

## 7. Migration assessment

The original stored-history gap defect is fixed:

- nonempty manifests are checked for positive, strictly ordered, contiguous versions beginning at 1;
- IDs are nonempty and unique;
- SQL is nonempty;
- SHA-256 checksums are stable;
- the complete stored history is ordered and compared against version, ID, and checksum;
- missing history, changed identity/SQL, reordered history, and unknown newer versions fail;
- validation of a malformed nonempty manifest happens before metadata-table creation;
- successful statements inside a failing migration roll back with its version metadata;
- normal reopen is idempotent.

M2 remains: the empty manifest bypasses all validation, creates metadata, and succeeds at version 0.

## 8. Bounded-store assessment

Positive evidence:

- pairing and session capacities and tombstone TTLs must be positive safe integers;
- creation/issuance sweeps expired records before capacity enforcement;
- no live entry is evicted to make space;
- exhaustion returns typed `CAPACITY_EXCEEDED`;
- expired pairings/sessions and eligible consumed/revoked tombstones are swept;
- replay tombstones remain invalid during their configured window;
- high-volume size is bounded by configured capacity;
- repeated cleanup is idempotent under a stable clock;
- failed issuance does not partially insert a credential.

M1 prevents acceptance of the clock-trust claim. Public callers can supply arbitrary future cleanup time and remove currently live credentials.

## 9. Declaration and package assessment

Positive evidence:

- package-name declaration tests execute;
- structural construction of `SendAuthorization` fails at compile time;
- brand and issuance/read helpers are absent from the package root;
- error/capacity types are intentionally public;
- active negative checks cover invalid roles, pairing inputs, capacities, action status, required timestamps, JSON safety, and authorization construction;
- the server build cleans `dist`;
- no test artifact, absolute path, test path, or source-only path remains in clean output;
- no test fake is exported through the production root.

Gaps:

- declaration tests cannot express repository-instance ownership, the runtime defect in H1;
- `cleanup(now)` is publicly declared and conflicts with the injected-clock claim;
- migration manifest negative declaration coverage is unavailable because migration internals are intentionally outside the root;
- emitted internal modules still contain migration and capability helper implementation files, although supported package exports block them (M4).

## 10. Test-quality assessment

All focused tests pass, and the SQLite tests use fresh temporary databases. The reconciliation trigger tests genuinely reach rollback paths. Query logging tests capture the application logger. Cleanup tests advance injected clocks. `@ts-expect-error` checks are active. Clean builds remove the old moved test output.

The suite count is accurate but broader than the proven acceptance surface:

- 11 auth-core tests;
- 36 server tests;
- 175 contracts tests;
- 282 repository-wide tests across 18 files.

Missing or misleading evidence:

- repository restart tests cover a consumed capability, not an unconsumed one;
- no test rejects a capability issued by another repository over the same database;
- no test prevents caller-controlled cleanup time;
- no empty-manifest test exists;
- duplicate repository create calls are sequential;
- commit boundary failures are not injected;
- fake reconciliation cannot demonstrate rollback.

## 11. Regression and scope assessment

No regression was found in:

- CSPRNG credential generation;
- role isolation and client binding;
- normal expiration/revocation;
- explicit origin policy;
- loopback bootstrap;
- SQLite foreign keys and initialization;
- ordinary migration rollback;
- legal/stale repository transitions;
- monotonic durable attempt history;
- restart classifications;
- production no-in-memory-fallback behavior;
- Phase A and Phase B tests.

Milestone 2 has not started. No mapping-budget work, action transport, Socket.IO delivery, SDK expansion, demo-game behavior, or Phase D behavior was introduced. FOUND-03A through FOUND-03D and FOUND-04A through FOUND-04D appropriately remain `PARTIAL` pending approval.

## 12. Exact verification results

Focused:

| Scope | Lint | Typecheck | Test | Build | Declarations |
|---|---:|---:|---:|---:|---:|
| `@crowdcircuit/auth-core` | PASS | PASS | PASS — 11/11 | PASS | PASS |
| `@crowdcircuit/server` | PASS | PASS | PASS — 36/36 | PASS, clean output | PASS |
| `@crowdcircuit/contracts` | PASS | PASS | PASS — 175/175 | PASS, forced | PASS |

Repository-wide:

- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS — 282 tests / 18 files
- `pnpm build`: PASS
- dashboard Vite production build: PASS — 28 modules transformed
- emitted JavaScript/declarations: no test or path artifacts; supported root does not export privileged helpers
- `git diff --check HEAD --`: PASS with line-ending warnings only

Independent probes:

| Probe | Result |
|---|---|
| forged/random/copied capability | PASS — rejected |
| capability consumed twice | PASS — second use rejected |
| duplicate create mints replacement | PASS — no replacement |
| capability used by second repository on same DB | **FAIL — accepted, attempt persisted** |
| unconsumed capability after repository close/reopen | **FAIL — accepted, attempt persisted** |
| query key variants | PASS — all `403` |
| absolute-form URL query | PASS — `403` |
| query secret in captured logs | PASS — absent |
| wrong pairing binding then correct redemption | PASS |
| SQLite reconciliation first/middle/final failure | PASS — complete rollback |
| nonempty manifest gaps/duplicates/reorder/identity changes | PASS — rejected |
| empty manifest on empty DB | **FAIL — returned 0 and created `schema_versions`** |
| public cleanup with future caller time | **FAIL — deleted live pairing and session** |
| clean server `dist` | PASS — no `*.test.*` |

## 13. Verdict

**REQUEST CHANGES**

Remediation 01 resolves most original findings, including the prior critical structural authorization flaw and high-severity reconciliation, query-log, and pairing-consumption defects. Milestone 1 still fails explicit security/runtime ownership, injected-clock, migration, and permanent-evidence acceptance criteria. In particular, H1 permits prior-owner send authorization to be consumed through a different or reopened repository before reconciliation. This is not a reviewer-applicable small fix, and Milestone 2 must remain blocked.
