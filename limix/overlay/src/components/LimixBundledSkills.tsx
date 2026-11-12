import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import { Card } from "./SettingsPrimitives";
import { LimixToolsDialog, limixTools } from "./LimixToolsDialog";

/** Settings > Skills: the skills that ship with Limix Bot (skills/<id>). Core ones are on for every bot; the others are
 * added to one bot at a time from its store (server/limix-skill-store.ts). A bot uses one when a message has a trigger word or /id. */
interface Bundled { id: string; name: string; description: string; defaultEnabled: boolean; triggerTerms: string[]; core?: boolean }

export function LimixBundledSkills() {
  const [skills, setSkills] = useState<Bundled[] | null>(null);
  useEffect(() => {
    void fetch("/api/limix/bundled-skills")
      .then((response) => (response.ok ? response.json() : { skills: [] }))
      .then((body: { skills?: Bundled[] }) => setSkills(body.skills ?? []))
      .catch(() => setSkills([]));
  }, []);

  return (
    <Card title="Kĩ năng có sẵn của Limix Bot" subtitle="Đi kèm ứng dụng. Kĩ năng gốc luôn bật cho mọi bot; các kĩ năng khác nằm trong kho, thêm cho từng bot ở mục Kĩ Năng (Skills) của bot.">
      <div className="flex flex-col gap-3">
        {skills === null ? null : skills.length === 0 ? (
          <p className="text-[13px] text-ink-secondary">Chưa thấy kỹ năng có sẵn nào trong bản cài này.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline/40 rounded-xl border border-hairline/40">
            {skills.map((skill) => (
              <li key={skill.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-ink">{skill.id}</span>
                  <span className="text-[12px] text-ink-tertiary">{skill.core ? "Kĩ năng gốc · mọi bot" : "Trong kho · thêm cho từng bot"}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{skill.description}</p>
                {skill.triggerTerms.length > 0 && (
                  <p className="mt-1 text-[12px] text-ink-tertiary">Từ khóa: {skill.triggerTerms.slice(0, 6).join(", ")}{skill.triggerTerms.length > 6 ? "…" : ""}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Settings > Skills, first card: the programs skills need (Docker, Node, ffmpeg, Java…), installed with one click. */
export function LimixToolsCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card title="Công cụ cho kỹ năng" subtitle="Chương trình mà các kỹ năng cần để chạy: Docker, Node.js, ffmpeg, Java, JADX, Ghidra, Agent-Reach… Thiếu gì thì bấm cài.">
      {limixTools() ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover">
          <Wrench size={14} />Xem và cài công cụ còn thiếu
        </button>
      ) : (
        <p className="text-[13px] text-ink-secondary">Mở mục này trong ứng dụng Limix Bot trên máy tính.</p>
      )}
      {open && <LimixToolsDialog onClose={() => setOpen(false)} />}
    </Card>
  );
}
