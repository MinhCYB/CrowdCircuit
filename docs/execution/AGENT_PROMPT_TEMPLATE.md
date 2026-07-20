# Coding Agent Prompt Template

You are implementing **`<TASK-ID> — <TASK TITLE>`** for CrowdCircuit.

## Source of truth

Read these files in order:

1. `docs/crowdcircuit-system-design-v0.1.1.md`
2. `docs/crowdcircuit-studio-ui-ux-spec-v0.1.md` only if the task touches UI
3. `docs/execution/ROADMAP.md`
4. `docs/execution/PROJECT_STATUS.md`
5. `docs/execution/DECISIONS.md`
6. `docs/execution/KNOWN_ISSUES.md`
7. `docs/execution/CURRENT_TASK.md`
8. The latest file in `docs/handoffs/`

Do not implement outside `CURRENT_TASK.md`.

## Before coding

Verify the actual repository:

```bash
git status
git log -1 --oneline
pnpm test
pnpm typecheck
```

If documentation and repository conflict, trust repository evidence and update `PROJECT_STATUS.md`.

## Implementation rules

- Preserve existing contracts.
- Do not refactor unrelated modules.
- Do not introduce new infrastructure without documenting a decision.
- Add or update tests for every behavior.
- Do not mark work complete when tests are skipped or failing.
- Keep changes limited to the task scope.

## Before finishing

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
```

Then:

1. Update `docs/execution/PROJECT_STATUS.md`.
2. Update task status in `docs/execution/ROADMAP.md`.
3. Update `docs/execution/KNOWN_ISSUES.md` only for verified unresolved issues.
4. Update `docs/execution/DECISIONS.md` only for actual new decisions.
5. Create a new handoff in `docs/handoffs/`.

## Final report

Include:

- Task status: DONE, PARTIAL or BLOCKED.
- Files changed.
- Commands run and exact results.
- Tests added.
- Known limitations.
- Next recommended task.
