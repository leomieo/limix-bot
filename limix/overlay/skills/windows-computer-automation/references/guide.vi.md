# Windows Computer Automation — hướng dẫn tiếng Việt (cho người đọc)

> Bản tiếng Việt của SKILL.md, để người dùng đọc. Agent làm theo SKILL.md (tiếng Anh) — khi hai bản khác nhau, SKILL.md đúng.



## Mục tiêu

Dùng **Agent Desktop** cho phần tử giao diện Windows dựa trên accessibility tree; dùng **Windows-MCP** cho công cụ hệ thống, filesystem, app, process và dự phòng UI khi thích hợp. Đây là Skill hướng dẫn điều phối: **không tự cài MCP Server hoặc cấp quyền cho máy**. Chỉ thực thi khi Herionix đã kết nối thực tế với các MCP Server và tool được cấp phép.

## Quy trình bắt buộc

1. **Xác định nhiệm vụ và giới hạn:** Xác nhận ứng dụng/cửa sổ, đầu vào/đầu ra, đường dẫn file, hành động cuối cùng có được phép thực hiện không. Phân biệt chỉ đọc với thay đổi hệ thống.
2. **Khám phá năng lực thật:** Lấy `list_tools` của hai MCP Server; không giả định tool có mặt chỉ vì tài liệu có tên. Kiểm tra trạng thái desktop, hệ điều hành, phiên đăng nhập và quyền. Nếu thiếu connector, dừng và thông báo cụ thể; không giả vờ đã thao tác.
3. **Kiểm tra rủi ro:** Đọc [references/security.md](references/security.md). Những tác vụ xóa/ghi đè, chạy lệnh, sửa Registry, gửi nội dung ra ngoài, thanh toán, đổi quyền hoặc tắt tiến trình cần quyết định theo policy của host. Model **không tự phê duyệt**. Host phải chặn hành động trước khi gọi tool.
4. **Điều phối một desktop:** Một `desktop_id` chỉ được có **một agent giữ quyền ghi/nhập liệu** tại một thời điểm; khóa ở backend Herionix, không chỉ trong prompt. Nhiều agent có thể lập kế hoạch/đọc nếu đọc không cản trở; việc ghi phải đi qua hàng đợi.
5. **Quan sát trước khi thao tác:** Ưu tiên accessibility tree, ref và window ID; tránh tọa độ nếu còn lựa chọn định danh ổn định. Chọn provider theo bảng dưới đây và [references/routing.md](references/routing.md).
6. **Thực thi tối thiểu:** Mỗi lần chỉ thực thi bước cần thiết. Không gọi song song hai tool nhập liệu. Sử dụng key chống trùng `task_id + step_id + target + desired_effect` do backend cấp.
7. **Xác minh sau thao tác:** Đọc lại phần tử/trạng thái/file hoặc kết quả tương ứng, xác nhận hậu điều kiện. `tool returned success` không đồng nghĩa công việc đã hoàn thành.
8. **Phục hồi có giới hạn:** Với `STALE_REF`/`AMBIGUOUS_TARGET`, làm mới snapshot và định vị lại. Chỉ retry khi upstream công bố an toàn hoặc hậu điều kiện chứng minh chưa xảy ra tác dụng phụ. Dừng sau tối đa **1 retry kỹ thuật** cho một bước, hoặc **2 chu kỳ không tiến triển**; không gọi vòng lặp vô hạn, không tự `microcompact` để che lỗi.
9. **Báo cáo:** Trả lời ngắn bằng tiếng Việt: việc đã làm/đã xác minh, file được tạo (nếu có), bước chưa hoàn tất, các phê duyệt cần thiết, lỗi và bằng chứng không nhạy cảm. Không ghi log ảnh/chụp clipboard chứa bí mật.

## Chọn công cụ

| Tình huống | Ưu tiên | Dự phòng / điều kiện |
|---|---|---|
| Đọc/nhấn/nhập trên UI có ref định danh | Agent Desktop: `desktop_snapshot`, `desktop_click`, `desktop_type`... | Windows-MCP `Snapshot` + `Click`/`Type` sau khi định vị mới |
| Giao diện không xuất accessibility hoặc điều khiển tọa độ | Windows-MCP `Snapshot` / `Screenshot`, `Click`, `Type` | Agent Desktop `--headed` chỉ khi cần và được phép |
| Khởi động, chuyển cửa sổ ứng dụng | Windows-MCP `App` | Agent Desktop `desktop_launch` / window tools nếu có |
| Xem, ghi file trong thư mục được cho phép | Windows-MCP `FileSystem` | Không thay bằng UI nếu có API/file-tool tin cậy |
| Kiểm tra tiến trình | Windows-MCP `Process` (chỉ list) | Terminate yêu cầu xác nhận từ host |
| PowerShell / Registry | **Mặc định không mở quyền** | Chỉ bật có chủ đích trong môi trường kiểm soát, qua host approval |
| Trang web cần DOM | Windows-MCP `Snapshot` (`use_dom` nếu phiên bản hỗ trợ) | Với luồng web phức tạp, cân nhắc browser automation chuyên biệt |

**Không chuyển provider để retry mù:** Sau lỗi của một thao tác có tác dụng phụ, phải quan sát và xác minh trạng thái trước khi quyết định bước tiếp theo.

## Luồng chống tốn token

- Lưu `window_id`, `snapshot_id`, mục tiêu và tóm tắt trạng thái ngắn; **vô hiệu** ref cũ sau mỗi thay đổi UI.
- Không gửi ảnh toàn màn hình ở mọi bước; dùng tree compact, vùng chụp nhỏ hoặc snapshot theo app.
- Chỉ tiếp tục khi có `progress marker` mới (trạng thái thay đổi, file xuất hiện, nút đổi trạng thái, trang chuyển); nếu hai lần không có tiến triển, dừng và báo lỗi.
- Nếu hai agent cùng xin điều khiển, chỉ một agent thực thi; agent còn lại chờ hoặc làm việc không tác động desktop.

## Kết nối và kiểm thử

- Tham khảo [references/herionix-integration.md](references/herionix-integration.md) để cài và kết nối hai MCP Server qua stdio.
- Dùng [assets/mcp-servers.example.json](assets/mcp-servers.example.json) làm cấu hình minh họa, **không coi là file cấu hình Herionix chính thức**.
- Có thể dùng `scripts/policy_engine.py` làm ví dụ bộ định tuyến/rào chắn **không có quyền tự thực thi OS**; backend phải thực hiện kiểm tra policy, khóa và approval thật. Ví dụ và kiểm thử: [references/scenarios.md](references/scenarios.md).

## Cách ứng xử khi không có quyền điều khiển máy

Trình bày kế hoạch, lệnh cấu hình hoặc code phù hợp; nói rõ chưa thi hành và chưa xác minh trên Windows thật. Không tuyên bố đã tích hợp vào máy hay Herionix nếu chưa có truy cập đến mã nguồn và runtime của ứng dụng.
