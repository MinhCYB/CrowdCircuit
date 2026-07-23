# CrowdCircuit — Handoff cho Codex từ FOUND-02C

**Ngày bàn giao:** 2026-07-23  
**Repository:** `https://github.com/MinhCYB/CrowdCircuit`  
**Branch:** `main`  
**Commit đã push gần nhất tại thời điểm bàn giao:** `6ecd211` — `found 02b-01`

## 1. Vai trò từ thời điểm này

Codex tiếp quản vai trò:

- Technical Lead.
- Architecture Guardian.
- Task Planner.
- Prompt Orchestrator cho Gemini Flash.
- Independent Reviewer.
- Final task gatekeeper.

Phân công:

| Vai trò | Trách nhiệm |
|---|---|
| Codex | Đọc repo, chia task, viết prompt Gemini, review exact diff, chạy test, chốt verdict |
| Gemini Flash High | Triển khai đúng một micro-task theo prompt Codex |
| User | Product Owner, commit/push và xử lý BLOCKED_DECISION |

Codex không nên làm implementation chính trong flow mặc định.

Codex chỉ sửa trực tiếp khi lỗi:

- Cơ học.
- Phạm vi rõ.
- Ít file.
- Không thay đổi public contract hoặc kiến trúc.

Các sửa đổi lớn phải được chuyển thành rework prompt cho Gemini.

---

## 2. Bối cảnh sản phẩm

CrowdCircuit by MS24 Labs là hệ thống local-first kết nối TikTok LIVE events với:

- Interactive games.
- Event-to-action mappings.
- Voice reaction và TTS.
- Admin dashboard.
- Simulator.
- Diagnostics.

Tagline:

`Turn live viewers into players.`

Stack:

- Node.js + TypeScript.
- pnpm monorepo.
- Fastify.
- React + Vite.
- Socket.IO.
- Zod.
- SQLite + Drizzle.
- Pino.
- Vitest.
- Phaser.

---

## 3. Nguồn thông tin

Long-form specifications:

- `docs/crowdcircuit-system-design-v0.1.1.md`
- `docs/crowdcircuit-studio-ui-ux-spec-v0.1.md`

Execution documents:

- `docs/execution/ROADMAP.md`
- `docs/execution/PROJECT_STATUS.md`
- `docs/execution/CURRENT_TASK.md`
- `docs/execution/DECISIONS.md`
- `docs/execution/KNOWN_ISSUES.md`
- `docs/execution/AGENT_WORKFLOW.md`

Task briefs hiện có:

- `docs/tasks/FOUND-02C.md`
- `docs/tasks/FOUND-02D.md`
- `docs/tasks/FOUND-02E.md`
- `docs/tasks/FOUND-02F.md`

Relevant handoffs:

- `HANDOFF-FOUND-01.md`
- `HANDOFF-FOUND-02A.md`
- `HANDOFF-FOUND-02A-PATCH-01.md`
- `HANDOFF-FOUND-02A-PATCH-02.md`
- `HANDOFF-FOUND-02B.md`
- `HANDOFF-FOUND-02B-PATCH-01.md`

Thứ tự nguồn sự thật:

1. Repository hiện tại.
2. Git status, history và exact diff.
3. Command output thực tế.
4. System Design và accepted decisions.
5. Task brief.
6. Handoff và PROJECT_STATUS sau khi đã xác minh.

---

## 4. Trạng thái đã hoàn thành

### FOUND-01

Monorepo scaffold.

### FOUND-02A

Contracts package foundation:

- `@crowdcircuit/contracts`.
- Zod.
- Package scripts.
- Public export structure.
- Tests nằm ngoài `src`.
- Root Vitest nhận contract tests.
- `dist` không chứa test artifacts.

### FOUND-02B

Common primitives và `LiveEventEnvelope` base.

### PATCH-FOUND-02B-01

Commit `6ecd211` đã xử lý các issue do Codex review phát hiện:

- Payload là required ở runtime và type level.
- Payload base dùng recursive JSON-safe schema.
- Base envelope type được infer từ Zod.
- Factory parameters bắt buộc.
- Factory giữ payload specialization.
- Factory giữ event type literal specialization.
- Event type schema bị giới hạn output là string.
- Có declaration-consumer test.
- `SPEC_VERSION` chỉ có một nguồn sự thật.
- ADR của envelope được đổi từ ID trùng `ADR-008` sang `ADR-009`.
- Không có concrete payload schema của FOUND-02C.

Reported verification từ implementation session:

- Contracts runtime tests: 33 tests, 3 files.
- Repository tests: 35 tests, 4 files.
- Declaration test: passed.
- Contracts lint/typecheck/build: passed.
- Repository lint/typecheck/build: passed.
- `dist` sạch.

Codex phải rerun, không được coi report này là bằng chứng cuối cùng.

---

## 5. Chốt FOUND-02B

FOUND-02B được xem là:

`DONE — APPROVED FOR CLOSURE`

Không mở lại FOUND-02B chỉ vì tài liệu trạng thái stale.

Residual documentation cleanup được gộp vào đầu FOUND-02C:

- `PROJECT_STATUS.md` có thể vẫn nói patch chưa commit.
- “Next recommended task” có thể còn trỏ FOUND-02B.
- `CURRENT_TASK.md` có thể chưa nhắc patch handoff mới nhất.

Codex phải đồng bộ các mục này theo repository thật trước khi giao implementation FOUND-02C.

---

## 6. Current task

`FOUND-02C — LIVE Event Payload Schemas`

Expected next task:

`FOUND-02D — GameActionEnvelope and Action Lifecycle Schemas`

Không triển khai FOUND-02D trong 02C.

---

## 7. Routine đầu mỗi cycle

Codex phải chạy:

```bash
git status
git rev-parse --short HEAD
git log -5 --oneline
node --version
pnpm --version

pnpm --filter @crowdcircuit/contracts lint
pnpm --filter @crowdcircuit/contracts typecheck
pnpm --filter @crowdcircuit/contracts test
pnpm --filter @crowdcircuit/contracts build
pnpm --filter @crowdcircuit/contracts test:declarations

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Sau đó:

- Đọc current task brief.
- Đọc relevant latest handoff.
- Chỉ đọc exact System Design sections được task yêu cầu.
- Kiểm tra `packages/contracts/dist`.
- Đồng bộ execution docs nếu stale.

---

## 8. Codex operating cycle

### Stage A — Inspect

- Xác minh repo.
- Xác định exact current task.
- Đọc task brief.
- Kiểm tra dependency và public contracts.
- Phát hiện ambiguity.
- Quyết định task có cần tách nhỏ không.

### Stage B — Plan

Codex phải xác định:

- Objective.
- Allowed paths.
- Required work.
- Must-not-do.
- Contract invariants.
- Acceptance criteria.
- Runtime tests.
- Type/declaration tests.
- Verification.
- Documentation updates.
- Handoff format.

### Stage C — Write Gemini prompt

Gemini prompt phải đầy đủ và tự chứa đủ ngữ cảnh cần thiết.

Gemini không được:

- Tự mở rộng scope.
- Tự bắt đầu task sau.
- Tự chốt quyết định kiến trúc lớn.
- Commit nếu chưa được yêu cầu.

### Stage D — Review Gemini result

Sau khi user push:

- Xác định implementation commit và parent commit.
- Inspect exact diff.
- Rerun relevant package và repository commands.
- Probe runtime behavior.
- Inspect emitted declarations.
- Inspect build artifacts.
- Check scope creep.
- Check docs consistency.

### Stage E — Verdict

Chỉ dùng:

- `APPROVE`
- `APPROVE WITH SMALL FIX`
- `REQUEST CHANGES`
- `BLOCKED_DECISION`

### Stage F — Next action

- APPROVE → tạo prompt task kế tiếp.
- SMALL FIX → Codex sửa trực tiếp nếu thật sự cơ học.
- REQUEST CHANGES → tạo focused rework prompt cho Gemini.
- BLOCKED_DECISION → hỏi user.

---

## 9. Architecture guardrails

Codex phải bảo vệ:

- Runtime schema/type cùng source of truth.
- Không dùng `any`.
- Không dùng `z.any()` thiếu kiểm soát.
- Transport contracts JSON-safe.
- Optional và nullable đúng semantics.
- Connector-neutral normalized events.
- Public exports ổn định.
- Không duplicate constants/schemas.
- Không trùng ADR ID.
- Receipt ACK khác completion result.
- Event-specific dedup semantics.
- Gift streak timeout semantics.
- Tests không bị emit vào package.
- Package-name consumer resolution được chứng minh ở FOUND-02F.
- Không implementation task tương lai sớm.

---

## 10. Definition of Done

Một micro-task chỉ DONE khi:

- Required code hoàn thành.
- Positive/negative tests đầy đủ.
- Type/declaration behavior đúng.
- Package verification pass.
- Repository verification pass.
- Build output sạch.
- Không scope creep.
- Execution docs đúng với repo.
- Handoff mới tồn tại.
- Codex review approve.

---

## 11. Nhiệm vụ đầu tiên của Codex

Trong phiên đầu tiên từ FOUND-02C:

1. Không code ngay.
2. Verify repository.
3. Confirm actual HEAD.
4. Reconcile stale documentation.
5. Read FOUND-02C brief.
6. Đánh giá task có quá lớn không.
7. Chia FOUND-02C nếu cần.
8. Tạo prompt hoàn chỉnh cho Gemini Flash High.
9. Không commit/push.
