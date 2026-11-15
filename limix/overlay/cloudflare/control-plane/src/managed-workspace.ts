import { HTTPError, json } from "./http";
import { limixSession } from "./limix-auth";

export async function managedWorkspace(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") throw new HTTPError(405, "method_not_allowed");
  const session = await limixSession(request, env);
  if (!session) throw new HTTPError(401, "unauthorized");

  const principal = session.user.id;
  if (request.method === "POST") {
    await env.DB.prepare(
      "UPDATE managed_cloud_beta SET workspace_id = ?, requested_at = ? WHERE principal = ? AND workspace_id IS NULL",
    ).bind(crypto.randomUUID(), new Date().toISOString(), principal).run();
  }
  const row = await env.DB.prepare(
    "SELECT workspace_id, runtime_state, runtime_seen FROM managed_cloud_beta WHERE principal = ?",
  ).bind(principal).first<{ workspace_id: string | null; runtime_state: string | null; runtime_seen: number | null }>();
  if (!row) throw new HTTPError(403, "beta_enrollment_required");
  if (!row.workspace_id) return json({ state: "available" });
  const state = row.runtime_seen && row.runtime_state
    ? (Date.now() / 1000 - row.runtime_seen < 180 ? row.runtime_state : "host_unreachable")
    : "queued";
  return json({ state, workspaceId: row.workspace_id }, request.method === "POST" ? 202 : 200);
}
