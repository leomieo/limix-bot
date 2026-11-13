import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { lx } from "@/lib/limix-text";

/** Bot → Kĩ Năng (Skills) → "Kho Kĩ Năng (Skills)": every skill installed on this computer, added to this one bot with
 * a click. Core skills of Limix Bot are always on. Settings → Kĩ Năng (Skills) is where skills are downloaded. */

interface StoreSkill {
  name: string; description: string; kind: "bundled" | "library" | "imported";
  added: boolean; core: boolean; ready: boolean; warnings: number; source: string;
}

const FILTERS = [["all", () => lx("Tất cả", "All")], ["added", () => lx("Bot đang có", "On this bot")], ["more", () => lx("Chưa thêm", "Not added")]] as const;
type Filter = (typeof FILTERS)[number][0];
const KIND = (kind: StoreSkill["kind"]) => ({ bundled: lx("Có sẵn", "Built in"), library: lx("Đã tải về", "Downloaded"), imported: lx("Từ máy tính", "From this computer") })[kind];
const button = "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50";

async function call(path: string, body?: unknown): Promise<StoreSkill[]> {
  const response = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { skills?: StoreSkill[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? lx(`Lỗi ${response.status}`, `Error ${response.status}`));
  return data.skills ?? [];
}

export function LimixSkillStoreDialog({ botId, botName, onClose, onOpenSettings }: {
  botId: string; botName: string; onClose: () => void; onOpenSettings: () => void;
}) {
  const [skills, setSkills] = useState<StoreSkill[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const path = `/api/limix/skill-store/${encodeURIComponent(botId)}`;

  useEffect(() => {
    let cancelled = false;
    call(path).then((list) => { if (!cancelled) setSkills(list); }).catch((cause: Error) => { if (!cancelled) { setSkills([]); setError(cause.message); } });
    return () => { cancelled = true; };
  }, [path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return (skills ?? []).filter((skill) =>
      (filter === "all" || (filter === "added" ? skill.added : !skill.added)) &&
      (!words || `${skill.name} ${skill.description}`.toLowerCase().includes(words)));
  }, [skills, query, filter]);

  const set = async (skill: StoreSkill, add: boolean) => {
    if (working) return;
    setWorking(skill.name);
    setError("");
    try {
      setSkills(await call(path, { name: skill.name, kind: skill.kind, add }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : lx("Không đổi được kĩ năng này.", "Couldn't change this skill."));
    } finally {
      setWorking("");
    }
  };

  const addedCount = (skills ?? []).filter((skill) => skill.added).length;
  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onMouseDown={(event) => event.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-labelledby="limix-skill-store-title" className="flex max-h-full w-full max-w-[640px] flex-col rounded-2xl border border-hairline/50 bg-panel shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-5">
          <div>
            <h2 id="limix-skill-store-title" className="text-[17px] font-semibold text-ink">{lx("Kho Kĩ Năng (Skills)", "Skills Store")}</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
              {lx(`Chọn kĩ năng riêng cho ${botName}. Chỉ những kĩ năng được thêm mới nằm trong lời nhắc của bot, nên bot không bị quá tải. Gõ /tên-kĩ-năng trong chat để gọi.`, `Pick skills just for ${botName}. Only added skills go into the bot's prompt, so it never gets overloaded. Type /skill-name in chat to call one.`)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={lx("Đóng", "Close")} className="rounded-lg p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"><X size={16} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-hairline/40 bg-inset px-3 py-2">
            <Search size={14} className="text-ink-tertiary" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={lx("Tìm kĩ năng…", "Search skills…")} aria-label={lx("Tìm kĩ năng", "Search skills")}
              className="w-full bg-transparent text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none" />
          </label>
          <div className="flex gap-1" role="tablist" aria-label={lx("Lọc kĩ năng", "Filter skills")}>
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] ${filter === id ? "bg-raised text-ink" : "text-ink-secondary hover:bg-raised"}`}>
                {label()}{id === "added" && skills ? ` ${addedCount}` : ""}
              </button>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="mx-6 mb-2 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {skills === null ? (
            <p className="flex items-center gap-2 py-6 text-[13px] text-ink-secondary"><Loader2 size={14} className="animate-spin" />{lx("Đang tải kho…", "Loading the store…")}</p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-[13px] text-ink-secondary">{skills.length === 0 ? lx("Kho chưa có kĩ năng nào.", "The store has no skills yet.") : lx("Không có kĩ năng khớp.", "No matching skills.")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline/40 rounded-xl border border-hairline/40">
              {shown.map((skill) => (
                <li key={`${skill.kind}:${skill.name}`} className="flex items-start gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[13px] text-ink">{skill.name}</span>
                      <span className="text-[12px] text-ink-tertiary">{skill.core ? lx("Kĩ năng gốc", "Core skill") : KIND(skill.kind)}</span>
                      {skill.warnings > 0 && <span className="text-[12px] text-warning">{skill.warnings} {lx("cảnh báo", "warnings")}</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-secondary">{skill.description}</p>
                  </div>
                  {skill.core ? (
                    <span className="inline-flex shrink-0 items-center gap-1 px-1 py-1.5 text-[12px] text-ink-secondary"><Check size={14} />{lx("Luôn bật", "Always on")}</span>
                  ) : skill.added ? (
                    <button type="button" className={button} disabled={Boolean(working)} onClick={() => void set(skill, false)} aria-label={lx(`Bỏ ${skill.name} khỏi bot`, `Remove ${skill.name} from this bot`)}>
                      {working === skill.name ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{lx("Đã thêm", "Added")}
                    </button>
                  ) : (
                    <button type="button" className={button} disabled={Boolean(working) || !skill.ready} onClick={() => void set(skill, true)} aria-label={lx(`Thêm ${skill.name} cho bot`, `Add ${skill.name} to this bot`)}>
                      {working === skill.name ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{lx("Thêm", "Add")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 pb-5 pt-3">
          <p className="text-[12px] text-ink-tertiary">{lx('Bấm "Đã thêm" để bỏ kĩ năng khỏi bot này.', 'Press "Added" to remove a skill from this bot.')}</p>
          <button type="button" className={button} onClick={onOpenSettings}>{lx("Tải thêm kĩ năng", "Get more skills")}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}
