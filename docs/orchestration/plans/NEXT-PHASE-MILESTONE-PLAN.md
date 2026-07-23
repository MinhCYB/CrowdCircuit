# Phase B Event Pipeline — Milestone Plan

## Purpose

Treat Phase B as one orchestration unit and deliver a tested event pipeline in
substantial sequential milestones. Milestones 1–4 were implemented in one
accumulated working tree. After the implementation-worker loop was retired,
Codex completed the remaining milestones directly and performed a full
self-review. Final remediation was independently reviewed and approved.

Phase A — Contract Foundation is complete. Runtime authentication/pairing and
SQLite remain separate deferred foundations; they are not silently included in
Phase B and must be scheduled before a dependent phase needs them.

## Commit policy

- Prefer one final Phase B commit after full phase acceptance.
- Do not request commits for prompts, handoffs, reviews, status updates, or
  routine milestone boundaries.
- An intermediate commit is justified only when a milestone is a substantial,
  independently reviewable rollback boundary and the product owner approves
  it.
- The product owner remains commit and push owner.

## Milestone sequence

### Milestone 1 — Mock-to-normalized playable input slice — DONE

Roadmap coverage: `BE-01A` through `BE-01C`, and `BE-02A` through `BE-02D`.

Deliver the earliest useful vertical slice: a deterministic mock connector
produces gift, comment, follow, and like inputs; the event normalizer converts
them into the approved `@crowdcircuit/contracts` LIVE envelopes; invalid raw
inputs fail conservatively; package-root outputs resolve and build cleanly.

This milestone must not implement deduplication, streak state, like
aggregation, TikTok networking, mappings, sockets, persistence, authentication,
or UI.

Gate: focused Codex review of runtime behavior, normalized contract output,
error handling, tests, package boundaries, declarations, and dist artifacts.

### Milestone 2 — Event integrity and burst-state pipeline — DONE

Roadmap coverage: `BE-03A` through `BE-03D`.

Add event-specific deduplication, bounded TTL state, gift streak lifecycle and
flush behavior, and like aggregation. Preserve comment semantics and avoid
false deduplication. Verify inactivity, maximum lifetime, disconnect flush,
finite bounded state, deterministic clocks, and integration with Milestone 1.

Gate: focused Codex review of algorithms, clocks, memory bounds, state
transitions, concurrency assumptions, and regression coverage.

### Milestone 3 — TikTok adapter behind the connector boundary — DONE

Roadmap coverage: `BE-04A` through `BE-04D`.

Implement the TikTok connector adapter, connection status mapping, raw-event
translation, reconnect behavior, and adapter contract tests. Keep provider
objects inside the adapter and prevent credentials from entering logs. Any
unstable external dependency or product-policy choice requires fresh
verification and may produce `BLOCKED_DECISION`.

Gate: focused Codex review of dependency evidence, isolation, reconnection,
secret handling, provider-object containment, and tests.

### Milestone 4 — Phase B acceptance and headless event gateway — DONE

Roadmap coverage: Phase B integration acceptance.

Run one deterministic acceptance path from mock scenario through normalization,
deduplication/aggregation, and the internal event boundary. Exercise failure,
disconnect, replay-risk, ordering, and burst cases. Inspect all package exports
and dist artifacts, reconcile documentation, and confirm no Phase C mapping or
game-delivery implementation entered scope.

Gate: independent full Phase B acceptance review. This gate returned APPROVE
after Final Remediation 01. Phase B is DONE and ready for the preferred single
phase commit.

## Current execution state

- Milestone 1: DONE.
- Milestone 2: DONE.
- Milestone 3: DONE.
- Milestone 4: DONE.
- Initial independent final review: REQUEST CHANGES (historical evidence).
- Final remediation 01: complete.
- Remediation self-review: complete.
- Independent Phase B re-review: APPROVE.
- Phase B: DONE.
- Phase C: BLOCKED / NOT_STARTED pending a separate phase-level plan.

## Working-tree and review protocol

1. Start each milestone from the accumulated working tree left by the approved
   prior milestone.
2. Read the phase plan, the milestone prompt, current execution documents, and
   only the cited System Design sections.
3. Run preflight before edits and preserve unrelated/user-owned changes.
4. Implement only the active milestone.
5. Run focused tests, package checks, repository lint/typecheck/test/build,
   `git diff --check`, and artifact inspection.
6. Create a milestone handoff without committing or pushing.
7. Stop for independent Codex review.
8. Begin the next milestone only after approval.

## Phase B acceptance invariants

- Approved public contracts remain owned by `@crowdcircuit/contracts`.
- Raw connector objects never escape connector/normalizer boundaries.
- Every normalized output is runtime-validated against its specialized schema.
- Timestamps, nullable fields, finite numbers, strict objects, and JSON safety
  retain their approved semantics.
- Event processing remains deterministic and testable with injected time.
- Connector loops are not blocked by downstream work.
- Deduplication and aggregation are event-specific.
- State caches are bounded and flush behavior is explicit.
- Provider libraries remain replaceable behind connector interfaces.
- No Phase C mapping/game action work is implemented.
