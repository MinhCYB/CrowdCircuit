# FOUND-02A — Contracts Package Foundation

**Status:** READY  
**Phase:** Foundation  
**Depends on:** FOUND-01

## Objective

Prepare `@crowdcircuit/contracts` as a clean, buildable package for all later versioned runtime schemas.

This task establishes package structure and tooling only. It must not implement the complete domain contracts.

## Required context

Read:

- `docs/execution/PROJECT_STATUS.md`
- `docs/handoffs/HANDOFF-FOUND-01.md`
- System Design:
  - `## 10. Quyết định kiến trúc`
  - `## 12. Data contracts`
  - `## 22. Technology stack đề xuất`

Do not read the UI/UX Specification.

## Allowed paths

- `packages/contracts/**`
- Root workspace/package configuration only when directly required
- Shared TypeScript/Vitest/ESLint configuration only when directly required
- Execution documentation and the new handoff

## Required work

- Confirm package name is `@crowdcircuit/contracts`.
- Add Zod as its runtime validation dependency.
- Ensure package scripts exist and work:
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Create intentional source structure:
  - `src/common/`
  - `src/events/`
  - `src/actions/`
  - `src/voice/`
  - `src/index.ts`
- Create package-level public export boundaries.
- Add one minimal **non-domain** schema solely to prove:
  - Zod runtime parsing works.
  - Type inference works.
  - Root exports work.
- Add focused package tests.
- Preserve the existing `SPEC_VERSION` placeholder only if it remains compatible with the new export structure; do not invent full contracts yet.

## Must not implement

- Complete `LiveEventEnvelope`.
- LIVE event payload schemas.
- `GameActionEnvelope`.
- Action receipt/result messages.
- `VoiceIntent`.
- Connector logic.
- Server routes.
- Database.
- UI.
- New unrelated infrastructure.

## Acceptance criteria

- [ ] `@crowdcircuit/contracts` builds independently.
- [ ] Runtime schema and inferred TypeScript type share one source.
- [ ] No `any`.
- [ ] Public exports work from the package root.
- [ ] No domain contract is partially invented.
- [ ] Package tests pass.
- [ ] Full repository baseline still passes.

## Verification

Run focused checks first:

```bash
pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
```

Then run the repository baseline:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
```

## Documentation updates

Before finishing:

- Mark FOUND-02A in `ROADMAP.md`.
- Update `PROJECT_STATUS.md` with exact test counts and commit state.
- Point `CURRENT_TASK.md` to FOUND-02B.
- Update `DECISIONS.md` only if a real decision was required.
- Update `KNOWN_ISSUES.md` only for a verified unresolved issue.

## Required handoff

Create:

`docs/handoffs/HANDOFF-FOUND-02A.md`

## Next task

`FOUND-02B — Common Primitives and LiveEventEnvelope Base`
