# Phase C Milestone 1 Remediation 03 — Codex Self-Review

**Date:** 2026-07-24  
**Baseline:** `86f1a32`  
**Target:** complete accumulated uncommitted working tree  
**Prior verdict:** REQUEST CHANGES  
**Self-review verdict:** APPROVE FOR NEW INDEPENDENT FOCUSED REVIEW

## Frozen defect

Resolved. All owner-scoped durable mutations now compare the repository's
private runtime owner with the current `runtime_ownership.owner_id` inside the
same `BEGIN IMMEDIATE` transaction as the mutation. SQLite's write lock prevents
an ownership claim from interleaving between validation and write.

An inactive or superseded repository receives the stable typed error
`RUNTIME_SUPERSEDED`. The failed transaction performs no mutation.

## Protected write-path inventory

The durable owner gate covers:

- action and first-send authorization creation;
- retry authorization issuance;
- capability consumption;
- capability revocation, including owner ID and durable expected-version
  matching;
- attempt-history insertion;
- action status and version advancement during send attempts;
- all legal action transitions, including receipt, completion, failure,
  expiry, and terminalization;
- restart classification and reconciliation authorization revocation;
- reconciliation readiness metadata;
- terminal action retention cleanup.

Configuration and event-diagnostic repositories remain outside this
action-runtime ownership model. Event retention cannot mutate action,
authorization, attempt, or reconciliation state.

## SQLite evidence

A permanent two-repository, two-connection test keeps Runtime A alive after
Runtime B claims the database. Runtime A repeatedly attempts:

- capability consumption;
- capability revocation;
- pending, in-flight, and received transitions;
- retry issuance;
- reconciliation;
- action cleanup.

Every operation returns `RUNTIME_SUPERSEDED`. Exact before/after queries prove
unchanged action status/version/reconciliation reason, authorization
consumption/revocation, attempts, and active owner metadata.

Runtime B then reconciles, creates a new action/capability, and remains able to
consume it after Runtime A fails to revoke or transition it.

## Fake parity

The deterministic fake now uses shared durable test state with one active owner.
A second fake repository supersedes the first. The first then fails the same
consumption, revocation, transition, retry, reconciliation, and cleanup cases
with `RUNTIME_SUPERSEDED` while shared records, attempts, and authorizations
remain unchanged. The current fake owner can reconcile and continue.

## Regression and output inspection

All Remediation 01 and 02 behavior remains unchanged. Public package roots
expose the typed error but no owner bypass, ownership constructor, transaction
fault control, fake repository, authorization factory, or migration runner.
No test artifact, unsafe assertion, `any`, `z.any()`, or production in-memory
fallback is present.

## Fresh verification

- Node.js v24.15.0
- pnpm 11.9.0
- auth-core: 11 tests; lint/typecheck/build/declarations PASS
- server: 47 tests; lint/typecheck/clean build/declarations PASS
- contracts: 175 tests; forced build/declarations PASS
- repository: 293 tests across 18 files; lint/typecheck/test/build PASS
- `git diff --check HEAD --`: PASS

No finding remains in the frozen Remediation 03 scope. Milestone 1 is
`READY_FOR_FOCUSED_REVIEW`, not `DONE`. Milestone 2 remains blocked and
FOUND-03A–03D / FOUND-04A–04D remain `PARTIAL`.
