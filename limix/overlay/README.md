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

Desktop installers are available for Windows, macOS and Linux. Choose the package for your operating system and processor:

| Platform | Download the latest release |
|---|---|
| Windows 10/11 · x64 | [Windows installer (.exe)](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-setup.exe) |
| macOS · Apple Silicon (M-series) | [Apple Silicon installer (.dmg)](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Apple-Silicon.dmg) |
| macOS · Intel | [Intel installer (.dmg)](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Intel.dmg) |
| Linux · x64 | [AppImage](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Linux-x64.AppImage) · [DEB for Ubuntu/Debian](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Linux-x64.deb) |

1. Download the matching package above and install it. You can also use [website downloads](https://limixmedia.com) or browse [all release assets](https://github.com/leomieo/limix-bot/releases/latest).
2. Sign in with your Limix account.
3. Open **Settings → AI**, select a supported provider and sign in or configure its API.
4. Create a bot with **+** in the sidebar, set its role and start a chat.
5. Optionally connect messaging services from the account menu, manage skills in Settings and pair your phone through the phone connection entry.

## Requirements and limitations

- Supported desktop packages: Windows x64, macOS Apple Silicon, macOS Intel and Linux x64. Choose the package that matches your machine; Linux ARM64 packages are not currently provided.
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

Developed by **Limix AI**.

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
  <b>Quản lý đội bot AI ngay trên máy tính của bạn.</b><br>
  Giao vai trò cho từng bot, cho bot dùng kỹ năng và kết nối với Telegram, Zalo hoặc Discord.
</p>

<p align="center">
  <a href="https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-setup.exe"><img src="https://img.shields.io/badge/T%E1%BA%A3i%20cho-Windows%2010%2F11-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Tải cho Windows"></a>
  &nbsp;
  <a href="https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Apple-Silicon.dmg"><img src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white" alt="Tải cho macOS Apple Silicon"></a>
  &nbsp;
  <a href="https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Intel.dmg"><img src="https://img.shields.io/badge/macOS-Intel-555555?style=for-the-badge&logo=apple&logoColor=white" alt="Tải cho macOS Intel"></a>
  &nbsp;
  <a href="https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Linux-x64.AppImage"><img src="https://img.shields.io/badge/Linux-x64-111111?style=for-the-badge&logo=linux&logoColor=white" alt="Tải cho Linux x64"></a>
</p>

<p align="center">
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

> **Bản thử nghiệm (beta).** Limix Bot đang trong giai đoạn phát triển. Hãy sao lưu dữ liệu quan trọng và kiểm tra quyền trước khi bật tính năng tự động hóa.

---

## Tính năng

**Một đội bot, mỗi bot một việc.** Tạo nhiều bot, đặt tên, vai trò và AI riêng cho từng bot. Giao việc trong khung chat, cho các bot làm việc chung trong nhóm, hoặc để một bot điều phối các bot khác.

**Dùng AI bạn đã có.** Kết nối tài khoản Claude, ChatGPT/Codex, Google Gemini (Antigravity), Grok và nhiều AI khác, hoặc dùng khóa API. Nếu máy đã cài Antigravity CLI (`agy`), Limix Bot có thể dùng công cụ đó.

**Trả lời khách trên các ứng dụng chat.** Nối bot với Telegram, Zalo và Discord từ một màn hình. Bot nhận và trả lời tin nhắn trong cuộc trò chuyện đã kết nối. Các loại tệp hỗ trợ tùy theo nền tảng.

**Tự học kỹ năng.** Lưu các quy trình hữu ích thành kỹ năng để dùng lại. Bạn có thể tải kỹ năng từ thư viện Limix, xem kết quả kiểm tra và duyệt trước khi bật.

**Máy tính riêng cho bot.** Mỗi bot có thể có một máy tính để duyệt web, mở ứng dụng và làm việc thật. Có thể dùng môi trường Docker trên máy này, dịch vụ máy tính đám mây được hỗ trợ hoặc máy chủ riêng, tùy cấu hình.

**Công cụ cho kỹ năng.** Kiểm tra công cụ mà các kỹ năng đã cài cần dùng. Trên Windows, Limix Bot có thể cài các công cụ còn thiếu nếu được hỗ trợ. Trên macOS và Linux, bạn có thể cài chúng riêng.

**Truy cập từ xa.** Ghép nối để mở Limix Bot bằng trình duyệt trên điện thoại hoặc máy tính khác. Khả năng kết nối phụ thuộc vào mạng và cấu hình truy cập từ xa.

**Chạy nền, tự động hóa.** Hẹn lịch cho bot làm việc định kỳ, theo dõi mức dùng của từng AI, nhận thông báo từ khay hệ thống. Bạn có thể cập nhật ứng dụng ngay trong Limix Bot.

---

## Bắt đầu

Limix Bot đã có bộ cài cho Windows, macOS và Linux. Chọn đúng hệ điều hành và bộ xử lý của máy:

| Nền tảng | Tải phiên bản mới nhất |
|---|---|
| Windows 10/11 · x64 | [Bộ cài Windows (.exe)](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-setup.exe) |
| macOS · Apple Silicon (dòng chip M) | [Bộ cài Apple Silicon (.dmg)](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Apple-Silicon.dmg) |
| macOS · Intel | [Bộ cài Intel (.dmg)](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Intel.dmg) |
| Linux · x64 | [AppImage](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Linux-x64.AppImage) · [DEB cho Ubuntu/Debian](https://github.com/leomieo/limix-bot/releases/latest/download/LimixBot-Linux-x64.deb) |

1. **Tải và cài đặt** gói phù hợp ở bảng trên. Bạn cũng có thể tải tại [limixmedia.com](https://limixmedia.com) hoặc xem [toàn bộ tệp của bản phát hành mới nhất](https://github.com/leomieo/limix-bot/releases/latest).
2. **Đăng nhập** tài khoản Limix khi ứng dụng yêu cầu.
3. **Kết nối AI:** vào **Cài đặt → AI**, chọn nhà cung cấp rồi đăng nhập hoặc cấu hình khóa API.
4. **Tạo bot đầu tiên** bằng nút **+** ở thanh bên, đặt tên và giao việc ngay trong khung chat.
5. **Tùy chọn:**
   - Nối Telegram, Zalo, Discord ở menu tài khoản → **Kết nối Telegram, Zalo, Discord**.
   - Cài thêm kỹ năng và công cụ ở **Cài đặt → Kỹ năng**.
   - Mở trên điện thoại ở menu tài khoản → **Kết nối điện thoại**.

---

## Yêu cầu và lưu ý

- **Hệ điều hành:** Windows x64, macOS Apple Silicon, macOS Intel và Linux x64. Chọn đúng gói cho máy; hiện chưa có bộ cài Linux ARM64.
- **Cảnh báo khi cài:** bộ cài chưa được ký số; bản macOS chưa được Apple chứng thực (notarization). Hãy kiểm tra nguồn tải và quyền được yêu cầu trước khi tiếp tục.
- **Máy ảo riêng cho bot** cần Docker Desktop. Limix Bot có nút cài sẵn trong **Cài đặt → Kỹ năng → Công cụ cho kỹ năng**.
- **Điều khiển qua Internet** cần máy tính đang bật, có mạng và đang chạy Limix Bot.
- **Ngôn ngữ:** giao diện tiếng Việt và tiếng Anh.
- **Dữ liệu** nằm trên máy bạn, trong thư mục `.limixbot` của người dùng. Hãy sao lưu trước khi chuyển máy hoặc thực hiện thay đổi lớn. Đồng bộ dữ liệu tài khoản qua Cloud hiện đang tắt.

---

## Dùng có trách nhiệm

Limix Bot kết nối với dịch vụ của các nhà cung cấp AI và ứng dụng chat bằng tài khoản của chính bạn.

- **Tuân thủ điều khoản** của từng nhà cung cấp AI và từng nền tảng chat (Telegram, Zalo, Discord…).
- **Tôn trọng giới hạn sử dụng.** Limix Bot không vượt hay né giới hạn của gói bạn đăng ký.
- **Cẩn trọng với kỹ năng có công cụ.** Kỹ năng kèm script hay MCP không tự cài phần công cụ; bạn quyết định bật hay không.
- **Bạn chịu trách nhiệm** về nội dung bot gửi đi và việc bot làm trên máy của bạn.

---

## Liên kết

[Thư viện kỹ năng](https://github.com/leomieo/limix-skill-hub) · [Đóng góp](CONTRIBUTING.md) · [Bảo mật](SECURITY.md) · [Quy tắc ứng xử](CODE_OF_CONDUCT.md) · [Giấy phép](LICENSE) · [Ghi công](NOTICE)

Limix Bot do **Limix AI** phát triển.
