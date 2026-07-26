# Phase C Milestone 3 Slice 1 — Independent Review 01

**Date:** 2026-07-26
**Scope:** Gemini additive schema/interface slice only (migration v3, Drizzle
parity, `BudgetAdmissionSnapshot`, `gameInstanceId` binding, `nextAttemptAt`
structural metadata, `ActionDeliveryPort`, `FakeActionDeliveryPort`,
declaration consumers, additive tests).
**Repository:** https://github.com/MinhCYB/CrowdCircuit
**Branch reviewed:** `review/phase-c`

---

## 1. Exact Repository HEAD and Runtime Evidence

```
branch:  review/phase-c
HEAD:    4f33f53cc52cee45bdbcb92ba93d448505a67814 ("wip: add Phase C milestone 3 schema and interface slice")
parent:  e70e97b ("docs: resolve Phase C milestone 3 architecture")
working tree: clean
```

Recent history:

```
4f33f53 (HEAD -> review/phase-c, origin/review/phase-c) wip: add Phase C milestone 3 schema and interface slice
e70e97b docs: resolve Phase C milestone 3 architecture
15eb07c docs: close Phase C milestone 2
c54b288 fix: remediate Phase C milestone 2 review findings
ab4a1cd wip: add Phase C milestone 2 additive coverage
```

Baseline gate: **PASSED**. HEAD is exactly the required commit, its
immediate parent is the required architecture-resolution commit, and all
six required Slice 1 checkpoint files are present:

- `apps/server/src/delivery/port.ts` — FOUND
- `apps/server/test/support/fake-action-delivery-port.ts` — FOUND
- `apps/server/test/persistence-slice1.test.ts` — FOUND
- `apps/server/test/delivery-port.test.ts` — FOUND
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01.md` — FOUND
- `docs/orchestration/reviews/PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md` — FOUND

### Runtime evidence — Node 24 unavailable (same constraint as the Milestone 2 closure review)

- Container ships Node.js **v22.22.2**; `pnpm 11.9.0` was obtained via
  `corepack prepare pnpm@11.9.0 --activate` (succeeds — not the blocker).
- `n 24.15.0` was retried and failed identically:
  `curl: (22) The requested URL returned error: 403` against
  `https://nodejs.org/dist/v24.15.0/...` — the sandbox's network egress
  allowlist still does not include `nodejs.org` or any Node-24 distribution
  channel.
- Every `package.json` in the touched workspaces declares
  `"engines": {"node": ">=24.2.0"}`; every `pnpm` invocation under Node 22
  printed the unsupported-engine warning.
- Per instruction, Node-22 results below are **supplementary evidence only**
  and do not substitute for the required Section 9 Node-24 verification.

---

## 2. Complete Slice 1 Diff Scope (`e70e97b..HEAD`)

```
A  apps/server/src/delivery/port.ts
M  apps/server/src/index.ts
M  apps/server/src/persistence/authorization.ts
M  apps/server/src/persistence/index.ts
M  apps/server/src/persistence/migrations.ts
M  apps/server/src/persistence/repository.ts
M  apps/server/src/persistence/schema.ts
M  apps/server/src/persistence/types.ts
M  apps/server/test/declaration-consumer.ts
A  apps/server/test/delivery-port.test.ts
M  apps/server/test/migration-upgrade.test.ts
A  apps/server/test/persistence-slice1.test.ts
A  apps/server/test/support/fake-action-delivery-port.ts
M  docs/execution/CURRENT_TASK.md
M  docs/execution/PROJECT_STATUS.md
M  docs/execution/ROADMAP.md
A  docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01.md
M  docs/orchestration/plans/PHASE-C-MILESTONE-03-DELEGATION-PLAN.md
M  docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md
A  docs/orchestration/prompts/PHASE-C-MILESTONE-03-GEMINI-01-PROMPT.md
A  docs/orchestration/reviews/PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md
```

Content matches the declared Slice 1 boundary: migration v3, Drizzle
parity, snapshot types, `gameInstanceId` pass-through, `nextAttemptAt`
column, delivery-port types + fake, declaration consumers, additive tests,
and documentation. A targeted search for Milestone-3-core / Milestone-4
keywords (`socket.io`, `promoteDeferredCandidate`, `computeActionId`,
`ACTION_ID_FORMAT_VERSION`, `retryScheduler`, `ttlWorker`, `backoff`) across
every changed source file returned **zero matches**. See Sections 16–17.

---

## 3. Findings

| # | Severity | Area | Summary |
|---|---|---|---|
| F-1 | **High** | `authorizeRetry` destination binding | Silently falls back to the *previous* authorization's `gameInstanceId` when the caller omits one, with no ADR permitting it. |
| F-2 | **Medium** | `BudgetAdmissionSnapshot` nullability | All five budget-scope fields are typed `T \| null`, but no real admission request can ever produce `null` for any of them; the type is more permissive than its source data, inviting an unsafe silent-skip pathway in Slice 2. |
| F-3 | **Low** | Process documentation | `PROJECT_STATUS.md`, `CURRENT_TASK.md`, and the delegation plan already mark Slice 1 `APPROVED_AND_COMPLETE` before this independent review gate ran, contradicting the delegation plan's own stated review-gate sequencing. |
| F-4 | **Low** | Self-review doc | `PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md` embeds local absolute Windows paths (`file:///d:/Dev/CrowdCircuit/...`) as evidence links — not reproducible for another reviewer/machine, though harmless (does not appear in emitted code or declarations; see Section 13). |

No Critical findings. Sections 4–13 give the full assessment behind each
row; Section "Verdict" explains how these combine.

---

## 4. Migration-v3 Assessment

`apps/server/src/persistence/migrations.ts`, migration `version: 3`,
`id: "phase-c-deferred-and-retry-metadata"`:

- Earlier migrations (v1, v2) are byte-for-byte unchanged in this diff.
- `mapping_budget_deferred_candidates` has all 19 columns specified in the
  delegation plan, in the same order, with matching types/nullability.
- `idempotency_seed TEXT PRIMARY KEY` is the sole uniqueness boundary for
  the table, matching ADR-020 ("one `idempotencySeed` has at most one
  active deferred record").
- Numeric/timestamp `CHECK` constraints are present and I independently
  verified SQLite actually enforces them (Section 5) rather than assuming
  the DDL text is sufficient:
  - `candidate_ordinal >= 0`
  - `candidate_ttl_ms > 0`
  - `deferred_expires_at >= 0 AND deferred_expires_at >= created_at` (a
    forward reference to a column defined later in the same `CREATE TABLE`
    statement — confirmed to work correctly in SQLite; order of column
    declaration does not affect `CHECK` evaluation)
  - `created_at >= 0`
  - `promoted_at IS NULL OR promoted_at >= 0`
- `status` is constrained to exactly `'queued' | 'promoted' | 'expired'`,
  and the same `CHECK` clause enforces promotion-metadata consistency in
  both directions: `status = 'promoted'` requires both
  `promoted_action_id` and `promoted_at` to be non-null, and
  `status IN ('queued', 'expired')` requires both to be null. I verified
  by direct insertion (Section 5 / `migration-upgrade.test.ts`'s dedicated
  constraint test) that SQLite rejects promoted rows missing either field,
  and rejects queued/expired rows carrying stray promotion metadata.
- `mapping_budget_deferred_promotion_idx` is declared with column order
  `(game_id, status, priority, created_at)` — exact match to spec.
- `action_logs.next_attempt_at INTEGER CHECK (... IS NULL OR ... >= 0)` is
  added via `ALTER TABLE ADD COLUMN`; I independently confirmed SQLite
  supports and enforces a `CHECK` constraint added this way (existing rows
  read the new column as `NULL`; a subsequent negative `UPDATE` is
  rejected).
- `action_logs_retry_schedule_idx` has column order `(status, next_attempt_at)` — exact match.
- `game_instance_id TEXT` (nullable, no `CHECK`) is added to both
  `action_send_authorizations` and `action_attempts` via `ALTER TABLE`.

**No raw-DDL/Drizzle drift found.**

---

## 5. Raw SQL / Drizzle Parity Assessment

Direct side-by-side comparison of `migrations.ts` version 3 against
`schema.ts`:

| Object | Raw DDL | Drizzle | Match |
|---|---|---|---|
| `mapping_budget_deferred_candidates` (19 columns) | present | `mappingBudgetDeferredCandidates` (19 fields, same order/types/nullability/default) | ✅ |
| `mapping_budget_deferred_promotion_idx` | `(game_id, status, priority, created_at)` | `.on(table.gameId, table.status, table.priority, table.createdAt)` | ✅ exact order |
| `action_logs.next_attempt_at` | nullable `INTEGER` | `nextAttemptAt: integer("next_attempt_at")` (no `.notNull()`) | ✅ |
| `action_logs_retry_schedule_idx` | `(status, next_attempt_at)` | `.on(table.status, table.nextAttemptAt)` | ✅ exact order |
| `action_send_authorizations.game_instance_id` | nullable `TEXT` | `gameInstanceId: text("game_instance_id")` | ✅ |
| `action_attempts.game_instance_id` | nullable `TEXT` | `gameInstanceId: text("game_instance_id")` | ✅ |

`CHECK` constraints are (correctly) not re-declared in Drizzle — Drizzle's
schema builder does not natively express arbitrary multi-column `CHECK`
clauses, and the raw DDL is the single source of truth actually applied to
the database; this matches the pattern already established for Milestone
2's budget tables. No naming/column-order drift found anywhere.

**Independent SQLite enforcement checks I ran directly** (not just DDL
inspection):

```
✅ Forward-referencing CHECK constraint (deferred_expires_at >= created_at,
   where created_at is declared later) is genuinely enforced by SQLite.
✅ ALTER TABLE ADD COLUMN ... CHECK (...) is genuinely enforced by SQLite
   — new column defaults to NULL for pre-existing rows, and a later
   negative UPDATE is rejected with "CHECK constraint failed".
```

---

## 6. v1→v2→v3 Upgrade Assessment

`apps/server/test/migration-upgrade.test.ts` was rewritten to extend the
prior v1→v2 regression into a genuine three-stage sequence. All 13 required
steps are present and independently re-run (not merely read):

1. Applies only `MIGRATIONS.filter(m => m.version === 1)`.
2. Seeds representative Milestone-1 rows (`runtime_ownership`,
   `game_profiles`, `event_mappings`, `action_logs`, `action_attempts`,
   `action_send_authorizations`).
3. Closes the v1 connection.
4. Reopens and applies only `MIGRATIONS.filter(m => m.version <= 2)`
   (pending v2 only).
5. Seeds representative Milestone-2 rows (`mapping_budget_profiles`,
   `mapping_budget_cooldowns`).
6. Captures pre-v3 snapshots of the Milestone-1/2 rows via `SELECT *`.
7. Verifies `mapping_budget_deferred_candidates` does **not** exist yet.
8. Closes the v2 connection.
9. Reopens with the **full** manifest — `migrateDatabase` reports exactly
   `3` (only the pending v3 migration applied, not a re-application of v1/v2).
10. Verifies `schema_versions` now lists versions 1, 2, 3 in order with the
    correct migration IDs.
11. Verifies the new table, both new indexes, and the new nullable columns
    exist.
12. Re-selects the captured Milestone-1/2 rows, strips only the newly added
    nullable column from each, and asserts the remainder is `toEqual` the
    pre-migration snapshot — proving no existing data was altered — while
    separately asserting the new columns (`next_attempt_at`,
    `game_instance_id` ×2) read back as `null` for pre-existing rows.
13. Reopens a third time, re-runs `migrateDatabase`, asserts it does not
    throw, and asserts `MAX(version)` is still `3` — idempotency.

A second, dedicated test (`enforces raw DDL check constraints on
mapping_budget_deferred_candidates`) independently exercises every `CHECK`
boundary described in Section 4 (valid queued/promoted inserts succeed;
invalid status, negative ordinal, non-positive TTL, expiry-before-creation,
and both directions of promotion-metadata inconsistency all throw).

**Independent execution (Node 22, supplementary):**

```
pnpm --filter @crowdcircuit/server exec vitest run test/migration-upgrade.test.ts
 ✓ test/migration-upgrade.test.ts (2 tests) 153ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

**Verdict: genuine v1→v2→v3 upgrade, not a single-startup fresh-database migration through all three versions.**

---

## 7. BudgetAdmissionSnapshot Completeness Assessment

`apps/server/src/persistence/types.ts`:

```ts
export interface BudgetUserWindowSnapshot { readonly limitPerMinute: number; }
export interface BudgetRuleWindowSnapshot { readonly limitPerMinute: number; }
export interface BudgetGlobalTokenSnapshot { readonly maxPerSecond: number; readonly burst: number; }
export interface BudgetCapacitySnapshot { readonly maxUserBuckets: number; readonly inactiveRetentionMs: number; readonly sweepLimit: number; }

export interface BudgetAdmissionSnapshot {
  readonly gameProfileId: string;
  readonly ruleId: string;
  readonly userBudgetKey: string;
  readonly userLimit: BudgetUserWindowSnapshot | null;
  readonly cooldownMs: number | null;
  readonly ruleLimit: BudgetRuleWindowSnapshot | null;
  readonly globalToken: BudgetGlobalTokenSnapshot | null;
  readonly capacityConfig: BudgetCapacitySnapshot | null;
}
```

Compared field-by-field against the actual request accepted by
`DurableBudgetRepository.admit` (`packages/mapping-engine/src/model.ts`,
`BudgetAdmissionRequest`) and the call site that constructs it
(`packages/mapping-engine/src/engine.ts` around the `this.#repository.admit({...})` call):

| Snapshot field | Real admission source | Real type |
|---|---|---|
| `gameProfileId` | `candidate.gameProfileId` | `string` (required) |
| `ruleId` | `candidate.ruleId` | `string` (required) |
| `userBudgetKey` | `candidate.userBudgetKey` | `string` (required) |
| `userLimit.limitPerMinute` | `rule.controls.maxActionsPerUserPerMinute` | `number` (required — `PositiveSafeIntegerSchema`, **never optional/nullable**) |
| `cooldownMs` | `rule.controls.cooldownMs` | `number` (required — `NonnegativeSafeIntegerSchema`, **never optional/nullable**) |
| `ruleLimit.limitPerMinute` | `rule.controls.maxActionsPerMinute` | `number` (required, **never optional/nullable**) |
| `globalToken.{maxPerSecond,burst}` | `profile.globalActionBudget.{maxPerSecond,burst}` | both required (`GlobalActionBudgetSchema`, **never optional/nullable**) |
| `capacityConfig.*` | `profile.capacity.*` | required, defaulted if absent from input, **never actually null at runtime** (`BudgetCapacitySchema` has defaults, not `.nullable()`) |

**All fields needed to reconstruct the exact `BudgetAdmissionRequest` shape
are present** (modulo `now`, deliberately excluded per ADR-020/24 — the
promoting caller supplies the *current* trusted clock value, not the
original). `overflowPolicy` and `deferredTtlMs` from `GlobalActionBudget`
are correctly omitted: neither is consumed by `admit()` itself (confirmed
by reading `engine.ts` — those two fields are only read by the *caller* of
`admit()` to decide what to do with a `GLOBAL_LIMIT` rejection, which is
out of scope for a promotion `admit()` re-run). So **structurally the
snapshot is complete** — this is not an `API_GAP`.

**However (F-2, Medium):** every one of the five scope fields
(`userLimit`, `cooldownMs`, `ruleLimit`, `globalToken`, `capacityConfig`)
is typed `| null` in the snapshot, but as the table above shows, **none of
their real-world sources can ever be null or absent** — every mapping rule
is required to specify `cooldownMs`, `maxActionsPerMinute`, and
`maxActionsPerUserPerMinute`; every profile is required to specify
`globalActionBudget` and `capacity` (the latter is defaulted, never
literally missing). The snapshot type is therefore strictly more
permissive than any value it will ever legitimately hold. This matters
because:

- It weakens the compile-time guarantee that Slice 2's snapshot-construction
  code populates every scope from the real admission — a bug that
  accidentally passes `null` for a scope would type-check cleanly instead
  of being caught by the compiler.
- It creates an unspecified "what does `null` mean here?" question for
  Slice 2's promotion `admit()`-replay logic: does `null` mean "skip this
  scope's check" (which would let a deferred candidate bypass a user
  window, rule cooldown, or rule limit at promotion — directly contradicting
  ADR-020's stated consequence, "Deferred candidates cannot bypass user
  sliding windows, rule cooldowns, or rule limits when promoted")? Nothing
  in Slice 1 documents an answer, because nothing in Slice 1 constructs or
  consumes a real snapshot yet — but the type as written invites exactly
  the ambiguity ADR-020 was written to prevent.

Units/semantics otherwise match exactly (minutes vs. seconds, ms vs.
seconds, etc. — no field found with subtly different units than its
source).

**Verdict: not an API_GAP (all data is representable), but the nullability
mismatch is a genuine Medium finding that should be tightened — these five
fields should be non-nullable to match their real source data — before
Slice 2 builds promotion logic on top of this type.**

---

## 8. gameInstanceId Authorization Assessment

`normalizeGameInstanceId` (`apps/server/src/persistence/repository.ts`):

```ts
function normalizeGameInstanceId(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    if (value.length === 0 || value.length > 256) {
      throw new PersistenceError("INVALID_INPUT", "Game instance ID is invalid");
    }
    return value;
  }
  throw new PersistenceError("INVALID_INPUT", "Game instance ID is invalid");
}
```

- Omitted and explicit `undefined`/`null` all normalize to `null` — ✅.
- A valid nonempty (≤256 char) string is preserved unchanged — ✅.
- Empty string or non-string value fails closed with `INVALID_INPUT` — ✅.
- `createBeforeFirstSend` normalizes and persists `gameInstanceId` on the
  originating authorization; `AuthorizationDetails.gameInstanceId` is
  stored as part of the opaque, `WeakMap`-backed `SendAuthorization`
  (unchanged branding/freezing mechanism from Milestone 1 — see
  `authorization.ts`), so it cannot be forged or read by a caller without
  going through `recordAttempt`.
- `recordAttempt` reads `details.gameInstanceId` from the trusted
  authorization record — **not** from caller input — when writing the
  `action_attempts` row and the returned `ActionAttempt`. The caller-
  supplied `binding.gameInstanceId` (if provided) is used **only** as a
  validation check against `details.gameInstanceId`, and a mismatch throws
  `INVALID_AUTHORIZATION` before any mutation — confirmed by direct
  inspection of `recordAttempt` (repository.ts:686–800) and exercised by
  `persistence-slice1.test.ts`'s `"fails closed when supplied binding
  gameInstanceId mismatches authorized gameInstanceId"` test (Node-22 run:
  pass). **An unrelated caller cannot override the persisted attempt
  value** — it is always the authorization's own bound value.
- The SQL `UPDATE ... action_send_authorizations SET consumed_at = ? WHERE
  ... AND (game_instance_id IS ? OR (game_instance_id IS NULL AND ? IS
  NULL))` correctly single-use-consumes the authorization scoped to its
  exact `gameInstanceId` (including the `NULL`-safe comparison SQLite's `=`
  operator would otherwise mishandle) — the existing opaque/single-use/
  expiry/runtime/version invariants from Milestone 1 (checked via
  `authorizationId`, `expectedVersion`, `attemptNumber`, `runtimeId`,
  `role`, `clientId`, `expiresAt`, `runtimeOwnerId`, `consumed_at IS NULL`,
  `revoked_at IS NULL`) are untouched by this addition — `gameInstanceId`
  is a strict, additive extra condition on top of the pre-existing
  fenced-consumption logic, not a replacement for any of it.

**No regression to Milestone 1 authorization invariants found. Binding
correctness for the "normal" (non-retry) creation → attempt path is solid.**

---

## 9. authorizeRetry Destination-Binding Assessment (F-1, High)

```ts
authorizeRetry(
  actionId: string,
  expectedVersion: number,
  runtimeId: string,
  gameInstanceId?: string | null,
): SendAuthorization {
  ...
  let targetGameInstanceId: string | null = null;
  if (gameInstanceId !== undefined) {
    targetGameInstanceId = normalizeGameInstanceId(gameInstanceId);
  } else {
    const prevAuth = this.#database
      .prepare(
        `SELECT game_instance_id FROM action_send_authorizations
         WHERE action_id = ? ORDER BY attempt_number DESC LIMIT 1`,
      )
      .get(actionId);
    targetGameInstanceId =
      prevAuth !== undefined
        ? ((Reflect.get(prevAuth, "game_instance_id") as string | null) ?? null)
        : null;
  }
  ...
}
```

This directly matches the exact pattern the review scope calls out to
check for: **the fourth parameter, `gameInstanceId`, is optional.** When
the caller omits it, `authorizeRetry` does **not** require a freshly
resolved destination — it silently queries the most recent prior
authorization row for that action (`ORDER BY attempt_number DESC LIMIT 1`)
and reuses its `game_instance_id` as the new authorization's binding.

I searched every accepted ADR (ADR-019 through ADR-024, and specifically
ADR-021 "Action Lifecycle Statuses, Retries, and Restart Recovery" and
ADR-022 "Send Authorization Binding and Persist-Before-Send Ordering",
which are the two ADRs that govern retries and authorization binding
respectively) and the full Milestone 3 architecture review doc for any
explicit permission for this fallback. **None exists.** ADR-022 only
establishes that `gameInstanceId` is a *nullable binding parameter* added
to `SendAuthorization`/`AuthorizationDetails` "alongside `actionId`,
`attemptNumber`, ..." — it says nothing about what a retry should do when
the caller doesn't supply a fresh value. The architecture review doc
(Section 10 discussion, lines ~273–294, ~470–480) frames `gameInstanceId`
binding purely as "architectural readiness" for Milestone 4, explicitly
stating "nothing can populate/verify it against a real session until
Milestone 4 wires Socket.IO" and lists as a still-open security invariant
that "once `gameInstanceId` binding exists, a client authenticated for
instance X can never consume an authorization scoped to instance Y" — the
current fallback behavior is in tension with that stated invariant, because
a retry that omits the parameter binds to whatever instance the *previous*
attempt happened to target, not necessarily the instance the caller
currently intends.

This is not an accidental oversight — it is intentionally implemented and
unit-tested as designed behavior. `persistence-slice1.test.ts`'s test
titled `"retry authorization preserves explicit or previous gameInstanceId
binding"` explicitly asserts: a first `authorizeRetry(...)` call with no
fourth argument produces an attempt bound to `"inst_original"` (the
instance from the very first attempt), and only a second call that
explicitly passes `"inst_new_destination"` overrides it. The test name
itself frames "preserving the previous binding" as a feature.

Per the review's own escalation rule — **"A fallback to a stale previous
destination must be reported unless there is an explicit accepted ADR
permitting it"** — this must be reported. Concretely: in a future
Milestone 4 world, if a player disconnects from game instance X and
reconnects as instance Y, and Slice 2's retry scheduler calls
`authorizeRetry` without explicitly re-resolving and passing the new
`gameInstanceId`, the retry would silently be authorized (and later,
`recordAttempt`-validated) against the *stale* instance X rather than the
player's current instance Y. Because `resolveDestination` (the
`ActionDeliveryPort` method that would normally discover the *current*
destination — Section 11) is a completely separate call that nothing in
this repository currently wires into `authorizeRetry`, there is no
structural guarantee that a caller re-resolves the destination before
retrying; the convenience default actively works against that guarantee
by making it optional to do so.

**This should be changed before Slice 2 (Codex Core) builds the retry
scheduler on top of this primitive.** The narrowest fix (not implemented by
this reviewer, per instructions) would be to make `gameInstanceId` a
required parameter of `authorizeRetry` (or otherwise force the caller to
make an explicit choice, e.g. a discriminated `"reuse-previous"` vs.
explicit-value input) so that "reuse the stale destination" can never
happen by omission.

**Verdict: reported per instructions — REQUEST CHANGES condition ("stale
destination-binding behavior").**

---

## 10. nextAttemptAt / API-Authority Assessment

- `DurableActionRecord.nextAttemptAt` is exposed as `number | null`
  (`types.ts`).
- `persistence-slice1.test.ts` confirms: a newly created action defaults
  `nextAttemptAt` to `null`; an explicit nonnegative value round-trips
  correctly; a negative value is rejected at creation with
  `"Next attempt timestamp is invalid"`.
- The `migration-upgrade.test.ts` v1→v2→v3 test additionally confirms
  pre-existing (pre-v3) rows read `next_attempt_at` back as `null` after
  migration.
- No backoff computation, scheduling, timer, worker, or eligibility logic
  exists anywhere in the diff — `next_attempt_at` is read/written as an
  inert column with a bounds check only. No action state automatically
  changes based on its value (nothing polls or reads it besides the two
  round-trip tests).

**On `CreateDurableAction` accepting both `nextAttemptAt` and
`gameInstanceId` at creation time:** both are optional
(`nextAttemptAt?: number`, `gameInstanceId?: string | null`) and both
default to `null` when omitted. This is reasonable, narrow structural
compatibility rather than an unnecessary expansion of caller authority:

- `gameInstanceId` at creation time is directly analogous to the existing
  Milestone-1 pattern of binding destination-adjacent metadata
  (`role`/`clientId`) at authorization time, and a genuinely new action can
  legitimately know its target instance up front (e.g., a mapping-engine
  candidate that already resolved a destination before the durable record
  is created) — this is not different in kind from other fields already
  accepted at creation (`priority`, `ttlMs`).
- `nextAttemptAt` at creation time is more debatable, since a brand-new
  action has no prior attempt to schedule a retry from — but the field is
  purely inert structural storage in this slice (no scheduler reads it),
  the input is validated and fails closed on invalid values, and allowing
  it at creation avoids a second write path later. I do not find this rises
  to an unsafe API-authority expansion, since nothing consumes the value
  yet and Slice 2 remains free to decide whether production code ever
  actually populates it at creation vs. only via a dedicated retry-
  scheduling write path.

**Verdict: acceptable as structural preparation; no API finding raised for
this specific item** (distinct from F-1, which is about `authorizeRetry`'s
*default* behavior, not about `CreateDurableAction`'s creation-time
authority).

---

## 11. Delivery-Port Assessment

`apps/server/src/delivery/port.ts`:

```ts
export interface DeliveryDestination {
  readonly clientId: string;
  readonly gameInstanceId: string | null;
}
export type DeliveryResolution =
  | { readonly status: "available"; readonly destination: DeliveryDestination }
  | { readonly status: "no_destination" };
export interface PreparedActionDelivery {
  readonly envelope: GameActionEnvelope;
  readonly attemptNumber: number;
  readonly destination: DeliveryDestination;
}
export type ActionDeliveryOutcome =
  | { readonly status: "sent" }
  | { readonly status: "transport_error"; readonly error: string };
export interface ActionDeliveryPort {
  resolveDestination(envelope: GameActionEnvelope): Promise<DeliveryResolution>;
  send(delivery: PreparedActionDelivery): Promise<ActionDeliveryOutcome>;
}
```

- Two-stage boundary is correctly modeled: `resolveDestination` is a
  separate method from `send`, and the `no_destination` outcome lives on
  `DeliveryResolution` (the *resolution* stage), never on
  `ActionDeliveryOutcome` (the *send* stage) — matching ADR-023's
  requirement that "a `no_destination` outcome occurs before attempt
  authorization consumption and does not count as a delivery attempt."
  (Enforcing that a caller actually sequences calls this way, and that
  `no_destination` truly consumes no authorization/attempt, is an
  orchestration-level guarantee for Slice 2, not something the type alone
  can prove — but the type shape is exactly right to support it.)
- `send` does **not** receive `SendAuthorization` — `PreparedActionDelivery`
  contains exactly the three specified fields (`envelope`, `attemptNumber`,
  `destination`) and nothing else; no `SendAuthorization` import appears
  anywhere in `port.ts`.
- The port interface itself implements no lifecycle or persistence
  behavior — it is a pure TypeScript interface with two method signatures.
- Zero Socket.IO, network, session, or ACK-handling code/imports exist in
  `port.ts` (only type-only import of `GameActionEnvelope` from
  `@crowdcircuit/contracts`).
- `transport_error.error: string` — nothing in the type system can enforce
  "cannot require exposing secrets" (that's a runtime-discipline concern
  for whoever implements the port later, not something Slice 1's type
  definition can violate or guarantee); no defect to report here, just a
  note that this remains an implementation-time responsibility.

**Verdict: fully compliant with ADR-023's transport-neutral boundary.**

---

## 12. Deterministic-Fake Assessment

`apps/server/test/support/fake-action-delivery-port.ts`:

- Lives only under `apps/server/test/support/` — not under `src/`.
- Not exported from `apps/server/src/index.ts` (confirmed by direct
  inspection — only `./persistence/index.js`, `./delivery/port.js`, and
  `./auth/index.js` are re-exported) and the declaration consumer has an
  active `@ts-expect-error` proving
  `import { FakeActionDeliveryPort } from "@crowdcircuit/server"` fails to
  compile.
- No random values, sleeps, clocks, network calls, timers, or durable
  mutation anywhere in the file — it is a plain in-memory FIFO queue
  (`#resolutions`/`#outcomes` arrays) with settable defaults
  (`setDefaultResolution`/`setDefaultOutcome`) and a `reset()` method.
- Records calls deterministically via `resolvedEnvelopes`/`sentDeliveries`
  arrays.
- Supports all frozen outcomes: `queueResolution`/`queueOutcome` accept any
  value of the frozen `DeliveryResolution`/`ActionDeliveryOutcome` union
  types, so `available`, `no_destination`, `sent`, and `transport_error`
  are all scriptable.

**Verdict: fully compliant with the deterministic-fake requirements.**

---

## 13. Declaration / Public-Export Assessment

`apps/server/src/persistence/index.ts` and `apps/server/src/index.ts`
export only the minimum approved types: durable action/authorization types,
the five new `Budget*Snapshot` types, `ActionDeliveryPort`, and the
concrete `SqliteDurableActionRepository`/`OpenActionRepositoryOptions`
(the intended concrete implementation, not an internal detail). No raw
SQLite handle, no `migrations.ts` exports, no transaction helper, and no
`AuthorizationDetails`/`issueSendAuthorization`/`readSendAuthorization`
internals are exported — `SendAuthorization` itself remains the existing
Milestone-1 opaque branded/frozen type, safe to export because it carries
no readable internals.

```
pnpm --filter @crowdcircuit/server test:declarations           → clean, 0 errors (Node 22, supplementary)
npx tsc -p apps/server/test/tsconfig.declarations.json --noEmit → clean, 0 errors (Node 22, supplementary)
```

`declaration-consumer.ts` proves, via active `@ts-expect-error` directives
that I confirmed are still functioning (the file fails to typecheck if any
are removed, since an un-triggered `@ts-expect-error` is itself a
compile error under `--noEmit`):

- Snapshot immutability (`validSnapshot.gameProfileId = ...` and a
  same-shape mutation inside a function both fail).
- Missing required snapshot fields fail (omitting `capacityConfig`
  entirely is rejected — confirms all five scope keys are mandatory *keys*,
  even though their *values* are unnecessarily nullable per F-2).
- Non-JSON-safe snapshot values fail (`cooldownMs: true as unknown as
  boolean` correctly rejected, since the declared type is `number | null`).
- Valid delivery discriminators (`"available"`, `"sent"`) type-check;
  invalid discriminators (`"ready"`, `"completed"`) and invented
  transport-specific fields (`socketId`) are all rejected.
- `PreparedActionDelivery` cannot contain `SendAuthorization` — attaching
  an `authorization` field is rejected.
- The fake cannot be imported from `@crowdcircuit/server`.
- Pre-existing Milestone 1/2 consumer assertions (`validStatus`,
  `invalidStatus`, `missingTimestamp`, `invalidParams`, `forgedAuthorization`)
  remain present and unweakened — no negative case was removed.

I also inspected the emitted `.d.ts` output under `apps/server/dist/` for
source/test/absolute-path leakage (`grep` for `d:/Dev`, `/home/claude`,
`C:\`): **none found.** The absolute-path leakage noted as F-4 is confined
to a documentation file (`PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md`),
not the compiled artifacts, so it has no runtime or type-safety impact —
flagged only as a documentation-hygiene note.

**Verdict: fully compliant.**

---

## 14. Focused Verification Results (Node 22, supplementary — not authoritative)

```
pnpm --filter @crowdcircuit/server lint             → clean (0 errors)
pnpm --filter @crowdcircuit/server typecheck         → clean (0 errors)
pnpm --filter @crowdcircuit/server build             → clean
pnpm --filter @crowdcircuit/server test:declarations → clean (0 errors)
npx tsc -p apps/server/test/tsconfig.declarations.json --noEmit → clean

pnpm --filter @crowdcircuit/server exec vitest run test/migration-upgrade.test.ts
 → 1 file, 2 tests, all passed

pnpm --filter @crowdcircuit/server exec vitest run test/persistence-slice1.test.ts test/delivery-port.test.ts
 → 2 files, 13 tests, all passed

pnpm --filter @crowdcircuit/server test (full package suite)
 → 9 files: 7 passed, 2 failed (74 tests: 67 passed, 7 failed)
   All 7 failures are in test/budget-concurrency.test.ts (6) and
   test/persistence.test.ts (1), all with the identical error:
   "Cannot find module '.../persistence/repository.js' imported from
   .../*-worker.ts" — a tsx@^4.20.3 ESM loader-hook incompatibility under
   Node 22 that also breaks the pre-existing Milestone-1
   repository-concurrency-worker.ts test, confirming this is an
   environment artifact, not a Slice 1 regression. Matches the exact
   finding already documented in the Milestone 2 closure review
   (PHASE-C-MILESTONE-02-INDEPENDENT-CLOSURE-REVIEW-03.md, Section 4).
   None of the failing tests touch Slice 1 code paths.
```

Expected baseline: "server: approximately 74 tests across 9 files" —
**exact match** (9 files, 74 tests, 67 passing / 7 environment-attributable
failures).

## 15. Repository-Wide Verification Results (Node 22, supplementary)

```
pnpm lint       → clean across all packages
pnpm typecheck  → clean across all packages
pnpm build      → clean across all packages (after building event-core,
                  which was not pre-built in this fresh checkout — a
                  build-order artifact unrelated to Slice 1)
pnpm test       → 25 files, 362 tests: 355 passed, 7 failed
                  (the same 7 worker-thread/tsx-under-Node-22 failures
                  described above; zero new failures relative to the
                  Milestone 2 closure review baseline)

git diff --check HEAD^..HEAD → only Markdown hard-line-break trailing
                                 whitespace in docs (expected, benign)
```

Expected baseline: "repository: approximately 362 tests across 25 files" —
**exact match.**

## 16. Confirmation — No Concurrency-Sensitive Core Exists

Confirmed. A targeted search across every file touched in this diff for
`promoteDeferredCandidate`, `computeActionId`, `ACTION_ID_FORMAT_VERSION`,
retry-scheduler/backoff logic, and TTL-worker logic returned zero matches.
`authorizeRetry`/`recordAttempt`/`revokeSendAuthorization` are pre-existing
Milestone-1 primitives, mechanically extended with the additive
`gameInstanceId` parameter (Sections 8–9) — no new transaction body,
promotion logic, or scheduling logic was added. `next_attempt_at` and
`mapping_budget_deferred_candidates` exist purely as inert, validated
storage with no reader/writer beyond the additive tests.

## 17. Confirmation — No Socket.IO / Milestone 4 Implementation Exists

Confirmed. `grep -rniE "socket\.io"` across the full diff scope returns
zero matches. `ActionDeliveryPort` contains only a type-only import of
`GameActionEnvelope` from the already-frozen `@crowdcircuit/contracts`
package. No `packages/game-sdk-js` changes exist in this diff.

## 18. Final Git Status

```
On branch review/phase-c
Your branch is up to date with 'origin/review/phase-c'.
nothing to commit, working tree clean
```

No untracked files outside `node_modules`/`dist` build artifacts.

## 19. Confirmation — No Production Files Modified by the Reviewer

Confirmed. Only this review document was created
(`docs/orchestration/reviews/PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md`).
No file under `apps/`, `packages/`, or any other `docs/` path was modified,
added, or deleted by this review.

## 20. Confirmation — No Commit or Push Occurred

Confirmed. No `git commit` or `git push` was executed at any point during
this review.

---

## Verdict

# REQUEST CHANGES

**Primary reason:** F-1 — `authorizeRetry` silently falls back to a
*previous* authorization's `gameInstanceId` when the caller omits one, with
no ADR permitting this behavior, and it is implemented and unit-tested as
designed rather than accidental. Per the review's explicit escalation rule,
a fallback to a stale previous destination must be reported and blocks
approval absent an accepted ADR. This is exactly the "stale
destination-binding behavior" condition the verdict rules list under
`REQUEST CHANGES`, and it should be fixed (the parameter should not have a
silent-reuse default) before Slice 2 builds a retry scheduler on top of
this primitive — reworking it after Slice 2 exists would be far more
disruptive.

**Secondary reason:** F-2 — `BudgetAdmissionSnapshot`'s five budget-scope
fields are typed nullable even though no real admission request can ever
produce a null value for any of them, which both weakens compile-time
completeness guarantees and leaves the promotion-time meaning of `null`
unspecified in exactly the area (bypassing a budget scope) ADR-020 was
written to prevent. This does not rise to `API_GAP` (the type can still
represent every real field), but should be tightened before Slice 2 writes
snapshot-construction/consumption code against it.

**Everything else assessed as compliant:** migration v3 DDL, raw-SQL/
Drizzle parity, the v1→v2→v3 upgrade regression, the "normal" (non-retry)
`gameInstanceId` creation/attempt binding path, `nextAttemptAt` structural
scope, the `ActionDeliveryPort`/`PreparedActionDelivery` transport-neutral
boundary, the deterministic fake, and the public/declaration surface are
all correctly scoped, additive-only, and free of Milestone-3-core or
Milestone-4 leakage. Static and (supplementary, Node-22) dynamic
verification came back clean at exactly the expected test counts, with the
only failures attributable to a known, pre-existing, environment-specific
worker-thread loader issue rather than anything introduced by this slice.

Node.js ≥24.2.0 remained unobtainable in this sandbox for the mandatory
Section 9 fresh-verification gate (same network-egress constraint recorded
in the Milestone 2 closure review); this review is not additionally
returning `ENVIRONMENT_BLOCKED`, because the substantive findings above
(F-1 in particular) are independent of runtime version and already meet
the bar for `REQUEST CHANGES` on their own — a clean Node-24 run would not
change that outcome. A future re-review after F-1 and F-2 are addressed
should still obtain genuine Node-24 evidence before issuing a final
`APPROVE`.