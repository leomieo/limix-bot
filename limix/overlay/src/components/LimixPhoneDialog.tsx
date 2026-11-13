import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { LimixPhoneBrowser } from "./LimixPhoneBrowser";
import { lx } from "@/lib/limix-text";

/** "Kết nối điện thoại": a window in the middle of the screen (like the other dialogs), not a page buried in Settings. */
export function LimixPhoneDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="limix-phone-title"
        className="max-h-full w-full max-w-[480px] overflow-y-auto rounded-2xl border border-hairline/50 bg-panel p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="limix-phone-title" className="text-[17px] font-semibold text-ink">{lx("Kết nối điện thoại", "Connect your phone")}</h2>
          <button type="button" onClick={onClose} aria-label={lx("Đóng", "Close")} className="rounded-lg p-1.5 text-ink-secondary hover:bg-raised hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <LimixPhoneBrowser />
      </div>
    </div>
  );
  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}
