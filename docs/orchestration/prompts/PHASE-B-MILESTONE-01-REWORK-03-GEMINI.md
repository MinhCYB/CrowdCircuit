# Gemini Rework Prompt — Phase B Milestone 01 Rework 03

## Task and objective

**Task ID:** `PHASE-B-MILESTONE-01-REWORK-03`  
**Parent milestone:** Phase B Milestone 01 — mock-to-normalized playable input
slice  
**Objective:** preserve all approved EventNormalizer behavior and resolve only
the remaining connector lifecycle, timestamp, clone-boundary, public
declaration, regression-test, and current-documentation findings recorded in
`PHASE-B-MILESTONE-01-CODEX-REVIEW-03.md`.

Milestone 1 remains `PARTIAL` pending independent re-review. Milestone 2 remains
blocked. Work in the existing accumulated uncommitted working tree. Do not
discard, reset, stage, commit, or push existing work.

## Exact reading order

1. `docs/orchestration/reviews/PHASE-B-MILESTONE-01-CODEX-REVIEW-03.md`
2. This prompt
3. `docs/orchestration/reviews/PHASE-B-MILESTONE-01-CODEX-REVIEW-02.md`
4. `docs/orchestration/prompts/PHASE-B-MILESTONE-01-REWORK-02-GEMINI.md`
5. `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-02.md`
6. `docs/orchestration/plans/NEXT-PHASE-MILESTONE-PLAN.md`
7. `docs/execution/PROJECT_STATUS.md`
8. `docs/execution/CURRENT_TASK.md`
9. `docs/execution/ROADMAP.md`
10. Current connector-core, connector-mock, and event-core source, tests,
    manifests, tsconfigs, declaration consumers, and built artifacts.
11. Only the connector and boundary sections of System Design already
    referenced by the milestone plan and prior prompts.

Do not revisit or redesign the approved EventNormalizer semantics.

## Preflight

Before editing, run and record:

```bash
git status
git rev-parse --short HEAD
git log -5 --oneline
git diff HEAD --stat
git diff --check HEAD --
git ls-files --others --exclude-standard
node --version
pnpm --version
```

Inspect the complete accumulated working tree before making changes. Preserve
all existing milestone work.

## Focused allowed paths

- `packages/connector-core/**`
- `packages/connector-mock/**`
- `packages/event-core/test/**` only for the missing declaration and numeric
  regression coverage; do not change EventNormalizer production behavior
- Minimal affected workspace metadata and `pnpm-lock.yaml`, only if required
  by the final public connector API
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md` only if its active milestone state is stale
- Current Phase B Milestone 1 handoffs
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-03.md`

Do not modify `packages/contracts/**`. Do not modify EventNormalizer production
semantics. If a contracts change appears necessary, stop and report
`BLOCKED_DECISION`.

## Approved invariants to preserve

- EventNormalizer validates every successful result with its specialized
  schema and `LiveEventEnvelopeSchema`.
- Raw like milestone data is never interpreted or propagated; normalized
  milestone remains `null`.
- Invalid present sender fields fail without fabrication.
- Absent or null sender maps to `user: null`.
- Gift `streakable` remains explicitly required and type checked.
- Gift streak remains `{ id: null, status: "single" }`.
- Decimal nonnegative diamond values remain valid.
- Zero like totals remain valid.
- No deduplication, aggregation, streak state, milestone state, networking, or
  other Milestone 2 behavior is introduced.

## A. Make lifecycle timestamp handling atomic

Current behavior can mutate connector status before validating the timestamp
used for status delivery.

Requirements:

- Read and validate a timestamp before mutating connector lifecycle state.
- Do not read the clock twice for a single lifecycle transition.
- Pass one validated timestamp into the state transition and status
  notification.
- A failed clock read must not leave the connector in `"connecting"`,
  `"connected"`, `"ended"`, or any partially transitioned state.
- `connect()` failure must preserve or restore the previous valid state.
- Status-observer failures remain isolated and cannot corrupt the transition.
- Repeated `connect()` remains idempotent:
  - return the original `ConnectionInfo` unchanged;
  - do not apply new config;
  - do not read the clock;
  - do not emit another lifecycle notification.

Add permanent tests proving:

- a clock can succeed for one transition and fail on the next attempted read;
- rejected initial connection leaves status `"disconnected"`;
- no `"connecting"` status remains after rejection;
- no malformed status message is delivered;
- repeated connect returns the original `ConnectionInfo`;
- repeated connect emits no extra lifecycle notification.

## B. Guard stream-ended transitions

Define and document deterministic `emitMockStreamEnded()` behavior.

Requirements:

- While connected, it may make the intended transition to `"ended"` using one
  prevalidated timestamp.
- Repeated stream-ended calls must be deterministic and must not produce
  accidental duplicate state transitions.
- After disconnect, behavior must be explicitly defined and tested.
- After destroy, it must do nothing or reject deterministically.
- It must never change a destroyed connector to `"ended"`.
- It must never emit a status message after destruction.
- Destroy idempotency and listener cleanup must remain intact.
- A throwing status listener during stream-ended remains isolated and later
  listeners still run.

Do not add real LIVE networking, reconnect scheduling, or Milestone 2 logic.

## C. Validate all timestamps before event publication

For `emitMockEvent()` and every typed mock emission path:

- validate caller-supplied `occurredAt` with the existing supported ISO
  timestamp schema;
- validate generated clock output before constructing or delivering the raw
  event;
- invalid timestamps must never reach listeners;
- event-ID generation must never publish malformed IDs or timestamps;
- failure behavior must match the public malformed-input contract selected in
  section E;
- lifecycle state remains unchanged after rejection.

Add permanent tests for:

- explicit `occurredAt: "not-iso"`;
- invalid generated clock output during emission;
- one valid supplied timestamp;
- rapid sequential default emissions retaining valid, unique event IDs;
- zero event deliveries for each rejected timestamp or identifier input.

## D. Replace `cloneRawValue` with a safe, assertion-free boundary

Remove all production assertions, including:

- `val as object`;
- `val as Record<string, unknown>`;
- `as unknown as`;
- any equivalent unchecked cast or escape hatch.

Do not use `any`, `z.any()`, or JSON stringify/parse.

Use natural TypeScript narrowing, `Reflect.ownKeys`, and `Reflect.get` where
needed. Use `WeakSet<object>` or equivalent for cycle detection.

Accept only:

- `null`;
- strings;
- booleans;
- finite numbers;
- arrays recursively containing supported values;
- ordinary objects with `Object.prototype`;
- null-prototype objects only if that support is intentional, documented, and
  permanently tested.

Reject deterministically:

- BigInt;
- functions;
- symbols, including symbol-keyed properties;
- cyclic graphs;
- `Date`;
- `Map`;
- `Set`;
- `WeakMap`;
- `WeakSet`;
- `RegExp`;
- `Promise`;
- `Error` instances;
- class instances;
- every other non-plain container;
- dangerous property keys including `__proto__`, `prototype`, and
  `constructor` where they could affect construction or prototype behavior.

Construct cloned objects safely so input keys cannot mutate the clone's
prototype. Do not silently convert unsupported objects into `{}`. Preserve
defensive copying of every supported nested value.

## E. Define malformed mock-emission behavior

Choose one consistent public behavior, preferring the smallest design
compatible with the existing API.

Preferred option:

- `emitMockEvent()` throws a documented typed `MockConnectorInputError`;
- the public declaration exposes that error type as necessary for consumers;
- no event is delivered;
- lifecycle state is unchanged;
- any optional error-observer notification cannot replace the original error;
- error-listener failures remain isolated and non-recursive.

Acceptable alternative:

- return a documented discriminated success/failure result;
- no uncontrolled exception escapes;
- no event is delivered on failure;
- lifecycle state remains unchanged.

Do not leak arbitrary native serialization or reflection errors. Tests must
assert the exact selected behavior, error identity/code/message contract, zero
delivery, unchanged lifecycle state, and isolated error observers.

## F. Complete executable declaration coverage

Keep every declaration consumer package-name based and included in the
package's `test:declarations` compilation.

Connector-core negative checks:

- invalid `ConnectorConfig` shapes;
- missing required config fields;
- invalid `ConnectionStatus`;
- malformed `ConnectionInfo`;
- invalid `LiveConnector.connect` implementation;
- incorrect `connect` return type.

Connector-mock negative checks:

- invalid constructor options;
- invalid source;
- invalid clock signature;
- invalid `emitMockEvent` input;
- public method misuse according to the final API;
- the selected public error or result contract.

Event-core negative checks:

- invalid `NormalizationResult` discriminator;
- success without an event;
- failure without an error;
- invalid error code;
- incorrect event/result combinations.

Every `@ts-expect-error` must execute and would fail compilation if the
expected type error disappeared. Retain all existing positive and negative
checks.

## G. Complete runtime regression coverage

Add tests without removing or replacing valid existing coverage:

- positive and negative Infinity across all relevant gift numeric fields;
- positive and negative Infinity across all relevant like numeric fields;
- status listener throwing specifically during disconnect;
- status listener throwing specifically during destroy;
- a later status listener still running;
- a later error listener still running;
- invalid explicit `occurredAt`;
- clock failure after an earlier valid clock read;
- function value;
- symbol value;
- `Date`;
- `Map`;
- `Set`;
- `WeakMap`;
- `WeakSet`;
- `RegExp`;
- `Promise`;
- `Error`;
- class instance;
- cyclic object;
- enumerable own `__proto__`;
- `constructor` and `prototype` keys where applicable;
- no event delivery for every rejected input;
- lifecycle state unchanged after every emission rejection.

Also retain all approved normalization, lifecycle isolation, defensive-copy,
and declaration regressions from earlier work.

## H. Documentation reconciliation and handoff

Update only current Milestone 1 documentation to record:

- Node.js `v24.15.0`;
- pnpm `11.9.0`;
- Milestone 1 remains `PARTIAL`, awaiting independent re-review;
- Milestone 2 remains blocked;
- the selected malformed mock-input behavior;
- atomic lifecycle timestamp behavior;
- exact fresh test counts and commands;
- accurate complete Git-status and changed-file evidence.

Clearly distinguish historical command and Git snapshots from current
evidence. Correct the REWORK-02 Git-status inventory and remove unsupported
claims that all findings were already resolved. Do not rewrite unrelated
historical reports.

Create:

`docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-03.md`

Label its Git evidence as the state at handoff-generation time.

## Required focused and repository verification

Run fresh:

```bash
git status
git diff HEAD --stat
git diff --check HEAD --
git ls-files --others --exclude-standard
node --version
pnpm --version

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

Record exact fresh test and declaration counts. Do not claim success for a
no-op command or an excluded declaration consumer.

## Required independent probes and artifact inspection

Probe at minimum:

- clock succeeds once and then fails during a lifecycle transition;
- rejected connection remains disconnected;
- stream-ended after destroy;
- explicit malformed `occurredAt`;
- invalid generated event timestamp;
- rapid unique default event IDs;
- every unsupported clone category and dangerous key;
- zero delivery and unchanged lifecycle state for rejected inputs;
- later status and error observers after earlier failures.

Inspect emitted JavaScript and declarations for connector-core,
connector-mock, and event-core. Confirm:

- declaration consumers compile via package-name imports;
- the selected malformed-input contract is represented publicly;
- declarations contain no source-relative path escapes or provider leakage;
- dependencies and TypeScript references remain acyclic;
- connector-core remains provider-independent;
- event-core does not acquire a mock runtime dependency;
- dist contains no tests, unsafe types, unexpected side effects, or unrelated
  artifacts.

## Explicit exclusions

Do not:

- change approved EventNormalizer behavior;
- modify public contracts unless required for the narrowly selected
  malformed-input behavior;
- implement deduplication;
- implement gift streak state, timers, or flush;
- implement like aggregation, thresholds, or milestones;
- add real provider networking or reconnect scheduling;
- add mappings, actions, sockets, persistence, authentication, or UI;
- begin Milestone 2;
- request an intermediate commit;
- stage, commit, or push.

## Final response format

Return:

1. remaining findings addressed;
2. files created and modified;
3. atomic lifecycle and stream-ended behavior;
4. supplied/generated timestamp validation;
5. clone boundary and selected rejection behavior;
6. runtime tests with exact counts;
7. declaration tests with exact coverage and counts;
8. focused and repository-wide verification;
9. dependency, emitted JavaScript, declaration, and dist assessment;
10. documentation reconciliation and handoff path;
11. final complete Git status;
12. confirmation that approved EventNormalizer semantics were preserved;
13. confirmation that Milestone 2 did not start;
14. genuine blockers as `BLOCKED_DECISION`.

