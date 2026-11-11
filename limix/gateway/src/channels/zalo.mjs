// Zalo Bot Platform API (https://docs.zaloplatforms.com/zalo-bot, checked 2026-11-11):
// POST https://bot-api.zaloplatforms.com/bot<TOKEN>/<method>, JSON body.
// getUpdates long-polls and returns ONE update object in `result` (not an array); it has no offset parameter.
// sendMessage text is 1–2000 characters. A registered webhook silently stops getUpdates, so it is checked first.
import { ChannelError } from "./telegram.mjs";

export class ZaloChannel {
  constructor({ token, apiBase = "https://bot-api.zaloplatforms.com", fetchImpl = fetch, pollTimeoutSec = 25, emptyPollDelayMs = 3000 }) {
    this.token = token;
    this.apiBase = apiBase.replace(/\/+$/, "");
    this.fetch = fetchImpl;
    this.pollTimeoutSec = pollTimeoutSec;
    this.emptyPollDelayMs = emptyPollDelayMs;
    this.platform = "zalo";
    this.maxLength = 2000;
    this.capabilities = { text: true, attachments: false, groups: false, typing: true, provisioning: "token" };
  }

  async api(method, body, timeoutMs = 15_000) {
    let res;
    try {
      res = await this.fetch(`${this.apiBase}/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ChannelError("network", `Không kết nối được Zalo (${error.name})`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return data.result;
    const code = Number(data.error_code ?? res.status);
    if (code === 401) throw new ChannelError("credential_invalid", "Token Zalo sai hoặc đã hết hạn");
    if (code === 408) return null;
    if (code === 429) throw new ChannelError("rate_limited", "Zalo báo vượt hạn mức", 10_000);
    const failure = new ChannelError("platform_error", `Zalo lỗi ${code} (${method}): ${data.description ?? ""}`);
    failure.httpCode = code;
    throw failure;
  }

  async getMe() {
    const me = await this.api("getMe");
    return { id: String(me?.id ?? ""), username: me?.account_name ?? me?.username ?? "", name: me?.display_name ?? me?.account_name ?? "" };
  }

  async checkConflict() {
    let info;
    try {
      info = await this.api("getWebhookInfo");
    } catch (error) {
      // Zalo answers 404 when the bot has no webhook at all: that is "no conflict", not a failure.
      if (error.httpCode === 404) return { conflict: false };
      throw error;
    }
    if (info?.url) return { conflict: true, detail: `Bot đang dùng webhook: ${info.url}` };
    return { conflict: false };
  }

  async fetchUpdates(cursor) {
    let result;
    try {
      result = await this.api("getUpdates", { timeout: String(this.pollTimeoutSec) }, (this.pollTimeoutSec + 15) * 1000);
    } catch (error) {
      if (error.httpCode !== 404) throw error;
      // Some Zalo bots answer an empty poll with 404 right away instead of waiting; pause so it does not spin.
      await new Promise((resolve) => setTimeout(resolve, this.emptyPollDelayMs));
      return { events: [], cursor };
    }
    if (!result || !result.message) return { events: [], cursor };
    const m = result.message;
    if (m.from?.is_bot) return { events: [], cursor };
    const isText = result.event_name === "message.text.received";
    return {
      cursor,
      events: [{
        eventId: String(m.message_id ?? `${m.chat?.id}:${m.date}`),
        chatId: String(m.chat?.id ?? m.from?.id),
        chatType: String(m.chat?.chat_type ?? "PRIVATE").toUpperCase() === "PRIVATE" ? "private" : "group",
        senderId: String(m.from?.id ?? ""),
        senderName: m.from?.display_name ?? "",
        text: isText && typeof m.text === "string" ? m.text : undefined,
      }],
    };
  }

  async sendText(chatId, text) {
    return this.api("sendMessage", { chat_id: chatId, text });
  }

  async typing(chatId) {
    await this.api("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  }
}
