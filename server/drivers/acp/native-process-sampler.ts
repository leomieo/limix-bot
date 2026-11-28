import { execFile } from "node:child_process";
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
    const { stdout } = await execFileAsync(binary, args, {
      timeout: 1500, maxBuffer: 1024, windowsHide: true, encoding: "utf8",
      env: { SystemRoot: process.env.SystemRoot },
    });
    return decodeProcessSample(stdout);
  } catch {
    return null;
  }
}
