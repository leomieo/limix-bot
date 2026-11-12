// Limix Bot's own windows and messages in the main process follow the language of the app: Vietnamese when the app is
// in Vietnamese, English otherwise. main.mjs gives the source (Settings language, else the system's).
let source = () => "";
export function setLimixLanguageSource(fn) { source = typeof fn === "function" ? fn : () => ""; }
export function limixVi() { try { return /^vi/i.test(String(source() || "")); } catch { return false; } }
export const lxm = (vi, en) => (limixVi() ? vi : en);
