import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { OpenMausBotEngine, EchoEngine } from "../src/engines/openmausbot.mjs";
import { Gateway, defaultMakeChannel } from "../src/gateway.mjs";
import { PairingStore, hashCode } from "../src/pairing.mjs";
import { SecretStore } from "../src/secrets.mjs";
import { Store } from "../src/store.mjs";
import { TEXT } from "../src/router.mjs";
import { fakeOpenMausBot, fakeTelegram, fakeZalo, until } from "./fakes.mjs";

const cleanups = [];
after(() => cleanups.forEach((f) => f()));

const OWNER = { id: 1001, name: "Chủ" };
const STRANGER = { id: 2002, name: "Lạ" };

function harness({ tg, zl, omb, dataDir = mkdtempSync(join(tmpdir(), "limix-gw-")) }) {
  const store = new Store(dataDir);
  const secrets = new SecretStore(dataDir);
  const pairing = new PairingStore(dataDir);
  const makeChannel = (conn, token) => defaultMakeChannel(conn, token, {
    telegram: { apiBase: tg?.base, pollTimeoutSec: 1 },
    zalo: { apiBase: zl?.base, pollTimeoutSec: 1 },
  });
  const makeEngine = (conn, sec) => conn.engine?.kind === "openmausbot"
    ? new OpenMausBotEngine({ endpoint: conn.engine.endpoint, apiKey: sec.get(conn.engine.keyRef), pollMs: 20, waitSeconds: 1 })
    : new EchoEngine();
  const gateway = new Gateway({ store, secrets, pairing, makeChannel, makeEngine });
  const add = (platform, token, extra = {}) => store.addConnection({
    platform, name: platform, botIdentity: { id: "1", username: "b", name: "Bot" },
    tokenRef: secrets.put(token), accessPolicy: "pairing",
    engine: omb ? { kind: "openmausbot", endpoint: omb.endpoint, keyRef: secrets.put(omb.key) } : { kind: "echo" },
    ...extra,
  });
  cleanups.push(() => gateway.stopAll());
  return { store, secrets, pairing, gateway, add, dataDir, makeChannel, makeEngine };
}

test("Telegram: owner links, chats through OpenMausBot, keeps the thread, ignores a duplicate update", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const omb = await fakeOpenMausBot(); cleanups.push(omb.close);
  const h = harness({ tg, omb });
  const conn = h.add("telegram", tg.token);
  h.store.setLinkCode(conn.id, hashCode("ABC234"), Date.now() + 60_000);
  h.gateway.start(conn.id);

  tg.push(OWNER, "/link ABC234");
  await until(() => tg.state.sent.some((s) => s.text === TEXT.linked));
  assert.deepEqual(h.store.getConnection(conn.id).ownerIds, ["1001"]);

  const id = tg.push(OWNER, "Xin chào");
  await until(() => tg.state.sent.some((s) => s.text === "Bot: Xin chào"));
  tg.push(OWNER, "Câu thứ hai");
  await until(() => tg.state.sent.some((s) => s.text === "Bot: Câu thứ hai"));
  assert.equal(omb.state.calls[0].thread, undefined);
  assert.equal(omb.state.calls[1].thread, "t1", "second message continues the same thread");

  tg.push(OWNER, "Xin chào", { sameIdAs: id });
  h.store.setCursor(conn.id, id);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(omb.state.calls.length, 2, "a repeated update is not sent to the AI again");

  tg.push(OWNER, "/new");
  await until(() => tg.state.sent.some((s) => s.text === TEXT.newSession));
  tg.push(OWNER, "Mới");
  await until(() => omb.state.calls.length === 3);
  assert.equal(omb.state.calls[2].thread, undefined, "/new starts a fresh thread");
});

test("Telegram: a stranger gets a pairing code, never reaches the AI, and the owner approves by chat", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const omb = await fakeOpenMausBot(); cleanups.push(omb.close);
  const h = harness({ tg, omb });
  const conn = h.add("telegram", tg.token, { ownerIds: ["1001"] });
  h.gateway.start(conn.id);

  tg.push(STRANGER, "cho tôi dùng với");
  await until(() => tg.state.sent.some((s) => s.chatId === "2002" && s.text.startsWith("Mã ghép cặp")));
  assert.equal(omb.state.calls.length, 0);
  const code = /: ([A-Z2-9]{8})/.exec(tg.state.sent.find((s) => s.chatId === "2002").text)[1];

  tg.push(STRANGER, "/approve " + code);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(h.store.getConnection(conn.id).allowedIds.length, 0, "a stranger cannot approve themself");

  tg.push(OWNER, "/approve " + code);
  await until(() => h.store.getConnection(conn.id).allowedIds.includes("2002"));
  await until(() => tg.state.sent.some((s) => s.chatId === "2002" && s.text === TEXT.approvedYou));
  tg.push(STRANGER, "giờ được chưa");
  await until(() => tg.state.sent.some((s) => s.text === "Bot: giờ được chưa"));
});

test("Telegram: group messages are ignored; non-text gets a clear answer", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const omb = await fakeOpenMausBot(); cleanups.push(omb.close);
  const h = harness({ tg, omb });
  const conn = h.add("telegram", tg.token, { ownerIds: ["1001"] });
  h.gateway.start(conn.id);
  tg.push(OWNER, "trong nhóm", { chatType: "supergroup", chatId: -500 });
  tg.push(OWNER, undefined);
  await until(() => tg.state.sent.some((s) => s.text === TEXT.textOnly));
  assert.equal(omb.state.calls.length, 0);
  assert.ok(!tg.state.sent.some((s) => s.chatId === "-500"));
});

test("Telegram: a bot that has a webhook is not taken over", async () => {
  const tg = await fakeTelegram({ webhookUrl: "https://other.example.com/hook" }); cleanups.push(tg.close);
  const h = harness({ tg });
  const conn = h.add("telegram", tg.token);
  h.gateway.start(conn.id);
  await until(() => h.store.getConnection(conn.id).status === "conflict");
  assert.ok(!tg.state.calls.includes("getUpdates"));
  assert.ok(!tg.state.calls.includes("deleteWebhook"));
});

test("Telegram: a 409 while polling stops the consumer instead of fighting", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const h = harness({ tg });
  const conn = h.add("telegram", tg.token);
  h.gateway.start(conn.id);
  await until(() => h.store.getConnection(conn.id).status === "running");
  tg.state.conflict = true;
  await until(() => h.store.getConnection(conn.id).status === "conflict");
  await until(() => !h.gateway.isRunning(conn.id));
});

test("Telegram: a wrong token is reported and nothing is polled", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const h = harness({ tg });
  const conn = h.add("telegram", "999999:WRONGTOKENWRONGTOKENWRONG");
  h.gateway.start(conn.id);
  await until(() => h.store.getConnection(conn.id).status === "credential_invalid");
  assert.ok(!JSON.stringify(h.store.state).includes("WRONGTOKENWRONG"), "the token never lands in state or logs");
});

test("OpenMausBot: a slow answer is polled until ready; an approval stop is explained", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const omb = await fakeOpenMausBot({
    respond: (m) => (m === "lâu" ? { working: 3, final: "Xong rồi" } : m === "duyệt" ? { needsApproval: true } : { reply: "ok" }),
  });
  cleanups.push(omb.close);
  const h = harness({ tg, omb });
  const conn = h.add("telegram", tg.token, { ownerIds: ["1001"] });
  h.gateway.start(conn.id);
  tg.push(OWNER, "lâu");
  await until(() => tg.state.sent.some((s) => s.text === "Xong rồi"));
  assert.ok(tg.state.typing >= 1, "typing indicator is shown");
  tg.push(OWNER, "duyệt");
  await until(() => tg.state.sent.some((s) => s.text === TEXT.needsApproval));
});

test("OpenMausBot: a wrong key is answered politely and logged without the key", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const omb = await fakeOpenMausBot(); cleanups.push(omb.close);
  const h = harness({ tg, omb: { ...omb, key: "bak_wrongwrongwrongwrongwrongwrong" } });
  const conn = h.add("telegram", tg.token, { ownerIds: ["1001"] });
  h.gateway.start(conn.id);
  tg.push(OWNER, "alo");
  await until(() => tg.state.sent.some((s) => s.text === TEXT.engineDown));
  assert.match(h.store.getConnection(conn.id).statusDetail, /Khóa Bot API sai/);
  assert.ok(!JSON.stringify(h.store.state).includes("wrongwrongwrong"));
});

test("Zalo: owner chats; a long reply is split under Zalo's 2000-character limit", async () => {
  const zl = await fakeZalo(); cleanups.push(zl.close);
  const long = Array.from({ length: 400 }, (_, i) => `câu ${i}.`).join(" ");
  const omb = await fakeOpenMausBot({ respond: () => ({ reply: long }) }); cleanups.push(omb.close);
  const h = harness({ zl, omb });
  const conn = h.add("zalo", zl.token, { ownerIds: ["u-owner"] });
  h.gateway.start(conn.id);
  zl.push("u-owner", "kể dài đi");
  await until(() => zl.state.sent.length >= 2);
  await new Promise((r) => setTimeout(r, 100));
  for (const s of zl.state.sent) assert.ok(s.text.length <= 2000);
  assert.equal(omb.state.calls[0].message, "kể dài đi");
  zl.push("u-owner", "", "message.sticker.received");
  await until(() => zl.state.sent.some((s) => s.text === TEXT.textOnly));
});

test("Restart: an event caught mid-processing is not re-run; the sender is asked to resend", async () => {
  const tg = await fakeTelegram(); cleanups.push(tg.close);
  const omb = await fakeOpenMausBot(); cleanups.push(omb.close);
  const dataDir = mkdtempSync(join(tmpdir(), "limix-restart-"));
  const first = harness({ tg, omb, dataDir });
  const conn = first.add("telegram", tg.token, { ownerIds: ["1001"] });
  first.store.acceptEvent({ connectionId: conn.id, eventId: "77", chatId: "1001", senderId: "1001" });
  first.store.markEvent(conn.id, "77", "processing");

  const second = harness({ tg, omb, dataDir });
  second.gateway.start(conn.id);
  await until(() => tg.state.sent.some((s) => s.text === TEXT.interrupted));
  assert.equal(omb.state.calls.length, 0);
  const saved = JSON.parse(readFileSync(join(dataDir, "state.json"), "utf8"));
  assert.equal(saved.inbox.find((e) => e.eventId === "77").state, "interrupted");
});
