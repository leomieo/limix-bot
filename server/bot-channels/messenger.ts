// A personal Messenger account, read and answered by the desktop app in a Facebook window it keeps hidden
// (electron/messenger-personal.mjs). Facebook's own sign-in stays in that window; this server only queues what the
// window reads and what it should type. Experimental: Facebook offers no API for personal accounts, so the window reads
// the page itself, and a Messenger thread cannot be told apart from a group there, so everyone is answered as a guest.
import type { RequestAuth } from "../request-auth.ts";
import { PASS, type RouteHandler } from "../routes/table.ts";
import { ChannelError, type ChannelAdapter, type ChannelIo } from "./engine.ts";
import { fetchChannelMedia, readChannelMedia } from "./channel-media.ts";

const OUTBOX_WAIT_MS = 25_000;
const SEND_WAIT_MS = 90_000;

interface Outgoing { id: number; chatId: string; text: string; file?: { name: string; base64: string }; settle(error?: string): void }
interface Bridge { io: ChannelIo; outbox: Outgoing[]; waiters: Array<() => void>; seenAt: number }

export function messengerBridge(options: { manageRefusal(auth: RequestAuth, botId: string): string | null; now?(): number }) {
  const now = options.now ?? Date.now;
  const bridges = new Map<string, Bridge>();
  const pending = new Map<number, Outgoing>();
  let nextId = 0;

  const adapter: ChannelAdapter = {
    kind: "messenger",
    label: "Messenger",
    textMax: 2000,
    quietToStrangers: true,
    guestsOnly: true,
    paceMs: [800, 2_000],
    async check(secret) {
      let account: { uid?: unknown; name?: unknown };
      try { account = JSON.parse(secret); } catch { throw new ChannelError("auth", "Đăng nhập Facebook trong cửa sổ của app trước."); }
      if (typeof account.uid !== "string" || !/^\d{3,25}$/.test(account.uid)) throw new ChannelError("auth", "Đăng nhập Facebook trong cửa sổ của app trước.");
      return { username: account.uid, name: typeof account.name === "string" ? account.name.slice(0, 100) : "" };
    },
    async open(_secret, io) {
      const botId = io.botId;
      const bridge: Bridge = { io, outbox: [], waiters: [], seenAt: 0 };
      bridges.set(botId, bridge);
      const done = new Promise<void>((resolve) => io.signal.addEventListener("abort", () => {
        if (bridges.get(botId) === bridge) bridges.delete(botId);
        for (const item of bridge.outbox) item.settle("stopped");
        for (const wake of bridge.waiters.splice(0)) wake();
        resolve();
      }, { once: true }));
      const enqueue = (chatId: string, text: string, file?: Outgoing["file"]) => new Promise<void>((resolve, reject) => {
          if (io.signal.aborted) return reject(new ChannelError("drop", "Messenger: stopped"));
          const id = ++nextId;
          const timer = setTimeout(() => item.settle("timeout"), SEND_WAIT_MS);
          const item: Outgoing = { id, chatId, text, file, settle: (error) => {
            clearTimeout(timer);
            pending.delete(id);
            bridge.outbox = bridge.outbox.filter((each) => each !== item);
            if (error) reject(new ChannelError(error === "timeout" ? "retry" : "drop", `Messenger: ${error}`)); else resolve();
          } };
          pending.set(id, item);
          bridge.outbox.push(item);
          for (const wake of bridge.waiters.splice(0)) wake();
        });
      return {
        done,
        send: enqueue,
        sendMedia: async (chatId, media) => {
          const file = await readChannelMedia(media);
          await enqueue(chatId, "", { name: file.filename, base64: file.data.toString("base64") });
        },
      };
    },
  };

  const PATH = /^\/api\/bots\/([\w-]{1,128})\/messenger\/(outbox|inbox|sent)$/;
  const routes: RouteHandler = async ({ req, res, path, method, auth, json, readBody }) => {
    if (path === "/api/messenger/bots" && method === "GET") return json(res, 200, { bots: [...bridges.keys()].filter((botId) => !options.manageRefusal(auth, botId)) });
    const match = PATH.exec(path);
    if (!match) return PASS;
    const botId = match[1]!, action = match[2]!;
    const refusal = options.manageRefusal(auth, botId);
    if (refusal) return json(res, 403, { error: refusal });
    const bridge = bridges.get(botId);
    if (!bridge) return json(res, 409, { error: "Messenger is off for this bot." });
    bridge.seenAt = now();
    if (action === "outbox" && method === "GET") {
      if (!bridge.outbox.length) await new Promise<void>((resolve) => { const timer = setTimeout(resolve, OUTBOX_WAIT_MS); bridge.waiters.push(() => { clearTimeout(timer); resolve(); }); });
      bridge.io.healthy();
      return json(res, 200, { items: bridge.outbox.slice(0, 1).map(({ id, chatId, text, file }) => ({ id, chatId, text, ...(file ? { file } : {}) })) });
    }
    if (method !== "POST") return json(res, 405, { error: "method not allowed" });
    const body = await readBody(req) as Record<string, unknown> | null;
    if (action === "sent") {
      const item = pending.get(Number(body?.id));
      const owned = item && bridge.outbox.includes(item);
      if (owned) item.settle(typeof body?.error === "string" ? body.error.slice(0, 200) : undefined);
      return json(res, 200, { ok: Boolean(owned) });
    }
    const messages = Array.isArray(body?.messages) ? body.messages.slice(0, 50) : [];
    for (const raw of messages as Array<Record<string, unknown>>) {
      const chatId = typeof raw?.chatId === "string" && /^[\w.-]{1,64}$/.test(raw.chatId) ? raw.chatId : null;
      const text = typeof raw?.text === "string" ? raw.text.slice(0, 8_000) : "";
      if (!chatId || typeof raw.id !== "string") continue;
      const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 100) : chatId;
      const url = typeof raw.fileUrl === "string" && raw.fileUrl.length <= 8_192 ? raw.fileUrl : undefined;
      const filename = typeof raw.fileName === "string" && raw.fileName.length <= 512 ? raw.fileName : "attachment.bin";
      bridge.io.deliver({ id: raw.id.slice(0, 200), chatId, direct: true, from: { id: chatId, name }, text,
        ...(url ? { media: true, loadMedia: () => fetchChannelMedia(url, ["fbcdn.net", "fbsbx.com", "facebook.com"], filename) } : {}),
      });
    }
    bridge.io.healthy();
    return json(res, 200, { ok: true });
  };

  return { adapter, routes };
}
