# Limix Cloud nội bộ trên Windows

Mỗi tài khoản được duyệt có một Limix Server chạy nền, gateway nhắn tin, mạng Docker và volume riêng. Desktop ảo cho bot là tài nguyên riêng. Worker điều phối ở accounts.limixmedia.com dùng chung xác thực Limix hiện tại. Máy Xeon chủ động hỏi Worker mỗi 30 giây. Phiên bản này dành cho một máy chủ vận hành.

## Chuẩn bị một lần

1. Trên Xeon, dùng Docker Linux và Node 24.14 trở lên. Tại thư mục gốc của bản mã này, build image có CLI rồi chạy kiểm thử với hai tài khoản giả lập.

   ```powershell
   docker build --target server --build-arg "ENGINES=@anthropic-ai/claude-code @openai/codex" -t limix-managed-base:beta .
   docker build -f deploy/managed-beta/Dockerfile -t limix-managed-home:beta .
   $env:LIMIX_HOME_IMAGE = 'limix-managed-home:beta'
   node deploy/managed-beta/smoke.mjs
   ```

2. Trên Xeon, tạo khóa host. Lệnh dưới sinh 32 byte ngẫu nhiên, lưu bằng DPAPI của người dùng đang vận hành Docker Desktop và chép khóa vào clipboard; khóa không hiện trên màn hình.

   ```powershell
   .\deploy\managed-beta\host.ps1 -Action Configure -Capacity 1 -Generate
   ```

   Dán khóa vào secret GitHub `LIMIX_BETA_HOST_TOKEN` của repository, rồi chạy workflow **Limix Cloudflare**. Workflow áp dụng migration 0018 đến 0020 và đặt secret Worker cùng tên. Đã có khóa từ trước thì bỏ `-Generate` và nhập vào ô ẩn.

3. Quản trị viên thêm tài khoản thử nghiệm vào D1 bằng câu lệnh bên dưới, thay tên mẫu bằng tên đăng nhập Limix đã xác minh, viết thường.

   ```sql
   INSERT INTO managed_cloud_beta(principal) VALUES ('limix:beta-user')
     ON CONFLICT(principal) DO NOTHING;
   ```

4. Khởi chạy trên Xeon bằng `.\deploy\managed-beta\host.ps1 -Action Run`. Cho Docker Desktop khởi động khi đăng nhập Windows. Để tự chạy bộ điều phối, tạo tác vụ Task Scheduler lúc người vận hành đăng nhập, chạy PowerShell với `-NoProfile -File "<đường dẫn đầy đủ tới host.ps1>" -Action Run` dưới chính tài khoản Windows đã cấu hình. Docker tự khởi động lại container khi engine hoạt động trở lại. Khởi động lại khi Windows chưa đăng nhập cần được thử riêng trên máy triển khai.

5. Trên bản desktop chứa thay đổi này, tài khoản được duyệt mở menu tài khoản → **Bot chạy trên Cloud (beta)** → **Yêu cầu khởi tạo**. Bấm mục đó lần nữa để đọc trạng thái. Khi trạng thái là **Đang chạy · bấm để mở**, bấm lần nữa: cửa sổ chuyển sang môi trường Cloud của đúng tài khoản đó và môi trường được thêm vào danh sách Máy chủ. Mỗi môi trường giới hạn 2 CPU và 4 GiB cho tiến trình chính; mặc định chỉ cấp một môi trường đồng thời. CLI được cài trong image. Khách cần đăng nhập nhà cung cấp riêng bên trong môi trường của mình. Image trên cài sẵn Codex, Claude Code và runtime Antigravity ACP chính thức. Trong môi trường Cloud đã ghép nối, mở Cài đặt → AI để đăng nhập hoặc thêm nhà cung cấp bằng khóa API. Khóa đã nhập và phiên còn hiệu lực được giữ trên volume riêng của tài khoản qua các lần tạo lại container. Phiên trên laptop chưa được tự động chuyển lên Cloud. Mất volume cần bản sao lưu riêng để khôi phục.

## Địa chỉ truy cập và đăng nhập

Worker tự tạo một Cloudflare Tunnel riêng tên `limix-cloud-beta-host` và cấp cho mỗi workspace một địa chỉ `https://lc-<UUID không dấu gạch>.limixmedia.com`. Bộ điều phối trên Xeon lấy token connector từ Worker, tạo mạng Docker `limix-managed-edge` và chạy container `limix-managed-tunnel` (cloudflared). Mỗi địa chỉ chỉ dẫn tới container edge của đúng workspace qua alias `edge-<UUID>`. Container chính của tài khoản không nằm trên mạng chung này. Tunnel quản trị hiện có và cổng 18799 không bị thay đổi.

Khi khách bấm mở, Worker kiểm tra phiên Limix, tài khoản đã được duyệt, workspace đang chạy và địa chỉ đã định tuyến, rồi ký một grant Ed25519 sống 90 giây ghi workspace, tài khoản và địa chỉ. Desktop gửi grant tới chính địa chỉ đó. Limix Server trong workspace chỉ giữ khóa công khai; nó kiểm tra chữ ký, workspace, địa chỉ nhận yêu cầu, thời hạn và việc dùng lại, rồi mở một lần ghép nối 120 giây. Grant của tài khoản A bị môi trường của B từ chối, và phiên đã ghép nối ở A không dùng được ở B.

## Kiểm tra môi trường của một tài khoản trên máy chủ

Lấy UUID workspace của tài khoản từ D1. Trên Xeon, dùng `docker compose -f deploy/managed-beta/compose.yaml -p limix-home-<UUID> port edge 8080` để xem cổng ghép nối trên loopback. Lệnh Compose cần biến LIMIX_HOME_IMAGE như ở trên. Cổng này chuyển yêu cầu qua Unix socket xác thực của Limix. Mỗi tài khoản có một cổng và kho phiên riêng. Không chuyển tiếp cổng API quản trị nội bộ 8799. Ghép nối qua mã dùng một lần theo quy trình server của Limix. Smoke test `node deploy/managed-beta/smoke.mjs` còn thử grant chéo giữa hai môi trường giả lập.

Nếu thu hồi thử nghiệm, xóa hàng enrollment của tài khoản. Sau lần đối soát thành công kế tiếp, host dừng các dịch vụ của tài khoản và giữ volume. Dừng bộ điều phối hoặc mất kết nối control plane sẽ giữ nguyên các dịch vụ đang chạy. Trạng thái running kiểm tra HTTP của Limix Server và gateway; cần thử gửi/nhận tin và đăng nhập từng nhà cung cấp để xác nhận hoạt động thực tế.
