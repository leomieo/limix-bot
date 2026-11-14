Limix Bot 0.3.42 — Windows, macOS Apple Silicon / Intel, Linux x64.

## Tiếng Việt

- Luôn cung cấp công cụ generate_image cho bot qua danh sách công cụ Limix. Khi chưa cấu hình API ảnh, công cụ trả hướng dẫn Cài đặt → AI → Tạo ảnh và không gửi yêu cầu tạo ảnh.
- Hướng bot dùng nhà cung cấp ảnh đã cấu hình. Chặn lời gọi tạo ảnh Composio trực tiếp và trong multi-execute để tránh tự chọn Gemini thay cho API người dùng muốn dùng.
- Hướng bot báo đúng lỗi cấu hình/quyền API, không suy đoán ai đã vô hiệu hóa tính năng và không gọi ảnh vẽ bằng code là ảnh siêu thực.

Đã kiểm thử bằng máy chủ tách biệt và AI/API giả lập. Chưa xác minh tạo ảnh Xingchi thật. Bản sửa này không cấp quyền tạo ảnh cho nhóm API bị server nhà cung cấp từ chối; hãy cấu hình giao thức và model được hỗ trợ trong mục Tạo ảnh.

## English

- Always expose generate_image through Limix's native tool catalog. Before setup it returns Settings → AI → Image generation instructions without sending a generation request.
- Route bots to the configured image provider. Refuse direct and multi-execute Composio image-generation calls to avoid silently choosing Gemini instead of the intended API.
- Instruct bots to report setup/provider permission errors accurately, avoid guessing who disabled a feature, and distinguish code-drawn illustrations from photorealistic generated images.

Verified with an isolated server and fake AI/API. Live Xingchi image generation remains unverified. This change cannot grant provider-side image permissions; configure the supported protocol and model in Image generation settings.
