# Gemini Prompt — Phase C Milestone 2 Additive Verification 01

## Task and authority

The CODEX-owned Milestone 2 production core and public APIs are frozen.
Perform additive fixtures, black-box tests, declaration consumption, and
documentation only. You have no authority to change production behavior,
interfaces, schemas, algorithms, persistence, package exports, or execution
status.

Gemini receives at most one focused rework round.

## Reading order

1. Exact current `git status` and accumulated diff
2. ADR-013 through ADR-018 in `docs/execution/DECISIONS.md`
3. `docs/orchestration/plans/PHASE-C-MILESTONE-02-DELEGATION-PLAN.md`
4. `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02-CODEX-CORE.md`
5. `docs/orchestration/reviews/PHASE-C-MILESTONE-02-CODEX-CORE-SELF-REVIEW.md`
6. Built `@crowdcircuit/mapping-engine` declarations
7. Existing mapping-engine and server tests, without editing them

## Frozen package APIs

Import only from `@crowdcircuit/mapping-engine` and
`@crowdcircuit/contracts` package names.

Frozen mapping exports include:

- `MappingEngine`
- mapping profile/rule/condition/action-template schemas and inferred types
- manifest, match-mode, overflow, global-budget, and capacity schemas/types
- `MappingCandidate`, `MappingResult`, `MappingEvaluation`, and diagnostics
- `CandidateIdentityInput`, `MAPPING_SEED_FORMAT_VERSION`,
  `createCandidateSeed`, and `canonicalJson`
- `TrustedClock`, `DurableBudgetRepository`, `BudgetAdmissionRequest`, and
  `BudgetAdmissionResult`

Frozen behavior is ADR-013 through ADR-018. Do not request or add `actionId`,
queue state, transport behavior, replay storage, provider payloads, or runtime
fakes exported from a package root.

## Exact allowed files

Create only:

- `packages/mapping-engine/test/fixtures/phase-c-milestone-02.ts`
- `packages/mapping-engine/test/milestone-02.black-box.test.ts`
- `packages/mapping-engine/test/phase-c-milestone-02.declaration-consumer.ts`
- `packages/mapping-engine/test/tsconfig.phase-c-milestone-02.json`
- `docs/handoffs/HANDOFF-PHASE-C-MILESTONE-02-GEMINI-01.md`

Do not modify any existing file. If one of these paths conflicts with actual
configuration, stop and report the mismatch rather than widening scope.

## Required additive fixtures and black-box coverage

Create representative, literal-preserving inputs for:

- exact gift-ID mapping;
- normalized comment command;
- equal-priority specificity and full deterministic tie ordering;
- `all`, `first`, and multiple `exclusive_group` cases;
- identical output from two distinct rules with distinct stable seeds;
- identified, unique-ID fallback, anonymous viewer, and userless like inputs;
- gift streak `update` treated only as normalized input;
- cooldown, exact sliding boundary, rule/user/global limits;
- `drop_low_priority`, `reject_newest`, and `queue_with_ttl`;
- malformed duplicate IDs, invalid regex/operator/configuration, unsafe
  template path, manifest mismatch, JSON-unsafe/non-finite values;
- dry-run non-consumption and repeated byte-stable evaluation.

Use a test-local deterministic fake implementing the frozen
`DurableBudgetRepository`. Do not export it. Additive tests must not duplicate
or weaken existing focused invariant tests.

## Declaration consumer

Using package-name imports, prove valid construction and active rejection of:

- invalid operators and match modes;
- missing required nullable/configuration fields;
- invalid limit and capacity types;
- non-JSON condition/template/candidate values;
- an invented final `actionId`;
- queue/transport fields;
- mutable or malformed result variants;
- wrong repository result discriminators.

Preserve existing LIVE, action, voice, fixture, authentication, and mapping
declaration checks.

## Verification

Run:

```text
git diff --check HEAD --
pnpm --filter @crowdcircuit/mapping-engine lint
pnpm --filter @crowdcircuit/mapping-engine typecheck
pnpm --filter @crowdcircuit/mapping-engine test
pnpm --filter @crowdcircuit/mapping-engine build
pnpm --filter @crowdcircuit/mapping-engine test:declarations
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also compile the new declaration consumer with its dedicated tsconfig and
inspect mapping-engine emitted declarations. Record exact fresh test counts,
Node/pnpm versions, and Git status.

## Forbidden work

Do not modify production code, existing tests, package manifests, exports,
server code, contracts, lockfile, configs, decisions, execution documents,
Milestone 3, transport, Socket.IO, SDK, demo game, voice, or Phase D. Do not
use `any`, `z.any()`, unsafe assertions, test skips, or source-path imports.

## Handoff and final response

Create the allowed handoff with exact files, cases, commands, counts, artifact
inspection, and Git evidence. State explicitly that frozen APIs were preserved
and no production file changed.

Do not commit or push. Return files created, coverage added, exact results,
declaration/dist assessment, blockers, handoff path, and Git status.
