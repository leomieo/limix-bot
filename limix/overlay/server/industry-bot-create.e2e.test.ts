import { expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { industryBotSettings, SUPER_SUPPORT_BOT } from "../shared/industry-templates.ts";

it("installs a customer care bot and its scoped tools on an isolated host with permissive workspace defaults", async () => {
  const fixture = await launchVerificationServer(process.env);
  try {
    const request = (path: string, body: unknown, method: "POST" | "PATCH" = "POST", headers: Record<string, string> = {}) => {
      const options = { method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) };
      return fetch(fixture.info.url + path, options);
    };
    const defaults = await request("/api/config", { newBotDefaults: {
      profile: { browser: true, composio: true, computer: "local", approvalMode: "full" },
      memory: { "memory/private.md": "Private fixture note" }, routines: [], skills: [],
    } }, "PATCH");
    expect(defaults.status, await defaults.text()).toBe(200);
    const video = await request("/api/bots", { name: "Limix AI Video Creator", videoTemplate: true, useDefaults: false });
    expect(video.status).toBe(201);
    const { bot: videoBot } = await video.json() as { bot: { id: string; name: string; soul: string } };
    expect(videoBot.name).toBe("Limix AI Video Creator");
    expect(videoBot.soul).toContain("video-workflow");
    const videoStore = await (await fetch(fixture.info.url + "/api/limix/skill-store/" + videoBot.id)).json() as { skills: unknown[] };
    expect(videoStore.skills).toContainEqual(expect.objectContaining({ name: "video-workflow", added: true }));
    const scan = await (await fetch(fixture.info.url + "/api/limix/skill-requirements")).json() as { requirements: Array<{ skill: string; name: string; optional?: boolean }> };
    const tools = scan.requirements.filter(row => row.skill === "Limix AI Video Creator" && row.optional).map(row => row.name);
    expect(tools).toEqual(expect.arrayContaining(["hypit", "node", "ffmpeg", "ffprobe", "rea-video", "remotion", "@remotion/cli", "vieneu", "whisperx"]));
    const selection = { industryTemplate: SUPER_SUPPORT_BOT.id };
    expect((await request("/api/bots", selection, "POST", { "x-openmausbot-companion": "1" })).status).toBe(403);
    expect((await request("/api/bots", { industryTemplate: "missing-template" })).status).toBe(400);
    const response = await request("/api/bots", { ...selection, name: "Support fixture" });
    const created = await response.json() as { bot: { id: string } };
    expect(response.status, JSON.stringify(created)).toBe(201);
    expect(created.bot).toMatchObject({ ...industryBotSettings(), name: "Support fixture", soul: SUPER_SUPPORT_BOT.soul });
    const skillResponse = await fetch(fixture.info.url + "/api/limix/skill-store/" + created.bot.id);
    expect(skillResponse.status).toBe(200);
    const store = await skillResponse.json() as { skills: unknown[] };
    expect(store.skills).toContainEqual(expect.objectContaining({ name: "industry-customer-care", added: true }));
    const privateNote = await fetch(fixture.info.url + "/api/bots/" + created.bot.id + "/memory/file?path=memory%2Fprivate.md");
    expect(await privateNote.text()).not.toContain("Private fixture note");
  } finally {
    await fixture.close();
  }
}, 90_000);
