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

export async function reconcile(homes, capacity, report, command = docker, { origins = {}, hostToken = "", power = {}, gateway = "1" } = {}) {
  if (!Array.isArray(homes) || !homes.every(id => typeof id === "string" && uuid.test(id)) ||
      new Set(homes).size !== homes.length || !Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error("Invalid host assignments or capacity");
  }
  const running = await command(["ps", "--filter", "label=com.limix.managed-home=beta-xeon",
    "--format", '{{.Label "com.docker.compose.project"}}']);
  const resident = new Set(running.split(/\r?\n/));
  const eligible = homes.filter(id => power[id] !== "asleep" || gateway !== "0");
  const active = new Set(eligible.filter(id => resident.has(prefix + id)));

  const listed = await command(["ps", "-a", "--filter", "label=com.limix.managed-home=beta-xeon",
    "--format", '{{.Label "com.docker.compose.project"}}']);
  const compose = (id, args, env = {}) => command(["compose", "-f", composeFile, "-p", prefix + id, ...args], env);
  const refusedSleep = new Set();
  for (const project of new Set(listed.split(/\r?\n/))) {
    const id = project.slice(prefix.length);
    if (project.startsWith(prefix) && uuid.test(id) && (!homes.includes(id) || (power[id] === "asleep" && gateway === "0"))) {
      if (power[id] === "asleep" && gateway === "0") {
        const container = await compose(id, ["ps", "-q", "home"]);
        if (container) {
          const prepared = await command(["exec", "-e", "LIMIX_PROBE_SECRET", "-e", "LIMIX_PROBE_HOST", container, "node", "/opt/limix-power-probe.mjs"],
            { LIMIX_PROBE_SECRET: homeBootstrapSecret(hostToken, id), LIMIX_PROBE_HOST: new URL(originFor(id, origins)).host }).catch(() => "unknown");
          if (prepared !== "prepared") { refusedSleep.add(id); continue; }
        }
      }
      await compose(id, ["stop"]);
    }
  }
  for (const id of eligible) {
    if (active.size + refusedSleep.size >= capacity) break;
    active.add(id);
  }
  for (const id of homes) {
    let state = "waiting_capacity";
    if (power[id] === "asleep" && gateway === "0") state = "asleep";
    if (active.has(id)) {
      // A Cloud home cannot start without its own address: it waits, as setting up, for the Worker to route it.
      const origin = originFor(id, origins);
      if (!origin || !hostToken) state = "starting";
      else try {
        const env = { LIMIX_HOME_ID: id, LIMIX_HOME_ORIGIN: origin, LIMIX_HOME_SECRET: homeBootstrapSecret(hostToken, id), LIMIX_HOME_GATEWAY: gateway };
        // --remove-orphans: a home from the earlier beta still has its separate edge container.
        await compose(id, ["up", "-d", "--no-build", "--remove-orphans", "home"], env);
        const container = await compose(id, ["ps", "-q", "home"], env);
        const health = container && await command(["inspect", "--format", "{{.State.Health.Status}}", container]);
        state = health === "healthy" ? "running" : health === "starting" ? "starting" : "failed";
      } catch { state = "failed"; }
    }
    await report(id, refusedSleep.has(id) ? "running" : state);
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
  const wakeName = "limix-managed-wake";
  await ensureTunnel((await call("tunnel")).token);
  const wakeRunning = await docker(["ps", "-a", "--filter", "name=^"+wakeName+"$", "--format", "{{.State}}"]);
  if (!wakeRunning) await docker(["run", "-d", "--name", wakeName, "--restart", "unless-stopped", "--network", EDGE_NETWORK,
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--read-only", "--user", "1000:1000", "--memory", "128m", "--pids-limit", "64",
    "--no-healthcheck", "-e", "LIMIX_WAKE_HOST_TOKEN", "-e", "LIMIX_WAKE_SUFFIX", "--entrypoint", "node", process.env.LIMIX_HOME_IMAGE, "/opt/limix-wake-proxy.mjs"],
    { LIMIX_WAKE_HOST_TOKEN: createHmac("sha256", token).update("limix-wake-proxy-v1").digest("base64url"), LIMIX_WAKE_SUFFIX: process.env.LIMIX_WAKE_SUFFIX || "limixmedia.com" });
  else if (wakeRunning !== "running") await docker(["start", wakeName]);
  let tunnelReady = true;
  for (;;) {
    try {
      if (!tunnelReady) {
        console.log("Tunnel connector:", await ensureTunnel((await call("tunnel")).token));
        tunnelReady = true;
      }
      const { homes, origins, routing, power } = await call("assignments");
      if (routing !== "ready") console.warn("Public addresses are still being set up; retrying next round.");
      await reconcile(homes, capacity, (id, state) => call("assignments", { id, state, sleepBlocked: process.env.LIMIX_HOME_GATEWAY !== "0" }), docker, { origins, hostToken: token, power, gateway: process.env.LIMIX_HOME_GATEWAY ?? "1" });
    } catch (error) {
      console.error("Host reconciliation failed:", error.message);
      if (process.argv.includes("--once")) process.exitCode = 1;
    }
    if (process.argv.includes("--once")) break;
    await delay(30000);
    if (tunnelReady && await docker(["ps", "--filter", "name=^" + TUNNEL_CONTAINER + "$", "--format", "{{.State}}"]).catch(() => "") !== "running") tunnelReady = false;
  }
}
