import { createHmac } from "node:crypto";
import vm from "node:vm";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { Gateway, defaultMakeChannel } from "../src/gateway.mjs";
import { PairingStore } from "../src/pairing.mjs";
import { SecretStore } from "../src/secrets.mjs";
import { Store } from "../src/store.mjs";
import { createApp } from "../src/web/server.mjs";
import { fakeOpenMausBot, fakeTelegram, until } from "./fakes.mjs";

const cleanups = [];
after(() => cleanups.forEach((f) => f()));

function call(port, { method = "GET", path = "/", host, admin, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = request({ host: "127.0.0.1", port, method, path, headers: {
      ...headers, Host: host ?? `127.0.0.1:${port}`, ...(admin ? { "X-Limix-Admin": admin } : {}),
      ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
    } }, (res) => {
      const parts = [];
      res.on("data", (c) => parts.push(c));
      res.on("end", () => {
        const text = Buffer.concat(parts).toString("utf8");
        let json; try { json = JSON.parse(text); } catch { /* html */ }
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

async function startApp() {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const omb = await fakeOpenMausBot(); cleanups.push(omb.close);
  const dir = mkdtempSync(join(tmpdir(), "limix-web-"));
  const store = new Store(dir), secrets = new SecretStore(dir), pairing = new PairingStore(dir);
  const makeChannel = (conn, token) => defaultMakeChannel(conn, token, { telegram: { apiBase: tg.base, pollTimeoutSec: 1 } });
  const gateway = new Gateway({ store, secrets, pairing, makeChannel });
  const { server } = createApp({ store, secrets, pairing, gateway, makeChannel, port: 0 });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  server.close();
  const app = createApp({ store, secrets, pairing, gateway, makeChannel, port });
  await new Promise((r) => app.server.listen(port, "127.0.0.1", r));
  cleanups.push(() => { gateway.stopAll(); app.server.close(); });
  const page = await call(port, {});
  const admin = /const ADMIN = "([^"]+)"/.exec(page.text)[1];
  return { tg, omb, store, secrets, gateway, port, admin, page };
}

test("API refuses calls without the page's admin token or from a foreign Host", async () => {
  const { port, admin } = await startApp();
  assert.equal((await call(port, { path: "/api/state" })).status, 401);
  assert.equal((await call(port, { path: "/api/state", admin: "guess" })).status, 401);
  assert.equal((await call(port, { path: "/api/state", admin, host: "evil.example.com" })).status, 421);
  assert.equal((await call(port, { path: "/api/state", admin })).status, 200);
});

test("Connecting a bot validates the token, starts it, and never returns secrets", async () => {
  const { tg, omb, port, admin, store } = await startApp();
  const bad = await call(port, { method: "POST", path: "/api/connections", admin, body: { platform: "telegram", token: "1:bad", engineKind: "echo" } });
  assert.equal(bad.status, 400);
  const ok = await call(port, { method: "POST", path: "/api/connections", admin, body: {
    platform: "telegram", token: tg.token, engineKind: "openmausbot", endpoint: omb.endpoint, apiKey: omb.key, accessPolicy: "owner_only" } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.engineCheck.ok, true);
  assert.equal(ok.json.connection.botIdentity.username, "limix_test_bot");
  const dup = await call(port, { method: "POST", path: "/api/connections", admin, body: { platform: "telegram", token: tg.token, engineKind: "echo" } });
  assert.equal(dup.status, 409);
  const id = ok.json.connection.id;
  await until(() => store.getConnection(id).status === "running");
  const state = await call(port, { path: "/api/state", admin });
  assert.ok(!state.text.includes(tg.token.split(":")[1]), "bot token not exposed");
  assert.ok(!state.text.includes(omb.key), "API key not exposed");
  const link = await call(port, { method: "POST", path: `/api/connections/${id}/link-code`, admin });
  assert.match(link.json.code, /^[A-Z2-9]{6}$/);
  const del = await call(port, { method: "POST", path: `/api/connections/${id}/delete`, admin });
  assert.equal(del.status, 200);
  assert.equal(store.listConnections().length, 0);
});

test("A wrong OpenMausBot address is refused with a hint", async () => {
  const { tg, port, admin } = await startApp();
  const r = await call(port, { method: "POST", path: "/api/connections", admin, body: { platform: "telegram", token: tg.token, engineKind: "openmausbot", endpoint: "http://127.0.0.1:1/x", apiKey: "bak_x" } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /hooks\/api\/bots/);
});

test("Shutdown needs the admin token or the launcher's own token", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const dir = mkdtempSync(join(tmpdir(), "limix-web-"));
  const store = new Store(dir), secrets = new SecretStore(dir), pairing = new PairingStore(dir);
  const gateway = new Gateway({ store, secrets, pairing });
  let stopped = 0;
  const probe = createApp({ store, secrets, pairing, gateway, port: 0 });
  await new Promise((r) => probe.server.listen(0, "127.0.0.1", r));
  const port = probe.server.address().port;
  probe.server.close();
  const app = createApp({ store, secrets, pairing, gateway, port, onShutdown: () => stopped++, launcherToken: "launcher-secret-123" });
  await new Promise((r) => app.server.listen(port, "127.0.0.1", r));
  cleanups.push(() => app.server.close());
  const post = (headers) => new Promise((resolve) => {
    const req = request({ host: "127.0.0.1", port, method: "POST", path: "/api/shutdown", headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.end();
  });
  assert.equal(await post({}), 401);
  assert.equal(await post({ "X-Limix-Launcher": "wrong" }), 401);
  assert.equal(await post({ "X-Limix-Launcher": "launcher-secret-123" }), 200);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(stopped, 1);
  assert.equal((await call(port, { path: "/favicon.svg" })).status, 200);
});

test("media settings persist and invalid limits are rejected", async () => {
  const { tg, port, admin, store } = await startApp();
  const added = await call(port, { method: "POST", path: "/api/connections", admin, body: { platform: "telegram", token: tg.token } });
  const id = added.json.connection.id;
  const path = `/api/connections/${id}/media`;
  assert.equal((await call(port, { method: "POST", path, admin, body: { maxCount: 99 } })).status, 400);
  assert.equal((await call(port, { method: "POST", path, admin, body: { receive: false, kinds: ["image"], maxBytes: 1048576, maxCount: 1 } })).status, 200);
  assert.equal(store.getConnection(id).media.receive, false);
  assert.deepEqual(store.getConnection(id).media.kinds, ["image"]);
});

test("gateway UI compiles and includes Page setup and media controls", async () => {
  const { page } = await startApp();
  const script = page.text.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(page.text, /Facebook Fanpage/); assert.match(page.text, /mediaForm/);
});

test("Page webhook verifies signature and challenge, then persists dedup before dispatch", async () => {
  const { port, store, secrets, gateway } = await startApp();
  const secret = "a".repeat(32), verify = "verify-token-123456789";
  const conn = store.addConnection({ platform: "facebook", pageId: "123", ownerIds: ["u"], appSecretRef: secrets.put(secret), verifyTokenRef: secrets.put(verify) });
  let turns = 0;
  gateway.active.set(conn.id, { channel: { maxLength: 2000, typing() {}, sendText: async () => ({ id: "sent" }) }, engine: { send: async () => { turns++; return { reply: "Hello", thread: "t" }; } } });
  const path = `/hooks/facebook/${conn.id}`;
  const challenge = await call(port, { path: `${path}?hub.mode=subscribe&hub.verify_token=${verify}&hub.challenge=hello`, host: "public.example.com" });
  assert.equal(challenge.status, 200); assert.equal(challenge.text, "hello");
  assert.equal((await call(port, { path: `${path}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=hello` })).status, 403);
  const body = { object: "page", entry: [{ id: "123", messaging: [{ sender: { id: "u" }, recipient: { id: "123" }, message: { mid: "m1", text: "hello" } }] }] };
  assert.equal((await call(port, { method: "POST", path, body })).status, 403);
  assert.equal(turns, 0);
  const headers = { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex") };
  assert.equal((await call(port, { method: "POST", path, body, headers })).status, 200);
  assert.equal((await call(port, { method: "POST", path, body, headers })).status, 200);
  await until(() => turns === 1); assert.equal(store.state.inbox.filter((e) => e.eventId === "m1").length, 1);
  assert.equal((await call(port, { path: "/api/state", host: "public.example.com" })).status, 421);
});
