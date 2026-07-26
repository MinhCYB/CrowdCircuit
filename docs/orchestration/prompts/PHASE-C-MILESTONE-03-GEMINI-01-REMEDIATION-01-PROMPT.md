# Task Prompt: Phase C Milestone 3 Slice 1 — Gemini Remediation 01

You are the narrow remediation agent for CrowdCircuit
Phase C Milestone 3 Slice 1.

Repository:

https://github.com/MinhCYB/CrowdCircuit

Branch:

review/phase-c

Required implementation checkpoint:

4f33f53 — wip: add Phase C milestone 3 schema and interface slice

Independent review:

docs/orchestration/reviews/
PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md

Independent verdict:

REQUEST CHANGES

This task addresses only the confirmed Slice 1 findings:

- F-1 High: authorizeRetry silently reuses a previous gameInstanceId.
- F-2 Medium: BudgetAdmissionSnapshot budget-scope fields are incorrectly nullable.
- F-3 Low: status documents marked Slice 1 approved before the independent review gate.
- F-4 Low: self-review contains machine-local file:/// links.
- Additional documentation hygiene: remove the duplicate
  PHASE-C-MILESTONE-03-GEMINI-01-PROMPT.md file and retain the canonical
  PHASE-C-MILESTONE-03-GEMINI-01.md prompt.

Do not implement the Milestone 3 concurrency-sensitive core.
Do not begin Slice 2.
Do not implement Socket.IO or Milestone 4.
Do not commit or push.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. BASELINE GATE
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

- branch: review/phase-c;
- clean working tree;
- HEAD is 4f33f53 or a newer review-document-only checkpoint;
- Node.js v24.15.0 or another version >=24.2.0;
- pnpm 11.9.0;
- ADR-019 through ADR-024 remain present;
- the independent review file exists at the required path.

Stop with BASELINE_BLOCKED if the independent review is absent or the
implementation checkpoint is not present.

Read completely:

- docs/execution/DECISIONS.md;
- docs/execution/CURRENT_TASK.md;
- docs/execution/PROJECT_STATUS.md;
- docs/execution/ROADMAP.md;
- docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md;
- docs/orchestration/plans/
  PHASE-C-MILESTONE-03-DELEGATION-PLAN.md;
- docs/orchestration/reviews/
  PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md;
- docs/orchestration/reviews/
  PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md;
- docs/handoffs/
  HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01.md.

Inspect the exact current implementations of:

- apps/server/src/persistence/types.ts;
- apps/server/src/persistence/repository.ts;
- apps/server/src/persistence/authorization.ts;
- apps/server/test/persistence-slice1.test.ts;
- apps/server/test/declaration-consumer.ts;
- apps/server/test/tsconfig.declarations.json.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. STRICT REMEDIATION BOUNDARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Permitted work:

- remove stale gameInstanceId fallback from authorizeRetry;
- require an explicit retry destination binding;
- tighten BudgetAdmissionSnapshot nullability;
- update focused runtime and declaration tests;
- correct status documents;
- remove local absolute documentation links;
- remove the duplicate prompt copy;
- create remediation handoff and self-review documents.

Forbidden work:

- migration-v3 redesign;
- deferred-promotion repository methods;
- full budget re-admission orchestration;
- retry scheduler;
- retry backoff implementation;
- TTL worker or sweep;
- background timers;
- restart reconciliation extension;
- production Action Gateway orchestration;
- action-ID derivation;
- Socket.IO;
- /game namespace;
- real sessions or acknowledgements;
- SDK or demo-game work;
- Milestone 4 or 5 implementation.

Do not broaden scope silently.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. F-1 HIGH — REQUIRE EXPLICIT RETRY DESTINATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current defect:

authorizeRetry silently queries the most recent authorization row and reuses
its game_instance_id when the caller omits gameInstanceId.

This behavior is forbidden.

Remove:

- the SELECT of the previous authorization's game_instance_id;
- all implicit previous-destination fallback behavior;
- tests that describe previous binding reuse as valid behavior.

Change authorizeRetry so every retry call makes an explicit destination
choice.

Required public/internal signature semantics:

```ts
authorizeRetry(
  actionId: string,
  expectedVersion: number,
  runtimeId: string,
  gameInstanceId: string | null,
): SendAuthorization;
```

The fourth argument must be required at the TypeScript level.

Runtime behavior must also fail closed:

- omitted argument / undefined:
  reject with the repository's existing INVALID_INPUT-style error;
- explicit null:
  accepted and persisted as null;
- valid nonempty string:
  normalized and persisted exactly;
- empty string:
  rejected;
- over-limit string:
  rejected;
- non-string runtime value:
  rejected.

Do not treat undefined as null for authorizeRetry.

Creation-time authorization behavior may remain source-compatible:

- createBeforeFirstSend may continue to normalize an omitted or undefined
  gameInstanceId to null when that behavior is already accepted;
- this remediation only forbids omission during retry authorization.

Every newly issued retry authorization must bind only to the explicit value
supplied for that retry.

The new authorization must not inspect or inherit a previous authorization's
destination.

Preserve all existing invariants:

- opaque SendAuthorization identity;
- single-use consumption;
- actionId binding;
- attempt-number binding;
- expected-version binding;
- runtimeId and runtime-owner fencing;
- role and clientId binding;
- authorization expiry;
- revoked/consumed guards.

Update runtime tests to prove:

1. omitted retry gameInstanceId fails closed;
2. explicit undefined fails closed;
3. explicit null succeeds and persists null;
4. explicit valid string succeeds and persists that value;
5. a retry for a new destination does not inherit the previous destination;
6. attempt recording copies only the new authorization's explicit binding;
7. mismatch still fails closed;
8. existing non-retry authorization tests remain green.

Update declaration consumers so omitting the fourth authorizeRetry argument is
a compile-time error.

Use an active @ts-expect-error for the omitted-argument case.

Do not add a "reuse_previous" escape hatch in this remediation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. F-2 MEDIUM — TIGHTEN BUDGET SNAPSHOT COMPLETENESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current defect:

BudgetAdmissionSnapshot permits null for budget-scope values that the real
DurableBudgetRepository.admit request always requires.

Change the snapshot to:

```ts
export interface BudgetAdmissionSnapshot {
  readonly gameProfileId: string;
  readonly ruleId: string;
  readonly userBudgetKey: string;
  readonly userLimit: BudgetUserWindowSnapshot;
  readonly cooldownMs: number;
  readonly ruleLimit: BudgetRuleWindowSnapshot;
  readonly globalToken: BudgetGlobalTokenSnapshot;
  readonly capacityConfig: BudgetCapacitySnapshot;
}
```

The five fields above must not be nullable:

- userLimit;
- cooldownMs;
- ruleLimit;
- globalToken;
- capacityConfig.

Keep every property readonly.

Do not add an optional or nullable bypass form.

Do not encode "disabled scope" using null.

The snapshot must remain JSON-safe and sufficient to reconstruct the complete
four-scope admission request using the current trusted processing clock.

Add declaration tests proving:

- null userLimit is rejected;
- null cooldownMs is rejected;
- null ruleLimit is rejected;
- null globalToken is rejected;
- null capacityConfig is rejected;
- missing fields remain rejected;
- valid complete snapshots compile;
- fields remain readonly.

Update Slice 1 handoff/self-review documentation to state explicitly that all
budget scopes are mandatory and non-null.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. F-3 LOW — CORRECT REVIEW-GATE STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The independent review returned REQUEST CHANGES.

Update status documents during remediation to accurately represent the gate.

Required final state after all remediation verification passes:

- Phase C: IN_PROGRESS;
- Milestone 3 architecture: RESOLVED;
- Milestone 3 Slice 1 implementation:
  REMEDIATED_AND_READY_FOR_RE_REVIEW;
- independent Slice 1 approval:
  PENDING;
- Milestone 3 concurrency-sensitive core:
  BLOCKED_BY_SLICE_1_RE_REVIEW;
- Milestones 4–5:
  BLOCKED_BY_PREVIOUS_MILESTONE;
- Phase D:
  untouched.

Do not mark Slice 1:

- APPROVED;
- APPROVED_AND_COMPLETE;
- COMPLETE.

Do not mark the concurrency-sensitive core ready or started.

Update only the necessary files:

- docs/execution/CURRENT_TASK.md;
- docs/execution/PROJECT_STATUS.md;
- docs/execution/ROADMAP.md;
- docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md;
- docs/orchestration/plans/
  PHASE-C-MILESTONE-03-DELEGATION-PLAN.md.

Preserve historical records that explicitly describe the earlier state as
history, but remove current-state claims that independent approval already
occurred.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. F-4 LOW — PORTABLE DOCUMENTATION LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update:

docs/orchestration/reviews/
PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md

Remove machine-local absolute links such as:

file:///d:/Dev/CrowdCircuit/...

Replace them with repository-relative paths in code formatting or plain text.

Example:

`apps/server/src/persistence/migrations.ts`

Do not add absolute Windows, Linux, or reviewer-sandbox paths.

Search changed documentation for:

- file:///;
- D:\Dev;
- d:/Dev;
- C:\;
- /home/claude;
- /mnt/data.

The final remediation documentation must contain none of these local paths,
except where a quoted historical error message is genuinely required and
clearly labeled.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. REMOVE DUPLICATE PROMPT COPY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Delete:

docs/orchestration/prompts/
PHASE-C-MILESTONE-03-GEMINI-01-PROMPT.md

Retain the canonical architecture-created prompt:

docs/orchestration/prompts/
PHASE-C-MILESTONE-03-GEMINI-01.md

Do not modify the canonical prompt merely to match the duplicate copy.

After deletion, verify there is only one canonical GEMINI-01 implementation
prompt in docs/orchestration/prompts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. REQUIRED REMEDIATION DOCUMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create:

docs/orchestration/reviews/
PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01-SELF-REVIEW.md

Create:

docs/handoffs/
HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01.md

Do not modify the independent review report.

Document:

- exact baseline HEAD;
- exact runtime versions;
- F-1 root cause and exact removal of fallback behavior;
- new authorizeRetry signature;
- runtime omitted/undefined failure behavior;
- explicit null/string behavior;
- F-2 non-null snapshot changes;
- declaration regressions added;
- F-3 status correction;
- F-4 portable documentation correction;
- duplicate prompt removal;
- exact changed-file list;
- exact focused and repository-wide verification counts;
- confirmation migration v3 DDL and Drizzle schema were not redesigned;
- confirmation no concurrency-sensitive core was implemented;
- confirmation no Socket.IO or Milestone 4 code was added;
- confirmation no commit or push occurred.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. FOCUSED VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use:

- Node.js v24.15.0;
- pnpm 11.9.0.

Run:

pnpm --filter @crowdcircuit/server lint
pnpm --filter @crowdcircuit/server typecheck
pnpm --filter @crowdcircuit/server test
pnpm --filter @crowdcircuit/server build
pnpm --filter @crowdcircuit/server test:declarations

Run focused tests explicitly:

pnpm --filter @crowdcircuit/server exec vitest run \
  test/persistence-slice1.test.ts

pnpm --filter @crowdcircuit/server exec vitest run \
  test/delivery-port.test.ts

pnpm --filter @crowdcircuit/server exec vitest run \
  test/migration-upgrade.test.ts

Run declarations independently:

npx tsc -p apps/server/test/tsconfig.declarations.json --noEmit

Expected previous baseline:

- server: 74 tests across 9 files;
- repository: 362 tests across 25 files.

Exact new counts are authoritative and may increase because of permanent
regression cases.

Every command must pass under Node.js >=24.2.0.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. REPOSITORY-WIDE VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run:

pnpm lint
pnpm typecheck
pnpm test
pnpm build

Run final audit:

git diff --check HEAD --
git status --short
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard

Search for scope leakage:

grep -RniE \
  "socket\.io|promoteDeferred|retryScheduler|ttlWorker|setInterval|setTimeout" \
  apps/server/src \
  || true

Use a PowerShell equivalent when required.

Required:

- no Socket.IO dependency;
- no deferred-promotion core;
- no scheduler or worker;
- no timer;
- no restart-reconciliation extension;
- no package-lock or pnpm-lock change;
- no generated build artifact tracked;
- no skipped or only tests;
- no ignored declaration suite.

Do not commit or push.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. STOP CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return BLOCKED instead of broadening scope when:

- making gameInstanceId required would break an accepted public contract that
  cannot be corrected additively;
- the current authorization interface cannot reject omitted runtime arguments
  without redesigning SendAuthorization;
- tightening snapshot nullability reveals a real admission scope that can
  legitimately be absent;
- a fix requires promotion, scheduler, TTL, or reconciliation implementation;
- migration v3 or Drizzle schema would need redesign for these findings.

Return PRODUCTION_FINDING when another existing behavior contradicts
ADR-019 through ADR-024.

Do not invent a compatibility fallback.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. REQUIRED OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return:

1. Exact branch, HEAD, Node.js, and pnpm evidence
2. Complete changed-file list
3. F-1 exact code change
4. authorizeRetry final signature
5. Omitted/undefined/null/string behavior
6. F-2 exact snapshot shape
7. New runtime tests
8. New declaration tests
9. Status-document corrections
10. Documentation-path cleanup
11. Duplicate-prompt deletion confirmation
12. Focused server verification and exact counts
13. Repository-wide verification and exact counts
14. Remediation self-review path
15. Remediation handoff path
16. Remaining findings or blockers
17. Final Git status
18. Confirmation no concurrency-sensitive core was implemented
19. Confirmation no Socket.IO or Milestone 4 code was added
20. Confirmation no commit or push occurred
