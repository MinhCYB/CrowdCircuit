# Handoff — FOUND-02E-REWORK-02 — VoiceIntent and Voice Protocol Schemas Rework 02

**Status:** REWORK COMPLETE — AWAITING INDEPENDENT RE-REVIEW  
**Date:** 2026-07-23  
**Verified Base Commit:** `76d7013` (`feat: complete FOUND-02D action lifecycle contracts`)  
**Product Decision:** ADR-010 — Public Voice Output Callbacks Use `playback.*` Wire Literals  
**Agent Session:** FOUND-02E-REWORK-02 One-Pass Decoded Audio URL Validation & Assertion-Free Reflect.get  

## Summary

Addressed all high, medium, and low severity findings identified during Codex independent review 02 (`docs/orchestration/reviews/FOUND-02E-CODEX-REVIEW-02.md`):

1. **One-Pass Percent-Decoded Audio URL Validation:**
   - Updated `isValidAudioUrl` in `packages/contracts/src/voice/protocol.ts`.
   - Performs a safe `decodeURIComponent(val)` pass wrapped in `try ... catch` for root-relative paths.
   - Rejects decoding failures (`URIError`), post-decode backslashes (`\`), post-decode control characters (U+0000..U+001F, U+007F), post-decode query/fragment delimiters (`?` or `#`), and post-decode `.` or `..` path segments.
   - Retained valid absolute `http:` and `https:` URL validation without credentials or missing hosts.
   - Added permanent runtime unit tests in `packages/contracts/test/domain-voice.test.ts` for `/a/%2e%2e/b.mp3`, `/a/%2E%2E/b.mp3`, `/a/..%2fb.mp3`, `/a/%2f..%2fb.mp3`, `/a%0ab.mp3`, encoded backslashes (`/path%5cfile.mp3`), malformed percent sequences (`/a/%2`), and encoded query/fragment delimiters (`/a/%3fb.mp3`, `/a/%23b.mp3`).
2. **Assertion-Free `Reflect.get` Variables Validation:**
   - Replaced `const v = (val as Record<string, unknown>)[key];` in `packages/contracts/src/voice/intent.ts` with `const v = Reflect.get(val, key);`.
   - Removed all production type assertions while preserving plain-object container checks (`Object.prototype` or `null`), symbol-key rejection (`typeof key !== "string"`), scalar value validation (string or finite number), non-plain container rejections (`EmptyClass`, `Date`, `Map`, `Set`, arrays, `null`, functions), and exported input/output TypeScript type `Record<string, string | number>`.
3. **Documentation & Handoff Reconciliation:**
   - Updated `docs/execution/PROJECT_STATUS.md` recording fresh verified tool output: Node.js `v24.15.0` and pnpm `11.9.0`.
   - Reconciled `docs/handoffs/HANDOFF-FOUND-02E.md` and `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md`.
   - Verified that `ROADMAP.md` retains FOUND-02E as `PARTIAL`, `CURRENT_TASK.md` retains status `IN_PROGRESS (REWORK-02)`, and `FOUND-02F` remains blocked.

## One-Pass Decoding Boundaries & Documented Limitations

- **One-Pass Decoding:** Root-relative paths are decoded exactly once via `decodeURIComponent` to catch encoded path traversals (`%2e%2e`), encoded control characters (`%0a`), encoded backslashes (`%5c`), encoded query/fragment delimiters (`%3f`/`%23`), and malformed percent sequences (`%2`).
- **Double-Encoded Limitation:** The double-encoded path `/a/%252e%252e/b.mp3` decodes once to `/a/%2e%2e/b.mp3`, which does not contain literal `..` or control characters after a single decoding pass. Because the repository currently defines no second percent-decoding boundary, this value passes one-pass validation. This is a documented design boundary and is not a blocking rejection requirement.

## Paths Changed and Created

### Created files

- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-02.md` — This rework 02 handoff document.

### Modified files

- `packages/contracts/src/voice/intent.ts` — Assertion-free `Reflect.get` variables validation.
- `packages/contracts/src/voice/protocol.ts` — One-pass percent-decoded root-relative `audioUrl` validation.
- `packages/contracts/test/domain-voice.test.ts` — Added runtime tests for encoded traversal, control characters, backslashes, malformed sequences, query/fragment delimiters (29 tests total).
- `docs/execution/PROJECT_STATUS.md` — Updated baseline tool output and task status.
- `docs/execution/CURRENT_TASK.md` — Updated CURRENT_TASK pointer to REWORK-02.
- `docs/handoffs/HANDOFF-FOUND-02E.md` — Reconciled tool versions.
- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md` — Reconciled tool versions.

## Public API and Contract Invariants

- **Public Callback Literals:** `playback.started`, `playback.finished`, `playback.interrupted`, `playback.failed`.
- **Variables Container:** Plain object container (`Object.prototype` or `null`) mapping string keys to string or finite number.
- **Variables Types:** `Record<string, string | number>` emitted for both input and output.
- **URL Safety:** Absolute `http:` / `https:` without credentials, or conservative root-relative paths validated post one-pass decoding.
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

- `packages/contracts/dist/voice/intent.d.ts` preserves `VoiceIntentVariablesSchema` input/output as `Record<string, string | number>`.
- `packages/contracts/dist/voice/protocol.d.ts` emits approved public `playback.*` callback literals.
- Zero `any` or `z.any()` types emitted.
- Zero test or declaration-consumer fixture artifacts leaked into `dist`.

### Full Repository Baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (7 test files, 145 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
git diff --check # ✅ Passed (0 trailing whitespace or formatting issues)
```

## Reconstructed Git Status Evidence

The earlier file-by-file status block was reconstructed rather than captured
verbatim and incorrectly classified several accumulated untracked files as
modified. It has therefore been removed. The reliable historical facts are
that the complete FOUND-02E working tree was uncommitted on `main` on top of
base commit `76d7013`, and no commit or push was performed. Use fresh
`git status --short` and `git ls-files --others --exclude-standard` output as
the source of truth for the current file inventory.

*No commit or push was performed during this rework session. All changes remain uncommitted for independent Codex re-review.*

## Next Task

`FOUND-02F — Contract Fixtures and Integration Review` (**BLOCKED**: must not start until FOUND-02E receives Codex re-review approval).
