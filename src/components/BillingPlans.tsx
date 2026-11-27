import type { CloudAccountState } from "../../electron/cloud-account.mjs";
import { lx } from "@/lib/limix-text";
import { useCloudPlan } from "./ProIntroduction";

export function BillingPlansView({ account }: { account?: CloudAccountState | null }) {
  const verified = account?.status === "connected" && !account.checking;
  const beta = verified && account.limixTrial === "approved" && account.entitlement?.status === "active";
  const free = verified && account.entitlement?.plan === "free";
  const current = lx("Gói hiện tại", "Current plan");
  return (
    <section aria-labelledby="limix-billing-plans" className="space-y-3">
      <h3 id="limix-billing-plans" className="text-[15px] font-semibold text-ink">{lx("Thanh toán", "Billing")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-hairline/50 bg-card p-4">
          <h4 className="font-semibold text-ink">Free{free && <span className="ml-2 text-xs text-accent">{current}</span>}</h4>
          <p className="mt-2 text-[13px] text-ink-secondary">{lx("Miễn phí cho mọi tài khoản. Bạn có thể dùng bot trên máy tính. Gói này không bao gồm Limix Cloud.", "Free for every account. Run bots on your computer. Limix Cloud is excluded.")}</p>
        </div>
        <div className="rounded-xl border border-hairline/50 bg-card p-4">
          <h4 className="font-semibold text-ink">Limix Cloud Beta{beta && <span className="ml-2 text-xs text-accent">{current}</span>}</h4>
          <p className="mt-2 text-[13px] text-ink-secondary">{lx("Chạy bot trên Limix Cloud. Trong giai đoạn thử nghiệm, chỉ quản trị viên Limix mới có thể cấp quyền cho tài khoản.", "Run bots on Limix Cloud. During the beta, access is granted internally by a Limix administrator.")}</p>
        </div>
      </div>
      <p className="text-xs text-ink-secondary">{lx("Chi phí mô hình trong báo cáo mức dùng là số liệu ước tính, không phải hóa đơn của Limix.", "Model costs in the usage report are estimates, not a Limix invoice.")}</p>
    </section>
  );
}

export function BillingPlans() {
  return <BillingPlansView account={useCloudPlan()?.account} />;
}
