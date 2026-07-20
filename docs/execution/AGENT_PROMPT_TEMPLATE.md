# Coding Agent Prompt Template — Micro-task Mode

You are implementing the current CrowdCircuit micro-task.

## Read only

Read in this order:

1. `docs/execution/PROJECT_STATUS.md`
2. `docs/execution/CURRENT_TASK.md`
3. The task brief referenced by `CURRENT_TASK.md`
4. `docs/execution/DECISIONS.md`
5. `docs/execution/KNOWN_ISSUES.md`
6. The latest relevant handoff

Do not read the full System Design or UI/UX Specification unless the task brief references exact sections.

## Before coding

Run:

```bash
git status
git log -1 --oneline
node --version
pnpm --version
pnpm test
pnpm typecheck
```

Summarize briefly:

- Actual repository state.
- Current task scope.
- Expected changed paths.
- Any real blocker.

Then implement immediately unless blocked.

## Scope discipline

- Perform exactly one micro-task.
- Do not begin the next task.
- Do not refactor unrelated code.
- Do not add unrequested infrastructure.
- Do not change public contracts silently.
- Follow allowed paths and exclusions from the task brief.

## Before finishing

Run all verification commands from the task brief, then:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
```

Update:

- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/ROADMAP.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/KNOWN_ISSUES.md` only when needed
- `docs/execution/DECISIONS.md` only when needed

Create the required handoff.

## Final response

### Status
DONE / PARTIAL / BLOCKED

### Implemented
- ...

### Verification
- lint:
- typecheck:
- tests:
- build:

### Documentation updated
- ...

### Limitations
- ...

### Next task
`<NEXT-TASK-ID> — <TITLE>`

Do not commit unless explicitly requested.
