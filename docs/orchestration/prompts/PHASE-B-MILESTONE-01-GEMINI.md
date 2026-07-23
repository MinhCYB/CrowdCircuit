# Gemini Implementation Prompt — Phase B Milestone 1

## Task and objective

**Task ID:** `PHASE-B-MILESTONE-01`  
**Phase:** Phase B — Event Pipeline  
**Objective:** implement a deterministic mock-to-normalized playable input
slice covering roadmap traceability items `BE-01A`–`BE-01C` and
`BE-02A`–`BE-02D`.

Produce mock gift, comment, follow, and like inputs and normalize them into the
already-approved specialized LIVE event contracts. Stop after this milestone;
do not implement Milestone 2.

## Reading order

Read in this exact order:

1. `docs/orchestration/plans/NEXT-PHASE-MILESTONE-PLAN.md`
2. `docs/execution/PROJECT_STATUS.md`
3. `docs/execution/CURRENT_TASK.md`
4. `docs/execution/ROADMAP.md`
5. `docs/execution/DECISIONS.md`
6. `docs/execution/KNOWN_ISSUES.md`
7. `docs/handoffs/HANDOFF-FOUND-02F-REWORK-02.md`
8. `docs/tasks/FOUND-02F.md` only for the approved contract baseline
9. `docs/crowdcircuit-system-design-v0.1.1.md` sections:
   - `3. Căn cứ kỹ thuật và ràng buộc nền tảng` → connector strategy only
   - `7` → `FR-02`, `FR-03`, and `FR-10`
   - `9. Kiến trúc tổng thể` → connector-to-normalizer flow only
   - `10` → ADR-001, ADR-002, ADR-004, and ADR-005
   - `11.1 LiveConnector`
   - `11.2 Event Normalizer`
   - `12.1 LiveEventEnvelope` and its payload subsections
   - `19. Testing strategy`
10. Current source and package metadata in:
    - `packages/contracts/**`
    - `packages/connector-core/**`
    - `packages/connector-mock/**`
    - `packages/event-core/**`

Do not read unrelated design sections unless a concrete conflict requires it.

## Preflight

Run and record exact output:

```bash
git status
git rev-parse --short HEAD
git log -5 --oneline
node --version
pnpm --version

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The working tree intentionally contains the approved uncommitted Phase A
changes. Preserve them. Do not reset, discard, stage, commit, or push.

## Allowed paths

- `packages/connector-core/**`
- `packages/connector-mock/**`
- `packages/event-core/**`
- Minimal dependency/reference changes required by those packages
- Tests colocated with or scoped to those packages
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`

Do not modify `packages/contracts` unless repository evidence proves an actual
contract regression. If a contract change appears necessary, stop with
`BLOCKED_DECISION`; do not invent it.

## Required implementation

### Connector boundary

- Replace the connector-core placeholder with the smallest coherent
  LiveConnector boundary supported by System Design section 11.1.
- Keep provider-specific raw objects and APIs out of public normalized
  contracts.
- Model connection state and event delivery only to the extent required for a
  deterministic mock connector. Do not add real network or reconnect behavior.
- Avoid global mutable singletons. Make clocks and IDs deterministic or
  injectable where required for repeatable tests.

### Deterministic mock connector

- Implement deterministic scenarios for gift, comment, follow, and like input.
- Cover the roadmap’s mock gift/comment and social/like behavior without
  implementing gift-streak state or like aggregation.
- Provide explicit start/stop or equivalent lifecycle behavior consistent with
  the chosen connector boundary.
- Ensure stopped/disposed connectors do not continue delivering events.
- Keep generated identifiers and timestamps controllable in tests.

### Event normalizer

- Convert supported mock inputs into the correct specialized schemas exported
  by `@crowdcircuit/contracts`.
- Normalize user, room, timestamps, text, gift, follow, and like fields using
  only rules supported by the design.
- Runtime-validate every output with the specialized Zod schema before
  returning or publishing it.
- Never expose the provider/raw input object on normalized output.
- Return a conservative typed failure/result for malformed or unsupported raw
  input; do not throw an untyped provider object or silently fabricate required
  data.
- Do not add deduplication, aggregation, streak lifecycle, or an asynchronous
  event bus beyond what this slice strictly needs.

## Contract invariants

- `specVersion` remains exactly `"0.1"`.
- Event discriminators and source literals must match the approved contracts.
- Required nullable properties remain present and use `null`, never omission or
  `undefined`.
- Timestamps are valid ISO instants with truthful occurred/received semantics.
- Numeric fields remain finite and honor integer/positivity rules.
- Objects remain strict and JSON-safe.
- Normalized outputs parse through their specialized schema and the public LIVE
  union.
- Existing contract source, canonical fixture values, declarations, and tests
  remain unchanged.

## Explicit exclusions

Do not implement:

- event deduplication;
- gift streak state, inactivity timeout, or flush;
- like aggregation;
- TikTok or any real external connector;
- reconnect policy;
- mappings, cooldowns, or action delivery;
- Socket.IO or another network transport;
- authentication, pairing, SQLite, or persistence;
- dashboard or other UI;
- FOUND-03A or Phase C work.

Do not add `any`, unsafe assertions, `z.any()`, unbounded caches, real sleeps,
random test behavior, or duplicate domain contract definitions.

## Required tests

Add deterministic positive runtime tests for:

- mock lifecycle and event delivery;
- one valid gift, comment, follow, and like path;
- exact normalized discriminators and required nullable fields;
- specialized-schema and LIVE-union parsing;
- controlled IDs and timestamps;
- stop/dispose preventing further delivery;
- raw/provider-only fields not leaking into normalized output.

Add negative runtime tests for:

- unsupported event kind;
- missing required raw data;
- wrong scalar types;
- invalid/non-finite numeric inputs;
- invalid timestamps;
- invalid nullable semantics;
- extra/untrusted provider data being ignored or rejected according to the
  documented boundary;
- normalizer failure not emitting a partially normalized event.

Preserve all existing Phase A regressions.

## Public types and declaration checks

- Add package-name consumer checks where a new public connector or event-core
  type is exposed.
- Prove supported callback/result narrowing and invalid shapes at compile time.
- Confirm generated declarations contain no provider-library types, `any`,
  unsafe widened discriminators, or duplicate LIVE envelope definitions.
- Public normalized types must refer to `@crowdcircuit/contracts`; do not copy
  them.

## Verification

Add focused package scripts as needed, then run:

```bash
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
git diff --check HEAD --
git status
```

If the repository convention uses a shared command instead of one listed
above, use the reproducible repository command and record the exact
replacement. Do not claim a command passed if it was not run successfully.

## Build and artifact inspection

Inspect all three affected packages’ `dist` JavaScript and declarations.
Confirm:

- package-root imports resolve;
- no test files or provider raw objects leak into dist;
- declarations preserve discriminators and result narrowing;
- normalized types come from `@crowdcircuit/contracts`;
- no source-relative import escapes package boundaries;
- runtime artifacts contain no unexpected side effects.

## Documentation and handoff

- Keep Phase B and Milestone 1 `IN_PROGRESS` or `PARTIAL` pending independent
  review; do not mark them DONE.
- Do not advance CURRENT_TASK to Milestone 2.
- Record only fresh Node/pnpm versions, test counts, Git evidence, and commands.
- Create `docs/handoffs/HANDOFF-PHASE-B-MILESTONE-01.md`.
- Clearly distinguish handoff-generation Git status from future repository
  state.

## Commit policy

Do not stage, commit, or push. Do not request an intermediate commit. Stop for
focused Codex review after Milestone 1.

## Final response format

Return:

1. objective completed;
2. files created and modified;
3. connector and normalizer behavior;
4. positive and negative test coverage with exact counts;
5. package and repository verification results;
6. declaration and dist inspection;
7. scope confirmation;
8. documentation and handoff path;
9. final `git status`;
10. blockers or decisions, using `BLOCKED_DECISION` only when user input is
    genuinely required.
