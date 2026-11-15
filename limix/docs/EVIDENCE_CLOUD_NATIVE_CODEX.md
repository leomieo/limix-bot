# Cloud native beta — kết quả C1–C4, 16/11/2026

Nhánh `cloud-native-codex` dựa trên `github/cloud-native` tại `610028b36`. Kiểm tra bằng Docker Desktop Linux trên Windows, CPU Intel i9-14900K. Hai Docker context đều dùng named pipe trên máy này. Xeon Windows, mạng Cloudflare thật, đăng nhập nhà cung cấp AI và tài khoản khách thật chưa được kiểm chứng.

| Việc | Lệnh đã chạy | Kết quả |
|---|---|---|
| C1 | `docker build --target cloud-home --build-arg "CLOUD_HOME_ENGINES=@anthropic-ai/claude-code @openai/codex" -t limix-cloud-home:beta .` và `docker build -f deploy/managed-beta/Dockerfile -t limix-managed-home:beta .` | Hai image build thành công. Hai container healthy. HTTP :8080 trả `{"app":"openmausbot"}`, gateway :8790/healthz trả `app=limix-bot`. Codex CLI 0.169.0, Claude Code 2.1.325. Launcher khởi động thành công. |
| C2 | `node deploy/managed-beta/smoke.mjs` | Mỗi home chấp nhận chữ ký của mình. B từ chối chữ ký, mã ghép nối và phiên của A. API key thử và tệp trong thư mục Codex của A vắng mặt ở B. Tạo lại A vẫn đọc được key, tệp và phiên. Smoke đã xóa container/volume thử. |
| C3 | `node --test deploy/managed-beta/host.test.mjs deploy/managed-beta/wake-proxy.test.mjs` | 9/9 qua. Kiểm tra dừng không xóa volume, giữ thức khi có gateway, hoạt động mới hủy lệnh ngủ và chuyển nguyên body một lần sau khi nhận HTTP 502 trong lúc home đang khởi động. |
| C4 | Từ `cloudflare/control-plane` chạy `node ../../node_modules/vitest/vitest.mjs run` | 180/180 qua (12 file). Worker/Miniflare và D1 thử nghiệm kiểm tra xác thực owner, từ chối người dùng khác, duyệt, từ chối, thu hồi, danh sách và dữ liệu lưu. Dịch vụ xác thực Limix được giả lập. |
| TypeScript | `node node_modules/typescript/bin/tsc -p cloudflare/control-plane/tsconfig.json` | Exit 0. |

Docker không cần cấp thêm capability để chạy bài thử. Runtime báo `bot box: off (userns-refused)` và `/proc: hidepid not applied (mount: /proc: permission denied.)`. Kiểm chứng cách ly ứng dụng trong C2 không thay thế đánh giá sandbox cho mã khách không tin cậy.

Để tái lập bài thử trên Xeon, mở PowerShell trong D:\limix-bot, dùng `git fetch github` và `git switch cloud-native-codex` (dùng tên remote thực sự trỏ GitHub trên Xeon), rồi chạy hai lệnh build C1 và smoke C2. Đặt `$env:LIMIX_SMOKE_POWER='1'` để thêm bước chờ idle, bắt tay ngủ và đánh thức. Xem hướng dẫn vận hành tại [deploy/managed-beta/README.md](../../deploy/managed-beta/README.md).

Lệnh `$env:LIMIX_SMOKE_POWER='1'; node deploy/managed-beta/smoke.mjs` đã qua trên Docker cục bộ. Hai request có chữ ký đọc idle và chuẩn bị ngủ thành công. Container thực sự dừng. Request HTTP đầu tiên qua wake proxy đã khởi động lại container và nhận HTTP 200. Fixture dùng callback cục bộ để gọi Docker khi thức. Đường Worker/Cloudflare công khai tới Xeon cần nghiệm thu riêng. Lần chạy đầu trả 502 vì TCP đã mở trước khi server sẵn sàng. Sau khi proxy chờ /api/health trả 200, bài thử khởi động nguội qua.
