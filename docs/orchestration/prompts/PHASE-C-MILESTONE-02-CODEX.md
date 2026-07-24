# CODEX Implementation Prompt — Phase C Milestone 2

## Gate

Do not execute this prompt until decisions M2-D1 through M2-D6 in
`docs/orchestration/plans/PHASE-C-MILESTONE-02-DELEGATION-PLAN.md` are selected
by the product owner and recorded in `docs/execution/DECISIONS.md`.

If any remains unresolved, return `BLOCKED_DECISION`; do not implement.

## Task and objective

**Task:** PHASE-C-MILESTONE-02 (`BE-05A`–`BE-05E`, `BE-06A`–`BE-06B`)  
Implement the correctness-sensitive mapping and action-budget core: approved
Phase B normalized event plus validated profile/manifest to deterministic,
JSON-safe action candidates and diagnostics under bounded rule/user/game
budgets.

## Reading order

1. Current repository state and exact working-tree diff
2. `docs/execution/CURRENT_TASK.md`
3. `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md`
4. `docs/orchestration/plans/PHASE-C-MILESTONE-02-DELEGATION-PLAN.md`
5. Recorded M2 decisions in `docs/execution/DECISIONS.md`
6. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-01-COMPLETE.md`
7. `docs/handoffs/HANDOFF-PHASE-B-COMPLETE.md`
8. System Design sections 11.5, 11.9, 15, 18, and the precise mapping error
   and testing sections referenced from them
9. Existing contracts, mapping-engine package, and relevant server repository
   interfaces

## Preflight

Run and record:

```text
git status
git rev-parse --short HEAD
git diff --stat HEAD --
git diff --check HEAD --
node --version
pnpm --version
pnpm --filter @crowdcircuit/mapping-engine lint
pnpm --filter @crowdcircuit/mapping-engine typecheck
pnpm --filter @crowdcircuit/mapping-engine test
pnpm --filter @crowdcircuit/mapping-engine build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If a package script does not yet exist, inspect it and add only the focused
real script required by this milestone.

## Allowed paths

- `packages/mapping-engine/**`
- focused mapping/budget composition and repository-adapter files under
  `apps/server/src/**` and `apps/server/test/**`
- the smallest necessary server migration/schema changes required by the
  selected durable budget decision
- package manifests, lockfile, root references, and TypeScript configs only as
  mechanically required
- `packages/contracts/**` only if an independently demonstrated existing
  contract gap is documented and reviewed before modification
- focused Milestone 2 handoff/self-review and current execution documents

Preserve all accumulated Milestone 1 and Phase B work.

## Required implementation checkpoints

1. Freeze strict mapping profile, rule, condition, template, manifest, result,
   candidate, diagnostic, clock, ID-input, and budget interfaces from the
   recorded decisions. Add runtime and package-name declaration tests first.
2. Implement safe field selection, approved operators, exact specificity,
   deterministic ordering, `all`/`first`/`exclusive_group`, parameter
   resolution, JSON safety, manifest validation, and side-effect-free dry-run.
3. Implement the selected per-user/per-rule/cooldown/global budget semantics
   with atomic admission, injected time, concurrency safety, bounded state,
   cleanup, failure rollback, and selected restart behavior.
4. Integrate only the Phase B normalized-event input and the future durable
   Action Gateway candidate/deferred-decision output boundary.
5. Inspect exact diff, run focused and repository verification, inspect emitted
   JavaScript/declarations/dist, and write the milestone handoff and self-review.

## Invariants

- One event yields deterministic zero/one/many results according to match mode.
- Ordering is priority DESC, specificity DESC, createdAt ASC, ruleId ASC.
- Input objects are not mutated and normalized facts are not fabricated.
- Nullable contract values remain null; undefined is not invented.
- Parameters and diagnostics are JSON safe and finite-number safe.
- Invalid configuration fails atomically before budget consumption.
- Dry-run never consumes budget or writes action state.
- A candidate consumes budgets only under the selected atomic admission rule.
- State, caches, and queues are explicitly bounded and deterministically
  cleaned.
- Milestone 2 never sends an action and never substitutes volatile state for
  required durability.
- No `any`, `z.any()`, unsafe assertions, unchecked casts, production
  wall-clock/random use, or swallowed failures.

## Required positive and negative tests

Cover all operators and type mismatches; exact tie ordering; each match mode;
exclusive groups; zero/one/many outputs; missing/null normalized fields;
safe templates; invalid/missing template paths; JSON-unsafe/non-finite output;
manifest mismatch; malformed/duplicate/conflicting configuration; invalid
regex; disabled/wrong-event rules; each specificity weight; rule cooldown;
per-user and per-rule minute boundaries; anonymous identity; global bucket
refill/burst; every overflow policy; bounded cleanup/capacity; clock rollback
policy if selected; restart state; atomic multi-scope admission; concurrent
admission; persistence unavailable/rollback; dry-run non-mutation; deterministic
diagnostic and candidate order.

Use fake clock/ID/storage behind frozen interfaces and real SQLite integration
tests where the selected durability decision requires it.

## Declaration and package checks

Using package-name imports, prove valid public construction and reject invalid
operators, match modes, conditions, limits, timestamps, templates, candidates,
diagnostics, non-JSON values, and wrong event/action parameter types. Preserve
all prior LIVE/action/voice/fixture/auth declaration regressions.

Build cleanly; inspect mapping-engine root declarations and JavaScript, server
output, export maps, and dist inventory. No test/source/absolute-path/internal
symbol leakage.

## Exclusions

Do not implement Action Gateway state transitions, transport, Socket.IO, SDK,
demo game, UI, voice, Phase D, or Milestones 3–5. Do not change approved event
or action wire behavior. Do not create an in-memory production substitute.

## Documentation and handoff

Update only current Milestone 2 execution state and create:

`docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02.md`

Record selected decisions, exact files, API boundaries, tests/counts, command
output, dist inspection, limitations, Git status, and explicit Milestone 3
boundary. Preserve historical reports.

## Final verification

Run focused package/server checks, declaration checks, relevant real-SQLite
tests, then:

```text
git diff --check HEAD --
CI=true pnpm lint
CI=true pnpm typecheck
CI=true pnpm test
CI=true pnpm build
```

## Git and final response

Do not commit or push. Return checkpoints completed, files changed, API/schema
impact, runtime/declaration/migration evidence, exact test counts, dist
assessment, scope assessment, Git status, and any blocker.
