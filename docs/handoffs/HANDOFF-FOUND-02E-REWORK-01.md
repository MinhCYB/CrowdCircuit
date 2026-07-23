# Handoff — FOUND-02E-REWORK-01 — VoiceIntent and Voice Protocol Schemas Rework 01

**Status:** REWORK COMPLETE — AWAITING INDEPENDENT RE-REVIEW  
**Date:** 2026-07-23  
**Verified Base Commit:** `76d7013` (`feat: complete FOUND-02D action lifecycle contracts`)  
**Product Decision:** ADR-010 — Public Voice Output Callbacks Use `playback.*` Wire Literals  
**Agent Session:** FOUND-02E-REWORK-01 Callback Literals, Safe URL Validation, Plain Variables Container  

## Summary

Addressed all high, medium, and low severity findings identified during Codex independent review 01 (`docs/orchestration/reviews/FOUND-02E-CODEX-REVIEW-01.md`):

1. **Public Callback Literals (ADR-010):**
   - Replaced `voice.playback.*` callback wire literals with public `playback.*` literals (`playback.started`, `playback.finished`, `playback.interrupted`, `playback.failed`) across `VoicePlaybackStartedMessageSchema`, `VoicePlaybackFinishedMessageSchema`, `VoicePlaybackInterruptedMessageSchema`, `VoicePlaybackFailedMessageSchema`, and the `VoicePlaybackCallbackMessageSchema` discriminated union in `packages/contracts/src/voice/protocol.ts`.
   - Reserved `voice.playback.*` for potential internal application events or handler names.
   - Added explicit runtime and declaration tests proving that legacy `voice.playback.*` wire literals are rejected by the public callback contract.
2. **Safe `audioUrl` Validation:**
   - Implemented `isValidAudioUrl` in `packages/contracts/src/voice/protocol.ts`.
   - Allows only absolute `http:` and `https:` URLs (requiring non-empty hostname and rejecting embedded credentials) plus conservative root-relative local media paths (must start with single `"/"`, contain no backslashes, contain no `.` or `..` dot traversal segments or `%2e` encoded forms, contain at least one non-empty path segment, contain no control characters, and contain no query parameters or fragments).
   - Rejects empty strings, arbitrary non-path strings, relative paths without leading `"/"`, `javascript:`, `data:`, `file:`, `ftp:`, protocol-relative `//host/path`, `/../secret.mp3`, `/./voice.mp3`, backslashes, malformed URLs, and URL credentials.
   - Added positive and negative runtime tests in `packages/contracts/test/domain-voice.test.ts`.
3. **Plain Variables Container:**
   - Updated `VoiceIntentVariablesSchema` in `packages/contracts/src/voice/intent.ts` to use `z.custom<Record<string, string | number>>`.
   - Requires a plain object container whose prototype is `Object.prototype` or `null`.
   - Rejects non-plain containers directly (`new EmptyClass()`, `Date`, `Map`, `Set`, arrays, `null`, functions) while preserving the public inferred input/output type `Record<string, string | number>`.
   - Added runtime container rejection tests in `packages/contracts/test/domain-voice.test.ts`.
4. **Documentation & ROADMAP Reconciliation:**
   - Updated `docs/execution/ROADMAP.md` setting task `FOUND-02E` to status `PARTIAL`.
   - Updated `docs/execution/CURRENT_TASK.md` setting status to `IN_PROGRESS (REWORK-01)` and blocking `FOUND-02F`.
   - Updated `docs/execution/PROJECT_STATUS.md` with baseline test counts (143 contract tests, 145 monorepo tests), fresh toolchain output (Node.js `v24.15.0`, pnpm `11.9.0`), and current task pointer.
   - Reconciled `docs/handoffs/HANDOFF-FOUND-02E.md` with ADR-010 callback literals and actual Git state.

## Paths Changed and Created

### Created files

- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md` — This rework handoff document.

### Modified files

- `packages/contracts/src/voice/intent.ts` — Plain variables container validation.
- `packages/contracts/src/voice/protocol.ts` — ADR-010 public `playback.*` callback literals and safe `audioUrl` validation.
- `packages/contracts/test/domain-voice.test.ts` — Added safe `audioUrl` positive/negative tests, plain container tests, and updated playback callback tests (29 tests total).
- `packages/contracts/test/declaration-consumer.ts` — Updated voice declaration checks for public `playback.*` literals and added legacy literal rejection check.
- `docs/execution/ROADMAP.md` — Updated status to `PARTIAL`.
- `docs/execution/CURRENT_TASK.md` — Updated task status and rework pointers.
- `docs/execution/PROJECT_STATUS.md` — Updated baseline test counts (143 contract tests, 145 monorepo tests).
- `docs/handoffs/HANDOFF-FOUND-02E.md` — Reconciled initial handoff.

## Public API and Contract Invariants

- **Public Callback Literals:** `playback.started`, `playback.finished`, `playback.interrupted`, `playback.failed`.
- **Variables Type:** `Record<string, string | number>` emitted for both input and output.
- **Runtime Source of Truth:** Zod schemas validate plain container structure, URL safety, scalar variable values, integer priorities, and bounded volume (`0` to `1`).
- **Strictness:** Fixed-shape objects remain `.strict()` and reject unknown keys.

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
pnpm --filter @crowdcircuit/contracts test               # ✅ Passed (6 test files, 143 tests passed)
pnpm --filter @crowdcircuit/contracts build --force      # ✅ Passed (tsc -b "--force" clean)
pnpm --filter @crowdcircuit/contracts test:declarations  # ✅ Passed (tsc -p test/tsconfig.declarations.json clean)
```

### Declaration & Dist Inspection

- `packages/contracts/dist/voice/protocol.d.ts` emits `playback.started`, `playback.finished`, `playback.interrupted`, and `playback.failed`.
- `packages/contracts/dist/voice/intent.d.ts` emits `VoiceIntentVariables` as `Record<string, string | number>`.
- Zero `any` types emitted.
- Zero test or declaration-consumer fixture artifacts leaked into `dist`.

### Full Repository Baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (7 test files, 145 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
git diff --check # ✅ Passed (0 trailing whitespace or formatting issues)
```

## Known Limitations & Explicit Exclusions

- No internal `voice.playback.*` event bus or mapping layer implemented.
- No TTS queue, priority queue, audio player, TTS provider, or Socket.IO runtime implemented.
- FOUND-02F was NOT started.

## Historical Snapshot Note

This document represents the historical REWORK-01 state snapshot. For current repository state, see `HANDOFF-FOUND-02E-REWORK-02.md`.

## Next Task

`FOUND-02F — Contract Fixtures and Integration Review` (**BLOCKED**: must not start until FOUND-02E receives Codex re-review approval).
