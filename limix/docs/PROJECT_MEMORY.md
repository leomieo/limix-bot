# PROJECT_MEMORY.md — Bộ nhớ dự án Limix Bot

> Mục đích: AI và chủ dự án không bị quên, không đi lệch giữa các phiên.
> **Luật:** đọc file này đầu mỗi phiên (sau `CLAUDE.md`). Sau MỖI lần thêm/sửa/xóa file, đổi quyết định
> hoặc phát hiện điều mới → cập nhật mục 1, 4 và ghi một dòng vào mục 5 TRƯỚC khi báo "xong".
> Chỉ ghi sự thật đã xảy ra. Không ghi kế hoạch vào nhật ký.

## 1. Trạng thái hiện tại (luôn ghi đè cho đúng)

- **Hướng chính (đổi 2026-11-11 18:41):** Limix Bot = **bản fork đổi thương hiệu của OpenMausBot** (giao diện như mausbot.com), phát hành file cài Windows `.exe` qua GitHub Actions của repo `leomieo/limix-bot`. `limix-gateway` (cổng Telegram/Zalo) là module sẽ gộp vào app ở mốc sau.
- **Mốc đang làm:** F1 — đẩy mã fork lên GitHub và build bản Windows đầu tiên
- **Việc dở dang:** 0.2.6 chặn hết lối vào Cloud còn sót (bước 8d). 0.2.5 đổi bộ nhận diện sang đen trắng (phương án F "Giao thoa ánh sáng", Codex thiết kế, chủ dự án chọn): biểu tượng app mọi cỡ, linh vật Limi thân mới, bỏ ảnh chrome con trỏ MausBot. Bản đã phát hành trước đó: v0.2.4 (ẩn Limix Cloud, run 43033302953 thành công)
- **Đã làm được:** script `limix/rebrand.py` (chạy lại được, ổn định); logo đen trắng + linh vật "Limi" (hai khối bo tròn chồng nhau); báo lỗi về hộp thư chủ dự án; Cloud là mô-đun ẩn; kiểm tra: 0 lỗi cú pháp, chạy từ bản sạch 6f226f15 → trùng khớp (trừ số phiên bản)
- **Đã kiểm trên GitHub Actions (run 43018860396, thành công):** cài thư viện, typecheck + build, cấu trúc gói, `Limix Bot.exe`, kênh cập nhật leomieo/limix-bot, máy chủ đóng gói trả lời /api/health
- **CHƯA kiểm:** cài và mở app thật 0.2.4+/0.2.5 trên máy Windows; linh vật chrome vẽ (không còn ảnh) trông thế nào trong app; thử gửi báo lỗi @devs thật
- **Đang bị chặn:** không
- **Bước tiếp theo:** chủ dự án cài thử → báo lỗi/ảnh chụp → F2 gộp Telegram/Zalo vào app. (Cũ:) chờ workflow "Limix Bot Windows" → sửa lỗi build nếu có → tải `LimixBot-setup.exe` từ Releases

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
| R11 | Gói `limixbot` đã công khai trên npm (0.2.0, 0.2.1; latest 0.2.1) — `npx limixbot pair` dùng được. Còn: bật Trusted Publishing rồi xóa token (token bypass-2FA bị ngừng từ 01/2027) | | Gần xong |
| R12 | Lần đổi tên 1 sót chữ "OpenMaus Bot" (có dấu cách), "OpenMaus", "Maus" và câu có dấu "/" | Màn hình khởi động/khay còn tên cũ ở v0.1.153 | Đã sửa ở 0.2.0 |
| R13 | Báo cáo lỗi (@devs) trước gửi về đội OpenMausBot. Chủ dự án chọn: gửi về email riêng, KHÔNG hiển thị email → dùng FormSubmit qua mã ẩn danh trong secret `LIMIX_REPORT_ALIAS`; tắt hỏi trạng thái tới cloud.openmausbot.com | Chờ chủ dự án bấm Activate trong email FormSubmit + lưu secret | Đang làm (commit 698e46d chưa đẩy) |
| R14 | Bài học: đổi tên bằng regex có thể dán tên sản phẩm vào tên kỹ thuật (header `X-Limix Bot-Desktop-Owner` làm app hiện trang ghép cặp ở 0.1.153–0.2.0). Script nay có bảng TECH + kiểm tra LEFTOVER, và phải so khớp chạy-từ-bản-sạch trước khi đẩy | | Đã sửa ở 0.2.1 |
| R10 | Máy chủ Claude không đẩy được tag git (chỉ đẩy nhánh) | Build kích hoạt bằng push lên `main`; tag phát hành do workflow tự tạo | Đã xử lý |

## 5. Nhật ký thay đổi (mới nhất ở trên, mỗi lần sửa một dòng)

Định dạng: `- YYYY-MM-DD HH:MM | Ai | Làm gì | File | Kiểm chứng`

- 2026-11-11 21:35 | Chủ dự án + Claude | Mốc mới L1 "Tài khoản Limix": khách tự đăng ký, app bắt buộc đăng nhập, 1 tài khoản tối đa 10 máy cùng lúc (máy thứ 11 bị từ chối), chưa giới hạn thời gian; DÙNG CHUNG tài khoản với Limix Studio (máy chủ hiện có https://tiktok.limixmedia.com, `gui_server.py` + `users.db`, VPS Ubuntu 24.04, theo `F:\Tool tu build\Bo Nho Du An\DU_AN_LIMIX.md`). Bản nháp máy chủ riêng `limix/account-server/` (Node, chưa dùng) — chờ đọc mã máy chủ hiện có để gắn vào | — | cần chủ dự án cấp quyền thư mục `tiktok-checker`, `LimixStudio`
- 2026-11-11 21:25 | Claude | 0.2.6: chủ dự án báo Settings → General vẫn có "Limix Bot Cloud / Add a Cloud". Bước 8d mới chặn MỌI lối vào Cloud theo công tắc LIMIX_CLOUD_ENABLED: dòng gói/ưu đãi ở General và Usage & billing (`useCloudPlan`, `buyOfferAllowed`), ghi chú lịch routine, chip Cloud khi mới cài, nút "thêm trang", hộp thoại Add a Cloud (reducer `openCloudAdd` bỏ qua) | `limix/rebrand.py` bước 8d; 6 file `src/` | chạy từ bản sạch → trùng khớp; typecheck chờ CI
- 2026-11-11 21:16 | Chủ dự án | Muốn khách dùng tài khoản qua VPS của chủ dự án (liên quan mô-đun Cloud C1) | — | tin nhắn; chưa chốt phạm vi
- 2026-11-11 21:20 | Claude + Codex + Chủ dự án | 0.2.5: logo đen trắng phương án F (hai khối chồng nhau, chỗ giao đảo màu = Li ánh sáng/vô hạn + Mix pha trộn); D11 cập nhật; icon app 16→1024 + .ico/.icns; thân linh vật Limi mới; xóa 6 ảnh chrome con trỏ MausBot (`src/assets/mausbot-steel/cursor-*.webp`, trước đây sót) | `limix/rebrand.py` bước 6/6b/6c, `limix/make-brand.ts`, `limix/brand-assets/*`, bản thiết kế gốc ở `F:\Tool tu build\Limix Bot\brand-bw\` | bộ sinh linh vật chạy qua (mặt vừa thân); chạy từ bản sạch → trùng khớp
- 2026-11-11 21:00 | Claude | 0.2.4: Limix Cloud thành mô-đun ẩn (công tắc LIMIX_CLOUD_ENABLED=false: nút/menu Add Cloud, mục Settings Cloud); tài liệu MODULE_CLOUD.md | `limix/overlay/*/limix-features.*`, `electron/main.mjs`, `src/components/SettingsModal.tsx`, `limix/docs/MODULE_CLOUD.md` | 0 lỗi cú pháp; script ổn định
- 2026-11-11 20:55 | Chủ dự án | Quyết định D12: bỏ phần Cloud, giữ làm mô-đun ẩn, phát triển khi có dàn VPS | — | tin nhắn
- 2026-11-11 20:50 | Claude | 0.2.3: Limix là "branded build" → ẩn bảng giá MausBot Cloud, popup What's new, thẻ tài trợ/thông báo upstream | `server/brand.ts` (rebrand bước 8b) | commit c62deac

- 2026-11-11 20:41 | GitHub Actions | Phát hành Windows v0.2.1; npm `limixbot` qua rà soát, công khai 0.2.0 + 0.2.1 | Releases, npmjs.com/package/limixbot | run 43029716881 success; trang npm hiện 0.2.1

- 2026-11-11 20:50 | Claude | Báo cáo lỗi gửi về hộp thư chủ dự án qua FormSubmit (mã ẩn danh), bỏ tên Milind/Omkar khỏi 15 ngôn ngữ, workflow đọc secret LIMIX_REPORT_ALIAS; đã gửi email kích hoạt FormSubmit | `limix/overlay/server/limix-report-*.ts`, `server/index.ts`, `limix/rebrand.py` bước 8 | tsc 0 lỗi file mới; chạy thử 6 tình huống với máy chủ giả; script ổn định

- 2026-11-11 20:40 | Claude | 0.2.1: sửa lỗi cửa sổ app hiện trang ghép cặp (header chủ nhân bị đổi tên sai), sửa 3 user-agent + tên tệp sao lưu, sửa mẫu "Open MausBot" trong script, thêm kiểm tra chặn tên dính vào tên kỹ thuật | commit 804cc9d, `limix/rebrand.py` | chạy từ bản sạch 6f226f15 → trùng khớp; 0 lỗi cú pháp; build đang chạy
- 2026-11-11 20:27 | Chủ dự án | Báo Limix Bot 0.2.0 mở ra trang "Connect to Leo" đòi mã ghép cặp; ảnh MausBot trước đó là app OpenMausBot gốc cài theo README cũ | — | ảnh chụp

- 2026-11-11 20:20 | Claude + Chủ dự án | Chủ dự án tạo npm token + secret NPM_TOKEN; Claude chạy workflow npm: lần 1 E403 (thiếu bypass 2FA), lần 2 thành công; npm đang rà soát 0.2.0 | GitHub Actions run 43026667384 (fail), 43027575052 (success) | trang npm: 0.2.0 Validating

- 2026-11-11 20:10 | Claude | Gói dòng lệnh đổi thành `limixbot` + workflow đăng npm tự động | `scripts/build-npm-package.mjs`, `.github/workflows/limix-npm.yml`, `limix/rebrand.py` (bước 2c) | commit a699a78; script ổn định; chờ secret NPM_TOKEN

- 2026-11-11 19:45 | Claude | 0.2.0: đổi mọi biến thể OpenMaus/MausBot/Maus hiển thị → Limix; thư mục `.openmausbot*` → `.limixbot*` đồng bộ mọi nơi (sửa lỗi tiềm ẩn ở lưu tệp/xóa môi trường); lệnh hiển thị → `limixbot`; version 0.2.0 | `limix/rebrand.py`, 119 file | 0 lỗi cú pháp, so token: chỉ chuỗi đổi; script chạy lại → 0 thay đổi; build run 43021503580
- 2026-11-11 19:31 | Chủ dự án | Báo màn hình khởi động ghi "OpenMaus Bot" và trang ghép cặp ghi `openmausbot pair`; yêu cầu đổi hết sang Limix | — | ảnh chụp

- 2026-11-11 19:30 | GitHub Actions | Build Windows thành công, phát hành v0.1.153 | Releases | run 43018860396 success, server smoke OK

- 2026-11-11 19:25 | Claude | Workflow build chạy khi push lên `main` (tag bị chặn); kích hoạt build đầu tiên | `.github/workflows/limix-windows.yml` | run 43018860396 đang chạy
- 2026-11-11 19:22 | Claude | Đẩy mã Limix Bot lên `leomieo/limix-bot` nhánh `main` (1 commit gốc, kèm `limix/gateway`, `limix/docs`) | repo GitHub | `git ls-remote` thấy `main`
- 2026-11-11 19:18 | Claude | Kiểm tra cài đặt GitHub App Claude của leomieo: đã có quyền "All repositories" (không đổi gì) | github.com/settings/installations | đọc trang

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
