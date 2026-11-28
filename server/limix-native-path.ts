import { join } from "node:path";
import { SERVER_ROOT } from "./proxy-paths.ts";

export function limixNativeResource(name: "limix_tool_gateway.wasm" | "limix-process-sampler" | "limix-process-sampler.exe"): string {
  const directory = import.meta.url.endsWith(".ts")
    ? join(SERVER_ROOT, "..", "dist-native", "limix-native", `${process.platform}-${process.arch}`)
    : join(SERVER_ROOT, "..", "limix-native");
  return join(directory, name);
}
