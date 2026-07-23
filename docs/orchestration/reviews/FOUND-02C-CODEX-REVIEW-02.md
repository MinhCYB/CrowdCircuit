# FOUND-02C — Independent Codex Re-review 02

**Review date:** 2026-07-23  
**Rework commit:** `5239df8` — `fix: address FOUND-02C review findings`  
**Parent commit:** `5b9793c` — `docs: plan FOUND-02C rework`  
**Original implementation commit:** `948f5ab` — `feat: implement LIVE event payload contracts`  
**Verdict:** `REQUEST CHANGES`

## Repository and commit evidence

- Branch: `main`.
- `HEAD` at re-review: `5239df8`.
- Remote state: synchronized with `origin/main`.
- Working tree at the end of the initial re-review: clean.
- Exact rework range: `5b9793c..5239df8`.
- Exact diff: 6 files changed, 533 insertions, 129 deletions.
- No FOUND-02D files or unrelated packages were changed.
- The re-review did not modify files.

## Findings by severity

### High — Empty-payload declaration inputs remain weaker than runtime validation

**Files:**

- `packages/contracts/src/events/payloads.ts:11`
- `packages/contracts/dist/events/envelope.d.ts:413`
- Equivalent `payload?: unknown` input declarations for the other lifecycle/social specialized schemas and union branches.

**Evidence:**

The rework changed the schema using a double assertion:

```ts
z.object({}).strict() as unknown as
  z.ZodType<Record<string, never>, z.ZodTypeDef, unknown>
```

This makes the inferred output type `Record<string, never>`, but declares the schema input as `unknown`. Emitted specialized schemas consequently expose input declarations such as:

```ts
payload?: unknown;
```

Package consumers using `z.input<typeof LiveConnectedEventSchema>` can therefore omit `payload` or supply an arbitrary connector payload at compile time, even though runtime validation rejects both.

Independent runtime probes confirmed:

- `EmptyPayloadSchema.parse({})` succeeds.
- An empty payload containing an extra property fails.
- A lifecycle envelope missing `payload` fails.
- A lifecycle envelope containing an invented payload property fails.

The runtime behavior is correct, but the schema's declared input is not aligned with it. The rework prompt also explicitly prohibited solving the defect through a type-only/double assertion.

A probe against the installed Zod version showed that `z.record(z.never())` accepts `{}`, rejects objects containing keys, rejects arrays, and rejects `null` without the double assertion. This is evidence that a native approach is available, but the implementation worker must validate both runtime and emitted input/output types before selecting the final solution.

**Why it matters:**

- Zod input and runtime behavior disagree.
- Required `payload` becomes optional in public schema-input declarations.
- Connector-specific fields remain legal at the schema-input type level.
- The schema is no longer a trustworthy single source for both input and output contracts.

**Minimal fix:**

Replace the double assertion with a Zod-native exact-empty schema whose `z.input` and `z.output` both forbid properties. Verify that specialized envelope inputs require `payload`, and add package-name declaration tests for missing and invented input payloads.

**Blocks FOUND-02D:** Yes.

### Medium — Required declaration coverage remains incomplete

**File:** `packages/contracts/test/declaration-consumer.ts:120`

**Evidence:**

The package-name declaration fixture now covers the basic `EmptyPayload` output and several nullable cases, but it does not cover schema input types and does not include all required nullable omission/undefined cases.

Missing checks include:

- `z.input<typeof EmptyPayloadSchema>` rejecting additional keys.
- `z.input<typeof LiveConnectedEventSchema>` requiring `payload`.
- Empty-payload specialized schema input rejecting invented payload keys.
- Empty-payload specialized schema output rejecting invented payload keys.
- Omitted `gift.diamondValue`.
- Explicit `undefined` for `gift.diamondValue`.
- Omitted `streak.id`.
- Omitted `estimatedDiamondTotal`.
- Omitted `LikePayload.milestone`.
- Explicit `undefined` for `LikePayload.milestone`.

Existing coverage for other required nullable fields must remain.

**Why it matters:**

The untested schema-input surface is where the High-severity mismatch appears. Partial nullable tests can allow required fields to become accidentally optional.

**Minimal fix:**

Add package-name declaration tests for both `z.input` and `z.output`/`z.infer`, plus every missing nullable omission and undefined case. Use correctly placed `@ts-expect-error` directives without casts that bypass checking.

**Blocks FOUND-02D:** Yes.

### Medium — Existing like boundary regression tests were removed

**File:** `packages/contracts/test/domain-events.test.ts:394`

**Evidence:**

REWORK-01 added the requested `NaN` and infinity cases but removed existing regression assertions for:

- Like delta equal to zero.
- Negative like delta.
- Fractional like delta.
- Negative non-null like total.
- Fractional non-null like milestone.

Independent runtime probes confirmed that the current schemas still reject all five values. The defect is loss of regression protection, not current runtime behavior.

**Why it matters:**

The new numeric-safety coverage replaced rather than supplemented existing semantic boundary coverage. A later schema regression could pass tests while allowing invalid like counts.

**Minimal fix:**

Restore all five removed assertions and retain every newer `NaN` and infinity case. REWORK-02 should be additive unless a test is proven incorrect.

**Blocks FOUND-02D:** Yes because required negative contract coverage remains incomplete.

### Low — Execution documentation still does not match the committed repository

**Files:**

- `docs/execution/PROJECT_STATUS.md:8`
- `docs/execution/PROJECT_STATUS.md:9`
- `docs/execution/PROJECT_STATUS.md:16`

**Evidence:**

- The document describes an uncommitted rework tree, but `5239df8` is committed, pushed, and clean.
- It records pnpm `11.15.1`; fresh command output reports `11.9.0`.
- It records the rework parent `5b9793c` but not current committed HEAD `5239df8` as the repository-current implementation state.

`CURRENT_TASK.md` and `ROADMAP.md` correctly keep FOUND-02C active/PARTIAL and block FOUND-02D.

The historical handoff's pre-commit status is valid as historical session evidence and must not be rewritten as repository-current state.

**Why it matters:**

Repository-current execution documents guide task selection and must distinguish current committed state from historical handoff state.

**Minimal fix:**

Reconcile current execution documents using actual preflight/final evidence while preserving historical handoffs. At the end of an uncommitted Gemini session, truthfully record that REWORK-02 is pending user commit and independent re-review.

**Blocks FOUND-02D:** Yes as a workflow gate.

## Fresh verification results

All verification was run independently rather than reused from the Gemini handoff.

### Toolchain

- Node.js: `v24.15.0`
- pnpm: `11.9.0`

### Contracts package

```text
pnpm --filter @crowdcircuit/contracts lint              PASSED
pnpm --filter @crowdcircuit/contracts typecheck         PASSED
pnpm --filter @crowdcircuit/contracts test              PASSED — 71 tests, 4 files
pnpm --filter @crowdcircuit/contracts build             PASSED
pnpm --filter @crowdcircuit/contracts test:declarations PASSED
```

### Repository

```text
pnpm lint      PASSED
pnpm typecheck PASSED
pnpm test      PASSED — 73 tests, 5 files
pnpm build     PASSED — all configured buildable projects
```

Final review state: clean working tree on `main`, synchronized with `origin/main`.

## Declarations and dist inspection

- `EmptyPayload` output emits as `Record<string, never>`.
- Specialized event output types preserve strict empty payloads.
- Specialized empty-event input declarations incorrectly emit `payload?: unknown`.
- All ten event literals and the discriminated union remain present.
- No uncontrolled public `any` was found.
- No test files, declaration-consumer fixtures, or test directories leaked into `dist`.
- No stale build artifacts were detected.

## Runtime probes

Independent probes confirmed:

- Exact empty payload runtime behavior is strict.
- Missing lifecycle payload fails at runtime.
- Invented lifecycle payload keys fail at runtime.
- Valid lifecycle payload `{}` succeeds.
- Like zero, negative, and fractional deltas fail.
- Negative like totals and fractional milestones fail.

The runtime probes do not resolve declaration-input weakness or missing regression tests.

## Scope check

No connector, normalizer, deduper, aggregator, mapping, action, voice, persistence, Socket.IO, UI, or FOUND-02D implementation was introduced.

## Verdict

`REQUEST CHANGES`

FOUND-02C remains `PARTIAL`. FOUND-02D remains blocked until focused REWORK-02 passes independent Codex re-review and receives an approval verdict.

## Required next action

Run `FOUND-02C-REWORK-02`, leave its changes uncommitted for review/user control, then return the committed/pushed result for another independent Codex re-review. Do not start FOUND-02D.
