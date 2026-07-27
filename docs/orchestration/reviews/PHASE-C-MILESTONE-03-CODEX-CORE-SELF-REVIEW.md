# Phase C Milestone 3 CODEX Core Self-Review

**Date:** 2026-07-27
**Baseline:** `a880572` on `review/phase-c`
**Verdict:** READY_FOR_INDEPENDENT_REVIEW

## Scope and decisions

The implementation follows ADR-019 through ADR-024 and remains transport
independent. It adds no Socket.IO, `/game` namespace, SDK, real game session,
demo-game, Milestone 4, Milestone 5, or Phase D behavior.

`computeActionId` uses private format version 1, canonical JSON encoding,
SHA-256, and 128 retained digest bits (`act_` plus 32 hexadecimal characters).
Database uniqueness remains authoritative. Replay returns the original row;
a same-ID/different-canonical-action conflict fails closed.

Deferred candidates remain separate from `action_logs`. Migration v4 adds the
two immutable fields required for complete candidate recovery that v3 omitted:
`event_type` and `user_budget_key`. Deferred insertion is bounded at 4096
queued rows per game with a deterministic 128-row expiry sweep.

Promotion owns one `BEGIN IMMEDIATE` transaction. It verifies the queued,
unexpired row, replays complete admission from the immutable snapshot across
user window, cooldown, rule window, global token bucket, and bounded capacity,
creates or recovers the durable action, then marks the deferred row promoted.
Failure injection proves budget mutations, action creation, and promotion roll
back together.

## Delivery and lifecycle

Accepted candidates create a durable pending action without pre-authorizing a
destination. Delivery resolves the current destination first.
`no_destination` creates no authorization or attempt and calls no send method.
With a destination, a fresh destination-bound authorization is issued and
consumed, `send_started` is inserted, and the action becomes `in_flight`
before the delivery port is invoked.

Retry constants are: 5000 ms receipt timeout, 1000/2000 ms retry backoffs,
1000 ms no-destination recheck, and 3 total attempts. Scheduling is durable in
`nextAttemptAt`, deterministic, and unjittered. TTL wins, exhaustion reaches
`delivery_failed`, receipt stops retry, and duplicate receipt/result signals
are idempotent.

Restart reconciliation follows ADR-021: unexpired pending actions are
reassigned and remain pending, in-flight actions become
`delivery_unknown_restart`, received actions remain received, expired work
remains terminal, authorizations are revoked, and queued deferred rows are
reassigned or expired. New writes retain runtime-owner fencing.

## Verification

- Server lint, typecheck, build, and declarations: pass.
- Server tests: 81 passed across 10 files.
- Promotion worker-thread/independent-handle race: 3/3 independent runs pass.
- Repository lint, typecheck, and build: pass.
- Repository tests: 369 passed across 26 files.
- Failure injection: atomic promotion rollback and later successful replay pass.

No open correctness, atomicity, ownership, retry, TTL, declaration, or scope
finding remains. Independent review is still required; Milestone 3 is not
marked complete or approved.
