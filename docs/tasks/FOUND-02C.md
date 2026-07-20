# FOUND-02C — LIVE Event Payload Schemas

**Status:** TODO  
**Phase:** Foundation  
**Depends on:** FOUND-02B

## Objective

Implement the v0.1 LIVE event-type union and payload schemas used by connectors, normalizer, mapping and Simulator.

## Required context

Read:

- `docs/handoffs/HANDOFF-FOUND-02B.md`
- System Design:
  - `### FR-02 — Nhận event`
  - `### FR-03 — Chuẩn hóa event`
  - `## 11.3 Deduper và Aggregator`
  - `## 12.1 LiveEventEnvelope`

Do not read the UI/UX Specification.

## Allowed paths

- `packages/contracts/src/events/**`
- `packages/contracts/src/common/**` only when a true shared primitive is missing
- `packages/contracts/src/index.ts`
- Contract package tests
- Execution documentation and handoff

## Required work

Implement discriminated event-envelope schemas and inferred types for:

- `live.connected`
- `live.disconnected`
- `live.ended`
- `viewer.joined`
- `chat.comment`
- `social.follow`
- `social.share`
- `engagement.like`
- `gift.sent`
- `subscription.created` as an optional supported contract event

Implement the payloads explicitly defined by the System Design:

- `GiftSentPayload`
- `ChatCommentPayload`
- `LikePayload`

Gift must cover:

- Gift identity and name.
- Nullable image URL.
- Nullable diamond value.
- `streakable`.
- Positive `quantity` and `totalQuantity`.
- Nullable streak ID.
- Streak status:
  - `single`
  - `start`
  - `update`
  - `end`
- Nullable estimated diamond total.

For lifecycle/social events whose extra payload fields are not specified, use a strict empty payload object and rely on the envelope room/user fields. Do not invent connector-specific fields.

## Must not implement

- Connector behavior.
- Gift timeout or aggregation logic.
- Deduplication.
- Mapping rules.
- Game actions.
- Voice intents.

## Acceptance criteria

- [ ] Every required v0.1 event type has a runtime schema.
- [ ] The discriminated union narrows payload types correctly.
- [ ] Gift streak and nullable diamond cases are tested.
- [ ] Invalid comment and like payloads fail validation.
- [ ] Lifecycle/social payloads do not invent raw connector fields.
- [ ] Connector-specific data does not escape the contract.
- [ ] No `any`.

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

`docs/handoffs/HANDOFF-FOUND-02C.md`

## Next task

`FOUND-02D — GameActionEnvelope and Action Lifecycle Schemas`
