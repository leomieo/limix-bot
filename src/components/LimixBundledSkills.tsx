import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import { Card } from "./SettingsPrimitives";
import { LimixToolsDialog, limixTools } from "./LimixToolsDialog";

/** Settings > Skills: the skills that ship with Limix Bot (skills/<id>). Every bot uses one by itself when a message
 * contains one of its trigger words, so they need no assigning; this card shows them and the programs they need. */
interface Bundled { id: string; name: string; description: string; defaultEnabled: boolean; triggerTerms: string[] }

export function LimixBundledSkills() {
  const [skills, setSkills] = useState<Bundled[] | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/limix/bundled-skills")
      .then((response) => (response.ok ? response.json() : { skills: [] }))
      .then((body: { skills?: Bundled[] }) => setSkills(body.skills ?? []))
      .catch(() => setSkills([]));
  }, []);

  return (
    <Card title="Kỹ năng có sẵn của Limix Bot" subtitle="Đi kèm ứng dụng. Mọi bot tự dùng khi tin nhắn có từ khóa liên quan, không cần gán cho từng bot.">
      <div className="flex flex-col gap-3">
        {skills === null ? null : skills.length === 0 ? (
          <p className="text-[13px] text-ink-secondary">Chưa thấy kỹ năng có sẵn nào trong bản cài này.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline/40 rounded-xl border border-hairline/40">
            {skills.map((skill) => (
              <li key={skill.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-ink">{skill.id}</span>
                  {!skill.defaultEnabled && <span className="text-[12px] text-ink-tertiary">tắt sẵn</span>}
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{skill.description}</p>
                {skill.triggerTerms.length > 0 && (
                  <p className="mt-1 text-[12px] text-ink-tertiary">Từ khóa: {skill.triggerTerms.slice(0, 6).join(", ")}{skill.triggerTerms.length > 6 ? "…" : ""}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {limixTools() && (
          <button type="button" onClick={() => setToolsOpen(true)} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover">
            <Wrench size={14} />Công cụ cho kỹ năng (cài phần còn thiếu)
          </button>
        )}
      </div>
      {toolsOpen && <LimixToolsDialog onClose={() => setToolsOpen(false)} />}
    </Card>
  );
}
