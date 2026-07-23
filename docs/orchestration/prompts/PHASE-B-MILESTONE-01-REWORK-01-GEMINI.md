# Gemini Rework Prompt — Phase B Milestone 01 Rework 01

## Task and objective

**Task ID:** `PHASE-B-MILESTONE-01-REWORK-01`  
**Parent milestone:** Phase B Milestone 01 — Mock-to-normalized playable input slice  
**Objective:** resolve only the verified findings in
`PHASE-B-MILESTONE-01-CODEX-REVIEW-01.md` while preserving the accumulated
uncommitted Milestone 1 implementation.

Milestone 1 remains PARTIAL pending independent re-review. Milestone 2 remains
blocked.

## Reading order

Read in this exact order:

1. `docs/orchestration/reviews/PHASE-B-MILESTONE-01-CODEX-REVIEW-01.md`
2. This rework prompt
3. `docs/orchestration/plans/NEXT-PHASE-MILESTONE-PLAN.md`
4. `docs/orchestration/prompts/PHASE-B-MILESTONE-01-GEMINI.md`
5. `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
6. `docs/execution/PROJECT_STATUS.md`
7. `docs/execution/CURRENT_TASK.md`
8. `docs/execution/ROADMAP.md`
9. `docs/execution/DECISIONS.md`
10. `docs/execution/KNOWN_ISSUES.md`
11. `docs/crowdcircuit-system-design-v0.1.1.md`:
    - section 11.1 LiveConnector, including the connection state machine;
    - section 11.2 Event Normalizer;
    - section 11.3 only to preserve the boundary with deferred deduplication,
      gift streak state, and like aggregation;
    - section 12.1 LiveEventEnvelope and relevant payloads;
    - section 19 Testing Strategy.
12. Current source, tests, package metadata, project references, and emitted
    artifacts for connector-core, connector-mock, event-core, and contracts.

Do not rely on the prior handoff without verifying repository files and fresh
command output.

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

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The working tree intentionally contains the accumulated uncommitted Milestone
1 implementation and orchestration artifacts. Preserve it. Do not reset,
discard, stage, commit, or push.

## Allowed paths

- `packages/connector-core/**`
- `packages/connector-mock/**`
- `packages/event-core/**`
- Minimal workspace metadata and lockfile changes required by those packages
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md` only if its current milestone status is stale
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-01.md`

Do not modify `packages/contracts/**`. If an approved public contract appears
to require alteration, stop and return `BLOCKED_DECISION`.

## A. Listener failure isolation and lifecycle safety

For MockConnector event, status, and error listeners:

- One listener throwing must not prevent later listeners from running.
- Observer failures must not interrupt `connect()`, `disconnect()`,
  `destroy()`, or state cleanup.
- `connect()` must never remain stuck in `connecting` because an observer
  throws.
- `destroy()` must always mark the connector destroyed and clear listener
  collections.
- Repeated `connect()`, `disconnect()`, and `destroy()` calls must have
  explicit deterministic behavior.
- Destroyed connectors must not reconnect, emit, or accept meaningful
  subscriptions.
- An error-listener failure must not recursively dispatch another error.
- Implement a small private safe-notification mechanism instead of duplicating
  try/catch loops.
- Decide and document whether observer errors are delivered to `onError` or
  otherwise contained. The behavior must be deterministic and non-recursive.

Add focused tests for:

- multiple event, status, and error listeners;
- first listener throws and later listener still runs;
- status listener throws during connect;
- status listener throws during destroy;
- error listener throws;
- repeated connect, disconnect, and destroy;
- event, status, and error unsubscribe;
- subscription after destruction;
- destroyed connector cannot reconnect or emit.

## B. Complete the provider-independent connector contracts

Implement the smallest provider-independent System Design boundary for:

- `ConnectorConfig`;
- `ConnectionInfo`;
- a live-ended lifecycle state.

Requirements:

- No TikTok-, TikFinity-, or mock-specific configuration properties in
  connector-core.
- `connect()` accepts the typed provider-independent config.
- `connect()` returns typed connection information.
- Connection status distinguishes live-ended from ordinary disconnection.
- MockConnector implements the updated interface and deterministic return
  values.
- Existing provider-independent raw-event and unsubscribe behavior remains.
- Do not implement networking, reconnect scheduling, or a real provider
  adapter.

Add declaration and runtime coverage for the new types and lifecycle state.

## C. Stop fabricating normalized domain data

Define and validate the supported raw gift, comment, follow, like, sender, and
envelope shapes explicitly.

The normalizer must not invent:

- `streamerUniqueId`;
- `giftId`;
- `giftName`;
- `giftImage`;
- streak IDs;
- streakable status;
- like milestones;
- connector or provider facts absent from raw input.

Requirements:

- Missing required non-null raw fields produce
  `MISSING_REQUIRED_FIELD`.
- Present values of the wrong type or invalid domain value produce a stable
  invalid-data error.
- Every required nullable public property remains present in normalized output.
- Unavailable nullable data maps to `null`, including:
  - gift image;
  - diamond value;
  - like total;
  - other contract-required nullable fields.
- Do not create gift streak progression in Milestone 1.
- Where the public gift payload requires a streak object, represent only the
  raw fact that no aggregation/streak state is established. Use a neutral
  contract-compatible representation, with no synthetic ID or progression.
- Do not create like milestone semantics. `milestone` remains `null` unless
  actual raw input explicitly and validly establishes a milestone within this
  milestone’s supported raw shape; prefer no milestone input if it belongs to
  Milestone 2.
- Do not mark gifts streakable unless that fact is explicitly present and
  valid in the raw input.
- Do not generate provider identity or room identity data that is absent.
- Preserve specialized-schema and `LiveEventEnvelopeSchema` validation for
  every successful kind.
- A failure never exposes a partial normalized event.

Numeric validation must reject before final contract parsing:

- fractional values where the public contract requires integers;
- negative values where nonnegative is required;
- zero where positive is required;
- `NaN`;
- positive Infinity;
- negative Infinity.

Classify those consistently as invalid raw data.

## D. Assertion-free structural validation

Remove production assertions including:

```ts
rawPayload as Record<string, unknown>
rawSender as Record<string, unknown>
```

Use one or more of:

- Zod raw-input schemas;
- assertion-free type guards;
- guarded `Reflect.get` after non-null object validation.

Do not introduce:

- `any`;
- `z.any()`;
- `as unknown as`;
- unchecked structural casts or escape hatches.

Expected malformed raw input must return a typed failure rather than throw an
untyped exception.

## E. Defensive copying

At the connector boundary, create fresh values for:

- raw event object;
- raw payload;
- sender;
- sender roles;
- every nested mutable array or object accepted from caller input.

Mutating caller-provided input after construction or delivery must not change
the retained or delivered event.

Add mutation-isolation tests for sender fields, roles, and any other nested
supported input. Preserve deterministic clock behavior.

## F. Reproducible package verification

Add meaningful scripts where appropriate for connector-core, connector-mock,
and event-core:

- `lint`;
- `typecheck`;
- `test`;
- `build`.

Requirements:

- Package-scoped test commands execute only that package’s intended tests.
- A package test command must fail if its tests fail.
- Do not treat an exit-zero command that executes zero tests as verification.
- Package lint scripts must execute meaningful linting of that package.
- Preserve root repository scripts.
- Remove event-core’s direct Zod dependency if fresh dependency and source
  inspection confirms it is unused.
- Keep package and project-reference direction acyclic.

## G. Complete runtime and declaration coverage

Retain every existing valid test and add coverage for:

- repeated lifecycle calls;
- multiple listeners and listener-failure isolation;
- all unsubscribe variants;
- observer failures during connect and destroy;
- error-listener failure without recursion;
- subscription after destruction;
- defensive copies;
- multiple generated event IDs and uniqueness;
- invalid clock output;
- positive and negative Infinity;
- fractional gift and like numbers;
- missing gift identity fields;
- invalid sender containers;
- invalid sender property types;
- null and unavailable gift image;
- null and unavailable diamond value;
- null and unavailable like total;
- absence of invented gift streak IDs/progression;
- absence of invented like milestones;
- missing streamer identity;
- stable missing/invalid/unsupported error codes;
- provider-field stripping;
- successful parsing through each specialized schema and the public LIVE union.

Add package-name declaration consumers for:

- `@crowdcircuit/connector-core`;
- `@crowdcircuit/connector-mock`;
- `@crowdcircuit/event-core`.

Prove:

- valid public connector configuration and connection information compile;
- live-ended status compiles;
- invalid status and connector shapes fail;
- MockConnector satisfies LiveConnector;
- normalization result narrows by `success`;
- normalized success exposes the approved `LiveEvent`;
- provider-specific or invented public fields are not introduced.

Inspect emitted declarations for exact discriminators, package-name imports,
and absence of `any`, provider-library types, or source-relative escapes.

## H. Documentation reconciliation

Update current Milestone 1 records to state:

- Node.js `v24.15.0`;
- pnpm `11.9.0`;
- Milestone 1 remains `PARTIAL` and awaits independent re-review;
- Milestone 2 remains blocked;
- focused verification claims list only commands that actually ran and tests
  that actually executed;
- test counts and changed-file evidence match fresh Git and command output.

Do not rewrite unrelated historical reports.

Create:

`docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01-REWORK-01.md`

Clearly label Git status as the state at handoff-generation time.

## Required verification

Run:

```bash
git diff --check HEAD --

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

pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Record exact test files and counts. Do not claim success for a command that
did not execute meaningful work.

## Artifact and dependency inspection

Inspect:

- all three affected package manifests;
- project references;
- `pnpm-lock.yaml`;
- all three packages’ emitted `index.js` and `index.d.ts`;
- declaration-consumer outputs if created.

Confirm:

- dependency direction remains acyclic;
- connector-core does not depend on mock or event-core;
- event-core does not acquire a runtime dependency on mock;
- package-name imports resolve;
- no source-relative paths, tests, provider objects, or unexpected side
  effects leak into dist.

## Scope exclusions

Do not implement:

- Milestone 2 deduplication;
- gift streak state machines, timers, or flush;
- like aggregation or threshold tracking;
- TikTok or other networking;
- reconnect scheduling;
- mapping, game actions, sockets, persistence, authentication, or UI.

Do not begin Milestone 2. Do not modify contracts. Do not stage, commit, push,
or request an intermediate commit.

## Final response format

Return:

1. findings addressed;
2. files created and modified;
3. connector lifecycle behavior;
4. normalized raw-shape and nullable semantics;
5. defensive-copy behavior;
6. runtime and declaration test coverage with exact counts;
7. package and repository verification results;
8. dependency and dist assessment;
9. documentation and handoff path;
10. final `git status`;
11. confirmation that Milestone 2 did not start;
12. any genuine blocker as `BLOCKED_DECISION`.
