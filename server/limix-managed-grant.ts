// A Limix Cloud beta home (deploy/managed-beta): the desktop brings a grant the account Worker signed for this workspace
// and gets one pairing credential for it. Only the public key is here; a home cannot mint grants for itself or another.
// Security: signature, workspace, audience (this home's own https origin, as the request reached it), expiry and
// single use are all checked before a pairing opens; a bad signature counts toward the pairing lockout.
import { createPublicKey, verify, type KeyObject } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readSignedBody } from "./cloud-home.ts";
import { json } from "./harness/http.ts";
import { requestOrigin, requestSource } from "./request-auth.ts";
import type { SessionRegistry } from "./sessions.ts";

export const LIMIX_MANAGED_GRANT_PATH = "/api/limix/managed/grant";
const SIGNED_PREFIX = "limix-managed-grant.v1.";
const MAX_LIFETIME_S = 120;
const SKEW_S = 60;
const PAIRING_TTL_MS = 120_000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

type GrantSessions = Pick<SessionRegistry, "openPairing" | "attemptAllowed" | "noteFailure" | "clearFailures">;

export interface ManagedGrantConfig { workspaceId: string; origin: string; key: KeyObject }

/** Null unless all three settings are present and valid; a half-configured home refuses to start. */
export function limixManagedGrantConfig(env: NodeJS.ProcessEnv = process.env): ManagedGrantConfig | null {
  const workspaceId = env.LIMIX_MANAGED_WORKSPACE?.trim() ?? "", rawKey = env.LIMIX_MANAGED_GRANT_KEY?.trim() ?? "";
  const rawOrigin = env.OMB_PUBLIC_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!workspaceId && !rawKey) return null;
  if (!UUID.test(workspaceId)) throw new Error("LIMIX_MANAGED_WORKSPACE must be the workspace UUID.");
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawKey)) throw new Error("LIMIX_MANAGED_GRANT_KEY must be an Ed25519 public key (base64url).");
  let origin: URL;
  try { origin = new URL(rawOrigin); } catch { throw new Error("OMB_PUBLIC_URL must be this home's https origin."); }
  if (origin.protocol !== "https:" || origin.origin !== rawOrigin) throw new Error("OMB_PUBLIC_URL must be this home's https origin.");
  return { workspaceId, origin: origin.origin, key: createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: rawKey }, format: "jwk" }) };
}

export function createLimixManagedGrant(config: ManagedGrantConfig, sessions: GrantSessions, now: () => number = Date.now) {
  const used = new Map<string, number>();
  const redeem = (grant: unknown, origin: string | null, source: string): { status: number; body: Record<string, unknown> } => {
    const lock = sessions.attemptAllowed(source);
    if (!lock.ok) return { status: 429, body: { error: "rate_limited", retryAfterSeconds: Math.ceil(lock.retryAfterMs / 1000) } };
    const [payload, signature, extra] = typeof grant === "string" && grant.length < 2048 ? grant.split(".") : [];
    let signed = false;
    try { signed = Boolean(payload && signature && extra === undefined) && verify(null, Buffer.from(SIGNED_PREFIX + payload), config.key, Buffer.from(signature!, "base64url")); } catch { signed = false; }
    if (!signed) {
      sessions.noteFailure(source);
      return { status: 401, body: { error: "invalid_grant" } };
    }
    sessions.clearFailures(source);
    let claims: Record<string, unknown>;
    try { claims = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")); } catch { return { status: 400, body: { error: "invalid_grant" } }; }
    const at = now() / 1000, iat = Number(claims.iat), exp = Number(claims.exp), nonce = claims.nonce;
    if (claims.v !== 1 || claims.ws !== config.workspaceId) return { status: 403, body: { error: "wrong_workspace" } };
    // cloudflared keeps the public Host; the scheme it reports is not relied on, the name is.
    if (claims.aud !== config.origin || origin?.replace(/^https?:/, "") !== config.origin.replace(/^https:/, "")) return { status: 403, body: { error: "wrong_origin" } };
    if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp - iat > MAX_LIFETIME_S || iat > at + SKEW_S || exp < at) {
      return { status: 401, body: { error: "expired_grant" } };
    }
    if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return { status: 400, body: { error: "invalid_grant" } };
    for (const [seen, until] of used) if (until < at) used.delete(seen);
    if (used.has(nonce)) return { status: 401, body: { error: "grant_used" } };
    used.set(nonce, exp + SKEW_S);
    const label = typeof claims.sub === "string" ? `Limix Cloud · ${claims.sub.replace(/^limix:/, "")}`.slice(0, 80) : "Limix Cloud";
    const opened = sessions.openPairing({ scopes: ["admin", "client"], label, ttlMs: PAIRING_TTL_MS });
    return { status: 200, body: { credential: opened.credential, expiresAt: opened.expiresAt } };
  };
  return {
    redeem,
    async handle(req: IncomingMessage, res: ServerResponse, path: string, method: string): Promise<boolean> {
      if (path !== LIMIX_MANAGED_GRANT_PATH) return false;
      res.setHeader("cache-control", "no-store");
      if (method !== "POST") { json(res, 405, { error: "method_not_allowed" }); return true; }
      if (!/^application\/json\b/i.test(String(req.headers["content-type"] ?? ""))) { json(res, 415, { error: "json_required" }); return true; }
      let body: unknown;
      try { body = JSON.parse((await readSignedBody(req)).toString("utf8")); } catch { json(res, 400, { error: "invalid_body" }); return true; }
      const result = redeem((body as { grant?: unknown } | null)?.grant, requestOrigin(req), requestSource(req));
      json(res, result.status, result.body);
      return true;
    },
  };
}
