// Limix Bot: the bot answers on Telegram. Paste the token from @BotFather, then link your own Telegram with a one-time
// code; the server reads the bot's messages itself (server/limix-telegram.ts).
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { lx } from "@/lib/limix-text";
import { api, type Bot } from "@/state/store";
import { Switch } from "../SettingsPrimitives";

export interface TelegramView {
  connected: boolean;
  username?: string;
  enabled?: boolean;
  access?: "owner" | "everyone";
  owner?: string;
  linkExpiresAt?: number;
  error?: string;
}

const buttonCls = "rounded-lg bg-control px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50";

export function TelegramCard({ bot, className }: { bot: Bot; className?: string }) {
  const path = `/api/bots/${bot.id}/telegram`;
  const [view, setView] = useState<TelegramView | null>(null);
  const [token, setToken] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setView(null); setCode(null); setToken("");
    api<TelegramView>(path).then((loaded) => { if (live) setView(loaded); }).catch((cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { live = false; };
  }, [path]);

  const run = async (request: () => Promise<TelegramView & { code?: string }>) => {
    setBusy(true); setError(null);
    try { const { code: made, ...next } = await request(); setView(next); if (made) setCode(made); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  const post = (body: unknown, suffix = "") => run(() => api(`${path}${suffix}`, { method: "POST", body: JSON.stringify(body ?? {}) }));

  return (
    <div className={cn("rounded-xl bg-card p-4", className)} data-testid="telegram-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ink">Telegram</div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">
            {view?.connected
              ? lx(`${bot.name} trả lời tin nhắn gửi tới @${view.username}.`, `${bot.name} answers messages sent to @${view.username}.`)
              : lx(`Cho ${bot.name} trả lời trên Telegram: tạo bot với @BotFather (lệnh /newbot), rồi dán token vào đây.`, `Let ${bot.name} answer on Telegram: make a bot with @BotFather (/newbot), then paste its token here.`)}
          </div>
        </div>
        {view?.connected && <Switch aria-label={lx("Bật Telegram", "Telegram on")} checked={view.enabled === true} disabled={busy} onClick={() => void post({ enabled: !view.enabled })} data-testid="telegram-switch" />}
      </div>

      {view && !view.connected && (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (token.trim()) void post({ token: token.trim() }).then(() => setToken("")); }}>
          <input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} placeholder="123456789:AA…" aria-label={lx("Token bot Telegram", "Telegram bot token")}
            className="min-w-0 flex-1 rounded-lg bg-inset px-3 py-1.5 font-mono text-[13px] text-ink outline-none" data-testid="telegram-token" />
          <button type="submit" disabled={busy || !token.trim()} className={buttonCls} data-testid="telegram-connect">{lx("Kết nối", "Connect")}</button>
        </form>
      )}

      {view?.connected && (
        <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
          {view.owner
            ? <div className="flex flex-wrap items-center gap-2 text-ink-secondary">
                <span>{lx(`Chủ bot trên Telegram: ${view.owner}. Bạn nhắn ở đó như nhắn trong app, toàn quyền.`, `Owner on Telegram: ${view.owner}. You write there as in the app, with full access.`)}</span>
                <button type="button" className={buttonCls} disabled={busy} onClick={() => void post({}, "/unlink")}>{lx("Bỏ liên kết", "Unlink")}</button>
              </div>
            : <div className="flex flex-col gap-1.5 text-ink-secondary">
                <span>{lx("Liên kết Telegram của bạn để nhắn với bot như trong app:", "Link your own Telegram to talk to the bot as in the app:")}</span>
                {code
                  ? <span className="text-ink" data-testid="telegram-code">{lx(`Nhắn cho @${view.username}: `, `Send @${view.username}: `)}<code className="rounded bg-inset px-1.5 py-0.5 font-mono">/link {code}</code>{lx(" (hết hạn sau 15 phút)", " (expires in 15 minutes)")}</span>
                  : <button type="button" className={cn(buttonCls, "self-start")} disabled={busy} onClick={() => void post({}, "/link")} data-testid="telegram-link">{lx("Tạo mã liên kết", "Make a link code")}</button>}
              </div>}
          <label className="flex items-center justify-between gap-3 text-ink">
            <span>
              {lx("Trả lời cả người khác", "Answer other people too")}
              <span className="block text-[12px] text-ink-secondary">{lx("Người khác nhắn được bot ở chế độ an toàn: không dùng công cụ, không thấy cuộc trò chuyện của bạn.", "Others can write to the bot in safe mode: no tools, none of your conversations.")}</span>
            </span>
            <Switch aria-label={lx("Trả lời cả người khác", "Answer other people too")} checked={view.access === "everyone"} disabled={busy} onClick={() => void post({ access: view.access === "everyone" ? "owner" : "everyone" })} data-testid="telegram-everyone" />
          </label>
          <div className="flex justify-end">
            <button type="button" className={buttonCls} disabled={busy} onClick={() => void run(() => api(path, { method: "DELETE" }))} data-testid="telegram-remove">{lx("Gỡ kết nối", "Disconnect")}</button>
          </div>
        </div>
      )}
      {(error || view?.error) && <div role="alert" className="mt-2 text-[13px] text-danger">{error ?? view?.error}</div>}
    </div>
  );
}
