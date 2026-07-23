# Gemini Implementation Prompt — FOUND-02F REWORK-01

## Task and objective

Task ID: `FOUND-02F-REWORK-01`

Address only the verified FOUND-02F findings:

1. make every exported canonical fixture recursively immutable at runtime;
2. emit exact, recursively readonly public fixture types;
3. isolate cross-workspace package-name verification from the SDK public and
   runtime API;
4. complete public-union integration coverage;
5. reconcile current FOUND-02F documentation.

Preserve the complete accumulated FOUND-02F working tree. Do not begin
FOUND-03A. Do not commit or push, and do not request an intermediate commit.

## Required reading order

Read in this order before changing anything:

1. `docs/orchestration/reviews/FOUND-02F-CODEX-REVIEW-01.md`
2. `docs/orchestration/prompts/FOUND-02F-GEMINI.md`
3. `docs/handoffs/HANDOFF-FOUND-02F.md`
4. `docs/tasks/FOUND-02F.md`
5. `docs/execution/PROJECT_STATUS.md`
6. `docs/execution/CURRENT_TASK.md`
7. `docs/execution/ROADMAP.md`
8. `docs/execution/DECISIONS.md`
9. `docs/execution/KNOWN_ISSUES.md`
10. `packages/contracts/src/fixtures/index.ts`
11. `packages/contracts/test/fixtures-integration.test.ts`
12. `packages/contracts/test/declaration-consumer.ts`
13. `packages/contracts/package.json`
14. `packages/contracts/src/index.ts`
15. `packages/game-sdk-js/package.json`
16. `packages/game-sdk-js/tsconfig.json`
17. `packages/game-sdk-js/src/index.ts`
18. Current emitted contracts fixture declarations and game SDK output

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
- `packages/contracts/src/index.ts`
- `packages/contracts/package.json`
- `packages/contracts/test/fixtures-integration.test.ts`
- `packages/contracts/test/declaration-consumer.ts`
- one isolated game SDK compile-check file
- `packages/game-sdk-js/src/index.ts` only to remove verification-only exports
- `packages/game-sdk-js/package.json`
- `packages/game-sdk-js/tsconfig.json`
- `pnpm-lock.yaml` only as required by workspace dependency metadata
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/handoffs/HANDOFF-FOUND-02F.md`
- `docs/handoffs/HANDOFF-FOUND-02F-REWORK-01.md`

Do not alter unrelated historical reports or unrelated packages.

## A. Runtime-deep immutable canonical fixtures

Every exported canonical fixture must be recursively immutable at runtime.

Requirements:

- freeze the complete reachable fixture object graph;
- freeze top-level and all nested:
  - payload objects;
  - gift objects;
  - arrays;
  - user roles;
  - actor;
  - trigger;
  - params;
  - variables;
  - completed-result details;
  - failed-result error objects;
- do not mutate shared input objects while constructing fixtures;
- avoid infinite recursion;
- handle only the JSON-safe fixture graph required by the contracts;
- do not add an external dependency solely for deep freezing.

Use a small, focused, type-safe deep-freeze mechanism appropriate for this
JSON-safe fixture graph. Do not introduce `any`, unsafe assertions,
`z.any()`, or an unchecked escape hatch.

Add permanent runtime regression tests proving mutation is prevented for:

- a top-level fixture field;
- a nested gift payload field;
- a nested array, including user roles;
- action params;
- action actor;
- action trigger;
- voice variables;
- completed-result details;
- failed-result error fields.

Each test must confirm:

- the mutation throws or is otherwise prevented under the repository's ESM
  strict-mode behavior;
- the shared exported fixture remains unchanged;
- the unchanged fixture still parses through its intended schema.

Do not write mutation tests that permanently contaminate shared exported
fixtures.

## B. Exact recursively readonly public fixture types

Fixture declarations must preserve exact literals and recursive readonly
behavior.

Requirements:

- do not explicitly widen fixtures to broad public union types;
- preserve exact discriminators and useful literals, including:
  - `status: "completed"`;
  - `status: "failed"`;
  - `kind: "thank_gift"`;
  - `actionType: "SPAWN_ZOMBIE"`;
  - `type: "game.action.received"`;
  - `type: "voice.play"`;
  - every `playback.*` callback literal;
  - specialized `{ spawnCount: number }` action params;
- expose recursively readonly properties and arrays in emitted declarations;
- still validate every fixture against its intended public schema;
- prefer literal-preserving conformance using `satisfies` or an equivalent safe
  pattern;
- do not use unsafe assertions, `any`, or `z.any()` to force types.

It is acceptable to use safe `as const` literal preservation if necessary,
provided it is not used to bypass schema compatibility and the fixture is
independently checked against the public schema/type.

Add package-name declaration tests proving:

- exact fixture literals remain narrow;
- completed and failed result fixtures are not exposed as the whole result
  union;
- each callback fixture retains its exact discriminator;
- the action fixture preserves its specialized params;
- top-level and nested fixture fields are readonly;
- arrays are readonly;
- mutation assignments fail with `@ts-expect-error`;
- invalid literal assignments fail;
- each fixture remains assignable to its intended public contract or union;
- imports work from:
  - `@crowdcircuit/contracts`;
  - `@crowdcircuit/contracts/fixtures`.

Retain every prior LIVE, action, and voice declaration regression.

## C. Remove SDK production API pollution

Remove from the public and runtime SDK API:

- `VERIFY_CONTRACTS_RESOLUTION`;
- `GameSdkActionEnvelope` and `GameSdkEventEnvelope` verification-only aliases;
- every runtime fixture import used solely for compile verification.

Preserve cross-workspace package-name resolution verification in an isolated
compile-only check or dedicated consumer test.

Requirements:

- import from package names, never contracts source paths;
- verify the `@crowdcircuit/contracts` root;
- verify `@crowdcircuit/contracts/fixtures` where appropriate;
- the check must not be exported from the SDK barrel;
- the built SDK runtime exports must remain limited to its intended current
  API, presently `GAME_SDK_VERSION`;
- the built SDK JavaScript must not import a fixture value solely for
  verification;
- do not add SDK runtime behavior;
- do not implement BE-08 or FOUND-03A.

Keep the dependency direction `game-sdk-js -> contracts`. Confirm there is no
circular project reference.

## D. Complete union integration coverage

Every canonical fixture belonging to a public union must parse through that
union.

Add the missing runtime coverage for:

- `CANONICAL_VOICE_PLAYBACK_FINISHED_MESSAGE` through
  `VoicePlaybackCallbackMessageSchema`;
- `CANONICAL_VOICE_PLAYBACK_INTERRUPTED_MESSAGE` through
  `VoicePlaybackCallbackMessageSchema`.

Retain started and failed union coverage.

Add declaration checks proving each of the four callback fixtures:

- retains its exact callback discriminator;
- remains assignable to `VoicePlaybackCallbackMessage`.

Do not remove valid existing fixture, domain, or integration coverage.

## E. Documentation reconciliation

Correct current FOUND-02F documentation to record:

- Node.js `v24.15.0`;
- pnpm `11.9.0`;
- FOUND-02F remains `PARTIAL` or `IN_PROGRESS`, awaiting independent
  re-review;
- FOUND-03A remains blocked;
- `pnpm-lock.yaml` appears in changed-file and Git-status evidence when fresh
  Git output reports it;
- the fixture inventory includes four required representative LIVE fixtures
  across the event contract family, not all ten LIVE variants;
- runtime and type immutability are claimed only after the new tests,
  declarations, and probes verify them.

Update:

- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/handoffs/HANDOFF-FOUND-02F.md`

Preserve historical review reports as historical records.

## F. Regression and packaging preservation

Requirements:

- retain all previous contract tests;
- do not remove or replace valid tests;
- root and fixtures-subpath runtime imports must work after build;
- declaration imports must work through both package paths;
- contracts `dist` must be clean;
- inspect SDK public declarations and runtime exports after build;
- no fixture, test, declaration-consumer, or compile-check artifact may leak
  unexpectedly into package output;
- do not introduce duplicate domain contract definitions.

The exact fixture inventory remains 14 unless a verified task requirement
requires otherwise. Do not add fixtures for the other six LIVE variants solely
to satisfy an inaccurate “all LIVE events” claim.

## Contract invariants

- Runtime schemas remain the source of truth for fixture validity.
- All canonical values remain JSON-safe.
- Required-nullable fields remain present.
- Action params remain specialized and JSON-safe.
- Completed and failed results remain correctly discriminated.
- Public callback literals remain exactly the approved `playback.*` family.
- Existing strict-object and nullable behavior remains unchanged.
- No production contract behavior outside fixture immutability changes.
- No `any`, `z.any()`, unsafe assertion, or unchecked escape hatch.

## Explicit exclusions

- No FOUND-03A implementation.
- No connector, normalizer, mapping, Socket.IO, TTS, UI, or database work.
- No BE-08 SDK implementation.
- No unrelated contract refactor.
- No new external deep-freeze dependency.
- No removal of valid regression coverage.
- No commit or push.
- No intermediate commit request.

## Required focused verification

Run focused fixture tests and declaration checks first. Then run:

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

Run and record:

- runtime imports from `@crowdcircuit/contracts`;
- runtime imports from `@crowdcircuit/contracts/fixtures`;
- runtime deep-immutability probes for all required nested categories;
- the isolated game SDK package-name consumer check;
- duplicate-definition searches for `LiveEventEnvelope`,
  `GameActionEnvelope`, `VoiceIntent`, and external `specVersion`-bearing
  domain schemas.

Record exact fresh test counts.

## Declaration and dist inspection

Inspect:

- `packages/contracts/dist/index.d.ts`
- `packages/contracts/dist/fixtures/index.d.ts`
- `packages/contracts/dist/fixtures/index.js`
- `packages/game-sdk-js/dist/index.d.ts`
- `packages/game-sdk-js/dist/index.js`
- the complete contracts and SDK dist inventories

Confirm:

- fixture declarations are exact and recursively readonly;
- completed and failed fixtures have exact status types;
- action and voice literals remain narrow;
- root and fixtures-subpath declarations resolve;
- contracts dist contains no tests or declaration fixtures;
- SDK runtime exports only intended API;
- SDK output has no verification-only runtime fixture import or export;
- isolated compile-check artifacts do not become public package API.

## Handoff

Create:

`docs/handoffs/HANDOFF-FOUND-02F-REWORK-01.md`

The handoff must include:

- actual base commit and accumulated working-tree state;
- exact files changed and created;
- the 14-fixture inventory, identifying the four required representative LIVE
  fixtures;
- deep-freeze implementation and recursion boundary;
- runtime mutation test and probe results;
- exact public fixture type strategy;
- declaration tests for root and subpath imports;
- SDK compile-check isolation and built SDK export inspection;
- completed union coverage;
- duplicate-definition search commands and results;
- fresh Node.js and pnpm versions;
- exact package, SDK, and repository verification results and test counts;
- contracts and SDK dist inspection;
- `git diff --check` result;
- exact `git status` at handoff-generation time, including
  `pnpm-lock.yaml` when reported;
- confirmation that FOUND-02F remains awaiting independent re-review;
- confirmation that FOUND-03A was not started;
- confirmation that no commit or push occurred.

## Final response format

Return:

1. Summary of each rework area.
2. Files modified or created.
3. Deep runtime immutability approach and mutation results.
4. Exact recursively readonly declaration approach.
5. Root and fixtures-subpath declaration/import results.
6. SDK isolation and final built SDK exports.
7. Union coverage added.
8. Fixture inventory clarification.
9. Package verification and exact test count.
10. Game SDK verification.
11. Repository verification and exact test count.
12. Declaration and dist assessment.
13. Documentation and handoff updates.
14. Final Git status.
15. Handoff path.
16. Explicit confirmation: no FOUND-03A, no commit, and no push.
