import { useState } from "react";
import { api } from "@/state/api";
export function LimixChannelReview() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unlock = async () => {
    setBusy(true); setError("");
    try {
      if (!window.ogb?.limixAccount?.review) throw new Error("Mở ứng dụng desktop để xác thực tài khoản / Use the desktop app.");
      const ticket = await window.ogb.limixAccount.review(password);
      setPassword("");
      const result = await api<{ until: number }>("/api/limix/channel-review/unlock", { method: "POST", body: JSON.stringify(ticket) });
      sessionStorage.setItem("limix-channel-review-until", String(result.until));
      location.reload();
    } catch (err) { setPassword(""); setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  return <section className="mx-4 my-3 space-y-2 rounded-xl border border-hairline p-4">
    <h3>Chat khách hàng / Channel conversations</h3>
    <p className="text-sm text-ink-secondary">Nhập mật khẩu tài khoản Limix để xem lịch sử trong 5 phút. / Verify your Limix password for five-minute access.</p>
    <div className="flex flex-wrap gap-2">
      <input type="password" autoComplete="current-password" aria-label="Limix password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="rounded bg-inset p-2" />
      <button disabled={busy || !password} onClick={() => void unlock()}>Mở khóa / Unlock</button>
      <button onClick={() => void api("/api/limix/channel-review/lock", { method: "POST" }).then(() => { sessionStorage.removeItem("limix-channel-review-until"); location.reload(); })}>Khóa lại / Lock</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
const expires = typeof sessionStorage === "undefined" ? 0 : Number(sessionStorage.getItem("limix-channel-review-until"));
if (expires) setTimeout(() => { sessionStorage.removeItem("limix-channel-review-until"); location.reload(); }, Math.max(0, expires - Date.now()));
