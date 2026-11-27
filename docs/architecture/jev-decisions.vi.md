# Jev trong Limix Bot

Đối chiếu ngày 28/11/2026 với mã nguồn Limix Bot 0.3.120 và tài liệu TypeSafe.

## Khả năng của nhà cung cấp

Jev nhận trạng thái và câu hỏi có cấu trúc. Choice chọn trong danh sách, Score chấm theo các mức định nghĩa trước và Noul trả về xác suất của một nhận định. Box xử lý vùng ảnh ở chế độ thử nghiệm và cần tùy chọn riêng trên API. Dữ liệu vị trí cần được xác minh lại trên màn hình hiện tại trước khi thao tác. [Tham chiếu API](https://api.typesafe.ai/redoc) · [Thông báo về ảnh và Box](https://typesafe.ai/blog/jev-1-14)

TypeSafe công bố 0,042 USD/triệu token đầu vào, đầu ra miễn phí và hạn mức ban đầu 80 yêu cầu/giây, 100.000 token/giây. Kịch bản trong ảnh tương ứng 10 triệu token/ngày, hay 0,42 USD/ngày và 12,60 USD cho 30 ngày. Mốc 70–500 ms là kết quả do nhà cung cấp công bố. Độ trễ mà khách hàng cảm nhận còn phụ thuộc mạng, thời gian chờ và bước xử lý sau quyết định. [Giá và hạn mức](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost) · [Công bố ban đầu](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

## Luồng vận hành và phạm vi

| Nhu cầu | Cách xử lý trong Limix |
| --- | --- |
| Chọn người trả lời trong phòng Auto | Bộ định tuyến đang có gửi danh sách thành viên hợp lệ. Kết quả phải thuộc danh sách và xác suất đạt ngưỡng 0,6. Nếu thiếu điều kiện, dùng phương án dự phòng. |
| Hộp thư và gợi ý ứng dụng | Hai nơi đang dùng bộ quyết định để ưu tiên thư hoặc xếp hạng ứng dụng có thể kết nối. Trích xuất dữ liệu có đường xử lý riêng. |
| Công cụ quyết định cho bot | Máy chủ kiểm tra quyền truy cập nội bộ. Một lần gọi có thể mang tối đa tám câu hỏi cùng trạng thái. Máy chủ phân tích kiểu dữ liệu, tập phương án và xác suất trước khi trả kết quả cho bot. |
| Bot, kỹ năng, công cụ và mô hình | Plugin hướng dẫn chọn trong tập đã cấp, giữ lựa chọn mô hình của người dùng. Quyết định phân công và thực thi vẫn đi qua các chức năng hiện có của Limix. |
| CSKH và kiểm tra chất lượng | Có thể hỏi đồng thời về nhóm xử lý, mức khẩn và dữ kiện còn thiếu. Với khách báo đã thanh toán, hệ thống giao dịch của khách là nguồn xác nhận trạng thái. |
| RAG, bộ nhớ, lịch chạy | Plugin có thể đánh giá tài liệu đã lọc theo quyền, đề xuất thông tin đáng nhớ hoặc ưu tiên công việc. Các cơ chế ghi nhớ, lịch chạy và kiểm tra quyền do ứng dụng quản lý. |
| Chống lặp, nội dung chèn chỉ dẫn và hành động nhạy cảm | Điểm rủi ro dùng để yêu cầu kiểm tra thêm. Giới hạn bước, kiểm tra quyền và xác nhận hành động vẫn do mã thực thi đảm nhiệm. Lưu kết quả quyết định không thay thế chống lặp thao tác ghi. |
| Trình duyệt, desktop | Vẫn dùng các công cụ điều khiển đã được cấp. Bản tích hợp này chưa nối Box vào điều khiển chuột hoặc tự gửi ảnh màn hình. |

Các điểm phù hợp 9,5/10, ví dụ tin cậy 96% và sơ đồ thư mục trong ảnh là giả thuyết thiết kế. Trong Limix, gói plugin phân phối chỉ dẫn và khai báo phụ thuộc MCP. Bộ điều phối, kiểm tra quyền và bộ nhớ đệm hoạt động ở máy chủ.

## Phạm vi tái sử dụng kết quả

Tối ưu nằm ở công cụ decide của bot khi dùng Jev. Khóa so khớp bao gồm bot, hội thoại, lượt, cấu hình kết nối, trạng thái và toàn bộ câu hỏi. Mỗi lần gọi vẫn đi qua cổng cấu hình. Bộ nhớ tiến trình giữ tối đa 128 mục, cho phép dùng lại trong 30 giây. Lỗi được bỏ để lượt gọi sau có thể thử lại. Dữ liệu hội thoại và khóa API không được ghi ra tệp cache. Đây là cache kết quả quyết định, tách biệt với tính phí cache prompt của nhà cung cấp.

## Đánh giá

Bộ kiểm thử đếm số lượt gọi nhà cung cấp mô phỏng, kiểm tra thay đổi khóa và lượt, tắt tính năng, hết hạn và khả năng thử lại sau lỗi. Kịch bản 10 yêu cầu đồng nhất đồng thời cho một lượt dự kiến một cuộc gọi; 10 yêu cầu có nội dung khác nhau không có bảo đảm tiết kiệm tương tự.

Bộ đánh giá định tuyến có dữ liệu tiếng Việt cho thanh toán, giao diện, nội dung và thiết kế. Bài chạy thật trong `server/decider/room-routing.eval.test.ts` báo tỷ lệ chọn đúng, trường hợp chọn sai có độ tin cậy cao, tỷ lệ dùng dự phòng, p50/p95 và token. Muốn kết luận hiệu quả trên lưu lượng sản xuất cần đo riêng theo ngôn ngữ, loại nhiệm vụ, số lần lặp trong từng lượt và cấu hình tài khoản.

Mã liên quan: `server/decider/jev.ts`, `server/decider/index.ts`, `server/decider/room-routing.ts`, `server/decider/app-picks.ts`, `server/host/inbox-triage.ts`, `server/routes/helper-tools.ts`. [Gói cho bot và nhóm](https://github.com/leomieo/limix-plugin-hub/blob/main/plugins/limix-ai-decision-engine.json)
