import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { mediaPolicy, downloadMedia, receiveMedia, checkMedia } from "../src/media.mjs";
import { TelegramChannel, telegramAttachments } from "../src/channels/telegram.mjs";
import { DiscordChannel } from "../src/channels/discord.mjs";
import { ZaloChannel } from "../src/channels/zalo.mjs";
import { FacebookChannel, facebookEvents, validFacebookSignature } from "../src/channels/facebook.mjs";
import { PublicMedia } from "../src/public-media.mjs";
import { Router } from "../src/router.mjs";

const item = { kind: "image", mime: "image/png", name: "photo.png", size: 3, data: Buffer.from("png").toString("base64") };
const event = { eventId: "m1", chatId: "chat", chatType: "private", senderId: "owner", attachments: [{ kind: "image", fileId: "photo", size: 3 }] };
function fixture(overrides = {}) {
  const sent = [], received = [], downloads = [], uploads = [];
  const conn = { id: "conn", platform: "telegram", ownerIds: ["owner"], allowedIds: [], accessPolicy: "owner_only", ...overrides };
  const store = { getThread: () => undefined, setThread() {}, log() {}, updateConnection() {} };
  const channel = { maxLength: 4096, typing() {}, sendText: async (_id, text, context) => sent.push({ text, context }), downloadAttachment: async (a) => { downloads.push(a); return item; }, sendAttachment: async (_id, a) => { uploads.push(a); return { message_id: "out" }; } };
  const engine = { send: async (body) => { received.push(body); return { thread: "t", reply: "Done", attachments: [item] }; } };
  return { conn, channel, engine, event, router: new Router({ store }), sent, received, downloads, uploads };
}

test("authorized media-only message reaches the engine and sends its attachment", async () => {
  const f = fixture();
  assert.equal(await f.router.process(f), "replied");
  assert.equal(f.downloads.length, 1); assert.equal(f.received[0].owner, true);
  assert.equal(f.received[0].attachments[0].data, item.data); assert.equal(f.uploads.length, 1);
});
test("unknown senders, disabled receive and oversized media never download", async () => {
  for (const overrides of [{ ownerIds: [] }, { media: { receive: false } }, { media: { maxBytes: 1024 } }]) {
    const f = fixture(overrides); f.event = { ...event, attachments: [{ ...event.attachments[0], size: 2048 }] };
    await f.router.process(f); assert.equal(f.downloads.length, 0); assert.equal(f.received.length, 0);
  }
});
test("revocation while queued blocks downloading and engine access", async () => {
  const f = fixture({ ownerIds: [] });
  assert.equal(await f.router.runTurn({ ...f, text: "hello", sessionKey: "s" }), "declined");
  assert.equal(f.downloads.length, 0);
});
test("partial outgoing failure does not repeat files already accepted", async () => {
  const f = fixture(); let attempts = 0;
  f.engine.send = async () => ({ reply: "", attachments: [item, item, item] });
  f.channel.sendAttachment = async () => { if (++attempts === 2) throw new Error("timeout"); return { id: "first" }; };
  assert.equal(await f.router.process(f), "media_partial"); assert.equal(attempts, 2);
  assert.match(f.sent.at(-1).text, /1\/3/);
});
test("disabled sending retains text but never uploads", async () => {
  const f = fixture({ media: { send: false } });
  assert.equal(await f.router.process(f), "media_blocked"); assert.equal(f.uploads.length, 0); assert.equal(f.sent[0].text, "Done");
});
test("group mention and topic are preserved, guests never become owners", async () => {
  const f = fixture({ accessPolicy: "open" });
  f.event = { ...event, chatType: "group", topicId: 42, mentionedBot: true };
  assert.equal(await f.router.process(f), "replied"); assert.equal(f.received[0].owner, false); assert.equal(f.sent[0].context.topicId, 42);
});
test("media download rejects local URLs, userinfo, lookalikes, redirects and oversized streams", async () => {
  let calls = 0;
  for (const url of ["http://api.telegram.org/a", "https://127.0.0.1/a", "https://api.telegram.org.evil.com/a", "https://secret@api.telegram.org/a"]) {
    await assert.rejects(downloadMedia(url, { hosts: ["api.telegram.org"], maxBytes: 5, fetchImpl: () => { calls++; } }));
  }
  assert.equal(calls, 0);
  await assert.rejects(downloadMedia("https://api.telegram.org/a", { hosts: ["api.telegram.org"], maxBytes: 5, fetchImpl: async (_url, opts) => { assert.equal(opts.redirect, "error"); return new Response("123456"); } }));
});
test("actual MIME and bytes cannot bypass kind or size settings", async () => {
  await assert.rejects(receiveMedia({ downloadAttachment: async () => item }, [{ kind: "file" }], mediaPolicy({ kinds: ["file"] })));
  assert.throws(() => checkMedia([{ ...item, size: 0, data: Buffer.alloc(2048).toString("base64") }], mediaPolicy({ maxBytes: 1024 }), "send"));
  assert.throws(() => mediaPolicy({ maxCount: 100 }));
});
test("Telegram picks largest photo, preserves voice and uploads binary multipart", async () => {
  assert.equal(telegramAttachments({ photo: [{ file_id: "small" }, { file_id: "large" }] })[0].fileId, "large");
  assert.equal(telegramAttachments({ voice: { file_id: "voice" } })[0].mime, "audio/ogg");
  const channel = new TelegramChannel({ token: "token", fetchImpl: async (url, opts) => {
    assert.match(url, /sendPhoto$/); assert.ok(opts.body instanceof FormData); assert.equal(opts.body.get("message_thread_id"), "42");
    assert.equal(await opts.body.get("photo").text(), "png");
    return Response.json({ ok: true, result: { message_id: 1 } });
  } });
  await channel.sendAttachment("chat", item, { topicId: 42 });
});
test("Discord uploads with mentions disabled and normalizes received attachments", async () => {
  const channel = new DiscordChannel({ token: "token", fetchImpl: async (_url, opts) => {
    assert.deepEqual(JSON.parse(opts.body.get("payload_json")).allowed_mentions, { parse: [] });
    assert.equal(await opts.body.get("files[0]").text(), "png"); return Response.json({ id: "sent" });
  } });
  channel.onMessage({ id: "m", channel_id: "c", author: { id: "u" }, attachments: [{ url: "https://cdn.discordapp.com/a", filename: "a.mp4", content_type: "video/mp4", size: 5 }] });
  assert.equal(channel.queue[0].attachments[0].kind, "video"); await channel.sendAttachment("chat", item);
});
test("Zalo rejects voice in groups and non-AAC before publishing", async () => {
  const channel = new ZaloChannel({ token: "token" });
  await assert.rejects(channel.sendAttachment("group", { ...item, kind: "audio", mime: "audio/aac" }, { chatType: "group" }));
  await assert.rejects(channel.sendAttachment("dm", { ...item, kind: "audio", mime: "audio/mpeg" }, { chatType: "private" }));
});
test("Facebook verifies raw signature, page isolation and ignores echo", () => {
  const raw = Buffer.from('{"object":"page"}');
  const sig = "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex");
  assert.equal(validFacebookSignature(raw, sig, "secret"), true); assert.equal(validFacebookSignature(Buffer.from("tampered"), sig, "secret"), false);
  assert.equal(validFacebookSignature(raw, "", "secret"), false);
  const m = { sender: { id: "user" }, recipient: { id: "123" }, message: { mid: "mid", attachments: [{ type: "image", payload: { url: "https://scontent.fbcdn.net/a" } }] } };
  const body = { object: "page", entry: [{ id: "123", messaging: [m, { ...m, message: { ...m.message, is_echo: true } }] }] };
  assert.equal(facebookEvents(body, "123").length, 1); assert.equal(facebookEvents(body, "999").length, 0);
});
test("Facebook sends Page response without putting token in URL", async () => {
  const channel = new FacebookChannel({ token: "secret", pageId: "123", fetchImpl: async (url, opts) => {
    assert.equal(url, "https://graph.facebook.com/v22.0/123/messages");
    assert.equal(opts.headers.Authorization, "Bearer secret"); assert.equal(JSON.parse(opts.body).messaging_type, "RESPONSE"); return Response.json({ message_id: "m" });
  } });
  await channel.sendText("user", "Hello");
});
test("published media is bounded, unguessable, expires and never serves a path", () => {
  let now = 0; const media = new PublicMedia(() => now);
  const url = media.publish("https://bots.example.com", item);
  assert.match(url, /\/hooks\/limix-media\/[a-f0-9]{64}\.bin$/);
  const out = { writeHead(status) { this.status = status; }, end(bytes) { this.bytes = bytes; } };
  media.serve({ method: "GET" }, out, new URL(url).pathname); assert.equal(out.status, 200); assert.equal(out.bytes.toString(), "png");
  now = 300001; media.serve({ method: "GET" }, out, new URL(url).pathname); assert.equal(out.status, 404);
  media.serve({ method: "GET" }, out, "/hooks/limix-media/../../secret"); assert.equal(out.status, 404);
});
