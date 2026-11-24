import { activeLocale } from "@/lib/i18n";
// "Xem thêm" on a bot template or a team template: everything the template brings, laid out the same way for each, so a
// person can compare two before pressing "Dùng mẫu". Nothing is created here.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { catalogCopy, industrySkillLabel, type TeamCatalogEntry } from "@/lib/team-catalog";
import { teamImportPreview, type PendingTeamImport } from "@/lib/team-import";
import { t } from "@/lib/i18n";
import { api } from "@/state/store";
import { createPortal } from "react-dom";
import { Loader2, Plus, X } from "lucide-react";
import { lx } from "@/lib/limix-text";

export interface TemplateDetailSection {
  label: string;
  /** A list shows as bullets; a string as a paragraph (kept line breaks). */
  body: readonly string[] | string;
}

export function TemplateDetails({ title, subtitle, icon, loading, error, sections, useLabel, onUse, onClose }: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  loading?: boolean;
  error?: string;
  sections: readonly TemplateDetailSection[];
  useLabel: string;
  onUse?: () => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("[data-details-close]")?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const shown = sections.filter((section) => (typeof section.body === "string" ? section.body.trim() : section.body.length) );
  return createPortal(<div className="ui-scrim fixed inset-0 z-[90] flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="template-details-title" data-template-details=""
      className="ui-modal relative flex max-h-[min(720px,calc(100dvh-32px))] w-[min(560px,calc(100vw-32px))] flex-col border-0 p-0 text-ink">
      <div className="flex items-center gap-3 border-b border-hairline/40 px-5 py-4 pe-12">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 id="template-details-title" className="break-words text-[17px] font-semibold">{title}</h2>
          {subtitle && <p className="break-words text-[13px] text-ink-secondary">{subtitle}</p>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading && <p className="flex items-center gap-2 py-2 text-[13px] text-ink-secondary"><Loader2 size={14} className="animate-spin" aria-hidden="true" />{lx("Đang tải chi tiết…", "Loading details…")}</p>}
        {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
        {shown.map((section) => <section key={section.label} className="mb-4 last:mb-0">
          <h3 className="mb-1 text-[12px] font-medium uppercase tracking-wide text-ink-tertiary">{section.label}</h3>
          {typeof section.body === "string"
            ? <p className="whitespace-pre-line break-words text-[13px] leading-[1.5] text-ink-secondary">{section.body}</p>
            : <ul className="list-disc space-y-0.5 ps-5 text-[13px] leading-[1.5] text-ink-secondary">{section.body.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul>}
        </section>)}
      </div>
      <div className="flex justify-end gap-2 border-t border-hairline/40 px-5 py-3">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[13px] text-ink-secondary hover:text-ink">{lx("Đóng", "Close")}</button>
        {onUse && <button type="button" onClick={onUse} className="flex items-center gap-1 rounded-full bg-raised px-4 py-2 text-[13px] font-medium text-ink hover:bg-raised-hover">
          <Plus size={14} aria-hidden="true" />{useLabel}
        </button>}
      </div>
      <button type="button" data-details-close="" onClick={onClose} aria-label={lx("Đóng", "Close")} className="ui-icon-button absolute end-3 top-3"><X size={16} /></button>
    </div>
  </div>, document.body);
}

/** "Xem thêm" on a team template: the catalog line plus who is on the team, read from its manifest. */
export function TeamTemplateDetails({ entry, onUse, onClose }: { entry: TeamCatalogEntry; onUse: () => void; onClose: () => void }) {
  const copy = catalogCopy(entry);
  const [team, setTeam] = useState<PendingTeamImport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api(`/api/team-library/teams/${entry.slug}${entry.builtIn ? `?locale=${activeLocale()}` : ""}`).then((manifest) => { if (live) setTeam(teamImportPreview(manifest)); },
      (cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { live = false; };
  }, [entry.slug]);
  const facts = [
    t("templates.botCount", { count: team?.members.length ?? entry.members }),
    ...(team ? [lx(`${team.rooms} phòng`, `${team.rooms} rooms`), lx(`${team.routines} lịch định kỳ`, `${team.routines} routines`)] : []),
    ...(entry.setupMinutes ? [t("templates.minutes", { count: entry.setupMinutes })] : []),
  ];
  return <TemplateDetails
    title={copy.name}
    subtitle={copy.category}
    loading={!team && !error}
    error={error}
    sections={[
      { label: lx("Nhóm này làm gì", "What the team does"), body: [copy.summary, copy.outcome].filter(Boolean).join("\n\n") },
      { label: lx("Tổng quan", "At a glance"), body: facts },
      { label: lx("Thành viên", "Members"), body: (team?.members ?? []).map((member) => (member.title ? `${member.name} — ${member.title}` : member.name)) },
      { label: lx("Kỹ năng đi kèm", "Skills included"), body: entry.builtIn ? entry.skills.map(industrySkillLabel) : team?.skills?.length ? team.skills : entry.skills },
      { label: lx("Ứng dụng cần kết nối", "Apps needed"), body: team?.apps.length ? team.apps.map((app) => (app.optional ? lx(`${app.label} (không bắt buộc)`, `${app.label} (optional)`) : app.label)) : entry.requires.apps },
      { label: lx("Lưu ý", "Notes"), body: team?.warnings ?? [] },
    ]}
    useLabel={t("templates.load")}
    onUse={onUse}
    onClose={onClose}
  />;
}
