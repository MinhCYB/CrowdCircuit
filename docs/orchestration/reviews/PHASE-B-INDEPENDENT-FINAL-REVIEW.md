# Phase B Independent Final Review

**Date:** 2026-07-23  
**Reviewer:** Codex independent final acceptance reviewer  
**Branch:** `main`  
**Base and reviewed HEAD:** `8c3f2e4` (`feat: complete Phase A contract foundation`)  
**Reviewed state:** complete accumulated uncommitted Phase B working tree  
**Verdict:** **REQUEST CHANGES**

## 1. Repository and working-tree evidence

- `git rev-parse --short HEAD`: `8c3f2e4`.
- `git log -5 --oneline` begins with `8c3f2e4 feat: complete Phase A contract foundation`.
- The working tree contains the tracked Phase B changes and all untracked
  connector, pipeline, gateway, test, prompt, review, and handoff files listed
  by `git status --short` and `git ls-files --others --exclude-standard`.
- `git diff HEAD --stat` reports 17 tracked files changed, 1,918 insertions,
  and 162 deletions. The untracked inventory includes the complete
  `connector-tiktok` package, the Phase B tests, pipeline/gateway sources, and
  orchestration evidence.
- The complete tracked diff and every untracked Phase B source/test/document
  were reviewed. No implementation file was modified by this review.
- Runtime: Node.js `v24.15.0`; pnpm `11.9.0`.

The initial non-interactive pnpm invocation stopped before project scripts
because pnpm wanted permission to reconcile `node_modules`. Re-running with
`CI=true` used the existing local store and all requested commands executed.
This was an environment preflight issue, not a project test failure.

## 2. Findings grouped by severity

### High — end-to-end deduplication cannot identify replayed raw events

`EventDeduplicator.accept()` keys every non-like event only by
`eventType:eventId` (`packages/event-core/src/pipeline.ts`). The normalizer
generates a new `eventId` for every normalization call
(`packages/event-core/src/index.ts`), while `RawConnectorEvent` has no stable
connector event ID or sequence field. Consequently, the same raw connector
event delivered twice through `HeadlessEventGateway` becomes two different
normalized IDs and both are emitted.

Independent smoke evidence: the exact same raw comment object was passed to
`emitMockEvent()` twice. The gateway emitted `smoke_5` and `smoke_6`;
`duplicateOutputs` was `2`. This violates Milestone 2's event-specific
deduplication requirement, the design priority for connector IDs/sequence IDs
and safe fingerprints, and Milestone 4's “no duplicate output where
deduplication applies” acceptance condition.

The permanent tests do not catch the defect. They call the deduplicator twice
with the same already-normalized object and therefore the same synthetic
normalized ID. The gateway acceptance test has no repeated raw input.

Required correction: preserve a trustworthy provider/connector event identity
or implement the approved event-specific fingerprints at the correct boundary,
then add raw-to-gateway replay regressions for gift, comment, and social events,
including the short comment window and the conservative no-safe-key behavior.

### High — gift streak state is inferred without the identity or lifecycle facts required by the design

The normalizer correctly emits the neutral raw interpretation
`streak: { id: null, status: "single" }`. However,
`GiftStreakAggregator.process()` treats every gift whose catalog metadata says
`streakable: true` as a streak start/update, creates
`streak_${event.eventId}`, and groups by room, user fallback, and gift ID.
Neither the connector boundary nor TikTok mapping carries a provider streak ID,
provider streak status, sequence, or explicit connector-END signal.

As a result:

- unrelated streakable gifts from the same viewer for the same gift within the
  timeout are merged even when no provider fact establishes one streak;
- all userless gifts in a room for the same gift share the internal
  `"anonymous"` key;
- the required `connector_end` finalization path is absent;
- provider END cannot be distinguished from an ordinary update;
- a synthetic streak ID and progression are exposed as normalized contract
  facts even though the available input cannot establish that identity.

The bounded inactivity, maximum-lifetime, capacity, disconnect, and shutdown
cleanup mechanics work, but they operate on state that can be opened and merged
incorrectly. The tests construct neutral normalized gifts and assert that the
aggregator invents a streak; they do not test separate provider streaks,
missing user identity, or connector END.

Required correction: carry and validate the minimum provider-independent
streak evidence needed by the approved state machine (or conservatively pass
through when it is absent), support explicit connector END, avoid grouping
unknown users, and add cross-boundary raw/TikTok/gateway tests.

### Medium — milestone and self-review claims overstate Milestone 2 and Phase B acceptance

`PROJECT_STATUS.md`, the Milestone 2/4 handoffs, and the implementation
self-review claim complete event-specific deduplication and gift streak
lifecycle. The two High findings show those claims are not currently true.
`KNOWN_ISSUES.md` lists only deferred concrete TikTok provider composition.
After correction, orchestration documents must be reconciled with the actual
behavior and fresh evidence.

### No Critical findings

No credential leak, arbitrary native exception leak from the mock malformed
input boundary, package cycle, declaration source leak, or Phase C
implementation was found.

## 3. Milestone-by-milestone acceptance matrix

| Milestone | Acceptance criterion | Implementation and permanent evidence | Result |
|---|---|---|---|
| 1 | Provider-independent connector contract and complete lifecycle | `connector-core/src/index.ts`; connector-core declaration consumer; mock lifecycle tests | Pass |
| 1 | Deterministic mock gift/comment/follow/like input | `connector-mock/src/index.ts`; 10 mock tests | Pass |
| 1 | Defensive malformed-input boundary with typed failures and no partial delivery/state | clone/descriptor validation in connector-mock; getter, proxy, cycle, sparse-array, unsafe-key, unsupported-value tests | Pass |
| 1 | Strict normalization into specialized schema and `LiveEventEnvelopeSchema` | `EventNormalizer`; 28 event-core tests include 14 normalizer tests | Pass |
| 1 | Nullable, numeric, sender, identity, and non-fabrication semantics | normalizer tests cover fractional diamond value, zero like total, integer quantities, finite values, required identities, and neutral streak/milestone | Pass |
| 1 | Clean package declarations and package-name consumers | four focused declaration suites; dist inspection | Pass |
| 2 | Event-specific deduplication integrated with the raw-to-normalized path | ID-only deduplicator; direct normalized-object tests only | **Fail** |
| 2 | Bounded TTL state | bounded `Map` caches with TTL/capacity tests | Pass mechanically |
| 2 | Gift streak start/update/end and connector END semantics | inactivity/max lifetime/capacity/flush implemented; no provider streak identity or connector END | **Fail** |
| 2 | Like interval/milestone aggregation and disconnect flush | `LikeAggregator`; positive, milestone, capacity, interval, and flush tests | Pass |
| 2 | Deterministic reset/cleanup and cross-stage integration | pipeline and gateway flush tests | Partial because incorrectly inferred streak state is cleaned correctly |
| 3 | Replaceable TikTok provider port and dependency containment | injectable `TikTokProviderClient`; ADR-011; no provider dependency | Pass |
| 3 | Status, cleanup, bounded reconnect, and error isolation | 8 TikTok tests | Pass |
| 3 | Minimal raw mapping without provider-object leakage | mapping code/tests and smoke/dist inspection | Pass, but mapping lacks streak lifecycle evidence needed by Milestone 2 |
| 4 | Ordered headless connector → normalize → integrity boundary | `HeadlessEventGateway`; gateway tests; independent smoke | Pass for ordering and observer isolation |
| 4 | Duplicate/replay-risk acceptance | no raw replay regression; independent smoke emits duplicate twice | **Fail** |
| 4 | Failure, disconnect, burst, cleanup, and observable output | malformed input, tick, flush, stats, and lifecycle tests | Pass except for the failed streak semantics |
| 4 | No Phase C implementation | no mapping rule/action delivery/game gateway behavior added | Pass |

Later milestones did not weaken Milestone 1's strict normalization or mock
input guarantees. They did, however, add derived streak facts after
normalization without sufficient raw evidence.

## 4. Connector and lifecycle assessment

`connector-core` is provider-independent. `ConnectorConfig`,
`ConnectionInfo`, the `ended` state, subscriptions, errors, and lifecycle
methods are public from the package root. TikTok-specific types do not leak
into it. Project references point from mock/TikTok/event-core toward
connector-core and contracts.

The mock connector behavior is strong:

- connect returns stable `ConnectionInfo`; repeated connect is idempotent and
  ignores conflicting later configuration without mutation;
- disconnect, stream-ended, and destroy are repeat-safe;
- destroy is terminal and subscriptions after destroy are inert;
- clocks are validated before lifecycle mutation where applicable;
- listener failures are isolated and error dispatch is non-recursive;
- cleanup occurs despite listener and destroy-clock failures.

The malformed-input clone boundary inspects descriptors rather than invoking
getters, rejects accessors, sparse arrays, cycles, unsafe keys, non-plain
objects, undefined/non-finite/unsupported values, and wraps reflection/proxy
failures in `MockConnectorInputError`. It preserves shared acyclic references,
does not notify `onError` for caller input mistakes, and defensively detaches
delivered values. No assertion escape or prototype-pollution path was found.

## 5. Event normalization assessment

Gift, comment, follow, and like raw inputs map to their specialized
`@crowdcircuit/contracts` schemas and then to
`LiveEventEnvelopeSchema`. Failures are stable `NormalizationResult` failures
and do not emit partial normalized events.

Verified behavior includes strict sender validation, no anonymous or provider
fact fabrication, explicit required nullable fields, null mapping for
unavailable values, required gift/streamer identity, neutral raw streak
semantics, null pre-aggregation like milestone, finite nonnegative decimal
diamond values, zero like total, integer-only quantities/deltas, and rejection
of NaN/infinities. Provider-only fields are absent. No duplicate public LIVE
contract definitions were introduced.

## 6. Later-milestone behavior assessment

Like aggregation is deterministic and bounded. It accumulates per room,
emits on interval or configured milestone, flushes on disconnect/shutdown, and
clears state. Like events deliberately bypass deduplication.

Deduplication storage is bounded and TTL-pruned, but it is not effective across
the actual connector-normalizer boundary because only the newly generated
normalized ID is keyed.

Gift storage is bounded and cleanup is deterministic, but streak creation,
grouping, and finalization are not semantically safe without provider streak
identity/status. No `connector_end` reason exists.

The gateway serializes work through a promise chain, preserves observed order,
isolates downstream listeners, flushes on disconnected/ended status, and
resets dedupe state on flush. No mapping, game action, socket, persistence,
authentication, UI, or voice behavior was added.

## 7. End-to-end smoke-test evidence

The independent smoke used built package artifacts and an injected deterministic
clock/ID sequence:

`MockConnector → HeadlessEventGateway → EventNormalizer → EventIntegrityPipeline → observer`

Inputs: one gift, one comment, one follow, one like, the same raw comment
object twice, malformed raw input containing `undefined`, a timer tick, and
disconnect/stop.

Exact evidence:

- gift: `smoke_1`, `gift_start`, then one `inactivity_timeout` end;
- comment: `smoke_2`, passthrough;
- follow: `smoke_3`, passthrough;
- like: `smoke_4`, interval output with `delta: 2`, `total: 2`,
  `milestone: null`;
- replayed raw comment: both `smoke_5` and `smoke_6` emitted;
- malformed caller input: `MockConnectorInputError`, no gateway receipt or
  partial event;
- stats: `rawReceived: 6`, `normalizationRejected: 0`,
  `normalizedAccepted: 6`, `emitted: 7`;
- provider leakage check: false;
- `duplicateOutputs: 2` (**acceptance failure**);
- stop completed and flushed/cleared state deterministically.

## 8. Package and declaration assessment

- The Phase B package graph is acyclic:
  contracts/connector-core → connector-mock and connector-tiktok;
  contracts/connector-core → event-core; connector-mock is event-core
  development-only.
- Runtime and development dependency classifications are appropriate.
- Package exports expose their intended roots; no verification-only symbol was
  found in production barrels.
- Emitted declarations use package names for cross-package references.
  Internal event-core files use emitted `./index.js`/`./pipeline.js`
  references, not source paths.
- No `src`, workspace absolute path, test, spec, or fixture leak was found in
  Phase B declarations/dist.
- Package declaration consumers compile by package name and include active
  `@ts-expect-error` negative cases.
- No unnecessary external TikTok dependency was introduced.

## 9. Test-quality and count reconciliation

Fresh repository test result: **225 passed tests across 14 files**, exactly
matching the claim.

Focused counts also match:

- connector-core: 2;
- connector-mock: 10;
- event-core: 28 across 3 files;
- connector-tiktok: 8.

All package test scripts execute nonzero intended tests. All declaration
scripts executed successfully. The declaration consumers contain positive use
and invalid `@ts-expect-error` cases. Deterministic clocks/IDs are used in the
Phase B tests.

The material quality gap is behavioral, not numerical: dedup tests bypass the
raw/normalizer identity boundary, the gateway suite has no replay input, and
gift tests assert inferred synthetic streak progression without supplying the
provider identity/lifecycle facts required to make that inference safe.

## 10. Scope and documentation assessment

Node/pnpm documentation matches the runtime. Phase B is correctly not marked
DONE and Phase C remains blocked/TODO. Historical Milestone 1 handoffs and
reviews are distinguishable from current evidence. The concrete TikTok
provider limitation is honestly recorded and non-blocking for the injectable
adapter scope.

The current status, final handoff, Milestone 2 handoff, and self-review
overstate deduplication and gift-streak completeness. They must not be used to
advance the gate until the High findings are corrected and independently
reverified.

## 11. Exact verification results

With `CI=true` where pnpm execution required it:

- connector-core: lint PASS; typecheck PASS; 2 tests PASS; build PASS;
  declarations PASS.
- connector-mock: lint PASS; typecheck PASS; 10 tests PASS; build PASS;
  declarations PASS.
- event-core: lint PASS; typecheck PASS; 28 tests PASS; build PASS;
  declarations PASS.
- connector-tiktok: lint PASS; typecheck PASS; 8 tests PASS; build PASS;
  declarations PASS.
- contracts forced build:
  `node_modules/.bin/tsc.cmd -b packages/contracts --force` PASS.
- contracts declarations PASS.
- repository `pnpm lint` PASS.
- repository `pnpm typecheck` PASS.
- repository `pnpm test` PASS: 225 tests, 14 files.
- repository `pnpm build` PASS, including dashboard Vite production build.
- `git diff --check HEAD --` PASS; only Git's informational LF→CRLF warnings
  were printed.
- Phase B dist JavaScript/declarations inspected: PASS for packaging/source
  containment.
- independent smoke: executed successfully but **failed deduplication
  acceptance** with two outputs for one repeated raw input.

The literal command
`pnpm --filter @crowdcircuit/contracts exec tsc -b --force` could not locate
`tsc` in this Windows pnpm execution context. The equivalent direct workspace
binary command above executed the required forced contracts build and passed.

## 12. Verdict

**REQUEST CHANGES**

Phase B must remain `READY_FOR_INDEPENDENT_FINAL_REVIEW` (or return to
`IN_PROGRESS`). The raw-to-gateway deduplication defect and unsupported gift
streak inference affect correctness, replay safety, data integrity, and
Milestone 2/4 acceptance. They are substantive behavior/architecture defects,
not local mechanical fixes. Do not mark Phase B DONE, commit it as accepted, or
begin Phase C until both are corrected, permanently tested across package
boundaries, and independently re-reviewed.
