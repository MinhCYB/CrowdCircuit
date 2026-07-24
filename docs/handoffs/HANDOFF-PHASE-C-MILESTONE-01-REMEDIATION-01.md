# Handoff — Phase C Milestone 1 Remediation 01

**Generated:** 2026-07-24  
**Baseline HEAD:** `86f1a32`  
**State:** accumulated uncommitted working tree  
**Status:** READY_FOR_FOCUSED_REVIEW

## What changed after REQUEST CHANGES

1. First-send authorization is a nominal, runtime-identity-checked, durable
   one-time capability. The database stores its hash-bound authorization row.
   Duplicate creation returns no second capability.
2. Attempt consumption validates every durable binding and consumes the
   authorization in the same transaction as attempt evidence and action
   advancement.
3. Restart reconciliation is one all-or-nothing transaction and revokes
   outstanding old-runtime authorizations.
4. Authentication endpoints reject query credentials before mutation. Logs
   contain sanitized paths and redact credential headers/body fields.
5. Admin bootstrap is POST and idempotently reuses the active dashboard
   session.
6. Invalid pairing binding/origin/body attempts do not consume a valid code;
   paired session creation and final consumption form one synchronous critical
   section.
7. Migration manifests and recorded histories are contiguous and protected by
   stable migration IDs and SHA-256 SQL checksums.
8. Pairing/session registries enforce configurable capacity, expiry cleanup,
   replay tombstones, and fail-closed exhaustion.
9. Action/event retention is transactional.
10. Server builds clean `dist`; stale `index.test.*` output is gone.

## Permanent evidence

- SQLite and deterministic-fake authorization forgery/copy/reuse/binding tests
- Two-repository duplicate-create test
- Capability-generation rollback and restart-reuse tests
- SQLite first/middle/final reconciliation trigger failures with full rollback
- Repaired and repeated reconciliation tests
- Query token/code rejection with captured-log secret scan
- Forwarded-header loopback bypass rejection
- Wrong role/client/origin/body followed by correct redemption
- Concurrent correct redemption
- Pairing/session capacity, expiry, tombstone, and cleanup tests
- Migration gap, duplicate, reorder, identity, checksum, upgrade, rollback,
  reopen, and unknown-version tests
- Package-name nominal capability and capacity declaration tests

## Fresh verification

- Node.js v24.15.0
- pnpm 11.9.0
- auth-core: 11 tests
- server: 36 tests
- contracts: 175 tests
- repository: 282 tests across 18 files
- focused lint/typecheck/build/declarations: PASS
- repository lint/typecheck/test/build: PASS
- contracts forced build and declarations: PASS
- `git diff --check HEAD --`: PASS

## Reviewer focus

Review the complete working tree against `86f1a32`. Re-run forged/copy/reuse
authorization, two-repository duplicate creation, injected reconciliation
rollback, captured authentication logging, pairing preservation, migration
history, capacity exhaustion, and clean-dist probes.

Milestone 2 remains blocked. No commit or push has occurred.

Git status must be refreshed by the reviewer; any status in this handoff is a
handoff-generation snapshot, not future repository state.
