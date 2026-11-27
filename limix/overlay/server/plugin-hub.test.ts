import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { RouteContext } from "./routes/table.ts";
import { createPluginHub } from "./plugin-hub.ts";

it("verifies package contents, requires an admin and preserves per-bot choices across restarts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "limix-plugin-unit-"));
  try {
    const bot = { id: "alpha", name: "Alpha", section: "Team" };
    const targets = () => ({ bots: [bot], teams: ["Team"] });
    const name = { en: "Sample", vi: "Mẫu" };
    const metadata = { id: "sample", version: "1.0.0", name, description: name, requiresMcp: ["git"] };
    let data = Buffer.from(JSON.stringify({ ...metadata, instructions: "Approved workflow" }));
    let sha256 = createHash("sha256").update(data).digest("hex");
    const load = async (path: string) => path === "catalog.json" ? Buffer.from(JSON.stringify([{ ...metadata, sha256 }])) : data;
    let hub = createPluginHub(directory, targets, load);
    const call = async (body: object, admin = true) => {
      let status: number | undefined;
      const context = { path: "/api/limix/plugins", method: "POST", auth: { kind: "loopback", trust: admin ? undefined : "service" }, readBody: async () => body,
        json: (_res: unknown, code: number) => { status = code; } };
      await hub.route(context as unknown as RouteContext);
      return status;
    };
    expect(await call({ action: "sync" }, false)).toBe(403);
    expect(await call({ action: "sync" })).toBe(200);
    const install = () => call({ action: "install", id: metadata.id, sha256 });
    const assign = (target: string, key: string, enabled: boolean | null) => call({ action: "assign", id: metadata.id, sha256, target, key, enabled });
    const valid = data;
    data = Buffer.from("tampered");
    expect(await install()).toBe(422);
    data = valid;
    expect(await install()).toBe(200);
    expect(await assign("team", "Team", true)).toBe(200);
    expect(hub.instructions(bot, [])).toBe("");
    expect(hub.instructions(bot, ["git"])).toContain("Approved workflow");
    await assign("bot", bot.id, false);
    hub = createPluginHub(directory, targets, load);
    expect(hub.instructions(bot, ["git"])).toBe("");
    await assign("bot", bot.id, null);
    hub.renameTeam("Team", "New");
    expect(hub.instructions(bot, ["git"])).toBe("");
    expect(hub.instructions({ ...bot, section: "New" }, ["git"])).toContain("Approved workflow");
    await assign("bot", bot.id, true);
    data = Buffer.from(JSON.stringify({ ...metadata, instructions: "Updated workflow" }));
    sha256 = createHash("sha256").update(data).digest("hex");
    await call({ action: "sync" });
    await install();
    expect(hub.instructions(bot, ["git"])).toBe("");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
