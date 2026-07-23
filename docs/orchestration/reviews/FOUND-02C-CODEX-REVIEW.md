# FOUND-02C — Independent Codex Review

**Review date:** 2026-07-23  
**Implementation commit:** `948f5ab` — `feat: implement LIVE event payload contracts`  
**Base commit:** `c9eb085` — `docs: prepare FOUND-02C orchestration`  
**Verdict:** `REQUEST CHANGES`

## Repository and commit evidence

- Branch: `main`.
- `HEAD`: `948f5ab`.
- Remote state at review: synchronized with `origin/main`.
- Working tree at the end of the initial review: clean.
- Exact implementation range: `c9eb085..948f5ab`.
- Exact diff: 8 files changed, 805 insertions, 28 deletions.
- All implementation paths were within FOUND-02C's allowed production, test, execution-document, and handoff scope.
- No FOUND-02D files or unrelated packages were changed.
- The initial review did not modify files.

## Findings by severity

### High — Strict empty payload is not strict at the public type level

**Files:**

- `packages/contracts/src/events/payloads.ts:7`
- `packages/contracts/dist/events/payloads.d.ts:6`
- `packages/contracts/test/declaration-consumer.ts:70`

**Evidence:**

`EmptyPayloadSchema = z.object({}).strict()` correctly rejects runtime keys, but the emitted schema output and inferred `EmptyPayload` type are `{}`. An independent TypeScript compiler probe accepted the following with zero semantic diagnostics:

```ts
const connectorSpecific: EmptyPayload = {
  rawConnectorField: 1,
};
```

The same weak payload type reaches lifecycle/social branches of `LiveEvent`. Connector-specific fields therefore fail runtime parsing but are allowed by the public TypeScript contract.

**Why it matters:**

- Runtime and public type behavior are misaligned.
- The public contract does not prevent connector-specific fields from escaping at compile time.
- The FOUND-02C declaration acceptance requirement is not met.

**Minimal fix:**

Use a Zod-backed empty-object representation whose inferred public output type forbids every property while runtime parsing continues to reject every property. Add package-name declaration tests proving that fresh object literals with invented keys fail for `EmptyPayload` and empty-payload event branches.

**Blocks FOUND-02D:** Yes. FOUND-02C's public contract must be corrected and independently re-reviewed first.

### Medium — Required negative runtime and declaration coverage is incomplete

**Files:**

- `packages/contracts/test/domain-events.test.ts:226`
- `packages/contracts/test/declaration-consumer.ts:43`

**Evidence:**

The committed tests do not explicitly cover all required cases. Missing coverage includes:

- Invalid `totalQuantity`: zero, negative, fractional, `NaN`, positive infinity, and negative infinity.
- Extra top-level gift fields.
- Extra nested streak fields.
- Extra like fields.
- Omitted required nullable properties.
- Explicit `undefined` for required nullable properties.
- Invalid mention element types.
- Like `NaN` and infinities.
- Declaration rejection for additional `EmptyPayload` properties.
- Declaration rejection for invented fields on empty-payload events.
- Invalid gift, comment, and like field types.
- Omitted or `undefined` required nullable properties at the public type level.

Independent probes showed that most corresponding runtime schemas behave correctly, but the required regression protection is absent. The empty-payload declaration case additionally exposes the High-severity defect above.

**Why it matters:**

The task's Definition of Done requires complete positive, negative, and declaration behavior. Missing tests allow public contract regressions to pass unnoticed.

**Minimal fix:**

Add focused runtime and package-name declaration cases for every listed scenario while preserving existing passing nullable cases.

**Blocks FOUND-02D:** Yes. Required contract verification is incomplete.

### Low — Repository-current execution documentation is stale

**Files:**

- `docs/execution/PROJECT_STATUS.md:7`
- `docs/execution/PROJECT_STATUS.md:8`
- `docs/execution/PROJECT_STATUS.md:16`
- `docs/execution/PROJECT_STATUS.md:75`
- `docs/execution/CURRENT_TASK.md:5`
- `docs/handoffs/HANDOFF-FOUND-02C.md:130`

**Evidence:**

- `PROJECT_STATUS.md` says “10 event payload schemas”; the implementation contains four payload schemas and ten specialized event-envelope schemas.
- It describes an uncommitted working tree even though `948f5ab` was committed, pushed, and clean at review time.
- It records pnpm `11.15.1`; fresh output was `11.9.0`.
- It says no production domain schemas exist.
- `CURRENT_TASK.md` remains `READY` rather than reflecting implementation awaiting rework/re-review.
- The original implementation handoff records the true historical pre-commit state, but repository-current documentation does not distinguish that history from current state.

**Why it matters:**

Execution documentation is used to select and gate subsequent tasks. Stale state risks starting FOUND-02D before FOUND-02C is approved.

**Minimal fix:**

Reconcile repository-current execution documents while leaving the historical implementation handoff intact and clearly historical. Keep FOUND-02C `PARTIAL`, keep it as `CURRENT_TASK`, and state that FOUND-02D is blocked pending independent re-review approval.

**Blocks FOUND-02D:** Yes as a workflow gate, though the corrections themselves are mechanical.

## Fresh verification results

The reviewer ran all commands independently rather than relying on the implementation handoff.

### Toolchain

- Node.js: `v24.15.0`
- pnpm: `11.9.0`

### Contracts package

```text
pnpm --filter @crowdcircuit/contracts lint              PASSED
pnpm --filter @crowdcircuit/contracts typecheck         PASSED
pnpm --filter @crowdcircuit/contracts test              PASSED — 48 tests, 4 files
pnpm --filter @crowdcircuit/contracts build             PASSED
pnpm --filter @crowdcircuit/contracts test:declarations PASSED
```

### Repository

```text
pnpm lint      PASSED
pnpm typecheck PASSED
pnpm test      PASSED — 50 tests, 5 files
pnpm build     PASSED — all configured buildable projects
```

The final review working tree was clean and synchronized with `origin/main`.

## Emitted declarations and dist artifacts

- New event APIs are exported from the package root.
- All ten event literals survive declaration emission.
- Specialized event payloads and the discriminated union survive emission.
- No uncontrolled public `any` was found.
- No tests or declaration-consumer fixtures leaked into `packages/contracts/dist`.
- The significant declaration defect is `EmptyPayload` emitting as `{}`.

## Independent runtime probes

Fresh read-only probes confirmed:

- Unknown event types fail.
- Mismatched event type and payload fail.
- Extra empty-payload and nested gift fields fail.
- Required nullable gift properties reject omission.
- `NaN`, infinity, fractional gift quantities, zero like delta, and negative like totals fail.
- Valid nullable gifts and valid `gift.sent` union parsing succeed.

These runtime results do not resolve the public `EmptyPayload` type mismatch or missing regression tests.

## Scope check

No connector, normalizer, deduper, aggregator, mapping, game-action, voice, persistence, Socket.IO, UI, or FOUND-02D implementation was introduced.

## Verdict

`REQUEST CHANGES`

FOUND-02C remains `PARTIAL`. FOUND-02D is blocked until the focused rework passes an independent Codex re-review and receives `APPROVE` or an otherwise closure-authorizing verdict.

## Required next action

Run focused Gemini rework `FOUND-02C-REWORK-01`, then commit/push only under the user's authority and return the result for independent Codex re-review. Do not start FOUND-02D.
