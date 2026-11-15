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
  if (signal?.aborted) return reject(new EngineError("aborted", "Đã dừng"));
  const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
  const t = setTimeout(finish, ms);
  const abort = () => { clearTimeout(t); signal?.removeEventListener("abort", abort); reject(new EngineError("aborted", "Đã dừng")); };
  signal?.addEventListener("abort", abort, { once: true });
});

const UNREACHED = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);

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

  async call(method, { body, thread, timeoutMs, owner = false, signal, conversation }) {
    if (signal?.aborted) throw new EngineError("aborted", "Đã dừng");
    let res;
    let lastError;
    const deadline = Date.now() + timeoutMs;
    for (const endpoint of this.candidates()) {
      const url = new URL(endpoint);
      if (method === "GET") url.searchParams.set("thread", thread);
      try {
        res = await this.fetch(url, {
          method,
          headers: { Authorization: `Bearer ${this.apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}), ...(conversation ? { "X-Limix-Conversation": Buffer.from(JSON.stringify(conversation)).toString("base64url") } : {}), ...(owner && this.ownerLaneToken ? { "X-Limix-Owner": this.ownerLaneToken } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.any([AbortSignal.timeout(Math.max(1, deadline - Date.now())), ...(signal ? [signal] : [])]),
        });
        this.endpoint = endpoint;
        break;
      } catch (error) {
        if (signal?.aborted) throw new EngineError("aborted", "Đã dừng");
        lastError = error;
        // A reset can happen after a POST was accepted. Only a confirmed connection failure may try another port.
        if (error.name === "TimeoutError" || Date.now() >= deadline || (method === "POST" && !UNREACHED.has(error.cause?.code))) break;
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
      if (signal?.aborted) throw new EngineError("aborted", "Đã dừng");
      if (res.status === 200 || res.status === 202) throw new EngineError("engine_error", "Bộ não AI trả dữ liệu không hợp lệ");
      // Error bodies are not always JSON.
    }
    if (res.status === 200 || res.status === 202) return data;
    const [code, message] = res.status === 403 ? forbidden(data?.error) : ERRORS[res.status] ?? ["engine_error", `Limix Bot trả lỗi ${res.status}`];
    const detail = typeof data?.detail === "string" ? data.detail.slice(0, 300) : "";
    const error = new EngineError(code, detail ? `${message}: ${detail}` : message, res.status);
    if (detail) error.detail = detail;
    error.retryable = res.status === 409 && data?.retryable === true && ["capacity_busy", "thread_busy"].includes(data?.code);
    throw error;
  }

  /** Sends one message. Resolves {reply, thread} or {status: "needs_approval" | "working", thread}. */
  async send({ message, attachments = [], thread, signal, owner = false, onThread, channel, conversation }) {
    const body = { message, ...(conversation ? { conversation } : {}), ...(attachments.length ? { attachments } : {}), wait: this.waitSeconds, ...(thread ? { thread } : {}),
      ...(["telegram", "zalo", "discord", "facebook"].includes(channel) ? { channel } : {}) };
    const deadline = Date.now() + this.maxWaitMs;
    let answer;
    for (;;) {
      try {
        answer = await this.call("POST", { body, owner, signal, conversation, timeoutMs: Math.max(1, Math.min((this.waitSeconds + 15) * 1000, deadline - Date.now())) });
        if (typeof answer.thread === "string" && /^[\w-]{1,128}$/.test(answer.thread)) onThread?.(answer.thread);
        break;
      } catch (error) {
        if (error.code === "thread_missing" && body.thread && Date.now() < deadline) {
          delete body.thread;
          continue;
        }
        // Only explicit pre-admission refusals guarantee this message has not already been appended or run.
        if (!error.retryable || Date.now() >= deadline) throw error;
        await sleep(Math.min(this.pollMs, deadline - Date.now()), signal);
        if (Date.now() >= deadline) throw error;
      }
    }
    while (answer.status === "working" && Date.now() < deadline) {
      await sleep(Math.min(this.pollMs, deadline - Date.now()), signal);
      if (Date.now() >= deadline) break;
      answer = await this.call("GET", { thread: answer.thread, owner, signal, conversation, timeoutMs: Math.max(1, Math.min(30_000, deadline - Date.now())) });
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
