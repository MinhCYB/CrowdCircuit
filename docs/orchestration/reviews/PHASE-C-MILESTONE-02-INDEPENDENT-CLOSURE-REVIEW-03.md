# Phase C Milestone 2 — Independent Closure Review 03

**Date:** 2026-07-26
**Reviewer scope:** Independent closure review after Codex core, Gemini
additive, Independent Focused Review 02, and Remediation 01.
**Repository:** https://github.com/MinhCYB/CrowdCircuit
**Branch reviewed:** `review/phase-c`

---

## 1. Exact Repository HEAD and Runtime Evidence

```
branch:            review/phase-c
HEAD:              c54b288a6fa0016adf941fcefb2afb894e19c874
HEAD (short):       c54b288
HEAD is an ancestor check: ab4a1cd IS an ancestor of HEAD (HEAD is newer)
working tree:      clean
```

Recent history:

```
c54b288 (HEAD -> review/phase-c, origin/review/phase-c) fix: remediate Phase C milestone 2 review findings
ab4a1cd wip: add Phase C milestone 2 additive coverage
e3d6002 wip: implement Phase C milestone 2 core
675271b docs: resolve Phase C milestone 2 architecture
824e7e4 wip: checkpoint approved Phase C milestone 1
```

Required checkpoint files — all present:

- `apps/server/test/budget-concurrency-worker.ts` — FOUND
- `apps/server/test/budget-concurrency.test.ts` — FOUND
- `apps/server/test/migration-upgrade.test.ts` — FOUND
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02-REMEDIATION-01.md` — FOUND
- `docs/orchestration/reviews/PHASE-C-MILESTONE-02-REMEDIATION-01-GEMINI-SELF-REVIEW.md` — FOUND

Baseline gate: **PASSED** (not `REPOSITORY_BLOCKED`).

### Runtime / environment result — ENVIRONMENT_BLOCKED for Node 24 specifically

- The sandbox's container image ships Node.js **v22.22.2** and no `pnpm`
  binary (`pnpm` was obtained via `corepack prepare pnpm@11.9.0 --activate`,
  which succeeded — pnpm 11.9.0 requirement is satisfiable).
- The container's network egress allowlist does **not** include
  `nodejs.org` (or any Node.js binary distribution mirror), and the only
  `apt`/`nodesource` channel configured is the Node 22.x line
  (`deb.nodesource.com/node_22.x`), which is also outside the network
  allowlist. `n 24.15.0` was attempted and failed with `curl: (22) The
  requested URL returned error: 403` against
  `https://nodejs.org/dist/v24.15.0/...` — confirming Node.js 24 genuinely
  cannot be obtained inside this review environment.
- `package.json` declares `"engines": {"node": ">=24.2.0"}` for the workspace
  packages touched by this milestone; every `pnpm` invocation under Node 22
  printed `[WARN] Unsupported engine: wanted: {"node":">=24.2.0"} (current:
  "v22.22.2")`.
- Per instruction: **"Do not issue a final approval-class verdict using
  Node.js 22 evidence."** All test/lint/typecheck runs below were executed
  under Node 22 purely as supplementary, non-authoritative evidence to
  support the closure-matrix review; none of them substitute for the
  required Node 24 verification.

Given Node.js ≥24.2.0 could not be obtained in this environment, this review
cannot complete the mandatory "Fresh Verification Under Node 24" gate, and
per Section 7 of the instructions this stops the review at
**ENVIRONMENT_BLOCKED**. The remainder of this document records everything
that could be independently verified by static analysis, code inspection,
and supplementary Node-22 execution, so that a Node-24-capable reviewer can
close this out quickly.

---

## 2. Complete Accumulated Diff Scope (baseline `675271b..HEAD`)

```
git diff --stat 675271b..HEAD  → 38 files changed, 4658 insertions(+), 92 deletions(-)
git diff --check 675271b..HEAD → only trailing-whitespace/EOF-blank-line hits,
                                   all inside Markdown files using intentional
                                   two-space hard-line-break syntax; no
                                   whitespace issues in any source file.
```

Full file list (`git diff --name-status 675271b..HEAD`): 6 modified + 1 added
under `apps/server/src/persistence/`; 5 new/modified test files under
`apps/server/test/`; 6 new/modified files under `packages/mapping-engine/src`
and `test/`; the remaining changes are docs (`ADR`s, handoffs, self-reviews,
`PROJECT_STATUS.md`, `CURRENT_TASK.md`, `ROADMAP.md`), `package.json`/
`tsconfig.json` plumbing, and `pnpm-lock.yaml`.

**No Milestone 3 implementation exists in the diff:**

- No final `actionId` allocation code.
- No Action Gateway action-creation code.
- No transport-send code.
- No Socket.IO usage (`grep` for `socket.io` in the changed source files:
  0 hits).
- No durable deferred queue implementation.
- No retry worker.
- No SDK or game-delivery behavior.

This matches ADR-017's boundary (Milestone 2 returns typed
accepted/rejected/dropped/deferred results only; Milestone 3 owns the queue).

---

## 3. Closure Matrix

| Finding | Verdict |
|---|---|
| H-1 — Genuine SQLite budget concurrency | **RESOLVED** |
| H-2 — Real schema v1→v2 upgrade | **RESOLVED** |
| M-1 — Environment-independent ordering | **RESOLVED** |
| M-2 — Collision-safe durable budget key | **RESOLVED** |
| M-3 — Safe path resolution | **RESOLVED** |
| M-4 — Drizzle index parity | **RESOLVED** |
| M-5 — Permanent declaration execution | **RESOLVED** |

All previously confirmed findings show genuine, code-level resolution.
Final approval is nonetheless withheld at the environment gate — see
Section 1 and the Verdict.

---

## 4. Six-Scenario Genuine-Concurrency Assessment (H-1)

`apps/server/test/budget-concurrency-worker.ts` (38 lines) runs inside a real
`node:worker_threads` `Worker`, opens its own
`SqliteDurableActionRepository.open({ filename, runtimeOwnerRandom })`
connection against the **same** temporary SQLite file as its sibling worker,
and uses an explicit `ready` → `go` postMessage handshake before calling
`repository.admit(...)`. There is no `Promise.all` over a single shared
in-process repository object standing in for real concurrency, and no
`setTimeout`/sleep-based synchronization anywhere in the file.

`apps/server/test/budget-concurrency.test.ts` (287 lines) implements all six
required scenarios, each spinning up two real worker threads against a fresh
`mkdtempSync` SQLite file, releasing both with a synchronized `go` message,
and then asserting on the returned typed results **and** on rows read back
through a separate `node:sqlite` `DatabaseSync` connection:

| # | Scenario | Test | Admits==1 | Typed loser reason | Durable-row check |
|---|---|---|---|---|---|
| A | Final per-user window slot | `A. enforces final per-user window slot under contention` | ✅ | `USER_LIMIT` | user_events, rule_events, cooldowns counts == 1; token math verified |
| B | Shared anonymous bucket | `B. enforces shared anonymous bucket under contention without duplicate rows` | ✅ | `USER_LIMIT` | user_buckets/user_events counts == 1 (no duplicate rows) |
| C | Rule cooldown | `C. enforces rule cooldown under contention` | ✅ | `RULE_COOLDOWN` | `last_accepted_at` asserted exactly |
| D | Final per-rule sliding-window slot | `D. enforces final rule-window slot under contention` | ✅ | `RULE_LIMIT` | rule_events count == 1 |
| E | Final global token | `E. enforces final global token under contention` | ✅ | `GLOBAL_LIMIT` | remaining token count asserted exactly (0) |
| F | Final tracked-user capacity slot | `F. enforces final tracked-user capacity slot under contention` | ✅ | `CAPACITY_EXHAUSTED` | winner's bucket exists; loser's bucket/events rows explicitly asserted `undefined` (no partial cross-scope mutation) |

No production bypass or weakened runtime-ownership path is introduced; the
worker calls the same `admit` path production code uses, through the same
`SqliteDurableActionRepository`.

**Supplementary Node-22 execution (non-authoritative):** all 6 scenarios
**failed to execute** under Node 22 with an identical, uniform error:

```
Error: Cannot find module '.../apps/server/src/persistence/repository.js'
imported from '.../apps/server/test/budget-concurrency-worker.ts'
```

Root cause is a `tsx@^4.20.3` `--import` ESM loader-hook incompatibility
under Node 22 — the pre-existing Milestone-1 worker-thread test
(`test/persistence.test.ts > ... serializes matching and conflicting
duplicate creates across two connections`, which uses the same
`--import tsx` mechanism via `repository-concurrency-worker.ts` and predates
this remediation entirely) fails with the exact same error under Node 22.
This is strong evidence the failure is a Node-22-vs-24 module-hook
regression in the harness, not a defect introduced by the Milestone 2
remediation — but it also means genuine execution/flake evidence for H-1
could only be obtained under Node 24, and per instruction that evidence
cannot be gathered in this environment. All other server tests not using
worker threads (53 of 60 supplementary tests) passed under Node 22.

**Verdict: RESOLVED** (by code inspection: real threads, real independent
connections, real contention, exact admission counts, typed rejection
reasons, durable-row assertions, no duplicate/partial state — all present
and correctly targeted). Execution confirmation is blocked on Node 24
per Section 1.

---

## 5. Real v1→v2 Migration Assessment (H-2)

`apps/server/test/migration-upgrade.test.ts` (223 lines, 1 test) performs
exactly the required 10-step sequence:

1. Applies **only** `MIGRATIONS.filter(m => m.version === 1)` — `appliedV1 === 1`.
2. Verifies `schema_versions` contains only version 1 (`phase-c-foundation`).
3. Verifies zero `mapping_budget_%` tables exist yet.
4. Seeds representative Milestone-1 rows across `runtime_ownership`,
   `game_profiles`, `event_mappings`, `action_logs`, `action_attempts`, and
   `action_send_authorizations`.
5. Captures each seeded row via `SELECT *` before closing.
6. Closes the v1 database (`dbV1.close()`).
7. Reopens with the **full current manifest** (`MIGRATIONS`) —
   `appliedV2 === 2` (only the pending version-2 migration is applied; it
   does not re-apply version 1).
8. Verifies `schema_versions` now records versions 1 and 2, that all six
   `mapping_budget_*` tables and the three named indexes exist, and that
   every Milestone-1 row captured in step 5 is `toEqual` its pre-migration
   snapshot (byte-for-byte / field-for-field).
9. Reopens a third time and calls `migrateDatabase` again, asserting it does
   not throw and that `MAX(version)` is still `2` — proving idempotency.

This is a genuine two-stage upgrade of a database that already contains
Milestone-1 data through a real close/reopen boundary — not a fresh empty
database migrated through both versions in a single startup.

**Supplementary Node-22 execution:** passed (`✓ test/migration-upgrade.test.ts (1 test)`).

**Verdict: RESOLVED.**

---

## 6. Ordering Assessment (M-1)

`compareRules` in `packages/mapping-engine/src/engine.ts`:

```ts
function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareRules(left: MappingRule, right: MappingRule): number {
  return (
    right.priority - left.priority ||
    specificity(right) - specificity(left) ||
    compareOrdinal(left.createdAt, right.createdAt) ||
    compareOrdinal(left.id, right.id)
  );
}
```

`compareOrdinal` uses plain ECMAScript `<`/`>` string comparison, which is
UTF-16 code-unit ordinal comparison — deterministic and independent of
`Intl`/locale/ICU state. A repository-wide `grep -rn "localeCompare"` across
`packages/mapping-engine/src` and `apps/server/src` returned **zero** hits —
no default-locale comparator remains anywhere in the frozen ordering path.

`packages/mapping-engine/test/milestone-02.black-box.test.ts` contains
permanent cases for non-ASCII schema-valid IDs, `createdAt`-ascending
tie-breaks, `ruleId`-ascending tie-breaks, input-order independence, and
repeat-evaluation stability (verified present via targeted grep and file
inspection).

**Verdict: RESOLVED.**

---

## 7. Budget-Key and Versioning Assessment (M-2)

`packages/mapping-engine/src/engine.ts`:

```ts
const USER_BUDGET_KEY_FORMAT_VERSION = 1 as const;

function userBudgetKey(event: LiveEvent, gameProfileId: string, ruleId: string): string {
  const identity =
    event.user !== null && typeof event.user.id === "string" && event.user.id.length > 0
      ? { kind: "id" as const, value: event.user.id }
      : event.user !== null && typeof event.user.uniqueId === "string" && event.user.uniqueId.length > 0
        ? { kind: "uniqueId" as const, value: event.user.uniqueId }
        : { kind: "anonymous" as const, value: null };
  return canonicalJson({
    keyFormatVersion: USER_BUDGET_KEY_FORMAT_VERSION,
    gameProfileId,
    ruleId,
    identity,
  });
}
```

- `USER_BUDGET_KEY_FORMAT_VERSION` is module-local (`grep` for an `export`
  of it returned zero matches) and is a distinct constant from
  `MAPPING_SEED_FORMAT_VERSION`, which is imported and used separately in
  `createCandidateSeed` (`packages/mapping-engine/src/canonical.ts`) — the
  two versions cannot alias.
- Precedence is `id` before `uniqueId` before anonymous, matching ADR-014.
- Because the key is a canonical, key-sorted JSON object
  (`canonicalJson` in `canonical.ts` sorts object keys and recursively
  serializes, rather than concatenating raw strings with separators), the
  `id`/`uniqueId`/`anonymous` namespaces are structurally distinguished by
  the `kind` discriminant field and cannot alias regardless of the
  characters present in `value` — the old concatenated-separator collision
  class (colons, slashes, control characters, `\u001f`, anonymous-shaped
  values) is structurally eliminated, not merely tested around.
- `displayName`, `avatarUrl`, provider payload, timestamps, and randomness
  do not appear anywhere in `userBudgetKey`.
- `candidate seed generation` (`createCandidateSeed`) is untouched by this
  change and still depends only on `MAPPING_SEED_FORMAT_VERSION`,
  `gameProfileId`, `ruleId`, `eventId`, `candidateOrdinal`, `actionType`,
  and `params` — confirmed unaffected by the budget-key format change.

`packages/mapping-engine/test/milestone-02.black-box.test.ts` contains
`prevents profile/rule separator aliasing collisions` and `prefers user.id
over user.uniqueId when both are present`, plus adversarial fixtures
covering the character classes called out in the finding.

**Verdict: RESOLVED.**

---

## 8. Safe Path-Resolution Assessment (M-3)

`readPath` in `packages/mapping-engine/src/engine.ts`:

```ts
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function readPath(root: object, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    if (FORBIDDEN_SEGMENTS.has(segment)) return undefined;
    if (!Object.hasOwn(current, segment)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(current, segment);
    if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || !("value" in descriptor)) {
      return undefined;
    }
    current = descriptor.value;
  }
  return current;
}
```

This rejects `__proto__`/`prototype`/`constructor` segments, requires
`Object.hasOwn` (so inherited properties are never traversed), reads the
own-property descriptor rather than dereferencing through the object
directly (so an own accessor/getter is never invoked — the function checks
`descriptor.get`/`descriptor.set` are both `undefined` and that `"value" in
descriptor` before accepting it), and fails closed to `undefined` on any
rejection branch. `readPath` is not exported from the package.

**Verdict: RESOLVED** (permanent test coverage for inherited property,
inherited getter, own getter, forbidden segments, absent property, and
normal nested own data property was confirmed present in
`milestone-02.black-box.test.ts`/`core.test.ts` by inspection).

---

## 9. Drizzle Index-Parity Assessment (M-4)

`apps/server/src/persistence/schema.ts` vs.
`apps/server/src/persistence/migrations.ts`:

| Index | Drizzle (`schema.ts`) columns | Raw SQL (`migrations.ts`) columns | Match |
|---|---|---|---|
| `mapping_budget_user_events_window_idx` | `profileId, ruleId, userKey, admittedAt` | `profile_id, rule_id, user_key, admitted_at` | ✅ exact order |
| `mapping_budget_rule_events_window_idx` | `profileId, ruleId, admittedAt` | `profile_id, rule_id, admitted_at` | ✅ exact order |
| `mapping_budget_user_buckets_cleanup_idx` | `profileId, lastActiveAt, ruleId, userKey` | `profile_id, last_active_at, rule_id, user_key` | ✅ exact order |

Index names match exactly on both sides. A repository search for the
incorrect legacy names `user_rate_windows` / `user_bucket_key` returned
**zero** hits anywhere under `apps/server/src`.

**Verdict: RESOLVED.**

---

## 10. Declaration-Command Assessment (M-5)

`packages/mapping-engine/package.json`:

```json
"test:declarations": "tsc -p test/tsconfig.declarations.json --noEmit && tsc -p test/tsconfig.phase-c-milestone-02.json --noEmit"
```

Both configs are chained in the single package command. Both were also run
individually under Node 22 (`npx tsc -p .../tsconfig.declarations.json
--noEmit` and `npx tsc -p .../tsconfig.phase-c-milestone-02.json --noEmit`)
and completed with no diagnostics. `@ts-expect-error` directives in
`packages/mapping-engine/test/declaration-consumer.ts` and
`packages/mapping-engine/test/phase-c-milestone-02.declaration-consumer.ts`
remain in place; none were removed or weakened relative to what the
negative-case declaration tests require to compile cleanly.

**Verdict: RESOLVED.**

---

## 11. Additional Regression Assessment (Section 4 of the instructions)

Confirmed present via targeted search of
`packages/mapping-engine/test/milestone-02.black-box.test.ts` and
`packages/mapping-engine/test/core.test.ts`:

- `enforces exact cooldown boundary: reject at expiry - 1ms, admit at exact expiry, admit at expiry + 1ms` — covers all three cooldown-boundary cases in one permanent test.
- `prefers user.id over user.uniqueId when both are present`.
- `resolves comment templates and does not consume budget during dry run` — dry-run consumes no budget; a separate dry-run diagnostic note in `engine.ts` (JSDoc on `evaluate`) explicitly states dry-run does not prove real admission success.
- `cooldown rejection changes no later budget state` — candidate idempotency seed / no-side-effect coverage for the rejection path.
- `prevents profile/rule separator aliasing collisions` — no old separator-based key expectation remains; the canonical-JSON key format replaces it structurally (see Section 7).

**Verdict: RESOLVED.**

---

## 12. Status/Documentation Assessment

`docs/execution/PROJECT_STATUS.md` states:

- Phase C status: `IN_PROGRESS` ✅
- Current milestone: `PHASE-C-MILESTONE-02 — READY_FOR_FOCUSED_REVIEW` ✅ (not `DONE`/`APPROVED`/`COMPLETE`)
- `Remediation 01 status: COMPLETE` ✅
- Milestones 3–5: `BLOCKED_BY_PREVIOUS_MILESTONE` ✅
- Runtime baseline listed as Node.js v24.15.0 / pnpm 11.9.0 — consistent with the required environment, even though this reviewer could not reproduce that runtime.

No occurrence of Milestone 2 being marked `DONE`, `APPROVED`, or `COMPLETE`
was found in `PROJECT_STATUS.md`, `CURRENT_TASK.md`, or `ROADMAP.md`.

Remediation documents (`HANDOFF-PHASE-C-MILESTONE-02-REMEDIATION-01.md`,
`PHASE-C-MILESTONE-02-REMEDIATION-01-GEMINI-SELF-REVIEW.md`) were read and
their claims cross-checked against the actual code in Sections 4–11 above
rather than trusted at face value, per the "treat every handoff/self-review
claim as untrusted until independently verified" instruction.

**Verdict: RESOLVED / accurate.**

---

## 13. Focused Verification Results (Supplementary — Node.js v22.22.2, NOT authoritative)

Executed for context only; **do not** treat as satisfying the Node-24 gate.

```
mapping-engine lint            → clean (0 diagnostics)
mapping-engine typecheck       → clean (0 diagnostics)
mapping-engine test            → 2 files, 42 tests, all passed (matches "~42 tests")
mapping-engine build           → clean
mapping-engine test:declarations (combined + both individually) → clean

server lint                    → clean (0 diagnostics)
server typecheck               → clean (0 diagnostics)
server build                   → clean
server test:declarations       → clean
server test                    → 7 files, 60 tests: 53 passed, 7 failed
                                  (all 7 failures are worker-thread tests —
                                  6 in budget-concurrency.test.ts, 1 in the
                                  pre-existing Milestone-1
                                  persistence.test.ts — failing identically
                                  with the tsx/Node-22 module-hook error
                                  described in Section 4; no other server
                                  test failed)
```

## 14. Repository-Wide Verification Results (Supplementary — Node 22)

```
pnpm lint       → clean across all packages
pnpm typecheck  → clean across all packages
pnpm build      → clean (after building event-core/connector-mock, which
                  were not pre-built in the fresh clone — a build-order
                  artifact, not a code defect; unrelated Phase B packages,
                  no Milestone 2 files involved)
pnpm test       → 23 files, 348 expected: after building all workspace
                  packages, 23 test files ran; 326 tests collected
                  (319 passed, 7 failed). The 7 failures are the same
                  worker-thread/tsx-under-Node-22 failures described above.
                  The ~348 expected-count figure from the prompt was not
                  exactly reproduced under Node 22; given the uniform,
                  single-root-cause nature of the failures and that they
                  are concentrated in exactly the worker-thread tests,
                  this is treated as further evidence that Node 24 is
                  required for a trustworthy count rather than as a
                  distinct defect.
```

```
git diff --check 675271b..HEAD  → only Markdown hard-line-break trailing
                                    whitespace (expected, not an issue)
git status                       → clean, still on review/phase-c
git ls-files --others --exclude-standard → no untracked files outside
                                    node_modules/dist build artifacts
```

## 15. Final Git Status

```
On branch review/phase-c
Your branch is up to date with 'origin/review/phase-c'.
nothing to commit, working tree clean
```

## 16. Confirmation — No Production Files Modified by the Reviewer

Confirmed. Only this review document was created
(`docs/orchestration/reviews/PHASE-C-MILESTONE-02-INDEPENDENT-CLOSURE-REVIEW-03.md`).
No file under `apps/`, `packages/`, or any other `docs/` path was modified,
added, or deleted by this review. `git status` shows a clean working tree
against `HEAD` other than the new review file itself (created after the
status check above, prior to being written to disk).

## 17. Confirmation — No Commit or Push Occurred

Confirmed. No `git commit` or `git push` was executed at any point during
this review.

## 18. Confirmation — Milestone 3 Not Begun

Confirmed. See Section 2; no Milestone 3 implementation exists in the
reviewed diff, and none was added by this review.

---

## Verdict

# ENVIRONMENT_BLOCKED

**Reason:** Node.js ≥24.2.0 cannot be obtained inside this review
environment (no route to `nodejs.org` or an equivalent Node-24 distribution
channel under the container's network egress allowlist; the only
Node-version channel configured, `nodesource/node_22.x`, is itself outside
that allowlist). pnpm 11.9.0 is obtainable via `corepack` and is not the
blocker.

Every closure-matrix finding (H-1, H-2, M-1 through M-5) was independently
verified by direct code and test inspection and is assessed as
**RESOLVED** with no regressions and no Milestone 3 leakage, and static
checks (lint/typecheck/build/declarations) plus 319/326 supplementary
Node-22 tests passed cleanly, with all 7 remaining failures attributable to
one uniform, pre-existing worker-thread/`tsx`-under-Node-22 loader
incompatibility rather than a Milestone 2 defect. However, per explicit
instruction this review must not issue an approval-class verdict
(`APPROVE` / `APPROVE WITH SMALL FIX` / `REQUEST CHANGES`) using Node 22
evidence, and the mandatory Section 6 "Fresh Verification Under Node 24"
gate could not be executed. A reviewer with access to Node.js ≥24.2.0
should be able to close this out quickly using the closure matrix above as
a starting point — the underlying engineering work appears complete and
correct.
