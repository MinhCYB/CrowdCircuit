# FOUND-02F Codex Review 01

## Review basis

- Task: `FOUND-02F`
- Review type: independent review of the complete accumulated working tree
- Base commit: `85a7d3b` (`feat: complete FOUND-02E voice protocol contracts`)
- Scope: tracked changes and all untracked files
- Implementation commit: not required for this working-tree review
- Initial-review mutation policy: no files were modified
- Review date: 2026-07-23

## Repository and working-tree evidence

Fresh repository evidence:

- Branch: `main`
- HEAD: `85a7d3b`
- `main` synchronized with `origin/main`
- Working tree: uncommitted FOUND-02F implementation
- Node.js: `v24.15.0`
- pnpm: `11.9.0`
- `git diff --check HEAD --`: passed

The review inspected:

- `git status`
- `git diff HEAD --stat`
- `git diff HEAD --`
- `git diff --check HEAD --`
- `git ls-files --others --exclude-standard`
- all required task, prompt, handoff, execution, and decision documents
- source fixtures and integration tests
- package export maps
- declaration tests
- the game SDK consumer change
- emitted declarations and JavaScript
- built SDK output
- actual runtime package-name imports

## Findings

### High — canonical fixtures are not recursively immutable

- File: `packages/contracts/src/fixtures/index.ts:21`
- Evidence: exported fixtures use `Object.freeze` at the top level and on a
  few shared objects, but their complete reachable object graphs are not
  frozen.
- Independent `Object.isFrozen` probes:

  ```text
  gift top: true
  gift payload: false
  gift nested gift: false
  user: true
  user roles: false
  action top: true
  action params: false
  action actor: false
  action trigger: false
  voice top: true
  voice variables: false
  failed result top: true
  failed result error: false
  ```

- Independent mutations succeeded:

  ```text
  action.params.spawnCount = 99
  voice.variables.count = 99
  failedResult.error.message = "changed"
  ```

- Top-level mutation threw a `TypeError`, confirming shallow rather than
  recursive freezing.
- Why it matters: shared exported canonical fixtures can be contaminated by a
  consumer or test, changing later parse results and invalidating their role
  as stable canonical values. The source comments and handoff claim
  immutability that the runtime does not provide.
- Minimal fix: recursively freeze the complete JSON-safe fixture graph,
  including objects and arrays, without mutating caller-owned inputs or adding
  a dependency. Add permanent top-level and nested mutation regressions.
- Next-task impact: blocks FOUND-02F approval and FOUND-03A.

### High — emitted fixture types are broad and mutable rather than exact and recursively readonly

- Files:
  - `packages/contracts/src/fixtures/index.ts:43`
  - `packages/contracts/dist/fixtures/index.d.ts`
  - `packages/contracts/test/declaration-consumer.ts:1262`
- Evidence: source fixtures are explicitly annotated with broad public types,
  and emitted declarations include:

  ```ts
  CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE: GameActionResultMessage
  CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE: GameActionResultMessage
  CANONICAL_VOICE_INTENT: VoiceIntent
  CANONICAL_GAME_ACTION_ENVELOPE: GameActionEnvelope<{ spawnCount: number }>
  ```

- Consequences:
  - completed and failed fixtures expose the whole result union rather than
    their exact `status` variants;
  - voice intent `kind` widens to the whole kind union;
  - action literal values such as `actionType` widen to `string`;
  - nested properties remain writable at compile time;
  - declaration tests assign broad fixtures to broad types but do not prove
    literal preservation, readonly behavior, invalid assignments, or the
    fixtures subpath.
- Why it matters: the public fixture API does not provide the exact,
  discriminated, immutable compile-time values required by the task and
  prompt.
- Minimal fix: use literal-preserving schema conformance such as `satisfies`
  with an assertion-free recursively readonly representation. Add package-name
  declaration tests for exact literals, nested readonly assignments, invalid
  assignments, and both package entry points.
- Next-task impact: blocks FOUND-02F approval and FOUND-03A.

### Medium — compile-only SDK verification pollutes production SDK exports

- File: `packages/game-sdk-js/src/index.ts:8`
- Evidence: the SDK barrel exports:

  ```ts
  GameSdkActionEnvelope
  GameSdkEventEnvelope
  VERIFY_CONTRACTS_RESOLUTION
  ```

  The built JavaScript imports the canonical fixture at runtime, and the built
  SDK runtime exports are:

  ```text
  GAME_SDK_VERSION
  VERIFY_CONTRACTS_RESOLUTION
  ```

- Why it matters: a compile-only resolution proof has become premature public
  SDK API and runtime behavior before BE-08. It also introduces a runtime
  fixture dependency solely for verification.
- Minimal fix: move the package-name proof to an isolated, non-exported
  compile-check file or dedicated consumer test. The SDK barrel and runtime
  output must retain only the intended current API.
- Next-task impact: blocks FOUND-02F approval and FOUND-03A.

### Medium — union integration coverage is incomplete

- File: `packages/contracts/test/fixtures-integration.test.ts`
- Evidence: all four playback callbacks parse through their specialized
  schemas, but only `playback.started` and `playback.failed` are parsed through
  `VoicePlaybackCallbackMessageSchema`.
- Missing:
  - `playback.finished` through the public callback union;
  - `playback.interrupted` through the public callback union;
  - declaration checks proving every callback fixture retains its exact
    discriminator while remaining assignable to the public callback union.
- Why it matters: the task requires every canonical fixture belonging to a
  public union to be verified through that union.
- Minimal fix: add the two runtime union cases and exact declaration checks
  without removing existing coverage.
- Next-task impact: blocks FOUND-02F approval and FOUND-03A.

### Low — current FOUND-02F documentation is stale or overstated

- Files:
  - `docs/execution/PROJECT_STATUS.md:16`
  - `docs/handoffs/HANDOFF-FOUND-02F.md:11`
  - `docs/handoffs/HANDOFF-FOUND-02F.md:69`
  - `docs/handoffs/HANDOFF-FOUND-02F.md:105`
- Evidence:
  - current documentation records pnpm `11.15.1`; fresh output is `11.9.0`;
  - the handoff calls all 14 fixtures immutable, which runtime and declaration
    probes disprove;
  - its Git-status snapshot omits modified `pnpm-lock.yaml`;
  - any wording implying all ten LIVE event variants have fixtures would be
    inaccurate.
- Clarification: FOUND-02F explicitly requires four representative LIVE
  fixtures—gift, comment, like milestone, and follow. The implementation has
  those four. The task does not require fixtures for all ten specialized LIVE
  variants.
- Minimal fix: record fresh tool versions, accurate current status, four
  required representative LIVE fixtures, and PARTIAL/blocked state without
  claiming immutability before it is verified.
- Next-task impact: blocks clean closure but is mechanical after the contract
  findings are resolved.

## Fixture inventory and acceptance-criteria assessment

Fourteen fixtures exist:

### Required representative LIVE fixtures

1. `CANONICAL_GIFT_SENT_EVENT`
2. `CANONICAL_CHAT_COMMENT_EVENT`
3. `CANONICAL_ENGAGEMENT_LIKE_EVENT`
4. `CANONICAL_SOCIAL_FOLLOW_EVENT`

### Action fixtures

5. `CANONICAL_GAME_ACTION_ENVELOPE`
6. `CANONICAL_GAME_ACTION_RECEIVED_MESSAGE`
7. `CANONICAL_GAME_ACTION_COMPLETED_RESULT_MESSAGE`
8. `CANONICAL_GAME_ACTION_FAILED_RESULT_MESSAGE`

### Voice fixtures

9. `CANONICAL_VOICE_INTENT`
10. `CANONICAL_VOICE_PLAY_MESSAGE`
11. `CANONICAL_VOICE_PLAYBACK_STARTED_MESSAGE`
12. `CANONICAL_VOICE_PLAYBACK_FINISHED_MESSAGE`
13. `CANONICAL_VOICE_PLAYBACK_INTERRUPTED_MESSAGE`
14. `CANONICAL_VOICE_PLAYBACK_FAILED_MESSAGE`

The four LIVE fixtures match the exact representative list in
`docs/tasks/FOUND-02F.md`. Fixtures for every one of the ten LIVE variants are
not required. All three contract families are represented.

Runtime values contain their required nullable properties, JSON-safe values,
specialized `{ spawnCount: number }` action parameters, correct completed and
failed result data, and only approved `playback.*` public callback literals.

## Immutability assessment

Current fixture behavior is:

- compile-time readonly: no;
- shallow runtime freeze: yes;
- recursive runtime immutability: no.

Because these are shared canonical fixtures and the implementation explicitly
uses `Object.freeze` and claims immutability, the task requirement must be
satisfied as recursive runtime immutability plus recursively readonly public
fixture types. The current implementation satisfies neither complete form.

Negative integration tests create shallow near-miss copies and do not mutate
the exported top-level fixture values directly. This is good, but does not
protect against nested shared mutation by other consumers.

## Export and cross-workspace assessment

Verified working:

- runtime import from `@crowdcircuit/contracts`;
- runtime import from `@crowdcircuit/contracts/fixtures`;
- root and subpath imports resolve to the same fixture identity;
- export-map paths resolve to built JavaScript and declarations;
- package-root and fixtures-subpath output exists;
- no source-only import is required;
- no contracts test artifact leaked into `dist`;
- dependency direction is `game-sdk-js -> contracts`;
- no circular TypeScript project reference exists;
- the SDK build resolves contracts through the package name.

The blocking cross-workspace issue is production SDK export/runtime pollution,
not resolution failure.

## Declaration and dist assessment

- `packages/contracts/dist/index.d.ts` exports the fixtures barrel.
- `packages/contracts/dist/fixtures/index.d.ts` and `.js` exist.
- Root and fixtures-subpath runtime imports succeed.
- Fixture declarations are broad and mutable, so exact literal and readonly
  acceptance is not met.
- Declaration tests import all fixtures from the root but do not import the
  fixtures subpath.
- Declaration tests do not prove fixture immutability or invalid literal
  assignments.
- Existing prior LIVE, action, and voice declaration regressions still pass.
- Contracts `dist` contains no unexpected test or declaration-consumer files.
- Game SDK `dist` exposes the verification-only runtime value.

## Duplicate-definition and scope assessment

Independent repository searches found:

- no duplicate `LiveEventEnvelope` definition outside
  `@crowdcircuit/contracts`;
- no duplicate `GameActionEnvelope` definition outside
  `@crowdcircuit/contracts`;
- no duplicate `VoiceIntent` definition outside `@crowdcircuit/contracts`;
- no duplicate external `specVersion`-bearing domain schema.

Legitimate imports, consumers, and aliases were distinguished from duplicate
source definitions.

No FOUND-03A runtime implementation was introduced.

## Fresh verification results

- Contracts lint: passed
- Contracts typecheck: passed
- Contracts tests: 164 passed across 7 files
- Contracts forced build: passed
- Contracts package-name declaration tests: passed
- Game SDK build: passed
- Repository lint: passed
- Repository typecheck: passed
- Repository tests: 166 passed across 8 files
- Repository build: passed
- `git diff --check HEAD --`: passed

Passing commands do not resolve the immutability, declaration-contract, SDK
API, or missing union-coverage findings.

## Verdict

**REQUEST CHANGES**

FOUND-02F remains `PARTIAL` pending focused rework and independent re-review.
FOUND-03A remains blocked.
