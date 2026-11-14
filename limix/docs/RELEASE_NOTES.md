Limix Bot 0.3.41 — Windows, macOS Apple Silicon / Intel, Linux x64.

## Tiếng Việt

- Tách chat cấu hình nội bộ khỏi chat của khách trên Zalo/Telegram/Discord/Facebook. Bấm tên bot mở chat nội bộ; chat kênh ngoài có nhãn riêng và không nhận lệnh cấu hình từ ô chat desktop.
- Gắn lịch sử với nền tảng, kết nối và ID người dùng. Nhóm dùng chung lịch sử của nhóm. Giữ lại lịch sử cũ, tạo ánh xạ phiên mới cho cơ chế định danh.
- Mặc định ẩn lịch sử chat kênh ngoài. Trong Cài đặt → AI, nhập mật khẩu tài khoản Limix để mở quyền xem trong 5 phút, hoặc bấm Khóa lại. Cần Internet để xác thực mật khẩu. Khóa áp dụng cho API đọc lịch sử và luồng cập nhật giao diện; tính năng tìm kiếm/xuất dữ liệu/nhật ký yêu cầu mở khóa khi có chat khách.
- Chờ khi máy chủ chưa nhận được lượt mới, chỉ thử lại khi được xác nhận chưa tiếp nhận tin; tránh gửi lặp khi mạng lỗi.

Đây là kiểm soát truy cập trong ứng dụng, chưa mã hóa lịch sử trên ổ đĩa. Đã kiểm thử máy chủ tách biệt và nền tảng/AI giả lập; chưa kiểm chứng nhập mật khẩu tài khoản thật và gửi nhận Zalo/Telegram trên bộ cài.

## English

- Separate local configuration chats from connected-channel conversations. Bot-row clicks return to the internal chat; channel transcripts have a read-only desktop composer.
- Bind channel histories to platform, connection and sender IDs. Groups retain shared group history. Preserve old history while using fresh scoped session mappings.
- Hide connected-channel history by default. Settings → AI verifies the current Limix account password online to grant five-minute review access; Lock revokes it. History APIs and UI event streams apply the visibility filter. Search, archives and activity require unlock when channel chats exist.
- Retry only explicit pre-admission busy refusals; never replay an ambiguously accepted message after network failure.

This is application access control, not disk encryption. Verified with isolated server fixtures and fake AI/platforms; live account password entry and packaged Zalo/Telegram delivery remain unverified.
