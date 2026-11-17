import assert from "node:assert/strict";
import { test } from "node:test";

import { DiscordChannel } from "../src/channels/discord.mjs";

class FakeSocket {
  static last = null;
  constructor(url) { this.url = url; this.sent = []; FakeSocket.last = this; queueMicrotask(() => this.emit({ op: 10, d: { heartbeat_interval: 60000 } })); }
  send(text) { this.sent.push(JSON.parse(text)); }
  close(code = 1000) { this.onclose?.({ code }); }
  emit(packet) { this.onmessage?.({ data: JSON.stringify(packet) }); }
}

function channel(extra = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.endsWith("/users/@me")) return new Response(JSON.stringify({ id: "900", username: "limixbot", global_name: "Limix" }), { status: 200 });
    return new Response(null, { status: 204 });
  };
  const ch = new DiscordChannel({ token: "TKN", fetchImpl, WebSocketImpl: FakeSocket, pollTimeoutSec: 1, ...extra });
  return { ch, calls };
}

test("Discord: identifies with the three intents and hands over a direct message", async () => {
  const { ch } = channel();
  const pending = ch.fetchUpdates(undefined);
  await new Promise((r) => setTimeout(r, 20));
  const ws = FakeSocket.last;
  const identify = ws.sent.find((p) => p.op === 2);
  assert.equal(identify.d.token, "TKN");
  assert.equal(identify.d.intents, 512 + 4096 + 32768);
  ws.emit({ op: 0, s: 1, t: "READY", d: { session_id: "s", user: { id: "900" } } });
  ws.emit({ op: 0, s: 2, t: "MESSAGE_CREATE", d: { id: "1", channel_id: "55", author: { id: "7", username: "an" }, content: "xin chào" } });
  const { events } = await pending;
  assert.deepEqual(events, [{ eventId: "1", chatId: "55", chatType: "private", senderId: "7", senderName: "an", text: "xin chào", attachments: [], mentionedBot: undefined, replyToBot: false }]);
  ch.close();
});

test("Discord: ignores bots and itself, marks server messages as group", async () => {
  const { ch } = channel();
  const pending = ch.fetchUpdates(undefined);
  await new Promise((r) => setTimeout(r, 20));
  const ws = FakeSocket.last;
  ws.emit({ op: 0, s: 1, t: "READY", d: { session_id: "s", user: { id: "900" } } });
  ws.emit({ op: 0, s: 2, t: "MESSAGE_CREATE", d: { id: "2", channel_id: "5", author: { id: "8", bot: true }, content: "bot" } });
  ws.emit({ op: 0, s: 3, t: "MESSAGE_CREATE", d: { id: "3", channel_id: "5", guild_id: "g", author: { id: "9", username: "bo" }, content: "hi" } });
  const { events } = await pending;
  assert.equal(events.length, 1);
  assert.equal(events[0].chatType, "group");
  ch.close();
});

test("Discord: reply and getMe go through the REST API with the bot token; mentions are not parsed", async () => {
  const { ch, calls } = channel();
  assert.deepEqual(await ch.getMe(), { id: "900", username: "limixbot", name: "Limix" });
  await ch.sendText("55", "ok");
  const post = calls.find((c) => c.method === "POST");
  assert.equal(post.auth, "Bot TKN");
  assert.match(post.url, /\/channels\/55\/messages$/);
  assert.deepEqual(post.body, { content: "ok", allowed_mentions: { parse: [] } });
});

test("Discord: a missing Message Content intent is explained in Vietnamese", async () => {
  const { ch } = channel();
  const pending = ch.fetchUpdates(undefined);
  await new Promise((r) => setTimeout(r, 20));
  FakeSocket.last.close(4014);
  await assert.rejects(pending, /Message Content Intent/);
});

test("Discord: a wrong token (close 4004) stops with credential_invalid", async () => {
  const { ch } = channel();
  const pending = ch.fetchUpdates(undefined);
  await new Promise((r) => setTimeout(r, 20));
  FakeSocket.last.close(4004);
  await assert.rejects(pending, (e) => e.code === "credential_invalid");
});
