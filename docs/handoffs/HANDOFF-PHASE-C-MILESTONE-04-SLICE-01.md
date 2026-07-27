# Handoff: Phase C Milestone 4 Slice 1 — Shared Contracts and Additive Scaffolding

**Milestone:** Phase C Milestone 4
**Slice:** Slice 1 — Shared contracts and additive scaffolding
**Baseline HEAD (original implementation):** `e09bdf09bcce43a25a6f5369a1062623550ccf44` (`e09bdf0`)
**Current HEAD (post-remediation):** `f02145948c1c7af8f74dfa61a73e083322b0c4f9` (`f021459`)
**Primary Owner:** Gemini
**Status:** REMEDIATION_COMPLETE_READY_FOR_RE_REVIEW

---

## Executive Summary

Slice 1 completes the shared contract update and additive scaffolding for Phase C Milestone 4. It establishes strict Zod schemas for all game lifecycle messages, removes `token` from `GameRegisterMessage`, adds numeric attempt and session-generation correlation primitives, defines 27 stable wire error codes, provides transport-neutral server session/registry port abstractions, and adds public type scaffolding for `@crowdcircuit/game-sdk-js`.

---

## Deliverables & Key Files

- Shared Protocol Contracts: `packages/contracts/src/actions/lifecycle.ts`
- Canonical Fixtures: `packages/contracts/src/fixtures/index.ts`
- Contract Tests: `packages/contracts/test/domain-actions.test.ts`, `packages/contracts/test/fixtures-integration.test.ts`, `packages/contracts/test/declaration-consumer.ts`
- Transport-Neutral Server Delivery Port Fencing: `apps/server/src/delivery/port.ts`
- Transport-Neutral Server Game Session Ports: `apps/server/src/game/ports.ts`, `apps/server/src/game/index.ts`, `apps/server/src/index.ts`
- SDK Public Type Scaffolding: `packages/game-sdk-js/src/types.ts`, `packages/game-sdk-js/src/index.ts`, `packages/game-sdk-js/test/declaration-consumer.ts`
- Self-Review Document: `docs/orchestration/reviews/PHASE-C-MILESTONE-04-SLICE-01-SELF-REVIEW.md`

---

## Summary of Key Contract Decisions

1. **`game.register`**: `token` field is completely removed. Handshake authentication is enforced out-of-band on Socket.IO connection.
2. **`game.registered`**: Gained `clientId`, `gameId`, `gameInstanceId`, `sessionGeneration`, `heartbeatIntervalMs`.
3. **`game.heartbeat`**: Includes `specVersion: "0.1"`.
4. **`game.action` / `game.action.received` / `game.action.result`**: Correlated via `attemptNumber` (positive safe int) and `sessionGeneration` (non-negative safe int).
5. **`game.error`**: Standardized response carrying 27 enumerated wire error codes, `correlationId`, `retryable`, and optional `actionId`. Raw stack traces, error messages, and credentials are strictly excluded.
6. **Server Ports**: Defined transport-neutral `DestinationGeneration` fence on `DeliveryDestination`, and added `GameSessionRegistryReadPort` and `GameSessionLifecyclePort` interfaces in `apps/server/src/game/ports.ts`.
7. **SDK Scaffolding**: Exposed `GameClientConfig`, `GameClientState`, `ActionHandler`, `CrowdCircuitGameClient` interfaces in `@crowdcircuit/game-sdk-js` with zero runtime code.

---

## Verification Summary

- `@crowdcircuit/contracts`: Lint clean, typecheck clean, 185 tests pass, declarations test pass, build clean.
- `@crowdcircuit/server`: Lint clean, typecheck clean, 96 tests pass, declarations test pass, build clean.
- `@crowdcircuit/game-sdk-js`: Build clean, declarations test pass.
- Repository-wide: 394/394 tests passing across 26 test suites, all 15 workspace packages build clean.
- `git diff --check HEAD --`: Clean (0 whitespace/formatting errors).

---

## Next Step

Per `docs/orchestration/plans/PHASE-C-MILESTONE-04-DELEGATION-PLAN.md`:
- Slice 1 is ready for independent review by Claude.
- Once Slice 1 is reviewed and approved, implementation owner CODEX will proceed with **Slice 2 — Game-session authentication, registration, and registry core**.
