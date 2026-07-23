# FOUND-02C-REWORK-02 — Gemini Flash High Prompt

You are Gemini Flash High, the implementation worker for a second focused CrowdCircuit contract rework.

## Task

**Task ID:** FOUND-02C-REWORK-02  
**Parent task:** FOUND-02C — LIVE Event Payload Schemas  
**Objective:** Replace the asserted empty-payload schema with a native Zod exact-empty contract, complete input/output declaration coverage, restore removed like regressions, and reconcile repository-current documentation.

Implement only the verified findings in:

`docs/orchestration/reviews/FOUND-02C-CODEX-REVIEW-02.md`

Do not implement FOUND-02D or expand FOUND-02C behavior.

## Starting evidence

- Rework commit under review: `5239df8`.
- Its exact parent: `5b9793c`.
- Original FOUND-02C implementation commit: `948f5ab`.
- Verdict: `REQUEST CHANGES`.
- FOUND-02C remains `PARTIAL`.
- FOUND-02D remains blocked pending independent re-review approval.

Repository files, Git history, and actual command output are authoritative. Report any mismatch before editing.

## Read in exact order

1. `docs/orchestration/CODEX-TECH-LEAD-MASTER-GOAL.md`
2. `docs/orchestration/reviews/FOUND-02C-CODEX-REVIEW-02.md`
3. `docs/execution/PROJECT_STATUS.md`
4. `docs/execution/CURRENT_TASK.md`
5. `docs/execution/ROADMAP.md`
6. `docs/tasks/FOUND-02C.md`
7. `docs/handoffs/HANDOFF-FOUND-02C-REWORK-01.md`
8. `packages/contracts/src/events/payloads.ts`
9. `packages/contracts/src/events/envelope.ts`
10. `packages/contracts/test/domain-events.test.ts`
11. `packages/contracts/test/declaration-consumer.ts`
12. `packages/contracts/test/tsconfig.declarations.json`
13. `packages/contracts/package.json`

Do not read or implement the FOUND-02D brief.

## Repository preflight

Run before editing:

```powershell
git status
git rev-parse --short HEAD
git rev-parse --short HEAD^
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

Report exact starting branch, HEAD, parent, working-tree state, tool versions, command results, and test counts. If `5239df8` is not in current history or unrelated changes exist, stop and report rather than overwriting them.

## Focused allowed paths

Modify only:

- `packages/contracts/src/events/payloads.ts`
- `packages/contracts/test/domain-events.test.ts`
- `packages/contracts/test/declaration-consumer.ts`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md` only if necessary to preserve FOUND-02C `PARTIAL` and FOUND-02D blocked state
- `docs/handoffs/HANDOFF-FOUND-02C-REWORK-02.md`

Do not modify `envelope.ts` unless a verified native Zod typing limitation makes it strictly necessary. If so, stop and explain the evidence before expanding scope. Do not modify package configuration, historical handoffs, orchestration review/prompt files, or unrelated code.

## A. Native exact-empty Zod schema

Remove the current double assertion completely:

```ts
as unknown as z.ZodType<...>
```

Requirements:

- Do not use this or any other unsafe type assertion.
- Do not use `any`, `z.any()`, or a handwritten public type layered over a different runtime schema.
- Use a Zod-native schema whose inferred input and output types both forbid properties.
- Runtime parsing must accept an empty object.
- Runtime parsing must reject every additional key.
- Runtime parsing must reject arrays, `null`, primitives, functions, dates, maps, sets, and other non-object/non-record values.
- `z.input<typeof EmptyPayloadSchema>` must reject every key.
- `z.output<typeof EmptyPayloadSchema>` and `z.infer<typeof EmptyPayloadSchema>` must reject every key.
- All seven lifecycle/social specialized envelope input types must require `payload`.
- Those envelope input and output types must reject invented payload keys.
- Runtime schema and TypeScript input/output must remain aligned through the native schema.
- Preserve all existing event mappings and public export names.

Evaluate candidate schemas against the installed Zod version. Do not assume behavior from documentation or memory. At planning time, `z.record(z.never())` was observed to accept `{}` and reject `{ x: 1 }`, arrays, and `null`, but you must independently verify runtime behavior, inferred input/output, emitted declarations, and specialized-envelope requiredness before selecting it.

Do not weaken runtime strictness merely to improve emitted types.

## B. Package-name declaration tests

Use imports from:

```ts
@crowdcircuit/contracts
```

The fixture must continue compiling against emitted `dist/index.d.ts`, not source-relative imports.

Add explicit checks for both:

- `z.input<typeof Schema>`
- `z.output<typeof Schema>` or `z.infer<typeof Schema>`

Prove all of the following:

### Empty payload

- Empty input accepts `{}`.
- Empty output accepts `{}`.
- Empty input rejects a fresh object with any property.
- Empty output rejects a fresh object with any property.

### Empty-payload specialized envelope input

For at least two specialized lifecycle/social schemas:

- A valid input with `payload: {}` compiles.
- Missing `payload` fails.
- `payload` containing an invented key fails.

### Empty-payload specialized envelope output

For at least two specialized lifecycle/social event output types:

- A valid output with `payload: {}` compiles.
- An invented payload key fails.

Include at least one `LiveEventEnvelopeSchema` union input/output or `LiveEvent` branch check to confirm the corrected strict payload survives union composition.

### Required nullable gift fields

Retain every existing omission/undefined test and add the missing cases:

- `gift.diamondValue` omitted.
- `gift.diamondValue` explicitly `undefined`.
- `streak.id` omitted.
- `streak.id` explicitly `undefined`.
- `estimatedDiamondTotal` omitted.
- `estimatedDiamondTotal` explicitly `undefined`.

Retain existing checks for `gift.imageUrl` and valid `null` assignments.

### Required nullable like fields

Retain existing total omission/undefined checks and add:

- `milestone` omitted.
- `milestone` explicitly `undefined`.

Retain valid `null` assignments.

Use correctly placed `@ts-expect-error` directives. The declaration test must fail if any prohibited assignment becomes legal. Do not use casts, `any`, or suppression directives that bypass the tested type.

## C. Restore removed runtime regression tests

Restore explicit runtime assertions for:

- `delta: 0` fails.
- Negative `delta` fails.
- Fractional `delta` fails.
- Negative non-null `total` fails.
- Fractional non-null `milestone` fails.

Retain every newer `NaN`, `Infinity`, and `-Infinity` test for delta, total, and milestone.

Do not replace old coverage with new coverage. This rework must be additive unless a test is genuinely incorrect, in which case stop and provide evidence before removing it.

Preserve all other existing FOUND-02C runtime tests.

## D. Documentation reconciliation

Update repository-current execution documentation using actual command and Git evidence:

- Record `5239df8` as the committed implementation HEAD before REWORK-02.
- Record the actual pnpm version from command output.
- Keep FOUND-02C as `PARTIAL`.
- Keep `CURRENT_TASK` as FOUND-02C.
- Keep FOUND-02D explicitly blocked pending independent re-review approval.
- At the end of Gemini's uncommitted session, describe REWORK-02 as applied and pending user commit/re-review.
- Preserve accurate test counts from final commands.
- Do not advance the next-task pointer to FOUND-02D.
- Do not rewrite historical handoff Git status as if it described current repository state.
- Do not modify `HANDOFF-FOUND-02C.md` or `HANDOFF-FOUND-02C-REWORK-01.md`; both are historical records.

Create:

`docs/handoffs/HANDOFF-FOUND-02C-REWORK-02.md`

The handoff must include:

- Status `IMPLEMENTED — AWAITING INDEPENDENT RE-REVIEW`.
- Date and actual starting HEAD.
- Rework parent/evidence commits: `5239df8`, `5b9793c`, and original implementation `948f5ab`.
- Exact native Zod schema chosen and verified behavior.
- Exact production, test, and documentation paths changed.
- Input/output declaration guarantees.
- Runtime and declaration tests added/restored.
- Exact package and repository verification results/counts.
- Dist inspection results.
- Actual final uncommitted Git status.
- No-commit statement.
- FOUND-02C remains `PARTIAL`.
- FOUND-02D is blocked and was not started.

## Explicit exclusions

Do not:

- Add, remove, or rename event types.
- Change gift, comment, or like payload semantics.
- Add connector-specific fields.
- Change the envelope factory or common primitives.
- Implement connector, normalization, deduplication, aggregation, mapping, action, voice, persistence, Socket.IO, or UI behavior.
- Read or implement FOUND-02D.
- Remove existing valid regression coverage.
- Use unsafe type assertions to force desired declarations.
- Modify historical handoffs.
- Add an ADR unless a genuinely new architecture decision is unavoidable; stop for user direction first.

## Focused verification

Run in order:

```powershell
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
pnpm --filter @crowdcircuit/contracts test:declarations
```

Report exact test-file and test counts.

## Clean build and dist inspection

Regenerate the contracts build from current source and inspect:

```powershell
rg --files packages/contracts/dist
rg -n "EmptyPayload|payload\??:|Record<string, never>|LiveConnectedEventSchema|SubscriptionCreatedEventSchema|LiveEventEnvelopeSchema|\bany\b" packages/contracts/dist/events packages/contracts/dist/index.d.ts
```

Read the relevant emitted `.d.ts` files and prove:

- No double/unsafe assertion exists in source.
- Empty schema input and output forbid properties.
- Specialized empty-event inputs require `payload`; no `payload?: unknown` remains.
- Specialized input and output payloads reject keys.
- Union input/output retains the exact-empty behavior.
- No uncontrolled public `any` appears.
- No tests, declaration-consumer fixtures, or test directories leak into `dist`.
- No stale artifacts mask source changes.

## Full repository verification

After focused checks and artifact inspection, run:

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

Report exact results, counts, and changed paths. Confirm there is no FOUND-02D scope.

## No commit or push

Do not stage, commit, amend, reset, restore, checkout, push, or create a branch. Leave all REWORK-02 changes uncommitted for independent Codex re-review and user-controlled commit/push.

## Final response format

Return exactly:

1. `Preflight`
2. `Native Exact-Empty Schema`
3. `Runtime Tests Restored`
4. `Declaration Input/Output Tests`
5. `Documentation and Handoff`
6. `Focused Verification`
7. `Declarations and Dist Inspection`
8. `Repository Verification`
9. `Files Changed`
10. `Final Git Status`
11. `Scope Confirmation`
12. `Risks or Blockers`

Use exact command output and test counts. State explicitly that FOUND-02C remains `PARTIAL`, FOUND-02D was not started, and independent re-review is required.
