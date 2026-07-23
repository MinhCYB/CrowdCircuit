# Handoff — FOUND-02C — LIVE Event Payload Schemas

**Status:** IMPLEMENTED — AWAITING INDEPENDENT REVIEW  
**Date:** 2026-07-23  
**Base commit:** `c9eb085`  
**Agent session:** FOUND-02C LIVE event payload schemas implementation  

## Summary

Implemented the complete v0.1 LIVE event contract for `@crowdcircuit/contracts`:
- 10 finite event type literals in `LiveEventTypeSchema`.
- Strict runtime payload schemas (`GiftSentPayloadSchema`, `ChatCommentPayloadSchema`, `LikePayloadSchema`, `EmptyPayloadSchema`).
- 10 specialized envelope schemas (`GiftSentEventSchema`, `ChatCommentEventSchema`, etc.) using `createLiveEventEnvelopeSchema`.
- Discriminated union schema `LiveEventEnvelopeSchema` discriminating on `eventType`, and inferred `LiveEvent` union type.
- Comprehensive positive and negative runtime tests in `packages/contracts/test/domain-events.test.ts`.
- Package-name declaration consumer typecheck tests in `packages/contracts/test/declaration-consumer.ts`.

## Paths changed and created

### Created files

- `packages/contracts/src/events/payloads.ts` — `EmptyPayloadSchema`, `GiftSentPayloadSchema`, `ChatCommentPayloadSchema`, `LikePayloadSchema` and inferred types.
- `packages/contracts/test/domain-events.test.ts` — Positive and negative runtime unit test suite for all 10 event types.
- `docs/handoffs/HANDOFF-FOUND-02C.md` — This handoff document.

### Modified files

- `packages/contracts/src/events/envelope.ts` — Updated `LiveEventTypeSchema` to 10 finite literals, added 10 specialized envelope schemas, and `LiveEventEnvelopeSchema` discriminated union.
- `packages/contracts/src/events/index.ts` — Exported `payloads.js` and `envelope.js`.
- `packages/contracts/test/declaration-consumer.ts` — Updated type assertions to verify public imports, payload narrowing, literal matching, and strict empty payload bounds against `dist/index.d.ts`.
- `docs/execution/PROJECT_STATUS.md` — Updated baseline test counts, test status, and task implementation state.
- `docs/execution/ROADMAP.md` — Set `FOUND-02C` status to `PARTIAL` (awaiting tech lead review).

## Public API and runtime invariants

### 1. Finite Event Type Literals

`LiveEventTypeSchema` restricts event types to:
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

### 2. Payload Schemas & Inferred Types

- **GiftSentPayloadSchema / GiftSentPayload:**
  - `gift`: `{ id: string; name: string; imageUrl: string | null; diamondValue: number | null; streakable: boolean }` (strict)
  - `quantity`: positive integer
  - `totalQuantity`: positive integer
  - `streak`: `{ id: string | null; status: "single" | "start" | "update" | "end" }` (strict)
  - `estimatedDiamondTotal`: non-negative number or `null`
  - Object schema is strict; unknown connector keys fail.
- **ChatCommentPayloadSchema / ChatCommentPayload:**
  - `text`: non-empty string
  - `textNormalized`: non-empty string
  - `mentions`: string array
  - Object schema is strict; raw connector fields fail.
- **LikePayloadSchema / LikePayload:**
  - `delta`: positive integer
  - `total`: non-negative integer or `null`
  - `milestone`: non-negative integer or `null`
  - Object schema is strict.
- **EmptyPayloadSchema / EmptyPayload:**
  - `{}` strict object schema for lifecycle (`live.*`) and social (`viewer.joined`, `social.follow`, `social.share`, `subscription.created`) events.
  - Invented connector fields on empty payload fail validation.

### 3. Discriminated Union Schema & Type

- `LiveEventEnvelopeSchema` = `z.discriminatedUnion("eventType", [... 10 specialized schemas ...])`.
- `LiveEvent` = `z.infer<typeof LiveEventEnvelopeSchema>`.
- Discriminates on `event.eventType`, narrowing both event and payload cleanly.

## Verification results

### Package-level checks (`@crowdcircuit/contracts`)

```bash
pnpm --filter @crowdcircuit/contracts lint               # ✅ Passed (0 errors, 0 warnings)
pnpm --filter @crowdcircuit/contracts typecheck          # ✅ Passed (tsc -b clean)
pnpm --filter @crowdcircuit/contracts test               # ✅ Passed (4 test files, 48 tests passed)
pnpm --filter @crowdcircuit/contracts exec tsc -b --force # ✅ Passed (dist generated)
pnpm --filter @crowdcircuit/contracts test:declarations  # ✅ Passed (tsc -p test/tsconfig.declarations.json clean)
```

### Declaration & dist inspection

- `packages/contracts/dist/events/payloads.d.ts` and `envelope.d.ts` retain exact literal unions, strict object schemas, and narrowed payload types.
- Zero `any` types emitted.
- Zero test files (`*.test.js`, `*.test.d.ts`, `test/`, `declaration-consumer.*`) in `dist/`.

### Full repository baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (5 test files, 50 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
```

## Known limitations & explicit exclusions

- Deduplication, gift combo state machines, and like aggregation logic were intentionally NOT implemented (belong to BE-03 pipeline).
- Connector adapters were NOT implemented.
- GameActionEnvelope and Action schemas were NOT implemented (belong to FOUND-02D).
- FOUND-02D was NOT started.

## Git status post-implementation

```
On branch main
Changes not staged for commit:
	modified:   docs/execution/PROJECT_STATUS.md
	modified:   docs/execution/ROADMAP.md
	modified:   packages/contracts/src/events/envelope.ts
	modified:   packages/contracts/src/events/index.ts
	modified:   packages/contracts/test/declaration-consumer.ts

Untracked files:
	docs/handoffs/HANDOFF-FOUND-02C.md
	packages/contracts/src/events/payloads.ts
	packages/contracts/test/domain-events.test.ts
```

No commit was performed. All changes are left uncommitted for independent Codex tech lead review.

## Expected next task

`FOUND-02D — GameActionEnvelope and Action Lifecycle Schemas` (Explicitly not started).
