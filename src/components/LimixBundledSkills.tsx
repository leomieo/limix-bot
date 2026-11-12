import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import { Card } from "./SettingsPrimitives";
import { LimixToolsDialog, limixTools } from "./LimixToolsDialog";
import { lx } from "@/lib/limix-text";

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
    <Card title={lx("Kĩ năng có sẵn của Limix Bot", "Skills built into Limix Bot")} subtitle={lx("Đi kèm ứng dụng. Kĩ năng gốc luôn bật cho mọi bot; các kĩ năng khác nằm trong kho, thêm cho từng bot ở mục Kĩ Năng (Skills) của bot.", "Shipped with the app. Core skills are always on for every bot; the others wait in the store, and you add them to one bot at a time under the bot's Skills page.")}>
      <div className="flex flex-col gap-3">
        {skills === null ? null : skills.length === 0 ? (
          <p className="text-[13px] text-ink-secondary">{lx("Chưa thấy kỹ năng có sẵn nào trong bản cài này.", "No built-in skills were found in this install.")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline/40 rounded-xl border border-hairline/40">
            {skills.map((skill) => (
              <li key={skill.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-ink">{skill.id}</span>
                  <span className="text-[12px] text-ink-tertiary">{skill.core ? lx("Kĩ năng gốc · mọi bot", "Core skill · every bot") : lx("Trong kho · thêm cho từng bot", "In the store · add per bot")}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{skill.description}</p>
                {skill.triggerTerms.length > 0 && (
                  <p className="mt-1 text-[12px] text-ink-tertiary">{lx("Từ khóa", "Keywords")}: {skill.triggerTerms.slice(0, 6).join(", ")}{skill.triggerTerms.length > 6 ? "…" : ""}</p>
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
    <Card title={lx("Công cụ cho kỹ năng", "Tools for skills")} subtitle={lx("Chương trình mà các kỹ năng cần để chạy: Docker, Node.js, ffmpeg, Java, JADX, Ghidra, Agent-Reach… Thiếu gì thì bấm cài.", "Programs the skills need to run: Docker, Node.js, ffmpeg, Java, JADX, Ghidra, Agent-Reach… Install whatever is missing.")}>
      {limixTools() ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover">
          <Wrench size={14} />{lx("Xem và cài công cụ còn thiếu", "See and install missing tools")}
        </button>
      ) : (
        <p className="text-[13px] text-ink-secondary">{lx("Mở mục này trong ứng dụng Limix Bot trên máy tính.", "Open this in the Limix Bot desktop app.")}</p>
      )}
      {open && <LimixToolsDialog onClose={() => setOpen(false)} />}
    </Card>
  );
}
