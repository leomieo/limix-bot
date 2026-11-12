import { useEffect, useState } from "react";

import { loadSidebarWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_WIDTH_KEY, SIMPLE_SIDEBAR_WIDTH_KEY } from "./sidebar-preferences";

/** Limix: whether the full sidebar (at the width the person gave it) still leaves the chat room to read. Measured in
 * CSS pixels, which already include the screen's scaling (125 %, 150 %…) and the app's zoom (Ctrl +/-), so it holds for
 * every resolution and zoom: re-checked on every resize and zoom change. When it does not fit the sidebar shows its
 * column of avatars instead of cutting its names and menus. */
const CHAT_ROOM = 560;
const fallback = (simple: boolean): number => (simple ? 280 : 320); // sidebarDefaultWidth

function fits(simple: boolean): boolean {
  if (typeof window === "undefined") return true;
  const saved = loadSidebarWidth(undefined, simple ? SIMPLE_SIDEBAR_WIDTH_KEY : SIDEBAR_WIDTH_KEY);
  const sidebar = Math.max(SIDEBAR_MIN_WIDTH, saved ?? fallback(simple));
  return window.innerWidth >= sidebar + CHAT_ROOM;
}

export function useLimixSidebarFits(simple: boolean): boolean {
  const [ok, setOk] = useState(() => fits(simple));
  useEffect(() => {
    const check = () => setOk(fits(simple));
    check();
    window.addEventListener("resize", check);
    window.addEventListener("storage", check);
    // A zoom change that keeps the window size still changes devicePixelRatio.
    let media: MediaQueryList | null = null;
    const watchZoom = () => {
      media?.removeEventListener("change", onZoom);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener("change", onZoom);
    };
    const onZoom = () => { check(); watchZoom(); };
    watchZoom();
    // The person dragging the sidebar wider changes the saved width.
    const timer = setInterval(check, 2000);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("storage", check);
      media?.removeEventListener("change", onZoom);
      clearInterval(timer);
    };
  }, [simple]);
  return ok;
}
