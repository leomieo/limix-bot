# Bàn giao cho Codex: Limix Bot sau 0.3.69

Cập nhật: 2026-11-18. Người viết: Claude. Đọc cùng `AGENTS.md`, `limix/docs/CLAUDE.md`, `docs/verification/README.md`.

## Vị trí mã nguồn

- **Nguồn chính trên máy chủ dự án:** `F:\Tool tu build\Limix Bot` (chính thư mục này là kho git, nhánh `main`).
  Thư mục cũ `F:\Tool tu build\Limix Bot\limix-bot-voice-vi` **không còn**: toàn bộ (kể cả `.git`, `.agents/`) đã được
  chuyển lên `F:\Tool tu build\Limix Bot`.
- Remote `github` = `https://github.com/leomieo/limix-bot` (GitHub thật). Remote `origin` = bundle sao lưu
  `F:\Tool tu build\Limix Bot Backup\limix-bot-full-history.bundle`.
- Các thứ nằm cạnh mã nguồn nhưng **không** thuộc kho (được bỏ qua qua `.git/info/exclude`): `CLAUDE.md`,
  `PROJECT_MEMORY.md`, `HERMES_EXTRACTION.md`, `KHAO_SAT_P0.md`, `releases/`, `brand-bw/`, `limix-bot/` (bản cũ 0.2.x,
  đừng sửa), `limix-bot-teams/`, `limix-bot-templates/`, `limix-gateway/`, `limix-release-0352-publish/`,
  `openmausbot-teams-reference/`, `release-0352-baseline/`, các `*.log`, `*.bundle`.
- Nhánh chỉ có trong phiên của Claude đã được nhập vào kho dưới tên `claude-sandbox/*` (kể cả `claude-sandbox/commercial`,
  riêng tư: không đẩy lên repo công khai).
- Repo riêng tư thương mại: `leomieo/limix-agent` (nhánh `commercial`).

## Quy tắc

- Commit không có `Co-authored-by`, không nhắc tên dự án/tác giả upstream. Giữ thông báo giấy phép.
- Mỗi lần đẩy `main` (trừ thay đổi chỉ trong `limix/docs/**`, `limix/site/**`, `*.md`, hoặc commit có `[skip ci]`) sẽ tự
  phát hành theo `version` trong `package.json`: nhớ tăng version và viết `limix/docs/RELEASE_NOTES.md` song ngữ.
- Không xin/gõ mật khẩu, token. Không mua gì. Không gửi tin cho khách thật hay chuyển bot thật để thử.
- Hook pre-push chạy lint, kiểm tra locale, `file-size-ratchet`, `vocabulary` (ví dụ phải viết "the Cloud", không "your Cloud").
- Test DOM (`*.dom.test.ts`) không chạy được trong môi trường Linux không có `node:sqlite` bundling; CI chạy chúng.

## Lịch sử phát hành (0.3.61 → 0.3.69)

| Bản | Nội dung chính |
|---|---|
| 0.3.62 | Nút "Xem thêm" cho Bot mẫu và Bản mẫu Nhóm (`src/components/TemplateDetails.tsx`); menu "Chuyển sang My Cloud" nói rõ lý do bị mờ (`blocked` trong `BotMoveState`); trả lời kênh chỉ gửi câu trả lời cuối (bỏ lời báo tiến độ). |
| 0.3.63 | Một lần "chuyển cả đội" còn đang chép (copy/wait, chưa khoá máy) nhường chỗ cho chuyển từng bot (`blocksBotMoves` trong `electron/one-home-main.mjs`). |
| 0.3.64 | Trả lời kênh chỉ gửi câu trả lời **mới nhất** khi trưởng nhóm giao việc nhiều lượt (`replyText` trong `server/bot-api-host.ts`). |
| 0.3.65 | (bị huỷ, gộp vào 0.3.66) Lệnh không đọc được của chủ bot qua kênh ở Full access thì chạy luôn (`heldAtSafetyFloor(..., { ownerFull })`). |
| 0.3.66 | Cuộc trò chuyện của chủ bot (owner lane, `isLimixOwnerThread`) **luôn** chạy Full access trong `approvalModeForTurn` (`server/index.ts`). Danh sách cấm vẫn chặn. |
| 0.3.67 | (không phát hành, gộp vào 0.3.68) Đám mây cạnh bot đang chuyển; bot đã lên My Cloud liệt kê từng tên; Worker tự kiểm tra lại DNS của Cloud (`cloudflare/control-plane/src/managed-routing.ts`, đã deploy). |
| 0.3.68 | **Sửa lỗi chính chuyển bot lên Cloud**: `one-home.json` còn sót lần "chuyển cả đội" của tài khoản cũ (`limix:tqtuan`) nên mọi lần chuyển bot của tài khoản mới (`limix:leox`) nhắm sai Cloud → "My Cloud is not ready". Nay `moveTargetOrigin()` chỉ dùng Cloud của journal khi cùng tài khoản. |
| 0.3.69 | Tiến độ chuyển bot hiện trên từng bot ở thanh bên (đám mây nhấp nháy / cảnh báo + lỗi + giờ thử lại) và mục menu "Thử chuyển lên Cloud lại ngay" (`BotMoveState.moves`, `botMove.status()`); danh sách mô hình theo tài khoản: Antigravity với CLI `agy` của người dùng đọc mô hình bằng `discoverAcpModels`; ACP core đọc lại danh sách khi đổi tài khoản hoặc quá 15 phút (`followAccount` trong `server/drivers/acp/core.ts`). |

Hạ tầng phát hành: thử tách "Windows/Linux trước, macOS sau" bị GitHub từ chối tạo release (HTTP 403) nên đã **trả lại**
workflow phát hành cả ba nền tảng cùng lúc (`.github/workflows/limix-desktop.yml`). Nguyên nhân 403 chưa rõ.
Thêm workflow chỉ đọc `Limix Cloud diagnose` (`.github/workflows/limix-cloud-diagnose.yml`): in trạng thái các home (không in
tên tài khoản), routing, và 15 phút log Worker liên quan pairing.

## Trạng thái hiện tại và việc còn lại

1. **Chuyển bot lên Cloud chưa được kiểm chứng sau 0.3.68.** Trên máy người dùng, 5 bot (Ursa, Scout, Cào Link Youtube,
   Update Nhóm Mẫu, Update skills) đang ở `bot-moves.json` phase `copy`, đã thất bại 7 lần (lần cuối khi còn 0.3.66).
   Việc: sau khi người dùng cập nhật 0.3.69 và bấm "Thử chuyển lên Cloud lại ngay", đọc
   `%APPDATA%\limixbot\logs\server.log` (dòng `team move:`), chạy workflow `Limix Cloud diagnose` cùng lúc nếu vẫn lỗi.
   Cloud của tài khoản `leox` là `https://lc-dfe3ecd8218c49b2854111aa150f5cbd.limixmedia.com` (đang chạy, routed).
   `cloud-ready.json` còn trỏ `lc-ddc6…` (đã mất DNS, không còn là Cloud của ai): có thể dọn.
   `one-home.json` của tài khoản cũ vẫn còn: cân nhắc tự bỏ journal của tài khoản khác khi chưa qua bước switch.
2. **Dòng trạng thái chuyển bot (`BotMoveLine` trong `CloudSendStrip`) không hiện** trên máy người dùng dù journal có
   move `failing`. Chưa rõ vì sao (`pageOf()` trong `electron/cloud-send-main.mjs` có thể trả `null`). 0.3.69 đã thêm cách
   hiện thay thế trên thanh bên; vẫn nên tìm nguyên nhân.
3. **Chủ bot nhắn từ kênh vẫn bị hỏi duyệt** (ảnh: lệnh `Select-String` của bot "Đệ Lưu Tổng", Gemini 3.8 Flash). 0.3.66
   ép Full cho owner thread; chưa kiểm chứng. Nếu còn hỏi: kiểm tra cuộc trò chuyện đó có trong
   `DATA_DIR/limix-owner-threads.json` không (nếu không, gateway chưa gửi `x-limix-owner`).
4. **Danh sách mô hình Antigravity (Ultra)** chưa thử với `agy` thật; nếu `discoverAcpModels` không thấy option `model`
   thì xem `catalogFromAntigravityConfigOptions` trong `server/drivers/antigravity-acp.ts` để đọc theo cách đó.
5. **Lỗi ghim/bỏ ghim Zalo nguồn→đích** (người dùng nhờ bot làm qua Telegram): là việc của bot người dùng trong
   `D:\Souce\finalsource\tele-zalo-bridge`, không phải mã Limix.
6. Nợ cũ: đồng bộ `limix/patches` và overlay cho thay đổi Cloud/upstream; 2 test `server/drivers/acp/acp.test.ts` lỗi
   sẵn từ trước; Docker Cloud trên Xeon (`D:\limix-bot`) cần `git pull` khi đổi `deploy/managed-beta/host.mjs`.

## Cách kiểm tra nhanh

- `npx tsc -p tsconfig.json --noEmit` và `npx tsc -p tsconfig.server.json --noEmit` (đặt `NODE_OPTIONS=--max-old-space-size=7000`).
- `node --test electron/one-home*.node-test.mjs electron/bot-move-main.node-test.mjs electron/cloud-send.node-test.mjs`
- `npx vitest run server/bot-api-host.test.ts server/safety-floor-gate.test.ts server/drivers/acp/`
- Phát hành: xem `gh run list -w "Limix Bot Desktop"`; ba feed `releases/latest/download/latest{,-mac,-linux}.yml` phải cùng version.
