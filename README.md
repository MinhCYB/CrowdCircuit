# CrowdCircuit

> **Turn live viewers into players.**

CrowdCircuit by MS24 Labs is a local-first platform that connects TikTok LIVE events to interactive games. It receives gifts, comments, follows, and other viewer actions, maps them to game actions through a configurable engine, and provides voice reactions via TTS.

## Architecture

- **Local-first modular monolith** — single Node.js process, no external message broker
- **Fastify** backend on port `3100`
- **React + Vite** dashboard
- **Socket.IO** for realtime game and voice channels
- **SQLite** for configuration persistence
- **Zod** for runtime validation
- **Pino** for structured logging

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Setup

```bash
pnpm install
cp .env.example .env
```

### Development

```bash
pnpm dev
```

This starts the backend server and dashboard dev server concurrently.

### Commands

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start dev servers                    |
| `pnpm lint`      | Run ESLint                           |
| `pnpm typecheck` | Run TypeScript type checking         |
| `pnpm test`      | Run tests via Vitest                 |
| `pnpm build`     | Build all packages                   |

### Health Check

```bash
curl http://127.0.0.1:3100/api/v1/health
```

## Repository Structure

```
crowdcircuit/
├── apps/
│   ├── server/          # Fastify backend
│   ├── dashboard/       # React + Vite admin UI
│   ├── voice-output/    # Browser source for TTS playback
│   └── demo-game/       # Placeholder demo game
├── packages/
│   ├── contracts/       # Shared event/action schemas
│   ├── connector-core/  # LiveConnector interface
│   ├── connector-mock/  # Mock connector for testing
│   ├── event-core/      # Event bus and normalizer
│   ├── mapping-engine/  # Event-to-action rules engine
│   ├── voice-engine/    # Voice reaction logic
│   ├── tts-core/        # TTS provider interface
│   ├── game-sdk-js/     # JavaScript Game SDK
│   └── shared/          # Shared utilities
├── games/
│   └── zombie-survival/ # Demo Phaser game
├── data/                # SQLite database (gitignored)
└── docs/                # Project documentation
```

## Documentation

- [System Design v0.1.1](docs/crowdcircuit-system-design-v0.1.1.md)
- [UI/UX Specification v0.1](docs/crowdcircuit-studio-ui-ux-spec-v0.1.md)
- [Execution Roadmap](docs/execution/ROADMAP.md)

## License

Proprietary — MS24 Labs
