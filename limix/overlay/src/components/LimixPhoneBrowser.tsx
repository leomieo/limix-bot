import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Globe, Loader2, RefreshCw, Smartphone, Wifi } from "lucide-react";

import { api } from "@/state/api";

/** Limix Bot has no phone app: a phone opens this computer's Limix Bot in its browser instead. The QR is an ordinary
 * web link (http://<this computer on the Wi-Fi>/pair#code=…) that any camera opens; the code signs that browser in once. */

interface Pairing { url: string | null; code: string; expiresAt: number; hint?: string | null }
type Bridge = { state(): Promise<{ on: boolean; active: boolean }>; set(on: boolean): Promise<void> };

const bridge = (): Bridge | undefined => (window as unknown as { ogb?: { limixPhone?: Bridge } }).ogb?.limixPhone;

const button = "inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50";

function WifiPane() {
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
          <CopyRow url={pairing.url} code={pairing.code} />
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

/** From anywhere (4G, another Wi-Fi): this computer's Limix address on limixmedia.com (a Cloudflare tunnel made for this
 * computer by the control plane, signed in with the Limix account). The phone opens it in a browser and pairs with a code. */
type AccountState = { status: "signed-out" | "connecting" | "ready" | "error"; endpoint?: string; message?: string };
type Ogb = {
  companion?: { setRoute(route: string, on: boolean): Promise<unknown>; start(routes?: string[]): Promise<unknown> };
  companionAccount?: { state(): Promise<AccountState>; prepare(): Promise<AccountState> };
};
const ogb = (): Ogb | undefined => (window as unknown as { ogb?: Ogb }).ogb;
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function RemotePane() {
  const [phase, setPhase] = useState<"idle" | "working" | "ready">("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ url: string; code: string; expiresAt: number } | null>(null);

  const run = useCallback(async () => {
    const host = ogb();
    if (!host?.companion || !host.companionAccount) {
      setError("Mở mục này trong ứng dụng Limix Bot trên máy tính.");
      return;
    }
    setPhase("working");
    setError(null);
    setPairing(null);
    try {
      setNote("Đang bật đường truyền từ xa cho máy tính này…");
      await host.companion.start();
      await host.companion.setRoute("https", true);
      let endpoint = "";
      let lastMessage = "";
      for (let i = 0; i < 45 && !endpoint; i++) {
        const account = await host.companionAccount.state();
        if (account.status === "ready" && account.endpoint && /\.limixmedia\.com$/.test(new URL(account.endpoint).hostname)) { endpoint = account.endpoint; break; }
        if (account.status === "signed-out" && i >= 3) throw new Error("Máy này chưa đăng nhập tài khoản Limix. Đăng xuất rồi đăng nhập lại Limix Bot, sau đó thử lại.");
        if (account.status === "error") lastMessage = account.message ?? "";
        if (account.status === "ready") await host.companionAccount.prepare().catch(() => undefined);
        setNote(i < 6 ? "Đang tạo địa chỉ riêng cho máy này trên Cloudflare…" : "Vẫn đang tạo địa chỉ, chờ thêm chút…");
        await pause(2000);
      }
      if (!endpoint) throw new Error(lastMessage || "Chưa tạo được địa chỉ từ xa sau 90 giây. Kiểm tra máy có Internet rồi thử lại.");
      const made = await api<{ code: string; expiresAt: number }>("/api/auth/pairing", {
        method: "POST",
        body: JSON.stringify({ label: "Điện thoại (từ xa)", ttlMs: 15 * 60_000 }),
      });
      setPairing({ url: `${endpoint}/pair#code=${made.code}`, code: made.code, expiresAt: made.expiresAt });
      setPhase("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase("idle");
    }
  }, []);

  if (phase !== "ready" || !pairing) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-hairline/40 bg-card px-4 py-4" data-limix-remote={phase}>
        <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Globe size={16} />Điều khiển từ xa (Internet)</div>
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          Điện thoại ở đâu cũng mở được Limix Bot của máy tính này.
          Máy tính cần <b>đang bật, có Internet và đang chạy Limix Bot</b>.
        </p>
        <button type="button" className={`${button} w-fit`} disabled={phase === "working"} onClick={() => void run()}>
          {phase === "working" ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}Tạo mã QR từ xa
        </button>
        {phase === "working" && note && <p className="text-[12px] text-ink-secondary">{note}</p>}
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    );
  }
  const until = new Date(pairing.expiresAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline/40 bg-card px-4 py-4" data-limix-remote="ready">
      <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Globe size={16} />Điều khiển từ xa (Internet)</div>
      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-secondary">
        <li>Trên điện thoại (Internet), mở camera và quét mã bên dưới.</li>
        <li>Chạm vào đường link hiện ra. Trình duyệt tự đăng nhập.</li>
        <li>Chia sẻ → <b>Thêm vào Màn hình chính</b> để dùng như một app.</li>
      </ol>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={pairing.url} size={220} level="M" marginSize={1} bgColor="#ffffff" fgColor="#111111" /></div>
        <div className="text-[12px] text-ink-secondary">Mã dùng một lần, hết hạn lúc {until} · mã: <span className="font-mono text-ink">{pairing.code}</span></div>
        <div className="max-w-full truncate font-mono text-[11px] text-ink-tertiary">{pairing.url.split("#")[0]}</div>
        <CopyRow url={pairing.url} code={pairing.code} />
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => void run()}><RefreshCw size={14} />Tạo mã mới</button>
      </div>
    </div>
  );
}

/** For a laptop or another computer: open the copied link there (it signs that browser in once), or type the code. */
function CopyRow({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const copy = async (what: "link" | "code", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={button} onClick={() => void copy("link", url)}>{copied === "link" ? <Check size={14} /> : <Copy size={14} />}{copied === "link" ? "Đã chép link" : "Chép link"}</button>
        <button type="button" className={button} onClick={() => void copy("code", code)}>{copied === "code" ? <Check size={14} /> : <Copy size={14} />}{copied === "code" ? "Đã chép mã" : "Chép mã"}</button>
      </div>
      <p className="text-center text-[11px] text-ink-tertiary">Dùng trên laptop: dán link vào trình duyệt là vào thẳng. Link chỉ dùng được một lần.</p>
    </div>
  );
}

/** Both ways to open Limix Bot on a phone, as two tabs. */
export function LimixPhoneBrowser() {
  const [tab, setTab] = useState<"remote" | "wifi">("remote");
  const tabClass = (on: boolean) => `flex-1 rounded-lg px-3 py-1.5 text-[13px] ${on ? "bg-raised text-ink font-medium" : "text-ink-secondary hover:text-ink"}`;
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-1 rounded-xl border border-hairline/40 bg-card p-1">
        <button type="button" role="tab" aria-selected={tab === "remote"} className={tabClass(tab === "remote")} onClick={() => setTab("remote")}>Từ Xa</button>
        <button type="button" role="tab" aria-selected={tab === "wifi"} className={tabClass(tab === "wifi")} onClick={() => setTab("wifi")}>Nội Bộ</button>
      </div>
      {tab === "remote" ? <RemotePane /> : <WifiPane />}
    </div>
  );
}
