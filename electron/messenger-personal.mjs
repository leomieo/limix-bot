// Limix Bot (experimental): a bot answers a personal Messenger account. Facebook has no API for personal accounts, so this
// app keeps a hidden Facebook window per bot, signed in by the person in that same window, reads new messages off the
// page and types the replies the server queues (server/bot-channels/messenger.ts). Nothing here sees the password: the
// sign-in stays in the window's own storage partition. Facebook's page markup is not a contract; when it changes, reading
// stops, and the bot's Messenger settings say so.
const MESSAGES = "https://www.facebook.com/messages/t/";
const SCAN_MS = 4_000;
const SUPERVISE_MS = 20_000;
const RELOAD_MS = 30 * 60_000;
const OWN = /^(?:bạn|you)\s*:|^(?:bạn|you) (?:đã gửi|sent)/iu;

const partition = (botId) => `persist:limix-messenger-${botId}`;
const nap = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** The chat list as the page shows it: thread id, the name on the row, and the preview without its time. */
export const SCAN = `(() => {
  const rows = [], seen = new Set();
  for (const link of document.querySelectorAll('a[href*="/messages/t/"]')) {
    const match = (link.getAttribute("href") || "").match(/\\/messages\\/t\\/([\\w.-]{1,64})/);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    const lines = (link.innerText || "").split("\\n").map((line) => line.trim()).filter((line) => line && line !== "·");
    if (lines.length < 2) continue;
    rows.push({ thread: match[1], name: lines[0], preview: lines.slice(1).join(" ") });
    if (rows.length >= 25) break;
  }
  const signIn = Boolean(document.querySelector('input[name="email"], input[name="pass"]'));
  return { rows, signIn };
})()`;

/** The newest message bubble of the open thread, and whether it sits on the right, where the account's own go. */
export const READ_LAST = `(() => {
  const main = document.querySelector('[role="main"]');
  if (!main) return null;
  const box = main.getBoundingClientRect();
  const rows = [...main.querySelectorAll('[role="row"]')];
  for (let i = rows.length - 1; i >= 0; i--) {
    const parts = [...rows[i].querySelectorAll('div[dir="auto"]')].filter((node) => (node.innerText || "").trim());
    if (!parts.length) continue;
    const last = parts[parts.length - 1].getBoundingClientRect();
    return { text: parts.map((node) => node.innerText.trim()).join("\\n"), mine: (last.left + last.right) / 2 > box.left + box.width * 0.55 };
  }
  return null;
})()`;

const OPEN_THREAD = (thread) => `(() => {
  const link = document.querySelector('a[href*="/messages/t/${thread}"]');
  if (link) { link.click(); return true; }
  return false;
})()`;
const FOCUS_BOX = `(() => {
  const box = document.querySelector('[role="main"] [role="textbox"][contenteditable="true"]') || document.querySelector('[role="textbox"][contenteditable="true"]');
  if (!box) return false;
  box.focus();
  return true;
})()`;

/** Drops the row's trailing time ("· 5 phút", "· 2m") so a preview only changes when a message does. */
export function previewOf(text) {
  return String(text ?? "").replace(/\s*·\s*[^·]{1,20}$/u, "").trim();
}

/** Rows new or changed since the last look that someone else wrote. */
export function changedRows(before, rows) {
  return rows.filter((row) => before.get(row.thread) !== previewOf(row.preview) && !OWN.test(previewOf(row.preview)));
}

export function installMessengerPersonal({ app, ipcMain, BrowserWindow, session, localRequest, guard, log = () => {}, timers = { setInterval, clearInterval } }) {
  const workers = new Map();

  const call = async (method, route, body) => {
    const response = await localRequest(route, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${response.status}`);
    return data;
  };

  const windowFor = (botId, show) => {
    const win = new BrowserWindow({ width: 1100, height: 800, show, title: "Messenger", autoHideMenuBar: true,
      webPreferences: { partition: partition(botId), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    void win.loadURL(MESSAGES);
    return win;
  };

  function startWorker(botId) {
    const win = windowFor(botId, false);
    const state = { win, stopped: false, busy: Promise.resolve(), before: null, loadedAt: Date.now() };
    const exclusive = (job) => { const next = state.busy.then(job, job); state.busy = next.catch(() => {}); return next; };
    const run = (code) => win.webContents.executeJavaScript(code, true);
    win.on("close", (event) => { if (!state.stopped) { event.preventDefault(); win.hide(); } });

    const typeInto = async (thread, text) => {
      if (!/^[\w.-]{1,64}$/u.test(thread)) throw new Error("bad thread");
      if (!(await run(OPEN_THREAD(thread)).catch(() => false))) { await win.loadURL(`${MESSAGES}${thread}/`); }
      await nap(2_500);
      if (!(await run(FOCUS_BOX).catch(() => false))) throw new Error("no message box");
      const input = win.webContents.debugger;
      if (!input.isAttached()) input.attach("1.3");
      const enter = async (modifiers) => {
        for (const type of ["keyDown", "keyUp"]) await input.sendCommand("Input.dispatchKeyEvent", { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers, ...(type === "keyDown" && !modifiers ? { text: "\r" } : {}) });
      };
      const lines = text.split("\n");
      for (const [index, line] of lines.entries()) {
        if (line) await input.sendCommand("Input.insertText", { text: line });
        if (index < lines.length - 1) await enter(8);
      }
      await enter(0);
      await nap(1_000);
    };

    const scan = () => exclusive(async () => {
      if (state.stopped || win.webContents.isLoading()) return;
      if (Date.now() - state.loadedAt > RELOAD_MS) { state.loadedAt = Date.now(); await win.loadURL(MESSAGES); return; }
      const page = await run(SCAN).catch(() => null);
      if (!page || page.signIn) return;
      const rows = Array.isArray(page.rows) ? page.rows : [];
      if (!state.before) { state.before = new Map(rows.map((row) => [row.thread, previewOf(row.preview)])); return; }
      const fresh = changedRows(state.before, rows);
      for (const row of rows) state.before.set(row.thread, previewOf(row.preview));
      for (const row of fresh) {
        let text = previewOf(row.preview);
        if (await run(OPEN_THREAD(row.thread)).catch(() => false)) {
          await nap(2_000);
          const last = await run(READ_LAST).catch(() => null);
          if (last?.mine) continue;
          if (last?.text) text = last.text;
        }
        await call("POST", `/api/bots/${botId}/messenger/inbox`, { messages: [{ id: `${row.thread}:${Date.now()}`, chatId: row.thread, name: row.name, text }] }).catch((error) => log(`messenger: ${error.message}`));
      }
    });

    const deliver = async () => {
      while (!state.stopped) {
        const outbox = await call("GET", `/api/bots/${botId}/messenger/outbox`).catch(() => null);
        if (!outbox) { await nap(5_000); continue; }
        for (const item of outbox.items ?? []) {
          const error = await exclusive(() => typeInto(item.chatId, item.text)).then(() => undefined, (failure) => String(failure?.message ?? failure));
          await call("POST", `/api/bots/${botId}/messenger/sent`, { id: item.id, ...(error ? { error } : {}) }).catch(() => {});
        }
      }
    };

    const timer = timers.setInterval(() => { void scan(); }, SCAN_MS);
    void deliver();
    workers.set(botId, { win, stop() { state.stopped = true; timers.clearInterval(timer); if (!win.isDestroyed()) win.destroy(); } });
  }

  const supervise = async () => {
    const wanted = new Set((await call("GET", "/api/messenger/bots").catch(() => ({ bots: [] }))).bots ?? []);
    for (const [botId, worker] of workers) if (!wanted.has(botId)) { worker.stop(); workers.delete(botId); }
    for (const botId of wanted) if (!workers.has(botId)) startWorker(botId);
  };
  timers.setInterval(() => { void supervise(); }, SUPERVISE_MS);
  const stopAll = () => { for (const worker of workers.values()) worker.stop(); workers.clear(); };
  app.on("before-quit", stopAll);

  const ID = /^[\w-]{1,128}$/u;
  ipcMain.handle("limix-messenger:sign-in", guard("limix-messenger:sign-in", async (_event, botId) => {
    if (!ID.test(String(botId))) throw new Error("bad bot");
    workers.get(botId)?.stop();
    workers.delete(botId);
    const win = windowFor(botId, true);
    await new Promise((resolve) => win.on("closed", resolve));
    const [cookie] = await session.fromPartition(partition(botId)).cookies.get({ url: "https://www.facebook.com", name: "c_user" });
    if (!cookie?.value) throw new Error("Chưa đăng nhập Facebook trong cửa sổ vừa đóng.");
    const view = await call("POST", `/api/bots/${botId}/messenger`, { token: JSON.stringify({ uid: cookie.value, name: "" }) });
    void supervise();
    return view;
  }));
  ipcMain.handle("limix-messenger:show", guard("limix-messenger:show", (_event, botId) => {
    const worker = workers.get(String(botId));
    if (worker && !worker.win.isDestroyed()) { worker.win.show(); worker.win.focus(); return true; }
    return false;
  }));
  ipcMain.handle("limix-messenger:sign-out", guard("limix-messenger:sign-out", async (_event, botId) => {
    if (!ID.test(String(botId))) throw new Error("bad bot");
    workers.get(botId)?.stop();
    workers.delete(botId);
    await session.fromPartition(partition(botId)).clearStorageData();
    return true;
  }));
  return { supervise, stopAll };
}
