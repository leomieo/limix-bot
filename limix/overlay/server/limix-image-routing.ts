import { connectorCallsIn } from "../shared/outbound.ts";

export const IMAGE_ROUTING_PROMPT = "\n\nAgent tools: prefer the active agent's own available tools for the requested task. For image generation, use its native image tool (for example image_gen or imagegen) when actually exposed in this session. Do not require Limix image-provider setup before calling an available native tool. An unavailable tool must never be invented. Limix Bot's generate_image is a separately configured alternative, usable only when the person explicitly chooses it. Do not silently switch providers through Composio, install a generator, search the web, or draw a substitute with code unless explicitly requested. If no native image tool is exposed, say so and ask whether the person wants to configure a separate image provider. If a native tool fails, report its actual error; do not blame separate Limix image settings or invent who disabled it. A code-drawn illustration is not a photorealistic generated image. Claim success only after a successful tool result and attached file. Preserve the requested style.\n";
export const IMAGE_CONNECTOR_REFUSAL = "Use the active agent's available native image tool first. Do not silently select another image provider through a connector. If no native image tool is available, explain that limitation and let the person explicitly choose a separate image provider. No image was requested from this connector.";

/** A connector cannot silently choose a different image provider from the configured image tool. */
export function imageConnectorRefusal(name: string, args: unknown): string | null {
  if (["generate_image", "image_gen", "imagegen"].includes(name.toLowerCase())) return null;
  const calls = connectorCallsIn(name, args);
  return calls.some(({ slug }) => /(?:^|_)(?:GENERATE_IMAGES?|CREATE_IMAGES?|TEXT_TO_IMAGE|TEXT_TO_IMAGE_GENERATION|IMAGE_GENERATION)(?:$|_)/i.test(slug))
    ? IMAGE_CONNECTOR_REFUSAL : null;
}
