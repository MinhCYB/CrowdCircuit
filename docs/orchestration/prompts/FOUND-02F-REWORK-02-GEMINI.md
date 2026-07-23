# Gemini Implementation Prompt — FOUND-02F REWORK-02

## Task and objective

Task ID: `FOUND-02F-REWORK-02`

Address only the remaining FOUND-02F findings:

1. make fixture deep freezing internal, cycle-safe, and assertion-free;
2. make the SDK package-resolution check genuinely compile-only;
3. reconcile current FOUND-02F documentation.

The canonical fixture values, deep immutability of their actual graphs, exact
narrow literals, recursively readonly declarations, package exports, and union
coverage are already correct. Preserve them.

Do not begin FOUND-03A. Do not commit or push. Do not request an intermediate
commit.

## Required reading order

Read in this order before changing anything:

1. `docs/orchestration/reviews/FOUND-02F-CODEX-REVIEW-02.md`
2. `docs/orchestration/reviews/FOUND-02F-CODEX-REVIEW-01.md`
3. `docs/orchestration/prompts/FOUND-02F-REWORK-01-GEMINI.md`
4. `docs/handoffs/HANDOFF-FOUND-02F.md`
5. `docs/handoffs/HANDOFF-FOUND-02F-REWORK-01.md`
6. `docs/tasks/FOUND-02F.md`
7. `docs/execution/PROJECT_STATUS.md`
8. `docs/execution/CURRENT_TASK.md`
9. `docs/execution/ROADMAP.md`
10. `packages/contracts/src/fixtures/index.ts`
11. `packages/contracts/test/fixtures-integration.test.ts`
12. `packages/contracts/test/declaration-consumer.ts`
13. `packages/contracts/package.json`
14. `packages/contracts/src/index.ts`
15. `packages/game-sdk-js/src/index.ts`
16. `packages/game-sdk-js/src/contracts-resolution.check.ts`
17. `packages/game-sdk-js/package.json`
18. `packages/game-sdk-js/tsconfig.json`
19. Current contracts fixture and game SDK dist output

Inspect the complete tracked and untracked working tree first.

## Preflight

Run and record exact output:

```text
git status
git rev-parse --short HEAD
git log -5 --oneline
git diff HEAD --stat
git diff HEAD --
git diff --check HEAD --
git ls-files --others --exclude-standard
node --version
pnpm --version
```

The independent review observed:

- base HEAD `85a7d3b`;
- Node.js `v24.15.0`;
- pnpm `11.9.0`.

Trust fresh command output if the environment differs.

## Focused allowed paths

Modify only what is necessary within:

- `packages/contracts/src/fixtures/**`
- `packages/contracts/test/fixtures-integration.test.ts`
- `packages/contracts/test/declaration-consumer.ts` only if required to prove
  removal of the public helper and preserve fixture declarations
- `packages/game-sdk-js/src/contracts-resolution.check.ts`
- an isolated game SDK no-emit tsconfig only if that design is selected
- `packages/game-sdk-js/package.json`
- `packages/game-sdk-js/tsconfig.json`
- `pnpm-lock.yaml` only for the dependency classification change
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/handoffs/HANDOFF-FOUND-02F.md`
- `docs/handoffs/HANDOFF-FOUND-02F-REWORK-01.md`
- `docs/handoffs/HANDOFF-FOUND-02F-REWORK-02.md`

Do not alter unrelated production contracts, tests, packages, or historical
review reports.

## A. Make deepFreeze internal, cycle-safe, and assertion-free

The canonical fixture values and exact readonly declarations are already
correct. Preserve them.

Requirements:

- `deepFreeze` must not be exported from:
  - `@crowdcircuit/contracts`;
  - `@crowdcircuit/contracts/fixtures`;
- keep the helper internal to the package fixture implementation;
- do not expose `DeepReadonly` as a new public contract unless an existing
  specification explicitly requires it;
- use `WeakSet<object>` or equivalent visited-object tracking;
- cyclic object graphs must not recurse indefinitely;
- do not use `Object.isFrozen` as the visited-graph mechanism;
- an already shallow-frozen parent must still have its descendants visited;
- remove:
  - `as DeepReadonly<T>`;
  - `as unknown`;
  - any other unsafe return assertion;
- do not use `any` or `z.any()`;
- the helper may freeze the provided graph in place;
- document in-place freezing honestly;
- remove the inaccurate claim that freezing does not mutate the supplied
  object's integrity state.

A viable assertion-free design is:

1. an internal recursive function accepting `object` and `WeakSet<object>`,
   returning `void`;
2. an internal generic wrapper returning the same input `T` after recursively
   freezing it;
3. fixtures supplied as literal-preserving readonly values using
   `as const satisfies ...` or an equivalent safe pattern.

The implementation must not treat shallow frozen state as proof that a graph
was already traversed.

Add focused tests proving:

- a cyclic graph does not throw `RangeError`;
- every object in the cycle becomes frozen;
- an already shallow-frozen parent still has a mutable child recursively
  frozen;
- all existing canonical nested-mutation tests remain passing;
- canonical fixtures remain unchanged and parseable after failed mutation
  attempts.

Because the freezer is internal, test it through an appropriate package-local
test boundary without exporting it as public API. A package-internal module
import is acceptable for focused implementation testing if it does not create
a public package export.

After building, verify that neither root nor fixtures-subpath declarations or
runtime exports expose:

- `deepFreeze`;
- an internal `DeepReadonly` helper.

## B. Make the SDK resolution check genuinely compile-only

Update:

`packages/game-sdk-js/src/contracts-resolution.check.ts`

Requirements:

- remove every runtime fixture value import;
- remove `console.log` and every runtime side effect;
- use only type imports or `typeof import(...)` type queries from:
  - `@crowdcircuit/contracts`;
  - `@crowdcircuit/contracts/fixtures`;
- retain meaningful compile-time resolution checks for both package entry
  points;
- do not export verification symbols from the SDK barrel;
- `packages/game-sdk-js/dist/index.js` and `index.d.ts` must continue exporting
  only `GAME_SDK_VERSION`;
- the check must not create a runtime dependency on fixture values;
- if the check is emitted, its JavaScript must contain no contracts import,
  fixture import, log, or other side effect;
- a no-emit compile-check configuration is also acceptable if it remains part
  of repository verification;
- do not implement FOUND-03A or future SDK runtime behavior.

Because contracts are used only for compile verification and do not appear in
the current SDK runtime or public declarations, inspect
`packages/game-sdk-js/package.json`. Move `@crowdcircuit/contracts` from
`dependencies` to `devDependencies` when that matches the final emitted SDK
behavior. Update `pnpm-lock.yaml` only through the normal package-manager
metadata change.

The type-only check should prove, at minimum:

- a root contract type resolves from `@crowdcircuit/contracts`;
- a fixture type resolves from `@crowdcircuit/contracts/fixtures`;
- an exact fixture discriminator or specialized params type is visible through
  the fixtures subpath.

## C. Preserve resolved behavior

Do not regress:

- recursive runtime immutability of all 14 canonical fixture graphs;
- exact narrow fixture literals;
- recursively readonly declarations;
- root and fixtures-subpath imports;
- specialized action params;
- exact completed and failed result variants;
- all four callback fixtures parsing through the public callback union;
- package export-map behavior;
- all previous LIVE, action, voice, fixture, and declaration tests;
- SDK barrel exports limited to `GAME_SDK_VERSION`.

Do not remove valid coverage.

## D. Documentation reconciliation

Update current FOUND-02F documentation to record:

- Node.js `v24.15.0`;
- pnpm `11.9.0`;
- FOUND-02F remains `PARTIAL` and awaiting independent re-review;
- FOUND-03A remains blocked;
- deep freezing is internal, assertion-free, and cycle-safe;
- the SDK resolution verification is type-only and has no runtime side effect;
- changed-file and Git-status evidence matches exact fresh Git output or is
  explicitly labeled as a historical snapshot;
- `pnpm-lock.yaml` is included when fresh Git output reports it;
- the fixture inventory remains 14, including four required representative
  LIVE fixtures.

Reconcile:

- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/handoffs/HANDOFF-FOUND-02F.md`
- `docs/handoffs/HANDOFF-FOUND-02F-REWORK-01.md`

Do not rewrite unrelated historical reports.

## Contract and packaging invariants

- Runtime schemas remain the source of truth for fixture validity.
- Fixture values remain JSON-safe.
- Required-nullable fields remain present.
- Public fixture types stay exact and recursively readonly.
- Public callback literals remain the approved `playback.*` family.
- Contracts package root and fixtures subpath remain usable.
- No new public freezer utility.
- No contracts runtime dependency in the current SDK solely for verification.
- No `any`, `z.any()`, `as unknown`, or unsafe return assertion.

## Explicit exclusions

- No FOUND-03A implementation.
- No BE-08 SDK implementation.
- No new fixture variants.
- No change to existing public event, action, or voice contract behavior.
- No unrelated refactor.
- No external deep-freeze dependency.
- No removal of valid regression tests.
- No commit or push.
- No intermediate commit request.

## Required focused verification

Run the focused cycle and shallow-frozen-parent tests first. Then run:

```text
git diff --check HEAD --

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm --filter @crowdcircuit/game-sdk-js build

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run independent probes for:

- cyclic graph freezing without `RangeError`;
- every object in that cycle frozen;
- an already-frozen parent with a previously mutable child;
- all 14 fixture graphs recursively frozen;
- root and fixtures-subpath runtime imports;
- root and fixtures-subpath declaration resolution;
- SDK public runtime exports;
- SDK emitted compile-check behavior.

Record exact fresh test counts.

## Declaration and dist inspection

Inspect:

- `packages/contracts/dist/index.d.ts`
- `packages/contracts/dist/index.js`
- `packages/contracts/dist/fixtures/index.d.ts`
- `packages/contracts/dist/fixtures/index.js`
- `packages/contracts/package.json`
- `packages/game-sdk-js/dist/index.d.ts`
- `packages/game-sdk-js/dist/index.js`
- `packages/game-sdk-js/dist/contracts-resolution.check.d.ts`, if emitted
- `packages/game-sdk-js/dist/contracts-resolution.check.js`, if emitted
- complete contracts and SDK dist inventories

Confirm:

- contracts root and fixtures subpath do not export `deepFreeze`;
- no internal `DeepReadonly` helper is exported;
- exact readonly fixture declarations remain unchanged in behavior;
- root and subpath fixture identities still match;
- contracts dist has no test artifacts;
- SDK index output contains only `GAME_SDK_VERSION`;
- emitted compile-check JavaScript, if present, has no contracts import,
  fixture import, log, or side effect;
- no verification-only public SDK declaration leaks;
- dependency classification matches runtime behavior.

## Handoff

Create:

`docs/handoffs/HANDOFF-FOUND-02F-REWORK-02.md`

The handoff must include:

- actual base commit and accumulated working-tree state;
- exact files changed and created;
- internal freezer design;
- cycle-tracking behavior;
- cycle and shallow-frozen-parent test/probe evidence;
- confirmation that public declarations do not export freezer helpers;
- preservation of exact readonly fixture declarations;
- SDK type-only resolution design;
- SDK dependency classification;
- SDK emitted output and export inspection;
- root and fixtures-subpath runtime and declaration probes;
- exact package, SDK, and repository verification results and test counts;
- contracts and SDK dist inventories/assessment;
- fresh Node.js and pnpm versions;
- `git diff --check` result;
- exact `git status` at handoff-generation time;
- confirmation that FOUND-02F remains awaiting independent re-review;
- confirmation that FOUND-03A was not started;
- confirmation that no commit or push occurred.

## Final response format

Return:

1. Internal freezer implementation summary.
2. Cycle and pre-frozen-parent evidence.
3. Public export/declaration inspection.
4. SDK type-only check and dependency classification.
5. SDK dist and public-export inspection.
6. Preserved fixture and union behavior.
7. Files modified or created.
8. Package verification and exact test count.
9. Game SDK verification.
10. Repository verification and exact test count.
11. Root/subpath resolution probes.
12. Documentation and handoff updates.
13. Final Git status.
14. Handoff path.
15. Explicit confirmation: no FOUND-03A, no commit, and no push.
