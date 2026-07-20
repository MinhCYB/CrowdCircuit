# FOUND-02B — Common Primitives and LiveEventEnvelope Base

**Status:** TODO  
**Phase:** Foundation  
**Depends on:** FOUND-02A

## Objective

Implement common versioned primitives and the generic `LiveEventEnvelope` base without implementing individual event payload schemas.

## Required context

Read:

- `docs/handoffs/HANDOFF-FOUND-02A.md`
- System Design:
  - `## 11.2 Event Normalizer`
  - `## 11.3 Deduper và Aggregator`
  - `## 12.1 LiveEventEnvelope`

Do not read the UI/UX Specification.

## Allowed paths

- `packages/contracts/src/common/**`
- `packages/contracts/src/events/**`
- `packages/contracts/src/index.ts`
- Contract package tests
- Execution documentation and handoff

## Required work

Implement Zod schemas and inferred types for:

- `specVersion`, fixed to `"0.1"`.
- Non-empty event/connector identifiers.
- ISO datetime strings used by contracts.
- Event source:
  - `tiktok`
  - `tikfinity`
  - `mock`
- Room reference:
  - nullable `roomId`
  - `streamerUniqueId`
- Viewer/user reference:
  - nullable `id`
  - nullable `uniqueId`
  - `displayName`
  - nullable `avatarUrl`
  - `roles`
- Event metadata:
  - `connectorId`
  - optional `connectorVersion`
  - optional `sequenceId`
  - `isReplay`
  - `rawStored`
- The generic/versioned `LiveEventEnvelope` base.
- An extensible event-type primitive that FOUND-02C can narrow.

The runtime schema API may use a schema factory for payload validation. If so, keep its public API small and test it.

## Must not implement

- Gift/comment/like/follow payload schemas.
- Deduplication logic.
- Connector logic.
- Game actions.
- Voice intents.
- Backend APIs.

## Acceptance criteria

- [ ] A valid base envelope parses.
- [ ] Invalid version, source and datetime fail.
- [ ] Nullable user behavior matches the System Design.
- [ ] Payload typing uses `unknown` or a generic schema, never `any`.
- [ ] Runtime schemas and inferred TypeScript types remain aligned.
- [ ] Positive and negative tests cover the base primitives.
- [ ] Public exports remain intentional.

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

`docs/handoffs/HANDOFF-FOUND-02B.md`

## Next task

`FOUND-02C — LIVE Event Payload Schemas`
