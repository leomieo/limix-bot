import { readConfig } from "./config";
import { HTTPError, json } from "./http";
import { limixSession } from "./limix-auth";
import { managedHomeHostname, managedHomeOrigin, signManagedGrant } from "./managed-grant";
import { managedHostToken } from "./managed-host";
import { routedHostnames } from "./managed-routing";

interface WorkspaceRow { workspace_id: string | null; runtime_state: string | null; runtime_seen: number | null }

function workspaceState(row: WorkspaceRow): string {
  if (!row.workspace_id) return "available";
  return row.runtime_seen && row.runtime_state
    ? (Date.now() / 1000 - row.runtime_seen < 180 ? row.runtime_state : "host_unreachable")
    : "queued";
}

async function enrolledPrincipal(request: Request, env: Env): Promise<string> {
  const session = await limixSession(request, env);
  if (!session) throw new HTTPError(401, "unauthorized");
  return session.user.id;
}

async function workspaceRow(env: Env, principal: string): Promise<WorkspaceRow> {
  const row = await env.DB.prepare(
    "SELECT workspace_id, runtime_state, runtime_seen FROM managed_cloud_beta WHERE principal = ?",
  ).bind(principal).first<WorkspaceRow>();
  if (!row) throw new HTTPError(403, "beta_enrollment_required");
  return row;
}

export async function managedWorkspace(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") throw new HTTPError(405, "method_not_allowed");
  const principal = await enrolledPrincipal(request, env);
  if (request.method === "POST") {
    await env.DB.prepare(
      "UPDATE managed_cloud_beta SET workspace_id = ?, requested_at = ? WHERE principal = ? AND workspace_id IS NULL",
    ).bind(crypto.randomUUID(), new Date().toISOString(), principal).run();
  }
  const row = await workspaceRow(env, principal);
  if (!row.workspace_id) return json({ state: "available" });
  return json({ state: workspaceState(row), workspaceId: row.workspace_id }, request.method === "POST" ? 202 : 200);
}

/** A short-lived grant for the caller's own workspace only; the home checks signature, workspace, origin, expiry and reuse. */
export async function managedWorkspaceOpen(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") throw new HTTPError(405, "method_not_allowed");
  const hostToken = managedHostToken(env);
  const principal = await enrolledPrincipal(request, env);
  const row = await workspaceRow(env, principal);
  const state = workspaceState(row);
  if (state !== "running" || !row.workspace_id) return json({ state }, 409);
  const suffix = readConfig(env).cloudflare.companionHostSuffix;
  if (!(await routedHostnames(env)).has(managedHomeHostname(row.workspace_id, suffix))) return json({ state: "routing" }, 409);
  const origin = managedHomeOrigin(row.workspace_id, suffix);
  const { grant, expiresAt } = await signManagedGrant(hostToken, { workspaceId: row.workspace_id, principal, origin });
  return json({ state, origin, grant, expiresAt });
}
