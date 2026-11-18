// Discord through its Gateway (API v10) for incoming messages and REST for replies. Only the non-privileged intents are
// asked for: Discord still hands a bot the text of direct messages and of messages that mention it, which is all it answers.
import WebSocket from "ws";

import { ChannelError, wait, type ChannelAdapter, type ChannelMessage } from "./engine.ts";
import { channelFileBlob, fetchChannelMedia, readChannelMedia } from "./channel-media.ts";

const API = "https://discord.com/api/v10";
const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";
const INTENTS = (1 << 9) | (1 << 12);
const FATAL_CLOSE: Record<number, string> = {
  4004: "Token Discord không còn dùng được. Dán token mới từ Discord Developer Portal.",
  4010: "Discord từ chối kết nối (4010).", 4011: "Bot Discord cần chia shard: bot đang ở quá nhiều server.",
  4012: "Discord từ chối phiên bản kết nối (4012).", 4013: "Discord từ chối quyền đọc tin (4013).", 4014: "Discord từ chối quyền đọc tin (4014).",
};

export interface SocketLike {
  on(event: "message", listener: (data: unknown) => void): unknown;
  on(event: "close", listener: (code: number) => void): unknown;
  on(event: "error", listener: (error: unknown) => void): unknown;
  send(data: string): void;
  close(code?: number): void;
}

export interface DiscordOptions { fetch?: typeof fetch; openSocket?(url: string): SocketLike; sleep?(ms: number, signal: AbortSignal): Promise<void> }

export function discordAdapter(options: DiscordOptions = {}): ChannelAdapter {
  const call = options.fetch ?? fetch;
  const openSocket = options.openSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  const sleep = options.sleep ?? wait;

  async function rest(token: string, method: string, path: string, body?: unknown) {
    const multipart = body instanceof FormData;
    const response = await call(`${API}${path}`, { method, redirect: "error", headers: { authorization: `Bot ${token}`, ...(body && !multipart ? { "content-type": "application/json" } : {}) }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) })
      .catch((error: unknown) => { throw new ChannelError("retry", `Discord: ${error instanceof Error ? error.message : String(error)}`); });
    if (response.ok) return response.status === 204 ? null : response.json().catch(() => null);
    const data = await response.json().catch(() => ({})) as { retry_after?: number; message?: string };
    if (response.status === 401) throw new ChannelError("auth", FATAL_CLOSE[4004]!);
    if (response.status === 429 || response.status >= 500) throw new ChannelError("retry", `Discord báo lỗi ${response.status}.`, data.retry_after ? Math.ceil(data.retry_after * 1000) : undefined);
    throw new ChannelError("drop", `Discord báo lỗi ${response.status}${data.message ? `: ${data.message}` : ""}.`);
  }

  return {
    kind: "discord",
    label: "Discord",
    textMax: 2000,
    async check(token) {
      if (!/^[\w.-]{50,100}$/.test(token)) throw new ChannelError("auth", "Token không đúng dạng. Copy token ở mục Bot của Discord Developer Portal.");
      const me = await rest(token, "GET", "/users/@me").catch(() => null) as { username?: string; global_name?: string; bot?: boolean } | null;
      if (!me?.username || !me.bot) throw new ChannelError("auth", "Discord không nhận token bot này.");
      return { username: me.username, name: me.global_name ?? me.username };
    },
    async open(token, io) {
      let self = "";
      let resume: { id: string; url: string } | undefined;
      let seq: number | null = null;
      const toMessage = (event: any): ChannelMessage | null => {
        if (!event?.author || event.author.bot || event.author.id === self) return null;
        const direct = !event.guild_id;
        const mentioned = Array.isArray(event.mentions) && event.mentions.some((user: { id?: string }) => user?.id === self);
        if (!direct && !mentioned) return null;
        const attachment = Array.isArray(event.attachments) ? event.attachments[0] : undefined;
        return {
          id: String(event.id), chatId: String(event.channel_id), direct,
          from: { id: String(event.author.id), name: event.member?.nick ?? event.author.global_name ?? event.author.username ?? String(event.author.id) },
          text: String(event.content ?? "").replace(new RegExp(`<@!?${self}>`, "g"), "").trim(),
          ...(attachment ? { media: true } : {}),
          ...(typeof attachment?.url === "string" ? { loadMedia: () => fetchChannelMedia(attachment.url, ["cdn.discordapp.com", "media.discordapp.net"], attachment.filename ?? "attachment.bin") } : {}),
        };
      };

      /** One Gateway connection; resolves when it closes in a way worth reconnecting after. */
      const connectOnce = () => new Promise<void>((resolve, reject) => {
        const socket = openSocket(resume?.url ? `${resume.url}/?v=10&encoding=json` : GATEWAY);
        let beat: ReturnType<typeof setInterval> | undefined;
        let acked = true;
        const stop = () => { if (beat) clearInterval(beat); io.signal.removeEventListener("abort", onAbort); };
        const onAbort = () => { stop(); socket.close(1000); resolve(); };
        io.signal.addEventListener("abort", onAbort, { once: true });
        socket.on("error", () => {});
        socket.on("close", (code) => {
          stop();
          if (FATAL_CLOSE[code]) return reject(new ChannelError(code === 4004 ? "auth" : "conflict", FATAL_CLOSE[code]!));
          if (code === 4007 || code === 4009) { resume = undefined; seq = null; }
          resolve();
        });
        socket.on("message", (raw) => {
          let packet: { op: number; d: any; s?: number | null; t?: string };
          try { packet = JSON.parse(String(raw)); } catch { return; }
          if (typeof packet.s === "number") seq = packet.s;
          if (packet.op === 10) {
            const every = Number(packet.d?.heartbeat_interval) || 41_250;
            beat = setInterval(() => {
              if (!acked) { socket.close(4000); return; }
              acked = false;
              socket.send(JSON.stringify({ op: 1, d: seq }));
            }, every);
            socket.send(JSON.stringify(resume && seq !== null
              ? { op: 6, d: { token, session_id: resume.id, seq } }
              : { op: 2, d: { token, intents: INTENTS, properties: { os: process.platform, browser: "limix-bot", device: "limix-bot" } } }));
          } else if (packet.op === 11) acked = true;
          else if (packet.op === 1) socket.send(JSON.stringify({ op: 1, d: seq }));
          else if (packet.op === 7) socket.close(4000);
          else if (packet.op === 9) { if (!packet.d) { resume = undefined; seq = null; } socket.close(4000); }
          else if (packet.op === 0) {
            if (packet.t === "READY") { self = String(packet.d?.user?.id ?? ""); resume = { id: String(packet.d?.session_id ?? ""), url: String(packet.d?.resume_gateway_url ?? "") }; io.healthy(); }
            else if (packet.t === "RESUMED") io.healthy();
            else if (packet.t === "MESSAGE_CREATE") { const message = toMessage(packet.d); if (message) io.deliver(message); }
          }
        });
      });

      const done = (async () => {
        let drops = 0;
        while (!io.signal.aborted) {
          const started = Date.now();
          await connectOnce();
          if (io.signal.aborted) return;
          drops = Date.now() - started > 60_000 ? 0 : drops + 1;
          if (drops > 5) throw new ChannelError("retry", "Discord liên tục ngắt kết nối.");
          await sleep(1_000 + Math.random() * 4_000, io.signal);
        }
      })();
      return {
        done,
        send: async (chatId, text) => { await rest(token, "POST", `/channels/${chatId}/messages`, { content: text, allowed_mentions: { parse: [] } }); },
        sendMedia: async (chatId, attachment) => {
          const file = await readChannelMedia(attachment);
          const form = new FormData();
          form.set("payload_json", JSON.stringify({ allowed_mentions: { parse: [] }, attachments: [{ id: 0, filename: file.filename }] }));
          form.set("files[0]", channelFileBlob(file), file.filename);
          await rest(token, "POST", `/channels/${chatId}/messages`, form);
        },
        typing: async (chatId) => { await rest(token, "POST", `/channels/${chatId}/typing`); },
      };
    },
  };
}
