import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

import { createLimixTelegram, telegramChunks } from "./limix-telegram.ts";
import { PASS } from "./routes/table.ts";

const TOKEN = "123456789:AAH_fake_token_fake_token_fake_tok";
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0)) stop(); });

/** A fake Telegram: getMe, getUpdates handing out queued updates, and every sendMessage kept. */
function fakeTelegram() {
  const queue: unknown[] = [];
  const sent: Array<{ chat_id: number; text: string }> = [];
  let updateId = 0;
  const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const method = String(url).split("/").pop();
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (!String(url).includes(`/bot${TOKEN}/`)) return Response.json({ ok: false, description: "Unauthorized" }, { status: 401 });
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
  const say = (from: number, text: string, name = "Ana") => queue.push({ message_id: Date.now(), chat: { id: from, type: "private" }, from: { id: from, is_bot: false, first_name: name }, text });
  return { fetch, sent, say };
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "limix-tg-"));
  const tg = fakeTelegram();
  const asks: Array<{ botId: string; text: string; threadId?: string; owner: boolean }> = [];
  const telegram = createLimixTelegram({
    dataDir: dir, apiBase: "https://telegram.test", fetch: tg.fetch as unknown as typeof fetch,
    botExists: (id) => id === "b1", manageRefusal: (auth) => (auth.scopes.includes("admin") ? null : "no"),
    ask: async (botId, input) => { asks.push({ botId, text: input.text, ...(input.threadId ? { threadId: input.threadId } : {}), owner: input.owner }); return { threadId: input.threadId ?? `t${asks.length}`, reply: `Đã nhận: ${input.text}` }; },
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
  await route("POST", "/api/bots/b1/telegram", { enabled: false });
  expect((await route("GET", "/api/bots/b1/telegram")).body).toMatchObject({ enabled: false });
  expect((await route("DELETE", "/api/bots/b1/telegram")).body).toEqual({ connected: false });
});

it("splits a long reply at paragraph and word boundaries to fit Telegram", () => {
  const long = `${"a ".repeat(3000)}\n\n${"b ".repeat(1000)}`;
  const parts = telegramChunks(long);
  expect(parts.every((part) => part.length <= 4096)).toBe(true);
  expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long.trim().replace(/\s+/g, " "));
});
