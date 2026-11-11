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
  502: ["engine_failed", "Bot không trả lời được (xem chi tiết trong OpenMausBot)"],
};

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); reject(new EngineError("aborted", "Đã dừng")); }, { once: true });
});

export class OpenMausBotEngine {
  constructor({ endpoint, apiKey, fetchImpl = fetch, pollMs = 4000, maxWaitMs = 10 * 60_000, waitSeconds = 50 }) {
    const url = new URL(endpoint);
    if (!/\/hooks\/api\/bots\/[\w-]+\/messages$/.test(url.pathname)) {
      throw new EngineError("bad_endpoint", "Địa chỉ phải có dạng …/hooks/api/bots/<botId>/messages (copy từ thẻ Bot API trong OpenMausBot)");
    }
    this.endpoint = url.toString();
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.pollMs = pollMs;
    this.maxWaitMs = maxWaitMs;
    this.waitSeconds = waitSeconds;
    this.kind = "openmausbot";
  }

  async call(method, { body, thread, timeoutMs }) {
    const url = new URL(this.endpoint);
    if (method === "GET") url.searchParams.set("thread", thread);
    let res;
    try {
      res = await this.fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new EngineError("engine_unreachable", `Không kết nối được OpenMausBot (${error.name === "TimeoutError" ? "hết thời gian chờ" : "app có đang mở?"})`);
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      // Error bodies are not always JSON.
    }
    if (res.status === 200 || res.status === 202) return data;
    const [code, message] = ERRORS[res.status] ?? ["engine_error", `OpenMausBot trả lỗi ${res.status}`];
    throw new EngineError(code, message, res.status);
  }

  /** Sends one message. Resolves {reply, thread} or {status: "needs_approval" | "working", thread}. */
  async send({ message, thread, signal }) {
    const body = { message, wait: this.waitSeconds, ...(thread ? { thread } : {}) };
    let answer;
    try {
      answer = await this.call("POST", { body, timeoutMs: (this.waitSeconds + 15) * 1000 });
    } catch (error) {
      if (error.code === "thread_missing" && thread) return this.send({ message, signal });
      throw error;
    }
    const deadline = Date.now() + this.maxWaitMs;
    while (answer.status === "working" && Date.now() < deadline) {
      await sleep(this.pollMs, signal);
      answer = await this.call("GET", { thread: answer.thread, timeoutMs: 30_000 });
    }
    return answer;
  }

  async check() {
    // A GET for a thread that cannot exist tells a wrong key (401) or a disabled API (403) from a working setup (404).
    try {
      await this.call("GET", { thread: "limix-health-check", timeoutMs: 10_000 });
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
