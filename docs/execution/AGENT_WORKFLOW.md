# Agent Workflow — Micro-task Mode

CrowdCircuit uses sequential coding agents with limited context and quota.

The objective is to let each agent finish one small, verifiable unit without rereading the entire project history.

## 1. Context-loading order

At the start of each agent session, read only:

1. `docs/execution/PROJECT_STATUS.md`
2. `docs/execution/CURRENT_TASK.md`
3. The task brief referenced by `CURRENT_TASK.md`
4. `docs/execution/DECISIONS.md`
5. `docs/execution/KNOWN_ISSUES.md`
6. The latest relevant handoff

Do not read the full System Design or UI/UX Specification unless the task brief references exact sections.

Backend agents must not read the UI/UX Specification unless the task directly affects frontend behavior.

## 2. Repository verification

Before coding, run:

```bash
git status
git log -1 --oneline
node --version
pnpm --version
pnpm test
pnpm typecheck
```

If documentation and repository conflict:

1. Trust repository evidence and tests.
2. Record the discrepancy.
3. Correct `PROJECT_STATUS.md`.
4. Do not silently continue with false assumptions.

## 3. Scope rules

- Perform exactly one micro-task.
- Do not begin the next task.
- Touch only paths allowed by the task brief.
- Do not refactor unrelated modules.
- Do not implement “helpful extras”.
- Do not silently change a public contract.
- Do not add infrastructure unless required by the task.
- Do not rewrite long-form specifications casually.

If quota or context runs out:

- Mark the task `PARTIAL`.
- Preserve working code.
- Update status honestly.
- Create a handoff with the exact stopping point.
- Never fake completion.

## 4. Development rules

- Write tests together with behavior.
- Avoid `any`.
- Keep runtime schemas and inferred TypeScript types aligned.
- Prefer shared contracts over duplicated definitions.
- Preserve repository tooling and conventions.
- A placeholder must not pretend to be production logic.

## 5. Decision handling

When the task reveals an unspecified choice:

1. Check `DECISIONS.md`.
2. Read only the System Design sections referenced by the task brief.
3. If still unresolved:
   - record `BLOCKED_DECISION` in the handoff, or
   - add a narrowly scoped ADR when the decision is necessary and low-risk.
4. Do not invent cross-package behavior silently.

## 6. Completion verification

Run all task-specific verification commands, then run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
```

Do not leave development processes running.

A task may be marked `DONE` only when:

- Required scope is implemented.
- Acceptance criteria pass.
- Verification passes.
- Execution documentation is updated.
- A new handoff exists.

## 7. Required documentation updates

Before finishing:

1. Update `docs/execution/PROJECT_STATUS.md`.
2. Update the task status in `docs/execution/ROADMAP.md`.
3. Update `docs/execution/CURRENT_TASK.md` to the next ready task.
4. Update `KNOWN_ISSUES.md` only for verified unresolved issues.
5. Update `DECISIONS.md` only for actual new decisions.
6. Create `docs/handoffs/HANDOFF-<TASK-ID>.md`.

Never overwrite an older handoff.

## 8. Handoff truth rule

A handoff is a summary, not proof.

The next agent must verify it with repository state and tests.

## 9. Commit rule

Do not commit unless the user explicitly asks the agent to commit.

When the user handles commits manually, include a concise recommended commit message in the handoff.

## 10. Recommended task size

A good micro-task:

- Primarily changes one package.
- Adds one coherent capability.
- Has focused tests.
- Usually changes no more than 5–15 primary source files.
- Can be reviewed from one focused diff.
- Does not require reading thousands of lines of documentation.

If a task violates these rules, split it before execution.
