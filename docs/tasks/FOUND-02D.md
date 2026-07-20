# FOUND-02D — GameActionEnvelope and Action Lifecycle Schemas

**Status:** TODO  
**Phase:** Foundation  
**Depends on:** FOUND-02B

## Objective

Implement versioned game-action contracts and explicitly separate delivery receipt from gameplay completion.

## Required context

Read:

- `docs/handoffs/HANDOFF-FOUND-02B.md`
- System Design:
  - `## 11.8 Game SDK`
  - `## 11.9 Action Gateway`
  - `## 12.2 GameActionEnvelope`
  - Game-related parts of `## 14. WebSocket protocol`

Do not read the UI/UX Specification.

## Allowed paths

- `packages/contracts/src/actions/**`
- `packages/contracts/src/common/**` only for true shared primitives
- `packages/contracts/src/index.ts`
- Contract package tests
- Execution documentation and handoff

## Required work

Implement schemas and inferred types for:

- `GameActionEnvelope`.
- Nullable actor/viewer reference.
- Trigger reference.
- Integer priority.
- Positive delivery TTL.
- Game registration message.
- Game registered response.
- Game heartbeat message, using only fields explicitly required by the current design.
- `game.action` delivery message.
- `game.action.received` receipt message with `receivedAt`.
- `game.action.result` discriminated result:
  - `completed`
  - `failed`
- Completed result:
  - `durationMs`
  - optional safe details object if kept conservative
- Failed result:
  - error code
  - message
  - retryable flag
- Action ID fields used for idempotency.

Receipt means the game validated and enqueued the action. It must not represent gameplay completion.

For generic `params` or result `details`, use `unknown`-based schemas, not `any`.

## Must not implement

- Socket.IO server behavior.
- Retry timers.
- SDK runtime logic.
- Mapping Engine.
- Game manifest schemas unless an existing exported contract strictly requires them.
- Voice contracts.

## Acceptance criteria

- [ ] Receipt and result are separate message schemas.
- [ ] Completed and failed results narrow correctly.
- [ ] Invalid TTL, duration, IDs and priority fail.
- [ ] Generic action payload uses `unknown`, not `any`.
- [ ] Positive and negative tests exist.
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

`docs/handoffs/HANDOFF-FOUND-02D.md`

## Next task

`FOUND-02E — VoiceIntent and Voice Protocol Schemas`
