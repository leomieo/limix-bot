import { describe, expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { limixDesktopResources, withBotDesktopResources } from "./limix-desktop-resources.ts";

describe("a bot's own Private desktop size", () => {
  it("takes whole numbers in range, drops empty fields, and clears with null", () => {
    expect(limixDesktopResources({ memoryGb: 8, cpus: 4 })).toEqual({ value: { memoryGb: 8, cpus: 4 } });
    expect(limixDesktopResources({ memoryGb: null, cpus: 3 })).toEqual({ value: { cpus: 3 } });
    expect(limixDesktopResources({ memoryGb: null, cpus: null })).toEqual({ value: undefined });
    expect(limixDesktopResources(null)).toEqual({ value: undefined });
    expect(limixDesktopResources({ memoryGb: 1 })).toMatchObject({ error: expect.stringContaining("2 to 128") });
    expect(limixDesktopResources({ cpus: 2.5 })).toMatchObject({ error: expect.stringContaining("whole number") });
    expect(limixDesktopResources({ disk: 10 })).toMatchObject({ error: expect.stringContaining("not disk") });
    expect(limixDesktopResources([1])).toMatchObject({ error: expect.any(String) });
  });

  it("lays the bot's limits over the workspace's", () => {
    expect(withBotDesktopResources({ memoryGb: 4, cpus: 2 }, { desktopResources: { cpus: 6 } })).toEqual({ memoryGb: 4, cpus: 6 });
    expect(withBotDesktopResources({ memoryGb: 4, cpus: 2 }, undefined)).toEqual({ memoryGb: 4, cpus: 2 });
  });

  it("is saved on the bot through its settings, refused when out of range, and cleared with null", async () => {
    const fixture = await launchVerificationServer();
    const api = async (method: string, path: string, body?: unknown) => {
      const response = await fetch(fixture.info.url + path, { method, headers: { "content-type": "application/json", origin: fixture.info.url }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    };
    try {
      const bot = (await api("POST", "/api/bots", { name: "Sizer" })).body.bot;
      expect((await api("PATCH", `/api/bots/${bot.id}`, { desktopResources: { memoryGb: 8, cpus: 4 } })).status).toBe(200);
      const read = async () => (await api("GET", "/api/bots")).body.bots.find((item: any) => item.id === bot.id);
      expect((await read()).desktopResources).toEqual({ memoryGb: 8, cpus: 4 });
      expect((await api("PATCH", `/api/bots/${bot.id}`, { desktopResources: { cpus: 999 } })).status).toBe(400);
      expect((await read()).desktopResources).toEqual({ memoryGb: 8, cpus: 4 });
      expect((await api("PATCH", `/api/bots/${bot.id}`, { desktopResources: null })).status).toBe(200);
      expect((await read()).desktopResources).toBeUndefined();
      expect((await api("GET", "/api/config")).body.localVm.resources).toEqual({ memoryGb: 4, cpus: 2 });
      expect((await api("PATCH", `/api/bots/${bot.id}`, { desktopTeam: true })).status).toBe(200);
      expect((await read()).desktopTeam).toBe(true);
      expect((await api("PATCH", `/api/bots/${bot.id}`, { desktopTeam: "yes" })).status).toBe(400);
      expect((await api("PATCH", `/api/bots/${bot.id}`, { desktopTeam: false })).status).toBe(200);
      expect((await read()).desktopTeam).toBeUndefined();
    } finally {
      await fixture.close();
    }
  }, 60_000);
});
