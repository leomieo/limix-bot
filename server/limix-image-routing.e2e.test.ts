import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { agentsMcp } from "./drivers/agents-mcp.ts";
import { IMAGE_MESSAGES } from "./routes/image-tools.ts";
import { hostTimeout } from "./testing/host-timeout.ts";

it("a live isolated turn has generate_image before setup and gets setup instructions without fabricating an image", async () => {
  const fixture = await launchVerificationServer({ FAKE_CLAUDE_VERSION: "2.1.284", FAKE_CLAUDE_MODE: "hang" });
  const api = async (path: string, body?: unknown) => {
    const response = await fetch(fixture.info.url + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", origin: fixture.info.url }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json() as any;
    expect(response.ok, JSON.stringify(result)).toBe(true);
    return result;
  };
  try {
    const { bot } = await api("/api/bots", { name: "Image routing fixture" });
    await api(`/api/bots/${bot.id}/messages`, { text: "Generate a photorealistic cat", threadId: bot.threadId });
    let env: Record<string, string> | undefined;
    await expect.poll(() => {
      try { env = JSON.parse(readFileSync(fixture.fixtureDumpPath, "utf8")).mcpConfig.mcpServers.agents.env; return env?.OMB_IMAGE_GENERATION; }
      catch { return undefined; }
    }, { timeout: hostTimeout(20000) }).toBe("1");
    const mcp = agentsMcp(env!);
    const listed = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }) as any;
    expect(listed.result.tools.some((tool: any) => tool.name === "generate_image")).toBe(true);
    const answer = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "generate_image", arguments: { prompt: "Photorealistic orange cat in natural window light" } } }) as any;
    expect(answer.result.isError).toBe(true);
    expect(answer.result.content.some((entry: any) => entry.text === IMAGE_MESSAGES.notSetUp)).toBe(true);
    const lines = (await api(`/api/threads/${bot.threadId}/messages`)).messages;
    expect(lines.some((line: any) => line.attachments?.length)).toBe(false);
  } finally { await fixture.close(); }
}, hostTimeout(60000));
