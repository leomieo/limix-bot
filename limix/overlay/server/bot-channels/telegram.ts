// Telegram Bot API over long polling (getUpdates): no webhook, so nothing has to reach this server from outside.
import { ChannelError, type ChannelAdapter, type ChannelMessage } from "./engine.ts";
import { channelFileBlob, readChannelDownload, readChannelMedia, storeChannelMedia } from "./channel-media.ts";

const TOKEN = /^\d{5,15}:[\w-]{30,60}$/;
const POLL_S = 25;

export interface TelegramOptions { apiBase?: string; fetch?: typeof fetch }

export function telegramAdapter(options: TelegramOptions = {}): ChannelAdapter {
  const base = (options.apiBase ?? "https://api.telegram.org").replace(/\/$/, "");
  const call = options.fetch ?? fetch;

  async function api(token: string, method: string, body: Record<string, unknown> | FormData, signal?: AbortSignal) {
    const payload = body instanceof FormData ? { body } : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
    const response = await call(`${base}/bot${token}/${method}`, { method: "POST", ...payload, redirect: "error", ...(signal ? { signal } : {}) })
      .catch((error: unknown) => { throw new ChannelError("retry", `Telegram: ${(error instanceof Error ? error.message : String(error)).replaceAll(token, "…")}`); });
    const data = await response.json().catch(() => ({})) as { ok?: boolean; result?: any; description?: string; parameters?: { retry_after?: number } };
    if (response.ok && data.ok === true) return data.result;
    const status = response.status;
    if (status === 401 || status === 404) throw new ChannelError("auth", "Token không còn dùng được. Dán token mới từ @BotFather.");
    if (status === 409) throw new ChannelError("conflict", "Bot Telegram này đang được nơi khác nhận tin (máy khác, Cloud hoặc webhook). Chỉ để một nơi nhận tin.");
    if (status === 429 || status >= 500) throw new ChannelError("retry", `Telegram báo lỗi ${status}.`, data.parameters?.retry_after ? data.parameters.retry_after * 1000 : undefined);
    throw new ChannelError("drop", `Telegram báo lỗi ${status}${data.description ? `: ${data.description}` : ""}.`);
  }

  return {
    kind: "telegram",
    label: "Telegram",
    textMax: 4096,
    async check(token) {
      if (!TOKEN.test(token)) throw new ChannelError("auth", "Token không đúng dạng. Copy nguyên dòng token từ @BotFather.");
      const me = await api(token, "getMe", {}).catch(() => null);
      if (!me?.username) throw new ChannelError("auth", "Telegram không nhận token này.");
      return { username: me.username, name: me.first_name ?? "" };
    },
    async open(token, io) {
      const me = await api(token, "getMe", {}, io.signal);
      const mentioned = new RegExp(`@${me.username}\\b`, "iu");
      const mention = new RegExp(mentioned.source, "giu");
      const toMessage = (message: any): ChannelMessage | null => {
        if (!message?.chat || !message.from || message.from.is_bot) return null;
        const direct = message.chat.type === "private";
        const raw = typeof message.text === "string" ? message.text : typeof message.caption === "string" ? message.caption : "";
        const addressed = direct || mentioned.test(raw) || message.reply_to_message?.from?.id === me.id;
        if (!addressed) return null;
        const from = message.from;
        const file = message.document ?? message.video ?? message.audio ?? message.voice ?? message.animation ??
          message.video_note ?? message.sticker ?? (Array.isArray(message.photo) ? message.photo.at(-1) : undefined);
        return {
          id: String(message.message_id), chatId: String(message.chat.id), direct,
          from: { id: String(from.id), name: [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || String(from.id) },
          text: raw.replace(mention, "").trim(),
          ...(file ? { media: true } : {}),
          ...(typeof file?.file_id === "string" ? { loadMedia: async () => {
            const signal = AbortSignal.any([io.signal, AbortSignal.timeout(30_000)]);
            const remote = await api(token, "getFile", { file_id: file.file_id }, signal);
            const path = remote?.file_path;
            if (typeof path !== "string" || !path.split("/").every(part => /^[\w.-]+$/.test(part) && part !== "." && part !== "..")) throw Error("Attachment unavailable");
            const response = await call(`${base}/file/bot${token}/${path}`, { signal, redirect: "error" });
            return storeChannelMedia(await readChannelDownload(response), file.file_name ?? path.split("/").at(-1)!);
          } } : {}),
        };
      };
      const done = (async () => {
        let offset = io.offset;
        while (!io.signal.aborted) {
          const updates = await api(token, "getUpdates", { offset, timeout: POLL_S, allowed_updates: ["message"] }, io.signal).catch((error) => { if (io.signal.aborted) return []; throw error; });
          io.healthy();
          if (!Array.isArray(updates) || !updates.length) continue;
          offset = Math.max(...updates.map((update: any) => Number(update?.update_id) || 0)) + 1;
          for (const update of updates) { const message = toMessage(update?.message); if (message) io.deliver(message); }
          io.saveOffset(offset);
        }
      })();
      return {
        done,
        send: async (chatId, text) => { await api(token, "sendMessage", { chat_id: Number(chatId), text }); },
        sendMedia: async (chatId, attachment) => {
          const file = await readChannelMedia(attachment);
          const image = attachment.kind === "image" && attachment.mime !== "image/webp";
          const form = new FormData();
          form.set("chat_id", chatId);
          form.set(image ? "photo" : "document", channelFileBlob(file), file.filename);
          await api(token, image ? "sendPhoto" : "sendDocument", form, AbortSignal.timeout(60_000));
        },
        typing: async (chatId) => { await api(token, "sendChatAction", { chat_id: Number(chatId), action: "typing" }); },
      };
    },
  };
}
