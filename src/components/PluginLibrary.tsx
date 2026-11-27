import { Blocks, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, useStore } from "@/state/store";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { cn } from "@/lib/cn";
import { glassPopupFrameStyle } from "@/lib/glass-popup";
import { activeLocale, t } from "@/lib/i18n";
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
export const pluginLabel = () => activeLocale().startsWith("vi") ? "Kho Plugin" : "Plugin library";

export function SidebarPluginButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const { state, dispatch } = useStore();
  const label = pluginLabel();
  const active = state.pluginsOpen && state.pluginsSurface === "library";
  return (
    <button type="button" data-sidebar-nav="plugins" aria-pressed={active} aria-label={label} title={label}
      className={cn("flex min-h-9 items-center gap-2 rounded-xl text-sm font-medium hover:bg-raised/50",
        iconOnly ? "size-9 shrink-0 justify-center" : "w-full px-3 py-1.5 text-left",
        active ? "bg-raised text-accent" : "text-ink")}
      onClick={() => dispatch({ type: "togglePlugins", open: true, surface: "library" })}>
      <Blocks size={18} aria-hidden="true" className="shrink-0" />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

export function PluginLibraryDialog() {
  const { dispatch } = useStore();
  const dialog = useRef<HTMLDivElement>(null);
  const close = () => dispatch({ type: "togglePlugins", open: false });
  useModalDialog(dialog, close);
  return (
    <div className="glass-popup-frame" style={glassPopupFrameStyle()} onMouseDown={event => event.stopPropagation()}>
      <div aria-hidden="true" className="glass-scrim pointer-events-none absolute inset-0" />
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="plugin-library-title" tabIndex={-1}
        className="glass-surface glass-popup animate-pop-in relative flex max-w-[780px] flex-col overflow-hidden rounded-2xl text-ink">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline/50 px-5 py-4">
          <h2 id="plugin-library-title" className="text-[20px] font-semibold">{pluginLabel()}</h2>
          <button type="button" aria-label={t("common.close")} onClick={close} className="rounded-lg p-2 text-ink-secondary hover:bg-raised">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"><PluginLibrary /></div>
      </div>
    </div>
  );
}

export function PluginLibrary() {
  const [view, setView] = useState<View>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("");
  const lang = activeLocale().startsWith("vi") ? "vi" : "en";
  const line = (vi: string, en: string) => lang === "vi" ? vi : en;
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError("");
    api<View>(endpoint, { signal: abort.signal }).then(setView).catch(e => {
      if (!abort.signal.aborted) setError(e.message);
    }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, []);
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
  return <section className="space-y-3">
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
          <pre className="whitespace-pre-wrap break-words p-2">{local.instructions}</pre></details>}
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
  </section>;
}
