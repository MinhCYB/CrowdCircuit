# Handoff — FOUND-02B — Common Primitives and LiveEventEnvelope Base

**Task status:** DONE  
**Date:** 2026-07-23  
**Base commit:** `7bb182d`  
**Agent session:** FOUND-02B common primitives and LiveEventEnvelope base implementation  

## Summary

Implemented common versioned contract primitives (`SpecVersion`, `IsoDateTime`, `EventSource`, `RoomRef`, `UserRef`, `EventMetadata`) and the generic `LiveEventEnvelope` base with Zod runtime schemas and inferred TypeScript types in `@crowdcircuit/contracts`.

## Documentation baseline cleanup performed

- Synchronized `docs/execution/PROJECT_STATUS.md` baseline to acknowledge completed tasks `FOUND-02A`, `PATCH-FOUND-02A-01`, and `PATCH-FOUND-02A-02`.
- Recorded base commit as `7bb182d` and working tree status prior to starting FOUND-02B domain implementation.

## Files changed and created

### Created files

- `packages/contracts/src/common/primitives.ts` — `SPEC_VERSION`, `SpecVersionSchema`, `IsoDateTimeSchema`, `EventSourceSchema` and inferred types.
- `packages/contracts/src/common/room.ts` — `RoomRefSchema` and inferred `RoomRef` type.
- `packages/contracts/src/common/user.ts` — `UserRefSchema` and inferred `UserRef` type with nullable user support.
- `packages/contracts/src/common/metadata.ts` — `EventMetadataSchema` and inferred `EventMetadata` type.
- `packages/contracts/src/events/envelope.ts` — `LiveEventTypeSchema`, `createLiveEventEnvelopeSchema` factory function, `BaseLiveEventEnvelopeSchema`, and generic `LiveEventEnvelope` TypeScript type.
- `packages/contracts/test/common-primitives.test.ts` — Focused unit test suite for common primitives (specVersion, source, ISO datetime, room, user, metadata).
- `packages/contracts/test/live-event-envelope.test.ts` — Focused unit test suite for base LiveEventEnvelope and generic payload factory.
- `docs/handoffs/HANDOFF-FOUND-02B.md` — This handoff document.

### Modified files

- `packages/contracts/src/common/index.ts` — Exported all common primitive modules (`primitives`, `room`, `user`, `metadata`, `sample`).
- `packages/contracts/src/events/index.ts` — Exported `envelope` module.
- `docs/execution/PROJECT_STATUS.md` — Updated task completion state, test counts, and verified execution outputs.
- `docs/execution/ROADMAP.md` — Marked `FOUND-02B` as `DONE` and updated execution pointer to `FOUND-02C`.
- `docs/execution/CURRENT_TASK.md` — Pointed to `FOUND-02C`.
- `docs/execution/DECISIONS.md` — Added `ADR-008` documenting the generic `LiveEventEnvelope` schema factory and `unknown` payload strategy.

## Shared primitives added

1. **SpecVersion:** Literal `"0.1"` (`SPEC_VERSION`), enforced by `SpecVersionSchema = z.literal("0.1")`.
2. **EventSource:** Enum union `"tiktok" | "tikfinity" | "mock"`, enforced by `EventSourceSchema`.
3. **IsoDateTime:** ISO 8601 UTC datetime string validation via `z.string().datetime()`.
4. **RoomRef:** `{ roomId: string | null; streamerUniqueId: string }`, enforced by `RoomRefSchema`.
5. **UserRef:** `{ id: string | null; uniqueId: string | null; displayName: string; avatarUrl: string | null; roles: string[] }`, enforced by `UserRefSchema`. Container is nullable (`user: UserRefSchema.nullable()`).
6. **EventMetadata:** `{ connectorId: string; connectorVersion?: string; sequenceId?: string; isReplay: boolean; rawStored: boolean }`, enforced by `EventMetadataSchema`.

## LiveEventEnvelope base API & Generic payload strategy

- **Base Schema:** `BaseLiveEventEnvelopeSchema` validates envelope structure with `payload: z.unknown()`. Zero use of `any`.
- **Schema Factory:** `createLiveEventEnvelopeSchema(payloadSchema, eventTypeSchema)` enables downstream tasks (e.g. FOUND-02C) to create strongly-typed envelope schemas and discriminated unions without duplicating envelope fields.
- **TypeScript Interface:** `LiveEventEnvelope<TPayload = unknown, TEventType extends string = string>` inferred cleanly from Zod schema structure.

## Public exports

Root `@crowdcircuit/contracts` exports:
- `SPEC_VERSION`, `SpecVersionSchema`, `SpecVersion`
- `IsoDateTimeSchema`, `IsoDateTime`
- `EventSourceSchema`, `EventSource`
- `RoomRefSchema`, `RoomRef`
- `UserRefSchema`, `UserRef`
- `EventMetadataSchema`, `EventMetadata`
- `LiveEventTypeSchema`, `LiveEventType`
- `createLiveEventEnvelopeSchema`, `BaseLiveEventEnvelopeSchema`, `LiveEventEnvelope`
- `SampleContractSchema`, `SampleContract`

## Tests added

- `packages/contracts/test/common-primitives.test.ts` (16 tests): Validates spec version, event source, ISO datetime format, room reference nullability, user reference nullability, and event metadata.
- `packages/contracts/test/live-event-envelope.test.ts` (9 tests): Validates base envelope parsing, null user envelopes, invalid spec/source/timestamp rejection, missing field rejection, and schema factory payload validation.

## Verification results

### Package-level checks (`@crowdcircuit/contracts`)

```bash
pnpm --filter @crowdcircuit/contracts lint       # ✅ Passed (0 errors)
pnpm --filter @crowdcircuit/contracts typecheck  # ✅ Passed (tsc -b clean)
pnpm --filter @crowdcircuit/contracts test       # ✅ Passed (3 test files, 28 tests passed)
pnpm --filter @crowdcircuit/contracts exec tsc -b --force # ✅ Passed
```

### Dist artifact check

`packages/contracts/dist/` verified via directory inspection:
- `dist/index.js`, `dist/index.d.ts`, `dist/common/`, `dist/events/`, `dist/actions/`, `dist/voice/`
- Zero test files (`*.test.js`, `*.test.d.ts`, `test/`) in `dist/`.

### Full repository baseline

```bash
pnpm lint        # ✅ Passed (0 errors across 15 workspace projects)
pnpm typecheck   # ✅ Passed (tsc -b clean)
pnpm test        # ✅ Passed (4 test files, 30 tests passed monorepo-wide)
pnpm build       # ✅ Passed (All 13 buildable workspace projects compiled cleanly)
```

## Contract or API changes

- Established public contract primitives (`RoomRef`, `UserRef`, `EventMetadata`, `EventSource`, `IsoDateTime`, `SpecVersion`).
- Established generic `LiveEventEnvelope` base schema, schema factory, and TS types.

## Decisions added

- `ADR-008` in `docs/execution/DECISIONS.md`: Generic `LiveEventEnvelope` schema factory and `unknown` base payload strategy.

## Known limitations

- Specific event payload schemas (`gift.sent`, `chat.comment`, `engagement.like`, `social.follow`, etc.) are intentionally not implemented yet per scope of FOUND-02B. They will be added in FOUND-02C.

## Intentionally un-implemented items (FOUND-02C Scope)

- `gift.sent` payload schema
- `chat.comment` payload schema
- `engagement.like` payload schema
- `social.follow` payload schema
- `social.share` payload schema
- `viewer.joined` payload schema
- `live.connected`, `live.disconnected`, `live.ended` payload schemas
- Full `LiveEventEnvelope` discriminated union

## Git status post-task

```
On branch main
Changes not staged for commit:
	modified:   docs/execution/CURRENT_TASK.md
	modified:   docs/execution/DECISIONS.md
	modified:   docs/execution/PROJECT_STATUS.md
	modified:   docs/execution/ROADMAP.md
	modified:   packages/contracts/src/common/index.ts
	modified:   packages/contracts/src/events/index.ts

Untracked files:
	docs/handoffs/HANDOFF-FOUND-02B.md
	packages/contracts/src/common/metadata.ts
	packages/contracts/src/common/primitives.ts
	packages/contracts/src/common/room.ts
	packages/contracts/src/common/user.ts
	packages/contracts/src/events/envelope.ts
	packages/contracts/test/common-primitives.test.ts
	packages/contracts/test/live-event-envelope.test.ts
```

No commit was performed (pending user commit).

## Next task

`FOUND-02C — LIVE Event Payload Schemas`
