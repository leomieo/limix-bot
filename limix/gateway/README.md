# Limix Gateway — nối bot Telegram, Zalo với OpenMausBot

> **Từ Limix Bot 0.3.3:** chương trình này đã nằm sẵn trong app. Mở app → bấm tên tài khoản (góc dưới bên trái) →
> **Kết nối Telegram, Zalo, Discord**. Không cần Node.js hay `Start-Limix.bat`. Các hướng dẫn bên dưới vẫn đúng cho cách chạy riêng.
>
> **Discord:** vào https://discord.com/developers/applications → New Application → Bot → Reset Token (copy token) →
> bật **Message Content Intent** → mời bot vào máy chủ/nhắn tin riêng. Trên trang kết nối chọn Discord và dán token.
>
> **WhatsApp và Messenger:** chưa có. Cả hai chỉ gửi tin qua địa chỉ công khai (webhook) và cần tài khoản Meta Business đã duyệt,
> nên sẽ làm ở bản sau.

Limix Gateway là chương trình nhỏ chạy trên máy Windows của bạn. Nó nhận tin nhắn từ bot Telegram hoặc Zalo,
chuyển cho một bot AI trong OpenMausBot, rồi gửi câu trả lời lại cho người nhắn.

```
Người dùng Telegram/Zalo  →  Limix Gateway (máy bạn)  →  Bot API của OpenMausBot  →  AI trả lời
```

Không cần cài thêm thư viện, chỉ cần Node.js 22 trở lên.

## Cài một lần

1. **Cài Node.js:** tải bản LTS tại https://nodejs.org và cài (bấm Next đến hết).
2. **Cài OpenMausBot:** tải bản Windows tại https://github.com/milind-soni/OpenMausBot/releases/latest
   (file `OpenMausBot-setup.exe`), cài và đăng nhập AI (Claude, Codex…) theo hướng dẫn trong app.
3. **Tạo bot Telegram:** mở Telegram, nhắn `@BotFather` → `/newbot` → đặt tên → BotFather gửi **token**. Giữ token bí mật.
   **Hoặc bot Zalo:** vào https://bot.zaloplatforms.com, đăng nhập, tạo bot, lấy **token**.

## Mỗi lần dùng

1. Mở OpenMausBot (phải đang mở thì bot mới trả lời được).
2. Nhấp đúp `Start-Limix.bat`. Cửa sổ đen hiện ra và trình duyệt mở trang `http://127.0.0.1:8790`.
   Giữ cửa sổ đen mở; đóng nó là bot ngừng trả lời.

## Kết nối bot lần đầu

1. Trong OpenMausBot: mở bot muốn dùng → bánh răng (Bot settings) → **Advanced: Access** → **Bot API** →
   bật **Let apps talk to this bot**. Copy **địa chỉ** (dạng `http://127.0.0.1:…/hooks/api/bots/…/messages`) và **khóa** (`bak_…`).
   Khóa chỉ hiện một lần.
2. Trên trang Limix, khung **Thêm kết nối**: chọn nền tảng, dán token, chọn "Bot trong OpenMausBot", dán địa chỉ và khóa → **Kết nối**.
   (Muốn thử nhanh trước khi có OpenMausBot: chọn "Chế độ thử", bot sẽ nhắc lại tin bạn gửi.)
3. Bấm **Tạo mã liên kết chủ**. Mở bot trên điện thoại, gửi tin `/link MÃ` như trang hiển thị. Bot trả lời
   "Đã xác nhận bạn là chủ bot này".
4. Nhắn thử cho bot. Xong.

## Ai được nhắn cho bot

| Chế độ | Ý nghĩa |
|---|---|
| Người lạ xin mã, chủ duyệt (mặc định) | Người lạ nhắn sẽ nhận mã 8 ký tự. Bạn bấm **Duyệt** trên trang Limix, hoặc nhắn `/approve MÃ` cho bot. |
| Chỉ chủ bot | Chỉ người đã liên kết bằng `/link`. |
| Mọi người | Ai cũng nhắn được. Cẩn thận: mọi người dùng chung hạn mức AI của bạn. |

Lệnh trong chat: `/new` (cuộc trò chuyện mới), `/status`, `/id`, `/pair`, `/help`.

## Giới hạn hiện tại (bản 0.1)

- Chỉ tin nhắn chữ, chỉ chat riêng (bỏ qua nhóm). Ảnh, tệp, giọng nói, nhóm: bản sau.
- Bot API của OpenMausBot cho bot trả lời ở **chế độ giới hạn**: không chạy lệnh máy, không mở trình duyệt, không dùng công cụ.
  Đây là cài đặt an toàn của OpenMausBot cho tin từ bên ngoài. Muốn bot thao tác máy qua Telegram sẽ cần thiết kế quyền riêng (mốc sau).
- Bot API giới hạn **10 tin/phút** cho mỗi khóa (của OpenMausBot).
- Bot cần duyệt thao tác → người nhắn được báo; bạn duyệt trong app OpenMausBot.
- Một bot Telegram/Zalo chỉ được một chương trình nhận tin. Nếu bot đang chạy ở chỗ khác (webhook, Hermes, OpenClaw…),
  Limix báo **Xung đột** và **không tự chiếm quyền**. Tắt chỗ kia rồi bấm **Chạy**.
- Máy tắt hoặc ngủ thì bot không trả lời.

## Dữ liệu và bảo mật

- Mọi dữ liệu nằm trong thư mục `data/` cạnh file này. Token và khóa được mã hóa (`secrets.json` + `master.key`).
  Ai có cả thư mục `data/` thì đọc được; đừng chia sẻ thư mục này.
- Trang quản lý chỉ mở trên chính máy bạn (127.0.0.1), trang khác không gọi được.
- Ngắt kết nối trong Limix không xóa bot trên Telegram/Zalo.

## Kiểm tra

Nhấp đúp `Kiem-tra.bat` để chạy bộ kiểm thử tự động (dùng máy chủ giả lập, không gửi tin thật).

## Nguồn tham khảo

- Cách chia tin dài và cơ chế mã ghép cặp: chuyển thể từ Hermes Agent (MIT License, Copyright (c) 2025 Nous Research),
  commit `b50d007e`. Chi tiết: `../docs/HERMES_EXTRACTION.md`.
- Bot API: tài liệu OpenMausBot `docs/bot-api.md` commit `6f226f15`.
- Telegram Bot API: https://core.telegram.org/bots/api · Zalo Bot API: https://docs.zaloplatforms.com/zalo-bot
