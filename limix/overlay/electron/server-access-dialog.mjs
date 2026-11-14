import { randomUUID } from "node:crypto";
import nativeText from "./native-text.cjs";

const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function serverAccessHtml(env, nonce, dark, t = nativeText.englishText.t) {
  const action = choice => `https://limix-confirm.invalid/${nonce}/${choice}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action https://limix-confirm.invalid; base-uri 'none'"><style>
  :root{color-scheme:${dark ? "dark" : "light"};--bg:${dark ? "#141414" : "#fafafa"};--card:${dark ? "#202020" : "#f0f0f0"};--ink:${dark ? "#f4f4f4" : "#191919"};--muted:${dark ? "#aaa" : "#626262"};--border:${dark ? "#343434" : "#d8d8d8"}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif;padding:26px}header{display:flex;align-items:center;justify-content:space-between;-webkit-app-region:drag}header form{-webkit-app-region:no-drag}.brand{font-size:14px;font-weight:600;color:var(--muted)}button{font:inherit;cursor:pointer;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);padding:9px 16px}button:focus-visible{outline:2px solid var(--ink);outline-offset:3px}.close{border:0;background:transparent;padding:0 6px;font-size:24px}h1{font-size:22px;line-height:1.3;font-weight:600;margin:20px 0 12px;overflow-wrap:anywhere}.server{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;overflow-wrap:anywhere}.server strong{display:block}.server span{color:var(--muted);font-size:14px}p{font-size:16px;color:var(--muted);margin:16px 0}footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.allow{background:var(--ink);color:var(--bg);font-weight:600}form{margin:0}
  </style></head><body><header><span class="brand">Limix Bot</span><form action="${action("cancel")}"><button class="close" aria-label="${escape(t("native.common.cancel"))}">×</button></form></header>
  <h1>${escape(t("native.lend.own.title", { name: env.name }))}</h1>
  <div class="server"><strong>${escape(env.name)}</strong><span>${escape(env.origin)}</span></div>
  <p>${escape(t("native.lend.own.detail"))}</p>
  <footer><form action="${action("cancel")}"><button autofocus>${escape(t("native.dialog.share.notNow"))}</button></form><form action="${action("allow")}"><button class="allow">${escape(t("native.lend.own.allow"))}</button></form></footer></body></html>`;
}

/** Main owns this static permission window. Closing or losing the window declines the grant. */
export function createServerAccessDialog({ BrowserWindow, dark = () => true, icon, t = nativeText.englishText.t }) {
  const pending = new Map();
  return function confirmOwn(env, parent) {
    if (pending.has(env.id)) return pending.get(env.id);
    const nonce = randomUUID();
    let finish;
    const result = new Promise(resolve => { finish = resolve; });
    pending.set(env.id, result);
    let win;
    let settled = false;
    const settle = allowed => {
      if (settled) return;
      settled = true;
      pending.delete(env.id);
      finish(allowed);
      if (win && !win.isDestroyed()) win.close();
    };
    try {
      win = new BrowserWindow({ width: 620, height: 420, minWidth: 480, minHeight: 360,
        title: "Limix Bot", icon, parent: parent && !parent.isDestroyed() ? parent : undefined,
        modal: Boolean(parent && !parent.isDestroyed()), frame: false, show: false, resizable: true,
        backgroundColor: dark() ? "#141414" : "#fafafa", autoHideMenuBar: true,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, partition: `limix-confirm-${nonce}` } });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (event, target) => {
        event.preventDefault();
        let url;
        try { url = new URL(target); } catch { return; }
        if (url.origin !== "https://limix-confirm.invalid" || url.search || url.hash) return;
        if (url.pathname === `/${nonce}/allow`) settle(true);
        else if (url.pathname === `/${nonce}/cancel`) settle(false);
      });
      win.webContents.on("before-input-event", (event, input) => {
        if (input.key === "Escape") { event.preventDefault(); settle(false); }
      });
      win.webContents.on("render-process-gone", () => settle(false));
      win.on("closed", () => settle(false));
      win.once("ready-to-show", () => { if (!win.isDestroyed()) { win.show(); win.focus(); } });
      void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(serverAccessHtml(env, nonce, dark(), t))}`).catch(() => settle(false));
    } catch { settle(false); }
    return result;
  };
}
