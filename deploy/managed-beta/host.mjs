import { execFile } from "node:child_process";
import { createHmac } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const run = promisify(execFile);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const composeFile = fileURLToPath(new URL("./compose.yaml", import.meta.url));
const prefix = "limix-home-";
export const EDGE_NETWORK = "limix-managed-edge";
export const TUNNEL_CONTAINER = "limix-managed-tunnel";
export const TUNNEL_IMAGE = "cloudflare/cloudflared:2026.9.3";

async function docker(args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.LIMIX_BETA_HOST_TOKEN;
  const result = await run("docker", args, { env, windowsHide: true, timeout: 90000 });
  return result.stdout.trim();
}

/** The home's OMB_CLOUD_BOOTSTRAP_SECRET, the key the Limix Cloud Admin signs its pairing requests with. The Worker
 * derives the same from the shared host token (cloudflare/control-plane/src/limix-cloud-admin.ts homeBootstrapSecret). */
export function homeBootstrapSecret(hostToken, workspaceId) {
  return createHmac("sha256", hostToken).update("limix-cloud-bootstrap-v1:" + workspaceId).digest("base64url");
}

function originFor(id, origins) {
  const origin = origins?.[id];
  if (typeof origin !== "string" || !new RegExp(`^https://lc-${id.replace(/-/g, "")}\\.[a-z0-9.-]+$`).test(origin)) return null;
  return origin;
}

export async function reconcile(homes, capacity, report, command = docker, { origins = {}, hostToken = "" } = {}) {
  if (!Array.isArray(homes) || !homes.every(id => typeof id === "string" && uuid.test(id)) ||
      new Set(homes).size !== homes.length || !Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error("Invalid host assignments or capacity");
  }
  const active = new Set(homes.slice(0, capacity));
  const listed = await command(["ps", "-a", "--filter", "label=com.limix.managed-home=beta-xeon",
    "--format", '{{.Label "com.docker.compose.project"}}']);
  const compose = (id, args, env = {}) => command(["compose", "-f", composeFile, "-p", prefix + id, ...args], env);
  for (const project of new Set(listed.split(/\r?\n/))) {
    const id = project.slice(prefix.length);
    if (project.startsWith(prefix) && uuid.test(id) && !active.has(id)) {
      await compose(id, ["stop"]);
    }
  }
  for (const id of homes) {
    let state = "waiting_capacity";
    if (active.has(id)) {
      // A Cloud home cannot start without its own address: it waits, as setting up, for the Worker to route it.
      const origin = originFor(id, origins);
      if (!origin || !hostToken) state = "starting";
      else try {
        const env = { LIMIX_HOME_ID: id, LIMIX_HOME_ORIGIN: origin, LIMIX_HOME_SECRET: homeBootstrapSecret(hostToken, id) };
        // --remove-orphans: a home from the earlier beta still has its separate edge container.
        await compose(id, ["up", "-d", "--no-build", "--remove-orphans", "home"], env);
        const container = await compose(id, ["ps", "-q", "home"], env);
        const health = container && await command(["inspect", "--format", "{{.State.Health.Status}}", container]);
        state = health === "healthy" ? "running" : health === "starting" ? "starting" : "failed";
      } catch { state = "failed"; }
    }
    await report(id, state);
  }
}

/** The shared edge network and the host's own Cloudflare Tunnel connector; the token reaches Docker only by environment. */
export async function ensureTunnel(token, command = docker) {
  if (typeof token !== "string" || !/^[\x21-\x7e]{20,4096}$/.test(token)) throw new Error("Invalid tunnel token");
  const networks = await command(["network", "ls", "--filter", "name=^" + EDGE_NETWORK + "$", "--format", "{{.Name}}"]);
  if (!networks.split(/\r?\n/).includes(EDGE_NETWORK)) await command(["network", "create", EDGE_NETWORK]);
  const running = await command(["ps", "-a", "--filter", "name=^" + TUNNEL_CONTAINER + "$", "--format", "{{.State}}"]);
  if (running === "running") return "running";
  if (running) {
    await command(["start", TUNNEL_CONTAINER]);
    return "started";
  }
  await command(["run", "-d", "--name", TUNNEL_CONTAINER, "--restart", "unless-stopped", "--network", EDGE_NETWORK,
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--memory", "128m", "--pids-limit", "64",
    "-e", "TUNNEL_TOKEN", TUNNEL_IMAGE, "tunnel", "--no-autoupdate", "run"], { TUNNEL_TOKEN: token });
  return "created";
}

if (import.meta.main) {
  const token = process.env.LIMIX_BETA_HOST_TOKEN;
  const capacity = Number(process.env.LIMIX_BETA_CAPACITY ?? 1);
  if (!token || token.length < 43 || !process.env.LIMIX_HOME_IMAGE) throw new Error("Set host token and runtime image");
  const base = "https://accounts.limixmedia.com/v1/managed-cloud/host/";
  const call = async (path, report) => {
    const response = await fetch(base + path, { method: report ? "POST" : "GET", redirect: "error",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: report && JSON.stringify(report), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Control plane HTTP " + response.status);
    return response.json();
  };
  let tunnelReady = false;
  for (;;) {
    try {
      if (!tunnelReady) {
        console.log("Tunnel connector:", await ensureTunnel((await call("tunnel")).token));
        tunnelReady = true;
      }
      const { homes, origins, routing } = await call("assignments");
      if (routing !== "ready") console.warn("Public addresses are still being set up; retrying next round.");
      await reconcile(homes, capacity, (id, state) => call("assignments", { id, state }), docker, { origins, hostToken: token });
    } catch (error) {
      console.error("Host reconciliation failed:", error.message);
      if (process.argv.includes("--once")) process.exitCode = 1;
    }
    if (process.argv.includes("--once")) break;
    await delay(30000);
    if (tunnelReady && await docker(["ps", "--filter", "name=^" + TUNNEL_CONTAINER + "$", "--format", "{{.State}}"]).catch(() => "") !== "running") tunnelReady = false;
  }
}
