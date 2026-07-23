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

### ADR-009 — Generic LiveEventEnvelope Schema Factory and JSON-Safe Payload Strategy

**Date:** 2026-07-23  
**Status:** Accepted  
**Task:** FOUND-02B (Renumbered in PATCH-FOUND-02B-01)

### Context

FOUND-02B requires establishing a generic `LiveEventEnvelope` base and runtime Zod schemas before specific event payloads (e.g. `gift.sent`, `chat.comment`) are defined in FOUND-02C. We must avoid `any` and `z.unknown()` while ensuring base envelopes require a JSON-safe payload and FOUND-02C can build a discriminated union without breaking the base envelope contract.

Note: System Design section 10 previously defined ADR-008 (Ephemeral local credentials). The FOUND-02B decision has been renumbered to ADR-009 in PATCH-FOUND-02B-01 to avoid ID conflict.

### Decision

Use recursive `JsonValueSchema` as the base payload schema with a required-parameter generic schema factory `createLiveEventEnvelopeSchema(payloadSchema, eventTypeSchema)` in `@crowdcircuit/contracts`.

### Alternatives considered

- Using `z.any()` for payload: Rejected because it bypasses TypeScript type safety and allows non-JSON types.
- Using `z.unknown()` for base payload: Rejected in PATCH-FOUND-02B-01 because `z.unknown()` allows non-JSON types (functions, BigInts, Date, Map/Set, NaN/Infinity) and permits missing payload properties.
- Hardcoding `JsonValueSchema` without factory function: Rejected because downstream payload specialization in FOUND-02C would require duplicating envelope schema structure.

### Consequences

- Positive: Safe runtime validation, zero use of `any`, clean forward compatibility for FOUND-02C discriminated union.
- Base payload is JSON-safe.
- Specialized schemas remain responsible for domain-level constraints.
- Recursive JSON validation has runtime cost.
- Unknown arbitrary JavaScript values are intentionally rejected.

### Affected packages

- `packages/contracts`

### ADR-010 — Public Voice Output callback wire literals

**Date:** 2026-07-23
**Status:** Accepted
**Task:** FOUND-02E

### Context

The System Design uses two similar naming families:

- Section 11.14 describes callbacks sent by the external Voice Output client as `playback.started` and `playback.finished`.
- Internal application event/handler examples use names such as `voice.playback.started` and `voice.playback.finished`.

FOUND-02E must define the public Voice Output wire protocol without conflating it with potential internal application events.

### Decision

The public Voice Output callback wire literals are:

- `playback.started`
- `playback.finished`
- `playback.interrupted`
- `playback.failed`

The interrupted and failed variants extend the same external callback family consistently.

The `voice.playback.*` family is reserved for potential internal application events or handler names and must not be used as the public Voice Output callback protocol.

### Alternatives considered

- Use `voice.playback.*` for both public callbacks and internal events: Rejected because it conflates the external Voice Output protocol with internal application event naming.
- Support both literal families publicly: Rejected because aliases would create an ambiguous wire contract and unnecessary compatibility surface.

### Consequences

- Public Voice Output messages follow the external playback terminology in System Design section 11.14.
- Internal event naming remains independently evolvable.
- Runtime schemas, public types, declaration tests, and handoff documentation must expose only the `playback.*` callback family.

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
