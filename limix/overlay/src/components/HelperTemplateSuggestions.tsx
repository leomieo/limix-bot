import { t } from "@/lib/i18n";
import { openIndustrySuggestions } from "@/lib/industry-suggestions";
import { useOwnerOrAdmin } from "@/lib/use-owner-or-admin";
import { Card } from "./bot-panel/rows";

const suggestions = [
  { kind: "department", label: "helperIntro.templates.department" },
  { kind: "team", label: "helperIntro.templates.team" },
  { kind: "support", label: "helperIntro.templates.support" },
] as const;

export function HelperTemplateSuggestions({ placement = "chat" }: { placement?: "chat" | "panel" | "panel-card" }) {
  const allowed = useOwnerOrAdmin();
  if (allowed === false || (typeof window !== "undefined" && window.ogb?.remoteClient?.active)) return null;
  const panel = placement !== "chat";
  const buttons = (
    <div role="group" aria-label={t("helperIntro.templates.group")} className={panel ? "flex flex-col" : "flex max-w-full flex-wrap gap-1.5"}>
      {suggestions.map(({ kind, label }) => (
        <button key={kind} type="button" data-helper-template={kind} onClick={event => openIndustrySuggestions(kind, event.currentTarget)}
          className={panel
            ? "min-h-9 w-full px-3.5 py-1 text-left text-[14px] text-ink hover:bg-ink/[0.03]"
            : "rounded-full border border-hairline/60 bg-app px-3 py-1.5 text-left text-[13px] text-ink hover:bg-raised-hover"}>
          {t(label)}
        </button>
      ))}
    </div>
  );
  return placement === "panel-card" ? <Card label={t("helperIntro.templates.group")} anchor="try-asking">{buttons}</Card> : buttons;
}
