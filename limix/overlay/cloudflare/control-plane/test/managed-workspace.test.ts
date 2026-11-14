import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { expect, it, vi } from "vitest";
import worker from "../src/index";

it("queues one workspace per enrolled Limix account across retries and devices", async () => {
  const bindings = { ...env, LIMIX_ACCOUNT_URL: "https://accounts.test" };
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const { token } = JSON.parse(String(init?.body));
    return Response.json({ valid: true, username: token.slice(6) });
  });
  const call = (account: string, method = "POST", machine = "one") => worker.fetch(
    new Request("https://auth.openmausbot.test/v1/managed-cloud/workspace?principal=limix:alice", {
      method, headers: account ? { authorization: "Bearer limix." + btoa(machine) + ".token-" + account } : {},
    }), bindings, createExecutionContext(),
  );
  try {
    await env.DB.prepare("INSERT INTO managed_cloud_beta(principal) VALUES ('limix:alice'), ('limix:bob')").run();
    expect((await call("")).status).toBe(401);
    expect((await call("eve")).status).toBe(403);
    expect(await (await call("alice", "GET")).json()).toEqual({ state: "available" });
    const responses = await Promise.all([call("alice"), call("alice", "POST", "two")]);
    expect(responses.map(r => r.status)).toEqual([202, 202]);
    const [a, retry] = await Promise.all(responses.map(r => r.json()));
    expect(a).toMatchObject({ state: "queued", workspaceId: expect.any(String) });
    expect(retry).toEqual(a);
    expect(await (await call("alice", "GET")).json()).toEqual(a);
    expect(await (await call("bob", "GET")).json()).toEqual({ state: "available" });
    expect(await (await call("bob")).json()).not.toEqual(a);
    fetchMock.mockResolvedValue(Response.json({ valid: true, username: "alice" }, { status: 403 }));
    expect((await call("alice")).status).toBe(401);
  } finally {
    fetchMock.mockRestore();
    await env.DB.prepare("DELETE FROM managed_cloud_beta").run();
  }
});
