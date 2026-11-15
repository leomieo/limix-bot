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

## Kết quả chạy test cuối (so với baseline `main` sạch, 5 file trên)
Baseline lỗi sẵn 154 test (phần lớn index.test.ts, môi trường sandbox). Sau thay đổi: 159 lỗi, trong đó **10 test lỗi MỚI** (5 test baseline được sửa nhờ thay đổi). Cả 10 đều do cùng một nguyên nhân: các test này khẳng định hành vi gốc "bot ở Full/Auto tạo bot/đội **ngay, không thẻ, có Undo**", còn thay đổi mới bắt buộc luôn hiện thẻ chờ duyệt (`autoApply = null`):
- server/create-bot-model.e2e.test.ts: "Chief creation uses the workspace default or a validated explicit model..."
- server/index.test.ts: "adds a specialist the Chief chose itself at once...", "lands a created operator in a requested working folder...", "takes a created operator's role description up to 4000 characters...", "tells the Chief ... when a bot it adds takes the person's own name"
- server/no-omb-cards.e2e.test.ts (4 test: Full/Auto, tạo đội + lưu team fact với Undo)
- server/starter-bots.e2e.test.ts: "a Chief's create_bot and team setup make bots past five..."

**ĐÃ QUYẾT: người dùng chọn cách A** (luôn hỏi duyệt cho cả create_bot và đề xuất đội; sửa 10 test theo hành vi mới; kiểm tra riêng 4 test team fact). Hai phương án đã cân nhắc: (a) giữ "luôn hỏi duyệt" -> sửa 10 test sang kỳ vọng thẻ pending rồi duyệt qua `/api/threads/:id/respond`; hoặc (b) chỉ bắt duyệt cho `propose_team_setup`, để `create_bot` tạo ngay như gốc (ít test phải sửa nhưng lệch yêu cầu "hỏi người duyệt"). Lưu ý "team fact" (no-omb-cards) có thể bị ảnh hưởng ngoài ý muốn: kiểm tra `autoApply` có đang chặn cả phần lưu team fact không, nếu có thì đó là lỗi cần sửa vì yêu cầu chỉ nói về đề xuất bot/nhóm.

## Mẹo môi trường
Không có Docker; npm cần `npm_config_noproxy=localhost NO_PROXY=localhost`; vitest chạy full rất chậm (chạy nền, dùng `--reporter=json --outputFile`).

## Việc khác còn mở
- Push commit `0ad3d74` (Cloud beta managed) khi người dùng bảo; rồi triển khai trên Xeon theo `HANDOFF_MANAGED_CLOUD_BETA.md` (smoke.mjs, host.ps1 Configure -Generate, secret `LIMIX_BETA_HOST_TOKEN`, workflow "Limix Cloudflare", test Zalo/Telegram tắt laptop, rồi test cô lập khách A/B; giữ cổng 18799 cho quản trị nội bộ).
- Đề xuất chờ trả lời: bộ test prompt-injection cho tin nhắn kênh, quyền theo người gửi, giới hạn chi phí theo khách.
- Luật người dùng: trả lời tiếng Việt, ngắn, từng bước; không đổi/gõ mật khẩu; không bảo người dùng gửi khoá/token; không mua gì khi chưa hỏi; việc thương mại Limix Agent giữ ở repo private.

## Cập nhật 15/11 (tối): đã làm xong cách A
Đã sửa 10 test theo thẻ chờ duyệt: create-bot-model, no-omb-cards (team fact thực ra pass, chỉ lỗi dây chuyền), starter-bots, index.test.ts (4 test + 1 viết lại, undo sau duyệt không còn). Trả `warning` trùng tên người ngay trên phản hồi pending của `/api/internal/create-bot`. Hạn chế đã biết: gợi ý "bot mới bị tạm dừng (gói Starter)" chỉ trả khi tạo ngay, nay không còn đến tay trợ lý sau khi duyệt. tsc 4 cấu hình sạch. Patch `assistant-proposals.json` + overlay đã tái tạo. Test `lets a Chief create operators...` lỗi từ trước (fake-claude dump), không do thay đổi này.

## Cập nhật 15/11 (tối, 2): Trợ Lý chẩn đoán lỗi Limix Bot
Người dùng muốn Trợ Lý toàn quyền kiểm tra/sửa lỗi Limix Bot (bot lỗi, Zalo/Telegram mất kết nối); đã chọn mức **"tự kiểm tra, sửa cần duyệt"**.
Đã làm (chỉ đọc): công cụ `diagnose_limix` (Chief-only) -> `GET /api/internal/limix-diagnosis` -> `server/limix-diagnose.ts` (+test) đọc trạng thái kết nối Telegram/Zalo/Discord/Facebook từ cổng (`limixGatewayConnections()` trong `server/limix-gateway-sidecar.ts`, chỉ có khi chạy bản server có sidecar), engine AI đăng xuất/thiếu, workspace không có bot; mỗi lỗi kèm cách sửa; không lộ khoá. Prompt trợ lý dặn gọi công cụ này trước khi đoán. Lỗi chạy của bot đã tự báo về luồng "Problems to look at" của Chief (có sẵn từ gốc).
Chưa làm: (1) bản **desktop** chạy cổng trong Electron (`electron/limix-gateway.mjs`), server không đọc được -> công cụ chỉ báo "không đọc được từ đây"; cần cầu nối Electron->server hoặc cho trợ lý hỏi qua UI. (2) Hành động sửa có duyệt: bấm Run/chạy lại kết nối, khởi động lại bot, đổi cài đặt kênh (policy/group/engine) qua thẻ duyệt: thêm công cụ `propose_channel_fix` + thẻ + gọi API gateway `POST /api/connections/:id/start|stop|policy|group|engine`. (3) Đọc log máy chủ đã che bí mật. (4) Test e2e thật với gateway giả.

## Cập nhật 15/11 (tối, 3): CPU/RAM Desktop riêng cho từng bot
Cài đặt bot > mục "Nơi … làm việc" có ô "Cấu hình Desktop riêng" (RAM GB, CPU; trống = theo cài đặt chung). Lưu `bot.desktopResources` qua PATCH `/api/bots/:id` (`server/limix-desktop-resources.ts` kiểm tra 2–128 GB, 1–64 CPU; null xoá). Khi tạo/khởi động desktop riêng của bot (chế độ per-bot), `localVmResourcesFor(target)` trong index.ts dùng giá trị của bot. Config trả thêm `localVm.resources`. Test: `server/limix-desktop-resources.test.ts` (đơn vị + fixture PATCH). Chưa kiểm chứng tạo container thật (sandbox không có Docker); chưa có tuỳ chỉnh "tự tắt sau" theo bot. Test `AccessSection.test.ts > Research (treg)` lỗi sẵn từ trước.

## Cập nhật 15/11 (tối, 4): nhóm bot dùng chung 1 Desktop
Trong chế độ mỗi bot một desktop (per-bot), bot bật `desktopTeam` dùng chung desktop của phòng ban (section) với các bot cùng bật (`teamLocalVmTarget`, key `team:<digest>`, container `limixbot-computer-t<16hex>`). Tắt = desktop riêng của bot như cũ. Một màn hình nên các bot xếp lượt (lease có sẵn). Cỡ: lớn nhất trong các bot đã đặt `desktopResources`, nếu không thì đề xuất = cỡ chung + 2 GB & 1 CPU mỗi bot thêm, không vượt sức máy (`server/limix-team-desktop.ts` + test). UI: công tắc trong ô Desktop ở Cài đặt bot. Chưa làm: kho máy ảo (inventory), khôi phục hẹn giờ tự tắt sau khi khởi động lại, dọn container nhóm khi đổi chế độ chưa tính desktop nhóm. 8 test Local VM trong index.test.ts lỗi sẵn từ trước (đã đối chiếu bằng git stash).

## Cập nhật 15/11 (tối, 5): chat khách Telegram/Zalo nằm ở đâu + ẩn/hiện
Mỗi người nhắn bot qua Telegram/Zalo/Discord/Facebook được lưu thành 1 "cuộc trò chuyện" (task, `botApi: true`) của bot đã liên kết, tên "Telegram · <senderId> · <tin đầu>" (`server/bot-api-host.ts` runCall), hiện trong danh sách Cuộc trò chuyện ở panel phải và ở sidebar. Chat của chủ bot (đã /link) được đánh dấu riêng (`limix-owner-threads.json`), nay gửi xuống app là `channelOwner: true`.
Mới: cài đặt bot `hideChannelGuests`; nút "Ẩn/Hiện chat khách Telegram/Zalo (N)" trong panel Cuộc trò chuyện; khi ẩn, chat khách không hiện ở panel và sidebar, chat chủ bot và chat đang mở luôn hiện. Test fixture PATCH trong `server/limix-desktop-resources.test.ts`. Các test Sidebar lỗi node:sqlite là lỗi sẵn có.
