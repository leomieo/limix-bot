# Lớp tiếng Việt — Limix Bot Factory

*Tài liệu này chỉ dành cho giải thích và sử dụng bằng tiếng Việt. Quy trình vận hành và giới hạn quyền có hiệu lực được định nghĩa trong `SKILL.md` (English Core) và do hệ thống backend thực thi.*

## Mục đích

Dùng Limix Bot Factory để tạo **Bot Mẫu** và các Skill đi kèm từ mô tả bằng ngôn ngữ tự nhiên. Bot có thể trò chuyện với khách bằng tiếng Việt, trong khi cấu trúc kỹ thuật, tên tool và quy tắc thao tác được giữ bằng tiếng Anh.

## Cách dùng

1. Chọn Bot Mẫu phù hợp, cung cấp yêu cầu nghiệp vụ bằng tiếng Việt.
2. Kiểm tra cấu hình `BotSpec` được tạo. Mỗi BotSpec phải khai báo chính sách `skills_policy` đúng chuẩn Hybrid Skills.
3. Khi cần tạo Skill riêng, dùng `skill-init` để tạo `SKILL.md` (English Core) và `references/vi.md` (Vietnamese Layer), sau đó bổ sung nội dung chính xác cho cả hai.
4. Chạy `skill-check` để kiểm tra cấu trúc; đọc lại cả hai lớp để đối chiếu ý nghĩa và bảo mật.
5. Chỉ dùng `skill-pack` với Skill đã kiểm tra. Việc đóng gói không có nghĩa là đã cài đặt, cấp quyền hoặc triển khai bot thật.

Ví dụ yêu cầu: “Tạo bot hỗ trợ cửa hàng, giải đáp bằng tiếng Việt và chỉ xem đơn khi khách đã xác minh.” Phần hội thoại và hướng dẫn tiếng Việt nằm ở lớp tiếng Việt; tên công cụ như `orders.lookup` phải giữ nguyên.

## Giới hạn

- Không tự cấp quyền, xuất bản, cài plugin lạ hoặc lấy dữ liệu của người dùng khác.
- Chỉ dùng các công cụ/nguồn kiến thức đã được hệ thống kiểm tra quyền.
- Nếu nội dung tiếng Việt mâu thuẫn với `SKILL.md`, không tự sửa quy tắc lõi: báo lỗi và yêu cầu rà soát.
- Các lệnh kiểm tra chỉ kiểm tra cấu trúc; chất lượng bản dịch và an toàn ngữ nghĩa vẫn cần rà soát trước khi đưa lên production.
