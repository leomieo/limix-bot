Limix Bot 0.3.32 — Windows, macOS Apple Silicon, macOS Intel và Linux x64.

- Thêm **Chuyển máy Offline**: xuất file có mật khẩu, nhập lại trên máy mới. Giữ bot, lịch sử văn bản, bộ nhớ và skills; bỏ media/tệp đính kèm. Chỉ nhập vào phiên bản bằng hoặc mới hơn bản đã xuất; xem trước, xác nhận thay thế và khởi động lại. Tài khoản AI/kết nối cần đăng nhập lại; ổ đĩa máy ảo không nằm trong file.
- Đồng bộ dữ liệu theo tài khoản được phát triển dưới dạng module ẩn và tiếp tục tắt vì chưa có server. Chưa tự tải dữ liệu khách lên mạng.
- Phân biệt **Kho kỹ năng Limix** trên GitHub và **Kỹ năng trên máy**. Gán skills tại cài đặt riêng của bot; bỏ điều khiển trùng ở màn hình chung.
- Sửa tải skill khi danh mục và vị trí skills/quarantine chưa đồng nhất, vẫn kiểm tra SHA-256 và giữ cảnh báo rủi ro.
- Chuẩn hóa các chỉ dẫn kỹ thuật đi kèm sang tiếng Anh; giao diện và mô tả dành cho người dùng giữ tiếng Việt. Không phải kết quả đo tăng độ chính xác mô hình.
- Trang tải limixmedia.com nhận diện các file đã phát hành; FAQ cấu hình máy mặc định đóng.

Bản cài chưa có chứng thư ký số của nhà phát hành. macOS chưa được Apple notarize; việc macOS chấp nhận mở app/cấp quyền Accessibility, Screen Recording và cập nhật tự động cần kiểm thử riêng. Build/server smoke trên CI không thay thế kiểm thử GUI và tác vụ Bot thật trên máy khách. Cài công cụ tự động trong hộp Công cụ cho kỹ năng hiện hỗ trợ Windows; trên macOS/Linux dùng công cụ đã có hoặc tự cài trước.
