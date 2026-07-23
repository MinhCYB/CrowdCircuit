# Gemini Rework Prompt — Phase B Milestone 01 Rework 02

## Task and objective

**Task ID:** `PHASE-B-MILESTONE-01-REWORK-02`  
**Parent milestone:** Phase B Milestone 01 — Mock-to-normalized playable input
slice  
**Objective:** resolve only the remaining findings recorded in
`PHASE-B-MILESTONE-01-CODEX-REVIEW-02.md`.

Preserve every resolved REWORK-01 behavior. Milestone 1 remains PARTIAL pending
independent re-review. Milestone 2 remains blocked.

## Reading order

Read in this exact order:

1. `docs/orchestration/reviews/PHASE-B-MILESTONE-01-CODEX-REVIEW-02.md`
2. This prompt
3. `docs/orchestration/reviews/PHASE-B-MILESTONE-01-CODEX-REVIEW-01.md`
4. `docs/orchestration/prompts/PHASE-B-MILESTONE-01-REWORK-01-GEMINI.md`
5. `docs/orchestration/plans/NEXT-PHASE-MILESTONE-PLAN.md`
6. `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-01.md`
7. `docs/execution/PROJECT_STATUS.md`
8. `docs/execution/CURRENT_TASK.md`
9. `docs/execution/ROADMAP.md`
10. Relevant current source, tests, package metadata, TypeScript references,
    and emitted artifacts.
11. System Design sections 11.1, 11.2, 11.3 boundary rules, 12.1, and 19.

Do not expand scope beyond the remaining verified findings.

## Preflight

Before edits, run and record:

```bash
git status
git rev-parse --short HEAD
git log -5 --oneline
git diff HEAD --stat
git diff --check HEAD --
git ls-files --others --exclude-standard
node --version
pnpm --version

pnpm --filter @crowdcircuit/connector-core lint
pnpm --filter @crowdcircuit/connector-core typecheck
pnpm --filter @crowdcircuit/connector-core test
pnpm --filter @crowdcircuit/connector-core build

pnpm --filter @crowdcircuit/connector-mock lint
pnpm --filter @crowdcircuit/connector-mock typecheck
pnpm --filter @crowdcircuit/connector-mock test
pnpm --filter @crowdcircuit/connector-mock build

pnpm --filter @crowdcircuit/event-core lint
pnpm --filter @crowdcircuit/event-core typecheck
pnpm --filter @crowdcircuit/event-core test
pnpm --filter @crowdcircuit/event-core build
```

Preserve the accumulated uncommitted working tree. Do not reset, discard,
stage, commit, or push.

## Allowed paths

- `packages/connector-core/**`
- `packages/connector-mock/**`
- `packages/event-core/**`
- Minimal workspace metadata and lockfile changes required by those packages
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md` only if its active milestone state is stale
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-01.md`
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-02.md`

Do not modify `packages/contracts/**`. If the public contract itself appears
wrong, stop with `BLOCKED_DECISION`.

## A. Correct normalization semantics

### A1. Like milestone

Milestone 1 must never detect, accept as a domain fact, or propagate like
milestones.

- Do not read or publish `rawPayload.milestone`.
- Every successfully normalized like event contains:

  ```ts
  milestone: null
  ```

- An input milestone value must not leak into normalized output. Prefer
  rejecting it as unsupported raw input or explicitly ignoring it according to
  the supported raw-shape policy, but never interpret it.
- Add a permanent leakage regression.

Do not implement threshold tracking, accumulation, or other Milestone 2 logic.

### A2. Sender validation

Do not fabricate or repair invalid sender data.

- A genuinely absent or explicitly null sender may normalize to `user: null`.
- If sender is present, validate its supported raw shape explicitly.
- Present fields with invalid types return `INVALID_DATA_TYPE`.
- Missing required sender fields return `MISSING_REQUIRED_FIELD`.
- Do not substitute:
  - `"Anonymous"`;
  - filtered roles;
  - null for invalid non-null values;
  - empty arrays for invalid roles;
  - any other synthetic user fact.
- Only fields explicitly nullable by the supported raw shape map to null.
- Preserve required nullable output properties such as user ID, unique ID, and
  avatar URL when their raw absence is supported.

Add tests for invalid:

- nickname;
- avatar URL;
- roles container;
- every invalid roles element;
- sender container.

Also test genuinely absent and null sender behavior.

### A3. Gift streakability

Do not default missing streakability to false.

- If `streakable` is part of the supported gift raw shape, require an explicit
  boolean.
- Missing `streakable` returns `MISSING_REQUIRED_FIELD`.
- Present non-boolean `streakable` returns `INVALID_DATA_TYPE`.
- Preserve only the approved neutral non-aggregated streak representation:

  ```ts
  streak: {
    id: null,
    status: "single"
  }
  ```

- Do not create streak IDs, progression, timers, or state.

Update MockConnector defaults so its valid generated gift explicitly supplies
the intended boolean rather than relying on the normalizer to fabricate it.

### A4. Numeric contract alignment

Match the public contracts exactly:

- gift quantity: positive integer;
- gift total quantity: positive integer;
- diamond value: null or finite nonnegative number; fractions are valid;
- like delta: positive integer;
- like total: null or nonnegative integer; zero is valid;
- like milestone: always null in Milestone 1.

Reject as `INVALID_DATA_TYPE` before public schema parsing:

- `NaN`;
- positive Infinity;
- negative Infinity;
- invalid signs;
- fractions only where the public contract requires integers.

Do not narrow a public finite-number field to integers.

### A5. Specialized and public-union validation

Every successful normalized event must be validated inside EventNormalizer
through:

1. its specialized event schema; and
2. `LiveEventEnvelopeSchema`.

Do not rely only on tests parsing the returned value afterward.

Use a small shared validation helper if it reduces duplication while
preserving precise typed results and stable `VALIDATION_FAILED` errors.

## B. Deterministic connector lifecycle

### B1. Repeated connect

When already connected:

- return the original `ConnectionInfo` unchanged;
- do not apply a new configuration;
- do not regenerate `connectedAt`;
- do not emit another lifecycle transition.

Store the successful connection information at initial connection time.

Add tests for:

- repeated connect with no config;
- repeated connect with a matching config;
- repeated connect with a conflicting config;
- stable object values, room, streamer, timestamp, and status;
- no extra lifecycle notifications.

### B2. Clock validation

Create one internal clock-reading path validated against the existing ISO
datetime contract from `@crowdcircuit/contracts`.

Requirements:

- Invalid clock output during connect fails deterministically.
- A failed connect does not leave the connector stuck in `connecting`.
- Invalid clock output during mock event emission does not emit malformed
  event data.
- Invalid clock output during status changes cannot corrupt lifecycle state.
- Observer notification remains failure-isolated.
- Do not create a duplicate timestamp validator.

Add permanent invalid-clock tests for connection, status, and event behavior.

If this requires connector-mock to depend on contracts for the existing
timestamp schema, update package metadata and TypeScript references without
creating a cycle.

## C. Replace unsafe generic cloning

Remove:

```ts
JSON.parse(JSON.stringify(...))
```

Requirements:

- Construct every supported raw event and payload explicitly.
- Copy sender, roles, and every nested mutable supported value.
- Caller mutation after event construction or delivery must not alter the
  retained or delivered event.
- Direct generic emission, if retained publicly, must validate the supported
  raw shape before copying.
- BigInt, cyclic input, functions, symbols, and malformed values must be
  rejected deterministically rather than causing an uncontrolled clone
  exception.
- Do not introduce `any`, `z.any()`, unsafe assertions, or lossy generic
  serialization.

Add defensive-copy and unsupported-input regressions.

## D. Execute declaration consumer checks

For connector-core, connector-mock, and event-core:

- add an explicit declaration-test tsconfig or equivalent;
- add a reproducible `test:declarations` script;
- import public APIs only by package name;
- execute both positive and negative checks with TypeScript;
- add `@ts-expect-error` cases whose failure would be detected if the public
  type became too broad.

Declaration coverage must include:

- `ConnectorConfig`;
- `ConnectionInfo`;
- every `ConnectionStatus`, including `"ended"`;
- the `LiveConnector.connect` signature;
- MockConnector’s public API;
- EventNormalizer;
- `NormalizationResult` narrowing;
- invalid status, source, connector config, connection info, mock options,
  result, and discriminator assignments.

Ensure these files are actually included in the declaration compilation.

## E. Complete regression coverage

Retain all valid existing tests and add:

- positive and negative Infinity for gift quantities, total quantity, diamond
  value, like delta, and like total;
- fractional quantity, total quantity, like delta, and like total rejection;
- valid fractional diamond value;
- zero like total;
- raw milestone never propagates;
- invalid nickname;
- invalid avatar URL type;
- invalid roles container;
- invalid roles elements;
- invalid sender container;
- missing and invalid streakability;
- invalid clock output;
- default event-ID uniqueness across multiple emissions;
- later status listener after an earlier listener throws;
- later error listener after an earlier listener throws;
- an actual status-listener exception during destroy/disconnect;
- BigInt, cyclic, function, symbol, and malformed defensive-copy inputs;
- executed negative declaration checks.

Do not replace old coverage with new coverage.

## F. Documentation reconciliation

Update only current Milestone 1 records to contain:

- Node.js `v24.15.0`;
- pnpm `11.9.0`;
- Milestone 1 `PARTIAL`, awaiting independent re-review;
- Milestone 2 blocked;
- only verification commands that actually executed meaningful checks;
- exact fresh runtime, declaration, package, and repository test counts;
- accurate changed-file and Git-status evidence.

Remove current-state wording that retains pnpm `11.15.1`. Do not rewrite
unrelated historical reports.

Create:

`docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-02.md`

Clearly label Git evidence as the state at handoff-generation time.

## Required verification

Run:

```bash
git diff --check HEAD --

pnpm --filter @crowdcircuit/connector-core lint
pnpm --filter @crowdcircuit/connector-core typecheck
pnpm --filter @crowdcircuit/connector-core test
pnpm --filter @crowdcircuit/connector-core build
pnpm --filter @crowdcircuit/connector-core test:declarations

pnpm --filter @crowdcircuit/connector-mock lint
pnpm --filter @crowdcircuit/connector-mock typecheck
pnpm --filter @crowdcircuit/connector-mock test
pnpm --filter @crowdcircuit/connector-mock build
pnpm --filter @crowdcircuit/connector-mock test:declarations

pnpm --filter @crowdcircuit/event-core lint
pnpm --filter @crowdcircuit/event-core typecheck
pnpm --filter @crowdcircuit/event-core test
pnpm --filter @crowdcircuit/event-core build
pnpm --filter @crowdcircuit/event-core test:declarations

pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Record exact test and declaration counts. Do not claim success for no-op
commands or unchecked declaration files.

## Artifact and dependency inspection

Inspect:

- all affected package manifests;
- all project and declaration-test tsconfigs;
- `pnpm-lock.yaml`;
- emitted JavaScript and declarations for connector-core, connector-mock, and
  event-core;
- declaration-consumer compilation results;
- package-root runtime and declaration resolution.

Confirm:

- dependencies and references remain acyclic;
- connector-core stays provider-independent;
- event-core does not depend on mock at runtime;
- declarations use package-name imports;
- no provider types, tests, source-relative escapes, unsafe types, or
  unexpected side effects enter dist.

## Scope exclusions

Do not implement:

- Milestone 2 deduplication;
- gift streak state, timers, or flush;
- like aggregation, thresholds, or milestones;
- real provider networking or reconnect scheduling;
- mappings, actions, sockets, persistence, authentication, or UI.

Do not modify contracts. Do not begin Milestone 2. Do not request an
intermediate commit. Do not stage, commit, or push.

## Final response format

Return:

1. remaining findings addressed;
2. files created and modified;
3. corrected normalization semantics;
4. deterministic lifecycle and clock behavior;
5. defensive-copy and rejection behavior;
6. runtime and declaration tests with exact counts;
7. focused and repository verification;
8. dependency, declaration, and dist assessment;
9. documentation and handoff path;
10. final Git status;
11. confirmation that Milestone 2 did not start;
12. genuine blockers as `BLOCKED_DECISION`.
