import { normalizeImageGenerationUrl } from "../shared/image-generation.ts";
import type { InstanceConfigMap } from "./contracts.ts";

/** Only explicitly saved endpoint/key pairs can be copied; never borrow another instance's credentials. */
export function savedImageConnections(instances: InstanceConfigMap) {
  return Object.entries(instances).flatMap(([id, instance]) => {
    if (instance.driver !== "openai-compat" || instance.enabled === false) return [];
    const config = instance.config as Record<string, unknown> | undefined;
    if (!config || typeof config.url !== "string") return [];
    const keyEnv = typeof config.apiKeyEnv === "string" ? config.apiKeyEnv : "OPENAI_COMPAT_API_KEY";
    const key = typeof config.key === "string" ? config.key : instance.environment?.[keyEnv];
    if (!key?.trim()) return [];
    try {
      const url = normalizeImageGenerationUrl(config.url);
      return [{ id, name: instance.displayName || id, url, key: key.trim() }];
    } catch { return []; }
  });
}
