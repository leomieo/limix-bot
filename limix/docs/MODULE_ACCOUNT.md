# MODULE_ACCOUNT.md — Tài khoản Limix cho Limix Bot (mốc L1)

**Quyết định của chủ dự án (2026-11-11):** khách tự đăng ký; app bắt buộc đăng nhập; 1 tài khoản tối đa **10 máy cùng
lúc**; máy thứ 11 bị **từ chối** (khách tự gỡ máy cũ); chưa giới hạn thời gian; **dùng chung tài khoản với Limix Studio**.

## Máy chủ (ĐÃ VIẾT, test giả lập; CHƯA lên máy chủ thật)

Máy chủ tài khoản có sẵn của chủ dự án: `https://tiktok.limixmedia.com` (`gui_server.py` + `db_manager.py`, SQLite
`users.db`, VPS Ubuntu 24.04). Mã máy chủ là dự án riêng của chủ dự án (thư mục `F:\Tool tu build\tiktok-checker`),
KHÔNG nằm trong repo công khai này (có thông tin đăng nhập quản trị trong mã).

Phần thêm cho Limix Bot (chỉ thêm, không sửa luồng cũ; bản gốc lưu cạnh file `*.bak-before-limixbot`):

| Route (POST, JSON) | Vào | Ra |
|---|---|---|
| `/api/limixbot/login` | `username` (tên hoặc email), `password`, `machine_id`, `machine_name` | 200 `token, username, email, max` · 401 `wrong_credentials` · 403 `not_activated` / `account_locked` · 409 `device_limit` + `machines[]` · 429 |
| `/api/limixbot/validate` | `token`, `machine_id` | 200 `valid: true` · 401 `signed_out` / `account_locked` |
| `/api/limixbot/logout` | `token` | 200 (nhả chỗ của máy) |
| `/api/limixbot/machines` | `username`, `password` | 200 `max, machines[]` |
| `/api/limixbot/remove-machine` | `username`, `password`, `id` | 200 `machines[]` còn lại |
| `/api/admin/limixbot/machines`, `/api/admin/limixbot/remove-machine` | cookie admin hiện có | danh sách / gỡ máy |

- Bảng mới `limixbot_machines` (user_id, machine_id, machine_name, token_hash = sha256, registered_at, last_seen).
- Giới hạn máy: `settings.limixbot_max_machines` (mặc định 10). Máy không mở app 30 ngày tự nhả chỗ.
- Không kiểm tra gói/hạn dùng (chưa giới hạn thời gian). Tài khoản `pending` (chưa OTP) hoặc bị đình chỉ không vào được.
- Nhập sai mật khẩu: tối đa 10 lần/tài khoản và 30 lần/IP trong 10 phút.
- Trang admin (tab Tài Khoản): nút "🤖 Bot n/10" mở danh sách máy, có nút "Gỡ máy".
- Kiểm thử (2026-11-11, máy chủ chạy với CSDL tạm, không đụng dữ liệu thật): 33/33 tình huống qua — 10 máy vào,
  máy 11 bị từ chối, gỡ máy, đăng xuất nhả chỗ, máy cũ 31 ngày, khóa tài khoản, chặn dò mật khẩu, API Limix Studio
  không đổi; ảnh trang admin.

## App (ĐÃ VIẾT trên nhánh `limix-account`, CHƯA build)

| File (sửa ở `limix/overlay/electron/`) | Việc |
|---|---|
| `limix-features.mjs` | `LIMIX_ACCOUNT_URL` (rỗng = tắt cổng đăng nhập) |
| `limix-account-client.mjs` | gọi máy chủ; cho chạy tiếp tối đa 7 ngày khi mất mạng sau lần kiểm tra tốt gần nhất |
| `limix-account.mjs` | cửa sổ đăng nhập (trước màn hình khởi động), màn hình "đã đủ máy" để gỡ máy, kiểm tra lại mỗi 10 phút; máy bị gỡ/tài khoản bị khóa → báo rồi khởi động lại app |
| `limix-account-preload.cjs` | cầu nối tối thiểu cho cửa sổ đăng nhập |
| `electron/main.mjs` | rebrand bước 8e chèn lời gọi `limixAccountGate` |

- Mã máy: Windows dùng `MachineGuid` (băm sha256 kèm "limixbot"), nơi khác là mã ngẫu nhiên lưu trong userData.
- Token lưu `userData/limix-account.json`, mã hóa bằng `safeStorage` (DPAPI trên Windows).
- Kiểm thử: client chạy với máy chủ thật (bản sửa, CSDL tạm) 14/14 tình huống; ảnh cửa sổ đăng nhập và màn hình đủ máy.
- CHƯA kiểm: chạy trong Electron thật (CI chỉ build), cài trên Windows.

## Thứ tự phát hành (bắt buộc)

1. Đưa bản sửa máy chủ lên VPS (chủ dự án đồng ý; `deploy.py` sẽ khởi động lại `tiktok-checker`).
2. Gọi thử `/api/limixbot/validate` trên máy chủ thật.
3. Mới gộp nhánh `limix-account` vào `main` (build app bắt buộc đăng nhập). Làm ngược lại thì không ai vào được app.

## Rủi ro đã thấy ở máy chủ có sẵn (chưa sửa, cần chủ dự án quyết)

- Cookie admin là một chuỗi cố định viết trong mã, kiểm tra bằng "chứa chuỗi"; tài khoản/mật khẩu admin viết trong mã.
- Mật khẩu khách băm SHA-256 một vòng (nên dùng scrypt/bcrypt).
- Trang admin chèn tên/email khách bằng `innerHTML` (khách tự đăng ký → có thể chèn mã vào trang admin).
- Limix Studio có mã băm tài khoản admin offline trong file .exe.
