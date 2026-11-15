# Bàn giao: Limix Cloud theo kiểu Cloud gốc của MausBot (16/11/2026)

Nhánh: `cloud-native` (chưa vào `main`; đẩy lên `main` là tự phát hành, nên chỉ gộp khi chủ dự án nói "phát hành").

## Quyết định của chủ dự án (16/11)

- Làm lại bước 2 của "Kế hoạch đám mây" (MODULE_LIMIX_PLANS.md): dùng giao diện Cloud có sẵn trong code gốc
  (Settings → Limix Bot Cloud, "My Cloud" trong danh sách máy chủ, tự chuyển bot lên mây, ngủ/thức), trỏ về máy Xeon.
  Bỏ mục beta "Bot chạy trên Cloud (beta)".
- Chưa thu tiền: khách bấm **Đăng ký dùng thử**, chủ dự án bấm **Duyệt**.
- Làm ngủ/thức trong đợt này.
- Địa chỉ Admin: **https://cloud.limixmedia.com** (cùng Worker `limix-control-plane`, thêm custom domain).

## Kiến trúc (3 bên, docs/cloud-pro.md)

1. **Máy khách (home)**: image `cloud-home` của repo, chạy ở chế độ Cloud (`OMB_CLOUD_ROLE=home`...). Mỗi khách một
   container trên Xeon, volume riêng `cloud`, alias `home-<workspace id>` trên mạng `limix-managed-edge`.
   Caddy của home nghe :8080, chỉ trả lời cho địa chỉ của chính nó `https://lc-<uuid không gạch>.limixmedia.com`.
2. **Admin Limix** (MausBot giữ kín Admin của họ, nên tự viết): `cloudflare/control-plane/src/limix-cloud-admin.ts`.
   - `POST /api/cloud/desktop/limix-token`: đổi đăng nhập tài khoản Limix (Bearer `limix.<máy>.<token>`) lấy token
     thiết bị `omc_…` (90 ngày). Không có mã email.
   - `GET/DELETE /api/cloud/desktop/session`: đúng hợp đồng v1 (`entitlement`, `cloud{state,origin,setup,...}`), thêm
     trường Limix `limixTrial: none|pending|approved|declined`.
   - `POST /api/cloud/desktop/trial`: khách xin dùng thử (bảng `limix_cloud_requests`).
   - `POST /api/cloud/desktop/pairing`: Worker ký HMAC rồi gọi `POST <home>/api/cloud/pairing`, trả mã ghép nối.
   - `moved`, `kept`, `move-status`, `moved-to`, `export` (409), `GET /api/public/config`.
   - Bí mật ký của từng home: `HMAC-SHA256(LIMIX_BETA_HOST_TOKEN, "limix-cloud-bootstrap-v1:" + workspaceId)` base64url.
     Worker và host tự tính, không lưu ở đâu.
   - Duyệt = có hàng trong `managed_cloud_beta`. Lần đọc session kế tiếp tự tạo workspace.
   - Tunnel ingress giờ trỏ `http://home-<id>:8080` (trước là `edge-<id>`).
3. **App**: `electron/cloud-account.mjs` và các module `cloud-*`. Đang tắt bằng `LIMIX_CLOUD_ENABLED=false`.

## Đã xong trên nhánh

- Admin + migration `0021_limix_cloud_admin.sql` + test `test/limix-cloud-admin.test.ts` (toàn bộ 176 test Worker qua).
- Host (`deploy/managed-beta/host.mjs`): chạy home ở chế độ Cloud, truyền `LIMIX_HOME_ID/ORIGIN/SECRET`, chờ có địa chỉ
  mới khởi động, `--remove-orphans` xóa container edge cũ. `compose.yaml` viết lại; `edge.mjs` đã bỏ. `host.test.mjs` qua.
- `Dockerfile` target `cloud-home` chép thêm gateway Telegram/Zalo; `server/cloud-home-start.ts` cho phép
  `LIMIX_GATEWAY_SIDECAR`. `deploy/managed-beta/Dockerfile` dựng trên `limix-cloud-home:beta`.

## Chia việc

### Codex (cần Docker thật, máy Xeon Windows, thư mục `D:\limix-bot`)

Làm trên nhánh `cloud-native-codex` tách từ `cloud-native`; không đẩy `main`.

- **C1. Dựng image và chạy thử một home**
  ```powershell
  git fetch; git checkout cloud-native
  docker build --target cloud-home --build-arg "CLOUD_HOME_ENGINES=@anthropic-ai/claude-code @openai/codex" -t limix-cloud-home:beta .
  docker build -f deploy/managed-beta/Dockerfile -t limix-managed-home:beta .
  ```
  Kiểm tra: launcher không báo `codeTrustProblem`; `/api/health` trên :8080 trả `openmausbot`; log có gateway Limix chạy;
  bot box báo `off`/`userns-refused` là chấp nhận được (ghi lại). Nếu Docker Desktop cần thêm quyền (capability), ghi rõ lý do.
- **C2. Viết lại `deploy/managed-beta/smoke.mjs`** cho chế độ Cloud: hai home giả lập; gửi `POST /api/cloud/pairing`
  có chữ ký (dùng `homeBootstrapSecret` của host.mjs) tới :8080 của từng home với header `Host` đúng địa chỉ của nó;
  kiểm tra: chữ ký của A bị B từ chối, mã ghép nối của A không dùng được ở B, phiên của A bị B từ chối, khóa API và
  `~/.codex` tách biệt, dữ liệu còn sau khi tạo lại container. Bỏ phần grant Ed25519 cũ.
- **C3. Ngủ/thức** (docs/cloud-pro.md "Sleeping homes"): Admin đọc `GET <home>/api/cloud/power` (ký như pairing),
  làm bắt tay ngủ; host tạm dừng/khởi động lại container theo lệnh của Worker (thêm trường vào
  `/v1/managed-cloud/host/assignments`). Session gửi `cloud.power`. Thức khi có yêu cầu tới (tin Telegram/Zalo đến qua
  gateway trong home, nên cần xem gateway có giữ home thức không — ghi rõ kết luận).
- **C4. Trang duyệt khách**: chỉ tài khoản chủ dự án (`limix:tqtuan`) thấy; liệt kê `limix_cloud_requests` đang chờ,
  nút Duyệt (thêm vào `managed_cloud_beta`, đặt `decision='approved'`) và Từ chối/Thu hồi. Có thể là route trong Worker
  trả trang HTML đơn giản, đăng nhập bằng token Limix như desktop.

### Claude (không cần Docker)

- **K1. App**: bật `LIMIX_CLOUD_ENABLED`, `CLOUD_ORIGIN = https://cloud.limixmedia.com`, tự đăng nhập Cloud bằng tài
  khoản Limix (gọi `limix-token`), ẩn mua/thanh toán, thay bằng **Đăng ký dùng thử**; bỏ mục beta và IPC
  `limix-account:managed-beta*`.
- **K2.** Đồng bộ overlay/patch của `limix/rebrand.py`, kiểm thử, phát hành khi chủ dự án đồng ý.

## Lưu ý vận hành

- Khi deploy Worker từ nhánh này, home beta cũ (container `edge`) ngừng truy cập được từ ngoài cho tới khi host chạy
  bản mới. Volume cũ `limix-home-<id>_data` được giữ nguyên.
- Đừng chạy workflow "Limix Cloudflare" từ `main` trước khi gộp: `main` còn lỗi `redirect: "error"` (đã sửa ở nhánh).
- Không bao giờ in hoặc ghi `LIMIX_BETA_HOST_TOKEN` hay bí mật của home ra log.
