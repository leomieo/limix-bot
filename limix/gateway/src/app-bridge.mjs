// The desktop app's side of the connector: when this server runs inside Limix Bot (spawned with an IPC channel), it can
// list the app's bots and switch on a bot's Bot API to get its address and key, so nobody copies them by hand.
// Outside the app (no IPC channel) every call fails with "not inside the app".
let next = 1;
const waiting = new Map();

if (typeof process.send === "function") {
  process.on("message", (message) => {
    const pending = waiting.get(message?.id);
    if (!pending) return;
    waiting.delete(message.id);
    if (message.error) pending.reject(Object.assign(new Error(String(message.error)), { status: 502 }));
    else pending.resolve(message.result);
  });
}

export const insideApp = () => typeof process.send === "function";

export function askApp(op, args = {}, timeoutMs = 20_000) {
  if (!insideApp()) return Promise.reject(Object.assign(new Error("Chỉ dùng được khi mở từ ứng dụng Limix Bot"), { status: 400 }));
  const id = next++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); reject(Object.assign(new Error("Limix Bot không trả lời"), { status: 504 })); }, timeoutMs);
    waiting.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    process.send({ id, op, ...args });
  });
}
