# Phase C Milestone 2 — Delegation and Semantic Freeze Plan

**Milestone:** PHASE-C-MILESTONE-02  
**Roadmap:** `BE-05A`–`BE-05E`, `BE-06A`–`BE-06B`  
**Status:** READY_TO_IMPLEMENT
**Primary implementation owner:** CODEX

## Authoritative scope

Milestone 2 accepts approved Phase B normalized LIVE events plus a validated
game profile/manifest and returns zero or more deterministic, JSON-safe action
candidates, budget decisions, and safe diagnostics. It owns mapping rules,
parameter resolution, deterministic evaluation, rule/user/game budgets,
bounded overflow decisions, and dry-run evidence.

It does not own durable action lifecycle, transport, Socket.IO, SDK behavior,
demo-game behavior, voice, UI, or Phase D.

## Semantics already frozen by authoritative design

| Area | Frozen behavior |
|---|---|
| Cardinality | One normalized event may produce zero, one, or multiple action candidates. |
| Match modes | `all` permits all matches; `first` permits the first match after deterministic ordering; `exclusive_group` permits at most one match per group. |
| Ordering | `priority DESC`, `specificity DESC`, `createdAt ASC`, `ruleId ASC`. This order also defines stable result and diagnostic order. |
| Specificity | Exact gift/command +100; exact scalar equality +50; numeric range +30; prefix/contains +20; regex +10; no condition 0. |
| Operators | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `regex`, and `in`. |
| Evaluation sequence | Filter event type/enabled; compute specificity and sort; evaluate conditions; apply user/rule/game budgets; apply match mode/group; resolve parameters; validate manifest; emit candidate and ordering diagnostics. |
| Rule controls | Cooldown and `maxActionsPerMinute` are rule-level controls. |
| Global budget | Per-game token bucket, applied after rule-level limits; design defaults are 30 actions/second, burst 50, `drop_low_priority`. |
| Overflow | Only bounded `drop_low_priority`, `queue_with_ttl`, and `reject_newest` are valid. Unbounded queues are forbidden. |
| Validation | Profiles/manifests are validated atomically. Invalid configuration produces no candidates and consumes no budget. Duplicate rule IDs are invalid. |
| Clock | Time-dependent evaluation uses an injected trusted clock; callers cannot supply authoritative timestamps. |
| Output safety | Candidate parameters and diagnostics are JSON safe, manifest validated, deterministic, and secret safe. |
| Persistence boundary | A budget-rejected candidate does not become a durable action. Milestone 2 never sends. The future gateway durably records an accepted action before first send. |

## Resolved decision register

M2-D1 through M2-D6 are `RESOLVED` and recorded as ADR-013 through ADR-018 in
`docs/execution/DECISIONS.md`.

### M2-D1 — RESOLVED: candidate identity (ADR-013)

Mapping emits no final `actionId`. It emits a deterministic, explicitly
versioned seed derived from `gameProfileId`, `ruleId`, normalized `eventId`,
candidate ordinal, action type, and canonical JSON-safe params. Timestamp,
randomness, UUID, and configuration version do not participate. Different
rules remain distinct. Milestone 3 allocates and persists the final action ID.

### M2-D2 — RESOLVED: anonymous-user budget identity (ADR-014)

Identity precedence is nonempty `user.id`, then nonempty `user.uniqueId`, then
a shared anonymous identity scoped by game profile and rule. Anonymous traffic
is subject to user, rule, and game scopes. No unstable provider/display facts
are identity inputs.

### M2-D3 — RESOLVED: windows and atomic admission (ADR-015)

User/anonymous and rule minute limits use exact sliding windows; cooldown uses
the last accepted timestamp; the game limit remains a token bucket. After
validation, matching, deterministic sorting, match-mode resolution, and
candidate resolution, each selected candidate atomically evaluates all scopes.
All mutations commit only on admission. Rejected, dropped, deferred, discarded,
or transaction-failed candidates consume nothing. Trusted processing time is
mandatory and clock rollback fails closed.

### M2-D4 — RESOLVED: durable budget state (ADR-016)

Cooldown, user/anonymous windows, rule windows, and game token state are
durable. Restart does not reset limits; downtime advances time normally and
tokens refill only to burst. Production has no in-memory fallback. Later
Action Gateway persistence failure does not refund admitted budget.

### M2-D5 — RESOLVED: queue ownership (ADR-017)

Milestone 2 retains and persists no queue and sends nothing. It returns typed
accepted, rejected, dropped, or deferred results. A `queue_with_ttl` deferred
result contains the resolved candidate, absolute expiry, and reason.
Milestone 3 exclusively owns durable queue insertion and transport lifecycle.

### M2-D6 — RESOLVED: bounded state (ADR-018)

Profiles contain validated capacity/retention settings backed by conservative
repository defaults. Cleanup is trusted-clock-only, lazy plus bounded sweeps,
and deterministic oldest-inactive removal. Live state is never evicted.
Exhaustion fails closed with a typed result. Diagnostics are not retained
without an explicit bound, and Milestone 2 has no queue state. Exact defaults
are justified and tested during implementation rather than frozen from review
examples.

## Failure and diagnostic freeze

Subject to the decisions above:

- Configuration loading is all-or-nothing. Malformed profiles, manifests,
  templates, operators, duplicate IDs, invalid regex, non-finite limits, or
  conflicting fixed-shape fields fail validation before evaluation.
- Expected mismatch or budget rejection is data, not an exception.
- Evaluation returns a typed result containing ordered candidates and ordered,
  machine-readable diagnostics. Diagnostics name rule/scope/reason without
  secrets or raw credentials.
- Internal dependency failure returns a typed fail-closed error and no
  candidates. Partial budget consumption must roll back.
- Dry-run performs the same validation, matching, ordering, and parameter
  resolution but does not consume budget or persist action state.

## Ownership and delegation

| Work unit | Owner | Allowed files | Frozen interfaces | Acceptance | Escalation |
|---|---|---|---|---|---|
| Semantic decisions and ADR | Product owner + CODEX | `docs/execution/DECISIONS.md`, this plan, current execution docs | ADR-013–ADR-018 | All six choices recorded | Any new ambiguity = BLOCKED_DECISION |
| Mapping public model and validation | CODEX | `packages/mapping-engine/src/**`, its package config/tests; contracts only for a proven reviewed gap | Phase B envelopes, existing action/JSON contracts | Runtime/type alignment; strict validation; no invented normalized facts | Contract change requires separate review |
| Deterministic evaluator and resolver | CODEX | `packages/mapping-engine/src/**`, focused tests | Ordering, specificity, operators, match modes | Deterministic zero/one/many output and safe diagnostics | Semantic ambiguity returns to decision register |
| Budget core and persistence adapter | CODEX | `packages/mapping-engine/src/**`, focused `apps/server/src/**` adapter/storage files and migrations if approved | Selected M2-D2–D6 semantics; Milestone 1 repositories | Atomic multi-scope admission, bounded cleanup, restart tests | Data-integrity/concurrency issue stays CODEX-owned |
| Phase B input and future gateway output adapters | CODEX | focused mapping/server composition files | Existing normalized event union; frozen candidate result | No fabricated domain facts; no transport/send | Boundary change requires focused review |
| Representative fixtures/configurations | GEMINI | new `packages/mapping-engine/test/fixtures/**` only | CODEX-published schemas/types | Exact requested fixtures; package compile passes | Any API gap: stop and report |
| Additive black-box runtime/declaration tests | GEMINI | new named test/consumer files only, as listed in its prompt | Published package-name APIs only | Requested positive/negative matrix passes unchanged APIs | One focused rework maximum; then CODEX takeover |
| Documentation/handoff | GEMINI | its handoff only | Recorded decisions and actual command output | Accurate file/status/results evidence | No current-state invention |

Gemini has no authority to alter production files, package exports, public
interfaces, schemas, algorithms, decisions, or execution status. Gemini gets
at most one focused rework round.

## Internal checkpoints for CODEX

1. Apply ADR-013–ADR-018; freeze schemas/interfaces and declaration tests.
2. Implement deterministic rule validation, matching, ordering, resolution,
   and dry-run without budgets.
3. Implement atomic bounded budget state and selected persistence behavior.
4. Compose Phase B input and future gateway output boundaries.
5. Run focused review, delegated additive test work if still useful, full
   verification, declaration/dist inspection, and milestone handoff.

No checkpoint authorizes a commit or Milestone 3 work.
