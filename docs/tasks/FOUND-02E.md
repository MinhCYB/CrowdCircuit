# FOUND-02E — VoiceIntent and Voice Protocol Schemas

**Status:** TODO  
**Phase:** Foundation  
**Depends on:** FOUND-02B

## Objective

Implement the versioned voice contracts used between Voice Reaction Engine, TTS queue and Voice Output.

## Required context

Read:

- `docs/handoffs/HANDOFF-FOUND-02B.md`
- System Design:
  - `## 11.10 Voice Reaction Engine`
  - `## 11.11 Name Normalizer`
  - `## 11.12 Priority Queue cho voice`
  - `## 11.13 TTS Provider`
  - `## 11.14 Audio Playback`
  - `## 12.3 VoiceIntent`
  - Voice-related parts of `## 14. WebSocket protocol`

Do not read the full UI/UX Specification.

## Allowed paths

- `packages/contracts/src/voice/**`
- `packages/contracts/src/common/**` only for true shared primitives
- `packages/contracts/src/index.ts`
- Contract package tests
- Execution documentation and handoff

## Required work

Implement schemas and inferred types for:

- `VoiceIntent`.
- Voice intent kinds:
  - `thank_gift`
  - `welcome_follow`
  - `game_commentary`
  - `system`
- Integer priority.
- Template group.
- Variables limited to scalar `string | number`.
- Voice profile ID.
- Nullable dedupe key.
- Expiration datetime.
- Interrupt policy:
  - `never_interrupt`
  - `interrupt_lower_priority`
  - `interrupt_any`
- `voice.play` message:
  - job ID
  - audio URL/path
  - subtitle
  - bounded volume
- Playback callbacks explicitly supported by the design:
  - started
  - finished
  - interrupted
  - failed, with a conservative safe error shape

Do not invent a full internal queue/job state machine in this task; only define messages needed across package boundaries.

## Must not implement

- Template rendering.
- Name normalization.
- Queue implementation.
- TTS provider implementation.
- Browser audio player.
- UI.

## Acceptance criteria

- [ ] A valid voice intent parses.
- [ ] Expiration and priority validation work.
- [ ] Variables reject nested arbitrary objects.
- [ ] Interrupt policy values match the System Design.
- [ ] Playback callback union narrows correctly.
- [ ] Invalid volume and identifiers fail.
- [ ] Positive and negative tests exist.

## Verification

Run focused checks first:

```bash
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
```

Then run the repository baseline:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
```

## Required handoff

`docs/handoffs/HANDOFF-FOUND-02E.md`

## Next task

`FOUND-02F — Contract Fixtures and Integration Review`
