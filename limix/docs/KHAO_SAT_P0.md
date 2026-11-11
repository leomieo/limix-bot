# Báo cáo khảo sát P0 và quyết định kiến trúc — Limix Bot

Ngày 11/11/2026. Nhãn: **ĐÃ XÁC MINH** (đọc mã/tài liệu), **ĐỀ XUẤT** (thiết kế), **CHƯA XÁC MINH**.

## 1. Nền tảng và mốc mã

| Repo | Commit | Vai trò | Giấy phép |
|---|---|---|---|
| milind-soni/OpenMausBot | `6f226f15def56c697626f2ed6dffac416510c79a` (v0.1.153) | Nền tảng chính (chủ dự án chọn) | Apache-2.0, riêng `enterprise/` có điều kiện khác |
| NousResearch/hermes-agent | `b50d007e26006da6bc6ac60cac8da9fe99326362` | Nguồn trích tính năng | MIT |
| jlcodes99/cockpit-tools | `7ca7f0db1f915452681c9bbc366f199e2310761f` | Công cụ quản lý tài khoản AI chạy riêng | CC-BY-NC-SA-4.0 (phi thương mại) |

## 2. OpenMausBot đã có gì (ĐÃ XÁC MINH)

| Nhóm | Trạng thái | Bằng chứng |
|---|---|---|
| Quản lý nhiều bot, giao diện chat, engine Claude/Codex/Grok/ACP/OpenAI-compatible | Có | `README.md`, `docs/custom-engines.md` |
| **Bot API**: ứng dụng ngoài gửi tin vào bot, nhận trả lời | Có | `docs/bot-api.md`, `server/bot-api.ts`, `server/bot-api-host.ts` |
| Bot API chạy giới hạn (Ask, không tool, không shell), 10 tin/phút/khóa, 50 lượt chờ | Có | như trên |
| Tự học skill (authoring) | Có, mặc định bật | `server/config.ts` `skillAuthoringEnabled` |
| Tự review hội thoại để cập nhật skill (port Hermes) | Có, **mặc định tắt** | `server/config.ts` `skillReviewEnabled` cần `features.skillReview: true` |
| Bản cài Windows | Có | `OpenMausBot-setup.exe` trong GitHub Releases (README) |
| Kết nối Telegram / Zalo / WhatsApp / Discord cho người dùng nhắn bot | **Không có** | tìm trong `server/`, `src/`, `shared/` |
| Chạy từ mã nguồn | Cần Node ≥ 24 + pnpm | `package.json` `engines` |

## 3. Quyết định kiến trúc (ADR)

### ADR-1: Không sửa lõi OpenMausBot; Limix Gateway chạy cạnh, gọi Bot API chính thức
- **Bối cảnh:** OpenMausBot ≈7.660 file, cập nhật liên tục; có sẵn Bot API cho ứng dụng ngoài.
- **Quyết định:** Kết nối nền tảng chat nằm trong chương trình riêng `limix-gateway/`, gọi `POST /hooks/api/bots/<id>/messages`.
- **Hệ quả tốt:** cập nhật OpenMausBot không vỡ Limix; người dùng cài bản .exe chính thức, không phải build; mỗi lượt chỉ một engine (OpenMausBot) xử lý.
- **Hệ quả xấu:** tin từ Telegram/Zalo chạy chế độ giới hạn (không tool); 10 tin/phút/khóa; duyệt thao tác phải làm trong app. Muốn mở quyền cho chủ bot qua Telegram sẽ cần ADR mới (sửa OpenMausBot hoặc dùng cơ chế khác).

### ADR-2: Node 22, không thư viện ngoài
- Máy chủ dự án chưa cài được gói npm; người dùng không biết code. Gateway chỉ dùng thư viện có sẵn của Node (fetch, http, crypto, test). Cài = cài Node + nhấp đúp `.bat`.

### ADR-3: Polling trước, webhook sau
- PC không có địa chỉ HTTPS công khai → Telegram và Zalo dùng long polling. Không bao giờ tự xóa webhook/chiếm bot đang chạy ở nơi khác.

### ADR-4: Danh tính và quyền
- Chủ bot xác nhận bằng mã dùng một lần tạo trong app (`/link MÃ`), không dựa vào username.
- Người lạ: mã ghép cặp kiểu Hermes; chủ duyệt. Phiên trò chuyện tách theo (kết nối, chat, người gửi). Nhóm bị bỏ qua ở bản 0.1.

### ADR-5: Tự học skill dùng hệ sẵn có của OpenMausBot
- Không viết hệ học thứ hai. P2 = bật `features.skillReview`, đo, và chỉ bổ sung kiểm duyệt nếu thử nghiệm cho thấy thiếu.

### ADR-6: cockpit-tools là công cụ ngoài
- Giấy phép phi thương mại → không chép mã. Dùng song song: đăng nhập/chuyển tài khoản cho CLI (Codex, Antigravity…) mà OpenMausBot dùng, hoặc trỏ engine "OpenAI-compatible" của OpenMausBot vào "Codex API Service" chạy local của cockpit-tools (**CHƯA XÁC MINH** tương thích).
- **Rủi ro:** xoay vòng nhiều tài khoản để vượt hạn mức có thể vi phạm điều khoản nhà cung cấp AI và bị khóa tài khoản. Chủ dự án tự quyết.

## 4. Kết quả P1 (bản 0.1 Limix Gateway)

Đã làm và kiểm thử với máy chủ giả lập (19/19 test đạt, Node 22.23):
Telegram + Zalo nhắn chữ ↔ OpenMausBot Bot API; giữ mạch hội thoại; chống trùng tin; không chiếm bot đang dùng nơi khác;
mã liên kết chủ; mã ghép cặp + duyệt trên web hoặc bằng chat; chia tin dài; báo "đang gõ"; tin bị gián đoạn khi khởi động lại không chạy lại;
token/khóa mã hóa và không lộ ra log/trình duyệt; trang quản lý tiếng Việt chỉ mở trên máy.

**Chưa kiểm:** chạy với bot Telegram/Zalo thật, OpenMausBot thật trên Windows. Đây là bước tiếp theo, cần chủ dự án làm theo README.

## 5. Lộ trình cập nhật

| Mốc | Nội dung | Ghi chú |
|---|---|---|
| P1 | Telegram + Zalo chữ | Xong mã, chờ thử thật |
| P2 | Tự học skill: bật `skillReview`, đo, thêm duyệt nếu thiếu | Không cần viết lại |
| P3 | Tạo bot Telegram bằng QR (Managed Bots) | Cần manager bot riêng |
| P4 | Quyền cao hơn cho chủ bot qua chat, lọc nội dung | Cần ADR mới |
| P5 | Discord (WebSocket, chạy được trên PC), WhatsApp Cloud API (cần HTTPS công khai/đường hầm) | |
| P6 | Ảnh/tệp/giọng nói, nhóm | |
