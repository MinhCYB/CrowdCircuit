# Phase C Milestone 2 — Delegation and Semantic Freeze Plan

**Milestone:** PHASE-C-MILESTONE-02  
**Roadmap:** `BE-05A`–`BE-05E`, `BE-06A`–`BE-06B`  
**Status:** READY_TO_START — BLOCKED_DECISION before implementation  
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

## BLOCKED_DECISION register

Implementation must not begin until the product owner selects and records each
decision below in `docs/execution/DECISIONS.md`.

### M2-D1 — Candidate identity and idempotency input

- Option A: mapping emits no final `actionId`; it emits a deterministic
  idempotency seed from `(gameProfileId, eventId, ruleId, candidateOrdinal)`.
  Milestone 3 allocates the final durable `actionId`.
- Option B: mapping allocates the final `actionId` using an injected ID source
  and passes it unchanged to Milestone 3.
- Option C: mapping derives the final `actionId` deterministically from the
  event/rule tuple.

**Recommendation:** Option A. It keeps durable identity allocation with the
Action Gateway while providing stable replay/idempotency input and avoiding
public dependence on a hash format.

### M2-D2 — Anonymous-user budget identity

- Option A: all events without a stable viewer ID share a bounded anonymous
  bucket scoped to game profile and rule.
- Option B: anonymous events bypass per-user limits but remain subject to rule
  and game limits.
- Option C: derive a synthetic user key from event/provider metadata.

**Recommendation:** Option A. It prevents anonymous traffic from bypassing
limits and does not invent identity from unstable provider facts.

### M2-D3 — Per-minute window algorithm and scope interaction

- Option A: exact sliding-window counters for per-user and per-rule minute
  limits; cooldown is a last-accepted timestamp; global limit remains the
  specified token bucket.
- Option B: fixed wall-clock minute buckets for per-user and per-rule limits.
- Option C: token buckets for every scope.

**Recommendation:** Option A. It avoids boundary bursts while preserving the
design's explicitly separate global token bucket. Candidates are evaluated in
deterministic order; a candidate consumes all applicable scopes atomically
only when every scope admits it.

### M2-D4 — Restart behavior and durable budget state

- Option A: persist per-user, per-rule, cooldown, and global token state; a
  restart resumes the same effective limits.
- Option B: reset all budgets at restart.
- Option C: persist cooldown/rule windows but reset the global token bucket.

**Recommendation:** Option A. Restart should not create a rate-limit bypass,
and Milestone 1 already supplies durable storage foundations. Test fakes may
remain in memory behind the identical interface.

### M2-D5 — `queue_with_ttl` ownership and durable boundary

- Option A: Milestone 2 returns a typed deferred decision and expiry; Milestone
  3 persists and owns the bounded queue before anything can later be sent.
- Option B: Milestone 2 owns a durable queue now.
- Option C: exclude `queue_with_ttl` until Milestone 3 and reject profiles that
  select it.

**Recommendation:** Option A. It preserves the approved policy without creating
a second action lifecycle or allowing volatile queued gameplay.

### M2-D6 — Bounded-state capacities and cleanup

- Option A: require explicit validated per-profile capacity/retention settings
  with conservative repository defaults.
- Option B: freeze repository-wide constants with no profile override.
- Option C: derive capacity dynamically from configured rates.

**Recommendation:** Option A. Expire entries after the longest applicable
window/TTL, remove oldest inactive entries deterministically, never evict
active deferred work, and fail closed for a new identity if capacity remains
full.

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
| Semantic decisions and ADR | Product owner + CODEX | `docs/execution/DECISIONS.md`, this plan, current execution docs | M2-D1–M2-D6 | Every choice recorded before code | Unresolved choice = BLOCKED_DECISION |
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

1. Record M2-D1–M2-D6; freeze schemas/interfaces and declaration tests.
2. Implement deterministic rule validation, matching, ordering, resolution,
   and dry-run without budgets.
3. Implement atomic bounded budget state and selected persistence behavior.
4. Compose Phase B input and future gateway output boundaries.
5. Run focused review, delegated additive test work if still useful, full
   verification, declaration/dist inspection, and milestone handoff.

No checkpoint authorizes a commit or Milestone 3 work.
