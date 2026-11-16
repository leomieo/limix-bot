# Limix Bot 0.3.57

## Tiếng Việt

- Ưu tiên công cụ gốc được agent cung cấp trong phiên hiện tại, gồm tạo ảnh; không ép thiết lập dịch vụ ảnh riêng khi công cụ gốc có sẵn.
- Bổ sung Cloud host tự kiểm tra image mới mỗi 6 giờ, chờ máy rảnh, sao lưu dữ liệu và thử khôi phục khi khởi động bản mới thất bại.

- Đưa Limix Cloud thành mục riêng trong Cài đặt và thêm lối mở nhanh từ menu tài khoản.
- Bỏ lựa chọn kết nối điện thoại với Cloud khỏi menu của máy cục bộ; giữ kết nối điện thoại với chính máy đang dùng.
- Mở trang quản trị tập trung tại admin.limixmedia.com bằng phiên đăng nhập tài khoản chủ dự án.
- Bổ sung quản lý thông tin khách hàng, gói, hạn mức thiết bị và cấu hình CPU/RAM Cloud riêng cho từng tài khoản trên trang quản trị.

### Bộ cài server riêng
- Bộ cài server 0.2.2 beta có mục mở Microsoft Autologon và bật/tắt Limix Bot chạy nền sau đăng nhập Windows.
- Máy Cloud Linux Hyper-V có thể tự khởi động cùng Windows; bot thao tác ứng dụng Windows cần desktop đã đăng nhập và không bị khóa.

### Giới hạn đã biết
- Cấu hình CPU/RAM cần cập nhật Cloud host; chưa xác nhận áp dụng trên máy Xeon thật.
- Tổ chức/vai trò hiện là dữ liệu quản lý; chưa dùng để phân quyền truy cập dữ liệu bot. Voucher được tạo và cấp cho tài khoản, chưa tích hợp thanh toán. Chưa có hạn mức ổ đĩa hoặc số bot riêng.
- Bộ cài server cần thử khởi động lại trên máy đích để xác nhận tự đăng nhập và chạy bot; chưa có kiểm chứng reboot trên Z840.

## English

- Prefer tools exposed by the active agent, including native image generation, without forcing separate image-provider setup.
- Add six-hour Cloud runtime image checks, idle preparation, pre-update snapshots and recovery after failed startup.

- Give Limix Cloud a dedicated Settings page and a shortcut in the account menu.
- Remove Cloud phone pairing from the local computer menu while retaining pairing with the current computer.
- Open centralized administration at admin.limixmedia.com using the project owner's authenticated session.
- Add customer profile, plan, device limit and per-account Cloud CPU/RAM administration.

### Separate server installer
- Server 0.2.2 beta opens Microsoft Autologon and can enable or disable background Limix Bot startup after Windows sign-in.
- The Hyper-V Linux Cloud VM can start with Windows; Windows application automation requires an unlocked signed-in desktop.

### Known limitations
- CPU/RAM overrides require an updated Cloud host; application on the physical Xeon is not verified.
- Organizations and roles are management records, without bot data access enforcement. Vouchers can be created and assigned but are not connected to checkout. Per-account disk and bot-count quotas are not implemented.
- Server automatic sign-in and bot startup still require a reboot acceptance test on the target Z840.

### Update rollout / Triển khai tự cập nhật
Cần cập nhật bộ điều phối Cloud host một lần để có tính năng này. Chỉ image runtime Cloud được cập nhật tự động; bộ cài Windows, host scripts và hệ điều hành không được thay thế tự động. Cần đủ dung lượng để sao lưu, có gián đoạn ngắn lúc khởi động lại. Đường khôi phục mới được kiểm tra tự động; còn chờ thử trên Xeon thật.

Install the updated Cloud host once to enable automatic runtime image updates. Windows setup, host scripts and the OS do not self-update. Updates need snapshot storage and briefly restart idle homes. Physical Xeon acceptance remains outstanding.
