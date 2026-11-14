Limix Bot 0.3.35 — Windows, macOS Apple Silicon, macOS Intel và Linux x64.

Cải tiến chat và các nhà cung cấp AI:

- Kéo phòng chat để sắp xếp trong thanh bên; hỗ trợ Alt+↑/↓, lưu thứ tự và đồng bộ giữa các cửa sổ.
- Đính kèm file nén ZIP, TAR/GZ, 7z… trong chat dưới dạng tệp; ứng dụng không tự giải nén.
- Đánh dấu ảnh được gửi lại từ lịch sử để AI phân biệt ảnh cũ với yêu cầu mới.
- Khôi phục hiển thị mức dùng Claude theo chu kỳ 5 giờ và tuần; tôn trọng cấu hình tắt đọc mức dùng.
- Sửa lỗi tên MCP dành riêng của Copilot và giới hạn OpenCode Go làm ảnh hưởng nhầm tới model miễn phí.
- Sửa phân biệt bot bị hệ thống dừng với người dùng chủ động dừng; tránh gửi lặp yêu cầu đánh dấu đã đọc.
- Mở xem trước Markdown Windows-1252 và hiển thị lý do server từ chối tệp rõ hơn.

Cloud và đồng bộ tài khoản vẫn tắt.

Bao gồm các cải tiến từ 0.3.34:

- Thêm **Chuyển máy Offline**: xuất file có mật khẩu, nhập lại trên máy mới. Giữ bot, lịch sử văn bản, bộ nhớ và skills; bỏ media/tệp đính kèm. Chỉ tài khoản Limix đã xuất file mới được nhập lại, và chỉ nhập vào phiên bản bằng hoặc mới hơn bản đã xuất; xem trước, xác nhận thay thế và khởi động lại. Tài khoản AI/kết nối cần đăng nhập lại; ổ đĩa máy ảo không nằm trong file.
- Đồng bộ dữ liệu theo tài khoản được phát triển dưới dạng module ẩn và tiếp tục tắt vì chưa có server. Chưa tự tải dữ liệu khách lên mạng.
- Phân biệt **Kho kỹ năng Limix** trên GitHub và **Kỹ năng trên máy**. Gán skills tại cài đặt riêng của bot; bỏ điều khiển trùng ở màn hình chung.
- Sửa tải skill khi danh mục và vị trí skills/quarantine chưa đồng nhất, vẫn kiểm tra SHA-256 và giữ cảnh báo rủi ro.
- Chuẩn hóa các chỉ dẫn kỹ thuật đi kèm sang tiếng Anh; giao diện và mô tả dành cho người dùng giữ tiếng Việt. Không phải kết quả đo tăng độ chính xác mô hình.
- Trang tải limixmedia.com nhận diện các file đã phát hành; FAQ cấu hình máy mặc định đóng.

Bản cài chưa có chứng thư ký số của nhà phát hành. macOS chưa được Apple notarize; việc macOS chấp nhận mở app/cấp quyền Accessibility, Screen Recording và cập nhật tự động cần kiểm thử riêng. Build/server smoke trên CI không thay thế kiểm thử GUI và tác vụ Bot thật trên máy khách. Cài công cụ tự động trong hộp Công cụ cho kỹ năng hiện hỗ trợ Windows; trên macOS/Linux dùng công cụ đã có hoặc tự cài trước.

- Thay xác nhận đăng xuất kiểu hệ điều hành bằng hộp thoại theo giao diện app, có trạng thái đang xử lý và lỗi.
- Công cụ CLI khai báo cài global (ví dụ agent-desktop) dùng thư mục công cụ riêng của Limix Bot; thư viện của dự án được giải thích trước khi người dùng bấm chọn thư mục.

- Thiết kế lại Công cụ cho kỹ năng: hai tab toàn chiều ngang, bộ lọc trạng thái, gom hướng dẫn thủ công theo skill và thu gọn mặc định; không còn cột trái trống khi cuộn.
