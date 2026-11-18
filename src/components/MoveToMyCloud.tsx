// Moving some of this computer's bots to My Cloud, in the desktop app only: the dialog that asks which ones before the first
// move ("Move everything" as the quick way), a bot's own "Move to My Cloud" in its menu, the line that says how it goes,
// and the one row the bots that moved leave in the sidebar. Main runs the move (electron/bot-move-main.mjs).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, Check, Cloud, CloudAlert, CloudCheck, CloudOff, CloudUpload, Loader2, RotateCw, X } from "lucide-react";
import type { BotMoveState, BotMoveStatus, BotMoveView, MoveLevel } from "../../electron/cloud-send.mjs";
import { botMoveLine, filterBots, ipcErrorText, CHOOSER_PAGE, MY_CLOUD_TEAM } from "@/lib/cloud-send";
import { t } from "@/lib/i18n";
import { lx } from "@/lib/limix-text";
import type { Bot } from "@/state/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { NotNowButton, PRIMARY_BUTTON } from "./NoticeCard";

type MenuItem = (icon: ReactNode, label: string, onClick?: () => void, opts?: { disabled?: boolean; hint?: string }) => ReactNode;

const bridge = () => (!window.ogb?.remoteClient?.active ? window.ogb?.cloudSendPage : undefined);

const LEVELS: ReadonlyArray<{ level: MoveLevel; title: string; line: string }> = [
  { level: "bot", title: lx("Chỉ bot", "The bot only"), line: lx("Bộ nhớ, kỹ năng riêng, chỉ dẫn và cài đặt của bot. Nhanh nhất.", "Its memory, own skills, instructions and settings. Fastest.") },
  { level: "chats", title: lx("Bot và đoạn chat văn bản", "The bot and its text chats"), line: lx("Như trên, kèm toàn bộ nội dung trò chuyện, không kèm tệp đính kèm.", "As above, with every conversation's text, without attachments.") },
  { level: "full", title: lx("Đầy đủ", "Everything"), line: lx("Bot, đoạn chat, tệp đính kèm và thư mục làm việc của bot. Tối đa 10 GB.", "The bot, its chats, their attachments and its working folders. Up to 10 GB.") },
];

/** How much the chosen bots carry to My Cloud. */
export function MoveLevelPicker({ value, onChange, disabled }: { value: MoveLevel; onChange(next: MoveLevel): void; disabled?: boolean }) {
  return <span role="radiogroup" aria-label={lx("Chuyển những gì", "What moves")} className="flex flex-col gap-1.5" data-move-levels="">
    {LEVELS.map((entry) => <button key={entry.level} type="button" role="radio" aria-checked={value === entry.level} disabled={disabled} data-move-level={entry.level}
      onClick={() => onChange(entry.level)}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-start ${value === entry.level ? "border-accent bg-raised" : "border-hairline/50 hover:bg-raised"}`}>
      <span aria-hidden="true" className={`mt-1 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${value === entry.level ? "border-accent" : "border-ink-tertiary"}`}>
        {value === entry.level && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0"><span className="block text-[13px] font-medium text-ink">{entry.title}</span><span className="block text-[12px] leading-[1.4] text-ink-secondary">{entry.line}</span></span>
    </button>)}
  </span>;
}

/** Which bots go to My Cloud: any of them, found by name, or everything with one press. */
export function MoveChooser({ onClose, everything = true }: { onClose: () => void; everything?: boolean }) {
  const [bots, setBots] = useState<ReadonlyArray<{ id: string; name: string }> | null>(null);
  useEffect(() => {
    let alive = true;
    void bridge()?.botChoices?.().then((answer) => { if (alive) setBots(answer.bots); }, () => { if (alive) setBots([]); });
    return () => { alive = false; };
  }, []);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(CHOOSER_PAGE);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<MoveLevel>("bot");
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const found = useMemo(() => filterBots(bots ?? [], query), [bots, query]);
  const allFound = found.length > 0 && found.every((bot) => chosen.has(bot.id));
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const toggle = (id: string) => setChosen((before) => {
    const next = new Set(before);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const toggleFound = () => setChosen((before) => {
    const next = new Set(before);
    for (const bot of found) if (allFound) next.delete(bot.id); else next.add(bot.id);
    return next;
  });
  const go = (work: (() => Promise<unknown>) | undefined) => {
    if (!work) return;
    setBusy(true);
    setError(null);
    void work().then(onClose, (cause: unknown) => setError(ipcErrorText(cause) ?? t("cloudSend.choose.failed"))).finally(() => setBusy(false));
  };
  const page = bridge();
  return createPortal(<div className="ui-scrim fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="move-chooser-title" data-move-chooser=""
      className="ui-modal relative flex max-h-[min(640px,calc(100dvh-32px))] w-[min(440px,calc(100vw-32px))] flex-col border-0 p-5 text-ink">
      <h2 id="move-chooser-title" className="pe-8 text-[17px] font-semibold">{t("cloudSend.choose.title")}</h2>
      <p className="mt-1 text-[14px] leading-5 text-ink-secondary">{t("cloudSend.choose.line")}</p>
      {everything && <button type="button" disabled={busy} data-move-everything="" className={`${PRIMARY_BUTTON} mt-4 w-full justify-center`}
        onClick={() => go(page?.moveEverything)}>{t("cloudSend.choose.everything")}</button>}
      <div className="mt-4 flex items-center gap-2">
        <input type="search" value={query} placeholder={t("cloudSend.choose.search")} aria-label={t("cloudSend.choose.search")} data-move-search=""
          onChange={(event) => { setQuery(event.target.value); setShown(CHOOSER_PAGE); }} className="min-w-0 flex-1 rounded-lg border border-hairline/50 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-accent focus:outline-none disabled:opacity-50" />
        <button type="button" data-move-select-all="" disabled={!found.length} onClick={toggleFound} className="ui-button whitespace-nowrap px-2.5 py-1.5 text-[13px]">
          {t(allFound ? "cloudSend.choose.clear" : "cloudSend.choose.selectAll")}
        </button>
      </div>
      <ul className="mt-2 min-h-[120px] flex-1 overflow-y-auto rounded-md border border-hairline" data-move-bots="">
        {found.slice(0, shown).map((bot) => {
          const on = chosen.has(bot.id);
          return <li key={bot.id}>
            <button type="button" role="checkbox" aria-checked={on} data-move-bot={bot.id} onClick={() => toggle(bot.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-[14px] hover:bg-raised">
              <span className="min-w-0 flex-1 truncate" dir="auto">{bot.name}</span>
              {on && <Check size={15} aria-hidden="true" />}
            </button>
          </li>;
        })}
        {bots !== null && !found.length && <li className="px-3 py-3 text-[13px] text-ink-tertiary">{t("cloudSend.choose.none")}</li>}
        {found.length > shown && <li><button type="button" data-move-more="" className="w-full px-3 py-2 text-[13px] text-ink-secondary hover:bg-raised" onClick={() => setShown((count) => count + CHOOSER_PAGE)}>
          {t("cloudSend.choose.more", { count: found.length - shown })}
        </button></li>}
      </ul>
      <p className="mt-2 text-[12px] text-ink-tertiary">{t("cloudSend.choose.rooms")}</p>
      <div className="mt-3"><MoveLevelPicker value={level} onChange={setLevel} disabled={busy} /></div>
      {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
      <button type="button" disabled={busy || !chosen.size} data-move-chosen="" className="ui-button mt-3 w-full justify-center py-1.5 text-[14px]" onClick={() => go(page?.moveBots && (() => page.moveBots!([...chosen], level)))}>
        {busy && <Loader2 size={14} aria-hidden="true" className="me-1.5 animate-spin" />}
        {chosen.size === 1 ? t("cloudSend.choose.moveOne") : t("cloudSend.choose.moveSome", { count: chosen.size })}
      </button>
      <div className="mt-1 flex justify-center"><NotNowButton onClick={onClose} /></div>
      <button type="button" onClick={onClose} aria-label={t("common.close")} className="ui-icon-button absolute end-3 top-3"><X size={16} /></button>
    </div>
  </div>, document.body);
}

/** Whether this computer's bots can move to My Cloud now, and how each bot on its way is going: one shared read for every
 * sidebar row and menu, again each time the window is back in front and whenever main tells of a change. */
let shared: BotMoveState | null = null;
const listeners = new Set<(next: BotMoveState | null) => void>();
let stopShared: (() => void) | null = null;
function readShared() {
  const page = bridge();
  void page?.botMoveState?.().then((next) => { shared = next; for (const listener of listeners) listener(next); }, () => { shared = null; for (const listener of listeners) listener(null); });
}
function useBotMoveState(): BotMoveState | null {
  const [known, setKnown] = useState<BotMoveState | null>(shared);
  useEffect(() => {
    const page = bridge();
    if (!page?.botMoveState) return;
    listeners.add(setKnown);
    if (!stopShared) {
      window.addEventListener("focus", readShared);
      const unsubscribe = page.onNotice?.(readShared);
      const timer = window.setInterval(readShared, 15_000);
      stopShared = () => { unsubscribe?.(); window.removeEventListener("focus", readShared); window.clearInterval(timer); };
    }
    readShared();
    return () => { listeners.delete(setKnown); if (!listeners.size) { stopShared?.(); stopShared = null; } };
  }, []);
  return known;
}

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
/** In words, for a bot on its way: moving now, or why it failed and when it tries again. */
function moveStatusText(status: BotMoveStatus): string {
  if (status.phase === "moving") return lx(`Đang chuyển ${status.name} lên My Cloud…`, `Moving ${status.name} to My Cloud…`);
  const again = status.retryAt && status.retryAt > Date.now() ? lx(` Tự thử lại lúc ${clock(status.retryAt)}.`, ` Tries again at ${clock(status.retryAt)}.`) : lx(" Đang thử lại.", " Trying again.");
  return lx(`${status.name} chưa chuyển được lên My Cloud (đã thử ${status.tries ?? 1} lần): ${status.error ?? "lỗi chưa rõ"}.${again}`,
    `${status.name} has not moved to My Cloud yet (${status.tries ?? 1} tries): ${status.error ?? "unknown error"}.${again}`);
}

/** The one reason the menu item is greyed out, so the person knows what to do next instead of a catch-all. */
function blockedHint(blocked: BotMoveState["blocked"]): string {
  switch (blocked) {
    case "signed-out": return lx("Bạn chưa đăng nhập Limix Cloud. Mở Cài đặt → Limix Cloud để đăng nhập.", "You are not signed in to Limix Cloud. Open Settings → Limix Cloud to sign in.");
    case "no-cloud": return lx("Tài khoản chưa có Cloud (yêu cầu dùng thử chưa được duyệt). Mở Cài đặt → Limix Cloud để gửi yêu cầu hoặc xem trạng thái.", "This account has no Cloud yet (the trial is not approved). Open Settings → Limix Cloud to ask or check.");
    case "setting-up": return lx("Cloud đang được khởi tạo, chưa sẵn sàng nhận bot. Thử lại sau ít phút.", "The Cloud is still setting up. Try again in a few minutes.");
    case "failed": return lx("Cloud đang gặp lỗi khởi động và sẽ tự thử lại. Xem chi tiết trong Cài đặt → Limix Cloud.", "The Cloud failed to start and will retry. See Settings → Limix Cloud.");
    case "ended": return lx("Cloud của tài khoản đã dừng hoặc hết hạn.", "This account's Cloud has stopped or ended.");
    case "busy": return lx("Đang có đợt chuyển cả đội bot lên Cloud. Chờ đợt đó xong rồi thử lại.", "The whole team is moving to Cloud. Wait for it to finish.");
    default: return lx("Cloud chưa nhận bot. Kiểm tra trạng thái trong Cài đặt → Limix Cloud.", "The Cloud is not taking bots yet. Check Settings → Limix Cloud.");
  }
}

/** A bot's own "Move to My Cloud", and the one confirm it opens. */
export function useMoveToMyCloud() {
  const known = useBotMoveState();
  const [asked, setAsked] = useState<Bot | null>(null);
  // A bot already on its way, asked to carry another amount: its move's next pass carries the new level.
  const [releveling, setReleveling] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<MoveLevel>("bot");
  const [error, setError] = useState<string | null>(null);
  const confirm = () => {
    const page = bridge();
    if (!asked || !page?.moveBots) return;
    setBusy(true);
    setError(null);
    const done = releveling && page.botMoveLevel ? page.botMoveLevel([asked.id], level).then(readShared) : page.moveBots([asked.id], level);
    void done.then(() => setAsked(null), (cause: unknown) => setError(ipcErrorText(cause) ?? t("cloudSend.choose.failed"))).finally(() => setBusy(false));
  };
  const names = { bot: asked?.name ?? "" };
  return {
    items(bot: Bot, item: MenuItem): ReactNode[] {
      if (!bridge()?.botMoveState || bot.defaultBot || bot.movedTo) return [];
      const moving = known?.moving.includes(bot.id);
      const status = known?.moves?.find((entry) => entry.id === bot.id);
      if (status) return [
        item(<Cloud size={16} className="text-ink-secondary" />, t("cloudSend.botMove.menu"), undefined, { disabled: true, hint: moveStatusText(status) }),
        ...(status.phase === "failed" && bridge()?.botMoveRetry ? [item(<RotateCw size={16} className="text-ink-secondary" />, lx("Thử chuyển lên Cloud lại ngay", "Retry the move to Cloud now"), () => { void bridge()!.botMoveRetry!().then(readShared, readShared); })] : []),
        ...(status.step === "copy" && bridge()?.botMoveLevel ? [item(<ArrowRightLeft size={16} className="text-ink-secondary" />, lx("Đổi dữ liệu chuyển lên Cloud…", "Change what moves to Cloud…"), () => {
          setError(null); setLevel(status.level ?? "full"); setReleveling(true); setAsked(bot);
        })] : []),
      ];
      if (!known?.available || moving) return [item(<Cloud size={16} className="text-ink-secondary" />, t("cloudSend.botMove.menu"), undefined, {
        disabled: true,
        hint: moving ? lx("Bot này đang được chuyển lên Cloud.", "This bot is moving to Cloud.") : known === null ? lx("Chưa đọc được trạng thái chuyển bot. Mở Cài đặt → Limix Cloud để kiểm tra kết nối.", "Transfer status is unavailable. Check Settings → Limix Cloud.") : blockedHint(known.blocked),
      })];
      return [item(<Cloud size={16} className="text-ink-secondary" />, t("cloudSend.botMove.menu"), () => { setError(null); setReleveling(false); setAsked(bot); }),
        item(<ArrowRightLeft size={16} className="text-ink-secondary" />, lx("Chọn nhiều bot để chuyển lên Cloud…", "Choose bots to move to Cloud…"), () => setChoosing(true))];
    },
    dialog: <>{choosing && <MoveChooser everything={false} onClose={() => { setChoosing(false); readShared(); }} />}<ConfirmDialog open={asked !== null} tone="neutral" icon={<Cloud size={18} />}
      title={releveling ? lx(`Đổi dữ liệu chuyển của ${names.bot}`, `Change what ${names.bot} carries`) : t("cloudSend.botMove.confirmTitle", names)}
      body={<span className="flex flex-col gap-2" data-bot-move-confirm="">
        <span>{releveling ? lx("Lượt chuyển đang chạy sẽ mang theo mức bạn chọn từ lần chép tiếp theo. Mức nhẹ hơn bỏ qua phần còn lại chưa chép.", "The move under way carries the level you pick from its next copy. A lighter level skips what is not copied yet.") : t("cloudSend.botMove.confirmBody", names)}</span>
        <MoveLevelPicker value={level} onChange={setLevel} disabled={busy} />
        {error && <span role="alert" className="text-danger">{error}</span>}
      </span>}
      confirmLabel={releveling ? lx("Đổi", "Change") : t("cloudSend.botMove.confirm")} pending={busy} onCancel={() => setAsked(null)} onConfirm={confirm} /></>,
  };
}

/** A small cloud beside a bot's name: on its way to My Cloud (pulsing), failing and trying again (warning), or there. */
export function CloudMark({ bot }: { bot: Pick<Bot, "id" | "movedTo" | "defaultBot"> }) {
  const known = useBotMoveState();
  const status = known?.moves?.find((entry) => entry.id === bot.id);
  const moved = bot.movedTo?.team.id === MY_CLOUD_TEAM ? bot.movedTo : undefined;
  // Four looks: done (check), moving (upload, pulsing), failed (alert), not moved yet (dim crossed cloud, shown only while
  // some bot is on its way so the rest read as "waiting", not as clutter on every bot).
  const state: "failed" | "moving" | "done" | "waiting" | null = status
    ? (status.phase === "failed" ? "failed" : "moving")
    : moved ? (moved.state === "moving" ? "moving" : "done")
    : !bot.defaultBot && !bot.movedTo && known && (known.moving.length > 0 || (known.moves?.length ?? 0) > 0) ? "waiting" : null;
  if (!state) return null;
  const label = status ? moveStatusText(status)
    : state === "moving" ? lx("Đang chuyển lên My Cloud", "Moving to My Cloud")
    : state === "done" ? lx("Đã chuyển lên My Cloud, đang chạy trên Cloud", "Moved to My Cloud and running there")
    : lx("Chưa chuyển lên My Cloud, vẫn chạy trên máy này", "Not moved to My Cloud yet, still runs on this computer");
  const Icon = state === "failed" ? CloudAlert : state === "moving" ? CloudUpload : state === "done" ? CloudCheck : CloudOff;
  const tone = state === "failed" ? "text-warning" : state === "waiting" ? "text-ink-tertiary" : "text-accent-text";
  return <span title={label} aria-label={label} role="img" data-cloud-mark={state} className={`inline-flex shrink-0 ${tone}`}>
    <Icon size={13} aria-hidden="true" className={state === "moving" ? "animate-pulse" : undefined} />
  </span>;
}

/** The bots that moved to My Cloud, each by name with its cloud, under one heading: any of them opens My Cloud. */
export function MovedToMyCloudRow({ bots }: { bots: readonly Bot[] }) {
  const moved = bots.filter((bot) => bot.movedTo?.state === "moved" && bot.movedTo.team.id === MY_CLOUD_TEAM);
  if (!moved.length) return null;
  const page = bridge();
  const open = () => { void page?.openMyCloud?.().catch(() => {}); };
  const row = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-secondary enabled:hover:bg-menu-hover enabled:hover:text-ink";
  return <div className="flex flex-col px-2 pb-1" data-moved-to-my-cloud={moved.length}>
    <p className="flex items-center gap-1.5 px-2.5 pb-0.5 pt-1 text-[12px] font-medium text-ink-tertiary">
      <Cloud size={13} aria-hidden="true" className="text-accent-text" />
      {moved.length === 1 ? t("cloudSend.botMove.movedOne", { bot: moved[0]!.name }) : t("cloudSend.botMove.movedMany", { count: moved.length })}
    </p>
    {moved.slice(0, 12).map((bot) => <button key={bot.id} type="button" data-moved-bot={bot.id} disabled={!page?.openMyCloud} onClick={open} className={row}
      title={lx(`${bot.name} đang chạy trên My Cloud. Bấm để mở My Cloud.`, `${bot.name} runs on My Cloud. Click to open it.`)}>
      <Cloud size={14} aria-hidden="true" className="shrink-0 text-accent-text" />
      <span className="truncate" dir="auto">{bot.name}</span>
    </button>)}
    {moved.length > 12 && <button type="button" disabled={!page?.openMyCloud} onClick={open} className={row}>
      <ArrowRightLeft size={14} aria-hidden="true" className="shrink-0" />{lx(`và ${moved.length - 12} bot khác — mở My Cloud`, `and ${moved.length - 12} more — open My Cloud`)}
    </button>}
  </div>;
}

/** How the chosen bots' move goes: on its way, failed (it tries again by itself), or done. */
export function BotMoveLine({ move, onChange }: { move: BotMoveView; onChange(next: BotMoveView | null): void }) {
  const page = bridge();
  const line = botMoveLine(move);
  const link = "font-medium text-accent-text underline underline-offset-2 hover:text-ink";
  return <div role="status" data-cloud-send-strip={line.kind} data-bot-move-line={move.phase} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-hairline/40 bg-panel px-3 py-1.5 text-[13px] text-ink-secondary">
    {line.kind === "sending" ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : <ArrowRightLeft size={14} aria-hidden="true" />}
    <span dir="auto" data-cloud-send-strip-line>{line.text}</span>
    {line.kind === "done" && page?.openMyCloud && <button type="button" className={link} onClick={() => { void page.openMyCloud!().catch(() => {}); }}>{t("cloudSend.botMove.open")}</button>}
    {line.kind === "failed" && page?.botMoveRetry && <button type="button" className={link} onClick={() => { void page.botMoveRetry!().then(onChange).catch(() => {}); }}>{t("cloudSend.strip.retry")}</button>}
    {line.kind !== "sending" && <button type="button" className="hover:text-ink" onClick={() => { void page?.dismiss("bot-move").then(() => onChange(null)).catch(() => {}); }}>{t("cloudSend.strip.close")}</button>}
  </div>;
}
