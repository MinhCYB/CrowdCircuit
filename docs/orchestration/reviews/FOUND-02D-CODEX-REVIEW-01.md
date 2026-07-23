# FOUND-02D — Independent Codex Working-Tree Review 01

**Review date:** 2026-07-23
**Review basis:** Complete working-tree diff against `HEAD`
**Base commit:** `c4c3dae` — `docs: close FOUND-02C and prepare FOUND-02D`
**Verdict:** `REQUEST CHANGES`

## Repository and working-tree evidence

- Branch: `main`.
- `HEAD`: `c4c3dae`.
- `main` was synchronized with `origin/main`.
- The implementation was intentionally uncommitted and was reviewed as a complete working-tree change set.
- The review inspected `git diff HEAD --` and every untracked file.
- All nine task-related files were present:
  - Five modified tracked files.
  - Four untracked files.
- `git diff --check HEAD --` passed.
- No files were modified during the initial review or verification.

Working-tree files at review time:

```text
 M docs/execution/CURRENT_TASK.md
 M docs/execution/PROJECT_STATUS.md
 M docs/execution/ROADMAP.md
 M packages/contracts/src/actions/index.ts
 M packages/contracts/test/declaration-consumer.ts
?? docs/handoffs/HANDOFF-FOUND-02D.md
?? packages/contracts/src/actions/envelope.ts
?? packages/contracts/src/actions/lifecycle.ts
?? packages/contracts/test/domain-actions.test.ts
```

Fresh tool versions:

```text
Node.js v24.15.0
pnpm 11.9.0
```

## Findings by severity

### High — Generic public action types bypass JSON safety

**Files:**

- `packages/contracts/src/actions/envelope.ts:51`
- `packages/contracts/src/actions/lifecycle.ts:60`
- `packages/contracts/dist/actions/envelope.d.ts:128`
- `packages/contracts/dist/actions/lifecycle.d.ts:313`

**Evidence:**

The public aliases are emitted without a constraint on `TParams`:

```ts
export type GameActionEnvelope<TParams = JsonValue> = ...
export type GameActionDeliveryMessage<TParams = JsonValue> = ...
```

Consumers can therefore instantiate the public contracts with non-JSON types such as:

```ts
GameActionEnvelope<Date>
GameActionEnvelope<() => void>
GameActionDeliveryMessage<Map<string, unknown>>
```

The corresponding runtime schemas correctly accept only `JsonValue`. The manual generic aliases therefore expose values that the Zod schemas reject.

**Why it matters:**

- Public TypeScript contracts promise inputs that cannot cross the runtime boundary.
- JSON safety is lost at the generic declaration surface.
- The generic aliases can drift from the Zod source of truth.
- Runtime/type alignment is violated.

**Minimal fix:**

Constrain every related public generic to JSON-safe values, for example:

```ts
TParams extends JsonValue = JsonValue
```

Add package-name declaration failures for non-JSON generic arguments while retaining valid JSON-safe specialized objects.

**Blocks FOUND-02E:** Yes.

### Medium — Required nullable declaration and runtime coverage is incomplete

**Files:**

- `packages/contracts/test/domain-actions.test.ts:207`
- `packages/contracts/test/declaration-consumer.ts:609`

**Evidence:**

The schemas correctly rejected missing and `undefined` nullable properties in independent runtime probes, but the required regression coverage was incomplete.

Missing explicit coverage included:

- `actor` omitted.
- `actor` explicitly `undefined`.
- `actor.viewerId` omitted.
- `actor.avatarUrl` omitted.
- `actor.avatarUrl` explicitly `undefined` in declaration tests.
- `actor.viewerId` omitted in declaration tests.

The runtime test titled as covering omitted and undefined required nullable properties checked omitted `gameInstanceId` and selected undefined cases, but did not cover all four fields for omission, undefined, and valid null.

**Why it matters:**

A required nullable property can accidentally become optional without the requested tests detecting every regression.

**Minimal fix:**

For `gameInstanceId`, `actor`, `actor.viewerId`, and `actor.avatarUrl`, add runtime and package-name declaration cases proving:

- Omission fails.
- Explicit `undefined` fails.
- `null` succeeds.

Retain every existing valid case.

**Blocks FOUND-02E:** Yes.

### Medium — Lifecycle and numeric negative regression coverage is incomplete

**File:**

- `packages/contracts/test/domain-actions.test.ts`

**Evidence:**

The schemas behaved correctly in independent probes, but the test suite did not fully establish the promised negative coverage.

Missing cases included:

- Negative infinity for priority.
- Negative infinity for TTL.
- Negative infinity for heartbeat interval.
- Negative infinity for completed duration.
- Empty registration `instanceId`.
- Empty registration `sdkVersion`.
- Empty registration `token`.
- Empty receipt action ID.
- Empty completed-result action ID.
- Empty failed-result action ID.
- Missing required fields across lifecycle fixed-shape messages.
- Extra-key rejection for every lifecycle/result fixed-shape object.
- Broad completed-result `details` JSON-safety rejection beyond the single function case.

Independent probes confirmed that representative negative infinities, missing nullable properties, extra receipt fields, and non-JSON details currently fail at runtime. The defect is missing regression protection and overstated handoff coverage, not observed schema behavior.

**Why it matters:**

Required validation guarantees are not fully protected against later regression, and the handoff reports broader coverage than the actual suite contains.

**Minimal fix:**

Add the missing cases additively. Preserve all existing valid tests and all existing negative cases.

**Blocks FOUND-02E:** Yes.

### Medium — Approved LIVE declaration regressions were removed

**File:**

- `packages/contracts/test/declaration-consumer.ts:578`

**Evidence:**

The FOUND-02D edit removed three previously valid package declaration checks:

- Factory rejection of a non-string event-type schema.
- Invalid generic specialized LIVE event payload assignment.
- Missing payload rejection on `BaseLiveEventEnvelope`.

The declaration command still passed because the assertions were no longer present. New FOUND-02D checks replaced rather than supplemented these approved regression checks.

**Why it matters:**

FOUND-02D must not weaken the approved FOUND-02C and base-envelope declaration safety net.

**Minimal fix:**

Restore all three checks alongside every new action declaration check.

**Blocks FOUND-02E:** Yes.

### Low — Current FOUND-02D documentation records the wrong pnpm version

**Files:**

- `docs/execution/PROJECT_STATUS.md:16`
- `docs/handoffs/HANDOFF-FOUND-02D.md`

**Evidence:**

Fresh command output reported:

```text
Node.js v24.15.0
pnpm 11.9.0
```

Current FOUND-02D documentation recorded pnpm `11.15.1`.

**Why it matters:**

Execution documents and handoffs must reflect actual repository command output.

**Minimal fix:**

Correct current FOUND-02D documentation to Node.js `v24.15.0` and pnpm `11.9.0`, keep FOUND-02D `PARTIAL` awaiting re-review, and keep FOUND-02E blocked. Do not rewrite historical reports as current state.

**Blocks FOUND-02E:** Yes as a task-closure requirement.

## Fresh verification results

All commands were run independently during the review.

### Contracts package

```text
pnpm --filter @crowdcircuit/contracts lint              PASSED
pnpm --filter @crowdcircuit/contracts typecheck         PASSED
pnpm --filter @crowdcircuit/contracts test              PASSED — 107 tests, 5 files
pnpm --filter @crowdcircuit/contracts build --force     PASSED
pnpm --filter @crowdcircuit/contracts test:declarations PASSED
```

### Repository

```text
pnpm lint      PASSED
pnpm typecheck PASSED
pnpm test      PASSED — 109 tests, 6 files
pnpm build     PASSED
git diff --check HEAD -- PASSED
```

Passing verification did not resolve the uncovered generic public-type mismatch or the removed and missing assertions.

## Runtime probes

Independent probes against the freshly built package confirmed:

- A valid action envelope succeeds.
- Omitted or undefined `actor` fails.
- Omitted `viewerId` and `avatarUrl` fail.
- Negative infinity fails for priority, TTL, heartbeat interval, and duration.
- A `Date` in completed-result details fails.
- Receipt messages containing completion status fail.
- Package-root runtime exports resolve.

These probes establish correct current runtime behavior but do not replace permanent regression tests.

## Declaration and dist assessment

Positive results:

- Package-root exports resolve correctly.
- Action envelope, lifecycle, receipt, error, and result declarations are emitted.
- Concrete schema `z.input` and `z.output` shapes align.
- Required nullable fields remain required in emitted schema declarations.
- Actor, trigger, envelope, lifecycle, receipt, error, and result objects are strict.
- Completed and failed results remain discriminated by `status`.
- Receipt and completion remain separate.
- Runtime schemas for `params` and `details` remain JSON-safe.
- No tests or declaration-consumer fixtures leaked into `dist`.
- No stale action artifacts were observed.

Blocking declaration result:

- The manually declared generic aliases permit arbitrary `TParams`, including non-JSON values, while their runtime schemas accept only `JsonValue`.

## Scope assessment

- No FOUND-02E or voice implementation was found.
- No Socket.IO runtime, SDK runtime, retry, persistence, mapping, UI, or unrelated package implementation was introduced.
- All task-related source, test, execution, and handoff files were present.
- The working tree remained unchanged after review.

## Verdict

`REQUEST CHANGES`

FOUND-02D remains `PARTIAL` and awaits focused rework and independent re-review. FOUND-02E remains blocked.
