# Limix Cloud Server 0.2 beta — Hyper-V

## Tiếng Việt

Tạo máy Linux Hyper-V riêng cho Cloud trên Windows Pro/Enterprise, tự bật cùng Windows không cần Sign in hoặc mật khẩu. HP Z840 cần BIOS After Power Loss = On và VTx enabled; Windows không được Sleep. Không chỉnh tự đăng nhập/mật khẩu Windows. CRM và volume Docker Desktop gốc được giữ.

### Cài đặt

1. Dừng cửa sổ host cũ bằng Ctrl+C, giữ Docker Desktop mở. Dùng tài khoản Windows đang có cấu hình LimixBot-Managed-Host/host.xml. Cần quyền UAC quản trị.
2. Mở LimixServer-Setup.exe bản 0.2, bấm Kiểm tra Hyper-V. Nếu chưa bật tính năng Windows thì bấm Bật Hyper-V, tự reboot khi Windows yêu cầu rồi mở lại. Chỉ bật BIOS chưa đủ; bộ cài không tự reboot.
3. Mặc định 4 vCPU, 12 GB RAM cố định, ổ hệ thống 120 GB mở rộng động. Đây là giới hạn tổng của môi trường Cloud. Switch Default Switch phải tồn tại và có Internet; không tự đổi card mạng đang dùng từ xa.
4. Xác nhận đã dừng host cũ, bấm Cài đặt và chuyển Cloud. Tải Ubuntu/Node chính thức, kiểm tra SHA-256, sao lưu image/volume, tạo ổ VM, nhập dữ liệu rồi kiểm tra trước khi kích hoạt. Chuẩn bị có thể 10–30 phút. Cần đủ chỗ cho image, bản sao, ổ chuyển dữ liệu và ổ hệ thống; tối thiểu 25 GB chỉ là kiểm tra ban đầu.
5. Xem trạng thái và thử Cloud từ máy khác. Reboot Xeon, chưa Sign in, kiểm tra lại. Thử ngắt mạng rồi nối lại. Chỉ xác nhận chạy ổn sau kiểm thử thật.

### Phục hồi và giới hạn

- Token/capacity giữ từ cấu hình DPAPI cũ. Không cần Node/WSL chạy trên Windows sau chuyển đổi; runtime Node và Docker nằm trong Linux.
- Chỉ dừng container Cloud được nhận diện và ingress chỉ định. Volume hoặc bind mount chưa hỗ trợ sẽ làm bộ cài dừng để kiểm tra. Không xóa/ghi đè VM có sẵn.
- Chuẩn bị Linux chưa bật connector. Nếu lỗi trước kích hoạt thì thử dừng VM mới và mở lại container cũ; cần chạy lại host cũ để tiếp tục quản lý bản gốc. Sau khi gửi kích hoạt, lỗi mạng không tự bật lại bản cũ vì có thể tạo hai bộ bot. Xem trạng thái/nhật ký; không chạy hai host.
- Hyper-V bật VM cùng Windows; systemd chạy Docker/host và thử lại sau lỗi. Container giữ chính sách restart hiện có. Kernel panic được cấu hình reboot sau 10 giây; không bảo đảm sửa mọi lỗi phần cứng/ổ đĩa.
- Bắt đầu chỉ bật VM đã cài; Dừng tắt VM và autostart, không xóa dữ liệu. Chưa cài thì báo lỗi rõ ràng. Nhật ký Linux lọc token.
- Seed và cấu hình chứa bí mật có ACL riêng. Guest health API cổng 9876 dùng khóa ngẫu nhiên, không trả dữ liệu tài khoản; chỉ dùng mạng nội bộ, không công khai cổng này. Linux không bật đăng nhập SSH bằng mật khẩu hoặc public SSH.
- Bản WSL 0.1 đã có server.json cần chuyển riêng, không tự lấy nhầm dữ liệu Desktop cũ. Không có gỡ/xóa VM tự động, cập nhật image hay đồng bộ ngược thay đổi về Desktop.
- Chưa kiểm chứng migration, Secure Boot, DHCP trước Sign in, reboot và mất mạng trên Xeon thật. Build, mock tests, payload và ảnh giao diện không thay thế kiểm thử máy đích. Windows có PIN mở khóa đĩa trước boot sẽ còn phụ thuộc bước đó.

## English

The 0.2 beta uses a dedicated Hyper-V Ubuntu VM instead of password-based WSL startup. It automatically starts with Windows and runs Docker/host via Linux systemd without interactive Windows sign-in. No Windows passwords or autologon changes. Requires Windows Pro/Enterprise, Hyper-V, an Internet-capable existing switch, an already-configured Docker Desktop Cloud host, administrator access and ample disk space.

Default resources: 4 vCPUs, 12 GB fixed RAM and 120 GB dynamic OS disk. The installer verifies pinned Ubuntu/Node downloads, saves consistent Cloud image/volume backups and prepares Linux without connectors. Only authenticated guest readiness permits activation. Pre-activation failure attempts rollback; ambiguous activation never restarts old connectors. Original volumes/CRM are preserved. Existing VM/unknown mounts are refused. Seed files are ACL-restricted; guest status/logs require a private key. Do not publish port 9876 or run both hosts.

Actual Hyper-V boot, Secure Boot, DHCP before sign-in, migration, network recovery and power restoration on Xeon are NOT verified by automated tests. This unsigned beta needs target acceptance. Legacy WSL source is retained for regression testing but not shipped in the current payload.

## Validation / Kiểm chứng

```powershell
python -m unittest discover -s deploy/windows-server-app -p 'test_*.py' -v
node --test deploy/managed-beta/docker-backend.test.mjs deploy/managed-beta/host.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/windows-server-app/build.ps1
dotnet deploy/windows-server-app/bin/Release/net8.0-windows/win-x64/LimixServer-Setup.dll --verify
```

13 new Hyper-V/guest tests, 6 legacy regression tests and 11 host/backend tests. Tests do not modify real VMs/tasks/Docker.

Sources: [VM startup](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vm), [Linux Secure Boot](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/learn-more/Generation-2-virtual-machine-security-settings-for-Hyper-V), [Ubuntu image](https://cloud-images.ubuntu.com/noble/20261017/), [Node release](https://nodejs.org/dist/v24.14.0/).

## Windows desktop bots / Bot điều khiển Windows
Bộ cài có mục Tự đăng nhập / Limix Bot nền: mở Microsoft Autologon chính thức, xác minh chữ ký Microsoft trước khi chạy. Nhập mật khẩu trực tiếp trong cửa sổ Microsoft; không dùng PIN. Với tài khoản không mật khẩu, thử để trống và xác nhận bằng reboot. Chọn đúng Limix Bot.exe đã cài để thêm mục tự chạy riêng của tài khoản Windows đang mở bộ cài; có nút xóa mục này. Nếu UAC dùng tài khoản quản trị khác, mục tự chạy thuộc tài khoản đó: cần mở bộ cài bằng đúng tài khoản chạy bot. Tắt tự đăng nhập trong Microsoft Autologon bằng Disable. Bộ cài không tự reboot hay thay đổi mật khẩu. Máy khóa/đăng xuất không bảo đảm điều khiển giao diện.

Use Windows desktop startup to open the signed Microsoft Autologon tool and configure an independent per-user Limix Bot startup entry. Passwords are entered only in Microsoft's window. The setup does not change passwords or reboot Windows. Disable automatic Windows sign-in in Autologon; remove the Limix startup entry using the separate disable button. Interactive desktop automation requires an available unlocked desktop. Reboot acceptance on the Z840 remains required.

## Docker services at Windows sign-in / Dịch vụ Docker khác
Mục Docker / Dịch vụ khác tự khởi động chỉ liệt kê container đang chạy; người dùng chọn dịch vụ để đặt unless-stopped, kiểm tra lại cấu hình và lưu chính sách cũ tại thư mục LimixBot-Server. Không stop/recreate/migrate container và không sửa volume. Docker Desktop được thêm vào tự chạy cho tài khoản Windows hiện tại; cần tự đăng nhập nếu muốn hoạt động sau mất điện. Trạng thái chạy không chứng minh ứng dụng khỏe; thứ tự phụ thuộc database và retry do ứng dụng/Compose quản lý. Ghi restart: unless-stopped vào Compose gốc để giữ thiết lập khi tạo lại container. Dịch vụ đã chủ động Stop được giữ tắt. Chưa thử reboot trên máy Xeon thật.

The Docker startup dialog lists running containers for explicit selection, updates only their restart policies and verifies them. Previous policies are saved locally. It does not stop, recreate or migrate services. Docker Desktop starts at Windows sign-in for the current account. Application dependency readiness must be handled by each service or Compose. Preserve restart policies in the original Compose configuration. Physical Xeon reboot acceptance remains outstanding.

## Storage / Nơi lưu dữ liệu
Bắt buộc chọn thư mục lưu trước khi cài. Image xuất ra, bản sao lưu, ổ Hyper-V và file chuyển dữ liệu nằm dưới thư mục riêng LimixCloudServer ở vị trí đã chọn. Có thể chọn thư mục trên cùng ổ với Docker Disk image location; không chọn bên trong thư mục nội bộ chứa VHDX Docker. Bản cài này không tự di chuyển máy Hyper-V đã tồn tại hoặc xóa bản sao lưu cũ. Cấu hình nhỏ vẫn lưu theo tài khoản Windows. Cần dừng phiên cài đang chạy trước khi đổi nơi lưu; giữ nguyên dữ liệu cho tới khi xác nhận hệ thống mới hoạt động.

Select a local storage folder before installation. Large exports, snapshots and Hyper-V disks go under a separate protected LimixCloudServer child. Prefer the Docker data drive without placing files inside Docker's internal VHDX directory. Existing VM disks and previous backups are not moved or deleted automatically.
