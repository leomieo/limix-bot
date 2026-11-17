import { sampleHomePower, wakeHostRequest, type PowerRow } from "./cloud-power-admin";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readConfig } from "./config";
import { HTTPError, json } from "./http";
import { managedHomeOrigin } from "./managed-grant";
import { hostConnectorToken, syncHostRouting } from "./managed-routing";

interface HostBindings { LIMIX_BETA_HOST_TOKEN?: string }

export function managedHostToken(env: Env & HostBindings): string {
  const secret = env.LIMIX_BETA_HOST_TOKEN;
  if (!secret || secret.length < 43) throw new HTTPError(503, "host_not_configured");
  return secret;
}

function requireHost(request: Request, env: Env & HostBindings, wakeOnly = false) {
  const hostKey = managedHostToken(env);
  const key = wakeOnly ? createHmac("sha256", hostKey).update("limix-wake-proxy-v1").digest("base64url") : hostKey;
  const expected = new TextEncoder().encode("Bearer " + key);
  const actual = new TextEncoder().encode(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new HTTPError(401, "unauthorized");
  }
}

export async function managedHostTunnel(request: Request, env: Env & HostBindings) {
  requireHost(request, env);
  if (request.method !== "GET") throw new HTTPError(405, "method_not_allowed");
  try {
    return json({ token: await hostConnectorToken(env) });
  } catch (error) {
    console.error(JSON.stringify({ message: "managed host tunnel unavailable", error: error instanceof Error ? error.message : "unknown" }));
    throw new HTTPError(503, "tunnel_unavailable");
  }
}

export async function managedHostAssignments(request: Request, env: Env & HostBindings) {
  const wakeOnly = request.method === "POST" && new URL(request.url).searchParams.get("wake") === "1";
  requireHost(request, env, wakeOnly);
  if (wakeOnly) return wakeHostRequest(request, env);
  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as { id?: unknown; state?: unknown; sleepBlocked?: unknown } | null;
    if (typeof body?.id !== "string" || typeof body.state !== "string" ||
        !["starting", "running", "failed", "waiting_capacity", "asleep"].includes(body.state)) {
      throw new HTTPError(400, "invalid_runtime_report");
    }
    const result = await env.DB.prepare(
      "UPDATE managed_cloud_beta SET runtime_state = ?, runtime_seen = unixepoch(), sleep_blocked = ?, power_observed = ?, power_desired = CASE WHEN ? = 'running' THEN 'awake' ELSE power_desired END WHERE workspace_id = ?",
    ).bind(body.state === "asleep" ? "starting" : body.state, body.sleepBlocked === false ? 0 : 1, body.state === "asleep" ? "asleep" : "awake", body.state, body.id).run();
    if (!result.meta.changes) throw new HTTPError(404, "workspace_not_found");
    return json({ ok: true });
  }
  if (request.method !== "GET") throw new HTTPError(405, "method_not_allowed");
  const query = new URL(request.url).searchParams;
  if (query.has("cpus") || query.has("memoryGb") || query.has("capacity")) {
    const cpus = Number(query.get("cpus"));
    const memoryGb = Number(query.get("memoryGb"));
    const capacity = Number(query.get("capacity"));
    if (!Number.isInteger(cpus) || cpus < 1 || cpus > 65536 ||
        !Number.isFinite(memoryGb) || memoryGb < 1 || memoryGb > 1048576 ||
        !Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
      throw new HTTPError(400, "invalid_host_resources");
    }
    await env.DB.prepare(
      "INSERT INTO limix_cloud_host_resources(id,cpus,memory_gb,capacity,reported_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cpus=excluded.cpus,memory_gb=excluded.memory_gb,capacity=excluded.capacity,reported_at=excluded.reported_at",
    ).bind(cpus, memoryGb, capacity, Date.now()).run();
  }
  const { results } = await env.DB.prepare(
    "SELECT workspace_id AS id, power_desired, power_since, power_revision, next_due_at, sleep_enabled, sleep_blocked, runtime_state FROM managed_cloud_beta WHERE workspace_id IS NOT NULL ORDER BY requested_at, workspace_id LIMIT 1001",
  ).all<PowerRow>();
  if (results.length > 1000) throw new HTTPError(503, "beta_registry_too_large");
  await Promise.all(results.filter(row => row.power_desired === "asleep").map(row => sampleHomePower(env, row)));
  await Promise.all(results.filter(row => row.power_desired !== "asleep" && row.sleep_enabled && !row.sleep_blocked && row.runtime_state === "running").slice(0, 8).map(row => sampleHomePower(env, row)));
  const { results: current } = await env.DB.prepare("SELECT workspace_id AS id, power_desired FROM managed_cloud_beta WHERE workspace_id IS NOT NULL").all<{id: string; power_desired: string}>();
  const power = Object.fromEntries(current.map(row => [row.id, row.power_desired]));
  const homes = results.map(row => row.id);
  let routing = "pending";
  try {
    routing = await syncHostRouting(env, homes) ? "ready" : "pending";
  } catch (error) {
    console.error(JSON.stringify({ message: "managed host routing sync failed", error: error instanceof Error ? error.message : "unknown" }));
  }
  const suffix = readConfig(env).cloudflare.companionHostSuffix;
  const { results: resourceRows } = await env.DB.prepare('SELECT b.workspace_id AS id,r.cpus,r.memory_gb FROM managed_cloud_beta b JOIN limix_cloud_resource_overrides r ON r.principal=b.principal WHERE b.workspace_id IS NOT NULL').all<{id:string;cpus:number;memory_gb:number}>();
  const resources = Object.fromEntries(resourceRows.map(row=>[row.id,{cpus:row.cpus,memoryGb:row.memory_gb}]));
  return json({ homes, power, resources, origins: Object.fromEntries(homes.map(id => [id, managedHomeOrigin(id, suffix)])), routing });
}
