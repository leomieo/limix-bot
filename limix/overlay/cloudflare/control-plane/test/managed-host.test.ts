import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { expect, it } from "vitest";
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
  await env.DB.prepare("INSERT INTO managed_cloud_beta VALUES ('limix:test', ?, '2026-11-15', NULL, NULL)").bind(id).run();
  try {
    expect((await call("wrong")).status).toBe(401);
    expect((await call("wrong", { id, state: "running" })).status).toBe(401);
    expect(await (await call(token)).json()).toEqual({ homes: [id] });
    expect((await call(token, { id, state: "invented" })).status).toBe(400);
    expect((await call(token, { id: crypto.randomUUID(), state: "running" })).status).toBe(404);
    expect((await call(token, { id, state: "running" })).status).toBe(200);
    expect(await env.DB.prepare("SELECT runtime_state FROM managed_cloud_beta WHERE workspace_id = ?").bind(id).first("runtime_state")).toBe("running");
  } finally {
    await env.DB.prepare("DELETE FROM managed_cloud_beta").run();
  }
});
