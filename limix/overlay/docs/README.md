[Tiếng Việt](#tieng-viet) · [English](#english) · [Kho mã / Repository](../README.md)

# Tài liệu Limix Bot · Limix Bot documentation

<a id="tieng-viet"></a>

## Tiếng Việt

[Bắt đầu](#vi-start) · [Bot và kỹ năng](#vi-bots) · [Kênh chat](#vi-channels) · [Triển khai](#vi-operations)

<a id="vi-start"></a>

### Bắt đầu

1. Chọn bộ cài đúng hệ điều hành và kiến trúc máy trong [bảng tải xuống](../README.md#tieng-viet). Nếu đang dùng phiên bản cũ, hãy xem [ghi chú phát hành](https://github.com/leomieo/limix-bot/releases) trước khi cập nhật.
2. Mở **Cài đặt → AI**, kết nối tài khoản hoặc khóa API của nhà cung cấp, rồi chọn mô hình cho bot.
3. Mở **Bản mẫu**, chọn một bot, bấm **Dùng mẫu** và gửi một yêu cầu thử trong Limix Bot. Dùng yêu cầu chỉ đọc, chẳng hạn tóm tắt một đoạn văn ngắn.
4. Kiểm tra nội dung phản hồi trước khi bật kỹ năng, kết nối kênh ngoài hoặc lên lịch tác vụ.

<a id="vi-bots"></a>

### Bot, nhóm bot và kỹ năng

| Mục tiêu | Cách thực hiện |
| --- | --- |
| Giao một vai trò | Tạo bot từ **Bản mẫu** hoặc dấu **+** ở thanh bên. Đặt vai trò, mô hình và phạm vi công cụ cho bot. |
| Phối hợp theo ngành | Chọn một nhóm trong thư viện, xem vai trò của từng bot và kỹ năng đi kèm, rồi dùng mẫu. Với nhóm chăm sóc khách hàng, hãy thử một tình huống bàn giao giữa hai vai trò trước. |
| Thêm kỹ năng | Mở phần kỹ năng của bot và xem nguồn, quyền và công cụ phụ thuộc trước khi bật. Dùng **Công cụ cho kỹ năng → Yêu cầu của skills** để xem phần mềm hỗ trợ cần cho từng tác vụ. |
| Sản xuất video | Chọn **Limix AI Video Creator** để chuẩn bị kịch bản phân cảnh, phụ đề và dự án Hypit có thể chỉnh sửa. Kết xuất video cần môi trường Hypit được cấu hình trên máy thực thi. |

### Quyền và dữ liệu

- Cấp quyền theo công việc. Với tài khoản, dữ liệu hoặc hành động nhạy cảm, dùng chế độ hỏi duyệt và giới hạn phạm vi tool hoặc thư mục theo bot.
- Trước khi bật lịch chạy hay kênh ngoài, kiểm tra bot có thể đọc và ghi những gì trong môi trường thực thi.
- Sao lưu dữ liệu trước khi chuyển máy hoặc nâng cấp môi trường tự lưu trữ. Báo riêng các vấn đề bảo mật theo hướng dẫn của dự án. [Báo cáo bảo mật](../SECURITY.md)

<a id="vi-channels"></a>

### Kênh chat và xử lý lỗi

Mở cài đặt bot và chọn **Kênh chat**. Kết nối dịch vụ đang cần, thử một tin nhắn riêng và kiểm tra câu trả lời trước khi cho khách sử dụng. Quyền chủ bot áp dụng cho tài khoản đã liên kết trên kênh hỗ trợ xác minh danh tính. Phản hồi trong nhóm dùng quyền khách.

| Hiện tượng | Kiểm tra |
| --- | --- |
| Bot không trả lời ngay trong Limix | Kiểm tra mô hình, tài khoản AI, hạn mức và trạng thái của cuộc trò chuyện. |
| Limix trả lời nhưng kênh ngoài gặp lỗi | Kiểm tra bot được gán cho kênh, trạng thái kết nối, quyền khách và khả năng xử lý quyền khách của mô hình đã chọn. |
| Kỹ năng báo thiếu công cụ | Quét lại trong **Công cụ cho kỹ năng**. Kiểm tra công cụ trên đúng máy mà bot sẽ chạy. |
| My Cloud không kết nối được | Kiểm tra mạng và trạng thái tài khoản. Nếu màn hình có tùy chọn **Dùng máy tính này**, bạn có thể tiếp tục với các bot đã có trên máy. |

<a id="vi-operations"></a>

### Triển khai máy chủ

- **Ứng dụng desktop** phù hợp khi bạn quản lý bot trực tiếp trên máy cá nhân. Xem [bộ cài desktop](../README.md#tieng-viet).
- **Máy chủ tự quản** phù hợp khi bot cần chạy độc lập với cửa sổ desktop. Xem [hướng dẫn tự lưu trữ](self-hosting.md) để cấu hình máy chủ, truy cập từ xa và Fleet.
- **Fleet trên Linux** dùng một dịch vụ systemd cho mỗi workspace. Máy chủ đã cài Fleet từ bản trước cần chuyển tên unit theo [hướng dẫn nâng cấp](self-hosting.md#updating-an-existing-fleet-to-the-new-service-name).

Khi báo lỗi, gửi phiên bản Limix Bot, hệ điều hành, thao tác tái hiện và thông báo lỗi đã che thông tin riêng tư. [Báo lỗi](https://github.com/leomieo/limix-bot/issues) · [Đóng góp](../CONTRIBUTING.md) · [Giấy phép](../LICENSE) · [Ghi công](../NOTICE)

---

<a id="english"></a>

## English

[Getting started](#en-start) · [Bots and skills](#en-bots) · [Chat channels](#en-channels) · [Deployment](#en-operations)

<a id="en-start"></a>

### Getting started

1. Choose the installer that matches your operating system and architecture from the [download table](../README.md#english). If you already use Limix Bot, read the [release notes](https://github.com/leomieo/limix-bot/releases) before updating.
2. Open **Settings → AI**, connect a provider account or API key, and choose a model for your bot.
3. Open **Templates**, select a bot, choose **Use template**, and send a test message in Limix Bot. Start with a read-only task, such as summarizing a short passage.
4. Check the reply before enabling skills, connecting external channels or scheduling tasks.

<a id="en-bots"></a>

### Bots, teams and skills

| Goal | What to do |
| --- | --- |
| Assign a role | Create a bot from **Templates** or the sidebar **+**. Set its role, model and tool scope. |
| Work as an industry team | Choose a team from the library, review the member roles and included skills, then use the template. For customer support, test a handoff between two roles first. |
| Add a skill | Open the bot's skills settings and review the source, permissions and dependencies before enabling a skill. Use **Tools for skills → Skill requirements** to see the software needed for specific tasks. |
| Produce video | Choose **Limix AI Video Creator** to prepare storyboards, captions and editable Hypit projects. Rendering needs a configured Hypit runtime on the machine doing the work. |

### Permissions and data

- Grant access for the job at hand. Use Ask approval and scope tools or folders per bot for sensitive accounts, data or actions.
- Before enabling scheduled work or external chat channels, check which data the bot can read and write where it runs.
- Back up your data before moving computers or upgrading a self-hosted environment. Report security issues privately using the project's policy. [Security reporting](../SECURITY.md)

<a id="en-channels"></a>

### Chat channels and troubleshooting

Open the bot's settings and choose **Chat channels**. Connect the service you need, test a private message and check the reply before opening access to guests. Owner permissions apply to a linked account on channels that support identity verification. Group replies use guest permissions.

| Symptom | Check |
| --- | --- |
| The bot does not reply in Limix Bot | Check the model, AI account, usage limits and conversation status. |
| Limix Bot replies, but an external channel fails | Check which bot is attached, the channel connection, guest access, and whether the selected model supports guest turns. |
| A skill reports a missing tool | Rescan in **Tools for skills**. Check for the tool on the machine where the bot actually runs. |
| My Cloud is unreachable | Check your network and account status. If you see **Use this computer**, you can continue working with bots stored locally. |

<a id="en-operations"></a>

### Server deployment

- **Desktop** suits people who manage bots directly on a personal computer. See the [desktop downloads](../README.md#english).
- **Self-hosted server** suits bots that need to run independently of the desktop window. See the [self-hosting guide](self-hosting.md) for server setup, remote access and Fleet.
- **Linux Fleet** uses one systemd service per workspace. For existing Fleet installations, follow the [unit migration instructions](self-hosting.md#updating-an-existing-fleet-to-the-new-service-name).

When filing an issue, include the Limix Bot version, operating system, steps to reproduce and a redacted error message. [Report a bug](https://github.com/leomieo/limix-bot/issues) · [Contributing](../CONTRIBUTING.md) · [License](../LICENSE) · [Notices](../NOTICE)
