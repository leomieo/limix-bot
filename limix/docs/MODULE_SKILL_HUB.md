# Limix Skill Hub

Hai phần:
1. **Kho** `leomieo/limix-skill-hub` (public): `tools/discover.mjs` tải kỹ năng công khai (không chạy mã), `lib/security.mjs` quét, `lib/classify.mjs` phân loại (chỉ hướng dẫn / kèm tool / gói MCP), `lib/score.mjs` chấm 100 điểm, `tools/build-catalog.mjs` dựng `registry/catalog.json`, `versions.json`, `checksums.json`. Workflow `daily-discovery.yml` chạy 20:00 UTC = 03:00 Asia/Ho_Chi_Minh.
2. **App** `server/limix-skill-hub.ts`: tải danh mục (ETag), cài khi mọi file khớp SHA-256 trong danh mục, qua `installLibrarySkill`. API: `GET /api/limix/hub`, `POST /api/limix/hub/{sync,settings,install,update,enable,remove}`. UI: `LimixSkillHub.tsx`.

Quy tắc: cài xong luôn TẮT; skill kèm script/MCP chỉ lấy phần hướng dẫn (có tham số `allowTools` cho từng skill khi chủ máy cho phép, UI chưa có nút); khu cách ly không cài được; skill không giấy phép tối đa 79 điểm.
Việt hóa và chấm thử: một bot trên máy chủ kho ghi `_hub.review.json` (`description_vi`, `tested`, `testScore`, `localized`, `category`, `approval`) vào từng thư mục skill. Chưa tự động.
