# FOUND-02E REWORK-01 — Gemini Flash High Prompt

## Objective

Resolve only the verified FOUND-02E review findings:

1. Apply the accepted public `playback.*` callback literal decision.
2. Make `audioUrl` validation conservative and safe.
3. Require a plain variables container while preserving its public record type.
4. Reconcile current FOUND-02E documentation with actual Git and tool output.

Preserve all valid FOUND-02E implementation and all prior LIVE, action, and voice regression tests. Do not implement FOUND-02F or any voice runtime.

## Exact reading order

Read in this order:

1. Inspect the complete current working tree:
   - `git status`
   - `git rev-parse --short HEAD`
   - `git diff HEAD --stat`
   - `git diff HEAD --`
   - `git diff --check HEAD --`
   - `git ls-files --others --exclude-standard`
2. `docs/orchestration/reviews/FOUND-02E-CODEX-REVIEW-01.md`
3. `docs/execution/DECISIONS.md`, especially ADR-010
4. `docs/orchestration/prompts/FOUND-02E-GEMINI.md`
5. `docs/tasks/FOUND-02E.md`
6. `docs/handoffs/HANDOFF-FOUND-02E.md`
7. `docs/execution/PROJECT_STATUS.md`
8. `docs/execution/CURRENT_TASK.md`
9. `docs/execution/ROADMAP.md`
10. Current implementation and tests:
    - `packages/contracts/src/voice/intent.ts`
    - `packages/contracts/src/voice/protocol.ts`
    - `packages/contracts/src/voice/index.ts`
    - `packages/contracts/test/domain-voice.test.ts`
    - `packages/contracts/test/declaration-consumer.ts`
    - `packages/contracts/test/tsconfig.declarations.json`
11. System Design:
    - `## 11.14 Audio Playback`
    - `## 12.3 VoiceIntent`
    - only voice-related material from `## 14. WebSocket protocol`

Do not read unrelated design sections or the UI/UX specification.

## Preflight and preservation

FOUND-02E already exists as an uncommitted working-tree implementation on top of `HEAD 76d7013`. Git is authoritative. Preserve all existing valid work and all orchestration artifacts.

Run:

```powershell
git status
git rev-parse --short HEAD
git log -5 --oneline
git diff HEAD --stat
git diff --check HEAD --
git ls-files --others --exclude-standard
node --version
pnpm --version

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations
```

Fresh independent review output was Node.js `v24.15.0` and pnpm `11.9.0`. Record only your fresh actual output.

Do not reset, restore, checkout, overwrite, or discard the working tree. If it differs materially from the reviewed state, stop and report the difference before editing.

## Focused allowed paths

Modify only:

- `packages/contracts/src/voice/intent.ts`
- `packages/contracts/src/voice/protocol.ts`
- `packages/contracts/test/domain-voice.test.ts`
- `packages/contracts/test/declaration-consumer.ts`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/handoffs/HANDOFF-FOUND-02E.md` only to correct current factual claims and affected protocol descriptions
- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md`

Do not modify event contracts, action contracts, package scripts, dependencies, decisions, known issues, orchestration reports, or orchestration prompts. ADR-010 is already accepted and must not be rewritten.

## 1. Public callback literals

The accepted public Voice Output callback wire literals are:

- `playback.started`
- `playback.finished`
- `playback.interrupted`
- `playback.failed`

The `voice.playback.*` family is reserved for potential internal application events or handler names. It must not appear in the public Voice Output callback schemas or types.

Update:

- Runtime schemas.
- Inferred public types.
- Discriminated callback union.
- Runtime tests.
- Package-name declaration tests.
- Narrowing code in declaration tests.
- Current handoff descriptions.
- Built declaration expectations and inspection.
- Any affected source comments or current documentation descriptions.

Do not:

- Support both families.
- Add compatibility aliases that accept the old literals.
- Implement an internal event bus.
- Implement a public-to-internal mapping layer.
- Change the `voice.play` delivery literal.

Add explicit negative runtime and declaration checks proving `voice.playback.*` is rejected by the public callback contract.

## 2. Safe `audioUrl` validation

Allow only:

1. Absolute `http:` URLs.
2. Absolute `https:` URLs.
3. Conservative root-relative local media paths.

Preserve support for:

```text
/media/tts/voice_123.mp3
```

### Absolute URLs

Requirements:

- Must parse as an absolute URL.
- Protocol must be exactly `http:` or `https:`.
- Host must be present.
- Reject embedded credentials.
- Reject malformed values.

### Root-relative local media paths

Requirements:

- Must begin with exactly one `/`.
- Must not begin with `//`.
- Must not contain backslashes.
- Must not contain `.` or `..` path segments, including encoded traversal forms when detectable without introducing a URL sanitizer subsystem.
- Must contain at least one non-empty path segment.
- Reject control characters and whitespace-only/malformed paths.
- Query strings and fragments should be rejected unless exact repository evidence requires them; keep the contract conservative.

At minimum reject:

- Empty string.
- Arbitrary non-path string.
- Relative path without a leading `/`.
- `javascript:`.
- `data:`.
- `file:`.
- `ftp:`.
- Protocol-relative `//host/path`.
- `/../secret.mp3`.
- `/./voice.mp3`.
- Backslash-containing paths.
- Malformed absolute URLs.
- Absolute URLs containing username/password credentials.

Add explicit positive runtime tests for:

- The documented local media path.
- Valid absolute `http:` URL.
- Valid absolute `https:` URL.
- A conservative nested root-relative path.

Add explicit negative runtime tests for every rejected category above.

Do not add broad filesystem access, normalization, URL fetching, or browser behavior.

## 3. Plain variables container

Preserve the public input/output type:

```ts
Record<string, string | number>
```

Runtime requirements:

- The variables value must be a plain object.
- Its prototype must be exactly `Object.prototype` or `null`.
- Every own enumerable value must remain a string or finite number.
- Empty ordinary objects remain valid.
- Ordinary mixed scalar records remain valid.
- Null-prototype records are valid if implemented and tested intentionally.

Reject the variables value directly when it is:

- A class instance.
- `Date`.
- `Map`.
- `Set`.
- Array.
- `null`.
- Function.
- Any other non-plain container.

Continue rejecting invalid values inside an otherwise valid record:

- Nested objects.
- Arrays.
- Booleans.
- `null`.
- `undefined`.
- Functions.
- Symbols.
- BigInts.
- `NaN`.
- Positive or negative infinity.
- Dates, maps, sets, or class instances.

Do not use:

- `any`.
- `z.any()`.
- Unsafe assertions.
- Double assertions.
- A transform that causes `z.input`, `z.output`, or `z.infer` to weaken or drift from `Record<string, string | number>`.

Add direct runtime container tests for:

- Class instance rejected.
- Date rejected.
- Map rejected.
- Set rejected.
- Array rejected.
- `null` rejected.
- Valid ordinary object accepted.
- Valid null-prototype object accepted if intentionally supported.

Inspect emitted declarations to confirm both input and output retain the intended record type.

## 4. Documentation reconciliation

Correct current FOUND-02E documentation using actual Git and command output:

- Node.js `v24.15.0`.
- pnpm `11.9.0`.
- ROADMAP FOUND-02E status is `PARTIAL`.
- CURRENT_TASK remains FOUND-02E.
- FOUND-02F remains blocked.
- `docs/tasks/FOUND-02F.md` already exists.

Correct `docs/handoffs/HANDOFF-FOUND-02E.md` so that:

- Changed-file claims match actual Git.
- It no longer claims ROADMAP was modified in the original session if that was false at handoff-generation time.
- Its recorded Git-status snapshot is clearly historical and matches the actual state captured then; if exact historical correction cannot be proven, label the discrepancy rather than inventing a snapshot.
- Tool versions match fresh output.
- Protocol descriptions use only public `playback.*` literals.

Keep FOUND-02E active and awaiting re-review. Do not mark it DONE or select FOUND-02F.

## Test preservation

This rework is additive except for replacing the rejected public callback literals with the accepted literals.

Preserve:

- All existing valid FOUND-02E runtime tests.
- All existing FOUND-02E declaration tests.
- All prior LIVE declaration regressions.
- All prior action declaration regressions, including JSON-safe generic constraints and nullable matrices.
- Existing event/action runtime suites.

Do not remove valid coverage to make counts or commands pass.

## Required verification

Run package verification:

```powershell
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations
```

Inspect:

- `packages/contracts/dist/voice/intent.d.ts`
- `packages/contracts/dist/voice/protocol.d.ts`
- `packages/contracts/dist/voice/index.d.ts`
- `packages/contracts/dist/index.d.ts`

Confirm:

- Only `playback.*` public callback literals are emitted.
- `voice.playback.*` is absent from the public voice protocol declarations.
- Callback union narrowing remains correct.
- Failed error remains strict and conservative.
- VoiceIntent variables input/output are both `Record<string, string | number>`.
- Required nullable properties remain required.
- Root exports remain complete.
- No uncontrolled `any` or unsafe assertion is introduced.

Inspect dist cleanliness:

```powershell
rg --files packages/contracts/dist
rg -n "voice\.playback|playback\.|VoiceIntentVariables|declaration-consumer|domain-voice|\.test\." packages/contracts/dist
```

Confirm no tests, declaration fixtures, test directories, stale voice artifacts, or unrelated output leak into `dist`.

Run repository verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check HEAD --
git status
git diff HEAD --stat
git diff HEAD --
git ls-files --others --exclude-standard
```

Report exact test-file and test counts from fresh output.

## Rework handoff

Create:

`docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md`

Include:

- Status `REWORK COMPLETE — AWAITING INDEPENDENT RE-REVIEW`
- Date and actual base `HEAD`
- Product decision and ADR-010 reference
- Exact review findings addressed
- Exact changed and created paths
- Public callback literals
- URL allowlist and rejection behavior
- Variables-container behavior and emitted type evidence
- Runtime and package-name declaration coverage
- Exact package and repository verification results/counts
- Declaration and dist inspection results
- Current documentation reconciliation
- Known limitations and explicit exclusions
- Final Git status explicitly labeled as the handoff-generation-time snapshot
- Statement that FOUND-02F was not started

Do not rewrite this rework handoff as an implementation commit report. The working tree remains uncommitted unless actual Git output proves otherwise.

## Explicit exclusions

Do not implement:

- Internal `voice.playback.*` events.
- An event bus or public/internal mapping layer.
- FOUND-02F.
- Template rendering, name normalization, queue behavior, TTS, playback, networking, authentication, persistence, or UI.
- Unrelated refactors or formatting.
- Package dependency or script changes.

## No commit

Do not request an intermediate commit.

Do not stage, commit, amend, reset, restore, checkout, push, create a branch, or discard any current working-tree changes. Leave the complete FOUND-02E plus REWORK-01 change set uncommitted for independent re-review and user-controlled commit/push.

## Final response format

Return exactly:

1. `Preflight and Preserved Working Tree`
2. `Callback Literal Decision`
3. `Safe Audio URL Validation`
4. `Plain Variables Container`
5. `Files Changed`
6. `Runtime Tests`
7. `Declaration Tests`
8. `Build and Dist Inspection`
9. `Documentation Reconciliation`
10. `Repository Verification`
11. `Rework Handoff`
12. `Final Git Status`
13. `Risks or Blockers`

Use exact command output and counts. State `None` only when no risk or blocker exists.
