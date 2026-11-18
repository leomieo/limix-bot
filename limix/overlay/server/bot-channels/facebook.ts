// A Facebook Page's Messenger inbox through the Graph API with a Page access token. Messages are read by polling the
// Page's conversations, so no webhook address is needed; Meta counts each call against the Page's daily rate budget
// (about 4,800 calls per engaged person per day), which is what sets the poll interval.
import { ChannelError, wait, type ChannelAdapter, type ChannelMessage } from "./engine.ts";

const GRAPH = "https://graph.facebook.com/v23.0";
const BUSY_MS = 8_000;
const IDLE_MS = 20_000;
const BUSY_FOR_MS = 3 * 60_000;
const FIELDS = "updated_time,messages.limit(5){id,message,from,created_time,attachments}";

export interface FacebookOptions { fetch?: typeof fetch; sleep?(ms: number, signal: AbortSignal): Promise<void>; now?(): number }

export function facebookAdapter(options: FacebookOptions = {}): ChannelAdapter {
  const call = options.fetch ?? fetch;
  const sleep = options.sleep ?? wait;
  const now = options.now ?? Date.now;

  async function graph(token: string, method: "GET" | "POST", path: string, body?: unknown, signal?: AbortSignal) {
    const url = new URL(`${GRAPH}${path}`);
    if (method === "GET") url.searchParams.set("access_token", token);
    const response = await call(url, {
      method, ...(signal ? { signal } : {}),
      ...(method === "POST" ? { headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body ?? {}) } : {}),
    }).catch((error: unknown) => { throw new ChannelError("retry", `Facebook: ${(error instanceof Error ? error.message : String(error)).replaceAll(token, "…")}`); });
    const data = await response.json().catch(() => ({})) as { error?: { code?: number; message?: string } } & Record<string, any>;
    if (response.ok && !data.error) return data;
    const code = data.error?.code ?? 0;
    if (code === 190 || code === 102 || response.status === 401) throw new ChannelError("auth", "Page Access Token đã hết hạn hoặc bị thu hồi. Tạo token mới và dán lại.");
    if (code === 10 || code === 200 || code === 230 || code === 3) throw new ChannelError("auth", "Token thiếu quyền Messenger của Page (pages_messaging). Tạo lại token có quyền này.");
    if (code === 4 || code === 17 || code === 32 || code === 613 || response.status >= 500) throw new ChannelError("retry", "Facebook đang giới hạn số lần gọi. Bot sẽ thử lại.", 60_000);
    throw new ChannelError("drop", `Facebook báo lỗi${data.error?.message ? `: ${data.error.message}` : ` ${response.status}`}.`);
  }

  return {
    kind: "facebook",
    label: "Facebook Page",
    textMax: 2000,
    quietToStrangers: true,
    async check(token) {
      if (!/^EA[\w-]{40,600}$/.test(token)) throw new ChannelError("auth", "Token không đúng dạng. Dán Page Access Token (bắt đầu bằng EA…).");
      const page = await graph(token, "GET", "/me?fields=id,name,category");
      if (!page.id || !page.category) throw new ChannelError("auth", "Đây không phải token của một Page. Chọn Page khi tạo token.");
      return { username: String(page.id), name: String(page.name ?? "") };
    },
    async open(token, io) {
      const page = await graph(token, "GET", "/me?fields=id", undefined, io.signal);
      const self = String(page.id);
      const done = (async () => {
        let since = io.offset || now();
        if (!io.offset) io.saveOffset(since);
        let lastActive = 0;
        while (!io.signal.aborted) {
          const list = await graph(token, "GET", `/me/conversations?platform=messenger&limit=10&fields=${encodeURIComponent(FIELDS)}`, undefined, io.signal)
            .catch((error) => { if (io.signal.aborted) return { data: [] }; throw error; });
          io.healthy();
          const fresh: Array<ChannelMessage & { at: number }> = [];
          for (const conversation of Array.isArray(list.data) ? list.data : []) {
            if (Date.parse(conversation.updated_time) <= since) continue;
            for (const message of conversation.messages?.data ?? []) {
              const at = Date.parse(message.created_time);
              if (!(at > since) || !message.from?.id || String(message.from.id) === self) continue;
              fresh.push({
                at, id: String(message.id), chatId: String(message.from.id), direct: true,
                from: { id: String(message.from.id), name: String(message.from.name ?? message.from.id) },
                text: typeof message.message === "string" ? message.message : "",
                ...(message.attachments?.data?.length ? { media: true } : {}),
              });
            }
          }
          if (fresh.length) {
            fresh.sort((a, b) => a.at - b.at);
            since = fresh[fresh.length - 1]!.at;
            io.saveOffset(since);
            lastActive = now();
            for (const { at: _at, ...message } of fresh) io.deliver(message);
          }
          await sleep(now() - lastActive < BUSY_FOR_MS ? BUSY_MS : IDLE_MS, io.signal);
        }
      })();
      return {
        done,
        send: async (chatId, text) => { await graph(token, "POST", "/me/messages", { recipient: { id: chatId }, messaging_type: "RESPONSE", message: { text } }); },
        typing: async (chatId) => { await graph(token, "POST", "/me/messages", { recipient: { id: chatId }, sender_action: "typing_on" }); },
      };
    },
  };
}
