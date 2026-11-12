import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";

import { Card, Switch } from "./SettingsPrimitives";
import { LimixToolsDialog, limixTools } from "./LimixToolsDialog";

/** Settings > Kỹ năng > "Thư viện kỹ năng Limix": the Limix Skill Hub catalog (leomieo/limix-skill-hub). Skills are
 * installed disabled and verified by SHA-256; skills that bring scripts or MCP never get those parts without a click. */

interface HubSkill {
  id: string; name: string; description: string; description_vi?: string | null; version: string;
  source: { repository: string | null; commit: string | null; path: string | null };
  license: string | null; language: string; category: string; tags: string[];
  quality_score: number; grade: string; security_status: string; approval_status: string; kind: string;
  compatibility: { text: string | null; runtimes: Array<{ name: string; installerId: string | null }> };
  dependencies: string[]; permissions: { runs_code: boolean; mcp: boolean; files: string[] };
  security_findings?: Array<{ rule: string; severity: string; file: string; line?: number }>;
  notes: string[]; last_checked: string | null;
  installed: boolean; enabled: boolean; updateAvailable: boolean; blocked: string | null;
}
interface HubState { repo: string; settings: { autoSync: boolean; autoInstall: boolean; lastSync: string | null; lastError: string | null }; skills: HubSkill[] }

const TABS = [
  ["discover", "Khám phá"], ["recommended", "Khuyên dùng"], ["installed", "Đã cài"], ["updates", "Cập nhật"],
  ["localization", "Việt hóa"], ["security", "Bảo mật"], ["sources", "Nguồn"], ["settings", "Cài đặt"],
] as const;
type Tab = (typeof TABS)[number][0];

const GRADE: Record<string, string> = { excellent: "Xuất sắc", recommended: "Khuyên dùng", review: "Cần xem xét", rejected: "Từ chối" };
const KIND: Record<string, string> = { "instructions-only": "Chỉ hướng dẫn", "skill-with-tools": "Kèm tool/script", "mcp-bundle": "Kèm MCP" };
const SECURITY: Record<string, string> = { clean: "Sạch", warning: "Có cảnh báo", quarantined: "Cách ly" };
const button = "inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Lỗi ${response.status}`);
  return data;
}

export function LimixSkillHub() {
  const [state, setState] = useState<HubState | null>(null);
  const [tab, setTab] = useState<Tab>("recommended");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setState(await call<HubState>("/api/limix/hub")); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await action(); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(null); }
  };

  const skills = state?.skills ?? [];
  const categories = useMemo(() => [...new Set(skills.map((s) => s.category))].sort(), [skills]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (category && s.category !== category) return false;
      if (q && !`${s.name} ${s.description} ${s.description_vi ?? ""} ${s.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      switch (tab) {
        case "discover": return true;
        case "recommended": return !s.blocked && (s.grade === "excellent" || s.grade === "recommended");
        case "installed": return s.installed;
        case "updates": return s.updateAvailable;
        case "localization": return !s.description_vi;
        case "security": return s.security_status !== "clean";
        default: return false;
      }
    });
  }, [skills, tab, query, category]);

  const syncNow = () => run("sync", () => call("/api/limix/hub/sync", {}));

  const card = (s: HubSkill) => (
    <li key={s.id} className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-[13px] font-medium text-ink">{s.name}</span>
            <span className="text-[12px] text-ink-secondary">{s.quality_score}/100 · {GRADE[s.grade] ?? s.grade}</span>
            <span className="text-[12px] text-ink-tertiary">v{s.version}</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{s.description_vi || s.description}</p>
          {!s.description_vi && <p className="text-[11px] text-ink-tertiary">Chưa có bản dịch tiếng Việt</p>}
          <p className="mt-1 text-[12px] text-ink-tertiary">
            {KIND[s.kind] ?? s.kind} · Bảo mật: {SECURITY[s.security_status] ?? s.security_status} · {s.license ?? "Chưa có giấy phép"} · {s.source.repository ?? "nguồn ?"}
            {s.dependencies.length > 0 && ` · Cần: ${s.dependencies.join(", ")}`}
          </p>
          {s.blocked && <p className="mt-1 flex items-center gap-1 text-[12px] text-danger"><ShieldAlert size={13} />{s.blocked}</p>}
          {(s.permissions.runs_code || s.permissions.mcp) && !s.blocked && (
            <div className="mt-1.5 rounded-lg border border-hairline/40 bg-raised/50 p-2.5 text-[12px] leading-relaxed text-ink-secondary">
              <button type="button" className="text-ink underline-offset-2 hover:underline" onClick={() => setGuide(guide === s.id ? null : s.id)}>
                {guide === s.id ? "Ẩn hướng dẫn cài đặt" : "Kỹ năng này có tool: xem hướng dẫn cài đặt"}
              </button>
              {guide === s.id && (
                <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                  <li>
                    <b className="text-ink">Cài kỹ năng:</b> bấm "Cài". Mặc định chỉ lấy phần hướng dẫn (SKILL.md). Kỹ năng được tải từ GitHub và kiểm tra SHA-256 từng file.
                  </li>
                  {s.compatibility.runtimes.length > 0 && (
                    <li>
                      <b className="text-ink">Chuẩn bị máy:</b> kỹ năng cần {s.compatibility.runtimes.map((r) => r.name).join(", ")}.
                      {s.compatibility.runtimes.filter((r) => r.installerId).length > 0 && (<> Limix Bot cài được: {s.compatibility.runtimes.filter((r) => r.installerId).map((r) => r.name).join(", ")}. </>)}
                      {s.compatibility.runtimes.some((r) => !r.installerId) && (<> Phải cài tay: {s.compatibility.runtimes.filter((r) => !r.installerId).map((r) => r.name).join(", ")} (Python: tải từ python.org, tick "Add python.exe to PATH"). </>)}
                      {limixTools() && <button type="button" className="ml-1 text-ink underline" onClick={() => setToolsOpen(true)}>Mở "Công cụ cho kỹ năng"</button>}
                    </li>
                  )}
                  {s.permissions.runs_code && (
                    <li><b className="text-ink">Cài phần script:</b> bấm "Cài kèm tool". Các file script sẽ nằm trong thư mục kỹ năng và bot có thể chạy chúng. Chỉ làm khi bạn tin nguồn {s.source.repository ?? "này"} (đã quét: {SECURITY[s.security_status] ?? s.security_status}).</li>
                  )}
                  {s.permissions.mcp && (
                    <li><b className="text-ink">MCP:</b> file cấu hình MCP chỉ được chép vào thư mục kỹ năng, không tự bật. Muốn dùng, thêm máy chủ MCP ở Cài đặt rồi bật.</li>
                  )}
                  <li><b className="text-ink">Bật:</b> sau khi cài, gạt công tắc "Đang tắt" sang bật, rồi gán cho bot ở thư viện bên dưới.</li>
                </ol>
              )}
            </div>
          )}
          {tab === "security" && s.security_findings?.slice(0, 5).map((f, i) => (
            <p key={i} className="text-[11px] text-ink-tertiary">{f.severity} · {f.rule} · {f.file}{f.line ? `:${f.line}` : ""}</p>
          ))}
          {s.notes.map((n) => <p key={n} className="text-[11px] text-ink-tertiary">{n}</p>)}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {busy === s.id ? <Loader2 size={15} className="animate-spin text-ink-secondary" /> : !s.installed ? (
            <>
              <button type="button" className={button} disabled={Boolean(s.blocked) || busy !== null} onClick={() => void run(s.id, () => call("/api/limix/hub/install", { id: s.id }))}>
                <Download size={14} />Cài (tắt sẵn)
              </button>
              {s.permissions.runs_code && !s.blocked && (
                <button type="button" className={button} disabled={busy !== null} onClick={() => { if (window.confirm(`Cài cả script của "${s.name}"? Bot có thể chạy các script này. Chỉ làm khi bạn tin nguồn.`)) void run(s.id, () => call("/api/limix/hub/install", { id: s.id, allowTools: true })); }}>
                  <Download size={14} />Cài kèm tool
                </button>
              )}
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
                {s.enabled ? "Đang bật" : "Đang tắt"}
                <Switch checked={s.enabled} disabled={busy !== null} onClick={() => void run(s.id, () => call("/api/limix/hub/enable", { id: s.id, enabled: !s.enabled }))} />
              </label>
              {s.updateAvailable && <button type="button" className={button} disabled={busy !== null} onClick={() => void run(s.id, () => call("/api/limix/hub/update", { id: s.id }))}><RefreshCw size={14} />Cập nhật</button>}
              <button type="button" className={button} disabled={busy !== null} onClick={() => void run(s.id, () => call("/api/limix/hub/remove", { id: s.id }))}><Trash2 size={14} />Gỡ</button>
            </>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <Card title="Thư viện kỹ năng Limix" subtitle="Kho kỹ năng đã quét bảo mật và chấm điểm. Cài xong kỹ năng vẫn tắt; bạn bật rồi gán cho bot ở thư viện bên dưới.">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-2.5 py-1 text-[13px] ${tab === id ? "bg-raised text-ink" : "text-ink-secondary hover:bg-raised-hover"}`}>{label}</button>
          ))}
        </div>
        {error && <p className="text-[12px] text-danger">{error}</p>}
        {!state ? <Loader2 size={15} className="animate-spin text-ink-secondary" /> : tab === "sources" ? (
          <div className="flex flex-col gap-1 text-[13px] text-ink-secondary">
            <p>Kho: <span className="font-mono text-ink">{state.repo}</span> ({skills.length} kỹ năng trong danh mục)</p>
            <p>Hub tự tìm kỹ năng mỗi ngày lúc 03:00 giờ Việt Nam, quét an toàn và chấm điểm trước khi đưa vào danh mục.</p>
            <p>Đồng bộ gần nhất: {state.settings.lastSync ? new Date(state.settings.lastSync).toLocaleString("vi-VN") : "chưa lần nào"}</p>
            {state.settings.lastError && <p className="text-danger">Lỗi gần nhất: {state.settings.lastError}</p>}
            <button type="button" className={`${button} w-fit`} disabled={busy !== null} onClick={() => void syncNow()}>
              {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Đồng bộ ngay
            </button>
          </div>
        ) : tab === "settings" ? (
          <div className="flex flex-col gap-3 text-[13px] text-ink">
            <label className="flex items-center justify-between gap-3">
              <span>Tự đồng bộ danh mục<span className="block text-[12px] text-ink-secondary">Chỉ cập nhật danh sách, không cài gì.</span></span>
              <Switch checked={state.settings.autoSync} onClick={() => void run("settings", () => call("/api/limix/hub/settings", { autoSync: !state.settings.autoSync }))} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Tự cài kỹ năng mới<span className="block text-[12px] text-ink-secondary">Mặc định tắt. Nếu bật: chỉ cài loại chỉ có hướng dẫn, đã duyệt, điểm từ 80; vẫn ở trạng thái tắt.</span></span>
              <Switch checked={state.settings.autoInstall} onClick={() => void run("settings", () => call("/api/limix/hub/settings", { autoInstall: !state.settings.autoInstall }))} />
            </label>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kỹ năng…" className="min-w-[160px] flex-1 rounded-lg border border-hairline/60 bg-card px-3 py-1.5 text-[13px] text-ink" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-hairline/60 bg-card px-2 py-1.5 text-[13px] text-ink">
                <option value="">Mọi nhóm</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {visible.length === 0 ? (
              <p className="text-[13px] text-ink-secondary">
                {skills.length === 0 ? "Chưa có danh mục. Bấm Đồng bộ ở mục Nguồn." : "Không có kỹ năng nào ở mục này."}
              </p>
            ) : (
              <ul className="flex max-h-[520px] flex-col divide-y divide-hairline/40 overflow-y-auto rounded-xl border border-hairline/40 bg-card">{visible.map(card)}</ul>
            )}
            {tab === "installed" && visible.length > 0 && <p className="flex items-center gap-1 text-[12px] text-ink-tertiary"><Check size={13} />Kỹ năng đã bật nằm trong thư viện kỹ năng bên dưới, nơi bạn gán cho từng bot hoặc mọi bot.</p>}
          </>
        )}
      </div>
      {toolsOpen && <LimixToolsDialog onClose={() => setToolsOpen(false)} />}
    </Card>
  );
}
