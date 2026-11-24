import { t } from "@/lib/i18n";
import { useAdvancedMode } from "@/lib/interface-mode";
import { useStore, type Bot } from "@/state/store";
import { HELPER_ASK_KEYS } from "../HelperIntro";
import { HelperTemplateSuggestions } from "../HelperTemplateSuggestions";
import { Card } from "./rows";

export function TryAsking({ bot }: { bot: Bot }) {
  const { dispatch } = useStore();
  const advanced = useAdvancedMode();
  if (!bot.defaultBot) return null;
  if (advanced) return <HelperTemplateSuggestions placement="panel-card" />;
  return (
    <Card label={t("botPanel.tryAsking")} anchor="try-asking">
      {HELPER_ASK_KEYS.map((key) => (
        <button key={key} type="button" data-panel-ask={key}
          onClick={() => dispatch({ type: "send", botId: bot.id, text: t(key), threadId: bot.threadId })}
          className="flex h-9 w-full items-center px-3.5 text-left text-[14px] text-ink transition-colors hover:bg-ink/[0.03]">
          <span className="truncate">{t(key)}</span>
        </button>
      ))}
      <HelperTemplateSuggestions placement="panel" />
    </Card>
  );
}
