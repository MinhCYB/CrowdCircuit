# FOUND-02E Codex Review 02

## Review basis

- Task: `FOUND-02E`
- Review type: independent re-review of the complete accumulated working tree
- Base: `HEAD 76d7013`
- Scope inspected: tracked changes and all untracked files
- Implementation commit: not required for this working-tree review
- Initial-review mutation policy: no files were modified during the review
- Review date: 2026-07-23

## Repository and working-tree evidence

The working tree contains the accumulated FOUND-02E implementation, REWORK-01 changes, execution-document updates, orchestration artifacts, handoffs, source files, and tests. `git diff HEAD --`, `git diff HEAD --stat`, `git ls-files --others --exclude-standard`, and `git status` were used together so that untracked task files were included in the assessment.

Fresh tool output:

- Node.js: `v24.15.0`
- pnpm: `11.9.0`
- `git diff --check HEAD --`: passed

No FOUND-02F implementation was present.

## Findings

### High — root-relative audio path validation misses unsafe values after one decode pass

- File: `packages/contracts/src/voice/protocol.ts`
- Area: `isValidAudioUrl`
- Evidence: independent runtime probes showed that the schema accepts:
  - `/a/..%2fb.mp3`
  - `/a/%2f..%2fb.mp3`
  - `/a%0ab.mp3`
- Why it matters: after one percent-decoding pass, these values contain traversal separators or a control character. A downstream component that decodes the accepted local path once could therefore observe a materially less safe path than the validator inspected.
- Minimal fix: apply one safe decoding pass to root-relative paths only, reject decoding failures, then validate the decoded representation for backslashes, control characters, query or fragment delimiters, and `.` or `..` path segments. Retain the existing absolute `http:` and `https:` URL validation.
- Next-task impact: blocks FOUND-02E approval and FOUND-02F.

The independently probed `/a/%252e%252e/b.mp3` value is accepted. This is not a blocking case for the current repository because it requires a second decoding pass and no double-decoding boundary is defined. The limitation must be documented without claiming that this value is rejected.

### Medium — production variables validation retains a type assertion

- File: `packages/contracts/src/voice/intent.ts:33`
- Evidence:

  ```ts
  const v = (val as Record<string, unknown>)[key];
  ```

- Why it matters: REWORK-01 required an assertion-free implementation. The surrounding runtime checks are sound, but this remains an unchecked TypeScript escape hatch in production contract code.
- Minimal fix: after the existing plain-object validation, read the property with `Reflect.get(val, key)` and preserve all current container, symbol-key, and scalar-value validation.
- Next-task impact: blocks FOUND-02E approval and FOUND-02F.

### Low — current documentation contains stale tool and Git-status evidence

- Files:
  - `docs/execution/PROJECT_STATUS.md:16`
  - `docs/handoffs/HANDOFF-FOUND-02E.md:60`
  - `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md:30`
  - `docs/handoffs/HANDOFF-FOUND-02E-REWORK-01.md:63`
- Evidence: the current documents record pnpm `11.15.1`, while the fresh command output is pnpm `11.9.0`.
- Additional evidence: the REWORK-01 handoff's Git-status description does not accurately represent the accumulated working tree; some source and test files are untracked, and accumulated decision, prompt, and review changes are omitted.
- Why it matters: current execution and handoff records must distinguish verified current state from an earlier snapshot.
- Minimal fix: record Node.js `v24.15.0` and pnpm `11.9.0` in current FOUND-02E records, and make handoff Git-status evidence match fresh output or label it clearly as historical.
- Next-task impact: blocks clean closure but is mechanical once the contract findings are fixed.

## Previous-finding resolution matrix

| Previous requirement | Result | Evidence |
| --- | --- | --- |
| Public callbacks are exactly `playback.started`, `playback.finished`, `playback.interrupted`, and `playback.failed` | Resolved | Runtime, declaration tests, and emitted declarations use the approved literals. |
| Legacy `voice.playback.*` literals are rejected | Resolved | Runtime and package-name declaration coverage rejects the legacy family. |
| ADR-010 distinguishes public callbacks from potential internal events | Resolved | The decision record makes the protocol boundary explicit. |
| Absolute audio URLs are limited to valid `http:` and `https:` URLs | Resolved | Runtime probes accepted valid HTTP(S) URLs and rejected other schemes, credentials, and malformed URLs. |
| Root-relative audio paths are conservatively validated | Not resolved | One-pass encoded traversal/control cases remain accepted. |
| Variables accept intended plain containers and reject non-plain containers | Resolved | Ordinary and null-prototype objects pass; class instances, Date, Map, Set, arrays, null, and functions fail. |
| Variables retain string-or-finite-number values | Resolved | Runtime probes and declarations preserve `Record<string, string | number>`. |
| No unsafe assertions or unchecked escape hatches | Not resolved | One production `as Record<string, unknown>` assertion remains. |
| Prior LIVE, action, voice, and declaration regressions remain | Resolved | Existing suites remain and all fresh verification commands pass. |
| Current documentation is accurate | Not resolved | pnpm and handoff Git-status evidence remain stale. |
| FOUND-02E remains active and FOUND-02F remains blocked | Resolved | ROADMAP and CURRENT_TASK retain the required state. |

## Verification results

Fresh commands completed successfully:

- Contracts lint: passed
- Contracts typecheck: passed
- Contracts runtime tests: passed — 143 tests across 6 files
- Contracts forced build: passed
- Contracts package-name declaration tests: passed
- Repository lint: passed
- Repository typecheck: passed
- Repository tests: passed — 145 tests across 7 files
- Repository build: passed
- `git diff --check HEAD --`: passed

## Declaration and dist assessment

- `packages/contracts/dist/voice/intent.d.ts` preserves `VoiceIntentVariablesSchema` input and output as `Record<string, string | number>`.
- Public voice callback declarations contain only:
  - `playback.started`
  - `playback.finished`
  - `playback.interrupted`
  - `playback.failed`
- No public `voice.playback.*` callback literals were found in the emitted voice declarations.
- Voice submodule and package-root exports are present.
- No test or declaration-consumer fixture leaked into `dist`.
- No `any` or `z.any()` regression was found in the reviewed voice contract implementation.

## Scope assessment

The implementation remains within FOUND-02E. No FOUND-02F implementation, internal voice event bus, URL fetching, filesystem access, or unrelated runtime voice system was introduced.

## Verdict

**REQUEST CHANGES**

FOUND-02E remains `PARTIAL`. FOUND-02F remains blocked pending implementation of the focused fixes and an independent re-review.
