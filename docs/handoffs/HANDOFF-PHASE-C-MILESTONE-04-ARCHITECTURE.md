# Handoff: Phase C Milestone 4 Architecture

**Date:** 2026-07-27
**Baseline commit:** `a50859f42a5918f0bdd63de0e4cd55531bec4341`
**Claude Architecture Review 01:** REQUEST_CHANGES (historical)
**Architecture remediation 01:** COMPLETE
**Claude Architecture Re-Review 02:** APPROVE_WITH_SMALL_FIX (historical)
**Final Architecture Fix Verification:** APPROVE
**Status:** APPROVED_AND_COMPLETE (ADR-025 through ADR-030 ACCEPTED)

## Decisions made

- `/game` is the only Milestone 4 namespace.
- Authentication uses the opaque game-role token exclusively in Socket.IO
  handshake auth; query and registration-body credentials are forbidden.
- Live destination identity is client ID, game ID, non-null instance ID,
  server runtime generation, and connection generation.
- One active socket owns an instance; same-client reconnect replaces it with a
  fenced generation, while another client is rejected.
- The registry is bounded, process-local, non-durable, and never an action
  source of truth.
- The adapter revalidates destination generation immediately before emit and
  never mutates persistence.
- Socket.IO callbacks are not durable receipt. Receipt follows SDK validation
  and local enqueue; result is a separate gameplay terminal signal.
- Shared messages gain protocol, attempt, and session-generation correlation.
- Restart clears sessions and requires re-pairing; ADR-021 remains authoritative.
- Numeric liveness, rate, buffer, registry, SDK queue, concurrency, and dedupe
  limits are selected in the architecture review.

## Accepted ADRs

ADR-025 through ADR-030 are accepted and appended to `docs/execution/DECISIONS.md`.

## Unresolved questions

No blocking product question remains. All architecture findings from independent review and re-review are resolved and approved.

## Expected implementation files

- `packages/contracts/src/actions/**`
- `apps/server/src/game/**`
- narrowly required server delivery/composition files
- `packages/game-sdk-js/**`
- affected package manifests and `pnpm-lock.yaml`
- focused tests, declarations, reviews, and handoffs

No persistence migration or schema change is expected.

## Slices and gates

1. Claude architecture review — APPROVED.
2. Gemini additive contracts/scaffolding; Claude review.
3. CODEX server auth/registry/adapter; Claude review.
4. CODEX receipt/result integration; Claude review.
5. CODEX SDK, with optional Gemini additive fixtures; Claude review.
6. CODEX integration/closure; fresh Claude final review.

The user owns every optional commit checkpoint. Agents do not stage, commit, or
push without a separate instruction.

## Verification expectations

- Contracts, auth-core, server, and SDK lint/typecheck/test/build/declarations.
- Real Socket.IO server/client tests with multiple independent clients.
- Deterministic registry and SDK tests using injected clocks.
- Real SQLite persist-before-send, receipt/retry/TTL, and restart integration.
- Full repository lint/typecheck/test/build at closure.
- Secret/log inspection and final Git inventory.

## Status after architecture work

- Phase C: IN_PROGRESS.
- Milestone 3: APPROVED_AND_COMPLETE.
- Claude Architecture Review 01: REQUEST_CHANGES (historical).
- Architecture remediation 01: COMPLETE.
- Claude Architecture Re-Review 02: APPROVE_WITH_SMALL_FIX (historical).
- Final Architecture Fix Verification: APPROVE.
- Milestone 4 architecture: APPROVED_AND_COMPLETE (decision state: RESOLVED).
- Milestone 4 implementation: ready to begin `Slice 1 — Shared contracts and additive scaffolding` per approved delegation plan.
- Milestone 5: BLOCKED_BY_PREVIOUS_MILESTONE.
- Phase D: untouched.
