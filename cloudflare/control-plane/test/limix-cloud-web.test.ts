import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import worker from "../src/index";

afterEach(async () => {
  vi.restoreAllMocks();
  await env.DB.batch(["managed_cloud_beta", "limix_cloud_devices", "limix_cloud_requests", "limix_cloud_web_codes"].map(table => env.DB.prepare(`DELETE FROM ${table}`)));
});

it("opens the customer page with a one-time code, and a browser sign-in only manages the account", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    const { token } = JSON.parse(String(init?.body));
    return token.startsWith("token-") ? Response.json({ valid: true, username: token.slice(6) }) : Response.json({ valid: false }, { status: 401 });
  });
  const bindings = { ...env, LIMIX_ACCOUNT_URL: "https://accounts.test", ALLOWED_ORIGINS: "https://cloud.limixmedia.test" as Env["ALLOWED_ORIGINS"] };
  const origin = "https://cloud.limixmedia.test";
  const send = (path: string, init: RequestInit = {}) => worker.fetch(new Request(origin + path, init), bindings, createExecutionContext());
  const signIn = async (name: string) => (await (await send("/api/cloud/desktop/limix-token", { method: "POST",
    headers: { authorization: "Bearer limix." + btoa("one") + ".token-" + name, "content-type": "application/json" }, body: JSON.stringify({ deviceName: "Laptop", platform: "win32" }) })).json()) as { accessToken: string; device: { id: string } };
  const as = (token: string, path: string, method = "GET", body?: object) =>
    send("/api/cloud/desktop/" + path, { method, headers: { origin, authorization: "Bearer " + token, ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
  const exchange = (code: string) => send("/api/cloud/web/exchange", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ code }) });

  expect((await send("/cloud")).status).toBe(200);
  const page = await send("/");
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toContain("text/html");
  expect(page.headers.get("content-security-policy")).toContain("script-src 'nonce-");
  expect(await page.text()).toContain("Limix Cloud");

  const alice = await signIn("alice");
  const { code } = await (await as(alice.accessToken, "web-code", "POST", {})).json() as { code: string };
  expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const first = await exchange(code);
  expect(first.status).toBe(200);
  const web = await first.json() as { accessToken: string };
  expect((await exchange(code)).status).toBe(401);
  expect((await exchange("x".repeat(43))).status).toBe(401);

  expect(await (await as(web.accessToken, "session")).json()).toMatchObject({ account: { id: "limix:alice" } });
  const listed = await (await as(web.accessToken, "devices")).json() as { devices: Array<{ id: string; platform: string; current: boolean }> };
  expect(listed.devices.map(d => d.platform).sort()).toEqual(["web", "win32"]);
  expect(listed.devices.find(d => d.platform === "web")?.current).toBe(true);
  // Moving bots and new codes stay the desktop's.
  for (const route of ["pairing", "moved", "web-code"]) expect((await as(web.accessToken, route, "POST", {})).status).toBe(403);

  // Another account can't sign Alice's computer out.
  const bob = await signIn("bob");
  expect((await as(bob.accessToken, "devices/revoke", "POST", { id: alice.device.id })).status).toBe(404);
  expect((await as(web.accessToken, "devices/revoke", "POST", { id: alice.device.id })).status).toBe(200);
  expect((await as(alice.accessToken, "session")).status).toBe(401);
});
