Limix Bot 0.3.73

## Tiếng Việt

- Trang quản lý Limix Cloud nay ở địa chỉ gọn cloud.limixmedia.com.

## English

- The Limix Cloud management page now lives at the short address cloud.limixmedia.com.

Limix Bot 0.3.72

## Tiếng Việt

- Có trang quản lý Limix Cloud cho khách trên trình duyệt. Trong Cài đặt → Limix Cloud, bấm "Quản lý trong trình duyệt của bạn" là vào thẳng, không cần đăng nhập lại. Trang cho xem gói dịch vụ, tình trạng máy Cloud (đang chạy, đang ngủ, đang chuẩn bị, lỗi), đánh thức Cloud, xin dùng thử, xem và đăng xuất các máy đã đăng nhập. Liên kết chỉ dùng một lần, phiên trên trình duyệt hết hạn sau 2 giờ.

## English

- Limix Cloud has a management page for customers in the browser. In Settings → Limix Cloud, "Manage in your browser" opens it already signed in. It shows the plan and the Cloud machine's state (running, asleep, getting ready, failed), and lets you wake the Cloud, ask for a trial, and see and sign out signed-in devices. The link works once; the browser session lasts 2 hours.

Limix Bot 0.3.71

## Tiếng Việt

- Nút "Quản lý trong trình duyệt của bạn" ở Cài đặt → Limix Cloud nay mở đúng trang quản lý tài khoản Limix, không còn ra trang báo lỗi "not_found".

## English

- "Manage in your browser" in Settings → Limix Cloud now opens the Limix account page instead of a "not_found" error page.

Limix Bot 0.3.70

## Tiếng Việt

- Đám mây cạnh bot đổi theo trạng thái chuyển lên My Cloud: dấu tích khi đã chuyển xong, mũi tên lên nhấp nháy khi đang chuyển, cảnh báo khi có lỗi, và đám mây gạch chéo mờ cho bot chưa chuyển (chỉ hiện khi đang có bot khác chuyển, để dễ so sánh). Rê chuột vào để xem chi tiết.

## English

- The cloud beside a bot now follows its move to My Cloud: a check when it has moved, a pulsing upload arrow while it moves, a warning when it failed, and a dim crossed cloud for a bot not moved yet (shown only while another bot is moving, so they are easy to compare). Hover for details.

Limix Bot 0.3.69

## Tiếng Việt

- Chuyển bot lên Cloud hiện rõ tiến độ: bot đang chuyển có đám mây nhấp nháy cạnh tên; bot chuyển lỗi có đám mây cảnh báo, rê chuột vào để xem lỗi, số lần đã thử và giờ tự thử lại. Trong menu của bot có "Thử chuyển lên Cloud lại ngay".
- Danh sách mô hình tự cập nhật theo tài khoản: Google Gemini (Antigravity) dùng CLI `agy` của bạn nay đọc đúng các mô hình của gói đang đăng nhập (ví dụ Ultra có Gemini 4). Với mọi nhà cung cấp tự liệt kê mô hình, danh sách được đọc lại khi đổi tài khoản và tối đa 15 phút một lần.

## English

- Moving bots to Cloud shows its progress: a pulsing cloud beside a bot on its way; a warning cloud when it failed, whose tooltip gives the error, tries and next retry. The bot's menu offers "Retry the move to Cloud now".
- Model lists follow the account: Google Gemini (Antigravity) with your own `agy` CLI now reads the models of the signed-in plan (Ultra lists Gemini 4). For every provider that lists its own models, the list is read again when the account changes and at most every 15 minutes.

Limix Bot 0.3.68

## Tiếng Việt

- Sửa lỗi chuyển bot lên Cloud luôn báo "My Cloud chưa sẵn sàng": app dùng nhầm địa chỉ Cloud của tài khoản đã đăng nhập trước đó trên máy. Nay luôn dùng Cloud của tài khoản đang đăng nhập; các bot đang chờ sẽ tự chuyển ở lần thử lại kế tiếp.

## English

- Fix moving bots to Cloud always failing with "My Cloud is not ready": the app used the Cloud of an account signed in earlier on this computer. It now uses the signed-in account's Cloud; waiting bots move at their next retry.

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
