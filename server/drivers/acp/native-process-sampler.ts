import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { limixNativeResource } from "../../limix-native-path.ts";
import type { ProcessSample } from "./quiet-status.ts";

const execFileAsync = promisify(execFile);
const binary = limixNativeResource(process.platform === "win32" ? "limix-process-sampler.exe" : "limix-process-sampler");

export function decodeProcessSample(stdout: string): ProcessSample | null {
  try {
    const { cpuMs, connections } = JSON.parse(stdout);
    if (cpuMs !== null && !(typeof cpuMs === "number" && Number.isFinite(cpuMs) && cpuMs >= 0)) return null;
    if (connections !== null && !(Number.isSafeInteger(connections) && connections >= 0)) return null;
    return { cpuMs, connections };
  } catch {
    return null;
  }
}

export async function tryRustProcessSample(pid: number, since?: number): Promise<ProcessSample | null> {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 0xffffffff
    || (since !== undefined && (!Number.isSafeInteger(since) || since < 0))) {
    return { cpuMs: null, connections: null };
  }
  try {
    if (!existsSync(binary)) return null;
    const args = since === undefined ? [String(pid)] : [String(pid), String(since)];
    if (process.platform === "linux") {
      linuxWorker ??= openLinuxWorker();
      return linuxWorker.sample(args.join(" "));
    }
    const { stdout } = await execFileAsync(binary, args, {
      timeout: 1500, maxBuffer: 1024, windowsHide: true, encoding: "utf8",
      env: { SystemRoot: process.env.SystemRoot },
    });
    return decodeProcessSample(stdout);
  } catch {
    return null;
  }
}

let linuxWorker: ReturnType<typeof openLinuxWorker> | undefined;

function openLinuxWorker() {
  const child = spawn(binary, ["--stdio"], { env: {}, stdio: ["pipe", "pipe", "ignore"] });
  const pending: Array<(sample: ProcessSample | null) => void> = [];
  let idle: NodeJS.Timeout | undefined;
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    linuxWorker = undefined;
    clearTimeout(idle);
    for (const finish of pending.splice(0)) finish(null);
    child.stdin.destroy();
    child.kill();
  }
  child.on("error", close);
  child.on("exit", close);
  child.stdin.on("error", close);
  child.stdout.on("error", close);
  createInterface({ input: child.stdout }).on("line", line => {
    const result = decodeProcessSample(line);
    if (!result || !pending.length) return close();
    pending.shift()!(result);
    if (!pending.length) idle = setTimeout(close, 30_000).unref();
  });
  child.unref();
  return { sample(line: string): Promise<ProcessSample | null> {
    if (pending.length >= 128) return Promise.resolve(null);
    clearTimeout(idle);
    return new Promise(resolve => {
      const timer = setTimeout(close, 1500);
      pending.push(result => { clearTimeout(timer); resolve(result); });
      child.stdin.write(line + "\n");
    });
  } };
}
