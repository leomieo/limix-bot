import { readConfig } from "./config";
import { HTTPError } from "./http";
import { managedHomeHostname, managedHomeOrigin } from "./managed-grant";
import { routedHostnames } from "./managed-routing";

const LINK_ORIGIN = "https://cloud.limixmedia.com";
const LINK_PATH = /^\/bot\/([0-9a-f]{24})$/;

export async function cloudAccountLink(env: Env, principal: string): Promise<string> {
  const lookup = env.DB.prepare("SELECT public_id FROM limix_cloud_account_links WHERE principal = ?").bind(principal);
  const existing = await lookup.first<{ public_id: string }>();
  if (existing) return LINK_ORIGIN + "/bot/" + existing.public_id;
  await env.DB.prepare("INSERT INTO limix_cloud_account_links (principal) VALUES (?) ON CONFLICT(principal) DO NOTHING").bind(principal).run();
  const row = await lookup.first<{ public_id: string }>();
  if (!row) throw new Error("Cloud account link missing");
  return LINK_ORIGIN + "/bot/" + row.public_id;
}

export function resolveCloudAccountLink(request: Request, env: Env): Promise<Response> | null {
  const url = new URL(request.url);
  const match = LINK_PATH.exec(url.pathname);
  if (url.origin !== LINK_ORIGIN || !match) return null;
  return redirectToWorkspace(request, env, match[1]!);
}

async function redirectToWorkspace(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") throw new HTTPError(405, "method_not_allowed");
  const row = await env.DB.prepare(`
    SELECT beta.workspace_id
    FROM limix_cloud_account_links AS link
    JOIN managed_cloud_beta AS beta ON beta.principal = link.principal
    WHERE link.public_id = ?
  `).bind(id).first<{ workspace_id: string | null }>();
  const suffix = readConfig(env).cloudflare.companionHostSuffix;
  if (!row?.workspace_id || !(await routedHostnames(env)).has(managedHomeHostname(row.workspace_id, suffix))) {
    return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  }
  return new Response(null, { status: 302, headers: {
    location: managedHomeOrigin(row.workspace_id, suffix),
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  } });
}
