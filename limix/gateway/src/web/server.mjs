// Local management app. Listens on 127.0.0.1 only.
// Security invariants: every /api call needs the per-run admin token that is only embedded in the page itself
// (another website cannot read it), and the Host header must be this machine (blocks DNS rebinding).
// Tokens and keys go in, never out: responses carry masked values only.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { EchoEngine, OpenMausBotEngine } from "../engines/openmausbot.mjs";
import { defaultMakeChannel } from "../gateway.mjs";
import { hashCode, newCode } from "../pairing.mjs";
import { maskToken, redact } from "../util/redact.mjs";

const LINK_CODE_TTL_MS = 15 * 60_000;
const MAX_BODY = 64 * 1024;
const PAGE = new URL("./ui.html", import.meta.url);
const FAVICON = new URL("./favicon.svg", import.meta.url);

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Dữ liệu quá lớn"), { status: 413 });
    parts.push(chunk);
  }
  if (!parts.length) return {};
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON không hợp lệ"), { status: 400 });
  }
}

function sameSecret(a, b) {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function publicConnection(conn, gateway) {
  return {
    id: conn.id, platform: conn.platform, name: conn.name, botIdentity: conn.botIdentity,
    tokenMasked: conn.tokenMasked, accessPolicy: conn.accessPolicy,
    ownerIds: conn.ownerIds, allowedIds: conn.allowedIds, enabled: conn.enabled,
    status: conn.status, statusDetail: redact(conn.statusDetail), running: gateway.isRunning(conn.id),
    engine: conn.engine?.kind === "openmausbot"
      ? { kind: "openmausbot", endpoint: conn.engine.endpoint, keyMasked: conn.engine.keyMasked }
      : { kind: "echo" },
    createdAt: conn.createdAt,
  };
}

export function createApp({ store, secrets, pairing, gateway, makeChannel = defaultMakeChannel, port, onShutdown = () => {}, launcherToken = "" }) {
  const adminToken = randomBytes(24).toString("base64url");
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  function buildEngine(body) {
    if (body.engineKind === "openmausbot") {
      if (!body.endpoint || !body.apiKey) throw Object.assign(new Error("Cần địa chỉ Bot API và khóa (key) của bot OpenMausBot"), { status: 400 });
      try {
        return new OpenMausBotEngine({ endpoint: String(body.endpoint).trim(), apiKey: String(body.apiKey).trim() });
      } catch (error) {
        throw Object.assign(new Error(error.message), { status: 400 });
      }
    }
    return new EchoEngine();
  }

  const routes = {
    "GET /api/state": () => ({
      connections: store.listConnections().map((c) => publicConnection(c, gateway)),
      pairing: pairing.list(),
      activity: store.state.activity.slice(-200).reverse(),
    }),

    "POST /api/connections": async (body) => {
      const platform = String(body.platform ?? "");
      const token = String(body.token ?? "").trim();
      if (!["telegram", "zalo"].includes(platform)) throw Object.assign(new Error("Chọn Telegram hoặc Zalo"), { status: 400 });
      if (!token) throw Object.assign(new Error("Chưa nhập token của bot"), { status: 400 });
      if (store.listConnections().some((c) => c.platform === platform && c.tokenFingerprint === hashCode(token))) {
        throw Object.assign(new Error("Bot này đã được kết nối rồi"), { status: 409 });
      }
      const engine = buildEngine(body);
      const channel = makeChannel({ platform }, token);
      let identity;
      try {
        identity = await channel.getMe();
      } catch (error) {
        throw Object.assign(new Error(error.message), { status: 400 });
      }
      const engineCheck = await engine.check();
      const conn = store.addConnection({
        platform,
        name: String(body.name ?? "").trim().slice(0, 60) || identity.name || identity.username || platform,
        botIdentity: identity,
        tokenRef: secrets.put(token),
        tokenMasked: maskToken(token),
        tokenFingerprint: hashCode(token),
        accessPolicy: ["owner_only", "pairing", "open"].includes(body.accessPolicy) ? body.accessPolicy : "pairing",
        engine: engine.kind === "openmausbot"
          ? { kind: "openmausbot", endpoint: engine.endpoint, keyRef: secrets.put(body.apiKey.trim()), keyMasked: maskToken(body.apiKey.trim()) }
          : { kind: "echo" },
      });
      store.log(conn.id, "connect", `Đã kết nối ${platform} @${identity.username || identity.id}`);
      gateway.start(conn.id);
      return { connection: publicConnection(conn, gateway), engineCheck };
    },

    "POST /api/connections/:id/start": (_b, id) => {
      store.updateConnection(id, { enabled: true });
      gateway.start(id);
      return { ok: true };
    },

    "POST /api/connections/:id/stop": async (_b, id) => {
      store.updateConnection(id, { enabled: false });
      await gateway.stop(id);
      return { ok: true };
    },

    "POST /api/connections/:id/delete": async (_b, id) => {
      const conn = store.getConnection(id);
      await gateway.stop(id);
      secrets.delete(conn.tokenRef);
      secrets.delete(conn.engine?.keyRef);
      pairing.forgetConnection(id);
      store.removeConnection(id);
      return { ok: true, note: "Đã ngắt kết nối trong Limix. Tài khoản bot trên nền tảng vẫn còn." };
    },

    "POST /api/connections/:id/link-code": (_b, id) => {
      const code = newCode(6);
      store.setLinkCode(id, hashCode(code), Date.now() + LINK_CODE_TTL_MS);
      return { code, expiresInMinutes: LINK_CODE_TTL_MS / 60_000 };
    },

    "POST /api/connections/:id/policy": (body, id) => {
      if (!["owner_only", "pairing", "open"].includes(body.accessPolicy)) throw Object.assign(new Error("Chế độ không hợp lệ"), { status: 400 });
      store.updateConnection(id, { accessPolicy: body.accessPolicy });
      store.log(id, "policy", `Đổi quyền truy cập: ${body.accessPolicy}`);
      return { ok: true };
    },

    "POST /api/connections/:id/remove-person": (body, id) => {
      const conn = store.getConnection(id);
      const pid = String(body.personId ?? "");
      store.updateConnection(id, { ownerIds: conn.ownerIds.filter((x) => x !== pid), allowedIds: conn.allowedIds.filter((x) => x !== pid) });
      store.log(id, "access", `Gỡ quyền ${pid}`);
      return { ok: true };
    },

    "POST /api/connections/:id/engine": async (body, id) => {
      const conn = store.getConnection(id);
      const engine = buildEngine(body);
      const check = await engine.check();
      if (!check.ok) throw Object.assign(new Error(check.message), { status: 400 });
      secrets.delete(conn.engine?.keyRef);
      store.updateConnection(id, {
        engine: engine.kind === "openmausbot"
          ? { kind: "openmausbot", endpoint: engine.endpoint, keyRef: secrets.put(body.apiKey.trim()), keyMasked: maskToken(body.apiKey.trim()) }
          : { kind: "echo" },
      });
      if (gateway.isRunning(id)) {
        await gateway.stop(id);
        gateway.start(id);
      }
      return { ok: true };
    },

    "POST /api/pairing/:id/approve": async (_b, reqId) => {
      const result = pairing.approveById(reqId);
      if (!result.approved) throw Object.assign(new Error("Yêu cầu không còn"), { status: 404 });
      const { connectionId, senderId, senderName } = result.approved;
      const conn = store.getConnection(connectionId);
      if (conn && !conn.allowedIds.includes(senderId)) store.updateConnection(connectionId, { allowedIds: [...conn.allowedIds, senderId] });
      store.log(connectionId, "pairing", `Đã duyệt ${senderName} (${senderId}) trong Limix`);
      if (conn) {
        const channel = makeChannel(conn, secrets.get(conn.tokenRef));
        await channel.sendText(senderId, "Chủ bot đã duyệt. Bạn có thể bắt đầu nhắn tin.").catch(() => {});
      }
      return { ok: true };
    },

    "POST /api/pairing/:id/deny": (_b, reqId) => ({ ok: pairing.deny(reqId) }),

    "POST /api/shutdown": () => {
      setTimeout(onShutdown, 100);
      return { ok: true };
    },
  };

  function match(method, path) {
    for (const key of Object.keys(routes)) {
      const [m, pattern] = key.split(" ");
      if (m !== method) continue;
      const re = new RegExp(`^${pattern.replace(":id", "([\\w-]+)")}$`);
      const found = re.exec(path);
      if (found) return { handler: routes[key], id: found[1] };
    }
    return undefined;
  }

  const server = createServer(async (req, res) => {
    try {
      if (!allowedHosts.has(req.headers.host ?? "")) return send(res, 421, { error: "Sai địa chỉ máy" });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === "GET" && url.pathname === "/") {
        const html = readFileSync(PAGE, "utf8").replace("__ADMIN_TOKEN__", adminToken);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'",
          "X-Frame-Options": "DENY",
        });
        return res.end(html);
      }
      if (req.method === "GET" && url.pathname === "/favicon.svg") {
        res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=86400" });
        return res.end(readFileSync(FAVICON));
      }
      if (req.method === "GET" && url.pathname === "/healthz") return send(res, 200, { app: "limix-bot" });
      if (!url.pathname.startsWith("/api/")) return send(res, 404, { error: "Không có" });
      // The desktop launcher stops the server with its own one-run token; it never sees the page's admin token.
      const launcherShutdown = launcherToken && req.method === "POST" && url.pathname === "/api/shutdown"
        && sameSecret(req.headers["x-limix-launcher"], launcherToken);
      if (!launcherShutdown && !sameSecret(req.headers["x-limix-admin"], adminToken)) return send(res, 401, { error: "Phiên hết hạn, tải lại trang" });
      const found = match(req.method, url.pathname);
      if (!found) return send(res, 404, { error: "Không có" });
      if (found.id && url.pathname.startsWith("/api/connections/") && !store.getConnection(found.id)) {
        return send(res, 404, { error: "Không tìm thấy kết nối" });
      }
      const body = req.method === "POST" ? await readBody(req) : {};
      send(res, 200, await found.handler(body, found.id));
    } catch (error) {
      send(res, error.status ?? 500, { error: redact(error.message) });
    }
  });

  return { server, adminToken };
}
