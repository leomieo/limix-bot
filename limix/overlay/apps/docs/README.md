[Tiếng Việt](#tieng-viet) · [English](#english)

# Limix Bot Docs

<a id="tieng-viet"></a>

## Tiếng Việt

Trang tài liệu dùng Next.js và Fumadocs. Chỉnh nội dung trong `content/docs`. Chạy các lệnh sau từ thư mục gốc của kho mã nguồn.

```sh
pnpm install
pnpm docs:dev
```

Mở [bản xem trước](http://localhost:3000). Chạy các kiểm tra trước khi gửi đóng góp.

```sh
pnpm docs:build
pnpm --dir apps/docs types:check
pnpm --dir apps/docs lint
```

Nếu tự triển khai trang tài liệu, chọn `apps/docs` làm thư mục gốc của ứng dụng Next.js trên nền tảng bạn sử dụng.

Khi tự triển khai, đặt `DOCS_SITE_URL` thành địa chỉ công khai của trang trước khi chạy lệnh build. Trên Vercel, trang tự dùng tên miền chính thức của dự án.

<a id="english"></a>

## English

The documentation site uses Next.js and Fumadocs. Edit pages in `content/docs`. Run these commands from the repository root.

```sh
pnpm install
pnpm docs:dev
```

Open the [local preview](http://localhost:3000). Run these checks before contributing.

```sh
pnpm docs:build
pnpm --dir apps/docs types:check
pnpm --dir apps/docs lint
```

If you host the documentation site yourself, set `apps/docs` as the root directory of the Next.js app on your hosting platform.

For a self-hosted documentation site, set `DOCS_SITE_URL` to its public origin before building. Vercel deployments use the production domain automatically.
