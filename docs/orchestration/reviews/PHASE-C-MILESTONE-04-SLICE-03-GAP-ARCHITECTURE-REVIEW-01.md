# Phase C Milestone 4 Slice 3 — Gap Architecture Review 01

**Date:** 2026-07-28
**Baseline commit:** `514813687aec465e91b42ee8fc8310408b3b1a21`
**Original result:** SCOPE_BLOCKED
**Review verdict:** APPROVE_WITH_REQUIRED_CORRECTIONS
**ADR impact:** No ADR change required

## Review record

The Slice 3 delivery-adapter proposal was reviewed against ADR-025 through
ADR-030, the approved Milestone 4 architecture and delegation plan, the Slice 1
and Slice 2 closure artifacts, and the current registry/socket boundaries.

No files were modified during proposal/review. The gap is delegation ownership
plus an underspecified internal send boundary. ADR-026 and ADR-027 semantics
remain unchanged.

## Required corrections

### RC-1 — Complete send eligibility fence

Immediately before emission, sendIfCurrent must synchronously validate:

- exact clientId;
- exact gameId;
- exact non-null gameInstanceId;
- exact server runtime generation;
- exact session generation;
- exact connection generation;
- registry not closed;
- authentication not expired;
- connection current, connected, registered, and writable.

### RC-2 — Eligible-only resolution

Destination lookup must exclude already-ineligible entries, including
auth-expired entries.

Semantics:

- ineligible at resolution → no_destination;
- valid at resolution but stale/expired/disconnected/backpressured before send
  → transport_error.

This distinction preserves durable attempt accounting.

### RC-3 — Opaque destinationGeneration

The public boundary remains:

```ts
readonly destinationGeneration: string;
```

The adapter may use a deterministic private encoding of a structured fence.

The encoding must be:

- unambiguous;
- fail-closed when malformed;
- independent of socket ID;
- tied to the selected session generation;
- never refreshed from a replacement during an old attempt.

### RC-4 — Internal provider failure reasons

Use bounded internal reasons:

```ts
type GameConnectionSendResult =
  | { readonly status: "sent" }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "disconnected"
        | "backpressured"
        | "emit_failed";
    };
```

Raw provider errors/messages/stacks remain redacted.

## Accepted closure

The implementation-ready internal interfaces, synchronous resolve/send race
proof, eligible-only selection rules, exact file/symbol ownership allowlist,
frozen behavior, failure mapping, declaration constraints, implementation
sequence, and classified test matrix are authoritative in
`docs/orchestration/plans/PHASE-C-MILESTONE-04-SLICE-03-DELIVERY-BRIDGE-AMENDMENT.md`.

**ARCHITECTURE REVIEW: APPROVE_WITH_REQUIRED_CORRECTIONS**
