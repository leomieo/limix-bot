# PROJECT_MEMORY.md — Bộ nhớ dự án Limix Bot

> Mục đích: AI và chủ dự án không bị quên, không đi lệch giữa các phiên.
> **Luật:** đọc file này đầu mỗi phiên (sau `CLAUDE.md`). Sau MỖI lần thêm/sửa/xóa file, đổi quyết định
> hoặc phát hiện điều mới → cập nhật mục 1, 4 và ghi một dòng vào mục 5 TRƯỚC khi báo "xong".
> Chỉ ghi sự thật đã xảy ra. Không ghi kế hoạch vào nhật ký.

## 1. Trạng thái hiện tại (luôn ghi đè cho đúng)

- Cloud native beta on cloud-native-codex: per-account Cloud homes, signed pairing, owner trial decisions and opt-in sleep. See EVIDENCE_CLOUD_NATIVE_CODEX.md for verification and outstanding Xeon acceptance.

- Managed beta image includes pinned Google Antigravity ACP alongside Codex and Claude Code. Customers can configure API providers inside their account runtime.

- Managed Cloud beta can allocate a per-account server + gateway, with isolated persistent CLI HOME and a loopback pairing edge. Enrolled desktop users can request provisioning from their account menu.

- Managed beta workspace requests now use verified Limix sessions and a D1 registry in source.

- 2026-11-15 owner selected managed customer Cloud on owner infrastructure, public endpoint bot.limixmedia.com. Recorded PLAN_MANAGED_CLOUD_BETA.md with account-verified provisioning, tenant isolation, durable jobs, automatic client connection, host capacity and acceptance. This is a design record, not implemented provisioning.

- 2026-11-15 preparing 0.3.48: replaced own-server lending popup with a main-owned static Electron modal matching app colors. Shows server identity and origin, explicit screen/app scope and separately granted folder/terminal access. Default Not now; close/Escape decline; page scripts off, resources blocked, only nonce-bound form navigation can approve. 19 node tests PASS, locale validation PASS, real isolated Electron screenshot and Allow form interaction PASS.

- 2026-11-15 Xeon beta preparation: owner reports two E5-2680 v4 CPUs (56 logical processors total), Windows with node/docker/wsl commands, different Internet networks and AnyDesk access. Added deploy/windows-beta/start.ps1 using published npm 0.3.47, separate beta data and ports, Tailscale by default, per-bot desktop limit one/4 GiB/2 CPUs. Syntax and read-only preflight PASS on the local i9 only.

- 2026-11-15 preparing 0.3.47: reviewed Vietnamese UI terminology across 10,234 locale keys; 389 changed values. Memory upkeep is Tu cap nhat bo nho; actor distinguishes automatic system changes. Department => nhom bot, conversation thread => cuoc tro chuyen, effort => muc do suy luan. Complete locale/placeholder validation PASS.

- 2026-11-15 preparing 0.3.46: team settings includes common folder bulk apply to current bots and individually targeted approval changes (ask/auto/full). Existing per-bot validation and trusted-approval IPC retained. 276 targeted tests PASS; TypeScript PASS; guarded source reproduction PASS.

- 2026-11-15 preparing 0.3.45: simplified gateway setup, folded name/test/access/media settings, automatic owner code after create and transient code retained across refresh until owner verification/expiry. 13 DOM/API tests PASS. Live Zalo NOT_TESTED.

- 2026-11-15 preparing 0.3.44: channel review guard matches route segments and excludes bot-template endpoints. 18 targeted tests PASS; screenshot request itself not captured.

- 0.3.43 adds a dedicated Xingchi Codex Responses preset in More AI providers. The image tool uses the selected preset for that conversation, retaining image limits.

- 2026-11-15 preparing 0.3.42: always advertise native generate_image, including missing setup; stable English routing instructions; reject Composio image-generation slugs (direct and multi-execute) before upstream. Missing setup returns Settings path and no fabricated success. 82 targeted tests PASS + one isolated real-server/fake-engine MCP test PASS; TypeScript PASS. Desktop 0.3.41 CI 43624714392 completed success across all platforms and publish. New routing release pending.

- 2026-11-15 preparing 0.3.41: hidden channel conversations with online Limix password reauthentication through main IPC, one-use review ticket, five-minute HttpOnly cookie, lock/expiry. Scoped sender identity and internal chat separation implemented. 60 gateway tests, 74 server/navigation and 35 visibility/privacy tests PASS; isolated real HTTP fixture with fake engine confirms hidden snapshots/transcripts and cross-user refusal. Live account password entry/Zalo/Telegram NOT_TESTED. Native release pending CI.

- 2026-11-15 channel chat isolation locally implemented, NOT RELEASED: desktop navigation/composer separated from API chats, safe pre-admission busy retry, platform/user/thread identity binding. Password-protected hidden conversation management remains incomplete; see PLAN_CHANNEL_PRIVACY.md. Do not claim privacy implemented.

- 2026-11-15 Responses image integration: Custom now supports Images and Responses protocols; Sol/Astra model choices, optional local-image-extension header from the user-supplied gateway config, and explicit saved API connection import without exposing keys. Image settings visible under AI in Simple mode. 319 tests passed, 2 skipped; TypeScript PASS; isolated HTTP fixture generated PNGs through Responses for both model IDs (fake upstream). Public v0.3.39 verified via GitHub release metadata; new image changes prepared as 0.3.40; publication pending native CI.

- 2026-11-15 desktop update schedule: change existing hourly check to every six hours (Windows/macOS/Linux). Keep startup check after 15 seconds and manual check via updater coordinator. Requires app process running; no OS background service introduced. Reproducible via rebrand.py.

- 2026-11-14 Mac Docker: per-tool installable flag enables Docker on macOS without enabling Windows-only installers. Official arch-specific DMG download, hdiutil verify then open; done means installer opened, not installed. Detect /Applications, user Applications and ~/.docker/bin. Source + overlays/workflows aligned. 3 helper tests and 4 tools UI tests pass (mock); actual DMG installation on a Mac NOT_TESTED. Prepared 0.3.38 for all-platform CI.

- **2026-11-14 media connections:** implemented Telegram/Discord binary media receive/send, Zalo image/voice receive and image/private AAC send via optional HTTPS, Facebook Fanpage signed webhook + Page responses. Per-connection controls and scoped Bot API attachments, authorization before download, bounded CDN fetch and partial-send status. Facebook personal/WhatsApp/Zalo OA remain unavailable; no verified official personal API. See `PLAN_CHANNEL_MEDIA.md`. Verification: gateway 49/49 PASS_MOCK; Bot API/attachment/ingress 104 passed, 1 skipped; targeted full-server/media 3 passed; TypeScript build PASS. Live accounts/HTTPS/packaged delivery NOT_TESTED. Release 0.3.37 requested: promoting reviewed channel-media changes to main for all-platform build; publication pending CI. Existing Windows symlink fixture fails EPERM before exercising code. Cloud stays off.

- **Yêu cầu mới — kết nối đa phương tiện:** đã rà soát gateway Telegram/Zalo/Discord: chỉ có đường truyền chữ, attachments=false và router chặn non-text; chưa có Facebook adapter. Kế hoạch `PLAN_CHANNEL_MEDIA.md`; chưa triển khai/chưa kiểm gửi nhận media thật. Chủ dự án đã chọn cả Facebook Fanpage và tài khoản cá nhân; cần hai loại kết nối riêng, chưa xác minh cơ chế hỗ trợ tài khoản cá nhân.

- **Đã phát hành 0.3.36:** sao chép mã liên kết chủ bot không còn báo thành công khi clipboard bị từ chối. Cửa sổ gateway dùng session riêng, chỉ cấp clipboard-sanitized-write cho main frame đúng origin/cửa sổ; có fallback chọn văn bản và lỗi rõ ràng. Mã tại 879367663; desktop CI 43603805772 success gồm Windows, Linux, Mac Apple Silicon/Intel và publish. Latest public v0.3.36; đã kiểm ba feed và năm liên kết bộ cài, Windows tải về khớp SHA-512.

- **Đang phát triển 2026-11-14:** đồng bộ dữ liệu tài khoản là module ẩn/tắt vì chưa có server; chuyển máy Offline bằng file có mật khẩu, chỉ nhập vào app bằng hoặc mới hơn; dọn trùng quản lý skills; chuẩn hóa English technical core; bổ sung macOS/Linux. Kế hoạch và giới hạn: `PLAN_ACCOUNT_DATA.md`. Desktop v0.3.36 đã được phát hành công khai cho Windows x64, macOS Apple Silicon/Intel và Linux x64; xem mốc phát hành bên dưới.

- **Hướng chính (đổi 2026-11-11 18:41):** Limix Bot = **bản fork đổi thương hiệu của OpenMausBot** (giao diện như mausbot.com), phát hành file cài Windows `.exe` qua GitHub Actions của repo `leomieo/limix-bot`. `limix-gateway` (cổng Telegram/Zalo) là module sẽ gộp vào app ở mốc sau.
- **Mốc hoàn tất:** desktop v0.3.36 đã public; workflow 43603805772 success ở Windows, Linux, macOS Apple Silicon, Intel smoke và publish. Publisher xác nhận feeds/hashes toàn bộ nền tảng.
- **Bản đã phát hành:** v0.3.36 — https://github.com/leomieo/limix-bot/releases/tag/v0.3.36. Ba feed cập nhật đúng 0.3.36; năm liên kết tải stable trả đúng kích thước từ GitHub. Bộ cài Windows tại `F:\Tool tu build\Limix Bot\releases\0.3.36\LimixBot-0.3.36-setup.exe`, 298303717 byte, tải thật và khớp SHA-512 trong latest.yml. Chưa cài trên dữ liệu người dùng hoặc xác minh GUI cập nhật tự động.
- **Đã làm được:** script `limix/rebrand.py` (chạy lại được, ổn định); logo đen trắng (hai khối bo tròn chồng nhau); linh vật mới 0.2.9: sao xanh ngọc + kính đen + mắt phát sáng (`limix/face.py`, rebrand bước 6a/6b/6d); tiếng Việt đủ 10210/10210 chuỗi; báo lỗi về hộp thư chủ dự án; Cloud là mô-đun ẩn; kiểm tra: 0 lỗi cú pháp, chạy từ bản sạch 6f226f15 → trùng khớp (trừ số phiên bản)
- **Đã kiểm trên GitHub Actions (run 43018860396, thành công):** cài thư viện, typecheck + build, cấu trúc gói, `Limix Bot.exe`, kênh cập nhật leomieo/limix-bot, máy chủ đóng gói trả lời /api/health
- **CHƯA kiểm:** 30 máy ảo cùng chạy trên phần cứng thật; cập nhật/cài đặt 0.3.31 qua giao diện ứng dụng của chủ dự án; tự khởi động sau khi đăng xuất/đăng nhập Windows hoặc reboot. Khởi động cùng Windows đã thử API native với registry fixture riêng.
- **Ủy quyền hiện tại:** chủ dự án đã yêu cầu đẩy thay đổi lên GitHub và phát hành để ứng dụng tự cập nhật; cho phép này thay thế luật tạm thời không push ngày 2026-11-12.
- **Bước tiếp theo:** kiểm tra cài đặt/cập nhật v0.3.36 và nút sao chép trên máy thực tế; macOS chưa ký số/notarize. Cloud account sync tiếp tục ẩn/tắt.

## 2. Bản đồ thư mục dự án

- Cloud native: deploy/managed-beta/{host,power-probe,wake-proxy,smoke}.mjs, control-plane migration 0022 and src/{cloud-owner,cloud-power-admin}.ts. Operational steps in deploy/managed-beta/README.md.

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

- Cloud native beta was exercised on local i9 Docker Desktop. Xeon, real tenant login, public tunnel and live messaging remain unverified. Enabled messaging gateway keeps the home awake. No production deployment.

- Cloud volume persistence is separate from backups and local CLI sign-in migration. No real subscription sign-in or live provider request verified for this image.

- The beta has no automatic public account-to-home grant, no verified live subscription or message delivery on Xeon, and no managed per-bot cloud computer allocator. Windows Docker startup before login has not been validated.

- The host allocator and customer connection are pending. No public route or live deployment verified.

- Managed Cloud controller, host worker, public HTTPS routing and beta UI are not implemented. Public DNS lookup for bot.limixmedia.com returned no records during this check. Running one Tailscale server does not establish customer-ready Cloud provisioning.

- Server access dialog verified in isolated Electron, not in an installed 0.3.48 app or a live remote permission grant. The new dialog applies to own-server initial/screen sharing consent; other native permission prompts retain their existing UI.

- Xeon Node version, Docker daemon/WSL readiness and Windows version remain unverified. No live server was started on Xeon. Tailscale installation/sign-in/HTTPS, cross-network pairing, real model and desktop acceptance pending. Computer-use skill prohibits terminal automation, so owner executes the remote PowerShell step.

- Review covers locale catalog and targeted context checks, not manual visual acceptance of every screen. i18n tests have two baseline failures (branding expectation and incomplete pt-br pack); MemorySection and team bulk checks PASS.

- Team folder is saved on current bot records, not a persistent department default. New members require reapplying. Explicit thread folders remain selected. No packaged UI acceptance performed.

- Zalo token issuance still requires the platform website. Sending media still needs the existing HTTPS configuration. Packaged visual and live Zalo acceptance pending.

- Exact request causing template screenshot error remains unobserved. Packaged regression is pending CI.

- Xingchi account permissions and packaged UI remain unverified. Network and sandbox permissions remain scoped by Limix.

- 2026-11-15 image routing: live Xingchi capability/403 account entitlement NOT_TESTED. Native image limits and person-turn rules unchanged. Connector guard recognizes image-generation slugs, not arbitrary opaque workbench code; do not claim universal prevention of external image services. 9 pre-existing system-prompt/catalog golden-budget tests fail identically on HEAD (baseline verified); no new failures in targeted routing tests.

- Channel privacy 0.3.41: application access control, not encrypted-at-rest storage. Online account verification required. Archive/search/activity access is unavailable while channel review is locked. Raw files remain accessible to the OS account owner. Live account verification and packaged runtime NOT_TESTED.

- 2026-11-15 password privacy pending: existing admin snapshots/SSE/search/attachments still expose channel history. Need trusted password reauthentication and per-session visibility gate before release. Identity metadata requires the Bot API bearer and is additional scope, not independent platform authentication. Groups share group history.

- 2026-11-15 image integration: Xingchi live endpoint/account NOT_TESTED, no real key supplied. Responses adapter requires non-streaming JSON with completed image_generation_call.result; no image editing. Settings suite has 6 pre-existing failures, reproduced on HEAD (analytics removal, old branding, disabled Cloud), not caused by image changes. No changes to guest permission/spending gates or the existing image/media size caps. Saved connection import copies credentials once and disables fallback; it does not synchronize later key changes.

- 2026-11-15 desktop update schedule: change existing hourly check to every six hours (Windows/macOS/Linux). Keep startup check after 15 seconds and manual check via updater coordinator. Requires app process running; no OS background service introduced. Reproducible via rebrand.py.

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
| R16 | Số máy ảo chạy cùng lúc tự tính là ước tính theo giới hạn RAM/CPU; không phải kiểm thử tải hay bảo đảm dung lượng ổ đĩa | Chừa 20% RAM (tối thiểu 2 GiB), 10% CPU (tối thiểu 1); chưa đọc runtime thì ghi rõ ước tính host. Máy đã tạo không bị giới hạn số lượng trong app; không tự dừng máy đang chạy khi mức tính giảm | Hiện rõ cơ sở tính trong Cài đặt |
| R11 | Gói `limixbot` đã công khai trên npm (0.2.0, 0.2.1; latest 0.2.1) — `npx limixbot pair` dùng được. Còn: bật Trusted Publishing rồi xóa token (token bypass-2FA bị ngừng từ 01/2027) | | Gần xong |
| R12 | Lần đổi tên 1 sót chữ "OpenMaus Bot" (có dấu cách), "OpenMaus", "Maus" và câu có dấu "/" | Màn hình khởi động/khay còn tên cũ ở v0.1.153 | Đã sửa ở 0.2.0 |
| R13 | Báo cáo lỗi (@devs) trước gửi về đội OpenMausBot. Chủ dự án chọn: gửi về email riêng, KHÔNG hiển thị email → dùng FormSubmit qua mã ẩn danh trong secret `LIMIX_REPORT_ALIAS`; tắt hỏi trạng thái tới cloud.openmausbot.com | Chờ chủ dự án bấm Activate trong email FormSubmit + lưu secret | Đang làm (commit 698e46d chưa đẩy) |
| R14 | Bài học: đổi tên bằng regex có thể dán tên sản phẩm vào tên kỹ thuật (header `X-Limix Bot-Desktop-Owner` làm app hiện trang ghép cặp ở 0.1.153–0.2.0). Script nay có bảng TECH + kiểm tra LEFTOVER, và phải so khớp chạy-từ-bản-sạch trước khi đẩy | | Đã sửa ở 0.2.1 |
| R10 | Máy chủ Claude không đẩy được tag git (chỉ đẩy nhánh) | Build kích hoạt bằng push lên `main`; tag phát hành do workflow tự tạo | Đã xử lý |

## 5. Nhật ký thay đổi (mới nhất ở trên, mỗi lần sửa một dòng)

- 2026-11-16: implemented C1–C4 on cloud-native-codex. Two real home containers verified pairing, key/session isolation and persistence. Worker 180/180 and host/proxy 9/9 passed.

- Built the managed Linux x64 image; verified real Antigravity ACP 1.4.3 initialization, synthetic OpenAI-compatible key persistence across recreation, and account isolation in two Docker fixtures.

- 2026-11-15: Built managed runtime image with Codex/Claude, verified two isolated Docker homes, pairing A rejected by B, retained volume after recreation. Control plane verification used local D1 with mock accounts.

- 2026-11-15: Added enrolled-account workspace requests with retry deduplication. Xeon tunnel screenshot shows Healthy, one replica, no routes.

- 2026-11-15 recorded owner decisions: customers use owner server, require only Limix Bot, and connect through bot.limixmedia.com. Added managed Cloud beta architecture and acceptance plan.

- 2026-11-15 redesigned own-server computer access confirmation, clarified English/Vietnamese copy, retained main-process permission ownership and added regression coverage.

- 2026-11-15 prepared a Windows beta server launcher and bilingual guide for testing server connection and server-hosted bot desktops while keeping daily Windows use.

- 2026-11-15 revised Vietnamese product terminology and corrected skill hint placeholder mismatch; reproducible reviewed key map applied after branding patches.

- 2026-11-15 implemented team folder selection and per-member approval targeting; extended bot patch queue nullable cwd normalization.

- 2026-11-15 simplified Zalo/gateway onboarding and automated the initial owner link code with retry on failure.

- 2026-11-15 fixed overbroad channel privacy path matcher and added template/search/archive regression coverage.

- 2026-11-15 added Xingchi preset, isolated endpoint key, model discovery and same-provider image routing. Focused tests 100/100 with simulated provider.

- 2026-11-15: Fixed native image tool disappearing before setup; added stable image routing rules and Composio image-call rejection; 82 unit/route tests and 1 isolated server MCP test PASS. Confirmed prior 0.3.41 desktop CI successful. Prepared 0.3.42; live image service not verified.

- 2026-11-15 preparing 0.3.41: hidden channel conversations with online Limix password reauthentication through main IPC, one-use review ticket, five-minute HttpOnly cookie, lock/expiry. Scoped sender identity and internal chat separation implemented. 60 gateway tests, 74 server/navigation and 35 visibility/privacy tests PASS; isolated real HTTP fixture with fake engine confirms hidden snapshots/transcripts and cross-user refusal. Live account password entry/Zalo/Telegram NOT_TESTED. Native release pending CI.

- 2026-11-15: Added local/API chat navigation separation, read-only customer composer and server refusal, explicit busy retry, and persistent scoped channel identity checks. 70 targeted server/navigation tests + 11 gateway queue tests passed. Password gate and hidden history browser still pending; changes not pushed/released.

- 2026-11-15: Implemented Custom Responses image generation and server-side saved API connection copy, exposed image settings in AI, added Sol/Astra suggestions. Unit/UI/mock route tests 319 PASS + 2 skipped; isolated HTTP config→Responses→PNG PASS for both models. Rebrand patches reproduce changes and are idempotent. Live Xingchi/Zalo NOT_TESTED.

- 2026-11-15 desktop update schedule: change existing hourly check to every six hours (Windows/macOS/Linux). Keep startup check after 15 seconds and manual check via updater coordinator. Requires app process running; no OS background service introduced. Reproducible via rebrand.py.

- 2026-11-14 Mac Docker: per-tool installable flag enables Docker on macOS without enabling Windows-only installers. Official arch-specific DMG download, hdiutil verify then open; done means installer opened, not installed. Detect /Applications, user Applications and ~/.docker/bin. Source + overlays/workflows aligned. 3 helper tests and 4 tools UI tests pass (mock); actual DMG installation on a Mac NOT_TESTED. Prepared 0.3.38 for all-platform CI.

- **2026-11-14 media connections:** implemented Telegram/Discord binary media receive/send, Zalo image/voice receive and image/private AAC send via optional HTTPS, Facebook Fanpage signed webhook + Page responses. Per-connection controls and scoped Bot API attachments, authorization before download, bounded CDN fetch and partial-send status. Facebook personal/WhatsApp/Zalo OA remain unavailable; no verified official personal API. See `PLAN_CHANNEL_MEDIA.md`. Verification: gateway 49/49 PASS_MOCK; Bot API/attachment/ingress 104 passed, 1 skipped; targeted full-server/media 3 passed; TypeScript build PASS. Live accounts/HTTPS/packaged delivery NOT_TESTED. Release 0.3.37 requested: promoting reviewed channel-media changes to main for all-platform build; publication pending CI. Existing Windows symlink fixture fails EPERM before exercising code. Cloud stays off.

- 2026-11-14 | Codex | Rà soát yêu cầu media đa nền tảng, đối chiếu tài liệu chính thức Telegram/Discord/Messenger/Zalo; ghi PLAN_CHANNEL_MEDIA.md. Phát hiện thiếu cả adapter media, router và hợp đồng truyền tệp vào/ra bot. Zalo sendVoice chỉ AAC chat riêng, không nhóm. Đây là kết quả khảo sát và kế hoạch, chưa phải tính năng đã thực hiện.

- 2026-11-14 | Codex | Hoàn tất phát hành v0.3.36: Actions 43603805772 toàn bộ jobs success; API latest draft=false/prerelease=false; kiểm ba updater feeds đúng phiên bản, đủ năm stable downloads và Content-Length khớp. Log publish: PASS release 0.3.36 Windows/macOS arm64/x64/Linux feeds/hashes. Tải bộ cài Windows 298303717 byte về releases/0.3.36, xác minh SHA-512 theo updater. Bản sửa clipboard đã public, chưa xác minh cài đặt/nút copy trên app của chủ dự án.

- 2026-11-14 | Codex | Sửa lỗi clipboard ở gateway: mã cũ nuốt NotAllowedError nhưng vẫn báo Đã sao chép; cửa sổ gateway dùng default session với quyền chỉ dành cho origin app chính nên không được cấp ghi clipboard. Thêm session gateway tách biệt với quyền ghi hạn chế theo cửa sổ/origin/main frame, từ chối đọc clipboard và mọi quyền khác; web UI chờ kết quả, fallback execCommand, timeout 3 giây, báo lỗi/chọn mã khi thất bại. 5 kiểm thử UI và 2 kiểm thử quyền đạt; 4 HTTP gateway tests đạt. Electron 43 fixture trên cổng ngẫu nhiên xác nhận quyền ghi theo gesture granted và đọc denied. Chưa ghi thử clipboard hệ điều hành để giữ nguyên clipboard ảnh hiện có; chưa kiểm bản cài thực tế. Kiểm tra mở rộng phát hiện 2 guard tests thất bại vì LimixPhoneBrowser gọi clipboard trực tiếp từ trước; chuyển hai nút chép link/mã điện thoại sang useCopyFeedback dùng chung, có fallback và báo lỗi. Kiểm thử cuối đạt 27/27 Vitest clipboard/UI, 19/19 Electron clipboard và 32/32 gateway (HTTP/API/channels giả lập); không phải xác minh gửi tin nền tảng thật. TypeScript UI đã qua. Đồng bộ overlay/workflow nguồn; thêm kiểm thử gateway/clipboard trên cả ba OS; chuẩn bị 0.3.36.

- 2026-11-14 | Codex | Cập nhật README song ngữ sau phát hành v0.3.35: hàng nút tải Windows, macOS Apple Silicon, macOS Intel và Linux x64; tách hàng phiên bản/giấy phép; bảng tải đủ EXE/DMG/AppImage/DEB ở cả hai ngôn ngữ; hướng dẫn bắt đầu và lưu ý nền tảng khớp gói đã public. Đồng bộ README gốc, overlay và brand asset. Chỉ sửa tài liệu, không khởi chạy lại build desktop. Nguồn trạng thái phát hành: API workflow 43554086881 và releases/latest.

- 2026-11-14 | GitHub Actions + Codex | Phát hành và xác minh v0.3.31 | main/tag 07b0860; Windows 43533896116, npm 43533896083, image 43533896079 | Cả 3 workflow success; tải thật bản cài 298305452 byte khớp SHA-512 latest.yml; latest feed 0.3.31; stable installer và blockmap có đủ. Release notes tiếng Việt đã cập nhật.

- 2026-11-14 | GitHub Actions + Codex | Phát hành v0.3.30; xác minh bản cài và metadata cập nhật trực tiếp từ Releases | tag/main 63716b7; Windows 43531575861, npm 43531575805, server image 43531575818 | Cả 3 workflow success; tải thật 298305129 byte, khớp SHA-512 latest.yml; latest feed 0.3.30; stable installer + blockmap có đủ.

- 2026-11-14 | Codex | Sửa Mở khi đăng nhập trên Windows: truy vấn quoted execPath cho Electron 43.7.9 (upstream PR #54364), đăng ký/enable rõ ràng đúng executable; xác minh lại trạng thái sau thay đổi, báo lỗi khi hệ thống không áp dụng | electron/open-at-login.mjs + overlay, OpenAtLoginRow + overlay | Đọc HKCU thấy Limix Bot at login đã đăng ký. Electron thật: unquoted không tìm thấy, quoted thấy enabled. Fixture registry riêng kiểm bật, nhận Task Manager disabled, bật lại, tắt và xóa đúng mục thử; helper mới đọc bản cài thật là on (chỉ đọc). Không đăng xuất/khởi động lại Windows.

- 2026-11-14 | Chủ dự án + Codex | Chốt lại giới hạn chỉ áp dụng máy chạy đồng thời, không áp dụng số đã tạo. Khi đầy slot, dùng Docker/Podman create để tạo máy ở trạng thái dừng; mọi đường start/run của app kiểm tra số chạy trong cùng hàng đợi để chống vượt giới hạn. Danh sách có Dừng/Bật | container-computer.ts, index/routes, ComputerPanel và LocalComputerSection; module capacity | 171 test backend/liên quan và 96 test UI liên quan đạt (có chồng lặp); mô phỏng 30 máy mới khi slot đầy, 6 yêu cầu bật đồng thời chỉ 3 chạy. Docker thật: tạo fixture stopped/resumable khi limit=0, số máy chạy giữ 2→2; đã xóa đúng fixture.

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

- 2026-11-14: thêm module `limix/account-sync` (9/9 Node fixture tests), tái sử dụng workspace backup cho Chuyển máy Offline, bỏ gán bot ở thư viện chung; rà soát ngôn ngữ kỹ thuật và nhận yêu cầu build macOS/Linux. Chưa nối server, chưa bật đồng bộ, chưa phát hành.

- 2026-11-14 QA trước push 0.3.32: 56/56 Vitest tính năng mới, 9/9 Node module đồng bộ, 2 kiểm thử archive/phiên bản thực tế đạt (các lượt có chồng lặp, không cộng tổng). TypeScript UI/server và Vite build đạt. Rebrand tái dựng đúng 15 file thay đổi, chạy lặp ổn định. Bộ Settings Simple còn 6 lỗi cũ; so với baseline HEAD 12 lỗi, không có lỗi mới. Bộ archive đầy đủ trên Windows còn 3 lỗi EPERM tạo symlink; sẽ chạy trên CI macOS/Linux. Fixture HTTP chuẩn đã launch và /status 200, export bị guard từ chối do HOME nằm trong DATA của launcher; không coi đây là export E2E đạt. Không sửa/bỏ guard. Website đã kiểm DOM fixture: FAQ không có open, 4 link nền tảng bật khi API giả trả đủ file; chưa xác minh trình duyệt/live site sau deploy.

- 2026-11-14 GitHub: commit 738e14b đã lên main. Site run 43543525483 success, cả limixmedia.com và www trả HTTP 200 từ runner. npm run 43543525446 và image run 43543525539 success. Desktop run 43543525640: kiểm thử trên Mac/Linux qua; macOS build OOM ở tsc với heap mặc định ~2 GB. Đang đặt NODE_OPTIONS=--max-old-space-size=4096 cho job build, tiếp tục chờ Windows/Linux để gom sửa trước khi chạy lại. Chưa phát hành desktop 0.3.32.

- 2026-11-14 yêu cầu bổ sung: Chuyển máy Offline chỉ nhập đúng tài khoản xuất; đã thêm hash principal Limix trong manifest mã hóa, kiểm tra preview/commit/startup, hủy pending sai tài khoản không áp dữ liệu. Principal do Electron gate cấp qua env, không dùng tên hồ sơ/HTTP body. Thay xác nhận đăng xuất native bằng ConfirmDialog có theme, pending/error, kiểm tra tài khoản không đổi. Công cụ npm global cài vào userData/limix-tools/npm-tools và PATH; Remotion giữ trong dự án, chỉ mở picker khi bấm chọn rõ ràng. Cài thử agent-desktop 1.3.1 trong temp riêng và chạy --version đạt. Chi tiết giới hạn/quyết định ở PLAN_ACCOUNT_DATA.md.
- 2026-11-14 CI lần đầu: Windows package success; Mac tsc OOM ~2GB; Linux build gói success nhưng smoke phát hiện python3 symlink trỏ về scratch đã xóa. Đã sửa cpSync verbatimSymlinks + kiểm tra sau cleanup và tăng heap build 4096MB. Không có desktop release 0.3.32; publisher đã bị chặn đúng khi một nền tảng lỗi. Bản tiếp theo 0.3.33 để khớp npm/image đã phát hành trước đó. Chưa push lượt bổ sung này.

- 2026-11-14 lượt 0.3.33: 67/67 Vitest chức năng tổng hợp, 14/14 UI/HTTP đăng xuất/chọn thư mục, 4/4 archive thật có ràng buộc account/version/khôi phục, 6/6 Node cài gói+đăng xuất đã qua (có kiểm thử chồng lặp, không cộng tổng). Bảo toàn sai tài khoản trước commit/startup đã xác minh trên thư mục fixture. Chưa có bộ cài 0.3.33 phát hành; đang kiểm tra tái dựng nguồn rồi push và chạy CI.

- 2026-11-14 trước push 0.3.33: TypeScript UI/server đạt; 29/29 HTTP + UI backup sau thay đổi accountReady đạt; tái dựng từ base 4aaad48 chạy hai lượt thành công, idempotent và không lệch file patch. Giữ module đồng bộ server tắt. Sẽ chạy lại toàn bộ desktop CI; chưa nhận là phát hành cho tới khi all-platform gate đạt.

- 2026-11-14 CI 43548573503: macOS kiểm thử Node phát hiện assertion đường dẫn /var và /private/var khác nhau sau canonicalize. Đã sửa kỳ vọng test dùng realpath (mã cài đặt đúng); Windows/Linux tiếp tục chạy. Site 43548604239 success gồm kiểm tra live FAQ đóng, đủ 4 placeholder và downloads.js khớp nguồn.

- 2026-11-14 CI 43548740166: Windows success; Mac đã build cả hai kiến trúc, health packaged Apple Silicon đạt, đang upload; Linux packaged server health đạt. Lỗi gom artifact Linux do electron-builder đặt tên x86_64.AppImage nhưng workflow dùng x64.AppImage. Đã sửa tham chiếu file đúng; vẫn giữ all-platform publish gate.

- 2026-11-14 chỉnh theo ảnh mới: Công cụ cho kỹ năng bỏ hai cột cuộn chung, dùng 2 tab full width + bộ lọc trạng thái; đoạn review gom theo skill trong details đóng mặc định. 4/4 DOM tests đạt, Electron43 fixture render 1400x1000 và 620x760 cả hai tab đạt containment/full width/no horizontal overflow; ảnh temp limix-tools-tabs-cBMzhH đã xem. Không thao tác app/dữ liệu thật. Bản đích chuyển 0.3.34 vì npm/image 0.3.33 đã public; all-platform desktop vẫn chưa phát hành.

- 2026-11-14 U155 theo yêu cầu chủ dự án: đã đọc release và mã tag OpenMausBot 0.1.155 (`8b17baf6f`), chọn 9 nhóm cải tiến cho Limix 0.3.35: room order, archive attachments, replay image context, Copilot namespaces, OpenCode Go scope, system stop cause, Claude usage, Markdown encoding/errors, read request dedupe. Không nhập toàn bộ 1.163 file thay đổi; giữ baseline cũ + patch/overlay tái dựng được. Chi tiết nguồn, phần hoãn, kiểm tra: UPSTREAM_0.1.155.md. Đặc biệt không nhập typed-reply-close-cards vì upstream đã revert trước tag dù release notes vẫn liệt kê. Cloud/account sync giữ tắt. Local TypeScript UI/server + Vite đạt; HTTP fixture room order/SSE và archive upload 2/2 đạt; engine-limit fixture 1/1 đạt. Các test branding được chỉnh kỳ vọng cho Limix. Chờ xác minh tái dựng và all-platform CI, chưa tuyên bố phát hành 0.3.35.

- 2026-11-14 U155 trước push: 22 file kiểm thử liên quan đạt, 897 passed/5 skipped (4 conditional sẵn có + 1 symlink bị Windows chặn); 2 HTTP integration tests đạt. Tái dựng base 4aaad48 + overlay/patch mới chạy hai lần: không lệch nguồn, lượt hai 0 thay đổi. Desktop CI 0.3.34 (43550459874) qua health cả 4 nền tảng nhưng publish bị chặn do feed Mac chuẩn hóa dấu cách tên DMG thành dấu gạch ngang. Sửa artifactName/copy DMG dùng LimixBot liền nhau cho 0.3.35, giữ nguyên cổng kiểm tra hash. 0.3.34 desktop chưa public; npm/image đã public. Chuẩn bị push 0.3.35 và chạy lại gate trên Mac/Linux cùng build bốn nền tảng.

- 2026-11-14: Chủ dự án yêu cầu toàn dự án dùng nhận diện Limix Bot trong commit/release/UI, không tự thêm tác giả hay Co-authored-by của nguồn tích hợp. Đã ghi ở AGENTS.md và CLAUDE.md; giữ giấy phép, NOTICE và định danh tương thích. Commit f2e5baf đã thay bằng 630974f16 (cùng mã), GitHub API contributors chỉ còn claude/leomieo; sidebar còn tên cũ là dữ liệu cache. Không xóa tác giả lịch sử không liên quan.

- 2026-11-14: Viết lại CONTRIBUTING.md riêng cho Limix Bot, kho leomieo/limix-bot, Node24/pnpm, cấu trúc nguồn, kiểm thử fixture, ràng buộc account/data, workflow bốn nền tảng và quy tắc thương hiệu. Không còn tên hay liên kết dự án nguồn. Bản chuẩn đặt trong limix/overlay/CONTRIBUTING.md để bước overlay hiện có tái dựng được; hai bản khớp. Chỉ sửa tài liệu, không cần khởi động lại vòng build desktop đang chạy.

- 2026-11-14 thương hiệu toàn dự án: sửa 9 thông điệp commit chứa tên cũ trên main, bảo toàn cây mã/tác giả/ngày commit; backup refs/limix-history-backups/branding-20261114-110104, head sau rewrite a650ba6d2. Tiếp tục chuẩn hóa tên trong phần văn bản tài liệu docs/apps-docs; không đổi code fences, URL, định danh giao thức hay thông báo pháp lý bằng thay chữ mù. Quy tắc tên sản phẩm Limix Bot áp dụng toàn dự án. Desktop CI đang chạy trên cây mã tương đương, chưa xác nhận public.

- 2026-11-14: CODE_OF_CONDUCT.md trước đây trống. Đã viết quy tắc cộng đồng Limix Bot bằng tiếng Việt: phạm vi, ứng xử, riêng tư, trách nhiệm nội dung bot, báo cáo qua email có sẵn trong SECURITY.md, xử lý theo mức độ và đề nghị xem xét lại. Không cam kết SLA hoặc khóa app tự động. Bản overlay khớp để không mất khi tái dựng. Đã kiểm tra link file nội bộ và không còn tên thương hiệu cũ trong tài liệu.

- 2026-11-14: Viết lại SECURITY.md tiếng Việt riêng Limix Bot, dùng email bảo mật hiện có; hướng dẫn báo cáo tối thiểu, che dữ liệu, phạm vi account/permissions/update/offline transfer, kiểm thử được phép và phối hợp công bố. Không tự cam kết SLA, hỗ trợ mọi bản cũ, bounty hay quyền tấn công bên thứ ba. Overlay khớp, link nội bộ hợp lệ. Chỉ thay tài liệu; không chạy lại desktop build.

- 2026-11-14: Chủ dự án yêu cầu README, Code of Conduct, Contributing, Security dùng song ngữ Anh–Việt; Apache-2.0 LICENSE giữ nguyên. Đã thêm hai phần có anchor chuyển ngôn ngữ cho cả 4 file, đồng bộ overlay và README.limix.md, ghi quy tắc AGENTS. Kiểm tra anchor, link file, code fences, thương hiệu và overlay đạt; LICENSE không thay đổi. README chuyển cách mô tả nền tảng sang gói thực sự có trên Releases, tránh hứa khả năng chưa phát hành.

- 2026-11-14 Codex sandbox mismatch reported on another computer (user confirmed). Earlier Other-provider turns succeeded. No direct access to that failing runtime; root cause unverified. Add requested/resolved sandbox types to refusal, retain fail-closed check and never start a mismatched turn. Request retry with updated CLI or working provider.

- 2026-11-15 release: 0.3.37 public, desktop run 43616981774 success across Windows/Linux/macOS ARM64 + Intel smoke + publish. Public metadata verifier passed three feeds and five stable downloads. 0.3.38 build run 43618462299 contains Mac Docker and sandbox diagnostics; publication pending. No live Zalo/Codex issue repair claimed.

- 2026-11-15 six-hour updater verified: syntax PASS, updater Vitest 10/10 (fake clock checks boundary before/at six hours), coordinator/recheck Node tests 57/57. Prepared 0.3.39 with prior 0.3.38 changes for all-platform publication. Not a six-hour wall-clock or installed app verification.
- 2026-11-15 Limix Cloud beta: tài khoản mở đúng môi trường riêng qua grant Ed25519 90 giây do Worker ký (chỉ workspace của chính tài khoản, khi running và đã định tuyến); home chỉ giữ khóa công khai, kiểm tra workspace/origin/hạn/dùng lại rồi mở một lần ghép nối. Worker sở hữu tunnel limix-cloud-beta-host, cấp lc-<uuid>.limixmedia.com cho mỗi workspace, không đụng tunnel quản trị/cổng 18799. Kiểm thử cục bộ: Worker 174/174, server 4/4, host 5/5, desktop 2/2; Docker smoke và Xeon chưa chạy.
- 2026-11-16 U160 đợt 1 (nhánh `upstream-0.1.160`, chưa phát hành): 53 bản sửa chọn lọc từ OpenMausBot 0.1.160 (khởi động engine, chuyển AI khi hết hạn mức, Antigravity dùng skill, automation "Cần xem", giới hạn đầu ra MCP, mở đúng tệp đã gửi, room, micro nhiều kênh...). Không thêm đồng tác giả. tsc UI/server qua; 50 file test liên quan: không có lỗi mới so với main (48 lỗi đều có sẵn trên main). Chưa chạy index.test/e2e/app thật. Chi tiết và các phần lớn để đợt sau: UPSTREAM_0.1.160.md. Codex C1–C4 đã gộp vào `cloud-native` (Worker 180/180, app+host 68/68).
- 2026-11-16 U160 đợt 2 (cùng nhánh): tạm dừng bot/phòng ban, Claude chỉ nạp công cụ khi cần, đính kèm mọi loại tệp và tệp nén (dán từ Explorer, bot gửi tệp nén). Giao diện riêng/ảnh đại diện/tắt nhóm công cụ chưa làm vì cần công cụ app_settings của upstream (Limix chưa có). tsc qua; 17 file test liên quan không có lỗi mới so với main.
- 2026-11-16 Limix Cloud lên Xeon: Worker cập nhật (migration 0018–0020, secret host), tài khoản limix:tqtuan được duyệt, host tạo tunnel và chạy home beta (healthy). Sửa Worker: `redirect: "error"` không được Cloudflare Workers hỗ trợ → `manual` (nhánh cloud-diag/cloud-open-fix, đã deploy từ nhánh). Lỗi app `serverConnect.open is not a function` sửa ở nhánh cloud-open-fix (chưa phát hành).
- 2026-11-16 Chủ dự án chọn làm lại bước 2 kế hoạch đám mây theo Cloud gốc (cloud.limixmedia.com, duyệt tay, có ngủ/thức), bỏ mục beta. Nhánh `cloud-native`: Admin Limix (`cloudflare/control-plane/src/limix-cloud-admin.ts`, migration 0021, Worker 176/176 test qua), host chạy home ở chế độ Cloud (host.test 5/5), Dockerfile cloud-home có gateway. Chưa build image, chưa chạy Docker/Xeon, app chưa bật. Chia việc với Codex: `limix/docs/HANDOFF_CLOUD_NATIVE.md` (Codex C1–C4, Claude K1–K2).

- 2026-11-16 Chủ dự án yêu cầu ghi chú cập nhật dùng tiếng Việt tự nhiên, đúng nghĩa và đúng chức năng. Phát hiện cửa sổ cập nhật 0.3.53 hiển thị gạch đầu dòng cũ từ 0.3.52 vì ghi chú mới chỉ có đoạn văn. Ghi chú phát hành phải chỉ chứa thay đổi của phiên bản hiện tại, danh sách tiếng Việt đặt trước tiếng Anh. Cần sửa cả nội dung release đã công bố trên GitHub.

- 2026-11-16 0.3.55: cloud.limixmedia.com was missing from ALLOWED_ORIGINS. Owner GET worked but browser POST returned origin_not_allowed, incorrectly displayed as lack of administrator rights. Fixed configuration and error reporting, deployed branch fix/cloud-owner-origin successfully (43853538169). Worker regression includes valid Leox browser POST, denied ordinary account and denied foreign origin. Windows startup previously reported a damaged installation immediately if ui/index.html was absent; it now waits up to five minutes for complete UI and referenced assets, with a cancellable loading screen. The slow extraction scenario is simulated in tests, not verified through a real installer upgrade.


### 2026-11-16 — Centralized account and Cloud administration
- Canonical admin entry: https://admin.limixmedia.com/; /admin redirects to root. VPS Nginx tested and reloaded.
- Account service authenticates the existing Limix leox account for web administration, replacing separate web-admin credentials. Passwords unchanged.
- Extension in limix/admin-center installs Cloud request/status/decision controls in the existing account admin panel. Cookie stays on the account server; owner bearer is backend-only, fixed HTTPS destination, no redirects. POST requires exact admin Origin and JSON.
- Live VPS proof: owner login 200, Cloud list 200 (leox workspace running), idempotent owner approval 200, anonymous 401, foreign Origin 403. Fixed Cloudflare 1010 by giving backend requests the explicit LimixBot-Admin user agent. 10 isolated adapter checks pass.
- Existing account plan controls are not Docker resource quotas. Custom per-account Cloud CPU/RAM/storage and a shared Cloud plan editor remain future work. Browser rendering is not automatically verified.
- Phone copy updated in English/Vietnamese to browser access; pairing instructions hidden until Cloud is reachable. 6 focused checks pass; full component suite still has the same 19 pre-existing baseline failures. Root TypeScript check passed before admin entry link update; final rerun recorded in task result.
- Legacy web-admin sessions revoked after authentication migration; existing account/app/bot sessions preserved. Final root TypeScript check, Python/JavaScript syntax checks, rebrand patch consistency and git diff check passed.

- Follow-up: old /cloud-admin page clears desktop bearer fragments then redirects to admin.limixmedia.com/#cloud; admin installer removes obsolete standalone credential assignments.

- Deployment verified: Limix Cloudflare run 43913279439 completed success on commit 0d0554ab6. Live VPS checks after rollout: legacy page 200 with fixed central redirect and fragment clearing, Leox login 200, unified Cloud list 200, owner runtime running, root panel 200 containing Cloud tab. Installer twice against isolated copied account source is idempotent, hooks unique and old admin credential assignments removed.


### 2026-11-17 — Windows Cloud Server installer beta
- User requires unattended startup before Windows sign-in. Docker Desktop logon startup cannot meet that requirement; new beta uses dedicated LimixCloud WSL 2 Docker Engine and a noninteractive AtStartup Windows task with locally supplied Windows credentials.
- Source: deploy/windows-server-app. Native self-contained Windows x64 WinForms EXE embeds host scripts; preserves existing DPAPI host.xml token/capacity. Existing Node 24+, WSL2 and configured Docker Desktop Cloud runtime required. Not a general fresh-server installer.
- Migration saves image/volume backups, stops only labeled Cloud and explicit ingress containers, refuses populated target volumes and restarts originals on transfer failure before new-host startup. CRM untouched. Original Docker Desktop volumes retained; no automatic reverse-sync or deletion. Desktop host must not run simultaneously.
- Backend deploy/managed-beta/docker-backend.mjs routes Docker through WSL, maps compose paths and passes secrets by WSLENV instead of argv. Supervisor runs hidden, retries, holds WSL session and rotates logs. No changes to Windows Sleep/password/autologon.
- Validation: 6 isolated installer scenarios PASS, 11 Node host/backend tests PASS, .NET Release win-x64 self-contained build PASS, embedded payload PASS, GUI rendered and visually inspected. No live WSL migration/Task Scheduler registration/reboot-before-logon acceptance on Xeon yet. Beta not production ready until real acceptance.
- CI: Limix Cloud Server Installer builds downloadable Windows artifact independently of desktop releases. Credentials are not in source/binary/config; Windows receives the startup password locally through Task Scheduler registration.

- Server beta delivered: commit 9fa8a8eb7 on main; prerelease server-v0.1.0-beta.1 contains LimixServer-Setup.exe (161930782 bytes). SHA-256 AE52B8324498BDFDEB7DB36956A5CF7919B61699F76D660AFC6B0E586AAA43F3 matches GitHub asset digest. Independent Windows CI run 43915187843 completed success (mock migration tests, Node backend tests, self-contained build, payload verification, uploaded artifact). Real Xeon cutover and reboot-before-logon still require acceptance; no local Docker/tasks were modified by verification.


### 2026-11-17 — HP Z840 no-password Hyper-V Cloud installer
- User confirmed BIOS power restoration/virtualization enabled. Windows has no password but sign-in requires interaction. Setup 0.2 uses dedicated Hyper-V Linux, independent of Windows login; no autologon/password changes.
- Defaults 4 vCPU/12GB/120GB. Checks Hyper-V/switch/config and stopped host. Two-stage migration: consistent backups, prepare Linux without connectors, authenticate readiness, activate. Rollback before activation only; ambiguous activation never restarts old connectors. Original Desktop volumes and CRM preserved; unknown mounts/existing VM refused.
- 13 new isolated Hyper-V/guest tests, 6 legacy and 11 Node tests passed. Self-contained build, embedded payload, PowerShell syntax and rendered UI checked. No real migration/reboot/network acceptance on Xeon yet. Local Docker daemon unavailable and Hyper-V not enabled, so there is no live virtualization proof.

- 2026-11-17 Cloud navigation: dedicated Limix Cloud settings page and account-menu entry; removed Cloud phone destination from local sidebar while retaining local phone connection. 108 affected tests passed, 4 failures matched baseline exactly (analytics/old branding expectations); typecheck result reported separately.

- Delivered Hyper-V server prerelease server-v0.2.0-beta.1 (161943070-byte EXE; SHA256 0ed6585da48f4564a5918f09d80a7e0a24f170657379df423a283c96a254af75). GitHub asset digest verified. Windows CI 43934994718 success on 1999f1e01. Root typecheck passed for Cloud navigation 0ea93011e; desktop navigation source pushed but no new desktop version published in this task. Xeon acceptance still pending.


### 2026-11-17 — Admin center redesign and account controls
- New sidebar: customers, organizations/roles, plans, promotions/vouchers, Cloud machines, transactions, system settings, channel logs. Leox remains sole web Super Admin; organization assignment registry does not grant system or bot-data permissions.
- Validated account edit endpoint sets email/phone/plan/exact expiry/max devices; password reset revokes web, Limix Bot and Studio license sessions. Protected leox cannot be modified. Per-user device override is patched into existing account login/list/remove functions; global default stays fallback. No real customer's password changed during verification.
- Promotions: create percent-discount program/code with UTC validity and usage cap, enable/disable, grant once per active user, transaction serialization prevents over-allocation. Beta has no commercial checkout; granted vouchers do NOT automatically discount a payment. No billing/discount effect claimed.
- Per-account Cloud CPU/RAM override D1 migration0023 and owner route, host assignment resources and compose CPU/memory env overrides. Independent of account plan. Effective after updated host reconciliation, may recreate container. Old installed hosts need updating; no live Docker limits acceptance yet. Disk quota/bot-count quota NOT implemented; UI says so.
- Isolated customer/structure/bridge tests19 pass; host10 pass; Worker targeted7 pass. Installer idempotence and JavaScript/Python syntax checked. Redesigned Cloud page rendered with synthetic data and inspected; live browser UI not yet acceptance proof. Worker typecheck new implementation fixed; existing test Env ALLOWED_ORIGINS literal typing failure remains.

- Admin redesign deployed to VPS: authenticated Leox login and customer/structure/plan/Cloud list/resource GET endpoints all 200; redesigned panel sections and sidebar style present, anonymous401, foreignOrigin403, deployed device-limit getter accepts per-user override. No real customer password/plan/role/voucher modifications were performed during verification. Cloudflare workflow43938864767 status: completed/success.

- 2026-11-17: Added server setup Windows desktop startup dialog: signed Microsoft Autologon download/UI for enable/disable and separate per-user Limix Bot Run entry with existing hidden-start argument. No password handling in Limix, no automatic reboot. Real Z840 sign-in/reboot not tested.
- Verification: .NET self-contained publish PASS; 19 existing installer tests PASS; startup dialog rendered and inspected without mutations; Microsoft download Authenticode Valid/Microsoft Corporation. Built artifact Releases/LimixServer-Desktop-Startup/LimixServer-Setup.exe. Startup registry writes and actual reboot NOT_TESTED.
- 2026-11-17 release preparation 0.3.56/server 0.2.1 beta: root app/server TypeScript checks PASS; UI tests 114 PASS after correcting four obsolete branding/analytics expectations; admin 19 PASS, installer 19 PASS, managed host/backend 13 PASS. Worker typecheck PASS after fixture binding type alignment; cloud admin 2 PASS. Release notes explicitly disclose role/voucher/quota and physical reboot limitations.
- Release locale check: refreshed six reviewed Vietnamese Cloud phone source hashes and removed six stale translations from other locales for English fallback; locale validation now PASS. Electron syntax 447 modules PASS. Cloud owner resource tests 5 PASS.
- Locale follow-up: dedicated Cloud section source hash refreshed as well; full locale command exit 0 verified.

- 2026-11-17 preparing 0.3.57/server 0.2.2: owner requested active-agent native tools first and automatic Cloud runtime updates. Replaced forced image-provider instructions in source/overlay; native image tool names pass connector guard. Added six-hour stable-release image discovery, fixed registry identity, per-home idle handshake, volume snapshots, persistent pending journal, unhealthy-start rollback and failure quarantine. Added managed image build/smoke/publish workflow and installer payload/seed integration. Physical Xeon updates and live Antigravity native image generation NOT_TESTED. Desktop 0.3.56 publication blocked by GitHub macOS runner capacity; Windows/Linux builds passed; superseded by 0.3.57.
- 0.3.57 checks: 23 updater/host/backend mock tests PASS, 19 server installer fixture tests PASS, 61 image-routing and settings tests PASS; self-contained server 0.2.2 beta build PASS. Added real isolated Docker smoke for image update and snapshot rollback to managed image CI; not yet run locally (Docker daemon unavailable).
- Updater follow-up: pin the current running image before deferring busy homes, so reconciliation cannot revert a manually installed newer runtime while waiting for idle.
- Managed runtime real smoke first run exposed fixture version 0.0.1 being correctly rejected by downgrade protection against installed 0.3.57. Corrected fixture target versions to 99.0.x; production update logic unchanged. Existing two-home isolation/recreation smoke passed on CI.
- Fixture unhealthy target also carries its distinct increasing version label, ensuring rollback smoke reaches the failed-health path rather than downgrade rejection.
- 2026-11-17 owner requested removing privileged login disclosure: updated published GitHub release bodies v0.3.53/v0.3.54/v0.3.55 with verified PATCH responses; replaced login name in Cloud redirect help and admin UI labels with administrator role wording. Authentication identities/guards unchanged; author credits retained. Added public administrator identity rule.

- 2026-11-17 commercial publishing rule: owner requested removing internal administration content entirely from public notes. Rewrote published 0.3.53/0.3.54/0.3.55 bilingual bodies to customer-facing behavior and verified API responses. Internal admin account/privilege/session/approval descriptions removed; authorization code unchanged.
- 2026-11-17 server 0.2.3 beta: custom-painted dark buttons preserve light text in disabled/busy, hover, pressed and focused states; dark inputs in both setup windows. Built self-contained installer and inspected --preview-disabled screenshot; 19 installer tests PASS. Preview does not run setup or modify machine configuration.
- 2026-11-17 server 0.2.4: added opt-in Docker Desktop startup and selected running-container unless-stopped configuration. Captures prior policies before writes, verifies each update, reports partial failure; no stop/recreate/data migration. Explicitly documents app readiness/dependency and Compose persistence limits. Build and 19 existing installer fixtures PASS; real Docker policies/reboot NOT_TESTED.
- 2026-11-17 server 0.2.5: mandatory folder picker for backup/image-transfer/Hyper-V disks. Setup no longer defaults large files to ProgramData on C; creates a unique protected child directory under selected local folder. Existing installed VM/data are not automatically moved. 19 isolated installer fixtures PASS; source-disk migration on Xeon waits for actual destination path from owner.
- 2026-11-17 owner screenshot confirms Xeon Docker disk location D:\DockerData\DockerDesktopWSL. Suggested independent server root D:\DockerData (child LimixCloudServer), outside Docker internal directory. Setup pre-fills this root only if it exists; existing data relocation remains pending live server state.
- 2026-11-17 server 0.2.6: added stopped Hyper-V VM storage move, password-encrypted export/import, compatibility check/network remapping, same/newer archive version gate, missing-store startup refusal. AES-GCM multi-chunk roundtrip/wrong-password/tamper/cleanup tests PASS; 19 existing installer fixtures PASS. Physical VM move/import NOT_TESTED; no control-plane fencing, source must remain off. App 0.3.57 all four platform builds and Intel packaged smoke PASS; publication uploading assets.
- Release verification 2026-11-17: desktop run 43951885099 completed success (Windows/Linux/macOS ARM and Intel smoke), v0.3.57 public with 20 assets. Public latest.yml/latest-mac.yml/latest-linux.yml all HTTP200 and 0.3.57. Public release body replaced with reviewed customer-only bilingual notes. Managed image run 43952422461 success incl real Docker update/rollback snapshot fixture. Cloudflare run 43953610483 success. Server 0.2.6 beta asset published, SHA256 70d7043b67a95d723d1bc935143dfc99214786be2e9e14764040759258a900b9. Physical Xeon move/import and reboot remain NOT_TESTED.
- 2026-11-17 server 0.2.7: use canonical Limix Bot black/white mark with an S badge, multi-resolution ICO embedded as Windows executable icon and assigned to setup windows. Source SVG and PNG kept for review. Self-contained installer build PASS; visual icon inspected.
- Server 0.2.8 repair: MAC-neighbor IP fallback verified against reported Xeon address, richer host/container diagnostics, explicit startup phase logs, and stopped-VM recovery seed refreshing services without replacing data disks. Existing 19 fixtures PASS; recovery seed execution on Z840 NOT_TESTED. Root cause of silent old host remains unconfirmed.
- Server 0.2.9: fixed Windows PowerShell 5.1 parsing of Vietnamese scripts by normalizing all six packaged PS1 files to UTF-8 BOM and parsing every staged script during build. Build PASS under powershell.exe; archive BOM verification 6/6 PASS. Previous repair script failed at parse time before executing.
- Server 0.2.10: fixed storage dialog black text by explicit theme foreground and custom-painted labels; busy state disables only interactive fields rather than the whole panel. Added title, larger resizable window and busy preview. Built and inspected actual --preview-storage-busy screenshot; text/status readable without running storage operations.
- Server 0.2.11 Vietnamese output fix: explicitly align C# stdin/stdout/stderr UTF-8 with PowerShell console input/output for storage, control and repair; Docker process output decoding UTF-8. Added --verify-encoding; executed actual Windows PowerShell roundtrip of Vietnamese text through all three redirected streams PASS. GUI dark-label fix retained. User screenshot reports storage move success but D paths/2-of-2 after move await verification.
- Server 0.2.12: fixed startup status visibility with fixed bottom panel, separate Limix startup/Windows autologon configuration states, refresh button and refresh on activation. Increased resizable window; inspected real preview screenshot with footer visible. Registry configuration is not reboot acceptance.
