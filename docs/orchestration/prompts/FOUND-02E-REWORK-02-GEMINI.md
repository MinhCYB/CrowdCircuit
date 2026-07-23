# Gemini Implementation Prompt — FOUND-02E REWORK-02

## Task and objective

Task ID: `FOUND-02E-REWORK-02`

Apply only the remaining verified FOUND-02E fixes:

1. harden root-relative local audio paths after exactly one percent-decoding pass;
2. remove the remaining production type assertion from variables validation;
3. reconcile current FOUND-02E tool-version and handoff evidence;
4. preserve every approved regression test and public contract.

Do not implement FOUND-02F. Do not create an internal voice event bus or mapping layer. Do not commit or push, and do not request an intermediate commit.

## Required reading order

Read these files in order before changing anything:

1. `docs/orchestration/reviews/FOUND-02E-CODEX-REVIEW-02.md`
2. `docs/orchestration/reviews/FOUND-02E-CODEX-REVIEW-01.md`
3. `docs/orchestration/prompts/FOUND-02E-REWORK-01-GEMINI.md`
4. `docs/handoffs/HANDOFF-FOUND-02E.md`
5. `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md`
6. `docs/tasks/FOUND-02E.md`
7. `docs/execution/DECISIONS.md`, especially ADR-010
8. `docs/execution/PROJECT_STATUS.md`
9. `docs/execution/CURRENT_TASK.md`
10. `docs/execution/ROADMAP.md`
11. `packages/contracts/src/voice/intent.ts`
12. `packages/contracts/src/voice/protocol.ts`
13. `packages/contracts/test/domain-voice.test.ts`
14. `packages/contracts/test/declaration-consumer.ts`
15. The voice-related System Design sections referenced by FOUND-02E

Inspect the complete existing working tree first. Preserve all accumulated FOUND-02E changes.

## Preflight

Run and record exact output:

```text
git status
git diff HEAD --stat
git diff HEAD --
git diff --check HEAD --
git ls-files --others --exclude-standard
node --version
pnpm --version
```

The expected fresh tool versions from the independent review are:

- Node.js `v24.15.0`
- pnpm `11.9.0`

Trust fresh command output if the environment differs.

## Focused allowed paths

Modify only files necessary within:

- `packages/contracts/src/voice/intent.ts`
- `packages/contracts/src/voice/protocol.ts`
- `packages/contracts/test/domain-voice.test.ts`
- `packages/contracts/test/declaration-consumer.ts` only if a declaration regression genuinely needs an additive assertion
- `docs/execution/PROJECT_STATUS.md`
- `docs/handoffs/HANDOFF-FOUND-02E.md`
- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md`
- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-02.md`

Do not change production files outside the two listed voice files. Do not alter unrelated historical reports. ROADMAP must remain FOUND-02E `PARTIAL`; CURRENT_TASK must remain FOUND-02E; FOUND-02F must remain blocked.

## A. Harden root-relative audio path validation after one decode pass

Apply the decoding rules only to root-relative local media paths. Absolute URLs must remain restricted to valid `http:` and `https:` URLs.

For a root-relative path:

- require exactly one leading slash;
- reject protocol-relative paths beginning with `//`;
- reject literal backslashes;
- reject literal control characters;
- reject query strings and fragments;
- reject malformed percent encoding;
- decode the path exactly once with a safe percent-decoding operation;
- catch and reject decoding failures;
- validate the decoded representation;
- reject decoded backslashes;
- reject decoded control characters, including U+0000 through U+001F and U+007F;
- reject decoded query or fragment delimiters;
- split the decoded pathname into segments and reject every segment equal to `.` or `..`.

Add permanent runtime tests proving rejection of:

- `/a/%2e%2e/b.mp3`
- `/a/%2E%2E/b.mp3`
- `/a/..%2fb.mp3`
- `/a/%2f..%2fb.mp3`
- `/a%0ab.mp3`
- encoded backslashes
- malformed percent sequences
- encoded query delimiters
- encoded fragment delimiters

Retain positive tests for:

- `/media/tts/voice_123.mp3`
- `/a/b/c.mp3`
- a valid absolute `http:` URL
- a valid absolute `https:` URL

Retain all existing URL safety tests. Add coverage; do not replace valid coverage.

The double-encoded value `/a/%252e%252e/b.mp3` is not a blocking rejection case because the repository currently has no second-decoding boundary. Document this limitation in the new handoff without claiming that the value is rejected.

Do not introduce filesystem access, URL fetching, or a second decoding pass.

## B. Remove the production type assertion

Remove:

```ts
const v = (val as Record<string, unknown>)[key];
```

Do not replace it with another assertion. Use an assertion-free property read such as `Reflect.get` after the existing plain-object validation.

Preserve all of these behaviors:

- ordinary plain objects are accepted;
- null-prototype objects are intentionally accepted;
- symbol-keyed containers are rejected;
- class instances, Date, Map, Set, arrays, null, and functions are rejected;
- each value must be a string or finite number;
- `z.input` and `z.output` remain `Record<string, string | number>`.

Do not introduce `any`, `z.any()`, an unsafe assertion, or another unchecked escape hatch.

## C. Documentation reconciliation

Correct the current FOUND-02E records in:

- `docs/execution/PROJECT_STATUS.md`
- `docs/handoffs/HANDOFF-FOUND-02E.md`
- `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md`

Use the fresh actual versions:

- Node.js `v24.15.0`
- pnpm `11.9.0`

Also ensure:

- ROADMAP remains FOUND-02E `PARTIAL`;
- CURRENT_TASK remains FOUND-02E;
- FOUND-02F remains blocked;
- handoff Git-status evidence matches fresh Git output or is clearly labeled as an earlier historical snapshot;
- unrelated historical reports are not rewritten.

## D. Regression preservation

Preserve:

- all approved public callback literal tests;
- all legacy `voice.playback.*` rejection tests;
- all existing URL safety tests;
- all variables-container tests;
- all prior LIVE-event regression tests;
- all action-contract regression tests;
- all prior and current package-name declaration regressions.

This rework is additive except for the narrowly required implementation correction. Do not remove or replace valid coverage.

## Public contract invariants

- Public callbacks remain exactly:
  - `playback.started`
  - `playback.finished`
  - `playback.interrupted`
  - `playback.failed`
- `voice.playback.*` remains excluded from the public callback protocol.
- VoiceIntent variables remain `Record<string, string | number>` at input and output.
- Required nullable VoiceIntent semantics remain unchanged.
- Fixed-shape schemas remain strict.
- Runtime schemas remain the source of truth.
- Package-root exports remain intact.

## Explicit exclusions

- No FOUND-02F work.
- No internal voice event bus or callback mapping layer.
- No filesystem access.
- No network fetching.
- No production changes outside the focused voice validation files.
- No weakening of runtime or TypeScript contracts.
- No `any`, `z.any()`, unsafe assertions, or unchecked escape hatches.
- No removal of valid tests.
- No commit or push.
- No intermediate commit request.

## Required verification

Run all commands fresh and record exact results and test counts:

```text
git diff --check HEAD --

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

After the build, inspect:

- `packages/contracts/dist/voice/intent.d.ts`
- `packages/contracts/dist/voice/protocol.d.ts`
- `packages/contracts/dist/voice/index.d.ts`
- `packages/contracts/dist/index.d.ts`

Confirm:

- variables input and output declarations remain `Record<string, string | number>`;
- callback literals remain the approved public family;
- package-root exports are complete;
- no test or declaration fixtures leaked into `dist`;
- `dist` contains no stale or unrelated artifacts.

Run focused independent probes for every required encoded-path case and for the variables-container behavior after removing the assertion.

## Handoff

Create:

`docs/handoffs/HANDOFF-FOUND-02E-REWORK-02.md`

The handoff must include:

- exact files changed;
- implementation summary;
- one-pass decoding behavior and its boundaries;
- the documented double-encoded limitation;
- test cases added;
- exact fresh Node.js and pnpm versions;
- exact package and repository verification commands and results;
- exact fresh test counts;
- declaration and dist inspection results;
- `git diff --check` result;
- current `git status`, explicitly labeled as the state at handoff-generation time;
- confirmation that FOUND-02E remains `PARTIAL` awaiting independent re-review;
- confirmation that FOUND-02F remains blocked;
- confirmation that no commit or push was performed.

## Final response format

Return:

1. Summary of the two implementation fixes.
2. Files modified or created.
3. Tests added, with the exact encoded-path cases.
4. Fresh tool versions.
5. Package verification results and exact test count.
6. Repository verification results and exact test count.
7. Declaration and dist inspection.
8. `git diff --check` result.
9. Final `git status`.
10. Handoff path.
11. Explicit confirmation: no FOUND-02F implementation, no commit, and no push.
