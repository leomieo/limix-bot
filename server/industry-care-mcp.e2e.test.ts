import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { request } from "../scripts/mcp-server.ts";
import { INDUSTRY_PROFILES } from "../shared/industry-profiles.ts";
import { INDUSTRY_CARE_SKILL, industryRoleBot } from "../shared/industry-templates.ts";
import type { StdioMcpSpec } from "./contracts.ts";
import { removeTempDir } from "./testing/cleanup.ts";

it("calls the shipped department workflow through the owner's scoped MCP gate", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "limix-care-mcp-"));
  const finish = join(scratch, "finish");
  const fixture = await launchVerificationServer({ FAKE_CLAUDE_MODE: "slow", FAKE_CLAUDE_VERSION: "2.1.284", FAKE_CLAUDE_SLOW_FINISH_GATE: finish });
  let client: ChildProcessWithoutNullStreams | undefined;
  try {
    const profile = INDUSTRY_PROFILES[0]!;
    const role = profile.roles[0]!;
    const post = (path: string, body: unknown) => request(path, { method: "POST", body: JSON.stringify(body) }, fixture.info.url);
    const { bot } = await post("/api/bots", { industryTemplate: industryRoleBot(profile, role).id });
    await post(`/api/bots/${bot.id}/messages`, { threadId: bot.threadId, text: "Chuẩn bị hồ sơ bàn giao", sendId: "care-mcp-case-fixture-01" });
    const dump = () => JSON.parse(readFileSync(fixture.fixtureDumpPath, "utf8")) as {
      argv: string[]; mcpConfig: { mcpServers: Record<string, StdioMcpSpec> };
    };
    await expect.poll(() => { try { return Boolean(dump().mcpConfig.mcpServers["industry-care"]); } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    const { argv, mcpConfig } = dump();
    expect(argv).toContain("--tools");
    expect(argv[argv.indexOf("--tools") + 1]).toBe("");
    const mount = mcpConfig.mcpServers["industry-care"]!;
    expect(mount.args.some(arg => arg.includes("mcp-gate"))).toBe(true);
    client = spawn(mount.command, ["--experimental-strip-types", "--no-warnings", ...mount.args], { stdio: "pipe", env: { ...process.env, ...mount.env } });
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
    expect(offered.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(["care_lookup", "care_prepare_case", "care_triage", "query_result"]);
    const denied = await ask(3, "tools/call", { name: "care_delete_case", arguments: {} });
    expect(denied.error.message).toContain("Tool selection excludes this tool");
    const catalogDir = join(fixture.info.dataDir, INDUSTRY_CARE_SKILL, bot.id);
    mkdirSync(catalogDir, { recursive: true });
    writeFileSync(join(catalogDir, "public-catalog.json"), JSON.stringify({ schemaVersion: 1, scope: bot.id, records: [] }));
    const missing = await ask(10, "tools/call", { name: "care_lookup", arguments: { sku: "CI-ABSENT" } });
    expect(JSON.parse(missing.result.content[0].text)).toEqual({ status: "no_current_record" });
    const called = await ask(4, "tools/call", { name: "care_prepare_case", arguments: { industry: profile.slug, role: role.slug, caseRef: "DEMO-42" } });
    expect(JSON.parse(called.result.content[0].text)).toEqual({
      status: "draft", industry: profile.slug, role: role.slug, caseRef: "DEMO-42", department: role.name,
      inputs: role.inputs, instructions: role.instructions, handoff: role.handoff,
    });
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
