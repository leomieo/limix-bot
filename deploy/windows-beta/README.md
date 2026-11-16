# Windows beta server / Máy chủ beta trên Windows

## Tiếng Việt

Chạy trên máy chủ Windows bằng PowerShell thông thường. Cần Node.js 24+, Docker Desktop đã chạy Linux containers và Tailscale. Cài Tailscale trên cả máy chủ Windows và máy dùng Limix Bot, đăng nhập vào cùng mạng riêng. Hướng dẫn chính thức tại https://tailscale.com/docs/install/windows.

```powershell
.\start.ps1 -CheckOnly
.\start.ps1
```

Mặc định dùng cơ chế `limixbot serve --tailscale`. Nếu Tailscale yêu cầu bật HTTPS, chủ tài khoản mở liên kết được in ra để bật tính năng. Nếu báo cần quyền Administrator để cấu hình Tailscale Serve trên Windows, thực hiện riêng bước cấu hình Tailscale theo tài liệu https://tailscale.com/docs/features/tailscale-serve, sau đó chạy lại Limix bằng PowerShell thông thường. Không đăng nhập tài khoản hoặc gửi mật khẩu/token qua chat.

Bộ chạy tải gói npm limixbot 0.3.47. Dữ liệu được lưu ở `%LOCALAPPDATA%/LimixBot-Server-Beta/data`, cổng server 18799 và webhook 18800. Khi tạo cấu hình mới, dùng desktop riêng cho từng bot, tối đa một desktop chạy đồng thời, mỗi desktop giới hạn 4 GiB RAM và 2 CPU. Đây là giới hạn desktop, không phải giới hạn toàn bộ máy chủ. Giữ cửa sổ mở khi thử; Ctrl+C dừng server. Chạy lại giữ cấu hình và dữ liệu beta.

Trong Limix Bot trên máy khách, chọn Kết nối tới máy chủ rồi dán liên kết ghép nối được in ra. Tạo bot thử trên máy chủ, cấu hình AI của bot và chọn máy ảo Docker trên máy chủ trong bảng Máy tính. Chuẩn bị desktop nếu được yêu cầu. Thử chụp màn hình và tạo một tệp trong thư mục làm việc của bot. Chỉ đánh dấu hoàn tất khi máy khách ghép nối được, bot dùng được AI thật và môi trường desktop trên máy chủ nhận thao tác.

`-Connection LAN` dành cho hai máy cùng mạng. `-Connection Local` dành cho kiểm tra tại chính máy chủ. `-CheckOnly` chỉ kiểm tra, không tải gói hoặc tạo dữ liệu. Chưa xác minh chạy thực tế trên máy chủ hay ghép nối hai máy qua Internet.

## English

Run in a regular PowerShell session on the server. Requires Node.js 24+, a running Docker Linux engine, and Tailscale on both devices in the same private network. The default uses the existing `limixbot serve --tailscale` flow. Complete any HTTPS enablement as the account owner. If Windows requires elevation for Tailscale Serve setup, configure Tailscale separately, then run Limix with an ordinary account.

The launcher pins npm limixbot 0.3.47, uses a separate beta data directory and ports 18799/18800, and initializes a per-bot desktop configuration with one running desktop, 4 GiB RAM and two CPUs. It preserves existing beta configuration. Ctrl+C stops the foreground server.

Use the printed pairing link in the desktop client, configure a test bot and its AI connection, then verify screenshots and file operations on the server desktop. Syntax and local read-only preflight are checked separately from live testing on the target server, with an AI provider, and across networks.
