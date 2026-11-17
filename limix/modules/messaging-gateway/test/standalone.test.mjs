// The module on its own: started as a plain process, reaching bots only through their Bot API, never through the app.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

import { OpenMausBotEngine } from "../src/engines/openmausbot.mjs";
import { Gateway, defaultMakeChannel } from "../src/gateway.mjs";
import { PairingStore, hashCode } from "../src/pairing.mjs";
import { SecretStore } from "../src/secrets.mjs";
import { Store } from "../src/store.mjs";
import { TEXT } from "../src/router.mjs";
import { fakeOpenMausBot, fakeTelegram, until } from "./fakes.mjs";

const cleanups = [];
after(() => cleanups.forEach((stop) => stop()));
const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test("runs as its own process: answers on loopback, behind its admin token, and offers no bots from an app", async () => {
  const dir = mkdtempSync(join(tmpdir(), "limix-mg-"));
  const port = await freePort();
  const admin = "test-admin-token-test-admin-token";
  const child = spawn(process.execPath, [fileURLToPath(new URL("../src/main.mjs", import.meta.url))], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: process.env.PATH, LIMIX_DATA_DIR: dir, LIMIX_PORT: String(port), LIMIX_NO_BROWSER: "1", LIMIX_ADMIN_TOKEN: admin },
  });
  cleanups.push(() => { child.kill(); rmSync(dir, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => { if (String(chunk).includes(String(port))) resolve(); });
    child.on("exit", (code) => reject(new Error(`exited early (${code})`)));
    setTimeout(() => reject(new Error("did not start")), 10_000);
  });
  const base = `http://127.0.0.1:${port}`;
  assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { app: "limix-bot" });
  assert.equal((await fetch(`${base}/api/state`)).status, 401, "the page's API needs its admin token");
  const bots = await fetch(`${base}/api/app/bots`, { headers: { "x-limix-admin": admin } });
  assert.deepEqual(await bots.json(), { inside: false, bots: [] });
  const link = await fetch(`${base}/api/app/link`, { method: "POST", headers: { "x-limix-admin": admin, "content-type": "application/json" }, body: JSON.stringify({ botId: "b" }) });
  assert.equal(link.status, 400);
  const owner = await fetch(`${base}/api/channel-reply`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(owner.status, 403, "no owner transport without a secret set up for it");
});

test("two channels reach two different bots through their own Bot API keys, each conversation kept on its own thread", async () => {
  const dir = mkdtempSync(join(tmpdir(), "limix-mg-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const sales = await fakeOpenMausBot({ bot: "sales", key: "bak_salessalessalessalessalessales1", respond: (message) => ({ reply: `Sales: ${message}` }) });
  const support = await fakeOpenMausBot({ bot: "support", key: "bak_supportsupportsupportsupport12", respond: (message) => ({ reply: `Support: ${message}` }) });
  const tgSales = await fakeTelegram({ token: "111111:SALESSALESSALESSALESSALESSALESSA" });
  const tgSupport = await fakeTelegram({ token: "222222:SUPPORTSUPPORTSUPPORTSUPPORTSUPP" });
  for (const fake of [sales, support, tgSales, tgSupport]) cleanups.push(fake.close);
  const store = new Store(dir), secrets = new SecretStore(dir), pairing = new PairingStore(dir);
  const bases = new Map([[tgSales.token, tgSales.base], [tgSupport.token, tgSupport.base]]);
  const gateway = new Gateway({
    store, secrets, pairing,
    makeChannel: (conn, token) => defaultMakeChannel(conn, token, { telegram: { apiBase: bases.get(token), pollTimeoutSec: 1 } }),
    makeEngine: (conn, sec) => new OpenMausBotEngine({ endpoint: conn.engine.endpoint, apiKey: sec.get(conn.engine.keyRef), pollMs: 20, waitSeconds: 1 }),
  });
  cleanups.push(() => gateway.stopAll());
  const add = (tg, bot) => store.addConnection({
    platform: "telegram", name: bot.endpoint, botIdentity: { id: "1", username: "b", name: "Bot" }, tokenRef: secrets.put(tg.token), accessPolicy: "pairing",
    engine: { kind: "openmausbot", endpoint: bot.endpoint, keyRef: secrets.put(bot.key) },
  });
  const one = add(tgSales, sales), two = add(tgSupport, support);
  store.setLinkCode(one.id, hashCode("SALE23"), Date.now() + 60_000);
  store.setLinkCode(two.id, hashCode("HELP23"), Date.now() + 60_000);
  gateway.start(one.id);
  gateway.start(two.id);
  const ana = { id: 31, name: "Ana" }, binh = { id: 32, name: "Bình" };
  tgSales.push(ana, "/link SALE23");
  tgSupport.push(binh, "/link HELP23");
  await until(() => tgSales.state.sent.some((s) => s.text === TEXT.linked) && tgSupport.state.sent.some((s) => s.text === TEXT.linked));

  tgSales.push(ana, "giá bao nhiêu");
  tgSupport.push(binh, "máy hỏng");
  await until(() => tgSales.state.sent.some((s) => s.text === "Sales: giá bao nhiêu") && tgSupport.state.sent.some((s) => s.text === "Support: máy hỏng"));
  tgSales.push(ana, "còn hàng không");
  await until(() => tgSales.state.sent.some((s) => s.text === "Sales: còn hàng không"));

  assert.deepEqual(sales.state.calls.map((call) => call.message), ["giá bao nhiêu", "còn hàng không"], "only the sales channel reached the sales bot");
  assert.deepEqual(support.state.calls.map((call) => call.message), ["máy hỏng"]);
  assert.equal(sales.state.calls[1].thread, "t1", "the second message continues the same conversation");
  assert.ok(tgSales.state.sent.every((s) => s.chatId === "31") && tgSupport.state.sent.every((s) => s.chatId === "32"), "each reply went back to its own chat");
  assert.ok(!tgSupport.state.sent.some((s) => s.text.startsWith("Sales:")));
});
