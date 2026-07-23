# Known Issues

Only add verified issues or limitations. Do not use this file as a generic TODO list.

## Open issues

### KI-002 — Concrete TikTok provider composition is deferred

**Status:** Mitigated
**Severity:** Low
**Discovered in:** Phase B Milestone 3

The connector adapter is verified through an injectable provider port, but the
repository does not bundle a concrete unofficial TikTok client or perform a
real-network smoke test.

**Mitigation:** Provider dependencies remain replaceable and contained behind
the tested port. Complete provider selection, license review, and real-network
smoke verification before release.

## Closed issues

### KI-003 — Phase B raw replay and unsupported streak inference

**Status:** Closed
**Severity:** High
**Discovered in:** Phase B independent final review
**Closed in:** PHASE-B-FINAL-REMEDIATION-01

Raw replay is now rejected using provider-independent connector identity,
sequence, or conservative event-specific fingerprints after successful
normalization and before aggregation. Gift streak state now requires explicit
identity and lifecycle evidence; ordinary gifts remain neutral singles.

The independent final remediation review returned APPROVE. Neutral and
userless gifts remain singles without evidence, explicit END supports
`connector_end`, likes remain aggregation-driven, and no-safe-key inputs are
accepted conservatively.

### KI-001 — Repository runtime versions are not verified

**Status:** Closed  
**Severity:** Low  
**Discovered in:** Documentation scaffold  
**Closed in:** FOUND-01

Node.js v24.15.0 and pnpm 11.9.0 verified. All workspace commands pass.

## Issue template

```md
### KI-XXX — Title

**Status:** Open | Mitigated | Closed  
**Severity:** Low | Medium | High | Critical  
**Discovered in:** TASK-ID

Description.

**Reproduction or evidence:**

- ...

**Workaround:**

- ...

**Resolution target:** TASK-ID
```
