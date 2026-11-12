import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Loader2, X } from "lucide-react";

/** "Công cụ cho kỹ năng": what this computer still lacks for the default skills, the private computer and the
 * suggested MCP, with an Install button each (electron/limix-tools.mjs does the work). */

interface ToolJob { status: "working" | "error"; step?: string | null; progress?: number | null; message?: string | null }
interface ToolItem { id: string; name: string; why: string; size: string; recommended?: boolean; needs: string[]; installed: boolean; job: ToolJob | null }
interface ToolsState { supported: boolean; items: ToolItem[] }
type Bridge = { state(): Promise<ToolsState>; install(ids: string[]): Promise<ToolsState>; shouldAsk(): Promise<boolean>; markAsked(): Promise<void> };

export const limixTools = (): Bridge | undefined => (window as unknown as { ogb?: { limixTools?: Bridge } }).ogb?.limixTools;

const button = "inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50";

export function LimixToolsDialog({ onClose, asking = false }: { onClose: () => void; asking?: boolean }) {
  const [state, setState] = useState<ToolsState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await limixTools()?.state();
      if (next) setState(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (asking) void limixTools()?.markAsked().catch(() => undefined);
  }, [refresh, asking]);

  const busy = Boolean(state?.items.some((item) => item.job?.status === "working"));
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

  const body = !limixTools() ? (
    <p className="text-[13px] text-ink-secondary">Mở mục này trong ứng dụng Limix Bot trên máy tính.</p>
  ) : !state ? (
    <Loader2 size={15} className="animate-spin text-ink-secondary" />
  ) : !state.supported ? (
    <p className="text-[13px] text-ink-secondary">Tự cài công cụ hiện chỉ có trên Windows.</p>
  ) : (
    <div className="flex flex-col gap-3">
      {asking && missingRecommended.length > 0 && (
        <p className="text-[13px] leading-relaxed text-ink">
          Máy này còn thiếu {missingRecommended.length} công cụ mà các kỹ năng có sẵn của bot cần. Cài ngay?
        </p>
      )}
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
                    {job.step ?? "Đang cài"}{typeof job.progress === "number" ? ` ${Math.round(job.progress * 100)}%` : "…"}
                  </p>
                )}
                {job?.status === "error" && job.message && <p className="mt-1 text-[12px] text-danger">{job.message}</p>}
              </div>
              <div className="shrink-0 pt-0.5">
                {item.installed ? (
                  <span className="inline-flex items-center gap-1 text-[13px] text-ink-secondary"><Check size={14} />Đã có</span>
                ) : job?.status === "working" ? (
                  <Loader2 size={15} className="animate-spin text-ink-secondary" />
                ) : (
                  <button type="button" className={button} onClick={() => void install([item.id])}>
                    <Download size={14} />{job?.status === "error" ? "Thử lại" : "Cài"}
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
            <Download size={14} />Cài các công cụ cần cho kỹ năng có sẵn
          </button>
        )}
        {missing.length > 0 && (
          <button type="button" className={button} disabled={busy} onClick={() => void install(missing.map((item) => item.id))}>
            Cài tất cả
          </button>
        )}
        {asking && <button type="button" className={button} onClick={onClose}>Để sau</button>}
      </div>
      <p className="text-[12px] text-ink-tertiary">
        Công cụ được tải từ trang chính thức của từng dự án, kiểm tra mã an toàn, rồi đặt trong thư mục riêng của Limix Bot.
        Bạn có thể đóng cửa sổ này, việc cài vẫn tiếp tục.
      </p>
    </div>
  );

  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="limix-tools-title" className="max-h-full w-full max-w-[560px] overflow-y-auto rounded-2xl border border-hairline/50 bg-panel p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="limix-tools-title" className="text-[17px] font-semibold text-ink">Công cụ cho kỹ năng</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"><X size={16} /></button>
        </div>
        {body}
      </div>
    </div>
  );
  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}
