# Phase C Milestone 2 — CODEX Core Self-Review

**Date:** 2026-07-25
**Scope:** CODEX-owned production core only
**Status:** CORE_READY_FOR_GEMINI_ADDITIVE
**Verdict:** APPROVE for frozen additive verification

## Repository evidence

- Branch: `review/phase-c`
- Implementation baseline: `675271b`
- Node.js: v24.15.0
- pnpm: 11.9.0
- Working tree: accumulated uncommitted Milestone 2 core
- No commit or push performed

## Public mapping and budget APIs

`@crowdcircuit/mapping-engine` now exports:

- strict mapping profile, rule, condition, action-template, global-budget,
  capacity, manifest, match-mode, operator, and overflow schemas/types;
- `MappingEngine` with runtime validation of unknown profile, manifest, and
  normalized-event inputs;
- deterministic identity helpers and `MAPPING_SEED_FORMAT_VERSION = 1`;
- JSON-safe `MappingCandidate`, accepted/rejected/dropped/deferred
  `MappingResult`, `MappingEvaluation`, and safe diagnostics;
- `TrustedClock`, `DurableBudgetRepository`, atomic admission request/result,
  and finite rejection reasons.

No mapping candidate contains a final `actionId`. It contains the normalized
actor reference, event/rule traceability, deterministic seed, action type,
canonical JSON-safe params, priorities, and TTL needed by Milestone 3.

## Deterministic mapping assessment

- Event inputs are validated by the existing normalized LIVE event union.
- Operators `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`,
  `startsWith`, `regex`, and `in` are implemented and tested.
- Rules order by priority DESC, specificity DESC, createdAt ASC, rule ID ASC.
- Match-mode/exclusive-group resolution happens before candidate creation and
  budget admission.
- Parameter templates resolve only validated dot paths and preserve JSON-safe
  values.
- Manifest validation is strict and produces no candidate on mismatch.
- Dry-run performs validation/matching/resolution without repository mutation.
- Canonical JSON sorts object keys recursively. Seed v1 hashes profile, rule,
  event, ordinal, action type, and canonical params only.
- Repeated evaluation is byte-stable; identical output from different rules
  has different seeds.

## Durable budget assessment

Schema version 2 adds:

- `mapping_budget_profiles`
- `mapping_budget_user_buckets`
- `mapping_budget_user_events`
- `mapping_budget_rule_events`
- `mapping_budget_cooldowns`
- `mapping_budget_game_tokens`

One `BEGIN IMMEDIATE` transaction validates runtime ownership, reads every
scope, rejects without partial capacity consumption, writes all admitted
scopes, performs bounded inactive cleanup, revalidates ownership, and commits.
Rollback covers statement and pre-commit failure.

Exact sliding windows use `admitted_at > now - 60_000`, so an entry expires
exactly at 60 seconds. Cooldown admits exactly at its boundary. Token refill
uses elapsed trusted processing time, is capped by burst, and is durable.
Clock rollback fails closed.

Opening a newer repository owner fences the older connection. The new owner
must complete Milestone 1 reconciliation before budget mutation. Restart tests
prove live windows persist; stale-owner admission returns a typed fail-closed
result.

## Bounded state

Defaults:

- 4,096 active user/rule buckets per profile;
- 10-minute inactive retention;
- 128 rows per deterministic cleanup sweep.

Rationale: 4,096 bounds local durable cardinality while remaining well above a
small creator stream's active mapped audience; 10 minutes safely exceeds the
fixed one-minute window and common cooldowns; 128 bounds transaction cleanup
work. Profiles may configure smaller validated limits. Retention must cover
the one-minute window and the longest configured cooldown. Cleanup orders by
last-active time, rule, then user key and never removes live state. Exhaustion
fails closed.

No queue or diagnostics history is retained by Milestone 2.

## Findings resolved during self-review

1. A fresh-database separate-worker test exposed `busy_timeout` being applied
   after migrations. It was moved before migration execution; the complete
   server suite then passed.
2. Boundary inspection found that the future gateway also needs the normalized
   actor. The frozen candidate now carries `GameActionActor | null`; identity
   inputs remain exactly ADR-013.

## Verification

- mapping-engine lint: passed
- mapping-engine typecheck: passed
- mapping-engine tests: 9 passed in 1 file
- mapping-engine build: passed
- mapping-engine declaration tests: passed
- server lint: passed
- server typecheck: passed
- server tests: 53 passed in 5 files
- server build: passed
- server declaration tests: passed
- contracts lint/typecheck/build/declarations: passed
- contracts tests: 175 passed in 7 files
- event-core lint/typecheck/build/declarations: passed
- event-core tests: 38 passed in 3 files
- repository lint/typecheck/build: passed
- repository tests: 308 passed in 20 files
- `git diff --check HEAD --`: passed

## Declaration and artifact assessment

- Mapping declarations expose the intended schemas and frozen readonly result
  interfaces through the package root.
- Server declarations reference the public mapping budget interface.
- Emitted mapping JavaScript has no test/source-path import, provider payload,
  transport, queue storage, or final-action-ID allocation.
- Test fake and transaction fault controls are not exported by the mapping
  package root.
- Existing server action lifecycle exports remain unchanged.

## Scope assessment

Milestone 3 did not start. There is no transport, Socket.IO, SDK, delivery
queue, retry/TTL worker, or final action-ID allocation. Gemini additive work
and a subsequent focused review remain required before Milestone 2 can advance.

## Remaining issues

- The additive fixture/declaration matrix assigned to Gemini is not yet
  implemented.
- The current task is not `DONE` and not `READY_FOR_FOCUSED_REVIEW`.
- Milestones 3–5 remain blocked.
