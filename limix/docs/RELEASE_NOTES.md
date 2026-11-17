Limix Bot 0.3.67

## Tiếng Việt

- Bot đang chuyển lên Cloud có biểu tượng đám mây cạnh tên; bot đã lên My Cloud được liệt kê từng tên kèm đám mây ở thanh bên của máy tính.
- Sửa lỗi chuyển bot lên Cloud báo "My Cloud chưa sẵn sàng" dù Cloud đang chạy: địa chỉ Cloud bị mất bản ghi DNS. Máy chủ nay tự kiểm tra lại và tạo lại bản ghi.

## English

- Bots on their way to Cloud show a cloud beside their name; bots on My Cloud are listed by name with a cloud in this computer's sidebar.
- Fix moving bots to Cloud failing with "My Cloud is not ready" while the Cloud runs: its address had lost its DNS record. The server now re-checks and recreates it.

Limix Bot 0.3.66

## Tiếng Việt

- Chủ bot điều khiển từ xa qua Telegram/Zalo: cuộc trò chuyện của chủ luôn chạy ở chế độ toàn quyền, bất kể mức quyền đang đặt cho bot trong app. Bot chạy lệnh, đọc/sửa tệp mà không dừng chờ duyệt. Lệnh trong danh sách cấm vẫn luôn bị chặn; khách vẫn bị giới hạn như cũ.

## English

- The bot's owner controlling it remotely over Telegram/Zalo: the owner's conversation always runs at Full access, whatever level the bot has in the app. The bot runs commands and reads/edits files without stopping for approval. Never-list commands are still denied; guests stay confined.

Limix Bot 0.3.65

## Tiếng Việt

- Chủ bot nhắn qua Telegram/Zalo ở chế độ toàn quyền: bot không còn dừng chờ duyệt khi chạy lệnh mở ứng dụng hoặc lệnh phức tạp trên máy. Các lệnh nguy hiểm trong danh sách cấm (ví dụ xoá sạch ổ đĩa) vẫn luôn bị chặn.

## English

- The bot's owner on Telegram/Zalo at Full access: the bot no longer stops for approval on commands that open apps or are too complex to read. Commands on the never-list (such as wiping a drive) are still always denied.

Limix Bot 0.3.64

## Tiếng Việt

- Tin trả lời qua Telegram/Zalo chỉ gồm câu trả lời mới nhất của bot. Trước đây khi bot giao việc cho các bot khác và nhận báo cáo, mọi câu trả lời trong lúc đó bị gộp thành một tin dài.

## English

- A Telegram/Zalo reply carries only the bot's latest answer. Before, when the bot delegated and teammates reported back, every answer in between was stacked into one long message.

Limix Bot 0.3.63

## Tiếng Việt

- Sửa lỗi "Chuyển sang My Cloud" bị mờ với lý do "đang có đợt chuyển cả đội bot": một lần chuyển cả đội còn đang chép dở (chưa khoá máy) giờ nhường chỗ; khi bạn chọn chuyển từng bot, lần chuyển cả đội đó được huỷ trước khi bot nào rời máy.

## English

- Fix "Move to My Cloud" greyed out with "the whole team is moving": a whole-team move still copying (nothing frozen yet) now gives way; choosing bots to move cancels it before any bot leaves.

Limix Bot 0.3.62

## Tiếng Việt

- Bot mẫu và Bản mẫu Nhóm có nút "Xem thêm": xem đầy đủ bot làm gì, cách làm việc, câu hỏi mẫu, kỹ năng, ứng dụng, lịch định kỳ (nhóm: danh sách thành viên, phòng, kỹ năng) để so sánh trước khi chọn.
- "Chuyển sang My Cloud" khi bị mờ nay nói đúng lý do: chưa đăng nhập, chưa được duyệt Cloud, Cloud đang khởi tạo, Cloud lỗi, đã dừng, hoặc đang có đợt chuyển khác.
- Khi nhờ bot trả lời khách qua Telegram/Zalo, khách chỉ nhận câu trả lời cuối, không còn kèm các lời báo tiến độ.
- Tên bot ghim dạng vòng tròn hiện đủ chữ.

## English

- Bot templates and team templates have a "See more" button: everything a template brings (what it does, how it works, sample asks, skills, apps, routines; for teams: members, rooms, skills) to compare before choosing.
- A greyed-out "Move to My Cloud" now gives the exact reason: signed out, no approved Cloud, still setting up, failed, ended, or another move in progress.
- When the bot replies to a customer on Telegram/Zalo, only its final answer is sent, not its progress notes.
- Pinned circle bot names show in full.

# Limix Bot 0.3.61

## Tiếng Việt

- Hiển thị mục chuyển bot lên Cloud kèm lý do khi chưa thể chuyển, thay vì ẩn mục này.
- Làm mới trạng thái chuyển bot khi nhận thông báo từ ứng dụng.
- Phân biệt trạng thái đang gửi tin và đang chờ bot trả lời trong cuộc trò chuyện từ kênh kết nối; hiển thị thời gian chờ.
- Giữ nội dung đang soạn khi hết thời gian chờ xác nhận và hướng dẫn kiểm tra trước khi gửi lại để tránh trùng tin.

## English

- Keep the Cloud transfer menu visible with an explanation when a bot cannot be moved.
- Refresh bot transfer availability when the app sends a notification.
- Distinguish message delivery from waiting for a bot reply in connected-channel conversations, with elapsed time.
- Preserve the draft when confirmation times out and explain how to check delivery before retrying to avoid duplicates.
