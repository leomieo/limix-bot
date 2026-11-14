[English](#english) · [Tiếng Việt](#tieng-viet)

<a id="english"></a>

# Contributing to Limix Bot

Thank you for helping improve Limix Bot. Report reproducible problems, propose focused changes, and submit pull requests to [leomieo/limix-bot](https://github.com/leomieo/limix-bot).

## Before making a change

- Read [AGENTS.md](AGENTS.md) and the [project rules](limix/docs/CLAUDE.md).
- Keep each pull request focused on one problem. Discuss larger architecture, account, permissions or data-format changes in an issue first.
- Use Limix Bot branding in the interface, public documentation, commit messages and release notes. Do not add external project names or automatic co-author trailers to integration commits. Preserve required license, copyright and third-party notices.
- Keep technical bot instructions in English. User-facing Vietnamese descriptions and translations belong in the locale and presentation layers.
- Reuse existing modules before adding dependencies. Explain any new runtime dependency.

## Development setup

Use Node.js 24 or newer and the pnpm version pinned in `package.json`. Real bot conversations also require a supported AI provider configured and signed in. Tests use isolated fixtures and synthetic providers.

```sh
git clone https://github.com/leomieo/limix-bot.git
cd limix-bot
pnpm install --frozen-lockfile
```

Run the server and frontend in separate terminals:

```sh
pnpm dev:server
pnpm dev
```

Use the addresses printed by those processes. For the Electron desktop shell:

```sh
pnpm dev:desktop
```

The desktop command stages the pinned tunnel connector for the current platform. Some native features need additional platform tools and permissions; consult the relevant module documentation before testing them.

## Code layout

| Directory | Purpose |
| --- | --- |
| `src/` | React interface, locale resources and client state |
| `server/` | Application server, provider drivers, persistence and tool permissions |
| `shared/` | Shared contracts and validation helpers |
| `electron/` | Desktop lifecycle, native integrations and update wiring |
| `limix/` | Limix modules, reproducible overlays, patches, branding and project records |
| `skills/` | Bundled bot skills |
| `scripts/` | Development, packaging and verification tools |

Application data normally lives in the user's `.limixbot` directory. Never use a customer's profile or a developer's live profile as a test fixture. Do not hand-edit generated `dist/`, `dist-server/` or packaged release output.

## Verification

Run the checks appropriate to the change:

```sh
pnpm typecheck
pnpm check:electron
pnpm test
```

For focused checks, use `pnpm exec vitest run <test-files>`. Follow [verification guidance](docs/verification/README.md) for server and conversation changes. Launch a disposable fixture before exercising mutations.

- Test observable behavior, permission boundaries and meaningful failures.
- Use temporary homes and synthetic provider credentials. Keep secrets out of logs, screenshots, fixtures, URLs and commit history.
- For UI changes, include before/after screenshots and verify narrow layouts, scrolling, focus, keyboard use and the active theme.
- For data migrations and offline transfer, verify account ownership, version compatibility, failed restores and preservation of existing data.
- State exactly what passed and what was not tested. A build or mock test does not establish real-provider, installed-client or updater acceptance.

## Limix modules and reproducibility

Keep reusable Limix-specific code in its existing module. Mirror overlay-managed source changes in `limix/overlay/`; maintain applicable patches and `limix/rebrand.py` transformations when changing core files. Verify reconstruction in a disposable checkout and verify that a second run makes no changes.

This document is maintained in `limix/overlay/CONTRIBUTING.md` and copied to the repository root by the existing overlay step. Keep both copies identical.

Record material decisions and validation results in `limix/docs/PROJECT_MEMORY.md` and the relevant module plan. Cloud services and account synchronization remain disabled unless the project owner explicitly authorizes activation.

## Pull requests

Describe the problem, resulting behavior, validation commands/results and material limitations. Include a reproduction or linked issue when available. Keep the title and description about the final change. Do not include credentials, personal customer data or generated build artifacts.

Changes to account access, tool execution, shared workspaces and backups must preserve existing authorization checks. Report security-sensitive issues privately using [SECURITY.md](SECURITY.md).

## Desktop builds and releases

Limix Bot targets Windows x64, macOS Apple Silicon, macOS Intel and Linux x64. Platform builds use native runners; macOS builds require the corresponding Apple development tools.

```sh
pnpm package:win
pnpm package:mac
pnpm package:linux
```

Release builds use [Limix Bot Desktop](.github/workflows/limix-desktop.yml), which coordinates platform packaging, packaged-server checks and updater-feed verification before publication. Keep the version aligned across all desktop targets. A completed workflow is not evidence that a real installed client has downloaded and applied an update.

Until signing and notarization are configured and verified, disclose those limitations in release notes. Do not publish from a feature branch or change release destinations without the project owner's authorization.

## License

Contributions are provided under the [Apache License 2.0](LICENSE). Preserve applicable notices in [NOTICE](NOTICE) and third-party license files.

---

[English](#english) · [Tiếng Việt](#tieng-viet)

<a id="tieng-viet"></a>

# Đóng góp cho Limix Bot

Cảm ơn bạn đã giúp cải thiện Limix Bot. Hãy gửi lỗi có thể tái hiện, đề xuất thay đổi tập trung và mở Pull Request tại [leomieo/limix-bot](https://github.com/leomieo/limix-bot).

## Trước khi thay đổi

- Đọc [AGENTS.md](AGENTS.md) và [quy tắc dự án](limix/docs/CLAUDE.md).
- Mỗi Pull Request tập trung vào một vấn đề. Trao đổi trước qua Issue khi thay đổi lớn về kiến trúc, tài khoản, phân quyền hoặc định dạng dữ liệu.
- Dùng nhận diện Limix Bot trong giao diện, tài liệu công khai, commit và ghi chú phát hành. Không tự thêm tên dự án ngoài hay dòng đồng tác giả vào commit tích hợp. Giữ thông báo giấy phép và bản quyền bắt buộc.
- Giữ chỉ dẫn kỹ thuật dành cho bot bằng tiếng Anh; mô tả và bản dịch dành cho người dùng nằm ở lớp giao diện/ngôn ngữ.
- Tái sử dụng module hiện có; giải thích lý do nếu thêm thư viện chạy ứng dụng.

## Thiết lập phát triển

Dùng Node.js 24 trở lên và phiên bản pnpm được ghim trong `package.json`. Trò chuyện thật cần cấu hình và đăng nhập một nhà cung cấp AI được hỗ trợ. Kiểm thử dùng môi trường tách biệt và nhà cung cấp giả lập.

```sh
git clone https://github.com/leomieo/limix-bot.git
cd limix-bot
pnpm install --frozen-lockfile
```

Chạy server và giao diện trong hai terminal riêng:

```sh
pnpm dev:server
pnpm dev
```

Dùng địa chỉ được các tiến trình in ra. Mở giao diện desktop Electron bằng:

```sh
pnpm dev:desktop
```

Lệnh desktop chuẩn bị trình kết nối tunnel đã ghim cho nền tảng hiện tại. Một số tính năng native cần công cụ và quyền riêng của hệ điều hành; đọc tài liệu module tương ứng trước khi thử.

## Cấu trúc mã nguồn

| Thư mục | Vai trò |
| --- | --- |
| `src/` | Giao diện React, tài nguyên ngôn ngữ và trạng thái client |
| `server/` | Server, driver AI, lưu trữ và quyền công cụ |
| `shared/` | Hợp đồng dữ liệu và kiểm tra dùng chung |
| `electron/` | Vòng đời desktop, tích hợp native và cập nhật |
| `limix/` | Module Limix, overlay, patch, thương hiệu và hồ sơ dự án |
| `skills/` | Kỹ năng bot đi kèm |
| `scripts/` | Công cụ phát triển, đóng gói và xác minh |

Dữ liệu ứng dụng thường nằm trong `.limixbot` của người dùng. Không kiểm thử trên hồ sơ khách hàng hoặc hồ sơ đang sử dụng thật. Không sửa tay `dist/`, `dist-server/` hoặc đầu ra bộ cài.

## Xác minh

Chạy các kiểm tra phù hợp:

```sh
pnpm typecheck
pnpm check:electron
pnpm test
```

Dùng `pnpm exec vitest run <test-files>` để kiểm tra tập trung. Tuân theo [hướng dẫn xác minh](docs/verification/README.md) khi sửa server hoặc hội thoại. Khởi tạo fixture tạm trước mọi thao tác thay đổi dữ liệu.

- Kiểm tra hành vi quan sát được, ranh giới quyền và lỗi có ý nghĩa.
- Dùng thư mục người dùng tạm và thông tin AI giả lập. Không để bí mật trong log, ảnh chụp, fixture, URL hay lịch sử commit.
- Thay đổi UI cần ảnh trước/sau; kiểm tra màn hình hẹp, cuộn, focus, bàn phím và theme.
- Di chuyển dữ liệu và chuyển máy cần kiểm tra tài khoản sở hữu, phiên bản tương thích, khôi phục thất bại và bảo toàn dữ liệu.
- Nói rõ phần đạt và chưa kiểm. Build hoặc mock test không chứng minh tài khoản AI thật, ứng dụng đã cài hay cập nhật tự động đã hoạt động.

## Module Limix và khả năng tái dựng

Đặt mã Limix tái sử dụng trong module tương ứng. Đồng bộ mã được quản lý bằng overlay vào `limix/overlay/`; duy trì patch và biến đổi trong `limix/rebrand.py` khi sửa lõi. Kiểm tra tái dựng ở checkout tạm và bảo đảm lượt chạy thứ hai không tạo thay đổi.

Bản chuẩn tài liệu này nằm tại `limix/overlay/CONTRIBUTING.md`, được sao chép về thư mục gốc qua bước overlay. Giữ hai bản giống nhau.

Ghi quyết định quan trọng và bằng chứng kiểm tra trong `limix/docs/PROJECT_MEMORY.md` cùng kế hoạch module liên quan. Cloud và đồng bộ tài khoản tiếp tục tắt trừ khi chủ dự án cho phép kích hoạt rõ ràng.

## Pull Request

Mô tả vấn đề, hành vi sau thay đổi, lệnh/kết quả kiểm tra và giới hạn quan trọng. Kèm bước tái hiện hoặc Issue nếu có. Tiêu đề và mô tả phải phản ánh thay đổi cuối cùng. Không đưa thông tin đăng nhập, dữ liệu khách hàng hay file build sinh tự động vào PR.

Thay đổi tài khoản, thực thi công cụ, không gian dùng chung và sao lưu phải giữ các kiểm tra quyền hiện có. Báo cáo vấn đề bảo mật riêng theo [SECURITY.md](SECURITY.md).

## Đóng gói và phát hành

Limix Bot hướng tới Windows x64, macOS Apple Silicon, macOS Intel và Linux x64. Build trên runner phù hợp từng hệ điều hành; macOS cần bộ công cụ phát triển Apple tương ứng.

```sh
pnpm package:win
pnpm package:mac
pnpm package:linux
```

Workflow [Limix Bot Desktop](.github/workflows/limix-desktop.yml) phối hợp đóng gói, kiểm tra server trong gói và xác minh nguồn cập nhật trước khi phát hành. Giữ cùng phiên bản giữa các nền tảng. Workflow thành công không chứng minh client thật đã tải và áp dụng bản cập nhật.

Khi chưa cấu hình và xác minh ký số/notarization, nêu rõ giới hạn trong ghi chú phát hành. Không phát hành từ nhánh tính năng hoặc đổi đích phát hành khi chưa được chủ dự án cho phép.

## Giấy phép

Đóng góp tuân theo [Apache License 2.0](LICENSE). Giữ các thông báo áp dụng trong [NOTICE](NOTICE) và tệp giấy phép bên thứ ba.
