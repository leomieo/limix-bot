# Điều phối và chống vòng lặp

## Nguồn thật

- Agent Desktop: https://github.com/vercel-labs/agent-desktop — MCP tools đặt tiền tố `desktop_` (`desktop_snapshot`, `desktop_click`...). `ref_id` có snapshot ID và mất hiệu lực khi UI thay đổi. Công cụ có thể trả `STALE_REF`, `AMBIGUOUS_TARGET`; đọc JSON `error.disposition.retry` trước khi thử lại.
- Windows-MCP: https://github.com/CursorTouch/Windows-MCP — Tools `Snapshot`, `Screenshot`, `Click`, `Type`, `App`, `FileSystem`, `Process`, `PowerShell`, `Registry`, `ControlStatus`, v.v. Kiểm tra khả năng hiện hành bằng `list_tools`.

## Thuật toán từng step

1. Kiểm tra quyền trước, sau đó yêu cầu backend cấp `desktop_id` lock nếu có nhập liệu.
2. Đọc snapshot/capabilities. Với phần tử accessibility đủ tin cậy, dùng Agent Desktop; với tác vụ hệ thống dùng Windows-MCP.
3. Chọn đúng tool và schema runtime từ `list_tools` của MCP Server; đừng suy diễn chữ ký tham số.
4. Gọi tool một lần. Ghi `step_id`, provider, tên tool, thời điểm và trạng thái ở log tối giản.
5. Quan sát lại điều kiện thành công độc lập với response; ghi idempotency key đã hoàn tất.
6. Nếu tool lỗi: xác định việc có thể đã thực thi hay chưa. Chỉ retry nếu upstream xác nhận `retry=safe` hoặc kiểm tra chắc chắn chưa có hiệu ứng. Với ref cũ, refresh snapshot trước.
7. Không có tiến triển trong hai chu kỳ, xung đột desktop, hoặc phải xin quyền mà host không cấp → `HALTED`, kèm lý do và trạng thái hiện tại.

## Trường hợp fallback

- Agent Desktop không thể định vị phần tử: Windows-MCP `Snapshot` mới + `Click`/`Type`, không dùng lại tọa độ cũ.
- Windows-MCP không có công cụ file được cấp quyền: không mô phỏng việc xóa/ghi file bằng chuột để lách policy.
- Một provider bị rớt kết nối: nếu bước mang tác dụng phụ chưa rõ trạng thái, chỉ quan sát; không lập tức thực thi lại với provider kia.

## Kiểm soát context

Giữ `task_id`, `step_id`, `window_id`, `snapshot_id`, trạng thái mong đợi và digest ngắn. Không lưu toàn bộ screenshot hoặc nội dung clipboard vào lịch sử model. Không gộp đầu ra không liên quan trong cùng một tool response. Retry và checkpoint là trách nhiệm host; prompt không thay thế được rào chắn ở backend.
