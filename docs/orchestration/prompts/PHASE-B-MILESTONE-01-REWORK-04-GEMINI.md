# Gemini Rework Prompt — Phase B Milestone 01 Rework 04

## Task and objective

**Task ID:** `PHASE-B-MILESTONE-01-REWORK-04`  
**Parent milestone:** Phase B Milestone 01 — mock-to-normalized playable input slice  
**Objective:** resolve only the final verified lifecycle, plain-data clone,
malformed-input documentation, declaration, runtime-regression, and current
documentation findings recorded in
`PHASE-B-MILESTONE-01-CODEX-REVIEW-04.md`.

This is an acceptance-frozen final rework. Preserve all approved
EventNormalizer and connector behavior. Milestone 1 remains `PARTIAL` pending
independent re-review. Milestone 2 remains blocked.

Work in the complete accumulated uncommitted Phase B working tree. Do not
reset, discard, stage, commit, or push any existing work.

## Exact reading order

1. `docs/orchestration/reviews/PHASE-B-MILESTONE-01-CODEX-REVIEW-04.md`
2. This prompt
3. `docs/orchestration/reviews/PHASE-B-MILESTONE-01-CODEX-REVIEW-03.md`
4. `docs/orchestration/prompts/PHASE-B-MILESTONE-01-REWORK-03-GEMINI.md`
5. `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-03.md`
6. Reviews 01 and 02 and their matching rework prompts, only to preserve
   already-approved regressions
7. `docs/orchestration/plans/NEXT-PHASE-MILESTONE-PLAN.md`
8. `docs/execution/PROJECT_STATUS.md`
9. `docs/execution/CURRENT_TASK.md`
10. `docs/execution/ROADMAP.md`
11. Current connector-core, connector-mock, and event-core source, tests,
    declarations, package metadata, TypeScript references, and dist artifacts
12. Only the connector and normalizer System Design sections already selected
    by the milestone plan

Do not expand scope beyond the findings in Review 04.

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

Inspect every tracked and untracked milestone file first. Preserve the
accumulated working tree.

## Focused allowed paths

- `packages/connector-core/test/**`
- `packages/connector-mock/src/index.ts`
- `packages/connector-mock/test/**`
- `packages/event-core/test/declaration-consumer.ts`
- Minimal affected package metadata or TypeScript declaration configuration,
  only if required to execute the requested checks
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md` only if its milestone status is stale
- Current Phase B Milestone 1 handoffs
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-04.md`

Do not modify `packages/contracts/**`. Do not modify EventNormalizer production
code or semantics. Do not implement Milestone 2.

## Acceptance freeze: behavior to preserve

Preserve:

- EventNormalizer specialized and `LiveEventEnvelopeSchema` validation;
- strict sender validation with no fabricated user facts;
- explicit gift streakability;
- neutral gift streak `{ id: null, status: "single" }`;
- like milestone always `null`;
- valid fractional nonnegative diamond values;
- valid zero like totals;
- rejection of NaN and infinities;
- repeated connect returning the exact original `ConnectionInfo` reference;
- repeated connect not reading the clock, applying conflicting config,
  regenerating `connectedAt`, or emitting status;
- listener failure isolation and non-recursive error observers;
- supplied and generated timestamp validation;
- connected and repeated stream-ended behavior;
- deterministic typed `MockConnectorInputError`;
- zero event delivery and unchanged lifecycle state on malformed input;
- existing declaration and runtime regressions.

Do not redesign approved behavior.

## A. Make destroy terminal even when clock validation fails

Current reproduced defect:

1. connector connects successfully;
2. `destroy()` marks it internally destroyed;
3. the destroy clock read fails;
4. cleanup runs, but `getStatus()` remains `"connected"`.

Required behavior:

- `destroy()` always leaves the connector:
  - destroyed;
  - inert;
  - listeners cleared;
  - active connection information cleared;
  - `getStatus()` reporting `"disconnected"`.
- Clock failure must never leave status `"connected"`, `"connecting"`, or
  `"ended"`.
- Cleanup happens exactly once and remains idempotent.
- Observer exceptions cannot interrupt cleanup.
- Do not fabricate a timestamp.
- Clock failures must be converted to or handled as the established
  `MockConnectorInputError` boundary; arbitrary native clock errors must not
  escape.

Use the smallest deterministic behavior:

1. if a final status notification is applicable, attempt to read and validate
   its timestamp before notification;
2. regardless of clock success, set the internal terminal state to
   `"disconnected"` and clear active connection/listener state;
3. if timestamp validation fails, omit the final status notification rather
   than inventing a timestamp;
4. complete cleanup without allowing observers to interrupt it.

Add permanent tests proving:

- connect succeeds and the next destroy clock read fails;
- the connector becomes destroyed and reports disconnected;
- active connection behavior is cleared;
- event, error, and status listeners are cleared;
- no malformed final status message is delivered;
- repeated destroy remains idempotent;
- a throwing status listener cannot prevent cleanup;
- destroy succeeds from connected and ended states.

## B. Replace cloneRawValue with a descriptor-safe plain-data clone

Replace the current helper as a coherent unit rather than incrementally
patching it.

Accepted values only:

- `null`;
- string;
- boolean;
- finite number;
- dense arrays whose elements are accepted values;
- ordinary objects with `Object.prototype`;
- null-prototype objects only if intentionally retained, documented, and
  tested.

Reject:

- `undefined`;
- BigInt;
- symbol values;
- functions;
- NaN;
- positive and negative Infinity;
- sparse arrays;
- accessor properties;
- getters;
- setters;
- symbol-keyed properties;
- `Date`;
- `Map`;
- `Set`;
- `WeakMap`;
- `WeakSet`;
- `RegExp`;
- `Promise`;
- `Error`;
- class instances;
- cyclic graphs;
- dangerous own keys:
  - `__proto__`;
  - `prototype`;
  - `constructor`.

Requirements:

- Do not invoke getters or setters.
- Inspect own property descriptors before reading values.
- Reject accessor descriptors without executing them.
- Reject descriptor or reflection failures as `MockConnectorInputError`.
- Do not silently convert unsupported values to `{}`.
- Do not use `JSON.parse()` or `JSON.stringify()`.
- Do not use:
  - `as object`;
  - `as Record<...>`;
  - `as unknown as`;
  - explicit `any`;
  - `z.any()`;
  - another unchecked production escape hatch.
- Use an active-path `WeakSet<object>` for true cycle detection.
- Use a `WeakMap<object, object>` or equivalent memo for completed clones and
  repeated shared references.

This valid graph must succeed:

```ts
const shared = { value: 1 };
const value = { a: shared, b: shared };
```

The clone may preserve shared-reference identity or create independent
equivalent copies. Select one deterministic behavior, document it, and test
it.

## C. Freeze the public malformed-input contract

Keep the selected behavior:

- `emitMockEvent()` throws `MockConnectorInputError` for malformed caller
  input;
- no event is delivered;
- lifecycle state is unchanged;
- malformed caller input does not notify `onError`;
- `onError` remains reserved for connector/runtime observer errors;
- arbitrary getter, descriptor, reflection, or native failures are wrapped in
  `MockConnectorInputError`;
- throwing error observers cannot replace another runtime observer error or
  recurse.

Add public JSDoc to `emitMockEvent()` and any relevant error class declaration
so emitted declarations state:

- when `MockConnectorInputError` is thrown;
- the supported plain-data boundary and rejected categories;
- no partial event is published;
- lifecycle state remains unchanged;
- `onError` observers are not notified for caller validation failures.

Tests must assert the exact error type/code, zero delivery, unchanged state,
and zero `onError` calls for every malformed caller input.

## D. Complete permanent runtime regressions

Add independently meaningful tests for:

- destroy-time clock failure;
- status listener throwing specifically during destroy;
- status listener throwing during stream-ended;
- stream-ended while disconnected;
- stream-ended after destroy;
- invalid generated event timestamp producing zero deliveries;
- caller mutation after emission not altering delivered:
  - sender;
  - roles;
  - payload arrays;
  - nested objects;
- undefined object property;
- undefined array element;
- sparse array;
- getter property;
- throwing getter without invocation;
- setter or accessor descriptor;
- symbol-keyed property;
- `Date`;
- `Map`;
- `Set`;
- `WeakMap`;
- `WeakSet`;
- `RegExp`;
- `Promise`;
- `Error`;
- class instance;
- function;
- symbol;
- BigInt;
- NaN;
- positive and negative Infinity;
- true cycle;
- valid repeated shared reference;
- enumerable own `__proto__`;
- own `constructor`;
- own `prototype`;
- no malformed caller input notifying error observers;
- lifecycle state unchanged after every rejected emission.

Restore or replace the previously lost defensive-copy regression. Do not
remove or merge away any existing valid test. Keep cases independently
meaningful enough that a failure identifies the broken boundary.

## E. Complete package-name declaration coverage

All declaration consumers must continue to execute under
`test:declarations` using package-name imports.

Connector-core must cover:

- valid and invalid `ConnectorConfig`;
- missing and invalid config fields where applicable;
- all `ConnectionStatus` variants including `"ended"`;
- valid and malformed `ConnectionInfo` fields;
- a valid `LiveConnector` implementation;
- malformed `LiveConnector` implementation;
- incorrect `connect()` parameter type;
- incorrect non-Promise return type;
- incorrect promised `ConnectionInfo` return shape.

Connector-mock must cover:

- valid constructor options;
- invalid connector ID;
- invalid room;
- invalid streamer;
- invalid clock signature;
- missing `rawPayload`;
- invalid event source;
- invalid `occurredAt`;
- invalid typed gift, comment, follow, and like helper arguments;
- invalid public method arguments;
- `MockConnectorInputError` code, name, message, inheritance, and intended
  readonly properties.

Event-core must cover:

- valid success and failure `NormalizationResult` variants;
- success with an error;
- failure with an event;
- success missing event;
- failure missing error;
- malformed event/error combinations;
- invalid discriminator;
- invalid error code.

Every `@ts-expect-error` must be included in the declaration compilation and
would fail if the expected error disappeared.

## F. Documentation reconciliation

Update only current Milestone 1 documentation to record:

- Node.js `v24.15.0`;
- pnpm `11.9.0`;
- Milestone 1 remains `PARTIAL`, awaiting independent re-review;
- Milestone 2 remains blocked;
- destroy always terminates as disconnected even if the final timestamp cannot
  be validated;
- no final status notification is emitted when a valid timestamp is
  unavailable;
- the exact `MockConnectorInputError` caller-input behavior;
- exact fresh test and declaration counts;
- accurate complete Git status and changed-file inventory.

The current handoff must not claim all findings are approved or that the
milestone is complete before independent review. Label older pnpm `11.15.1`
outputs explicitly as historical snapshots rather than current evidence. Do
not rewrite unrelated historical reports.

Create:

`docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-04.md`

Label its Git evidence as the state at handoff-generation time.

## Required verification

Run every focused package command:

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

Record exact fresh test counts. Do not report a command as passed unless it
actually executed the intended checks.

## Required probes and artifact inspection

Independently probe:

- destroy after a successful connection when the destroy clock read fails;
- destroy status and listener state afterward;
- throwing status listeners during destroy and stream-ended;
- every unsupported clone category;
- getter and throwing-getter non-invocation;
- sparse arrays and undefined;
- true cycle versus repeated shared reference;
- dangerous own keys;
- zero event delivery, unchanged lifecycle state, and zero validation-error
  observer notifications.

Inspect emitted JavaScript and declarations for connector-core,
connector-mock, and event-core. Confirm:

- `emitMockEvent()` public JSDoc is emitted;
- `MockConnectorInputError` is stable and correctly declared;
- declaration consumers execute with package-name imports;
- no assertion, `any`, `z.any()`, source-relative escape, provider leakage,
  unexpected side effect, or test artifact enters dist;
- package dependencies and TypeScript references remain acyclic;
- connector-core stays provider-independent;
- event-core does not acquire a mock runtime dependency.

## Scope exclusions

Do not:

- modify approved EventNormalizer production semantics;
- modify contracts;
- implement deduplication;
- implement aggregation, gift streak state, timers, or flush;
- implement like thresholds or milestones;
- add real provider networking or reconnect scheduling;
- add mapping, action delivery, sockets, persistence, authentication, or UI;
- begin Milestone 2;
- request an intermediate commit;
- stage, commit, or push.

Do not expand Milestone 1 with unrelated hypothetical edge cases unless a
probe reveals an actual contract, safety, or correctness defect.

## Final response format

Return:

1. Review 04 findings addressed;
2. files created and modified;
3. terminal destroy behavior with and without a valid clock;
4. descriptor-safe clone behavior and shared-reference policy;
5. public malformed-input contract;
6. runtime tests and exact counts;
7. declaration tests and exact coverage;
8. focused and repository-wide verification;
9. emitted JavaScript, declaration, dependency, and dist assessment;
10. documentation reconciliation and handoff path;
11. complete final Git status;
12. confirmation that approved EventNormalizer and connector behavior was
    preserved;
13. confirmation that Milestone 2 did not start;
14. genuine blockers as `BLOCKED_DECISION`.

