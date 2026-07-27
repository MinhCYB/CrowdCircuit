# Phase C Milestone 3 Slice 1 — Independent Re-Review 02

**Reviewer role:** Independent focused re-reviewer, post Gemini Remediation 01.
**Repository:** https://github.com/MinhCYB/CrowdCircuit
**Branch:** `review/phase-c`

---

## 0. Baseline gate — evidence

```
git rev-parse HEAD        → b256e386cfc457412c6f2e08692d1ec2fb58d7b9
git rev-parse --short HEAD → b256e38   (= REMEDIATION_COMMIT)
git branch --show-current  → review/phase-c
git status                 → clean working tree
node --version              → v22.22.2
pnpm --version               → 11.9.0  (via corepack; not preinstalled)
```

```
git log --oneline --decorate -12
b256e38 (HEAD, origin/review/phase-c) fix: remediate Phase C milestone 3 slice 1 review findings
f50ec91 docs: add Phase C milestone 3 slice 1 independent review
4f33f53 wip: add Phase C milestone 3 schema and interface slice
e70e97b docs: resolve Phase C milestone 3 architecture
15eb07c docs: close Phase C milestone 2
c54b288 fix: remediate Phase C milestone 2 review findings
ab4a1cd wip: add Phase C milestone 2 additive coverage
e3d6002 wip: implement Phase C milestone 2 core
675271b docs: resolve Phase C milestone 2 architecture
824e7e4 wip: checkpoint approved Phase C milestone 1
86f1a32 (tag: phase-b-complete, origin/main, origin/HEAD, main) feat: complete Phase B event pipeline
8c3f2e4 feat: complete Phase A contract foundation
```

```
git merge-base --is-ancestor 4f33f53 HEAD  → OK (ancestor)
git merge-base --is-ancestor f50ec91 HEAD  → OK (ancestor)
```

**Node.js / pnpm requirement:** the repository's runtime baseline (`PROJECT_STATUS.md`, `package.json` engines) requires Node.js **v24.15.0 / ≥24.2.0** and **pnpm 11.9.0**. This sandbox's system Node is **v22.22.2**; `apt-cache madison nodejs` offers only 22.x packages, and `nodejs.org` is not reachable through this sandbox's egress allowlist (`x-deny-reason: host_not_allowed`). **True Node ≥24.2.0 verification could not be executed in this sandbox.** pnpm 11.9.0 itself was obtainable via `corepack prepare pnpm@11.9.0 --activate` and ran correctly.

ADR-019 through ADR-024 are present in `docs/execution/DECISIONS.md` (lines 432, 468, 509, 548, 583, 616). Original review, remediation self-review, and remediation handoff all exist at their expected paths.

**Repository baseline gate: PASSED** (not `REPOSITORY_BLOCKED`). **Node ≥24.2.0 could not be obtained — this is disclosed and factored into the final verdict per the guidance that a substantive defect found independently of runtime can still determine the verdict.** A genuine, code-independent defect *was* found (Section 6, F-4), so this review does not terminate early as `ENVIRONMENT_BLOCKED`; instead it reports the full closure matrix plus the environment limitation, consistent with "no independent substantive defect already determines another verdict" not holding here.

---

## 1. Complete remediation diff scope

```
git diff --stat f50ec91..b256e38
 apps/server/src/persistence/repository.ts                                     |   21 +-
 apps/server/src/persistence/types.ts                                          |   12 +-
 apps/server/test/declaration-consumer.ts                                      |   27 +-
 apps/server/test/persistence-slice1.test.ts                                   |   56 +-
 apps/server/test/persistence.test.ts                                          |   13 +-
 docs/execution/CURRENT_TASK.md                                                |    8 +-
 docs/execution/PROJECT_STATUS.md                                              |    8 +-
 docs/execution/ROADMAP.md                                                     |    2 +-
 docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01.md        |   59 ++
 docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01.md                       |    9 +-
 docs/orchestration/plans/PHASE-C-MILESTONE-03-DELEGATION-PLAN.md              |    2 +-
 docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md                            |    2 +-
 docs/orchestration/prompts/PHASE-C-MILESTONE-03-GEMINI-01-PROMPT.md           | 1044 (deleted)
 docs/orchestration/reviews/...GEMINI-01-REMEDIATION-01-SELF-REVIEW.md         |   56 ++ (new)
 docs/orchestration/reviews/PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md      |   20 +-
 docs/orchestration/prompts/...SLICE-01-INDEPENDENT-REVIEW-01.md → docs/orchestration/reviews/...   (R100, pure rename)
 16 files changed, 229 insertions(+), 1110 deletions(-)
```

`git diff --name-status f50ec91..b256e38` confirms file-status codes: 8 `M` (2 code, 3 test, 5 doc-status), 1 `A` (new remediation handoff), 1 `A` (new remediation self-review), 1 `D` (duplicate prompt deleted), 1 `R100` (independent review moved `prompts/` → `reviews/`).

**Scope confirmed narrow and matches the expected remediation categories exactly:** explicit retry destination binding (repository.ts/types.ts), `BudgetAdmissionSnapshot` nullability tightening (types.ts), focused runtime/declaration regressions (declaration-consumer.ts, persistence*.test.ts), review-gate status corrections (5 execution/plan docs), documentation path cleanup (new handoff/self-review docs, existing self-review edit), duplicate prompt cleanup (deletion + rename), and remediation evidence (2 new docs). No file outside this list was touched.

`git diff --check f50ec91..b256e38` reports 9 "trailing whitespace" warnings, **all** on lines ending in two trailing spaces inside two new documentation files (`HANDOFF-...-REMEDIATION-01.md`, `...REMEDIATION-01-SELF-REVIEW.md`). These are intentional Markdown hard-line-break syntax (`  ` at end of line), not real whitespace defects, and appear only in prose metadata headers, not in code, tests, or data. Noted as informational, not a finding.

**Confirmed NOT changed** (verified via empty `git diff --stat` for each path across `f50ec91..b256e38`): `apps/server/src/persistence/schema.ts`, `migrations.ts`, `authorization.ts`, `budget.ts`, `index.ts`; `apps/server/test/delivery-port.test.ts`, `migration-upgrade.test.ts`. No migration-v3 DDL, Drizzle schema, delivery-port shape, deferred promotion logic, retry scheduler, TTL worker, restart reconciliation, or action-ID derivation changed. No Socket.IO, SDK, or Milestone 4 code exists anywhere in the tree (confirmed via `git grep`, Section 5).

---

## 2. Closure matrix

| Finding | Verdict |
|---|---|
| **F-1** High — stale `gameInstanceId` fallback in `authorizeRetry` | **RESOLVED** |
| **F-2** Medium — nullable `BudgetAdmissionSnapshot` budget scopes | **RESOLVED** |
| **F-3** Low — premature `APPROVED_AND_COMPLETE` status | **RESOLVED** |
| **F-4** Low — machine-local documentation links | **PARTIALLY_RESOLVED** — original instance fixed; a new instance of the identical defect was introduced in a file created by this same remediation |
| **H-1** Hygiene — duplicate prompt/review file placement | **RESOLVED** |

Detail for each follows in Sections 3–6.

---

## 3. F-1 — authorizeRetry destination binding

### Final interface (verified directly in code, not trusted from docs)

`apps/server/src/persistence/types.ts`:

```ts
authorizeRetry(
  actionId: string,
  expectedVersion: number,
  runtimeId: string,
  gameInstanceId: string | null,
): SendAuthorization;
```

The prior optional `gameInstanceId?: string | null` is now `gameInstanceId: string | null` — **required at the TypeScript level, no overload, no optional form remains.**

### Implementation (`apps/server/src/persistence/repository.ts`)

```diff
   ): SendAuthorization {
     try {
       this.#database.exec("BEGIN IMMEDIATE");
       this.#requireActiveOwner(true);
+      if (gameInstanceId === undefined) {
+        throw new PersistenceError("INVALID_INPUT", "Game instance ID is required for retry authorization");
+      }
       ...
-      let targetGameInstanceId: string | null = null;
-      if (gameInstanceId !== undefined) {
-        targetGameInstanceId = normalizeGameInstanceId(gameInstanceId);
-      } else {
-        const prevAuth = this.#database
-          .prepare(
-            `SELECT game_instance_id FROM action_send_authorizations
-             WHERE action_id = ? ORDER BY attempt_number DESC LIMIT 1`,
-          )
-          .get(actionId);
-        targetGameInstanceId = ...
-      }
+      const targetGameInstanceId = normalizeGameInstanceId(gameInstanceId);
```

The previous-authorization `SELECT ... ORDER BY attempt_number DESC LIMIT 1` fallback query is **entirely removed**, not merely bypassed.

### Evidence no stale destination fallback remains

```
git grep -n "SELECT game_instance_id FROM action_send_authorizations"  → 0 matches in apps/server/src or any production/test file
git grep -n "ORDER BY attempt_number DESC LIMIT 1"                     → 0 matches outside docs/orchestration/reviews/...-01.md (the original review's own quotation of the old defect) and one prompt file's search-instruction text
git grep -n "prevAuth"                                                  → 0 matches outside the same historical-quotation context
git grep -n "previous gameInstanceId"                                   → 0 matches outside the same historical-quotation context and the remediation prompt's finding title
git grep -n "reuse previous"                                            → 0 matches
```

All surviving hits are inside (a) the original independent review document quoting the *old*, now-removed code for the record, and (b) the remediation task prompt's own finding description/search-instruction text. Neither is production or test code. **No production fallback remains.**

### Fail-closed behavior — verified against `apps/server/test/persistence-slice1.test.ts`

The rewritten test `"requires explicit gameInstanceId during authorizeRetry and fails closed on omitted/undefined"` and the shared `normalizeGameInstanceId` helper (used identically by both `authorizeRetry` and `validateCreate`) together demonstrate:

| Required behavior | Verified |
|---|---|
| Fourth argument required at TS level | Yes — `authorizeRetry(actionId, version, runtimeId, gameInstanceId: string \| null)`, no optional/overload |
| No overload/optional form remains | Yes — single signature |
| No previous-authorization SELECT remains | Yes — removed |
| No implicit fallback/destination inheritance remains | Yes — `targetGameInstanceId` is now a pure function of the new call's own argument |
| Explicit `null` accepted and persisted as null | Yes — test asserts `retryAttemptNull.gameInstanceId` is `null` after `authorizeRetry(..., null)` |
| Explicit valid string accepted and persisted exactly | Yes — test asserts `retryAttemptNew.gameInstanceId === "inst_new_destination"` |
| Omitted runtime argument fails closed | Yes — test calls with `undefined as unknown as string` in the 4th position and expects `PersistenceError` |
| Explicit `undefined` at runtime fails closed | Yes — same guard (`gameInstanceId === undefined` check precedes any DB read) |
| Non-string runtime values fail closed | **Only indirectly verified.** `normalizeGameInstanceId` throws `PersistenceError("INVALID_INPUT", ...)` for any non-string, non-null, non-undefined value (`typeof value === "string"` check with an `else throw`), and this same function is exercised by both `authorizeRetry` and action creation, but no dedicated `authorizeRetry` test passes a number/object/boolean. Coverage exists indirectly through the shared function and its creation-path test; a dedicated retry-path assertion would be stronger but its absence is not a functional gap — the code path is identical. |
| Empty string fails closed | **Only indirectly verified.** `normalizeGameInstanceId` rejects `value.length === 0`, tested at the `createBeforeFirstSend` call site (`"rejects invalid gameInstanceId formats during action creation"`), not at the `authorizeRetry` call site specifically. Same shared-function reasoning as above. |
| Over-limit string fails closed | **Not directly tested anywhere in the suite.** `normalizeGameInstanceId` rejects `value.length > 256` in code (verified by direct code reading), but no test in `persistence-slice1.test.ts` or `persistence.test.ts` exercises a >256-character `gameInstanceId` at either call site. This is a genuine, if narrow, test-coverage gap. |
| New attempt copies the explicit value from the new authorization | Yes — `recordAttempt` reads `targetGameInstanceId` from the just-issued `SendAuthorization`'s bound details, verified by the "explicit valid string" test |
| Mismatch still fails with `INVALID_AUTHORIZATION` | Yes — new test #7 (`"fails closed when supplied binding gameInstanceId mismatches authorized gameInstanceId"` and the added mismatch case in the rewritten retry test) both call `recordAttempt` with a binding `gameInstanceId` that disagrees with the authorization and assert `PersistenceError` |
| Opaque/single-use/expiry/runtime-owner/version/role/clientId/actionId/attempt-number invariants unchanged | Yes — `authorization.ts` (the file implementing these invariants) has a **zero-line diff** across the whole remediation; `#newAuthorizationDetails` and the WeakMap-backed frozen-token mechanism are untouched |

### Focused test run (Node 22, non-authoritative — see Section 7)

```
pnpm --filter @crowdcircuit/server exec vitest run test/persistence-slice1.test.ts
✓ test/persistence-slice1.test.ts (10 tests) — all passing
```

**Verdict for F-1: RESOLVED.** The core defect (silent inheritance of a stale delivery destination across retries) is completely eliminated at the code level, with strong test coverage for the primary fail-closed/explicit-binding/mismatch behaviors. The two missing edge-case tests (over-limit string, non-string value — both specifically *at the retry call site*, as distinct from the creation call site) do not indicate a code defect (the shared validation function already handles both correctly, confirmed by direct reading) and are noted as a Low test-completeness gap in Section 8, not as a reason to withhold F-1 resolution.

---

## 4. F-2 — budget snapshot completeness

### Final shape (`apps/server/src/persistence/types.ts`) — matches the required shape exactly

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

All eight fields are `readonly`; the five budget-scope fields (`userLimit`, `cooldownMs`, `ruleLimit`, `globalToken`, `capacityConfig`) are now **non-nullable** (previously `X | null` for all five). No union, overload, helper alias, optional wrapper, or alternate public type reintroducing null/undefined bypass semantics was found anywhere in `types.ts`, `index.ts`, or any other exported surface (`grep -rn "BudgetAdmissionSnapshot" apps/server/src` returns only the declaration and its re-export — nothing constructs it in production code yet, since Slice 1 is interface-only and no orchestration exists to populate it; this is expected and correct for this slice, not a gap).

### JSON-safety and semantic alignment

- `BudgetUserWindowSnapshot { limitPerMinute: number }` and `BudgetRuleWindowSnapshot { limitPerMinute: number }` — plain numeric, JSON-safe.
- `BudgetGlobalTokenSnapshot { maxPerSecond: number; burst: number }` — matches the corresponding fields of `packages/mapping-engine`'s `GlobalActionBudget` (`GlobalActionBudgetSchema`: `maxPerSecond`, `burst`, `overflowPolicy`, `deferredTtlMs`). The snapshot deliberately omits `overflowPolicy`/`deferredTtlMs` — those are policy inputs to admission, not token-bucket *state* to be replayed, so their absence is correct, not a gap.
- `BudgetCapacitySnapshot { maxUserBuckets, inactiveRetentionMs, sweepLimit }` — an exact structural match to mapping-engine's `BudgetCapacity`/`BudgetCapacitySchema`.
- `now` (trusted processing time) is intentionally not part of the snapshot — it is supplied fresh at replay time by the caller's injected clock, not stored durably, which is the correct design (a stored `now` would be stale by definition).

**No legitimate real admission scope was found to be unrepresentable by this shape.** Verdict: **not `API_GAP`.**

### Declaration regression evidence (`apps/server/test/declaration-consumer.ts`)

```ts
// @ts-expect-error authorizeRetry requires explicit gameInstanceId fourth argument
repository.authorizeRetry("a", 1, "runtime");

// @ts-expect-error null userLimit is rejected
const nullUserLimitSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, userLimit: null };
// @ts-expect-error null cooldownMs is rejected
const nullCooldownMsSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, cooldownMs: null };
// @ts-expect-error null ruleLimit is rejected
const nullRuleLimitSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, ruleLimit: null };
// @ts-expect-error null globalToken is rejected
const nullGlobalTokenSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, globalToken: null };
// @ts-expect-error null capacityConfig is rejected
const nullCapacityConfigSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, capacityConfig: null };
```

All five null-rejection cases plus the retry-arity case are present, each properly `void`-referenced later in the file to avoid unused-variable noise. Running the declarations suite directly:

```
npx tsc -p apps/server/test/tsconfig.declarations.json --noEmit
→ exit 0, no errors
```

This proves every `@ts-expect-error` annotation is load-bearing — if any of the six new assertions had stopped actually erroring (i.e., the bypass had crept back in), `tsc` would report an "unused `@ts-expect-error` directive" failure. A clean exit confirms all six still trigger a genuine compile error.

**Verdict for F-2: RESOLVED.**

---

## 5. F-3 — status and review gate

Current-state documents were read directly (not trusted from remediation self-report):

| Document | Relevant line |
|---|---|
| `docs/execution/CURRENT_TASK.md` | `Milestone 3 Slice 1 (GEMINI-01): REMEDIATED_AND_READY_FOR_RE_REVIEW (independent review: PENDING)` / `Milestone 3 Slice 2 (CODEX-CORE): BLOCKED_BY_SLICE_1_RE_REVIEW` |
| `docs/execution/PROJECT_STATUS.md` | `**Milestone 3 Slice 1 (GEMINI-01):** REMEDIATED_AND_READY_FOR_RE_REVIEW (independent review: PENDING)` / `**Milestone 3 Slice 2 (CODEX-CORE):** BLOCKED_BY_SLICE_1_RE_REVIEW` / milestone-3 status line: `IN_PROGRESS (Slice 1 GEMINI-01 REMEDIATED_AND_READY_FOR_RE_REVIEW)` |
| `docs/execution/ROADMAP.md` | `PHASE-C-MILESTONE-03 | ... | IN_PROGRESS (Slice 1 REMEDIATED_AND_READY_FOR_RE_REVIEW)` |
| `docs/orchestration/plans/PHASE-C-MILESTONE-PLAN.md` | `**Status:** IN_PROGRESS (Slice 1 REMEDIATED_AND_READY_FOR_RE_REVIEW)` |
| `docs/orchestration/plans/PHASE-C-MILESTONE-03-DELEGATION-PLAN.md` | `**Status**: REMEDIATED_AND_READY_FOR_RE_REVIEW (independent review: PENDING)` |

All five required statuses match exactly what the re-review brief requires: Phase C `IN_PROGRESS`; Milestone 3 architecture `RESOLVED`; Slice 1 `REMEDIATED_AND_READY_FOR_RE_REVIEW`; independent approval `PENDING`; concurrency-sensitive core `BLOCKED_BY_SLICE_1_RE_REVIEW`; Milestones 4–5 `BLOCKED_BY_PREVIOUS_MILESTONE` (`CURRENT_TASK.md`: `Milestones 4–5: BLOCKED_BY_PREVIOUS_MILESTONE`).

A repository-wide search confirms **no current-state document marks Slice 1 as `APPROVED`, `APPROVED_AND_COMPLETE`, or `COMPLETE`.** The two remaining hits for "Slice 1" + "approved"/"complete" (`PROJECT_STATUS.md`'s "Accumulated Phase C work including approved Milestone 1 & 2 and Milestone 3 Slice 1 remediated schema layer" and the Gemini handoff's "delivers the complete additive schema foundation") are prose describing *other* milestones' approval status and the *content* of the deliverable, respectively — neither is a status-field assertion that Slice 1 itself is approved or complete. This is a stylistically tight reading; a stricter writer might avoid "complete" near "Slice 1" even in this descriptive sense, but it does not constitute a false status claim.

**Verdict for F-3: RESOLVED.**

---

## 6. F-4 and file hygiene

### F-4 — portable documentation paths

```
git grep -n -E "file:///|D:\\Dev|d:/Dev|C:\\|/home/claude|/mnt/data" -- docs
```

Results, filtered to files touched or created by this remediation:

- `docs/orchestration/reviews/PHASE-C-MILESTONE-03-GEMINI-01-SELF-REVIEW.md` — **confirmed clean**, direct grep returns 0 matches. This was the file the original F-4 finding targeted; it is genuinely fixed.
- `docs/orchestration/reviews/PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01-SELF-REVIEW.md` (new) — one line mentions the *literal strings* `file:///`, `d:/Dev`, `C:\`, `/home/claude`, `/mnt/data` inside a table cell describing what was searched for during verification (`"Checked changed docs for file:///, d:/Dev, C:\\, /home/claude, /mnt/data — 0 machine-local links remain"`). This is descriptive text about a search, not an embedded path reference, and is not a defect.
- **`docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01.md` (new, line 13) — genuinely contains a live embedded absolute path as a Markdown link:**

  ```
  This remediation addresses all confirmed findings from
  [PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md](file:///d:/Dev/CrowdCircuit/docs/orchestration/reviews/PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md):
  ```

  This is the **exact defect class F-4 was raised to eliminate** — a machine-local, non-portable `file:///d:/Dev/CrowdCircuit/...` link — reintroduced in a **brand-new file that this same remediation created specifically to document the F-4 fix.** It is not reproducible on any other reviewer's machine (it hardcodes a Windows drive-letter path `d:/Dev/CrowdCircuit` that only exists on the implementer's local filesystem) and should have been a repository-relative link (e.g. `docs/orchestration/reviews/PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md`) exactly as the remediation itself did correctly elsewhere in the very same file (e.g., the plain-text references to `types.ts`, `repository.ts`, `CURRENT_TASK.md`, etc., which are not machine-local links).

  Other matches in the tree (`docs/handoffs/HANDOFF-FOUND-02F-REWORK-01.md`, `HANDOFF-FOUND-02F-REWORK-02.md`, `docs/orchestration/reviews/FOUND-02E-CODEX-REVIEW-01.md`) are historical Phase-A documents untouched by this or any Milestone 3 remediation — out of scope, not a regression introduced here, and not evaluated further.

  The remediation prompt file (`docs/orchestration/prompts/PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01-PROMPT.md`) also contains the literal strings, but only as part of its own task-instruction text describing what to search for (the same descriptive pattern as the self-review table above) — not an embedded broken link.

**Verdict for F-4: PARTIALLY_RESOLVED.** The originally flagged file is genuinely fixed. A new instance of the identical defect was introduced in new content produced by this remediation. This is a small, mechanical, doc-only fix (replace one Markdown link target), but it is real and should not be waved through silently — see final verdict rationale.

### H-1 — duplicate file hygiene

```
git ls-files | grep "PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md"
→ docs/orchestration/reviews/PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md   (exactly one path, under reviews/, as required)
```

```
find docs/orchestration/prompts -iname "*INDEPENDENT-REVIEW*"  → no results (no duplicate independent review remains under prompts/)
git ls-files docs/orchestration/prompts | grep -i "gemini-01"
→ docs/orchestration/prompts/PHASE-C-MILESTONE-03-GEMINI-01.md                          (canonical prompt, present)
→ docs/orchestration/prompts/PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01-PROMPT.md    (a distinct, legitimate remediation-task prompt, not a duplicate of the Slice 1 prompt)
```

The duplicate `docs/orchestration/prompts/PHASE-C-MILESTONE-03-GEMINI-01-PROMPT.md` (the actual duplicate of the canonical prompt) is confirmed deleted (`D` in the name-status diff). The canonical `PHASE-C-MILESTONE-03-GEMINI-01.md` remains. The independent review's rename from `prompts/` to `reviews/` is a clean `R100` (100% content-identical rename, verified by the empty diff body for that path in `git diff --name-status`).

**Verdict for H-1: RESOLVED.**

---

## 7. Migration/Drizzle/delivery-port non-regression and scope-leakage assessment

Confirmed via `git diff --stat`/`--name-status` (Section 1) that the remediation touched **none** of: `schema.ts`, `migrations.ts`, `authorization.ts`, `budget.ts`, `index.ts` under `persistence/`, or `delivery-port.test.ts`, `migration-upgrade.test.ts` under `test/`. `SendAuthorization`'s opaque-token internals (`authorization.ts`) are byte-for-byte unchanged.

```
git grep -n -E "socket\.io|promoteDeferred|retryScheduler|ttlWorker|setInterval|setTimeout|ACTION_ID_FORMAT_VERSION" -- apps/server/src
→ no matches
```

Confirmed absent from `apps/server/src`: promotion transaction, full budget re-admission orchestration, retry scheduler, TTL worker, background timer, restart-reconciliation extension, production Action Gateway, Socket.IO, and any Milestone 4 code. **No scope leakage.**

`SqliteDurableActionRepository.createBeforeFirstSend` and `recordAttempt`'s non-retry paths were re-read directly and are unchanged in this diff — the only production-code change in the entire remediation is the ~20-line `authorizeRetry` rewrite plus the `types.ts` signature/interface tightening. **Existing action-creation behavior and existing non-retry attempt behavior are unaffected.**

---

## 8. Node 24 focused verification (attempted; environment limitation disclosed)

Node ≥24.2.0 was **not available** in this sandbox (Section 0). As a best-effort, explicitly non-authoritative substitute, the exact focused commands were run under the available Node v22.22.2 with pnpm 11.9.0 activated via corepack, after `pnpm install --frozen-lockfile` (succeeded, no lockfile drift):

```
pnpm --filter @crowdcircuit/server lint        → pass (0 errors; engine-version WARN only)
pnpm --filter @crowdcircuit/server typecheck   → pass (0 errors)
pnpm --filter @crowdcircuit/server build       → pass
npx tsc -p apps/server/test/tsconfig.declarations.json --noEmit  → pass (0 errors)

pnpm --filter @crowdcircuit/server exec vitest run test/persistence-slice1.test.ts
  → 1 file, 10 tests, all passing
pnpm --filter @crowdcircuit/server exec vitest run test/delivery-port.test.ts
  → 1 file, 3 tests, all passing
pnpm --filter @crowdcircuit/server exec vitest run test/migration-upgrade.test.ts
  → 1 file, 2 tests, all passing
pnpm --filter @crowdcircuit/server exec vitest run test/persistence.test.ts
  → 1 file, 37 tests, 36 passing, 1 failing (see below)

pnpm --filter @crowdcircuit/server test   (full server suite)
  → 9 files, 74 tests total: 2 files failed, 7 passed; 7 tests failed, 67 passed
```

**The 7 failures are all one root cause:** `Cannot find module '.../apps/server/src/persistence/repository.js' imported from .../budget-concurrency-worker.ts` (and the equivalent for `repository-concurrency-worker.ts`). These are the genuine multi-process/worker-thread SQLite concurrency tests (`budget-concurrency.test.ts`'s 6 cases, plus `persistence.test.ts`'s `"serializes matching and conflicting duplicate creates across two connections"`), which spawn real `node:worker_threads` workers that import the worker script's sibling module via a `.js`-suffixed specifier resolving against a `.ts` source file — a pattern that depends on Node's native TypeScript-stripping/module-resolution behavior, which differs materially between Node 22 and Node ≥24.

**This was verified to be pre-existing and unrelated to the remediation**, not a regression: a temporary `git worktree` was created at the pre-remediation commit `f50ec91`, dependencies installed, and `budget-concurrency.test.ts` run under the identical Node 22 sandbox — it fails with the same root-cause module-resolution error before any remediation code existed. This is strong, direct evidence that the failure is a Node-version environment gap (which is exactly why the repository's own baseline mandates Node ≥24.2.0 for authoritative runs), not something introduced or left unfixed by Gemini's remediation.

None of the four explicitly required focused suites (`persistence-slice1.test.ts`, `persistence.test.ts` apart from the one worker-thread case, `delivery-port.test.ts`, `migration-upgrade.test.ts`) show any failure attributable to the remediation's actual changes.

**Exact counts recorded: server 74 tests across 9 files** (matches the task's stated pre-remediation baseline exactly), **7 of which fail for the pre-existing, Node-version-specific, worker-thread reason above — 0 attributable to this remediation.**

---

## 9. Repository-wide verification and exact counts

```
pnpm lint       → pass (0 errors, engine-version WARN only)
pnpm typecheck  → pass (0 errors)
pnpm build      → pass (all 15 buildable workspace packages + dashboard vite build succeeded)
pnpm test       → 25 files, 362 tests total: 23 files passed, 2 failed; 355 tests passed, 7 failed
```

**Exact counts: repository 362 tests across 25 files — matches the task's stated pre-remediation baseline exactly.** The 7 failing tests are the identical two files/root-cause described in Section 8 (`budget-concurrency.test.ts`'s 6 cases + `persistence.test.ts`'s 1 worker-thread case), independently confirmed pre-existing on `f50ec91` via the same worktree comparison. **No new failing test exists anywhere in the repository as a result of this remediation.**

```
git diff --check f50ec91..b256e38   → 9 Markdown-hard-break false positives in 2 new doc files (Section 1), no real formatting defects
git status                          → clean working tree (after install/build/test)
git ls-files --others --exclude-standard → empty (no untracked/generated files leaked into the tree)
git diff --stat -- pnpm-lock.yaml   → empty (no lockfile change)
```

No skipped/`.only` tests were observed in any run output. The declarations suite ran to completion with no ignored files. No generated artifact (e.g. `dist/`) is tracked. Working tree is clean.

---

## 10. Remaining findings

### Critical
None.

### High
None. F-1 (the original High finding) is fully resolved with no new High-severity issue introduced.

### Medium
None. F-2 (the original Medium finding) is fully resolved with no new Medium-severity issue introduced.

### Low

- **F-4-regression (new, Low):** `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01.md` line 13 contains a machine-local `file:///d:/Dev/CrowdCircuit/...` Markdown link, reintroducing the exact defect class F-4 was meant to eliminate, inside the very document written to report that fix. **Fix:** replace the link target with the repository-relative path `docs/orchestration/reviews/PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-01.md` (plain text or a relative Markdown link), matching the portable-path convention used correctly elsewhere in the same document.
- **F-1 test-completeness gap (carried forward, Low):** no test exercises an over-limit-length (>256 char) `gameInstanceId` string, and no test exercises a non-string `gameInstanceId` value, specifically at the `authorizeRetry` call site (both are only exercised, indirectly, via the shared `normalizeGameInstanceId` function's coverage at the `createBeforeFirstSend` call site). The runtime behavior is already correct by direct code inspection; this is a test-suite completeness gap, not a functional defect. Recommend adding 1–2 assertions to `persistence-slice1.test.ts`'s retry-binding test the next time that file is touched.

---

## 11. Confirmations

- **No production or test files were modified by this reviewer.** All commands executed were read-only inspection (`git`, `view`), or ran the repository's own existing lint/typecheck/build/test scripts without editing any source; the one exception — creating a temporary `git worktree` at `/tmp/pre-remediation` to compare pre-remediation test behavior — was removed (`git worktree remove --force`) before this report was written, and never touched any file inside the primary `review/phase-c` checkout.
- **No commit or push occurred.** `git status` on the primary checkout is clean; no commits were created beyond the pre-existing `REMEDIATION_COMMIT`; `origin` was never pushed to.
- **Slice 2 (the concurrency-sensitive production core) was not begun.** No promotion transaction, retry scheduler, TTL worker, restart-reconciliation extension, or Action Gateway orchestration code was written; confirmed via the scope-leakage grep in Section 7 returning no matches.
- The only file created by this review is `docs/orchestration/reviews/PHASE-C-MILESTONE-03-SLICE-01-INDEPENDENT-REVIEW-02.md` itself.

---

## 12. Final verdict

**APPROVE WITH SMALL FIX**

Rationale: F-1, F-2, F-3, and H-1 are fully and correctly resolved, verified independently at the code, declaration, test, and documentation level — not merely trusted from the remediation's self-report. Node ≥24.2.0 could not be obtained in this sandbox, but the full focused and repository-wide test suites were run under Node 22 as best-effort corroboration, producing exact test/file counts matching the task's own stated pre-remediation baseline (74/9 server, 362/25 repository-wide), with the only failures being a pre-existing, Node-version-specific worker-thread module-resolution gap independently confirmed to predate this remediation (verified by running the identical test against the pre-remediation commit `f50ec91` in an isolated worktree) — not a defect introduced by, or left unfixed by, this remediation. No new High or Medium finding exists, and no scope leakage into migration/schema/transport/scheduler/reconciliation/Milestone 4 territory occurred.

The one substantive gap — F-4's regression — is exactly the kind of issue this verdict is for: a single machine-local link in one new documentation file, fixable by replacing one Markdown link target with a repository-relative path. It is documentation wording/formatting only; it requires no code, API, security, migration, or architecture correction, and does not by itself justify blocking Slice 2 behind another full remediation-and-re-review cycle. Recommend: fix the one link in `HANDOFF-PHASE-C-MILESTONE-03-GEMINI-01-REMEDIATION-01.md` line 13 (and optionally add the two missing edge-case tests noted in Section 10) before or alongside marking independent approval, then proceed to Slice 2 under CODEX per the existing delegation plan.