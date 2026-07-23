# Handoff — PATCH-FOUND-02B-01 — Envelope Contract Hardening

**Status:** DONE  
**Date:** 2026-07-23  
**Base commit:** `a961b4e`  
**Agent session:** PATCH-FOUND-02B-01 maintenance patch  

## Summary

Applied maintenance patch PATCH-FOUND-02B-01 to resolve contract flaws identified after task FOUND-02B:
1. Enforced JSON-safe required payload validation at runtime and type level.
2. Derived base envelope type directly from Zod schema (`z.infer<typeof BaseLiveEventEnvelopeSchema>`) to maintain a single Zod source of truth.
3. Hardened `createLiveEventEnvelopeSchema` factory parameters (required payload & string-constrained eventType schema), eliminating type widening in emitted declarations.
4. Created a declaration-consumer typecheck fixture (`packages/contracts/test/declaration-consumer.ts`) verifying emitted `.d.ts` declarations against package name `@crowdcircuit/contracts`.
5. Eliminated duplicate `SPEC_VERSION` declaration from root `src/index.ts`.
6. Renumbered FOUND-02B decision from ADR-008 to `ADR-009` to avoid conflict with System Design section 10 (`ADR-008 — Ephemeral local credentials`).
7. Synchronized `docs/execution/PROJECT_STATUS.md` with verified test results.

## Findings reproduced prior to fix

- **Missing payload / undefined payload:** `BaseLiveEventEnvelopeSchema` previously used `z.unknown()` fallback, allowing missing payload properties and non-JSON JavaScript values.
- **Non-string eventType in factory:** Factory parameters previously accepted non-string schemas without compile-time type rejection.
- **Type widening in declarations:** Optional factory parameters (`??` fallback) resulted in widened generic return types in emitted `.d.ts` files.
- **Duplicate SPEC_VERSION:** `SPEC_VERSION` was declared in both `src/common/primitives.ts` and `src/index.ts`.
- **ADR ID Conflict:** `ADR-008` in original FOUND-02B handoff collided with System Design section 10 (`ADR-008 — Ephemeral local credentials`).

## Implementation details

### 1. JSON-Value Strategy & Required Payload Fix (FIX A)

Created `JsonValueSchema` and `JsonValue` type in `packages/contracts/src/common/json.ts`:
- Validates primitives (`string`, `number.finite`, `boolean`, `null`), plain objects (`proto === Object.prototype || proto === null`), and arrays recursively.
- Rejects non-JSON types: `undefined`, `function`, `bigint`, `symbol`, `NaN`, `Infinity`, `-Infinity`, `Date`, `Map`, `Set`, and class instances.
- Base envelope requires `payload` property (`payload: JsonValueSchema`). Missing payload or `payload: undefined` fails validation.

### 2. Single Zod Source of Truth & Type Alignment (FIX B)

- `BaseLiveEventEnvelope` derived directly via `z.infer<typeof BaseLiveEventEnvelopeSchema>`.
- `LiveEventEnvelope<TPayload, TEventType>` defined via `Omit<BaseLiveEventEnvelope, "payload" | "eventType"> & { eventType: TEventType; payload: TPayload }`.
- Eliminates handwritten duplicate interface declarations.

### 3. Factory Signature & Inference Behavior (FIX C)

- `createLiveEventEnvelopeSchema(payloadSchema, eventTypeSchema)` requires both parameters.
- `TEventTypeSchema` constrained to `z.ZodType<string, z.ZodTypeDef, unknown>`.
- Rejects non-string schemas (e.g. `z.number()`) at compile-time.
- Preserves exact inferred payload and literal eventType types.

### 4. Declaration Consumer Test Design (FIX D)

- Created `packages/contracts/test/declaration-consumer.ts` importing from `@crowdcircuit/contracts`.
- Created `packages/contracts/test/tsconfig.declarations.json` mapping `@crowdcircuit/contracts` to `../dist/index.d.ts`.
- Added script `"test:declarations": "tsc -p test/tsconfig.declarations.json"` to `packages/contracts/package.json`.
- Compiles cleanly after package build. Excluded from `dist/` compilation.

### 5. Single SPEC_VERSION Source (FIX F)

- `SPEC_VERSION` declared exclusively in `packages/contracts/src/common/primitives.ts`.
- Re-exported via `src/common/index.ts` and `src/index.ts`.

### 6. ADR Renumbering (FIX G)

- Original FOUND-02B handoff reference `ADR-008` was renumbered to `ADR-009 — Generic LiveEventEnvelope Schema Factory and JSON-Safe Payload Strategy` in `docs/execution/DECISIONS.md`.
- Updated consequences section to document runtime costs of recursive validation and explicit rejection of non-JSON JavaScript values.

## Files changed and created

### Created files

- `packages/contracts/src/common/json.ts` — `JsonValueSchema` and `JsonValue` type definition.
- `packages/contracts/test/declaration-consumer.ts` — Package-name declaration consumer typecheck fixture.
- `packages/contracts/test/tsconfig.declarations.json` — TypeScript config for declaration consumer testing against `dist/index.d.ts`.
- `docs/handoffs/HANDOFF-FOUND-02B-PATCH-01.md` — This handoff document.

### Modified files

- `packages/contracts/src/common/index.ts` — Re-exported `json.js`.
- `packages/contracts/src/events/envelope.ts` — Updated `createLiveEventEnvelopeSchema`, `BaseLiveEventEnvelopeSchema`, and type derivations.
- `packages/contracts/src/index.ts` — Removed duplicate `SPEC_VERSION` constant.
- `packages/contracts/package.json` — Added `"test:declarations"` script.
- `packages/contracts/test/live-event-envelope.test.ts` — Added required payload and JSON-safety test suites (14 tests total).
- `docs/execution/DECISIONS.md` — Renumbered ADR-008 to `ADR-009` and updated consequences.
- `docs/execution/PROJECT_STATUS.md` — Updated baseline test counts, declaration test status, and base commit.

## Verification results

### Package-level checks (`@crowdcircuit/contracts`)

```bash
pnpm --filter @crowdcircuit/contracts lint               # ✅ Passed (0 errors, 0 warnings)
pnpm --filter @crowdcircuit/contracts typecheck          # ✅ Passed (tsc -b clean)
pnpm --filter @crowdcircuit/contracts test               # ✅ Passed (3 test files, 33 tests passed)
pnpm --filter @crowdcircuit/contracts exec tsc -b --force # ✅ Passed (dist generated)
pnpm --filter @crowdcircuit/contracts test:declarations  # ✅ Passed (tsc -p test/tsconfig.declarations.json clean)
```

### Dist artifact check

`packages/contracts/dist/` verified via directory inspection:
- `dist/index.js`, `dist/index.d.ts`, `dist/common/`, `dist/events/`, `dist/actions/`, `dist/voice/`
- Zero test or declaration fixture artifacts (`*.test.js`, `*.test.d.ts`, `test/`, `declaration-consumer.*`) in `dist/`.

### Full repository baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (4 test files, 35 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
```

## Known limitations

- Specific domain event payload schemas (`gift.sent`, `chat.comment`, etc.) are intentionally not implemented yet. They will be added in FOUND-02C.

## Git status post-patch

```
On branch main
Changes not staged for commit:
	modified:   docs/execution/DECISIONS.md
	modified:   docs/execution/PROJECT_STATUS.md
	modified:   packages/contracts/package.json
	modified:   packages/contracts/src/common/index.ts
	modified:   packages/contracts/src/events/envelope.ts
	modified:   packages/contracts/src/index.ts
	modified:   packages/contracts/test/live-event-envelope.test.ts

Untracked files:
	docs/handoffs/HANDOFF-FOUND-02B-PATCH-01.md
	packages/contracts/src/common/json.ts
	packages/contracts/test/declaration-consumer.ts
	packages/contracts/test/tsconfig.declarations.json
```

No commit was performed (pending user commit).

## Next task

`FOUND-02C — LIVE Event Payload Schemas`
