import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { INDUSTRY_CARE_SKILL } from "../shared/industry-templates.ts";

it("mounts the operator toolkit and supplies only the current bot's public facts to an outside conversation", async () => {
  const reply = "Đã nhận yêu cầu tra cứu sản phẩm.";
  const fixture = await launchVerificationServer({ FAKE_CLAUDE_VERSION: "2.1.284", FAKE_CLAUDE_TOOL_CALLS: "[]", FAKE_CLAUDE_REPLIES: JSON.stringify([reply]) });
  const url = fixture.info.url;
  const api = async <T = unknown>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(url + path, { method, headers: { origin: url, "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    expect(response.ok, JSON.stringify(result)).toBe(true);
    return result as T;
  };
  const dump = () => JSON.parse(readFileSync(fixture.fixtureDumpPath, "utf8"));
  try {
    const { bot } = await api<{ bot: { id: string; threadId: string } }>("POST", "/api/bots", { industryTemplate: INDUSTRY_CARE_SKILL });
    await api("POST", `/api/bots/${bot.id}/messages`, { threadId: bot.threadId, text: "Kiểm tra công cụ CSKH", sendId: "industry-owner-fixture-01" });
    await expect.poll(() => {
      try { return Boolean(dump().mcpConfig.mcpServers["industry-care"]); } catch { return false; }
    }, { timeout: 25_000 }).toBe(true);
    const ownerArgs: string[] = dump().argv;
    expect(ownerArgs.indexOf("--tools")).toBeGreaterThan(-1);
    expect(ownerArgs[ownerArgs.indexOf("--tools") + 1]).toBe("");

    await api("PUT", `/api/bots/${bot.id}/memory/file`, { path: "memory/notes.md", text: "care-fixture-private-note" });
    const catalogDir = join(fixture.info.dataDir, INDUSTRY_CARE_SKILL, bot.id);
    mkdirSync(catalogDir, { recursive: true });
    const record = { visibility: "public", status: "approved", sku: "A/B", name: "fixture public SKU", priceMinor: 123000, currency: "VND",
      availability: "in_stock", source: "fixture approved price list", asOf: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 3600_000).toISOString(), internal: "care-fixture-private-field" };
    const catalog = (scope: string) => writeFileSync(join(catalogDir, "public-catalog.json"), JSON.stringify({ schemaVersion: 1, scope, records: [record] }));
    const access = await api<{ url: string; key: string }>("POST", `/api/bots/${bot.id}/bot-api`, { enabled: true });
    const ask = async () => {
      const response = await fetch(access.url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${access.key}` },
        body: JSON.stringify({ message: "Giá bán SKU A/B?" }) });
      const result = await response.json() as { reply?: string; thread: string };
      if (!response.ok) {
        const status = await api<{ calls: { reason?: string }[] }>("GET", `/api/bots/${bot.id}/bot-api`);
        throw new Error(`Guest request returned ${response.status}: ${status.calls.map(call => call.reason).filter(Boolean).join(", ")}`);
      }
      expect(result.reply).toBe(reply);
      const { prompt, systemPrompt, mcpConfig, argv } = dump();
      expect(argv).toContain("--restricted");
      expect(argv[argv.indexOf("--tools") + 1]).toBe("");
      expect(argv).not.toContain("--add-dir");
      expect(mcpConfig?.mcpServers ?? {}).not.toHaveProperty("industry-care");
      expect(JSON.stringify([prompt, systemPrompt])).not.toMatch(/care-fixture-private/);
      return JSON.stringify(prompt);
    };
    catalog(bot.id);
    expect(await ask()).toContain("fixture approved price list");
    catalog("other-bot");
    expect(await ask()).not.toContain("fixture approved price list");
    catalog(bot.id);
    const bridge = `/api/bots/${bot.id}/messenger`;
    await api("POST", bridge, { token: JSON.stringify({ uid: "100045", name: "Fixture" }), access: "everyone" });
    await expect.poll(async () => (await api<{ bots: string[] }>("GET", "/api/messenger/bots")).bots).toContain(bot.id);
    await api("POST", bridge + "/inbox", { messages: [{ id: "fixture:care:1", chatId: "fixture-customer", name: "Lan", text: "Giá bán SKU A/B?" }] });
    const { items } = await api<{ items: { chatId: string; text: string; id: number }[] }>("GET", bridge + "/outbox");
    expect(items).toContainEqual(expect.objectContaining({ chatId: "fixture-customer", text: reply }));
    await api("POST", bridge + "/sent", { id: items[0]!.id });
    expect(JSON.stringify(dump().prompt)).toContain("fixture approved price list");
  } finally {
    await fixture.close();
  }
}, 150_000);
