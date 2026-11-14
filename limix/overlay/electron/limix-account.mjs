// Limix Bot sign-in gate (Leox ৹ Limix AI). Before the app opens, the computer must be signed in to a Limix account
// (the same accounts as Limix Studio). One account may be signed in on at most N computers at once; the server refuses
// the next one and this window lets the customer free a seat. Off while LIMIX_ACCOUNT_URL is empty.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createAccountClient } from "./limix-account-client.mjs";
import { lxm } from "./limix-lang.mjs";

const HEARTBEAT_MS = 10 * 60_000;
const SITE = "https://tiktok.limixmedia.com";

/** Token file in userData; the token itself is encrypted with the OS keychain (DPAPI on Windows) when available. */
function fileStore(file, safeStorage) {
  const canEncrypt = () => { try { return safeStorage?.isEncryptionAvailable?.() === true; } catch { return false; } };
  return {
    read() {
      try {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        if (raw.tokenEnc && canEncrypt()) raw.token = safeStorage.decryptString(Buffer.from(raw.tokenEnc, "base64"));
        delete raw.tokenEnc;
        return raw;
      } catch { return {}; }
    },
    write(value) {
      const out = { ...value };
      if (out.token && canEncrypt()) { out.tokenEnc = safeStorage.encryptString(out.token).toString("base64"); delete out.token; }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(out), { mode: 0o600 });
    },
  };
}

/** A stable id for this computer: Windows' MachineGuid (hashed), else a random id kept in userData. */
async function machineIdentity(userData) {
  const keep = path.join(userData, "limix-machine-id");
  const hashed = raw => crypto.createHash("sha256").update(`limixbot|${raw}`).digest("hex");
  if (process.platform === "win32") {
    const guid = await new Promise(resolve => execFile("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { windowsHide: true, timeout: 5000 }, (error, stdout) => resolve(error ? "" : (/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{20,})/.exec(stdout)?.[1] ?? ""))));
    if (guid) return hashed(guid.toLowerCase());
  }
  try { const id = fs.readFileSync(keep, "utf8").trim(); if (/^[0-9a-f-]{32,}$/.test(id)) return id; } catch {}
  const id = crypto.randomUUID().replaceAll("-", "") + crypto.randomBytes(8).toString("hex");
  try { fs.mkdirSync(userData, { recursive: true }); fs.writeFileSync(keep, id); } catch {}
  return id;
}

const esc = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function loginPageHtml({ iconPath, notice = "", username = "" }) {
  const J = (vi, en) => JSON.stringify(lxm(vi, en)).replaceAll("<", "\\u003c");
  let icon = "";
  try { icon = fs.readFileSync(iconPath).toString("base64"); } catch {}
  return `<!doctype html><html lang="${lxm("vi", "en")}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>${lxm("Đăng nhập Limix Bot", "Sign in to Limix Bot")}</title><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0a0a0a;color:#fafafa;font:14px/1.5 "Segoe UI",system-ui,sans-serif}
main{min-height:100%;display:flex;flex-direction:column;justify-content:center;padding:28px 34px}
.head{display:flex;align-items:center;gap:12px;margin-bottom:18px}.head img{width:44px;height:44px}
h1{font-size:21px;margin:0;letter-spacing:-.3px}p{margin:4px 0;color:#a1a1aa}
label{display:block;font-size:12px;color:#a1a1aa;margin:12px 0 4px}
input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #3f3f46;background:#121214;color:#fafafa;font:inherit}
input:focus{outline:2px solid #fafafa;outline-offset:1px}
button{font:inherit;cursor:pointer;border-radius:10px;padding:10px 14px;border:1px solid #3f3f46;background:#1c1c1f;color:#fafafa}
button.primary{width:100%;margin-top:16px;background:#fafafa;color:#0a0a0a;border-color:#fafafa;font-weight:600}
button.secondary{width:100%;margin-top:10px;background:transparent}button.secondary:hover{background:#1c1c1f}
button.danger{border-color:#7f1d1d;color:#fca5a5;background:transparent;padding:6px 10px}
button:disabled{opacity:.55;cursor:default}button:focus-visible{outline:2px solid #fafafa;outline-offset:2px}
.links{display:flex;justify-content:space-between;margin-top:14px}.links a{color:#d4d4d8;cursor:pointer;text-decoration:underline;font-size:13px}
.err{color:#fca5a5;min-height:20px;margin-top:10px}.note{color:#fde68a;margin-bottom:6px}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #27272a}
.muted{color:#a1a1aa;font-size:12px}[hidden]{display:none!important}.list{max-height:250px;overflow:auto;margin-top:8px}
</style></head><body><main>
<div class="head">${icon ? `<img src="data:image/png;base64,${icon}" alt="">` : ""}<div><h1>Limix Bot</h1><p>${lxm("Đăng nhập bằng tài khoản Limix (dùng chung với Limix Studio)", "Sign in with your Limix account (shared with Limix Studio)")}</p></div></div>
<section id="form">
${notice ? `<div class="note" role="status">${esc(notice)}</div>` : ""}
<label for="u">${lxm("Email hoặc tên đăng nhập", "Email or username")}</label><input id="u" autocomplete="username" value="${esc(username)}">
<label for="p">${lxm("Mật khẩu", "Password")}</label><input id="p" type="password" autocomplete="current-password">
<button class="primary" id="go">${lxm("Đăng nhập", "Sign in")}</button>
<div class="err" id="err" role="alert"></div>
<button class="secondary" id="reg">${lxm("Chưa có tài khoản? Đăng ký", "No account yet? Sign up")}</button>
<div class="links"><span></span><a id="forgot">${lxm("Quên mật khẩu?", "Forgot password?")}</a></div>
</section>
<section id="full" hidden>
<p id="fullText"></p><div class="list" id="list"></div><div class="err" id="err2" role="alert"></div>
<button id="back" style="margin-top:12px">${lxm("Quay lại", "Back")}</button>
</section>
</main><script>
const $ = s => document.querySelector(s), api = window.limixAccount;
const MSG = { wrong_credentials: ${J("Sai email/tên đăng nhập hoặc mật khẩu.", "Wrong email/username or password.")}, not_activated: ${J("Tài khoản chưa kích hoạt. Hãy nhập mã OTP trong email đăng ký.", "The account is not activated yet. Enter the OTP code from your sign-up email.")},
  account_locked: ${J("Tài khoản đang bị khóa. Liên hệ Limix AI.", "The account is locked. Contact Limix AI.")}, too_many_attempts: ${J("Thử sai quá nhiều lần. Đợi 10 phút rồi thử lại.", "Too many wrong attempts. Wait 10 minutes and try again.")},
  offline: ${J("Không kết nối được máy chủ Limix. Kiểm tra Internet rồi thử lại.", "Can't reach the Limix server. Check your Internet and try again.")}, server_error: ${J("Máy chủ đang lỗi, thử lại sau.", "The server has an error, try again later.")}, bad_request: ${J("Thiếu thông tin.", "Some information is missing.")} };
const say = r => MSG[r.error] || r.detail || (${J("Có lỗi: ", "Error: ")} + r.error);
const when = s => s ? String(s).replace("T", " ").slice(0, 16) : "—";
let creds = null;
function showFull(r) {
  $("#form").hidden = true; $("#full").hidden = false;
  $("#fullText").textContent = ${J("Tài khoản đã đăng nhập trên ", "This account is signed in on ")} + r.machines.length + "/" + r.max + ${J(" máy. Gỡ một máy không còn dùng để đăng nhập máy này:", " computers. Remove one you no longer use to sign in on this one:")};
  const list = $("#list"); list.replaceChildren();
  for (const m of r.machines) {
    const row = document.createElement("div"); row.className = "row";
    const info = document.createElement("div"), name = document.createElement("div"), seen = document.createElement("div");
    name.textContent = m.name; seen.className = "muted"; seen.textContent = ${J("Dùng lần cuối ", "Last used ")} + when(m.last_seen);
    info.append(name, seen);
    const b = document.createElement("button"); b.className = "danger"; b.textContent = ${J("Gỡ máy này", "Remove this computer")};
    b.onclick = async () => {
      b.disabled = true; $("#err2").textContent = "";
      const out = await api.removeMachine(creds.u, creds.p, m.id);
      if (!out.ok) { $("#err2").textContent = say(out); b.disabled = false; return; }
      const again = await api.login(creds.u, creds.p);
      if (!again.ok && again.error === "device_limit") return showFull(again);
      if (!again.ok) { $("#err2").textContent = say(again); b.disabled = false; }
    };
    row.append(info, b); list.append(row);
  }
}
$("#go").onclick = async () => {
  const u = $("#u").value.trim(), p = $("#p").value;
  if (!u || !p) { $("#err").textContent = ${J("Nhập email/tên đăng nhập và mật khẩu.", "Enter your email/username and password.")}; return; }
  $("#go").disabled = true; $("#err").textContent = ""; creds = { u, p };
  const out = await api.login(u, p);
  $("#go").disabled = false;
  if (out.ok) return;
  if (out.error === "device_limit") return showFull(out);
  $("#err").textContent = say(out);
};
$("#p").onkeydown = e => { if (e.key === "Enter") $("#go").click(); };
$("#u").onkeydown = e => { if (e.key === "Enter") $("#p").focus(); };
$("#back").onclick = () => { $("#full").hidden = true; $("#form").hidden = false; };
$("#reg").onclick = () => api.open("register");
$("#forgot").onclick = () => api.open("forgot");
($("#u").value ? $("#p") : $("#u")).focus();
</script></body></html>`;
}

/**
 * Resolves true once this computer is signed in (or still within the offline grace period), false when the person
 * closes the sign-in window. While the app runs, re-checks every 10 minutes; a removed computer or a locked account
 * restarts the app at the sign-in window.
 */
let remoteCredential = () => null;
let accountStore = null, accountClient = null;

/** Who this computer is signed in as, for the sign-out item in the app's account menu; null when the gate is off. */
export function limixAccountInfo() {
  if (!accountStore) return null;
  const saved = accountStore.read() ?? {};
  return saved.token ? { username: String(saved.username ?? ""), email: String(saved.email ?? "") } : null;
}

/** Signs this computer out: frees its seat on the account and forgets the token here even when the server is
 * unreachable. The caller restarts the app, which then opens at the sign-in window. */
export async function limixSignOut() {
  if (!accountStore || !accountClient) return false;
  try {
    await accountClient.logout();
  } catch {
    const saved = accountStore.read() ?? {};
    accountStore.write({ username: saved.username });
  }
  return true;
}

/** What remote access signs in with: the Limix account's own bearer for this computer, or null when not signed in. */
export function limixRemoteCredential() { return remoteCredential(); }

export async function limixAccountGate({ app, BrowserWindow, ipcMain, safeStorage, shell, dialog, iconPath, log = () => {}, baseUrl }) {
  delete process.env.LIMIX_ACCOUNT_USER_ID;
  if (!baseUrl) return true;
  const userData = app.getPath("userData");
  const store = fileStore(path.join(userData, "limix-account.json"), safeStorage);
  const machineId = await machineIdentity(userData);
  const client = createAccountClient({ baseUrl, store, machineId, machineName: os.hostname() });
  accountStore = store; accountClient = client;
  remoteCredential = () => {
    const saved = store.read() ?? {};
    const key = String(saved.username ?? "").trim().toLowerCase();
    if (!saved.token || saved.token === "master-offline" || !/^[a-z0-9._-]{1,64}$/.test(key)) return null;
    return { bearer: `limix.${Buffer.from(machineId, "utf8").toString("base64url")}.${saved.token}`, userId: `limix:${key}`, email: `${key}@limix.invalid` };
  };

  const first = await client.check();
  log(`limix account: ${first.status}${first.offline ? " (offline grace)" : ""}${first.reason ? ` (${first.reason})` : ""}`);
  if (first.status !== "ok") {
    const notice = first.reason === "account_locked" ? lxm("Tài khoản đang bị khóa. Liên hệ Limix AI.", "The account is locked. Contact Limix AI.")
      : first.reason === "signed_out" ? lxm("Máy này đã bị đăng xuất khỏi tài khoản. Hãy đăng nhập lại.", "This computer was signed out of the account. Please sign in again.")
      : first.reason === "offline" ? lxm("Không kết nối được máy chủ Limix để kiểm tra đăng nhập. Kiểm tra Internet rồi đăng nhập lại.", "Can't reach the Limix server to check your sign-in. Check your Internet and sign in again.") : "";
    const signedIn = await showLoginWindow({ BrowserWindow, ipcMain, shell, iconPath, client, notice, username: store.read().username ?? "" });
    if (!signedIn) return false;
  }

  const identity = remoteCredential();
  if (identity) process.env.LIMIX_ACCOUNT_USER_ID = identity.userId;

  // The profile (Settings > General) shows the Limix account's name and e-mail until the owner types their own.
  { const saved = store.read() ?? {}; if (saved.email) process.env.LIMIX_ACCOUNT_EMAIL = String(saved.email); if (saved.username) process.env.LIMIX_ACCOUNT_NAME = String(saved.username); }

  const beat = setInterval(async () => {
    const now = await client.check();
    if (now.status === "ok") return;
    clearInterval(beat);
    log(`limix account: signed out while running (${now.reason})`);
    if (now.reason === "offline") {
      await dialog.showMessageBox({ type: "warning", title: "Limix Bot", message: lxm("Đã quá lâu không kết nối được máy chủ Limix.", "Couldn't reach the Limix server for too long."), detail: lxm("Ứng dụng sẽ khởi động lại để đăng nhập.", "The app will restart so you can sign in.") });
    } else {
      await dialog.showMessageBox({ type: "warning", title: "Limix Bot",
        message: now.reason === "account_locked" ? lxm("Tài khoản Limix của bạn đang bị khóa.", "Your Limix account is locked.") : lxm("Máy này đã bị đăng xuất khỏi tài khoản Limix.", "This computer was signed out of your Limix account."),
        detail: lxm("Ứng dụng sẽ khởi động lại để đăng nhập.", "The app will restart so you can sign in.") });
    }
    app.relaunch(); app.quit();
  }, HEARTBEAT_MS);
  beat.unref?.();
  return true;
}

function showLoginWindow({ BrowserWindow, ipcMain, shell, iconPath, client, notice, username }) {
  return new Promise(resolve => {
    let done = false;
    const win = new BrowserWindow({
      width: 460, height: 600, resizable: false, maximizable: false, fullscreenable: false, show: false,
      backgroundColor: "#0a0a0a", icon: iconPath, title: lxm("Đăng nhập Limix Bot", "Sign in to Limix Bot"), autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false,
        preload: fileURLToPath(new URL("./limix-account-preload.cjs", import.meta.url)) },
    });
    win.setMenu(null);
    const own = event => event.sender === win.webContents;
    const channels = ["limix-account:login", "limix-account:remove", "limix-account:open"];
    const finish = ok => {
      if (done) return; done = true;
      for (const channel of channels) ipcMain.removeHandler(channel);
      if (!win.isDestroyed()) win.destroy();
      resolve(ok);
    };
    ipcMain.handle("limix-account:login", async (event, u, p) => {
      if (!own(event)) return { ok: false, error: "bad_request" };
      const out = await client.login(String(u ?? ""), String(p ?? ""));
      if (out.ok) setImmediate(() => finish(true));
      return out;
    });
    ipcMain.handle("limix-account:remove", async (event, u, p, id) => own(event)
      ? client.removeMachine(String(u ?? ""), String(p ?? ""), Number(id)) : { ok: false, error: "bad_request" });
    ipcMain.handle("limix-account:open", (event, which) => {
      if (!own(event)) return;
      void shell.openExternal(which === "register" ? "https://limixmedia.com/dang-ky" : `${SITE}/login`);
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", event => event.preventDefault());
    win.once("ready-to-show", () => win.show());
    win.on("closed", () => finish(false));
    void win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(loginPageHtml({ iconPath, notice, username })));
  });
}
