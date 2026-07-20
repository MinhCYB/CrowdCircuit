# CrowdCircuit Execution Roadmap

**Status values:** `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `PARTIAL`, `DONE`

## Phase A — Foundation

| ID | Task | Status | Depends on |
|---|---|---|---|
| FOUND-01 | Monorepo scaffold | READY | — |
| FOUND-02 | Shared contracts and schemas | TODO | FOUND-01 |
| FOUND-03 | Runtime session and client pairing | TODO | FOUND-01, FOUND-02 |
| FOUND-04 | SQLite persistence and migrations | TODO | FOUND-01, FOUND-02 |

## Phase B — Event Pipeline

| ID | Task | Status | Depends on |
|---|---|---|---|
| BE-01 | Mock connector | TODO | FOUND-02 |
| BE-02 | Event normalizer | TODO | FOUND-02, BE-01 |
| BE-03 | Event-specific deduplication and aggregation | TODO | BE-02 |
| BE-04 | TikTok connector adapter | TODO | BE-02, BE-03 |

## Phase C — Game Vertical Slice

| ID | Task | Status | Depends on |
|---|---|---|---|
| BE-05 | Mapping Engine | TODO | FOUND-02, BE-03 |
| BE-06 | Global action budget | TODO | BE-05 |
| BE-07 | Action Gateway | TODO | FOUND-03, BE-05 |
| BE-08 | JavaScript Game SDK | TODO | BE-07 |
| BE-09 | Phaser demo game | TODO | BE-08 |

## Phase D — Voice

| ID | Task | Status | Depends on |
|---|---|---|---|
| VOICE-01 | Voice Reaction Engine | TODO | FOUND-02, BE-03 |
| VOICE-02 | Voice priority queue | TODO | VOICE-01 |
| VOICE-03 | TTS provider adapters | TODO | VOICE-02 |
| VOICE-04 | Voice Output Browser Source | TODO | FOUND-03, VOICE-03 |

## Phase E — Backend Hardening

| ID | Task | Status | Depends on |
|---|---|---|---|
| BE-10 | Active game transition | TODO | BE-07, BE-08 |
| BE-11 | Graceful shutdown and startup recovery | TODO | FOUND-04, BE-03, BE-07, VOICE-02 |
| BE-12 | Diagnostics and observability | TODO | BE-04, BE-07, VOICE-03 |

## Phase F — Frontend

| ID | Task | Status | Depends on |
|---|---|---|---|
| FE-01 | App shell and admin bootstrap | TODO | FOUND-03, BE-12 |
| FE-02 | Connection and Overview | TODO | FE-01, BE-04 |
| FE-03 | Event Monitor | TODO | FE-01, BE-03 |
| FE-04 | Games and Pairing | TODO | FE-01, BE-07, BE-10 |
| FE-05A | Mapping list | TODO | FE-01, BE-05 |
| FE-05B | Trigger Builder | TODO | FE-05A |
| FE-05C | Action Parameter Builder | TODO | FE-05B |
| FE-05D | Mapping Test and Conflict Panel | TODO | FE-05C |
| FE-06A | Voice Control and Queue | TODO | FE-01, VOICE-02, VOICE-03 |
| FE-06B | Voice Templates | TODO | FE-06A |
| FE-06C | Pronunciation Rules | TODO | FE-06A |
| FE-07 | Simulator | TODO | FE-03, BE-01, BE-05 |
| FE-08 | Diagnostics and Settings | TODO | FE-01, BE-12 |

## Phase G — Release

| ID | Task | Status | Depends on |
|---|---|---|---|
| REL-01 | End-to-end tests | TODO | BE-09, VOICE-04, FE-08 |
| REL-02 | Local packaging | TODO | REL-01 |
| REL-03 | Real TikTok LIVE smoke test | TODO | REL-02 |

## Milestone gates

### Gate 1 — Contracts Stable

Required:
- FOUND-01
- FOUND-02
- FOUND-03
- FOUND-04

### Gate 2 — Headless Event Gateway

Required:
- BE-01
- BE-02
- BE-03
- BE-04

### Gate 3 — First Game Vertical Slice

Required:
- BE-05
- BE-06
- BE-07
- BE-08
- BE-09

### Gate 4 — Voice Vertical Slice

Required:
- VOICE-01
- VOICE-02
- VOICE-03
- VOICE-04

### Gate 5 — Backend Ready for Studio

Required:
- BE-10
- BE-11
- BE-12

### Gate 6 — MVP Candidate

Required:
- FE-01 through FE-08
- REL-01
