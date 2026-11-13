import { expect, it } from "vitest";
import { calculateLimixVmCapacity, parseLimixRuntimeResources } from "./limix-vm-capacity.ts";
import { localVmMaxInstances, parseStoredConfig } from "./config.ts";

const resources = { memoryGb: 4, cpus: 2 };

it("uses the Docker allocation rather than the Windows machine's larger RAM total", () => {
  const machine = parseLimixRuntimeResources("docker", JSON.stringify({ NCPU: 32, MemTotal: 16631676928 }))!;
  const result = calculateLimixVmCapacity(machine, resources);
  expect(result).toMatchObject({ source: "docker", limit: 3, cpus: 32, constrainedBy: "memory", perVmMemoryGb: 4 });
  expect(result.reservedMemoryGb).toBeGreaterThanOrEqual(2);
});

it("allows more than eight desktops on a suitably sized runtime and recalculates per-desktop limits", () => {
  const machine = { memoryGb: 160, cpus: 96, source: "docker" as const };
  expect(calculateLimixVmCapacity(machine, resources).limit).toBe(32);
  expect(calculateLimixVmCapacity(machine, { memoryGb: 8, cpus: 4 }).limit).toBe(16);
  expect(calculateLimixVmCapacity({ ...machine, cpus: 8 }, resources)).toMatchObject({ limit: 3, constrainedBy: "cpu" });
});

it("reports zero rather than promising a desktop whose resource limits cannot fit", () => {
  expect(calculateLimixVmCapacity({ memoryGb: 4, cpus: 2, source: "podman" }, resources).limit).toBe(0);
});

it("reads Podman host resources and rejects incomplete or invalid readings", () => {
  expect(parseLimixRuntimeResources("podman", JSON.stringify({ host: { cpus: 16, memTotal: 32 * 1024 ** 3 } }))).toEqual({ source: "podman", cpus: 16, memoryGb: 32 });
  for (const raw of ["broken", "{}", '{"NCPU":0,"MemTotal":123}', '{"NCPU":2,"MemTotal":-1}']) expect(parseLimixRuntimeResources("docker", raw)).toBeNull();
});

it("upgrades old stored fixed limits to automatic without discarding the config, and preserves explicit manual mode", () => {
  const upgraded = parseStoredConfig({ localVm: { mode: "per-bot", maxInstances: 5 } });
  expect(upgraded.localVm).toMatchObject({ mode: "per-bot", maxInstances: 5, automaticCapacity: true });
  expect(localVmMaxInstances(upgraded)).toBe(localVmMaxInstances({}));
  const manual = parseStoredConfig({ localVm: { maxInstances: 30, automaticCapacity: false } });
  expect(localVmMaxInstances(manual)).toBe(30);
});
