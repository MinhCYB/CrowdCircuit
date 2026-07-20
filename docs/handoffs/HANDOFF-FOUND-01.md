# Handoff — FOUND-01 — Monorepo Scaffold

**Task status:** DONE  
**Date:** 2026-07-20  
**Agent session:** FOUND-01 scaffold implementation

## Summary

Created the complete CrowdCircuit monorepo scaffold with pnpm workspace, TypeScript project references, ESLint, Vitest, a minimal Fastify server with health endpoint, a React + Vite dashboard placeholder, and all required placeholder packages.

## Files and directories created

### Root configuration

- `package.json` — Root workspace scripts (dev, lint, typecheck, test, build)
- `pnpm-workspace.yaml` — Workspace definition (apps/*, packages/*, games/*)
- `pnpm-lock.yaml` — Lock file
- `tsconfig.json` — Root project references
- `tsconfig.base.json` — Shared TypeScript base config (strict, Node16, composite)
- `eslint.config.mjs` — Flat ESLint config with typescript-eslint
- `vitest.config.ts` — Root Vitest configuration
- `.gitignore` — Standard Node.js monorepo ignores
- `.env.example` — Environment variable template
- `README.md` — Project overview and setup instructions

### Apps

- `apps/server/` — Fastify backend with `GET /api/v1/health`
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/index.test.ts`
- `apps/dashboard/` — React 19 + Vite 6 placeholder
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `vite-env.d.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`
- `apps/voice-output/` — Placeholder (package.json only)
- `apps/demo-game/` — Placeholder (package.json only)

### Packages

All packages follow the same structure: `package.json`, `tsconfig.json`, `src/index.ts`

- `packages/shared/` — Branding constants placeholder
- `packages/contracts/` — SPEC_VERSION placeholder
- `packages/connector-core/` — Placeholder
- `packages/connector-mock/` — Placeholder
- `packages/event-core/` — Placeholder
- `packages/mapping-engine/` — Placeholder
- `packages/voice-engine/` — Placeholder
- `packages/tts-core/` — Placeholder
- `packages/game-sdk-js/` — Placeholder

### Games

- `games/zombie-survival/` — Game identity placeholder
  - `package.json`, `tsconfig.json`, `src/index.ts`

### Data

- `data/.gitkeep` — Empty directory for SQLite database

## Commands run and results

| Command | Result |
| --- | --- |
| `pnpm install` | ✅ 15 workspace projects, 300+ packages resolved |
| `pnpm lint` | ✅ No errors |
| `pnpm typecheck` | ✅ No errors |
| `pnpm test` | ✅ 2 tests passed (1 file) |
| `pnpm build` | ✅ All 13 buildable packages compiled |
| `pnpm dev` (server) | ✅ Server started on http://127.0.0.1:3100 |
| `GET /api/v1/health` | ✅ `{"status":"ok","product":"CrowdCircuit","version":"0.1.0","timestamp":"..."}` |

## Test count

- **Test files:** 1 (`apps/server/src/index.test.ts`)
- **Tests:** 2
  - `returns status ok` — verifies 200 response with correct body
  - `returns valid ISO timestamp` — verifies timestamp format

## Environment verified

- **Node.js:** v24.15.0
- **pnpm:** 11.15.1
- **TypeScript:** 5.9.3
- **Vitest:** 4.1.10
- **Fastify:** 5.3.x
- **React:** 19.1.x
- **Vite:** 6.4.x
- **ESLint:** 10.7.x

## Decisions made

No new decisions beyond what was already documented in DECISIONS.md. The technology choices (Fastify, Vitest, tsx, flat ESLint config) follow directly from the System Design and existing ADRs.

**Note:** `pnpm` was not pre-installed and had to be installed globally via `npm install -g pnpm`. This is now resolved (KI-001 closed).

## Incomplete items

None — all acceptance criteria met.

## Known limitations

- Placeholder packages only export version/identity constants. No real logic.
- Dashboard is a bare minimum React component, no routing or real UI.
- `voice-output` and `demo-game` apps have only `package.json`, no source.
- No SQLite, no Socket.IO, no authentication — all deferred to later tasks.
- `pnpm dev` runs server + dashboard in parallel; stopping requires Ctrl+C.

## Git status

```
On branch main
Changes not staged for commit:
  modified:   README.md

Untracked files:
  .env.example
  .gitignore
  apps/
  data/
  eslint.config.mjs
  games/
  package.json
  packages/
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.base.json
  tsconfig.json
  vitest.config.ts
```

All files are uncommitted. Ready for user to review and commit.

## Documentation updated

- `docs/execution/PROJECT_STATUS.md` — Updated with verified state
- `docs/execution/ROADMAP.md` — FOUND-01 status changed to DONE
- `docs/execution/KNOWN_ISSUES.md` — KI-001 closed
- `docs/handoffs/HANDOFF-FOUND-01.md` — This file

## Next recommended task

**FOUND-02 — Shared contracts and schemas**

Define `LiveEventEnvelope`, `GameActionEnvelope`, `VoiceIntent`, and related Zod schemas in `@crowdcircuit/contracts`. This unblocks the event pipeline and game integration packages.
