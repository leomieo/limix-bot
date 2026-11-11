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

function call(port, { method = "GET", path = "/", host, admin, body }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = request({ host: "127.0.0.1", port, method, path, headers: {
      Host: host ?? `127.0.0.1:${port}`, ...(admin ? { "X-Limix-Admin": admin } : {}),
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
  return { tg, omb, store, gateway, port, admin, page };
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
