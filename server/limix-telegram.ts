// Limix Bot: a bot answers on Telegram once its owner pastes the token from @BotFather in the bot's settings. This server
// reads the bot's messages itself (Telegram long polling, no webhook, no address to open) and answers in the same chat.
// The owner links their own Telegram with a one-time code (/link CODE) and then talks to the bot as from the app, at Full
// access, in a conversation of its own; other people are answered only when the owner allows it, through the confined
// Bot API path. Nothing here is reachable from outside: the token is sealed on disk and only this server calls Telegram.
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { writeFileAtomic } from "./atomic.ts";
import type { RequestAuth } from "./request-auth.ts";
import { PASS, type RouteHandler } from "./routes/table.ts";

export const TELEGRAM_TEXT_MAX = 4096;
const LINK_MS = 15 * 60_000;
const POLL_S = 25;
const BACKOFF_MS = [2_000, 5_000, 15_000, 60_000];
const TOKEN = /^\d{5,15}:[\w-]{30,60}$/;

const botSchema = z.object({
  sealed: z.string(),
  username: z.string().default(""),
  name: z.string().default(""),
  enabled: z.boolean().default(true),
  access: z.enum(["owner", "everyone"]).default("owner"),
  owner: z.object({ id: z.number(), name: z.string() }).optional(),
  link: z.object({ hash: z.string(), expiresAt: z.number() }).optional(),
  offset: z.number().default(0),
  chats: z.record(z.string(), z.string()).default({}),
  error: z.string().optional(),
});
const fileSchema = z.object({ v: z.literal(1), bots: z.record(z.string(), botSchema) });
type Stored = z.output<typeof botSchema>;
type FileShape = z.output<typeof fileSchema>;

export interface TelegramView {
  connected: boolean;
  username?: string;
  enabled?: boolean;
  access?: "owner" | "everyone";
  owner?: string;
  linkExpiresAt?: number;
  error?: string;
}

export interface TelegramAsk {
  (botId: string, input: { text: string; threadId?: string; title: string; owner: boolean }): Promise<{ threadId: string; reply: string; status?: "needs_approval" | "working" }>;
}

export interface LimixTelegramDeps {
  dataDir: string;
  ask: TelegramAsk;
  botExists(botId: string): boolean;
  /** May this person change this bot's Telegram? Null when they may, else the reason. */
  manageRefusal(auth: RequestAuth, botId: string): string | null;
  apiBase?: string;
  fetch?: typeof fetch;
  log?(line: string): void;
  now?(): number;
}

const TEXT = {
  start: "Chào bạn! Đây là bot Limix. Nhắn tin để trò chuyện. Chủ bot: gửi /link MÃ để liên kết.",
  linked: "Đã liên kết. Từ giờ bạn nhắn ở đây như nhắn trong app Limix.",
  badCode: "Mã không đúng hoặc đã hết hạn. Tạo mã mới trong app Limix: bot → Cài đặt → Telegram.",
  ownerOnly: "Bot này hiện chỉ trả lời chủ bot.",
  textOnly: "Hiện bot chỉ đọc tin nhắn chữ.",
  fresh: "Đã bắt đầu cuộc trò chuyện mới.",
  approval: "Bot đang chờ bạn duyệt một bước trong app Limix.",
  working: "Bot vẫn đang làm việc này. Xem kết quả trong app Limix.",
  failed: "Bot chưa trả lời được lúc này. Thử lại sau.",
  empty: "Bot đã làm xong nhưng không có câu trả lời bằng chữ.",
} as const;

/** Splits a reply at paragraph, then line, then word boundaries so each piece fits one Telegram message. */
export function telegramChunks(text: string, max = TELEGRAM_TEXT_MAX): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const at = cut > max / 2 ? cut : max;
    out.push(rest.slice(0, at).trimEnd());
    rest = rest.slice(at).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

const hashCode = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");

export function createLimixTelegram(deps: LimixTelegramDeps) {
  const file = join(deps.dataDir, "limix-telegram.json");
  const keyFile = join(deps.dataDir, "limix-telegram.key");
  const base = (deps.apiBase ?? "https://api.telegram.org").replace(/\/$/, "");
  const call = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});
  const loops = new Map<string, AbortController>();
  const chatQueues = new Map<string, Promise<void>>();
  let running = false;

  function read(): FileShape {
    try { const parsed = fileSchema.safeParse(JSON.parse(readFileSync(file, "utf8"))); if (parsed.success) return parsed.data; } catch {}
    return { v: 1, bots: {} };
  }
  function write(data: FileShape) { mkdirSync(dirname(file), { recursive: true }); writeFileAtomic(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 }); }
  function patch(botId: string, change: (entry: Stored) => Stored | null) {
    const data = read();
    const entry = data.bots[botId];
    if (!entry) return;
    const next = change(entry);
    if (next) data.bots[botId] = next; else delete data.bots[botId];
    write(data);
  }
  function key(create: boolean): Buffer | null {
    try { const hex = readFileSync(keyFile, "utf8").trim(); if (/^[0-9a-f]{64}$/.test(hex)) return Buffer.from(hex, "hex"); } catch {}
    if (!create) return null;
    const made = randomBytes(32);
    mkdirSync(dirname(keyFile), { recursive: true });
    writeFileAtomic(keyFile, `${made.toString("hex")}\n`, { mode: 0o600 });
    return made;
  }
  function seal(token: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(true)!, nonce);
    const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString("base64");
  }
  function unseal(sealed: string): string | null {
    const k = key(false);
    if (!k) return null;
    try {
      const data = Buffer.from(sealed, "base64");
      const decipher = createDecipheriv("aes-256-gcm", k, data.subarray(0, 12));
      decipher.setAuthTag(data.subarray(data.length - 16));
      return Buffer.concat([decipher.update(data.subarray(12, data.length - 16)), decipher.final()]).toString("utf8");
    } catch { return null; }
  }

  async function api(token: string, method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<{ ok: boolean; status: number; result?: any; description?: string }> {
    const response = await call(`${base}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), ...(signal ? { signal } : {}) });
    const data = await response.json().catch(() => ({})) as { ok?: boolean; result?: unknown; description?: string };
    return { ok: response.ok && data.ok === true, status: response.status, result: data.result, ...(data.description ? { description: data.description } : {}) };
  }
  const send = (token: string, chatId: number, text: string) => (async () => {
    for (const piece of telegramChunks(text)) await api(token, "sendMessage", { chat_id: chatId, text: piece });
  })().catch((error) => log(`telegram: send failed (${error instanceof Error ? error.message : String(error)})`));

  async function handle(botId: string, token: string, update: any): Promise<void> {
    const message = update?.message;
    if (!message || message.chat?.type !== "private" || !message.from || message.from.is_bot) return;
    const chatId: number = message.chat.id, from: { id: number; first_name?: string; last_name?: string; username?: string } = message.from;
    const who = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || String(from.id);
    const text: string = typeof message.text === "string" ? message.text : typeof message.caption === "string" ? message.caption : "";
    const entry = read().bots[botId];
    if (!entry) return;
    const command = /^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/s.exec(text.trim());
    if (command?.[1] === "start" && !command[2]) return void await send(token, chatId, TEXT.start);
    if (command?.[1] === "link") {
      const code = (command[2] ?? "").trim();
      const ok = entry.link && entry.link.expiresAt > now() && code && timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(entry.link.hash));
      if (!ok) return void await send(token, chatId, TEXT.badCode);
      patch(botId, (current) => { const { link: _used, ...rest } = current; return { ...rest, owner: { id: from.id, name: who } }; });
      return void await send(token, chatId, TEXT.linked);
    }
    const owner = entry.owner?.id === from.id;
    if (!owner && entry.access !== "everyone") return void await send(token, chatId, TEXT.ownerOnly);
    if (command?.[1] === "new") {
      patch(botId, (current) => { const chats = { ...current.chats }; delete chats[String(chatId)]; return { ...current, chats }; });
      return void await send(token, chatId, TEXT.fresh);
    }
    if (!text.trim()) return void await send(token, chatId, TEXT.textOnly);
    const typing = setInterval(() => { void api(token, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {}); }, 4_000);
    void api(token, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
    try {
      const known = read().bots[botId]?.chats[String(chatId)];
      const answer = await deps.ask(botId, { text, ...(known ? { threadId: known } : {}), title: `Telegram · ${who}`, owner });
      patch(botId, (current) => ({ ...current, chats: { ...current.chats, [String(chatId)]: answer.threadId } }));
      await send(token, chatId, answer.reply.trim() || (answer.status === "needs_approval" ? TEXT.approval : answer.status === "working" ? TEXT.working : TEXT.empty));
    } catch (error) {
      log(`telegram: ${error instanceof Error ? error.message : String(error)}`);
      await send(token, chatId, TEXT.failed);
    } finally {
      clearInterval(typing);
    }
  }

  /** One chat's messages run one after another; different chats run side by side. */
  function enqueue(botId: string, token: string, update: any) {
    const chat = `${botId}:${update?.message?.chat?.id ?? "?"}`;
    const next = (chatQueues.get(chat) ?? Promise.resolve()).then(() => handle(botId, token, update)).catch(() => {});
    chatQueues.set(chat, next);
    void next.finally(() => { if (chatQueues.get(chat) === next) chatQueues.delete(chat); });
  }

  async function loop(botId: string, abort: AbortController) {
    let failures = 0;
    while (!abort.signal.aborted) {
      const entry = read().bots[botId];
      const token = entry ? unseal(entry.sealed) : null;
      if (!entry || !entry.enabled || !token || !deps.botExists(botId)) break;
      try {
        const answer = await api(token, "getUpdates", { offset: entry.offset, timeout: POLL_S, allowed_updates: ["message"] }, abort.signal);
        if (!answer.ok) {
          const error = answer.status === 401 || answer.status === 404 ? "Token không còn dùng được. Dán token mới từ @BotFather."
            : answer.status === 409 ? "Bot Telegram này đang được nơi khác nhận tin (máy khác, Cloud hoặc webhook). Chỉ để một nơi nhận tin."
            : `Telegram báo lỗi ${answer.status}.`;
          patch(botId, (current) => ({ ...current, error }));
          if (answer.status === 401 || answer.status === 404) break;
          await wait(BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)]!, abort.signal);
          continue;
        }
        failures = 0;
        const updates = Array.isArray(answer.result) ? answer.result : [];
        if (updates.length) {
          const offset = Math.max(...updates.map((update: any) => Number(update?.update_id) || 0)) + 1;
          patch(botId, (current) => ({ ...current, offset, error: undefined }));
          for (const update of updates) enqueue(botId, token, update);
        } else if (entry.error) patch(botId, (current) => ({ ...current, error: undefined }));
      } catch (error) {
        if (abort.signal.aborted) break;
        log(`telegram: ${error instanceof Error ? error.message : String(error)}`);
        await wait(BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)]!, abort.signal);
      }
    }
    if (loops.get(botId) === abort) loops.delete(botId);
  }

  function ensure(botId: string) {
    if (!running || loops.has(botId)) return;
    const entry = read().bots[botId];
    if (!entry?.enabled) return;
    const abort = new AbortController();
    loops.set(botId, abort);
    void loop(botId, abort);
  }
  function halt(botId: string) { loops.get(botId)?.abort(); loops.delete(botId); }

  function view(botId: string): TelegramView {
    const entry = read().bots[botId];
    if (!entry) return { connected: false };
    return {
      connected: true, username: entry.username, enabled: entry.enabled, access: entry.access,
      ...(entry.owner ? { owner: entry.owner.name } : {}),
      ...(entry.link && entry.link.expiresAt > now() ? { linkExpiresAt: entry.link.expiresAt } : {}),
      ...(entry.error ? { error: entry.error } : {}),
    };
  }

  async function connect(botId: string, token: string): Promise<TelegramView> {
    const clean = token.trim();
    if (!TOKEN.test(clean)) throw Object.assign(new Error("Token không đúng dạng. Copy nguyên dòng token từ @BotFather."), { status: 400 });
    const me = await api(clean, "getMe", {}).catch(() => null);
    if (!me?.ok || !me.result?.username) throw Object.assign(new Error("Telegram không nhận token này."), { status: 400 });
    halt(botId);
    const data = read();
    const kept = data.bots[botId];
    data.bots[botId] = botSchema.parse({ sealed: seal(clean), username: me.result.username, name: me.result.first_name ?? "", enabled: true, access: kept?.access ?? "owner", ...(kept?.owner ? { owner: kept.owner } : {}), offset: 0, chats: kept?.chats ?? {} });
    write(data);
    ensure(botId);
    return view(botId);
  }

  const PATH = /^\/api\/bots\/([\w-]{1,128})\/telegram(?:\/(link|unlink))?$/;
  const changeSchema = z.object({ token: z.string().max(200).optional(), enabled: z.boolean().optional(), access: z.enum(["owner", "everyone"]).optional() }).strict();

  const routes: RouteHandler = async ({ req, res, path, method, auth, json, readBody }) => {
    const match = PATH.exec(path);
    if (!match) return PASS;
    const botId = match[1]!;
    if (!deps.botExists(botId)) return json(res, 404, { error: "no such bot" });
    const refusal = deps.manageRefusal(auth, botId);
    if (refusal) return json(res, 403, { error: refusal });
    try {
      if (method === "GET" && !match[2]) return json(res, 200, view(botId));
      if (method === "DELETE" && !match[2]) { halt(botId); const data = read(); delete data.bots[botId]; write(data); return json(res, 200, view(botId)); }
      if (method !== "POST") return json(res, 405, { error: "method not allowed" });
      if (match[2] === "link") {
        if (!read().bots[botId]) return json(res, 409, { error: "Kết nối Telegram trước." });
        const code = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
        patch(botId, (current) => ({ ...current, link: { hash: hashCode(code), expiresAt: now() + LINK_MS } }));
        return json(res, 200, { code, ...view(botId) });
      }
      if (match[2] === "unlink") { patch(botId, (current) => { const { owner: _gone, ...rest } = current; return rest as Stored; }); return json(res, 200, view(botId)); }
      const parsed = changeSchema.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: "invalid request" });
      if (parsed.data.token !== undefined) await connect(botId, parsed.data.token);
      if (parsed.data.enabled !== undefined || parsed.data.access !== undefined) {
        patch(botId, (current) => ({ ...current, ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}), ...(parsed.data.access ? { access: parsed.data.access } : {}) }));
        if (parsed.data.enabled === false) halt(botId); else ensure(botId);
      }
      return json(res, 200, view(botId));
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
      return json(res, status, { error: error instanceof Error ? error.message : String(error) });
    }
  };

  return {
    routes,
    view,
    start() { running = true; for (const botId of Object.keys(read().bots)) ensure(botId); },
    stop() { running = false; for (const abort of loops.values()) abort.abort(); loops.clear(); },
  };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => { const timer = setTimeout(resolve, ms); signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true }); });
}
