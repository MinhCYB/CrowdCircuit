# Phase C Milestone 4 Slice 4 — Architecture Review 01

**Reviewed baseline:** `37be23c4f345bee5f7be1ca2a640125514e3f09c`  
**Review type:** static/read-only architecture review  
**Runtime limitation:** Node 22 and missing pnpm in the reviewer environment  
**Repository activity:** no implementation or repository modification during review  
**Core architecture:** sound and schema-compatible  
**Final verdict:** REQUEST_CHANGES  
**Reason:** specification was not yet implementation-ready.

## Findings

### Critical — rejected-code union incomplete

The proposal omitted approved `ACTION_BINDING_MISMATCH` and
`ATTEMPT_NOT_FOUND`.

### High — legacy result handling has no conflict detection

Current `markResult` can return an existing terminal record without proving
the incoming result is identical. Slice 4 must replace/narrow the old
`markReceived` and `markResult` methods with attempt-correlated lifecycle
handling and canonical-result comparison.

### High — production composition path undefined

Production currently constructs neither the durable repository nor
`ActionGateway`. The amendment must decide exactly how the inbound dependency
reaches the socket runtime.

### Medium — result-before-receipt behavior unspecified

The amendment must state the server behavior and which later slice owns any
client resend behavior.

### Low — orphan binding rows after action retention cleanup

The gateway must always confirm the parent action exists before trusting an
attempt-binding row. Missing parent maps to `ACTION_NOT_FOUND`.

The focused amendment resolves these findings without rewriting this
historical verdict.

**ARCHITECTURE REVIEW: REQUEST_CHANGES**  
**CORE MODEL: APPROVED SUBJECT TO THE FOCUSED SLICE 4 AMENDMENT**
