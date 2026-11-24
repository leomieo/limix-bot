import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

import { PASS } from "../routes/table.ts";
import { deleteAttachment } from "../attachments.ts";
import { chunkText, createBotChannels } from "./engine.ts";
import { telegramAdapter } from "./telegram.ts";

const TOKEN = `123456789:${randomBytes(27).toString("base64url")}`;
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0)) stop(); });

/** A fake Telegram: getMe, getUpdates handing out queued updates, and every sendMessage kept. */
function fakeTelegram() {
  const queue: unknown[] = [];
  const sent: Array<{ chat_id: number; text: string }> = [];
  const uploads: Array<{ method: string; form: FormData }> = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=", "base64");
  let updateId = 0;
  const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const method = String(url).split("/").pop();
    if (!String(url).includes(`/bot${TOKEN}/`)) return Response.json({ ok: false, description: "Unauthorized" }, { status: 401 });
    if (String(url).includes(`/file/bot${TOKEN}/`)) return new Response(method === "photo.png" ? Uint8Array.from(png) : "fixture");
    if (init?.body instanceof FormData && (method === "sendPhoto" || method === "sendDocument")) {
      uploads.push({ method, form: init.body });
      return Response.json({ ok: true, result: {} });
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (method === "getFile") return Response.json({ ok: true, result: { file_path: body.file_id === "fixture-photo" ? "photos/photo.png" : "documents/report.csv" } });
    if (method === "getMe") return Response.json({ ok: true, result: { id: 1, is_bot: true, first_name: "Shop", username: "shop_bot" } });
    if (method === "sendMessage") { sent.push(body); return Response.json({ ok: true, result: {} }); }
    if (method === "sendChatAction") return Response.json({ ok: true, result: true });
    if (method === "getUpdates") {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const out = queue.splice(0).map((message) => ({ update_id: ++updateId, message }));
      return Response.json({ ok: true, result: out });
    }
    return Response.json({ ok: false }, { status: 404 });
  });
  let messageId = 0;
  const say = (from: number, text: string, name = "Ana") => queue.push({ message_id: ++messageId, chat: { id: from, type: "private" }, from: { id: from, is_bot: false, first_name: name }, text });
  const sayInGroup = (from: number, text: string, name = "Ana") => queue.push({ message_id: ++messageId, chat: { id: -100, type: "group" }, from: { id: from, is_bot: false, first_name: name }, text });
  const attach = (from: number) => queue.push({ message_id: ++messageId, chat: { id: from, type: "private" }, from: { id: from }, document: { file_id: "fixture-id", file_name: "report.csv" } });
  const photo = (from: number) => queue.push({ message_id: ++messageId, chat: { id: from, type: "private" }, from: { id: from }, photo: [{ file_id: "fixture-photo" }] });
  return { fetch, sent, say, sayInGroup, uploads, attach, photo, png };
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "limix-tg-"));
  const tg = fakeTelegram();
  const asks: Array<{ botId: string; text: string; threadId?: string; owner: boolean }> = [];
  const telegram = createBotChannels({
    dataDir: dir, adapters: [telegramAdapter({ apiBase: "https://telegram.test", fetch: tg.fetch as unknown as typeof fetch })],
    botExists: (id) => id === "b1", manageRefusal: (auth) => (auth.scopes.includes("admin") ? null : "no"),
    ask: async (botId, input) => {
      asks.push({ botId, text: input.text, ...(input.threadId ? { threadId: input.threadId } : {}), owner: input.owner });
      if (input.attachment) cleanups.push(() => deleteAttachment(input.attachment!.path));
      return { threadId: input.threadId ?? `t${asks.length}`, reply: `Đã nhận: ${input.text}`, ...(input.attachment ? { attachments: [input.attachment] } : {}) };
    },
  });
  telegram.start();
  cleanups.push(() => { telegram.stop(); rmSync(dir, { recursive: true, force: true }); });
  const route = async (method: string, path: string, body?: unknown, scopes = ["admin"]) => {
    let status = 0, answer: any;
    const json = ((_res: unknown, code: number, value: unknown) => { status = code; answer = value; }) as never;
    const result = await telegram.routes({ req: {} as never, res: {} as never, url: new URL(`http://x${path}`), path, method, auth: { scopes } as never, json, readBody: (async () => body) as never });
    return result === PASS ? { status: 0, body: null } : { status, body: answer };
  };
  return { dir, tg, asks, route };
}

const until = async (check: () => boolean) => { for (let i = 0; i < 300 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 10)); expect(check()).toBe(true); };

it("connects with a @BotFather token, links the owner with a one-time code, and answers the owner in one conversation", async () => {
  const { dir, tg, asks, route } = setup();
  expect((await route("POST", "/api/bots/b1/telegram", { token: "not a token" })).status).toBe(400);
  expect((await route("POST", "/api/bots/b1/telegram", { token: TOKEN }, ["read"])).status).toBe(403);
  const connected = await route("POST", "/api/bots/b1/telegram", { token: TOKEN });
  expect(connected.body).toMatchObject({ connected: true, username: "shop_bot", enabled: true, access: "owner" });
  expect(readFileSync(join(dir, "limix-telegram.json"), "utf8")).not.toContain(TOKEN.split(":")[1]);

  tg.say(7, "chào");
  await until(() => tg.sent.some((m) => m.text.includes("chỉ trả lời chủ bot")));
  expect(asks).toEqual([]);

  const { code } = (await route("POST", "/api/bots/b1/telegram/link")).body as { code: string };
  tg.say(7, "/link WRONG1");
  await until(() => tg.sent.some((m) => m.text.includes("Mã không đúng")));
  tg.say(7, `/link ${code}`);
  await until(() => tg.sent.some((m) => m.text.startsWith("Đã liên kết")));
  expect((await route("GET", "/api/bots/b1/telegram")).body).toMatchObject({ owner: "Ana" });

  tg.say(7, "làm báo cáo");
  await until(() => tg.sent.some((m) => m.text === "Đã nhận: làm báo cáo"));
  tg.say(7, "thêm biểu đồ");
  await until(() => tg.sent.some((m) => m.text === "Đã nhận: thêm biểu đồ"));
  expect(asks).toEqual([{ botId: "b1", text: "làm báo cáo", owner: true }, { botId: "b1", text: "thêm biểu đồ", threadId: "t1", owner: true }]);
  tg.say(7, `/link ${code}`);
  await until(() => tg.sent.filter((m) => m.text.includes("Mã không đúng")).length === 2);
});

it("answers other people only when the owner allows everyone, as a confined caller, each in their own conversation", async () => {
  const { tg, asks, route } = setup();
  await route("POST", "/api/bots/b1/telegram", { token: TOKEN });
  await route("POST", "/api/bots/b1/telegram", { access: "everyone" });
  tg.say(8, "giá bao nhiêu", "Bình");
  await until(() => tg.sent.some((m) => m.chat_id === 8 && m.text === "Đã nhận: giá bao nhiêu"));
  expect(asks).toEqual([{ botId: "b1", text: "giá bao nhiêu", owner: false }]);
  tg.attach(8);
  await until(() => tg.uploads.length === 1);
  const { method, form } = tg.uploads[0]!;
  expect(method).toBe("sendDocument");
  expect(form.get("chat_id")).toBe("8");
  expect(form.get("document")).toBeInstanceOf(File);
  expect(await (form.get("document") as File).text()).toBe("fixture");
  tg.photo(8);
  await until(() => tg.uploads.length === 2);
  const image = tg.uploads[1]!;
  expect(image.method).toBe("sendPhoto");
  expect(Buffer.from(await (image.form.get("photo") as File).arrayBuffer())).toEqual(tg.png);
  await route("POST", "/api/bots/b1/telegram", { enabled: false });
  expect((await route("GET", "/api/bots/b1/telegram")).body).toMatchObject({ enabled: false });
  expect((await route("DELETE", "/api/bots/b1/telegram")).body).toEqual({ connected: false });
});

it("splits a long reply at paragraph and word boundaries to fit Telegram", () => {
  const long = `${"a ".repeat(3000)}\n\n${"b ".repeat(1000)}`;
  const parts = chunkText(long, 4096);
  expect(parts.every((part) => part.length <= 4096)).toBe(true);
  expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long.trim().replace(/\s+/g, " "));
});

it("grants separate private conversations to multiple administrators and revokes one independently", async () => {
  const { tg, asks, route } = setup();
  const path = "/api/bots/b1/telegram";
  await route("POST", path, { token: TOKEN });
  for (const id of [11, 12, 13]) {
    const { code } = (await route("POST", path + "/link")).body;
    tg.say(id, `/link ${code}`);
    await until(() => tg.sent.some(m => m.chat_id === id && m.text.startsWith("Đã liên kết")));
    tg.say(id, "first");
    await until(() => asks.length === id - 10);
  }
  expect(asks.map(a => [a.owner, a.threadId])).toEqual([[true, undefined], [true, undefined], [true, undefined]]);
  expect((await route("GET", path)).body.admins.map((a: { id: string }) => a.id)).toEqual(["12", "13"]);
  expect((await route("POST", path + "/remove-admin", { id: "12" }, ["read"])).status).toBe(403);
  expect((await route("POST", path + "/remove-admin", { id: "12" })).status).toBe(200);
  await route("POST", path, { access: "everyone" });
  tg.say(12, "revoked");
  await until(() => asks.length === 4);
  tg.say(13, "still here");
  await until(() => asks.length === 5);
  expect(asks[3]).toMatchObject({ owner: false });
  expect(asks[3]?.threadId).toBeUndefined();
  expect(asks[4]).toMatchObject({ owner: true, threadId: "t3" });
});
