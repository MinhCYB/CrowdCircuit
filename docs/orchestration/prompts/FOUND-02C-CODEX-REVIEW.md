# FOUND-02C — Independent Codex Review Prompt

Act as CrowdCircuit Technical Lead, Architecture Guardian, and independent reviewer for Gemini's FOUND-02C implementation.

This is an initial review pass. Do not modify, stage, commit, restore, reset, or push files while reviewing. Establish findings and a verdict first. Small mechanical fixes may be considered only after returning the initial review findings and only when explicitly authorized by the review workflow.

## Objective

Independently verify that FOUND-02C correctly implements the v0.1 LIVE event payload schemas and discriminated envelope union without regressions, architectural invention, or scope creep into FOUND-02D.

## Source-of-truth order

1. Current repository files.
2. Git status, history, exact diffs, and actual command output.
3. System Design and accepted decisions.
4. `docs/tasks/FOUND-02C.md`.
5. Gemini's handoff and execution documents only after verification.

Never invent commit hashes, test counts, repository state, or completed work.

## Read in order

1. `docs/orchestration/CODEX-TECH-LEAD-MASTER-GOAL.md`
2. `docs/orchestration/CROWDCIRCUIT-HANDOFF-FOR-CODEX-FROM-FOUND-02C.md`
3. `docs/execution/PROJECT_STATUS.md`
4. `docs/execution/CURRENT_TASK.md`
5. `docs/tasks/FOUND-02C.md`
6. `docs/execution/DECISIONS.md`
7. `docs/execution/KNOWN_ISSUES.md`
8. `docs/handoffs/HANDOFF-FOUND-02B-PATCH-01.md`
9. `docs/handoffs/HANDOFF-FOUND-02C.md`
10. Only the System Design sections required by FOUND-02C:
    - `### FR-02 — Nhận event`
    - `### FR-03 — Chuẩn hóa event`
    - `## 11.3 Deduper và Aggregator`
    - `## 12.1 LiveEventEnvelope`

## Establish implementation and base commits

Before reviewing code:

```powershell
git status
git rev-parse --short HEAD
git log -10 --oneline --decorate
git show --stat --oneline HEAD
```

Determine and report:

- The exact Gemini implementation commit, if committed.
- Its exact parent/base commit.
- Whether work is instead uncommitted, and if so the verified HEAD serving as its base.
- Whether unrelated user or orchestration changes coexist in the working tree.

Do not assume `6ecd211` is still HEAD. Use it only as planning history unless current Git evidence confirms it.

## Inspect the exact diff

For committed work, inspect the exact base-to-implementation diff. For uncommitted work, inspect both tracked and untracked paths against the verified base.

Use appropriate read-only commands such as:

```powershell
git diff --stat <base>..<implementation>
git diff --name-status <base>..<implementation>
git diff <base>..<implementation>
git status --short
git diff --stat
git diff
```

Read every changed production, test, declaration-fixture, execution-document, decision, and handoff file. Check for changes outside the task's allowed paths.

## Required verification

Run and report exact outputs/counts:

```powershell
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

git diff --check
git status
```

Do not reuse Gemini's reported results as evidence.

## Contract review checklist

Verify all of the following independently.

### Runtime/type alignment

- Zod schemas remain the runtime source of truth.
- Public TypeScript types match runtime parsing behavior.
- The ten supported event literals form the exact `LiveEventType` union.
- Every specialized event schema pairs one event literal with the correct payload.
- The public envelope union is genuinely discriminated by `eventType` and narrows payload types.
- Generic base-envelope and factory behavior from PATCH-FOUND-02B-01 is not weakened.
- No handwritten duplicate contract drifts from its schema.
- No `any` or uncontrolled `z.any()`/`z.unknown()` escape hatch appears.

### Optional and nullable semantics

- Required properties cannot be omitted or passed as `undefined` merely because they are nullable.
- Nullable gift image, diamond value, streak ID, estimated total, like total, and like milestone accept `null` and valid non-null values only.
- Optional connector capability `subscription.created` is still a supported union member; its presence is not confused with optional object properties.
- Existing optional envelope metadata fields retain their intended behavior.

### JSON safety and connector neutrality

- Payloads remain JSON-safe.
- Strict payload objects reject unknown connector-specific fields, including nested gift and streak objects.
- Lifecycle and social payloads are strict empty objects.
- No Date, BigInt, Map, Set, function, symbol, `NaN`, or infinite numeric value can escape through the new public payload schemas.
- Raw connector identifiers or implementation-specific fields were not invented.

### Semantic constraints

- Gift quantities are positive integers.
- Gift monetary/diamond totals have the documented nullable and non-negative behavior.
- Gift streak status is exact.
- Comment text constraints and mention types are enforced.
- Like delta, total, and milestone constraints match the task contract.
- No undocumented cross-field gift rule was invented.

### Scope and architecture

- No connector, normalizer, deduper, aggregator, mapping, game-action, voice, persistence, Socket.IO, or UI behavior was implemented.
- No action lifecycle or other FOUND-02D work was started.
- Public exports are intentional and minimal.
- No unrelated refactor or package-configuration churn occurred.
- Execution documents and handoff match the repository and do not prematurely mark FOUND-02C approved or advance FOUND-02D.

## Declaration and dist inspection

Inspect the actual emitted artifacts after a clean successful build:

```powershell
rg --files packages/contracts/dist
rg -n "\bany\b|LiveEventEnvelopeSchema|LiveEventType|GiftSentPayload|ChatCommentPayload|LikePayload|gift\.sent|chat\.comment|subscription\.created" packages/contracts/dist
```

Read the relevant `.d.ts` files and verify:

- New APIs are exported from the package root.
- Literal specialization and payload inference survive emission.
- The union remains discriminated.
- No `any` appears in the new public surface.
- Tests and declaration-consumer fixtures are absent from `dist`.
- No stale artifacts mask missing source exports.

## Independent runtime probes

In addition to committed tests, probe representative edge cases without editing repository files. At minimum verify:

- Unknown event type fails.
- Mismatched event type and payload fails.
- Unknown fields in empty and nested payloads fail rather than being silently accepted.
- Nullable fields accept `null` but reject omission/`undefined` when required.
- `NaN`, infinities, fractional counts, zero deltas, and negative counts fail as applicable.
- Discriminated-union parsing returns the expected specialized payload.

Use temporary or inline read-only probes; do not add files during the initial review.

## Findings format

Report findings ordered by severity: Critical, High, Medium, Low. For every actionable finding include:

- File and precise line.
- Reproduction or direct evidence.
- Why it matters to the public contract or architecture.
- Minimal fix.
- Whether it blocks FOUND-02D.

Do not bury substantive findings in a summary. If no findings exist, explicitly state that no actionable findings were found and list any residual test/coverage risks.

## Verdict

Return exactly one:

- `APPROVE`
- `APPROVE WITH SMALL FIX`
- `REQUEST CHANGES`
- `BLOCKED_DECISION`

Use these gates:

- `APPROVE`: all required behavior, verification, artifacts, scope, and documentation pass.
- `APPROVE WITH SMALL FIX`: only a clearly mechanical, low-risk correction remains; identify it but do not apply it during this initial review.
- `REQUEST CHANGES`: substantive contract, test, build, declaration, scope, or documentation problems require Gemini rework.
- `BLOCKED_DECISION`: repository evidence reveals a genuine product/architecture ambiguity requiring the user's decision.

Do not begin FOUND-02D under any verdict. Do not modify files during the initial review.

## Final response

Return:

1. `Repository and Commit Evidence`
2. `Findings by Severity`
3. `Verification Results`
4. `Declarations and Dist`
5. `Scope and Documentation Check`
6. `Verdict`
7. `Next Action`
