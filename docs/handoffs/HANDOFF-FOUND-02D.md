# Handoff — FOUND-02D — GameActionEnvelope and Action Lifecycle Schemas

**Status:** IMPLEMENTED — AWAITING INDEPENDENT REVIEW  
**Date:** 2026-07-23  
**Verified Base Commit:** `c4c3dae` (`docs: close FOUND-02C and prepare FOUND-02D`)  
**Parent Commit:** `34ad050` (`found 02c`)  
**Agent Session:** FOUND-02D GameActionEnvelope and Action Lifecycle Contracts Implementation  

## Summary

Implemented versioned public contracts for game actions and action lifecycle protocol in `@crowdcircuit/contracts`:
1. **GameActionEnvelope:** Versioned `"0.1"` envelope schema and inferred TypeScript types with non-empty string validation for IDs, actionType, gameId, and trigger fields; strict actor reference schema (`viewerId`, `displayName`, `avatarUrl`); strict trigger reference schema (`eventId`, `eventType`, `mappingId`); integer `priority`; positive integer `ttlMs`; ISO datetime `createdAt`; required nullable `gameInstanceId` and `actor`; strict object shape (`.strict()`); and JSON-safe generic `params` (defaulting to `JsonValue`).
2. **Registration and Heartbeat Messages:**
   - `game.register`: Strict message schema with `type: "game.register"`, non-empty `gameId`, `instanceId`, `sdkVersion`, and `token`.
   - `game.registered`: Strict message schema with `type: "game.registered"` and positive integer `heartbeatIntervalMs`.
   - `game.heartbeat`: Strict minimal frame schema with `type: "game.heartbeat"` (zero extra fields per design).
3. **Delivery, Receipt, and Result Messages:**
   - `game.action`: Strict WebSocket delivery wrapper message with `type: "game.action"` and `data: GameActionEnvelopeSchema`.
   - `game.action.received`: Strict receipt ACK message with `type: "game.action.received"`, non-empty `actionId`, and ISO `receivedAt`. Delivery receipt is strictly separated from gameplay completion.
   - `game.action.result`: Discriminated union on `status` ("completed" | "failed"):
     - `completed`: `type: "game.action.result"`, non-empty `actionId`, `status: "completed"`, non-negative integer `durationMs` (>= 0), optional JSON-safe `details`.
     - `failed`: `type: "game.action.result"`, non-empty `actionId`, `status: "failed"`, strict `error` object (`code`, `message`, `retryable`).
4. **Runtime & Declaration Test Coverage:**
   - Added 33 unit tests in `packages/contracts/test/domain-actions.test.ts` covering positive valid structures, nullable properties, JSON-safe params/details, error discrimination, and negative validations for invalid types, empty strings, bad URLs, invalid durations/TTLs, non-JSON objects, and extra keys.
   - Extended `packages/contracts/test/declaration-consumer.ts` with TypeScript compile-time verification for importability, literal message types, nullable field rejection (`undefined`/omission), receipt/result separation, result union narrowing, and `z.input`/`z.output` alignment.

## Paths Changed and Created

### Created files

- `packages/contracts/src/actions/envelope.ts` — GameActionActorSchema, GameActionTriggerSchema, GameActionEnvelopeSchema, and inferred types.
- `packages/contracts/src/actions/lifecycle.ts` — GameRegisterMessageSchema, GameRegisteredMessageSchema, GameHeartbeatMessageSchema, GameActionDeliveryMessageSchema, GameActionReceivedMessageSchema, GameActionCompletedResultSchema, GameActionFailedResultSchema, GameActionResultMessageSchema, GameActionErrorSchema, and inferred types.
- `packages/contracts/test/domain-actions.test.ts` — 33 focused runtime unit tests.
- `docs/handoffs/HANDOFF-FOUND-02D.md` — This handoff document.

### Modified files

- `packages/contracts/src/actions/index.ts` — Exported all envelope and lifecycle schemas and public types.
- `packages/contracts/test/declaration-consumer.ts` — Added compile-time declaration test cases for FOUND-02D.
- `docs/execution/PROJECT_STATUS.md` — Updated status, test counts (107 contract tests, 109 monorepo tests), and baseline commit `c4c3dae`.
- `docs/execution/CURRENT_TASK.md` — Updated status to IN_PROGRESS (AWAITING INDEPENDENT REVIEW) and set FOUND-02E as blocked.
- `docs/execution/ROADMAP.md` — Set FOUND-02D status to `PARTIAL`.

## Public API and Contract Invariants

- **Package exports:** Re-exported from `@crowdcircuit/contracts` top-level index.
- **Runtime validation:** All protocol message schemas are strict (`.strict()`) and reject unknown keys.
- **Nullable semantics:** `gameInstanceId`, `actor`, `actor.viewerId`, and `actor.avatarUrl` are required nullable fields that reject `undefined` or property omission.
- **Receipt vs Result Separation:** `game.action.received` contains only `actionId` and `receivedAt`, explicitly prohibiting completion status or result data.
- **Result Discrimination:** `GameActionResultMessageSchema` discriminates between `completed` and `failed` variants using `status`, preventing completed-only fields on failed results and vice-versa.
- **JSON Safety:** Generic `params` and `details` use `JsonValueSchema`, strictly rejecting `NaN`, infinities, functions, symbols, BigInts, dates, maps, sets, and class instances.

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
pnpm --filter @crowdcircuit/contracts test               # ✅ Passed (5 test files, 107 tests passed)
pnpm --filter @crowdcircuit/contracts build              # ✅ Passed (tsc -b clean)
pnpm --filter @crowdcircuit/contracts test:declarations  # ✅ Passed (tsc -p test/tsconfig.declarations.json clean)
```

### Declaration & Dist Inspection

- `packages/contracts/dist/actions/envelope.d.ts` exports `GameActionEnvelopeSchema`, `GameActionActorSchema`, `GameActionTriggerSchema`, `GameActionEnvelope<TParams = JsonValue>`, and `BaseGameActionEnvelope`.
- `packages/contracts/dist/actions/lifecycle.d.ts` exports `GameRegisterMessageSchema`, `GameRegisteredMessageSchema`, `GameHeartbeatMessageSchema`, `GameActionDeliveryMessageSchema`, `GameActionReceivedMessageSchema`, `GameActionCompletedResultSchema`, `GameActionFailedResultSchema`, `GameActionResultMessageSchema`, and `GameActionErrorSchema`.
- Zero `any` types emitted.
- Zero test artifacts (`*.test.*`, `declaration-consumer.*`, `test/`) in `dist/`.

### Full Repository Baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (6 test files, 109 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
git diff --check # ✅ Passed (0 trailing whitespace or formatting issues)
```

## Known Limitations & Explicit Exclusions

- No Socket.IO server or WebSocket runtime client code implemented.
- No SDK runtime, local queues, retry timers, or receipt timeouts added.
- No Action Gateway routing, budget token bucket, or Mapping Engine rules added.
- No Game Manifest schemas added (deferred to game management phase).
- Voice contracts (FOUND-02E) were NOT started.

## Final Git Status at Handoff-Generation Time

The following snapshot describes the working directory state at handoff-generation time:

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
	docs/handoffs/HANDOFF-FOUND-02D.md
	packages/contracts/src/actions/envelope.ts
	packages/contracts/src/actions/lifecycle.ts
	packages/contracts/test/domain-actions.test.ts

no changes added to commit (use "git add" and/or "git commit -a")
```

*No commit was performed during this implementation session. All changes are left uncommitted for independent Codex review.*

## Next Task

`FOUND-02E — VoiceIntent and Voice Protocol Schemas` (**BLOCKED**: must not start until FOUND-02D receives Codex review approval).
