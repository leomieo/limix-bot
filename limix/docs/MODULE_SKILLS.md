# MODULE_SKILLS.md — Skill mặc định của Limix Bot (mốc S1)

**Quyết định của chủ dự án (2026-11-11):** đưa skill/tool từ GitHub vào làm mặc định; bot chỉ dùng khi cần; cập nhật
**theo bản phát hành Limix** (gom bản mới → chủ dự án duyệt → phát hành, app tự cập nhật); **gói sẵn Python** trong
file cài. Skill riêng của chủ dự án: làm sau.

## Skill đi kèm (ĐÃ LÀM, chờ build)

| id | Nguồn (ghim commit) | Giấy phép | Cần trên máy khách | Bật |
|---|---|---|---|---|
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill `6ae86f6` | MIT | Python (đi kèm) | Có |
| `agent-reach` | Panniantong/Agent-Reach `c70ae6d` | MIT | uv (đi kèm) cài lệnh `agent-reach` lần đầu, hỏi người dùng trước; vài kênh phải đăng nhập | Có |
| `rea-video` | JuneYaooo/rea-video `3669923` | Apache-2.0 (có NOTICE) | uv cài `rea-video` lần đầu (~vài trăm MB thư viện) + **ffmpeg** (chưa đi kèm); tùy chọn khóa API mô hình xem ảnh | Có |

- Danh sách và từ khóa kích hoạt: `limix/skills/sources.json`. Bot nhận skill khi tin nhắn chứa một từ khóa
  (`server/skill-library.ts` `selectBundledSkills`), giống 5 skill sẵn có của OpenMausBot.
- `python3 limix/skills/sync.py` dựng lại `limix/overlay/skills/<id>/` từ commit đã ghim (SKILL.md gốc + đoạn mở đầu
  "Limix Bot" hướng dẫn chạy, `manifest.json`, `LICENSE`/`NOTICE`); rebrand chép sang `skills/`.
- **Cập nhật:** `python3 limix/skills/sync.py --update` → xem `git diff limix/` (skill bên ngoài có thể bảo bot chạy lệnh
  trên máy khách) → chủ dự án duyệt → commit → build phát hành.
- Thử (2026-11-11): bộ đọc manifest (luật của `parseSkillManifest`) nhận đủ 8 skill; câu "Thiết kế giao diện landing
  page…" → ui-ux-pro-max; "đọc bài reddit…" → agent-reach; "phân tích video…" → rea-video; "chào bạn" → không skill;
  script `search.py` của ui-ux-pro-max chạy được bằng Python. CHƯA thử: bot thật dùng skill trên Windows.

## Python và uv đi kèm (ĐÃ LÀM, chờ build)

- Workflow Windows tải **CPython 3.12.16** (python-build-standalone `20261026`, bản `install_only_stripped`) và
  **uv 0.13.5**, kiểm SHA-256 ghim sẵn, đặt vào `resources/limix-runtime/{python,uv}` (+ `python3.exe`).
- `electron/limix-runtime.mjs` (bước rebrand 8g): `OMB_EXTRA_PATH` (máy chủ đặt lên đầu PATH của mọi engine,
  `server/env-path.ts`), `UV_PYTHON`, công cụ cài bằng uv vào `userData/limix-tools` (giữ qua cập nhật, không cần admin).
- File cài nặng thêm khoảng 35–45 MB.

## rea (Reverse Engineer Anything) — tắt sẵn, CHƯA đóng gói

MCP server + CLI (MIT), cần Node.js/npx trên máy khách và tùy loại Ghidra/JADX/JDK. Upstream có DISCLAIMER: chỉ dùng
hợp pháp (nghiên cứu bảo mật, phần mềm mình có quyền). OpenMausBot chưa có danh mục "MCP gợi ý" để thêm sẵn ở trạng thái
tắt, nên hiện bật thủ công: **Plugins → MCP servers → Add server**, dán `npx -y rea-agents@6.8.0 mcp`.
Việc thêm danh mục MCP gợi ý (tắt sẵn) là ĐỀ XUẤT cho sau.
