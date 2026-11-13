import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Globe, Loader2, RefreshCw, Smartphone, Wifi } from "lucide-react";

import { api } from "@/state/api";
import { lx } from "@/lib/limix-text";

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
        body: JSON.stringify({ label: lx("Điện thoại (trình duyệt)", "Phone (browser)"), ttlMs: 15 * 60_000 }),
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
    return <p className="text-[13px] text-ink-secondary">{lx("Mở mục này trong ứng dụng Limix Bot trên máy tính.", "Open this in the Limix Bot desktop app.")}</p>;
  }
  if (!state) return <Loader2 size={15} className="animate-spin text-ink-secondary" />;

  if (!state.on) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-hairline/40 bg-card px-4 py-4" data-limix-phone="off">
        <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Smartphone size={16} />{lx("Mở Limix Bot trên điện thoại", "Open Limix Bot on your phone")}</div>
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          {lx(<>Điện thoại dùng chung Wi-Fi với máy tính này có thể mở Limix Bot bằng trình duyệt (Safari, Chrome), không cần cài app. Bật xong, Limix Bot khởi động lại một lần. Nếu Windows hỏi quyền mạng, chọn <b>Cho phép</b> (mạng riêng).</>,
            <>A phone on the same Wi-Fi as this computer can open Limix Bot in its browser (Safari, Chrome), no app to install. After you turn it on, Limix Bot restarts once. If Windows asks about network access, choose <b>Allow</b> (private network).</>)}
        </p>
        <button type="button" className={`${button} w-fit`} disabled={busy} onClick={() => void turn(true)}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}{lx("Bật và khởi động lại", "Turn on and restart")}
        </button>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    );
  }

  if (!state.active) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-hairline/40 bg-card px-4 py-4">
        <p className="text-[13px] text-ink">{lx("Đã bật. Khởi động lại Limix Bot để điện thoại mở được.", "Turned on. Restart Limix Bot so your phone can connect.")}</p>
        <button type="button" className={`${button} w-fit`} disabled={busy} onClick={() => void turn(true)}>{lx("Khởi động lại ngay", "Restart now")}</button>
      </div>
    );
  }

  const until = pairing ? new Date(pairing.expiresAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline/40 bg-card px-4 py-4" data-limix-phone="on">
      <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Smartphone size={16} />{lx("Mở Limix Bot trên điện thoại", "Open Limix Bot on your phone")}</div>
      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-secondary">
        <li>{lx("Điện thoại bắt cùng Wi-Fi với máy tính này.", "Connect your phone to the same Wi-Fi as this computer.")}</li>
        <li>{lx("Mở camera, quét mã bên dưới, chạm vào đường link hiện ra.", "Open the camera, scan the code below, tap the link that appears.")}</li>
        <li>{lx(<>Trong trình duyệt: Chia sẻ → <b>Thêm vào Màn hình chính</b> để dùng như một app.</>, <>In the browser: Share → <b>Add to Home Screen</b> to use it like an app.</>)}</li>
      </ol>
      {pairing?.url ? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={pairing.url} size={220} level="M" marginSize={1} bgColor="#ffffff" fgColor="#111111" /></div>
          <div className="text-[12px] text-ink-secondary">{lx("Mã dùng một lần, hết hạn lúc", "One-time code, expires at")} {until} · {lx("mã", "code")}: <span className="font-mono text-ink">{pairing.code}</span></div>
          <div className="max-w-full truncate font-mono text-[11px] text-ink-tertiary">{pairing.url.split("#")[0]}</div>
          <CopyRow url={pairing.url} code={pairing.code} />
        </div>
      ) : pairing ? (
        <p className="text-[13px] text-warning">{lx("Máy tính chưa có địa chỉ Wi-Fi. Kiểm tra máy đã nối Wi-Fi hoặc mạng dây trong nhà, rồi tạo mã mới.", "This computer has no Wi-Fi address. Check it is on your home Wi-Fi or wired network, then create a new code.")}</p>
      ) : busy ? <Loader2 size={15} className="animate-spin text-ink-secondary" /> : null}
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => void newCode()}><RefreshCw size={14} />{lx("Tạo mã mới", "New code")}</button>
        <button type="button" className={button} disabled={busy} onClick={() => void turn(false)}>{lx("Tắt", "Turn off")}</button>
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
      setError(lx("Mở mục này trong ứng dụng Limix Bot trên máy tính.", "Open this in the Limix Bot desktop app."));
      return;
    }
    setPhase("working");
    setError(null);
    setPairing(null);
    try {
      setNote(lx("Đang bật đường truyền từ xa cho máy tính này…", "Turning on remote access for this computer…"));
      await host.companion.start();
      await host.companion.setRoute("https", true);
      let endpoint = "";
      let requested = false;
      for (let i = 0; i < 45 && !endpoint; i++) {
        let account = await host.companionAccount.state();
        if (!requested && (account.status === "error" || (account.status === "ready" && !account.endpoint))) {
          requested = true;
          account = await host.companionAccount.prepare();
        }
        if (account.status === "ready" && account.endpoint && /\.limixmedia\.com$/.test(new URL(account.endpoint).hostname)) { endpoint = account.endpoint; break; }
        if (account.status === "signed-out" && i >= 3) throw new Error(lx("Máy này chưa đăng nhập tài khoản Limix. Đăng xuất rồi đăng nhập lại Limix Bot, sau đó thử lại.", "This computer is not signed in to a Limix account. Sign out, sign in to Limix Bot again, then retry."));
        if (account.status === "error") throw new Error(account.message || lx("Không thể bật kết nối từ xa. Hãy thử lại.", "Could not enable remote access. Please retry."));
        if (account.status === "ready" && account.endpoint) throw new Error(lx("Địa chỉ từ xa không thuộc Limix. Hãy đăng nhập lại tài khoản Limix.", "The remote address is outside the Limix domain. Sign in to your Limix account again."));
        setNote(i < 6 ? lx("Đang tạo địa chỉ riêng cho máy này trên Cloudflare…", "Creating a private address for this computer on Cloudflare…") : lx("Vẫn đang tạo địa chỉ, chờ thêm chút…", "Still creating the address, one moment…"));
        await pause(2000);
      }
      if (!endpoint) throw new Error(lx("Chưa tạo được địa chỉ từ xa sau 90 giây. Kiểm tra máy có Internet rồi thử lại.", "Couldn't create the remote address within 90 seconds. Check the computer is online, then retry."));
      const made = await api<{ code: string; expiresAt: number }>("/api/auth/pairing", {
        method: "POST",
        body: JSON.stringify({ label: lx("Điện thoại (từ xa)", "Phone (remote)"), ttlMs: 15 * 60_000 }),
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
        <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Globe size={16} />{lx("Điều khiển từ xa (Internet)", "Remote control (Internet)")}</div>
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          {lx(<>Điện thoại ở đâu cũng mở được Limix Bot của máy tính này. Máy tính cần <b>đang bật, có Internet và đang chạy Limix Bot</b>.</>,
            <>Your phone can open this computer's Limix Bot from anywhere. The computer must be <b>on, online and running Limix Bot</b>.</>)}
        </p>
        <button type="button" className={`${button} w-fit`} disabled={phase === "working"} onClick={() => void run()}>
          {phase === "working" ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}{lx("Tạo mã QR từ xa", "Create remote QR code")}
        </button>
        {phase === "working" && note && <p className="text-[12px] text-ink-secondary">{note}</p>}
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    );
  }
  const until = new Date(pairing.expiresAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline/40 bg-card px-4 py-4" data-limix-remote="ready">
      <div className="flex items-center gap-2 text-[14px] font-medium text-ink"><Globe size={16} />{lx("Điều khiển từ xa (Internet)", "Remote control (Internet)")}</div>
      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-secondary">
        <li>{lx("Trên điện thoại (Internet), mở camera và quét mã bên dưới.", "On your phone (any network), open the camera and scan the code below.")}</li>
        <li>{lx("Chạm vào đường link hiện ra. Trình duyệt tự đăng nhập.", "Tap the link that appears. The browser signs in by itself.")}</li>
        <li>{lx(<>Chia sẻ → <b>Thêm vào Màn hình chính</b> để dùng như một app.</>, <>Share → <b>Add to Home Screen</b> to use it like an app.</>)}</li>
      </ol>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={pairing.url} size={220} level="M" marginSize={1} bgColor="#ffffff" fgColor="#111111" /></div>
        <div className="text-[12px] text-ink-secondary">{lx("Mã dùng một lần, hết hạn lúc", "One-time code, expires at")} {until} · {lx("mã", "code")}: <span className="font-mono text-ink">{pairing.code}</span></div>
        <div className="max-w-full truncate font-mono text-[11px] text-ink-tertiary">{pairing.url.split("#")[0]}</div>
        <CopyRow url={pairing.url} code={pairing.code} />
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => void run()}><RefreshCw size={14} />{lx("Tạo mã mới", "New code")}</button>
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
        <button type="button" className={button} onClick={() => void copy("link", url)}>{copied === "link" ? <Check size={14} /> : <Copy size={14} />}{copied === "link" ? lx("Đã chép link", "Link copied") : lx("Chép link", "Copy link")}</button>
        <button type="button" className={button} onClick={() => void copy("code", code)}>{copied === "code" ? <Check size={14} /> : <Copy size={14} />}{copied === "code" ? lx("Đã chép mã", "Code copied") : lx("Chép mã", "Copy code")}</button>
      </div>
      <p className="text-center text-[11px] text-ink-tertiary">{lx("Dùng trên laptop: dán link vào trình duyệt là vào thẳng. Link chỉ dùng được một lần.", "On a laptop: paste the link into a browser to go straight in. The link works only once.")}</p>
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
        <button type="button" role="tab" aria-selected={tab === "remote"} className={tabClass(tab === "remote")} onClick={() => setTab("remote")}>{lx("Từ Xa", "Remote")}</button>
        <button type="button" role="tab" aria-selected={tab === "wifi"} className={tabClass(tab === "wifi")} onClick={() => setTab("wifi")}>{lx("Nội Bộ", "Local")}</button>
      </div>
      {tab === "remote" ? <RemotePane /> : <WifiPane />}
    </div>
  );
}
