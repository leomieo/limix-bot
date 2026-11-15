# Giao cho Codex: phát hành Limix Bot 0.3.52

Nhánh `release-0.3.52` (repo leomieo/limix-bot) đã gộp sẵn: main + cloud-native (Limix Cloud) + upstream-0.1.160. `package.json` = 0.3.52, `limix/docs/RELEASE_NOTES.md` đã có ghi chú song ngữ. `tsc` (tsconfig.json và tsconfig.server.json) sạch trước khi bump.

## Quy tắc
- Commit KHÔNG thêm đồng tác giả / Co-authored-by, không nhắc tên dự án/tác giả upstream.
- Không xin/đòi mật khẩu, token trong chat. Không mua gì.

## Việc cần làm (theo thứ tự)
1. `git fetch && git checkout release-0.3.52`. Chạy `npm ci`, `tsc` cả hai tsconfig, `npx vitest run` các test chạm tới: `server/drivers/*`, `server/mcp-*`, `server/app-settings/*`, `cloudflare/control-plane`, `electron/*`. So sánh lỗi với `main` (nhiều test lỗi sẵn trên main vì node:sqlite). Lần chạy trước có 48 test lỗi (driver claude/codex, mcp-gate, mcp-trim, agents-proxy, agents-bridge-wire): xác định bài nào lỗi MỚI so với main và sửa; nếu do golden/ngân sách prompt thì tái tạo bằng `UPDATE_AGENTS_CATALOG_GOLDENS=1`.
2. Nếu có sửa: commit, push lên `release-0.3.52`.
3. Merge vào `main` (fast-forward hoặc merge commit), `git push origin main`. Hook pre-push chạy lint/locale/ratchet. Push main tự phát hành v0.3.52 (desktop/npm/server image).
4. Sau khi workflow xong: chạy workflow "Limix Cloudflare" từ `main` (Worker có Admin mới, migration 0021/0022, `redirect:"manual"`).
5. Báo lại cho người dùng (tiếng Việt, ngắn): phát hành xong chưa, test lỗi nào còn lại.

## Chưa kiểm chứng trên máy thật
Docker/Xeon chế độ Cloud home (cần `git fetch`, build lại `limix-cloud-home:beta`, `limix-managed-home:beta`), Worker thật, app đóng gói. Nợ kỹ thuật: đồng bộ `limix/patches` và overlay cho thay đổi Cloud + upstream (K2).
