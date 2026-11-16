# Limix Cloud managed runtime

[Tiếng Việt](#tiếng-việt) · [English](#english)

## Tiếng Việt

Mỗi máy Cloud được cấp phát có vùng lưu trữ và phiên đăng nhập riêng. Bot có thể nhận tin từ kênh đã kết nối khi môi trường của bot đang chạy và có mạng. Nếu tự vận hành trên Windows, xem [hướng dẫn Limix Cloud Server](../windows-server-app/README.md).

Máy chủ có thể kiểm tra bản cập nhật định kỳ. Máy Cloud đang bận sẽ được hoãn cập nhật. Hệ thống tạo bản sao dữ liệu trước khi đổi image và thử khôi phục nếu bản mới không khởi động. Cần đủ chỗ lưu bản sao và có thể gián đoạn ngắn.

## English

Each provisioned Cloud machine has separate storage and sign-in sessions. Bots can receive messages from connected channels while their environment is running and online. For hosting on Windows, see the [Limix Cloud Server guide](../windows-server-app/README.md).

The host can check for updates periodically. Updates are deferred while a Cloud machine is busy. The host takes a data snapshot before replacing the image and attempts recovery if the new version fails to start. Allow disk space for snapshots and a brief interruption.
