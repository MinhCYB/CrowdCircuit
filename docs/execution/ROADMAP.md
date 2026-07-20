# CrowdCircuit Execution Roadmap

**Status values:** `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `PARTIAL`, `DONE`

## Workflow policy

- Mỗi coding agent chỉ thực hiện **một micro-task**.
- Một micro-task nên tập trung vào tối đa **1–2 package chính**.
- Không tự chuyển sang task kế tiếp trong cùng phiên.
- Chỉ đánh dấu `DONE` khi acceptance criteria và verification đều pass.
- Khi task lớn hơn khả năng xử lý trong một lượt, phải chia nhỏ trong roadmap trước khi giao agent.
- Handoff là bản tóm tắt; repository và test mới là source of truth cuối cùng.

---

## Phase A — Foundation

| ID | Task | Status | Depends on |
|---|---|---|---|
| FOUND-01 | Monorepo scaffold | DONE | — |
| FOUND-02A | Contracts package foundation | READY | FOUND-01 |
| FOUND-02B | Common primitives and LiveEventEnvelope base | TODO | FOUND-02A |
| FOUND-02C | LIVE event payload schemas | TODO | FOUND-02B |
| FOUND-02D | GameActionEnvelope and action lifecycle schemas | TODO | FOUND-02B |
| FOUND-02E | VoiceIntent and voice protocol schemas | TODO | FOUND-02B |
| FOUND-02F | Contract fixtures and integration review | TODO | FOUND-02C, FOUND-02D, FOUND-02E |
| FOUND-03A | Runtime secret and admin session foundation | TODO | FOUND-02F |
| FOUND-03B | Pairing code lifecycle | TODO | FOUND-03A |
| FOUND-03C | Role tokens and client authorization | TODO | FOUND-03B |
| FOUND-03D | Authentication contract and integration tests | TODO | FOUND-03C |
| FOUND-04A | SQLite and Drizzle foundation | TODO | FOUND-02F |
| FOUND-04B | Core configuration tables and migrations | TODO | FOUND-04A |
| FOUND-04C | Runtime logs and reconciliation storage | TODO | FOUND-04B |
| FOUND-04D | Persistence integration tests | TODO | FOUND-04C |

---

## Phase B — Event Pipeline

| ID | Task | Status | Depends on |
|---|---|---|---|
| BE-01A | Mock connector package foundation | TODO | FOUND-02F |
| BE-01B | Mock gift and comment events | TODO | BE-01A |
| BE-01C | Mock social, like and scenario events | TODO | BE-01B |
| BE-02A | Event normalizer foundation | TODO | FOUND-02F, BE-01B |
| BE-02B | User, room and timestamp normalization | TODO | BE-02A |
| BE-02C | Gift, comment and social normalization | TODO | BE-02B |
| BE-02D | Invalid-event handling and contract tests | TODO | BE-02C |
| BE-03A | Event-specific deduplication | TODO | BE-02D |
| BE-03B | Gift streak state and inactivity timeout | TODO | BE-03A |
| BE-03C | Like aggregation and disconnect flush | TODO | BE-03B |
| BE-03D | Deduplication and aggregation integration tests | TODO | BE-03C |
| BE-04A | TikTok connector package foundation | TODO | BE-02D |
| BE-04B | TikTok connection and status adapter | TODO | BE-04A |
| BE-04C | TikTok raw-event mapping | TODO | BE-04B |
| BE-04D | Reconnect and connector contract tests | TODO | BE-04C |

---

## Phase C — Game Vertical Slice

| ID | Task | Status | Depends on |
|---|---|---|---|
| BE-05A | Mapping rule model and operators | TODO | FOUND-02F, BE-03D |
| BE-05B | Mapping parameter resolver | TODO | BE-05A |
| BE-05C | Priority, specificity and match modes | TODO | BE-05B |
| BE-05D | Mapping cooldown and per-rule limits | TODO | BE-05C |
| BE-05E | Mapping dry-run and integration tests | TODO | BE-05D |
| BE-06A | Per-game global action budget | TODO | BE-05E |
| BE-06B | Overflow and priority policies | TODO | BE-06A |
| BE-07A | Game Socket.IO namespace and registration | TODO | FOUND-03D, BE-05E |
| BE-07B | Action delivery and received ACK | TODO | BE-07A |
| BE-07C | Completion result, retry and TTL | TODO | BE-07B |
| BE-07D | Action Gateway integration tests | TODO | BE-07C |
| BE-08A | JavaScript SDK connection and registration | TODO | BE-07D |
| BE-08B | Action handlers and automatic receipt ACK | TODO | BE-08A |
| BE-08C | Result reporting, heartbeat and idempotency | TODO | BE-08B |
| BE-09A | Phaser demo game shell | TODO | BE-08C |
| BE-09B | Demo game action handlers | TODO | BE-09A |
| BE-09C | First end-to-end game vertical slice | TODO | BE-09B |

---

## Phase D — Voice

| ID | Task | Status | Depends on |
|---|---|---|---|
| VOICE-01A | Voice rule model and template rendering | TODO | FOUND-02F, BE-03D |
| VOICE-01B | Name normalization and pronunciation | TODO | VOICE-01A |
| VOICE-01C | Aggregation, cooldown and moderation | TODO | VOICE-01B |
| VOICE-02A | Voice priority queue foundation | TODO | VOICE-01C |
| VOICE-02B | Queue merge, TTL and drop policies | TODO | VOICE-02A |
| VOICE-02C | Interrupt policies and recovery states | TODO | VOICE-02B |
| VOICE-03A | TTS provider interface and mock provider | TODO | VOICE-02C |
| VOICE-03B | First real TTS provider | TODO | VOICE-03A |
| VOICE-03C | Cache, retry and provider health | TODO | VOICE-03B |
| VOICE-04A | Voice Output pairing and realtime channel | TODO | FOUND-03D, VOICE-03C |
| VOICE-04B | Browser audio playback and callbacks | TODO | VOICE-04A |
| VOICE-04C | Subtitle and playback watchdog | TODO | VOICE-04B |

---

## Phase E — Backend Hardening

| ID | Task | Status | Depends on |
|---|---|---|---|
| BE-10A | Active-game state machine | TODO | BE-07D, BE-08C |
| BE-10B | Drain, cancel and switch policies | TODO | BE-10A |
| BE-11A | Graceful shutdown | TODO | FOUND-04D, BE-03D, BE-07D, VOICE-02C |
| BE-11B | Startup reconciliation | TODO | BE-11A |
| BE-12A | Structured logging and correlation IDs | TODO | BE-04D, BE-07D |
| BE-12B | Metrics JSON endpoint | TODO | BE-12A, VOICE-03C |
| BE-12C | Diagnostic bundle and secret masking | TODO | BE-12B |

---

## Phase F — Frontend

Frontend task briefs chỉ được kích hoạt khi backend contract tương ứng đã ổn định.

| ID | Task | Status | Depends on |
|---|---|---|---|
| FE-01A | App shell and routing | TODO | FOUND-03D, BE-12B |
| FE-01B | Admin bootstrap and realtime status | TODO | FE-01A |
| FE-02A | Connection screen | TODO | FE-01B, BE-04D |
| FE-02B | Overview screen | TODO | FE-02A |
| FE-03A | Event feed | TODO | FE-01B, BE-03D |
| FE-03B | Event details and action/voice linkage | TODO | FE-03A |
| FE-04A | Games list, details and pairing | TODO | FE-01B, BE-07D |
| FE-04B | Active-game switch UX | TODO | FE-04A, BE-10B |
| FE-05A | Mapping list | TODO | FE-01B, BE-05E |
| FE-05B | Trigger Builder | TODO | FE-05A |
| FE-05C | Action Parameter Builder | TODO | FE-05B |
| FE-05D | Mapping Test and Conflict Panel | TODO | FE-05C |
| FE-06A | Voice Control and Queue | TODO | FE-01B, VOICE-03C |
| FE-06B | Voice Templates | TODO | FE-06A |
| FE-06C | Pronunciation Rules | TODO | FE-06A |
| FE-07A | Simulator event builder | TODO | FE-03A, BE-01C |
| FE-07B | Scenario presets and pipeline timeline | TODO | FE-07A |
| FE-08A | Diagnostics | TODO | FE-01B, BE-12C |
| FE-08B | Settings and paired clients | TODO | FE-08A |

---

## Phase G — Release

| ID | Task | Status | Depends on |
|---|---|---|---|
| REL-01A | Core end-to-end scenario | TODO | BE-09C, VOICE-04C, FE-08B |
| REL-01B | Failure and recovery E2E scenarios | TODO | REL-01A |
| REL-02A | Local production build | TODO | REL-01B |
| REL-02B | Windows packaging experiment | TODO | REL-02A |
| REL-03A | Real TikTok LIVE smoke test | TODO | REL-02B |
| REL-03B | OBS/TikTok LIVE Studio audio validation | TODO | REL-03A |

---

## Milestone gates

### Gate 1 — Contracts Stable

Required:

- FOUND-01
- FOUND-02A through FOUND-02F
- FOUND-03A through FOUND-03D
- FOUND-04A through FOUND-04D

### Gate 2 — Headless Event Gateway

Required:

- BE-01A through BE-04D

### Gate 3 — First Game Vertical Slice

Required:

- BE-05A through BE-09C

### Gate 4 — Voice Vertical Slice

Required:

- VOICE-01A through VOICE-04C

### Gate 5 — Backend Ready for Studio

Required:

- BE-10A through BE-12C

### Gate 6 — MVP Candidate

Required:

- FE-01A through FE-08B
- REL-01A and REL-01B

---

## Current execution pointer

**Current task:** `FOUND-02A — Contracts Package Foundation`

**Detailed brief:** `docs/tasks/FOUND-02A.md`
