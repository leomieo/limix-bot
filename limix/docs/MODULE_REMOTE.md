# MODULE_REMOTE.md — Dùng Limix Bot từ điện thoại / máy khác, từ bất kỳ đâu (mốc R1)

**Trạng thái: MỚI LẬP KẾ HOẠCH (2026-11-12), chưa viết mã.** Không dính Limix Cloud (máy ảo trả tiền): chỉ phần "đường hầm" cho thiết bị đã ghép nối.

## Hiện có (không cần làm gì)
- Ghép nối cùng Wi-Fi (địa chỉ web của máy + mã ghép nối) và qua Tailscale. Điện thoại dùng bằng trình duyệt; chưa có app điện thoại riêng.
- Dòng "ở bất kỳ đâu qua Limix Bot" trong hộp thoại ghép nối hiện CHƯA có dịch vụ phía sau (do đổi thương hiệu). Việc sửa chữ là việc nhỏ.

## Quyết định của chủ dự án (2026-11-12)
- Tên miền `limixmedia.com` đã nằm trên Cloudflare; email gửi mã `noreply@limixmedia.com` (Zoho).
- Dùng CHUNG tài khoản Limix Studio (tiktok.limixmedia.com); bỏ riêng phần máy tính đám mây (Limix Cloud).

## Thiết kế đề xuất
1. **Worker "control plane"** (`cloudflare/control-plane/`, ~5.700 dòng, Better Auth + D1) đổi sang **xác thực bằng token tài khoản Limix**: Worker gọi máy chủ tài khoản (cùng API `/api/limixbot/validate`) thay cho đăng nhập OTP của Better Auth. Email vẫn do máy chủ tài khoản gửi (Zoho) → bỏ binding EMAIL của Cloudflare.
2. Mỗi máy 1 **Cloudflare Tunnel** do Worker tạo (đường hầm chỉ trỏ vào cổng gateway 127.0.0.1:8812, có sẵn trong mã gốc), hostname DẠNG MỘT CẤP: `<mã-ngẫu-nhiên>.limixmedia.com` (chứng chỉ miễn phí của Cloudflare chỉ phủ một cấp; `a.b.limixmedia.com` cần gói trả phí).
3. **Worker chạy ở** `accounts.limixmedia.com` (hoặc tên khác) — KHÔNG đụng `tiktok.limixmedia.com`.
4. App: `electron/desktop-companion-client.mjs` chỉ chấp nhận hậu tố `openmausbot.com`, `mausbot.si` → thêm `limixmedia.com`; bật lại phần đăng nhập đám mây ở mức tối thiểu (chỉ đường hầm, không gói/máy ảo).
5. Giữ nguyên bước GHÉP NỐI bằng mã: người lạ biết địa chỉ đường hầm vẫn không vào được.

## Việc phải làm (thứ tự)
1. Soát cổng vào (gateway 8812) + thử xâm nhập (không tài khoản, tài khoản khác, token hết hạn).
2. Viết bộ xác thực mới cho Worker (token Limix) + test; bỏ OTP/Better Auth.
3. Đổi cấu hình `wrangler.jsonc` (tên, miền, ID) và đổi thương hiệu Worker.
4. App: hậu tố hostname, bật lối vào đường hầm, sửa chữ hộp thoại.
5. Chủ dự án tạo token API Cloudflare, dán vào bí mật của Worker (KHÔNG gửi cho Claude); triển khai; thử với 1 điện thoại thật.
6. Phát hành (cần chủ dự án cho phép đẩy GitHub).

## Cloudflare: cần từ chủ dự án
- Account ID, Zone ID của `limixmedia.com`.
- Token API tùy chỉnh: Account → Cloudflare Tunnel: Edit; Zone → DNS: Edit (chỉ zone limixmedia.com); Account → Account Settings: Read.
- Gói Free: ~200 bản ghi DNS/zone (mỗi máy 1 bản ghi) → tối đa ~200 máy dùng đường hầm; vượt thì nâng Pro hoặc dùng zone phụ.

## Rủi ro
- Mỗi khách có một địa chỉ công khai trỏ vào máy: an toàn nhờ bước ghép nối + xác thực cổng; cần soát/thử riêng trước khi bán.
- Zone `limixmedia.com` đang chạy Limix Studio: thêm bản ghi DNS tự động của đường hầm vào CÙNG zone → token phải hẹp quyền, và Worker không được xóa bản ghi không do nó tạo.
- Ước lượng: vài ngày làm việc; chưa thử được trên Cloudflare thật từ máy Claude.

## Kết quả soát bước 1 (cổng vào)
- `companion-origin-gateway.mjs` (cổng 8812) chỉ chuyển tiếp HTTP/WebSocket, KHÔNG tự xác thực.
- Bảo vệ nằm ở máy chủ nội bộ (server/index.ts): `/api/pair` đổi mã ghép nối dùng 1 lần (có khoá khi nhập sai), mọi route khác qua `resolveRequestAuth` (cookie/token phiên). Chưa có phiên → bị từ chối 401.
- Chưa thử xâm nhập thực tế; làm khi bắt đầu R1.
- Cloudflare Account ID: e2c5f1d87da45803ba77f9eb676ec3ed · Zone ID (limixmedia.com): b6ded94cfef973f6dbb5e480d7dde361 (không phải bí mật).
