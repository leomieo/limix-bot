import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, RefreshCw, Smartphone, Wifi } from "lucide-react";

import { api } from "@/state/api";

/** Limix Bot has no phone app: a phone opens this computer's Limix Bot in its browser instead. The QR is an ordinary
 * web link (http://<this computer on the Wi-Fi>/pair#code=…) that any camera opens; the code signs that browser in once. */

interface Pairing { url: string | null; code: string; expiresAt: number; hint?: string | null }
type Bridge = { state(): Promise<{ on: boolean; active: boolean }>; set(on: boolean): Promise<void> };

const bridge = (): Bridge | undefined => (window as unknown as { ogb?: { limixPhone?: Bridge } }).ogb?.limixPhone;

const button = "inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50";

export function LimixPhoneBrowser() {
  const [state, setState] = useState<{ on: boolean; active: boolean } | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bridge()?.state().then(setState).catch(() => setState({ on: false, active: false }));
  }, []);

  const newCode = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const made = await api<Pairing>("/api/auth/pairing", {
        method: "POST",
        body: JSON.stringify({ label: "Điện thoại (trình duyệt)", ttlMs: 15 * 60_000 }),
      });
      setPairing(made);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (state?.active && !pairing) void newCode();
  }, [state?.active, pairing, newCode]);

  const turn = async (on: boolean) => {
    setBusy(true);
    try {
      await bridge()?.set(on);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  if (!bridge()) {
    return <p className="text-[13px] text-ink-secondary">Mở mục này trong ứng dụng Limix Bot trên máy tính.</p>;
  }
  if (!state) return <Loader2 size={15} className="animate-spin text-ink-secondary" />;

  if (!state.on) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-hairline/40 bg-card px-4 py-4" data-limix-phone="off">
        <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Smartphone size={16} />Mở Limix Bot trên điện thoại</div>
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          Điện thoại dùng chung Wi-Fi với máy tính này có thể mở Limix Bot bằng trình duyệt (Safari, Chrome), không cần cài app.
          Bật xong, Limix Bot khởi động lại một lần. Nếu Windows hỏi quyền mạng, chọn <b>Cho phép</b> (mạng riêng).
        </p>
        <button type="button" className={`${button} w-fit`} disabled={busy} onClick={() => void turn(true)}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}Bật và khởi động lại
        </button>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    );
  }

  if (!state.active) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-hairline/40 bg-card px-4 py-4">
        <p className="text-[13px] text-ink">Đã bật. Khởi động lại Limix Bot để điện thoại mở được.</p>
        <button type="button" className={`${button} w-fit`} disabled={busy} onClick={() => void turn(true)}>Khởi động lại ngay</button>
      </div>
    );
  }

  const until = pairing ? new Date(pairing.expiresAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline/40 bg-card px-4 py-4" data-limix-phone="on">
      <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Smartphone size={16} />Mở Limix Bot trên điện thoại</div>
      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-secondary">
        <li>Điện thoại bắt cùng Wi-Fi với máy tính này.</li>
        <li>Mở camera, quét mã bên dưới, chạm vào đường link hiện ra.</li>
        <li>Trong trình duyệt: Chia sẻ → <b>Thêm vào Màn hình chính</b> để dùng như một app.</li>
      </ol>
      {pairing?.url ? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={pairing.url} size={220} level="M" marginSize={1} bgColor="#ffffff" fgColor="#111111" /></div>
          <div className="text-[12px] text-ink-secondary">Mã dùng một lần, hết hạn lúc {until} · mã: <span className="font-mono text-ink">{pairing.code}</span></div>
          <div className="max-w-full truncate font-mono text-[11px] text-ink-tertiary">{pairing.url.split("#")[0]}</div>
        </div>
      ) : pairing ? (
        <p className="text-[13px] text-warning">Máy tính chưa có địa chỉ Wi-Fi. Kiểm tra máy đã nối Wi-Fi hoặc mạng dây trong nhà, rồi tạo mã mới.</p>
      ) : busy ? <Loader2 size={15} className="animate-spin text-ink-secondary" /> : null}
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => void newCode()}><RefreshCw size={14} />Tạo mã mới</button>
        <button type="button" className={button} disabled={busy} onClick={() => void turn(false)}>Tắt</button>
      </div>
    </div>
  );
}
