import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import worker from "../src/index";
import { cloudSummary, homeBootstrapSecret } from "../src/limix-cloud-admin";

const HOST_TOKEN = "fixture-host-token-".repeat(3);
const TUNNEL_ID = "6f0d4b52-6a40-4a77-9a3c-7f8f2a6f4c11";
const encoder = new TextEncoder();
const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function signatureOf(secret: string, headers: Headers, body: string) {
  const hash = b64(await crypto.subtle.digest("SHA-256", encoder.encode(body)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const canonical = `v1\n${headers.get("x-omb-cloud-timestamp")}\n${headers.get("x-omb-cloud-nonce")}\nPOST\n/api/cloud/pairing\n${hash}`;
  return "v1=" + b64(await crypto.subtle.sign("HMAC", key, encoder.encode(canonical)));
}

function fakes() {
  const records = new Map<string, { id: string; name: string; content: string }>();
  const pairings: string[] = [];
  const ok = (result: unknown) => Response.json({ success: true, errors: [], result });
  const handler = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    if (url.hostname === "accounts.test") {
      const { token } = JSON.parse(String(init?.body));
      return token.startsWith("token-") ? Response.json({ valid: true, username: token.slice(6) }) : Response.json({ valid: false }, { status: 401 });
    }
    if (url.hostname.startsWith("lc-")) {
      // A home on the Xeon: it opens a pairing only for its own bootstrap secret.
      const hex = url.hostname.slice(3, 35);
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      const headers = new Headers(init?.headers);
      const body = String(init?.body);
      if (url.pathname !== "/api/cloud/pairing" || headers.get("x-omb-cloud-signature") !== await signatureOf(await homeBootstrapSecret(HOST_TOKEN, id), headers, body)) {
        return Response.json({ error: "invalid_signature" }, { status: 401 });
      }
      pairings.push(id);
      return Response.json({ code: "ABCD-EFGH-JKLM", credential: "omb_pair_x", expiresAt: Date.now() + 300_000 });
    }
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname.endsWith("/cfd_tunnel") && method === "GET") return ok([]);
    if (url.pathname.endsWith("/cfd_tunnel") && method === "POST") return ok({ id: TUNNEL_ID, name: body.name, config_src: "cloudflare" });
    if (url.pathname.endsWith("/configurations")) return ok({ config: { ingress: body.config.ingress } });
    if (url.pathname.endsWith("/dns_records") && method === "GET") {
      const name = url.searchParams.get("name.exact");
      return ok([...records.values()].filter(record => record.name === name).map(record => ({ ...record, type: "CNAME", proxied: true })));
    }
    if (url.pathname.endsWith("/dns_records") && method === "POST") {
      const record = { id: crypto.randomUUID().replace(/-/g, ""), name: body.name, content: body.content };
      records.set(record.id, record);
      return ok({ ...record, type: "CNAME", proxied: true });
    }
    return Response.json({ success: false, errors: [{ code: 81044 }] }, { status: 404 });
  };
  return { handler, pairings };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await env.DB.batch(["managed_cloud_beta", "managed_cloud_host", "limix_cloud_devices", "limix_cloud_requests", "limix_cloud_moves", "limix_cloud_account_links"]
    .map(table => env.DB.prepare(`DELETE FROM ${table}`)));
});

it("signs a Limix account in, takes its trial request, and pairs only its own home once the host runs it", async () => {
  const fake = fakes();
  vi.spyOn(globalThis, "fetch").mockImplementation(fake.handler);
  const bindings = { ...env, LIMIX_ACCOUNT_URL: "https://accounts.test", ALLOWED_ORIGINS: "https://cloud.limixmedia.test" as Env["ALLOWED_ORIGINS"], LIMIX_BETA_HOST_TOKEN: HOST_TOKEN };
  const send = (path: string, init: RequestInit = {}) => worker.fetch(new Request("https://cloud.limixmedia.test" + path, init), bindings, createExecutionContext());
  const signIn = async (name: string) => {
    const response = await send("/api/cloud/desktop/limix-token", { method: "POST", headers: { authorization: "Bearer limix." + btoa("one") + ".token-" + name, "content-type": "application/json" },
      body: JSON.stringify({ deviceName: "Laptop", platform: "win32", appVersion: "0.3.52" }) });
    expect(response.status).toBe(200);
    return await response.json() as { accessToken: string; account: { id: string }; device: { id: string }; expiresAt: number; cloudContractVersion: number };
  };
  const as = (token: string, path: string, method = "GET", body?: object) =>
    send("/api/cloud/desktop/" + path, { method, headers: { origin: "https://cloud.limixmedia.test", authorization: "Bearer " + token, ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
  const host = (path: string, body?: object) => send("/v1/managed-cloud/host/" + path, { method: body ? "POST" : "GET", headers: { authorization: "Bearer " + HOST_TOKEN, "content-type": "application/json" }, body: body && JSON.stringify(body) });

  expect((await send("/api/cloud/desktop/limix-token", { method: "POST", headers: { authorization: "Bearer limix." + btoa("one") + ".bad" } })).status).toBe(401);
  const alice = await signIn("alice");
  expect(alice).toMatchObject({ cloudContractVersion: 1, account: { id: "limix:alice", email: "alice" } });
  expect(alice.accessToken).toMatch(/^omc_[A-Za-z0-9_-]{43}$/);
  expect((await as("omc_" + "x".repeat(43), "session")).status).toBe(401);
  expect(await (await as("omc_" + "x".repeat(43), "session")).json()).toEqual({ error: "invalid_token" });

  let session = await (await as(alice.accessToken, "session")).json() as Record<string, any>;
  expect(session).toMatchObject({ cloudContractVersion: 1, device: { id: alice.device.id }, account: { id: "limix:alice" }, entitlement: { plan: "free", status: "inactive" }, limixTrial: "none" });
  expect(session.cloud).toBeUndefined();
  session = await (await as(alice.accessToken, "trial", "POST")).json() as Record<string, any>;
  expect(session.limixTrial).toBe("pending");
  expect((await as(alice.accessToken, "pairing", "POST", {})).status).toBe(404);

  // The operator approves: the next session read reserves the workspace and the host picks it up.
  await env.DB.prepare("INSERT INTO managed_cloud_beta(principal) VALUES ('limix:alice')").run();
  session = await (await as(alice.accessToken, "session")).json() as Record<string, any>;
  expect(session).toMatchObject({ entitlement: { plan: "pro", status: "active" }, limixTrial: "approved", cloud: { state: "setting_up", setup: { step: "reserving" } } });
  const accountLink = session.cloud.accountLink as string;
  expect(accountLink).toMatch(/^https:\/\/cloud\.limixmedia\.com\/bot\/[0-9a-f]{24}$/);
  const followLink = (init?: RequestInit, suffix = "") => worker.fetch(new Request(accountLink + suffix, init), bindings, createExecutionContext());
  expect((await followLink()).status).toBe(404);
  const assignments = await (await host("assignments")).json() as { homes: string[]; origins: Record<string, string> };
  const [workspace] = assignments.homes;
  const redirect = await followLink(undefined, "?next=https://elsewhere.test");
  expect(redirect.status).toBe(302);
  expect(redirect.headers.get("location")).toBe(assignments.origins[workspace]);
  expect(redirect.headers.get("cache-control")).toBe("no-store");
  expect(redirect.headers.has("set-cookie")).toBe(false);
  expect((await followLink({ method: "POST" })).status).toBe(405);
  expect(session.cloud.origin).toBe(assignments.origins[workspace]);
  expect((await as(alice.accessToken, "pairing", "POST", {})).status).toBe(409);
  await host("assignments", { id: workspace, state: "running" });
  session = await (await as(alice.accessToken, "session")).json() as Record<string, any>;
  expect(session.cloud).toEqual({ state: "ready", origin: assignments.origins[workspace], pairingAvailable: true, moves: true, accountLink });

  const paired = await (await as(alice.accessToken, "pairing", "POST", {})).json() as Record<string, unknown>;
  expect(paired).toMatchObject({ cloudContractVersion: 1, origin: assignments.origins[workspace], code: "ABCD-EFGH-JKLM" });
  expect(fake.pairings).toEqual([workspace]);

  // Another account sees nothing of Alice's and cannot pair her home.
  const bob = await signIn("bob");
  expect((await as(bob.accessToken, "pairing", "POST", {})).status).toBe(404);
  expect(await (await as(bob.accessToken, "moved-to", "POST", { origin: assignments.origins[workspace] })).json()).toEqual({ cloudContractVersion: 1, state: "unknown" });
  expect(await (await as(alice.accessToken, "moved-to", "POST", { origin: assignments.origins[workspace] })).json()).toEqual({ cloudContractVersion: 1, state: "live" });
  expect((await as(alice.accessToken, "moved", "POST", { installation: "i".repeat(22) })).status).toBe(200);
  expect((await as(alice.accessToken, "export", "POST", {})).status).toBe(409);

  await env.DB.prepare("DELETE FROM managed_cloud_beta WHERE principal = 'limix:alice'").run();
  expect((await followLink()).status).toBe(404);
  await env.DB.prepare("INSERT INTO managed_cloud_beta(principal) VALUES ('limix:alice')").run();
  const replacement = await (await as(alice.accessToken, "session")).json() as Record<string, any>;
  expect(replacement.cloud.accountLink).toBe(accountLink);
  expect(replacement.cloud.origin).not.toBe(session.cloud.origin);
  await host("assignments");
  expect((await followLink()).headers.get("location")).toBe(replacement.cloud.origin);

  expect((await as(alice.accessToken, "session", "DELETE", {})).status).toBe(200);
  expect((await as(alice.accessToken, "session")).status).toBe(401);
  await env.DB.prepare("INSERT INTO limix_cloud_requests(principal,requested_at) VALUES ('limix:review',1)").run();
  const review = (origin: string, name: string) => send("/api/cloud/owner/decision", {
    method: "POST", headers: { origin, authorization: "Bearer limix." + btoa("one") + ".token-" + name, "content-type": "application/json" },
    body: JSON.stringify({ principal: "limix:review", decision: "approve" }),
  });
  expect((await review("https://cloud.limixmedia.test", "Leox")).status).toBe(200);
  expect((await review("https://cloud.limixmedia.test", "alice")).status).toBe(403);
  expect((await review("https://attacker.test", "Leox")).status).toBe(403);
  const owner = await signIn("Leox");
  const ownerSession = await (await as(owner.accessToken, "session")).json();
  expect(ownerSession).toMatchObject({ account: { id: "limix:leox" }, entitlement: { status: "active" }, limixTrial: "approved" });
  const ownerWorkspace = await env.DB.prepare("SELECT workspace_id FROM managed_cloud_beta WHERE principal='limix:leox'").first();
  expect(ownerWorkspace).toMatchObject({ workspace_id: expect.any(String) });
  await as(owner.accessToken, "session");
  expect(await env.DB.prepare("SELECT workspace_id FROM managed_cloud_beta WHERE principal='limix:leox'").first()).toEqual(ownerWorkspace);

});

it("reads the host's report as the desktop's setup steps", () => {
  const origin = "https://lc-x.limixmedia.com", now = 1_800_000_000;
  const row = (runtime_state: string | null, seen: number | null = now - 10) => ({ workspace_id: "w", runtime_state, runtime_seen: seen });
  expect(cloudSummary(row(null, null), origin, false, now)).toEqual({ state: "setting_up", origin, setup: { step: "reserving" } });
  expect(cloudSummary(row("waiting_capacity"), origin, true, now)).toEqual({ state: "setting_up", origin, setup: { step: "reserving", slow: true } });
  expect(cloudSummary(row("starting"), origin, true, now)).toEqual({ state: "setting_up", origin, setup: { step: "starting" } });
  expect(cloudSummary(row("running"), origin, false, now)).toEqual({ state: "setting_up", origin, setup: { step: "checking" } });
  expect(cloudSummary(row("failed"), origin, true, now)).toMatchObject({ state: "failed", origin });
  expect(cloudSummary(row("running", now - 600), origin, true, now)).toMatchObject({ state: "ready", pairingAvailable: false, unreachable: { cause: "no_answer" } });
});
