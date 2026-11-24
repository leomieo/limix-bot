# Dùng mẫu bot theo ngành trong Limix Bot

Chọn **Siêu bot CSKH** khi một đầu mối cần tiếp nhận khách từ nhiều kênh. Chọn **mẫu phòng ban** khi đã biết người phụ trách, ví dụ bộ phận đổi trả. Chọn **nhóm ngành** khi muốn có cả bàn tiếp nhận, ba bot chuyên môn và phòng nội bộ để bàn giao ca.

## Chọn mẫu

Trong **Trợ lý Limix**, chọn **Chọn bot cho phòng ban** để xem 30 vai trò, **Tìm nhóm bot theo ngành** để xem 10 nhóm, hoặc **Xem mẫu Siêu bot CSKH** để mở thẻ CSKH. Các gợi ý có trong lời chào và bảng chi tiết của trợ lý đối với người có quyền thêm mẫu trên máy chủ. Sau khi xem thẻ, chọn **Dùng mẫu** để tiếp tục tạo bot hoặc nhập nhóm.

Trong thư viện bot, lọc theo ngành, mở thẻ để đọc mô tả rồi chọn **Dùng mẫu**. Kiểm tra tên và mô hình trong hộp tạo bot. Bộ mẫu ngành được đóng gói cùng ứng dụng nên có thể chọn khi kho mẫu trực tuyến mất kết nối. Việc trả lời bằng AI vẫn phụ thuộc vào mô hình đã cấu hình.

| Ngành | Bot phòng ban 1 | Bot phòng ban 2 | Bot phòng ban 3 |
|---|---|---|---|
| Bán lẻ và thương mại điện tử | Tư vấn sản phẩm | Điều phối đơn hàng | Chăm sóc đổi trả |
| Nhà hàng và đồ uống | Tư vấn thực đơn | Đặt bàn nhà hàng | Hậu mãi nhà hàng |
| Làm đẹp và spa | Tư vấn dịch vụ spa | Điều phối lịch spa | Chăm sóc sau dịch vụ |
| Giáo dục và đào tạo | Tư vấn tuyển sinh | Giáo vụ lớp học | Học vụ tài chính |
| Lưu trú và du lịch | Tư vấn hành trình | Đặt chỗ du lịch | Hỗ trợ khách lưu trú |
| Bất động sản | Tư vấn bất động sản | Điều phối lịch xem | Điều phối hồ sơ nhà đất |
| Vận tải và giao nhận | Báo cước vận chuyển | Điều vận bưu gửi | Đối soát giao nhận |
| Dịch vụ và sửa chữa ô tô | Tiếp nhận xe | Dự toán phụ tùng | Bảo hành xưởng xe |
| Dịch vụ tại nhà | Khảo sát nhu cầu tại nhà | Điều phối kỹ thuật | Bảo hành dịch vụ tại nhà |
| Bán buôn và phân phối | Kinh doanh đại lý | Vận hành đơn sỉ | Đối soát đại lý |

Để tạo cả nhóm, vào thư viện nhóm, chọn **Nhóm** mang tên ngành, xem trước và xác nhận nhập. Mỗi nhóm có bốn bot. Siêu bot CSKH là người trả lời mặc định trong phòng **Tiếp nhận · [tên ngành]**. Quy trình **Tiếp nhận và bàn giao** hướng dẫn gọi `@` đúng tên một thành viên trong phòng và ghi nguồn đã kiểm tra, phần còn thiếu cùng việc cần xử lý. Trong cuộc trò chuyện với khách, bot chỉ chuẩn bị tóm tắt. Nhân viên hoặc hệ thống tiếp nhận cần xác nhận trước khi báo khách đã chuyển việc.

## Bộ công cụ có sẵn

Các mẫu dùng chung runtime của Limix Bot, với hướng dẫn riêng về dữ liệu đầu vào và bàn giao theo vai trò. Skill `industry-customer-care` đi kèm CLI và máy chủ MCP `industry-care`. Bot mới dùng chế độ hỏi trước, tắt máy tính, trình duyệt và Composio. Quyền công cụ mặc định gồm ba lệnh đọc.

| Công cụ MCP | Đầu vào | Dùng kết quả |
|---|---|---|
| `care_triage` | `text` và tùy chọn `channel` | Đề xuất bộ phận cùng bước tiếp theo. Ví dụ, “tôi muốn hoàn tiền” cần người có quyền xét duyệt. |
| `care_lookup` | `sku` khớp chính xác | Trả tên, giá, đồng tiền, tình trạng hàng, nguồn và thời điểm hiệu lực của bản ghi đã duyệt. |
| `care_prepare_case` | `industry`, `role`, mã hồ sơ `caseRef` tùy chọn | Chuẩn bị bản nháp nội bộ theo đúng một trong 30 vai trò. Kết quả ghi rõ dữ liệu cần có, cách xử lý và điều kiện bàn giao. |

Trên runtime hỗ trợ MCP tùy chỉnh, cuộc trò chuyện của người vận hành có thể dùng các công cụ theo chính sách máy chủ. Ở chế độ bot chạy trong hộp cách ly, host bỏ qua tiến trình MCP cục bộ này. Đối với khách, host tự phân loại và tìm mã được ghi rõ, ví dụ **“Giá SKU SP-001?”**, rồi đưa kết quả công khai vào lượt trả lời. Khách không được cấp CLI, MCP hay quyền của chủ kênh.

## Nạp danh mục cho một bot

Trên máy chạy server, người quản trị tạo tệp `<DATA_DIR>/industry-customer-care/<botId>/public-catalog.json`. Dùng ID của **bot đã tạo**, vì mỗi lần tạo mẫu sinh một bot mới. Mỗi thành viên nhóm có phạm vi riêng. Chỉ thêm những mặt hàng và dữ kiện mà doanh nghiệp cho phép báo công khai cho khách.

Ví dụ dưới đây dùng bot và giá giả lập. Khi áp dụng, thay `scope`, nguồn, giá và hai mốc UTC theo đợt công bố thực tế.

```json
{
  "schemaVersion": 1,
  "scope": "demo-shop",
  "records": [
    {
      "sku": "SP-001",
      "name": "Bình nước mẫu",
      "visibility": "public",
      "status": "approved",
      "priceMinor": 125000,
      "currency": "VND",
      "availability": "in_stock",
      "source": "Bảng giá công khai cửa hàng mẫu, kỳ tháng 11/2026",
      "asOf": "2026-11-01T00:00:00Z",
      "validUntil": "2026-12-01T00:00:00Z"
    }
  ]
}
```

`priceMinor` là số nguyên tính theo đơn vị nhỏ nhất của đồng tiền. Ví dụ trên tương ứng **125.000 đồng**. `availability` nhận `in_stock`, `out_of_stock` hoặc `on_request`. Bot chỉ dùng bản ghi từ `asOf` đến trước `validUntil`. Khi chưa có danh mục, công cụ trả `not_configured`. Khi thiếu SKU phù hợp hoặc bản ghi hết hạn, công cụ trả `no_current_record`. Tệp có phạm vi sai, dữ liệu lỗi hoặc nhiều bản ghi đang hiệu lực cho cùng SKU có thể trả `unavailable`. Trong các trường hợp này, bot cần hỏi lại mã hoặc nhờ nhân viên xác minh.

### Kiểm tra CLI và MCP trên máy phát triển

Chạy PowerShell tại thư mục gốc mã nguồn. Giả sử đã lưu tệp mẫu vào thư mục thử dưới đây. Hai tham số `--scope` và `--catalog-dir` do người vận hành đặt, thư mục phải là đường dẫn tuyệt đối.

```powershell
$careEntry = 'skills/industry-customer-care/scripts/care.mjs'
$careCatalog = Join-Path $env:TEMP 'limix-care-demo/demo-shop'
'{"text":"refund request","channel":"telegram"}' | node $careEntry triage
'{"industry":"retail-ecommerce","role":"returns-desk","caseRef":"CASE-15"}' | node $careEntry prepare
'{"sku":"SP-001"}' | node $careEntry lookup --scope demo-shop --catalog-dir $careCatalog
node $careEntry mcp --scope demo-shop --catalog-dir $careCatalog
```

Lệnh cuối mở máy chủ stdio để client MCP gửi `initialize`, `tools/list` rồi `tools/call`, mỗi thông điệp JSON-RPC nằm trên một dòng. Khi Limix Bot khởi chạy công cụ cho một bot, server tự đặt phạm vi và thư mục tương ứng.

Để lấy mã cho bộ phận khác, mở `skills/industry-customer-care/assets/industry-profiles.json`. Chọn `slug` của ngành làm `industry` và một `slug` trong `roles` của chính ngành đó làm `role`. Ví dụ trên chuẩn bị hồ sơ đổi trả của ngành bán lẻ. Nhân viên dùng kết quả để thu thập dữ kiện, sau đó xác nhận việc tiếp nhận trong hệ thống nghiệp vụ của doanh nghiệp.

## Kết nối các kênh CSKH

Mở **Cài đặt của bot** đã chọn làm đầu mối và tìm thẻ của kênh. Sau khi kết nối, bật **Trả lời cả người khác** nếu muốn phục vụ khách bên ngoài. Với Zalo, kiểm tra riêng công tắc **Trả lời khi được @gọi trong nhóm**.

| Kênh | Kết nối hiện có trong Limix Bot | Điều kiện vận hành |
|---|---|---|
| Zalo | Đăng nhập tài khoản Zalo cá nhân bằng QR | Dùng phiên Zalo Web qua thư viện kết nối cá nhân. Đăng nhập Web tại nơi khác có thể ngắt phiên. |
| Facebook Page | Dán Page access token để đọc và trả lời hộp thư của Trang qua Graph API | Kiểm tra quyền nhắn tin của ứng dụng Meta cho nhóm người nhận dự kiến. Server thăm dò hội thoại của Trang. |
| Messenger cá nhân | Đăng nhập trong cửa sổ Facebook của ứng dụng desktop | Tích hợp thử nghiệm, cần mở ứng dụng trên máy đó. Mọi người gửi dùng quyền khách. |
| Telegram | Dán token bot do BotFather cấp | Server lấy tin qua long polling. Dùng tài khoản khách riêng để kiểm tra đường nhận và trả lời. |

Với kênh hỗ trợ ghép chủ bot, tin nhắn riêng từ chủ đã ghép đi theo luồng người vận hành. Kiểm tra trải nghiệm khách bằng một tài khoản khác. Thông tin đăng nhập kênh phải được cấu hình cho từng doanh nghiệp.

## Kiểm tra trên dữ liệu cô lập

Trong mã nguồn, chạy bộ kiểm tra sau. Các bài E2E tự khởi động server, thư mục dữ liệu tạm và engine giả theo quy trình kiểm chứng của dự án.

```powershell
node --test scripts/industry-customer-care.test.mjs
.\node_modules\.bin\vitest.CMD run server/industry-bot-create.e2e.test.ts server/industry-teams.e2e.test.ts server/industry-care.e2e.test.ts
```

Bài kiểm tra trên host cục bộ dùng engine Claude giả lập phiên bản `2.1.284`. Lượt của nhân viên được gắn MCP với toàn bộ công cụ gốc của engine đã tắt. Lượt của khách chạy trong chế độ giới hạn. Với SKU giả, engine nhận nguồn giá của đúng bot, còn ghi chú nội bộ và danh mục sai phạm vi được giữ ngoài ngữ cảnh. Driver Codex hiện từ chối phạm vi quyền công cụ này. Khi bot chạy trong hộp cách ly, lượt của nhân viên chưa dùng được MCP cục bộ qua cách gắn trực tiếp.

Fixture cũng đã đưa tin nhắn giả lập qua hộp thư đến của cầu nối Messenger cá nhân, đọc phản hồi từ hộp thư đi và xác nhận mã gửi qua cầu nối. Việc khách thực sự nhận được tin từ tài khoản Messenger, Facebook Page, Zalo hay Telegram của doanh nghiệp vẫn cần nghiệm thu trên từng kênh.

## Kết nối nghiệp vụ của doanh nghiệp

Để bot **tra đơn riêng, đặt lịch hoặc hoàn tiền**, doanh nghiệp cần cấp API nghiệp vụ tương ứng. Bắt đầu bằng thao tác đọc có xác minh danh tính khách, kiểm tra quyền trên server và truy vấn đúng doanh nghiệp. Với thao tác ghi, bổ sung xác nhận, khóa chống thực hiện trùng, nhật ký cùng mã biên nhận. Với tài liệu chính sách dài, nối nguồn tri thức có phân quyền và trích dẫn. Danh mục SKU hiện tại phục vụ tra cứu chính xác từ tệp công khai.
