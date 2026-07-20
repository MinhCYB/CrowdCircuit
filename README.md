# CrowdCircuit Documentation Workspace

Bộ tài liệu này dùng để nhiều coding agent làm việc tuần tự trên cùng repository mà không mất ngữ cảnh.

## Source of truth

1. `docs/crowdcircuit-system-design-v0.1.1.md`
2. `docs/crowdcircuit-studio-ui-ux-spec-v0.1.md`
3. `docs/execution/ROADMAP.md`
4. `docs/execution/PROJECT_STATUS.md`
5. `docs/execution/DECISIONS.md`
6. `docs/execution/KNOWN_ISSUES.md`
7. `docs/execution/CURRENT_TASK.md`
8. Handoff gần nhất trong `docs/handoffs/`

## Quy tắc vận hành

- Mỗi agent chỉ xử lý một task ID.
- Không triển khai ngoài phạm vi `CURRENT_TASK.md`.
- Trước khi code, agent phải kiểm tra repo thật bằng `git status`, `pnpm test`, `pnpm typecheck`.
- Trước khi kết thúc, agent phải cập nhật `PROJECT_STATUS.md` và tạo handoff mới.
- Không đánh dấu `DONE` nếu acceptance criteria hoặc test chưa đạt.
- Mọi thay đổi contract phải được ghi vào `DECISIONS.md` và cập nhật tài liệu liên quan.
- `PROJECT_STATUS.md` phải phản ánh trạng thái thật của repo, không phản ánh dự đoán.

## Task đầu tiên

`FOUND-01 — Monorepo Scaffold`

Xem `docs/execution/CURRENT_TASK.md`.
