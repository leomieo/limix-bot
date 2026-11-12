# Hướng dẫn tích hợp vào Herionix (Windows 10/11)

## 1. Chuẩn bị công cụ

Cài Node.js/npm và Agent Desktop:

```powershell
npm install -g agent-desktop
agent-desktop status
```

Cài `uv` và Python phiên bản phù hợp theo trang Windows-MCP (README hiện nêu Python 3.14+). Với Windows-MCP, dùng lệnh sau để kiểm tra server và lưu ý nó sẽ tiếp tục chạy cho đến khi client/terminal đóng:

```powershell
uvx windows-mcp serve --exclude-tools "PowerShell,Registry" --control-policy balanced
```

Tài liệu nguồn:
- https://github.com/vercel-labs/agent-desktop
- https://github.com/CursorTouch/Windows-MCP

## 2. Đăng ký hai MCP Server vào backend

Xem `assets/mcp-servers.example.json`. Đây là **MCP client config mẫu**, không phải định dạng config Herionix đã được xác nhận. Nếu Herionix dùng định dạng khác, chuyển hai `command` + `args` tương ứng vào cấu hình app. Chạy server trong phiên người dùng đang đăng nhập Windows và dùng stdio local.

Backend phải hỗ trợ startup/healthcheck, khám phá `list_tools`, chuẩn hóa lỗi, timeout, shutdown; không spawn bản sao MCP server cho từng bot nếu chúng cùng điều khiển một session. Nếu máy có nhiều interactive sessions, phân biệt bằng `desktop_id` thực tế.

## 3. Gắn Skill

Đặt thư mục `windows-computer-automation` vào **skills directory mà Herionix thực sự tải**. Gắn Skill cho các Bot/Teammate được cho quyền computer-use. Nếu Herionix chưa có skill loader, cần thêm parser `SKILL.md` và entrypoints tương ứng — chỉ sao chép thư mục chưa biến thành kết nối MCP.

## 4. Component đề xuất

```text
Bot / Teammate
    |  task + intent
    v
ComputerControlManager (orchestrator)
    |-- policy + host approvals
    |-- desktop mutex + task queue
    |-- state snapshots + idempotency
    |-- progress watchdog + verification
    +-- AgentDesktopAdapter ------> agent-desktop MCP
    +-- WindowsMcpAdapter --------> windows-mcp MCP
```

Các module và trách nhiệm:
- `ToolRegistry`: khám phá tên, schema và trạng thái tool của hai server.
- `Planner/Router`: chọn provider theo tác vụ, không tự tạo lại tác dụng phụ khi chuyển provider.
- `AuthorizationService`: người dùng cấp quyền, allowlist path, risk classification và token một lần.
- `DesktopSessionScheduler`: khóa input per desktop/session và hàng đợi công bằng.
- `ExecutionLedger`: task ID, step ID, state digest, trạng thái hoàn thành, idempotency.
- `Verifier`: hậu điều kiện sau thao tác; phản hồi lỗi có phân loại để tránh vòng lặp.

## 5. Cấu hình UI khuyến nghị

Trong `Herionix > Tools > Windows Computer Automation`: bật/tắt cả hai providers; ưu tiên Agent Desktop cho UI; hiển thị số bot đang chờ quyền desktop; cho phép chọn thư mục ghi; quyền admin tools mặc định off; số lần retry tối đa 1; giới hạn 2 vòng không tiến triển; nút Stop/Emergency Release; audit log đã che dữ liệu nhạy cảm.

## 6. Kiểm thử chấp nhận

1. Bot A nhấn nút trong Notepad bằng ref; Bot B chờ, không can thiệp bàn phím.
2. Ref UI hết hạn → snapshot mới; không dùng lại ref cũ và không spam retry.
3. Bot liệt kê file đọc-only; ghi `.txt` trong thư mục cho phép và xác minh file.
4. Xóa file / chạy PowerShell / Registry bị block hoặc yêu cầu host approval tương ứng.
5. MCP Server tắt giữa tác vụ → dừng có trạng thái rõ, không tự lặp thao tác.
6. Cùng một `step_id` gửi hai lần → tác dụng phụ chỉ thực thi tối đa một lần ở host.
7. No progress hai chu kỳ → dừng và báo lý do, không clear context để lặp vô hạn.
8. Không có desktop session/unlock → báo bị chặn, không giả thành công.

## 7. Phạm vi bản đóng gói

Skill này bao gồm quy trình, policy router có thể kiểm thử và cấu hình MCP mẫu. **Chưa phải bản cài đặt Herionix hoặc proxy MCP chạy sẵn**; thực thi connector, mutex liên tiến trình, duyệt quyền và xác minh file thật phải được hiện thực trong Herionix backend.
