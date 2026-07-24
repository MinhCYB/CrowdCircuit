# Phase C Milestone 1 Remediation 02 — Codex Self-Review

**Date:** 2026-07-24  
**Baseline:** `86f1a32`  
**Target:** complete accumulated uncommitted working tree  
**Prior verdict:** REQUEST CHANGES  
**Self-review verdict:** APPROVE FOR NEW INDEPENDENT FOCUSED REVIEW

## Frozen findings

### Runtime and repository ownership

Resolved. The production model permits one repository owner per runtime
generation. Opening a repository atomically claims a new cryptographically
random owner in `runtime_ownership`. Capabilities carry private exact-instance
identity and the durable owner ID. Consumption checks object identity, issuing
repository, current durable ownership, reconciliation completion, and every
action/attempt binding inside the write transaction.

A new claim immediately makes the old live repository fail durable ownership
checks. Reopened repositories cannot consume or mint authorizations until
restart reconciliation commits. Reconciliation revokes prior-owner
authorizations and marks the current owner ready atomically. Closing the issuer
also disables its in-memory ownership state.

### Trusted-clock cleanup

Resolved. `PairingCodeRegistry.cleanup()` and
`RoleSessionRegistry.cleanup()` accept no time argument. Their private sweep
helpers receive timestamps only from each registry's injected clock. Active
declaration tests reject caller-supplied timestamps.

### Nonempty migration manifests

Resolved. An empty manifest raises typed
`INVALID_MIGRATION_MANIFEST` before PRAGMA changes, metadata initialization, or
schema mutation. Fresh-database tests inspect the empty schema after failure,
then prove a valid retry succeeds. Initialized databases reject an empty
manifest without changing history.

### Concurrency and transaction evidence

Resolved for the selected single-owner model.

- Two worker threads open separate SQLite connections, synchronize after
  ownership claims, and contest matching/conflicting creation. Exactly one
  current owner creates one action and one authorization.
- Capability consumption is serialized through the one synchronous repository
  owner; competing scheduled calls yield one attempt and one version advance.
- Internal, root-inaccessible fault hooks fail create, attempt, and
  reconciliation at after-statements, before-commit, and commit-path
  boundaries. Assertions prove complete rollback.
- SQLite trigger tests continue covering first/middle/final reconciliation
  mutations. The explicit commit-path fault also proves ownership readiness is
  not advanced.
- The deterministic fake binds capabilities to its exact owner, rejects closed
  owners, stages attempts and reconciliation, and applies no mutation when its
  injected failure fires.

## Regression and package assessment

All Remediation 01 behavior remains: query credentials fail before mutation;
authentication logs are sanitized; invalid pairing bindings preserve codes;
capabilities remain opaque and single-use; reconciliation is transactional;
migration identities/checksums are enforced; stores remain bounded; no
production in-memory fallback exists.

Built package roots expose neither runtime-owner internals nor transaction
fault hooks, authorization factories, migration runners, or fake details.
Milestone 2 remains untouched.

## Fresh verification

- Node.js v24.15.0
- pnpm 11.9.0
- auth-core: 11 tests; lint/typecheck/build/declarations PASS
- server: 45 tests; lint/typecheck/clean build/declarations PASS
- contracts: 175 tests; forced build/declarations PASS
- repository: 291 tests across 18 files; lint/typecheck/test/build PASS
- `git diff --check HEAD --`: PASS

No Critical, High, Medium, or Low finding remains in the frozen remediation
scope. Milestone 1 is `READY_FOR_FOCUSED_REVIEW`, not `DONE`.
`FOUND-03A`–`FOUND-03D` and `FOUND-04A`–`FOUND-04D` remain `PARTIAL`.
