# Phase B Milestone 01 — Codex Review 04

## Review basis

- Review target: `PHASE-B-MILESTONE-01-REWORK-03`
- Parent milestone: Phase B Milestone 01 — mock-to-normalized playable input slice
- Repository state: complete accumulated uncommitted working-tree diff
- Base commit and HEAD: `8c3f2e4`
- Branch: `main`, synchronized with `origin/main`
- Review date: 2026-07-23
- Fresh toolchain: Node.js `v24.15.0`, pnpm `11.9.0`
- Initial-review mutation policy: no files were modified
- Verdict: **REQUEST CHANGES**

The review inspected the complete tracked diff and untracked inventory, all
Milestone 1 prompts, reviews, and handoffs, connector and normalizer source,
runtime tests, declaration consumers, package scripts, TypeScript references,
emitted JavaScript and declarations, execution documents, and the relevant
System Design sections. All required focused and repository-wide verification
was executed fresh.

## Repository and working-tree evidence

- `HEAD`, `main`, and `origin/main` were synchronized at `8c3f2e4`.
- The tracked diff contained 11 files, 1,447 insertions, and 105 deletions.
- Untracked files included all Milestone 1 prompts, reviews, handoffs, runtime
  tests, declaration consumers, and declaration-test configurations.
- `git diff --check HEAD --` passed.
- No Milestone 2 implementation was present.

## Findings

### High — destroy-time clock failure leaves a destroyed connector reporting connected

- File and lines: `packages/connector-mock/src/index.ts:246-265`
- Evidence: `destroy()` sets `isDestroyed = true`, then reads the clock. If
  that read fails, it swallows the error and clears resources without changing
  `status`.
- Independent reproduction:

  ```text
  connect succeeds with first clock read
  destroy encounters failing second clock read
  getStatus() after destroy: "connected"
  ```

- Why it matters: the connector is destroyed and inert while its public
  lifecycle state remains connected. This violates terminal cleanup and atomic
  lifecycle requirements.
- Minimal fix: always finish destruction with internal status
  `"disconnected"` and cleared resources. Attempt the timestamp before any
  notification, but omit the final status notification if no valid timestamp
  exists rather than fabricating one.
- Next-milestone impact: blocks Milestone 2.

### High — cloneRawValue still contains a production assertion

- File and line: `packages/connector-mock/src/index.ts:118`
- Evidence:

  ```ts
  val as { constructor?: { name?: string } }
  ```

- Why it matters: this directly violates the assertion-free production
  requirement and contradicts the REWORK-03 handoff.
- Minimal fix: replace the clone helper with an assertion-free,
  descriptor-aware plain-data validator and clone implementation.
- Next-milestone impact: blocks Milestone 2.

### High — cloneRawValue invokes accessors and accepts unsupported values

- File and lines: `packages/connector-mock/src/index.ts:85-139`
- Evidence:
  - `Reflect.get()` invokes getters without first checking property
    descriptors.
  - A getter-bearing object was accepted, delivered, and its getter ran once.
  - Object properties containing `undefined` were accepted.
  - Sparse arrays were accepted and holes were converted into explicit
    `undefined` entries.
  - A throwing getter can leak an arbitrary native exception instead of
    `MockConnectorInputError`.
- Independent probe:

  ```text
  accessor accepted: true
  event delivered: 1
  getter calls: 1
  sparse array accepted: true
  undefined property accepted: true
  ```

- Why it matters: cloning has undocumented side effects and accepts values
  outside the selected JSON-safe plain-data boundary.
- Minimal fix: inspect descriptors without reading accessor values; reject
  getters, setters, undefined, sparse arrays, symbol keys, unsupported
  descriptors, and reflection failures deterministically.
- Next-milestone impact: blocks Milestone 2.

### Medium — valid repeated references are incorrectly classified as cycles

- File and lines: `packages/connector-mock/src/index.ts:103-106`
- Evidence: the single `WeakSet` retains completed objects. A valid acyclic
  graph such as `{ a: shared, b: shared }` throws:

  ```text
  MockConnectorInputError: Cannot clone cyclic raw payload object
  ```

- Why it matters: repeated references are not cycles and are valid plain-data
  input.
- Minimal fix: use an active-path `WeakSet` for true recursion-cycle detection
  plus a `WeakMap` for completed clones or shared-reference memoization.
- Next-milestone impact: blocks Milestone 2.

### Medium — public malformed-input behavior is incompletely documented

- File and lines:
  - `packages/connector-mock/src/index.ts:17-25`
  - `packages/connector-mock/src/index.ts:297-340`
- Evidence: malformed input currently throws `MockConnectorInputError`
  directly and does not notify `onError`, but the public JSDoc and emitted
  declaration do not state the rejection categories, zero-delivery guarantee,
  unchanged lifecycle state, or error-observer policy.
- Why it matters: consumers cannot determine the stable public failure
  boundary from declarations.
- Minimal fix: document that caller validation failures throw
  `MockConnectorInputError`, publish no event, do not change lifecycle state,
  and do not notify `onError`. Wrap reflection/getter/native failures in that
  typed error.
- Next-milestone impact: blocks Milestone 2.

### Medium — declaration coverage remains incomplete

- Files:
  - `packages/connector-core/test/declaration-consumer.ts`
  - `packages/connector-mock/test/declaration-consumer.ts`
  - `packages/event-core/test/declaration-consumer.ts`
- Evidence:
  - connector-core lacks malformed `LiveConnector` implementations, invalid
    connect parameter implementations, incorrect promised return shapes, and
    broader malformed `ConnectionInfo` checks;
  - connector-mock lacks invalid ID, room, streamer, typed helper, raw event,
    and complete error-contract checks;
  - event-core lacks explicit incompatible success-with-error and
    failure-with-event combinations.
- Why it matters: the executable declaration suites do not yet lock the whole
  public API requested by the milestone.
- Minimal fix: add package-name negative checks and ensure every
  `@ts-expect-error` is compiled by `test:declarations`.
- Next-milestone impact: blocks Milestone 2.

### Medium — runtime regression coverage was reduced and remains incomplete

- File: `packages/connector-mock/test/mock-connector.test.ts`
- Evidence:
  - REWORK-02 recorded 8 connector-mock tests and 201 repository tests;
    REWORK-03 contains 7 and 200.
  - Because the test file has remained untracked, Git cannot recover an
    immutable before/after test identity.
  - The effective missing coverage includes caller-mutation defensive copying,
    destroy-time clock failure, an actual throwing listener during destroy,
    stream-ended listener isolation, disconnected stream-ended behavior,
    generated timestamp rejection counts, accessors, sparse arrays,
    undefined, shared references, and malformed-input error-observer policy.
  - The test named for connect and disconnect clock safety tests a failed event
    emission after connect, not failed disconnect or destroy.
- Why it matters: valid prior coverage was not preserved and the actual
  remaining defects are not represented by permanent tests.
- Minimal fix: restore or replace the defensive-copy regression and add
  independently meaningful cases for every listed boundary without removing
  existing valid tests.
- Next-milestone impact: blocks Milestone 2.

### Low — current documentation overstates completion

- Files:
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-03.md`
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-01.md`
- Evidence:
  - the current handoff claims every Review 03 finding is resolved;
  - older handoffs contain pnpm `11.15.1` or mixed versions without
    consistently identifying them as historical snapshots.
- Fresh evidence: Node.js `v24.15.0`, pnpm `11.9.0`.
- Minimal fix: keep Milestone 1 partial, remove premature completion claims,
  label historical version output, and record accurate current evidence.
- Next-milestone impact: does not independently block Milestone 2.

## Lifecycle and timestamp assessment

Resolved behavior that must be preserved:

- initial connect validates one timestamp before state mutation;
- the same validated timestamp is used for connecting, connected, and
  `ConnectionInfo`;
- observer failures remain isolated;
- repeated connect returns the exact cached `ConnectionInfo`;
- repeated connect does not reread the clock, apply conflicting config,
  regenerate `connectedAt`, or emit status;
- disconnect and stream-ended validate timestamps before their state changes;
- supplied and generated event timestamps are validated before delivery;
- invalid event timestamps publish no event and leave connected state
  unchanged;
- repeated stream-ended is idempotent;
- stream-ended after destroy throws `MockConnectorInputError` and does not
  change the connector to ended.

Unresolved behavior:

- destroy clock failure leaves public status connected;
- permanent destroy-time failure and stream-ended observer tests are missing.

## Clone and malformed-input assessment

Resolved behavior that must be preserved:

- supported plain nested values are defensively copied;
- common non-plain containers, BigInt, functions, symbols, NaN, infinities,
  cycles, and dangerous keys are rejected;
- enumerable own `__proto__` causes deterministic
  `MockConnectorInputError`, zero delivery, and no prototype pollution;
- JSON stringify/parse is not used;
- malformed caller input currently does not notify `onError`.

Unresolved behavior:

- one production assertion remains;
- getters execute;
- accessors, undefined values, and sparse arrays are accepted;
- throwing accessors can leak arbitrary native errors;
- repeated shared references are rejected as cycles;
- public JSDoc does not communicate the selected malformed-input contract.

## Listener and cleanup assessment

Resolved behavior that must be preserved:

- event, status, and error listeners are isolated;
- later listeners run after earlier listener failures;
- error-listener failure is non-recursive;
- ordinary cleanup clears listener sets;
- repeated disconnect and destroy are idempotent;
- subscriptions after destruction are inert.

Unresolved behavior:

- destroy-time clock failure leaves lifecycle status inconsistent;
- no permanent test triggers a status-listener failure specifically during
  destroy;
- no permanent test covers status-listener failure during stream-ended.

## Declaration and regression assessment

- All three declaration suites execute using package-name imports.
- Their negative coverage remains incomplete as described above.
- Fresh runtime counts:
  - connector-core: 2 tests;
  - connector-mock: 7 tests;
  - event-core: 14 tests;
  - contracts: 175 tests;
  - repository: 200 tests across 11 files.
- The previous one-test reduction is not accurately reconciled. The test file
  was never committed, so Git cannot identify a deleted historical test by
  line, but defensive-copy and lifecycle coverage previously recorded as
  approved is absent from the current permanent suite.

## EventNormalizer regression assessment

The previously approved EventNormalizer behavior remains intact and must be
frozen:

- specialized schema and `LiveEventEnvelopeSchema` validation;
- strict sender validation with no fabricated user facts;
- explicit gift streakability requirement;
- neutral gift streak only;
- like milestone always null;
- decimal nonnegative diamond values accepted;
- zero like total accepted;
- NaN and both infinities rejected;
- no aggregation, deduplication, gift-streak state, or like-milestone
  interpretation.

## Scope and documentation assessment

- No Milestone 2 implementation was introduced.
- No aggregation, deduplication, mapping, action delivery, persistence,
  authentication, networking, or UI work entered scope.
- Current execution documents keep Milestone 1 pending review and Milestone 2
  blocked.
- Current execution documents record Node.js `v24.15.0` and pnpm `11.9.0`.
- Current handoff completion and historical-version wording require
  reconciliation.

## Fresh verification results

| Verification | Result |
| --- | --- |
| `git diff --check HEAD --` | Passed |
| Connector-core lint | Passed |
| Connector-core typecheck | Passed |
| Connector-core tests | 2 passed |
| Connector-core build | Passed |
| Connector-core declaration tests | Passed |
| Connector-mock lint | Passed |
| Connector-mock typecheck | Passed |
| Connector-mock tests | 7 passed |
| Connector-mock build | Passed |
| Connector-mock declaration tests | Passed |
| Event-core lint | Passed |
| Event-core typecheck | Passed |
| Event-core tests | 14 passed |
| Event-core build | Passed |
| Event-core declaration tests | Passed |
| Contracts tests | 175 passed across 7 files |
| Contracts declaration tests | Passed |
| Repository lint | Passed |
| Repository typecheck | Passed |
| Repository tests | 200 passed across 11 files |
| Repository build | Passed |

Passing verification does not override the independently reproduced lifecycle
and clone-boundary defects or the missing permanent coverage.

## Verdict

**REQUEST CHANGES**

EventNormalizer and the approved connector behavior remain frozen. Milestone 1
cannot be approved until destruction is terminal despite clock failure, the
clone boundary is assertion-free and descriptor-safe, shared references are
handled correctly, the public malformed-input contract is documented, and the
required runtime and declaration regressions are complete.

Milestone 2 remains blocked.

