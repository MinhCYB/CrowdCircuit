# FOUND-02C — Gemini Flash High Implementation Prompt

You are Gemini Flash High, the implementation worker for CrowdCircuit.

## Task

**Task ID:** FOUND-02C  
**Title:** LIVE Event Payload Schemas

Implement the complete v0.1 LIVE event contract: payload schemas, specialized envelope schemas, discriminated union, inferred public types, runtime tests, declaration-consumer tests, build inspection, and implementation handoff.

Do not implement FOUND-02D or any future task.

## Repository state

The verified implementation base at planning time is commit `6ecd211` on `main`. Repository files and current command output override this statement if the repository has changed.

The technical lead made two small documentation corrections before implementation:

- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/KNOWN_ISSUES.md`

Preserve them. They correct the committed FOUND-02B baseline, actual pnpm version, and current task pointer. Do not revert or overwrite them.

## Read in exact order

1. `docs/orchestration/CODEX-TECH-LEAD-MASTER-GOAL.md`
2. `docs/orchestration/CROWDCIRCUIT-HANDOFF-FOR-CODEX-FROM-FOUND-02C.md`
3. `docs/execution/PROJECT_STATUS.md`
4. `docs/execution/CURRENT_TASK.md`
5. `docs/tasks/FOUND-02C.md`
6. `docs/execution/DECISIONS.md`
7. `docs/execution/KNOWN_ISSUES.md`
8. `docs/handoffs/HANDOFF-FOUND-02B.md`
9. `docs/handoffs/HANDOFF-FOUND-02B-PATCH-01.md`
10. Only these System Design sections in `docs/crowdcircuit-system-design-v0.1.1.md`:
    - `### FR-02 — Nhận event`
    - `### FR-03 — Chuẩn hóa event`
    - `## 11.3 Deduper và Aggregator`
    - `## 12.1 LiveEventEnvelope`
11. Existing contract API and tests:
    - `packages/contracts/src/common/**`
    - `packages/contracts/src/events/**`
    - `packages/contracts/src/index.ts`
    - `packages/contracts/test/common-primitives.test.ts`
    - `packages/contracts/test/live-event-envelope.test.ts`
    - `packages/contracts/test/declaration-consumer.ts`
    - `packages/contracts/test/tsconfig.declarations.json`
    - `packages/contracts/package.json`

Do not read the UI/UX specification or unrelated System Design sections.

## Preflight

Run and report exact results before implementation:

```powershell
git status
git rev-parse --short HEAD
git log -5 --oneline
node --version
pnpm --version

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If preflight fails, diagnose it before changing production code. Do not silently treat a pre-existing failure as your own result.

## Allowed paths

- `packages/contracts/src/events/**`
- `packages/contracts/src/common/**` only if a genuinely shared primitive is missing
- `packages/contracts/src/index.ts`
- `packages/contracts/test/**`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/execution/DECISIONS.md` only for a genuinely new architectural decision
- `docs/execution/KNOWN_ISSUES.md`
- `docs/handoffs/HANDOFF-FOUND-02C.md`

Avoid package-configuration changes unless verification proves one is required. Stop and report before changing anything outside these paths.

## Required public contract

Implement the exact v0.1 event-type union:

- `live.connected`
- `live.disconnected`
- `live.ended`
- `viewer.joined`
- `chat.comment`
- `social.follow`
- `social.share`
- `engagement.like`
- `gift.sent`
- `subscription.created`

`subscription.created` is an optional connector capability but is a supported v0.1 contract event and belongs in the union.

Update `LiveEventTypeSchema` and inferred `LiveEventType` to expose this exact finite set. Preserve the generic `BaseLiveEventEnvelopeSchema`, `BaseLiveEventEnvelope`, `LiveEventEnvelope`, and `createLiveEventEnvelopeSchema` behavior established by FOUND-02B and PATCH-FOUND-02B-01.

## Payload schemas and inferred types

Export:

- `GiftSentPayloadSchema` / `GiftSentPayload`
- `ChatCommentPayloadSchema` / `ChatCommentPayload`
- `LikePayloadSchema` / `LikePayload`
- One reusable strict empty payload schema and inferred type for lifecycle/social events

All domain payload objects, including nested gift and streak objects, must be strict. Unknown connector-specific payload fields must fail validation.

### GiftSentPayload

Implement exactly:

```ts
{
  gift: {
    id: string;
    name: string;
    imageUrl: string | null;
    diamondValue: number | null;
    streakable: boolean;
  };
  quantity: number;
  totalQuantity: number;
  streak: {
    id: string | null;
    status: "single" | "start" | "update" | "end";
  };
  estimatedDiamondTotal: number | null;
}
```

Runtime invariants:

- Gift ID and name are non-empty strings.
- Image URL is a valid URL or `null`.
- Diamond value is a finite, non-negative number or `null`.
- `streakable` is boolean.
- `quantity` and `totalQuantity` are positive integers.
- Streak ID is a non-empty string or `null`.
- Status is exactly `single | start | update | end`.
- Estimated diamond total is a finite, non-negative number or `null`.
- Do not invent cross-field rules between status, streakability, quantities, or streak ID.

### ChatCommentPayload

Implement exactly:

```ts
{
  text: string;
  textNormalized: string;
  mentions: string[];
}
```

- `text` and `textNormalized` are non-empty.
- `mentions` is an array of strings.
- Do not normalize text in the contract layer.
- Do not add connector message IDs or raw connector fields.

### LikePayload

Implement exactly:

```ts
{
  delta: number;
  total: number | null;
  milestone: number | null;
}
```

- `delta` is a positive integer.
- `total` and `milestone` are non-negative integers or `null`.
- Do not add aggregation windows, connector counters, or deduplication state.

### Strict empty payload

Use a strict empty object for:

- `live.connected`
- `live.disconnected`
- `live.ended`
- `viewer.joined`
- `social.follow`
- `social.share`
- `subscription.created`

The envelope room and user fields carry shared context. Do not invent connector-specific payload fields.

## Specialized envelope schemas

Using `createLiveEventEnvelopeSchema`, export:

- `LiveConnectedEventSchema` / `LiveConnectedEvent`
- `LiveDisconnectedEventSchema` / `LiveDisconnectedEvent`
- `LiveEndedEventSchema` / `LiveEndedEvent`
- `ViewerJoinedEventSchema` / `ViewerJoinedEvent`
- `ChatCommentEventSchema` / `ChatCommentEvent`
- `SocialFollowEventSchema` / `SocialFollowEvent`
- `SocialShareEventSchema` / `SocialShareEvent`
- `EngagementLikeEventSchema` / `EngagementLikeEvent`
- `GiftSentEventSchema` / `GiftSentEvent`
- `SubscriptionCreatedEventSchema` / `SubscriptionCreatedEvent`

Then export:

- `LiveEventEnvelopeSchema`, a Zod discriminated union on `eventType`
- Its inferred union type; use `LiveEvent` unless that conflicts with a verified existing public API

Checking `event.eventType` must narrow both event and payload. Keep every public API reachable from `@crowdcircuit/contracts`.

## Contract invariants

- Zod schemas are the runtime source of truth.
- Infer public types from schemas wherever practical.
- No `any` and no payload escape hatch using `z.unknown()`.
- Preserve all base-envelope validation.
- Event type and payload combinations cannot be mismatched.
- Connector-specific fields cannot escape normalized payloads.
- Unknown payload keys must be rejected.
- Preserve JSON safety and declaration quality from PATCH-FOUND-02B-01.
- Do not weaken the generic factory or base envelope.
- Avoid duplicate constants or handwritten types that can drift.

## Tests

### Positive runtime tests

- Every one of the ten event types parses through its specialized schema and the union.
- A single/non-streakable gift accepts nullable image, diamond value, streak ID, and estimated total.
- Streak gifts cover `start`, `update`, and `end`.
- Positive quantity and total quantity are accepted.
- Valid comment and like payloads parse.
- Like accepts nullable total and milestone.
- Each lifecycle/social event accepts `{}`.
- Existing base-envelope and factory behavior remains valid.

### Negative runtime tests

- Unknown event type.
- Event type paired with another event's payload.
- Missing payload.
- Extra connector-specific fields in empty, gift, nested gift, nested streak, comment, and like payloads.
- Empty gift ID or name and invalid non-null image URL.
- Negative, zero, fractional, `NaN`, and infinite quantities where relevant.
- Invalid streak status and invalid nullable field values.
- Empty comment text or normalized text and invalid mentions.
- Zero, negative, fractional, `NaN`, or infinite like delta.
- Negative or fractional non-null like total or milestone.

### Declaration/type tests

Extend `packages/contracts/test/declaration-consumer.ts` using imports from `@crowdcircuit/contracts` and verify:

- All new schemas and types are publicly importable.
- All ten event literals are accepted; an unsupported literal is rejected.
- The discriminated union narrows payload correctly.
- Gift payload cannot be assigned to a comment event.
- Invalid gift, comment, and like types are rejected.
- Strict empty payload types reject invented fields on fresh object literals.
- Existing generic factory and base-envelope checks still pass.

## Explicit exclusions

Do not implement connector behavior, raw connector models, text normalization, gift timeout logic, streak state machines, aggregation, deduplication, mapping, game actions, voice intents, Socket.IO, persistence, Simulator UI, FOUND-02D, or unrelated refactors.

## Verification

Run focused checks first:

```powershell
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
pnpm --filter @crowdcircuit/contracts test:declarations
```

Then inspect `packages/contracts/dist`:

- Root declarations export the new API.
- Event declarations retain exact literals and payload types.
- The union remains discriminated by `eventType`.
- No `any` is emitted for new contracts.
- No tests or declaration fixtures leak into `dist`.
- No stale or unrelated artifacts appear.

Useful checks:

```powershell
rg --files packages/contracts/dist
rg -n "\bany\b|LiveEventEnvelopeSchema|GiftSentPayload|ChatCommentPayload|LikePayload|gift\.sent|chat\.comment" packages/contracts/dist
```

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
```

Report exact test-file and test counts. Do not estimate.

## Documentation and handoff

Create `docs/handoffs/HANDOFF-FOUND-02C.md` with:

- Status `IMPLEMENTED — AWAITING INDEPENDENT REVIEW`
- Date and verified base commit
- Summary and exact paths changed
- Public API and runtime invariants
- Tests and exact verification results/counts
- Declaration and dist inspection results
- Known limitations and explicit exclusions
- Actual final git status
- No-commit statement
- FOUND-02D as expected next task, explicitly not started

Synchronize execution documents conservatively:

- Keep FOUND-02C current.
- Mark it awaiting review or otherwise non-DONE.
- Set ROADMAP FOUND-02C to `PARTIAL`, not `DONE`.
- Do not advance to FOUND-02D.
- Preserve the lead's baseline corrections.
- Update known issues only for verified issues.
- Add an ADR only for a genuinely new architectural decision.

## No commit

Do not stage, commit, amend, reset, checkout, restore, push, or create a branch. Leave all changes uncommitted for independent Codex review.

## Final response

Return exactly:

1. `Preflight`
2. `Implementation`
3. `Files Changed`
4. `Tests`
5. `Declaration and Dist Inspection`
6. `Documentation`
7. `Final Git Status`
8. `Risks or Blockers`

Use exact command output and counts. State `None` for risks or blockers only if none exist.
