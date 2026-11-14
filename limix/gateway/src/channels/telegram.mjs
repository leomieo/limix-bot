import { downloadMedia } from "../media.mjs";
// Telegram Bot API (https://core.telegram.org/bots/api): long polling with getUpdates.
// Polling and a webhook cannot both be active for one bot; a 409 from getUpdates means another consumer holds it.

export class ChannelError extends Error {
  constructor(code, message, retryAfterMs) {
    super(message);
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export class TelegramChannel {
  constructor({ token, apiBase = "https://api.telegram.org", fetchImpl = fetch, pollTimeoutSec = 25 }) {
    this.token = token;
    this.apiBase = apiBase.replace(/\/+$/, "");
    this.fetch = fetchImpl;
    this.pollTimeoutSec = pollTimeoutSec;
    this.platform = "telegram";
    this.maxLength = 4096;
    this.capabilities = { text: true, attachments: true, groups: true, typing: true, provisioning: "token" };
  }

  async api(method, body, timeoutMs = 15_000) {
    let res;
    try {
      res = await this.fetch(`${this.apiBase}/bot${this.token}/${method}`, {
        method: "POST",
        headers: body instanceof FormData ? {} : { "Content-Type": "application/json" },
        body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ChannelError("network", `Không kết nối được Telegram (${error.name})`);
    }
    const data = await res.json().catch(() => ({}));
    if (data.ok) return data.result;
    if (res.status === 401 || res.status === 404) throw new ChannelError("credential_invalid", "Token Telegram sai hoặc đã bị thu hồi");
    if (res.status === 409) throw new ChannelError("connection_conflict", "Bot này đang được một chương trình khác nhận tin (webhook hoặc polling khác)");
    if (res.status === 429) {
      const after = Number(data.parameters?.retry_after ?? 5) * 1000;
      throw new ChannelError("rate_limited", "Telegram yêu cầu gửi chậm lại", after);
    }
    throw new ChannelError("platform_error", `Telegram lỗi ${res.status}: ${data.description ?? ""}`);
  }

  async getMe() {
    const me = await this.api("getMe");
    this.selfId = me.id;
    return { id: String(me.id), username: me.username ?? "", name: me.first_name ?? "" };
  }

  /** Refuses to start when a webhook is set: removing it is the operator's decision, not ours. */
  async checkConflict() {
    const info = await this.api("getWebhookInfo");
    if (info.url) return { conflict: true, detail: `Bot đang dùng webhook: ${new URL(info.url).host}` };
    return { conflict: false };
  }

  /** One long-poll. Returns {events, cursor}. */
  async fetchUpdates(cursor) {
    const updates = await this.api(
      "getUpdates",
      { offset: cursor, timeout: this.pollTimeoutSec, allowed_updates: ["message"] },
      (this.pollTimeoutSec + 15) * 1000,
    );
    let next = cursor;
    const events = [];
    for (const u of updates) {
      next = u.update_id + 1;
      const m = u.message;
      if (!m || !m.from || m.from.is_bot) continue;
      events.push({
        eventId: String(u.update_id),
        chatId: String(m.chat.id),
        chatType: m.chat.type === "private" ? "private" : "group",
        senderId: String(m.from.id),
        senderName: [m.from.first_name, m.from.last_name].filter(Boolean).join(" ") || m.from.username || "",
        text: m.text ?? m.caption,
        messageId: String(m.message_id),
        topicId: m.message_thread_id,
        replyToBot: Boolean(this.selfId && m.reply_to_message?.from?.id === this.selfId),
        attachments: telegramAttachments(m),
      });
    }
    return { events, cursor: next };
  }

  async sendText(chatId, text, context = {}) {
    return this.api("sendMessage", { chat_id: chatId, text, ...(context.topicId ? { message_thread_id: context.topicId } : {}), link_preview_options: { is_disabled: true } });
  }

  async downloadAttachment(item, maxBytes) {
    const file = await this.api("getFile", { file_id: item.fileId });
    if (!file.file_path || file.file_path.split("/").some((part) => part === "..") || file.file_size > maxBytes) throw new Error("Không thể tải tệp Telegram hoặc tệp quá lớn.");
    const loaded = await downloadMedia(`${this.apiBase}/file/bot${this.token}/${file.file_path}`, { hosts: ["api.telegram.org"], maxBytes, fetchImpl: this.fetch });
    return { ...loaded, mime: item.mime || loaded.mime };
  }

  async sendAttachment(chatId, item, context = {}) {
    const kind = item.kind || "file";
    const [method, field] = ({ image: ["sendPhoto", "photo"], video: ["sendVideo", "video"], audio: ["sendAudio", "audio"], file: ["sendDocument", "document"] })[kind];
    const form = new FormData();
    form.set("chat_id", chatId);
    if (context.topicId) form.set("message_thread_id", String(context.topicId));
    form.set(field, new Blob([Buffer.from(item.data, "base64")], { type: item.mime }), item.name);
    return this.api(method, form, 60_000);
  }

  async typing(chatId) {
    await this.api("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  }
}

export function telegramAttachments(m) {
  if (m.photo?.length) {
    const photo = m.photo.at(-1);
    return [{ kind: "image", fileId: photo.file_id, size: photo.file_size, mime: "image/jpeg", name: "photo.jpg" }];
  }
  for (const [key, kind, mime, name] of [["video", "video", "video/mp4", "video.mp4"], ["animation", "video", "video/mp4", "animation.mp4"], ["voice", "audio", "audio/ogg", "voice.ogg"], ["audio", "audio", "audio/mpeg", "audio.mp3"], ["document", "file", "application/octet-stream", "document.bin"]]) {
    const file = m[key];
    if (file) return [{ kind, fileId: file.file_id, size: file.file_size, mime: file.mime_type || mime, name: file.file_name || name }];
  }
  return [];
}
