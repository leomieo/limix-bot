import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import type { PluginLibrary } from "../shared/plugin-hub.ts";

it.skipIf(process.env.LIMIX_VERIFY_PLUGIN_CATALOG !== "1")("downloads the public plugin and scopes its workflow on an isolated server", async () => {
  const fixture = await launchVerificationServer(process.env);
  try {
    const base = fixture.info.url;
    const endpoint = "/api/limix/plugins";
    async function request<T = unknown>(path: string, body?: unknown) {
      const response = await fetch(base + path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      expect(response.ok, JSON.stringify(result)).toBe(true);
      return result as T;
    }
    const synced = await request<PluginLibrary>(endpoint, { action: "sync" });
    const { id, sha256 } = synced.catalog.find(row => row.id === "meeting-brief")!;
    const pack = (await request<PluginLibrary>(endpoint, { action: "install", id, sha256 })).installed[0];
    const { bot } = await request<{ bot: { id: string } }>("/api/bots", { name: "Plugin fixture", useDefaults: false });
    const { bot: other } = await request<{ bot: { id: string } }>("/api/bots", { name: "Control fixture", useDefaults: false });
    const preview = async (botId: string) => JSON.stringify(await request("/api/bots/" + botId + "/system-prompt"));
    expect(await preview(bot.id)).not.toContain(pack.instructions);
    await request("/api/sidebar-sections", { name: "Research", botIds: [bot.id] });
    const assign = (target: string, key: string, enabled: boolean | null) => request(endpoint, { action: "assign", id, sha256, target, key, enabled });
    await assign("team", "Research", true);
    expect(await preview(bot.id)).toContain(pack.instructions);
    expect(await preview(other.id)).not.toContain(pack.instructions);
    const command = (...args: string[]) => execFileSync(process.execPath, ["--experimental-strip-types", "scripts/control-omb.ts", ...args, "--url", base], { encoding: "utf8", timeout: 60000, windowsHide: true });
    command("send", "--bot", bot.id, "--text", "Summarize the meeting notes.");
    command("wait", "--bot", bot.id, "--timeout", "30");
    const dump = JSON.parse(readFileSync(join(fixture.info.dataDir, "fake-claude-dump.json"), "utf8"));
    expect(dump.systemPrompt).toContain(pack.instructions);
    await assign("bot", bot.id, false);
    expect(await preview(bot.id)).not.toContain(pack.instructions);
    await assign("bot", bot.id, null);
    expect(await preview(bot.id)).toContain(pack.instructions);
    await request(endpoint, { action: "remove", id });
    expect(await preview(bot.id)).not.toContain(pack.instructions);
  } finally { await fixture.close(); }
}, 160000);
