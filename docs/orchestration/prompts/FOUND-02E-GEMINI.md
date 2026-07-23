# FOUND-02E — Gemini Flash High Implementation Prompt

## Task and objective

Implement `FOUND-02E — VoiceIntent and Voice Protocol Schemas`.

Add strict, versioned, runtime-validated public voice contracts for communication between the Voice Reaction Engine, TTS queue boundary, and Voice Output. Implement only cross-package schemas and inferred types. Do not implement rendering, normalization, queuing, TTS, playback, networking, or FOUND-02F.

FOUND-02E remains one task because it is confined to `@crowdcircuit/contracts`, its tests, and execution/handoff documentation.

## Exact reading order

Read in this order:

1. `docs/execution/PROJECT_STATUS.md`
2. `docs/execution/CURRENT_TASK.md`
3. `docs/tasks/FOUND-02E.md`
4. `docs/execution/DECISIONS.md`
5. `docs/execution/KNOWN_ISSUES.md`
6. `docs/orchestration/reviews/FOUND-02D-CODEX-REVIEW-FINAL.md`
7. `docs/handoffs/HANDOFF-FOUND-02D-REWORK-01.md`
8. `docs/crowdcircuit-system-design-v0.1.1.md`:
   - `## 11.10 Voice Reaction Engine`
   - `## 11.11 Name Normalizer`
   - `## 11.12 Priority Queue cho voice`
   - `## 11.13 TTS Provider`
   - `## 11.14 Audio Playback`
   - `## 12.3 VoiceIntent`
   - only voice-related content in `## 14. WebSocket protocol`
9. Existing package conventions:
   - `packages/contracts/src/common/**`
   - `packages/contracts/src/events/**`
   - `packages/contracts/src/actions/**`
   - `packages/contracts/src/voice/index.ts`
   - `packages/contracts/src/index.ts`
   - `packages/contracts/test/**`
   - `packages/contracts/package.json`

Do not read the full UI/UX specification or unrelated System Design sections.

## Preflight

Before changing files, run and report exact output:

```powershell
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

The working tree may contain the approved, uncommitted FOUND-02D task and its orchestration artifacts. Preserve all existing changes. Git output is authoritative. Do not reset, restore, overwrite, or discard prior work.

Fresh closure versions were Node.js `v24.15.0` and pnpm `11.9.0`; record only actual command output.

## Allowed paths

- `packages/contracts/src/voice/**`
- `packages/contracts/src/common/**` only if a genuinely shared primitive is missing
- `packages/contracts/src/index.ts`
- `packages/contracts/test/**`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/execution/DECISIONS.md` only for a genuinely new architectural decision
- `docs/execution/KNOWN_ISSUES.md` only for a verified issue
- `docs/handoffs/HANDOFF-FOUND-02E.md`

Do not modify approved event or action contracts and tests except to resolve a verified regression that prevents the package from remaining valid. Stop and report before changing anything outside the allowed paths.

## Required public contracts

Export Zod schemas and inferred types for:

1. `VoiceIntent`
2. Voice intent kind
3. Voice interrupt policy
4. `voice.play` message
5. Playback callback variants:
   - started
   - finished
   - interrupted
   - failed
6. A discriminated playback callback union

Use clear names consistent with existing contract conventions. Every intended public API must be reachable through package-name imports from `@crowdcircuit/contracts`.

## VoiceIntent

Implement the exact design shape:

```ts
{
  specVersion: "0.1";
  intentId: string;
  eventId: string | null;
  kind: "thank_gift" | "welcome_follow" | "game_commentary" | "system";
  priority: number;
  templateGroup: string;
  variables: Record<string, string | number>;
  voiceProfileId: string;
  dedupeKey: string | null;
  expiresAt: string;
}
```

Requirements:

- Reuse `SpecVersionSchema` and `IsoDateTimeSchema`.
- `intentId`, non-null `eventId`, `templateGroup`, `voiceProfileId`, and non-null `dedupeKey` are non-empty strings.
- `eventId` and `dedupeKey` are required nullable properties, never optional.
- `priority` is a finite integer. Do not invent a range absent from the design.
- `kind` is exactly the four literals from the task brief.
- `variables` is a strict record whose values are only finite numbers or strings.
- Reject nested objects, arrays, booleans, `null`, `undefined`, functions, symbols, BigInts, `NaN`, and infinities in variables.
- `expiresAt` uses the existing ISO datetime contract.
- The intent object is strict and rejects connector, queue, TTS, or internal state fields.

Do not invent semantic relationships between kind, event ID, priority, template group, dedupe key, or expiration.

## Interrupt policy

Export an exact schema and inferred type for:

- `never_interrupt`
- `interrupt_lower_priority`
- `interrupt_any`

Do not add defaults or queue behavior in the contract layer.

## Voice play message

Implement the strict message shown by the design:

```ts
{
  type: "voice.play";
  jobId: string;
  audioUrl: string;
  subtitle: string;
  volume: number;
}
```

Requirements:

- `jobId` is non-empty.
- `audioUrl` accepts the design's local path example and a valid absolute URL. Reject empty strings and unsafe/non-path arbitrary values conservatively without requiring only network URLs.
- `subtitle` is a required string; require non-empty text unless repository design evidence explicitly supports silent subtitle text.
- `volume` is finite and bounded inclusively from `0` to `1`.
- The object is strict.
- Do not add provider, cache, queue, duration, format, or playback state fields.

## Playback callbacks

Implement strict callback variants and a discriminated union for the task-required states:

- started
- finished
- interrupted
- failed

Use stable message literals consistent with repository voice event naming, preferably:

- `voice.playback.started`
- `voice.playback.finished`
- `voice.playback.interrupted`
- `voice.playback.failed`

Every callback must include a non-empty `jobId`. Add no timestamp, duration, queue, provider, or retry fields unless exact design text requires them.

For failed playback, use a conservative strict error object:

```ts
{
  code: string;
  message: string;
}
```

Both strings must be non-empty. Do not add stack traces, raw errors, arbitrary details, retry state, or provider response payloads.

The callback union must narrow correctly by its message discriminator. If repository naming evidence conflicts with the preferred literals above, stop and report `BLOCKED_DECISION` rather than silently inventing another public protocol.

## Contract invariants

- Zod schemas are the runtime source of truth.
- Infer public types from schemas.
- Runtime, `z.input`, `z.output`, and emitted declarations must align.
- All fixed-shape objects are strict.
- Required nullable properties reject omission and explicit `undefined`.
- All numeric values reject `NaN` and both infinities.
- No `any`, `z.any()`, unsafe assertions, or unchecked payload escape hatches.
- Preserve JSON-safe public contract behavior.
- Preserve exact literals and discriminated-union narrowing.
- Reuse shared primitives rather than duplicating them.
- Do not weaken approved event or action contracts.

## Runtime tests

Add positive and negative tests without removing existing valid coverage.

Positive coverage:

- All four VoiceIntent kinds.
- Zero, positive, and negative integer priorities.
- Required nullable `eventId` and `dedupeKey` accept `null`.
- Non-null nullable IDs accept non-empty strings.
- Variables accept empty records, strings, finite integers, finite fractional numbers, and mixed scalar records.
- All three interrupt policy literals.
- Valid `voice.play` using the local path example.
- Valid `voice.play` using an absolute URL.
- Volume boundaries `0` and `1`, plus a value between them.
- Each playback callback variant.
- Failed callback with conservative error.
- Callback union parsing and narrowing.

Negative coverage:

- Unsupported kind and interrupt-policy literals.
- Empty required identifiers and strings.
- Omitted and explicit `undefined` for required nullable properties.
- Fractional priority, `NaN`, and both infinities.
- Invalid expiration datetime.
- Variables containing nested object, array, boolean, `null`, `undefined`, function, symbol, BigInt, `NaN`, either infinity, Date, Map, Set, or class instance.
- Invalid or empty audio URL/path.
- Volume below `0`, above `1`, `NaN`, and both infinities.
- Wrong message discriminator.
- Missing required callback fields.
- Empty callback job ID.
- Empty failed error code/message.
- Extra keys on the intent, play message, every callback variant, and nested error object.
- Mismatched callback fields between variants.

## Package-name declaration tests

Extend `packages/contracts/test/declaration-consumer.ts` using imports only from `@crowdcircuit/contracts`.

Prove:

- Every new schema and type is publicly importable.
- All VoiceIntent kinds and interrupt policies preserve exact literals.
- Required nullable fields accept `null` but reject omission and `undefined`.
- Variables accept only `Record<string, string | number>`.
- Invalid nested/scalar variable types fail.
- Voice play fields retain their intended types.
- Volume is a number at the type level; runtime tests enforce bounds.
- Callback variants preserve exact discriminators.
- The callback union narrows variant-specific fields correctly.
- Failed-only error data is rejected on other callbacks.
- `z.input` and `z.output`/`z.infer` remain aligned for VoiceIntent and the callback union.
- Fresh object literals reject invented top-level and nested fields.
- All prior LIVE and action declaration regressions remain intact.

Use correctly placed `@ts-expect-error` directives. Do not use casts that bypass the intended checks.

## Explicit exclusions

Do not implement:

- Template rendering or random template selection
- Name normalization, moderation, pronunciation, or aliases
- Aggregation, cooldown, deduplication behavior, or expiration processing
- Priority queue, interrupt execution, fade-out, replay, or watchdog behavior
- TTS provider interfaces or implementations
- Audio generation, caching, storage, HTTP media serving, or browser playback
- Socket.IO/WebSocket server or client runtime
- Pairing/authentication
- UI or browser-source pages
- Internal queue/job state machines
- FOUND-02F or unrelated refactors

## Verification

Run focused verification:

```powershell
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations
```

Inspect built declarations and artifacts:

- `packages/contracts/dist/voice/**`
- `packages/contracts/dist/index.d.ts`

Confirm:

- Root declarations export the intended voice API.
- VoiceIntent and callback schema input/output types align.
- Required nullable fields remain required.
- Variables emit only scalar string/number values.
- Callback union remains discriminated.
- No uncontrolled `any` appears.
- No test or declaration fixture artifacts leak into `dist`.
- No stale or unrelated artifacts appear.

Run repository verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status
git diff --stat
git diff
git ls-files --others --exclude-standard
```

Report exact test-file and test counts from fresh output.

## Documentation and handoff

Create `docs/handoffs/HANDOFF-FOUND-02E.md` with:

- Status `IMPLEMENTED — AWAITING INDEPENDENT REVIEW`
- Date and actual verified base `HEAD`
- Clear note that the starting working tree already contained approved, uncommitted FOUND-02D work
- Summary and exact changed/created paths attributable to FOUND-02E
- Public API and contract invariants
- Exact verification results/counts
- Declaration and dist inspection evidence
- Known limitations and explicit exclusions
- Final Git status explicitly labeled as the handoff-generation-time snapshot
- Statement that FOUND-02F was not started

Synchronize execution documents conservatively:

- Keep FOUND-02E current and non-DONE.
- Set ROADMAP FOUND-02E to `PARTIAL`.
- Do not select or start FOUND-02F.
- Preserve historical handoffs and reports.
- Update decisions or known issues only if genuinely required by verified evidence.

## Commit policy and no-commit instruction

Prefer one commit per completed task. Do not request a separate commit solely for the prompt, handoff, review, or status documents.

For this implementation session, do not stage, commit, amend, reset, restore, checkout, push, or create a branch. Preserve all current working-tree changes and leave FOUND-02E uncommitted for independent review and user-controlled commit/push.

## Final response format

Return exactly:

1. `Preflight and Preserved Working Tree`
2. `VoiceIntent`
3. `Voice Play and Playback Callbacks`
4. `Files Changed`
5. `Runtime Tests`
6. `Declaration Tests`
7. `Build and Dist Inspection`
8. `Repository Verification`
9. `Documentation and Handoff`
10. `Final Git Status`
11. `Risks or Blockers`

Use exact command output and counts. State `None` only when no risk or blocker exists.
