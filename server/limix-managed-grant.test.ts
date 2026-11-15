import { createHmac, createPrivateKey, createPublicKey, randomUUID, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createLimixManagedGrant, limixManagedGrantConfig } from "./limix-managed-grant.ts";

const HOST_TOKEN = "fixture-host-token-".repeat(3);
const seed = createHmac("sha256", HOST_TOKEN).update("limix-managed-grant-ed25519-v1").digest();
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
const publicX = createPublicKey(privateKey).export({ format: "jwk" }).x!;

function grantFor(claims: Record<string, unknown>, key = privateKey): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(null, Buffer.from("limix-managed-grant.v1." + payload), key).toString("base64url")}`;
}

function home(workspaceId = randomUUID()) {
  const origin = `https://lc-${workspaceId.replace(/-/g, "")}.limixmedia.com`;
  const opened: Array<{ scopes?: string[]; label?: string }> = [], failures: string[] = [];
  const config = limixManagedGrantConfig({ LIMIX_MANAGED_WORKSPACE: workspaceId, LIMIX_MANAGED_GRANT_KEY: publicX, OMB_PUBLIC_URL: origin })!;
  const grants = createLimixManagedGrant(config, {
    openPairing: (input) => { opened.push(input ?? {}); return { id: "p", code: "123456", credential: "omb_pair_fixture", expiresAt: 1 }; },
    attemptAllowed: () => ({ ok: true }),
    noteFailure: (source) => { failures.push(source); },
    clearFailures: () => {},
  }, () => 1_800_000_000_000);
  const claims = (overrides: Record<string, unknown> = {}) => ({ v: 1, ws: workspaceId, sub: "limix:alice", aud: origin, iat: 1_800_000_000, exp: 1_800_000_090, nonce: randomUUID().replace(/-/g, ""), ...overrides });
  return { workspaceId, origin, grants, opened, failures, claims };
}

describe("Limix Cloud beta grants", () => {
  it("opens one pairing for this home's own grant, once", () => {
    const a = home();
    const grant = grantFor(a.claims());
    expect(a.grants.redeem(grant, a.origin, "1.1.1.1")).toEqual({ status: 200, body: { credential: "omb_pair_fixture", expiresAt: 1 } });
    expect(a.opened).toEqual([{ scopes: ["admin", "client"], label: "Limix Cloud · alice", ttlMs: 120_000 }]);
    expect(a.grants.redeem(grant, a.origin, "1.1.1.1")).toMatchObject({ status: 401, body: { error: "grant_used" } });
    expect(a.opened).toHaveLength(1);
  });

  it("refuses another account's grant and any grant presented at another address", () => {
    const a = home(), b = home();
    expect(a.grants.redeem(grantFor(b.claims({ sub: "limix:bob" })), a.origin, "2.2.2.2")).toMatchObject({ status: 403, body: { error: "wrong_workspace" } });
    expect(a.grants.redeem(grantFor(a.claims({ aud: b.origin })), a.origin, "2.2.2.2")).toMatchObject({ status: 403, body: { error: "wrong_origin" } });
    expect(a.grants.redeem(grantFor(a.claims()), b.origin, "2.2.2.2")).toMatchObject({ status: 403, body: { error: "wrong_origin" } });
    expect(a.grants.redeem(grantFor(a.claims()), null, "2.2.2.2")).toMatchObject({ status: 403 });
    expect(a.opened).toHaveLength(0);
    expect(a.grants.redeem(grantFor(a.claims()), "http://" + new URL(a.origin).host, "2.2.2.2")).toMatchObject({ status: 200 });
  });

  it("refuses forged, expired and over-long grants, counting forgeries toward the lockout", () => {
    const a = home();
    const forger = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.alloc(32, 7)]), format: "der", type: "pkcs8" });
    expect(a.grants.redeem(grantFor(a.claims(), forger), a.origin, "3.3.3.3")).toMatchObject({ status: 401, body: { error: "invalid_grant" } });
    expect(a.grants.redeem("not-a-grant", a.origin, "3.3.3.3")).toMatchObject({ status: 401 });
    expect(a.grants.redeem(grantFor(a.claims()) + "x", a.origin, "3.3.3.3")).toMatchObject({ status: 401 });
    expect(a.failures).toEqual(["3.3.3.3", "3.3.3.3", "3.3.3.3"]);
    expect(a.grants.redeem(grantFor(a.claims({ iat: 1_799_999_000, exp: 1_799_999_090 })), a.origin, "3.3.3.3")).toMatchObject({ status: 401, body: { error: "expired_grant" } });
    expect(a.grants.redeem(grantFor(a.claims({ exp: 1_800_003_600 })), a.origin, "3.3.3.3")).toMatchObject({ status: 401, body: { error: "expired_grant" } });
    expect(a.opened).toHaveLength(0);
  });

  it("is off without settings and refuses a partial or unsafe configuration", () => {
    expect(limixManagedGrantConfig({})).toBeNull();
    expect(() => limixManagedGrantConfig({ LIMIX_MANAGED_WORKSPACE: randomUUID() })).toThrow();
    expect(() => limixManagedGrantConfig({ LIMIX_MANAGED_WORKSPACE: randomUUID(), LIMIX_MANAGED_GRANT_KEY: publicX, OMB_PUBLIC_URL: "http://lc-x.limixmedia.com" })).toThrow();
  });
});
