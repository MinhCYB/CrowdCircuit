# CrowdCircuit Documentation Index

## Product and architecture

- `crowdcircuit-system-design-v0.1.1.md`
- `crowdcircuit-studio-ui-ux-spec-v0.1.md`

These are long-form source-of-truth documents. Agents should read only exact sections referenced by their task brief.

## Execution control

- `execution/ROADMAP.md`
- `execution/PROJECT_STATUS.md`
- `execution/CURRENT_TASK.md`
- `execution/DECISIONS.md`
- `execution/KNOWN_ISSUES.md`
- `execution/AGENT_WORKFLOW.md`
- `execution/AGENT_PROMPT_TEMPLATE.md`

## Task briefs

- `tasks/README.md`
- `tasks/TASK-TEMPLATE.md`
- `tasks/FOUND-02A.md`
- `tasks/FOUND-02B.md`
- `tasks/FOUND-02C.md`
- `tasks/FOUND-02D.md`
- `tasks/FOUND-02E.md`
- `tasks/FOUND-02F.md`

The active task is always selected by:

`execution/CURRENT_TASK.md`

## Handoffs

- `handoffs/HANDOFF-TEMPLATE.md`
- `handoffs/HANDOFF-FOUND-01.md`
- Future handoffs must be added without deleting or rewriting historical files.

## Default agent reading order

1. Project Status
2. Current Task
3. Referenced task brief
4. Decisions
5. Known Issues
6. Latest relevant handoff

Do not make every agent reread the complete System Design and UI/UX Specification.
