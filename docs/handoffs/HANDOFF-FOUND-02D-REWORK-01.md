# Handoff — FOUND-02D-REWORK-01 — GameActionEnvelope and Action Lifecycle Schemas Rework 01

**Status:** REWORK COMPLETE — AWAITING INDEPENDENT RE-REVIEW  
**Date:** 2026-07-23  
**Verified Base Commit:** `c4c3dae` (`docs: close FOUND-02C and prepare FOUND-02D`)  
**Agent Session:** FOUND-02D-REWORK-01 Public Generic Constraints & Comprehensive Test Matrix  

## Summary

Addressed all high, medium, and low severity findings identified during Codex independent review 01 (`docs/orchestration/reviews/FOUND-02D-CODEX-REVIEW-01.md`):

1. **Task A — Public Generic Constraints:** Constrained all exposed public action generic type parameters to `TParams extends JsonValue = JsonValue` across `GameActionEnvelope<TParams>`, `GameActionDeliveryMessage<TParams>`, `GameActionMessage<TParams>`, and `BaseGameActionDeliveryMessage`. Non-JSON types (`Date`, `() => void`, `Map`, `Set`, `bigint`, `symbol`, class instances) now fail at compile-time in TypeScript declaration tests with `@ts-expect-error`.
2. **Task B — Required-Nullable Test Matrix:** Added complete runtime and declaration test coverage for all required nullable properties (`gameInstanceId`, `actor`, `actor.viewerId`, `actor.avatarUrl`), proving that property omission fails, explicit `undefined` fails, and valid `null` succeeds across both runtime validation and TypeScript declaration checking without casts.
3. **Task C — Lifecycle and Numeric Negative Coverage:**
   - **Numeric Safety:** Added negative infinity (`Number.NEGATIVE_INFINITY`) rejection tests for `priority`, `ttlMs`, `heartbeatIntervalMs`, and completed-result `durationMs`.
   - **Registration:** Added empty string (`""`) rejection tests for `instanceId`, `sdkVersion`, and `token` on `game.register`.
   - **Action IDs:** Added empty string (`""`) rejection tests for `actionId` on `game.action.received`, completed `game.action.result`, and failed `game.action.result`.
   - **Missing Required Fields:** Added explicit missing-field rejection tests for every fixed-shape lifecycle message (`game.register`, `game.registered`, `game.heartbeat`, `game.action`, `game.action.received`, completed `game.action.result`, failed `game.action.result`, and `GameActionErrorSchema`).
   - **Extra-Key Strictness:** Added extra-key rejection tests for every fixed-shape object schema.
   - **Details JSON Safety:** Added comprehensive rejection tests for completed-result `details` containing nested `undefined`, array `undefined`, `BigInt`, `Symbol`, functions, `Date`, `Map`, `Set`, `NaN`, positive infinity, negative infinity, or class instances.
4. **Task D — Restored Approved LIVE Declaration Regressions:** Restored the 3 approved LIVE event declaration test cases in `packages/contracts/test/declaration-consumer.ts`:
   - `createLiveEventEnvelopeSchema` rejects a non-string event-type schema.
   - Invalid generic specialized LIVE event payload assignment fails.
   - `BaseLiveEventEnvelope` rejects a missing `payload` property.
5. **Task E — Documentation Reconciliation:** Updated `PROJECT_STATUS.md`, `CURRENT_TASK.md`, and `ROADMAP.md` to reflect fresh actual toolchain output (Node.js `v24.15.0`, pnpm `11.9.0`), updated test counts (114 contract tests, 116 monorepo tests), status `IN_PROGRESS (REWORK-01)`, and explicitly blocked `FOUND-02E`.

## Paths Changed and Created

### Created files

- `docs/handoffs/HANDOFF-FOUND-02D-REWORK-01.md` — This rework handoff document.

### Modified files

- `packages/contracts/src/actions/envelope.ts` — Constrained `GameActionEnvelope<TParams extends JsonValue = JsonValue>`.
- `packages/contracts/src/actions/lifecycle.ts` — Constrained `GameActionDeliveryMessage<TParams extends JsonValue = JsonValue>` and `GameActionMessage<TParams extends JsonValue = JsonValue>`.
- `packages/contracts/test/domain-actions.test.ts` — Added 7 new test cases (40 total action tests, 114 contract tests in suite).
- `packages/contracts/test/declaration-consumer.ts` — Added generic constraint checks, complete required-nullable matrix, and restored 3 approved LIVE declaration regression checks.
- `docs/execution/PROJECT_STATUS.md` — Updated baseline test counts (114 contract tests, 116 monorepo tests) and status `Rework 01 Complete — Awaiting Re-review`.
- `docs/execution/CURRENT_TASK.md` — Updated status to IN_PROGRESS (REWORK-01) and set FOUND-02E as blocked.
- `docs/execution/ROADMAP.md` — Preserved status `PARTIAL`.

## Public API and Contract Invariants

- **Generic Constraints:** `TParams extends JsonValue = JsonValue` on all public action generic interfaces.
- **Runtime Source of Truth:** Zod schemas validate JSON-safety recursively and strictly enforce `.strict()` fixed shapes.
- **Nullable Semantics:** `gameInstanceId`, `actor`, `actor.viewerId`, and `actor.avatarUrl` are required nullable fields that reject omission and `undefined`.
- **Receipt vs Result Separation:** Delivery receipt ACK remains strictly separated from gameplay completion.

## Verification Results

### Toolchain

```text
Node.js v24.15.0
pnpm 11.9.0
```

### Package-Level Checks (`@crowdcircuit/contracts`)

```bash
pnpm --filter @crowdcircuit/contracts lint               # ✅ Passed (0 errors, 0 warnings)
pnpm --filter @crowdcircuit/contracts typecheck          # ✅ Passed (tsc -b clean)
pnpm --filter @crowdcircuit/contracts test               # ✅ Passed (5 test files, 114 tests passed)
pnpm --filter @crowdcircuit/contracts build --force      # ✅ Passed (tsc -b "--force" clean)
pnpm --filter @crowdcircuit/contracts test:declarations  # ✅ Passed (tsc -p test/tsconfig.declarations.json clean)
```

### Declaration & Dist Inspection

- `packages/contracts/dist/actions/envelope.d.ts` emits `GameActionEnvelope<TParams extends JsonValue = JsonValue>`.
- `packages/contracts/dist/actions/lifecycle.d.ts` emits `GameActionDeliveryMessage<TParams extends JsonValue = JsonValue>` and `GameActionMessage<TParams extends JsonValue = JsonValue>`.
- Zero `any` types emitted.
- Zero test or declaration-consumer fixture artifacts leaked into `dist`.

### Full Repository Baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (6 test files, 116 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
git diff --check # ✅ Passed (0 trailing whitespace or formatting issues)
```

## Known Limitations & Explicit Exclusions

- No Socket.IO server or WebSocket runtime client code implemented.
- No SDK runtime, local queues, retry timers, or receipt timeouts added.
- No Action Gateway routing, budget token bucket, or Mapping Engine rules added.
- Voice contracts (FOUND-02E) were NOT started.

## Final Git Status at Handoff-Generation Time

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   docs/execution/CURRENT_TASK.md
	modified:   docs/execution/PROJECT_STATUS.md
	modified:   docs/execution/ROADMAP.md
	modified:   packages/contracts/src/actions/index.ts
	modified:   packages/contracts/test/declaration-consumer.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/handoffs/HANDOFF-FOUND-02D-REWORK-01.md
	docs/handoffs/HANDOFF-FOUND-02D.md
	docs/orchestration/prompts/FOUND-02D-REWORK-01-GEMINI.md
	docs/orchestration/reviews/FOUND-02D-CODEX-REVIEW-01.md
	packages/contracts/src/actions/envelope.ts
	packages/contracts/src/actions/lifecycle.ts
	packages/contracts/test/domain-actions.test.ts

no changes added to commit (use "git add" and/or "git commit -a")
```

*No commit was performed during this rework session. All changes are left uncommitted for independent Codex re-review.*

## Next Task

`FOUND-02E — VoiceIntent and Voice Protocol Schemas` (**BLOCKED**: must not start until FOUND-02D receives Codex re-review approval).
