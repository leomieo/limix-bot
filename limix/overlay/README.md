[English](#english) · [Tiếng Việt](#tieng-viet)

<a id="english"></a>

# Limix Bot

**Run a team of AI bots from your own computer.** Give bots separate roles, reusable skills and a computer environment, and connect them to Telegram, Zalo and Discord.

> **Beta software.** Limix Bot is under active development. Back up important data and review permissions before using automation.

## Features

- **A team of bots:** create bots with individual names, roles and AI providers; work in direct chats or shared rooms and delegate between bots.
- **Use your existing AI:** connect supported Claude, ChatGPT/Codex, Gemini/Antigravity, Grok and other accounts, or API providers. An installed Antigravity CLI can be reused.
- **Messaging integrations:** connect Telegram, Zalo and Discord to handle messages and send replies to the relevant chat.
- **Reusable skills:** capture useful workflows as skills. The Limix skill library provides curated, scanned and rated skills; review warnings and approve activation where required.
- **Computer environments:** use local Docker desktops, supported cloud computer providers or your own VPS, depending on configuration.
- **Skill tools:** scan installed skill requirements and install supported missing tools. Automatic installation currently supports Windows; other platforms can use tools installed separately.
- **Remote access:** open the web interface from a phone or laptop using pairing. Availability depends on the network and configured remote connection.
- **Automation:** schedule work, monitor supported AI usage and receive desktop notifications. Desktop releases include updater metadata.

## Getting started

1. Download the appropriate available package from [Releases](https://github.com/leomieo/limix-bot/releases) and install it. [Website downloads](https://limixmedia.com) show platform packages when they are published.
2. Sign in with your Limix account.
3. Open **Settings → AI**, select a supported provider and sign in or configure its API.
4. Create a bot with **+** in the sidebar, set its role and start a chat.
5. Optionally connect messaging services from the account menu, manage skills in Settings and pair your phone through the phone connection entry.

## Requirements and limitations

- Download only a platform package actually listed in the release. Windows x64, macOS Apple Silicon, macOS Intel and Linux x64 are separate build targets.
- Installers are not yet publisher-signed; macOS notarization is not configured. Review operating-system warnings and permissions carefully.
- Local virtual desktops require a compatible container runtime such as Docker Desktop.
- Remote access requires the host to remain powered on, online and running Limix Bot.
- The interface supports Vietnamese and English. Technical bot instructions remain in English.
- Local application data normally lives in the user's `.limixbot` directory. Back up before migration or major changes.
- Cloud account synchronization is disabled. It does not automatically upload customer bot data to an account server.

## Responsible use

Use your own authorized accounts and follow the terms of AI providers and messaging platforms. Respect usage limits. Review skill/tool permissions and untrusted code before activation. You are responsible for messages and actions performed by your bots.

## Links

[Releases](https://github.com/leomieo/limix-bot/releases) · [Skill library](https://github.com/leomieo/limix-skill-hub) · [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [License](LICENSE) · [Notices](NOTICE)

Developed by **Leox ৹ Limix AI**.

---

[English](#english) · [Tiếng Việt](#tieng-viet)

<a id="tieng-viet"></a>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="limix/brand-assets/limix-logo-horizontal-dark.svg">
    <img src="limix/brand-assets/limix-logo-horizontal.svg" alt="Limix Bot" width="420">
  </picture>
</p>

<p align="center">
  <b>Điều hành cả một đội bot AI ngay trên máy tính của bạn.</b><br>
  Mỗi bot có máy tính riêng, tự học kỹ năng mới và trả lời khách trên Telegram, Zalo, Discord.
</p>

<p align="center">
  <a href="https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-setup.exe"><img src="https://img.shields.io/badge/T%E1%BA%A3i%20cho-Windows%2010%2F11-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Tải cho Windows"></a>
  &nbsp;
  <a href="https://github.com/leomieo/limix-bot/releases"><img src="https://img.shields.io/github/v/release/leomieo/limix-bot?style=for-the-badge&label=Phi%C3%AAn%20b%E1%BA%A3n&color=111111" alt="Phiên bản mới nhất"></a>
  &nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/Gi%E1%BA%A5y%20ph%C3%A9p-Apache%202.0-555555?style=for-the-badge" alt="Apache 2.0"></a>
</p>

<p align="center">
  <a href="#bắt-đầu">Bắt đầu</a> ·
  <a href="#tính-năng">Tính năng</a> ·
  <a href="https://github.com/leomieo/limix-bot/releases">Có gì mới</a> ·
  <a href="https://github.com/leomieo/limix-skill-hub">Thư viện kỹ năng</a>
</p>

> **Bản thử nghiệm (beta).** Limix Bot đang phát triển nhanh và cập nhật gần như mỗi ngày. Hãy sao lưu dữ liệu quan trọng và tự chịu trách nhiệm khi dùng.

---

## Tính năng

**Một đội bot, mỗi bot một việc.** Tạo nhiều bot, đặt tên, vai trò và AI riêng cho từng bot. Giao việc trong khung chat, cho các bot làm việc chung trong nhóm, hoặc để một bot điều phối các bot khác.

**Dùng AI bạn đã có.** Kết nối tài khoản Claude, ChatGPT/Codex, Google Gemini (Antigravity), Grok và nhiều AI khác, hoặc dùng khóa API. Nếu máy đã cài Antigravity CLI (`agy`), Limix Bot có thể dùng công cụ đó.

**Trả lời khách trên các ứng dụng chat.** Nối bot với Telegram, Zalo và Discord từ một màn hình. Bot nhận tin, xử lý, gửi lại chữ và ảnh vào đúng cuộc trò chuyện hay nhóm.

**Tự học kỹ năng.** Bot rút ra quy trình hay từ các lần làm việc và lưu thành kỹ năng để dùng lại. Thư viện kỹ năng Limix có sẵn các kỹ năng đã được chọn lọc, quét bảo mật, Việt hóa và chấm điểm. Bấm là tải về.

**Máy tính riêng cho bot.** Mỗi bot có thể có một máy tính để duyệt web, mở ứng dụng và làm việc thật. Có máy ảo riêng trên máy bạn (Docker), máy tính đám mây (Boat, Instabox) hoặc VPS của bạn.

**Cài công cụ một chạm.** Limix Bot tự kiểm tra và cài những gì kỹ năng cần: Docker, Node.js, ffmpeg, Java, JADX, Ghidra, Agent-Reach… Tự cài công cụ hiện hỗ trợ Windows; trên Mac/Linux dùng công cụ đã cài riêng.

**Điều khiển từ điện thoại hoặc laptop.** Quét mã QR là mở Limix Bot trong trình duyệt điện thoại, cùng Wi-Fi hay qua Internet. Mỗi mã chỉ dùng một lần. Có nút chép link để mở trên laptop.

**Chạy nền, tự động hóa.** Hẹn lịch cho bot làm việc định kỳ, theo dõi mức dùng của từng AI, nhận thông báo từ khay hệ thống. Ứng dụng tự cập nhật bản mới.

---

## Bắt đầu

1. **Tải** [LimixBot-setup.exe](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-setup.exe) và chạy để cài.
2. **Đăng nhập** tài khoản Limix khi ứng dụng yêu cầu.
3. **Kết nối AI:** vào **Cài đặt → AI**, chọn AI bạn có và đăng nhập.
4. **Tạo bot đầu tiên** bằng nút **+** ở thanh bên, đặt tên và giao việc ngay trong khung chat.
5. **Tùy chọn:**
   - Nối Telegram, Zalo, Discord ở menu tài khoản → **Kết nối Telegram, Zalo, Discord**.
   - Cài thêm kỹ năng và công cụ ở **Cài đặt → Kỹ năng**.
   - Mở trên điện thoại ở menu tài khoản → **Kết nối điện thoại**.

---

## Yêu cầu và lưu ý

- **Hệ điều hành:** Chọn gói có sẵn trên [Releases](https://github.com/leomieo/limix-bot/releases). Các mục tiêu build gồm Windows x64, macOS Apple Silicon, macOS Intel và Linux x64.
- **Cảnh báo khi cài:** bộ cài chưa được ký số. Nếu Windows SmartScreen hiện cảnh báo, chọn **More info → Run anyway**.
- **Máy ảo riêng cho bot** cần Docker Desktop. Limix Bot có nút cài sẵn trong **Cài đặt → Kỹ năng → Công cụ cho kỹ năng**.
- **Điều khiển qua Internet** cần máy tính đang bật, có mạng và đang chạy Limix Bot.
- **Ngôn ngữ:** giao diện tiếng Việt và tiếng Anh.
- **Dữ liệu** nằm trên máy bạn, trong thư mục `.limixbot` của người dùng. Hãy sao lưu trước khi chuyển máy hoặc thực hiện thay đổi lớn. Đồng bộ dữ liệu tài khoản qua Cloud hiện đang tắt.

---

## Dùng có trách nhiệm

Limix Bot kết nối tới dịch vụ của các nhà cung cấp AI và ứng dụng chat bằng tài khoản của chính bạn.

- **Tuân thủ điều khoản** của từng nhà cung cấp AI và từng nền tảng chat (Telegram, Zalo, Discord…).
- **Tôn trọng giới hạn sử dụng.** Limix Bot không vượt hay né giới hạn của gói bạn đăng ký.
- **Cẩn trọng với kỹ năng có công cụ.** Kỹ năng kèm script hay MCP không tự cài phần công cụ; bạn quyết định bật hay không.
- **Bạn chịu trách nhiệm** về nội dung bot gửi đi và việc bot làm trên máy của bạn.

---

## Liên kết

[Thư viện kỹ năng](https://github.com/leomieo/limix-skill-hub) · [Bảo mật](SECURITY.md) · [Quy tắc ứng xử](CODE_OF_CONDUCT.md) · [Giấy phép](LICENSE) · [Ghi công](NOTICE)

Limix Bot do **Leox ৹ Limix AI** phát triển.
