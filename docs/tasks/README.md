# CrowdCircuit Task Briefs

Task briefs are small, implementation-focused slices extracted from the long-form specifications.

## Rules

- One task brief equals one agent session.
- A brief must define allowed paths.
- A brief must define excluded work.
- A brief must define measurable acceptance criteria.
- A brief must define focused and repository-wide verification.
- A brief must name the required handoff and next task.
- A brief should reference exact System Design sections rather than the entire document.

## Current sequence

1. `FOUND-02A.md` — Contracts Package Foundation
2. `FOUND-02B.md` — Common Primitives and LiveEventEnvelope Base
3. `FOUND-02C.md` — LIVE Event Payload Schemas
4. `FOUND-02D.md` — GameActionEnvelope and Action Lifecycle Schemas
5. `FOUND-02E.md` — VoiceIntent and Voice Protocol Schemas
6. `FOUND-02F.md` — Contract Fixtures and Integration Review

## Creating future task briefs

Copy `TASK-TEMPLATE.md`.

A good task primarily modifies one package, adds one coherent capability and has focused tests.
