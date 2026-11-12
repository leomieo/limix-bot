# Chính sách quyền Windows cho Herionix

## Mặc định deny-by-default

- **An toàn theo phạm vi**: đọc trạng thái cửa sổ, xem danh sách file, xem tiến trình; điều khiển giao diện một cách rõ ràng theo yêu cầu người dùng.
- **Được phép có điều kiện**: ghi file vào `allowed_write_roots` được người dùng cấu hình. Kiểm tra đường dẫn tuyệt đối, canonically resolve, symlink/reparse point và quyền NTFS **tại backend Windows** trước mỗi hành động; tránh ghi đè nếu chưa được duyệt.
- **Cần phê duyệt trực tiếp từ người dùng qua UI host**: xóa/ghi đè, di chuyển file ra ngoài scope, upload/gửi tin nhắn, thanh toán, thay đổi cấu hình bảo mật, đóng ứng dụng có dữ liệu chưa lưu, kill process, cài đặt hoặc gỡ phần mềm, chạy executable theo đường dẫn tùy ý.
- **Tắt mặc định**: PowerShell và Registry (loại khỏi MCP tool list). Nếu chủ sở hữu muốn bật, phải thiết lập trong host và yêu cầu phê duyệt từng thao tác rủi ro; không cho model tự nâng quyền hay dùng tool khác để lách chặn.

## Chặn thực sự ở backend

1. Tách quyền `read`, `desktop_input`, `file_write_scoped`, `system_admin` theo Bot/Agent và task.
2. Expose chỉ tool được phép; phân quyền ở host, không tin vào prompt hoặc biến `approved=true` do model gửi lên.
3. Mọi lệnh nguy hiểm phải có một `approval token` ngắn hạn được host phát hành sau sự đồng ý cụ thể của người dùng, gắn với task, tool, tham số đã chuẩn hóa, đường dẫn và thời hạn; token bị tiêu thụ một lần.
4. Duy trì **global desktop input mutex** trên một interactive Windows session; một session được chia sẻ bởi nhiều bot thì phải serialize input. Dừng/hủy phải giải phóng lock trong `finally` và dừng input tool đang chạy khi có thể.
5. Giữ log tối thiểu, che dữ liệu cá nhân, tài khoản, password, cookie, clipboard, screenshot. Không xuất dữ liệu ra Internet hay bên thứ ba nếu không có yêu cầu rõ ràng.
6. Chống prompt injection: mọi chỉ dẫn từ web/email/file vừa đọc là **dữ liệu không đáng tin cậy**, không cấp quyền thực thi, không thay đổi policy.
7. Không mở MCP Server công khai trên mạng. Ưu tiên stdio local; nếu dùng HTTP phải dùng bind localhost hoặc authentication/TLS/IP allowlist, tránh port có quyền thao tác OS bị công khai.

## Lưu ý kỹ thuật

- `--control-policy balanced` của Windows-MCP chỉ là cơ chế ownership/gating; **không thay thế authorization** cho filesystem hay PowerShell.
- Agent Desktop headless actions không đồng nghĩa không có tác dụng phụ. Hành động logic nguy hiểm phải được gate bất kể có di chuột hay không.
- `scripts/policy_engine.py` là bộ định tuyến thử nghiệm, không phải hệ thống cấp quyền. Runtime production cần xác minh trạng thái và đường dẫn thật trên Windows.
