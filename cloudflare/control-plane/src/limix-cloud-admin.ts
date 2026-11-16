import { wakeHome } from "./cloud-power-admin";
import { cloudOwnerRoute } from "./cloud-owner";
// Limix Cloud Admin: the Admin half of docs/cloud-pro.md, written for Limix (MausBot's own Admin is closed source).
// The desktop's built-in Cloud client talks to it at https://cloud.limixmedia.com with a personal device token (omc_…).
// Each account's home runs on the operator's Xeon in Cloud home mode; this Worker signs pairing requests with that
// home's bootstrap secret, which both sides derive from LIMIX_BETA_HOST_TOKEN, so no per-home secret is stored here.
//
// Differences from MausBot's Admin, on purpose:
// - Sign-in: the desktop is already signed in to its Limix account, so it trades that sign-in for a device token
//   (POST /api/cloud/desktop/limix-token). There is no email code and no browser approval.
// - No payment yet: a person asks for a trial (POST /api/cloud/desktop/trial) and the operator approves it.
//   An approved account has an active plan; nothing is sold, so the session never carries an `offer`.
import { HTTPError, json, readOptionalBoundedJSON, type JSONValue } from "./http";
import { limixSession } from "./limix-auth";
import { managedHomeHostname, managedHomeOrigin } from "./managed-grant";
import { managedHostToken } from "./managed-host";
import { routedHostnames } from "./managed-routing";
import { readConfig } from "./config";

export const CONTRACT = 1;
export const DEVICE_TOKEN_DAYS = 90;
/** How long an active plan reads as paid for before the next session read renews it. */
const PLAN_WINDOW_MS = 30 * 24 * 3600_000;
const TOKEN = /^omc_[A-Za-z0-9_-]{43}$/;
/** A home whose host has not reported for this long reads as unreachable (its host polls every 30 s). */
const STALE_SECONDS = 180;
const BOOTSTRAP_LABEL = "limix-cloud-bootstrap-v1:";
const encoder = new TextEncoder();
// oxlint-disable-next-line no-control-regex
const PLAIN = /^[^\x00-\x1f\x7f]{1,100}$/;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function hmac(key: string, message: string): Promise<string> {
  const mac = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", mac, encoder.encode(message))));
}

/** The home's OMB_CLOUD_BOOTSTRAP_SECRET: 43 base64url characters. deploy/managed-beta/host.mjs derives the same. */
export function homeBootstrapSecret(hostToken: string, workspaceId: string): Promise<string> {
  return hmac(hostToken, BOOTSTRAP_LABEL + workspaceId);
}

/** server/cloud-home.ts cloudRequestSignature, for a request this Worker sends to a home. */
export async function homeRequestHeaders(secret: string, method: string, target: string, body: string, now = Date.now()) {
  const timestamp = String(Math.floor(now / 1000));
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const bodyHash = await sha256(body);
  const signature = await hmac(secret, `v1\n${timestamp}\n${nonce}\n${method}\n${target}\n${bodyHash}`);
  return { "x-omb-cloud-timestamp": timestamp, "x-omb-cloud-nonce": nonce, "x-omb-cloud-signature": `v1=${signature}` };
}

interface Device { id: string; principal: string; expires_at: number }
interface BetaRow { workspace_id: string | null; runtime_state: string | null; runtime_seen: number | null; power_desired?: string; power_since?: number; sleep_enabled?: number; sleep_blocked?: number; power_observed?: string }

function account(principal: string) {
  const name = principal.startsWith("limix:") ? principal.slice(6) : principal;
  return { id: principal, email: name };
}

async function device(request: Request, env: Env): Promise<Device> {
  const token = /^Bearer (omc_[A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !TOKEN.test(token)) throw new HTTPError(401, "invalid_token");
  const row = await env.DB.prepare(
    "SELECT id, principal, expires_at FROM limix_cloud_devices WHERE token_hash = ? AND revoked_at IS NULL",
  ).bind(await sha256(token)).first<Device>();
  if (!row || row.expires_at <= Date.now()) throw new HTTPError(401, "invalid_token");
  return row;
}

async function betaRow(env: Env, principal: string): Promise<BetaRow | null> {
  return env.DB.prepare("SELECT workspace_id, runtime_state, runtime_seen, power_desired, power_since, sleep_enabled, sleep_blocked, power_observed FROM managed_cloud_beta WHERE principal = ?")
    .bind(principal).first<BetaRow>();
}

/** An approved account gets its workspace as soon as the desktop asks; the host picks it up on its next round. */
async function ensureWorkspace(env: Env, principal: string): Promise<BetaRow | null> {
  // The validated project owner has Cloud access without approving their own trial.
  if (principal === "limix:leox") {
    await env.DB.prepare("INSERT INTO managed_cloud_beta(principal) VALUES (?) ON CONFLICT(principal) DO NOTHING")
      .bind(principal).run();
  }
  const row = await betaRow(env, principal);
  if (!row || row.workspace_id) return row;
  await env.DB.prepare("UPDATE managed_cloud_beta SET workspace_id = ?, requested_at = ? WHERE principal = ? AND workspace_id IS NULL")
    .bind(crypto.randomUUID(), new Date().toISOString(), principal).run();
  return betaRow(env, principal);
}

/** The session's `cloud` (docs/cloud-pro.md "What the desktop reads from the Admin"), from the host's last report. */
export function cloudSummary(row: BetaRow, origin: string, routed: boolean, nowSeconds = Date.now() / 1000): Record<string, JSONValue> {
  const stale = !row.runtime_seen || nowSeconds - row.runtime_seen >= STALE_SECONDS;
  const setting = (step: string, slow = false) => ({ state: "setting_up", origin, setup: { step, ...(slow ? { slow: true } : {}) } });
  if (row.sleep_enabled && !row.sleep_blocked && (row.power_observed === "asleep" || row.power_desired === "asleep")) return {
    state: "ready", origin, pairingAvailable: false, moves: true,
    power: { state: row.power_desired === "asleep" ? "asleep" : "waking", since: row.power_since ?? 0, sleeps: true },
  };
  if (!row.runtime_state) return setting("reserving");
  if (stale && row.runtime_state === "running") {
    return { state: "ready", origin, pairingAvailable: false, moves: true, unreachable: { cause: "no_answer", since: (row.runtime_seen ?? 0) * 1000 } };
  }
  if (row.runtime_state === "waiting_capacity") return setting("reserving", true);
  if (row.runtime_state === "starting") return setting("starting", stale);
  if (row.runtime_state === "failed") return { state: "failed", origin, retryAt: Math.ceil(nowSeconds + 30) * 1000 };
  if (!routed) return setting("checking");
  return { state: "ready", origin, pairingAvailable: true, moves: true, ...(row.sleep_enabled && !row.sleep_blocked ? {power:{state:"awake",since:row.power_since ?? 0,sleeps:true}} : {}) };
}

async function trialState(env: Env, principal: string, enrolled: boolean): Promise<string> {
  if (enrolled) return "approved";
  const row = await env.DB.prepare("SELECT decision FROM limix_cloud_requests WHERE principal = ?").bind(principal).first<{ decision: string | null }>();
  return !row ? "none" : row.decision === "declined" ? "declined" : "pending";
}

async function session(env: Env, found: Device): Promise<Response> {
  const row = await ensureWorkspace(env, found.principal);
  const now = Date.now();
  const enrolled = Boolean(row);
  const body: Record<string, JSONValue> = {
    cloudContractVersion: CONTRACT,
    expiresAt: found.expires_at,
    device: { id: found.id },
    account: account(found.principal),
    entitlement: enrolled
      ? { plan: "pro", tier: "personal", status: "active", expiresAt: now + PLAN_WINDOW_MS, version: 1 }
      : { plan: "free", status: "inactive", expiresAt: null, version: 0 },
    limixTrial: await trialState(env, found.principal, enrolled),
  };
  if (row?.workspace_id) {
    const suffix = readConfig(env).cloudflare.companionHostSuffix;
    const routed = (await routedHostnames(env)).has(managedHomeHostname(row.workspace_id, suffix));
    body.cloud = cloudSummary(row, managedHomeOrigin(row.workspace_id, suffix), routed);
  }
  return json(body);
}

async function signIn(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") throw new HTTPError(405, "method_not_allowed");
  const limix = await limixSession(request, env);
  if (!limix) throw new HTTPError(401, "unauthorized");
  const input = (await readOptionalBoundedJSON(request)) as { deviceName?: unknown; platform?: unknown } | undefined;
  const name = typeof input?.deviceName === "string" && PLAIN.test(input.deviceName) ? input.deviceName : "Limix Bot";
  const platform = ["darwin", "win32", "linux"].includes(input?.platform as string) ? input!.platform as string : "unknown";
  const token = `omc_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const id = crypto.randomUUID();
  const now = Date.now(), expiresAt = now + DEVICE_TOKEN_DAYS * 24 * 3600_000;
  await env.DB.prepare(
    "INSERT INTO limix_cloud_devices(id, principal, token_hash, name, platform, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, limix.user.id, await sha256(token), name, platform, now, expiresAt).run();
  return json({ cloudContractVersion: CONTRACT, accessToken: token, expiresAt, device: { id }, account: account(limix.user.id) });
}

async function askForTrial(env: Env, found: Device): Promise<Response> {
  if (!(await betaRow(env, found.principal))) {
    await env.DB.prepare(
      "INSERT INTO limix_cloud_requests(principal, requested_at) VALUES (?, ?) ON CONFLICT(principal) DO UPDATE SET requested_at = excluded.requested_at, decision = NULL, decided_at = NULL WHERE decision = 'declined'",
    ).bind(found.principal, Date.now()).run();
  }
  return session(env, found);
}

/** One ordinary pairing window on the account's own home, opened by the home's signed pairing route. */
async function pairing(env: Env, found: Device, fetcher: typeof fetch): Promise<Response> {
  const row = await betaRow(env, found.principal);
  if (!row?.workspace_id) throw new HTTPError(404, "not_found");
  const suffix = readConfig(env).cloudflare.companionHostSuffix;
  const origin = managedHomeOrigin(row.workspace_id, suffix);
  const routed = (await routedHostnames(env)).has(managedHomeHostname(row.workspace_id, suffix));
  if (cloudSummary(row, origin, routed).pairingAvailable !== true) throw new HTTPError(409, "not_running");
  const body = JSON.stringify({ label: "Limix Bot (Cloud)", ttlSeconds: 300 });
  const secret = await homeBootstrapSecret(managedHostToken(env), row.workspace_id);
  let answer: { code?: unknown; expiresAt?: unknown } | null = null;
  try {
    const response = await fetcher(`${origin}/api/cloud/pairing`, {
      method: "POST", redirect: "manual", body,
      headers: { "content-type": "application/json", ...(await homeRequestHeaders(secret, "POST", "/api/cloud/pairing", body)) },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) answer = await response.json();
    else console.error(JSON.stringify({ message: "home pairing refused", status: response.status }));
  } catch (error) {
    console.error(JSON.stringify({ message: "home pairing unreachable", error: error instanceof Error ? error.name : "unknown" }));
  }
  if (typeof answer?.code !== "string" || !Number.isSafeInteger(answer.expiresAt)) throw new HTTPError(503, "temporarily_unavailable");
  return json({ cloudContractVersion: CONTRACT, origin, code: answer.code, expiresAt: answer.expiresAt as number });
}

const INSTALLATION = /^[A-Za-z0-9_-]{22,64}$/;

async function move(request: Request, env: Env, found: Device, state: "moved" | "kept" | null): Promise<Response> {
  const input = (await readOptionalBoundedJSON(request)) as Record<string, unknown> | undefined;
  const installation = typeof input?.installation === "string" && INSTALLATION.test(input.installation) ? input.installation : null;
  if (!installation) {
    if (state) throw new HTTPError(400, "invalid_request");
    return json({ cloudContractVersion: CONTRACT });
  }
  const status = state ? null : JSON.stringify(input).slice(0, 4000);
  await env.DB.prepare(
    `INSERT INTO limix_cloud_moves(principal, installation, state, status, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(principal, installation) DO UPDATE SET state = COALESCE(?, state), status = COALESCE(excluded.status, status), updated_at = excluded.updated_at`,
  ).bind(found.principal, installation, state ?? "moved", status, Date.now(), state).run();
  return json({ cloudContractVersion: CONTRACT });
}

async function movedTo(request: Request, env: Env, found: Device): Promise<Response> {
  const input = (await readOptionalBoundedJSON(request)) as { origin?: unknown } | undefined;
  const row = await betaRow(env, found.principal);
  const own = row?.workspace_id ? managedHomeOrigin(row.workspace_id, readConfig(env).cloudflare.companionHostSuffix) : null;
  return json({ cloudContractVersion: CONTRACT, state: own && input?.origin === own ? "live" : "unknown" });
}

const DESKTOP = "/api/cloud/desktop/";

/** Null for any path that is not the Admin's. */
export function limixCloudAdminRoute(path: string, request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> | null {
  if (path === "/cloud-admin" || path.startsWith("/api/cloud/owner/")) return cloudOwnerRoute(path, request, env);
  if (path === "/api/public/config") return Promise.resolve(json({ cloudContractVersion: CONTRACT }));
  if (!path.startsWith(DESKTOP)) return null;
  const route = path.slice(DESKTOP.length);
  if (route === "limix-token") return signIn(request, env);
  return (async () => {
    const found = await device(request, env);
    const post = request.method === "POST";
    if (route === "session" && request.method === "GET") return session(env, found);
    if (route === "session" && request.method === "DELETE") {
      await env.DB.prepare("UPDATE limix_cloud_devices SET revoked_at = ? WHERE id = ?").bind(Date.now(), found.id).run();
      return json({ cloudContractVersion: CONTRACT });
    }
    if (route === "wake" && post) {
      const row = await betaRow(env, found.principal);
      if (!row?.workspace_id) throw new HTTPError(404, "not_found");
      await wakeHome(env, row.workspace_id);
      return session(env, found);
    }
    if (route === "trial" && post) return askForTrial(env, found);
    if (route === "pairing" && post) return pairing(env, found, fetcher);
    if (route === "moved" && post) return move(request, env, found, "moved");
    if (route === "kept" && post) return move(request, env, found, "kept");
    if (route === "move-status" && post) return move(request, env, found, null);
    if (route === "moved-to" && post) return movedTo(request, env, found);
    if (route === "export" && post) throw new HTTPError(409, "not_held");
    throw new HTTPError(404, "not_found");
  })();
}
