import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { stoppedAtBotLimit } from "@/lib/bot-limit";
import { MausAvatar } from "./Avatar";
import { NewBotDialog } from "./lazy-screens";
import { READY_BOT_CATEGORIES, READY_BOTS, readyBotCopy, type ReadyBot, type ReadyBotCategory } from "@/lib/ready-bots";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";
import { api, useStore, type Bot } from "@/state/store";
import type { MascotBodyId } from "../../shared/mascot-bodies";
import type { MausColor } from "../../shared/wire";

/** Templates > Khám phá > Bot dựng sẵn, read from github.com/leomieo/limix-bot-teams: the page loads only the light list,
 * and a bot's full template is fetched when the person presses "Dùng mẫu". Offline, the bots built into the app show. */

const APP_LABELS: Record<string, string> = {
  gmail: "Gmail", github: "GitHub", discord: "Discord", slack: "Slack", googlecalendar: "Google Calendar",
  notion: "Notion", linear: "Linear", figma: "Figma", gong: "Gong", hubspot: "HubSpot", postiz: "Postiz",
};

const CATEGORY_KEYS: Record<ReadyBotCategory, LocaleKey> = {
  everyday: "readyBots.category.everyday", work: "readyBots.category.work", writing: "readyBots.category.writing",
  design: "readyBots.category.design", sales: "readyBots.category.sales", personal: "readyBots.category.personal",
};

interface Card {
  id: string;
  name: string;
  title: string;
  category: ReadyBotCategory;
  description: string;
  try: string;
  look: { color: MausColor; mascotBody: MascotBodyId };
  apps: string[];
  routines: number;
  /** From the app itself (offline): opened by id, nothing to download. */
  builtIn: boolean;
}

const builtInCards = (): Card[] => READY_BOTS.map((bot) => {
  const copy = readyBotCopy(bot);
  return { id: bot.id, name: bot.name, title: copy.title, category: bot.category, description: copy.description, try: copy.tryAsking,
    look: bot.look, apps: bot.apps, routines: bot.routines?.length ?? 0, builtIn: true };
});

let remembered: Card[] | null = null;

const matches = (card: Card, query: string) => {
  const needle = query.trim().toLowerCase();
  return !needle || [card.name, card.title, card.description, card.category].some((field) => field.toLowerCase().includes(needle));
};

export function LimixBotGallery({ search, onDialog, onAdded, onRefresh }: {
  search: string;
  /** "Cập nhật" also reloads the team templates listed under this section. */
  onRefresh?: () => void;
  /** The New bot dialog is open over Templates, so Templates must leave its keys alone. */
  onDialog: (open: boolean) => void;
  onAdded: (bot: Bot) => void;
}) {
  const { state, dispatch } = useStore();
  const [category, setCategory] = useState<ReadyBotCategory | null>(null);
  const [cards, setCards] = useState<Card[] | null>(remembered);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<{ id: string; data?: ReadyBot } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState("");

  useEffect(() => {
    let live = true;
    api<{ bots: Omit<Card, "builtIn">[] }>("/api/limix/bots")
      .then(({ bots }) => {
        if (!live) return;
        const next = bots.length ? bots.map((bot) => ({ ...bot, builtIn: false })) : builtInCards();
        remembered = bots.length ? next : null;
        setCards(next);
        setOffline(false);
      })
      .catch(() => { if (live) { setCards(remembered ?? builtInCards()); setOffline(!remembered); } });
    return () => { live = false; };
  }, []);

  const close = () => { setAdding(null); onDialog(false); };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    setRefreshed("");
    onRefresh?.();
    try {
      const { bots } = await api<{ bots: Omit<Card, "builtIn">[] }>("/api/limix/bots/refresh", { method: "POST" });
      const next = bots.length ? bots.map((bot) => ({ ...bot, builtIn: false })) : builtInCards();
      remembered = bots.length ? next : null;
      setCards(next);
      setOffline(false);
      setRefreshed(`Đã cập nhật: ${bots.length} bot mẫu`);
    } catch (cause) {
      setError(`Chưa cập nhật được kho mẫu: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setRefreshing(false);
    }
  };

  const use = async (card: Card) => {
    if (busy || stoppedAtBotLimit(state)) return;
    setError("");
    // A paired device may not read the host's New bot defaults that the review is filled from.
    if (window.ogb?.remoteClient?.active) { dispatch({ type: "newBot", onCreated: onAdded }); return; }
    if (card.builtIn) { setAdding({ id: card.id }); onDialog(true); return; }
    setBusy(card.id);
    try {
      const { bot } = await api<{ bot: ReadyBot }>(`/api/limix/bots/${card.id}`);
      setAdding({ id: card.id, data: bot });
      onDialog(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  if (!cards) {
    return <div className="mb-8 flex items-center gap-2 py-6 text-[13px] text-ink-secondary"><Loader2 size={15} className="animate-spin" />{t("templates.loading")}</div>;
  }
  const visible = cards.filter((card) => (!category || card.category === category) && matches(card, search));
  if (search.trim() && visible.length === 0) return null;
  return <section className="mb-8" aria-labelledby="ready-bots-title">
    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
      <h3 id="ready-bots-title" className="text-[12px] font-medium text-ink-secondary">{t("readyBots.title")}</h3>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[12px] text-ink-tertiary" role="status" aria-live="polite">{refreshed || (offline ? "Đang dùng bản có sẵn trong ứng dụng (chưa tải được kho mẫu)." : t("readyBots.subtitle"))}</p>
        <button type="button" onClick={() => void refresh()} disabled={refreshing} title="Tải lại danh sách bot mẫu và nhóm mẫu mới nhất từ kho"
          className="flex h-8 items-center gap-1.5 rounded-full bg-raised px-3 text-[12px] font-medium text-ink hover:bg-raised-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent">
          <RefreshCw size={13} aria-hidden="true" className={refreshing ? "animate-spin" : undefined} />{refreshing ? "Đang cập nhật" : "Cập nhật"}
        </button>
      </div>
    </div>
    <div className="mb-3 mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("readyBots.categories")}>
      {[null, ...READY_BOT_CATEGORIES].map((value) => <button key={value ?? "all"} type="button" aria-pressed={category === value}
        onClick={() => setCategory(value)}
        className={cn("rounded-full px-3 py-1 text-[13px] transition-colors",
          category === value ? "bg-ink text-panel" : "bg-raised/70 text-ink-secondary hover:text-ink")}>
        {value ? t(CATEGORY_KEYS[value]) : t("readyBots.all")}
      </button>)}
    </div>
    {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {visible.map((card) => <article key={card.id} data-ready-bot={card.id} className="flex flex-col rounded-2xl border border-hairline/40 bg-card p-4">
        <div className="flex items-center gap-3">
          <MausAvatar color={card.look.color} bodyId={card.look.mascotBody} size={40} animated={false} label={card.name} />
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-[14px] font-medium text-ink">{card.name}</h4>
            <p className="truncate text-[12px] text-ink-secondary">{card.title} · {t(CATEGORY_KEYS[card.category])}</p>
          </div>
          <button type="button" onClick={() => void use(card)} disabled={busy !== null} aria-label={`Dùng mẫu ${card.name}, ${card.title}`}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-raised px-3 text-[13px] font-medium text-ink hover:bg-raised-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent">
            {busy === card.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}Dùng mẫu
          </button>
        </div>
        <p className="mt-3 text-[13px] leading-[1.45] text-ink-secondary">{card.description}</p>
        <p className="mt-2 text-[12px] italic text-ink-tertiary">{t("readyBots.try", { prompt: card.try })}</p>
        {(card.apps.length > 0 || card.routines > 0) && <p className="mt-auto pt-2 text-[12px] text-ink-tertiary">
          {[card.apps.length > 0 && t("readyBots.worksWith", { apps: card.apps.map((app) => APP_LABELS[app] ?? app).join(", ") }),
            card.routines > 0 && t("readyBots.pausedRoutine")].filter(Boolean).join(" · ")}
        </p>}
      </article>)}
    </div>
    {adding && createPortal(<NewBotDialog readyBotId={adding.id} readyBotData={adding.data} onClose={close} onCreated={(bot) => { onDialog(false); onAdded(bot); }} />, document.body)}
  </section>;
}
