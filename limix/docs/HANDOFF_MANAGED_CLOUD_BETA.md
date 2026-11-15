# Bàn giao phát triển Limix Cloud beta

Ngày 15/11/2026. Mốc mã nguồn đã kiểm thử là `b975936e3` trên GitHub `leomieo/limix-bot`, nhánh `main`. Trong checkout Windows hiện tại, thư mục dự án là `F:\Tool tu build\Limix Bot\limix-bot-voice-vi`, nhánh làm việc là `voice-vi`, remote GitHub tên `github`. Remote `origin` ở checkout này trỏ vào bản lưu cục bộ.

## Mục tiêu của chủ dự án

Khách đăng nhập Limix, đưa bot lên máy Xeon của chủ dự án và vẫn nhận được câu trả lời qua Zalo hoặc Telegram sau khi tắt laptop. Khách chỉ cài Limix Bot. Giai đoạn thử nội bộ dùng hai Xeon E5-2680 v4, Windows 10 Pro và 64 GB RAM; máy chủ còn được dùng cho công việc hằng ngày.

Mỗi tài khoản sở hữu một môi trường chạy thường trực gồm Limix Server, gateway nhắn tin, mạng Docker, dữ liệu bot và thư mục đăng nhập AI. Các bot trong tài khoản có thể dùng kết nối AI mà chủ tài khoản chọn. Cloud Computer là desktop để bot thao tác khi công việc cần màn hình. Bộ cấp desktop theo bot và nút **Khởi động ngay** là luồng riêng.

## Điểm vào trong mã

| Thành phần | Vị trí và hành vi hiện có |
|---|---|
| Tài khoản trên desktop | `electron/limix-managed-beta.mjs`, `src/lib/limix-managed-beta.ts`. Menu tài khoản được duyệt gửi yêu cầu và đọc trạng thái. Electron main giữ thông tin xác thực. |
| Worker và D1 | `cloudflare/control-plane/src/managed-workspace.ts`, `managed-host.ts`, migration `0018` và `0019`. Phiên Limix đã xác thực xác định chủ sở hữu. Gửi lại yêu cầu trả về cùng workspace. |
| Xeon | `deploy/managed-beta/host.ps1`, `host.mjs`, `compose.yaml`, `edge.mjs`. Host hỏi Worker, giới hạn số môi trường chạy và giữ volume qua lần tạo lại. Mặc định cấp một môi trường cùng lúc. |
| Kênh và AI | `server/limix-gateway-sidecar.ts` và `limix/gateway/src/app-bridge.mjs`. Image có Codex, Claude Code và Antigravity ACP. API key nhập trong môi trường Cloud được giữ ở tài khoản tương ứng. |
| Tên miền | Control plane dùng `accounts.limixmedia.com`. Địa chỉ khách dự kiến là `bot.limixmedia.com`. Tunnel Xeon từng hiện Healthy, một replica, chưa có route trong ảnh của chủ dự án. Cổng 18799 thuộc workspace quản trị thử nghiệm. |

Quy trình dựng image, đăng ký tài khoản beta, cấu hình secret cho host, khởi động và thu hồi môi trường nằm trong [hướng dẫn vận hành](../../deploy/managed-beta/README.md). Khi sửa mã được sinh lại, cập nhật overlay hoặc patch theo quy tắc trong [AGENTS.md](../../AGENTS.md).

## Bằng chứng và giới hạn

- Hai kiểm thử bộ điều phối và bốn kiểm thử Worker/D1 đã chạy ở môi trường cục bộ với tài khoản giả lập.
- `deploy/managed-beta/smoke.mjs` chạy hai Limix Server và hai gateway thật trong Docker. Phiên ghép nối A bị B từ chối. API key giả lập của A được giữ sau khi tạo lại container và không xuất hiện ở B. Antigravity ACP hoàn tất khởi tạo, phiên bản 1.4.3.
- Trạng thái `running` chỉ xác nhận tiến trình và gateway đang đáp ứng. Chưa xác minh đăng nhập thuê bao thật, suy luận qua API tính phí, tin nhắn thật đi và về, hay tự phục hồi trên Xeon sau khi Windows khởi động lại.
- Lần đầu khách cần kết nối nhà cung cấp trong môi trường Cloud. Volume lưu phiên còn hiệu lực qua lần khởi động lại. Chưa có chuyển phiên từ laptop, sao lưu ngoài máy chủ hay kiểm thử khôi phục sau mất ổ đĩa.
- Bản bàn giao là mã nguồn. Chưa xác minh triển khai bản này lên Xeon, route HTTPS cho khách hay gói desktop phát hành cho người dùng.

## Kết nối tài khoản tới đúng môi trường (đã có mã, chờ chạy thật)

- **Địa chỉ.** Mỗi workspace có một hostname riêng `lc-<UUID không gạch>.limixmedia.com`, không dùng chung `bot.limixmedia.com`, vì ứng dụng web và cookie phiên giả định mỗi môi trường một origin. Worker sở hữu tunnel `limix-cloud-beta-host`, tạo CNAME và ingress cho từng workspace (`cloudflare/control-plane/src/managed-routing.ts`, migration `0020`). Worker không ghi đè hay xóa bản ghi DNS trỏ nơi khác. Tunnel cũ của chủ dự án và cổng 18799 giữ nguyên.
- **Xeon.** `host.mjs` lấy token connector qua `GET /v1/managed-cloud/host/tunnel`, chạy `limix-managed-tunnel` (cloudflared 2026.9.3) trên mạng `limix-managed-edge`. Edge của mỗi tài khoản có alias `edge-<UUID>`; container chính không vào mạng chung. Mỗi home nhận `OMB_PUBLIC_URL`, `LIMIX_MANAGED_WORKSPACE` và khóa công khai grant.
- **Đăng nhập.** Desktop gọi `POST /v1/managed-cloud/workspace/open` bằng phiên Limix. Worker chỉ cấp cho workspace của chính tài khoản, khi trạng thái `running` và địa chỉ đã định tuyến, một grant Ed25519 90 giây (`managed-grant.ts`). Desktop gửi grant tới `/api/limix/managed/grant` của home (`server/limix-managed-grant.ts`). Home kiểm tra chữ ký, workspace, origin nhận yêu cầu, hạn, nonce dùng một lần; chữ ký sai tính vào khóa ghép nối. Thành công thì mở một lần ghép nối 120 giây; desktop thêm môi trường vào Máy chủ và mở `/pair` như luồng kết nối máy chủ hiện có.
- **Khóa.** Seed Ed25519 suy ra từ `LIMIX_BETA_HOST_TOKEN` bằng HMAC; home chỉ có khóa công khai nên không tự ký được. Workflow Limix Cloudflare đặt secret Worker từ secret GitHub cùng tên; `host.ps1 -Action Configure -Generate` sinh khóa và chép vào clipboard.
- **Kiểm thử cục bộ.** Worker 174/174 (gồm 2 kiểm thử định tuyến + grant với Cloudflare API giả lập, DNS lạ không bị chiếm), grant phía server 4/4, host 5/5, desktop 2/2, tsc Worker và server sạch. Chưa chạy Docker smoke trong môi trường này; `smoke.mjs` đã thêm bước grant chéo A/B và phiên A bị B từ chối, cần chạy trên Xeon.

## Công việc tiếp theo

1. **Triển khai lên Xeon.** Build lại hai image, chạy `smoke.mjs`, đặt khóa host, chạy workflow Limix Cloudflare, chạy `host.ps1 -Action Run`. Xác nhận log `Tunnel connector: created` và trạng thái `running`. Trong Cloudflare, tunnel `limix-cloud-beta-host` phải Healthy.
2. **Thử một tài khoản và một kênh trên Xeon.** Đăng nhập nhà cung cấp ngay trong môi trường tài khoản A, liên kết một bot Zalo hoặc Telegram, chuyển việc nhận tin sang Xeon để tránh hai nơi cùng trả lời. Tắt laptop, gửi tin từ điện thoại. Ghi nhận thời điểm nhận và nội dung trả lời thật, bỏ thông tin riêng khi lưu bằng chứng.
3. **Kiểm tra hai khách.** A đã đăng nhập, B chưa đăng nhập. B phải được yêu cầu kết nối AI riêng. Sau khi B đăng nhập, đăng xuất A và xác nhận B vẫn trả lời. Kiểm tra cả khóa API, phiên ghép nối, lịch sử, tệp và cấu hình gateway. Dùng fixture riêng theo [hướng dẫn kiểm thử](../../docs/verification/README.md).
4. **Kiểm tra vận hành và Cloud Computer.** Khởi động lại Xeon, kiểm tra Docker, bộ điều phối, gateway và dữ liệu. Đo tài nguyên khi chủ máy làm việc. Sau đó nối nút **Khởi động ngay** và công cụ điều khiển của bot tới cùng một desktop được cấp trên Xeon.

Mốc bàn giao kế tiếp là một tin nhắn mới được trả lời qua nền tảng thật khi laptop đã tắt, cùng bằng chứng tài khoản B không dùng được phiên AI của A. Ghi riêng kết quả kiểm thử cục bộ, Xeon, nhà cung cấp và bản phát hành.
