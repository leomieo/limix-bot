# Chạy Limix Bot trên máy chủ riêng (VPS) 24/7

Tắt máy tính, đóng ứng dụng Limix Bot: bot trên máy chủ vẫn trả lời Telegram, Zalo, Discord và chạy việc định kỳ.

**Chọn đường cài:**
- Máy thuê có IP riêng (VPS) → làm Bước 1–4 bên dưới.
- Máy đặt ở nhà/văn phòng, mạng cáp quang thường, không IP tĩnh (ví dụ máy Xeon của chủ dự án) → làm
  "Phần A: cài Ubuntu" rồi "Máy ở nhà hoặc văn phòng — dùng đường hầm Cloudflare", sau đó Bước 2–4.

## Phần A: cài Ubuntu lên máy trống (máy ở nhà, khoảng 30–45 phút)

Cần: 1 USB từ 8 GB, màn hình, bàn phím, dây mạng cắm vào máy.

1. Trên máy Windows, tải **Ubuntu Server 24.04 LTS** (file .iso) tại https://ubuntu.com/download/server.
2. Tải **Rufus** (https://rufus.ie), chọn USB và file .iso, bấm **Start** để ghi.
3. Cắm USB vào máy chủ, bật máy, bấm liên tục **F11** (hoặc F12/F8 tùy bo mạch) để chọn khởi động từ USB.
4. Khi cài: chọn **English**; mạng để tự nhận; ổ cứng chọn **Use an entire disk** (⚠️ xóa sạch ổ đó — sao lưu
   trước); tự đặt tên đăng nhập + mật khẩu (tự giữ, không gửi ai); tick **Install OpenSSH server**; bỏ qua snap.
5. Cài xong máy khởi động lại: rút USB, đăng nhập bằng tên và mật khẩu vừa đặt.
6. Nên dùng bộ lưu điện (UPS): máy ở nhà mất điện/mất mạng thì bot ngừng.

## Cần chuẩn bị

- Một VPS Ubuntu 22.04 hoặc 24.04, x86-64, tối thiểu 2 CPU, 4 GB RAM (nên 8 GB), 20 GB ổ trống.
- Một tên miền (ví dụ `bot.tenmien.com`) đã trỏ bản ghi A về địa chỉ IP của VPS.
- Cổng 80 và 443 trên VPS còn trống.

## Bước 1. Cài lên VPS (một lệnh)

Đăng nhập VPS bằng SSH, dán:

```sh
curl -fsSL https://raw.githubusercontent.com/leomieo/limix-bot/main/deploy/install.sh | sudo sh -s -- --domain bot.tenmien.com
```

Trình cài kiểm tra máy trước (không đổi gì nếu chưa đạt), rồi cài Docker (hỏi trước), tải bản Limix Bot mới nhất
(`ghcr.io/leomieo/limix-bot`), bật HTTPS và in ra một đường link. Mọi thứ nằm ở `/opt/limixbot`; dữ liệu ở
`/opt/limixbot/data` và không bị đụng tới khi cài lại hay cập nhật.

Chỉ muốn kiểm tra máy: thêm `--check`. Cập nhật: chạy lại đúng lệnh trên.

## Bước 2. Nối ứng dụng trên máy tính với máy chủ

Trong Limix Bot: **＋ → Kết nối với máy chủ**, dán link trình cài vừa in. Thanh bên trái sẽ có thêm máy chủ.

Muốn chuyển bot đang có sang máy chủ: trên thanh bên trái, chọn máy chủ → **Đặt … làm nơi chính** (chuyển bot,
cuộc trò chuyện, bộ nhớ và việc định kỳ).

## Bước 3. Đăng nhập AI trên máy chủ

Khi đang chọn máy chủ, vào phần AI của bot và đăng nhập như trên máy tính:

- **ChatGPT / Codex (gói Plus, Pro…)**: bản cài có sẵn Codex CLI; đăng nhập bằng mã thiết bị (mở link, nhập mã).
  Phiên đăng nhập lưu trên máy chủ và tự gia hạn.
- **API key** (OpenRouter, DeepSeek, OpenAI, Anthropic, Gemini…): dán key như bình thường.

Lưu ý: mỗi người tự đăng nhập tài khoản AI của chính mình. Không dùng chung một tài khoản gói cho nhiều khách.

## Bước 4. Kết nối Telegram / Zalo / Discord trên máy chủ

Trên máy chủ, chương trình kết nối luôn chạy cùng Limix Bot. Mở trang của nó bằng trình duyệt (đã đăng nhập máy chủ):

```
https://bot.tenmien.com/api/limix/gateway/
```

Thêm kết nối như trên máy tính, chọn bot của máy chủ trong danh sách.

Quan trọng: một bot Telegram/Zalo chỉ nên được kết nối ở **một nơi**. Khi đã kết nối trên máy chủ, hãy xóa kết nối
đó trong ứng dụng trên máy tính, nếu không hai nơi sẽ tranh nhau tin nhắn.

## Máy ở nhà hoặc văn phòng (không có IP tĩnh) — dùng đường hầm Cloudflare

Không cần mở cổng trên modem, không cần IP tĩnh. Tên miền phải nằm trên Cloudflare (ví dụ `limixmedia.com`).

1. Trên Cloudflare: **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**, đặt tên (ví dụ `limix-xeon`).
   Cloudflare hiện một lệnh cài có đoạn `--token eyJ...`: chép riêng phần mã sau `--token` (giữ bí mật).
2. Ở bước **Public hostname**: Subdomain `bot`, Domain `limixmedia.com`, Service **HTTP**, URL `caddy:80`. Lưu.
3. Trên máy chủ (Ubuntu 22.04/24.04), chạy (thay MÃ bằng mã vừa chép):

```sh
curl -fsSL https://raw.githubusercontent.com/leomieo/limix-bot/main/deploy/install.sh | sudo sh -s -- --domain bot.limixmedia.com --tunnel MÃ --install-docker
```

Trình cài bỏ qua bước kiểm tra cổng 80/443 và bản ghi DNS, chạy thêm `cloudflared` cạnh Limix Bot. Mã được giữ trong
`/opt/limixbot/.env`, nên lần chạy lại hoặc cập nhật vẫn giữ đường hầm.

## Máy chủ tự lo những gì

- Tự chạy lại khi Limix Bot lỗi hoặc VPS khởi động lại (Docker `restart: unless-stopped`).
- Chương trình kết nối Telegram/Zalo/Discord tự chạy lại nếu dừng.
- Mỗi bot giữ bộ nhớ, cấu hình, quyền và việc định kỳ riêng.

## Giới hạn hiện tại

- Bản máy chủ chưa có "hộp cát" (sandbox) cứng cho từng bot như bản OpenMausBot mới nhất; trình cài sẽ báo. Chỉ
  dùng VPS riêng cho Limix Bot.
- Trang kết nối Telegram/Zalo/Discord hiện chỉ có tiếng Việt.
- Không khuyến khích đăng nhập Google Antigravity (gói Google AI) trên máy chủ: Google đã khóa quyền dùng của các
  tài khoản đưa phiên đăng nhập Antigravity vào công cụ bên thứ ba. Trên máy chủ nên dùng API key Gemini (AI Studio
  hoặc Vertex).
