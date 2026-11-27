import { useEffect, useState } from "react";
import { api } from "@/state/store";
import { activeLocale } from "@/lib/i18n";
import { pluginEnabled, type PluginLibrary as Library } from "../../shared/plugin-hub";

type View = Library & { bots: { id: string; name: string; section?: string }[]; teams: string[] };
const endpoint = "/api/limix/plugins";
const button = "rounded-lg bg-control px-3 py-1.5 text-sm text-ink disabled:opacity-50 hover:bg-raised-hover";

const errorMessages: Record<string, string> = {
  "forbidden: this session lacks the admin scope": "Chỉ quản trị viên mới có thể quản lý kho plugin.",
  "Could not sync the plugin catalog": "Chưa đồng bộ được kho plugin. Hãy kiểm tra kết nối và thử lại.",
  "Plugin download or integrity check failed": "Tải gói hoặc kiểm tra tính toàn vẹn thất bại. Hãy đồng bộ kho rồi thử lại.",
  "Refresh the catalog and review this version": "Hãy đồng bộ kho và xem lại phiên bản này.",
  "Review the installed version first": "Hãy mở lại kho để xem phiên bản đã cài.",
  "The saved plugin library could not be read": "Không đọc được dữ liệu kho plugin đã lưu.",
};
export function PluginLibrary() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("");
  const lang = activeLocale().startsWith("vi") ? "vi" : "en";
  const line = (vi: string, en: string) => lang === "vi" ? vi : en;
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setBusy(true);
    setError("");
    api<View>(endpoint, { signal: abort.signal }).then(setView).catch(e => {
      if (!abort.signal.aborted) setError(e.message);
    }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [open]);
  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try { setView(await api<View>(endpoint, { method: "POST", body: JSON.stringify(payload) })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const ids = new Set([...(view?.catalog ?? []), ...(view?.installed ?? [])].map(p => p.id));
  const team = scope.startsWith("team:");
  const key = scope.slice(scope.indexOf(":") + 1);
  const bot = view?.bots.find(b => b.id === key);
  return <section className="mb-4 rounded-xl border border-line p-3">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="font-semibold text-ink">
      {open ? "▾ " : "▸ "}{line("Kho Plugin", "Plugin library")}
    </button>
    {open && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={busy} onClick={() => void act({ action: "sync" })}>{line("Đồng bộ kho", "Sync catalog")}</button>
        <a href="https://github.com/leomieo/limix-plugin-hub" target="_blank" rel="noopener noreferrer" className="text-sm underline">{line("Mở kho trên GitHub", "View catalog on GitHub")}</a>
        {view && <select className={button} aria-label={line("Phạm vi áp dụng", "Applies to")} value={scope} onChange={e => setScope(e.target.value)}>
          <option value="">{line("Chọn bot hoặc nhóm", "Choose a bot or team")}</option>
          <optgroup label={line("Nhóm bot", "Teams")}>{view.teams.map(s => <option value={"team:" + s} key={s}>{s}</option>)}</optgroup>
          <optgroup label="Bot">{view.bots.map(b => <option value={"bot:" + b.id} key={b.id}>{b.name}</option>)}</optgroup>
        </select>}
      </div>
      {error && <p role="alert" className="text-danger">{lang === "vi" ? errorMessages[error] ?? error : error}</p>}
      {busy && <p role="status">{line("Đang xử lý…", "Working…")}</p>}
      {view && !ids.size && <p>{line("Đồng bộ kho để xem các plugin có thể tải.", "Sync the catalog to see available plugins.")}</p>}
      {[...ids].map(id => {
        const found = view!.catalog.find(p => p.id === id);
        const local = view!.installed.find(p => p.id === id);
        const display = found ?? local!;
        const changed = found && local && found.sha256 !== local.sha256;
        const assignment = local && (team ? String(local.teams.includes(key)) : Object.hasOwn(local.bots, key) ? String(local.bots[key]) : "inherit");
        return <article key={id} className="space-y-2 border-t border-line pt-3">
          <h3 className="font-medium">{display.name[lang]} <small>v{display.version}</small></h3>
          <p>{display.description[lang]}</p>
          <p className="text-sm">{line("Quyền: thêm chỉ dẫn vào cuộc trò chuyện.", "Permission: add instructions to the conversation.")} {line("Kết nối MCP cần có", "Required MCP connections")} · {display.requiresMcp.join(", ") || line("Không có", "None")}</p>
          {!!display.requiresMcp.length && <p className="text-xs text-ink-secondary">{line("Plugin hoạt động khi bot đã được cấp các kết nối trên trong lượt chat.", "The workflow runs when these connections are available to the bot in this turn.")}</p>}
          {local && <details><summary>{line("Xem nội dung đã cài", "Inspect installed package")} · v{local.version}</summary>
            <p>MCP · {local.requiresMcp.join(", ") || line("Không có", "None")}</p>
            <pre className="whitespace-pre-wrap p-2">{local.instructions}</pre></details>}
          <div className="flex flex-wrap gap-2">
            {found && (!local || changed) && <button disabled={busy} className={button} onClick={() => void act({ action: "install", id, sha256: found.sha256 })}>
              {changed ? line("Cập nhật và tắt để duyệt lại", "Update and disable for review") : line("Tải về", "Download")}
            </button>}
            {local && <>
              {scope && <select aria-label={display.name[lang]} className={button} disabled={busy} value={assignment} onChange={e => void act({ action: "assign", id, sha256: local.sha256, target: team ? "team" : "bot", key, enabled: e.target.value === "inherit" ? null : e.target.value === "true" })}>
                {!team && <option value="inherit">{line("Theo nhóm", "Inherit from team")} · {bot && local.teams.includes(bot.section ?? "") ? line("Bật", "On") : line("Tắt", "Off")}</option>}
                <option value="true">{line("Bật", "On")}</option><option value="false">{line("Tắt", "Off")}</option>
              </select>}
              {scope && !team && bot && <span className="self-center text-xs">{pluginEnabled(local, bot) ? line("Đang bật", "Enabled") : line("Đang tắt", "Disabled")}</span>}
              <button className={button} disabled={busy} onClick={() => void act({ action: "remove", id })}>{line("Gỡ cài đặt", "Uninstall")}</button>
            </>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
