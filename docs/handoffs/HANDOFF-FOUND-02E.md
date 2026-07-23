# Handoff — FOUND-02E — VoiceIntent and Voice Protocol Schemas

**Status:** IMPLEMENTED — AWAITING INDEPENDENT RE-REVIEW (REWORK-02 APPLIED)  
**Date:** 2026-07-23  
**Verified Base Commit:** `76d7013` (`feat: complete FOUND-02D action lifecycle contracts`)  
**Starting Working Tree:** Clean on base commit `76d7013`  
**Agent Session:** FOUND-02E VoiceIntent and Voice Protocol Schemas Implementation & Rework 02  

## Summary

Implemented strict, versioned, runtime-validated public voice contracts for communication between the Voice Reaction Engine, TTS queue boundary, and Voice Output client:

1. **`VoiceIntent` and Voice Interrupt Policy:**
   - `VoiceIntentKindSchema`: Enum validating exact literals (`"thank_gift"`, `"welcome_follow"`, `"game_commentary"`, `"system"`).
   - `VoiceIntentVariablesSchema`: Requires a plain object container (Object.prototype or null prototype) mapping string keys strictly to scalar `string` or finite `number` values. Uses `Reflect.get` for assertion-free property inspection. Rejects non-plain containers (class instances, `Date`, `Map`, `Set`, arrays, `null`, functions) directly as well as invalid values inside the object.
   - `VoiceIntentSchema`: Versioned (`"0.1"`) strict object validating `intentId`, required nullable `eventId` (`string | null`), `kind`, integer `priority`, `templateGroup`, `variables`, `voiceProfileId`, required nullable `dedupeKey` (`string | null`), and ISO `expiresAt`.
   - `VoiceInterruptPolicySchema`: Enum validating exact policy literals (`"never_interrupt"`, `"interrupt_lower_priority"`, `"interrupt_any"`).
2. **`voice.play` Message:**
   - `VoicePlayMessageSchema`: Strict object validating `type: "voice.play"`, non-empty `jobId`, local audio path (starting with single `"/"`, no backslashes, no dot traversal segments, verified after one-pass percent decoding) or valid absolute `http:` / `https:` URL without credentials `audioUrl`, non-empty `subtitle`, and bounded `volume` (`0 <= volume <= 1`).
3. **Playback Callbacks & Discriminated Union (ADR-010):**
   - `VoicePlaybackStartedMessageSchema`: Strict callback for `type: "playback.started"`.
   - `VoicePlaybackFinishedMessageSchema`: Strict callback for `type: "playback.finished"`.
   - `VoicePlaybackInterruptedMessageSchema`: Strict callback for `type: "playback.interrupted"`.
   - `VoicePlaybackErrorSchema`: Conservative strict error object containing non-empty `code` and `message`.
   - `VoicePlaybackFailedMessageSchema`: Strict callback for `type: "playback.failed"` with strict error object.
   - `VoicePlaybackCallbackMessageSchema`: Discriminated union on `type` property using public `playback.*` wire literals.

## Paths Changed and Created

### Created files

- `packages/contracts/src/voice/intent.ts` — VoiceIntent, VoiceIntentKind, VoiceIntentVariables, VoiceInterruptPolicy schemas and inferred types.
- `packages/contracts/src/voice/protocol.ts` — VoicePlayMessage, playback callbacks, conservative error, and discriminated callback union schemas and inferred types.
- `packages/contracts/test/domain-voice.test.ts` — 29 runtime unit tests covering positive and negative validation rules for voice contracts.
- `docs/handoffs/HANDOFF-FOUND-02E.md` — Initial handoff document.
- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md` — Rework 01 handoff document.
- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-02.md` — Rework 02 handoff document.

### Modified files

- `packages/contracts/src/voice/index.ts` — Exported intent and protocol schemas and types.
- `packages/contracts/test/declaration-consumer.ts` — Extended with compile-time assertions for all voice schemas, types, nullables, variables, play message, and callback union narrowing.
- `docs/execution/PROJECT_STATUS.md` — Updated baseline test counts (143 contract tests, 145 monorepo tests) and status `Rework 02 Complete — Awaiting Re-review`.
- `docs/execution/CURRENT_TASK.md` — Updated task pointer to FOUND-02E and blocked FOUND-02F.
- `docs/execution/ROADMAP.md` — Set FOUND-02E status to `PARTIAL`.

## Public API and Contract Invariants

- **Exported Schemas:** `VoiceIntentKindSchema`, `VoiceIntentVariablesSchema`, `VoiceIntentSchema`, `VoiceInterruptPolicySchema`, `VoicePlayMessageSchema`, `VoicePlaybackStartedMessageSchema`, `VoicePlaybackFinishedMessageSchema`, `VoicePlaybackInterruptedMessageSchema`, `VoicePlaybackErrorSchema`, `VoicePlaybackFailedMessageSchema`, `VoicePlaybackCallbackMessageSchema`, `VoicePlaybackMessageSchema`.
- **Exported Public Types:** `VoiceIntentKind`, `VoiceIntentVariables`, `VoiceIntent`, `VoiceInterruptPolicy`, `VoicePlayMessage`, `VoicePlaybackStartedMessage`, `VoicePlaybackFinishedMessage`, `VoicePlaybackInterruptedMessage`, `VoicePlaybackError`, `VoicePlaybackFailedMessage`, `VoicePlaybackCallbackMessage`, `VoicePlaybackMessage`.
- **Strictness:** Every fixed-shape object is `.strict()` and rejects unknown keys.
- **Nullable Semantics:** `eventId` and `dedupeKey` are required nullable fields that reject omission and `undefined`.
- **Numeric Bounds:** Priority requires finite integer; volume requires finite number in range `[0, 1]`; variables reject `NaN` and infinities.

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

- Root `dist/index.d.ts` re-exports all voice schemas and types.
- `dist/voice/intent.d.ts` and `dist/voice/protocol.d.ts` emit aligned `z.input` and `z.output` shapes.
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

- No template rendering or TTS generation logic implemented.
- No Name Normalizer or moderation implemented.
- No TTS queue, priority queue, or audio playback player implemented.
- No Socket.IO server or client runtime implemented.
- Double-encoded local paths (`/a/%252e%252e/b.mp3`) pass one-pass decoding validation because no second-decoding boundary exists in the repository.
- FOUND-02F was NOT started.

## Next Task

`FOUND-02F — Contract Fixtures and Integration Review` (**BLOCKED**: must not start until FOUND-02E receives Codex review approval).
