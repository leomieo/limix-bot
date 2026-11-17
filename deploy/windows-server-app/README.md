# Limix Cloud Server

[Tiếng Việt](#tiếng-việt) · [English](#english)

## Tiếng Việt

Limix Cloud Server chạy trong máy ảo Linux riêng trên Hyper-V. Máy ảo có thể khởi động cùng Windows trước khi người dùng đăng nhập.

1. [Tải bộ cài](https://github.com/leomieo/limix-bot/releases/tag/server-v0.3.1-beta.1) và chạy bằng tài khoản Windows đã cấu hình Cloud. Cần quyền quản trị, Windows hỗ trợ Hyper-V, kết nối Internet và đủ dung lượng ổ đĩa.
2. Mở **Cài đặt lần đầu** để kiểm tra Hyper-V, chọn tài nguyên và thư mục lưu dữ liệu. Nếu chuyển từ Cloud trên Docker Desktop, giữ Docker Desktop mở và dừng tiến trình quản lý Cloud cũ.
3. Mở **Tổng quan** để xem trạng thái và nhật ký. Thử truy cập từ một thiết bị khác trước khi đưa vào sử dụng.
4. Dùng **Dữ liệu** để đổi ổ lưu trữ hoặc xuất gói chuyển máy được mã hóa. Dừng máy Cloud trước khi chuyển. Giữ máy cũ tắt khi khởi động bản nhập trên máy mới.

Mục **Khởi động tự động** có cấu hình riêng cho bot điều khiển ứng dụng Windows và cho dịch vụ Docker Desktop. Cả hai chạy sau khi Windows đăng nhập. Microsoft Autologon yêu cầu tài khoản có mật khẩu. Bot điều khiển giao diện Windows cần phiên desktop có thể thao tác.

Đây là bản thử nghiệm. Hãy sao lưu và kiểm tra lại Cloud sau khi khởi động máy. Nếu đã có máy Cloud, dùng **Tổng quan** để kiểm tra hoặc **Khắc phục** để xử lý lỗi.

## English

Limix Cloud Server runs inside a dedicated Hyper-V Linux VM that can start with Windows before anyone signs in.

1. [Download the installer](https://github.com/leomieo/limix-bot/releases/tag/server-v0.3.1-beta.1) and run it from the Windows account configured for Cloud. Setup requires administrator permission, a Windows edition with Hyper-V, Internet access and enough disk space.
2. Open **First-time setup** to check Hyper-V and choose resources and storage. If migrating from Cloud on Docker Desktop, leave Docker Desktop running and stop the old Cloud management process.
3. Open **Overview** to check status and logs. Try connecting from another device before putting the server into use.
4. Open **Data** to move storage or export an encrypted transfer package. Stop the Cloud VM before transferring it. Keep the original VM off when starting the imported copy.

**Automatic startup** has separate settings for Windows desktop bots and Docker Desktop services. Both start after Windows sign-in. Microsoft Autologon requires an account password. Bots that operate Windows apps need an interactive desktop session.

This is a beta release. Back up your data and check Cloud after a reboot. For an existing Cloud VM, use **Overview** to check status or **Recovery** to address an issue.
