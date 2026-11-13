export interface LimixVmCapacity {
  limit: number;
  source: "docker" | "podman" | "host";
  memoryGb: number;
  cpus: number;
  reservedMemoryGb: number;
  reservedCpus: number;
  perVmMemoryGb: number;
  perVmCpus: number;
  constrainedBy: "memory" | "cpu";
}
