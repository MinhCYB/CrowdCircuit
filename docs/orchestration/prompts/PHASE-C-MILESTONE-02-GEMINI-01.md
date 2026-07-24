# Gemini Prompt — Phase C Milestone 2 Safe Additive Work 01

## Gate

Do not execute until CODEX has:

1. resolved and recorded M2-D1–M2-D6;
2. implemented and frozen the Milestone 2 public package interfaces; and
3. provided the exact resulting package-name APIs and confirmed this prompt's
   allowed file list.

If any API is missing or contradictory, stop and report it. Do not repair or
redesign production code.

## Objective

Add representative black-box fixtures, mapping configurations, package-name
declaration consumers, and documentation against CODEX's frozen Milestone 2
interfaces. This is additive verification work only.

## Reading order and preflight

Read the delegation plan, recorded M2 decisions, CODEX Milestone 2 handoff or
checkpoint note, package public declarations, existing tests, and exact diff.
Then run `git status`, `git diff --stat HEAD --`, `git diff --check HEAD --`,
Node/pnpm versions, and the mapping-engine focused test/build/declaration
commands.

## Exact allowed files

Only create or modify:

- `packages/mapping-engine/test/fixtures/phase-c-milestone-02.ts`
- `packages/mapping-engine/test/milestone-02.black-box.test.ts`
- `packages/mapping-engine/test-d/phase-c-milestone-02.test-d.ts`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02-GEMINI-01.md`

If the repository's established test/declaration directories use different
exact names, stop and report the discovered paths to CODEX before editing.

## Frozen interfaces

All production exports, schemas, result shapes, decisions, algorithms,
ordering, clocks, repositories, and adapters are immutable for this task.
Import only from package names in declaration tests. Do not import internal
source paths.

## Required fixtures and tests

After CODEX supplies exact APIs, add:

- a valid gift mapping with exact gift match and finite JSON-safe params;
- a valid comment command mapping using prefix/contains behavior;
- equal-priority rules exercising specificity and full tie ordering;
- `all`, `first`, and two `exclusive_group` configurations;
- an anonymous-user budget scenario using the selected decision;
- rule cooldown/per-minute and global-bucket boundary scenarios;
- each selected overflow outcome, including bounded TTL evidence where
  applicable;
- malformed duplicate IDs, invalid operator/regex, unsafe template path,
  manifest mismatch, non-finite/JSON-unsafe value, and invalid limit cases;
- dry-run evidence showing no state consumption;
- package-name declarations proving valid representative construction and
  rejecting invalid operators, match modes, limit values, non-JSON parameters,
  malformed candidates, and wrong normalized-event types.

All expected output must follow frozen deterministic ordering. Preserve every
existing test and declaration regression.

## Forbidden work

Do not edit production code, package manifests, exports, schemas, configs,
execution documents, decisions, existing tests, contracts, server code,
transport, Socket.IO, SDK, demo game, voice, or Phase D. Do not use `any`,
`z.any()`, assertions, skips, snapshots that conceal semantics, or runtime
source imports in declaration consumers.

Gemini may receive at most one focused rework round. Any substantive issue
returns immediately to CODEX.

## Verification

Run the focused mapping-engine lint/typecheck/test/build/declaration commands,
the new black-box and package-name declaration checks, `git diff --check HEAD
--`, and any repository-wide checks CODEX explicitly requests. Inspect emitted
mapping declarations to confirm tests did not change public output.

## Handoff and final response

Create the allowed handoff with exact fixtures, assertions, commands, counts,
versions, changed files, and Git status. Clearly state that APIs were frozen
and no production file changed.

Do not commit or push. Return files changed, focused results/counts, any
blocker, exact Git status, and the handoff path.
