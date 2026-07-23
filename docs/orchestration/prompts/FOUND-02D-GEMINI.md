# FOUND-02D — Gemini Flash High Implementation Prompt

## Task and objective

Implement `FOUND-02D — GameActionEnvelope and Action Lifecycle Schemas`.

Add the versioned, runtime-validated public contracts for game registration, heartbeat, action delivery, receipt, and completed/failed results. Preserve the architectural distinction between delivery receipt and gameplay completion. Do not implement runtime networking or FOUND-02E.

This task remains one task: it is confined to `@crowdcircuit/contracts`, its tests, and execution/handoff documentation.

## Exact reading order

Read in this order:

1. `docs/execution/PROJECT_STATUS.md`
2. `docs/execution/CURRENT_TASK.md`
3. `docs/tasks/FOUND-02D.md`
4. `docs/execution/DECISIONS.md`
5. `docs/execution/KNOWN_ISSUES.md`
6. `docs/orchestration/reviews/FOUND-02C-CODEX-REVIEW-FINAL.md`
7. `docs/handoffs/HANDOFF-FOUND-02C-REWORK-02.md`
8. `docs/crowdcircuit-system-design-v0.1.1.md`:
   - `## 11.8 Game SDK`
   - `## 11.9 Action Gateway`
   - `## 12.2 GameActionEnvelope`
   - only the game-related parts of `## 14. WebSocket protocol`
9. Existing contract implementation and tests:
   - `packages/contracts/src/common/**`
   - `packages/contracts/src/events/**`
   - `packages/contracts/src/actions/index.ts`
   - `packages/contracts/src/index.ts`
   - `packages/contracts/test/**`
   - `packages/contracts/package.json`

Do not read the UI/UX specification or unrelated System Design sections.

## Preflight

Before changing files, run and report exact output:

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

Expected starting implementation baseline is approved commit `34ad050`, but Git output is authoritative. If the tree is dirty or a command fails, distinguish pre-existing state from your changes and diagnose before implementation.

## Allowed paths

- `packages/contracts/src/actions/**`
- `packages/contracts/src/common/**` only when a genuinely shared primitive is required
- `packages/contracts/src/index.ts`
- `packages/contracts/test/**`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/execution/DECISIONS.md` only for a genuinely new architectural decision
- `docs/execution/KNOWN_ISSUES.md` only for a verified issue
- `docs/handoffs/HANDOFF-FOUND-02D.md`

Stop and report before changing anything outside these paths. Do not alter FOUND-02C production contracts or tests except for a verified regression strictly necessary to keep the package valid.

## Required implementation

Export Zod schemas and inferred public types for:

1. `GameActionEnvelope`
2. Game registration message (`game.register`)
3. Game registered response (`game.registered`)
4. Minimal game heartbeat message
5. Action delivery message (`game.action`)
6. Action receipt message (`game.action.received`)
7. Action result union (`game.action.result`) discriminated by:
   - `completed`
   - `failed`

Keep public names clear and consistent with existing package conventions. All APIs must be reachable through package-name imports from `@crowdcircuit/contracts`.

### GameActionEnvelope

Implement the System Design fields:

```ts
{
  specVersion: "0.1";
  actionId: string;
  actionType: string;
  gameId: string;
  gameInstanceId: string | null;
  params: JsonValue;
  actor: {
    viewerId: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  trigger: {
    eventId: string;
    eventType: string;
    mappingId: string;
  };
  priority: number;
  ttlMs: number;
  createdAt: string;
}
```

Requirements:

- Use the existing `SpecVersionSchema`, `IsoDateTimeSchema`, and JSON-safe contract primitives where applicable.
- IDs, action type, game ID, display name, and trigger strings must be non-empty.
- `avatarUrl` is a valid URL or `null`.
- `priority` is a finite integer.
- `ttlMs` is a positive finite integer.
- `createdAt` is an ISO datetime accepted by the existing shared schema.
- `actor` is either the strict actor object or `null`.
- `gameInstanceId` and actor `viewerId` are required nullable fields, not optional fields.
- All fixed-shape objects are strict.
- Do not invent UUID, prefix, priority-range, TTL-maximum, or cross-field constraints absent from the design.

Use the existing JSON-safe schema for generic `params`. Do not use `any`, `z.any()`, or an unchecked escape hatch. Public generic/default typing may be `unknown` only where the task brief explicitly requires generic extensibility, while runtime validation must remain JSON-safe.

### Registration and heartbeat

- `game.register` contains strict fields from the protocol example:
  - `type`
  - non-empty `gameId`
  - non-empty `instanceId`
  - non-empty `sdkVersion`
  - non-empty opaque `token`
- `game.registered` contains:
  - `type`
  - positive integer `heartbeatIntervalMs`
- The design requires a game heartbeat but does not define extra payload fields. Implement only the strict minimal message discriminator required for a heartbeat; do not add state, timestamps, IDs, sequence numbers, or status fields without explicit design support.

### Delivery, receipt, and result

- `game.action` is a strict wrapper containing `type: "game.action"` and `data: GameActionEnvelope`.
- `game.action.received` is a strict message containing:
  - `type`
  - non-empty `actionId`
  - ISO `receivedAt`
- Receipt means only that the game validated and enqueued the action. Do not add completion status or result data to the receipt.
- `game.action.result` must be a discriminated union on `status`.
- Both result variants contain `type: "game.action.result"` and non-empty `actionId`.
- Completed result contains:
  - `status: "completed"`
  - non-negative finite integer `durationMs`
  - optional `details` only if it is validated as JSON-safe; omit the field entirely if a conservative design cannot keep it safe and exact
- Failed result contains:
  - `status: "failed"`
  - strict `error` object with non-empty `code`, non-empty `message`, and boolean `retryable`
- Completed and failed result types must narrow correctly by `status`.
- Do not merge receipt and result into one schema or imply exactly-once gameplay execution.

## Contract invariants

- Zod schemas are the runtime source of truth; infer public types from schemas.
- Runtime, `z.input`, `z.output`, and emitted declarations must align.
- All fixed-shape protocol objects reject unknown keys.
- Required nullable properties cannot be omitted or assigned `undefined`.
- No `any` or `z.any()`.
- Generic action values and optional details remain JSON-safe at runtime.
- Reject `NaN`, infinities, functions, symbols, BigInts, dates, maps, sets, class instances, and `undefined` in JSON-value positions.
- Preserve literal message discriminators and `"0.1"` spec version.
- Preserve receipt/result separation and action ID idempotency fields.
- Do not duplicate shared schemas or handwrite public types that can drift.
- Do not weaken or modify approved LIVE event behavior.

## Runtime tests

Add focused positive and negative tests.

Positive coverage:

- Valid complete action envelope.
- Nullable `gameInstanceId`, nullable actor, nullable actor viewer ID, and nullable avatar URL.
- JSON-safe nested params.
- Registration, registered response, and minimal heartbeat.
- Action delivery wrapper.
- Receipt with valid ISO `receivedAt`.
- Completed result with zero and positive integer duration.
- Failed result with the complete error object.
- Completed/failed union parsing and narrowing.
- Valid optional JSON-safe details if details are implemented.

Negative coverage:

- Missing required fields and extra fields on every fixed-shape schema.
- Empty IDs, action type, game ID, display name, trigger fields, SDK version, and token.
- Invalid non-null avatar URL.
- Omitted or `undefined` required nullable properties.
- Fractional, `NaN`, and infinite priority.
- Zero, negative, fractional, `NaN`, and infinite TTL.
- Invalid `createdAt` and `receivedAt`.
- Invalid heartbeat interval: zero, negative, fractional, `NaN`, and infinities.
- Mismatched message discriminators.
- Missing action delivery data.
- Receipt containing result/completion fields.
- Zero is valid for completed `durationMs`; negative, fractional, `NaN`, and infinities are invalid.
- Completed result containing failed-only fields and failed result containing completed-only fields.
- Empty error code/message and non-boolean retryable.
- Non-JSON params/details, including `undefined`, function, BigInt, Symbol, `NaN`, infinities, Date, Map, Set, and class instances.

Do not remove existing valid regression coverage.

## Declaration tests

Extend the package-name declaration fixture using imports from `@crowdcircuit/contracts`.

Prove:

- Every new schema and inferred type is publicly importable.
- Literal message types are preserved.
- `GameActionEnvelope` accepts valid JSON-safe params and rejects invalid field types.
- Required nullable fields reject omission and explicit `undefined` but accept `null`.
- Priority, TTL, timestamps, and result fields have the intended public types.
- Receipt does not accept completion/result fields.
- The result union narrows completed versus failed fields by `status`.
- Completed and failed variants reject each other's exclusive fields.
- `z.input` and `z.output`/`z.infer` remain aligned for the envelope and result union.
- Strict fresh-object checks reject invented top-level and nested fields.
- Existing LIVE event declaration coverage remains passing.

Use correctly placed `@ts-expect-error` directives. Do not use casts that bypass the intended check.

## Explicit exclusions

Do not implement:

- Socket.IO server/client behavior
- SDK runtime, reconnection, pairing, local queues, LRU caches, or duplicate handling
- Retry timers, receipt timeouts, TTL expiration processing, action state machines, or persistence
- Mapping Engine or action budgets
- Game manifests or game state-report schemas unless an existing exported contract strictly requires them
- Voice contracts or FOUND-02E
- Connector/event changes, UI work, unrelated refactors, or package-wide formatting

## Verification

Run focused verification:

```powershell
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations
```

Inspect `packages/contracts/dist`:

- New public schemas/types are exported from package declarations.
- Message literals, nullable requirements, receipt/result separation, and result discrimination are preserved.
- Generic params/details are JSON-safe and do not emit uncontrolled `any`.
- No test or declaration fixture artifacts leak into `dist`.
- No stale or unrelated artifacts exist.

Use package-name consumer probes where necessary; do not rely only on source-level types.

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

Report exact test-file and test counts from fresh output.

## Documentation and handoff

Create `docs/handoffs/HANDOFF-FOUND-02D.md` containing:

- Status `IMPLEMENTED — AWAITING INDEPENDENT REVIEW`
- Date and actual verified base commit
- Summary and exact changed paths
- Public API and contract invariants
- Exact verification results and counts
- Declaration and `dist` inspection evidence
- Known limitations and explicit exclusions
- Final Git status, explicitly labeled as the state at handoff-generation time
- Statement that FOUND-02E was not started

Synchronize execution documents conservatively:

- Keep FOUND-02D current and non-DONE until independent review.
- Set ROADMAP FOUND-02D to `PARTIAL`.
- Do not select or start FOUND-02E.
- Do not rewrite historical handoffs.
- Update decisions or known issues only when verified and necessary.

## Commit policy and no-commit instruction

From FOUND-02D onward, prefer one commit per completed task. Mid-task commits are allowed only for substantial, independently reviewable milestones. Do not request separate commits solely for prompts, handoffs, reviews, or status updates.

For this implementation session, do not stage, commit, amend, reset, checkout, restore, push, or create a branch. Leave the complete task change set uncommitted for independent review and user-controlled commit/push.

## Final response format

Return exactly:

1. `Preflight`
2. `Implementation`
3. `Files Changed`
4. `Runtime Tests`
5. `Declaration Tests`
6. `Build and Dist Inspection`
7. `Repository Verification`
8. `Documentation`
9. `Final Git Status`
10. `Risks or Blockers`

Use exact command output and counts. State `None` only when no risk or blocker exists.
