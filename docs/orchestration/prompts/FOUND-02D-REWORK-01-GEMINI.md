# FOUND-02D REWORK-01 — Gemini Flash High Prompt

## Objective

Resolve only the verified findings from the independent FOUND-02D working-tree review.

Preserve the complete existing FOUND-02D implementation in the working tree. Make focused corrections to public generic constraints, test coverage, restored LIVE declaration regressions, and current FOUND-02D documentation. Do not redesign the action contracts, implement FOUND-02E, or perform unrelated cleanup.

## Exact reading order

Read in this order:

1. Inspect the current working tree:
   - `git status`
   - `git diff --stat HEAD --`
   - `git diff HEAD --`
   - `git ls-files --others --exclude-standard`
2. `docs/orchestration/reviews/FOUND-02D-CODEX-REVIEW-01.md`
3. `docs/tasks/FOUND-02D.md`
4. `docs/handoffs/HANDOFF-FOUND-02D.md`
5. `docs/execution/PROJECT_STATUS.md`
6. `docs/execution/CURRENT_TASK.md`
7. `docs/execution/ROADMAP.md`
8. `docs/execution/DECISIONS.md`
9. `docs/execution/KNOWN_ISSUES.md`
10. Current implementation and tests:
    - `packages/contracts/src/actions/envelope.ts`
    - `packages/contracts/src/actions/lifecycle.ts`
    - `packages/contracts/src/actions/index.ts`
    - `packages/contracts/src/common/json.ts`
    - `packages/contracts/test/domain-actions.test.ts`
    - `packages/contracts/test/declaration-consumer.ts`
    - `packages/contracts/test/tsconfig.declarations.json`
    - `packages/contracts/package.json`
11. Only if needed to confirm an existing contract invariant:
    - System Design sections `11.8`, `11.9`, `12.2`, and the game-related portion of `14`

Do not read unrelated design sections or the UI/UX specification.

## Repository preflight

The FOUND-02D implementation is already present as an uncommitted working-tree change set based on `c4c3dae`. Git is the source of truth; do not discard, reset, restore, or overwrite the existing changes.

Run and report:

```powershell
git status
git rev-parse --short HEAD
git log -5 --oneline
git diff --stat HEAD --
git diff --check HEAD --
git ls-files --others --exclude-standard
node --version
pnpm --version

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations
```

Fresh independent review output was Node.js `v24.15.0` and pnpm `11.9.0`. Record only your actual fresh output.

If the working tree differs from the reviewed FOUND-02D state, identify the difference before editing. Preserve all valid existing FOUND-02D work.

## Focused allowed paths

Modify only:

- `packages/contracts/src/actions/envelope.ts`
- `packages/contracts/src/actions/lifecycle.ts` only if a related public generic constraint is present there
- `packages/contracts/test/domain-actions.test.ts`
- `packages/contracts/test/declaration-consumer.ts`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/handoffs/HANDOFF-FOUND-02D.md` only to correct current FOUND-02D facts if necessary
- `docs/handoffs/HANDOFF-FOUND-02D-REWORK-01.md`

Do not modify other production code, event contracts, package configuration, decisions, known issues, orchestration reviews, or orchestration prompts. Stop and report if a required correction cannot be made within these paths.

## A. Constrain public generic contracts to JSON-safe values

Update every exposed action generic involved, including:

- `GameActionEnvelope<TParams>`
- `GameActionDeliveryMessage<TParams>`
- `GameActionMessage<TParams>`
- Any related generic base or alias exposed publicly

Use:

```ts
TParams extends JsonValue = JsonValue
```

or an equivalent constraint that preserves the intended API.

Requirements:

- `Date` generic arguments fail at compile time.
- Function generic arguments fail.
- `Map` generic arguments fail.
- `Set` generic arguments fail.
- `bigint`/BigInt generic arguments fail.
- `symbol`/Symbol generic arguments fail.
- Class-instance generic arguments fail.
- Other non-JSON generic arguments fail.
- Valid JSON-safe specialized parameter objects continue working.
- Arrays and nested objects of JSON-safe values remain supported.
- Runtime schemas remain the source of truth.
- Do not weaken `JsonValueSchema`.
- Do not use `any`, `z.any()`, unsafe assertions, double assertions, or casts that bypass checking.

Add package-name declaration tests importing from `@crowdcircuit/contracts` that prove invalid generic arguments fail. Use correctly placed `@ts-expect-error` directives.

Test both the envelope generic and the delivery/message generic surface. Retain the default JSON-safe type.

## B. Complete required-nullable coverage

For each required nullable property:

- `gameInstanceId`
- `actor`
- `actor.viewerId`
- `actor.avatarUrl`

Add runtime and package-name declaration tests proving:

- Omitted property fails.
- Explicit `undefined` fails.
- `null` succeeds.

Requirements:

- Keep the properties required and nullable, never optional.
- Retain every existing valid nullable case.
- Do not use casts to hide the TypeScript error in declaration tests.
- Runtime omission tests may construct invalid unknown input mechanically, but must exercise the actual schema.
- Cover the top-level `actor: null` case and nested null cases.

## C. Complete lifecycle and numeric negative tests

Add these cases without removing or replacing existing tests:

### Numeric safety

- Negative infinity for `priority`.
- Negative infinity for `ttlMs`.
- Negative infinity for `heartbeatIntervalMs`.
- Negative infinity for completed-result `durationMs`.

Retain positive infinity, `NaN`, zero, negative, and fractional cases already present.

### Registration

- Empty `instanceId`.
- Empty `sdkVersion`.
- Empty `token`.

Retain the existing empty `gameId` case.

### Action IDs

- Empty `actionId` on `game.action.received`.
- Empty `actionId` on completed result.
- Empty `actionId` on failed result.

### Missing required lifecycle fields

Add explicit missing-field rejection for each fixed-shape lifecycle message:

- `game.register`
- `game.registered`
- `game.heartbeat`
- `game.action`
- `game.action.received`
- Completed `game.action.result`
- Failed `game.action.result`
- The strict failed-result error object where independently useful

Exercise meaningful required fields rather than relying on a single generic assertion.

### Extra-key strictness

Prove extra-key rejection for every lifecycle/result fixed-shape object:

- Registration
- Registered response
- Heartbeat
- Action delivery wrapper
- Receipt
- Completed result
- Failed result
- Nested failed-result error object

Actor, trigger, and envelope strictness tests already exist and must remain.

### Completed-result details JSON safety

Add rejection cases for:

- `undefined` as a nested JSON property or array element; do not treat omission of the optional `details` property as invalid
- BigInt
- Symbol
- Function
- Date
- Map
- Set
- `NaN`
- Positive infinity
- Negative infinity
- Class instances

Retain valid JSON-safe details and the valid omitted-details case.

## D. Restore approved LIVE declaration regressions

Restore these exact declaration protections removed during FOUND-02D:

1. `createLiveEventEnvelopeSchema` rejects a non-string event-type schema.
2. An invalid generic specialized LIVE event payload assignment fails.
3. `BaseLiveEventEnvelope` rejects a missing `payload`.

Requirements:

- Restore them alongside all current action declaration checks.
- Do not remove or rewrite other approved LIVE declaration coverage.
- Use package-name imports and correctly placed `@ts-expect-error` directives.
- Do not use casts that make the intended invalid assignment pass.
- Keep declaration fixtures out of build output.

## E. Documentation correction

Update only current FOUND-02D documentation to record fresh actual facts:

- Node.js `v24.15.0`.
- pnpm `11.9.0`.
- FOUND-02D remains `PARTIAL` / awaiting independent re-review.
- `CURRENT_TASK` remains FOUND-02D.
- FOUND-02E remains blocked.
- The working tree is still uncommitted unless actual Git output says otherwise.

Do not:

- Mark FOUND-02D `DONE`.
- Select or start FOUND-02E.
- Rewrite historical orchestration reports as current state.
- Claim a commit exists for the rework.
- Predict a future commit hash.

Update test counts only from fresh command output.

## Contract invariants to preserve

- Do not change valid FOUND-02D wire shapes or runtime behavior except as necessary to align generic public types with existing JSON-safe runtime validation.
- Zod schemas remain the runtime source of truth.
- Actor and trigger remain strict.
- Required nullable properties remain required.
- Registration and heartbeat remain strict and minimal.
- `game.action` remains the delivery wrapper.
- Receipt remains separate from completion.
- Completed and failed results remain a `status`-discriminated union.
- `params` and optional completed-result `details` remain JSON-safe.
- No `any`, `z.any()`, unsafe assertion, or runtime-validation weakening.
- Preserve all approved FOUND-02C behavior and tests.

## Explicit exclusions

Do not implement or change:

- FOUND-02E or voice contracts
- Socket.IO or WebSocket runtime behavior
- SDK runtime, retry, queue, heartbeat scheduling, or idempotency implementation
- Mapping Engine, budgets, persistence, game manifests, UI, or unrelated refactors
- New architectural decisions
- Package scripts or dependency versions

## Required verification

Run focused package verification:

```powershell
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations
```

Inspect built declarations:

- `packages/contracts/dist/actions/envelope.d.ts`
- `packages/contracts/dist/actions/lifecycle.d.ts`
- `packages/contracts/dist/actions/index.d.ts`
- `packages/contracts/dist/index.d.ts`

Confirm:

- Every public action generic is constrained to JSON-safe values.
- Valid JSON-safe specialization remains usable.
- Concrete schema input/output declarations remain aligned.
- Required nullable properties remain required.
- Receipt/result separation and result discrimination remain intact.
- No uncontrolled `any` is introduced.
- Root exports expose the intended action API.

Inspect dist cleanliness:

```powershell
rg --files packages/contracts/dist
rg -n "\bany\b|GameActionEnvelope|GameActionDeliveryMessage|GameActionResult" packages/contracts/dist
```

Confirm no test files, declaration-consumer fixtures, test directories, or stale artifacts exist in `dist`.

Run repository-wide verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check HEAD --
git status
git diff --stat HEAD --
git diff HEAD --
git ls-files --others --exclude-standard
```

Report exact test-file and test counts from fresh output.

## Rework handoff

Create:

`docs/handoffs/HANDOFF-FOUND-02D-REWORK-01.md`

Include:

- Status `REWORK COMPLETE — AWAITING INDEPENDENT RE-REVIEW`
- Date and actual base `HEAD`
- Original FOUND-02D working-tree context
- Exact findings addressed
- Exact changed and created paths
- Generic constraint and JSON-safety evidence
- Required-nullable test matrix
- Lifecycle/numeric negative coverage added
- Restored LIVE declaration regressions
- Exact package and repository verification results/counts
- Declaration and dist inspection results
- Known limitations and explicit exclusions
- Final Git status explicitly labeled as the handoff-generation-time snapshot
- Statement that FOUND-02E was not started

Do not rewrite the original `HANDOFF-FOUND-02D.md` as if it were the rework handoff. Only correct a verified current factual error there if required by the documentation finding.

## No intermediate commit

Do not request or create an intermediate commit.

Do not stage, commit, amend, reset, restore, checkout, push, create a branch, or otherwise discard the current working-tree implementation. Leave the complete FOUND-02D plus REWORK-01 change set uncommitted for independent re-review and user-controlled commit/push.

## Final response format

Return exactly:

1. `Preflight and Preserved Working Tree`
2. `Generic Contract Fix`
3. `Required-Nullable Coverage`
4. `Lifecycle and Numeric Coverage`
5. `Restored LIVE Declaration Regressions`
6. `Files Changed`
7. `Package Verification`
8. `Declaration and Dist Inspection`
9. `Repository Verification`
10. `Documentation and Handoff`
11. `Final Git Status`
12. `Risks or Blockers`

Use exact command output and counts. State `None` only when no risk or blocker exists.
