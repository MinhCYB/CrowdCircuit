# Phase B Milestone 01 — Codex Review 01

## Review basis

- Review target: complete accumulated uncommitted working-tree diff
- Base commit and HEAD: `8c3f2e4`
- Branch: `main`
- Branch synchronization: `main` matched `origin/main`
- Review date: 2026-07-23
- Toolchain: Node.js `v24.15.0`, pnpm `11.9.0`
- Initial-review policy: no files were modified during the review

The review inspected all tracked and untracked files, the exact working-tree
diff, package metadata and project references, implementation source, tests,
current execution documents, the milestone plan and prompt, the handoff,
relevant System Design sections, and emitted JavaScript and declarations.

## Repository and working-tree evidence

At review time:

- 11 tracked files were modified.
- Four task-related paths were untracked:
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
  - `packages/connector-core/test/index.test.ts`
  - `packages/connector-mock/test/mock-connector.test.ts`
  - `packages/event-core/test/normalizer.test.ts`
- The tracked diff contained 926 insertions and 105 deletions.
- `git diff --check HEAD --` passed.
- No implementation commit was required for this working-tree review.

## Findings

### High — listener exceptions can corrupt lifecycle state and suppress other listeners

- Files and lines:
  - `packages/connector-mock/src/index.ts:103`
  - `packages/connector-mock/src/index.ts:150`
  - `packages/connector-mock/src/index.ts:291`
- Evidence:
  - A throwing first status listener caused `connect()` to reject.
  - The connector remained stuck in `connecting`.
  - A later status listener was not called.
  - A throwing first event listener prevented a later event listener from
    receiving the event.
  - A status-listener exception during `destroy()` can interrupt destruction
    before the connector is marked destroyed and listeners are cleared.
- Why it matters: observers can corrupt connector lifecycle state, prevent
  cleanup, and make delivery depend on listener ordering.
- Minimal fix: centralize safe listener notification, isolate each observer
  failure, continue notifying later listeners, prevent recursive error
  dispatch, and guarantee lifecycle transitions and destruction cleanup.
- Next-milestone impact: blocks Milestone 2.

### High — normalization fabricates domain data and misrepresents nullable and deferred aggregation semantics

- Files and lines:
  - `packages/event-core/src/index.ts:136`
  - `packages/event-core/src/index.ts:200`
  - `packages/event-core/src/index.ts:239`
  - `packages/event-core/src/index.ts:368`
- Independent reproduction:
  - A gift missing `giftId`, `giftName`, and `giftImage` normalized
    successfully with invented values:
    - `gift_unknown`
    - `Gift`
    - `https://example.com/gift.png`
  - Missing `streamerUniqueId` became `unknown_streamer`.
  - Every gift was marked `streakable: true` and received a synthetic streak
    ID.
  - Missing `diamondValue` failed despite the public contract requiring a
    present nullable property.
  - Likes required `totalLikes` despite public `total` being nullable.
  - Every like set `milestone` to its total. A total of 17 therefore produced
    `milestone: 17`.
- Why it matters: the implementation silently creates provider/domain facts
  that were not observed, violates required-nullable semantics, and pulls gift
  streak and like milestone behavior forward from Milestone 2.
- Minimal fix: explicitly validate supported raw shapes; fail missing required
  non-null data; map unavailable nullable facts to `null`; represent no
  established gift streak without a synthetic ID or progression; keep like
  milestone `null` until aggregation establishes one.
- Next-milestone impact: blocks Milestone 2.

### High — the provider-independent connector boundary is incomplete

- File and lines:
  - `packages/connector-core/src/index.ts:11`
  - `packages/connector-core/src/index.ts:48`
- Evidence against System Design section 11.1:
  - `ConnectionStatus` omits the live-ended state.
  - `connect()` accepts an unstructured `Record<string, unknown>`.
  - `connect()` returns no connection information.
  - No provider-independent `ConnectorConfig` or `ConnectionInfo` exists.
- Why it matters: the shared boundary cannot represent the documented
  lifecycle or provide the typed connection contract required by later
  adapters.
- Minimal fix: add the smallest provider-independent typed config and
  connection information supported by the design, represent live-ended
  distinctly, and update MockConnector without adding networking.
- Next-milestone impact: blocks Milestone 2.

### Medium — mock inputs are not copied defensively

- Files and lines:
  - `packages/connector-mock/src/index.ts:192`
  - `packages/connector-mock/src/index.ts:220`
- Evidence: mutating a caller-provided sender and its roles array after event
  construction changed the retained raw event to the mutated nickname and
  roles.
- Why it matters: caller mutation can contaminate delivered or retained event
  history and make deterministic tests order-dependent.
- Minimal fix: copy the event, payload, sender, roles, and any other nested
  mutable values at the connector boundary.
- Next-milestone impact: blocks Milestone 2.

### Medium — prohibited production assertions remain

- File and lines:
  - `packages/event-core/src/index.ts:147`
  - `packages/event-core/src/index.ts:158`
- Evidence:
  - `rawPayload as Record<string, unknown>`
  - `rawSender as Record<string, unknown>`
- Why it matters: these bypass structural narrowing at the exact untrusted raw
  input boundary, contrary to the milestone prompt.
- Minimal fix: use Zod raw-input schemas, assertion-free type guards, or
  guarded `Reflect.get`.
- Next-milestone impact: blocks Milestone 2.

### Medium — focused package verification is not reproducible

- Files:
  - `packages/connector-core/package.json`
  - `packages/connector-mock/package.json`
  - `packages/event-core/package.json`
- Evidence:
  - All three focused lint commands failed with
    `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`.
  - All three focused test commands returned without running tests because the
    packages define no test scripts.
  - Tests passed only through root Vitest discovery.
- Why it matters: the handoff overstates focused verification and package
  regressions cannot be reproduced with the prescribed commands.
- Minimal fix: add meaningful package-scoped lint and test scripts that execute
  only the intended files and fail when they fail.
- Next-milestone impact: blocks Milestone 2.

### Medium — runtime and declaration coverage is narrower than claimed

- Files:
  - `packages/connector-core/test/index.test.ts`
  - `packages/connector-mock/test/mock-connector.test.ts`
  - `packages/event-core/test/normalizer.test.ts`
- Missing coverage:
  - repeated connect, disconnect, and destroy;
  - status and error unsubscribe;
  - multiple listeners and listener-failure isolation;
  - subscription after destruction;
  - defensive copying;
  - multiple default IDs and uniqueness;
  - invalid clock output;
  - positive and negative infinity;
  - fractional gift and like values;
  - missing gift identity fields;
  - invalid sender containers and sender field types;
  - nullable gift image, diamond value, and like total;
  - absence of synthetic streak and milestone facts;
  - package-name declaration consumers for the new public APIs.
- Why it matters: important failure behavior and public declarations remain
  unprotected even though the handoff claims a complete focused slice.
- Minimal fix: add the missing additive runtime and declaration regressions
  without removing valid coverage.
- Next-milestone impact: blocks Milestone 2.

### Low — current documentation records a stale pnpm version

- Files:
  - `docs/execution/PROJECT_STATUS.md`
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
- Evidence: both record pnpm `11.15.1`; fresh output was `11.9.0`.
- Minimal fix: record Node.js `v24.15.0` and pnpm `11.9.0`, and reconcile
  verification claims with commands that actually executed tests.
- Next-milestone impact: mechanical but required for milestone closure.

## Connector lifecycle assessment

Resolved aspects:

- The boundary is provider-independent and contains no TikTok library types.
- Event unsubscribe works for the single tested case.
- Event delivery is blocked while disconnected and after destruction.
- Connecting after destruction rejects.

Unresolved aspects:

- Observer exceptions can interrupt transitions and cleanup.
- Multiple-listener reliability is not implemented.
- Repeated lifecycle behavior is incompletely tested.
- Error and status unsubscribe behavior is untested.
- Subscription after destruction is not explicitly handled.
- Live-ended status, typed configuration, and typed connection information are
  absent.

## Normalization assessment

Resolved aspects:

- The four supported raw kinds map to their intended specialized schemas.
- Successful tested outputs parse through the public LIVE envelope schema.
- Provider-only fields are excluded from normalized envelopes.
- Expected failures return a discriminated result rather than partial output.
- Unsupported kinds have a stable dedicated error code.
- `trim().toLowerCase()` is a conservative comment normalization rule.

Unresolved aspects:

- Missing and nullable fields are handled incorrectly.
- Gift streak and like milestone facts are invented.
- Several invalid shapes are silently repaired.
- Fractional data is rejected only by final schema validation rather than
  consistently classified as invalid raw data.
- Assertion-based access remains at the raw input boundary.

## Package and dependency assessment

Verified:

- `connector-core` has no dependency on connector-mock or event-core.
- `connector-mock` depends on connector-core only.
- `event-core` depends on connector-core and contracts.
- Connector-mock is an event-core development dependency for tests.
- No project-reference or package cycle exists.
- Emitted declarations use package-name imports.
- No source-relative path escapes appear in emitted declarations.
- Dist contains only expected index JavaScript, declarations, maps, and no
  tests.

Cleanup required:

- Event-core declares a direct Zod dependency but does not import Zod directly.
  Remove it if focused verification confirms it is unnecessary.

## Fresh verification results

| Check | Result |
| --- | --- |
| `git diff --check HEAD --` | Passed |
| Connector-core lint | Failed — no script |
| Connector-core typecheck | Passed |
| Connector-core focused test | No tests executed |
| Connector-core build | Passed |
| Connector-mock lint | Failed — no script |
| Connector-mock typecheck | Passed |
| Connector-mock focused test | No tests executed |
| Connector-mock build | Passed |
| Event-core lint | Failed — no script |
| Event-core typecheck | Passed |
| Event-core focused test | No tests executed |
| Event-core build | Passed |
| Repository lint | Passed |
| Repository typecheck | Passed |
| Repository tests | 198 passed across 11 files |
| Repository build | Passed |

Repository test distribution matched the documentation:

- contracts: 175
- connector-core: 2
- connector-mock: 4
- event-core: 15
- server: 2

## Scope and documentation assessment

No deduplication cache, aggregation state, full gift-streak state machine,
mapping, action delivery, networking, persistence, authentication, or UI code
was introduced. However, synthetic gift streak and like milestone values
prematurely encode Milestone 2 semantics and must be removed.

Milestone 1 remains PARTIAL. Milestone 2 remains blocked.

## Verdict

**REQUEST CHANGES**

The package direction and happy-path slice are promising, but listener-induced
lifecycle corruption, fabricated normalized data, nullable-semantic
misalignment, incomplete shared contracts, missing defensive copies,
assertion-based raw access, and non-reproducible focused verification are
substantive blockers.
