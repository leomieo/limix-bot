import { expect, it, vi } from "vitest";
import { XINGCHI_URL } from "../shared/xingchi.ts";
import { newCodexEndpoint, updateCodexEndpoint } from "./codex-endpoints.ts";
import { decodeRoutedCodexConfig, endpointCodexArgs } from "./drivers/codex-endpoint-config.ts";
import { discoverAgentEndpointModels } from "./agent-endpoint-models.ts";
import { xingchiTurnImages } from "./xingchi-turn-images.ts";
import { generateImage } from "./image-generation.ts";

const fields = { profile: "xingchi" as const, displayName: "Xingchi", baseUrl: XINGCHI_URL, token: "fixture-key" };
const base = { imageGen: { maxPerTurn: 2, geminiKey: "other-key" } };

it("discovers the two models and uses the selected account for chat and metered images", async () => {
  const { instances, instanceId } = newCodexEndpoint({ instances: {} } as never, fields);
  const entry = instances[instanceId];
  const catalog = vi.fn<typeof fetch>(async () => Response.json({ data: [{ id: "gpt-6-astra" }, { id: "gpt-6.1-sol" }] }));
  await discoverAgentEndpointModels(entry, catalog);
  expect(catalog).toHaveBeenCalledWith(XINGCHI_URL + "/models", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer fixture-key", "x-openai-actor-authorization": "local-image-extension" }) }));
  const endpoint = decodeRoutedCodexConfig((entry.config as { endpoint: object }).endpoint);
  expect(endpoint.models).toEqual(["gpt-6.1-sol", "gpt-6-astra"]);
  expect(endpointCodexArgs(endpoint).join(" ")).toContain("local-image-extension");
  expect(endpointCodexArgs(endpoint).join(" ")).not.toContain(fields.token);
  const cfg = xingchiTurnImages(base, entry, "gpt-6-astra");
  expect(cfg.imageGen?.maxPerTurn).toBe(2);
  const upstream = vi.fn<typeof fetch>(async () => new Response("group denied", { status: 403 }));
  await expect(generateImage(cfg, { prompt: "cat" }, { fetchImpl: upstream })).rejects.toThrow("HTTP 403");
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0][0]).toBe(XINGCHI_URL + "/responses");
  expect(JSON.parse(String(upstream.mock.calls[0][1]?.body))).toMatchObject({ model: "gpt-6-astra", store: false, tools: [{ type: "image_generation" }] });
  expect(xingchiTurnImages(base, undefined, "gpt-6-astra")).toBe(base);
  expect(() => updateCodexEndpoint({ instances } as never, instanceId, { baseUrl: "https://elsewhere.example", token: "new" })).toThrow("official endpoint");
});
