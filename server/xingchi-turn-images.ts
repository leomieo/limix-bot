import { XINGCHI_URL } from "../shared/xingchi.ts";
import type { InstanceConfig } from "./contracts.ts";
import type { ImageCredentials } from "./image-generation.ts";

export function xingchiTurnImages(base: ImageCredentials, entry: InstanceConfig | undefined, model: string): ImageCredentials {
  const endpoint = (entry?.config as { endpoint?: { profile?: string; url?: string } } | undefined)?.endpoint;
  if (entry?.driver !== "codex" || endpoint?.profile !== "xingchi" || endpoint.url !== XINGCHI_URL) return base;
  return { imageGen: {
    primary: { provider: "custom", model }, customApi: "responses", customUrl: XINGCHI_URL,
    customLocalImageExtension: true, customApiKey: entry.environment?.OPENMAUSBOT_CODEX_API_KEY,
    maxPerTurn: base.imageGen?.maxPerTurn,
  } };
}
