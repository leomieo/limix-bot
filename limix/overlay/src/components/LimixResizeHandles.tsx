import { useEffect, useRef } from "react";
import { lx } from "@/lib/limix-text";

const KEY = "limix.settings.size";
const MIN_W = 640;
const MIN_H = 460;
const wide = (): boolean => typeof window !== "undefined" && window.innerWidth >= 768;

function apply(el: HTMLElement, width: number, height: number, widthInset: number, heightInset: number): void {
  const maxW = Math.max(1, window.innerWidth - widthInset);
  const maxH = Math.max(1, window.innerHeight - heightInset);
  el.style.width = `${Math.round(Math.min(Math.max(width, MIN_W), maxW))}px`;
  el.style.height = `${Math.round(Math.min(Math.max(height, MIN_H), maxH))}px`;
}

function reset(el: HTMLElement, storageKey: string): void {
  el.style.width = "";
  el.style.height = "";
  try { window.localStorage.removeItem(storageKey); } catch { /* storage can be blocked */ }
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

export function LimixResizeHandles({ storageKey = KEY, widthInset = 32, heightInset = 96, showGrip = false }: {
  storageKey?: string;
  widthInset?: number;
  heightInset?: number;
  showGrip?: boolean;
} = {}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const drag = useRef<AbortController | null>(null);
  const size = useRef<{ w: number; h: number } | null>(null);
  const title = lx("Kéo để đổi kích thước (bấm đúp để đặt lại)", "Drag to resize (double-click to reset)");
  const remember = (el: HTMLElement) => {
    size.current = { w: el.offsetWidth, h: el.offsetHeight };
    try { window.localStorage.setItem(storageKey, JSON.stringify(size.current)); } catch { /* storage can be blocked */ }
  };

  useEffect(() => {
    const el = anchor.current?.parentElement;
    if (!el) return;
    el.style.maxWidth = "100%";
    el.style.maxHeight = "100%";
    size.current = null;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as { w?: number; h?: number } | null;
      if (saved && typeof saved.w === "number" && Number.isFinite(saved.w) && typeof saved.h === "number" && Number.isFinite(saved.h)) {
        size.current = { w: saved.w, h: saved.h };
      }
    } catch { /* no saved size */ }
    const onResize = () => {
      const preferred = size.current;
      if (wide() && preferred) apply(el, preferred.w, preferred.h, widthInset, heightInset);
      else { el.style.width = ""; el.style.height = ""; }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      drag.current?.abort();
      window.removeEventListener("resize", onResize);
    };
  }, [storageKey, widthInset, heightInset]);

  const start = (edge: Edge) => (event: React.PointerEvent) => {
    const el = anchor.current?.parentElement;
    if (!el || !wide() || event.button !== 0) return;
    event.preventDefault();
    drag.current?.abort();
    const controller = new AbortController();
    drag.current = controller;
    const x0 = event.clientX, y0 = event.clientY, w0 = el.offsetWidth, h0 = el.offsetHeight;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      apply(el, w0 + edge.sx * (e.clientX - x0) * 2, h0 + edge.sy * (e.clientY - y0) * 2, widthInset, heightInset);
    };
    const finish = () => {
      controller.abort();
      drag.current = null;
      if (wide()) remember(el);
    };
    const finishPointer = (e: PointerEvent) => { if (e.pointerId === event.pointerId) finish(); };
    const options = { signal: controller.signal };
    window.addEventListener("pointermove", move, options);
    window.addEventListener("pointerup", finishPointer, options);
    window.addEventListener("pointercancel", finishPointer, options);
    window.addEventListener("blur", finish, options);
  };

  const resetSize = () => {
    const el = anchor.current?.parentElement;
    size.current = null;
    if (el) reset(el, storageKey);
  };
  return (
    <span ref={anchor} className="contents">
      {EDGES.map((edge) => showGrip && edge.sx === 1 && edge.sy === 1 ? (
        <button type="button" key="grip" title={title}
          aria-label={lx("Đổi kích thước cửa sổ bằng phím mũi tên. Enter để đặt lại.", "Resize with arrow keys. Press Enter to reset.")}
          className="absolute bottom-1 right-1 z-20 hidden size-5 cursor-nwse-resize touch-none items-center justify-center rounded text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:flex"
          onPointerDown={start(edge)} onDoubleClick={resetSize}
          onKeyDown={(event) => {
            const el = anchor.current?.parentElement;
            if (!el) return;
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); resetSize(); return; }
            const step = 32;
            const x = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
            const y = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
            if (!x && !y) return;
            event.preventDefault();
            apply(el, el.offsetWidth + x, el.offsetHeight + y, widthInset, heightInset);
            remember(el);
          }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 10 10 3m-3 7 3-3" stroke="currentColor" strokeLinecap="round" /></svg>
        </button>
      ) : (
        <span
          key={`${edge.sx}${edge.sy}`}
          aria-hidden="true"
          title={title}
          className={`absolute z-20 hidden touch-none md:block ${edge.cls} ${edge.cursor}`}
          onPointerDown={start(edge)}
          onDoubleClick={resetSize}
        />
      ))}
    </span>
  );
}
