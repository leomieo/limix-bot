# PROJECT_MEMORY.md — Bộ nhớ dự án Limix Bot

> Mục đích: AI và chủ dự án không bị quên, không đi lệch giữa các phiên.
> **Luật:** đọc file này đầu mỗi phiên (sau `CLAUDE.md`). Sau MỖI lần thêm/sửa/xóa file, đổi quyết định
> hoặc phát hiện điều mới → cập nhật mục 1, 4 và ghi một dòng vào mục 5 TRƯỚC khi báo "xong".
> Chỉ ghi sự thật đã xảy ra. Không ghi kế hoạch vào nhật ký.

## 1. Trạng thái hiện tại (luôn ghi đè cho đúng)

- **Hướng chính (đổi 2026-11-11 18:41):** Limix Bot = **bản fork đổi thương hiệu của OpenMausBot** (giao diện như mausbot.com), phát hành file cài Windows `.exe` qua GitHub Actions của repo `leomieo/limix-bot`. `limix-gateway` (cổng Telegram/Zalo) là module sẽ gộp vào app ở mốc sau.
- **Mốc đang làm:** F1 — đẩy mã fork lên GitHub và build bản Windows đầu tiên
- **Việc dở dang:** commit `a40e26cf` (đổi thương hiệu) nằm trong máy chủ Claude, CHƯA đẩy lên GitHub vì repo `leomieo/limix-bot` chưa được tạo
- **Đã làm được:** script `limix/rebrand.py` (chạy lại được, ổn định); logo + linh vật "Limi" (bong bóng chat tím); kiểm tra: 0 lỗi cú pháp, so token trước/sau chỉ chuỗi chữ thay đổi (trừ 2 chỗ chủ ý)
- **CHƯA kiểm:** typecheck/build thật (cần `pnpm install`, bị chặn mạng ở máy chủ Claude → sẽ chạy trên GitHub Actions); app chạy thật trên Windows
- **Đang bị chặn:** chờ chủ dự án tạo repo `limix-bot` (Public, trống) trên tài khoản GitHub `leomieo`
- **Bước tiếp theo:** đẩy commit → chạy workflow "Limix Bot Windows" → sửa lỗi build nếu có → tải `LimixBot-setup.exe` từ Releases

## 2. Bản đồ thư mục dự án

| Đường dẫn | Là gì |
|---|---|
| `CLAUDE.md` | Luật làm việc, quyết định đã chốt, lộ trình |
| `PROJECT_MEMORY.md` | File này: trạng thái + nhật ký thay đổi |
| `CLAUDE_BOT_PLATFORM_CONTEXT.md` | Hồ sơ thiết kế chi tiết (tham khảo, không sửa tùy tiện) |
| `docs/KHAO_SAT_P0.md` | Báo cáo khảo sát, ADR-1..6, lộ trình |
| `docs/HERMES_EXTRACTION.md` | Lấy gì từ Hermes, file nguồn, giấy phép, test |
| `limix-gateway/` | Cổng kết nối Telegram/Zalo → OpenMausBot (Node 22, không thư viện ngoài), bản 0.2 giao diện desktop mới (chưa chép về máy) |
| repo `leomieo/limix-bot` (GitHub) | Mã fork Limix Bot = OpenMausBot @6f226f15 + commit đổi thương hiệu |
| `limix/rebrand.py` (trong repo) | Script đổi OpenMausBot → Limix Bot; chạy: `python3 limix/rebrand.py . limix/brand-assets` |
| `limix/brand-assets/` (trong repo) | Biểu tượng (.ico/.icns/.png/.svg), workflow `limix-windows.yml`, README Limix |
| `.github/workflows/limix-windows.yml` (trong repo) | Build Windows + kiểm tra server khởi động + đăng Release |

## 3. Sự thật đã xác minh (kèm nguồn)

| # | Sự thật | Nguồn | Ngày |
|---|---|---|---|
| F1 | Không tồn tại repo tên "OpenManusBot"; chủ dự án chọn OpenMausBot | tìm kiếm web + xác nhận của chủ | 2026-11-11 |
| F2 | OpenMausBot (Apache-2.0, thư mục `enterprise/` giấy phép riêng) là app Electron + React + server Node/TS, ~7.660 file, yêu cầu Node ≥ 24, pnpm | `package.json`, `LICENSING.md` @6f226f1 | 2026-11-11 |
| F3 | OpenMausBot CHƯA có kết nối Telegram/Zalo/WhatsApp/Discord | tìm trong `server/`, `src/`, `shared/` @6f226f1 | 2026-11-11 |
| F4 | OpenMausBot có **Bot API** (giới hạn: Ask, không tool, 10 tin/phút/khóa) | `docs/bot-api.md`, `server/bot-api*.ts` @6f226f1 | 2026-11-11 |
| F5 | OpenMausBot có sẵn `skill-learn.ts`, `skill-review.ts` (port từ Hermes); `skillReview` mặc định TẮT | `server/config.ts` @6f226f1 | 2026-11-11 |
| F6 | Hermes Agent: MIT, adapter 25+ nền tảng; KHÔNG có Zalo | `plugins/platforms/` @b50d007 | 2026-11-11 |
| F7 | cockpit-tools: quản lý tài khoản AI IDE, giấy phép CC-BY-NC-SA-4.0 | `src-tauri/Cargo.toml` @7ca7f0d | 2026-11-11 |
| F9 | Zalo Bot API: getUpdates trả 1 sự kiện, sendMessage ≤ 2000 ký tự | https://docs.zaloplatforms.com/zalo-bot | 2026-11-11 |
| F10 | Tên OpenMausBot/MausBot và linh vật là **thương hiệu** của Supamaus; Apache không cấp quyền thương hiệu → fork phải có tên + linh vật riêng | `LICENSING.md` @6f226f1 | 2026-11-11 |
| F11 | Tên sản phẩm lấy từ `DEFAULT_BRAND` (`server/brand.ts`) và `PRODUCT_NAME` (`src/lib/brand.ts`); repo/links ở `src/lib/app-links.ts`; thư mục dữ liệu `~/.openmausbot` ở `server/config.ts` + `electron/main.mjs` | đọc mã @6f226f1 | 2026-11-11 |
| F12 | Linh vật = thân (bộ sinh `scripts/gen-mascot-bodies.ts` → `shared/mascot-bodies.ts`) + khuôn mặt chung (`src/components/cursor-face-data.ts`); thân mặc định id "cursor" | đọc mã @6f226f1 | 2026-11-11 |
| F13 | Windows build chính thức chạy trên GitHub `windows-latest`: `pnpm install --frozen-lockfile` → `pnpm package:win` | `.github/workflows/package-win.yml` @6f226f1 | 2026-11-11 |

## 4. Vấn đề mở / rủi ro

| # | Vấn đề | Ảnh hưởng | Trạng thái |
|---|---|---|---|
| R1 | Bot API chạy giới hạn → bot qua Telegram chỉ trò chuyện | Tính năng từ xa hạn chế | Mở |
| R2 | cockpit-tools phi thương mại; xoay tài khoản có thể vi phạm điều khoản | Pháp lý | Mở |
| R5 | Các trường Zalo chưa thử với bot thật | | Mở |
| R6 | Khuôn mặt linh vật (mắt hình viên thuốc) vẫn dùng bộ biểu cảm của OpenMausBot; chỉ thân đã thay | Có thể bị coi là giống linh vật MausBot | Mở — cân nhắc vẽ bộ mặt riêng |
| R7 | Giao thức liên kết `openmausbot://` giữ nguyên (mã chạy dùng đúng tên này) | Cài cả OpenMausBot gốc thì link cài gói có thể mở nhầm app | Mở, nhỏ |
| R8 | Bản cài chưa ký số | SmartScreen báo "Unknown publisher" | Mở |
| R9 | Không chạy được typecheck ở máy chủ Claude | Lỗi build chỉ lộ ra trên GitHub Actions | Mở |

## 5. Nhật ký thay đổi (mới nhất ở trên, mỗi lần sửa một dòng)

Định dạng: `- YYYY-MM-DD HH:MM | Ai | Làm gì | File | Kiểm chứng`

- 2026-11-11 19:20 | Claude | Commit đổi thương hiệu OpenMausBot → Limix Bot (381 file): tên, tác giả Leox ৹ Limix AI, biểu tượng, linh vật Limi, thư mục `~/.limixbot`, kênh cập nhật `leomieo/limix-bot`, bỏ `enterprise/` + MausBot Cloud, workflow build Windows | commit `a40e26cf` (chưa đẩy) | 0 lỗi cú pháp; so token; script chạy 2 lần → 0 thay đổi; chạy từ bản sạch → trùng khớp
- 2026-11-11 19:00 | Claude | Thiết kế logo + linh vật "Limi" (bong bóng chat, tím #A78BFA→#6D28D9) | `limix/brand-assets/`, `limix-brand-sheet.png` | bộ sinh linh vật kiểm tra mặt vừa thân ở mọi biểu cảm
- 2026-11-11 18:51 | Chủ dự án | GitHub: `leomieo`; yêu cầu logo/linh vật tối giản hiện đại | — | tin nhắn
- 2026-11-11 18:45 | Chủ dự án | Làm rõ: Limix Bot = app dựa trên OpenMausBot, giao diện như mausbot.com (không phải trang cổng kết nối); chọn build có Claude hỗ trợ + có GitHub | — | trả lời câu hỏi
- 2026-11-11 18:40 | Claude | Giao diện desktop mới cho limix-gateway 0.2 + lệnh thoát + favicon (20/20 test) | `limix-gateway/src/web/*` (chưa chép về máy, máy bị ngắt liên kết) | test cloud
- 2026-11-11 18:40 | Claude | Cập nhật lộ trình + quyết định D8 | `CLAUDE.md` | đã ghi
- 2026-11-11 18:38 | Claude | Tạo Limix Gateway 0.1 | `limix-gateway/**` | 19/19 test
- 2026-11-11 18:36 | Claude | Báo cáo khảo sát + ADR; tài liệu trích Hermes | `docs/*` | dẫn nguồn
- 2026-11-11 18:08 | Claude | Tạo bộ nhớ dự án | `PROJECT_MEMORY.md` | đã ghi file
- 2026-11-11 18:06 | Claude | Tạo luật dự án | `CLAUDE.md` | đã ghi file
- 2026-11-11 18:02 | Chủ dự án | Chốt: OpenMausBot, Windows, Telegram+Zalo+WhatsApp+Discord, cockpit-tools | — | trả lời câu hỏi
