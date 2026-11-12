# Ví dụ chạy Skill

## A. Nhập liệu qua UI

Người dùng: "Mở Notepad và nhập nội dung tôi vừa đưa."

1. Windows-MCP `App` hoặc Agent Desktop launch ứng dụng, sau khi quan sát.
2. Agent Desktop `desktop_snapshot` chọn đúng Notepad/window; lấy ref ô soạn thảo hiện tại.
3. Khóa `desktop_id`; `desktop_type` một lần theo ref hợp lệ.
4. `desktop_snapshot` lại và xác minh có nội dung mong đợi; giải phóng lock.
5. Chưa có yêu cầu lưu file thì không tự lưu vào vị trí bất kỳ.

## B. Thu thập dữ liệu từ web ra thư mục Windows

Người dùng: "Thu thập tiêu đề video công khai và lưu CSV tại thư mục X."

1. Dùng công cụ web/trình duyệt được cấp quyền để thu thập dữ liệu công khai. Tránh scraping vi phạm điều khoản và dữ liệu riêng tư.
2. Xác nhận `X` là đường dẫn tuyệt đối và nằm trong thư mục đã được người dùng cho phép.
3. Windows-MCP `FileSystem` tạo CSV ở đường dẫn được phép nếu có tool, không ghi đè file tồn tại khi chưa xác nhận.
4. Kiểm tra file tồn tại, kích thước/nội dung hợp lệ; trả về đường dẫn và số dòng đã kiểm chứng.

## C. Chặn hành động nguy hiểm

Bot: "Xóa toàn bộ thư mục Downloads để dọn máy".

1. Không dùng FileSystem, PowerShell, Explorer hay shortcut để thực thi ngay.
2. Trả về yêu cầu xác nhận rõ phạm vi; giao cho UI host hiển thị danh sách file sẽ xóa.
3. Không có approval hợp lệ: dừng. Có approval: backend thực thi đúng các file đã được duyệt, không thêm phạm vi.

## D. Khắc phục lặp thao tác

Bot click nút gửi nhưng mất kết nối MCP trước khi nhận response.

1. Coi kết quả là **không chắc chắn**; không click lại.
2. Quan sát lại hộp thoại hoặc lịch sử gửi, xác nhận đã gửi hay chưa.
3. Nếu chưa xác định được, dừng và hỏi người dùng thay vì gây gửi trùng.

## E. Gợi ý gọi policy engine

```bash
python scripts/policy_engine.py --config assets/control-policy.example.json --request '{"kind":"ui","operation":"click","observed":true,"target":{"ref_id":"@s123:e8"}}'
```

Kết quả JSON chỉ cho biết đường định tuyến/phán đoán; **không có tool nào đã được gọi**.
