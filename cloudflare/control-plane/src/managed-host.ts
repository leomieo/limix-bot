import { timingSafeEqual } from "node:crypto";
import { HTTPError, json } from "./http";

interface HostBindings { LIMIX_BETA_HOST_TOKEN?: string }

export async function managedHostAssignments(request: Request, env: Env & HostBindings) {
  const secret = env.LIMIX_BETA_HOST_TOKEN;
  if (!secret || secret.length < 43) throw new HTTPError(503, "host_not_configured");
  const expected = new TextEncoder().encode("Bearer " + secret);
  const actual = new TextEncoder().encode(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new HTTPError(401, "unauthorized");
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as { id?: unknown; state?: unknown } | null;
    if (typeof body?.id !== "string" || typeof body.state !== "string" ||
        !["starting", "running", "failed", "waiting_capacity"].includes(body.state)) {
      throw new HTTPError(400, "invalid_runtime_report");
    }
    const result = await env.DB.prepare(
      "UPDATE managed_cloud_beta SET runtime_state = ?, runtime_seen = unixepoch() WHERE workspace_id = ?",
    ).bind(body.state, body.id).run();
    if (!result.meta.changes) throw new HTTPError(404, "workspace_not_found");
    return json({ ok: true });
  }
  if (request.method !== "GET") throw new HTTPError(405, "method_not_allowed");
  const { results } = await env.DB.prepare(
    "SELECT workspace_id AS id FROM managed_cloud_beta WHERE workspace_id IS NOT NULL ORDER BY requested_at, workspace_id LIMIT 1001",
  ).all<{ id: string }>();
  if (results.length > 1000) throw new HTTPError(503, "beta_registry_too_large");
  return json({ homes: results.map(row => row.id) });
}
