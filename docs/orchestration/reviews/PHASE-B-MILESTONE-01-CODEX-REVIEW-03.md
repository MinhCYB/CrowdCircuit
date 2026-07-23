# Phase B Milestone 01 — Codex Review 03

## Review basis

- Review target: `PHASE-B-MILESTONE-01-REWORK-02`
- Parent milestone: Phase B Milestone 01 — mock-to-normalized playable input slice
- Repository state: complete accumulated uncommitted working-tree diff
- Base commit and HEAD: `8c3f2e4`
- Branch: `main`, synchronized with `origin/main`
- Review date: 2026-07-23
- Fresh toolchain: Node.js `v24.15.0`, pnpm `11.9.0`
- Initial-review mutation policy: no files were modified
- Verdict: **REQUEST CHANGES**

The review inspected the full tracked diff and untracked inventory, source,
tests, declaration consumers, package scripts, TypeScript references, emitted
JavaScript and declarations, current execution documents, and milestone
handoffs. All focused package and repository-wide verification was run fresh.

## Repository and working-tree evidence

- `HEAD`, `main`, and `origin/main` were synchronized at `8c3f2e4`.
- The accumulated working tree contained 11 modified tracked files plus
  untracked milestone handoffs, prompts, reviews, runtime tests, declaration
  consumers, and declaration-test configurations.
- `git diff --check HEAD --` passed.
- No Milestone 2 implementation was present.

## Findings

### High — failed clock validation can leave lifecycle state corrupted

- Files and lines:
  - `packages/connector-mock/src/index.ts:165`
  - `packages/connector-mock/src/index.ts:429`
- Evidence: `connect()` reads the clock before beginning its transition, but
  `setStatus()` mutates `this.status` and then reads the clock again. A clock
  that succeeds once and fails on the next read rejects the connection while
  leaving `getStatus()` equal to `"connecting"`.
- Independent probe:

  ```text
  changingClockError: Invalid clock output 'bad'...
  changingClockStatus: "connecting"
  ```

- Why it matters: lifecycle transitions are not atomic. A timestamp failure
  can leave an externally observable partial state and can attempt malformed
  status publication.
- Minimal fix: read and validate one timestamp before each transition; pass
  that timestamp into the state change and notification; never mutate state
  before validation; preserve or restore the previous valid state on failure.
- Next-milestone impact: blocks Milestone 2.

### High — stream-ended and explicit event timestamps bypass lifecycle boundaries

- Files and lines:
  - `packages/connector-mock/src/index.ts:257`
  - `packages/connector-mock/src/index.ts:425`
- Evidence:
  - `emitMockStreamEnded()` has no destroyed-state guard. Calling it after
    `destroy()` changes the connector from destroyed cleanup state to
    `"ended"`.
  - `emitMockEvent()` validates a generated clock value only when
    `occurredAt` is absent. A supplied `occurredAt: "not-iso"` reaches event
    listeners unchanged.
- Why it matters: destroyed connectors must remain inert, and malformed
  timestamps must never cross the raw-event publication boundary.
- Minimal fix: define deterministic stream-ended behavior for connected,
  disconnected, repeated, and destroyed states; validate every supplied or
  generated timestamp before state mutation or event delivery.
- Next-milestone impact: blocks Milestone 2.

### High — the defensive-clone boundary accepts unsupported objects and permits prototype manipulation

- File and lines: `packages/connector-mock/src/index.ts:74-108`
- Evidence:
  - Production assertions remain:
    - `val as object`
    - `(val as Record<string, unknown>)[key]`
  - Independent probes showed `Date`, `Map`, `Set`, and class instances were
    accepted and could be silently transformed to `{}` or a partial object.
  - An enumerable own `__proto__` property altered the clone's prototype:

    ```text
    own __proto__: false
    prototype polluted: true
    ```

- Why it matters: malformed input can be silently reinterpreted and dangerous
  keys can affect constructed object prototypes. The implementation also
  violates the assertion-free production requirement.
- Minimal fix: use natural narrowing with `Reflect.ownKeys` and `Reflect.get`;
  accept only JSON-safe primitives, arrays, and explicitly supported plain
  object containers; reject non-plain containers, cycles, unsupported scalar
  categories, and dangerous property keys; construct objects without a
  prototype-pollution path.
- Next-milestone impact: blocks Milestone 2.

### High — malformed mock-emission rejection is not a defined public contract

- File: `packages/connector-mock/src/index.ts`
- Evidence: unsupported clone inputs currently escape through generic
  exceptions. The public API and declarations do not define whether malformed
  input throws, returns a failure, or notifies error observers.
- Why it matters: consumers cannot handle failure predictably, arbitrary
  native errors may leak, and listener-isolation guarantees do not define this
  input boundary.
- Minimal fix: choose one consistent behavior compatible with the existing
  public API. Prefer a typed `MockConnectorInputError` if retaining a throwing
  method; guarantee no event delivery or lifecycle mutation and isolate any
  optional error-observer notification.
- Next-milestone impact: blocks Milestone 2.

### Medium — declaration checks execute but do not cover the required public API failures

- Files:
  - `packages/connector-core/test/declaration-consumer.ts`
  - `packages/connector-mock/test/declaration-consumer.ts`
  - `packages/event-core/test/declaration-consumer.ts`
- Evidence: all three declaration-test scripts run and use package-name
  imports, but negative checks are limited:
  - connector-core lacks complete invalid `ConnectorConfig`, malformed
    `ConnectionInfo`, and invalid `LiveConnector.connect()` implementation and
    return-type coverage;
  - connector-mock lacks invalid clock, event input, method misuse, and final
    rejection-contract coverage;
  - event-core lacks malformed `NormalizationResult` discriminator and shape
    coverage.
- Why it matters: public contract regressions can compile unnoticed despite
  the presence of executable declaration suites.
- Minimal fix: add package-name negative checks for every specified public
  shape and ensure every `@ts-expect-error` is included in the declaration
  compilation.
- Next-milestone impact: blocks Milestone 2.

### Medium — required runtime regressions remain incomplete

- Files:
  - `packages/connector-mock/test/**`
  - `packages/event-core/test/**`
- Evidence:
  - the observer regression does not actually throw during both disconnect
    and destroy transitions;
  - infinity coverage does not test both signs across all relevant gift and
    like fields;
  - permanent tests are missing for an invalid supplied `occurredAt`, a clock
    failing after an earlier successful read, functions, symbols, all listed
    non-plain objects, dangerous property keys, and unchanged lifecycle/no
    delivery after each rejection.
- Why it matters: the remaining production failures were not caught by the
  claimed regression suite.
- Minimal fix: add the missing cases without replacing any valid existing
  coverage.
- Next-milestone impact: blocks Milestone 2.

### Low — current handoff evidence and version references are stale

- Files:
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-01.md`
  - `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-02.md`
- Evidence:
  - earlier current-state handoffs retain pnpm `11.15.1` or mixed-version
    wording;
  - the REWORK-02 handoff's Git inventory does not match the full current
    working tree;
  - it claims all findings are resolved despite the defects above.
- Fresh evidence: Node.js `v24.15.0`, pnpm `11.9.0`.
- Minimal fix: distinguish historical snapshots from current evidence, correct
  the REWORK-02 inventory, remove unsupported resolution claims, and record
  only the fresh current tool versions.
- Next-milestone impact: does not independently block Milestone 2.

## Approved EventNormalizer behavior

The following REWORK-02 behavior is approved and must be preserved:

- all four successful normalization paths use their specialized schema and
  `LiveEventEnvelopeSchema`;
- raw like milestones are not interpreted or propagated and normalized
  milestone remains `null`;
- invalid present sender fields return typed failures without fabricating an
  anonymous user;
- absent or null sender maps to `user: null`;
- gift streakability is required and type checked;
- neutral gift streak output remains `{ id: null, status: "single" }`;
- decimal nonnegative diamond values remain valid;
- zero like totals remain valid;
- no aggregation, deduplication, gift-streak state, or like-milestone state is
  implemented.

## Previous-finding resolution summary

| Area | Result |
| --- | --- |
| EventNormalizer semantics and public-union validation | Resolved |
| No fabricated sender, streak, or milestone facts | Resolved |
| Numeric contract alignment | Resolved |
| Repeated connect returns original connection info | Resolved |
| General listener isolation | Resolved |
| Destroy cleanup and idempotency | Resolved, except post-destroy stream-ended transition |
| Atomic lifecycle timestamp handling | Not resolved |
| Supplied timestamp validation | Not resolved |
| Safe assertion-free raw clone boundary | Not resolved |
| Defined malformed-input behavior | Not resolved |
| Executable declaration suites | Resolved |
| Complete declaration coverage | Not resolved |
| Complete runtime regression coverage | Not resolved |
| Current documentation evidence | Not resolved |

## Fresh verification results

| Check | Result |
| --- | --- |
| `git diff --check HEAD --` | Passed |
| Connector-core lint | Passed |
| Connector-core typecheck | Passed |
| Connector-core build | Passed |
| Connector-core declaration tests | Passed |
| Connector-core runtime tests | 2 passed |
| Connector-mock lint | Passed |
| Connector-mock typecheck | Passed |
| Connector-mock build | Passed |
| Connector-mock declaration tests | Passed |
| Connector-mock runtime tests | 8 passed |
| Event-core lint | Passed |
| Event-core typecheck | Passed |
| Event-core build | Passed |
| Event-core declaration tests | Passed |
| Event-core runtime tests | 14 passed |
| Contracts runtime tests | 175 passed across 7 files |
| Contracts declaration tests | Passed |
| Repository lint | Passed |
| Repository typecheck | Passed |
| Repository tests | 201 passed across 11 files |
| Repository build | Passed |

Passing commands do not override the independently reproduced lifecycle and
clone-boundary defects or the missing permanent coverage.

## Declaration, dist, scope, and documentation assessment

- Emitted declarations use clean package-name imports with no source-relative
  leakage.
- The focused declaration configurations execute, but their negative public
  contract coverage remains incomplete.
- Dist output is limited to expected package artifacts.
- No provider-specific types leak through connector-core.
- No Milestone 2 deduplication, gift streak aggregation, like aggregation,
  real networking, action delivery, persistence, authentication, or UI was
  introduced.
- Milestone 1 remains `PARTIAL`.
- Milestone 2 remains blocked pending successful rework and independent
  re-review.

## Verdict

**REQUEST CHANGES**

The approved EventNormalizer behavior must remain unchanged. Approval is
blocked by non-atomic lifecycle timestamps, post-destroy stream-ended
transitions, unvalidated supplied timestamps, the unsafe clone boundary,
undefined malformed-input behavior, incomplete declaration and runtime
coverage, and inaccurate current documentation.

