import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";

const child = spawn("agy_acp_server.par", ["--uid="], {
  env: { ...process.env, AGY_ACP_FORCE_FILE_STORAGE: "1", ANTIGRAVITY_HARNESS_PATH: "/opt/limix-antigravity/localharness_external" },
  stdio: ["pipe", "pipe", "inherit"],
});
const timeout = setTimeout(() => child.kill("SIGKILL"), 90000);
const closed = once(child, "close");
try {
  const lines = createInterface({ input: child.stdout });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: 1, clientInfo: { name: "limix-beta-smoke", version: "1" }, clientCapabilities: {} } }) + "\n");
  let ready = false;
  for await (const line of lines) {
    const message = JSON.parse(line);
    if (message.id !== 1) continue;
    if (!message.result?.agentInfo?.version || message.result.protocolVersion !== 1) throw new Error("Invalid ACP initialization reply");
    console.log("Antigravity ACP initialized", message.result.agentInfo.version);
    ready = true;
    break;
  }
  if (!ready) throw new Error("Antigravity exited before ACP initialization");
} finally {
  clearTimeout(timeout);
  child.kill("SIGKILL");
  await closed;
}
