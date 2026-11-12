import { useEffect, useRef } from "react";
import { lx } from "@/lib/limix-text";

/** Settings window: drag an edge or corner to resize it (it stays centred, so each edge moves twice as far as the
 * pointer). Never smaller than 640 x 460 and never larger than the app window; double-click an edge to reset. The size is
 * remembered on this computer. Only on wide windows: on a phone Settings is a full-screen sheet. */

const KEY = "limix.settings.size";
const MIN_W = 640;
const MIN_H = 460;
const wide = (): boolean => typeof window !== "undefined" && window.innerWidth >= 768;

function apply(el: HTMLElement, width: number, height: number): void {
  const maxW = Math.max(320, window.innerWidth - 32);
  const maxH = Math.max(320, window.innerHeight - 96);
  el.style.width = `${Math.round(Math.min(Math.max(width, Math.min(MIN_W, maxW)), maxW))}px`;
  el.style.height = `${Math.round(Math.min(Math.max(height, Math.min(MIN_H, maxH)), maxH))}px`;
}

function reset(el: HTMLElement): void {
  el.style.width = "";
  el.style.height = "";
  try { window.localStorage.removeItem(KEY); } catch { /* storage can be blocked */ }
}

type Edge = { sx: -1 | 0 | 1; sy: -1 | 0 | 1; cls: string; cursor: string };
const EDGES: Edge[] = [
  { sx: 1, sy: 0, cls: "right-0 top-4 bottom-4 w-1.5", cursor: "cursor-ew-resize" },
  { sx: -1, sy: 0, cls: "left-0 top-4 bottom-4 w-1.5", cursor: "cursor-ew-resize" },
  { sx: 0, sy: 1, cls: "bottom-0 left-4 right-4 h-1.5", cursor: "cursor-ns-resize" },
  { sx: 0, sy: -1, cls: "top-0 left-4 right-4 h-1.5", cursor: "cursor-ns-resize" },
  { sx: 1, sy: 1, cls: "bottom-0 right-0 h-4 w-4", cursor: "cursor-nwse-resize" },
  { sx: -1, sy: 1, cls: "bottom-0 left-0 h-4 w-4", cursor: "cursor-nesw-resize" },
];

export function LimixResizeHandles() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = anchor.current?.parentElement;
    if (!el) return;
    el.style.maxWidth = "100%";
    el.style.maxHeight = "100%";
    if (wide()) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as { w?: number; h?: number } | null;
        if (saved && typeof saved.w === "number" && typeof saved.h === "number") apply(el, saved.w, saved.h);
      } catch { /* no saved size */ }
    }
    const onResize = () => {
      if (!el.style.width) return;
      if (wide()) apply(el, el.offsetWidth, el.offsetHeight); else { el.style.width = ""; el.style.height = ""; }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const start = (edge: Edge) => (event: React.PointerEvent) => {
    const el = anchor.current?.parentElement;
    if (!el || !wide()) return;
    event.preventDefault();
    const x0 = event.clientX, y0 = event.clientY, w0 = el.offsetWidth, h0 = el.offsetHeight;
    const move = (e: PointerEvent) => apply(el, w0 + edge.sx * (e.clientX - x0) * 2, h0 + edge.sy * (e.clientY - y0) * 2);
    const up = () => {
      window.removeEventListener("pointermove", move);
      try { window.localStorage.setItem(KEY, JSON.stringify({ w: el.offsetWidth, h: el.offsetHeight })); } catch { /* storage can be blocked */ }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  return (
    <span ref={anchor} className="contents">
      {EDGES.map((edge) => (
        <span
          key={`${edge.sx}${edge.sy}`}
          aria-hidden="true"
          title={lx("Kéo để đổi kích thước (bấm đúp để đặt lại)", "Drag to resize (double-click to reset)")}
          className={`absolute z-20 hidden touch-none md:block ${edge.cls} ${edge.cursor}`}
          onPointerDown={start(edge)}
          onDoubleClick={() => { const el = anchor.current?.parentElement; if (el) reset(el); }}
        />
      ))}
    </span>
  );
}
