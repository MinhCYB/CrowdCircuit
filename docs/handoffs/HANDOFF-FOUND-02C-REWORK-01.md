# Handoff — FOUND-02C-REWORK-01 — LIVE Event Payload Schemas Rework

**Status:** IMPLEMENTED — AWAITING INDEPENDENT RE-REVIEW  
**Date:** 2026-07-23  
**Starting HEAD:** `5b9793c`  
**Reviewed implementation commit:** `948f5ab`  
**Original base commit:** `c9eb085`  
**Agent session:** FOUND-02C-REWORK-01 contract hardening & test coverage rework  

## Summary

Addressed all high, medium, and low severity findings identified during Codex independent review (`docs/orchestration/reviews/FOUND-02C-CODEX-REVIEW.md`):
1. **Type-Safe Strict Empty Payload:** Corrected `EmptyPayloadSchema` in `packages/contracts/src/events/payloads.ts` by explicitly typing the exported schema as `z.ZodType<Record<string, never>, z.ZodTypeDef, unknown>`. Runtime parsing accepts `{}` and rejects any property, while inferred `EmptyPayload` type evaluates to `Record<string, never>`, rejecting invented keys at compile-time across all 7 empty-payload event types and union branches.
2. **Missing Runtime Regression Tests:** Expanded `packages/contracts/test/domain-events.test.ts` from 15 to 38 unit tests (71 total contract tests) with dedicated tests for `totalQuantity` boundary/invalid numbers (`0`, `-1`, `1.5`, `NaN`, `±Infinity`), strict unknown-key rejection across top-level, streak, like, empty payload, specialized event, and union levels, required nullable field omission & `undefined` failure (`imageUrl`, `diamondValue`, `streak.id`, `estimatedDiamondTotal`, `like.total`, `like.milestone`), comment mention element type bounds, and like numeric safety.
3. **Missing Declaration Consumer Tests:** Extended `packages/contracts/test/declaration-consumer.ts` with 14 new compile-time verification blocks testing `EmptyPayload` strictness, specialized empty-payload event types (`LiveConnectedEvent`, `SubscriptionCreatedEvent`), `LiveEvent` discriminated union empty branches, gift/comment/like field type mismatches, and required nullable omission/undefined rejections.
4. **Execution Documentation Reconciliation:** Synchronized `docs/execution/PROJECT_STATUS.md`, `ROADMAP.md`, and `CURRENT_TASK.md` to reflect actual post-rework test counts, pnpm `11.15.1`, and explicit blocking of task `FOUND-02D` pending Codex re-review. Historical `HANDOFF-FOUND-02C.md` remains intact as a historical record.

## Defect resolution details

### 1. Strict Empty Payload Public Type Alignment

- **Defect:** `z.object({}).strict()` previously parsed `{}` at runtime but inferred output type as `{}`, allowing `{ rawConnectorField: 1 }` at compile-time without TypeScript errors.
- **Fix:** Typed `EmptyPayloadSchema` as `z.object({}).strict() as unknown as z.ZodType<Record<string, never>, z.ZodTypeDef, unknown>`.
- **Emitted declaration:** `packages/contracts/dist/events/payloads.d.ts` emits `export declare const EmptyPayloadSchema: z.ZodType<Record<string, never>, z.ZodTypeDef, unknown>;` and `export type EmptyPayload = z.infer<typeof EmptyPayloadSchema>;`.
- **Result:** `const bad: EmptyPayload = { foo: 1 }` fails at compile time with TS2322 (`Type 'number' is not assignable to type 'never'`), while runtime parsing accepts `{}` and throws `ZodError` on extra keys.

### 2. Runtime Regression Coverage Added

- **Gift `totalQuantity`:** Explicitly test rejection of `0`, `-1`, `1.5`, `NaN`, `Infinity`, and `-Infinity`.
- **Strict Unknown-Key Rejection:** Added tests proving runtime failure for extra top-level gift keys, extra nested streak keys, extra like keys, extra empty payload keys, extra keys via `LiveConnectedEventSchema`, and extra keys via `LiveEventEnvelopeSchema` discriminated union.
- **Required Nullable Properties:** Proved omission and explicit `undefined` fail for `gift.imageUrl`, `gift.diamondValue`, `streak.id`, `estimatedDiamondTotal`, `LikePayload.total`, and `LikePayload.milestone`. Verified `null` assignment remains valid.
- **Comment Mentions:** Proved rejection of number elements (`[123]`), object elements (`[{ name: "user" }]`), `null`, and `boolean` array elements.
- **Like Numeric Safety:** Proved rejection of `NaN`, `Infinity`, and `-Infinity` for `delta`, non-null `total`, and non-null `milestone`.

### 3. Declaration Consumer Coverage Added

- Added `@ts-expect-error` compile-time tests verifying rejection of:
  - Extra properties on `EmptyPayload`.
  - Extra properties on `LiveConnectedEvent["payload"]` and `SubscriptionCreatedEvent["payload"]`.
  - Extra properties on `LiveEvent` discriminated union empty-payload branch.
  - Invalid gift field types (`imageUrl: 123`, `diamondValue: "hundred"`, `quantity: "one"`).
  - Omission or `undefined` assignment to `gift.imageUrl`, `streak.id`, `estimatedDiamondTotal`, `like.total`, and `like.milestone`.
  - Invalid comment text/mention types (`text: 123`, `mentions: [123]`).
  - Invalid like field types (`delta: "ten"`, `total: "hundred"`, `milestone: true`).

## Paths changed and created

### Created files

- `docs/handoffs/HANDOFF-FOUND-02C-REWORK-01.md` — This rework handoff document.

### Modified files

- `packages/contracts/src/events/payloads.ts` — Updated `EmptyPayloadSchema` type annotation to `z.ZodType<Record<string, never>>`.
- `packages/contracts/test/domain-events.test.ts` — Added 23 missing runtime regression test cases (38 tests total in suite).
- `packages/contracts/test/declaration-consumer.ts` — Added compile-time assertions for `EmptyPayload`, empty event branches, and required nullables.
- `docs/execution/PROJECT_STATUS.md` — Updated baseline test counts (71 contract tests, 73 monorepo tests), status `Rework Complete — Awaiting Re-review`, and base commit.
- `docs/execution/CURRENT_TASK.md` — Set status `IN_PROGRESS (REWORK-01)`, noted review file, and explicitly blocked `FOUND-02D`.

## Verification results

### Package-level checks (`@crowdcircuit/contracts`)

```bash
pnpm --filter @crowdcircuit/contracts lint               # ✅ Passed (0 errors, 0 warnings)
pnpm --filter @crowdcircuit/contracts typecheck          # ✅ Passed (tsc -b clean)
pnpm --filter @crowdcircuit/contracts test               # ✅ Passed (4 test files, 71 tests passed)
pnpm --filter @crowdcircuit/contracts exec tsc -b --force # ✅ Passed (dist generated)
pnpm --filter @crowdcircuit/contracts test:declarations  # ✅ Passed (tsc -p test/tsconfig.declarations.json clean)
```

### Declaration & dist inspection

- `packages/contracts/dist/events/payloads.d.ts` emits `EmptyPayloadSchema: z.ZodType<Record<string, never>>`.
- All specialized envelope schemas emit narrowed payload types.
- Zero `any` types emitted.
- Zero test artifacts (`*.test.*`, `declaration-consumer.*`, `test/`) in `dist/`.

### Full repository baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (5 test files, 73 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
```

## Known limitations & explicit exclusions

- No connector logic, raw connector models, or text normalization added.
- Deduplication, gift combo state machines, and like aggregation logic remain excluded (belong to BE-03).
- GameActionEnvelope and Action schemas remain excluded (belong to FOUND-02D).
- FOUND-02D was NOT started.

## Git status post-rework

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   docs/execution/CURRENT_TASK.md
	modified:   docs/execution/PROJECT_STATUS.md
	modified:   packages/contracts/src/events/payloads.ts
	modified:   packages/contracts/test/declaration-consumer.ts
	modified:   packages/contracts/test/domain-events.test.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/handoffs/HANDOFF-FOUND-02C-REWORK-01.md

no changes added to commit (use "git add" and/or "git commit -a")
```

No commit was performed. All changes are left uncommitted for independent Codex re-review.

## Next task

`FOUND-02D — GameActionEnvelope and Action Lifecycle Schemas` (**BLOCKED**: must not start until FOUND-02C receives Codex re-review approval).
