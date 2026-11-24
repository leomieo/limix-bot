// Limix Bot: where a bot answers outside the app. Telegram, Discord and a Facebook Page take a pasted token; Zalo signs in
// by QR. The server holds each connection itself (server/bot-channels).
import { useEffect, useState } from "react";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { lx } from "@/lib/limix-text";
import { api, type Bot } from "@/state/store";
import { Switch } from "../SettingsPrimitives";

type Kind = "telegram" | "discord" | "zalo" | "facebook" | "messenger";
type MessengerBridge = NonNullable<NonNullable<Window["ogb"]>["limixMessenger"]>;
const messengerBridge = (): MessengerBridge | undefined => window.ogb?.limixMessenger;

export interface ChannelView {
  connected: boolean;
  username?: string;
  name?: string;
  enabled?: boolean;
  access?: "owner" | "everyone";
  groupMentions?: boolean;
  owner?: string;
  admins?: Array<{ id: string; name: string }>;
  linkExpiresAt?: number;
  error?: string;
  login?: { qr?: string; scanned?: string; error?: string };
}

const CHANNELS: Array<{ kind: Kind; label: string; placeholder?: string; howTo: () => string; where: (view: ChannelView) => string; linkFrom: (view: ChannelView) => string; note?: () => string }> = [
  {
    kind: "telegram", label: "Telegram", placeholder: "123456789:AA…",
    howTo: () => lx("Tạo bot với @BotFather (lệnh /newbot), rồi dán token vào đây.", "Make a bot with @BotFather (/newbot), then paste its token here."),
    where: (view) => `@${view.username}`,
    linkFrom: (view) => lx(`Nhắn cho @${view.username}: `, `Send @${view.username}: `),
  },
  {
    kind: "discord", label: "Discord", placeholder: "MTA…",
    howTo: () => lx("Vào discord.com/developers → New Application → Bot → Reset Token, dán token vào đây. Mời bot vào server: OAuth2 → URL Generator → chọn bot và quyền Send Messages. Trong server, gọi bot bằng @tên-bot.", "At discord.com/developers: New Application → Bot → Reset Token, paste it here. Invite it with OAuth2 → URL Generator (bot, Send Messages). In a server, call it with @its-name."),
    where: (view) => `@${view.username}`,
    linkFrom: () => lx("Nhắn riêng cho bot trên Discord: ", "Send the bot a direct message on Discord: "),
  },
  {
    kind: "zalo", label: "Zalo",
    howTo: () => lx("Quét mã QR bằng ứng dụng Zalo của tài khoản sẽ làm bot.", "Scan the QR code with the Zalo app of the account that will be the bot."),
    note: () => lx("Nên dùng tài khoản Zalo phụ: đây là cách đăng nhập không chính thức (như Zalo Web), Zalo có thể khoá tài khoản. Mở Zalo Web bằng tài khoản này ở nơi khác sẽ ngắt bot.", "Use a spare Zalo account: this sign-in is unofficial (like Zalo Web) and Zalo may lock the account. Opening Zalo Web with it elsewhere disconnects the bot."),
    where: (view) => view.name || view.username || "Zalo",
    linkFrom: () => lx("Từ Zalo của bạn, nhắn cho tài khoản bot: ", "From your own Zalo, message the bot's account: "),
  },
  {
    kind: "facebook", label: "Facebook Page", placeholder: "EAA…",
    howTo: () => lx("Dán Page Access Token: developers.facebook.com → tạo app → thêm Messenger → Access Tokens → chọn Page → Generate token.", "Paste a Page access token: developers.facebook.com → create an app → add Messenger → Access Tokens → pick the Page → Generate token."),
    note: () => lx("Bot trả lời khách nhắn vào Page sau khoảng 10–20 giây. Muốn trả lời mọi khách, app Meta cần được duyệt quyền pages_messaging.", "The bot answers people who message the Page within about 10–20 seconds. To answer everyone, the Meta app needs pages_messaging approved."),
    where: (view) => view.name || "Page",
    linkFrom: () => lx("Từ Facebook cá nhân, nhắn cho Page: ", "From your own Facebook, message the Page: "),
  },
  {
    kind: "messenger", label: "Messenger",
    howTo: () => lx("Đăng nhập Facebook trong cửa sổ của app (nhập cả mã PIN khôi phục tin nhắn nếu Facebook hỏi), rồi đóng cửa sổ. App giữ một cửa sổ Facebook ẩn, đọc tin mới và gõ câu trả lời.", "Sign in to Facebook in the app's window (enter the chat-restore PIN if Facebook asks), then close it. The app keeps a hidden Facebook window that reads new messages and types the replies."),
    note: () => lx("Thử nghiệm, tài khoản cá nhân. Chỉ chạy khi app đang mở trên máy này. Nên dùng tài khoản phụ: Facebook không có cách chính thức cho tài khoản cá nhân và có thể khoá tài khoản. Ai nhắn cũng được trả lời ở chế độ an toàn.", "Beta, personal accounts. Runs only while the app is open on this computer. Use a spare account: Facebook has no official way for personal accounts and may lock it. Everyone is answered in safe mode."),
    where: () => lx("tài khoản Facebook đã đăng nhập", "the signed-in Facebook account"),
    linkFrom: () => "",
  },
];

const buttonCls = "rounded-lg bg-control px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50";

export function BotChannelCards({ bot, className }: { bot: Bot; className?: string }) {
  const [kind, setKind] = useState<Kind>("telegram");
  const [views, setViews] = useState<Partial<Record<Kind, ChannelView>>>({});
  useEffect(() => {
    let live = true;
    setViews({});
    for (const channel of CHANNELS.filter((each) => each.kind !== "messenger" || messengerBridge())) api<ChannelView>(`/api/bots/${bot.id}/${channel.kind}`).then((view) => { if (live) setViews((all) => ({ ...all, [channel.kind]: view })); }).catch(() => {});
    return () => { live = false; };
  }, [bot.id]);
  const channels = CHANNELS.filter((each) => each.kind !== "messenger" || messengerBridge());
  const channel = channels.find((each) => each.kind === kind)!;
  return (
    <div className={cn("rounded-xl bg-card p-4", className)} data-testid="channels-card">
      <div className="text-[15px] font-medium text-ink">{lx("Kênh chat", "Chat channels")}</div>
      <div className="mt-0.5 text-[13px] text-ink-secondary">{lx(`Cho ${bot.name} trả lời tin nhắn ngoài app.`, `Let ${bot.name} answer messages outside the app.`)}</div>
      <div role="tablist" className="mt-3 flex flex-wrap gap-1.5">
        {channels.map((each) => {
          const view = views[each.kind];
          return (
            <button key={each.kind} type="button" role="tab" aria-selected={kind === each.kind} onClick={() => setKind(each.kind)} data-testid={`channel-tab-${each.kind}`}
              className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px]", kind === each.kind ? "bg-control text-ink" : "text-ink-secondary hover:bg-raised-hover")}>
              {view?.connected && <span className={cn("size-1.5 rounded-full", view.error ? "bg-danger" : view.enabled ? "bg-success" : "bg-ink-tertiary")} />}
              {each.label}
            </button>
          );
        })}
      </div>
      <ChannelPanel key={`${bot.id}:${kind}`} bot={bot} channel={channel} view={views[kind]} onView={(view) => setViews((all) => ({ ...all, [kind]: view }))} />
    </div>
  );
}

function ChannelPanel({ bot, channel, view, onView }: { bot: Bot; channel: (typeof CHANNELS)[number]; view: ChannelView | undefined; onView(view: ChannelView): void }) {
  const path = `/api/bots/${bot.id}/${channel.kind}`;
  const [token, setToken] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = Boolean(view?.login && !view.login.error && !view.connected);

  useEffect(() => {
    if (!waiting && !code) return;
    let live = true;
    const timer = setInterval(() => { api<ChannelView>(path).then(next => {
      if (!live) return;
      onView(next);
      if (!next.linkExpiresAt) setCode(null);
    }).catch(() => {}); }, 2_000);
    return () => { live = false; clearInterval(timer); };
  }, [waiting, code, path, onView]);

  const run = async (request: () => Promise<ChannelView & { code?: string }>) => {
    setBusy(true); setError(null);
    try { const { code: made, ...next } = await request(); onView(next); if (made) setCode(made); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  const post = (body: unknown, suffix = "") => run(() => api(`${path}${suffix}`, { method: "POST", body: JSON.stringify(body ?? {}) }));

  if (!view) return <div className="mt-3 text-[13px] text-ink-secondary">…</div>;
  return (
    <div className="mt-3 text-[13px]" data-testid={`channel-${channel.kind}`}>
      {!view.connected && (
        <div className="flex flex-col gap-2 text-ink-secondary">
          <span>{channel.howTo()}</span>
          {channel.note && <span className="text-[12px]">{channel.note()}</span>}
          {channel.placeholder
            ? <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (token.trim()) void post({ token: token.trim() }).then(() => setToken("")); }}>
                <input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} placeholder={channel.placeholder} aria-label={lx(`Token ${channel.label}`, `${channel.label} token`)}
                  className="min-w-0 flex-1 rounded-lg bg-inset px-3 py-1.5 font-mono text-[13px] text-ink outline-none" data-testid={`channel-token-${channel.kind}`} />
                <button type="submit" disabled={busy || !token.trim()} className={buttonCls} data-testid={`channel-connect-${channel.kind}`}>{lx("Kết nối", "Connect")}</button>
              </form>
            : channel.kind === "messenger"
              ? <button type="button" className={cn(buttonCls, "self-start")} disabled={busy} onClick={() => void run(async () => (await messengerBridge()!.signIn(bot.id)) as ChannelView)} data-testid="channel-signin-messenger">{lx("Mở cửa sổ đăng nhập Facebook", "Open the Facebook sign-in window")}</button>
              : <ZaloSignIn view={view} busy={busy} start={() => void post({}, "/login")} cancel={() => void run(() => api(`${path}/login`, { method: "DELETE" }))} />}
        </div>
      )}

      {view.connected && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 text-ink">
            <span>{lx(`${bot.name} trả lời tin nhắn gửi tới ${channel.where(view)}.`, `${bot.name} answers messages sent to ${channel.where(view)}.`)}</span>
            <Switch aria-label={lx(`Bật ${channel.label}`, `${channel.label} on`)} checked={view.enabled === true} disabled={busy} onClick={() => void post({ enabled: !view.enabled })} data-testid={`channel-switch-${channel.kind}`} />
          </div>
          {channel.note && (channel.kind === "facebook" || channel.kind === "messenger") && <span className="text-[12px] text-ink-secondary">{channel.note()}</span>}
          {channel.kind === "messenger"
            ? <button type="button" className={cn(buttonCls, "self-start")} onClick={() => void messengerBridge()?.show(bot.id)}>{lx("Mở cửa sổ Messenger của bot", "Show the bot's Messenger window")}</button>
            : <div className="flex flex-col gap-2 text-ink-secondary">
                {view.owner && <div className="flex flex-wrap items-center gap-2">
                  <span>{lx(`Chủ bot: ${view.owner}`, `Owner: ${view.owner}`)}</span>
                  <button type="button" className={buttonCls} disabled={busy} onClick={() => void post({}, "/unlink")}>{lx("Bỏ liên kết", "Unlink")}</button>
                </div>}
                {view.admins?.map(admin => <div key={admin.id} className="flex flex-wrap items-center gap-2">
                  <span>{t("channels.admin.account", { name: admin.name, id: admin.id })}</span>
                  <button type="button" className={buttonCls} disabled={busy} aria-label={t("channels.admin.removeNamed", { name: admin.name, id: admin.id })}
                    onClick={() => void post({ id: admin.id }, "/remove-admin")}>{t("channels.admin.remove")}</button>
                </div>)}
                <span>{t("channels.admin.explain")}</span>
                {code && view.linkExpiresAt
                  ? <span className="text-ink" data-testid={`channel-code-${channel.kind}`}>{channel.linkFrom(view)}<code className="rounded bg-inset px-1.5 py-0.5 font-mono">/link {code}</code>{lx(" (hết hạn sau 15 phút)", " (expires in 15 minutes)")}</span>
                  : <button type="button" className={cn(buttonCls, "self-start")} disabled={busy} onClick={() => void post({}, "/link")} data-testid={`channel-link-${channel.kind}`}>{view.owner ? t("channels.admin.invite") : lx("Tạo mã liên kết", "Make a link code")}</button>}
              </div>}
          <label className="flex items-center justify-between gap-3 text-ink">
            <span>
              {lx("Trả lời cả người khác", "Answer other people too")}
              <span className="block text-[12px] text-ink-secondary">{channel.kind === "zalo"
                ? lx("Người khác có thể nhắn riêng cho bot với quyền khách.", "Other people can message the bot privately as guests.")
                : lx("Người khác và nhóm nhắn được bot ở chế độ an toàn: không dùng công cụ, không thấy cuộc trò chuyện của bạn.", "Others and groups can write to the bot in safe mode: no tools, none of your conversations.")}</span>
            </span>
            <Switch aria-label={lx("Trả lời cả người khác", "Answer other people too")} checked={view.access === "everyone"} disabled={busy} onClick={() => void post({
              access: view.access === "everyone" ? "owner" : "everyone",
              ...(view.groupMentions !== undefined ? { groupMentions: view.groupMentions } : {}),
            })} data-testid={`channel-everyone-${channel.kind}`} />
          </label>
          {channel.kind === "zalo" && (
            <label className="flex items-center justify-between gap-3 text-ink">
              <span>
                {lx("Trả lời khi được @gọi trong nhóm", "Reply to @mentions in groups")}
                <span className="block text-[12px] text-ink-secondary">{lx("Chủ bot đã liên kết luôn có toàn quyền khi gọi bot trong nhóm. Bật tùy chọn này để các thành viên khác cũng có thể gọi bot với quyền khách.", "The linked owner always has full access when mentioning the bot in a group. Turn this on to let other members mention it with guest access.")}</span>
              </span>
              <Switch aria-label={lx("Trả lời khi được @gọi trong nhóm", "Reply to @mentions in groups")} checked={view.groupMentions ?? view.access === "everyone"} disabled={busy} onClick={() => void post({ groupMentions: !(view.groupMentions ?? view.access === "everyone") })} data-testid="channel-zalo-group-mentions" />
            </label>
          )}
          <div className="flex justify-end">
            <button type="button" className={buttonCls} disabled={busy} onClick={() => void run(async () => { const gone = await api<ChannelView>(path, { method: "DELETE" }); if (channel.kind === "messenger") await messengerBridge()?.signOut(bot.id); return gone; })} data-testid={`channel-remove-${channel.kind}`}>{lx("Gỡ kết nối", "Disconnect")}</button>
          </div>
        </div>
      )}
      {(error || view.error) && <div role="alert" className="mt-2 text-[13px] text-danger">{error ?? view.error}</div>}
    </div>
  );
}

function ZaloSignIn({ view, busy, start, cancel }: { view: ChannelView; busy: boolean; start(): void; cancel(): void }) {
  const login = view.login;
  if (!login || login.error) {
    return (
      <div className="flex flex-col gap-1.5">
        {login?.error && <span className="text-danger">{login.error}</span>}
        <button type="button" className={cn(buttonCls, "self-start")} disabled={busy} onClick={start} data-testid="channel-qr-zalo">{lx("Tạo mã QR đăng nhập", "Show a sign-in QR code")}</button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      {login.qr ? <img src={login.qr} alt={lx("Mã QR đăng nhập Zalo", "Zalo sign-in QR code")} className="size-44 rounded-lg bg-white p-1.5" data-testid="channel-qr-image" /> : <div className="flex size-44 items-center justify-center rounded-lg bg-inset">…</div>}
      <div className="flex flex-col gap-2">
        <span className="text-ink">{login.scanned ? lx(`${login.scanned} đã quét. Xác nhận đăng nhập trong ứng dụng Zalo.`, `${login.scanned} scanned it. Confirm the sign-in in the Zalo app.`) : lx("Mở Zalo trên điện thoại → biểu tượng quét mã → quét mã này.", "Open Zalo on the phone → scan icon → scan this code.")}</span>
        <button type="button" className={cn(buttonCls, "self-start")} onClick={cancel}>{lx("Huỷ", "Cancel")}</button>
      </div>
    </div>
  );
}
