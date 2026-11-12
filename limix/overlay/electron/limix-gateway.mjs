// Limix Bot: the Telegram / Zalo / Discord connector (limix/gateway) runs inside the app. It is started with the app,
// listens only on 127.0.0.1, keeps its data in userData/limix-gateway and stops when the app quits. Its own page is
// shown in a small window (menu: "Kết nối Zalo · Telegram · Discord").
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomBytes } from "node:crypto";

const PORT = 8790;
const URL_ = `http://127.0.0.1:${PORT}/`;

export function createLimixGateway({ app, BrowserWindow, shell, resourcesPath, userData, iconPath, log = () => {}, ownerLaneToken }) {
  const entry = [path.join(resourcesPath, "limix-gateway", "src", "main.mjs"), path.join(app.getAppPath(), "limix", "gateway", "src", "main.mjs")]
    .find((candidate) => fs.existsSync(candidate));
  let child = null;
  let stopping = false;
  let restarts = 0;
  let window = null;
  const launcherToken = randomBytes(16).toString("hex");

  const alive = () => new Promise((resolve) => {
    const request = http.get(URL_ + "api/state", { timeout: 1000 }, (res) => { res.resume(); resolve(true); });
    request.on("error", () => resolve(false));
    request.on("timeout", () => { request.destroy(); resolve(false); });
  });

  function start() {
    if (!entry || child || stopping) return;
    const dataDir = path.join(userData, "limix-gateway");
    fs.mkdirSync(dataDir, { recursive: true });
    child = spawn(process.execPath, [entry], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", LIMIX_DATA_DIR: dataDir, LIMIX_PORT: String(PORT), LIMIX_NO_BROWSER: "1", LIMIX_LAUNCHER_TOKEN: launcherToken, ...(ownerLaneToken ? { LIMIX_OWNER_LANE_TOKEN: ownerLaneToken } : {}) },
    });
    const note = (chunk) => { const line = String(chunk).trim().split("\n").pop(); if (line) log(`limix gateway: ${line.slice(0, 200)}`); };
    child.stdout.on("data", note);
    child.stderr.on("data", note);
    child.on("exit", (code) => {
      child = null;
      if (stopping) return;
      log(`limix gateway exited (${code})`);
      if (restarts++ < 5) setTimeout(start, 2000 * restarts).unref?.();
    });
  }

  function stop() {
    stopping = true;
    try { child?.kill(); } catch { /* already gone */ }
    child = null;
    try { window?.destroy(); } catch { /* closed */ }
  }

  async function open() {
    if (!entry) throw new Error("Chương trình kết nối chưa được cài kèm bản này.");
    if (window && !window.isDestroyed()) { window.show(); window.focus(); return; }
    start();
    for (let i = 0; i < 40 && !(await alive()); i++) await new Promise((r) => setTimeout(r, 250));
    if (!(await alive())) throw new Error("Chưa khởi động được chương trình kết nối. Thử lại sau vài giây.");
    window = new BrowserWindow({
      width: 1040, height: 720, minWidth: 760, minHeight: 520, backgroundColor: "#0a0a0a", icon: iconPath,
      title: "Kết nối Zalo · Telegram · Discord", autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
    window.webContents.on("will-navigate", (event, url) => { if (!url.startsWith(URL_)) event.preventDefault(); });
    window.on("closed", () => { window = null; });
    void window.loadURL(URL_);
  }

  return { start, stop, open, available: Boolean(entry) };
}
