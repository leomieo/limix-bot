import { mediaPolicy, receiveMedia, checkMedia } from "./media.mjs";
// Decides what to do with one accepted inbound message: commands, access (owner / approved / pairing),
// then one engine call per message, serialized per session so a thread never gets two turns at once.
import { splitMessage } from "./chunk.mjs";
import { hashCode } from "./pairing.mjs";
import { Store } from "./store.mjs";

const DECLINE_REPEAT_MS = 24 * 60 * 60_000;
const TYPING_EVERY_MS = 4000;

export const TEXT = {
  help: (name) => [
    `Xin chào! Đây là ${name || "bot"} chạy bằng Limix Bot.`,
    "Lệnh:",
    "/new — bắt đầu cuộc trò chuyện mới",
    "/status — xem trạng thái",
    "/id — xem ID của bạn",
    "/pair — xin quyền dùng bot (gửi mã cho chủ bot duyệt)",
  ].join("\n"),
  textOnly: "Loại tin nhắn này chưa được kết nối hỗ trợ. Hãy gửi văn bản hoặc loại tệp đã bật trong thiết lập.",
  ownerOnly: "Bot này hiện chỉ dành cho chủ bot.",
  pairCode: (code) => `Mã ghép cặp của bạn: ${code}\nGửi mã này cho chủ bot để được duyệt (mã hết hạn sau 1 giờ).`,
  pairPending: "Yêu cầu của bạn đang chờ chủ bot duyệt.",
  pairRateLimited: "Bạn vừa xin mã. Vui lòng thử lại sau 10 phút.",
  pairFull: "Đang có quá nhiều yêu cầu chờ duyệt. Vui lòng thử lại sau.",
  approvedYou: "Chủ bot đã duyệt. Bạn có thể bắt đầu nhắn tin.",
  linked: "Đã xác nhận bạn là chủ bot này.",
  linkBad: "Mã liên kết không đúng hoặc đã hết hạn. Tạo mã mới trong Limix.",
  newSession: "Đã bắt đầu cuộc trò chuyện mới.",
  needsApproval: "Bot cần chủ duyệt một thao tác trong ứng dụng Limix Bot. Sau khi duyệt, hãy nhắn tiếp để nhận kết quả.",
  stillWorking: "Bot vẫn đang xử lý lâu hơn dự kiến. Bạn hãy nhắn lại sau ít phút để nhận kết quả.",
  busy: "Bot đang trả lời tin trước của bạn, vui lòng chờ một chút.",
  emptyReply: "(Bot không gửi câu trả lời bằng chữ.)",
  engineDown: "Bot tạm thời không trả lời được. Chủ bot đã được báo trong Limix.",
  interrupted: "Tin nhắn trước của bạn bị gián đoạn vì Limix vừa khởi động lại. Vui lòng gửi lại.",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function sendWithRetry(channel, chatId, text, attempts = 3, context = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await channel.sendText(chatId, text, context);
    } catch (error) {
      lastError = error;
      if (error.code === "credential_invalid") throw error;
      await sleep(error.retryAfterMs ?? 1000 * 2 ** i);
    }
  }
  throw lastError;
}

/** The names a group member may call the bot by: its @username and its display name. */
function callNames(conn) {
  return [conn.botIdentity?.username, conn.botIdentity?.name, conn.name].filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim().toLowerCase());
}

export function calledIn(conn, text) {
  const lower = text.toLowerCase();
  return callNames(conn).some((n) => lower.includes(`@${n}`)) || /^\/\w+/.test(text);
}

export function stripCall(conn, text) {
  let out = text;
  for (const n of callNames(conn)) out = out.replace(new RegExp(`@${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), " ");
  return out.replace(/\s+/g, " ").trim();
}

export function roleOf(conn, senderId) {
  if (conn.ownerIds.includes(senderId)) return "owner";
  if (conn.allowedIds.includes(senderId)) return "member";
  if (conn.accessPolicy === "open") return "external";
  return "unknown";
}

export class Router {
  constructor({ store, pairing, now = () => Date.now() }) {
    this.store = store;
    this.pairing = pairing;
    this.now = now;
    this.queues = new Map();
    this.declined = new Map();
  }

  async reply(channel, chatId, text, context = {}) {
    for (const part of splitMessage(text, channel.maxLength)) await sendWithRetry(channel, chatId, part, 3, context);
  }

  /** Handles one event that the store already accepted. Never throws. */
  async handle({ conn, channel, engine, event }) {
    this.store.markEvent(conn.id, event.eventId, "processing");
    try {
      const outcome = await this.process({ conn, channel, engine, event });
      this.store.markEvent(conn.id, event.eventId, outcome ?? "done");
    } catch (error) {
      this.store.markEvent(conn.id, event.eventId, "failed");
      this.store.log(conn.id, "error", `Xử lý tin thất bại: ${error.message}`);
    }
  }

  async process({ conn, channel, engine, event }) {
    if (event.chatType !== "private") return this.processGroup({ conn, channel, engine, event });
    if (event.text === undefined && !event.attachments?.length) {
      await this.reply(channel, event.chatId, TEXT.textOnly);
      return "unsupported";
    }
    const text = (event.text ?? "").trim();
    const cmd = /^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text);
    const role = roleOf(conn, event.senderId);
    const sessionKey = Store.sessionKey(conn.id, event.topicId ? `${event.chatId}:${event.topicId}` : event.chatId, event.senderId);

    if (cmd) {
      const name = cmd[1].toLowerCase();
      const arg = (cmd[2] ?? "").trim();
      switch (name) {
        case "start":
        case "help":
          await this.reply(channel, event.chatId, TEXT.help(conn.botIdentity?.name));
          return "command";
        case "id":
          await this.reply(channel, event.chatId, `ID ${conn.platform} của bạn: ${event.senderId}`);
          return "command";
        case "link": {
          if (arg && this.store.takeLinkCode(conn.id, hashCode(arg))) {
            if (!conn.ownerIds.includes(event.senderId)) {
              this.store.updateConnection(conn.id, { ownerIds: [...conn.ownerIds, event.senderId] });
            }
            this.store.log(conn.id, "owner", `Đã liên kết chủ bot: ${event.senderName} (${event.senderId})`);
            await this.reply(channel, event.chatId, TEXT.linked);
          } else {
            await this.reply(channel, event.chatId, TEXT.linkBad);
          }
          return "command";
        }
        case "approve": {
          if (role !== "owner") break;
          const result = this.pairing.approve(conn.id, arg);
          if (result.approved) {
            const id = result.approved.senderId;
            if (!conn.allowedIds.includes(id)) this.store.updateConnection(conn.id, { allowedIds: [...conn.allowedIds, id] });
            this.store.log(conn.id, "pairing", `Chủ bot duyệt ${result.approved.senderName} (${id}) qua chat`);
            await this.reply(channel, event.chatId, `Đã duyệt ${result.approved.senderName || id}.`);
            await this.reply(channel, id, TEXT.approvedYou).catch(() => {});
          } else {
            await this.reply(channel, event.chatId, result.error === "locked_out" ? "Nhập sai quá nhiều lần, thử lại sau 1 giờ." : "Mã không đúng hoặc đã hết hạn.");
          }
          return "command";
        }
        case "new":
          this.store.resetSession(sessionKey);
          await this.reply(channel, event.chatId, TEXT.newSession);
          return "command";
        case "status":
          await this.reply(channel, event.chatId, [
            `Trạng thái: ${conn.status}`,
            `AI: ${engine.kind === "echo" ? "chế độ thử" : "Limix Bot"}`,
            `Quyền của bạn: ${{ owner: "chủ bot", member: "đã duyệt", external: "khách", unknown: "chưa được duyệt" }[role]}`,
          ].join("\n"));
          return "command";
        case "pair":
          if (role === "unknown") return this.decline({ conn, channel, event, explicit: true });
          await this.reply(channel, event.chatId, "Bạn đã có quyền dùng bot.");
          return "command";
        default:
          break;
      }
    }

    if (role === "unknown") return this.decline({ conn, channel, event, explicit: false });
    return this.enqueue(sessionKey, () => this.runTurn({ conn, channel, engine, event, text, sessionKey }));
  }

  /** A group chat: the bot answers when called by name (or every message, if the owner chose it), only for people it
   * already serves; a stranger in a group is never sent a pairing code there. One shared conversation per group. */
  async processGroup({ conn, channel, engine, event }) {
    const mode = conn.groupMode ?? "mention";
    if (mode === "off" || (event.text === undefined && !event.attachments?.length)) return "ignored_group";
    const raw = (event.text ?? "").trim();
    const called = event.mentionedBot || calledIn(conn, raw);
    if (mode !== "all" && !called && !event.replyToBot) return "ignored_group";
    const text = stripCall(conn, raw);
    if (!text && !event.attachments?.length) return "ignored_group";
    if (/^\/(link|approve|pair)\b/i.test(text)) {
      await this.reply(channel, event.chatId, "Lệnh này chỉ dùng khi nhắn riêng cho bot.");
      return "command";
    }
    if (roleOf(conn, event.senderId) === "unknown") return "ignored_group";
    const sessionKey = Store.sessionKey(conn.id, event.topicId ? `${event.chatId}:${event.topicId}` : event.chatId, "group");
    const said = event.senderName ? `${event.senderName}: ${text}` : text;
    return this.enqueue(sessionKey, () => this.runTurn({ conn, channel, engine, event, text: said, sessionKey }));
  }

  async decline({ conn, channel, event, explicit }) {
    if (conn.accessPolicy === "pairing") {
      const result = this.pairing.request(conn.id, event.senderId, event.senderName);
      if (result.code) {
        this.store.log(conn.id, "pairing", `Yêu cầu ghép cặp mới từ ${event.senderName} (${event.senderId})`);
        await this.reply(channel, event.chatId, TEXT.pairCode(result.code));
        return "pairing_requested";
      }
      const words = { already_pending: TEXT.pairPending, rate_limited: TEXT.pairRateLimited, too_many_pending: TEXT.pairFull }[result.refused];
      await this.replyOncePerDay(conn, channel, event, words, explicit);
      return "declined";
    }
    await this.replyOncePerDay(conn, channel, event, TEXT.ownerOnly, explicit);
    return "declined";
  }

  async replyOncePerDay(conn, channel, event, text, force) {
    const key = `${conn.id}:${event.senderId}:${text}`;
    const last = this.declined.get(key);
    if (!force && last && this.now() - last < DECLINE_REPEAT_MS) return;
    this.declined.set(key, this.now());
    await this.reply(channel, event.chatId, text);
  }

  enqueue(key, task) {
    const prev = this.queues.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(task);
    this.queues.set(key, next);
    next.finally(() => { if (this.queues.get(key) === next) this.queues.delete(key); }).catch(() => {});
    return next;
  }

  async runTurn({ conn, channel, engine, event, text, sessionKey }) {
    if (roleOf(conn, event.senderId) === "unknown" || conn.enabled === false) return "declined";
    channel.typing(event.chatId);
    const typing = setInterval(() => channel.typing(event.chatId), TYPING_EVERY_MS);
    try {
      // Only the linked owner, in a private chat, gets the owner lane (any AI); everyone else stays confined.
      const owner = roleOf(conn, event.senderId) === "owner" && event.chatType === "private";
      const policy = mediaPolicy(conn.media);
      let attachments;
      try {
        attachments = await receiveMedia(channel, event.attachments, policy);
      } catch {
        await this.reply(channel, event.chatId, "Không nhận được tệp: kiểm tra loại tệp, giới hạn dung lượng và quyền nhận media trong thiết lập kết nối.", event);
        return "media_rejected";
      }
      const answer = await engine.send({ message: text || "Please inspect the attached files.", attachments, thread: this.store.getThread(sessionKey), owner });
      if (answer.thread) this.store.setThread(sessionKey, answer.thread);
      if (typeof answer.reply === "string") {
        if (answer.reply.trim()) await this.reply(channel, event.chatId, answer.reply.trim(), event);
        const outgoing = answer.attachments ?? [];
        if (outgoing.length) {
          try {
            checkMedia(outgoing, policy, "send");
            if (!channel.sendAttachment) throw new Error("unsupported");
            if (["zalo", "facebook"].includes(conn.platform) && !conn.publicMediaBase) throw new Error("public media is not configured");
            if (conn.platform === "zalo" && outgoing.some((a) => a.kind !== "image" && !(a.kind === "audio" && a.mime === "audio/aac" && event.chatType === "private"))) throw new Error("unsupported Zalo attachment");
          } catch {
            await this.reply(channel, event.chatId, "Bot đã tạo tệp nhưng kết nối này chưa cho phép gửi loại tệp đó. Xem tệp trong Limix Bot.", event);
            return "media_blocked";
          }
          let delivered = 0;
          for (const item of outgoing) {
            try {
              const receipt = await channel.sendAttachment(event.chatId, item, event);
              if (!receipt?.message_id && !receipt?.id) throw new Error("Missing platform receipt");
              delivered++;
              this.store.log(conn.id, "media", `Nền tảng nhận tệp ${delivered}/${outgoing.length}: ${String(receipt?.message_id ?? receipt?.id ?? "accepted")}`);
            } catch {
              await this.reply(channel, event.chatId, `Đã gửi ${delivered}/${outgoing.length} tệp. Tệp tiếp theo chưa xác nhận gửi thành công; không tự gửi lại để tránh trùng.`, event);
              return "media_partial";
            }
          }
        } else if (!answer.reply.trim()) await this.reply(channel, event.chatId, TEXT.emptyReply, event);
        if (answer.mediaError) await this.reply(channel, event.chatId, "Một số tệp Bot tạo vượt giới hạn gửi. Xem bản đầy đủ trong Limix Bot.", event);
        return "replied";
      }
      if (answer.status === "needs_approval") {
        this.store.log(conn.id, "approval", "Bot dừng ở bước cần duyệt — mở Limix Bot để duyệt");
        await this.reply(channel, event.chatId, TEXT.needsApproval);
        return "needs_approval";
      }
      await this.reply(channel, event.chatId, TEXT.stillWorking);
      return "working";
    } catch (error) {
      if (error.code === "busy") {
        await this.reply(channel, event.chatId, TEXT.busy);
        return "busy";
      }
      this.store.log(conn.id, "engine", `${error.code ?? "error"}: ${error.message}`);
      this.store.updateConnection(conn.id, { statusDetail: `Lỗi AI: ${error.message}` });
      await this.reply(channel, event.chatId, TEXT.engineDown).catch(() => {});
      return "engine_error";
    } finally {
      clearInterval(typing);
    }
  }
}
