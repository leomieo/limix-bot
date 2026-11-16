# Limix Cloud native beta trên Windows

Mỗi tài khoản được duyệt có một Cloud home, volume `cloud` và CLI HOME riêng. Home chạy root launcher của target `cloud-home`, Caddy :8080, server và gateway. Các home cùng nằm trên mạng ingress `limix-managed-edge`; đây không phải mạng riêng cho từng khách. API của mỗi home vẫn yêu cầu phiên riêng. Không gắn Docker socket hoặc thư mục máy chủ vào home.

## Build và kiểm chứng

Chạy tại gốc repository trên nhánh `cloud-native-codex`, không dùng image target `server` cũ:

```powershell
docker build --target cloud-home --build-arg "CLOUD_HOME_ENGINES=@anthropic-ai/claude-code @openai/codex" -t limix-cloud-home:beta .
docker build -f deploy/managed-beta/Dockerfile -t limix-managed-home:beta .
$env:LIMIX_HOME_IMAGE = 'limix-managed-home:beta'
node deploy/managed-beta/smoke.mjs
# Tùy chọn: thử ngủ/thức thật, thêm khoảng 130 giây chờ idle.
$env:LIMIX_SMOKE_POWER = '1'
node deploy/managed-beta/smoke.mjs
Remove-Item Env:LIMIX_SMOKE_POWER
```

Smoke chỉ tạo UUID/volume thử nghiệm và xóa chính các volume đó khi xong. Không dùng tài khoản, API key hoặc dữ liệu khách thật. Codex, Claude Code và Antigravity ACP có sẵn trong image; cài CLI không đồng nghĩa đã đăng nhập hoặc gọi model thành công.

## Triển khai phối hợp với Worker

1. Tạo/lưu host token bằng `host.ps1 -Action Configure -Capacity 1 -Generate` nếu chưa cấu hình. Giữ token cũ nếu đã có, vì bí mật home được suy ra từ token này. Không ghi token vào log hoặc Git.
2. Build image mới trước. Áp dụng migration tới **0022**, triển khai Worker từ nhánh đã tích hợp, không chạy workflow từ `main` cũ. Phối hợp thời điểm đổi Worker/host: ingress mới cần `limix-managed-wake` trên mạng Docker.
3. Chạy `host.ps1 -Action Run`. Host tạo tunnel connector và wake proxy, rồi đối soát mỗi 30 giây. Khi nâng image hoặc đổi host token/suffix, dừng host, tạo lại **chỉ container `limix-managed-wake`**, rồi chạy host lại; không xóa volume home.
4. Admin desktop dùng `https://cloud.limixmedia.com`. Trỏ domain này tới cùng Worker và đưa vào allowed origins khi tích hợp/deploy. Giao diện desktop và bật Cloud là phần K1/K2 của Claude; không dùng menu beta cũ.
5. Khách đăng nhập Limix, xin dùng thử; chủ dự án mở `/cloud-admin`, nhập **bearer Limix** theo định dạng desktop (không phải mật khẩu tài khoản hay token nhà cung cấp AI). Trang chỉ giữ token trong RAM, xóa ô nhập sau đăng nhập. API kiểm tra principal đúng `limix:tqtuan`; người khác không được xem/duyệt dữ liệu.

Duyệt thêm enrollment và đánh dấu approved. Từ chối/thu hồi xóa enrollment, thu hồi token thiết bị Cloud; host dừng home trong lần đối soát kế tiếp, giữ volume. Khi control plane mất liên lạc, dịch vụ đang chạy giữ nguyên; thu hồi chưa có hiệu lực trên host cho tới lần đối soát thành công. Duyệt lại tạo workspace mới; volume cũ không tự gắn lại.

## Ghép nối và định tuyến

Địa chỉ mỗi home: `https://lc-<UUID không dấu gạch>.limixmedia.com`. Tunnel đi qua `limix-managed-wake:8080`, proxy xác minh workspace còn được duyệt rồi chuyển tới `home-<UUID>:8080`, giữ Host header. Proxy không lưu body media và không gửi lại body sau khi đã chuyển cho home. Có giới hạn 256 kết nối; beta chưa kiểm chứng tải lớn.

Worker ký HMAC theo giao thức Cloud cho `/api/cloud/pairing`. Bí mật mỗi home được suy ra bằng HMAC từ host token và UUID. Mã ghép nối, phiên, khóa API và `~/.codex` của A không dùng ở B. Home không publish cổng máy chủ trong Compose vận hành; smoke mới thêm cổng loopback tạm. Không mở trực tiếp 8799.

## Ngủ và thức

- **Mặc định không ngủ.** `sleep_enabled=0`; `LIMIX_HOME_GATEWAY=1` giữ home thức ngay cả khi có lệnh ngủ. Telegram/Zalo/Discord có polling hoặc kết nối nền, không thể nhận tin khi container chứa gateway đã dừng. Không hứa 24/7 nếu máy Xeon/Windows/Docker bị tắt hoặc ngủ.
- Muốn thử tiết kiệm tài nguyên, dùng host thử nghiệm **không chạy các connector**: đặt `LIMIX_HOME_GATEWAY=0`, chạy host để báo `sleep_blocked=0`, rồi operator đặt `sleep_enabled=1` cho enrollment thử nghiệm trong D1. Không bật cho khách đang cần nhắn tin 24/7.
- Admin đọc power có chữ ký và chỉ ký bắt tay ngủ khi idle. Home tự kiểm tra turn/routine/computer/maintenance và thời gian idle. Host kiểm tra lại trạng thái `sleeping` ngay trước khi dừng; nếu không xác minh được thì giữ thức. Volume được giữ.
- Worker trả `power` trong assignments và `cloud.power` trong desktop session. `POST /api/cloud/desktop/wake` chỉ tác động home của người gọi. Wake proxy luôn chạy: request tới home gọi Worker, chờ Docker sẵn sàng tối đa 90 giây rồi mới chuyển request. Các probe power không đánh thức home. Worker đánh thức trước `nextDueAt` 3 phút; host cần hoạt động liên tục để thực hiện.
- Home ngủ không chiếm slot đang chạy. Hết capacity thì request có thể hết thời gian chờ và nhận 503; proxy không tự tăng giới hạn máy chủ.

## Giới hạn kiểm chứng

Xem `limix/docs/EVIDENCE_CLOUD_NATIVE_CODEX.md`. Kết quả Docker cục bộ không thay thế kiểm thử Xeon, DNS/Cloudflare thật, owner login thật, OAuth nhà cung cấp hay gửi/nhận Zalo/Telegram thật. Docker Desktop có thể báo `bot box: off (userns-refused)` và không remount được `/proc` với hidepid. Không tự thêm `privileged` hoặc `SYS_ADMIN` chỉ để xóa cảnh báo; cần đánh giá cách ly trước khi mở cho khách không tin cậy.

## Automatic runtime updates / Tự cập nhật runtime
Cloud host mới mặc định kiểm tra bản GitHub ổn định mỗi 6 giờ, tải tag managed-vX.Y.Z từ ghcr.io/leomieo/limix-bot và kiểm tra nhãn image. Chỉ cập nhật máy đang chạy, khỏe và chấp nhận bắt tay tạm dừng khi rảnh; máy bận hoặc ngủ được hoãn. Tạo snapshot Docker volume riêng trước khi đổi image; thất bại sẽ thử khôi phục snapshot và image cũ. Giữ một snapshot cho mỗi máy, không tự xóa image cũ. Cần đủ dung lượng ổ đĩa; quá trình tạo snapshot và khởi động gây gián đoạn. Nếu khôi phục lỗi, host giữ nhật ký và dừng đối soát để tránh tiếp tục thay dữ liệu. Đặt LIMIX_AUTO_UPDATE=0 để tắt kiểm tra mới, nhưng vẫn phục hồi giao dịch dang dở. State mặc định ~/.limix-managed-updates/state.json; không xóa state hoặc snapshot khi đang cập nhật. Cần nâng host một lần; không tự thay host scripts, OS, bộ cài Windows hoặc CRM. Image managed được CI build và smoke riêng sau khi phát hành desktop thành công. Không dùng image server thường thay cho managed home.

The new host checks stable releases every six hours, pulls only versioned managed runtime images and verifies identity labels. Healthy idle homes update sequentially after a signed preparation handshake. Snapshots and pinned previous image IDs support failed-start recovery; failed recovery retains the journal and halts reconciliation. One snapshot per home is kept, old images are retained. Storage and brief downtime are required. LIMIX_AUTO_UPDATE=0 disables new checks; unfinished recovery still runs. Host scripts, OS and Windows installers require a separate upgrade. Physical Xeon acceptance is not yet verified.
