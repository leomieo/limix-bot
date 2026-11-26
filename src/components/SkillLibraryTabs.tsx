import { useId, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { lx } from "@/lib/limix-text";

const tabs = ["catalog", "bundled", "local", "tools"] as const;
type Tab = (typeof tabs)[number];

export function SkillLibraryTabs({ catalog, bundled, tools, children }: {
  catalog: ReactNode;
  bundled: ReactNode;
  tools: ReactNode;
  children: ReactNode;
}) {
  const [active, setActive] = useState<Tab>("catalog");
  const id = useId();
  const labels = {
    catalog: lx("Kho kỹ năng", "Skill catalog"),
    bundled: lx("Có sẵn", "Built-in"),
    local: t("skills.library.title"),
    tools: lx("Công cụ", "Tools"),
  };
  const panels = { catalog, bundled, local: children, tools };
  return (
    <>
      <div role="tablist" aria-label={t("settings.section.skills")} className="sticky top-0 z-10 flex flex-wrap gap-1 self-start rounded-xl border border-hairline/40 bg-card p-1">
        {tabs.map((tab, index) => (
          <button key={tab} type="button" role="tab" id={id + tab} aria-controls={id + tab + "-panel"}
            aria-selected={active === tab} tabIndex={active === tab ? 0 : -1}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${active === tab ? "bg-control text-ink" : "text-ink-secondary hover:text-ink"}`}
            onClick={() => setActive(tab)}
            onKeyDown={(event) => {
              const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index };
              const offset = offsets[event.key as keyof typeof offsets];
              if (typeof offset !== "number") return;
              event.preventDefault();
              const next = tabs[(index + offset + tabs.length) % tabs.length]!;
              setActive(next);
              document.getElementById(id + next)?.focus();
            }}>
            {labels[tab]}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <section key={tab} role="tabpanel" id={id + tab + "-panel"} aria-labelledby={id + tab} hidden={active !== tab}>
          <div className="flex flex-col gap-4">{panels[tab]}</div>
        </section>
      ))}
    </>
  );
}
