import { existsSync, mkdtempSync, renameSync, rmdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { request } from "../scripts/mcp-server.ts";
import { industryBotSettings } from "../shared/industry-templates.ts";
import { INDUSTRY_PROFILES } from "../shared/industry-profiles.ts";

it("installs a reviewed industry team with per-member tools and rolls back a failed skill write", async () => {
  const advisor = INDUSTRY_PROFILES.find(profile => profile.slug === "retail-ecommerce")!.roles[0]!;
  const handoff = `@${advisor.name} vui lòng kiểm tra bảng kích cỡ.`;
  const reply = "CARE-ROLE-OK: đã tiếp nhận câu hỏi về kích cỡ.";
  const scratch = mkdtempSync(join(tmpdir(), "limix-room-replies-"));
  const state = join(scratch, "sequence");
  const fixture = await launchVerificationServer({
    FAKE_CLAUDE_VERSION: "2.1.284", FAKE_CLAUDE_REPLIES: JSON.stringify([handoff, reply]), FAKE_CLAUDE_REPLY_STATE: state,
  });
  try {
    const get = (path: string) => request(path, {}, fixture.info.url);
    const post = (path: string, data: unknown) => request(path, { method: "POST", body: JSON.stringify(data) }, fixture.info.url);
    const slug = "industry-retail-ecommerce";
    const doc = await get(`/api/team-library/teams/${slug}`);
    const install = `/api/teams/import?mode=add&builtInTeam=${slug}`;
    const initial = await get("/api/bots");
    const changed = structuredClone(doc);
    changed.package.agents[0].soul = "Changed in the preview";
    await expect(post(install, changed)).rejects.toThrow("differs from this preview");
    const obstacle = join(fixture.info.dataDir, "skill-state");
    const saved = join(fixture.info.dataDir, "fixture-original-skill-state");
    if (existsSync(obstacle)) renameSync(obstacle, saved);
    try {
      writeFileSync(obstacle, "fixture-only write failure");
      await expect(post(install, doc)).rejects.toThrow();
    } finally {
      if (existsSync(obstacle)) unlinkSync(obstacle);
      if (existsSync(saved)) renameSync(saved, obstacle);
    }
    expect(await get("/api/bots")).toEqual(initial);
    const added = await post(install, doc);
    expect(added.bots).toHaveLength(4);
    expect(added.groups).toHaveLength(1);
    expect(added.groups[0].defaultResponder).toEqual({ kind: "member", botId: added.bots[0].id });
    expect(added.groups[0].memberIds).toEqual(added.bots.map((bot: { id: string }) => bot.id));
    expect(added.routines).toEqual([]);
    for (const bot of added.bots) {
      expect(bot).toMatchObject(industryBotSettings());
      expect(bot.chiefOfStaff).not.toBe(true);
      const store = await get(`/api/limix/skill-store/${bot.id}`);
      expect(store.skills).toContainEqual(expect.objectContaining({ name: "industry-customer-care", kind: "bundled", added: true }));
      expect(store.skills.filter((item: { name: string; added: boolean }) => item.added && item.name.startsWith("industry-")).map((item: { name: string }) => item.name).sort()).toEqual(["industry-customer-care", slug]);
    }
    const room = added.groups[0];
    await post(`/api/groups/${room.id}/messages`, { threadId: room.threadId, text: "CARE-ROOM-IN: Khách cần tư vấn kích cỡ." });
    await expect.poll(async () => (await get(`/api/threads/${room.threadId}/messages?limit=50`)).messages, { timeout: 25_000 })
      .toContainEqual(expect.objectContaining({ text: reply, role: "bot", from: expect.objectContaining({ botId: added.bots[1].id }) }));
    const fileCopy = await post("/api/teams/import?mode=add", doc);
    expect(fileCopy.section).not.toBe(added.section);
    const store = await get(`/api/limix/skill-store/${fileCopy.bots[0].id}`);
    expect(store.skills).toContainEqual(expect.objectContaining({ name: "industry-customer-care", added: false }));
    console.log(JSON.stringify({ logPath: fixture.info.logPath, members: added.bots.length, rooms: added.groups.length, roomHandoff: true }));
  } finally {
    await fixture.close();
    if (existsSync(state)) unlinkSync(state);
    rmdirSync(scratch);
  }
}, 90_000);
