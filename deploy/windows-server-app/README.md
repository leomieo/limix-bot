# Limix Cloud Server for Windows / Máy chủ Limix Cloud trên Windows

## Tiếng Việt

Bộ cài beta dành cho máy Windows đã chạy Limix Cloud qua Docker Desktop. Bộ cài chuyển các container Cloud sang Docker Engine trong bản WSL 2 riêng tên `LimixCloud`, đăng ký tác vụ **AtStartup** bằng tài khoản Windows hiện tại với mật khẩu được Windows lưu. Tác vụ không yêu cầu phiên đăng nhập tương tác. Cần kiểm chứng trên máy đích bằng khởi động lại thực tế; build và kiểm thử giả lập chưa chứng minh WSL chạy được trước đăng nhập trên mọi máy.

### Cài trên Xeon

1. Giữ Docker Desktop mở, dừng cửa sổ Cloud host cũ bằng Ctrl+C. Cần dùng cùng tài khoản Windows đang giữ cấu hình `LimixBot-Managed-Host/host.xml`.
2. Chạy `LimixServer-Setup.exe`, chấp nhận UAC. Node.js 24+, WSL 2, ảo hóa và image `limix-managed-home:beta` phải có sẵn. Không tự cài driver Windows hoặc tự reboot.
3. Nhập mật khẩu **Windows thật**, không phải PIN hoặc mật khẩu Limix. Mật khẩu chỉ đi vào stdin của tiến trình cài tại máy và Windows Task Scheduler; không có trong argv, file cấu hình ứng dụng hoặc yêu cầu mạng.
4. Xác nhận đã dừng host cũ, bấm **Cài đặt và chuyển Cloud**. Cần Internet để tải Ubuntu và gói Docker, cùng dung lượng trống cho bản WSL, image và bản sao volume. Kiểm tra dung lượng trên ổ người dùng trước khi cài; bản sao image có thể nhiều GB.
5. Sau khi hoàn tất, thử Cloud. Khởi động lại Xeon, **chưa đăng nhập Windows**, kiểm tra Cloud từ máy khác. Chỉ đánh dấu đạt chạy 24/7 sau phép thử này.

Ứng dụng giữ token/capacity trong cấu hình DPAPI cũ; không tạo token mới. Không thay đổi CRM hoặc Docker Desktop. Chỉ dừng container gắn nhãn Cloud và hai container ingress được chỉ định. Volume Docker Desktop và bản sao lưu được giữ lại. Không bật đồng thời host cũ và mới vì có thể chạy hai bộ bot/connector.

**Bắt đầu** bật lại tự khởi động và chạy host; **Dừng** dừng host, tắt tự khởi động nhưng không dừng các container Cloud đang chạy. Nhật ký: `%LOCALAPPDATA%/LimixBot-Server/host.log`, xoay ở khoảng 5 MB. Một lần đối soát có thể kéo dài hơn 30 giây; khoảng nghỉ giữa hai lượt là 30 giây. Tác vụ tự chạy lại khi thoát lỗi, không giới hạn thời gian chạy và không tự chỉnh Sleep của Windows.

Nếu lỗi trước khi chuyển xong volume, bộ cài thử chạy lại các container cũ đã dừng. Nếu volume WSL đích đã có dữ liệu, bộ cài dừng, không ghi đè. Nếu đã bắt đầu tác vụ mới thì không tự khởi động bộ cũ khi có lỗi sau đó; kiểm tra trước khi quay lại để tránh chạy trùng. Không tự xóa WSL hoặc volume để thử lại.

Quay lại thủ công: Dừng tác vụ mới, xác nhận các container Cloud trong `LimixCloud` đã dừng, rồi khởi động các container gốc theo danh sách `OriginalContainers` trong `server.json` và chạy host Docker Desktop cũ. Những thay đổi phát sinh trên WSL sau chuyển đổi không tự sao chép ngược. Đổi mật khẩu Windows sẽ cần đăng ký lại mật khẩu cho tác vụ; phiên bản beta chưa có nút cập nhật mật khẩu tác vụ. Không lưu mật khẩu Windows trong script riêng.

Chưa có quản lý cài mới không có host.xml, cập nhật tự động image, gỡ cài tự động hoặc UI điều chỉnh cấu hình WSL. Chữ ký mã Windows chưa được cấp. Cần bảo đảm nguồn tải đúng; file beta chưa ký có thể bị Windows cảnh báo.

### Kiểm chứng

```powershell
python -m unittest discover -s deploy/windows-server-app -p 'test_*.py' -v
node --test deploy/managed-beta/docker-backend.test.mjs deploy/managed-beta/host.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/windows-server-app/build.ps1
dotnet deploy/windows-server-app/bin/Release/net8.0-windows/win-x64/LimixServer-Setup.dll --verify
```

6 phép thử cài đặt giả lập xác minh thứ tự sao lưu/nhập volume, mật khẩu sai không dừng container, lỗi xuất/nhập phục hồi container cũ và từ chối ghi đè dữ liệu đích. 11 phép thử Node xác minh đối soát/cách ly và chuyển Docker sang WSL mà không đưa secret vào argv. Kiểm thử này không chạy WSL, không tạo tác vụ thật và không thay đổi Docker người dùng.

## English

This beta installer migrates an already-configured Windows Docker Desktop Cloud host to a dedicated `LimixCloud` WSL 2 distribution. It registers a noninteractive startup task under the current Windows account using a locally supplied Windows password. Existing DPAPI host configuration is retained. The host supervisor retries reconciliation, holds the WSL session open and rotates logs. Windows Task Scheduler restarts the task if it exits with an error.

The installer needs administrator access, WSL 2, Node 24+, an existing Linux Docker Desktop engine/image and sufficient free space. It downloads an official Ubuntu 24.04 rootfs over HTTPS and verifies its pinned SHA-256 before importing it; a changed upstream archive is rejected. Docker Engine packages come from Ubuntu repositories. It saves the configured Cloud image, stops only labeled Cloud/explicit ingress containers, exports and imports their Cloud volumes, then starts the new task. Original volumes and backups are retained. Existing destination data is never overwritten. A failed migration attempts to restart original containers before the new host starts; post-start failures require deliberate operator recovery.

There is no general fresh-host setup or automatic image upgrade in this version. Do not run the old and new host simultaneously. A real reboot-before-logon acceptance test on the target Xeon is required. No such live acceptance is implied by mock tests, payload inspection or successful compilation.

References: [Microsoft WSL import](https://learn.microsoft.com/en-us/windows/wsl/use-custom-distro), [Ubuntu rootfs and checksums](https://cloud-images.ubuntu.com/wsl/releases/noble/current/), [Docker Desktop logon startup](https://docs.docker.com/desktop/settings-and-maintenance/settings/).
