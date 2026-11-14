import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Loader2, ScanSearch, X } from "lucide-react";
import { lx } from "@/lib/limix-text";

/** "Công cụ cho kỹ năng": what this computer still lacks for the default skills, the private computer and the
 * suggested MCP, with an Install button each (electron/limix-tools.mjs does the work). */

interface ToolJob { status: "working" | "error" | "done"; step?: string | null; progress?: number | null; message?: string | null; project?: string }
interface ToolItem { id: string; name: string; why: string; size: string; recommended?: boolean; needs: string[]; installed: boolean; source?: "limix" | "system" | null; where?: string | null; job: ToolJob | null }
interface SkillRequirement { id?: string; installable?: boolean; packages?: string[]; job?: ToolJob | null; optional?: boolean; installScope?: "tool" | "project"; skill: string; directory: string; kind: string; name: string; required?: string; evidence: string; status: "found" | "missing" | "review"; version?: string; where?: string }
interface SkillScan { error?: string; skillCount?: number; scannedAt?: string; requirements?: SkillRequirement[]; warnings?: string[] }
interface ToolsState { supported: boolean; items: ToolItem[]; skillScan?: SkillScan | null }
type Bridge = { state(): Promise<ToolsState>; scan?(): Promise<ToolsState>; install(ids: string[]): Promise<ToolsState>; installRequirements?(ids: string[], project: string): Promise<ToolsState>; shouldAsk(): Promise<boolean>; markAsked(): Promise<void> };

export const limixTools = (): Bridge | undefined => (window as unknown as { ogb?: { limixTools?: Bridge } }).ogb?.limixTools;

const button = "inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50";

export function LimixToolsDialog({ onClose, asking = false }: { onClose: () => void; asking?: boolean }) {
  const [state, setState] = useState<ToolsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installation, setInstallation] = useState<{ rows: SkillRequirement[]; project: string; baseIds: string[] } | null>(null);
  const [frame, setFrame] = useState<CSSProperties>({ inset: 16 });
  useLayoutEffect(() => {
    const parent = document.querySelector<HTMLElement>('[data-settings-sheet] [aria-modal="true"]');
    const measure = () => {
      const rect = parent?.getBoundingClientRect();
      const gap = window.innerWidth < 640 ? 8 : 20;
      const left = Math.max(gap, (rect?.left ?? 0) + gap);
      const top = Math.max(gap, (rect?.top ?? 0) + gap);
      const right = Math.min(window.innerWidth - gap, (rect?.right ?? window.innerWidth) - gap);
      const bottom = Math.min(window.innerHeight - gap, (rect?.bottom ?? window.innerHeight) - gap);
      setFrame({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (parent) observer?.observe(parent);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await limixTools()?.state();
      if (next) setState(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const [scanning, setScanning] = useState(false);
  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const bridge = limixTools();
      const next = await (bridge?.scan ? bridge.scan() : bridge?.state());
      if (next) setState(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void scan();
    if (asking) void limixTools()?.markAsked().catch(() => undefined);
  }, [scan, asking]);

  const busy = Boolean(state?.items.some((item) => item.job?.status === "working") || state?.skillScan?.requirements?.some((item) => item.job?.status === "working"));
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void refresh(), 1000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const install = async (ids: string[]) => {
    setError(null);
    try {
      const next = await limixTools()?.install(ids);
      if (next) setState(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const missing = state?.items.filter((item) => !item.installed) ?? [];
  const missingRecommended = missing.filter((item) => item.recommended);
  const missingPackages = (state?.skillScan?.requirements ?? []).filter((row) => row.id && row.installable && row.status === "missing");
  const prepareInstall = async (rows: SkillRequirement[], baseIds: string[] = []) => {
    setError(null);
    try {
      setInstallation({ rows, project: "", baseIds });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const needsProject = installation?.rows.some(row => row.kind !== "bin" && row.installScope !== "tool") ?? false;
  const chooseProject = async () => {
    try { const project = await window.ogb?.pickFolder?.(); if (project) setInstallation(value => value ? { ...value, project } : null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const confirmInstall = async () => {
    if (!installation || (installation.rows.some(row => row.kind !== "bin" && row.installScope !== "tool") && !installation.project)) return;
    const selected = installation;
    setInstallation(null);
    setError(null);
    try {
      const bridge = limixTools();
      if (!bridge?.installRequirements) throw new Error(lx("Hãy cập nhật Limix Bot để cài gói kỹ năng.", "Update Limix Bot to install skill packages."));
      if (selected.baseIds.length) await bridge.install(selected.baseIds);
      const next = await bridge.installRequirements(selected.rows.map((row) => row.id!), selected.project);
      setState(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const body = !limixTools() ? (
    <p className="text-[13px] text-ink-secondary">{lx("Mở mục này trong ứng dụng Limix Bot trên máy tính.", "Open this in the Limix Bot desktop app.")}</p>
  ) : !state ? (
    <Loader2 size={15} className="animate-spin text-ink-secondary" />
  ) : !state.supported ? (
    <p className="text-[13px] text-ink-secondary">{lx("Tự cài công cụ hiện chỉ có trên Windows.", "Installing tools automatically is only available on Windows for now.")}</p>
  ) : (
    <div className="flex flex-col gap-3">
      {asking && missingRecommended.length > 0 && (
        <p className="text-[13px] leading-relaxed text-ink">
          {lx(`Máy này còn thiếu ${missingRecommended.length} công cụ mà các kỹ năng có sẵn của bot cần. Cài ngay?`, `This computer is missing ${missingRecommended.length} tools the bot's built-in skills need. Install them now?`)}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-ink-secondary">
          {lx("Quét công cụ cơ bản và đọc yêu cầu của các kỹ năng có sẵn hoặc đã tải về. Xem kết quả trong mục Yêu cầu của kỹ năng đã cài.", "Scan base tools and read requirements from bundled or downloaded skills. See the Installed skill requirements section for details.")}
        </p>
        <button type="button" className={`${button} shrink-0`} disabled={scanning || busy} onClick={() => void scan()}>
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}{lx("Quét máy", "Scan this computer")}
        </button>
      </div>
      <div className={state.skillScan ? "grid grid-cols-1 items-start gap-5 @[820px]/tools:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" : ""}>
      <div className="flex min-w-0 flex-col gap-3">
      <ul className="flex flex-col divide-y divide-hairline/40 rounded-xl border border-hairline/40 bg-card">
        {state.items.map((item) => {
          const job = item.job;
          return (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
                  {item.name}
                  <span className="text-[12px] font-normal text-ink-tertiary">{item.size}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{item.why}</p>
                {job?.status === "working" && (
                  <p className="mt-1 text-[12px] text-ink-secondary">
                    {job.step ?? lx("Đang cài", "Installing")}{typeof job.progress === "number" ? ` ${Math.round(job.progress * 100)}%` : "…"}
                  </p>
                )}
                {job?.status === "error" && job.message && <p className="mt-1 text-[12px] text-danger">{job.message}</p>}
              </div>
              <div className="shrink-0 pt-0.5">
                {item.installed ? (
                  <span className="inline-flex flex-col items-end text-[13px] text-ink-secondary" title={item.where ?? undefined}>
                    <span className="inline-flex items-center gap-1"><Check size={14} />{lx("Đã có", "Installed")}</span>
                    <span className="text-[11px] text-ink-tertiary">{item.source === "system" ? lx("dùng bản trên máy", "using the copy on this computer") : lx("do Limix Bot cài", "installed by Limix Bot")}</span>
                  </span>
                ) : job?.status === "working" ? (
                  <Loader2 size={15} className="animate-spin text-ink-secondary" />
                ) : (
                  <button type="button" className={button} onClick={() => void install([item.id])}>
                    <Download size={14} />{job?.status === "error" ? lx("Thử lại", "Retry") : lx("Cài", "Install")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {missingRecommended.length > 0 && (
          <button type="button" className={button} disabled={busy} onClick={() => void install(missingRecommended.map((item) => item.id))}>
            <Download size={14} />{lx("Cài các công cụ cần cho kỹ năng có sẵn", "Install the tools the built-in skills need")}
          </button>
        )}
        {missing.length > 0 && (
          <button type="button" className={button} disabled={busy} onClick={() => void install(missing.map((item) => item.id))}>
            {lx("Cài công cụ cơ bản còn thiếu", "Install missing base tools")}
          </button>
        )}
        {asking && <button type="button" className={button} onClick={onClose}>{lx("Để sau", "Later")}</button>}
      </div>
      </div>
      {state.skillScan && <section className="min-w-0" aria-label={lx("Yêu cầu của kỹ năng đã cài", "Installed skill requirements")}>
        <h3 className="text-[14px] font-medium text-ink">{lx("Yêu cầu của kỹ năng đã cài", "Installed skill requirements")}</h3>
        {missingPackages.length > 0 && limixTools()?.installRequirements && <button type="button" className={`${button} mt-3`} disabled={busy || scanning} onClick={() => void prepareInstall(missingPackages, missing.map((item) => item.id))}><Download size={14} />{lx("Cài tất cả còn thiếu", "Install all missing requirements")}</button>}
        {installation && <div className="my-3 rounded-xl border border-hairline/40 bg-raised p-3 text-[12px]">
          <p className="font-medium text-ink">{needsProject ? lx("Chọn dự án cần các thư viện này", "Choose the project that needs these libraries") : lx("Cài vào thư mục công cụ của Limix Bot", "Install into Limix Bot’s tools folder")}</p>
          {needsProject && <><p className="mt-1 text-ink-secondary">{lx("Thư viện như Remotion cần nằm trong dự án đang làm. Bấm nút dưới để chọn thư mục; công cụ dùng chung sẽ được cài riêng trong Limix Bot.", "Libraries such as Remotion belong in the project you are working on. Choose its folder below; shared tools are installed separately in Limix Bot.")}</p><button type="button" className={`${button} mt-2`} onClick={() => void chooseProject()}>{lx("Chọn thư mục dự án…", "Choose project folder…")}</button><p className="mt-1 break-all text-ink-secondary">{installation.project || lx("Chưa chọn thư mục", "No folder selected")}</p></>}
          <p className="mt-1 break-words text-ink-secondary">{[...new Set(installation.rows.flatMap((row) => row.packages ?? [row.name]))].join(", ")}{installation.baseIds.length > 0 && ` · ${installation.baseIds.join(", ")}`}</p>
          <p className="mt-2 text-ink-tertiary">{lx("Công cụ dòng lệnh dùng thư mục công cụ riêng của Limix Bot. Thư viện npm lưu trong dự án; Python dùng .venv. Các gói đánh dấu Tùy chọn chỉ cần cho chức năng tương ứng.", "Command-line tools use Limix Bot’s private tools folder. Project npm libraries stay in the project; Python uses .venv. Optional packages are needed only for the corresponding workflow.")}</p>
          <div className="mt-3 flex gap-2"><button type="button" className={button} disabled={busy || (needsProject && !installation.project)} onClick={() => void confirmInstall()}>{lx("Cài đặt", "Install packages")}</button><button type="button" className={button} onClick={() => setInstallation(null)}>{lx("Hủy", "Cancel")}</button></div>
        </div>}
        {state.skillScan.error ? <p role="alert" className="mt-2 text-[12px] text-danger">{lx("Chưa đọc được yêu cầu kỹ năng: ", "Could not read skill requirements: ")}{state.skillScan.error}</p> : <>
          <p className="mt-1 text-[12px] text-ink-secondary">{lx(`Đã đọc ${state.skillScan.skillCount ?? 0} kỹ năng. Kết quả kiểm tra trên máy chạy Limix Bot; môi trường Docker và cloud cần kiểm tra riêng.`, `Read ${state.skillScan.skillCount ?? 0} skills. Checks apply to the computer running Limix Bot; Docker and cloud environments need separate checks.`)}</p>
          <p className="mt-1 text-[12px] text-ink-tertiary">{lx("Gồm yêu cầu khai báo và công cụ được nhắc trong hướng dẫn. Xem nguồn để phân biệt yêu cầu bắt buộc và ví dụ; ràng buộc phiên bản chưa xác minh sẽ hiện Cần kiểm tra.", "Includes declared requirements and tools mentioned in instructions. Inspect the source to distinguish prerequisites from examples; unverified version constraints are marked Needs review.")}</p>
          <ul className="mt-3 flex flex-col divide-y divide-hairline/40 rounded-xl border border-hairline/40">
            {(state.skillScan.requirements ?? []).map((req, index) => <li key={`${req.directory}:${index}`} className="px-3 py-2 text-[12px]">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-medium text-ink">{req.name}{req.required && ` ${req.required}`}{req.optional && <span className="ms-1 font-normal text-ink-tertiary">· {lx("Tùy chọn", "Optional")}</span>}</span>
                <span className={req.status === "missing" ? "shrink-0 text-danger" : "shrink-0 text-ink-secondary"}>{req.status === "found" ? lx("Đã tìm thấy", "Found") : req.status === "missing" ? lx("Chưa tìm thấy", "Not found") : lx("Cần kiểm tra", "Needs review")}</span>
              </div>
              <p className="mt-1 break-words text-ink-secondary" title={req.directory}>{req.skill} · {req.kind}{req.version && ` · ${req.version}`}</p>
              {req.status === "review" && <p className="mt-1 text-ink-tertiary">{lx("Chưa xác minh tự động: có thể là hướng dẫn, yêu cầu cấu hình hoặc giới hạn phiên bản. Xem nguồn bên dưới.", "Not automatically verified: this may be setup guidance, configuration or a version constraint. See the source below.")}</p>}
              {req.job?.status === "working" ? <p className="mt-1 flex items-center gap-1 text-ink-secondary"><Loader2 size={12} className="animate-spin" />{req.job.step ?? lx("Đang cài", "Installing")}</p> : req.installable && req.id && req.status === "missing" && limixTools()?.installRequirements ? <button type="button" className={`${button} mt-2`} disabled={busy || scanning} onClick={() => void prepareInstall([req])}><Download size={12} />{req.job?.status === "error" ? lx("Thử lại", "Retry") : lx("Cài", "Install")}</button> : null}
              {req.job?.status === "error" && <p role="alert" className="mt-1 text-danger">{req.job.message}</p>}
              {req.job?.status === "done" && <p className="mt-1 break-all text-ink-secondary">{lx("Đã chạy cài đặt tại ", "Installation completed in ")}{req.job.project}</p>}
              <details className="mt-1 text-ink-tertiary"><summary className="cursor-pointer">{lx("Xem nguồn yêu cầu", "Requirement source")}</summary><pre className="mt-1 whitespace-pre-wrap break-words font-sans">{req.evidence}{req.where && `\n${req.where}`}</pre></details>
            </li>)}
          </ul>
          {!!state.skillScan.warnings?.length && <details className="mt-2 text-[12px] text-ink-secondary"><summary className="cursor-pointer">{lx(`Có ${state.skillScan.warnings.length} mục chưa đọc đủ`, `${state.skillScan.warnings.length} items could not be fully read`)}</summary><ul>{state.skillScan.warnings.map((warning, index) => <li key={index} className="break-words">{warning}</li>)}</ul></details>}
        </>}
      </section>}
      </div>
      <p className="text-[12px] text-ink-tertiary">
        {lx("Công cụ được tải từ trang chính thức của từng dự án, kiểm tra mã an toàn, rồi đặt trong thư mục riêng của Limix Bot. Bạn có thể đóng cửa sổ này, việc cài vẫn tiếp tục.", "Tools are downloaded from each project's official site, checked with a hash, and kept in Limix Bot's own folder. You can close this window; installing carries on.")}
      </p>
    </div>
  );

  const overlay = (
    <div className="fixed inset-0 z-[70] bg-black/50" onMouseDown={(event) => event.stopPropagation()}>
      <div style={frame} className="absolute flex items-center justify-center">
      <div role="dialog" aria-modal="true" aria-labelledby="limix-tools-title" className="@container/tools flex max-h-full w-full max-w-[1080px] min-w-0 flex-col overflow-hidden rounded-2xl border border-hairline/50 bg-panel shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline/40 px-5 py-4">
          <h2 id="limix-tools-title" className="text-[17px] font-semibold text-ink">{lx("Công cụ cho kỹ năng", "Tools for skills")}</h2>
          <button type="button" onClick={onClose} aria-label={lx("Đóng", "Close")} className="rounded-lg p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"><X size={16} /></button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">{body}</div>
      </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}
