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

/** Limix: the same password unlock, as one row in a bot's conversation list. The owner's own chat is listed anyway. */
export function ChannelReviewRow() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const until = typeof sessionStorage === "undefined" ? 0 : Number(sessionStorage.getItem("limix-channel-review-until")) || 0;
  const unlocked = until > Date.now();
  const unlock = async () => {
    setBusy(true); setError("");
    try {
      if (!window.ogb?.limixAccount?.review) throw new Error("Mở ứng dụng desktop để xác thực tài khoản.");
      const ticket = await window.ogb.limixAccount.review(password);
      setPassword("");
      const result = await api<{ until: number }>("/api/limix/channel-review/unlock", { method: "POST", body: JSON.stringify(ticket) });
      sessionStorage.setItem("limix-channel-review-until", String(result.until));
      location.reload();
    } catch (err) { setPassword(""); setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const lock = () => void api("/api/limix/channel-review/lock", { method: "POST" }).then(() => { sessionStorage.removeItem("limix-channel-review-until"); location.reload(); });
  if (!window.ogb?.limixAccount?.review) return null;
  if (unlocked) {
    return (
      <button type="button" data-channel-review onClick={lock}
        className="mb-2 w-full rounded-[6px] px-2 py-1 text-start text-[12px] text-ink-secondary hover:bg-ink/[0.06] hover:text-ink">
        {`Đang xem chat khách hàng tới ${new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Khóa lại`}
      </button>
    );
  }
  return (
    <div className="mb-2">
      <button type="button" data-channel-review aria-expanded={open} onClick={() => { setOpen(!open); setError(""); }}
        className="w-full rounded-[6px] px-2 py-1 text-start text-[12px] text-ink-secondary hover:bg-ink/[0.06] hover:text-ink">
        Mở khóa chat khách hàng (Telegram/Zalo…)
      </button>
      {open && (
        <form className="mt-1 flex items-center gap-2 px-2" onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
          <input type="password" autoComplete="current-password" aria-label="Mật khẩu tài khoản Limix" placeholder="Mật khẩu tài khoản Limix"
            value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)}
            className="min-w-0 flex-1 rounded-[6px] bg-inset px-2 py-1 text-[12px] text-ink" />
          <button type="submit" disabled={busy || !password} className="shrink-0 rounded-[6px] bg-control px-2 py-1 text-[12px] text-ink disabled:opacity-50">Mở 5 phút</button>
        </form>
      )}
      {error && <p role="alert" className="mt-1 px-2 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
