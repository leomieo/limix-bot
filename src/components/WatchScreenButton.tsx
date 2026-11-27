import { useEffect, useRef } from "react";
import { Monitor } from "lucide-react";
import { useStore, type Message } from "@/state/store";
import { rememberComputerPanelOpen } from "@/lib/computer-panel-focus";
import { writeComputerPanelView } from "@/lib/computer-panel-view";
import { liveScreenPlace, type EffectivePlace } from "@/lib/place";
import { COMPACT_BUBBLE } from "@/lib/compact-chip";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

export function asksToOpenBrowser(text: string): boolean {
  const command = text.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d").trim();
  return /^(?:(?:please|hay|vui long|ban|giup toi|giup minh|can you|could you)\s+)*(?:mo|truy cap|vao|open|navigate to|go to|show me)\s+(?:(?:giup (?:toi|minh)|the|this|that)\s+)*(?:trang(?:\s|$)|trinh duyet|duong (?:dan|link)|lien ket|web(?:site)?\b|browser\b|page\b|site\b|link\b|https?:\/\/|[a-z0-9-]+\.[a-z]{2,}\b)/i.test(command);
}

/** A "Watch" pill in the chat header while a running tool call is using the bot's screen and the Screen panel is
 * closed, so the person can see what the bot is doing without hunting for the monitor button. It opens the panel on
 * the tab that shows that tool (Browser or Screen), not the tab last viewed. */
export function WatchScreenButton({ botId, messages, liveTools, place, request }: { request?: Message; botId: string; messages: readonly Message[]; liveTools: ReadonlySet<string>; place: EffectivePlace }) {
  const { state, dispatch } = useStore();
  const active = liveScreenPlace(messages, liveTools, place);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (active !== "browser" || !request?.text || !asksToOpenBrowser(request.text) || handled.current === request.id) return;
    handled.current = request.id;
    if (state.computerOpen) {
      window.dispatchEvent(new CustomEvent("limix-show-bot-browser", { detail: botId }));
      return;
    }
    writeComputerPanelView(botId, "browser");
    rememberComputerPanelOpen({ botId, opener: null, tabs: false, browser: true });
    dispatch({ type: "toggleComputer", botId, open: true });
  }, [active, botId, dispatch, request, state.computerOpen]);
  const screen = state.computerOpen ? null : active;
  if (!screen) return null;
  return (
    <button
      data-testid="watch-screen"
      onClick={(event) => { writeComputerPanelView(botId, screen === "browser" ? "browser" : "computer"); rememberComputerPanelOpen({ botId, opener: event.currentTarget, tabs: event.detail === 0, browser: screen === "browser" }); dispatch({ type: "toggleComputer", open: true }); }}
      className={cn("flex items-center gap-1.5 rounded-full border border-hairline/40 bg-raised/60 px-2.5 py-1 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink", COMPACT_BUBBLE)}
      title={t("chat.watchScreenHint")}
    >
      <Monitor size={13} aria-hidden="true" />
      <span>{t("chat.watchScreen")}</span>
    </button>
  );
}
