# Phase C Milestone 4 Slice 3 — Client-Routing Architecture Review 01

**Date:** 2026-07-28  
**Baseline commit:** `6617f9fffda55f39476ad49fe39732277040978b`  
**Slice 3 implementation review:** REQUEST_CHANGES  
**Corrective model:** structurally sound  
**Final architecture review:** REQUEST_CHANGES pending formal ownership, ADR, and migration amendments

## Review record

Independent review confirmed the adapter defect `clientId: envelope.gameId` and
the authorization defect `clientId: input.gameId`. No repository files were
modified during architecture analysis.

## Blockers

### AR-1 — Persistence/delivery ownership amendment missing

The remediation needs narrow changes to `apps/server/src/delivery/gateway.ts`,
`apps/server/src/persistence/types.ts`, and
`apps/server/src/persistence/repository.ts`.

### AR-2 — ADR-027 null-instance wording conflicts with the honest data model

The accepted phrase “this authenticated action client and game” cannot be
satisfied because the durable action/gateway has no client identity before
registry selection.

### AR-3 — Test/call-site migration allowlist incomplete

The signature correction affects `apps/server/test/persistence.test.ts`,
`apps/server/test/persistence-slice1.test.ts`, and
`apps/server/test/action-gateway-core.test.ts`. The architecture review
observed approximately 62 direct call sites. The fresh pre-edit search is
authoritative: it reports 62 matches across those files and 3 more in
`apps/server/test/declaration-consumer.ts`, for 65 total.

### AR-4 — Lookup port ownership ambiguous

The amendment must explicitly choose which interface owns
`lookupDestination`.

**ARCHITECTURE REVIEW: REQUEST_CHANGES**  
**CORRECTIVE MODEL: APPROVED SUBJECT TO DOCUMENTED AMENDMENTS**
