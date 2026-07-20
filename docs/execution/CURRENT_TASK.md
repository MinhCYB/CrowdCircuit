# Current Task

**Task ID:** FOUND-01  
**Title:** Monorepo Scaffold  
**Status:** READY  
**Priority:** P0

## Objective

Create the initial CrowdCircuit monorepo and establish a reproducible development baseline for all later agents.

## Source of truth

Read in this order:

1. `docs/crowdcircuit-system-design-v0.1.1.md`
2. `docs/execution/PROJECT_STATUS.md`
3. `docs/execution/DECISIONS.md`
4. `docs/execution/KNOWN_ISSUES.md`
5. This file

The UI/UX specification is not required for this task.

## Required scope

Create:

```text
crowdcircuit/
├── apps/
│   ├── server/
│   ├── dashboard/
│   ├── voice-output/
│   └── demo-game/
├── packages/
│   ├── contracts/
│   ├── connector-core/
│   ├── connector-mock/
│   ├── event-core/
│   ├── mapping-engine/
│   ├── voice-engine/
│   ├── tts-core/
│   ├── game-sdk-js/
│   └── shared/
├── games/
│   └── zombie-survival/
├── data/
├── docs/
├── pnpm-workspace.yaml
└── package.json
```

Implement only the minimum scaffold needed to verify the workspace:

- Root package scripts:
  - `dev`
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Shared TypeScript configuration.
- ESLint and formatting configuration.
- Vitest configuration.
- Minimal Fastify server with `GET /api/v1/health`.
- Minimal React + Vite dashboard placeholder.
- Placeholder packages that compile.
- `.gitignore`.
- `.env.example`.
- Basic root `README.md`.
- Copy the documentation workspace into the repository `docs/`.

## Must not implement

- TikTok connector.
- Mock event behavior.
- Shared event contracts beyond harmless placeholders.
- Authentication/pairing.
- SQLite schema.
- Mapping engine logic.
- Game WebSocket protocol.
- TTS.
- Full dashboard design.
- Docker.
- Electron or Tauri packaging.
- Refactors outside the scaffold.

## Acceptance criteria

The following commands must run successfully from repository root:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additionally:

- `pnpm dev` starts the backend and dashboard development processes.
- `GET http://127.0.0.1:3100/api/v1/health` returns a successful JSON response.
- No package contains untracked implementation outside task scope.
- The workspace imports and TypeScript project references are valid.
- Existing docs remain unchanged except for path adjustments required by the new repository.

## Required verification

Before finishing:

```bash
git status
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Record exact outputs or test counts in the handoff.

## Required handoff

Create:

```text
docs/handoffs/HANDOFF-FOUND-01.md
```

Then update:

- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/ROADMAP.md`
- `docs/execution/KNOWN_ISSUES.md`, only if a real issue exists
- `docs/execution/DECISIONS.md`, only if a new decision was necessary

## Completion report

Report:

- Files and directories created.
- Commands run.
- Test/lint/typecheck/build results.
- Any deviations from the requested structure.
- Known limitations.
- Recommended next task: `FOUND-02`.
