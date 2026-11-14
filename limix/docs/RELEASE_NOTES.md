Limix Bot 0.3.39 — Windows, macOS Apple Silicon / Intel, Linux x64.

## Tiếng Việt

- Tự kiểm tra cập nhật mỗi 6 giờ khi ứng dụng đang chạy, trên Windows/macOS/Linux. Vẫn kiểm tra sau khi mở app khoảng 15 giây và hỗ trợ kiểm tra thủ công.

- Mac: thêm nút Cài Docker trong Công cụ cho kỹ năng. Tải DMG chính thức theo kiến trúc app Intel/Apple Silicon, kiểm tra bằng hdiutil và mở bộ cài. Người dùng kéo Docker vào Applications, mở Docker rồi Quét máy để xác nhận. Nhận diện Docker trong /Applications, ~/Applications và ~/.docker/bin. Các công cụ khác trên Mac vẫn chưa có trình cài tự động.

- Thêm nhận/gửi ảnh, video, âm thanh và tài liệu cho Telegram và Discord.
- Thêm tùy chỉnh nhận/gửi media, loại tệp, dung lượng và số tệp cho từng kết nối (tối đa tổng 10 MB / 4 tệp mỗi tin).
- Zalo Bot nhận ảnh và thoại; gửi ảnh và thoại AAC trong chat riêng khi có địa chỉ HTTPS công khai cho media.
- Thêm Facebook Fanpage qua Messenger Platform: Page token, xác thực webhook và phản hồi văn bản/media. Cần tự cấu hình HTTPS, quyền Page và App Review. Facebook cá nhân chưa hỗ trợ.
- Kiểm tra quyền trước khi tải tệp, giới hạn nguồn tải và báo kết quả gửi từng phần. Khả năng hiểu hoặc tạo media phụ thuộc AI/công cụ của bot.

Đây là bản để kiểm thử tính năng kết nối mới. Đã kiểm thử cục bộ với nền tảng/AI giả lập và máy chủ tách biệt; chưa xác minh gửi nhận bằng tài khoản nền tảng thật. Không tự cấu hình server HTTPS. Cloud đồng bộ tài khoản tiếp tục tắt.

## English

- Check for updates automatically every six hours while the app is running on Windows/macOS/Linux. Keep the startup check after about 15 seconds and manual checks.

- Mac: add Install Docker to skill tools. Download the official DMG for the app architecture (Intel/Apple Silicon), verify it with hdiutil and open the installer. Drag Docker into Applications, launch Docker and scan again. Detect Docker in standard app and CLI locations. Other Mac tools still require manual installation.

- Receive and send images, video, audio and documents through Telegram and Discord.
- Configure media directions, allowed types, size and count for each connection (10 MB combined / four files per message).
- Zalo Bot receives images and voice; sends images and private AAC voice with a configured public HTTPS media endpoint.
- Add Facebook Page setup, signed Messenger webhooks and text/media replies. Requires HTTPS routing, Page permissions and App Review. Personal Facebook accounts remain unsupported.
- Authorize before downloading, restrict download origins and report partial sends. Media understanding and generation depend on the bot's AI/tools.

New integrations have isolated mock-provider and server verification; live platform delivery remains unverified. HTTPS infrastructure is user-managed. Account cloud sync remains disabled. Desktop installers are unsigned; macOS is not notarized.
