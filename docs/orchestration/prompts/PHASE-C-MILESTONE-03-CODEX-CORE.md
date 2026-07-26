# Task Prompt: Phase C Milestone 3 — Codex Core Orchestration & Concurrency Layer (CODEX-CORE)

You are the primary implementation agent for CrowdCircuit Phase C Milestone 3 Slice 2 (Core Orchestration & Concurrency Layer).

Repository: https://github.com/MinhCYB/CrowdCircuit  
Branch: `review/phase-c`  
Prerequisite: Gemini Slice 1 (`PHASE-C-MILESTONE-03-GEMINI-01.md`) completed, verified, and accepted by independent review.

Your task is to implement the core delivery orchestration, atomic promotion, retry scheduling, TTL worker, restart reconciliation, and multi-connection concurrency verification against frozen decisions ADR-019 through ADR-024.

---

## 1. Required Scope & Deliverables

### A. Action ID Derivation (`ADR-019`)
- Implement `computeActionId(idempotencySeed: string): string` using private constant `ACTION_ID_FORMAT_VERSION = 1 as const` and SHA-256 (retaining ≥128 bits entropy, e.g. `act_` + 26 base32/hex chars).
- Bind `idempotencySeed` permanently to `actionId`. Duplicate claims return original record without issuing a second `SendAuthorization`.

### B. Atomic Deferred Promotion Transaction (`ADR-020`)
- Implement `promoteDeferredCandidate(idempotencySeed: string, now: number)` as a single, atomic repository-level transaction:
  - Verify deferred record is `queued` and unexpired under active runtime owner.
  - Re-run full atomic budget admission (`DurableBudgetRepository.admit`) across all 4 scopes (user/anonymous window, cooldown, rule window, global token) using stored `BudgetAdmissionSnapshot` and current processing clock.
  - Create or recover idempotent durable action record and mark deferred row `promoted`.
  - Transaction boundary MUST be single-level (`BEGIN IMMEDIATE`) without nested transactions.

### C. Persist-Before-Send Orchestration (`ADR-022` & `ADR-023`)
- Enforce strict 6-step production delivery sequence:
  1. Action record exists in DB;
  2. `SendAuthorization` issued;
  3. Authorization consumed & attempt recorded with `send_started` atomically (`recordAttempt`);
  4. Status transitions to `in_flight`;
  5. SQLite transaction commits;
  6. `ActionDeliveryPort.send` invoked ONLY AFTER commit.
- Never invoke `ActionDeliveryPort.send` before transaction commit.
- Handle `no_destination` (does not consume attempt) and `transport_error` (durable retry evidence).

### D. Retry Scheduler & Backoff Engine (`ADR-021`)
- Implement delivery retry scheduler (max 2 retries, 3 total attempts).
- Compute deterministic backoff `nextAttemptAt`.
- Enforce `in_flight -> delivery_failed` transition on attempt exhaustion.
- Re-authorize each retry attempt with a newly issued `SendAuthorization`.

### E. Live TTL Worker & Restart Reconciliation (`ADR-021` & `ADR-024`)
- Implement live TTL worker for expired actions and deferred candidates.
- Extend `reconcilePreviousRuntime` to handle `pending`, `in_flight`, `received`, `expired`, and `deferred` records.

### F. Concurrency Verification
- Create multi-connection worker thread tests in `apps/server/test/` verifying atomic promotion and budget admission under heavy multi-process contention.

---

## 2. Verification Protocol

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
