import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

import { PASS } from "../routes/table.ts";
import { discordAdapter, type SocketLike } from "./discord.ts";
import { ChannelError, createBotChannels, type ChannelAdapter, type ChannelIo, type ChannelLogin } from "./engine.ts";
import { facebookAdapter } from "./facebook.ts";
import { zaloAdapter, zaloLogin, type ZaloClient } from "./zalo.ts";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0)) stop(); });
const until = async (check: () => boolean) => { for (let i = 0; i < 300 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 10)); expect(check()).toBe(true); };

function host(adapter: ChannelAdapter, logins?: Partial<Record<ChannelAdapter["kind"], ChannelLogin>>) {
  const dir = mkdtempSync(join(tmpdir(), "limix-ch-"));
  const asks: Array<{ text: string; threadId?: string; owner: boolean }> = [];
  const channels = createBotChannels({
    dataDir: dir, adapters: [adapter], ...(logins ? { logins } : {}), sleep: async () => {},
    botExists: (id) => id === "b1", manageRefusal: () => null,
    ask: async (_botId, input) => { asks.push({ text: input.text, ...(input.threadId ? { threadId: input.threadId } : {}), owner: input.owner }); return { threadId: `t${asks.length}`, reply: `ok: ${input.text}` }; },
  });
  channels.start();
  cleanups.push(() => { channels.stop(); rmSync(dir, { recursive: true, force: true }); });
  const route = async (method: string, path: string, body?: unknown) => {
    let status = 0, answer: any;
    const json = ((_res: unknown, code: number, value: unknown) => { status = code; answer = value; }) as never;
    const result = await channels.routes({ req: {} as never, res: {} as never, url: new URL(`http://x${path}`), path, method, auth: { scopes: ["admin"] } as never, json, readBody: (async () => body) as never });
    return result === PASS ? null : { status, body: answer };
  };
  return { asks, route };
}

/** A channel whose incoming messages the test hands in and whose sends it records. */
function fakeChannel(options: { quiet?: boolean; failFirstSends?: number } = {}) {
  const sent: Array<{ chatId: string; text: string }> = [];
  let io: ChannelIo | undefined;
  let failures = options.failFirstSends ?? 0;
  const adapter: ChannelAdapter = {
    kind: "discord", label: "Fake", textMax: 12, ...(options.quiet ? { quietToStrangers: true } : {}),
    check: async (secret) => { if (secret !== "good-secret") throw new ChannelError("auth", "bad secret"); return { username: "fake", name: "Fake" }; },
    open: async (_secret, given) => {
      io = given;
      return {
        done: new Promise((resolve) => given.signal.addEventListener("abort", () => resolve(), { once: true })),
        send: async (chatId, text) => { if (failures-- > 0) throw new ChannelError("retry", "busy", 1); sent.push({ chatId, text }); },
      };
    },
  };
  const deliver = (id: string, from: string, text: string, direct = true, chatId = direct ? from : "room") => io!.deliver({ id, chatId, from: { id: from, name: from }, text, direct });
  return { adapter, sent, deliver, ready: () => Boolean(io) };
}

it("drops a repeated message, retries a busy send, and answers a group as a guest even when the owner writes there", async () => {
  const fake = fakeChannel({ failFirstSends: 2 });
  const { asks, route } = host(fake.adapter);
  expect((await route("POST", "/api/bots/b1/discord", { token: "bad" }))!.status).toBe(400);
  await route("POST", "/api/bots/b1/discord", { token: "good-secret" });
  await until(fake.ready);
  const { code } = (await route("POST", "/api/bots/b1/discord/link"))!.body as { code: string };
  fake.deliver("1", "boss", `/link ${code}`);
  await until(() => fake.sent.map((m) => m.text).join(" ").includes("Đã liên kết"));
  const linkedPieces = fake.sent.length;
  fake.deliver("2", "boss", "xin chào bạn");
  fake.deliver("2", "boss", "xin chào bạn");
  await until(() => fake.sent.length >= linkedPieces + 2);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(fake.sent.slice(linkedPieces).map((m) => m.text)).toEqual(["ok: xin", "chào bạn"]);
  fake.deliver("3", "boss", "trong nhóm", false);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(asks).toEqual([{ text: "xin chào bạn", owner: true }]);
  await route("POST", "/api/bots/b1/discord", { access: "everyone" });
  fake.deliver("4", "boss", "trong nhóm", false);
  fake.deliver("5", "khach", "cũng trong nhóm", false);
  await until(() => asks.length === 3);
  expect(asks.slice(1)).toEqual([{ text: "trong nhóm", owner: false }, { text: "cũng trong nhóm", owner: false }]);
});

it("stays silent to strangers on an account that is also someone's inbox", async () => {
  const fake = fakeChannel({ quiet: true });
  const { route } = host(fake.adapter);
  await route("POST", "/api/bots/b1/discord", { token: "good-secret" });
  await until(fake.ready);
  fake.deliver("1", "stranger", "hello");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(fake.sent).toEqual([]);
});

it("connects Discord through the Gateway and answers a direct message and a mention, never pinging anyone", async () => {
  const sockets: Array<SocketLike & { emit(event: string, ...args: unknown[]): void; sent: string[] }> = [];
  const openSocket = () => {
    const listeners = new Map<string, Array<(...args: any[]) => void>>();
    const socket = {
      sent: [] as string[],
      on: (event: string, listener: (...args: any[]) => void) => { listeners.set(event, [...(listeners.get(event) ?? []), listener]); return socket; },
      emit: (event: string, ...args: unknown[]) => { for (const listener of listeners.get(event) ?? []) listener(...args); },
      send: (data: string) => { socket.sent.push(data); },
      close: (code = 1000) => socket.emit("close", code),
    };
    sockets.push(socket as never);
    return socket as never;
  };
  const posts: Array<{ path: string; body: any }> = [];
  const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("https://discord.com/api/v10", "");
    if (path === "/users/@me") return Response.json({ id: "99", username: "shopbot", bot: true });
    posts.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null });
    return Response.json({ id: "m" });
  });
  const { asks, route } = host(discordAdapter({ fetch: fetch as unknown as typeof globalThis.fetch, openSocket, sleep: async () => {} }));
  await route("POST", "/api/bots/b1/discord", { token: "x".repeat(70) });
  await route("POST", "/api/bots/b1/discord", { access: "everyone" });
  await until(() => sockets.length === 1);
  const gateway = sockets[0]!;
  gateway.emit("message", JSON.stringify({ op: 10, d: { heartbeat_interval: 60_000 } }));
  expect(JSON.parse(gateway.sent[0]!)).toMatchObject({ op: 2, d: { token: "x".repeat(70), intents: 4608 } });
  gateway.emit("message", JSON.stringify({ op: 0, s: 1, t: "READY", d: { user: { id: "99" }, session_id: "s1", resume_gateway_url: "wss://resume.test" } }));
  gateway.emit("message", JSON.stringify({ op: 0, s: 2, t: "MESSAGE_CREATE", d: { id: "1", channel_id: "dm1", author: { id: "7", username: "ana" }, content: "@everyone xin chào" } }));
  gateway.emit("message", JSON.stringify({ op: 0, s: 3, t: "MESSAGE_CREATE", d: { id: "2", guild_id: "g", channel_id: "c1", author: { id: "8", username: "binh" }, content: "không gọi bot", mentions: [] } }));
  gateway.emit("message", JSON.stringify({ op: 0, s: 4, t: "MESSAGE_CREATE", d: { id: "3", guild_id: "g", channel_id: "c1", author: { id: "8", username: "binh" }, content: "<@99> giá?", mentions: [{ id: "99" }] } }));
  await until(() => posts.filter((post) => post.path.endsWith("/messages")).length === 2);
  expect(asks.map((ask) => ask.text)).toEqual(["@everyone xin chào", "giá?"]);
  expect(posts.find((post) => post.path === "/channels/c1/messages")!.body).toEqual({ content: "ok: giá?", allowed_mentions: { parse: [] } });
  gateway.close(4000);
  await until(() => sockets.length === 2);
  sockets[1]!.emit("message", JSON.stringify({ op: 10, d: { heartbeat_interval: 60_000 } }));
  expect(JSON.parse(sockets[1]!.sent[0]!)).toEqual({ op: 6, d: { token: "x".repeat(70), session_id: "s1", seq: 4 } });
  sockets[1]!.close(4004);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect((await route("GET", "/api/bots/b1/discord"))!.body.error).toContain("Token Discord không còn dùng được");
});

it("reads a Facebook Page's new messages once each and replies in Messenger", async () => {
  let clock = Date.parse("2026-11-18T10:00:00Z");
  const inbox: Array<{ id: string; message: string; from: { id: string; name: string }; created_time: string }> = [];
  const replies: any[] = [];
  const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const at = new URL(String(url));
    if (at.pathname.endsWith("/me") && at.searchParams.get("fields")?.includes("category")) return Response.json({ id: "page1", name: "Shop", category: "Shopping" });
    if (at.pathname.endsWith("/me")) return Response.json({ id: "page1" });
    if (at.pathname.endsWith("/me/conversations")) return Response.json({ data: [{ updated_time: inbox.at(-1)?.created_time ?? "2026-01-01T00:00:00+0000", messages: { data: [...inbox].reverse() } }] });
    replies.push(JSON.parse(String(init?.body)));
    return Response.json({ message_id: "r" });
  });
  const { asks, route } = host(facebookAdapter({ fetch: fetch as unknown as typeof globalThis.fetch, now: () => clock, sleep: (_ms, signal) => new Promise((resolve) => { const timer = setTimeout(resolve, 5); signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }); }) }));
  expect((await route("POST", "/api/bots/b1/facebook", { token: "not-a-page-token" }))!.status).toBe(400);
  await route("POST", "/api/bots/b1/facebook", { token: `EAA${"b".repeat(60)}` });
  await route("POST", "/api/bots/b1/facebook", { access: "everyone" });
  expect((await route("GET", "/api/bots/b1/facebook"))!.body).toMatchObject({ connected: true, name: "Shop" });
  await until(() => fetch.mock.calls.some((call) => String(call[0]).includes("/me/conversations")));
  inbox.push({ id: "old", message: "trước khi kết nối", from: { id: "u1", name: "Lan" }, created_time: "2026-11-18T09:00:00+0000" });
  inbox.push({ id: "m1", message: "còn size M không", from: { id: "u1", name: "Lan" }, created_time: "2026-11-18T10:00:05+0000" });
  inbox.push({ id: "m2", message: "dạ còn ạ", from: { id: "page1", name: "Shop" }, created_time: "2026-11-18T10:00:06+0000" });
  clock += 10_000;
  await until(() => replies.some((reply) => reply.message?.text === "ok: còn size M không"));
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(asks).toEqual([{ text: "còn size M không", owner: false }]);
  expect(replies.find((reply) => reply.message)).toEqual({ recipient: { id: "u1" }, messaging_type: "RESPONSE", message: { text: "ok: còn size M không" } });
});

it("signs Zalo in by QR, answers direct messages and mentions, and reports a session opened elsewhere", async () => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const sends: Array<{ text: string; thread: string; type: number }> = [];
  const api = {
    getOwnId: () => "500", fetchAccountInfo: async () => ({ profile: { displayName: "Shop Zalo" } }),
    sendMessage: async (message: { msg: string }, thread: string, type: number) => { sends.push({ text: message.msg, thread, type }); return {}; },
    sendTypingEvent: async () => ({}),
    listener: { on: (event: string, handler: (...args: any[]) => void) => { handlers.set(event, handler); }, start: () => handlers.get("connected")?.(), stop: () => {} },
  };
  const client: ZaloClient = {
    login: async (credentials: any) => { if (credentials.imei !== "imei-1") throw new Error("expired"); return api as never; },
    loginQR: async (_options, callback) => {
      callback({ type: 0, data: { image: "QRDATA" }, actions: { abort: () => {} } });
      await new Promise((resolve) => setTimeout(resolve, 30));
      callback({ type: 2, data: { display_name: "Shop Zalo" }, actions: { abort: () => {} } });
      callback({ type: 4, data: { cookie: [], imei: "imei-1", userAgent: "UA" }, actions: null });
      return api as never;
    },
  };
  const load = async () => client;
  const { asks, route } = host(zaloAdapter(load), { zalo: zaloLogin(load) });
  expect((await route("POST", "/api/bots/b1/zalo", { token: "{}" }))!.status).toBe(400);
  await route("POST", "/api/bots/b1/zalo/login");
  const started = await route("GET", "/api/bots/b1/zalo");
  expect(started!.body.login.qr).toBe("data:image/png;base64,QRDATA");
  await until(() => handlers.has("message"));
  await route("POST", "/api/bots/b1/zalo", { access: "everyone" });
  expect((await route("GET", "/api/bots/b1/zalo"))!.body).toMatchObject({ connected: true, name: "Shop Zalo", username: "500" });
  const say = (msgId: string, thread: string, type: number, content: string, mentions?: unknown[]) =>
    handlers.get("message")!({ type, threadId: thread, isSelf: false, data: { msgId, uidFrom: "42", dName: "Hoa", content, ...(mentions ? { mentions } : {}) } });
  say("1", "42", 0, "chào shop");
  say("2", "g9", 1, "nói chuyện riêng trong nhóm");
  say("3", "g9", 1, "@Shop Zalo giá bao nhiêu", [{ uid: "500", pos: 0, len: 10 }]);
  await until(() => sends.length === 2);
  expect(asks.map((ask) => ask.text)).toEqual(["chào shop", "giá bao nhiêu"]);
  expect(sends).toEqual([{ text: "ok: chào shop", thread: "42", type: 0 }, { text: "ok: giá bao nhiêu", thread: "g9", type: 1 }]);
  handlers.get("closed")!(3000, "duplicate");
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect((await route("GET", "/api/bots/b1/zalo"))!.body.error).toContain("mở ở nơi khác");
});

it("queues personal Messenger replies for the desktop window and answers everyone there as a guest", async () => {
  const { messengerBridge } = await import("./messenger.ts");
  const bridge = messengerBridge({ manageRefusal: () => null });
  const { asks, route } = host(bridge.adapter);
  const call = async (method: string, path: string, body?: unknown) => {
    let status = 0, answer: any;
    const json = ((_res: unknown, code: number, value: unknown) => { status = code; answer = value; }) as never;
    await bridge.routes({ req: {} as never, res: {} as never, url: new URL(`http://x${path}`), path, method, auth: { scopes: ["admin"] } as never, json, readBody: (async () => body) as never });
    return { status, body: answer };
  };
  expect((await route("POST", "/api/bots/b1/messenger", { token: JSON.stringify({ uid: "x" }) }))!.status).toBe(400);
  expect((await route("POST", "/api/bots/b1/messenger", { token: JSON.stringify({ uid: "100045", name: "" }) }))!.body).toMatchObject({ connected: true, access: "everyone" });
  for (let i = 0; i < 50 && !(await call("GET", "/api/messenger/bots")).body.bots.length; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  await call("POST", "/api/bots/b1/messenger/inbox", { messages: [{ id: "t1:1", chatId: "t1", name: "Lan", text: "/link ABC123" }, { id: "t1:2", chatId: "t1", name: "Lan", text: "còn hàng không" }] });
  const outbox = await call("GET", "/api/bots/b1/messenger/outbox");
  expect(outbox.body.items).toEqual([{ id: 1, chatId: "t1", text: "ok: còn hàng không" }]);
  expect(asks).toEqual([{ text: "còn hàng không", owner: false }]);
  expect((await call("POST", "/api/bots/b1/messenger/sent", { id: 1 })).body).toEqual({ ok: true });
});
