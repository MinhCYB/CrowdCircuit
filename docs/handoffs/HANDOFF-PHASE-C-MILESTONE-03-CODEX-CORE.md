# Handoff: Phase C Milestone 3 CODEX Core

**Date:** 2026-07-27
**Baseline:** `a880572` on `review/phase-c`
**Status:** APPROVED_AND_COMPLETE (independent verdict: APPROVE)

## Delivered

- Versioned deterministic SHA-256 action IDs and durable collision/idempotency
  handling.
- Bounded durable deferred insertion and immutable admission snapshots.
- Single-transaction full budget re-admission, action creation, and promotion.
- Candidate-to-action orchestration and destination-first persist-before-send.
- Explicit retry destination binding, three total attempts, durable scheduling,
  live TTL processing, and delivery exhaustion.
- ADR-021 restart reconciliation for action and deferred work.
- Worker-thread/independent-handle contention tests, failure injection, public
  exports, and declaration consumers.

## Constants

- Action-ID format: 1; retained digest: 128 bits.
- Receipt timeout: 5000 ms.
- Retry backoffs: 1000 ms, 2000 ms.
- No-destination recheck: 1000 ms.
- Maximum attempts: 3.
- Deferred capacity: 4096 queued rows per game.
- Deferred lazy sweep and default lifecycle sweep: 128 rows.

## Evidence

- Server: lint/typecheck/build/declarations pass; 81/81 tests pass.
- Promotion race: three independent runs, 3/3 pass, with one action and one
  budget mutation set under six workers.
- Repository: lint/typecheck/build pass; 369/369 tests across 26 files pass.

Review the transaction-aware admission primitive, promotion rollback,
destination-first authorization, durable schedule versioning, ADR-021
reconciliation, migration v4 completeness fields, and shared-owner race test.

No staging, commit, push, branch switch, fetch, pull, Socket.IO, or Milestone 4
work occurred.
