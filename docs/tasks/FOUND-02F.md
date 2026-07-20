# FOUND-02F — Contract Fixtures and Integration Review

**Status:** TODO  
**Phase:** Foundation  
**Depends on:** FOUND-02C, FOUND-02D, FOUND-02E

## Objective

Complete the contracts phase by adding canonical fixtures, verifying public exports and testing cross-contract integration without implementing business logic.

## Required context

Read:

- `docs/handoffs/HANDOFF-FOUND-02C.md`
- `docs/handoffs/HANDOFF-FOUND-02D.md`
- `docs/handoffs/HANDOFF-FOUND-02E.md`
- System Design:
  - `## 12. Data contracts`
  - `## 14. WebSocket protocol`
  - `## 19. Testing strategy`

Do not read the UI/UX Specification unless a documented frontend contract is directly relevant.

## Allowed paths

- `packages/contracts/**`
- One minimal consuming-package compile test if required
- Execution documentation and handoff

## Required work

Create canonical valid fixtures for:

- Gift event.
- Comment event.
- Like milestone.
- Follow event.
- Game action.
- Action received receipt.
- Action completed result.
- Action failed result.
- Voice intent.
- Voice play message.
- Playback callbacks.

Add tests that verify:

- Canonical fixtures parse.
- Invalid near-miss fixtures fail.
- Package-root exports expose all intended schemas and inferred types.
- A consuming workspace package can import the public API if a compile test is needed.
- No duplicate domain-contract definitions exist outside `@crowdcircuit/contracts`.
- Package build output is usable.

Review consistency of:

- IDs.
- Timestamp fields.
- `specVersion`.
- Event/action/voice discriminators.
- Nullable versus optional behavior.
- Naming across event, action and voice families.

## Must not implement

- Connector.
- Normalizer.
- Mapping logic.
- Socket.IO runtime.
- TTS runtime.
- UI.
- Database.

## Acceptance criteria

- [ ] Canonical fixtures cover all three contract families.
- [ ] Public root exports are tested.
- [ ] Invalid near-miss fixtures are tested.
- [ ] Full repository baseline passes.
- [ ] No duplicated contract source remains.
- [ ] Any necessary contract decision is recorded in `DECISIONS.md`.
- [ ] FOUND-02 is ready for runtime session and event-pipeline work.

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

`docs/handoffs/HANDOFF-FOUND-02F.md`

## Next task

`FOUND-03A — Runtime Secret and Admin Session Foundation`
