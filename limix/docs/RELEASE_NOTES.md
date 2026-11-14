Limix Bot 0.3.40 — Windows, macOS Apple Silicon / Intel, Linux x64.

## Tiếng Việt

- Hiển thị Tạo ảnh trong Cài đặt → AI, kể cả giao diện đơn giản.
- Custom hỗ trợ Responses API với công cụ image_generation, bên cạnh Images API. Thêm lựa chọn GPT-6.1 Sol, GPT-6 Astra và nhập model tùy chỉnh; endpoint phải hỗ trợ model và công cụ tương ứng.
- Thêm tùy chọn header local-image-extension cho gateway yêu cầu nó. Chỉ gửi tới endpoint Responses tùy chỉnh đã cấu hình.
- Dùng lại kết nối API đã lưu: sao chép địa chỉ/khóa trong máy chủ, không trả khóa ra giao diện. Chọn giao thức và model sau khi nhập; bỏ nhà cung cấp dự phòng để tránh tự chuyển ngoài ý muốn. Khóa không tự đồng bộ khi kết nối gốc thay đổi.
- Chỉ báo có ảnh khi API trả kết quả hoàn tất và dữ liệu ảnh hợp lệ. Nếu API chỉ trả chữ hoặc báo lỗi, không coi đó là ảnh thành công.

Đã kiểm thử bằng API giả lập và máy chủ tách biệt; chưa xác minh tạo ảnh trên Xingchi thật hoặc gửi ảnh qua Zalo. Chưa hỗ trợ sửa ảnh/streaming trong adapter Responses này. Giữ nguyên giới hạn media và quyền sử dụng công cụ hiện có. Bản 0.3.39 trước đó có kiểm tra cập nhật mỗi 6 giờ và trình cài Docker cho Mac.

## English

- Show image generation under Settings → AI in Simple mode.
- Support Custom Responses API with the image_generation tool alongside Images API. Offer GPT-6.1 Sol, GPT-6 Astra and custom model IDs; the endpoint must support the selected model and tool.
- Add an optional local-image-extension header for gateways that require it, scoped to the configured Custom Responses endpoint.
- Reuse a saved API connection by copying its address/key entirely on the server. Select the protocol and model after import. Clear the backup to avoid unintended provider switching; later key changes are not synchronized.
- Accept only completed responses with valid image bytes. Text-only replies and errors are not reported as generated images.

Verified with mocked APIs and an isolated HTTP server fixture; live Xingchi generation and Zalo delivery remain unverified. Image edits/streaming are not implemented by this Responses adapter. Existing media limits and tool permission gates remain in place. Previous version 0.3.39 includes six-hour update checks and the Mac Docker installer flow.
