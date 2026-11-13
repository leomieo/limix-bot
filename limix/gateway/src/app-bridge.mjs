// The app's side of the connector. Two ways to reach Limix Bot:
//   inside the desktop app — spawned with an IPC channel; the app answers "bots" and "link".
//   on a server — LIMIX_SERVER_URL names the Limix Bot server in the same machine or container (loopback), and the
//   connector asks it directly over HTTP, the way the desktop app would. The server runs it as its sidecar.
// Otherwise every call fails with "not inside the app".
let next = 1;
const waiting = new Map();
const SERVER = (process.env.LIMIX_SERVER_URL ?? "").trim().replace(/\/+$/, "");
const serverMode = () => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SERVER);

if (typeof process.send === "function") {
  process.on("message", (message) => {
    const pending = waiting.get(message?.id);
    if (!pending) return;
    waiting.delete(message.id);
    if (message.error) pending.reject(Object.assign(new Error(String(message.error)), { status: 502 }));
    else pending.resolve(message.result);
  });
}

export const insideApp = () => typeof process.send === "function" || serverMode();

async function serverCall(route, body, timeoutMs) {
  const res = await fetch(SERVER + route, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || `Limix Bot ${res.status}`), { status: 502 });
  return data;
}

/** The same two questions the desktop app answers (electron/limix-gateway.mjs), asked of the server itself. */
async function askServer(op, args, timeoutMs) {
  if (op === "bots") {
    const { bots } = await serverCall("/api/bots?messages=0", undefined, timeoutMs);
    return (Array.isArray(bots) ? bots : []).filter((bot) => !bot.hidden).map((bot) => ({ id: bot.id, name: bot.name }));
  }
  if (op === "link" && typeof args.botId === "string" && /^[\w-]{1,128}$/.test(args.botId)) {
    const route = `/api/bots/${args.botId}/bot-api`;
    const on = await serverCall(route, { enabled: true }, timeoutMs);
    // Already on: its key was shown once and is not kept, so a new one is made for the connector.
    const key = on.key ?? (await serverCall(`${route}/new-key`, {}, timeoutMs)).key;
    if (typeof key !== "string" || typeof on.url !== "string") throw Object.assign(new Error("Limix Bot did not provide the Bot API address or key"), { status: 502 });
    // On the server the bot is reached over loopback, never through the public address and back in.
    const local = new URL(on.url);
    const endpoint = process.env.LIMIX_BOT_API_URL ? new URL(local.pathname + local.search, process.env.LIMIX_BOT_API_URL).toString() : on.url;
    return { endpoint, apiKey: key, canTakeCalls: on.canTakeCalls !== false };
  }
  throw Object.assign(new Error("Invalid request"), { status: 400 });
}

export function askApp(op, args = {}, timeoutMs = 20_000) {
  if (typeof process.send !== "function") {
    if (serverMode()) return askServer(op, args, timeoutMs);
    return Promise.reject(Object.assign(new Error("Chỉ dùng được khi mở từ ứng dụng Limix Bot"), { status: 400 }));
  }
  const id = next++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); reject(Object.assign(new Error("Limix Bot không trả lời"), { status: 504 })); }, timeoutMs);
    waiting.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    process.send({ id, op, ...args });
  });
}
