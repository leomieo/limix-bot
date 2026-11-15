import { createHmac } from "node:crypto";
import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { expect, it, vi } from "vitest";
import worker from "../src/index";

it("limits assignment reads and runtime reports to the configured beta host", async () => {
  const token = "test-host-token-".repeat(4);
  const bindings = { ...env, LIMIX_BETA_HOST_TOKEN: token };
  const call = (key: string, body?: object) => worker.fetch(
    new Request("https://auth.openmausbot.test/v1/managed-cloud/host/assignments", {
      method: body ? "POST" : "GET", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      body: body && JSON.stringify(body),
    }), bindings, createExecutionContext());
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO managed_cloud_beta(principal,workspace_id,requested_at,runtime_state,runtime_seen) VALUES ('limix:test', ?, '2026-11-15', NULL, NULL)").bind(id).run();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const wakeKey = createHmac("sha256", token).update("limix-wake-proxy-v1").digest("base64url");
    const wake = (key: string) => worker.fetch(new Request("https://cloud.test/v1/managed-cloud/host/assignments?wake=1", {
      method:"POST", headers:{authorization:"Bearer "+key,"content-type":"application/json"}, body:JSON.stringify({id}),
    }), bindings, createExecutionContext());
    expect((await wake(wakeKey)).status).toBe(200);
    expect((await wake("wrong")).status).toBe(401);
    expect((await call(wakeKey)).status).toBe(401);
    expect((await call("wrong")).status).toBe(401);
    expect((await call("wrong", { id, state: "running" })).status).toBe(401);
    expect(await (await call(token)).json()).toMatchObject({ homes: [id], origins: { [id]: expect.stringMatching(/^https:\/\/lc-[0-9a-f]{32}\./) } });
    expect((await call(token, { id, state: "invented" })).status).toBe(400);
    expect((await call(token, { id: crypto.randomUUID(), state: "running" })).status).toBe(404);
    expect((await call(token, { id, state: "running" })).status).toBe(200);
    expect(await env.DB.prepare("SELECT runtime_state FROM managed_cloud_beta WHERE workspace_id = ?").bind(id).first("runtime_state")).toBe("running");
  } finally {
    await env.DB.prepare("DELETE FROM managed_cloud_beta").run();
  }
});
