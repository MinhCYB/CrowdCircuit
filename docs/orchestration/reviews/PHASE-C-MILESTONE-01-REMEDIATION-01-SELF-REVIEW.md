# Phase C Milestone 1 Remediation 01 — Codex Self-Review

**Date:** 2026-07-24  
**Baseline:** `86f1a32`  
**Review target:** complete accumulated uncommitted working tree  
**Prior verdict:** REQUEST CHANGES  
**Self-review verdict:** APPROVE FOR NEW INDEPENDENT FOCUSED REVIEW

## Frozen remediation findings

### A. Durable one-time send authorization

Resolved.

- `SendAuthorization` is nominal through a private unique-symbol member.
- Package-name consumers cannot construct it from an object literal.
- Runtime acceptance requires the exact repository-issued frozen object in an
  internal `WeakMap`; copied fields and random objects fail.
- The database stores only a SHA-256 identifier generated from 32 random
  bytes, never the raw random material.
- Action and first authorization rows commit in one transaction.
- Duplicate create returns the same durable action with `sendAuthorization:
  null` and a typed `already_authorized | already_consumed` reason.
- Conflicting data under an action ID or idempotency key fails.
- Consumption validates action, version, attempt, runtime, role, client,
  expiry, revocation, and terminal state, then atomically consumes the durable
  row, records the attempt, and advances action state.
- Reuse, forgery, copying, wrong binding, stale state, expiry, revocation, and
  restart reuse fail for both SQLite and the deterministic test fake.

### B. Transactional restart reconciliation

Resolved.

- Classification is computed before mutation.
- All action transitions and outstanding-authorization revocations execute in
  one `BEGIN IMMEDIATE` transaction.
- First-, middle-, and final-record injected failures roll back statuses,
  versions, reconciliation reasons, attempts, and authorization revocations.
- A repaired rerun applies the batch once; later reruns are idempotent.
- Reconciliation contains no transport or gameplay call.

### C. HTTP credential location and logging

Resolved.

- Authentication endpoints reject every query parameter in `onRequest`,
  before session or pairing mutation.
- Approved cookie/body credential locations continue working.
- Pino request serialization records method and path only, stripping the
  entire query string.
- Authorization/cookie headers and token/code body fields are redacted.
- Error logging records only a safe error name.
- Forwarded, X-Forwarded-For, and Host values cannot turn a remote address
  into loopback because Fastify trusted-proxy behavior is not enabled.
- Admin bootstrap now uses POST and reuses the live dashboard admin session.

### D. Pairing redemption

Resolved.

- Lookup and expiry/revocation/binding validation occur before consumption.
- Wrong role/client, malformed body, and wrong origin preserve a valid code.
- `redeem` invokes session creation before marking the code consumed, so
  session-capacity failure also preserves it.
- Correct concurrent requests have one winner. A wrong-binding request cannot
  deny the correct client.
- Failures use enumeration-resistant credential responses.

### E. Migration manifest

Resolved.

- Complete manifests must start at version 1 and remain positive, unique,
  contiguous, and strictly ordered.
- Migration IDs are nonempty and unique.
- Applied metadata stores version, migration ID, and SHA-256 SQL checksum.
- Complete recorded history is checked against the approved manifest before
  executing pending SQL.
- Gap, duplicate, reorder, changed identity/checksum, missing initial version,
  and newer unknown history fail.
- Manifest rejection occurs before metadata-table creation; SQL failure still
  rolls back its schema and metadata.

### F. Bounded authentication stores

Resolved.

- Pairing and session registries have configurable positive capacities and
  tombstone TTLs.
- Deterministic cleanup uses only the injected clock.
- Create, issue, redeem, validate, and revoke paths sweep removable records.
- Expired entries are removed; consumed/revoked tombstones remain for the
  configured replay window.
- Live credentials are never evicted to make room. Exhaustion produces typed
  `CAPACITY_EXCEEDED`.
- Explicit cleanup is bounded by the configured maximum store size and is
  idempotent.

## Additional independent-review corrections

- Action and event cleanup policies are transactionally all-or-nothing.
- Server builds delete `dist` before forced compilation, removing stale test
  artifacts.
- Migration implementation functions are no longer exported from the server
  package root.
- The repository Node engine floor is now `>=24.2.0`, matching the selected
  `node:sqlite` runtime class.
- The test fake is not described as full production parity; it is used only
  for the frozen shared capability/state tests and is not a production
  fallback.

## Verification

- Node.js v24.15.0
- pnpm 11.9.0
- auth-core: lint, typecheck, build, declarations PASS; 11 tests PASS
- server: lint, typecheck, clean build, declarations PASS; 36 tests PASS
- contracts: forced build and declarations PASS; 175 tests PASS
- repository: lint, typecheck, test, build PASS; 282 tests across 18 files
- `git diff --check HEAD --`: PASS

Built root declarations expose the nominal authorization type but no
authorization factory, migration runner, test fake, or verification symbol.
Server `dist` contains no `*.test.*` artifact. Source and emitted output contain
no operational secret, raw capability, unsafe assertion, `any`, `z.any()`,
source/test path, database, or production in-memory fallback.

## Scope

Milestone 2 mapping/budget work, Socket.IO, transport sending, SDK behavior,
demo gameplay, and Phase D remain untouched.

No Critical, High, Medium, or Low remediation finding remains. Milestone 1 is
`READY_FOR_FOCUSED_REVIEW`, not `DONE`; FOUND-03A–03D and FOUND-04A–04D remain
`PARTIAL`.
