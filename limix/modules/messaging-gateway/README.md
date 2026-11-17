# Limix Messaging Gateway

[Tiếng Việt](#tiếng-việt) · [English](#english)

## Tiếng Việt

Mô-đun nối bot Telegram, Zalo, Discord và Facebook Page với bot trong Limix Bot. Từ Limix Bot 0.3.75, mô-đun này
**không còn nằm trong app**: app Desktop và Cloud không kèm, không tự chạy và không có mục menu cho nó. Bạn chạy mô-đun riêng
khi cần, và nó chỉ nói chuyện với Limix Bot qua **Bot API** (địa chỉ + khóa của từng bot).

```
Người nhắn (Telegram/Zalo/Discord/Facebook) → Messaging Gateway (máy bạn) → Bot API của Limix Bot → bot trả lời
```

### Cần có

- Node.js 22 trở lên (https://nodejs.org, bản LTS).
- Limix Bot đang mở trên máy (hoặc một Cloud có Bot API mở được từ máy chạy mô-đun).
- Token bot của nền tảng: Telegram (`@BotFather` → `/newbot`), Zalo (https://bot.zaloplatforms.com), Discord
  (https://discord.com/developers/applications → Bot → Reset Token, bật **Message Content Intent**).

### Chạy

- Windows: nhấp đúp `Start-Limix.bat`. Trang quản lý mở ở `http://127.0.0.1:8790`. Giữ cửa sổ đen mở.
- Dòng lệnh (mọi hệ điều hành): `node src/main.mjs` trong thư mục này.

Biến môi trường:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `LIMIX_DATA_DIR` | `data/` cạnh mô-đun | Nơi lưu kết nối, token (mã hóa), mã ghép cặp |
| `LIMIX_PORT` | `8790` | Cổng trang quản lý, chỉ nghe trên 127.0.0.1 |
| `LIMIX_NO_BROWSER` | (trống) | `1`: không tự mở trình duyệt |
| `LIMIX_ADMIN_TOKEN` | (tự tạo) | Khóa cho API của trang quản lý khi chạy không giao diện |

### Cấu hình Bot API cho từng bot

1. Trong Limix Bot: mở bot → bánh răng → **Advanced: Access** → **Bot API** → bật **Let apps talk to this bot**.
2. Copy **địa chỉ** (dạng `http://127.0.0.1:…/hooks/api/bots/<botId>/messages`) và **khóa** (`bak_…`). Khóa chỉ hiện một lần;
   cần khóa mới thì bấm tạo khóa mới (khóa cũ thôi dùng được).
3. Trên trang mô-đun, **Thêm kết nối**: chọn nền tảng, dán token, dán địa chỉ và khóa Bot API → **Kết nối**.
4. Bấm **Tạo mã liên kết chủ** rồi nhắn `/link MÃ` cho bot trên điện thoại để nhận quyền chủ kết nối (duyệt người nhắn).

Mỗi kết nối kênh dùng khóa Bot API của đúng một bot, nên tin vào kênh nào chỉ đến bot đó. Bot API trả lời ở chế độ an toàn
cho tin từ bên ngoài: không làm thay chủ bot, việc cần duyệt sẽ chờ chủ bot trong app.

### Ai được nhắn

| Chế độ | Ý nghĩa |
|---|---|
| Người lạ xin mã, chủ duyệt (mặc định) | Người lạ nhận mã 8 ký tự; chủ duyệt trên trang hoặc nhắn `/approve MÃ`. |
| Chỉ chủ kết nối | Chỉ người đã `/link`. |
| Mọi người | Ai cũng nhắn được, dùng chung hạn mức AI của bạn. |

Lệnh trong chat: `/new`, `/status`, `/id`, `/pair`, `/help`.

### Nâng cấp từ bản Limix Bot có gateway sẵn

- Khi lên Limix Bot 0.3.75, các kênh Telegram/Zalo/Discord **dừng nhận tin** cho đến khi bạn chạy mô-đun này và cấu hình lại.
- App không xóa gì: dữ liệu kết nối cũ vẫn ở `%APPDATA%\limixbot\limix-gateway` (Windows) hoặc `<userData>/limix-gateway`;
  trên Cloud là `<DATA_DIR>/limix-gateway`. Lịch sử hội thoại kênh vẫn nằm trong Limix Bot, đọc được sau khi mở khóa bằng
  mật khẩu tài khoản như trước.
- App không tự sao chép token, không gửi tin, không hủy webhook và không đăng ký lại kênh.
- Muốn dùng lại kết nối cũ: tắt Limix Bot bản cũ (nếu còn chạy), rồi chạy mô-đun với `LIMIX_DATA_DIR` trỏ tới thư mục cũ
  (hoặc một bản copy). Kết nối cũ đã có sẵn địa chỉ và khóa Bot API nên thường chạy ngay; kết nối nào báo sai khóa thì tạo khóa mới
  cho bot đó và nhập lại.
- Chỉ chạy **một** chương trình nhận tin cho mỗi bot Telegram/Zalo. Mô-đun báo **Xung đột** và không tự chiếm quyền.

### Tái tích hợp vào app (cho người phát triển)

Mô-đun chỉ cần hợp đồng Bot API (`docs/bot-api.md`): `POST <địa chỉ>` với `Authorization: Bearer <khóa>`, thân
`{message, thread?, attachments?, conversation?, channel?, wait?}`; trả `200 {reply, thread}` hoặc `202 {thread, status}`;
`GET <địa chỉ>?thread=<id>` đọc lại. Tái tích hợp nghĩa là app khởi động `src/main.mjs` như một tiến trình con và cho trang
quản lý một khóa Bot API của bot; không mở tuyến nội bộ nào khác. Đường "chủ bot" (`/api/channel-reply`, tiêu đề
`X-Limix-Owner`) tắt khi không có bí mật riêng do chính app cấp lúc khởi động; đừng thay nó bằng khóa thông thường.

### Kiểm thử

`node --test test/*.test.mjs` (hoặc nhấp đúp `Kiem-tra.bat`). Mọi bài thử dùng Telegram, Zalo, Discord, Facebook và Bot API
giả lập trên 127.0.0.1, không gửi tin thật.

### Dữ liệu và bảo mật

- Token và khóa được mã hóa trong `secrets.json` + `master.key` của `LIMIX_DATA_DIR`. Ai có cả thư mục thì đọc được; đừng chia sẻ.
- Trang quản lý chỉ nghe trên 127.0.0.1 và từ chối tên máy khác.

### Nguồn tham khảo

- Cách chia tin dài và mã ghép cặp: chuyển thể từ Hermes Agent (MIT License, Copyright (c) 2025 Nous Research), commit `b50d007e`.
- Telegram Bot API: https://core.telegram.org/bots/api · Zalo Bot API: https://docs.zaloplatforms.com/zalo-bot

## English

A module that connects Telegram, Zalo, Discord and Facebook Page bots to bots in Limix Bot. From Limix Bot 0.3.75 it is
**no longer part of the app**: the Desktop and Cloud apps neither ship nor start it, and have no menu entry for it. Run it on
its own when you need it; it talks to Limix Bot only through the **Bot API** (each bot's address and key).

### Requirements

Node.js 22 or later; Limix Bot running (or a Cloud whose Bot API this machine can reach); a platform bot token.

### Run

Windows: double-click `Start-Limix.bat` (the page opens at `http://127.0.0.1:8790`). Anywhere: `node src/main.mjs`.
Environment: `LIMIX_DATA_DIR` (default `data/`), `LIMIX_PORT` (default `8790`, loopback only), `LIMIX_NO_BROWSER=1`,
`LIMIX_ADMIN_TOKEN` (the page API's key when running headless).

### Bot API setup per bot

In Limix Bot open the bot → gear → **Advanced: Access** → **Bot API** → turn on **Let apps talk to this bot**, copy the
address and the `bak_…` key (shown once). On the module page, **Add connection**: pick the platform, paste the token, the
address and the key. Then **Create owner link code** and send `/link CODE` to the bot. Each connection uses one bot's key,
so a channel only ever reaches that bot. Bot API turns run in the safe mode for outside messages.

### Upgrading from an app with the built-in gateway

- On Limix Bot 0.3.75, Telegram/Zalo/Discord channels **stop receiving messages** until this module runs and is configured.
- Nothing is deleted: the old connections stay in `<userData>/limix-gateway` (desktop) or `<DATA_DIR>/limix-gateway` (Cloud);
  channel conversation history stays in Limix Bot and opens after the account-password unlock, as before.
- The app copies no token, sends no message, removes no webhook and registers no channel.
- To reuse old connections, point `LIMIX_DATA_DIR` at that folder (or a copy). They keep their Bot API address and key, so they
  usually run at once; for one that reports a wrong key, make a new key for that bot and enter it again.
- Run only **one** receiver per Telegram/Zalo bot; the module reports a **Conflict** and never takes a bot over.

### Re-integration (developers)

The module needs only the Bot API contract (`docs/bot-api.md`). Re-integrating means the app starts `src/main.mjs` as a child
process and gives its page a bot's Bot API key; no other internal route. The owner path (`/api/channel-reply`,
`X-Limix-Owner`) stays off without a secret the app itself issues at launch; never replace it with an ordinary key.

### Tests

`node --test test/*.test.mjs`: every test uses fake Telegram, Zalo, Discord, Facebook and Bot API servers on 127.0.0.1.
