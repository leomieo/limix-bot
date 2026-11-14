import { expect, it } from "vitest";
import { imageConnectorRefusal, IMAGE_CONNECTOR_REFUSAL, IMAGE_ROUTING_PROMPT } from "./limix-image-routing.ts";
import { agentsServerEnv } from "./agents-turn.ts";
import { availableTools } from "./drivers/agents-catalog.ts";
import { catalogProfileFromEnv } from "./drivers/agents-catalog-profile.ts";
import { buildSystemPrompt } from "./system-prompt.ts";

it.each(["GEMINI_GENERATE_IMAGE", "OPENAI_CREATE_IMAGE", "STABILITYAI_TEXT_TO_IMAGE", "REPLICATE_GENERATE_IMAGES"])("refuses image generation via %s before connector execution", slug => {
  expect(imageConnectorRefusal(slug, { prompt: "cat" })).toBe(IMAGE_CONNECTOR_REFUSAL);
  expect(imageConnectorRefusal("COMPOSIO_MULTI_EXECUTE_TOOL", { tools: [{ tool_slug: "GMAIL_LIST_MESSAGES" }, { tool_slug: slug, arguments: { prompt: "cat" } }] })).toBe(IMAGE_CONNECTOR_REFUSAL);
});
it.each(["GMAIL_LIST_MESSAGES", "GOOGLEDRIVE_UPLOAD_FILE", "GEMINI_GENERATE_CONTENT", "COMPOSIO_SEARCH_TOOLS"])("keeps unrelated connector operation %s", slug => {
  expect(imageConnectorRefusal(slug, {})).toBeNull();
});
it("keeps the native image tool discoverable before a key is configured, with routing instructions", () => {
  const env = agentsServerEnv({ threadId: "chat", bot: { id: "bot" }, room: false, teamComputer: false, host: { skillAuthoring: false, sharedComputers: false, cloudHome: false, team: false, voiceNotes: false, x: false, research: false, imageGeneration: false } }, { generation: "person", depth: 0, skillAuthoring: false }, () => "fixture-capability", "http://localhost:8799");
  expect(env.OMB_IMAGE_GENERATION).toBe("1");
  expect(availableTools(catalogProfileFromEnv(env)).map(tool => tool.name)).toContain("generate_image");
  const prompt = buildSystemPrompt("bot", "", [], { env });
  expect(prompt.stable).toContain(IMAGE_ROUTING_PROMPT);
  expect(prompt.volatile).not.toContain(IMAGE_ROUTING_PROMPT);
  expect(prompt.stable).toContain("A code-drawn illustration is not a photorealistic generated image");
});
