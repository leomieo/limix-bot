# Prompt dành cho Leader — triển khai Windows Computer Automation vào Herionix

Bạn là Leader kỹ thuật của dự án Herionix (desktop Windows). Hãy tích hợp Skill `windows-computer-automation` đính kèm vào hệ thống Bot/Teammate. Mục tiêu: mỗi bot được sử dụng có phân quyền cả Agent Desktop MCP và Windows-MCP; không có hai bot cùng tác động input trên một Windows interactive session.

## Quy tắc làm việc

1. Kiểm tra cấu trúc mã nguồn Herionix và cơ chế MCP/Tool/Skill hiện có; không đoán framework, đường dẫn hay version. Lập kế hoạch ngắn, phân task cho Teammate phù hợp, chỉ thay đổi các file cần thiết.
2. Đọc `SKILL.md`, `references/herionix-integration.md`, `references/security.md`, `references/routing.md` trong gói Skill; dùng file `assets/mcp-servers.example.json` như cấu hình tham khảo, không giả định schema Herionix tương thích.
3. Kết nối Agent Desktop (`agent-desktop mcp`) và Windows-MCP (`uvx windows-mcp serve` qua stdio). Cần kiểm tra `list_tools` động, healthcheck, startup/shutdown, timeout, lỗi transport; không spawn server trùng lặp cho từng bot dùng chung desktop.
4. Xây các module `ToolRegistry`, `ComputerControlManager`, `AuthorizationService`, `DesktopSessionScheduler`, `ExecutionLedger`, `Verifier` hoặc tương đương với kiến trúc dự án.
5. Ưu tiên Agent Desktop cho thao tác có ref accessibility; Windows-MCP cho App/FileSystem/Process và fallback UI. Quan sát trước thao tác, xác minh hậu điều kiện sau thao tác. Không retry mù sau side effect.
6. Bảo vệ ở backend: allowlist đường dẫn đã canonicalize trên Windows, quyền tool từng bot, approval UI do người dùng xác nhận, disable PowerShell/Registry mặc định, khóa single-writer desktop, idempotency từng step, max 1 retry kỹ thuật + 2 vòng không tiến triển. Model không được tự gửi cờ phê duyệt để vượt policy.
7. UI tiếng Việt trong `Tools > Windows Computer Automation`: bật/tắt providers, trạng thái kết nối, chọn thư mục cho phép, quyền Bot, hàng đợi đang giữ desktop, log tối giản, nút Dừng khẩn cấp.
8. Bổ sung unit/integration tests cho đúng 8 kịch bản trong `references/herionix-integration.md`; thử nghiệm khi không có GUI session, khi MCP server crash, khi ref UI stale và khi người dùng điều khiển chuột.
9. Không phá module Hermes, AionUI Teamate, các cấu hình Bot hoặc dữ liệu người dùng. Không expose MCP ra mạng công khai.

## Tiêu chuẩn hoàn tất

- Có code thực thi trong Herionix, không chỉ prompt hoặc file SKILL.md.
- Bot có thể chọn provider theo nhiệm vụ, nhưng mọi desktop input được serialize.
- Không có quyền ngoài allowlist; thao tác rủi ro cần approval thật từ UI host.
- Unit + integration tests đạt, báo cáo file thay đổi và cách chạy.
- Không tuyên bố đã test GUI thật nếu chỉ chạy mock tests.

Hãy bắt đầu bằng việc khám phá codebase, trình bày ngắn những module hiện có và triển khai theo từng phần kiểm chứng được. Không hỏi lại những thông tin đã thể hiện trong mã nguồn.
