# Task Prompt: Phase C Milestone 3 — Gemini Additive Schema & Interface Slice (GEMINI-01)

You are the additive implementation agent for CrowdCircuit
Phase C Milestone 3 Slice 1.

Repository:

https://github.com/MinhCYB/CrowdCircuit

Branch:

review/phase-c

Expected baseline:

- Phase C Milestone 2 is APPROVED_AND_COMPLETE.
- Phase C Milestone 3 architecture is RESOLVED.
- ADR-019 through ADR-024 are present in
  docs/execution/DECISIONS.md.
- The current branch contains the architecture-resolution checkpoint,
  expected commit message:

  docs: resolve Phase C milestone 3 architecture

This task is limited to additive schema, persistence-shape, interface,
declaration, fake-adapter, migration-test, and documentation work.

You are NOT the concurrency-sensitive core owner.

Do not commit or push.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. HARD BASELINE GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run:

git fetch --all --prune
git checkout review/phase-c
git pull --ff-only origin review/phase-c

git status
git branch --show-current
git rev-parse HEAD
git rev-parse --short HEAD
git log --oneline --decorate -10
node --version
pnpm --version

Required:

- branch is review/phase-c;
- working tree is clean;
- Node.js is v24.15.0 or another version >=24.2.0;
- pnpm is 11.9.0;
- Milestone 2 is APPROVED_AND_COMPLETE;
- Milestone 3 architecture is RESOLVED;
- ADR-019 through ADR-024 exist;
- these files exist:

  docs/orchestration/reviews/
  PHASE-C-MILESTONE-03-ARCHITECTURE-REVIEW-01.md

  docs/orchestration/plans/
  PHASE-C-MILESTONE-03-DELEGATION-PLAN.md

  docs/orchestration/prompts/
  PHASE-C-MILESTONE-03-CODEX-CORE.md

Stop with BASELINE_BLOCKED if any requirement is missing.

Read completely:

- docs/execution/DECISIONS.md;
- docs/execution/CURRENT_TASK.md;
- docs/execution/PROJECT_STATUS.md;
- docs/execution/ROADMAP.md;
- docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md;
- docs/orchestration/plans/
  PHASE-C-MILESTONE-03-DELEGATION-PLAN.md;
- docs/orchestration/reviews/
  PHASE-C-MILESTONE-03-ARCHITECTURE-REVIEW-01.md;
- Milestone 1 and Milestone 2 final handoffs;
- Milestone 2 final closure record.

Inspect before editing:

- apps/server/src/persistence/migrations.ts;
- apps/server/src/persistence/schema.ts;
- apps/server/src/persistence/types.ts;
- apps/server/src/persistence/repository.ts;
- apps/server/src/persistence/authorization.ts;
- apps/server/test/migration-upgrade.test.ts;
- apps/server/test/declaration-consumer.ts;
- apps/server/test/tsconfig.declarations.json;
- apps/server/package.json;
- packages/contracts action envelope and lifecycle exports;
- packages/mapping-engine public candidate and budget-admission types.

Do not assume a requested type already exists.
Verify every imported type and public export against the current code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. STRICT SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This slice may implement only:

- SQLite migration version 3;
- matching Drizzle schema declarations;
- immutable deferred-candidate persistence shapes;
- immutable BudgetAdmissionSnapshot types;
- nullable gameInstanceId authorization and attempt pass-through;
- nullable nextAttemptAt structural persistence support;
- transport-neutral delivery-port interfaces;
- deterministic test fake;
- declaration consumers;
- additive schema and migration tests;
- documentation and status updates.

You MUST NOT implement:

- deferred promotion transactions;
- full budget re-admission orchestration;
- nested or transaction-aware promotion primitives;
- retry scheduler logic;
- retry backoff calculation;
- receipt-timeout handling;
- TTL sweep workers;
- background timers or loops;
- restart reconciliation extensions;
- production action-delivery orchestration;
- new lifecycle transition transaction bodies;
- Socket.IO;
- `/game` namespace;
- real game sessions;
- acknowledgement handlers;
- SDK behavior;
- demo game behavior;
- Milestone 4 or Milestone 5 implementation.

Do not silently broaden scope for convenience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. SQLITE MIGRATION VERSION 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extend:

apps/server/src/persistence/migrations.ts

Add migration:

- version: 3
- id: phase-c-deferred-and-retry-metadata

Preserve the repository's existing migration checksum, ordering,
transaction, and compatibility conventions.

Migration version 3 must create:

mapping_budget_deferred_candidates

Required columns:

- idempotency_seed
  - TEXT
  - PRIMARY KEY

- game_profile_id
  - TEXT
  - NOT NULL

- game_id
  - TEXT
  - NOT NULL

- rule_id
  - TEXT
  - NOT NULL

- event_id
  - TEXT
  - NOT NULL

- candidate_ordinal
  - INTEGER
  - NOT NULL

- action_type
  - TEXT
  - NOT NULL

- params_json
  - TEXT
  - NOT NULL

- actor_json
  - TEXT
  - nullable

- priority
  - INTEGER
  - NOT NULL

- action_priority
  - INTEGER
  - NOT NULL

- candidate_ttl_ms
  - INTEGER
  - NOT NULL

- deferred_expires_at
  - INTEGER
  - NOT NULL

- created_at
  - INTEGER
  - NOT NULL

- admission_snapshot_json
  - TEXT
  - NOT NULL

- status
  - TEXT
  - NOT NULL
  - DEFAULT 'queued'

- owning_runtime_id
  - TEXT
  - NOT NULL

- promoted_action_id
  - TEXT
  - nullable

- promoted_at
  - INTEGER
  - nullable

Add CHECK constraints matching existing repository conventions:

- candidate_ordinal >= 0;
- candidate_ttl_ms > 0;
- deferred_expires_at >= created_at;
- created_at >= 0;
- deferred_expires_at >= 0;
- promoted_at IS NULL OR promoted_at >= 0;
- status IN ('queued', 'promoted', 'expired');

Promotion metadata must remain internally consistent:

- status = 'promoted'
  requires:
  - promoted_action_id IS NOT NULL;
  - promoted_at IS NOT NULL;

- status IN ('queued', 'expired')
  requires:
  - promoted_action_id IS NULL;
  - promoted_at IS NULL.

Add index:

mapping_budget_deferred_promotion_idx

Column order:

- game_id;
- status;
- priority;
- created_at.

Also alter action_logs:

Add nullable column:

next_attempt_at INTEGER

Add a nonnegative constraint where supported by the repository's migration
conventions:

next_attempt_at IS NULL OR next_attempt_at >= 0

Add index:

action_logs_retry_schedule_idx

Column order:

- status;
- next_attempt_at.

Also alter action_send_authorizations:

Add nullable column:

game_instance_id TEXT

Also alter action_attempts:

Add nullable column:

game_instance_id TEXT

Do not add deferred-promotion SQL.
Do not add retry-worker SQL.
Do not add TTL-worker SQL.
Do not modify existing migration versions 1 or 2.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. DRIZZLE SCHEMA PARITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update:

apps/server/src/persistence/schema.ts

Declare Drizzle schema matching migration version 3 exactly.

Required parity:

- table names;
- column names;
- nullability;
- defaults;
- primary keys;
- CHECK constraints where represented by the current Drizzle conventions;
- index names;
- index column order;
- integer/text types.

Declare:

mappingBudgetDeferredCandidates

matching:

mapping_budget_deferred_candidates

Declare index:

mapping_budget_deferred_promotion_idx

with exact column order:

gameId,
status,
priority,
createdAt.

Add actionLogs.nextAttemptAt mapped to:

next_attempt_at

Declare index:

action_logs_retry_schedule_idx

with exact column order:

status,
nextAttemptAt.

Add:

actionSendAuthorizations.gameInstanceId

mapped to:

game_instance_id

Add:

actionAttempts.gameInstanceId

mapped to:

game_instance_id

Do not rename existing tables, indexes, or fields.

Add or extend schema-parity tests when consistent with the repository's
current testing style.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. IMMUTABLE BUDGET ADMISSION SNAPSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update:

apps/server/src/persistence/types.ts

Before defining BudgetAdmissionSnapshot, inspect the exact request and
configuration types currently used by:

DurableBudgetRepository.admit

The snapshot must contain enough immutable information to reproduce the
complete four-scope admission request later:

1. user or anonymous sliding window;
2. rule cooldown;
3. rule sliding window;
4. global token bucket;
5. bounded-state and capacity behavior required by the repository.

Do not store the original clock value.
Promotion will use the current trusted processing clock.

Prefer reusing the actual existing immutable types when their semantics match.

Do not silently invent lookalike aliases with different semantics.

The intended public shape is conceptually:

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

However, the identifiers:

- UserWindowConfig;
- RuleWindowConfig;
- GlobalTokenConfig;
- BoundedCapacityConfig;

must only be used if those exact types already exist with the required
semantics.

When they do not exist:

- derive the minimum readonly snapshot subtypes from the actual current
  admission request;
- use clear, non-conflicting names;
- document how each snapshot field maps to the existing admission request;
- keep all properties readonly;
- preserve JSON-safe serializability;
- avoid importing mutable mapping profiles as the semantic source of truth.

The snapshot must not require reloading current mutable rule configuration.

The snapshot must be sufficient for a future core implementation to call
the full admission logic without re-evaluating mapping rules or templates.

Return API_GAP instead of guessing when the current repository API cannot
reconstruct full admission from an immutable snapshot.

Do not implement snapshot serialization or deferred insertion in this slice
unless a minimal JSON encoder/decoder is already required by existing
persistence type conventions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. GAME INSTANCE AUTHORIZATION PASS-THROUGH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update the existing authorization and attempt persistence path mechanically.

Required behavior:

- IssueAuthorizationParams accepts:

  readonly gameInstanceId?: string | null

- AuthorizationDetails exposes normalized:

  readonly gameInstanceId: string | null

- omitted gameInstanceId normalizes to null;
- explicit undefined normalizes to null;
- explicit null remains null;
- a nonempty string is preserved exactly.

Authorization issuance must store the normalized value in:

action_send_authorizations.game_instance_id

Authorization row reading must restore it.

Attempt recording must copy the authorized value into:

action_attempts.game_instance_id

The attempt value must come from the consumed authorization binding, not
from an unrelated untrusted caller field.

Retry authorization must preserve the explicitly supplied destination
binding for the new attempt.

Extend existing binding comparisons so a supplied gameInstanceId mismatch
fails closed in the same style as existing clientId/role binding checks.

Do not implement:

- real session lookup;
- Socket.IO validation;
- active game-instance registry;
- cross-instance networking behavior;
- reconnect behavior.

Do not weaken:

- opaque SendAuthorization identity;
- single-use consumption;
- expiry;
- runtime ownership;
- runtime-owner fencing;
- expected-version binding;
- action/attempt binding.

Add runtime and declaration tests for:

- omitted;
- undefined;
- null;
- valid nonempty string;
- mismatch rejection;
- persistence and read-back;
- attempt copying the authorized value;
- retry authorization preserving the new binding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. RETRY SCHEDULING METADATA SHAPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add nullable durable scheduling metadata:

action_logs.next_attempt_at

Update all required structural paths:

- raw migration;
- Drizzle schema;
- persisted row type;
- durable action record type;
- row decoder;
- row serializer or insert/update shape where structurally necessary;
- declaration consumers.

Expose normalized public/internal value:

readonly nextAttemptAt: number | null

Existing rows and callers must remain source-compatible.

Creation paths that do not explicitly provide nextAttemptAt must store null.

Do not implement:

- backoff calculations;
- scheduling decisions;
- retry eligibility;
- timers;
- scheduler workers;
- updates to nextAttemptAt based on delivery outcomes;
- new retry transaction bodies.

This field is structural preparation for the concurrency-sensitive core.

Add tests proving:

- omitted value becomes null;
- existing records read as null after migration;
- explicit valid values survive persistence where the current API allows
  structural insertion;
- negative values are rejected by schema or validation conventions;
- declarations expose number | null.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. TRANSPORT-NEUTRAL DELIVERY PORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create:

apps/server/src/delivery/port.ts

This must be a production interface only.

Milestone 3 uses a two-stage delivery boundary because ADR-022 requires
destination resolution before SendAuthorization consumption and durable
attempt creation.

Define:

```ts
import type {
  GameActionEnvelope,
} from "@crowdcircuit/contracts";

export interface DeliveryDestination {
  readonly clientId: string;
  readonly gameInstanceId: string | null;
}

export type DeliveryResolution =
  | {
      readonly status: "available";
      readonly destination: DeliveryDestination;
    }
  | {
      readonly status: "no_destination";
    };

export interface PreparedActionDelivery {
  readonly envelope: GameActionEnvelope;
  readonly attemptNumber: number;
  readonly destination: DeliveryDestination;
}

export type ActionDeliveryOutcome =
  | {
      readonly status: "sent";
    }
  | {
      readonly status: "transport_error";
      readonly error: string;
    };

export interface ActionDeliveryPort {
  resolveDestination(
    envelope: GameActionEnvelope,
  ): Promise<DeliveryResolution>;

  send(
    delivery: PreparedActionDelivery,
  ): Promise<ActionDeliveryOutcome>;
}
```

Adjust import names only when required by the actual contracts package
exports.

Frozen semantics:

1. A durable action already exists before destination resolution.
2. resolveDestination is called before issuing or consuming a
   SendAuthorization for an attempt.
3. no_destination:
   - consumes no attempt number;
   - consumes no SendAuthorization;
   - creates no action_attempt row;
   - invokes no send operation.
4. After a destination is resolved:
   - issue a SendAuthorization bound to the destination;
   - consume the authorization;
   - persist the send_started attempt;
   - transition the action to in_flight;
   - commit the SQLite transaction;
   - only then may send be invoked.
5. send never receives SendAuthorization.
6. The transport port does not issue, inspect, consume, or revoke
   SendAuthorization.
7. The transport port does not own durable lifecycle transitions.
8. The transport port contains zero Socket.IO imports or dependencies.
9. The error string is an already-sanitized diagnostic and must never contain:
   - tokens;
   - pairing codes;
   - cookies;
   - authorization objects;
   - raw secret material.

SendAuthorization is intentionally not part of PreparedActionDelivery.

Do not add:

- Socket.IO;
- sessions;
- namespace handling;
- network code;
- timers;
- acknowledgement logic;
- reconnect logic;
- retry logic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. DETERMINISTIC DELIVERY TEST FAKE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create:

apps/server/test/support/fake-action-delivery-port.ts

The fake implements ActionDeliveryPort.

Do not place the fake under production source exports.

The fake must support deterministic scripting of:

- available destination;
- no destination;
- successful send;
- transport error;
- ordered recorded resolveDestination calls;
- ordered recorded send calls.

Requirements:

- no network access;
- no random UUID;
- no sleeps;
- no system clock dependency;
- no Socket.IO import;
- no background tasks;
- no durable lifecycle mutation;
- no SendAuthorization access.

The fake should be configurable through explicit queued outcomes or another
deterministic, type-safe mechanism.

Add focused unit tests for the fake and public port discriminators.

Do not implement the Milestone 3 production gateway with the fake.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. PUBLIC EXPORTS AND DECLARATION CONSUMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Inspect the existing apps/server public-export conventions.

Export only the minimum types required by the frozen Slice 1 boundary.

Do not expose:

- raw SQLite database handles;
- migration internals;
- repository-private transaction helpers;
- SendAuthorization internals;
- authorization token details beyond already-approved public types;
- test fake through production exports.

Update:

apps/server/test/declaration-consumer.ts

and any declaration tsconfig or package script required by the current
repository convention.

Declaration coverage must prove:

- BudgetAdmissionSnapshot fields are readonly;
- invalid/missing snapshot fields fail;
- non-JSON-safe snapshot values fail where represented by public types;
- nextAttemptAt is number | null;
- gameInstanceId is string | null after normalization;
- invalid delivery-resolution discriminators fail;
- invalid delivery-outcome discriminators fail;
- PreparedActionDelivery does not accept SendAuthorization;
- transport-specific or Socket.IO fields cannot be invented;
- FakeActionDeliveryPort is not exported from production package surfaces;
- existing valid consumers remain source-compatible.

Every @ts-expect-error must be active.

The normal command:

pnpm --filter @crowdcircuit/server test:declarations

must permanently execute all new declaration consumers.

Do not leave a standalone declaration config disconnected from the normal
package command.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. MIGRATION AND SCHEMA TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extend:

apps/server/test/migration-upgrade.test.ts

Add a real v1 → v2 → v3 upgrade regression.

Required procedure:

1. Apply only real migration version 1.
2. Seed representative Milestone 1 rows.
3. Close the database.
4. Reopen and apply real migration version 2 only.
5. Seed representative Milestone 2 budget rows.
6. Capture representative Milestone 1 and Milestone 2 rows.
7. Verify deferred table and version-3 columns/indexes do not yet exist.
8. Close the database.
9. Reopen with the full migration manifest.
10. Apply only pending migration version 3.
11. Verify schema_versions contains versions 1, 2, and 3 in order.
12. Verify mapping_budget_deferred_candidates exists.
13. Verify all required version-3 columns exist.
14. Verify these indexes exist:

    mapping_budget_deferred_promotion_idx
    action_logs_retry_schedule_idx

15. Verify version-3 columns exist on:

    action_logs.next_attempt_at
    action_send_authorizations.game_instance_id
    action_attempts.game_instance_id

16. Verify all pre-existing Milestone 1 and Milestone 2 rows remain
    field-for-field unchanged except for newly added nullable columns reading
    as null.
17. Reopen again and prove migration idempotency.
18. Verify changed-checksum and migration-order protections remain intact.

Also add focused constraint tests proving:

- invalid deferred status is rejected;
- negative candidate ordinal is rejected;
- nonpositive candidate TTL is rejected;
- deferred expiry before creation is rejected;
- promoted status without complete promotion metadata is rejected;
- queued/expired rows with partial promotion metadata are rejected;
- valid queued row inserts successfully;
- valid promoted row inserts successfully.

Do not add promotion behavior.
Do not invoke budget admission during these tests.
Do not implement a deferred repository in this slice unless the existing
schema-testing convention strictly requires a minimal row adapter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. MECHANICAL PERSISTENCE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add or extend focused persistence tests for:

gameInstanceId:

- authorization issuance persists null when omitted;
- authorization issuance persists null when undefined;
- explicit null persists as null;
- valid string round-trips;
- attempt recording copies the value from the consumed authorization;
- mismatched supplied binding fails closed;
- retry authorization stores the newly supplied destination binding;
- existing callers without gameInstanceId still pass.

nextAttemptAt:

- pre-v3 rows read as null after migration;
- new action creation defaults to null;
- valid nonnegative value round-trips where structurally supported;
- negative values fail validation or database constraint checks;
- no scheduler behavior is introduced.

Transport port:

- no_destination is represented only by resolveDestination;
- send has no no_destination outcome;
- send does not accept SendAuthorization;
- fake call recording is deterministic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. REQUIRED DOCUMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create:

docs/orchestration/reviews/
PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md

Create:

docs/handoffs/
HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01.md

Document:

- exact baseline and runtime versions;
- exact changed-file list;
- migration version 3 DDL;
- all CHECK constraints;
- raw SQL and Drizzle schema parity;
- exact BudgetAdmissionSnapshot shape;
- mapping from snapshot fields to the current budget-admission request;
- gameInstanceId authorization and attempt pass-through;
- nextAttemptAt structural preparation;
- transport-port two-stage boundary;
- why SendAuthorization is absent from send;
- deterministic fake behavior;
- declaration coverage;
- migration-upgrade evidence;
- exact verification commands and test counts;
- API gaps or production findings;
- confirmation no concurrency-sensitive core was implemented;
- confirmation no Socket.IO or Milestone 4 code was added.

Update only the necessary status documents:

- docs/execution/CURRENT_TASK.md;
- docs/execution/PROJECT_STATUS.md;
- docs/execution/ROADMAP.md;
- docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md;
- docs/orchestration/plans/
  PHASE-C-MILESTONE-03-DELEGATION-PLAN.md.

Set:

- Phase C: IN_PROGRESS;
- Milestone 3 architecture: RESOLVED;
- Milestone 3 Slice 1: READY_FOR_INDEPENDENT_REVIEW;
- Milestone 3 concurrency-sensitive core: BLOCKED_BY_SLICE_1_REVIEW;
- Milestones 4–5: BLOCKED_BY_PREVIOUS_MILESTONE;
- Phase D: untouched.

Do not mark:

- Milestone 3 COMPLETE;
- Milestone 3 APPROVED;
- Milestone 3 core started;
- Milestone 4 unblocked.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. VERIFICATION PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use:

- Node.js v24.15.0;
- pnpm 11.9.0.

Run focused server verification:

pnpm --filter @crowdcircuit/server lint
pnpm --filter @crowdcircuit/server typecheck
pnpm --filter @crowdcircuit/server test
pnpm --filter @crowdcircuit/server build
pnpm --filter @crowdcircuit/server test:declarations

Run declaration verification independently:

npx tsc -p apps/server/test/tsconfig.declarations.json --noEmit

Run migration-upgrade verification independently:

pnpm --filter @crowdcircuit/server exec vitest run \
  test/migration-upgrade.test.ts

Run any new focused port/fake test explicitly.

Run repository-wide:

pnpm lint
pnpm typecheck
pnpm test
pnpm build

Run final diff audit:

git diff --check HEAD --
git status --short
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard

Inspect emitted server JavaScript and declaration files.

Required:

- every command passes;
- no skipped or only tests;
- no ignored declaration suite;
- no source/test path leakage in declarations;
- no Socket.IO dependency;
- no lockfile change unless an existing dependency graph genuinely requires
  it;
- no Milestone 4 code;
- no concurrency-sensitive core implementation.

Do not commit or push.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. STOP CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return API_GAP instead of implementing a workaround when:

- full four-scope budget admission cannot be reconstructed from an immutable
  snapshot;
- current admission types depend on mutable profile configuration that cannot
  be frozen safely;
- migration version 3 cannot preserve existing v1/v2 rows;
- gameInstanceId cannot be passed through without changing authorization
  security semantics;
- adding nextAttemptAt requires implementing retry scheduling behavior;
- the repository requires a nested transaction for this additive slice;
- the transport interface conflicts with ADR-022 persist-before-send;
- the requested public type would expose authorization internals.

Return PRODUCTION_FINDING when existing behavior contradicts ADR-019 through
ADR-024.

Do not:

- weaken constraints;
- omit a requested field silently;
- invent a second budget-admission algorithm;
- duplicate mutable mapping profiles into the deferred snapshot;
- implement promotion as a workaround;
- implement scheduler behavior as a workaround;
- add Socket.IO as a workaround.

Stop and report the exact blocker.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. REQUIRED OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return:

1. Exact branch, HEAD, Node.js, and pnpm evidence
2. Complete created/modified-file list
3. Migration version 3 summary
4. Exact deferred-table constraints
5. Raw SQL and Drizzle parity assessment
6. Exact BudgetAdmissionSnapshot type shape
7. Mapping from snapshot fields to current admission request
8. gameInstanceId authorization/attempt pass-through
9. nextAttemptAt structural persistence changes
10. Exact ActionDeliveryPort interface
11. Deterministic fake behavior
12. Declaration-consumer coverage
13. v1→v2→v3 migration-upgrade results
14. Focused server test results and exact counts
15. Repository-wide verification results and exact counts
16. Self-review path
17. Handoff path
18. Status-document updates
19. Remaining API gaps or production findings
20. Final Git status
21. Confirmation no concurrency-sensitive core was implemented
22. Confirmation no Socket.IO or Milestone 4 code was added
23. Confirmation no commit or push occurred
