# CLAUDE.md — Quy tắc dự án Limix Bot

> File này là luật làm việc cho mọi AI (Claude, Codex, Antigravity...) trong dự án.
> Đọc file này TRƯỚC mỗi phiên. Tài liệu thiết kế chi tiết: `CLAUDE_BOT_PLATFORM_CONTEXT.md`.
> Nếu file này mâu thuẫn với tài liệu khác, file này thắng. Chỉ chủ dự án được sửa các quyết định ở mục 2.

## 1. Dự án là gì (một câu)

Limix Bot = ứng dụng tạo và quản lý Bot AI — **bản fork đổi thương hiệu của OpenMausBot** (giao diện như mausbot.com), tác giả **Leox ৹ Limix AI**, thêm **tự học skill** và **kết nối native** tới Telegram, Zalo, WhatsApp, Discord, lấy có chọn lọc từ **Hermes Agent**.

## 2. Quyết định đã chốt (không tự đổi)

| # | Quyết định | Ngày |
|---|---|---|
| D1 | Nền tảng = `milind-soni/OpenMausBot` (KHÔNG phải OpenManus, KHÔNG phải OpenClaw) | 2026-11-11 |
| D2 | Chạy trước trên máy Windows của chủ dự án; VPS 24/7 là bước sau | 2026-11-11 |
| D3 | Nền tảng chat đợt đầu: Telegram (trước) → Zalo, WhatsApp, Discord | 2026-11-11 |
| D4 | Quản lý tài khoản OAuth AI: dùng `jlcodes99/cockpit-tools` như **công cụ chạy riêng**, không chép mã (giấy phép CC-BY-NC-SA-4.0) | 2026-11-11 |
| D5 | Hermes chỉ là nguồn tham khảo/trích chọn (giấy phép MIT). Không nhập nguyên Hermes | 2026-11-11 |
| D6 | "Tự học" = tạo/cải thiện skill có bằng chứng, có duyệt và hoàn tác. KHÔNG phải huấn luyện lại mô hình | 2026-11-11 |
| D7 | Chủ dự án không biết code: giải thích bằng tiếng Việt dễ hiểu, giao sản phẩm chạy được, không giao bài tập code | 2026-11-11 |
| D8 | ~~Không sửa lõi OpenMausBot~~ → thay bằng D9 (chủ dự án muốn chính app OpenMausBot mang tên Limix Bot). `limix-gateway/` giữ làm module Telegram/Zalo, sẽ gộp vào app | 2026-11-11 |
| D9 | Limix Bot = fork OpenMausBot @6f226f15. Mọi thay đổi thương hiệu đi qua `limix/rebrand.py` (chạy lại được khi cập nhật upstream). Sửa lõi tối thiểu: chuỗi hiển thị, tên, biểu tượng, thư mục dữ liệu `~/.limixbot`, kênh cập nhật. Bỏ `enterprise/` và MausBot Cloud | 2026-11-11 |
| D10 | Mã nguồn ở GitHub `leomieo/limix-bot` (Public). Build Windows bằng GitHub Actions (`.github/workflows/limix-windows.yml`), phát hành qua Releases (app tự cập nhật từ đó) | 2026-11-11 |
| D11 | Thương hiệu: tên "Limix Bot", tác giả "Leox ৹ Limix AI", linh vật "Limi" = bong bóng chat bo tròn, màu tím #A78BFA→#6D28D9. Không dùng tên/linh vật MausBot (thương hiệu đã đăng ký của Supamaus) | 2026-11-11 |

Mốc mã nguồn đã khảo sát (pin, không dùng "latest"):
- OpenMausBot `6f226f15def56c697626f2ed6dffac416510c79a`
- hermes-agent `b50d007e26006da6bc6ac60cac8da9fe99326362`
- cockpit-tools `7ca7f0db1f915452681c9bbc366f199e2310761f`

## 3. Chống ảo giác — luật bắt buộc

1. **Không bịa.** Không nêu tên file, hàm, API, route, cấu hình, phiên bản, giá, giới hạn nếu chưa đọc tận mắt trong mã hoặc tài liệu chính thức ở phiên này. Không chắc → nói "chưa kiểm tra" và đi kiểm tra.
2. **Gắn nhãn mọi khẳng định kỹ thuật:**
   - `ĐÃ XÁC MINH` — đã đọc mã/tài liệu, ghi kèm đường dẫn file hoặc URL.
   - `ĐỀ XUẤT` — thiết kế của dự án, chưa tồn tại trong mã.
   - `CHƯA XÁC MINH` — giả định, cần kiểm tra.
3. **Dẫn nguồn cụ thể:** `đường/dẫn/file.ts` (+ commit) hoặc URL tài liệu chính thức. Không dẫn blog/tin tức làm bằng chứng tính năng.
4. **"Chạy được" phải có bằng chứng:** chỉ nói "đã chạy/đã qua test" khi có lệnh đã chạy và kết quả thật. Build qua ≠ hoạt động. Test với mock ≠ test thật. Báo rõ đã kiểm cái gì và CHƯA kiểm cái gì.
5. **API nền tảng bên ngoài** (Telegram, Zalo, WhatsApp, Discord, nhà cung cấp AI): tra tài liệu chính thức hiện hành trước khi viết code. Không viết từ trí nhớ.
6. **Không suy diễn tên giống nhau là cùng một thứ** (OpenMausBot ≠ OpenManus ≠ OpenClaw; Bot API của OpenMausBot ≠ Telegram Bot API).
7. **Gặp mâu thuẫn** giữa tài liệu và mã thực tế → tin mã thực tế, ghi lại chênh lệch, báo chủ dự án.
8. **Không đoán ý chủ dự án** ở các quyết định đổi nền tảng, quyền, chi phí hoặc phạm vi → hỏi một câu ngắn.

## 4. Chống lan man — giữ đúng phạm vi

1. Mỗi phiên chỉ làm **một mốc** (milestone) đang mở ở mục 6. Không tự mở việc mới.
2. **Tái dùng trước khi xây:** OpenMausBot đã có Bot API, skill-learn, skill-review, staging/Undo. Không viết lại.
3. **Sửa lõi tối thiểu.** Đổi thương hiệu chỉ qua `limix/rebrand.py`; tính năng mới của Limix nằm trong module/thư mục riêng; mỗi thay đổi lõi phải có lý do ghi trong commit. Không bỏ check quyền/đăng nhập/entitlement.
4. **Không thêm** khi chưa được yêu cầu: SaaS nhiều khách hàng, thanh toán, Kubernetes, marketplace, app mobile mới, fine-tuning, tự cài skill từ Internet, gửi tin hàng loạt.
5. Không thêm thư viện mới nếu thư viện có sẵn hoặc API chính thức đã đủ. Thêm thì nêu lý do một dòng.
6. Báo cáo ngắn: làm được gì → bằng chứng → chưa làm/chưa kiểm → bước tiếp. Không kể lể từng bước.
7. Một tính năng chưa xong thì hiện "Chưa hỗ trợ" trên giao diện, không làm nút giả.

## 5. Luật an toàn (thực thi bằng code, không chỉ bằng prompt)

- Token/bí mật: chỉ lưu ở backend (secret store), không đưa vào log, prompt, skill, URL, giao diện.
- Người nhắn từ Telegram/Zalo/... mặc định là **người ngoài**: không có quyền chủ, không tự duyệt tác vụ, không ghi skill dùng chung.
- Mỗi lượt chạy chỉ có **một engine** xử lý. Không chạy song song gateway Hermes trên cùng bot.
- Một bot Telegram chỉ một bên nhận tin (polling HOẶC webhook). Gặp xung đột → báo, không tự chiếm quyền.
- Skill do bot tự học: phải qua kiểm tra + chủ duyệt (chế độ `propose`) trước khi dùng; luôn có hoàn tác.
- Không tự động hóa giao diện tài khoản cá nhân để tạo bot; chỉ dùng API chính thức của nền tảng.

## 6. Lộ trình (cập nhật trạng thái tại đây)

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| P0 | Chốt nền tảng, pin mã, khảo sát, gap analysis | Xong (`docs/KHAO_SAT_P0.md`) |
| F1 | Fork + đổi thương hiệu + build `LimixBot-setup.exe` qua GitHub Actions | Đang làm: commit xong, chờ repo `leomieo/limix-bot` |
| P1 | Telegram + Zalo nhắn tin chữ (limix-gateway, nhập token có sẵn) | Xong mã, test giả lập; CHỜ thử bot thật |
| F2 | Gộp kết nối Telegram/Zalo vào trong app Limix Bot | Chưa bắt đầu |
| P2 | Tự học skill có kiểm duyệt | Chưa bắt đầu |
| P3 | Tạo bot Telegram bằng QR (Managed Bots) | Chưa bắt đầu |
| P4 | Quyền cao hơn cho chủ bot qua chat (cần ADR mới) | Chưa bắt đầu |
| P5 | WhatsApp Business Cloud API, Discord | Chưa bắt đầu |
| P6 | Ảnh/tệp/giọng nói, nhóm, nâng cao | Chưa bắt đầu |

## 7. Cách trả lời chủ dự án

- Tiếng Việt, câu ngắn, ít thuật ngữ; thuật ngữ bắt buộc thì giải thích trong ngoặc.
- Khi cần chủ dự án làm gì (tạo bot, dán token, bấm nút), đưa từng bước đánh số, rõ ràng.
- Code, tên biến, tên file: tiếng Anh.
- Ghi quyết định mới vào mục 2 (khi chủ dự án đồng ý) và cập nhật mục 6 sau mỗi mốc.

## 8. Bộ nhớ dự án — bắt buộc

- Đầu phiên: đọc `CLAUDE.md` → `PROJECT_MEMORY.md` → chỉ mở tài liệu khác khi cần.
- Sau MỖI thay đổi (file, quyết định, phát hiện mới): cập nhật `PROJECT_MEMORY.md` mục 1 (trạng thái), mục 2 nếu có file mới, mục 4 nếu có rủi ro, và thêm một dòng nhật ký ở mục 5.
- Chưa cập nhật bộ nhớ = chưa được báo "xong".
- Sự thật mới chỉ vào mục 3 khi đã xác minh và có nguồn.
