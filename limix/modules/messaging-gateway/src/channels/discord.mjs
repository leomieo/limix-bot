import { downloadMedia, mediaKind } from "../media.mjs";
// Discord bot (https://discord.com/developers/docs/events/gateway): one WebSocket to the Gateway (outbound only, no public
// address needed) for incoming messages, the REST API for replies. In the Developer Portal the bot needs the
// "Message Content Intent" switched on (Bot > Privileged Gateway Intents), or it sees empty messages in servers.
import { ChannelError } from "./telegram.mjs";

const INTENTS = (1 << 9) | (1 << 12) | (1 << 15); // GUILD_MESSAGES | DIRECT_MESSAGES | MESSAGE_CONTENT
const FATAL = { 4004: "Token Discord sai hoặc đã bị thu hồi", 4010: "Cấu hình shard sai", 4011: "Bot cần chia shard", 4012: "Phiên bản API không hợp lệ", 4013: "Intents không hợp lệ", 4014: "Hãy bật \"Message Content Intent\" trong Discord Developer Portal (Bot → Privileged Gateway Intents) rồi kết nối lại" };

export class DiscordChannel {
  constructor({ token, apiBase = "https://discord.com/api/v10", gatewayUrl = "wss://gateway.discord.gg/?v=10&encoding=json", fetchImpl = fetch, WebSocketImpl = globalThis.WebSocket, pollTimeoutSec = 25 }) {
    this.token = token;
    this.apiBase = apiBase.replace(/\/+$/, "");
    this.gatewayUrl = gatewayUrl;
    this.fetch = fetchImpl;
    this.WebSocket = WebSocketImpl;
    this.pollTimeoutSec = pollTimeoutSec;
    this.platform = "discord";
    this.maxLength = 2000;
    this.capabilities = { text: true, attachments: true, groups: true, typing: true, provisioning: "token" };
    this.queue = [];
    this.waiter = null;
    this.fatal = null;
    this.ws = null;
    this.heartbeat = null;
    this.sequence = null;
    this.sessionId = null;
    this.resumeUrl = null;
    this.selfId = "";
    this.closed = false;
    this.retry = null;
  }

  async api(method, path, body, timeoutMs = 15_000) {
    let res;
    try {
      res = await this.fetch(`${this.apiBase}${path}`, {
        method,
        headers: { Authorization: `Bot ${this.token}`, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), "User-Agent": "LimixBot (https://github.com/leomieo/limix-bot, 0.3)" },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ChannelError("network", `Không kết nối được Discord (${error.name})`);
    }
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (res.status === 401) throw new ChannelError("credential_invalid", "Token Discord sai hoặc đã bị thu hồi");
    if (res.status === 429) throw new ChannelError("rate_limited", "Discord yêu cầu gửi chậm lại", Math.ceil(Number(data.retry_after ?? 5) * 1000));
    throw new ChannelError("platform_error", `Discord lỗi ${res.status}: ${data.message ?? ""}`);
  }

  async getMe() {
    const me = await this.api("GET", "/users/@me");
    this.selfId = String(me.id);
    return { id: String(me.id), username: me.username ?? "", name: me.global_name ?? me.username ?? "" };
  }

  async checkConflict() {
    return { conflict: false };
  }

  connect(resume = false) {
    if (this.closed || !this.WebSocket) {
      if (!this.WebSocket) this.fatal = new ChannelError("platform_error", "Phiên bản chạy chương trình này không hỗ trợ WebSocket");
      return;
    }
    const ws = new this.WebSocket(resume && this.resumeUrl ? this.resumeUrl : this.gatewayUrl);
    this.ws = ws;
    ws.onmessage = (event) => {
      let packet;
      try { packet = JSON.parse(typeof event.data === "string" ? event.data : String(event.data)); } catch { return; }
      this.onPacket(packet, ws, resume);
    };
    ws.onclose = (event) => {
      clearInterval(this.heartbeat);
      if (this.ws !== ws) return;
      if (FATAL[event?.code]) {
        this.fatal = new ChannelError(event.code === 4014 ? "platform_error" : "credential_invalid", FATAL[event.code]);
        this.wake();
        return;
      }
      if (!this.closed) this.retry = setTimeout(() => this.connect(Boolean(this.sessionId)), 3000);
    };
    ws.onerror = () => {};
  }

  onPacket(packet, ws, resume) {
    if (packet.s != null) this.sequence = packet.s;
    switch (packet.op) {
      case 10: {
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 1, d: this.sequence })), packet.d.heartbeat_interval);
        this.heartbeat.unref?.();
        if (resume && this.sessionId) ws.send(JSON.stringify({ op: 6, d: { token: this.token, session_id: this.sessionId, seq: this.sequence } }));
        else ws.send(JSON.stringify({ op: 2, d: { token: this.token, intents: INTENTS, properties: { os: process.platform, browser: "limix-bot", device: "limix-bot" } } }));
        break;
      }
      case 7: ws.close(4000); break;
      case 9: this.sessionId = null; this.sequence = null; ws.close(4000); break;
      case 0:
        if (packet.t === "READY") { this.sessionId = packet.d.session_id; this.resumeUrl = packet.d.resume_gateway_url ? `${packet.d.resume_gateway_url}/?v=10&encoding=json` : null; this.selfId = String(packet.d.user?.id ?? this.selfId); }
        else if (packet.t === "MESSAGE_CREATE") this.onMessage(packet.d);
        break;
      default: break;
    }
  }

  onMessage(m) {
    if (!m || m.author?.bot || String(m.author?.id) === this.selfId) return;
    this.queue.push({
      eventId: String(m.id),
      chatId: String(m.channel_id),
      chatType: m.guild_id ? "group" : "private",
      senderId: String(m.author?.id ?? ""),
      senderName: m.author?.global_name || m.author?.username || "",
      text: typeof m.content === "string" && m.content ? m.content : undefined,
      mentionedBot: m.mentions?.some((u) => String(u.id) === this.selfId),
      replyToBot: String(m.referenced_message?.author?.id) === this.selfId,
      attachments: (m.attachments ?? []).map((a) => ({ kind: mediaKind(a.content_type), url: a.url, name: a.filename, mime: a.content_type, size: a.size })),
    });
    this.wake();
  }

  wake() {
    const waiter = this.waiter;
    this.waiter = null;
    waiter?.();
  }

  /** Waits for messages the open connection received (at most pollTimeoutSec). */
  async fetchUpdates(cursor) {
    if (this.fatal) throw this.fatal;
    if (!this.ws && !this.closed) this.connect();
    if (!this.queue.length) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, this.pollTimeoutSec * 1000);
        timer.unref?.();
        this.waiter = () => { clearTimeout(timer); resolve(); };
      });
    }
    if (this.fatal) throw this.fatal;
    return { events: this.queue.splice(0), cursor };
  }

  async sendText(chatId, text) {
    return this.api("POST", `/channels/${encodeURIComponent(chatId)}/messages`, { content: text, allowed_mentions: { parse: [] } });
  }

  async downloadAttachment(item, maxBytes) {
    const loaded = await downloadMedia(item.url, { hosts: ["cdn.discordapp.com", "media.discordapp.net"], maxBytes, fetchImpl: this.fetch });
    return { ...loaded, mime: item.mime || loaded.mime };
  }

  async sendAttachment(chatId, item) {
    const form = new FormData();
    form.set("payload_json", JSON.stringify({ allowed_mentions: { parse: [] }, attachments: [{ id: 0, filename: item.name }] }));
    form.set("files[0]", new Blob([Buffer.from(item.data, "base64")], { type: item.mime }), item.name);
    return this.api("POST", `/channels/${encodeURIComponent(chatId)}/messages`, form, 60_000);
  }

  async typing(chatId) {
    await this.api("POST", `/channels/${encodeURIComponent(chatId)}/typing`).catch(() => {});
  }

  close() {
    this.closed = true;
    clearInterval(this.heartbeat);
    clearTimeout(this.retry);
    try { this.ws?.close(1000); } catch { /* already closed */ }
    this.wake();
  }
}
