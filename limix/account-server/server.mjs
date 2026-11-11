// Limix Account server (Leox ৹ Limix AI): customer accounts for the Limix Bot desktop app.
// One account may be signed in on at most MAX_DEVICES computers at once; the next one is refused until a device is
// removed (by the customer on /account, or by the owner on /admin). No time limit yet.
// Zero dependencies: Node >= 22.13 (node:sqlite, node:crypto). Runs behind Caddy, which adds HTTPS.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { accountPage, adminPage, homePage } from "./pages.mjs";

const env = process.env;
const CONFIG = {
  host: env.HOST || "127.0.0.1",
  port: Number(env.PORT || 8787),
  dataDir: env.DATA_DIR || path.join(process.cwd(), "data"),
  adminToken: env.ADMIN_TOKEN || "",
  maxDevices: Number(env.MAX_DEVICES || 10),
  staleDays: Number(env.STALE_DAYS || 30),
  allowRegister: env.ALLOW_REGISTER !== "0",
};

const DAY = 86_400_000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export function openDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, pass TEXT NOT NULL,
      created INTEGER NOT NULL, locked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL DEFAULT '',
      token TEXT NOT NULL UNIQUE, created INTEGER NOT NULL, last_seen INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, device_id));`);
  return db;
}

// --- passwords and tokens ---------------------------------------------------------------------------------------
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
function checkPassword(password, stored) {
  const [kind, salt, key] = String(stored).split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "base64");
  const got = crypto.scryptSync(password, Buffer.from(salt, "base64"), want.length, SCRYPT);
  return crypto.timingSafeEqual(want, got);
}
// Spent on unknown emails too, so a wrong email and a wrong password take the same time.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString("hex"));
const tokenHash = token => crypto.createHash("sha256").update(token).digest("hex");
const sameSecret = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y) && String(a).length > 0;
};

// --- attempt limits (in memory; a restart forgets them) --------------------------------------------------------
export function createLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map();
  return {
    blocked(key) {
      const entry = hits.get(key);
      if (!entry || now() - entry.start > windowMs) return false;
      return entry.count >= max;
    },
    hit(key) {
      const entry = hits.get(key);
      if (!entry || now() - entry.start > windowMs) hits.set(key, { start: now(), count: 1 });
      else entry.count++;
      if (hits.size > 50_000) hits.clear();
    },
  };
}

// --- the account logic, independent of HTTP ---------------------------------------------------------------------
export function createAccounts(db, { maxDevices = 10, staleDays = 30, allowRegister = true, now = Date.now } = {}) {
  const q = {
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    insertUser: db.prepare("INSERT INTO users (email, pass, created) VALUES (?, ?, ?)"),
    active: db.prepare("SELECT id, name, platform, created, last_seen FROM devices WHERE user_id = ? AND revoked = 0 AND last_seen >= ? ORDER BY last_seen DESC"),
    deviceRow: db.prepare("SELECT * FROM devices WHERE user_id = ? AND device_id = ?"),
    insertDevice: db.prepare("INSERT INTO devices (user_id, device_id, name, platform, token, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    reuseDevice: db.prepare("UPDATE devices SET name = ?, platform = ?, token = ?, last_seen = ?, revoked = 0 WHERE id = ?"),
    byToken: db.prepare("SELECT d.id AS device, d.revoked, d.last_seen, u.id AS user, u.email, u.locked FROM devices d JOIN users u ON u.id = d.user_id WHERE d.token = ?"),
    touch: db.prepare("UPDATE devices SET last_seen = ? WHERE id = ?"),
    revoke: db.prepare("UPDATE devices SET revoked = 1 WHERE id = ?"),
    revokeOwn: db.prepare("UPDATE devices SET revoked = 1 WHERE id = ? AND user_id = ?"),
    users: db.prepare(`SELECT u.id, u.email, u.created, u.locked,
      (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id AND d.revoked = 0 AND d.last_seen >= ?) AS devices,
      (SELECT MAX(last_seen) FROM devices d WHERE d.user_id = u.id) AS last_seen
      FROM users u ORDER BY u.created DESC LIMIT 1000`),
    userDevices: db.prepare("SELECT id, name, platform, created, last_seen FROM devices WHERE user_id = ? AND revoked = 0 AND last_seen >= ? ORDER BY last_seen DESC"),
    lock: db.prepare("UPDATE users SET locked = ? WHERE id = ?"),
    deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
  };
  const since = () => now() - staleDays * DAY;
  const fail = (status, error) => ({ status, body: { error } });
  const deviceList = rows => rows.map(r => ({ id: r.id, name: r.name, platform: r.platform, lastSeen: r.last_seen }));
  const normEmail = email => String(email ?? "").trim().toLowerCase();
  const cleanName = (name, fallback) => String(name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80) || fallback;

  function verify(email, password) {
    const user = q.userByEmail.get(normEmail(email));
    const ok = checkPassword(String(password ?? ""), user ? user.pass : DUMMY_HASH);
    if (!user || !ok) return { error: fail(401, "wrong_credentials") };
    if (user.locked) return { error: fail(403, "account_locked") };
    return { user };
  }

  /** Signs this computer in: the same computer again reuses its seat; a new one needs a free seat. */
  function signIn(user, { deviceId, deviceName, platform }) {
    const id = String(deviceId ?? "");
    if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return fail(400, "bad_device");
    const token = crypto.randomBytes(32).toString("base64url");
    const at = now();
    const name = cleanName(deviceName, "PC"), os = cleanName(platform, "");
    const row = q.deviceRow.get(user.id, id);
    const activeHere = row && !row.revoked && row.last_seen >= since();
    if (!activeHere) {
      const active = q.active.all(user.id, since());
      if (active.length >= maxDevices) return { status: 409, body: { error: "device_limit", max: maxDevices, devices: deviceList(active) } };
    }
    if (row) q.reuseDevice.run(name, os, tokenHash(token), at, row.id);
    else q.insertDevice.run(user.id, id, name, os, tokenHash(token), at, at);
    return { status: 200, body: { token, email: user.email, max: maxDevices } };
  }

  return {
    register(body) {
      if (!allowRegister) return fail(403, "register_closed");
      const email = normEmail(body.email), password = String(body.password ?? "");
      if (!EMAIL.test(email)) return fail(400, "bad_email");
      if (password.length < 8 || password.length > 200) return fail(400, "weak_password");
      if (q.userByEmail.get(email)) return fail(409, "email_taken");
      q.insertUser.run(email, hashPassword(password), now());
      return signIn(q.userByEmail.get(email), body);
    },
    login(body) {
      const { user, error } = verify(body.email, body.password);
      return error ?? signIn(user, body);
    },
    session(token) {
      const row = token ? q.byToken.get(tokenHash(token)) : null;
      if (!row || row.revoked || row.last_seen < since()) return fail(401, "signed_out");
      if (row.locked) return fail(403, "account_locked");
      q.touch.run(now(), row.device);
      return { status: 200, body: { email: row.email, max: maxDevices } };
    },
    logout(token) {
      const row = token ? q.byToken.get(tokenHash(token)) : null;
      if (row) q.revoke.run(row.device);
      return { status: 200, body: { ok: true } };
    },
    devices(body) {
      const { user, error } = verify(body.email, body.password);
      return error ?? { status: 200, body: { email: user.email, max: maxDevices, devices: deviceList(q.active.all(user.id, since())) } };
    },
    removeDevice(body) {
      const { user, error } = verify(body.email, body.password);
      if (error) return error;
      q.revokeOwn.run(Number(body.id), user.id);
      return { status: 200, body: { ok: true, devices: deviceList(q.active.all(user.id, since())) } };
    },
    admin: {
      users: () => ({ status: 200, body: { max: maxDevices, users: q.users.all(since()) } }),
      devices: body => ({ status: 200, body: { devices: deviceList(q.userDevices.all(Number(body.userId), since())) } }),
      lock: body => { q.lock.run(body.locked ? 1 : 0, Number(body.userId)); return { status: 200, body: { ok: true } }; },
      removeDevice: body => { q.revoke.run(Number(body.id)); return { status: 200, body: { ok: true } }; },
      deleteUser: body => { q.deleteUser.run(Number(body.userId)); return { status: 200, body: { ok: true } }; },
    },
  };
}

// --- HTTP -------------------------------------------------------------------------------------------------------
const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

export function createServer(config = CONFIG, { now = Date.now } = {}) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const db = openDatabase(path.join(config.dataDir, "accounts.db"));
  const accounts = createAccounts(db, { ...config, now });
  const ipLimit = createLimiter({ max: 30, windowMs: 10 * 60_000, now });
  const emailLimit = createLimiter({ max: 10, windowMs: 10 * 60_000, now });
  const adminLimit = createLimiter({ max: 20, windowMs: 10 * 60_000, now });

  const send = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  const readJson = req => new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    req.on("data", chunk => { size += chunk.length; if (size > 16_384) { reject(new Error("too_large")); req.destroy(); } else parts.push(chunk); });
    req.on("end", () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString("utf8")) : {}); } catch { reject(new Error("bad_json")); } });
    req.on("error", reject);
  });
  const clientIp = req => String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket.remoteAddress || "?";
  const bearer = req => /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1] ?? "";

  // Password-checking routes count failures per IP and per email.
  const guarded = (handler) => (req, body) => {
    const ip = clientIp(req), email = String(body.email ?? "").trim().toLowerCase();
    if (ipLimit.blocked(ip) || emailLimit.blocked(email)) return { status: 429, body: { error: "too_many_attempts" } };
    const out = handler(body);
    if (out.status === 401 || out.status === 400 || out.status === 409 && out.body.error === "email_taken") { ipLimit.hit(ip); if (email) emailLimit.hit(email); }
    return out;
  };
  const routes = {
    "POST /api/register": guarded(body => accounts.register(body)),
    "POST /api/login": guarded(body => accounts.login(body)),
    "POST /api/devices": guarded(body => accounts.devices(body)),
    "POST /api/devices/remove": guarded(body => accounts.removeDevice(body)),
    "GET /api/session": req => accounts.session(bearer(req)),
    "POST /api/logout": req => accounts.logout(bearer(req)),
  };
  const adminRoutes = {
    "GET /api/admin/users": () => accounts.admin.users(),
    "POST /api/admin/devices": (_req, body) => accounts.admin.devices(body),
    "POST /api/admin/lock": (_req, body) => accounts.admin.lock(body),
    "POST /api/admin/remove-device": (_req, body) => accounts.admin.removeDevice(body),
    "POST /api/admin/delete-user": (_req, body) => accounts.admin.deleteUser(body),
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    const key = `${req.method} ${url.pathname}`;
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/account" || url.pathname === "/admin")) {
        res.writeHead(200, PAGE_HEADERS);
        return res.end(url.pathname === "/admin" ? adminPage() : url.pathname === "/account" ? accountPage(config.maxDevices) : homePage());
      }
      if (key === "GET /health") return send(res, 200, { ok: true });
      const body = req.method === "POST" ? await readJson(req) : {};
      if (routes[key]) { const out = routes[key](req, body); return send(res, out.status, out.body); }
      if (adminRoutes[key]) {
        const ip = clientIp(req);
        if (adminLimit.blocked(ip)) return send(res, 429, { error: "too_many_attempts" });
        if (!config.adminToken || !sameSecret(req.headers["x-admin-token"] ?? "", config.adminToken)) { adminLimit.hit(ip); return send(res, 401, { error: "admin_only" }); }
        const out = adminRoutes[key](req, body); return send(res, out.status, out.body);
      }
      send(res, 404, { error: "not_found" });
    } catch (error) {
      if (error?.message === "too_large" || error?.message === "bad_json") return send(res, 400, { error: error.message });
      console.error(new Date().toISOString(), key, error);
      if (!res.headersSent) send(res, 500, { error: "server_error" });
    }
  });
  server.on("close", () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  if (!CONFIG.adminToken) console.warn("ADMIN_TOKEN is not set: the /admin page will refuse every request.");
  createServer().listen(CONFIG.port, CONFIG.host, () => console.log(`Limix Account on http://${CONFIG.host}:${CONFIG.port} (max ${CONFIG.maxDevices} devices per account)`));
}
