# Gemini Implementation Prompt — FOUND-02F

## Task and objective

Task ID: `FOUND-02F`

Complete the contracts phase by adding canonical fixtures, verifying public
exports, and testing cross-contract integration without implementing business
logic.

FOUND-02F is a coherent contracts-only integration task and should remain one
task. Do not split it unless repository evidence reveals a materially broader
cross-package change requiring a product decision.

## Required reading order

Read in this order:

1. `docs/execution/PROJECT_STATUS.md`
2. `docs/execution/CURRENT_TASK.md`
3. `docs/tasks/FOUND-02F.md`
4. `docs/orchestration/reviews/FOUND-02E-CODEX-REVIEW-FINAL.md`
5. `docs/execution/DECISIONS.md`
6. `docs/execution/KNOWN_ISSUES.md`
7. `docs/handoffs/HANDOFF-FOUND-02C.md`
8. `docs/handoffs/HANDOFF-FOUND-02D.md`
9. `docs/handoffs/HANDOFF-FOUND-02E-REWORK-02.md`
10. System Design section `12 — Data contracts`
11. System Design section `14 — WebSocket protocol`
12. System Design section `19 — Testing strategy`
13. Current `packages/contracts` source, tests, package metadata, tsconfigs,
    and emitted declarations
14. The package metadata and tsconfig of the selected consuming workspace
    package

Do not read the UI/UX Specification unless a documented frontend contract is
directly relevant.

## Preflight

Before changing files, run:

```text
git status
git rev-parse --short HEAD
git log -5 --oneline
node --version
pnpm --version

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Verify that the user has committed the approved FOUND-02E working tree and
that the implementation base is immutable before beginning FOUND-02F. If the
working tree still contains uncommitted FOUND-02E changes, do not mix
FOUND-02F implementation into it; report the blocker.

Record only fresh Node.js and pnpm output.

## Allowed paths

- `packages/contracts/**`
- One minimal existing consuming workspace package, only for a package-name
  TypeScript import verification that cannot be proven inside the contracts
  package
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/ROADMAP.md`
- `docs/execution/DECISIONS.md` only if a genuinely necessary contract
  decision is discovered
- `docs/handoffs/HANDOFF-FOUND-02F.md`

Do not modify unrelated packages or documentation.

## Required implementation

### A. Canonical fixtures

Add clearly named, immutable canonical valid fixtures for:

- gift event;
- comment event;
- like milestone event;
- follow event;
- game action;
- action received receipt;
- action completed result;
- action failed result;
- voice intent;
- voice play message;
- every public playback callback variant.

Fixtures must use only public contract types and values accepted by the
corresponding runtime schemas. Export them through an intentional package
subpath or package root consistent with the existing package architecture.
Do not introduce a second definition of any domain contract.

### B. Positive and negative integration tests

Add positive tests proving every canonical fixture parses with its public
schema.

Add focused invalid near-miss fixtures or test mutations covering, at minimum:

- incorrect `specVersion`;
- wrong event/action/voice discriminator;
- invalid or empty identifiers;
- invalid timestamp;
- omitted required-nullable field;
- explicit `undefined` for a required-nullable field;
- invented key on a strict fixed-shape object;
- non-JSON action parameters or result details;
- invalid voice variables;
- unsafe voice audio path;
- invalid playback callback discriminator.

Do not duplicate the exhaustive domain-level suites. Integration cases should
prove consistency across families and protect fixture correctness.

### C. Public exports and declaration contracts

Using package-name imports from `@crowdcircuit/contracts`, prove:

- every intended schema, inferred type, and canonical fixture is exported;
- fixture values retain their useful discriminated literal types;
- event, action, result, voice intent, voice play, and playback callback unions
  narrow correctly;
- required-nullable fields remain required and reject `undefined`;
- invalid near-miss assignments fail with `@ts-expect-error`;
- all previously approved LIVE, action, and voice declaration regressions
  remain present.

Use `z.input`, `z.output`, and `z.infer` where they materially verify
input/output alignment.

### D. Cross-workspace package resolution

Add one minimal compile-only verification in an existing consuming workspace
package that imports `@crowdcircuit/contracts` by package name.

Requirements:

- relative imports into `packages/contracts` do not count;
- do not add runtime business logic;
- do not create a new package unless the current workspace offers no suitable
  consumer;
- verify TypeScript and package exports resolution through the repository's
  normal project references/toolchain;
- keep the consumer change isolated and easy to remove or retain.

### E. Consistency and duplication review

Review and test consistency across event, action, and voice families:

- identifiers;
- timestamps;
- `specVersion`;
- discriminators;
- nullable versus optional semantics;
- naming.

Search the repository for duplicate domain-contract definitions outside
`@crowdcircuit/contracts`. Do not mechanically move or rewrite unrelated code.
If an actual conflicting duplicate exists and resolving it would expand scope,
stop with `BLOCKED_DECISION` and provide exact evidence.

## Contract invariants

- Runtime Zod schemas remain the source of truth.
- Public input, output, and inferred types remain aligned.
- JSON-safe fields remain JSON-safe.
- Required-nullable properties remain required and accept `null`, not
  omission or `undefined`.
- Fixed-shape objects remain strict.
- Public discriminators and ADR-010 callback literals remain unchanged.
- Empty payloads remain exact-empty at runtime and type level.
- Public action generics remain constrained to `JsonValue`.
- No `any`, `z.any()`, unsafe assertion, or unchecked escape hatch.
- Existing approved runtime and declaration regression coverage must remain.

## Explicit exclusions

- No connector or normalizer implementation.
- No mapping logic.
- No Socket.IO runtime.
- No TTS or voice runtime.
- No UI.
- No database.
- No FOUND-03A implementation.
- No architectural refactor unrelated to fixtures and integration proof.
- No removal or replacement of valid regression tests.
- No commit or push.
- Do not request separate intermediate commits for prompts, handoffs, reviews,
  or status updates.

## Verification

Run:

```text
git diff --check

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build --force
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run the selected consuming package's direct typecheck/build command and
record it separately.

Inspect:

- package-root and fixture declarations in `packages/contracts/dist`;
- emitted fixture literal and nullable types;
- `package.json` exports and declaration entry points;
- source maps and JavaScript output needed by consumers;
- dist cleanliness, including absence of test and declaration-fixture files;
- package-name resolution from the consuming workspace package.

Record exact fresh test counts. Do not infer counts from a previous handoff.

## Documentation and handoff

While implementing, keep FOUND-02F `IN_PROGRESS` and FOUND-03A blocked.

Create:

`docs/handoffs/HANDOFF-FOUND-02F.md`

The handoff must include:

- actual base commit and working-tree state;
- exact files changed and created;
- fixture inventory;
- positive and negative integration coverage;
- package-name declaration coverage;
- selected consumer and exact cross-workspace verification;
- duplicate-definition search commands and results;
- package and repository commands with exact test counts;
- emitted declaration and dist inspection;
- fresh Node.js and pnpm versions;
- `git diff --check` result;
- exact `git status` at handoff-generation time;
- confirmation that FOUND-03A was not implemented;
- confirmation that no commit or push was performed.

Do not mark FOUND-02F DONE. Leave it awaiting independent Codex review.

## Final response format

Return:

1. Implementation summary.
2. Files modified or created.
3. Canonical fixture inventory.
4. Invalid near-miss coverage.
5. Package-name declaration coverage.
6. Cross-workspace consumer verification.
7. Duplicate-definition review results.
8. Package verification and exact test count.
9. Repository verification and exact test count.
10. Declaration and dist assessment.
11. Documentation and handoff updates.
12. Final Git status.
13. Handoff path.
14. Explicit confirmation: no FOUND-03A implementation, no commit, and no
    push.
