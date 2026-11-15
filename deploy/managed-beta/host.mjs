import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const run = promisify(execFile);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const composeFile = fileURLToPath(new URL("./compose.yaml", import.meta.url));
const prefix = "limix-home-";

async function docker(args) {
  const env = { ...process.env };
  delete env.LIMIX_BETA_HOST_TOKEN;
  const result = await run("docker", args, { env, windowsHide: true, timeout: 90000 });
  return result.stdout.trim();
}

export async function reconcile(homes, capacity, report, command = docker) {
  if (!Array.isArray(homes) || !homes.every(id => typeof id === "string" && uuid.test(id)) ||
      new Set(homes).size !== homes.length || !Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error("Invalid host assignments or capacity");
  }
  const active = new Set(homes.slice(0, capacity));
  const listed = await command(["ps", "-a", "--filter", "label=com.limix.managed-home=beta-xeon",
    "--format", '{{.Label "com.docker.compose.project"}}']);
  const compose = (id, args) => command(["compose", "-f", composeFile, "-p", prefix + id, ...args]);
  for (const project of new Set(listed.split(/\r?\n/))) {
    const id = project.slice(prefix.length);
    if (project.startsWith(prefix) && uuid.test(id) && !active.has(id)) {
      await compose(id, ["stop"]);
    }
  }
  for (const id of homes) {
    let state = "waiting_capacity";
    if (active.has(id)) {
      try {
        await compose(id, ["up", "-d", "--no-build", "home", "edge"]);
        const container = await compose(id, ["ps", "-q", "home"]);
        const health = container && await command(["inspect", "--format", "{{.State.Health.Status}}", container]);
        state = health === "healthy" ? "running" : health === "starting" ? "starting" : "failed";
      } catch { state = "failed"; }
    }
    await report(id, state);
  }
}

if (import.meta.main) {
  const token = process.env.LIMIX_BETA_HOST_TOKEN;
  const capacity = Number(process.env.LIMIX_BETA_CAPACITY ?? 1);
  if (!token || token.length < 43 || !process.env.LIMIX_HOME_IMAGE) throw new Error("Set host token and runtime image");
  const endpoint = "https://accounts.limixmedia.com/v1/managed-cloud/host/assignments";
  const call = async (report) => {
    const response = await fetch(endpoint, { method: report ? "POST" : "GET", redirect: "error",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: report && JSON.stringify(report), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Control plane HTTP " + response.status);
    return response.json();
  };
  do {
    try {
      const { homes } = await call();
      await reconcile(homes, capacity, (id, state) => call({ id, state }));
    } catch (error) {
      console.error("Host reconciliation failed:", error.message);
      if (process.argv.includes("--once")) process.exitCode = 1;
    }
    if (process.argv.includes("--once")) break;
    await delay(30000);
  } while (true);
}
