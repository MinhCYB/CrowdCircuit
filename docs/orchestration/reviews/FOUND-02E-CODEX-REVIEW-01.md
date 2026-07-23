# FOUND-02E — Independent Codex Working-Tree Review 01

**Review date:** 2026-07-23
**Review basis:** Complete working-tree diff against `HEAD`
**Base commit:** `76d7013` — `feat: complete FOUND-02D action lifecycle contracts`
**Initial verdict:** `BLOCKED_DECISION`
**Decision resolution:** Public Voice Output callbacks use `playback.*`; focused rework is required.
**Current workflow verdict:** `REQUEST CHANGES`

## Repository and working-tree evidence

- Branch: `main`.
- `HEAD`: `76d7013`.
- `main` was synchronized with `origin/main`.
- FOUND-02E was reviewed as a complete uncommitted working-tree change set.
- The review inspected `git diff HEAD --`, `git diff --check HEAD --`, and every untracked file.
- Four modified tracked files and four untracked FOUND-02E files were present.
- No implementation commit was required.
- No files were modified during the initial review or verification.

Reviewed working-tree files:

```text
 M docs/execution/CURRENT_TASK.md
 M docs/execution/PROJECT_STATUS.md
 M packages/contracts/src/voice/index.ts
 M packages/contracts/test/declaration-consumer.ts
?? docs/handoffs/HANDOFF-FOUND-02E.md
?? packages/contracts/src/voice/intent.ts
?? packages/contracts/src/voice/protocol.ts
?? packages/contracts/test/domain-voice.test.ts
```

Fresh versions:

```text
Node.js v24.15.0
pnpm 11.9.0
```

## Findings by severity

### High — Public callback literals conflicted with the external protocol

**File:**

- `packages/contracts/src/voice/protocol.ts:35`

**Evidence:**

The implementation exposed:

```text
voice.playback.started
voice.playback.finished
voice.playback.interrupted
voice.playback.failed
```

System Design section 11.14 describes the external Voice Output client sending `playback.started` and `playback.finished`, while a separate internal event list uses `voice.playback.*`. The implementation prompt required a `BLOCKED_DECISION` when this conflict was encountered, but the implementation selected one family without stopping.

**Product decision:**

The public Voice Output callback wire literals are:

```text
playback.started
playback.finished
playback.interrupted
playback.failed
```

The `voice.playback.*` family is reserved for potential internal application events or handler names.

This decision is recorded as ADR-010 in `docs/execution/DECISIONS.md`.

**Minimal fix:**

Replace the public callback literals everywhere in the runtime schemas, inferred types, tests, declarations, descriptions, and current handoff. Do not implement an internal event bus or mapping layer.

**Blocks FOUND-02F:** Yes.

### High — `audioUrl` accepted unsafe and unsupported schemes

**File:**

- `packages/contracts/src/voice/protocol.ts:11`

**Evidence:**

The schema accepted every string beginning with `/` and every string accepted by `new URL(value)`.

Independent probes confirmed acceptance of:

```text
javascript:alert(1)
data:audio/mpeg;base64,AA==
file:///C:/secret.mp3
ftp://example.com/a.mp3
//evil.example/a.mp3
/../secret.mp3
/\evil
```

The design supports a conservative root-relative local media path, such as `/media/tts/voice_123.mp3`, and safe absolute URLs. It does not justify arbitrary URL schemes, protocol-relative URLs, traversal-like paths, or backslashes.

**Why it matters:**

This is a browser playback boundary. The current contract permits executable, local-file, alternate-protocol, protocol-relative, traversal-like, and malformed values.

**Minimal fix:**

Allow only absolute `http:` and `https:` URLs plus conservative root-relative local media paths. Reject unsafe schemes, protocol-relative values, dot traversal segments, backslashes, malformed paths, empty paths, and arbitrary strings. Add explicit positive and negative runtime tests.

**Blocks FOUND-02F:** Yes.

### Medium — Variables schema accepted class instances as the container

**File:**

- `packages/contracts/src/voice/intent.ts:21`

**Evidence:**

Scalar values were correctly restricted to strings and finite numbers. However, a direct probe showed:

```text
VoiceIntentVariablesSchema.safeParse(new EmptyClass()).success === true
```

Existing tests placed invalid instances inside an ordinary variables object but did not test non-plain objects as the `variables` value itself.

**Why it matters:**

`variables` is a public `Record<string, string | number>` contract. Accepting class instances as the container allows non-plain runtime values to cross a JSON-like contract boundary.

**Minimal fix:**

Require a plain-object container whose prototype is `Object.prototype` or `null`, while preserving the public input/output type `Record<string, string | number>`. Reject class instances and other non-plain containers directly. Do not weaken scalar validation or use unsafe assertions.

**Blocks FOUND-02F:** Yes.

### Low — Current documentation did not match Git or fresh command output

**Files:**

- `docs/execution/PROJECT_STATUS.md:16`
- `docs/handoffs/HANDOFF-FOUND-02E.md:43`
- `docs/handoffs/HANDOFF-FOUND-02E.md:59`
- `docs/handoffs/HANDOFF-FOUND-02E.md:108`
- `docs/execution/ROADMAP.md`

**Evidence:**

- Fresh pnpm output was `11.9.0`; current FOUND-02E documentation recorded `11.15.1`.
- The handoff claimed ROADMAP was modified to set FOUND-02E to `PARTIAL`.
- Actual Git showed no ROADMAP diff.
- The handoff Git-status snapshot incorrectly listed ROADMAP as modified.
- Actual ROADMAP still recorded FOUND-02E as `READY`.
- PROJECT_STATUS claimed `docs/tasks/FOUND-02F.md` was yet to be created, but that file already exists.

**Minimal fix:**

Reconcile current FOUND-02E documentation and ROADMAP from actual Git and command output. Keep FOUND-02E active/PARTIAL and FOUND-02F blocked. Clearly distinguish historical snapshots from current state.

**Blocks FOUND-02F:** Yes as a closure requirement.

## Fresh verification results

All requested commands were run independently.

### Contracts package

```text
pnpm --filter @crowdcircuit/contracts lint              PASSED
pnpm --filter @crowdcircuit/contracts typecheck         PASSED
pnpm --filter @crowdcircuit/contracts test              PASSED — 141 tests, 6 files
pnpm --filter @crowdcircuit/contracts build --force     PASSED
pnpm --filter @crowdcircuit/contracts test:declarations PASSED
```

### Repository

```text
pnpm lint      PASSED
pnpm typecheck PASSED
pnpm test      PASSED — 143 tests, 7 files
pnpm build     PASSED
git diff --check HEAD -- PASSED
```

Passing tests did not cover unsafe URL schemes or non-plain variables containers.

## Declaration and dist assessment

Positive results:

- `VoiceIntent` otherwise matched the approved design shape.
- Voice intent kind and interrupt-policy literals were exact.
- `eventId` and `dedupeKey` remained required nullable properties.
- Variable values emitted as `Record<string, string | number>`.
- Priority was a finite integer at runtime.
- Volume was finite and bounded inclusively from `0` to `1`.
- The callback union narrowed by its implemented discriminator.
- The failed callback error was strict and conservative.
- Fixed-shape voice objects were strict.
- Package-root exports were complete.
- Schema input/output declarations aligned for the implemented schemas.
- No uncontrolled `any` or unsafe assertions were introduced.
- No test or declaration-consumer artifacts leaked into `dist`.
- Approved LIVE and action declaration regressions remained present.

Blocking results:

- Emitted declarations encoded the wrong public callback literal family under the accepted product decision.
- The URL declaration remained `string`, while runtime validation was too permissive.
- The variables declaration promised a record while runtime accepted at least some class instances.

## Scope assessment

- No FOUND-02F implementation was introduced.
- No template rendering, name normalizer, queue, TTS provider, audio player, Socket.IO runtime, UI, or unrelated package implementation was added.
- The working tree remained unchanged after the initial review.

## Required next action

Run focused FOUND-02E-REWORK-01, preserve all prior valid regression coverage, and return the complete uncommitted working tree for independent re-review. FOUND-02F remains blocked.
