import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import worker from "../src/index";
import { GRANT_SEED_LABEL, GRANT_SIGNED_PREFIX } from "../src/managed-grant";

const HOST_TOKEN = "fixture-host-token-".repeat(3);
const TUNNEL_ID = "6f0d4b52-6a40-4a77-9a3c-7f8f2a6f4c11";

function fakeCloudflare() {
  const records = new Map<string, { id: string; name: string; content: string }>();
  const calls: string[] = [];
  let ingress: unknown[] = [];
  const ok = (result: unknown) => Response.json({ success: true, errors: [], result });
  const handler = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    if (url.hostname === "accounts.test") {
      const { token } = JSON.parse(String(init?.body));
      return Response.json({ valid: true, username: token.slice(6) });
    }
    calls.push(`${method} ${url.pathname}`);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname.endsWith("/cfd_tunnel") && method === "GET") return ok([]);
    if (url.pathname.endsWith("/cfd_tunnel") && method === "POST") return ok({ id: TUNNEL_ID, name: body.name, config_src: "cloudflare" });
    if (url.pathname.endsWith("/token")) return ok("fixture-connector-token-value");
    if (url.pathname.endsWith("/configurations")) { ingress = body.config.ingress; return ok({ config: { ingress } }); }
    if (url.pathname.endsWith("/dns_records") && method === "GET") {
      const name = url.searchParams.get("name.exact");
      return ok([...records.values()].filter(record => record.name === name).map(record => ({ ...record, type: "CNAME", proxied: true })));
    }
    if (url.pathname.endsWith("/dns_records") && method === "POST") {
      const record = { id: crypto.randomUUID().replace(/-/g, ""), name: body.name, content: body.content };
      records.set(record.id, record);
      return ok({ ...record, type: "CNAME", proxied: true });
    }
    const recordId = url.pathname.split("/").pop()!;
    if (method === "GET" && records.has(recordId)) return ok({ ...records.get(recordId), type: "CNAME", proxied: true });
    if (method === "DELETE") { records.delete(recordId); return ok({ id: recordId }); }
    return Response.json({ success: false, errors: [{ code: 81044 }] }, { status: 404 });
  };
  return { handler, records, calls, ingress: () => ingress };
}

async function verifyGrant(grant: string) {
  const [payload, signature] = grant.split(".");
  const mac = await crypto.subtle.importKey("raw", new TextEncoder().encode(HOST_TOKEN), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const seed = new Uint8Array(await crypto.subtle.sign("HMAC", mac, new TextEncoder().encode(GRANT_SEED_LABEL)));
  const der = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20, ...seed]);
  const jwk = await crypto.subtle.exportKey("jwk", await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"])) as JsonWebKey;
  const publicKey = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: jwk.x }, { name: "Ed25519" }, false, ["verify"]);
  const bytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  expect(await crypto.subtle.verify("Ed25519", publicKey, bytes(signature), new TextEncoder().encode(GRANT_SIGNED_PREFIX + payload))).toBe(true);
  return JSON.parse(new TextDecoder().decode(bytes(payload)));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await env.DB.batch([env.DB.prepare("DELETE FROM managed_cloud_beta"), env.DB.prepare("DELETE FROM managed_cloud_host")]);
});

it("routes each workspace through the host tunnel and grants only the caller's own home", async () => {
  const cloudflare = fakeCloudflare();
  vi.spyOn(globalThis, "fetch").mockImplementation(cloudflare.handler);
  const bindings = { ...env, LIMIX_ACCOUNT_URL: "https://accounts.test", LIMIX_BETA_HOST_TOKEN: HOST_TOKEN };
  const send = (path: string, init: RequestInit = {}) => worker.fetch(new Request("https://auth.openmausbot.test" + path, init), bindings, createExecutionContext());
  const host = (path: string, body?: object) => send(path, { method: body ? "POST" : "GET", headers: { authorization: "Bearer " + HOST_TOKEN, "content-type": "application/json" }, body: body && JSON.stringify(body) });
  const customer = (name: string, path: string, method = "POST") => send(path, { method, headers: { authorization: "Bearer limix." + btoa("one") + ".token-" + name } });

  await env.DB.prepare("INSERT INTO managed_cloud_beta(principal) VALUES ('limix:alice'), ('limix:bob')").run();
  const alice = (await (await customer("alice", "/v1/managed-cloud/workspace")).json() as { workspaceId: string }).workspaceId;
  const bob = (await (await customer("bob", "/v1/managed-cloud/workspace")).json() as { workspaceId: string }).workspaceId;
  expect(await (await customer("alice", "/v1/managed-cloud/workspace/open")).json()).toEqual({ state: "queued" });

  expect((await send("/v1/managed-cloud/host/tunnel")).status).toBe(401);
  expect(await (await host("/v1/managed-cloud/host/tunnel")).json()).toEqual({ token: "fixture-connector-token-value" });
  const assignments = await (await host("/v1/managed-cloud/host/assignments")).json() as { homes: string[]; origins: Record<string, string>; routing: string };
  expect(assignments.routing).toBe("ready");
  expect(cloudflare.ingress()).toEqual([
    ...[alice, bob].map(id => ({ hostname: new URL(assignments.origins[id]).hostname, service: "http://limix-managed-wake:8080" }))
      .sort((a, b) => a.hostname.localeCompare(b.hostname)),
    { service: "http_status:404" },
  ]);
  expect([...cloudflare.records.values()].every(record => record.content === `${TUNNEL_ID}.cfargotunnel.com`)).toBe(true);

  expect(await (await customer("alice", "/v1/managed-cloud/workspace/open")).json()).toEqual({ state: "queued" });
  await host("/v1/managed-cloud/host/assignments", { id: alice, state: "running" });
  await host("/v1/managed-cloud/host/assignments", { id: bob, state: "running" });
  expect((await customer("eve", "/v1/managed-cloud/workspace/open")).status).toBe(403);
  expect((await customer("alice", "/v1/managed-cloud/workspace/open", "GET")).status).toBe(405);

  const opened = await (await customer("alice", "/v1/managed-cloud/workspace/open")).json() as { origin: string; grant: string };
  expect(opened.origin).toBe(assignments.origins[alice]);
  const claims = await verifyGrant(opened.grant);
  expect(claims).toMatchObject({ v: 1, ws: alice, sub: "limix:alice", aud: assignments.origins[alice] });
  expect(claims.exp - claims.iat).toBe(90);
  const bobs = await (await customer("bob", "/v1/managed-cloud/workspace/open")).json() as { origin: string; grant: string };
  expect(await verifyGrant(bobs.grant)).toMatchObject({ ws: bob, aud: assignments.origins[bob] });
  expect(bobs.origin).not.toBe(opened.origin);

  const configures = cloudflare.calls.filter(call => call.endsWith("/configurations")).length;
  await host("/v1/managed-cloud/host/assignments");
  expect(cloudflare.calls.filter(call => call.endsWith("/configurations")).length).toBe(configures);

  await env.DB.prepare("DELETE FROM managed_cloud_beta WHERE principal = 'limix:bob'").run();
  await host("/v1/managed-cloud/host/assignments");
  expect(cloudflare.ingress()).toEqual([{ hostname: new URL(assignments.origins[alice]).hostname, service: "http://limix-managed-wake:8080" }, { service: "http_status:404" }]);
  expect([...cloudflare.records.values()].map(record => record.name)).toEqual([new URL(assignments.origins[alice]).hostname]);
});

it("never takes over or deletes a DNS record that points elsewhere", async () => {
  const cloudflare = fakeCloudflare();
  vi.spyOn(globalThis, "fetch").mockImplementation(cloudflare.handler);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const id = crypto.randomUUID();
  const hostname = `lc-${id.replace(/-/g, "")}.openmausbot.com`;
  cloudflare.records.set("foreign", { id: "foreign", name: hostname, content: "someone-else.example.com" });
  await env.DB.prepare("INSERT INTO managed_cloud_beta(principal,workspace_id,requested_at,runtime_state,runtime_seen) VALUES ('limix:carol', ?, '2026-11-15', 'running', unixepoch())").bind(id).run();
  const bindings = { ...env, LIMIX_ACCOUNT_URL: "https://accounts.test", LIMIX_BETA_HOST_TOKEN: HOST_TOKEN };
  const response = await worker.fetch(new Request("https://auth.openmausbot.test/v1/managed-cloud/host/assignments", { headers: { authorization: "Bearer " + HOST_TOKEN } }), bindings, createExecutionContext());
  expect(await response.json()).toMatchObject({ routing: "pending" });
  expect(cloudflare.records.get("foreign")?.content).toBe("someone-else.example.com");
  expect(cloudflare.ingress()).toEqual([{ service: "http_status:404" }]);
  const open = await worker.fetch(new Request("https://auth.openmausbot.test/v1/managed-cloud/workspace/open", { method: "POST", headers: { authorization: "Bearer limix." + btoa("one") + ".token-carol" } }), bindings, createExecutionContext());
  expect(await open.json()).toEqual({ state: "routing" });
});
