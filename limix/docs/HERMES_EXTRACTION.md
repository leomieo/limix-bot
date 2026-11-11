# HERMES_EXTRACTION.md — Lấy gì từ Hermes Agent, lấy thế nào

Nguồn: `NousResearch/hermes-agent` commit `b50d007e26006da6bc6ac60cac8da9fe99326362` (11/11/2026). Giấy phép **MIT**:
được dùng lại, phải giữ dòng bản quyền "Copyright (c) 2025 Nous Research" ở chỗ dùng.

Hermes rất lớn (≈24.300 file). Riêng adapter Telegram ≈12.350 dòng Python, Discord ≈9.270 dòng, gắn chặt vào
`gateway/`, `hermes_state_*`, profile, scheduler và `AIAgent`. **Không nhập nguyên khối.** Limix chép *hành vi* đã được
Hermes kiểm nghiệm, viết lại gọn bằng JavaScript (Node 22, không thư viện ngoài) để chạy cạnh OpenMausBot.

## 1. Đã lấy (bản 0.1)

| Tính năng | File Hermes | Cách lấy | File Limix | Test |
|---|---|---|---|---|
| Chia tin dài, giữ khối code ``` , đánh số (1/n) | `gateway/platforms/base.py` `truncate_message` | Chuyển thể (port) | `limix-gateway/src/chunk.mjs` | `units.test.mjs` (3 test) |
| Mã ghép cặp người lạ: 8 ký tự bảng chữ không nhầm, hết hạn 1 giờ, tối đa 3 chờ, 1 yêu cầu/10 phút/người, khóa sau 5 lần sai, lưu dạng băm | `gateway/pairing.py` | Chuyển thể chính sách | `limix-gateway/src/pairing.mjs` | `units.test.mjs`, `gateway.test.mjs` |
| Chỉ một bên nhận tin cho mỗi bot; 409 = xung đột, không tranh | `plugins/platforms/telegram/update_admission.py` (hành vi) | Viết lại theo nguyên tắc | `src/gateway.mjs`, `src/channels/telegram.mjs` | 2 test xung đột |
| Từ chối người lạ tối đa 1 lần/24 giờ (chống spam trả lời) | `gateway/pairing.py` `DECLINE_DEDUPE_SECONDS` | Viết lại | `src/router.mjs` | — |
| Lệnh `/new`, `/status`, duyệt bằng chat | `gateway/slash_commands*.py` (ý tưởng) | Viết lại tối giản | `src/router.mjs` | `gateway.test.mjs` |
| Hiển thị "đang gõ…" khi AI xử lý | `plugins/platforms/telegram/telegram_typing_gate.py` (ý tưởng) | Viết lại | `src/router.mjs` | test chờ lâu |

## 2. Không lấy vì OpenMausBot đã có

| Tính năng Hermes | Đã có ở OpenMausBot (`6f226f15`) |
|---|---|
| Tự review sau hội thoại để tạo/sửa skill (`agent/background_review.py`) | `server/skill-review.ts` (ghi rõ port từ Hermes), bật bằng `features.skillReview: true` trong `~/.openmausbot/config.json` |
| Tạo/sửa skill theo yêu cầu (`tools/skill_manager_tool.py`) | `server/skill-learn.ts`, `features.skillAuthoring` (mặc định bật) |
| Staging, hoàn tác skill (`tools/skill_ledger.py`) | `server/skills.ts`, `server/skill-storage.ts` |
| Engine Hermes | `server/drivers/acp/hermes.ts` (tùy chọn) |
| Giao diện, quản lý nhiều bot | Toàn bộ app OpenMausBot |

## 3. Lấy ở mốc sau

| Tính năng | File Hermes | Mốc | Ghi chú |
|---|---|---|---|
| Tạo bot Telegram bằng QR (Managed Bots) | `hermes_cli/telegram_managed_bot.py` | P3 | Client của Hermes gọi dịch vụ Nous (`setup.hermes-agent.nousresearch.com`). Limix phải tự làm "manager bot" riêng theo Telegram Bot API, chỉ tham khảo luồng. |
| WhatsApp Business Cloud API | `plugins/platforms/whatsapp_cloud/adapter.py` (≈1.565 dòng) | P5 | Cần webhook HTTPS công khai + kiểm chữ ký `X-Hub-Signature-256` (HMAC app secret), API `graph.facebook.com`. Trên PC cần đường hầm (OpenMausBot có kèm cloudflared). |
| Discord | `plugins/platforms/discord/adapter.py` | P5 | Dùng Gateway WebSocket, chạy được trên PC không cần tên miền. Node 22 có sẵn WebSocket. |
| Lọc nội dung trước khi gửi, ẩn khối "suy nghĩ" | `gateway/response_filters.py`, `stream_consumer_think.py` | P4 | Nếu câu trả lời Bot API có lẫn phần nội bộ. |
| Ảnh/tệp/giọng nói | `gateway/media_*`, `run_inbound_media.py` | P6 | Bot API OpenMausBot hiện chỉ nhận chữ; cần kiểm tra lại. |
| Curator, pin/lock skill | `tools/skill_lock.py`, docs Curator | P2+ | Đối chiếu với OpenMausBot trước. |

## 4. Bỏ hẳn

Hosted Team Gateway / Nous Cloud, TUI và desktop của Hermes, toàn bộ `hermes_state_*`, hosted rooms, kanban, cron,
RL/fine-tuning, skills hub tự cài từ Internet, các adapter không cần (WeCom, Feishu, QQ, Signal, Matrix…).

## 5. Zalo

Hermes **không có** adapter Zalo (đã kiểm `plugins/platforms/` @b50d007). Limix tự viết theo tài liệu chính thức
Zalo Bot Platform: https://docs.zaloplatforms.com/zalo-bot → `limix-gateway/src/channels/zalo.mjs`.

Đã xác minh từ tài liệu (11/11/2026): base `https://bot-api.zaloplatforms.com/bot<TOKEN>/<method>`, POST JSON;
`getUpdates` long-poll trả **một** sự kiện trong `result`; `sendMessage` 1–2000 ký tự; webhook có header
`X-Bot-Api-Secret-Token`; có webhook thì `getUpdates` ngừng âm thầm. Nhóm (Zalo Bot) chỉ trả lời khi được @nhắc
(theo tài liệu OpenClaw, **chưa xác minh** từ Zalo).

**CHƯA XÁC MINH** (cần thử với bot Zalo thật): tên trường của `getMe`, giá trị `chat_type` của nhóm, mã lỗi khi
`getUpdates` hết thời gian chờ (mã đang giả định 408 = không có tin), `sendChatAction`.
