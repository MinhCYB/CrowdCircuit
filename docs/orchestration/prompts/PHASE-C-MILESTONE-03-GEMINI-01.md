# Task Prompt: Phase C Milestone 3 — Gemini Additive Schema & Interface Slice (GEMINI-01)

You are the additive implementation agent for CrowdCircuit Phase C Milestone 3 Slice 1.

Repository: https://github.com/MinhCYB/CrowdCircuit  
Branch: `review/phase-c`  
Baseline commit: `15eb07c` (plus accepted ADR-019 through ADR-024)

Your work is strictly limited to additive DDL migration v3, Drizzle schema updates, immutable snapshot interfaces, transport port definitions, test fakes, declaration consumers, and schema/migration unit tests against frozen decisions ADR-019 through ADR-024.

You are NOT the concurrency core owner.
Do not implement production promotion transactions, retry schedulers, TTL workers, or restart reconciliation.
Do not commit or push.

---

## 1. Required Scope & Deliverables

### A. SQLite Migration v3 DDL & Drizzle Schema Parity
1. Extend `apps/server/src/persistence/migrations.ts` to add migration version 3 (`phase-c-deferred-and-retry-metadata`):
   - Table `mapping_budget_deferred_candidates`:
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
   - Index `mapping_budget_deferred_promotion_idx` on `mapping_budget_deferred_candidates(game_id, status, priority, created_at)`.
   - Column `next_attempt_at` (INTEGER) on `action_logs`.
   - Index `action_logs_retry_schedule_idx` on `action_logs(status, next_attempt_at)`.
   - Column `game_instance_id` (TEXT) on `action_send_authorizations` and `action_attempts`.
2. Update `apps/server/src/persistence/schema.ts` to declare Drizzle schema definitions matching raw migration SQL index names, column names, and column types with 100% parity.

### B. Immutable Snapshot Interface & Types
1. In `apps/server/src/persistence/types.ts`, declare `BudgetAdmissionSnapshot` interface:
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
2. Update `AuthorizationDetails` and `IssueAuthorizationParams` to support optional `gameInstanceId?: string | null`.

### C. Transport-Neutral Delivery Port Boundary & Test Fake
1. Create `apps/server/src/delivery/port.ts` (or `apps/server/src/persistence/port.ts`):
   - Define `ActionDeliveryOutcome = { status: 'sent' } | { status: 'no_destination' } | { status: 'transport_error'; error: string }`.
   - Define interface `ActionDeliveryPort`:
     ```ts
     export interface ActionDeliveryPort {
       send(envelope: GameActionEnvelope, authorization: SendAuthorization): Promise<ActionDeliveryOutcome>;
     }
     ```
   - Define `FakeActionDeliveryPort` implementing `ActionDeliveryPort` for deterministic unit testing.
   - MUST contain zero Socket.IO imports or dependencies.

### D. Verification Tests & Declarations
1. Add migration v1 → v2 → v3 upgrade test in `apps/server/test/migration-upgrade.test.ts` verifying all tables, columns, indexes, and existing Milestone 1 & 2 rows.
2. Update declaration check scripts and declaration consumers.

---

## 2. Hard Boundaries & Exclusions

You MUST NOT implement:
- Deferred promotion transactions or budget re-admission orchestration.
- Retry scheduler workers or background timers.
- TTL sweep workers or background loops.
- Restart reconciliation extensions.
- Production state-machine transition bodies.
- Socket.IO or network code.

---

## 3. Verification Protocol

Run:
```bash
pnpm --filter @crowdcircuit/server lint
pnpm --filter @crowdcircuit/server typecheck
pnpm --filter @crowdcircuit/server test
pnpm --filter @crowdcircuit/server build
pnpm --filter @crowdcircuit/server test:declarations
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check HEAD --
```
