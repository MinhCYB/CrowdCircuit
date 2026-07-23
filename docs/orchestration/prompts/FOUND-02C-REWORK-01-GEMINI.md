# FOUND-02C-REWORK-01 — Gemini Flash High Rework Prompt

You are Gemini Flash High, the implementation worker for a focused CrowdCircuit contract rework.

## Task

**Task ID:** FOUND-02C-REWORK-01  
**Parent task:** FOUND-02C — LIVE Event Payload Schemas  
**Objective:** Correct the strict-empty public type mismatch, add the missing runtime/declaration regression tests, and reconcile repository-current documentation.

Implement only the findings recorded in:

`docs/orchestration/reviews/FOUND-02C-CODEX-REVIEW.md`

Do not expand the event contract, refactor unrelated code, or implement FOUND-02D.

## Starting evidence

- Reviewed implementation commit: `948f5ab`.
- Its base commit: `c9eb085`.
- Review verdict: `REQUEST CHANGES`.
- FOUND-02C remains `PARTIAL` and is blocked from closure until independent re-review.
- FOUND-02D must not start.

Repository files, Git history, and actual command output override these statements if the repository has changed. Report any mismatch before implementation.

## Read in exact order

1. `docs/orchestration/CODEX-TECH-LEAD-MASTER-GOAL.md`
2. `docs/orchestration/reviews/FOUND-02C-CODEX-REVIEW.md`
3. `docs/execution/PROJECT_STATUS.md`
4. `docs/execution/CURRENT_TASK.md`
5. `docs/execution/ROADMAP.md`
6. `docs/tasks/FOUND-02C.md`
7. `docs/execution/DECISIONS.md`
8. `docs/execution/KNOWN_ISSUES.md`
9. `docs/handoffs/HANDOFF-FOUND-02C.md`
10. `packages/contracts/src/events/payloads.ts`
11. `packages/contracts/src/events/envelope.ts`
12. `packages/contracts/src/events/index.ts`
13. `packages/contracts/test/domain-events.test.ts`
14. `packages/contracts/test/declaration-consumer.ts`
15. `packages/contracts/test/tsconfig.declarations.json`
16. `packages/contracts/package.json`

Do not read unrelated specifications or begin future-task discovery.

## Preflight

Run before editing:

```powershell
git status
git rev-parse --short HEAD
git log -5 --oneline --decorate
node --version
pnpm --version

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Report the actual starting branch, HEAD, working-tree state, Node version, pnpm version, and exact results. Preserve unrelated user changes. If the reviewed implementation commit is not in the current history, stop and report the discrepancy.

## Allowed paths

Modify only:

- `packages/contracts/src/events/payloads.ts`
- `packages/contracts/src/events/envelope.ts` only if required to preserve runtime/type alignment after the empty-payload correction
- `packages/contracts/test/domain-events.test.ts`
- `packages/contracts/test/declaration-consumer.ts`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/execution/KNOWN_ISSUES.md` only for a newly verified unresolved issue
- `docs/handoffs/HANDOFF-FOUND-02C-REWORK-01.md`

Do not change package configuration, unrelated schemas, orchestration source documents, or the historical `docs/handoffs/HANDOFF-FOUND-02C.md`.

## A. Type-safe strict empty payload

Correct the lifecycle/social empty payload contract so all of the following are simultaneously true:

- Runtime parsing accepts `{}`.
- Runtime parsing rejects every own property.
- The public TypeScript type is not `{}`.
- A fresh object literal with any property fails assignment.
- Empty-payload event branches also reject invented payload fields at compile time.
- The solution remains Zod-backed.
- Runtime schema and public type remain aligned from a single schema source wherever Zod supports it.
- Do not use `any` or `z.any()`.
- Do not weaken strict runtime validation.
- Do not replace runtime validation with a type-only assertion or handwritten type that can drift.

Prefer the smallest Zod-native schema change that emits an exact no-properties output such as `Record<string, never>` while rejecting keys at runtime. Verify the actual Zod behavior and emitted `.d.ts`; do not assume a construction works from its apparent type.

Preserve all seven empty-payload event mappings:

- `live.connected`
- `live.disconnected`
- `live.ended`
- `viewer.joined`
- `social.follow`
- `social.share`
- `subscription.created`

Do not alter gift, comment, or like payload shapes except where required by the focused tests below.

## B. Missing runtime tests

Add explicit, individually attributable runtime tests for every case below.

### Gift `totalQuantity`

Reject:

- `0`
- A negative integer
- A positive fractional number
- `NaN`
- `Infinity`
- `-Infinity`

### Strict unknown-key rejection

Reject:

- An extra top-level property on `GiftSentPayload`.
- An extra property inside `streak`.
- An extra property on `LikePayload`.
- At least one property on `EmptyPayload` directly.
- At least one invented payload property through an empty-payload specialized event schema or the discriminated union.

### Required nullable properties

For each required nullable field, prove omission fails and explicit `undefined` fails:

- `gift.imageUrl`
- `gift.diamondValue`
- `streak.id`
- `estimatedDiamondTotal`
- `LikePayload.total`
- `LikePayload.milestone`

Keep and rerun valid cases proving these fields accept `null`.

### Comment mentions

Reject arrays containing invalid mention element types, including at least a number and an object.

### Like numeric safety

Reject `NaN`, `Infinity`, and `-Infinity` for:

- `delta`
- Non-null `total`
- Non-null `milestone`

Existing valid nullable gift and like cases must continue passing.

Do not collapse all scenarios into one opaque assertion. Test names or table labels must identify the failed invariant.

## C. Missing declaration tests

Use package-name imports from `@crowdcircuit/contracts`, resolved against emitted `dist/index.d.ts` by the existing declaration consumer.

Add compile-time checks proving:

- `EmptyPayload` accepts `{}`.
- `EmptyPayload` rejects a fresh object literal containing any additional property.
- At least two different empty-payload specialized event types reject invented payload fields.
- The `LiveEvent` empty-payload branch rejects invented fields after discrimination or direct branch assignment.
- Invalid gift field types fail, including a nullable field receiving a non-null invalid type and a quantity receiving a string.
- Invalid comment field types fail, including non-string text and an invalid mention element.
- Invalid like field types fail, including a string delta and invalid non-null total/milestone types.
- Required nullable gift and like properties cannot be omitted.
- Required nullable gift and like properties cannot be assigned `undefined`.
- Existing valid `null` assignments continue compiling.

Use correctly placed `@ts-expect-error` directives so the declaration test fails if a prohibited assignment becomes legal. Avoid assertions or casts that bypass the type system.

## D. Documentation reconciliation

Update repository-current documentation using actual post-rework Git and command evidence:

- Record `948f5ab` as the committed FOUND-02C implementation base before this rework.
- Record the actual pnpm version from preflight/final command output.
- Describe four payload schemas and ten specialized event-envelope schemas.
- Keep ROADMAP `FOUND-02C` as `PARTIAL`.
- Keep `CURRENT_TASK` as FOUND-02C and set a rework/awaiting-re-review status rather than `READY` or `DONE`.
- State explicitly that FOUND-02D is blocked and must not start until independent re-review approves FOUND-02C.
- Update stale limitations that claim no production domain event schemas exist.
- Describe the actual working-tree state at handoff time without predicting a later user commit.
- Keep `docs/handoffs/HANDOFF-FOUND-02C.md` unchanged as a historical implementation-session record. Repository-current documents must clearly distinguish that historical state from current state.
- Do not mark FOUND-02C complete or advance the next-task pointer to FOUND-02D.

Create:

`docs/handoffs/HANDOFF-FOUND-02C-REWORK-01.md`

The rework handoff must include:

- Status `IMPLEMENTED — AWAITING INDEPENDENT RE-REVIEW`.
- Date and actual starting HEAD.
- Reviewed implementation commit `948f5ab` and original base `c9eb085`.
- Exact defect corrected.
- Exact production, test, and documentation paths changed.
- Runtime/type alignment explanation.
- Tests added.
- Exact package and repository verification results and counts.
- Declaration and dist inspection results.
- Actual final `git status`.
- No-commit statement.
- FOUND-02D explicitly blocked and not started.

## Explicit exclusions

Do not:

- Add or remove event types.
- Change gift/comment/like business semantics beyond enforcing and testing their existing schemas.
- Add connector fields.
- Implement connectors, normalization, deduplication, aggregation, mapping, game actions, voice, persistence, Socket.IO, or UI behavior.
- Implement any portion of FOUND-02D.
- Refactor the envelope factory, common primitives, or unrelated tests.
- Rewrite the historical FOUND-02C handoff as if it were repository-current state.
- Create a new ADR unless a genuinely new architecture decision is unavoidable; stop for user direction before doing so.

## Focused verification

Run in this order:

```powershell
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
pnpm --filter @crowdcircuit/contracts test:declarations
```

Report exact test-file and test counts.

## Clean build and dist inspection

Ensure the contracts build is regenerated from current source, then inspect:

```powershell
rg --files packages/contracts/dist
rg -n "\bany\b|EmptyPayload|LiveEventEnvelopeSchema|live\.connected|subscription\.created" packages/contracts/dist
```

Read the relevant emitted declarations and prove:

- `EmptyPayload` is not emitted as `{}`.
- Its output forbids all properties.
- Every empty-payload specialized envelope uses the corrected payload type.
- Runtime and declaration behavior align.
- No uncontrolled `any` appears in the new/changed public surface.
- No tests, declaration fixtures, or test directories appear in `dist`.
- No stale artifacts mask the source change.

## Repository verification

After focused checks and dist inspection, run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status
git diff --stat
git diff
```

Report actual results and exact changed paths. Confirm there is no FOUND-02D scope.

## No commit or push

Do not stage, commit, amend, reset, restore, checkout, push, or create a branch. Leave all rework changes uncommitted for independent Codex re-review and user-controlled commit/push.

## Final response format

Return exactly:

1. `Preflight`
2. `Strict Empty Payload Fix`
3. `Runtime Tests Added`
4. `Declaration Tests Added`
5. `Documentation and Handoff`
6. `Verification Results`
7. `Declarations and Dist Inspection`
8. `Files Changed`
9. `Final Git Status`
10. `Scope Confirmation`
11. `Risks or Blockers`

Use exact command output and counts. State explicitly that FOUND-02C remains `PARTIAL`, FOUND-02D was not started, and independent re-review is required.
