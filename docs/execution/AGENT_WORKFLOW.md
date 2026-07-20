# Agent Workflow

## Start of every agent session

1. Read:
   - System Design
   - UI/UX Spec only if relevant
   - ROADMAP
   - PROJECT_STATUS
   - DECISIONS
   - KNOWN_ISSUES
   - CURRENT_TASK
   - Latest handoff
2. Inspect the repository:
   ```bash
   git status
   git log -1 --oneline
   pnpm test
   pnpm typecheck
   ```
3. Compare documentation claims with actual repository state.
4. If they conflict, trust the repository and tests, then fix `PROJECT_STATUS.md`.

## During the task

- Stay inside the task scope.
- Do not silently change contracts.
- Do not refactor unrelated packages.
- Write tests with implementation.
- Record any necessary new decision in `DECISIONS.md`.
- Record actual unresolved issues in `KNOWN_ISSUES.md`.

## End of every agent session

1. Run:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   git status
   ```
2. Update `PROJECT_STATUS.md`.
3. Update the task status in `ROADMAP.md`.
4. Create a new handoff.
5. Do not overwrite previous handoffs.
6. Commit only if the user's workflow allows commits.
7. Mark the task:
   - `DONE` only when every acceptance criterion passes.
   - `PARTIAL` when useful work exists but criteria fail.
   - `BLOCKED` when a decision or external dependency prevents progress.

## Handoff truth rule

A handoff is a summary, not proof. The next agent must verify it with the repository and tests.
