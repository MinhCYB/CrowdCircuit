# Phase B Milestone 01 — Codex Review 02

## Review basis

- Task reviewed: `PHASE-B-MILESTONE-01-REWORK-01`
- Parent milestone: Phase B Milestone 01 — Mock-to-normalized playable input
  slice
- Review target: complete accumulated uncommitted working-tree diff
- Base commit and HEAD: `8c3f2e4`
- Branch: `main`, synchronized with `origin/main`
- Review date: 2026-07-23
- Fresh toolchain: Node.js `v24.15.0`, pnpm `11.9.0`
- Initial-review mutation policy: no files were modified

The review inspected the complete tracked diff, untracked inventory,
implementation, tests, package scripts and dependencies, TypeScript project
references, execution documents, handoffs, and emitted JavaScript and
declarations. It ran all focused package checks, contracts regressions, and
repository-wide smoke verification.

## Repository evidence

- The working tree remained uncommitted on `main`.
- HEAD was `8c3f2e4`.
- 11 tracked files were modified.
- Untracked files included both milestone handoffs, the first review and
  rework prompt, and test/declaration-consumer files for connector-core,
  connector-mock, and event-core.
- `git diff --check HEAD --` passed.
- No Milestone 2 implementation files were introduced.

## Findings

### High — like milestone semantics remain implemented

- File: `packages/event-core/src/index.ts:471`
- Evidence: the normalizer reads `rawPayload.milestone`, validates it, and
  publishes it.
- Independent probe:

  ```text
  likeCount: 1, totalLikes: null, milestone: 1000
  → success with payload.milestone = 1000
  ```

- Why it matters: milestone detection and propagation belong to Milestone 2.
  Milestone 1 must not interpret or publish milestone facts.
- Minimal fix: do not read or propagate raw milestone input; set
  `milestone: null` for every successfully normalized like event and add a
  leakage regression.
- Next-milestone impact: blocks Milestone 2.

### High — invalid sender fields still fabricate normalized user facts

- File: `packages/event-core/src/index.ts:170`
- Evidence: this present invalid sender:

  ```ts
  { nickname: 123, avatarUrl: 99, roles: [1, "viewer"] }
  ```

  normalized successfully to:

  ```ts
  {
    id: null,
    uniqueId: null,
    displayName: "Anonymous",
    avatarUrl: null,
    roles: ["viewer"]
  }
  ```

- Why it matters: invalid raw data is silently repaired by inventing a display
  name, converting invalid non-null fields to null, and filtering invalid
  elements. This violates the typed-failure and no-fabrication requirements.
- Minimal fix: define and validate the supported sender shape; distinguish
  absent sender, missing required fields, valid nullable values, and invalid
  present values.
- Next-milestone impact: blocks Milestone 2.

### High — gift streakability is still fabricated when absent

- File: `packages/event-core/src/index.ts:305`
- Evidence: `rawPayload.streakable === true` maps every missing or invalid
  non-true value to `false`.
- Why it matters: `false` is still a domain fact. Missing streakability must
  not silently become a factual value.
- Minimal fix: require an explicit boolean in the supported raw gift shape;
  missing returns `MISSING_REQUIRED_FIELD`, invalid type returns
  `INVALID_DATA_TYPE`. Preserve the neutral non-aggregated streak object with
  no ID or progression.
- Next-milestone impact: blocks Milestone 2.

### High — numeric validation narrows approved public contracts

- Files:
  - `packages/event-core/src/index.ts:262`
  - `packages/event-core/src/index.ts:451`
- Independent evidence:
  - `diamondValue: 1.5` returned `INVALID_DATA_TYPE`.
  - `totalLikes: 0` returned `INVALID_DATA_TYPE`.
- Public contract evidence:
  - `diamondValue` is nullable, finite, and nonnegative; it is not restricted
    to integers.
  - like `total` is nullable, integer, and nonnegative; zero is valid.
- Why it matters: the normalizer rejects inputs accepted by the canonical
  public contract and therefore misaligns runtime boundaries.
- Minimal fix: align every numeric rule exactly with its public schema and
  reject fractions only for integer fields.
- Next-milestone impact: blocks Milestone 2.

### High — public LIVE-union validation is absent from the normalizer

- File: `packages/event-core/src/index.ts`
- Evidence: `LiveEventEnvelopeSchema` is neither imported nor called.
- Why it matters: tests separately parsing returned events do not satisfy the
  runtime requirement that the normalizer itself validate each successful
  output through both its specialized schema and the public union.
- Minimal fix: apply the specialized schema and `LiveEventEnvelopeSchema`
  inside each successful normalization path and return typed validation
  failure if either check fails.
- Next-milestone impact: blocks Milestone 2.

### Medium — repeated connect mutates active configuration and connectedAt

- File: `packages/connector-mock/src/index.ts:105`
- Evidence: configuration is applied before the already-connected check and
  `getConnectionInfo()` reads the clock each time.
- Independent probe:

  ```text
  first:  roomId "a", streamer "s1", connectedAt T1
  second: roomId "b", streamer "s2", connectedAt T2
  ```

- Why it matters: a supposedly idempotent repeated call silently changes the
  active connection without a lifecycle transition and changes its connection
  timestamp.
- Minimal fix: retain the original `ConnectionInfo`; when already connected,
  return it unchanged before applying new config or reading the clock.
- Next-milestone impact: blocks Milestone 2.

### Medium — invalid connector clock output is accepted

- File: `packages/connector-mock/src/index.ts`
- Evidence: a clock returning `not-a-timestamp` allowed connection and emitted
  `connectedAt: "not-a-timestamp"`.
- Why it matters: public connection and status timestamps can be malformed,
  and no deterministic failure/recovery behavior is defined.
- Minimal fix: centralize clock reads through existing ISO datetime validation;
  invalid output must not leave the connector in `connecting` or emit malformed
  status/event data.
- Next-milestone impact: blocks Milestone 2.

### Medium — generic JSON cloning can throw before listener isolation

- File: `packages/connector-mock/src/index.ts:178`
- Evidence: `JSON.parse(JSON.stringify(rawPayload))` throws for BigInt and
  cyclic graphs. Independent BigInt probe produced:

  ```text
  Do not know how to serialize a BigInt
  ```

- Why it matters: unsupported input escapes as an uncontrolled cloning
  exception outside listener failure isolation. JSON cloning also changes or
  drops several JavaScript value categories.
- Minimal fix: explicitly construct and copy the supported raw shapes; reject
  unsupported values deterministically.
- Next-milestone impact: blocks Milestone 2.

### Medium — declaration consumers exist but are not executed

- Files:
  - `packages/connector-core/test/declaration-consumer.ts`
  - `packages/connector-mock/test/declaration-consumer.ts`
  - `packages/event-core/test/declaration-consumer.ts`
- Evidence:
  - package `tsconfig.json` files include only `src`;
  - `typecheck` runs `tsc -b`;
  - `test` runs Vitest;
  - no declaration-test tsconfig or script includes the consumer files.
- Why it matters: the handoff claims package-name declaration verification,
  but TypeScript never checks these artifacts. Negative assignments and
  `@ts-expect-error` directives cannot protect the public APIs.
- Minimal fix: add explicit declaration-test configurations and reproducible
  scripts, then include them in focused verification.
- Next-milestone impact: blocks Milestone 2.

### Medium — required runtime and declaration coverage remains incomplete

Missing or incomplete permanent coverage includes:

- positive and negative Infinity across gift and like numeric fields;
- fractional quantity and like-delta rejection;
- valid fractional diamond value;
- zero like total;
- raw milestone never propagating;
- invalid sender property types;
- invalid clock output;
- default event-ID uniqueness;
- later status listener after an earlier listener throws;
- later error listener after an earlier listener throws;
- an actual status-listener failure during destroy;
- unsupported defensive-copy inputs;
- executed negative declaration checks.

Why it matters: the remaining semantic and lifecycle defects were not caught by
the claimed regression suite.

Minimal fix: add all missing cases without removing valid existing coverage.

Next-milestone impact: blocks Milestone 2.

### Low — current documentation retains stale pnpm references

- Files:
  - `docs/execution/PROJECT_STATUS.md`
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-01.md`
- Evidence: these retain pnpm `11.15.1` or mixed-version wording.
- Fresh output: pnpm `11.9.0`.
- Minimal fix: current Milestone 1 records must contain only the fresh observed
  tool version and accurate verification claims.
- Next-milestone impact: mechanical but required before approval.

## Previous-finding resolution matrix

| Previous finding | Result | Evidence |
| --- | --- | --- |
| Listener exceptions corrupt lifecycle | Resolved | Status and event callbacks are isolated; connect reaches connected and destroy cleanup uses `finally`. |
| Later event listeners run | Resolved | Focused test and source loop both confirm continuation. |
| Error listener recursion | Resolved | Error-listener exceptions are swallowed without redispatch. |
| Destroy cleanup guaranteed | Resolved | `finally` marks destroyed and clears all listener sets. |
| Repeated disconnect/destroy | Resolved | Both are idempotent. |
| Destroyed connector reconnect/emission | Resolved | Reconnect rejects and emission/subscription has no meaningful effect. |
| ConnectorConfig and ConnectionInfo | Resolved | Public types and connect return exist. |
| Live-ended state | Resolved | `ConnectionStatus` includes `"ended"` and mock can emit it. |
| Missing gift/streamer identities | Resolved | Missing values return typed failure. |
| Nullable gift image/diamond/like total | Mostly resolved | Missing values map to null, but numeric alignment remains wrong. |
| Synthetic gift streak ID/progression | Resolved | Neutral `{ id: null, status: "single" }` is emitted. |
| Synthetic like milestone | Not resolved | Raw milestone is still accepted and propagated. |
| Defensive copy of ordinary sender/roles | Resolved | Caller mutation no longer changes delivered ordinary mock data. |
| Assertion-free production access | Resolved | No prohibited production assertions remain in the affected source. |
| Focused package lint/test scripts | Resolved | Scripts now execute real package-scoped checks. |
| Declaration coverage | Not resolved | Consumer files are not run by TypeScript. |
| Current pnpm documentation | Not resolved | Stale/mixed 11.15.1 references remain. |

## Fresh verification results

| Check | Result |
| --- | --- |
| `git diff --check HEAD --` | Passed |
| Connector-core lint | Passed |
| Connector-core typecheck | Passed |
| Connector-core tests | 2 passed |
| Connector-core build | Passed |
| Connector-mock lint | Passed |
| Connector-mock typecheck | Passed |
| Connector-mock tests | 8 passed |
| Connector-mock build | Passed |
| Event-core lint | Passed |
| Event-core typecheck | Passed |
| Event-core tests | 14 passed |
| Event-core build | Passed |
| Contracts tests | 175 passed |
| Contracts declaration tests | Passed |
| Repository lint | Passed |
| Repository typecheck | Passed |
| Repository tests | 201 passed across 11 files |
| Repository build | Passed |

The three new package declaration-consumer files were not included in these
TypeScript checks.

## Declaration and dist assessment

- Connector-core declarations expose provider-independent
  `ConnectorConfig`, `ConnectionInfo`, `ConnectionStatus`, and
  `LiveConnector`.
- Connector-mock declarations use package-name imports and implement the
  updated connect signature.
- Event-core declarations use package-name imports and expose the discriminated
  normalization result.
- No provider library types or source-relative path escapes appear.
- Dist contains expected index artifacts only.
- Declaration consumer execution remains missing.

## Scope and documentation assessment

- No deduplication cache, gift streak state machine, like aggregation state,
  networking, mapping, action delivery, persistence, authentication, or UI was
  introduced.
- Accepting and publishing raw milestone values is nevertheless Milestone 2
  semantics and must be removed.
- Milestone 1 remains PARTIAL.
- Milestone 2 remains blocked.
- Fresh versions are Node.js `v24.15.0` and pnpm `11.9.0`.

## Verdict

**REQUEST CHANGES**

The lifecycle failure isolation and package verification foundation are now
substantially improved. Approval remains blocked by milestone propagation,
sender and streakability fabrication, numeric contract mismatch, missing
public-union validation, nondeterministic repeated connection behavior,
unvalidated clocks, unsafe generic cloning, unexecuted declaration consumers,
missing regressions, and stale current documentation.
