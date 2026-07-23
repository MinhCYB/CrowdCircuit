You are the implementation worker for one CrowdCircuit micro-task.

TASK

<TASK-ID — TITLE>

OBJECTIVE

<One exact implementation outcome>

READ IN ORDER

1. docs/execution/PROJECT_STATUS.md
2. docs/execution/CURRENT_TASK.md
3. <task brief>
4. docs/execution/DECISIONS.md
5. docs/execution/KNOWN_ISSUES.md
6. <latest relevant handoff>
7. Only exact System Design sections listed below:
   - ...

PREFLIGHT

Run:

git status
git rev-parse --short HEAD
git log -3 --oneline
<package baseline commands>
<repository baseline commands>

Report repository state, scope, expected paths, and blockers.
If no blocker exists, implement immediately.

ALLOWED PATHS

- ...

REQUIRED WORK

- ...

CONTRACT INVARIANTS

- ...

MUST NOT IMPLEMENT

- ...

TESTS

Runtime:
- ...

Type/declaration:
- ...

Negative:
- ...

ACCEPTANCE CRITERIA

- [ ] ...

VERIFICATION

<package commands>
<clean build>
<declaration tests>
<repository commands>
<dist inspection>
git status
git diff --stat

DOCUMENTATION

Update:
- PROJECT_STATUS
- ROADMAP
- CURRENT_TASK
- DECISIONS only for actual decisions
- KNOWN_ISSUES only for verified unresolved issues

Create:
- docs/handoffs/HANDOFF-<TASK-ID>.md

Do not commit unless explicitly requested.

FINAL RESPONSE

Status
Implemented
Verification
Documentation
Scope confirmation
Limitations
Next task
