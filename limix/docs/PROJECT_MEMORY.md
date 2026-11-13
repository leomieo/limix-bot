# PROJECT_MEMORY.md — Bộ nhớ dự án Limix Bot

> Mục đích: AI và chủ dự án không bị quên, không đi lệch giữa các phiên.
> **Luật:** đọc file này đầu mỗi phiên (sau `CLAUDE.md`). Sau MỖI lần thêm/sửa/xóa file, đổi quyết định
> hoặc phát hiện điều mới → cập nhật mục 1, 4 và ghi một dòng vào mục 5 TRƯỚC khi báo "xong".
> Chỉ ghi sự thật đã xảy ra. Không ghi kế hoạch vào nhật ký.

## 1. Trạng thái hiện tại (luôn ghi đè cho đúng)

- **Hướng chính (đổi 2026-11-11 18:41):** Limix Bot = **bản fork đổi thương hiệu của OpenMausBot** (giao diện như mausbot.com), phát hành file cài Windows `.exe` qua GitHub Actions của repo `leomieo/limix-bot`. `limix-gateway` (cổng Telegram/Zalo) là module sẽ gộp vào app ở mốc sau.
- **Mốc đang làm:** phát hành 0.3.30: cài yêu cầu kỹ năng, quét đúng phạm vi đã tải, sửa cập nhật Codex, bố cục Công cụ cho kỹ năng và giới hạn máy ảo tự tính theo tài nguyên Docker/Podman.
- **Bản đã phát hành:** v0.3.29, đã xác minh latest.yml và SHA-512 bản cài. 0.3.30 đang kiểm tra trên test-build, chưa phát hành.
- **Đã làm được:** script `limix/rebrand.py` (chạy lại được, ổn định); logo đen trắng (hai khối bo tròn chồng nhau); linh vật mới 0.2.9: sao xanh ngọc + kính đen + mắt phát sáng (`limix/face.py`, rebrand bước 6a/6b/6d); tiếng Việt đủ 10210/10210 chuỗi; báo lỗi về hộp thư chủ dự án; Cloud là mô-đun ẩn; kiểm tra: 0 lỗi cú pháp, chạy từ bản sạch 6f226f15 → trùng khớp (trừ số phiên bản)
- **Đã kiểm trên GitHub Actions (run 43018860396, thành công):** cài thư viện, typecheck + build, cấu trúc gói, `Limix Bot.exe`, kênh cập nhật leomieo/limix-bot, máy chủ đóng gói trả lời /api/health
- **CHƯA kiểm:** cài và mở app thật 0.2.4+/0.2.5 trên máy Windows; linh vật 0.2.9 trong app thật (mới xem bằng ảnh dựng lại từ dữ liệu, chưa chạy vitest vì máy làm việc không có node_modules); thử gửi báo lỗi @devs thật
- **Ủy quyền hiện tại:** chủ dự án đã yêu cầu đẩy thay đổi lên GitHub và phát hành để ứng dụng tự cập nhật; cho phép này thay thế luật tạm thời không push ngày 2026-11-12.
- **Bước tiếp theo:** hoàn tất kiểm tra test-build, phát hành 0.3.30 trên main, xác minh bản cài và kênh cập nhật.

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
| R9 | Typecheck hiện chạy được trên máy Windows làm việc | Tính năng mới đã kiểm tra kiểu dữ liệu và fixture riêng; chưa thay cho nghiệm thu bản cài trên dữ liệu thật | Đã xử lý hạn chế cũ |
| R15 | Công cụ/yêu cầu quét trên host, chưa xác minh môi trường Docker/cloud | Không suy ra gói đã cài trên host cũng có trong máy ảo | Hiện rõ trên giao diện |
| R16 | Số máy ảo tự tính là ước tính theo giới hạn RAM/CPU; không phải kiểm thử tải hay bảo đảm dung lượng ổ đĩa | Chừa 20% RAM (tối thiểu 2 GiB), 10% CPU (tối thiểu 1); khi chưa đọc được runtime thì ghi rõ ước tính host. Máy đã tạo được giữ nguyên khi mức tính giảm | Hiện rõ cơ sở tính trong Cài đặt |
| R11 | Gói `limixbot` đã công khai trên npm (0.2.0, 0.2.1; latest 0.2.1) — `npx limixbot pair` dùng được. Còn: bật Trusted Publishing rồi xóa token (token bypass-2FA bị ngừng từ 01/2027) | | Gần xong |
| R12 | Lần đổi tên 1 sót chữ "OpenMaus Bot" (có dấu cách), "OpenMaus", "Maus" và câu có dấu "/" | Màn hình khởi động/khay còn tên cũ ở v0.1.153 | Đã sửa ở 0.2.0 |
| R13 | Báo cáo lỗi (@devs) trước gửi về đội OpenMausBot. Chủ dự án chọn: gửi về email riêng, KHÔNG hiển thị email → dùng FormSubmit qua mã ẩn danh trong secret `LIMIX_REPORT_ALIAS`; tắt hỏi trạng thái tới cloud.openmausbot.com | Chờ chủ dự án bấm Activate trong email FormSubmit + lưu secret | Đang làm (commit 698e46d chưa đẩy) |
| R14 | Bài học: đổi tên bằng regex có thể dán tên sản phẩm vào tên kỹ thuật (header `X-Limix Bot-Desktop-Owner` làm app hiện trang ghép cặp ở 0.1.153–0.2.0). Script nay có bảng TECH + kiểm tra LEFTOVER, và phải so khớp chạy-từ-bản-sạch trước khi đẩy | | Đã sửa ở 0.2.1 |
| R10 | Máy chủ Claude không đẩy được tag git (chỉ đẩy nhánh) | Build kích hoạt bằng push lên `main`; tag phát hành do workflow tự tạo | Đã xử lý |

## 5. Nhật ký thay đổi (mới nhất ở trên, mỗi lần sửa một dòng)

- 2026-11-14 | Codex | Giới hạn máy ảo tự tính theo MemTotal/NCPU của Docker hoặc host.memTotal/cpus của Podman, bỏ lựa chọn cố định 1–8; nâng cấu hình cũ sang auto, vẫn giữ lựa chọn thủ công rõ ràng trong config/API; không xóa hay dừng máy hiện có | server/limix-vm-capacity.ts, shared/limix-vm-capacity.ts, cấu hình/routes và LocalComputerSection, limix/patches/vm-capacity.json | 385 test đạt, 2 bỏ qua; typecheck đạt. Đọc Docker thật: 15.49 GiB/32 CPU, mỗi VM 4 GiB/2 CPU => 3 VM sau dự phòng. Chưa kiểm thử tải nhiều máy cùng lúc.

- 2026-11-14 | Codex | Kiểm tra API cấu hình tự động/thủ công trên server control:omb riêng, và component Máy tính thật với CSS production trong Edge headless | Fixture data-fu3Pf6; limix-vm-ui-ARSrag | API auto và manual 30 giữ đúng; UI hiển thị tự động 3, 2/3 máy Kiwi/Dev và bước 4 có dấu hoàn tất; không còn select giới hạn 1–8. Vite production build đạt.

- 2026-11-14 | Codex | Bước 4 thiết lập máy ảo riêng lấy trạng thái từ inventory: có desktop do app quản lý thì đánh dấu hoàn tất, kể cả đang dừng; không yêu cầu tạo lại | LocalComputerSection.tsx; limix/rebrand.py | Ảnh chủ dự án có Kiwi/Dev chạy nhưng bước 4 chưa hoàn tất; điều kiện cũ luôn false ở per-bot đã được sửa.

- 2026-11-14 | Codex | Công cụ cho kỹ năng rộng tối đa 1080px, giới hạn trong khung Cài đặt, tiêu đề/nút đóng cố định, hai cột khi đủ chỗ; sửa pipeline grep CI tránh SIGPIPE 141 | LimixToolsDialog.tsx + overlay; limix-docker.yml + brand-assets | Headless Edge dựng component thật với CSS production: khung lớn/nhỏ nằm trong parent, cuộn dọc và không tràn ngang; CI ảnh máy chủ đang chờ chạy lại.

Định dạng: `- YYYY-MM-DD HH:MM | Ai | Làm gì | File | Kiểm chứng`

- 2026-11-12 04:25 | Claude | Bản dựng 0.3.1 lần 1 LỖI tsc (onHelp không dùng trong SidebarProfileMenu; CI chạy tsc -b nên noUnused* chặn build). Sửa: onHelp tùy chọn, cập nhật test menu. Theo ý chủ dự án, hộp Giới thiệu chỉ hiện tác giả, bỏ chữ 'Based on OpenMausBot' (còn trong NOTICE, README, nút Giấy phép, chú thích khi rê chuột). Tạo kho github.com/leomieo/limix-bot-teams (catalog.json trống + README) | rebrand từ 6f226f15 trùng khớp
- 2026-11-12 04:15 | Claude | Chủ dự án đã deploy máy chủ + đặt mật khẩu leox (set_master_password.py). Tài khoản master đăng nhập được khi không có mạng/máy chủ: sau 1 lần đăng nhập thành công trên máy đó, app lưu băm scrypt của mật khẩu (không lưu mật khẩu) trong limix-account.json (mã hóa safeStorage); master không bị giới hạn 1 giờ offline. Máy mới tinh lần đầu vẫn cần máy chủ. Chưa đẩy GitHub | test node 5 tình huống; chưa chạy trong Electron
- 2026-11-12 04:05 | Claude | Chủ dự án: kỹ năng bot tự học KHÔNG cần duyệt (mặc định), có công tắc trong Cài đặt > Thử nghiệm 'Tự học kỹ năng mới, không cần hỏi' (features.skillAutoApply); tắt thì hiện thẻ hỏi trước khi thêm (rebrand 9h). Chưa đẩy GitHub | rebrand từ 6f226f15 trùng khớp; chưa chạy typecheck
- 2026-11-12 03:55 | Claude | 0.3.1 (chỉ commit trong máy, chờ chủ dự án cho đẩy): menu Trợ giúp bỏ 'Trung tâm trợ giúp'; 'Gửi phản hồi' icon Zalo, mở zalo.me/0977242439 (rebrand 9g). Deploy máy chủ: sandbox không SSH được tới VPS, chủ dự án tự chạy deploy.py + đặt LIMIXBOT_MASTER_PASSWORD | rebrand từ 6f226f15 trùng khớp
- 2026-11-12 03:40 | Claude | Chủ dự án: PHÁT HÀNH v0.3.0 (đã cho phép đẩy lên GitHub). Gộp 0.2.15 + đăng nhập tài khoản Limix (nhánh limix-account) vào main; mất mạng chỉ chạy tiếp 1 giờ; tài khoản master 'leox' ở máy chủ (biến LIMIXBOT_MASTER_PASSWORD, chủ dự án tự đặt). MÁY CHỦ CHƯA DEPLOY: tới khi deploy, app 0.3.0 không đăng nhập được | rebrand 8e + 9a–9f | node --check; test grace 1 giờ; rebrand từ 6f226f15 trùng khớp
- 2026-11-12 03:50 | Claude | 0.2.15 (chỉ commit trong máy): (1) chữ openmausbot trong ảnh Cua Driver → limixbot (ảnh máy ảo, đường dẫn trong ảnh, số lớp ảnh 8→9, dựng lại một lần) và quét chuỗi còn sót theo dòng (bước 9a); (2) Thoát từ khay hệ thống dọn mọi tiến trình con còn sót trong thư mục cài (9c; nút X thu về khay đã có sẵn ở bản gốc); (3) Kho cộng đồng → github.com/leomieo/limix-bot-teams (9d; repo cần catalog.json định dạng openmaus.catalog); (4) tự học skill kiểu Hermes + kho kỹ năng bật mặc định, dòng 'đã thêm kỹ năng' chữ vàng lấp lánh (9e, 9f); (5) tài khoản master 'leox' ở máy chủ (db_manager.py, mật khẩu qua biến môi trường LIMIXBOT_MASTER_PASSWORD, chưa deploy) | rebrand 9a–9f | node --check main.mjs; rebrand từ 6f226f15 trùng khớp; chưa chạy test/typecheck (không có node_modules)
- 2026-11-12 03:00 | Claude | Chủ dự án: TẠM KHÔNG ĐẨY LÊN GITHUB cho tới khi được phép. 0.2.14 (chỉ commit trong máy): bộ cài thiếu thư mục ui → hộp thoại "Bộ cài Limix Bot bị thiếu tệp" + nút tải bản cài, thay cho trang "no route" | rebrand bước 6i | node --check main.mjs; rebrand từ 6f226f15 trùng khớp

- 2026-11-12 02:55 | Claude | 0.2.13: sửa lỗi cập nhật (app biến mất, mở lại thấy "no route: GET /"). Nguyên nhân nghi cao: tiến trình phụ (cua-driver, trình duyệt bot, cloudflared, Python/uv) còn chạy giữ tệp → trình cài xóa giao diện cũ nhưng không ghi được bản mới. Sửa: build/limix-installer.nsh (customInit/customUnInit) dừng mọi tiến trình chạy từ thư mục cài trước khi cài. CHƯA kiểm trên Windows thật; chưa có log xác nhận | limix/overlay/build/limix-installer.nsh, rebrand bước 6h | rebrand từ 6f226f15 trùng khớp; chờ build CI (makensis biên dịch script)

- 2026-11-12 02:45 | Claude | 0.2.12: ẩn hẳn "Đăng nhập bằng tài khoản tổ chức" (Cài đặt → Tổ chức, dòng trong màn hình chào, menu Máy chủ) bằng công tắc LIMIX_ORGANIZATION_ENABLED = false, theo yêu cầu chủ dự án. Lỗi "no route: GET /" sau khi cập nhật 0.2.10: chưa rõ nguyên nhân (nghi tiến trình cũ còn chạy), chờ server.log/updater.log | limix/overlay/electron/limix-features.mjs, rebrand bước 6g | node --check main/menu/preload; rebrand từ 6f226f15 trùng khớp

- 2026-11-12 02:35 | Claude | 0.2.11: cổng Admin mặc định của "Đăng nhập bằng tài khoản tổ chức" đổi admin.openmausbot.com → https://admin.limixbot.com (theo yêu cầu chủ dự án). CHƯA có máy chủ ở địa chỉ đó nên nút vẫn báo lỗi; chủ dự án cũng báo 0.2.9 lỗi, chờ ảnh/log | rebrand bước 6f | rebrand từ 6f226f15 trùng khớp

- 2026-11-12 02:20 | Claude | 0.2.10: dấu tin chưa đọc trên taskbar Windows đổi từ logo thu nhỏ (trông như logo thứ hai) sang chấm đỏ có số 1–9, 9+ | limix/overlay/electron/resources/unread-badge-*.png, rebrand bước 6e | node --check main.mjs; rebrand từ 6f226f15 trùng khớp; CHƯA thấy trên Windows thật

- 2026-11-12 02:30 | Claude | 0.2.9: linh vật mới theo ảnh mẫu (sao bo tròn, kính đen, 25 biểu cảm mắt viên thuốc, bóng 3D, màu mặc định xanh ngọc); thân "star" thành hình hai khối "Giao thoa"; dịch nốt 4.632 chuỗi còn tiếng Anh, "Chief of Staff" → "Trợ lý trưởng" | limix/face.py, limix/rebrand.py, src/locales/vi.json | rebrand từ 6f226f15 trùng khớp (trừ version + vi.json), chạy lại 0 thay đổi; gen-mascot-bodies: mọi thân scale 1, không chạm mép; merge.py 0 lỗi placeholder

- 2026-11-11 23:35 | GitHub Actions + Claude | Build Windows 0.2.8 lỗi ở bước tải Python: GNU tar hiểu `D:\...` là máy từ xa → thêm `--force-local`; build lại | run 43046287196 (fail) | log job
- 2026-11-11 23:20 | Claude | 0.2.8 (S1): 3 skill mặc định từ GitHub ghim commit — ui-ux-pro-max `6ae86f6` (MIT), agent-reach `c70ae6d` (MIT), rea-video `3669923` (Apache-2.0) — qua `limix/skills/sources.json` + `sync.py` → `limix/overlay/skills/`; gói Python 3.12.16 + uv 0.13.5 (kiểm SHA-256) vào `resources/limix-runtime` (workflow Windows), `electron/limix-runtime.mjs` đưa lên PATH engine qua `OMB_EXTRA_PATH`; rea chỉ hướng dẫn bật tay | `limix/docs/MODULE_SKILLS.md`, rebrand bước 8g + builder | manifest hợp lệ 8/8, thử từ khóa 5 câu, `search.py` chạy được; rebrand từ bản sạch trùng khớp; CHƯA thử trên Windows
- 2026-11-11 22:55 | Claude | Khảo sát thêm skill/tool mặc định: app đã có skill đóng gói sẵn (`skills/<id>/SKILL.md + manifest.json`, `triggerTerms`, `defaultEnabled`), nhập skill từ link GitHub (`server/skill-fetch.ts`, ghi commit gốc), hàm kiểm tra bản mới `latestSkillCommit` CÓ nhưng CHƯA nối vào giao diện. 4 repo chủ dự án muốn: ui-ux-pro-max (skill, Python, MIT), Agent-Reach (CLI Python+uv, đăng nhập/cookie, MIT), rea-video (skill+CLI Python+ffmpeg, CHƯA thấy giấy phép), rea (MCP server+CLI Node, cần Ghidra/JADX…, MIT) | `server/skill-library.ts`, `server/skill-fetch.ts`, README các repo | đọc mã + trang GitHub; chờ chủ dự án chọn cách cập nhật
- 2026-11-11 22:40 | GitHub Actions | Phát hành v0.2.7 (Windows + npm thành công) | Releases | run 43041602191, 43041602203
- 2026-11-11 22:30 | Claude | 0.2.7: ẩn "Tải ứng dụng điện thoại" (mục menu, hộp QR App Store/APK, nút "Chưa có ứng dụng? Tải về") theo công tắc `LIMIX_PHONE_APPS_ENABLED=false`; giữ "Kết nối điện thoại". Phát hiện: mã QR "Kết nối điện thoại" là `openmausbot://pair?...` dành cho app gốc, KHÔNG mở được bản web; bản web trên điện thoại cần địa chỉ HTTPS (Tailscale/tên miền riêng), relay mặc định là hạ tầng của Supamaus | `limix/rebrand.py` bước 8f, `shared/pairing-link.ts`, `docs/phone-web-app.md` | rebrand từ bản sạch trùng khớp
- 2026-11-11 22:20 | Claude | Máy chủ tài khoản (dự án riêng tiktok-checker): sửa lỗ hổng (1) cookie admin cố định → phiên ngẫu nhiên, (3) trang admin chèn HTML không lọc → lọc hết; chủ dự án chọn để sau (2) băm mật khẩu yếu, (4) mã admin offline trong Limix Studio; CHƯA deploy (chủ dự án chưa muốn) | `F:\Tool tu build\tiktok-checker\gui_server.py`, `gui/admin_panel.html` | 9/9 phiên admin + 33/33 Limix Bot (CSDL tạm), thử chèn mã vào tên khách không chạy
- 2026-11-11 22:20 | Chủ dự án + Claude | Hỏi app điện thoại: repo OpenMausBot @6f226f15 KHÔNG có mã nguồn app iPhone/Android (chỉ `companion/` = tiến trình trung gian chạy trên máy tính, và bản web cho điện thoại); hộp "Tải ứng dụng điện thoại" của Limix đang trỏ tới app MausBot trên App Store và file APK không tồn tại ở repo Limix | `src/lib/app-links.ts` `IOS_APP_STORE_URL`, `ANDROID_APK_URL`; trang release android-v1.5.0 của upstream | đọc mã + trang GitHub
- 2026-11-11 22:00 | Claude | L1 tài khoản: (1) máy chủ có sẵn tiktok.limixmedia.com thêm `/api/limixbot/*` (đăng nhập, kiểm tra, đăng xuất, xem/gỡ máy; tối đa 10 máy, máy 11 bị từ chối, 30 ngày tự nhả chỗ, chặn dò mật khẩu) + nút "🤖 Bot n/10" ở trang admin — đã ghi vào `F:\Tool tu build\tiktok-checker` (bản gốc `*.bak-before-limixbot`), CHƯA đưa lên VPS; (2) app: cửa sổ đăng nhập trước khi mở app, màn hình đủ máy, kiểm tra 10 phút, 7 ngày mất mạng — nhánh `limix-account` (0.3.0), CHƯA gộp main | `limix/docs/MODULE_ACCOUNT.md` | máy chủ 33/33 + client 14/14 tình huống (CSDL tạm); ảnh trang admin + cửa sổ đăng nhập; rebrand từ bản sạch trùng khớp
- 2026-11-11 21:40 | GitHub Actions | Phát hành v0.2.5 và v0.2.6 (Windows + npm đều thành công); bản mới nhất v0.2.6 | Releases | run 43037001238, 43037001253
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
- 2026-11-12 0.3.2: remote access with Limix account (Worker accounts.limixmedia.com, `connectLimix`), email/name of the Limix account fill Settings > General when empty (env LIMIX_ACCOUNT_EMAIL/NAME → server profile fallback), About tagline shortened, placeholder limix.example.com, Usage analytics REMOVED entirely (owner decision: analyticsEnabled() always false, key blanked, Settings row hidden, docs/analytics.md deleted), bot Skills page: skills.sh link, built-in skills, add from local folder (`local-folder:<path>`, server/limix-skill-folder.ts). instabox.sh (Firecracker microVM + REST API, API key ibk_…) evaluated for cloud computer: NOT built yet, needs the owner's API key and a provider layer.
- 2026-11-12 0.3.3: Limix Gateway (Telegram, Zalo, NEW Discord via WebSocket) bundled in resources/limix-gateway, started by the app after sign-in (electron/limix-gateway.mjs, port 8790 on 127.0.0.1, data in userData/limix-gateway), opened from the account menu "Kết nối Telegram, Zalo, Discord", stopped on quit. WhatsApp and Messenger NOT built: both are webhook-only (public HTTPS address + Meta Business approval); plan: use the Cloudflare tunnel/Worker already deployed, one module each. Bot link (address + bak_ key) is still pasted by hand; automating it is a next step.
- 2026-11-12 0.3.4: fix gateway page blank (global function named top clashed with window.top; renamed pageTop). Lesson: UI scripts need a real-browser check (playwright), unit tests did not catch it.
- 2026-11-12 0.3.5 (test build first): Zalo getWebhookInfo 404 = no webhook (not an error); Zalo errors name the failing method.
- 2026-11-12 0.3.5 (test build): connector window restyled to the app's Midnight/Daylight tokens (no green, no gradients, Limix mark); Zalo getUpdates 404 = empty poll; reach line uses app locale (rebrand 10h).
- 2026-11-12 0.3.6 (test build): Instabox cloud computers — an ibk_ key in the Boat key slot routes boatFetch to server/limix-instabox.ts, which translates Boat REST to Instabox and answers in Boat's shape (rebrand 10i). Untested live: the sandbox and the user's Linux VM cannot reach api.instabox.sh (proxy 403). Phone: Settings → Phone & devices shows a browser QR (OMB_LAN=1 on the app server, /pair#code=…) instead of the phone-app pairing (rebrand 10j); Wi-Fi only for now. Connector: no OpenMausBot wording; Bot API address retries ports 8800/18800/28800.
- 2026-11-12 0.3.7–0.3.10: bản vá giao diện/kết nối (chi tiết ở lịch sử git); không đổi kiến trúc.
- 2026-11-12 0.3.11: chat nhóm, nhận Instabox, khay hệ thống.
- 2026-11-12 0.3.12: máy tính cloud hiện tên bot, hộp thoại "Kết nối điện thoại" ở giữa, QR từ xa qua 4G.
- 2026-11-12 0.3.13: QR từ xa dùng limixmedia.com, tự quên tài khoản từ xa OpenMausBot còn sót (`forgetForeign`), tab "Từ Xa"/"Nội Bộ", icon khay đổi theo giao diện.
- 2026-11-12 0.3.14 (gộp vào 0.3.15): "Công cụ cho kỹ năng" tự cài Docker/Node/ffmpeg/JDK/JADX/Ghidra/Agent-Reach/rea (`electron/limix-tools.mjs`), hỏi một lần trên máy mới; Cài đặt > Kỹ năng hiện kỹ năng có sẵn.
- 2026-11-12 0.3.15: **Limix Skill Hub**. Repo riêng `leomieo/limix-skill-hub` (tìm hằng ngày 03:00 VN, quét bảo mật, cách ly, chấm 100 điểm, SHA-256, đăng danh mục). Trong app: `server/limix-skill-hub.ts` + thẻ "Thư viện kỹ năng Limix" (Cài đặt > Kỹ năng; rebrand 10w). Cài từ Hub luôn ở trạng thái TẮT, kiểm SHA-256 từng file, bỏ script/MCP. Tự đồng bộ BẬT, tự cài TẮT. CHƯA làm: bot "curator" tự dịch/chấm thử (định dạng `_hub.review.json` đã chốt), hoàn tác về phiên bản cũ bằng một nút (bản cũ vẫn nằm trong archive của thư viện), phân quyền riêng từng bot ngoài cơ chế thư viện có sẵn.
- 2026-11-12 0.3.16: menu chat mới không bị cắt chữ (Windows 10), thẻ Hub có hướng dẫn cài đặt đầy đủ cho kỹ năng kèm tool + nút "Cài kèm tool" (rebrand 10x).
- 2026-11-12 0.3.17: Antigravity chậm do giải nén 0.3-1.3 GB mỗi lần mở; giữ động cơ rảnh 45 phút thay vì 10 (OMB_ACP_SESSION_IDLE_MS trong limix-runtime.mjs). Lần mở đầu tiên vẫn chậm.
- 2026-11-12 0.3.18: chủ dự án tự làm bot dịch/chấm riêng, đẩy kết quả lên kho Hub; app người dùng chỉ xem và tải skill (bỏ tab Việt hóa và dòng 'chưa có bản dịch'). Mô tả tiếng Việt hiện khi kho có description_vi.
- 2026-11-12 0.3.19: Antigravity làn nhanh: AI Antigravity đầu tiên dùng Antigravity CLI có sẵn (%LOCALAPPDATA%\agy\bin\agy.exe hoặc PATH, lệnh `agy acp`, đăng nhập theo agy), các AI khác dùng runtime như cũ. Tắt bằng LIMIX_AGY_CLI=0. Chủ làn lưu ở DATA_DIR/limix-agy-cli.json, đăng xuất AI đó thì nhả làn (rebrand 10y).
- 2026-11-12 0.3.20: Cài đặt (chế độ đơn giản) có mục Kỹ năng riêng, nằm dưới AI, trên Máy tính (rebrand 10z).
- 2026-11-12 0.3.21: 'Công cụ cho kỹ năng' rời menu tài khoản, thành thẻ đầu tiên trong Cài đặt > Kỹ năng (rebrand 10z2, LimixToolsCard); thẻ Hub hiện số sao, ngày tạo, ngày cập nhật (kho tự làm mới hằng ngày bằng tools/refresh-stats.mjs). Kho: tự tìm skill chỉ chạy khi bấm tay; bot của chủ kho chọn skill.
- 2026-11-12 0.3.22: SỬA 4G: đường hầm Cloudflare kết thúc ở cổng của app điện thoại gốc (companion origin), trình duyệt bị từ chối 'pair this device…'. Nay companion chuyển yêu cầu từ trình duyệt (có Origin hoặc không có Bearer, trừ /api/pair, /api/health, /v1/) sang server qua OMB_TUNNEL_SOCKET (companion/src/limix-web.ts, LIMIX_WEB_ORIGIN, rebrand 10z3). Chữ 'Điều khiển từ xa (Internet)'. Chưa thử trên điện thoại thật. Nút Chép link / Chép mã để điều khiển từ laptop.
- 2026-11-12 0.3.22: sửa 'Unknown mode: yolo' khi AI Antigravity chạy qua agy CLI (tên chế độ khác): chọn giá trị chế độ mà phiên có, không có thì bỏ qua (rebrand 10z4).
- 2026-11-12 0.3.23: Công cụ cho kỹ năng nhận công cụ có sẵn trên máy (PATH hiện tại của Windows đọc lại khi quét, WinGet Links, choco, scoop, JAVA_HOME≥17, GHIDRA_INSTALL_DIR), nút 'Quét máy', ghi 'dùng bản trên máy'/'do Limix Bot cài' (limix-tools.mjs locate/scan, rebrand 10z5). Cửa sổ Cài đặt kéo co giãn các cạnh (tối thiểu 640x460, tối đa cửa sổ app, nhớ kích thước, bấm đúp đặt lại; LimixResizeHandles, rebrand 10z6). Thẻ Hub thiết kế lại: nhãn điểm có màu, mô tả gọn 3 dòng + Xem thêm, chip loại/bảo mật/giấy phép, bỏ khung cuộn lồng, phân trang 12, đếm theo tab; nút 'Cài đặt'; skill cách ly có 'Cài đặt (không khuyến khích)' với cảnh báo (server allowRisky, field risky tách khỏi blocked).
- 2026-11-13 0.3.24: Câu chào đầu tiên + lựa chọn bắt đầu tiếng Việt, máy chủ theo ngôn ngữ chọn trong app (rebrand 11a). Bản mẫu > Bot dựng sẵn đọc từ kho leomieo/limix-bot-teams (catalog.json "bots" + bots/<id>.json, chỉ tải khi bấm Dùng mẫu, nút Cập nhật bỏ qua bộ nhớ đệm, offline dùng 16 bot có sẵn; 11b). Màn hình đăng nhập có nút Đăng ký lớn; menu tài khoản có Đăng xuất (hỏi lại, nhả chỗ máy, khởi động lại ở màn hình đăng nhập; 11c).
- 2026-11-13 0.3.25: skill theo từng bot (mặc định chỉ kĩ năng gốc; Kho Kĩ Năng (Skills) riêng mỗi bot; /tên-skill để gọi; rebrand 11d), kèm skill windows-computer-automation; trang /dang-ky bỏ chấm đầu dòng.
- 2026-11-13 0.3.26: nút "Đăng ký" mở limixmedia.com/dang-ky; mọi màn hình/hộp thoại/thông báo của Limix theo ngôn ngữ app (vi → tiếng Việt, khác → tiếng Anh): `src/lib/limix-text.ts` (lx), `electron/limix-lang.mjs` (lxm), `server/limix-lang.ts` (lxs); rebrand 11e–11g.
- 2026-11-13 0.3.27 (nhánh cloud-server): chạy Limix Bot trên VPS 24/7. ĐÃ XÁC MINH có sẵn từ OpenMausBot: Dockerfile target `server`, `deploy/install.sh`, `docs/deploy-vps.md`, đăng nhập Codex bằng mã thiết bị (`server/drivers/codex-device-auth.ts`), app "＋ → Kết nối với máy chủ", "Đặt … làm nơi chính". Thêm: kết nối Telegram/Zalo/Discord chạy kèm máy chủ (`server/limix-gateway-sidecar.ts`, `LIMIX_GATEWAY_SIDECAR=1` trong ảnh Docker), trang kết nối qua `/api/limix/gateway/` sau đăng nhập máy chủ, gateway chế độ máy chủ (`limix/gateway/src/app-bridge.mjs`, `LIMIX_SERVER_URL`), ảnh `ghcr.io/leomieo/limix-bot` (workflow `limix-docker.yml`, kèm Codex CLI), trình cài trỏ về leomieo/limix-bot; hướng dẫn `limix/docs/TRIEN_KHAI_CLOUD_24-7.md`. Đã phát hành 0.3.27; gói ghcr đã Public (tải ẩn danh được v0.3.27, stable). Rủi ro: bản fork chưa có sandbox cứng; Google Antigravity trên máy chủ dễ bị khóa.
- 2026-11-13 (nhánh home-tunnel): trình cài máy chủ thêm `--tunnel TOKEN` (đường hầm Cloudflare) cho máy ở nhà không IP tĩnh: bỏ kiểm tra cổng 80/443 và DNS, Caddy chỉ HTTP trên 127.0.0.1:8080, thêm dịch vụ cloudflared 2026.9.3, mã lưu .env (CF_TUNNEL_TOKEN); rebrand 11i. ĐÃ KIỂM: sh -n, sinh compose/Caddyfile đúng (thử bằng hàm thật của trình cài). CHƯA KIỂM: chạy thật trên Ubuntu + Cloudflare. Máy Xeon của chủ dự án: chưa cài hệ điều hành, mạng nhà.
- 2026-11-13 (nhánh skills-language, 0.3.28 chưa phát hành): Hybrid Skills cho skill tích hợp sẵn — lõi tiếng Anh giữ nguyên (SKILL.md), lớp tiếng Việt: mô tả hiển thị theo ngôn ngữ app (`limixSkillText`), từ khóa kích hoạt tiếng Việt cho cả 9 skill (rebrand 11k, `limix/skills/sources.json`), so khớp không dấu (`foldVietnamese` trong `limixSelectBundled`); windows-computer-automation chuyển lõi sang tiếng Anh, bản Việt ở `references/guide.vi.md`; skill bot tự học: mô tả tiếng Việt, thân tiếng Anh (`server/skill-learn.ts`, 11j); skill điện thoại bỏ chữ MausBot. ĐÃ ĐO (chỉ phần tìm skill theo từ khóa, 19 câu vi có dấu/không dấu/en): trước 9/19, sau 19/19 (`disc.mjs`); CHƯA đo tỉ lệ làm việc thành công của agent. Tool của agent: tên/mô tả vẫn tiếng Anh (OMB), Limix không dịch.

## Cập nhật cục bộ 2026-11-14

- Bot mẫu: 16 mẫu riêng dùng mô tả tiếng Việt, title/soul/notes/routine prompt tiếng Anh; 7 bot trong 2 nhóm đã tách mô tả khỏi soul ở bản checkout limix-bot-teams. Chưa đẩy kho mẫu lên GitHub.
- Docker: tên mới limixbot-computer; tự đổi tên container cũ có nhãn sở hữu đúng, giữ container ID và trạng thái chạy. Đã kiểm tra bằng Docker thật với container thử riêng. Nhãn kỹ thuật cũ được dùng để nhận diện dữ liệu đã tạo.
- Menu: bỏ dòng Đăng nhập dư thừa; sửa kỳ vọng test sau rebrand, 184 test liên quan đạt và 3 test đổi tên đạt.
- Popup dạng hộp thoại giữ mở khi bấm nền ngoài, đóng bằng điều khiển rõ ràng. 19 test thao tác/focus đạt; bản cài Windows dựng thành công. Suite SettingsModal.simple còn 12 kỳ vọng cũ về menu/ngôn ngữ/tính năng chưa khớp bản fork.

- Bản mẫu: tab Bản mẫu Nhóm tách khỏi Khám phá; Cập nhật chung tải lại hai kho, xử lý lỗi từng kho. Tạo và đẩy 16 Bot mẫu lên repo công khai leomieo/limix-bot-templates theo yêu cầu chủ dự án. Workflow cập nhật danh mục đã thành công; fixture control:omb tải thật 16 Bot + 2 nhóm, Dev có mô tả Việt và soul Anh. Repo nhóm vẫn leomieo/limix-bot-teams.

- 0.3.29 bổ sung theo yêu cầu mới: Quét máy đọc yêu cầu skill tích hợp, thư viện, skill riêng từng Bot và các thư mục .agents/.codex/.claude; đọc SKILL.md và tài liệu phụ trợ, metadata, package.json, requirements.txt/pyproject. Kiểm tra CLI/npm/Python/env trên host; ràng buộc phiên bản/MCP/yêu cầu không tự kiểm được báo cần kiểm tra. Fixture riêng đã nhận Remotion có sẵn và CLI còn thiếu; 8 test liên quan đạt, typecheck đạt.

- 0.3.30: quét chỉ skill tích hợp và đã tải/cài vào Limix Bot, bỏ skill ngoài app và kho chưa tải. Sửa parser không tách văn xuôi thành tên gói. Thêm cài từng mục/tất cả thiếu, chọn và xem lại dự án đích, npm/Python .venv, công cụ cơ bản dùng installer hiện có. Thử thật Remotion + CLI 4.0.543 và packaging 26.3 trong project tạm: rescan nhận đầy đủ. Sửa Update Codex trước cài lại pin 0.167.0: update lấy npm latest, chuyển đúng CLI và xác minh phiên bản thực tế; 23 test registry/route/UI đạt.

- 0.3.30 bổ sung giao diện Hub: bỏ tab Nguồn, chuyển Đồng bộ ngay sang Khám phá, giữ thời điểm/lỗi đồng bộ ở đó; test DOM đạt. Luồng Update Codex đã thử tải thật vào prefix tạm: expected 0.169.0, CLI báo codex-cli 0.169.0.
