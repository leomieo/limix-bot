# Bàn giao: Trợ Lý Limix đề xuất Bot / Nhóm Bot (nhánh `assistant-proposals`)

Trạng thái: **code xong phần lớn, CHƯA commit, CHƯA push**. Nhánh local `assistant-proposals` (tách từ `main`, commit managed beta `0ad3d74` cũng chưa push). Không push/release khi người dùng chưa bảo.

## Yêu cầu của người dùng
Trợ Lý Limix (đổi tên từ Limix Bot) đề xuất tạo Bot / nhóm Bot, hoặc dùng Bot Mẫu / Nhóm Bot Mẫu theo yêu cầu; đề xuất hiện trong khung chat và **hỏi người duyệt**. Đã chốt: người duyệt chọn có tạo nhóm chat hay không ngay trên thẻ; chỉ đổi tên bot mặc định nếu người dùng chưa tự đặt tên.

## Đã làm (chưa commit)
- Đổi tên bot mặc định -> "Trợ Lý Limix" (`shared/default-bot.ts`, `server/default-bot.ts`, `server/limix-assistant-name.ts` + test; bỏ qua bot đã đổi tên và bot khác trùng tên).
- Bot Mẫu dùng chung server/UI: `shared/ready-bots.ts` (src/lib/ready-bots.ts re-export), `shared/new-bot-defaults.ts`.
- Kế hoạch đội: `shared/team-setup.ts`, `server/team-setup-requests.ts` (+test): thẻ duyệt, `room` tuỳ chọn, template Bot Mẫu, `autoApply = null` (luôn chờ duyệt, kể cả full access).
- Công cụ trợ lý: `server/drivers/agents-catalog.ts` (mô tả `propose_team_setup`, `create_bot` -> chỉ đề xuất), `server/chief-of-staff.ts`, `server/routes/internal-chief-team.ts`, `server/routes/bot-messages.ts`, `server/index.ts`. Goldens/budget wire đã tái tạo (50/50 pass).
- UI: `ApprovalCard.tsx`, `PendingApproval.tsx` (+ test), `HelperIntro.tsx`, `SimpleHelperIntro.tsx`, `MausBotCustomize.tsx`, `src/state/store.tsx`. Thẻ có dòng `Group chat (the reviewer chooses): "<tên>" with @<Chief>...`; respond `room:false` = chỉ tạo bot, không tạo nhóm.
- Rebrand: `limix/patches/assistant-proposals.json`, vòng apply cuối `limix/rebrand.py`, bản overlay trong `limix/overlay/**`.
- e2e `server/team-setup.e2e.test.ts` viết lại (đề xuất -> thẻ -> duyệt/chỉ bot/huỷ/xoá/trong nhóm chat). Đã pass ở lần trước khi sửa `create_bot`.

## Còn phải làm (cho Codex)
1. Chạy lại 5 file test: `server/team-setup.e2e.test.ts`, `server/create-bot-model.e2e.test.ts`, `server/index.test.ts`, `server/starter-bots.e2e.test.ts`, `server/no-omb-cards.e2e.test.ts`. Lần chạy cuối bị ngắt, chưa có kết quả. Từng có 8 test lỗi khi `/api/internal/create-bot` bị từ chối; đã bỏ từ chối, nhưng vì `autoApply` = null nên `create_bot` nay trả `{state:"pending", applied:false}` -> test nào còn kỳ vọng "áp dụng ngay + Undo" cần sửa test (hoặc giữ create_bot áp dụng ngay nếu muốn tương thích; quyết định theo ý người dùng: luôn hỏi duyệt).
2. Lỗi có sẵn trên `main` sạch (không phải do thay đổi này): default-bot tests, preload-contract `organization`, 3 UI test node:sqlite, rebrand.py thiếu pattern `botSettings.simple.skills`. Đối chiếu bằng `git stash`.
3. Tái tạo `limix/patches/assistant-proposals.json` + overlay sau các sửa cuối; chạy `python3 limix/rebrand.py` kiểm tra idempotent.
4. `tsc` cả server và app (`NODE_OPTIONS=--max-old-space-size=7000`).
5. Xác minh trong fixture cô lập theo `docs/verification/README.md` (không đụng dữ liệu thật); chạy thử trên giao diện: nói "cần bot viết bài + researcher" -> thẻ -> duyệt.
6. Commit trên `assistant-proposals`, chờ người dùng bảo mới push.

## Mẹo môi trường
Không có Docker; npm cần `npm_config_noproxy=localhost NO_PROXY=localhost`; vitest chạy full rất chậm (chạy nền, dùng `--reporter=json --outputFile`).

## Việc khác còn mở
- Push commit `0ad3d74` (Cloud beta managed) khi người dùng bảo; rồi triển khai trên Xeon theo `HANDOFF_MANAGED_CLOUD_BETA.md` (smoke.mjs, host.ps1 Configure -Generate, secret `LIMIX_BETA_HOST_TOKEN`, workflow "Limix Cloudflare", test Zalo/Telegram tắt laptop, rồi test cô lập khách A/B; giữ cổng 18799 cho quản trị nội bộ).
- Đề xuất chờ trả lời: bộ test prompt-injection cho tin nhắn kênh, quyền theo người gửi, giới hạn chi phí theo khách.
- Luật người dùng: trả lời tiếng Việt, ngắn, từng bước; không đổi/gõ mật khẩu; không bảo người dùng gửi khoá/token; không mua gì khi chưa hỏi; việc thương mại Limix Agent giữ ở repo private.
