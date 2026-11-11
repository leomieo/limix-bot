import { createServer } from "node:http";

async function body(req) {
  const parts = [];
  for await (const c of req) parts.push(c);
  const raw = Buffer.concat(parts).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

/** A Telegram Bot API stand-in: queue updates, read what the bot sent. */
export async function fakeTelegram({ token = "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef", webhookUrl = "" } = {}) {
  const state = { updates: [], sent: [], calls: [], nextId: 1, webhookUrl, conflict: false, typing: 0 };
  const { server, base } = await listen(async (req, res) => {
    const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url);
    const json = (code, data) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (!m) return json(404, { ok: false });
    if (m[1] !== token) return json(401, { ok: false, error_code: 401, description: "Unauthorized" });
    const b = await body(req);
    state.calls.push(m[2]);
    switch (m[2]) {
      case "getMe": return json(200, { ok: true, result: { id: 123456, is_bot: true, first_name: "Limix Test", username: "limix_test_bot" } });
      case "getWebhookInfo": return json(200, { ok: true, result: { url: state.webhookUrl, pending_update_count: 0 } });
      case "getUpdates": {
        if (state.conflict) return json(409, { ok: false, error_code: 409, description: "Conflict: terminated by other getUpdates request" });
        const offset = b.offset ?? 0;
        const ready = state.updates.filter((u) => u.update_id >= offset);
        if (!ready.length) await new Promise((r) => setTimeout(r, 30));
        return json(200, { ok: true, result: ready });
      }
      case "sendMessage": state.sent.push({ chatId: String(b.chat_id), text: b.text }); return json(200, { ok: true, result: { message_id: state.sent.length } });
      case "sendChatAction": state.typing++; return json(200, { ok: true, result: true });
      default: return json(404, { ok: false });
    }
  });
  return {
    base, token, state, close: () => server.close(),
    push(from, text, { chatType = "private", chatId = from.id, sameIdAs } = {}) {
      const update_id = sameIdAs ?? state.nextId++;
      state.updates.push({ update_id, message: { message_id: update_id, from: { id: from.id, is_bot: false, first_name: from.name }, chat: { id: chatId, type: chatType }, date: 0, text } });
      return update_id;
    },
  };
}

/** A Zalo Bot API stand-in: getUpdates hands out one update per call. */
export async function fakeZalo({ token = "9876543210:zalosecretzalosecretzalosecret" } = {}) {
  const state = { queue: [], sent: [], webhookUrl: "" };
  const { server, base } = await listen(async (req, res) => {
    const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url);
    const json = (code, data) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (!m || m[1] !== token) return json(401, { ok: false, error_code: 401, description: "Unauthorized" });
    const b = await body(req);
    switch (m[2]) {
      case "getMe": return json(200, { ok: true, result: { id: "777", account_name: "limix.zalo", display_name: "Limix Zalo" } });
      case "getWebhookInfo": return json(200, { ok: true, result: { url: state.webhookUrl, updated_at: 0 } });
      case "getUpdates": {
        const next = state.queue.shift();
        if (!next) { await new Promise((r) => setTimeout(r, 30)); return json(200, { ok: false, error_code: 408, description: "Request timeout" }); }
        return json(200, { ok: true, result: next });
      }
      case "sendMessage":
        if (String(b.text).length > 2000) return json(400, { ok: false, error_code: 400, description: "text too long" });
        state.sent.push({ chatId: String(b.chat_id), text: b.text });
        return json(200, { ok: true, result: { message_id: `m${state.sent.length}`, date: Date.now() } });
      case "sendChatAction": return json(200, { ok: true, result: true });
      default: return json(404, { ok: false });
    }
  });
  let n = 0;
  return {
    base, token, state, close: () => server.close(),
    push(userId, text, eventName = "message.text.received") {
      n++;
      state.queue.push({ event_name: eventName, message: { message_id: `zm${n}`, date: Date.now(), message_type: "CHAT_TEXT", from: { id: userId, display_name: `User ${userId}`, is_bot: false }, chat: { id: userId, chat_type: "PRIVATE" }, text } });
    },
  };
}

/** An OpenMausBot Bot API stand-in. `respond(message, thread)` decides the answer. */
export async function fakeOpenMausBot({ key = "bak_testkeytestkeytestkeytestkey123", respond } = {}) {
  const state = { calls: [], threads: new Map(), n: 0 };
  const answer = respond ?? ((message) => ({ reply: `Bot: ${message}` }));
  const { server, base } = await listen(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const json = (code, data) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (!/^\/hooks\/api\/bots\/bot1\/messages$/.test(url.pathname)) return json(403, { error: "off" });
    if (req.headers.authorization !== `Bearer ${key}`) return json(401, { error: "Invalid key" });
    if (req.method === "GET") {
      const t = url.searchParams.get("thread");
      const th = state.threads.get(t);
      if (!th) return json(404, { error: "no such thread" });
      if (th.pending && th.pending.polls-- > 0) return json(202, { thread: t, status: "working" });
      if (th.pending) { const r = th.pending.final; th.pending = null; return json(200, { reply: r, thread: t }); }
      return json(200, { reply: th.last ?? "", thread: t });
    }
    const b = await body(req);
    state.calls.push(b);
    let thread = b.thread;
    if (thread && !state.threads.has(thread)) return json(404, { error: "no such thread" });
    if (!thread) { thread = `t${++state.n}`; state.threads.set(thread, {}); }
    const out = await answer(b.message, thread);
    if (out.working) { state.threads.get(thread).pending = { polls: out.working, final: out.final }; return json(202, { thread, status: "working" }); }
    if (out.needsApproval) return json(202, { thread, status: "needs_approval" });
    if (out.status) return json(out.status, { error: "x" });
    state.threads.get(thread).last = out.reply;
    return json(200, { reply: out.reply, thread });
  });
  return { base, key, state, endpoint: `${base}/hooks/api/bots/bot1/messages`, close: () => server.close() };
}

export async function until(check, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timed out waiting");
}
