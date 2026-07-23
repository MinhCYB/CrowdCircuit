# FOUND-02F Codex Review 02

## Review basis

- Task: `FOUND-02F-REWORK-01`
- Parent task: `FOUND-02F`
- Review type: independent re-review of the complete accumulated working tree
- Base commit: `85a7d3b` (`feat: complete FOUND-02E voice protocol contracts`)
- Scope: all tracked changes and untracked files
- Implementation commit: not required for this working-tree review
- Initial-review mutation policy: no files were modified
- Review date: 2026-07-23

## Repository and working-tree evidence

Fresh evidence:

- Branch: `main`
- HEAD: `85a7d3b`
- `main` synchronized with `origin/main`
- Working tree: accumulated uncommitted FOUND-02F and REWORK-01 changes
- Node.js: `v24.15.0`
- pnpm: `11.9.0`
- `git diff --check HEAD --`: passed

The review inspected the complete diff and untracked inventory, source
fixtures, integration and declaration tests, package metadata, SDK consumer
files, emitted declarations, emitted JavaScript, dist inventories, and current
execution and handoff documentation.

## Findings

### High — exported deepFreeze is not cycle-safe and relies on prohibited assertions

- File: `packages/contracts/src/fixtures/index.ts:37`
- Current implementation:

  ```ts
  export function deepFreeze<T>(obj: T): DeepReadonly<T> {
    if (obj === null || typeof obj !== "object") {
      return obj as DeepReadonly<T>;
    }
    const frozen = Object.isFrozen(obj) ? obj : Object.freeze(obj);
    for (const key of Reflect.ownKeys(frozen)) {
      const val = Reflect.get(frozen, key);
      if (val !== null && (typeof val === "object" || typeof val === "function")) {
        deepFreeze(val);
      }
    }
    return frozen as DeepReadonly<T>;
  }
  ```

- Independent evidence:
  - all 14 actual acyclic canonical fixture graphs are deeply frozen;
  - an already shallow-frozen parent still has its child visited and frozen;
  - a cyclic object causes:

    ```text
    RangeError: Maximum call stack size exceeded
    ```

  - production code retains:
    - `obj as DeepReadonly<T>`;
    - `frozen as DeepReadonly<T>`.

- Additional public-surface evidence:
  - `deepFreeze` and `DeepReadonly` are emitted from
    `packages/contracts/dist/fixtures/index.d.ts`;
  - the fixtures barrel is re-exported from the package root;
  - the helper is therefore public through both
    `@crowdcircuit/contracts` and `@crowdcircuit/contracts/fixtures`.

- Why it matters: REWORK-01 explicitly required infinite-recursion avoidance
  and prohibited unsafe assertions. The exported helper claims general
  recursive freezing but fails cyclic graphs. Its source comment also says it
  does not mutate inputs even though `Object.freeze` changes the supplied
  object's integrity state.
- Minimal fix:
  - make `deepFreeze` internal;
  - do not export a new `DeepReadonly` contract;
  - use `WeakSet<object>` or equivalent cycle tracking;
  - recurse into descendants even when a parent is already shallow-frozen;
  - remove unsafe return assertions;
  - document in-place freezing honestly;
  - preserve the already-correct exact readonly fixture declarations.
- Next-task impact: blocks FOUND-02F approval and FOUND-03A.

### Medium — SDK resolution check still emits runtime behavior

- Files:
  - `packages/game-sdk-js/src/contracts-resolution.check.ts:1`
  - `packages/game-sdk-js/dist/contracts-resolution.check.js`
- Source evidence:

  ```ts
  import { CANONICAL_GAME_ACTION_ENVELOPE } from
    "@crowdcircuit/contracts/fixtures";

  const _verifyResolution = CANONICAL_GAME_ACTION_ENVELOPE;
  console.log(_verifyResolution.actionId);
  ```

- Emitted evidence:

  ```js
  import { CANONICAL_GAME_ACTION_ENVELOPE } from
    "@crowdcircuit/contracts/fixtures";
  const _verifyResolution = CANONICAL_GAME_ACTION_ENVELOPE;
  console.log(_verifyResolution.actionId);
  ```

- Resolved aspect: `packages/game-sdk-js/dist/index.js` and `index.d.ts`
  expose only `GAME_SDK_VERSION`; no verification symbol leaks through the
  barrel.
- Unresolved aspect: the compile-check module is emitted into SDK `dist` with
  a runtime fixture dependency and side effect.
- Why it matters: the task requires a genuinely compile-only package-resolution
  proof with no fixture runtime import or behavior.
- Minimal fix: use only `import type` or `typeof import(...)` type queries for
  both package entry points, or integrate the check through a no-emit
  configuration. If contracts are compile-only, place the workspace dependency
  in `devDependencies`.
- Next-task impact: blocks FOUND-02F approval and FOUND-03A.

### Low — current handoff evidence is not fully reconciled

- Files:
  - `docs/handoffs/HANDOFF-FOUND-02F.md:69`
  - `docs/handoffs/HANDOFF-FOUND-02F-REWORK-01.md:93`
- Evidence:
  - the original current-task handoff still records pnpm `11.15.1`;
  - the REWORK-01 handoff says it reconciled that document, but the stale
    value remains;
  - its Git-status snapshot classifies accumulated untracked files as modified
    and omits the untracked review and prompt.
- Resolved documentation:
  - `PROJECT_STATUS.md` records Node.js `v24.15.0` and pnpm `11.9.0`;
  - FOUND-02F remains awaiting re-review;
  - FOUND-03A remains blocked;
  - the inventory correctly describes four required representative LIVE
    fixtures rather than all ten LIVE variants.
- Minimal fix: reconcile current FOUND-02F handoffs with fresh versions and
  exact Git evidence, without rewriting unrelated historical reports.
- Next-task impact: mechanical after the two implementation findings.

## Previous-finding resolution matrix

| Previous finding | Result | Evidence |
| --- | --- | --- |
| All 14 canonical fixtures recursively immutable at runtime | Resolved for actual fixture graphs | Every exported fixture and all inspected descendants are frozen; required mutations throw and values remain unchanged. |
| Already-frozen parent must not bypass mutable child | Resolved | Independent probe froze the initially mutable child beneath an already-frozen parent. |
| Avoid infinite recursion | Not resolved | A cyclic object produces `RangeError: Maximum call stack size exceeded`. |
| No unsafe production assertions | Not resolved | Two `as DeepReadonly<T>` return assertions remain. |
| Exact narrow fixture literals | Resolved | Emitted declarations preserve event, action, result, voice, message, and callback literals. |
| Recursively readonly declarations | Resolved | Nested properties and arrays emit readonly. |
| Exact completed/failed variants | Resolved | Declarations expose exact `"completed"` and `"failed"` status values. |
| Specialized action params | Resolved | Params emit as readonly `{ spawnCount: number }`. |
| Root and fixtures-subpath declarations | Resolved | Both package-name paths compile and resolve. |
| SDK barrel pollution | Resolved | SDK index exports only `GAME_SDK_VERSION`. |
| Genuinely compile-only SDK check | Not resolved | Emitted check JavaScript imports a fixture and logs. |
| All four callbacks through public union | Resolved | Started, finished, interrupted, and failed all parse through the callback union. |
| Tool versions and Git evidence | Partially resolved | Execution status is correct; handoff evidence remains stale/inaccurate. |

## Deep immutability assessment

Independent recursive probes found exactly 14 canonical fixture exports. For
each fixture, every reachable object and array was frozen.

Verified frozen descendants include:

- gift payload and nested gift;
- shared user and roles array;
- action params;
- action actor;
- action trigger;
- voice variables;
- completed result details;
- failed result error.

The permanent mutation tests verify that mutation attempts throw and do not
contaminate later schema parsing. The actual fixture values are therefore
deeply immutable.

The recursion algorithm does not use `Object.isFrozen` as an early return, so
pre-frozen parents do not bypass descendant traversal. Its remaining flaw is
the lack of visited-object tracking for cycles.

## Exact declaration assessment

`packages/contracts/dist/fixtures/index.d.ts` correctly preserves:

- exact event types;
- exact `actionType: "SPAWN_ZOMBIE"`;
- exact completed and failed statuses;
- exact `kind: "thank_gift"`;
- exact receipt, voice-play, and callback message types;
- recursively readonly nested properties;
- readonly arrays;
- specialized action parameters.

Fixtures remain assignable to the intended public schemas, result variants,
event unions, and callback union. Declaration tests cover imports through both
the package root and fixtures subpath and retain prior LIVE, action, and voice
regressions.

No `any` or `z.any()` was introduced. The remaining unsafe type mechanisms
are the two `as DeepReadonly<T>` assertions in the public helper.

## Runtime and schema compatibility

- All 14 canonical fixtures parse through their intended specialized schemas.
- Representative LIVE fixtures parse through the public LIVE event union.
- Completed and failed results parse through the public result union.
- All four playback callbacks parse through
  `VoicePlaybackCallbackMessageSchema`.
- Negative near-miss tests use independent shallow copies or independent
  values and do not contaminate the shared frozen fixtures.
- Failed mutation attempts leave fixtures unchanged and parseable.

## SDK compile-check and packaging assessment

Verified:

- SDK public JavaScript exports only `GAME_SDK_VERSION`;
- SDK public declaration exports only `GAME_SDK_VERSION`;
- no verification alias or fixture value is exported from the SDK barrel;
- dependency direction remains `game-sdk-js -> contracts`;
- no circular project reference exists;
- both contracts package entry points resolve;
- root and subpath fixture identities match;
- contracts dist contains no test artifacts.

Unresolved:

- `contracts-resolution.check.js` is emitted into SDK dist;
- it has a runtime contracts-fixture import;
- it executes `console.log`;
- it therefore is not a compile-only check.

## Fresh verification results

- Contracts lint: passed
- Contracts typecheck: passed
- Contracts tests: 173 passed across 7 files
- Contracts forced build: passed
- Contracts declaration tests: passed
- Game SDK build: passed
- Repository lint: passed
- Repository typecheck: passed
- Repository tests: 175 passed across 8 files
- Repository build: passed
- `git diff --check HEAD --`: passed

## Scope and documentation assessment

- FOUND-02F remains PARTIAL/IN_PROGRESS pending re-review.
- FOUND-03A remains blocked.
- No FOUND-03A implementation was introduced.
- Four required representative LIVE fixtures are accurately identified.
- Fresh versions are Node.js `v24.15.0` and pnpm `11.9.0`.
- Current handoff version and Git-status evidence still require reconciliation.

## Verdict

**REQUEST CHANGES**

The canonical fixtures and their declarations are now correct. The remaining
blockers are narrowly limited to the internal cycle-safe assertion-free
freezer, the genuinely type-only SDK resolution check, and mechanical current
documentation reconciliation. FOUND-03A remains blocked.
