# Project Decisions

This file records implementation decisions discovered during development that are not already fully specified in the System Design.

## Existing architecture decisions

### ADR-001 — Modular monolith

**Status:** Accepted

CrowdCircuit v0.1 runs as a local modular monolith. Do not introduce microservices or an external message broker without a documented revision.

### ADR-002 — In-process event bus

**Status:** Accepted

Use a typed in-process event bus. Kafka, RabbitMQ and Redis are outside MVP scope.

### ADR-003 — Socket.IO for realtime integration

**Status:** Accepted

Use Socket.IO for admin, game and voice-output realtime channels in v0.1.

### ADR-004 — Versioned contracts

**Status:** Accepted

`LiveEventEnvelope`, `GameActionEnvelope` and `VoiceIntent` are versioned contracts owned by `@crowdcircuit/contracts`.

### ADR-005 — Local-first deployment

**Status:** Accepted

Bind admin APIs to loopback by default. No cloud dependency is required except connector/TTS providers that need internet access.

### ADR-006 — Browser game first

**Status:** Accepted

The first vertical slice uses Phaser and the JavaScript Game SDK.

### ADR-007 — Game owns gameplay state

**Status:** Accepted

CrowdCircuit sends actions but does not become the source of truth for gameplay state.

### ADR-008 — Generic LiveEventEnvelope Schema Factory and Payload Strategy

**Date:** 2026-07-23  
**Status:** Accepted  
**Task:** FOUND-02B

### Context

FOUND-02B requires establishing a generic `LiveEventEnvelope` base and runtime Zod schemas before specific event payloads (e.g. `gift.sent`, `chat.comment`) are defined in FOUND-02C. We must avoid `any` while ensuring FOUND-02C can build a discriminated union without breaking the base envelope contract.

### Decision

Use `unknown` as the base payload type with a generic schema factory `createLiveEventEnvelopeSchema(payloadSchema, eventTypeSchema)` in `@crowdcircuit/contracts`.

### Alternatives considered

- Using `z.any()` for payload: Rejected because it bypasses TypeScript type safety and allows non-JSON types.
- Hardcoding `z.unknown()` without factory function: Rejected because downstream payload specialization in FOUND-02C would require duplicating envelope schema structure.

### Consequences

- Positive: Safe runtime validation, zero use of `any`, clean forward compatibility for FOUND-02C discriminated union.
- Negative: None identified.

### Affected packages

- `packages/contracts`

## New decision template


```md
## ADR-XXX — Title

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Superseded  
**Task:** TASK-ID

### Context

Why a decision is needed.

### Decision

What was chosen.

### Alternatives considered

- Alternative A
- Alternative B

### Consequences

- Positive
- Negative

### Affected packages

- package/path
```
