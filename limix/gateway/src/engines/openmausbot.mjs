// Client for the OpenMausBot Bot API (docs/bot-api.md @ 6f226f15):
// POST <endpoint> {message, thread?, wait?} with "Authorization: Bearer <key>";
// 200 {reply, thread} | 202 {thread, status: "working" | "needs_approval"}; GET <endpoint>?thread=<id> reads it later.
// Bot API turns run confined, in Ask mode, without tools: the right default for people writing from outside.

export class EngineError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ERRORS = {
  400: ["bad_request", "Yêu cầu không hợp lệ"],
  401: ["credential_invalid", "Khóa Bot API sai hoặc đã đổi"],
  403: ["api_off", "Bot API đang tắt cho bot này (hoặc bot không tồn tại / AI không chạy được chế độ giới hạn)"],
  404: ["thread_missing", "Không tìm thấy cuộc trò chuyện"],
  409: ["busy", "Bot đang bận trả lời tin trước"],
  413: ["too_large", "Tin nhắn quá dài"],
  429: ["rate_limited", "Quá 10 tin/phút cho khóa này"],
  502: ["engine_failed", "Bot không trả lời được (xem chi tiết trong Limix Bot)"],
};

/** The app says which of its three refusals a 403 is. */
function forbidden(reason) {
  const text = String(reason ?? "");
  if (/is off/i.test(text)) return ["api_off", "Bot API đang tắt cho bot AI này: mở bot trong Limix Bot → bánh răng → Advanced: Access → Bot API → bật “Let apps talk to this bot”"];
  if (/can't take Bot API/i.test(text)) return ["engine_unsupported", "AI của bot này không nhận được tin từ ngoài (Bot API). Trong Limix Bot, đổi AI của bot sang Claude, Codex hoặc một AI kiểu OpenAI"];
  if (/higher plan/i.test(text)) return ["plan", "Gói hiện tại chưa có Bot API"];
  return ERRORS[403];
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); reject(new EngineError("aborted", "Đã dừng")); }, { once: true });
});

export class OpenMausBotEngine {
  constructor({ endpoint, apiKey, fetchImpl = fetch, pollMs = 4000, maxWaitMs = 10 * 60_000, waitSeconds = 50, hooksPorts = [8800, 18800, 28800], ownerLaneToken = process.env.LIMIX_OWNER_LANE_TOKEN }) {
    const url = new URL(endpoint);
    if (!/\/hooks\/api\/bots\/[\w-]+\/messages$/.test(url.pathname)) {
      throw new EngineError("bad_endpoint", "Địa chỉ phải có dạng …/hooks/api/bots/<botId>/messages (copy từ thẻ Bot API trong Limix Bot)");
    }
    this.endpoint = url.toString();
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.pollMs = pollMs;
    this.maxWaitMs = maxWaitMs;
    this.waitSeconds = waitSeconds;
    this.kind = "openmausbot";
    this.hooksPorts = hooksPorts;
    this.ownerLaneToken = ownerLaneToken;
  }

  /** The app's receiver moves to the next port pair when 8799 is taken (8800, 18800, 28800), so a copied loopback
   * address is tried on each of them; the one that answers is kept. */
  candidates() {
    const url = new URL(this.endpoint);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return [this.endpoint];
    const ports = [url.port || "80", ...this.hooksPorts.map(String).filter((p) => p !== url.port)];
    return ports.map((port) => { const u = new URL(this.endpoint); u.port = port; return u.toString(); });
  }

  async call(method, { body, thread, timeoutMs, owner = false }) {
    let res;
    let lastError;
    for (const endpoint of this.candidates()) {
      const url = new URL(endpoint);
      if (method === "GET") url.searchParams.set("thread", thread);
      try {
        res = await this.fetch(url, {
          method,
          headers: { Authorization: `Bearer ${this.apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}), ...(owner && this.ownerLaneToken ? { "X-Limix-Owner": this.ownerLaneToken } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
        this.endpoint = endpoint;
        break;
      } catch (error) {
        lastError = error;
        if (error.name === "TimeoutError") break;
      }
    }
    if (!res) {
      const why = lastError?.name === "TimeoutError" ? "hết thời gian chờ" : `${lastError?.cause?.code ?? lastError?.name ?? "lỗi mạng"} — app Limix Bot có đang mở?`;
      throw new EngineError("engine_unreachable", `Không kết nối được bộ não AI trong Limix Bot (${why})`);
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      // Error bodies are not always JSON.
    }
    if (res.status === 200 || res.status === 202) return data;
    const [code, message] = res.status === 403 ? forbidden(data?.error) : ERRORS[res.status] ?? ["engine_error", `Limix Bot trả lỗi ${res.status}`];
    throw new EngineError(code, message, res.status);
  }

  /** Sends one message. Resolves {reply, thread} or {status: "needs_approval" | "working", thread}. */
  async send({ message, attachments = [], thread, signal, owner = false }) {
    const body = { message, ...(attachments.length ? { attachments } : {}), wait: this.waitSeconds, ...(thread ? { thread } : {}) };
    let answer;
    try {
      answer = await this.call("POST", { body, owner, timeoutMs: (this.waitSeconds + 15) * 1000 });
    } catch (error) {
      if (error.code === "thread_missing" && thread) return this.send({ message, attachments, signal, owner });
      throw error;
    }
    const deadline = Date.now() + this.maxWaitMs;
    while (answer.status === "working" && Date.now() < deadline) {
      await sleep(this.pollMs, signal);
      answer = await this.call("GET", { thread: answer.thread, owner, timeoutMs: 30_000 });
    }
    return answer;
  }

  async check() {
    // A GET for a thread that cannot exist tells a wrong key (401) or a disabled API (403) from a working setup (404).
    try {
      await this.call("GET", { thread: "limix-health-check", timeoutMs: 10_000, owner: Boolean(this.ownerLaneToken) });
      return { ok: true };
    } catch (error) {
      if (error.code === "thread_missing") return { ok: true };
      return { ok: false, code: error.code, message: error.message };
    }
  }
}

/** Test engine: answers with the message it got, so a channel can be checked before OpenMausBot is set up. */
export class EchoEngine {
  constructor() {
    this.kind = "echo";
  }

  async send({ message, thread }) {
    return { reply: `[Chế độ thử] Limix đã nhận: ${message}`, thread: thread ?? `echo-${Date.now()}` };
  }

  async check() {
    return { ok: true };
  }
}
