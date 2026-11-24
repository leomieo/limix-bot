import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { request } from "../scripts/mcp-server.ts";
import type { StdioMcpSpec } from "./contracts.ts";
import { removeTempDir } from "./testing/cleanup.ts";

it("runs the bundled factory in the default assistant's private workspace", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "limix-care-mcp-"));
  const finish = join(scratch, "finish");
  const fixture = await launchVerificationServer({ FAKE_CLAUDE_MODE: "slow", FAKE_CLAUDE_VERSION: "2.1.284", FAKE_CLAUDE_SLOW_FINISH_GATE: finish });
  let client: ChildProcessWithoutNullStreams | undefined;
  try {
    const post = (path: string, body: unknown) => request(path, { method: "POST", body: JSON.stringify(body) }, fixture.info.url);
    const list = await request("/api/bots", {}, fixture.info.url);
    const bot = list.bots.find((item: { defaultBot?: unknown }) => item.defaultBot);
    expect(bot).toBeDefined();
    await post(`/api/bots/${bot.id}/messages`, { threadId: bot.threadId, text: "/limix-bot-factory Create a customer support bot draft", sendId: "care-mcp-case-fixture-01" });
    const dump = () => JSON.parse(readFileSync(fixture.fixtureDumpPath, "utf8")) as {
      argv: string[]; mcpConfig: { mcpServers: Record<string, StdioMcpSpec> };
    };
    await expect.poll(() => { try { return Boolean(dump().mcpConfig.mcpServers["limix-bot-factory"]); } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    const mount = dump().mcpConfig.mcpServers["limix-bot-factory"]!;
    const args = mount.args.some(arg => arg.includes("mcp-gate")) ? ["--experimental-strip-types", "--no-warnings", ...mount.args] : mount.args;
    client = spawn(mount.command, args, { stdio: "pipe", env: { ...process.env, ...mount.env } });
    const lines = createInterface({ input: client.stdout })[Symbol.asyncIterator]();
    const ask = async (id: number, method: string, params?: unknown) => {
      client!.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      const frame = await lines.next();
      if (frame.done) throw new Error("The scoped MCP gate stopped before replying");
      const reply = JSON.parse(frame.value);
      expect(reply.id).toBe(id);
      return reply;
    };
    await ask(1, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "care-fixture", version: "1" } });
    const offered = await ask(2, "tools/list");
    expect(offered.result.tools.filter((tool: { name: string }) => tool.name.startsWith("factory_"))).toHaveLength(10);
    const ref = { bot_id: "sample", tenant_id: "sandbox" };
    const call = async (id: number, name: string, args: unknown) => {
      const reply = await ask(id, "tools/call", { name, arguments: args });
      expect(reply.result.isError).not.toBe(true);
      return JSON.parse(reply.result.content[0].text);
    };
    expect((await call(3, "factory_templates", {})).templates).toHaveLength(7);
    expect((await call(4, "factory_create_draft", { ...ref, template: "customer-support", display_name: "Sample", requirements: "Answer support questions" })).status).toBe("draft_only");
    expect((await call(5, "factory_validate_draft", ref)).valid).toBe(true);
    expect((await call(6, "factory_evaluate_draft", ref)).passed).toBe(true);
  } finally {
    writeFileSync(finish, "");
    if (client && client.exitCode === null && client.signalCode === null) {
      const closed = once(client, "close");
      client.stdin.end();
      await closed;
    }
    await fixture.close();
    await removeTempDir(scratch);
  }
}, 90_000);
