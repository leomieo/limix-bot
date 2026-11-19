// Limix Bot: a bot answers on Telegram, Discord, Zalo or a Facebook Page from its own settings. This server holds each connection itself
// (no webhook, no address to open): the owner links their own account with a one-time code (/link CODE) and then talks
// to the bot as from the app, at Full access, in a direct chat of its own; everyone else, and every group, is answered
// only when the owner allows it, through the confined Bot API path. Secrets are sealed on disk and never leave this server.
//
// The duplicate filter, retry with backoff, per-account send pacing and the channel adapter contract follow ChannelHub,
// Copyright (c) 2026 TheOwlOps, used under the MIT License (third_party/channelhub/LICENSE).
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import type { ChannelMedia } from "./channel-media.ts";
import { retryableBusySchema } from "../bot-api.ts";
import { writeFileAtomic } from "../atomic.ts";
import type { RequestAuth } from "../request-auth.ts";
import { PASS, type RouteHandler } from "../routes/table.ts";

export type ChannelKind = "telegram" | "discord" | "zalo" | "facebook" | "messenger";

/** One incoming message, the same shape whatever the channel. */
export interface ChannelMessage {
  id: string;
  chatId: string;
  from: { id: string; name: string };
  text: string;
  /** A one-to-one chat with the bot; anything else is a group, answered only as a guest. */
  direct: boolean;
  /** Carried a photo, file or sticker this server cannot read yet. */
  media?: boolean;
  loadMedia?(): Promise<ChannelMedia>;
}

/** Why a connection or a send failed: "auth" stops the channel until a new secret, "conflict" and "retry" try again. */
export class ChannelError extends Error {
  readonly reason: "auth" | "conflict" | "retry" | "drop";
  readonly retryAfterMs: number | undefined;
  constructor(reason: ChannelError["reason"], message: string, retryAfterMs?: number) { super(message); this.reason = reason; this.retryAfterMs = retryAfterMs; }
}

export interface ChannelIo {
  botId: string;
  signal: AbortSignal;
  offset: number;
  saveOffset(offset: number): void;
  deliver(message: ChannelMessage): void;
  /** The connection works; clears a previous error. */
  healthy(): void;
}

export interface ChannelSession {
  send(chatId: string, text: string): Promise<void>;
  sendMedia?(chatId: string, file: ChannelMedia): Promise<void>;
  typing?(chatId: string): Promise<void>;
  /** Settles when the connection ends for good; rejects with a ChannelError. */
  done: Promise<void>;
}

export interface ChannelAdapter {
  kind: ChannelKind;
  label: string;
  textMax: number;
  /** Strangers get no answer at all while only the owner is answered: the account is also a person's or a shop's inbox. */
  quietToStrangers?: boolean;
  /** No one, the owner included, gets Full access here: the channel cannot tell a person's own chat from a group. */
  guestsOnly?: boolean;
  /** Pause before each send on one account, picked between the two bounds. */
  paceMs?: readonly [number, number];
  /** Checks a secret and names the account it opens. */
  check(secret: string): Promise<{ username: string; name: string }>;
  open(secret: string, io: ChannelIo): Promise<ChannelSession>;
}

export interface ChannelAsk {
  (botId: string, input: { text: string; attachment?: ChannelMedia; threadId?: string; title: string; owner: boolean; zaloGroup?: true; delivery?: { signal: AbortSignal; accepted(threadId: string): void; approval(): void } }): Promise<{ threadId: string; reply: string; attachments?: ChannelMedia[]; status?: "needs_approval" | "working" }>;
}

export interface BotChannelsDeps {
  dataDir: string;
  adapters: readonly ChannelAdapter[];
  ask: ChannelAsk;
  botExists(botId: string): boolean;
  /** May this person change this bot's channels? Null when they may, else the reason. */
  manageRefusal(auth: RequestAuth, botId: string): string | null;
  /** Starts a login that ends with a secret (Zalo's QR); absent for channels that take a pasted token. */
  logins?: Partial<Record<ChannelKind, ChannelLogin>>;
  log?(line: string): void;
  now?(): number;
  sleep?(ms: number, signal: AbortSignal): Promise<void>;
}

export interface ChannelLogin {
  start(update: (state: LoginState) => void, signal: AbortSignal): Promise<string>;
}
export interface LoginState { qr?: string; scanned?: string }

export interface ChannelView {
  connected: boolean;
  username?: string;
  name?: string;
  enabled?: boolean;
  access?: "owner" | "everyone";
  groupMentions?: boolean;
  owner?: string;
  linkExpiresAt?: number;
  error?: string;
  login?: LoginState & { error?: string };
}

const LINK_MS = 15 * 60_000;
const BACKOFF_MS = [2_000, 5_000, 15_000, 60_000];
const SEND_RETRIES = 3;
const BUSY_RETRY_MS = 1_000;
const SEEN_MS = 10 * 60_000;
const KEY_FILE = "limix-telegram.key";

const mediaFields = { path: z.string(), mime: z.string() };
const mediaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), ...mediaFields, name: z.string().optional() }),
  z.object({ kind: z.literal("file"), ...mediaFields, name: z.string() }),
]);
const inboxSchema = z.object({
  id: z.string(), chatId: z.string(), from: z.object({ id: z.string(), name: z.string() }),
  text: z.string(), direct: z.boolean(), media: z.boolean().optional(),
  downloading: z.boolean().optional(), attachment: mediaSchema.optional(), owner: z.boolean(),
  started: z.boolean().optional(),
  result: z.object({ reply: z.string(), attachments: z.array(mediaSchema).optional() }).optional(),
  sent: z.number().int().min(0).optional(),
});

const botSchema = z.object({
  sealed: z.string(),
  username: z.string().default(""),
  name: z.string().default(""),
  enabled: z.boolean().default(true),
  access: z.enum(["owner", "everyone"]).default("owner"),
  groupMentions: z.boolean().optional(),
  owner: z.object({ id: z.union([z.string(), z.number()]).transform(String), name: z.string() }).optional(),
  link: z.object({ hash: z.string(), expiresAt: z.number() }).optional(),
  offset: z.number().default(0),
  chats: z.record(z.string(), z.string()).default({}),
  error: z.string().optional(),
  inbox: z.record(z.string(), inboxSchema).default({}),
  recent: z.record(z.string(), z.number()).default({}),
});
const fileSchema = z.object({ v: z.literal(1), bots: z.record(z.string(), botSchema) });
type InboxMessage = z.output<typeof inboxSchema>;
type Stored = z.output<typeof botSchema>;
type FileShape = z.output<typeof fileSchema>;

const text = (label: string) => ({
  start: `Chào bạn! Đây là bot Limix. Nhắn tin để trò chuyện. Chủ bot: gửi /link MÃ để liên kết.`,
  linked: "Đã liên kết. Từ giờ bạn nhắn ở đây như nhắn trong app Limix.",
  badCode: `Mã không đúng hoặc đã hết hạn. Tạo mã mới trong app Limix: bot → Cài đặt → ${label}.`,
  linkHere: "Hãy gửi /link MÃ trong tin nhắn riêng với bot.",
  ownerOnly: "Bot này hiện chỉ trả lời chủ bot.",
  textOnly: "Bot chưa nhận được nội dung đọc được. Bạn hãy gửi chữ, ảnh hoặc tệp đính kèm.",
  fresh: "Đã bắt đầu cuộc trò chuyện mới.",
  approval: "Bot đang chờ bạn duyệt một bước trong app Limix.",
  working: "Bot vẫn đang làm việc này. Xem kết quả trong app Limix.",
  queued: "Đã nhận tin nhắn. Bot sẽ xử lý khi đến lượt.",
  interrupted: "Tác vụ bị gián đoạn. Kiểm tra cuộc trò chuyện trong Limix trước khi gửi lại.",
  mediaFailed: "Bot chưa tải được tệp này. Bạn hãy thử gửi lại hoặc gửi tệp nhỏ hơn.",
  failed: "Bot chưa trả lời được lúc này. Thử lại sau.",
  empty: "Bot đã làm xong nhưng không có câu trả lời bằng chữ.",
});

const ZALO_RECEIPT = /^(?:\*\*)?(?:(?:mình|tôi|em)\s+)?đã nhận(?: được)? tin nhắn(?:\s*[:：]?\s+(?:“([^”\r\n]*)”|"([^"\r\n]*)"|'([^'\r\n]*)'|‘([^’\r\n]*)’)|(?: của bạn)?(?=\s*[.!。]|\s*$))\s*[.!。]?(?:\*\*)?\s*/iu;

function zaloGroupReply(reply: string, message: string, hasMedia: boolean): string {
  const receipt = ZALO_RECEIPT.exec(reply);
  if (!receipt) return reply;
  const quoted = receipt.slice(1).find((value) => value !== undefined);
  if (quoted !== undefined && quoted.trim() !== message.trim()) return reply;
  const rest = reply.slice(receipt[0].length).trimStart();
  if (rest || hasMedia) return rest;
  return /^(?:hi|hello|hey|chào|xin chào)[!.\s]*$/iu.test(message.trim())
    ? "Chào bạn! Mình giúp gì cho bạn được?"
    : "Bạn nói rõ hơn một chút để mình giúp nhé?";
}

/** Splits a reply at paragraph, then line, then word boundaries so each piece fits one message. */
export function chunkText(body: string, max: number): string[] {
  const out: string[] = [];
  let rest = body.trim();
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
const failure = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export function createBotChannels(deps: BotChannelsDeps) {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});
  const sleep = deps.sleep ?? wait;
  const keyFile = join(deps.dataDir, KEY_FILE);
  const adapters = new Map(deps.adapters.map((adapter) => [adapter.kind, adapter]));
  const runs = new Map<string, AbortController>();
  const queues = new Map<string, Promise<void>>();
  const sessions = new Map<string, ChannelSession>();
  const paces = new Map<string, Promise<void>>();
  const seen = new Map<string, number>();
  const logins = new Map<string, { abort: AbortController; state: LoginState & { error?: string } }>();
  let running = false;

  const fileOf = (kind: ChannelKind) => join(deps.dataDir, `limix-${kind}.json`);
  function read(kind: ChannelKind): FileShape {
    try { const parsed = fileSchema.safeParse(JSON.parse(readFileSync(fileOf(kind), "utf8"))); if (parsed.success) return parsed.data; } catch {}
    return { v: 1, bots: {} };
  }
  function write(kind: ChannelKind, data: FileShape) { mkdirSync(deps.dataDir, { recursive: true }); writeFileAtomic(fileOf(kind), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 }); }
  function patch(kind: ChannelKind, botId: string, change: (entry: Stored) => Stored | null) {
    const data = read(kind);
    const entry = data.bots[botId];
    if (!entry) return;
    const next = change(entry);
    if (next) data.bots[botId] = next; else delete data.bots[botId];
    write(kind, data);
  }
  function key(create: boolean): Buffer | null {
    try { const hex = readFileSync(keyFile, "utf8").trim(); if (/^[0-9a-f]{64}$/.test(hex)) return Buffer.from(hex, "hex"); } catch {}
    if (!create) return null;
    const made = randomBytes(32);
    mkdirSync(dirname(keyFile), { recursive: true });
    writeFileAtomic(keyFile, `${made.toString("hex")}\n`, { mode: 0o600 });
    return made;
  }
  function seal(secret: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(true)!, nonce);
    const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
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

  function firstSight(id: string): boolean {
    const at = now();
    if ((seen.get(id) ?? 0) > at) return false;
    if (seen.size > 5_000) for (const [old, until] of seen) if (until <= at) seen.delete(old);
    seen.set(id, at + SEEN_MS);
    return true;
  }

  /** Sends on one account one after another, paced, retrying what the channel says to retry. */
  function paced(adapter: ChannelAdapter, botId: string, job: () => Promise<void>): Promise<void> {
    const lane = `${adapter.kind}:${botId}`;
    const run = async () => {
      if (adapter.paceMs) { const [low, high] = adapter.paceMs; await new Promise((resolve) => setTimeout(resolve, low + Math.random() * Math.max(0, high - low))); }
      for (let attempt = 0; ; attempt++) {
        try { return await job(); } catch (error) {
          const retry = error instanceof ChannelError && error.reason === "retry" && attempt < SEND_RETRIES;
          if (!retry) throw error;
          await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs ?? 500 * 2 ** attempt));
        }
      }
    };
    const next = (paces.get(lane) ?? Promise.resolve()).then(run, run);
    paces.set(lane, next.catch(() => {}));
    return next;
  }

  async function reply(adapter: ChannelAdapter, botId: string, session: ChannelSession, chatId: string, body: string) {
    try { for (const piece of chunkText(body, adapter.textMax)) await paced(adapter, botId, () => session.send(chatId, piece)); }
    catch (error) { log(`${adapter.kind}: send failed (${failure(error)})`); }
  }

  async function askWhenReady(botId: string, input: Parameters<ChannelAsk>[1], signal: AbortSignal, onQueue: () => void) {
    while (!signal.aborted) {
      try {
        return await deps.ask(botId, input);
      } catch (error) {
        if (!retryableBusySchema.safeParse(error).success) throw error;
        onQueue();
        await sleep(BUSY_RETRY_MS, signal);
      }
    }
  }

  function acceptGuest(kind: ChannelKind, entry: Stored, message: ChannelMessage) {
    return kind === "zalo" && !message.direct ? entry.groupMentions ?? entry.access === "everyone" : entry.access === "everyone";
  }

  const messageKey = (message: ChannelMessage) => createHash("sha256").update(JSON.stringify([message.chatId, message.id])).digest("hex");

  function updateInbox(kind: ChannelKind, botId: string, id: string, change: (message: InboxMessage) => InboxMessage, signal: AbortSignal) {
    if (signal.aborted) return;
    patch(kind, botId, (entry) => {
      const message = entry.inbox[id];
      return message ? { ...entry, inbox: { ...entry.inbox, [id]: change(message) } } : entry;
    });
  }

  async function deliverResult(adapter: ChannelAdapter, botId: string, id: string, message: InboxMessage, signal: AbortSignal) {
    const lane = `${adapter.kind}:${botId}`;
    const result = message.result!;
    let sent = message.sent ?? 0;
    while (!signal.aborted) {
      const session = sessions.get(lane);
      if (!session) {
        await sleep(BUSY_RETRY_MS, signal);
        continue;
      }
      const media = session.sendMedia ? result.attachments ?? [] : [];
      const parts = chunkText(result.reply, adapter.textMax);
      if (sent >= media.length + parts.length) return;
      try {
        const file = media[sent];
        await paced(adapter, botId, () => {
          if (signal.aborted || sessions.get(lane) !== session) throw new ChannelError("drop", "Connection changed");
          return file ? session.sendMedia!(message.chatId, file) : session.send(message.chatId, parts[sent - media.length]!);
        });
      } catch (error) {
        if (signal.aborted) return;
        if (sessions.get(lane) !== session || error instanceof ChannelError && error.reason === "retry") {
          await sleep(BACKOFF_MS[0]!, signal);
          continue;
        }
        if (media[sent]) await reply(adapter, botId, session, message.chatId, "Bot chưa gửi được một tệp đính kèm qua kênh này.");
        else {
          log(`${adapter.kind}: send failed (${failure(error)})`);
          return;
        }
      }
      sent++;
      updateInbox(adapter.kind, botId, id, (row) => ({ ...row, sent }), signal);
    }
  }

  async function handle(adapter: ChannelAdapter, botId: string, session: ChannelSession, message: ChannelMessage, signal: AbortSignal, saved?: { id: string; row: InboxMessage; media: Promise<ChannelMedia | Error | undefined>; queued(): void }): Promise<void> {
    const kind = adapter.kind, say = text(adapter.label);
    const entry = read(kind).bots[botId];
    if (signal.aborted || !entry?.enabled) return;
    const send = (body: string) => reply(adapter, botId, session, message.chatId, body);
    const command = message.media ? null : /^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/s.exec(message.text.trim());
    if (command?.[1] === "start" && !command[2]) return void await send(say.start);
    if (command?.[1] === "link") {
      if (adapter.guestsOnly) return;
      if (!message.direct) return void await send(say.linkHere);
      const code = (command[2] ?? "").trim();
      const ok = entry.link && entry.link.expiresAt > now() && code && timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(entry.link.hash));
      if (!ok) return void await send(say.badCode);
      patch(kind, botId, (current) => { const { link: _used, ...rest } = current; return { ...rest, owner: { id: message.from.id, name: message.from.name } }; });
      return void await send(say.linked);
    }
    const isOwner = message.direct && !adapter.guestsOnly && entry.owner?.id === message.from.id;
    if (saved?.row.owner && !isOwner) return;
    const owner = isOwner && (saved?.row.owner ?? true);
    const allowsGuest = acceptGuest(kind, entry, message);
    if (!owner && !allowsGuest) return message.direct && !adapter.quietToStrangers ? void await send(say.ownerOnly) : undefined;
    const conversation = message.direct ? message.chatId : `${message.chatId}:${message.from.id}`;
    if (command?.[1] === "new") {
      patch(kind, botId, (current) => { const chats = { ...current.chats }; delete chats[conversation]; return { ...current, chats }; });
      return void await send(say.fresh);
    }
    if (!saved) {
      if (!message.text.trim() && !message.loadMedia) await send(say.textOnly);
      return;
    }
    if (saved.row.result) return deliverResult(adapter, botId, saved.id, saved.row, signal);
    const pulse = () => void sessions.get(`${kind}:${botId}`)?.typing?.(message.chatId).catch(() => {});
    let result: NonNullable<InboxMessage["result"]>;
    if (saved.row.started) result = { reply: say.interrupted };
    else {
      pulse();
      const typing = setInterval(pulse, 4_000);
      try {
        const known = read(kind).bots[botId]?.chats[conversation];
        const attachment = await saved.media;
        if (attachment instanceof Error) throw attachment;
        const zaloGroup = kind === "zalo" && !message.direct;
        const answer = await askWhenReady(botId, {
          text: message.text || (attachment?.kind === "image" ? "Ảnh đính kèm" : "Tệp đính kèm"),
          ...(attachment ? { attachment } : {}),
          ...(known ? { threadId: known } : {}),
          title: `${adapter.label} · ${message.from.name}`,
          owner,
          ...(zaloGroup ? { zaloGroup: true as const } : {}),
          delivery: {
            signal,
            accepted(threadId) {
              updateInbox(kind, botId, saved.id, (row) => ({ ...row, started: true }), signal);
              if (!signal.aborted) patch(kind, botId, (current) => ({ ...current, chats: { ...current.chats, [conversation]: threadId } }));
            },
            approval() { if (!signal.aborted) void send(say.approval); },
          },
        }, signal, saved.queued);
        if (!answer || signal.aborted) return;
        patch(kind, botId, (current) => ({ ...current, chats: { ...current.chats, [conversation]: answer.threadId } }));
        const attachments = answer.attachments;
        const replyText = answer.reply.trim();
        const hasMedia = Boolean(attachments?.length && session.sendMedia);
        const body = zaloGroup && !answer.status ? zaloGroupReply(replyText, message.text, hasMedia) : replyText;
        result = { reply: body || (answer.status === "needs_approval" ? say.approval : answer.status === "working" ? say.working : hasMedia ? "" : say.empty), attachments };
      } catch (error) {
        if (signal.aborted) return;
        log(`${kind}: ${failure(error)}`);
        result = { reply: error === mediaUnavailable ? say.mediaFailed : say.failed };
      } finally {
        clearInterval(typing);
      }
    }
    updateInbox(kind, botId, saved.id, (row) => ({ ...row, result }), signal);
    await deliverResult(adapter, botId, saved.id, { ...saved.row, result }, signal);
  }

  const mediaUnavailable = new Error("Channel attachment unavailable");

  function enqueue(adapter: ChannelAdapter, botId: string, session: ChannelSession, message: ChannelMessage, signal: AbortSignal, restored?: InboxMessage) {
    const kind = adapter.kind;
    const chat = `${kind}:${botId}:${message.chatId}`;
    const id = messageKey(message);
    const entry = read(kind).bots[botId];
    if (!entry?.enabled || signal.aborted) return;
    if (!restored && (entry.inbox[id] || (entry.recent[id] ?? 0) > now())) return;
    const link = !message.media && /^\/link(?:@\w+)?(?:\s|$)/.test(message.text.trim());
    if (link && adapter.guestsOnly) return;
    const command = link || !message.media && /^\/start(?:@\w+)?$/.test(message.text.trim());
    const owner = message.direct && !adapter.guestsOnly && entry.owner?.id === message.from.id;
    const eligible = (owner || acceptGuest(kind, entry, message)) && !command && (message.text.trim() || message.loadMedia);
    const row = restored ?? (eligible ? inboxSchema.parse({ ...message, owner, downloading: Boolean(message.loadMedia) }) : undefined);
    if (!row && !firstSight(`${chat}:${id}`)) return;
    if (row && !restored) patch(kind, botId, (current) => ({ ...current, inbox: { ...current.inbox, [id]: row } }));
    let notified = Boolean(restored);
    const queued = () => {
      if (notified || signal.aborted) return;
      notified = true;
      void reply(adapter, botId, session, message.chatId, text(adapter.label).queued);
    };
    const previous = queues.get(chat);
    const media = row && message.loadMedia
      ? Promise.resolve().then(message.loadMedia).then((attachment) => {
        updateInbox(kind, botId, id, (current) => ({ ...current, downloading: false, attachment }), signal);
        return attachment;
      }).catch(() => mediaUnavailable)
      : Promise.resolve(row?.downloading ? mediaUnavailable : row?.attachment);
    const process = async () => {
      if (signal.aborted) return;
      await handle(adapter, botId, session, message, signal, row ? {
        id, row, queued, media,
      } : undefined);
      if (row && !signal.aborted) patch(kind, botId, (current) => {
        const inbox = { ...current.inbox };
        delete inbox[id];
        const recent = Object.fromEntries(Object.entries(current.recent).filter(([, expires]) => expires > now()));
        recent[id] = now() + SEEN_MS;
        return { ...current, inbox, recent };
      });
    };
    const next = (previous ? previous.then(process) : process()).catch((error) => log(`${kind}: ${failure(error)}`));
    queues.set(chat, next);
    if (row && previous) queued();
    void next.finally(() => { if (queues.get(chat) === next) queues.delete(chat); });
  }

  async function loop(adapter: ChannelAdapter, botId: string, abort: AbortController) {
    const kind = adapter.kind, lane = `${kind}:${botId}`;
    let failures = 0;
    let restored = false;
    while (!abort.signal.aborted) {
      const entry = read(kind).bots[botId];
      const secret = entry ? unseal(entry.sealed) : null;
      if (!entry || !entry.enabled || !secret || !deps.botExists(botId)) break;
      try {
        let session: ChannelSession | undefined;
        const io: ChannelIo = {
          botId,
          signal: abort.signal,
          offset: entry.offset,
          saveOffset: (offset) => patch(kind, botId, (current) => ({ ...current, offset })),
          deliver: (message) => { if (session) enqueue(adapter, botId, session, message, abort.signal); },
          healthy: () => { failures = 0; if (read(kind).bots[botId]?.error) patch(kind, botId, (current) => ({ ...current, error: undefined })); },
        };
        session = await adapter.open(secret, io);
        if (abort.signal.aborted) { await session.done; break; }
        sessions.set(lane, session);
        if (!restored && !abort.signal.aborted) {
          restored = true;
          for (const row of Object.values(read(kind).bots[botId]?.inbox ?? {})) enqueue(adapter, botId, session, row, abort.signal, row);
        }
        try { await session.done; }
        finally { if (sessions.get(lane) === session) sessions.delete(lane); }
        if (abort.signal.aborted) break;
        throw new ChannelError("retry", `${adapter.label} ngắt kết nối.`);
      } catch (error) {
        if (abort.signal.aborted) break;
        const reason = error instanceof ChannelError ? error.reason : "retry";
        const message = error instanceof ChannelError && reason !== "retry" ? error.message : `${adapter.label}: ${failure(error)}`;
        log(`${kind}: ${message}`);
        if (reason !== "retry" || failures >= 2) patch(kind, botId, (current) => ({ ...current, error: message }));
        if (reason === "auth") break;
        await sleep(BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)]!, abort.signal);
      }
    }
    if (runs.get(lane) === abort) runs.delete(lane);
  }

  function ensure(kind: ChannelKind, botId: string) {
    const adapter = adapters.get(kind);
    const lane = `${kind}:${botId}`;
    if (!running || !adapter || runs.has(lane) || !read(kind).bots[botId]?.enabled) return;
    const abort = new AbortController();
    runs.set(lane, abort);
    void loop(adapter, botId, abort);
  }
  function halt(kind: ChannelKind, botId: string) { const lane = `${kind}:${botId}`; runs.get(lane)?.abort(); runs.delete(lane); }

  function view(kind: ChannelKind, botId: string): ChannelView {
    const entry = read(kind).bots[botId];
    const login = logins.get(`${kind}:${botId}`)?.state;
    if (!entry) return { connected: false, ...(login ? { login } : {}) };
    return {
      connected: true, username: entry.username, name: entry.name, enabled: entry.enabled, access: entry.access,
      ...(kind === "zalo" ? { groupMentions: entry.groupMentions ?? entry.access === "everyone" } : {}),
      ...(entry.owner ? { owner: entry.owner.name } : {}),
      ...(entry.link && entry.link.expiresAt > now() ? { linkExpiresAt: entry.link.expiresAt } : {}),
      ...(entry.error ? { error: entry.error } : {}),
      ...(login ? { login } : {}),
    };
  }

  async function connect(kind: ChannelKind, botId: string, secret: string): Promise<void> {
    const adapter = adapters.get(kind)!;
    const account = await adapter.check(secret).catch((error) => { throw Object.assign(new Error(error instanceof ChannelError ? error.message : `${adapter.label} không nhận thông tin đăng nhập này.`), { status: 400 }); });
    halt(kind, botId);
    const data = read(kind);
    const kept = data.bots[botId];
    const sameAccount = kept?.username === account.username;
    data.bots[botId] = botSchema.parse({
      sealed: seal(secret), username: account.username, name: account.name, enabled: true, access: kept?.access ?? (adapter.guestsOnly ? "everyone" : "owner"),
      groupMentions: kept?.groupMentions,
      ...(sameAccount && kept.owner ? { owner: kept.owner } : {}), offset: sameAccount ? kept.offset : 0, chats: sameAccount ? kept.chats : {},
      inbox: sameAccount ? kept.inbox : {}, recent: sameAccount ? kept.recent : {},
    });
    write(kind, data);
    ensure(kind, botId);
  }

  function startLogin(kind: ChannelKind, botId: string) {
    const login = deps.logins?.[kind];
    if (!login) throw Object.assign(new Error("not supported"), { status: 404 });
    const lane = `${kind}:${botId}`;
    logins.get(lane)?.abort.abort();
    const abort = new AbortController();
    const current = { abort, state: {} as LoginState & { error?: string } };
    logins.set(lane, current);
    const live = () => logins.get(lane) === current;
    void login.start((state) => { if (live()) current.state = { ...current.state, ...state }; }, abort.signal)
      .then(async (secret) => { if (!live()) return; await connect(kind, botId, secret); if (live()) logins.delete(lane); })
      .catch((error) => { if (live() && !abort.signal.aborted) current.state = { error: failure(error) }; });
  }

  const PATH = /^\/api\/bots\/([\w-]{1,128})\/(telegram|discord|zalo|facebook|messenger)(?:\/(link|unlink|login))?$/;
  const changeSchema = z.object({ token: z.string().max(400).optional(), enabled: z.boolean().optional(), access: z.enum(["owner", "everyone"]).optional(), groupMentions: z.boolean().optional() }).strict();

  const routes: RouteHandler = async ({ req, res, path, method, auth, json, readBody }) => {
    const match = PATH.exec(path);
    if (!match || !adapters.has(match[2] as ChannelKind)) return PASS;
    const botId = match[1]!, kind = match[2] as ChannelKind, action = match[3];
    if (!deps.botExists(botId)) return json(res, 404, { error: "no such bot" });
    const refusal = deps.manageRefusal(auth, botId);
    if (refusal) return json(res, 403, { error: refusal });
    try {
      if (method === "GET" && !action) return json(res, 200, view(kind, botId));
      if (method === "DELETE" && action === "login") { logins.get(`${kind}:${botId}`)?.abort.abort(); logins.delete(`${kind}:${botId}`); return json(res, 200, view(kind, botId)); }
      if (method === "DELETE" && !action) { halt(kind, botId); const data = read(kind); delete data.bots[botId]; write(kind, data); return json(res, 200, view(kind, botId)); }
      if (method !== "POST") return json(res, 405, { error: "method not allowed" });
      if (action === "login") { startLogin(kind, botId); return json(res, 202, view(kind, botId)); }
      if (action === "link") {
        if (!read(kind).bots[botId]) return json(res, 409, { error: `Kết nối ${adapters.get(kind)!.label} trước.` });
        const code = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
        patch(kind, botId, (current) => ({ ...current, link: { hash: hashCode(code), expiresAt: now() + LINK_MS } }));
        return json(res, 200, { code, ...view(kind, botId) });
      }
      if (action === "unlink") { patch(kind, botId, (current) => { const { owner: _gone, ...rest } = current; return rest as Stored; }); return json(res, 200, view(kind, botId)); }
      const parsed = changeSchema.safeParse(await readBody(req));
      if (!parsed.success || (kind !== "zalo" && parsed.data.groupMentions !== undefined)) return json(res, 400, { error: "invalid request" });
      if (parsed.data.token !== undefined) {
        if (deps.logins?.[kind]) return json(res, 400, { error: "invalid request" });
        await connect(kind, botId, parsed.data.token.trim());
      }
      const { enabled, access, groupMentions } = parsed.data;
      if (enabled !== undefined || access !== undefined || groupMentions !== undefined) {
        patch(kind, botId, (current) => ({
          ...current,
          enabled: enabled ?? current.enabled,
          access: access ?? current.access,
          groupMentions: groupMentions ?? current.groupMentions,
        }));
        if (parsed.data.enabled === false) halt(kind, botId); else ensure(kind, botId);
      }
      return json(res, 200, view(kind, botId));
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
      return json(res, status, { error: failure(error) });
    }
  };

  return {
    routes,
    view,
    start() { running = true; for (const kind of adapters.keys()) for (const botId of Object.keys(read(kind).bots)) ensure(kind, botId); },
    stop() {
      running = false;
      for (const abort of runs.values()) abort.abort();
      for (const login of logins.values()) login.abort.abort();
      runs.clear(); logins.clear();
    },
  };
}
