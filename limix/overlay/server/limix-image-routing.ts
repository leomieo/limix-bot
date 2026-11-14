import { connectorCallsIn } from "../shared/outbound.ts";

export const IMAGE_ROUTING_PROMPT = "\n\nImage generation: when the person asks to generate an image, call generate_image (through find_tool/use_tool if bridged). It uses the image provider explicitly configured in Settings > AI > Image generation. A chat model or its sign-in does not select or authorize an image provider. Do not discover or call another image provider through Composio, install a generator, search the web, or draw a substitute with code unless the person explicitly requests that alternative. If generate_image reports missing setup, permission denial, or another error, report that exact limitation and the settings path; do not invent who disabled it, assert a global inability of GPT, or claim success. A code-drawn illustration is not a photorealistic generated image. Claim an image was generated only after a successful tool result and attached file. Preserve the requested style in the image prompt.\n";
export const IMAGE_CONNECTOR_REFUSAL = "Use Limix Bot's generate_image tool for image generation. It routes to the image provider chosen in Settings > AI > Image generation. Do not switch to Gemini or another Composio image provider. If setup is missing or the configured provider refuses, report that error and ask the person to configure image generation. No image was requested from this connector.";

/** A connector cannot silently choose a different image provider from the configured image tool. */
export function imageConnectorRefusal(name: string, args: unknown): string | null {
  const calls = connectorCallsIn(name, args);
  return calls.some(({ slug }) => /(?:^|_)(?:GENERATE_IMAGES?|CREATE_IMAGES?|TEXT_TO_IMAGE|TEXT_TO_IMAGE_GENERATION|IMAGE_GENERATION)(?:$|_)/i.test(slug))
    ? IMAGE_CONNECTOR_REFUSAL : null;
}
