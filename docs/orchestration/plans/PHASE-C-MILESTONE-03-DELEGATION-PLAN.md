# Phase C Milestone 3 — Delegation and Implementation Plan

## Objective and Strategy

Milestone 3 implements the **Durable Action Gateway Lifecycle** (roadmapped under items `BE-07B`–`BE-07D`), extending the verified Milestone 1 persistence core and Milestone 2 mapping/budget capability into a transport-independent, persist-before-send delivery orchestration layer.

To preserve strict architectural boundaries and prevent multi-connection concurrency regressions, Milestone 3 uses **Sequential Delegation (Option C)**:
1. **Slice 1 (Gemini Additive Schema & Interface Slice)**: Additive database migration v3, Drizzle schema updates, immutable `BudgetAdmissionSnapshot` type, nullable `gameInstanceId` authorization binding, transport-port interfaces (`ActionDeliveryPort`) with deterministic test fakes (`FakeActionDeliveryPort`), declaration consumers, and migration/schema unit tests.
2. **Independent Review Gate**: Independent review of Slice 1 before any core orchestration work begins.
3. **Slice 2 (Codex Core Orchestration & Concurrency Slice)**: Full atomic budget re-admission promotion transaction, retry scheduler, TTL worker, restart reconciliation, state-machine transaction bodies, and concurrency-sensitive production orchestration.
4. **Final Verification & Acceptance**: Additive black-box tests and independent closure review.

---

## Scope Boundaries

### In Scope for Milestone 3
- Mapping result to durable action lifecycle (`accepted` → durable `action_logs` record).
- Deterministic `actionId` derivation (`ACTION_ID_FORMAT_VERSION = 1`) and permanent idempotency seed binding (`ADR-019`).
- Durable deferred candidate persistence (`mapping_budget_deferred_candidates` table) and full budget re-admission during promotion (`ADR-020`).
- Atomic deferred promotion and action creation within a single repository transaction (`ADR-020`).
- Transport-neutral delivery port (`ActionDeliveryPort`) and deterministic fake (`FakeActionDeliveryPort`) (`ADR-023`).
- Durable attempt preparation and strict persist-before-send order (`ADR-022`).
- Retry scheduling (`nextAttemptAt`, max 2 retries, 3 total attempts, deterministic backoff) (`ADR-021`).
- Live TTL and expiry processing (`ADR-024`).
- Restart reconciliation across pending, in-flight, received, and expired records (`ADR-021`).
- Delivery selection ordering (`priority DESC, created_at ASC, action_id ASC`) and bounded capacity (`ADR-024`).
- Extending runtime-owner fencing (`#requireActiveOwner`) across all new tables and operations (`ADR-024`).

### Out of Scope for Milestone 3
- Socket.IO, `/game` namespace, handshake auth, or connection registries (Milestone 4, `BE-07A`).
- JavaScript SDK (`packages/game-sdk-js`) (Milestone 4, `BE-08A`–`BE-08C`).
- Demo game / Zombie Survival (Milestone 5, `BE-09A`–`BE-09C`).
- Dashboard UI or active-game switching.
- Voice engine / Phase D.

---

### Slice 1 Status — Gemini Additive Schema & Interface Layer

**Primary Owner**: GEMINI  
**Status**: APPROVED_AND_COMPLETE (independent review: APPROVE_WITH_SMALL_FIX; approved small fix: CLOSED)
**Scope Boundary**: Additive schemas, types, DDL migration v3, port interfaces, fakes, declaration tests, and additive unit tests.

### Tasks for Gemini
1. **Schema & Migration Manifest v3**:
   - Create migration v3 DDL script in `apps/server/src/persistence/migrations.ts`.
   - Add table `mapping_budget_deferred_candidates` with columns:
     - `idempotency_seed` (TEXT, PRIMARY KEY / UNIQUE)
     - `game_profile_id` (TEXT, NOT NULL)
     - `game_id` (TEXT, NOT NULL)
     - `rule_id` (TEXT, NOT NULL)
     - `event_id` (TEXT, NOT NULL)
     - `candidate_ordinal` (INTEGER, NOT NULL)
     - `action_type` (TEXT, NOT NULL)
     - `params_json` (TEXT, NOT NULL)
     - `actor_json` (TEXT)
     - `priority` (INTEGER, NOT NULL)
     - `action_priority` (INTEGER, NOT NULL)
     - `candidate_ttl_ms` (INTEGER, NOT NULL)
     - `deferred_expires_at` (INTEGER, NOT NULL)
     - `created_at` (INTEGER, NOT NULL)
     - `admission_snapshot_json` (TEXT, NOT NULL)
     - `status` (TEXT, NOT NULL DEFAULT 'queued')
     - `owning_runtime_id` (TEXT, NOT NULL)
     - `promoted_action_id` (TEXT)
     - `promoted_at` (INTEGER)
   - Add index `mapping_budget_deferred_promotion_idx` on `(game_id, status, priority, created_at)`.
   - Add column `next_attempt_at` (INTEGER) to `action_logs` and index `action_logs_retry_schedule_idx` on `(status, next_attempt_at)`.
   - Add nullable column `game_instance_id` (TEXT) to `action_send_authorizations` and `action_attempts`.
   - Update Drizzle definitions in `apps/server/src/persistence/schema.ts` to maintain 100% parity with raw migration SQL.
2. **Immutable Admission Snapshot Type**:
   - Define `BudgetAdmissionSnapshot` interface in `apps/server/src/persistence/types.ts`:
     ```ts
     export interface BudgetAdmissionSnapshot {
       readonly gameProfileId: string;
       readonly ruleId: string;
       readonly userBudgetKey: string;
       readonly userLimit: UserWindowConfig | null;
       readonly cooldownMs: number | null;
       readonly ruleLimit: RuleWindowConfig | null;
       readonly globalToken: GlobalTokenConfig | null;
       readonly capacityConfig: BoundedCapacityConfig | null;
     }
     ```
3. **Nullable `gameInstanceId` Authorization Binding**:
   - Update `AuthorizationDetails` and `IssueAuthorizationParams` to accept optional `gameInstanceId?: string | null`.
4. **Transport-Neutral Port Interfaces & Test Fake**:
   - Create `ActionDeliveryPort` interface and `FakeActionDeliveryPort` in `apps/server/src/delivery/port.ts` (or `persistence/port.ts`).
   - Must contain zero Socket.IO dependencies.
   - Define transport delivery outcome types: `sent`, `no_destination`, `transport_error`.
5. **Declaration & Unit Verification**:
   - Update declaration consumers in `packages/mapping-engine` and `apps/server`.
   - Add additive schema migration tests verifying v1 → v2 → v3 upgrade and Drizzle index parity.

### Explicit Gemini Exclusions
Gemini MUST NOT implement:
- Deferred candidate promotion transactions or full budget re-admission orchestration.
- Retry scheduler workers or background timers.
- Live TTL workers or background sweep loops.
- Restart reconciliation extensions.
- State-machine transition transaction bodies.
- Concurrency-sensitive production code.

---

## Slice 2 Breakdown — Codex Core Orchestration & Concurrency Layer

**Primary Owner**: CODEX (or Claude Code via explicit separate assignment if Codex remains unavailable)  
**Status**: READY_FOR_IMPLEMENTATION
**Scope Boundary**: Concurrency-sensitive production transactions, promotion, retry scheduler, TTL worker, restart reconciliation, and core orchestration.

### Tasks for Core Owner
1. **Deterministic Action ID Derivation**:
   - Implement `computeActionId(idempotencySeed: string): string` using `ACTION_ID_FORMAT_VERSION = 1` and SHA-256 (e.g. `act_` + 26 chars).
2. **Atomic Deferred Candidate Promotion Transaction**:
   - Implement `promoteDeferredCandidate(idempotencySeed: string, now: number)` as a single, atomic repository transaction:
     - Check deferred row is `queued` and unexpired under active runtime ownership.
     - Re-run `DurableBudgetRepository.admit` using `admissionSnapshot` and current clock.
     - Create durable action record and mark deferred row `promoted`.
3. **Persist-Before-Send & Authorization Consumption Pipeline**:
   - Implement strict 6-step persist-before-send execution sequence:
     `createBeforeFirstSend` → issue authorization → `recordAttempt(send_started)` + transition `in_flight` → commit → invoke `ActionDeliveryPort.send`.
4. **Retry Scheduler & Backoff Engine**:
   - Implement retry scheduling for failed attempts (max 2 retries, 3 total attempts).
   - Compute deterministic backoff `nextAttemptAt`.
   - Implement `in_flight -> delivery_failed` transition on retry exhaustion.
5. **Live TTL Worker & Restart Reconciliation**:
   - Implement background sweep for live expired actions and deferred candidates.
   - Extend `reconcilePreviousRuntime` to handle pending/in_flight/deferred records across runtime restarts.

---

## Review Gates & Execution Sequence

```text
[ADRs Accepted (ADR-019..ADR-024)]
       │
       ▼
[Gemini Slice 1 Prompt Issued]
       │
       ▼
[Gemini Implementation (Schema v3, Snapshot, Port Types, Fakes)]
       │
       ▼
[Independent Claude Review Gate] ──── (If issues found: Gemini Rework)
       │
       ▼
[Codex Core Prompt Issued]
       │
       ▼
[Codex Implementation (Promotion Tx, Retry Scheduler, TTL, Reconciliation)]
       │
       ▼
[Additive Black-box & Multi-connection Concurrency Tests]
       │
       ▼
[Independent Final Milestone 3 Closure Review]
```

---

## Stop Conditions & Escalation Rules

Implementers MUST halt work and report `API_GAP` or `BLOCKED_DECISION` if:
1. `DurableBudgetRepository.admit` cannot re-play full admission from `BudgetAdmissionSnapshot` without changing public signatures.
2. Atomic deferred promotion cannot execute inside a single SQLite transaction without nested transaction errors.
3. Retry timing cannot be persisted without mutating frozen contract interfaces.
4. Authorization binding changes contradict existing Milestone 1 security invariants.
