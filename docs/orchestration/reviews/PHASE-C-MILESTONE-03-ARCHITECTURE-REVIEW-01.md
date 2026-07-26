# Phase C Milestone 3 — Independent Architecture Review 01

**Reviewer role:** Independent architecture and decision reviewer (analysis only — no production code, tests, migrations, or commits were created).
**Repository:** https://github.com/MinhCYB/CrowdCircuit
**Branch:** `review/phase-c`
**Baseline commit:** `15eb07c48137a6983ee64709636c9b7d67baa7f7` (`docs: close Phase C milestone 2`)

---

## 0. Headline finding — scope conflict between this review's brief and the frozen Milestone Plan

Before anything else, this must be surfaced because it changes how several sections below should be read.

The frozen `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md` explicitly scopes Milestone 3 as the **transport-independent core** of `BE-07B`–`BE-07D`:

- In scope: state machine, transactional persist-before-send, attempt recording, retry, TTL, idempotent duplicate receipt/result handling, restart reconciliation.
- Out of scope (verbatim): *"Socket.IO, real game sessions, SDK, demo game, UI, Phase D, and active-game switching."*
- Milestone 4 owns `BE-07A` (Socket.IO namespace/registration) and `BE-08A`–`BE-08C` (SDK), per both the plan and `ROADMAP.md`.

This review's instructions (Sections 8–9) ask for a concrete Socket.IO `/game` transport boundary and acknowledgement-semantics decision as Milestone 3 architecture output. That is Milestone 4 territory under the project's own frozen decisions, and treating it as binding Milestone 3 scope would contradict ADR history and the ownership table in the plan (Milestone 3 owner is CODEX for *"Persist-before-send, state machine, retry, TTL, reconciliation, and idempotency"* — transport concerns are explicitly Milestone 4's ownership row).

**Resolution used in this review:** Sections 8–9 below are answered as **forward-looking transport-contract guidance** — the minimum shape Milestone 3's lifecycle core must expose so that Milestone 4 can attach Socket.IO without re-opening lifecycle decisions — not as Milestone 3 implementation scope. No Socket.IO code, dependency, or namespace should be added during Milestone 3. This is listed again as Open Decision OD-1 and is why the verdict below is `READY_TO_RESOLVE` rather than treating transport as blocking: the ambiguity is resolvable by deferring to the existing plan, not by inventing a new product decision.

A second, related finding: `ROADMAP.md`'s `BE-05A`–`BE-06B` rows still read `TODO` while `PROJECT_STATUS.md`, `CURRENT_TASK.md`, and the Milestone 2 closure record all say `APPROVED_AND_COMPLETE`. This is a documentation-sync gap, not an architecture blocker — noted in Section 24.

---

## 1. Repository and baseline evidence

```
git rev-parse HEAD        → 15eb07c48137a6983ee64709636c9b7d67baa7f7
git branch --show-current → review/phase-c
git status                → clean working tree
```

Recent history (`git log --oneline -12`):

```
15eb07c (HEAD, origin/review/phase-c) docs: close Phase C milestone 2
c54b288 fix: remediate Phase C milestone 2 review findings
ab4a1cd wip: add Phase C milestone 2 additive coverage
e3d6002 wip: implement Phase C milestone 2 core
675271b docs: resolve Phase C milestone 2 architecture
824e7e4 wip: checkpoint approved Phase C milestone 1
86f1a32 (tag: phase-b-complete, origin/main) feat: complete Phase B event pipeline
```

Node.js in this sandbox is **v22.22.2**; the repository's recorded runtime baseline is **Node.js v24.15.0** (`PROJECT_STATUS.md`). Per instruction, this is disclosed rather than blocking: this review performed **no executable verification** (no `pnpm install`, `lint`, `typecheck`, `test`, or `build` was run). All findings below come from **static reading of source, schema, contracts, and docs** at the pinned commit. Any command list in this document is a *recommended* verification command, not a result already produced in this session.

Milestone 2 closure artifacts are present and consistent with `CURRENT_TASK.md`:
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02-FINAL.md` — Milestone 2 `APPROVED_AND_COMPLETE`.
- `docs/orchestration/reviews/PHASE-C-MILESTONE-02-FINAL-CLOSURE-RECORD.md` — confirms **zero Milestone 3 code exists** in the tree (no transport delivery, no `/game` namespace, no final `actionId` allocation, no durable deferred queue, no SDK code).

Baseline requirements are satisfied. Verdict for this section: **not repository-blocked**.

---

## 2. Current guarantees inherited from Milestones 1 and 2

This is the most consequential fact this review surfaces: **Milestone 1 already built a materially complete durable action repository**, not just a persistence "prerequisite." Milestone 3's job is narrower than a from-scratch design — it is mainly (a) closing specific, real gaps, and (b) building the orchestration layer that calls the existing repository.

### Already present (apps/server/src/persistence/repository.ts, types.ts, schema.ts, authorization.ts)

- `DurableActionRepository` interface with `createBeforeFirstSend`, `authorizeRetry`, `revokeSendAuthorization`, `findById`, `findByIdempotencyKey`, `transition`, `recordAttempt`, `listAttempts`, `listNonterminal`, `reconcilePreviousRuntime`, `cleanup`, `close`.
- A 9-state status set: `pending → in_flight → received → completed | failed`, plus `expired`, `delivery_failed`, `delivery_unknown_restart`, `aborted_restart`, enforced through an explicit `LEGAL_TRANSITIONS` table and optimistic `version` compare-and-set on every write.
- `createBeforeFirstSend` takes a **caller-supplied `actionId` and `idempotencyKey`**, claims both uniquely inside `BEGIN IMMEDIATE`, and — critically — **already returns the original durable record instead of creating a duplicate** when either key repeats, distinguishing `already_authorized` vs `already_consumed`. This is essentially ADR-013's Option A already implemented at the repository layer.
- An opaque, `WeakMap`-backed, frozen `SendAuthorization` token (`authorization.ts`) that already binds `actionId`, `expectedVersion`, `attemptNumber`, `runtimeId`, `role: "game"`, `clientId`, `expiresAt`, and `runtimeOwnerId`, and is consumed exactly once (`consumed_at IS NULL AND revoked_at IS NULL` guard) inside the same transaction as the attempt/state write.
- Runtime-owner fencing: every mutating method calls `#requireActiveOwner`, and a superseding runtime causes stale owners to fail with `RUNTIME_SUPERSEDED` rather than mutate.
- `reconcilePreviousRuntime` already implements startup reconciliation: non-terminal actions owned by a stale runtime are reclassified to `expired` (if past `expiresAt`), `aborted_restart` (was `pending`, never sent), or `delivery_unknown_restart` (was `in_flight`/`received`), and any un-consumed authorization for that action is revoked in the same transaction.
- `cleanup(policy)` already does bounded, deterministic terminal-record retention (age cutoff + max-count overflow trim).
- Migration/schema: `action_logs`, `action_attempts`, `action_send_authorizations`, `runtime_ownership` tables exist with the needed unique indexes (`idempotency_key`, `(action_id, attempt_number)` on both attempts and authorizations).

### Deliberately NOT present yet (real Milestone 3 work)

- No caller allocates or generates an `actionId` anywhere in the tree — `createBeforeFirstSend` receives it as an opaque input. Nothing today turns a `MappingCandidate.idempotencySeed` into `CreateDurableAction.idempotencyKey`/`actionId`.
- No durable deferred-candidate/queue table exists (`schema.ts` has no such table). ADR-017 explicitly fences deferred-queue ownership to Milestone 3, unbuilt.
- No orchestration/service layer calls `mapping-engine` output into `persistence`. `apps/server/src/index.ts` wires only Fastify + auth routes + a health check; there is no Action Gateway service module.
- No retry **scheduler** (nothing computes `nextAttemptAt`/backoff or drives `authorizeRetry` on a timer) — the repository supports being *told* to retry, but nothing decides *when*.
- No TTL/expiry sweep exists as a runtime process (schema has `expiresAt`/`ttlMs` columns, and reconciliation classifies expiry at restart time, but there's no live expiry worker for actions that expire while the process is running and no one is sending).
- No `gameInstanceId` binds anywhere in `SendAuthorization`/`ActionAttempt` — only `role`/`clientId`. `GameActionEnvelopeSchema` in contracts *does* carry `gameInstanceId` (nullable), so the wire contract anticipates it, but the durable authorization model does not yet.
- No package/module boundary decision has been implemented (no `packages/action-gateway` exists).

### From Milestone 2 (ADR-013 through ADR-018, `packages/mapping-engine`)

- `MappingCandidate` carries `idempotencySeed` (format `m2:v1:<sha256 of canonical seed input>`, from `createCandidateSeed`/`canonical.ts`), `gameProfileId`, `gameId`, `ruleId`, `eventId`, `eventType`, `candidateOrdinal`, `actionType`, `params`, `actor`, `userBudgetKey`, `priority`, `actionPriority`, `ttlMs` — but **no `actionId`** (ADR-013: mapping never allocates it).
- `MappingResult` is a closed, typed union: `accepted`, `rejected` (with a typed reason), `dropped` (`GLOBAL_LIMIT`), `deferred` (`candidate`, absolute `expiresAt`, `reason: "GLOBAL_LIMIT"`). Only `queue_with_ttl` overflow policy produces `deferred`; Milestone 2 persists none of it (ADR-017).
- Budget admission (`DurableBudgetRepository.admit`) is already durable and atomic across sliding windows, cooldown, and the global token bucket (ADR-014–ADR-016), and is a **separate** durable-state concern from action lifecycle — Milestone 3 must not conflate the two.

---

## 3. Milestone 3 IN_SCOPE / OUT_OF_SCOPE matrix

| | Item |
|---|---|
| **IN_SCOPE** | Turning an `accepted` `MappingResult` into a final `actionId` + durable `CreateDurableAction` call |
| | Turning a `deferred` `MappingResult` into a durable deferred-candidate record (new capability) and its promotion path |
| | Deciding what happens to `rejected`/`dropped` results (default: nothing durable) |
| | Driving attempts against a transport-neutral `send(action) → outcome` port (fake in tests) |
| | Retry scheduling (backoff, max attempts, TTL interaction) on top of the existing `authorizeRetry`/`recordAttempt` primitives |
| | TTL/expiry as a live process concern, not just a restart-time reconciliation concern |
| | Ordering/fairness/backpressure across eligible actions before a transport exists to send them |
| | Extending runtime-ownership fencing to the new deferred/retry/expiry code paths |
| | Defining the transport-neutral port shape that Milestone 4's Socket.IO adapter will implement |
| **OUT_OF_SCOPE** | Socket.IO namespace, handshake, real game sessions (Milestone 4, `BE-07A`) |
| | JavaScript SDK (Milestone 4, `BE-08A`–`BE-08C`) |
| | Demo game / Zombie Survival (Milestone 5) |
| | Connector ingestion, Phase B dedup, mapping rule evaluation, budget admission logic (Milestone 2, frozen) |
| | Voice output (Phase D) |
| | Dashboard UI beyond nothing — no UI work of any kind |
| | Active-game switching (Phase E, `BE-10A`/`BE-10B`) |
| **REQUIRED_DEPENDENCIES** | `DurableActionRepository` (Milestone 1, present) |
| | `SendAuthorization` primitive (Milestone 1, present) |
| | Runtime-ownership fencing (Milestone 1, present) |
| | `MappingResult`/`MappingCandidate` boundary (Milestone 2, present, frozen) |
| | ADR-012, ADR-013, ADR-017 (present, frozen) |
| **DOWNSTREAM_DEPENDENCIES** | Milestone 4 needs a frozen transport-neutral send port and a frozen wire-adjacent `GameActionEnvelope` construction step from Milestone 3 |
| | Milestone 4 needs Milestone 3's `SendAuthorization` binding extended (or explicitly *not* extended) to carry `gameInstanceId` before Socket.IO delivery authorization can be implemented |
| | Milestone 5 needs Milestone 3's reconciliation/TTL/retry evidence as the recovery baseline for the end-to-end smoke |

---

## 4. End-to-end accepted flow

```
Normalized event (Phase B)
  → mapping-engine.evaluate() → MappingResult{status:"accepted", candidate}
  → [M3] derive (actionId, idempotencyKey) from candidate.idempotencySeed
  → [M3] repository.createBeforeFirstSend(CreateDurableAction)
        durable state before: none (or existing row if seed repeats)
        transaction boundary: single BEGIN IMMEDIATE (already atomic incl. authorization issuance)
        idempotency boundary: idempotency_key UNIQUE index (already enforced)
        ownership check: #requireActiveOwner (already enforced)
        externally observable result: DurableCreateResult{created, record, sendAuthorization | null}
  → [M3] build GameActionEnvelope from record (actionId, actionType, gameId, gameInstanceId, params, actor, trigger, priority, ttlMs, createdAt)
  → [M3] transport-neutral send(envelope, authorization) — port only; concrete impl is M4's Socket.IO adapter
  → repository.recordAttempt(authorization, binding, at, outcome)
        transaction: consumes authorization + inserts action_attempts + status→in_flight, all atomic (already enforced)
  → (transport layer, M4) acknowledgement or timeout
  → [M3] repository.transition({..., nextStatus:"received"}) on ACK
  → (M4/game) completion or failure reported
  → [M3] repository.transition({..., nextStatus:"completed"|"failed"})
  → terminal state; eligible for cleanup() retention
```

## 5. End-to-end deferred flow

```
mapping-engine.evaluate() → MappingResult{status:"deferred", candidate, expiresAt, reason:"GLOBAL_LIMIT"}
  → [M3, NEW] durable deferred-candidate insert (no such table exists yet)
        must capture: candidate.idempotencySeed, gameProfileId, gameId, ruleId, eventId,
        candidateOrdinal, actionType, params, actor, priority/actionPriority, ttlMs,
        createdAt, notBefore (if any), deferred expiresAt, owning runtime
  → [M3, NEW] promotion worker/check: when global budget has headroom AND now < expiresAt
        → atomically claim the deferred row (compare-and-set / delete-and-insert-action in one transaction)
        → repository.createBeforeFirstSend(...) using the SAME idempotencySeed-derived actionId
  → converges into the accepted flow above
  → if now >= expiresAt before promotion: mark deferred row expired, no action ever created
```

Rejected/dropped candidates (Section 3, Section 16 below) must **not** create a durable action or deferred row by default — ADR-017 gives Milestone 2 no queue and no send; nothing in Milestone 2's docs asks for a rejected/dropped audit trail beyond whatever Milestone 2 itself already logs, and inventing one here would be scope creep. If product wants an audit record for rejected/dropped, that is a new decision, not an inferred one (see Open Decision OD-4).

## 6. Crash and restart flow

Existing `reconcilePreviousRuntime` already handles the four "crash around create/send/receipt" cases listed in the review brief, for the accepted-flow portion:

| Crash point | Durable state before | Reconciled to | Mechanism (existing) |
|---|---|---|---|
| Before `createBeforeFirstSend` commits | none | no row exists; safe to re-evaluate | N/A — nothing durable happened |
| After action commit, before first `recordAttempt` | `pending`, authorization uncommitted-yet-issued in same txn | `aborted_restart` (if not expired) or `expired` | `reconcilePreviousRuntime` |
| After `recordAttempt` (send_started), before ACK | `in_flight` | `delivery_unknown_restart` (if not expired) or `expired` | `reconcilePreviousRuntime`; open authorization revoked |
| After ACK (`received`), before terminal | `received` | `delivery_unknown_restart` (if not expired) or `expired` | `reconcilePreviousRuntime` treats `received` as nonterminal too |
| During retry scheduling | `in_flight` (unauthorized attempt) | same as "after recordAttempt" row above | existing |
| Runtime superseded mid-operation | any | in-flight write fails with `RUNTIME_SUPERSEDED`, zero mutation | `#requireActiveOwner` inside every write transaction |

Two cases are **not** covered by existing code and are genuine Milestone 3 gaps:

- **Crash during deferred promotion** — no deferred table/worker exists yet, so there is nothing to reconcile. Milestone 3 must design promotion as a single atomic transaction (claim-and-create) specifically so a crash mid-promotion cannot leave a "claimed but no action" or "action created but deferred row still active" state.
- **Crash before deferred insertion** — same as accepted-flow's "before commit" case: nothing durable happened, safe to let Milestone 2's caller re-evaluate (mapping is deterministic and re-evaluation is idempotent per ADR-013's seed).

---

## 7. Final actionId / idempotency recommendation (Decision 1)

**Recommendation: Option A** — allocate the final `actionId` only via a durable unique claim, keyed by the Milestone 2 `idempotencySeed`, with one seed permanently mapping to one `actionId`.

This is not a green-field choice — it is confirming what `createBeforeFirstSend` was already built to do. Concretely:

- `idempotencyKey` passed to `createBeforeFirstSend` **is** `candidate.idempotencySeed` (or a thin versioned wrapper of it — see below). No separate derivation step is needed for the idempotency boundary; it already exists as a unique index.
- `actionId` should be **derived deterministically from the seed** for the *first* claim (Option B flavor layered onto Option A), e.g. `actionId = "act_" + sha256(idempotencySeed).slice(0, 26)` (or similar fixed-width encoding), computed by the Milestone 3 caller *before* calling `createBeforeFirstSend`, and passed in. Reasons:
  - Pure Option A (random `actionId` + seed-only uniqueness) works but forces every duplicate-caller path to look the record up by `idempotencyKey` first to discover the "real" `actionId` — extra round trips and extra places to get the precedence between `existingById` and `idempotent` wrong. `createBeforeFirstSend` already has to disambiguate `existingById` vs `idempotent` (line-level evidence: it checks `existing !== null` from either lookup and requires `#sameCreate` to hold) — a deterministic `actionId` collapses those into the same row by construction for the common case, and the existing dual-lookup remains as a defensive fallback for any future non-deterministic caller.
  - Rejected Option C (allocate id before claim, rely on conflict recovery) — `createBeforeFirstSend` already proves this isn't necessary: the atomic `BEGIN IMMEDIATE` claim-or-return design means there is no window where an ID is "spent" without a corresponding committed row. Option C would only be reinventing what already exists, with worse failure modes (an orphaned pre-allocated ID if the caller crashes between allocation and claim).
  - Pure Option B without a durable claim (derive-and-trust) is rejected: it would let two concurrent evaluations of the same candidate race to insert without the DB serializing them — the existing `BEGIN IMMEDIATE` + unique index is what actually gives replay safety, not the derivation formula alone.

- **Duplicate-call return behavior:** confirmed already correct — `createBeforeFirstSend` returns `created:false` with the **original** durable record and `sendAuthorization:null`, tagged `already_authorized` (an unconsumed authorization exists) or `already_consumed` (already sent at least once). Milestone 3's orchestration layer must treat `created:false` as "do not send again from here" and, for `already_authorized`, may resume the pending attempt via `authorizeRetry` rather than treating it as an error.
- **Can a seed ever produce a second action after expiry/cancellation/failure?** No — must remain no. The unique index is on `idempotency_key` with no expiry-based release. This is intentional: replaying the same mapping evaluation after an action already expired/failed must not silently create a second delivery; if the product ever wants "re-arm after failure," that is a new, explicit, reviewed decision (a distinct seed input, e.g. an explicit retry epoch), not an implicit unique-index bypass.
- **Deferred promotion** must use the *same* seed-derived `actionId`/`idempotencyKey` at promotion time as at deferred-insertion time, so a duplicate mapping evaluation that arrives between insertion and promotion converges on the same eventual action rather than creating a second deferred row or a second action.
- **Security/leakage:** a seed-derived `actionId` is a one-way hash of `gameProfileId + ruleId + eventId + ordinal + canonical action output` — it does not leak raw event content and is safe to expose in the public `GameActionEnvelope.actionId`. No migration impact: `actionId`/`idempotencyKey` columns already exist and are untyped strings.

**Required unique constraints:** already present (`action_logs_idempotency_key_unique` on `idempotency_key`, primary key on `action_id`). No schema change needed for this decision alone.

---

## 8. Durable storage recommendation (Decision 2)

**Recommendation: Option B** — a separate deferred-candidate table, distinct from `action_logs`, plus reuse of the existing action tables once promoted.

Rationale against the alternatives:

- **Option A (unified table)** would force `action_logs` — which has a carefully built `LEGAL_TRANSITIONS` state machine keyed on delivery states (`pending`/`in_flight`/`received`/...) — to also represent "not yet an action at all" states (`deferred`, `not_before`). That either grows `LEGAL_TRANSITIONS` with delivery-irrelevant states or requires nullable delivery columns for rows that were never sendable, both of which weaken the existing, already-reviewed invariants of `action_logs`.
- **Option C (extend the action record with scheduled/not-before states)** has the same problem: a deferred candidate does not have a final `actionId` allocated yet in the "wait for headroom" sense the plan implies (though per Decision 1 above, the id *can* be pre-computed deterministically — the objection is state-machine pollution, not id availability).
- **Option B** keeps `action_logs`'s existing, reviewed transition table untouched and gives the deferred queue its own bounded lifecycle (`queued → promoted | expired`), which is simpler to reason about, test, and bound independently (its own retention policy, its own capacity limit per ADR-018's "bounded durable mapping state" spirit).

**Minimum durable fields for the new deferred table** (naming illustrative, to be finalized during implementation):

| Field | Immutable? | Notes |
|---|---|---|
| `idempotencySeed` | yes | primary uniqueness boundary; unique index required |
| `gameProfileId`, `gameId`, `ruleId` | yes | from `MappingCandidate` |
| `eventId`, `candidateOrdinal` | yes | traceability, matches `GameActionTrigger` |
| `actionType`, `paramsJson` | yes | canonical resolved output |
| `actor` | yes | nullable |
| `priority`, `actionPriority` | yes | for ordering (Section 12) |
| `candidateTtlMs` | yes | from candidate |
| `deferredExpiresAt` | yes | absolute, from `MappingResult.deferred.expiresAt` |
| `createdAt` | yes | insertion time |
| `notBefore` | yes (or omitted for MVP) | Milestone 2's `queue_with_ttl` does not currently emit a not-before; only include if a future overflow policy needs it — do not invent one now |
| `owningRuntime` | mutable (fencing) | for the same `RUNTIME_SUPERSEDED` fencing pattern used elsewhere |
| `status` | mutable | `queued` \| `promoted` \| `expired` |
| `failureReason` | mutable | nullable |

**Persist-before-send** is unaffected: deferred rows are pre-action and never sent; only after promotion does `createBeforeFirstSend` run, which already guarantees persist-before-send.

**Promotion atomicity:** promotion must be one transaction that (a) verifies the deferred row is still `queued` and unexpired, (b) calls the equivalent of `createBeforeFirstSend` with the seed-derived id, and (c) marks the deferred row `promoted` — all inside one `BEGIN IMMEDIATE`, guarded by the same `#requireActiveOwner` fencing already used elsewhere, so a crash mid-promotion cannot double-create or silently drop.

**Retry separation:** deferred-promotion retry (of the *insertion decision*) is a distinct concern from action-delivery retry (already handled by `authorizeRetry`/`recordAttempt`) — do not reuse `retryCount` for both.

---

## 9. Lifecycle state-machine recommendation (Decision 3)

**Recommendation: keep the existing state machine as-is; do not invent new states.**

The existing `LEGAL_TRANSITIONS` in `apps/server/src/persistence/repository.ts` already implements almost exactly what the plan's "In scope" list asks for (`CREATED → SENT → RECEIVED → COMPLETED/FAILED plus EXPIRED, DELIVERY_FAILED, delivery-unknown/restart outcomes`), using these names:

| Existing name | Plan's conceptual name | Terminal? | Owning component |
|---|---|---|---|
| `pending` | CREATED (durably persisted, not yet sent) | no | repository (write), M3 orchestration (read/act) |
| `in_flight` | SENT / retry-wait (reused, no separate state) | no | repository + transport port |
| `received` | RECEIVED | no (gameplay completion still pending) | repository, driven by transport ACK |
| `completed` | COMPLETED | yes | repository, driven by game result |
| `failed` | FAILED | yes | repository, driven by game result |
| `expired` | EXPIRED | yes | repository (TTL/reconciliation) |
| `delivery_failed` | DELIVERY_FAILED | yes | repository (via `transition`, driven by M3 retry-exhaustion decision) |
| `delivery_unknown_restart` | delivery-unknown/restart outcome | no (per `LEGAL_TRANSITIONS`, it can still reach `completed`/`failed`/`expired`) | repository (reconciliation) |
| `aborted_restart` | restart outcome for never-sent actions | yes | repository (reconciliation) |

Notably there is **no separate `retry-wait` state** — a retry re-authorizes and re-attempts directly from `pending`/`in_flight`, which matches "same-action-ID retries" in the plan and avoids inventing a state whose only job would be "waiting for a timer," something the *scheduler* (new in M3) can represent in memory/queue ordering rather than as a durable status. This is the right call: fewer durable states, one more thing the (new) scheduler owns.

**Mismatch found:** the plan text lists `DELIVERY_FAILED` as a target state, and it exists in `ACTION_STATUSES`/schema, but nothing in the current `LEGAL_TRANSITIONS` table shows a transition *into* `delivery_failed` — only `expired`, `delivery_unknown_restart`, `received` are reachable from `in_flight`. Milestone 3 must add (or confirm) the transition `in_flight → delivery_failed` for the "retries exhausted, TTL not yet expired, permanently give up" case, since today only expiry can terminate a stuck `in_flight` action. This is a genuine open implementation item, not a design decision — flagged in Section 24.

No `cancelled` or `superseded` state is recommended for Milestone 3: nothing in scope calls for user-initiated cancellation, and "superseded" is already expressed structurally via `runtimeId`/`RUNTIME_SUPERSEDED`, not as an action status.

---

## 10. SendAuthorization recommendation (Decision 4)

The existing `SendAuthorization` mechanism (Section 2) already satisfies the required invariant for the pieces it covers:

> No production transport send may occur without (1) a durable action record, (2) a durable delivery-attempt record, (3) a valid authorization bound to that exact action attempt, (4) active runtime ownership.

Evidence: `recordAttempt` checks `readSendAuthorization` (WeakMap-bound, frozen-object identity check), re-validates `runtimeId`, `expectedVersion`, `expiresAt`, and status, consumes the authorization row with a `consumed_at IS NULL AND revoked_at IS NULL` guard, inserts the attempt row, and updates `action_logs` — all inside one `BEGIN IMMEDIATE` behind `#requireActiveOwner`. That is invariant (1)–(4) in one transaction already.

**Gap requiring a Milestone 3 decision:** the authorization currently binds `role: "game"` and `clientId`, but **not `gameInstanceId` or a game session identifier**. `GameActionEnvelopeSchema.gameInstanceId` exists in the wire contract, so the intent to scope delivery per game instance is already present at the contract layer, but the durable authorization does not yet enforce it.

**Recommendation:** extend `AuthorizationDetails`/`recordAttempt`'s binding parameter to include `gameInstanceId` (nullable, matching the envelope) now, even though nothing can populate/verify it against a real session until Milestone 4 wires Socket.IO. Reasoning: this is a narrow, additive, low-risk schema/interface change confined to Milestone 3's own package boundary (repository interface + one new nullable column), and doing it now avoids a second, disruptive interface change to an already-reviewed frozen contract during Milestone 4 when session concerns are being layered in under time pressure. If deferred, Milestone 4 must re-open `SendAuthorization`'s shape, which the plan's ownership table treats as a "lifecycle/data-integrity finding" requiring CODEX — better to absorb it in Milestone 3 while the interface is already open.

**Retry re-authorization:** already correct — `authorizeRetry` issues a *new* authorization row per attempt number (`action_send_authorizations_action_attempt_unique` on `(actionId, attemptNumber)`), so a retry always requires a new authorization; the old one is never reused.

**Authorization issued but no send occurs:** currently unaddressed by a timer — an authorization has `expiresAt` but nothing proactively revokes it if the transport never attempts a send. Milestone 3 should ensure its (new) retry/expiry scheduler treats "authorized but not yet attempted past its expiry" as eligible for `revokeSendAuthorization` + either `authorizeRetry` (if TTL remains) or a terminal transition (if not) — this doesn't require new persistence primitives, just an orchestration policy on top of what exists.

**Send occurs but consumption-persistence fails:** cannot occur as a partial state given the current transaction shape — consumption and attempt-insert are the same transaction, so this is already closed at the persistence layer; the transport port itself must be designed so a network send is only attempted with the authorization already durably consumed (send-after-persist ordering is an orchestration discipline, not a new mechanism).

**Authorizations after restart:** `reconcilePreviousRuntime` already revokes any authorization for a reconciled action that isn't `consumed_at`-set. Confirmed correct.

---

## 11. Socket.IO boundary recommendation (Decision 5) — forward-looking guidance for Milestone 4, not Milestone 3 scope

Per Section 0, this is guidance Milestone 3 should design *toward* without implementing.

- **Namespace:** `/game`, matching the plan and existing `GameRegisterMessageSchema`/`GameActionDeliveryMessageSchema` naming already in `packages/contracts`.
- **Authentication source:** existing auth-core `ClientRole = "game"` sessions (`packages/auth-core/src/index.ts`); handshake-time token, never query string — consistent with ADR history and Milestone 1's `QUERY_TOKEN_FORBIDDEN` enforcement pattern already used for HTTP auth routes.
- **Session binding:** `clientId` (already in `RoleSession`), plus the `gameId`/`instanceId` pair already defined in `GameRegisterMessageSchema` — this is exactly the `gameInstanceId` gap identified in Section 10.
- **One active connection vs multiple:** the plan's Milestone 4 acceptance criteria say "duplicate instance" must be rejected and mentions "one active session policy as specified" — Milestone 3 should not pre-decide this; it should just make sure `SendAuthorization`/`recordAttempt` binding is *general enough* (role + clientId + optional gameInstanceId) to support whatever single-vs-multi policy Milestone 4 picks, without needing another interface change.
- **Trusted vs client-supplied identifiers:** `actionId`, `trigger`, `priority`, `ttlMs`, `createdAt` in `GameActionEnvelope` are server-authoritative (constructed by Milestone 3 from the durable record); only the client's `game.action.received`/`game.action.result` messages carry client-supplied `actionId`/`status`/`details`, which must be checked against a durable record that already exists in `in_flight`/`received` state — a spoofed or unknown `actionId` must fail closed. This is already implied by `transition`'s `expectedStatuses`/`expectedVersion` guard.

No wire event, dependency, or namespace should be added to the codebase in Milestone 3. The concrete Socket.IO decision belongs in a Milestone 4 ADR, informed by this section.

---

## 12. Acknowledgement recommendation (Decision 6) — likewise forward-looking, but the contract already answers most of it

Unusually, this decision is **already made** at the contracts layer and should simply be ratified, not re-litigated:

- `game.action.received` (`GameActionReceivedMessageSchema`: `actionId`, `receivedAt`) is explicitly documented in `lifecycle.ts` as *"Sent by Game SDK immediately after validating and enqueuing an action locally... Delivery receipt ACK is strictly separated from gameplay completion."* — this is **Option A** (client received/locally-enqueued), not Option B or C.
- `game.action.result` (`GameActionResultMessageSchema`, discriminated on `status: "completed" | "failed"`) is the separate, later completion signal.

So the "minimum semantics" question is already resolved by frozen contracts: **two stages** — transport-level receipt (`received`, stops retry) and gameplay-level result (`completed`/`failed`, does not affect retry). Milestone 3's job is to make its state machine's `received`/`completed`/`failed` transitions match this contract precisely (already does — see `LEGAL_TRANSITIONS`), and to define, for itself (transport-neutral), how a fake/test transport signals these two stages so Milestone 4 only has to translate real Socket.IO messages onto the same seam.

**Duplicate/late/stale handling** (still a real M3 decision since it's server-side, not just a wire-format question):
- Duplicate `received` after already `received`/terminal: idempotent no-op (transition's expected-status guard naturally rejects it without erroring the caller if orchestration checks status first).
- Late `received` after the action already reconciled to `delivery_unknown_restart`/`expired`: must be rejected — `LEGAL_TRANSITIONS` shows no path back from `expired`, and `delivery_unknown_restart → received` is explicitly still legal per the existing table (delivery-unknown genuinely means "we don't know," so a late receipt should still be honored if not yet expired) — this is correct as designed.
- `received` from a stale/superseded runtime: already impossible — write path requires the current owner.

---

## 13. Retry recommendation (Decision 7)

Retry **mechanics** (issuing a new authorization, recording an attempt, TTL guard) already exist via `authorizeRetry`/`recordAttempt`. Retry **policy** (when/how many/backoff) is genuinely new Milestone 3 work — nothing today decides this.

Proposed **implementation defaults** (explicitly labeled as proposals requiring product-owner acceptance, per the instruction not to invent unlabeled numeric defaults):

- Maximum attempts: **2 retries** (3 total attempts) — this number is *not* invented here; it is lifted directly from the plan's own text: *"Attempt recording, same-action-ID retries, default receipt timeout, maximum two retries, TTL, and completion diagnostics."* Treat as already-decided, not proposed.
- Backoff: proposed exponential, e.g. `attempt 2 at +2s, attempt 3 at +6s`, deterministic (no jitter) for MVP — **proposed, not frozen**. Deterministic no-jitter is recommended specifically because it keeps retry-scheduling tests reproducible without injected randomness, consistent with this codebase's existing pattern of injected clocks/random sources everywhere else.
- Receipt timeout: plan says "default receipt timeout" without a number — **proposed** 5s as a starting default, tunable, tested with a fake clock.

**Eligibility for retry** (mapped against existing terminal/nonterminal semantics):

| Failure | Retryable? | Mechanism |
|---|---|---|
| No connected game session | yes, bounded by max attempts | transport port returns a typed "no session" outcome; scheduler backs off |
| SendAuthorization failure (stale/expired) | yes, via fresh `authorizeRetry` | already supported |
| Transport send exception | yes | `recordAttempt(..., outcome:"send_failed")` already models this |
| Acknowledgement timeout | yes | scheduler-driven, no receipt within receipt-timeout window |
| Disconnect before ACK | yes | same as timeout, from the transport port's perspective |
| Malformed ACK | no — reject the message, do not transition, but do NOT count it as a delivery failure either; wait for a valid ACK or timeout | orchestration-level input validation |
| Explicit game rejection (`game.action.result` failed at transport level — not gameplay `failed`) | no explicit contract for this today; treat as a "received" already happened, so it's a gameplay `failed`, not a retryable delivery failure | matches "retry stops after receipt" plan rule |
| Persistence failure | no — fail closed, surface a distinguishable error, do not silently retry against unknown durable state | matches ADR-012 |
| Stale runtime | no — `RUNTIME_SUPERSEDED` is not retryable by the superseded runtime; the new runtime's reconciliation takes over | already enforced |
| Action TTL expiry | no — expiry always wins over retry eligibility | must be checked before every retry attempt |

- **Same actionId is reused** across attempts — confirmed by design (`action_attempts` keyed by `(action_id, attempt_number)`).
- **Every attempt gets a unique attempt identifier** — yes, `attempt_number` monotonically increasing per action, already enforced by the unique index.
- **Attempts are append-only** — yes, `INSERT` only, never updated/deleted except by `cleanup()`'s bulk terminal-record retention.
- **Retry survives restart** — partially: the *durable record* survives, but "retry survives restart" in the live-scheduling sense (a pending backoff timer) does not, because no scheduler exists yet; on restart, `delivery_unknown_restart`/`aborted_restart` actions must be picked up by a startup sweep that re-evaluates eligibility (TTL, attempt count) and either resumes retrying or terminalizes — this sweep is new Milestone 3 work, not present today.
- **TTL expiring during backoff:** TTL always wins; the scheduler must check `now >= expiresAt` before issuing a new `authorizeRetry` and transition to `expired` instead if so.
- **Priority and retry ordering:** proposed — priority affects *initial* delivery ordering (Section 14) but should not let a low-priority action's retry starve behind new high-priority first-sends indefinitely; a reasonable rule is "retries get priority equal to or slightly above their original priority" — **proposed, not frozen**.

---

## 14. TTL/expiry recommendation (Decision 8)

Distinguishing the five TTL-like quantities is important because two already exist in the schema/contracts and three are policy questions:

| Quantity | Exists today? | Source |
|---|---|---|
| Mapping candidate `ttlMs` | yes | `MappingCandidate.ttlMs` |
| Deferred result `expiresAt` | yes (value), no (storage) | `MappingResult.deferred.expiresAt`, computed but not persisted anywhere (ADR-017 gap, Section 8) |
| Action `expiresAt` | yes | `CreateDurableAction.expiresAt` / `action_logs.expires_at` |
| Send-authorization `expiresAt` | yes | `AuthorizationDetails.expiresAt` |
| Acknowledgement timeout | no | new, orchestration-level (Section 13) |
| Retry backoff | no | new, orchestration-level (Section 13) |

**Authoritative clock source:** the injected trusted processing clock already used throughout Milestone 1/2 (never event time, never client time) — must be threaded into whatever new scheduler Milestone 3 introduces, consistent with ADR-015's "all time comes from an injected trusted processing clock" rule, which this review treats as a cross-cutting project convention, not just a mapping-engine-local rule.

**When action expiry is calculated:** recommend `expiresAt = createdAt + candidate.ttlMs`, computed once at durable-creation time (already how `CreateDurableAction.expiresAt` is shaped) — not recomputed at send time, so TTL is stable regardless of retry count.

**Deferred promotion with little TTL remaining:** if `candidate.ttlMs` computed from the *original* event time would leave little/no time after a long deferral, the deferred row's own `deferredExpiresAt` (a separate, typically shorter budget-overflow window) should already have expired the candidate before this becomes relevant in practice; if promotion happens right at the edge, recommend the action still gets the full `candidate.ttlMs` from promotion time — deferral time is "waiting to become an action," not "action aging," so it shouldn't eat into delivery TTL. **Proposed**, not frozen.

**Expiry during active send / after ACK:** already correctly modeled — `LEGAL_TRANSITIONS` allows `in_flight → expired` and `received → expired`, so a race between "ACK just arrived" and "expiry sweep just fired" is resolved by the existing optimistic-version compare-and-set: whichever transition wins the `UPDATE ... WHERE version = ?` race wins cleanly, the other fails with `STALE_TRANSITION` and must be treated as a no-op by the caller (already how the interface reports it).

**Expired actions replayed?** No — same reasoning as Section 7: once `expired`, no path back per `LEGAL_TRANSITIONS`.

**Duplicate candidate evaluation after expiry:** per Section 7, returns the original (now-expired) record via the idempotency-key claim path; it must **not** create a new action. This is an explicit, important consequence of Option A that should be called out as an accepted trade-off in the ADR (see Section 20).

---

## 15. Ordering/fairness/backpressure recommendation (Decision 9)

No durable field or index exists yet to support fair ordering across eligible actions (nothing indexes `action_logs` by `priority`/`created_at` for a "next eligible action" query). This is new, bounded Milestone 3 work.

- **Ordering key (proposed):** `priority DESC, createdAt ASC, actionId ASC` — deliberately mirrors Milestone 2's own deterministic tie-break convention (`priority DESC, specificity DESC, createdAt ASC, ruleId ASC` from `PHASE-C-MILESTONE-PLAN.md`), for consistency across the codebase rather than inventing a new convention.
- **Serial per game instance:** recommend yes for MVP — one in-flight action per `gameId` (or `gameInstanceId` once that concept is wired, Section 10) at a time, since nothing in scope requires true parallel delivery and serial delivery is far simpler to reason about for retry/TTL interaction. **Proposed.**
- **Max in-flight per session:** 1, for the same reason. **Proposed.**
- **Starvation prevention:** since Milestone 3 is expected to be serial-per-game and bounded by `max two retries` before terminalizing, a stuck low-priority action cannot block high-priority ones indefinitely by construction, provided the "next eligible action" query always re-evaluates from durable state rather than holding an in-memory ordered queue that could go stale.
- **No connected game client:** action stays `pending`/`in_flight` (per whatever the actual send outcome was) until a client reconnects or TTL expires — no special status needed beyond what exists.
- **Maximum durable queue size / capacity exhaustion:** the *action* table has no separate bound in scope (each action already has its own TTL-bounded lifetime and Milestone 2's global token bucket already caps upstream admission — ADR-016/ADR-018). The **new deferred table** (Section 8) does need an explicit bound, analogous to ADR-018's "bounded durable mapping state": recommend a capacity check at insertion time that fails closed (typed rejection) rather than growing unboundedly, consistent with ADR-018's precedent. Exact numeric limit: **proposed**, to be selected during implementation per ADR-018's own convention ("exact defaults are selected during implementation, documented with rationale... illustrative review numbers are not architectural defaults").

---

## 16. Runtime-ownership/recovery recommendation (Decision 10)

The existing fencing model (single active durable runtime-owner generation, `#requireActiveOwner` inside every mutating transaction) should extend to every new Milestone 3 code path without modification to its mechanism — only its call sites grow:

- Deferred insertion, promotion, and cleanup: same `#requireActiveOwner(true)` pattern as `createBeforeFirstSend`/`cleanup`.
- Retry scheduling: the *decision* to retry (in-memory scheduler tick) can run without ownership (it's read-mostly), but the *act* of calling `authorizeRetry` must go through the existing fenced path (already true — no change needed).
- Startup reconciliation for deferred candidates: new — on startup, any deferred row owned by a stale runtime must be reassigned to the current runtime (not reconciled to a terminal state the way actions are, since a deferred candidate hasn't "done" anything observable yet) or, if past `deferredExpiresAt`, marked `expired`. This mirrors `reconcilePreviousRuntime`'s action-side logic but is new code for the new table.
- **Worker leases:** not needed for the MVP — the existing single-active-process-owner model (`runtime_ownership` singleton row) already provides everything Milestone 3 needs; introducing per-worker leases would be scope growth beyond "the existing single active process owner is sufficient," which the plan's own Milestone 1 acceptance criteria already validated end-to-end.
- **Stale-runtime attempts produce zero durable mutation:** already guaranteed by the existing fencing (`RUNTIME_SUPERSEDED` thrown before any write executes), and this guarantee must be preserved, not re-derived, in every new code path.

---

## 17. Transaction/concurrency recommendation (Decision 11)

The existing pattern — `BEGIN IMMEDIATE`, `#requireActiveOwner` first, optimistic `version`/status compare-and-set on the `UPDATE`, explicit `ROLLBACK` on any thrown error — should be reused verbatim for every new table and operation. Concretely:

- **Duplicate candidate creation from two connections:** already solved by the `idempotency_key` unique index inside `BEGIN IMMEDIATE`; the loser gets a unique-constraint failure inside the transaction, which the existing catch block maps to a typed `PersistenceError`. Apply the identical pattern to the new deferred table's `idempotencySeed` unique index.
- **Two workers selecting the same eligible action:** with the single-active-runtime-owner model, there should never be two live workers — this race is structurally prevented rather than resolved via locking, which is simpler and consistent with the existing architecture. If a future milestone introduces multiple workers, this assumption must be revisited (flagged as a downstream dependency, not a Milestone 3 concern).
- **Retry worker racing with late acknowledgement:** resolved by `version`-guarded `UPDATE ... WHERE version = ?` — whichever commits first wins, the other gets `STALE_TRANSITION` and must no-op rather than error the caller.
- **Expiry worker racing with send:** same version-guard mechanism; already proven by the fact `LEGAL_TRANSITIONS` treats `in_flight → expired` and `in_flight → received`/`delivery_unknown_restart` as mutually exclusive via the same compare-and-set.
- **Deferred promotion racing with duplicate mapping evaluation:** must be resolved the same way — the promotion transaction and a "new duplicate accepted candidate arriving directly" both attempting `createBeforeFirstSend`/deferred-insert for the same seed must serialize on the same unique index, with the loser converging onto the winner's record.
- **SQLITE_BUSY:** not explicitly handled with retry-with-backoff anywhere visible in `repository.ts` today (worth confirming during implementation, not assumed) — `BEGIN IMMEDIATE` will surface `SQLITE_BUSY` as a thrown error under real contention; the existing catch-all maps unknown errors to `PersistenceError("DATABASE_UNAVAILABLE", ...)`, which is a safe fail-closed default but means transient contention currently surfaces as a hard error rather than a caller-visible retry hint. Recommend Milestone 3's orchestration layer (not the repository) retries `DATABASE_UNAVAILABLE` a small bounded number of times before giving up, rather than changing the repository's transaction semantics.
- **Sync vs async at the service boundary:** the repository is synchronous (`better-sqlite3`-style, given the API shape) — Milestone 3's orchestration layer should keep the repository calls synchronous and put any async behavior (timers, transport `await`) strictly outside/after the durable write, so "await never sits between durable commit and the next durable read" — this preserves the persist-before-send ordering guarantee end-to-end.

---

## 18. Package/API-boundary recommendation (Decision 12)

Proposed layout (**not created** in this review):

```
apps/server/src/
  gateway/                         # NEW — Milestone 3 orchestration, apps/server-local
    createAction.ts                 # accepted MappingResult -> CreateDurableAction -> repository call
    deferred.ts                     # deferred insert/promote (calls persistence + repository)
    scheduler.ts                    # retry backoff + TTL sweep, driven by injected clock, pure decision logic
    transportPort.ts                # the transport-neutral send() interface Milestone 4 implements
  persistence/                      # EXISTING, extended only with: deferred table, gameInstanceId on authorization
```

- **Candidate ingestion:** stays `packages/mapping-engine` (unchanged, frozen).
- **Action Gateway domain service:** recommend `apps/server/src/gateway/` rather than a new top-level `packages/action-gateway` package. Reasoning: the plan itself lists Milestone 3's likely packages as `apps/server` (composition), `packages/mapping-engine` (frozen candidates), `packages/contracts` — it does not list a new package, and the existing precedent (Milestone 1's auth/persistence composition also lives in `apps/server`) favors keeping orchestration local until there's a second consumer that needs it as an installable package. Promote to a package only if Milestone 4/5 turn out to need it importable outside `apps/server` — not decided here.
- **Durable repository port:** stays `apps/server/src/persistence/` (extended, not replaced).
- **SQLite adapter:** same location; already the concrete implementation behind `DurableActionRepository`.
- **Game transport port:** define the interface in `apps/server/src/gateway/transportPort.ts` now (Milestone 3), leave it unimplemented (no Socket.IO adapter) until Milestone 4.
- **Socket.IO adapter:** explicitly **not** created in Milestone 3 (Section 0/11).
- **Retry scheduler:** `apps/server/src/gateway/scheduler.ts`, pure/testable, injected clock, no direct DB access beyond calling repository methods.
- **Trusted clock, auth/session resolver:** reuse existing injected-clock convention and `@crowdcircuit/auth-core`; no new abstraction needed.
- **Game SDK contracts:** `packages/contracts` (existing, frozen `actions/lifecycle.ts`/`actions/envelope.ts`) — Milestone 3 should not need to change these; if it discovers a genuine contract gap (e.g., `gameInstanceId` binding on authorization is a *server-internal* type, not a wire type, so no contract change is needed for Section 10's recommendation).

**Dependency direction check:** the proposed `apps/server/src/gateway/` module depends on `packages/mapping-engine` (candidate/result types), `packages/contracts` (envelope construction), and `apps/server/src/persistence/` (repository) — all already-legal directions. It introduces no new dependency from any domain package into `apps/server`, Socket.IO, SQLite, or connector-specific types, preserving the acyclic rule already stated in the plan.

---

## 19. Failure matrix

| Failure point | Durable state before | Possible external effect | Durable state after restart | Automatic recovery | Duplicate-send risk | Data-loss risk | Terminal outcome |
|---|---|---|---|---|---|---|---|
| DB unavailable before action creation | none | none | none (nothing written) | caller re-evaluates (mapping is deterministic) | none | none | caller retries create |
| DB failure during action-create transaction | none or prior row only | none (no send yet) | rolled back to none | caller re-evaluates | none | none | create fails, caller retries |
| Crash after action commit, before first attempt | `pending` | none | `aborted_restart` or `expired` | `reconcilePreviousRuntime` | none — never sent | none | terminal, no gameplay lost (never happened) |
| Crash after attempt commit, before transport send returns | `in_flight` | unknown — send may or may not have reached client | `delivery_unknown_restart` or `expired` | `reconcilePreviousRuntime` | possible — client may have received it once already; a resumed retry could double-deliver at the transport level | none at persistence layer | requires client-side idempotency (SDK dedup, Milestone 4) to fully close |
| Crash immediately after send (pre-ACK) | `in_flight` | client may have the action | same as above | same as above | same as above | none | same as above |
| ACK timeout | `in_flight` | client may or may not have received it | n/a (no restart) | scheduler retries or terminalizes per TTL/attempt policy | possible, mitigated by client dedup | none | `delivery_failed` (once implemented, Section 9) or `expired` |
| Late ACK (after retry already issued) | `in_flight`, new authorization already issued | client's earlier receipt now arrives | n/a | version-guarded transition — whichever write wins | none at persistence layer (guarded) | none | `received` (first valid one wins) |
| Duplicate ACK | `received` or later | none | n/a | transition rejected (no legal path from terminal, or idempotent no-op from `received`) | none | none | unchanged |
| Disconnect before ACK | `in_flight` | none new | n/a | same as ACK timeout | same as ACK timeout | none | same |
| No connected game | `pending`/`in_flight` | none | n/a | scheduler waits/backs off | none | none | eventually `expired` if TTL elapses |
| Malformed game response | `in_flight`/`received` | none | n/a | rejected at validation, no transition | none | none | unchanged, awaiting valid input |
| Runtime superseded | any | none | new runtime's `reconcilePreviousRuntime` handles it | automatic on new-runtime startup | none (fencing prevents stale writes) | none | per reconciliation table above |
| TTL expiry (action) | any nonterminal | none new | `expired` | automatic (sweep or reconciliation) | none | none — diagnostic record retained | `expired` |
| Deferred expiry | `queued` (new table) | none — was never sent | `expired` (new table) | new sweep, mirrors action reconciliation | none | the candidate is dropped, by design (ADR-017 overflow policy) | no durable action ever created |
| Queue capacity exhaustion (deferred table) | n/a | none | n/a | fail-closed typed rejection at insertion | none | the deferred candidate is not queued — same "drop" outcome as a rejected candidate | caller/mapping layer must treat as a rejection |
| Migration failure | pre-migration schema | none | rolled back, no partial version advance | manual/operator intervention (existing Milestone 1 guarantee) | none | none | server does not start against a partially migrated DB |

---

## 20. Security findings and invariants

- **Session fixation / token replay:** out of Milestone 3's direct surface (owned by `auth-core`/Milestone 1, extended by Milestone 4), but Milestone 3's `SendAuthorization` extension (Section 10, adding `gameInstanceId`) must not weaken the existing single-use, frozen-object-identity, WeakMap-backed authorization design — any extension should add fields to `AuthorizationDetails`, not change how the token itself is validated.
- **Token in query string:** not applicable to Milestone 3 (no transport yet), but the existing HTTP-layer precedent (`QUERY_TOKEN_FORBIDDEN`) should be the explicit model cited in the forward-looking Socket.IO guidance (Section 11) rather than re-derived from scratch in Milestone 4.
- **Cross-game action delivery / spoofed `gameInstanceId`:** cannot be fully closed until Milestone 4 exists, but Milestone 3 should ensure the durable authorization *can* carry and later verify `gameInstanceId` (Section 10) — the gap today is architectural readiness, not an active vulnerability, since nothing sends yet.
- **ACK spoofing / stale-socket ACK:** mitigated by requiring every `transition` call to know the exact `actionId` + current `expectedVersion`/`expectedStatuses` — a spoofed ACK for an unrelated or already-terminal action fails closed via `ILLEGAL_TRANSITION`/`STALE_TRANSITION`. This already holds; extending it to check `gameInstanceId` binding (once added) closes the remaining cross-instance spoofing gap.
- **Authorization reuse:** already prevented (`consumed_at`/`revoked_at` guards, one-time WeakMap-backed token).
- **Action data tampering:** `params` is validated JSON-safe at multiple layers (mapping-engine output, `JsonValueSchema` in `transition`'s `resultDetails` check) — Milestone 3 should apply the same `JsonValueSchema.safeParse` discipline to any new deferred-table JSON columns, not assume it's inherited for free.
- **Untrusted JSON payload size:** no explicit size cap is visible in the reviewed code for `params_json`/`result_json` — worth an explicit bound in Milestone 3's new insertion paths (deferred candidate params) even though this may already be an accepted, if unstated, gap inherited from Milestone 1/2; flagged as an open item (Section 24) rather than assumed resolved.
- **DoS via ACK omission / reconnect storms / queue exhaustion:** addressed structurally by (a) bounded retry/TTL (an action that's never ACKed eventually expires and stops consuming retry cycles) and (b) the new deferred table's proposed capacity bound (Section 15) failing closed rather than growing unboundedly. Reconnect-storm handling proper belongs to Milestone 4 (Socket.IO layer), but Milestone 3 must make sure its scheduler doesn't assume a connected client and doesn't busy-loop retrying against a permanently absent one — TTL is the real backstop here.
- **Log leakage of secrets/authorization tokens:** the existing Fastify logger already redacts `authorization`/`cookie`/`pairingCode`/`token` fields (`apps/server/src/index.ts`); Milestone 3 must ensure any new logging around action creation/attempts never logs the opaque `SendAuthorization` object itself (it's a frozen branded object, not a string, so accidental string-interpolation logging is a real and easy mistake to make — call this out explicitly as a test requirement, Section 21).

**Security invariants requiring permanent negative tests:** (1) an authorization for action A can never be consumed against action B; (2) a superseded runtime can never produce a durable mutation; (3) a duplicate/replayed idempotency seed can never produce two `actionId`s; (4) an expired action can never transition to `received`/`completed`; (5) once `gameInstanceId` binding exists, a client authenticated for instance X can never consume an authorization scoped to instance Y.

---

## 21. Mandatory acceptance-test plan

### A. Domain and state machine (mandatory)
- Every transition in the updated `LEGAL_TRANSITIONS` (including the `in_flight → delivery_failed` addition from Section 9), and every disallowed transition, as explicit positive/negative pairs.
- Duplicate `idempotencySeed`/`idempotencyKey` returns the original record, never a second row (`created:false`, correct `already_authorized`/`already_consumed` reason).
- Replay after terminal state (`expired`/`completed`/`failed`/`aborted_restart`/`delivery_failed`) never re-enters a nonterminal state.
- TTL expiry pre-empts a concurrent late transition (version-guard race, both orderings tested).
- Retry: max-attempts boundary (exactly 2 retries succeeds in triggering `delivery_failed`/terminal on the 3rd failure, not before).

### B. Real SQLite (mandatory)
- Multi-connection duplicate candidate claim (mirrors the existing `budget-concurrency.test.ts` pattern already used for Milestone 2 — same worker-thread technique should be reused for action creation and deferred-promotion races).
- Exactly-once action creation under concurrent duplicate `createBeforeFirstSend`.
- Attempt contention (`authorizeRetry` racing `recordAttempt`).
- Late ACK vs. retry race (both orderings, both must converge to a single consistent terminal/nonterminal state).
- Expiry vs. send race.
- Stale-runtime fencing: every new mutating method must have a test proving a superseded runtime produces zero rows changed.
- Restart reconciliation: extend the existing reconciliation tests to cover the new deferred table.
- Migration from current schema (v2) to whatever new schema version introduces the deferred table — must reuse the existing `migration-upgrade.test.ts` byte-for-byte-preservation pattern.

### C. Socket.IO (NOT Milestone 3 — explicitly deferred to Milestone 4, listed here only for traceability per the review template)
- All of: valid session, invalid role, query-token rejection, wrong game/profile binding, reconnect, duplicate ACK, stale ACK, ACK timeout, disconnect — belongs in Milestone 4's acceptance plan, not Milestone 3's.

### D. Declaration consumers (mandatory)
- No final `actionId`/`idempotencyKey` can be fabricated by an untrusted consumer of the new gateway module's public exports.
- New `apps/server` exports (if any new public gateway API is exported from `apps/server/src/index.ts`) pass the existing package-name declaration consumer pattern.
- Invalid lifecycle-transition arguments rejected by types, not just runtime — mirror the existing `ActionTransition` shape's discipline.
- JSON-safety of any new persisted columns (deferred table).

### E. End-to-end (mandatory, using the existing deterministic transport fake pattern already implied by the plan)
- mapping `accepted` → durable action → fake-transport "send" → fake "ACK" → fake "complete".
- mapping `deferred` → durable deferred row → promotion → durable action → fake delivery.
- Crash/restart injected at every boundary in the Section 19 failure matrix, using the existing fault-injection pattern already present in Milestone 1's repository tests (`#transactionFault` hook is already visible in `repository.ts`'s `admit()`/`createBeforeFirstSend` call sites — reuse this existing fault-injection seam rather than building a new one).

**Mandatory vs. desirable split:** everything in A/B/D/E above is mandatory Milestone 3 acceptance evidence. Section C (Socket.IO) is explicitly out of Milestone 3's acceptance bar and should not block Milestone 3 sign-off; it becomes Milestone 4's mandatory evidence instead.

---

## 22. Sequential agent-delegation recommendation

**Recommendation: Option C** — split Milestone 3 into a contract/schema sub-milestone that can safely begin now, while concurrency-sensitive orchestration waits for Codex (per the plan's own ownership table, which assigns Milestone 3 to CODEX specifically because of "Persist-before-send, state machine, retry, TTL, reconciliation, and idempotency").

Reasoning against the alternatives:
- **Option A (wait entirely for Codex)** wastes the fact that a real, low-risk, non-concurrency-sensitive slice exists: the deferred-table schema/migration, the `SendAuthorization`/`AuthorizationDetails` `gameInstanceId` field addition (an additive interface change), and the transport-port *interface* (no implementation) can all be drafted and reviewed without touching the concurrency-sensitive transaction bodies.
- **Option B (Claude owns the production core)** contradicts the plan's explicit ownership table, which reserves Milestone 3's primary-owner role for CODEX specifically because of its data-integrity/concurrency sensitivity, and this review's own instructions forbid production implementation beyond architecture analysis in this pass regardless.
- **Option C** matches both the plan's ownership intent and the current unavailability of Codex noted in the brief: it lets safe, additive, schema/contract-level work proceed (candidate: Gemini, under a frozen prompt, per the plan's established "frozen implementation prompt → Gemini implementation → Codex focused review" pattern already used successfully in Milestone 2), while the retry scheduler, promotion-transaction logic, and reconciliation extensions wait for Codex.

**Proposed sequential plan:**

1. **Claude (this review) → architecture decisions frozen as ADRs** (Section 23) — done in this pass, pending product-owner confirmation of the Open Decisions in Section 24.
2. **Gemini, frozen prompt → additive, non-concurrency schema/contract slice:** new deferred-table Drizzle schema + migration manifest entry (structure only, no promotion logic), `AuthorizationDetails`/`SendAuthorization` interface extension for `gameInstanceId` (interface + trivial pass-through, no new authorization semantics), transport-port TypeScript interface (no implementation), declaration-consumer scaffolding for any new public types. **Review gate:** Codex focused review before any of this is treated as frozen.
3. **Future Codex → concurrency-sensitive production core:** promotion-transaction logic, retry scheduler, TTL sweep, restart reconciliation extension for the deferred table, the `in_flight → delivery_failed` transition and its trigger condition, and all mandatory Section 21.A/B/E tests. **Stop condition:** any finding that the frozen Gemini schema/interface slice is insufficient must return to step 2 for a Gemini rework (one rework maximum per the plan's standard pattern) before Codex proceeds further, rather than Codex silently patching around it.
4. **Codex focused self-review** → milestone handoff, per the plan's standard Milestone 3 completion gate.

---

## 23. Proposed ADR set

Numbering continues from the current highest, **ADR-018**.

### ADR-019 — Final actionId allocation and seed-based idempotency

- **Decision question:** How and when is the final `actionId` allocated, and what happens on replay?
- **Recommended option:** Option A (durable unique claim keyed by `idempotencySeed`) with a deterministic `actionId` derivation from the seed, computed by the caller before the durable claim.
- **Alternatives rejected:** pure random `actionId` with seed-only uniqueness (extra lookup indirection with no benefit given the existing dual-lookup); pre-allocate-then-reconcile (Option C — unnecessary given the existing atomic claim-or-return).
- **Invariants established:** one seed → one `actionId`, forever, including after terminal/expired states; duplicate claims return the original record and never issue a second `SendAuthorization`.
- **Consequences:** a replayed evaluation after expiry/failure never creates a new action — an explicit accepted trade-off, not an oversight.
- **Acceptance evidence required:** Section 21.A/B duplicate-claim and replay-after-terminal tests.
- **Downstream dependency:** Milestone 4/5 delivery-idempotency assumptions depend on this holding.

### ADR-020 — Durable deferred-candidate storage and promotion

- **Decision question:** Where does a `deferred` `MappingResult` live durably, and how does it become an action?
- **Recommended option:** Option B — separate deferred-candidate table, promoted atomically into `action_logs` via the existing `createBeforeFirstSend` path using the seed-derived `actionId`.
- **Alternatives rejected:** unified action/inbox table (Option A) and extending `action_logs` with scheduled/not-before states (Option C) — both would pollute the already-reviewed `LEGAL_TRANSITIONS` state machine with pre-action states.
- **Invariants established:** a deferred row is claimed and promoted in one transaction; a crash mid-promotion cannot double-create or silently drop; deferred capacity is bounded and fails closed.
- **Consequences:** two tables to reconcile at startup instead of one; explicit bound required (ADR-018 precedent).
- **Acceptance evidence required:** Section 21.B promotion-race and migration tests.
- **Downstream dependency:** none beyond Milestone 3 itself.

### ADR-021 — Action lifecycle state machine (ratification, not a new design)

- **Decision question:** What durable states and transitions govern action delivery?
- **Recommended option:** Keep the existing `LEGAL_TRANSITIONS` table as the single authoritative source; add the missing `in_flight → delivery_failed` transition.
- **Alternatives rejected:** introducing a separate durable `retry-wait` state (unnecessary — retry timing is scheduler-owned, not durable-state-owned); introducing `cancelled`/`superseded` statuses (out of current scope).
- **Invariants established:** no new states beyond the existing nine; every reachable state has a defined terminal/nonterminal classification already encoded in `NonterminalActionStatus`/`TerminalActionStatus`.
- **Consequences:** Milestone 3 orchestration must be built to fit the existing machine, not the other way around.
- **Acceptance evidence required:** Section 21.A full transition-matrix tests.
- **Downstream dependency:** Milestone 4's completion-reporting SDK behavior must match `received`/`completed`/`failed` exactly.

### ADR-022 — SendAuthorization binding extension for gameInstanceId

- **Decision question:** Does the durable send authorization bind a game instance, and when is that added?
- **Recommended option:** Add a nullable `gameInstanceId` to `AuthorizationDetails`/the `recordAttempt` binding parameter now, in Milestone 3, even though it cannot be verified against a real session until Milestone 4.
- **Alternatives rejected:** deferring the interface change to Milestone 4 — rejected because it would force re-opening an already-reviewed, security-sensitive interface under Milestone 4's own time pressure.
- **Invariants established:** the persist-before-send invariant (Section 10) is preserved; the extension is additive and does not change existing consumption/expiry semantics.
- **Consequences:** one more nullable column/field to carry through Milestone 3's code, unused until Milestone 4.
- **Acceptance evidence required:** existing authorization tests extended to cover the new nullable field without behavior change when null.
- **Downstream dependency:** Milestone 4's Socket.IO adapter is the actual consumer.

### ADR-023 — Transport-neutral send port and Milestone 4 boundary

- **Decision question:** What is the minimum interface Milestone 3 exposes so Milestone 4 can attach Socket.IO without re-opening lifecycle decisions? (Explicitly *not* an ADR about Socket.IO itself — see Section 0.)
- **Recommended option:** A `send(envelope, authorization) → Promise<SendOutcome>` port, implemented by a deterministic fake in Milestone 3's own tests, left unimplemented in production until Milestone 4.
- **Alternatives rejected:** building any part of the Socket.IO adapter now — explicitly out of Milestone 3 scope per the frozen plan.
- **Invariants established:** Milestone 3's orchestration never assumes a specific transport; all transport-specific concerns (namespace, handshake, ACK wire format) stay outside this port's contract.
- **Consequences:** Milestone 4 must adapt Socket.IO messages onto this port's shape rather than Milestone 3 adapting to Socket.IO.
- **Acceptance evidence required:** Section 21.E end-to-end tests using the fake transport.
- **Downstream dependency:** Milestone 4, directly.

### ADR-024 — Retry policy, TTL authority, and ordering defaults

- **Decision question:** What governs retry attempts, backoff, and delivery ordering?
- **Recommended option:** Max 2 retries (already decided by the plan text, ratified here), deterministic no-jitter backoff, `priority DESC, createdAt ASC, actionId ASC` ordering, serial-per-game delivery — all explicitly labeled proposed defaults except the max-retry count.
- **Alternatives rejected:** jittered backoff (adds nondeterminism to tests without a demonstrated need at MVP scale); parallel in-flight actions per game (unnecessary complexity for the current scope).
- **Invariants established:** TTL always pre-empts retry eligibility; retries never exceed the durable attempt-number uniqueness constraint.
- **Consequences:** numeric defaults (timeout, backoff intervals, deferred-table capacity) remain implementation-time decisions per ADR-018's own precedent, not frozen here.
- **Acceptance evidence required:** Section 21.A max-attempts boundary test, Section 21.B expiry-vs-retry race test.
- **Downstream dependency:** Milestone 5's end-to-end recovery smoke.

---

## 24. Open decisions requiring project-owner confirmation

- **OD-1 (headline, Section 0):** Confirm that Sections 8–9/11–12's Socket.IO/ACK content is to be treated as forward-looking Milestone 4 guidance only, and that Milestone 3 itself stays transport-independent per the frozen plan. If the project owner actually wants Milestone 3's scope expanded to include Socket.IO, that is a genuine, material scope change to the frozen plan and should be recorded as its own ADR/plan amendment, not inferred from this review's brief.
- **OD-2:** Confirm the deferred-table numeric capacity bound, retry backoff intervals, and receipt-timeout default (Section 13/15) — all explicitly proposed, not frozen, per ADR-018's own precedent against inventing unlabeled numeric defaults.
- **OD-3:** Confirm the `gameInstanceId` binding addition to `SendAuthorization` should happen in Milestone 3 (ADR-022's recommendation) rather than being deferred to Milestone 4 — this is a judgment call about interface-churn risk, not a purely technical fact.
- **OD-4:** Confirm rejected/dropped `MappingResult`s should create **no** durable audit record in Milestone 3 (this review's default reading of ADR-017), versus wanting an explicit audit trail — the review brief's Section 3 instructions allow an audit record "if... already within accepted scope," and nothing in ADR-013–018 currently asks for one, so the default is "no," but this should be an explicit confirmation given it's easy to want in hindsight.
- **OD-5 (minor, documentation only):** `ROADMAP.md`'s `BE-05A`–`BE-06B` rows still say `TODO` while every other Milestone 2 closure document says `APPROVED_AND_COMPLETE`. Recommend a documentation-sync pass (not an architecture blocker) before or alongside Milestone 3 closure so the roadmap and execution docs don't drift further.
- **OD-6:** Confirm whether the `in_flight → delivery_failed` transition gap (Section 9) should be added as part of Milestone 3 (this review's recommendation) or was an intentional omission this review is misreading — worth one line of explicit confirmation since it's the one place existing code appears to fall short of the plan's own stated target states.

None of these rise to the level of *"a genuine product-level choice that cannot be inferred from current goals and materially changes architecture"* — each has a clearly reasoned recommended default in this document, grounded in existing frozen ADRs and code, that a delegated implementer can proceed with pending a lightweight confirmation.

---

## 25. Architecture verdict

**READY_TO_RESOLVE**

Repository constraints are understood (baseline verified, Node runtime disclosed as not the required v24, static analysis only). Viable, evidence-grounded recommended decisions exist for all twelve decision points, most of them substantially de-risked by discovering that Milestone 1 already built the hard, concurrency-sensitive persistence core — Milestone 3's real remaining work is narrower and more orchestration-shaped than the review brief's structure alone would suggest. The one apparent blocking ambiguity (Socket.IO scope, Section 0) is resolved by deferring to the project's own frozen Milestone Plan rather than requiring a new product decision, and is recorded as OD-1 for explicit confirmation rather than as a genuine blocker. The remaining open items (OD-2 through OD-6) are implementation-detail confirmations, not architecture-changing choices, and can be resolved directly into the ADR set in Section 23 without further implementation evidence.
