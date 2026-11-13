import { availableParallelism, totalmem } from "node:os";
import type { DesktopResources } from "./container-limits.ts";
import type { LimixVmCapacity } from "../shared/limix-vm-capacity.ts";

const GIB = 1024 ** 3;
const TTL_MS = 30_000;
type Runtime = "docker" | "podman" | "container";
type Runner = (command: string, args: string[], timeout?: number) => Promise<{ stdout: string }>;
interface Machine { memoryGb: number; cpus: number; source: LimixVmCapacity["source"] }
let machine: Machine | null = null;
let cached: { runtime: Runtime; expires: number; pending: Promise<void> } | null = null;
let generation = 0;
let startQueue: Promise<unknown> = Promise.resolve();

export function serializeLimixVmStart<T>(work: () => Promise<T>): Promise<T> {
  const next = startQueue.then(work, work);
  startQueue = next.catch(() => undefined);
  return next;
}

export function calculateLimixVmCapacity(host: Machine, resources: DesktopResources): LimixVmCapacity {
  const reservedMemoryGb = Math.min(host.memoryGb, Math.max(2, host.memoryGb * 0.2));
  const reservedCpus = Math.min(host.cpus, Math.max(1, Math.ceil(host.cpus * 0.1)));
  const memorySlots = Math.max(0, Math.floor((host.memoryGb - reservedMemoryGb) / resources.memoryGb));
  const cpuSlots = Math.max(0, Math.floor((host.cpus - reservedCpus) / resources.cpus));
  return {
    limit: Math.min(memorySlots, cpuSlots), source: host.source,
    memoryGb: host.memoryGb, cpus: host.cpus, reservedMemoryGb, reservedCpus,
    perVmMemoryGb: resources.memoryGb, perVmCpus: resources.cpus,
    constrainedBy: memorySlots <= cpuSlots ? "memory" : "cpu",
  };
}

export function limixVmCapacity(resources: DesktopResources): LimixVmCapacity {
  return calculateLimixVmCapacity(machine ?? { memoryGb: totalmem() / GIB, cpus: availableParallelism(), source: "host" }, resources);
}

export function parseLimixRuntimeResources(runtime: Runtime, raw: string): Machine | null {
  try {
    const info = JSON.parse(raw);
    const memory = Number(runtime === "podman" ? info.host?.memTotal : info.MemTotal);
    const cpus = Number(runtime === "podman" ? info.host?.cpus : info.NCPU);
    if (!Number.isFinite(memory) || !Number.isFinite(cpus) || memory <= 0 || cpus < 1 || runtime === "container") return null;
    return { memoryGb: memory / GIB, cpus: Math.floor(cpus), source: runtime };
  } catch { return null; }
}

export async function refreshLimixVmCapacity(runtime: Runtime | null, runner: Runner): Promise<void> {
  if (!runtime) { generation++; machine = null; cached = null; return; }
  if (cached?.runtime === runtime && cached.expires > Date.now()) return cached.pending;
  if (cached?.runtime !== runtime) machine = null;
  const current = ++generation;
  const pending = (async () => {
    try {
      const result = await runner(runtime, ["info", "--format", runtime === "podman" ? "json" : "{{json .}}"], 5000);
      const detected = parseLimixRuntimeResources(runtime, result.stdout);
      if (detected && current === generation) machine = detected;
    } catch {}
  })();
  cached = { runtime, expires: Date.now() + TTL_MS, pending };
  await pending;
}
