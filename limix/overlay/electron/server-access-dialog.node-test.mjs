import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createServerAccessDialog, serverAccessHtml } from "./server-access-dialog.mjs";

function fixture() {
  const windows = [];
  class Window extends EventEmitter {
    constructor(options) { super(); this.options = options; this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = fn => { this.opener = fn; }; windows.push(this); }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    isDestroyed() { return this.destroyed === true; }
    close() { this.destroyed = true; this.emit("closed"); }
  }
  return { windows, confirm: createServerAccessDialog({ BrowserWindow: Window }) };
}
const env = { id: "test", name: "Xeon <script>bad()</script>", origin: "https://server.example" };
test("escapes server fields and disables page scripts and remote resources", () => {
  const html = serverAccessHtml(env, "nonce", true);
  assert.ok(html.includes("&lt;script&gt;bad()&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("default-src 'none'"));
  assert.match(html, /button autofocus/);
});
test("accepts only its own explicit allow action, deduplicates concurrent prompts", async () => {
  const f = fixture(), result = f.confirm(env);
  assert.equal(f.confirm(env), result);
  const win = f.windows[0];
  assert.deepEqual(win.options.webPreferences.nodeIntegration, false);
  assert.equal(win.options.webPreferences.javascript, false);
  const html = decodeURIComponent(win.url.split(",")[1]);
  const allow = html.match(/action="([^"]+\/allow)"/)[1];
  let prevented = 0;
  const event = { preventDefault() { prevented++; } };
  win.webContents.emit("will-navigate", event, "https://server.example/allow");
  win.webContents.emit("will-navigate", event, allow.replace("/allow", "/allow?unexpected=true"));
  win.webContents.emit("will-navigate", event, allow);
  assert.equal(await result, true);
  assert.equal(prevented, 3);
  assert.equal(win.destroyed, true);
  assert.deepEqual(win.opener(), { action: "deny" });
});
test("closing and Escape both decline", async () => {
  for (const method of ["close", "escape"]) {
    const f = fixture(), result = f.confirm(env), win = f.windows[0];
    if (method === "close") win.close();
    else win.webContents.emit("before-input-event", { preventDefault() {} }, { key: "Escape" });
    assert.equal(await result, false);
  }
});
