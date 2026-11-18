// Zalo personal accounts through zca-js (the Zalo Web protocol, unofficial): the owner signs a spare Zalo account in by
// scanning a QR code, and the session cookies are what this server keeps, sealed. Zalo allows one web session per account,
// so opening Zalo Web elsewhere ends this one (close code 3000).
import { ChannelError, type ChannelAdapter, type ChannelLogin, type ChannelMessage } from "./engine.ts";

import { receiveZaloMedia, zaloUpload } from "./zalo-media.ts";

const USER = 0, GROUP = 1;

export interface ZaloListener {
  on(event: "message", listener: (message: { type: number; threadId: string; isSelf: boolean; data: { msgType?: string; msgId: string; uidFrom: string; dName?: string; content: unknown; mentions?: Array<{ uid: string; pos: number; len: number }> } }) => void): unknown;
  on(event: "connected", listener: () => void): unknown;
  on(event: "closed", listener: (code: number, reason: string) => void): unknown;
  on(event: "error", listener: (error: unknown) => void): unknown;
  start(options?: { retryOnClose?: boolean }): void;
  stop(): void;
}
export interface ZaloApi {
  listener: ZaloListener;
  getOwnId(): string;
  fetchAccountInfo(): Promise<{ profile?: { displayName?: string; zaloName?: string; username?: string } }>;
  sendMessage(message: { msg: string; attachments?: Awaited<ReturnType<typeof zaloUpload>> }, threadId: string, type: number): Promise<unknown>;
  sendTypingEvent(threadId: string, type: number): Promise<unknown>;
}
export interface ZaloClient {
  login(credentials: unknown): Promise<ZaloApi>;
  loginQR(options: Record<string, never>, callback: (event: { type: number; data: any; actions: { abort(): unknown } | null }) => unknown): Promise<ZaloApi>;
}
export type ZaloLoader = () => Promise<ZaloClient>;

const loadZcaJs: ZaloLoader = async () => {
  const { Zalo } = (await import("zca-js")) as unknown as { Zalo: new (options: { selfListen: boolean; checkUpdate: boolean; logging: boolean }) => ZaloClient };
  return new Zalo({ selfListen: false, checkUpdate: false, logging: false });
};

const thread = (chatId: string) => ({ type: chatId.startsWith("g:") ? GROUP : USER, id: chatId.slice(2) });

export function zaloAdapter(load: ZaloLoader = loadZcaJs): ChannelAdapter {
  async function signIn(secret: string): Promise<ZaloApi> {
    let credentials: unknown;
    try { credentials = JSON.parse(secret); } catch { throw new ChannelError("auth", "Phiên Zalo hỏng. Quét mã QR lại."); }
    return (await load()).login(credentials).catch((error: unknown) => {
      throw new ChannelError("auth", `Phiên Zalo đã hết hạn hoặc bị đăng xuất. Quét mã QR lại. (${error instanceof Error ? error.message : String(error)})`);
    });
  }
  async function account(api: ZaloApi) {
    const info = await api.fetchAccountInfo().catch(() => null);
    const name = info?.profile?.displayName ?? info?.profile?.zaloName ?? "";
    return { username: api.getOwnId(), name };
  }
  return {
    kind: "zalo",
    label: "Zalo",
    textMax: 2000,
    quietToStrangers: true,
    paceMs: [400, 1_200],
    async check(secret) { return account(await signIn(secret)); },
    async open(secret, io) {
      const api = await signIn(secret);
      const self = api.getOwnId();
      const done = new Promise<void>((resolve, reject) => {
        const stop = () => { try { api.listener.stop(); } catch {} };
        io.signal.addEventListener("abort", () => { stop(); resolve(); }, { once: true });
        api.listener.on("connected", () => io.healthy());
        api.listener.on("error", () => {});
        api.listener.on("closed", (code) => {
          if (io.signal.aborted) return resolve();
          if (code === 3000 || code === 3003) return reject(new ChannelError("auth", "Tài khoản Zalo của bot vừa mở ở nơi khác (Zalo Web hoặc máy khác) nên bot đã dừng. Đóng nơi đó rồi tắt và bật lại Zalo ở đây."));
          reject(new ChannelError("retry", `Zalo ngắt kết nối (${code}).`));
        });
        api.listener.on("message", (event) => {
          if (event.isSelf || event.data.uidFrom === self) return;
          const direct = event.type === USER;
          const tag = (event.data.mentions ?? []).find((mention) => mention.uid === self);
          if (!direct && !tag) return;
          const content = event.data.content;
          const data = content && typeof content === "object" ? content as Record<string, unknown> : {};
          const photo = event.data.msgType === "chat.photo";
          const attachmentUrl = (photo || event.data.msgType === "chat.video.msg") && typeof data.href === "string" ? data.href : undefined;
          const said = typeof content !== "string" ? "" : tag && !direct ? content.slice(0, tag.pos) + content.slice(tag.pos + tag.len) : content;
          const message: ChannelMessage = {
            id: String(event.data.msgId), chatId: `${direct ? "u" : "g"}:${event.threadId}`, direct,
            from: { id: String(event.data.uidFrom), name: event.data.dName || String(event.data.uidFrom) },
            text: said.trim() || (attachmentUrl && typeof data.title === "string" ? data.title : ""),
            ...(attachmentUrl ? { loadMedia: () => receiveZaloMedia(attachmentUrl, photo) } : {}),
            ...(typeof content === "string" ? {} : { media: true }),
          };
          io.deliver(message);
        });
        api.listener.start({ retryOnClose: true });
      });
      return {
        done,
        send: async (chatId, text) => {
          const target = thread(chatId);
          await api.sendMessage({ msg: text }, target.id, target.type).catch((error: unknown) => { throw new ChannelError("retry", `Zalo: ${error instanceof Error ? error.message : String(error)}`); });
        },
        sendMedia: async (chatId, file) => {
          const target = thread(chatId);
          await api.sendMessage({ msg: "", attachments: await zaloUpload(file) }, target.id, target.type);
        },
        typing: async (chatId) => { const target = thread(chatId); await api.sendTypingEvent(target.id, target.type); },
      };
    },
  };
}

/** Signs a Zalo account in by QR: the image goes to the settings card, the session cookies come back as the secret. */
export function zaloLogin(load: ZaloLoader = loadZcaJs): ChannelLogin {
  return {
    async start(update, signal) {
      const client = await load();
      let credentials: unknown;
      let abortLogin: (() => unknown) | undefined;
      signal.addEventListener("abort", () => abortLogin?.(), { once: true });
      const expired = "Mã QR đã hết hạn hoặc bị từ chối. Bấm tạo mã mới.";
      await client.loginQR({}, (event) => {
        if (event.actions) abortLogin = event.actions.abort;
        if (event.type === 0) update({ qr: `data:image/png;base64,${String(event.data?.image ?? "")}` });
        else if (event.type === 1) event.actions?.abort();
        else if (event.type === 2) update({ scanned: String(event.data?.display_name ?? "") });
        else if (event.type === 4) credentials = { cookie: event.data?.cookie, imei: event.data?.imei, userAgent: event.data?.userAgent };
      }).catch(() => { if (!credentials) throw new Error(expired); });
      if (signal.aborted || !credentials) throw new Error(expired);
      return JSON.stringify(credentials);
    },
  };
}
