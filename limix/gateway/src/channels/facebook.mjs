import { createHmac, timingSafeEqual } from "node:crypto";
import { ChannelError } from "./telegram.mjs";
import { downloadMedia } from "../media.mjs";
import { publicMedia } from "../public-media.mjs";

export function validFacebookSignature(raw, signature, secret) {
  if (!secret || typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature.slice(7), "hex"), createHmac("sha256", secret).update(raw).digest());
}

export function facebookEvents(body, pageId) {
  if (body.object !== "page" || !Array.isArray(body.entry)) return [];
  return body.entry.filter((entry) => String(entry.id) === pageId).flatMap((entry) => (entry.messaging ?? []).flatMap((event) => {
    const m = event.message;
    if (!m?.mid || m.is_echo || !event.sender?.id || String(event.recipient?.id) !== pageId) return [];
    return [{ eventId: m.mid, chatId: String(event.sender.id), chatType: "private", senderId: String(event.sender.id), senderName: "", text: m.text,
      attachments: (m.attachments ?? []).filter((a) => ["image", "audio", "video", "file"].includes(a.type) && a.payload?.url).map((a) => ({ kind: a.type, url: a.payload.url })) }];
  }));
}

export class FacebookChannel {
  constructor({ token, pageId, apiVersion = "v22.0", publicMediaBase = "", fetchImpl = fetch }) {
    if (!/^\d{1,40}$/.test(pageId ?? "") || !/^v\d{1,2}\.0$/.test(apiVersion)) throw new Error("Page ID hoặc phiên bản Graph API không hợp lệ.");
    this.token = token; this.pageId = pageId; this.apiVersion = apiVersion; this.publicMediaBase = publicMediaBase; this.fetch = fetchImpl;
    this.platform = "facebook"; this.maxLength = 2000;
    this.capabilities = { text: true, attachments: true, groups: false, typing: true, provisioning: "page-webhook" };
  }
  async api(path, body) {
    const response = await this.fetch(`https://graph.facebook.com/${this.apiVersion}/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
    const data = await response.json();
    if (!response.ok || data.error) throw new ChannelError(data.error?.code === 190 ? "credential_invalid" : "platform_error", `Facebook từ chối yêu cầu (${data.error?.code ?? response.status}). Kiểm tra quyền Page, App Review và thời hạn trả lời.`);
    return data;
  }
  async getMe() { const me = await this.api("me?fields=id,name"); if (String(me.id) !== this.pageId) throw new Error("Token không thuộc Page ID đã nhập."); return { id: String(me.id), name: me.name, username: "" }; }
  async checkConflict() { return { conflict: false }; }
  async fetchUpdates(cursor) { await new Promise((resolve) => { this.waiter = resolve; this.timer = setTimeout(resolve, 25_000); }); return { events: [], cursor }; }
  close() { clearTimeout(this.timer); this.waiter?.(); }
  async sendText(chatId, text) { return this.api(`${this.pageId}/messages`, { recipient: { id: chatId }, messaging_type: "RESPONSE", message: { text } }); }
  async typing(chatId) { await this.api(`${this.pageId}/messages`, { recipient: { id: chatId }, sender_action: "typing_on" }).catch(() => {}); }
  async downloadAttachment(item, maxBytes) {
    return downloadMedia(item.url, { hosts: [".fbcdn.net", ".fbsbx.com"], maxBytes, fetchImpl: this.fetch });
  }
  async sendAttachment(chatId, item) {
    const url = publicMedia.publish(this.publicMediaBase, item);
    return this.api(`${this.pageId}/messages`, { recipient: { id: chatId }, messaging_type: "RESPONSE", message: { attachment: { type: item.kind, payload: { url, is_reusable: false } } } });
  }
}
