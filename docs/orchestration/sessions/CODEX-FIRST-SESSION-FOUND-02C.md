Continue the CrowdCircuit repository from FOUND-02C as Technical Lead and Prompt Orchestrator.

Read the accompanying CrowdCircuit handoff and obey the Codex Master Goal.

Do not implement FOUND-02C in this first response.

Perform:

1. Verify the current repository:
   - git status
   - git rev-parse --short HEAD
   - git log -5 --oneline
   - package and repository baseline verification
2. Confirm commit 6ecd211 or report the actual newer HEAD.
3. Read:
   - docs/execution/PROJECT_STATUS.md
   - docs/execution/CURRENT_TASK.md
   - docs/tasks/FOUND-02C.md
   - docs/execution/DECISIONS.md
   - docs/execution/KNOWN_ISSUES.md
   - docs/handoffs/HANDOFF-FOUND-02B.md
   - docs/handoffs/HANDOFF-FOUND-02B-PATCH-01.md
4. Read only System Design sections referenced by FOUND-02C.
5. Inspect the existing contracts API and tests.
6. Reconcile stale PROJECT_STATUS fields:
   - PATCH-FOUND-02B-01 is committed.
   - FOUND-02B is closed.
   - Current and next recommended task are FOUND-02C.
   - Use actual HEAD, test counts, and git status.
7. Determine whether FOUND-02C is small enough for one Gemini session.
8. Split it into smaller tasks if necessary.
9. Produce one complete implementation prompt for the next Gemini task.
10. Do not edit domain code.
11. Do not commit or push.

Return:

Repository baseline
Documentation reconciliation
FOUND-02C scope assessment
Task split, if needed
Architecture decisions required
Gemini implementation prompt
User decisions, if any
