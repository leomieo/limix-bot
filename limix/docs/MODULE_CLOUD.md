# MODULE_CLOUD.md — Mô-đun "Limix Cloud" (đang ẩn)

**Trạng thái:** ẨN từ 0.2.4 (quyết định D12 của chủ dự án, 2026-11-11). Mã nguồn đám mây của OpenMausBot vẫn nằm nguyên
trong repo; Limix chỉ tắt mọi lối vào. Phát triển lại khi Limix có dàn VPS/máy đám mây riêng.

## Công tắc

| File | Giá trị | Ai đọc |
|---|---|---|
| `shared/limix-features.ts` | `LIMIX_CLOUD_ENABLED = false` | giao diện (Settings) và máy chủ |
| `electron/limix-features.mjs` | `LIMIX_CLOUD_ENABLED = false` | tiến trình desktop (menu, thanh bên) |

Hai file được chép từ `limix/overlay/` bởi `limix/rebrand.py` (bước 8). Sửa ở `limix/overlay/`, không sửa bản chép.

## Những gì công tắc tắt

| Lối vào | Chỗ trong mã | Cơ chế |
|---|---|---|
| Nút/menu "Add a Cloud", lựa chọn Cloud ở thanh bên | `electron/main.mjs` `cloudOffersAllowed()` | `return LIMIX_CLOUD_ENABLED && …` |
| Mục Settings → Cloud account | `src/components/SettingsModal.tsx` `availableSections` | lọc `cloudAccount` khi tắt |
| Dòng "Limix Bot Cloud / Add a Cloud" ở Settings → General và Usage & billing, ghi chú routine, chip Cloud khi mới cài, nút "thêm trang", hộp thoại Add a Cloud | `src/components/ProIntroduction.tsx` `useCloudPlan`, `src/lib/cloud-plan.ts` `buyOfferAllowed`, `src/lib/default-bot.ts`, `PageTools.tsx`, `PublishedPageCard.tsx`, `src/state/store.tsx` (`openCloudAdd`) | rebrand bước 8d, từ 0.2.6 |
| Bảng giá, popup "What's new", thẻ dùng thử Cloud, thẻ tài trợ, thông báo từ máy chủ MausBot | `src/components/AppNotices.tsx`, `BoatOffer.tsx`, `modelgo-offer.ts`… | Limix là "branded build": `server/brand.ts` trả `source: "file"` (rebrand bước 8b) |

Không bị ảnh hưởng: app trên máy, Remote access/ghép cặp điện thoại, `npx limixbot serve` (tự dựng máy chủ), BYO VPS
(máy ảo cho bot qua SSH, `docs/byo-vps.md`), Deploy on a VPS (`docs/deploy-vps.md`).

Khi chưa đăng nhập Cloud, app không gửi yêu cầu nào tới máy chủ đám mây (`electron/main.mjs`: "Fresh local use never
makes a Cloud request").

## Muốn bật lại: cần xây gì (ĐỀ XUẤT, chưa làm)

| Phần | Có sẵn trong repo? | Việc cần làm |
|---|---|---|
| Phần mềm trên máy đám mây (My Cloud, Team Cloud, bot box) | Có (`server/`, `docs/cloud-pro.md`, `docs/team-cloud.md`, `docs/bot-box.md`) | Cấu hình cho máy của Limix |
| Control plane (tài khoản, tunnel điện thoại) | Có (`cloudflare/control-plane/`, `relay/`) | Triển khai trên tài khoản Cloudflare của Limix, đổi địa chỉ `cloud.openmausbot.com`, `accounts.openmausbot.com`, relay |
| **Admin** (đăng ký, thanh toán, tạo máy cho từng khách, đo giờ dùng, ký ghép cặp) | **Không** (mã đóng `openmaus-cloud` của Supamaus) | Viết mới |
| Hạ tầng (mỗi khách một máy; máy có desktop cho bot tốn hơn) | — | Thuê VPS/Fly.io/Hetzner…; sao lưu, giám sát |
| Thanh toán | — | Stripe không hỗ trợ người bán ở Việt Nam (2026); xem Lemon Squeezy, PayPal, VNPay/MoMo |
| Pháp lý, chi phí AI, hỗ trợ khách | — | Pháp nhân, điều khoản, chính sách bảo mật; chọn khách tự đăng nhập AI hay Limix trả |

Lộ trình gợi ý: (1) dịch vụ cài `limixbot serve` trên VPS của khách → (2) tự thuê VPS cho vài khách, thu tiền thủ công
→ (3) mới viết Admin + bật `LIMIX_CLOUD_ENABLED`.

## Bật lại để thử (khi đã có Admin của Limix)

1. Đổi `LIMIX_CLOUD_ENABLED` thành `true` ở cả hai file trong `limix/overlay/`.
2. Đổi các địa chỉ đám mây của OpenMausBot sang máy chủ Limix (`electron/cloud-account.mjs` `CLOUD_ORIGIN`,
   `server/devs-report-send.ts`, `electron/companion-account-service.mjs`…) — tìm `openmausbot.com`.
3. Xem lại bước 8b (branded build): nếu muốn hiện bảng giá Limix Cloud, phải cho các thẻ Cloud chạy cả khi
   `source === "file"`, nhưng vẫn ẩn thẻ tài trợ/thông báo của MausBot.
4. Chạy lại `python3 limix/rebrand.py . limix/brand-assets`, build, kiểm thử với máy đám mây thử nghiệm.
