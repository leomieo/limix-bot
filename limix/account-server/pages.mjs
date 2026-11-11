// The three pages the account server shows: a home page, the customer's own devices, and the owner's admin page.
// Plain HTML with inline script (allowed by the page CSP). Every value from the server is set with textContent.

const MARK = `<svg viewBox="0 0 1024 1024" width="40" height="40" aria-hidden="true"><rect width="1024" height="1024" rx="224" fill="#fff"/><path fill="#000" fill-rule="evenodd" d="M269 344H533C593 344 641 392 641 452V672C641 732 593 780 533 780H269C209 780 161 732 161 672V452C161 392 209 344 269 344ZM491 244H755C815 244 863 292 863 352V572C863 632 815 680 755 680H491C431 680 383 632 383 572V352C383 292 431 244 491 244Z"/></svg>`;

const STYLE = `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0a0a0a;color:#fafafa;font:15px/1.5 "Segoe UI",system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 16px}header{display:flex;align-items:center;gap:14px;margin-bottom:28px}
h1{font-size:24px;margin:0;letter-spacing:-.4px}h2{font-size:17px;margin:28px 0 10px}p{color:#a1a1aa;margin:6px 0}
.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:18px;margin:12px 0}
label{display:block;font-size:13px;color:#a1a1aa;margin:10px 0 4px}input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid #3f3f46;background:#0a0a0a;color:#fafafa;font:inherit}
input:focus{outline:2px solid #fafafa;outline-offset:1px}button{font:inherit;cursor:pointer;border-radius:10px;padding:9px 14px;border:1px solid #3f3f46;background:#27272a;color:#fafafa}
button.primary{background:#fafafa;color:#0a0a0a;border-color:#fafafa;font-weight:600}button.danger{border-color:#7f1d1d;color:#fca5a5;background:transparent}
button:disabled{opacity:.5;cursor:default}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #27272a}
.row:first-child{border-top:0}.muted{color:#a1a1aa;font-size:13px}.err{color:#fca5a5;min-height:22px;margin-top:10px}.ok{color:#86efac}
.tag{font-size:12px;border:1px solid #3f3f46;border-radius:999px;padding:1px 8px;color:#a1a1aa}a{color:#fafafa}[hidden]{display:none!important}`;

const page = (title, body, script) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${STYLE}</style></head>
<body><main><header>${MARK}<div><h1>${title}</h1><p>Limix Bot · Leox ৹ Limix AI</p></div></header>${body}</main><script>${script}</script></body></html>`;

const COMMON = `
const $ = s => document.querySelector(s);
const ERRORS = { wrong_credentials: "Sai email hoặc mật khẩu.", account_locked: "Tài khoản đang bị khóa. Liên hệ Limix AI.",
  too_many_attempts: "Thử sai quá nhiều lần. Đợi 10 phút rồi thử lại.", admin_only: "Mã quản trị không đúng.", server_error: "Máy chủ lỗi, thử lại sau." };
const say = (code) => ERRORS[code] || "Có lỗi: " + code;
async function call(path, body, headers = {}) {
  const res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: "server_error" }));
  if (!res.ok) throw new Error(data.error || "server_error");
  return data;
}
const when = ms => ms ? new Date(ms).toLocaleString("vi-VN") : "—";
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
`;

export function homePage() {
  return page("Tài khoản Limix", `<div class="card"><p>Đây là máy chủ tài khoản của Limix Bot. Đăng ký và đăng nhập ngay trong ứng dụng Limix Bot.</p>
<p><a href="/account">Quản lý các máy đang đăng nhập tài khoản của bạn →</a></p></div>`, "");
}

export function accountPage(max) {
  return page("Máy đang dùng tài khoản", `
<div class="card" id="login"><p>Mỗi tài khoản dùng được trên tối đa <b>${Number(max)}</b> máy cùng lúc. Đăng nhập để xem và gỡ máy không còn dùng.</p>
<label for="email">Email</label><input id="email" type="email" autocomplete="username">
<label for="password">Mật khẩu</label><input id="password" type="password" autocomplete="current-password">
<div style="margin-top:14px"><button class="primary" id="go">Xem các máy</button></div><div class="err" id="err" role="alert"></div></div>
<div class="card" id="list" hidden><p id="who"></p><div id="rows"></div><div class="err" id="err2" role="alert"></div></div>`, COMMON + `
let creds = null;
function render(data) {
  $("#who").textContent = data.email + " — " + data.devices.length + "/" + data.max + " máy đang đăng nhập";
  const rows = $("#rows"); rows.replaceChildren();
  if (!data.devices.length) rows.append(el("p", "Chưa có máy nào đăng nhập."));
  for (const d of data.devices) {
    const row = el("div", undefined, "row"), info = el("div");
    info.append(el("div", d.name), el("div", (d.platform ? d.platform + " · " : "") + "dùng lần cuối " + when(d.lastSeen), "muted"));
    const btn = el("button", "Gỡ máy này", "danger");
    btn.onclick = async () => { btn.disabled = true; try { render({ ...data, ...(await call("/api/devices/remove", { ...creds, id: d.id })) }); } catch (e) { $("#err2").textContent = say(e.message); btn.disabled = false; } };
    row.append(info, btn); rows.append(row);
  }
}
$("#go").onclick = async () => {
  $("#err").textContent = ""; creds = { email: $("#email").value, password: $("#password").value };
  try { const data = await call("/api/devices", creds); $("#login").hidden = true; $("#list").hidden = false; render(data); }
  catch (e) { $("#err").textContent = say(e.message); }
};
$("#password").onkeydown = e => { if (e.key === "Enter") $("#go").click(); };`);
}

export function adminPage() {
  return page("Quản trị tài khoản Limix", `
<div class="card" id="login"><label for="token">Mã quản trị (ADMIN_TOKEN, in ra khi cài máy chủ)</label><input id="token" type="password" autocomplete="off">
<div style="margin-top:14px"><button class="primary" id="go">Vào trang quản trị</button></div><div class="err" id="err" role="alert"></div></div>
<div id="panel" hidden><div class="card"><p id="sum"></p><button id="reload">Tải lại</button></div><div class="card" id="users"></div><div class="err" id="err2" role="alert"></div></div>`, COMMON + `
let token = sessionStorage.getItem("limixAdmin") || "";
const admin = (path, body) => call(path, body, { "x-admin-token": token });
async function load() {
  const data = await admin("/api/admin/users");
  $("#sum").textContent = data.users.length + " tài khoản · tối đa " + data.max + " máy mỗi tài khoản";
  const box = $("#users"); box.replaceChildren();
  if (!data.users.length) box.append(el("p", "Chưa có tài khoản nào."));
  for (const u of data.users) {
    const row = el("div", undefined, "row"), info = el("div");
    const top = el("div", u.email); if (u.locked) { top.append(" "); top.append(el("span", "đã khóa", "tag")); }
    info.append(top, el("div", u.devices + "/" + data.max + " máy · tạo " + when(u.created) + " · dùng lần cuối " + when(u.last_seen), "muted"));
    const tools = el("div"); tools.style.display = "flex"; tools.style.gap = "8px"; tools.style.flexWrap = "wrap";
    const devs = el("button", "Máy"), lock = el("button", u.locked ? "Mở khóa" : "Khóa", u.locked ? "" : "danger"), del = el("button", "Xóa", "danger");
    devs.onclick = () => showDevices(u, row);
    lock.onclick = async () => { await admin("/api/admin/lock", { userId: u.id, locked: !u.locked }); load(); };
    del.onclick = async () => { if (confirm("Xóa hẳn tài khoản " + u.email + "?")) { await admin("/api/admin/delete-user", { userId: u.id }); load(); } };
    tools.append(devs, lock, del); row.append(info, tools); box.append(row);
  }
}
async function showDevices(u, row) {
  const old = row.nextElementSibling; if (old && old.dataset.devices) { old.remove(); return; }
  const list = el("div", undefined, "card"); list.dataset.devices = "1";
  const data = await admin("/api/admin/devices", { userId: u.id });
  if (!data.devices.length) list.append(el("p", "Không có máy nào đang đăng nhập."));
  for (const d of data.devices) {
    const r = el("div", undefined, "row"), info = el("div");
    info.append(el("div", d.name), el("div", (d.platform ? d.platform + " · " : "") + "dùng lần cuối " + when(d.lastSeen), "muted"));
    const b = el("button", "Gỡ", "danger"); b.onclick = async () => { await admin("/api/admin/remove-device", { id: d.id }); list.remove(); load(); };
    r.append(info, b); list.append(r);
  }
  row.after(list);
}
async function enter() {
  try { await load(); sessionStorage.setItem("limixAdmin", token); $("#login").hidden = true; $("#panel").hidden = false; }
  catch (e) { $("#err").textContent = say(e.message); sessionStorage.removeItem("limixAdmin"); }
}
$("#go").onclick = () => { token = $("#token").value.trim(); $("#err").textContent = ""; enter(); };
$("#token").onkeydown = e => { if (e.key === "Enter") $("#go").click(); };
$("#reload").onclick = () => load().catch(e => { $("#err2").textContent = say(e.message); });
if (token) enter();`);
}
