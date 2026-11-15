// The Xeon host's own tunnel: one hostname per Cloud beta workspace, each routed to that workspace's edge container.
// Security: this Worker owns the whole tunnel named HOST_TUNNEL_NAME, so replacing its ingress is safe; a DNS record is
// created or deleted only when it is a CNAME to that tunnel, never someone else's record with the same name.
import { CloudflareAPI, type CloudflareFetch } from "./cloudflare-api";
import { readConfig } from "./config";
import { managedHomeHostname } from "./managed-grant";

export const HOST_TUNNEL_NAME = "limix-cloud-beta-host";

interface HostRow { tunnel_id: string; routed: string; configured: string | null }

function api(env: Env, fetcher: CloudflareFetch) {
  const config = readConfig(env);
  return { client: new CloudflareAPI(config.cloudflare, fetcher), suffix: config.cloudflare.companionHostSuffix };
}

export async function hostTunnelId(env: Env, fetcher: CloudflareFetch = fetch): Promise<string> {
  const saved = await env.DB.prepare("SELECT tunnel_id FROM managed_cloud_host WHERE id = 1").first<string>("tunnel_id");
  if (saved) return saved;
  const { client } = api(env, fetcher);
  const tunnel = (await client.listTunnels(HOST_TUNNEL_NAME))[0] ?? await client.createTunnel(HOST_TUNNEL_NAME);
  await env.DB.prepare("INSERT INTO managed_cloud_host(id, tunnel_id) VALUES (1, ?) ON CONFLICT(id) DO NOTHING").bind(tunnel.id).run();
  return (await env.DB.prepare("SELECT tunnel_id FROM managed_cloud_host WHERE id = 1").first<string>("tunnel_id"))!;
}

export async function hostConnectorToken(env: Env, fetcher: CloudflareFetch = fetch): Promise<string> {
  return api(env, fetcher).client.getConnectorToken(await hostTunnelId(env, fetcher));
}

export async function routedHostnames(env: Env): Promise<Set<string>> {
  const routed = await env.DB.prepare("SELECT routed, configured FROM managed_cloud_host WHERE id = 1").first<{ routed: string; configured: string | null }>();
  if (!routed?.configured) return new Set();
  const live = new Set(routed.configured.replace(/^wake-v1:/, "").split(",").filter(Boolean));
  return new Set(Object.keys(JSON.parse(routed.routed) as Record<string, string>).filter(name => live.has(name)));
}

/** Brings DNS and ingress in line with the workspaces; progress is saved after each step, so a failure resumes later. */
export async function syncHostRouting(env: Env, workspaceIds: string[], fetcher: CloudflareFetch = fetch): Promise<boolean> {
  const tunnelId = await hostTunnelId(env, fetcher);
  const { client, suffix } = api(env, fetcher);
  const target = `${tunnelId}.cfargotunnel.com`;
  const row = (await env.DB.prepare("SELECT tunnel_id, routed, configured FROM managed_cloud_host WHERE id = 1").first<HostRow>())!;
  const routed = JSON.parse(row.routed) as Record<string, string>;
  const desired = new Map(workspaceIds.map(id => [managedHomeHostname(id, suffix), id]));
  const save = () => env.DB.prepare("UPDATE managed_cloud_host SET routed = ? WHERE id = 1").bind(JSON.stringify(routed)).run();
  let complete = true;

  for (const hostname of desired.keys()) {
    if (routed[hostname]) continue;
    const records = await client.listDNSRecords(hostname);
    const ours = records.find(record => record.content.toLowerCase() === target);
    if (ours) routed[hostname] = ours.id;
    else if (records.length) { complete = false; continue; }
    else routed[hostname] = (await client.createDNSRecord(hostname, tunnelId)).id;
    await save();
  }
  const rules = [...desired].filter(([hostname]) => routed[hostname]).sort(([a], [b]) => a.localeCompare(b))
    .map(([hostname]) => ({ hostname, service: "http://limix-managed-wake:8080" }));
  const configured = rules.map(rule => rule.hostname).join(",");
  const wakeVersion = "wake-v1:";
  if (wakeVersion + configured !== row.configured) {
    await client.configureTunnelIngress(tunnelId, rules);
    await env.DB.prepare("UPDATE managed_cloud_host SET configured = ? WHERE id = 1").bind(wakeVersion + configured).run();
  }
  for (const [hostname, recordId] of Object.entries(routed)) {
    if (desired.has(hostname)) continue;
    const record = await client.getDNSRecord(recordId);
    if (record && record.content.toLowerCase() === target && record.name.toLowerCase() === hostname) await client.deleteDNSRecord(recordId);
    delete routed[hostname];
    await save();
  }
  return complete;
}
