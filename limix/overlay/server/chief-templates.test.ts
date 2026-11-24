import { describe, expect, it } from "vitest";

import { createChiefTemplates, githubSources, parseTemplateId, TemplateIdError } from "./chief-templates.ts";
import { fakeTemplateGithub } from "./testing/fake-template-github.ts";
import { INDUSTRY_PROFILES } from "../shared/industry-profiles.ts";
import { INDUSTRY_BOTS, SUPER_SUPPORT_BOT } from "../shared/industry-templates.ts";

const templates = () => {
  const github = fakeTemplateGithub();
  return { github, chief: createChiefTemplates(githubSources(github.fetcher)) };
};

describe("the Chief's search of the bot and team template libraries", () => {
  it("finds the right industry team or department from Vietnamese requests when both remote catalogs are offline", async () => {
    const { chief, github } = templates();
    github.down.bots = true;
    github.down.teams = true;
    for (const profile of INDUSTRY_PROFILES) {
      const slug = `industry-${profile.slug}`;
      const found = await chief.search(`Tôi muốn nhóm bot cho ngành ${profile.vi.name}`);
      expect(found.results[0], profile.name).toMatchObject({ id: `team:${slug}`, source: "builtin", roles: 4, gallery: { id: slug, kind: "team" } });
      expect(found.unavailable).toEqual(["bots", "teams"]);
      expect(found.results.filter(item => item.id === `team:${slug}`)).toHaveLength(1);
      for (const role of profile.roles) {
        const roleId = `${slug}-${role.slug}`;
        const result = await chief.search(`Tôi cần bot phòng ban ${role.vi.name} cho ngành ${profile.vi.name}`);
        expect(result.results[0], roleId).toMatchObject({ id: `builtin:${roleId}`, gallery: { id: roleId, kind: "bot" } });
      }
    }
    const help = await chief.search("toi can cham soc khach hang tren Zalo, Facebook va Telegram");
    expect(help.results[0]).toMatchObject({ id: `builtin:${SUPER_SUPPORT_BOT.id}` });
    const departments = await chief.search("goi y bot phong ban cho nganh spa", 3);
    expect(departments.results.every(hit => hit.id.startsWith("builtin:industry-beauty-spa-"))).toBe(true);
  });

  it("previews all bundled teams and specialists locally and directs their installation to the exact gallery card", async () => {
    const { chief, github } = templates();
    for (const bot of INDUSTRY_BOTS) {
      const target = { kind: "bot", id: bot.id, name: bot.name };
      const [preview] = await chief.details([`builtin:${bot.id}`]);
      expect(preview).toMatchObject({ source: "builtin", gallery: target, members: [{ template: `builtin:${bot.id}` }] });
      await expect(chief.resolve(bot.id)).rejects.toThrow(bot.name);
      await expect(chief.resolve(`bot:${bot.id}`)).rejects.toThrow("Dùng mẫu");
    }
    for (const profile of INDUSTRY_PROFILES) {
      const slug = `industry-${profile.slug}`;
      const [preview] = await chief.details([`team:${slug}`]);
      expect(preview).toMatchObject({ kind: "team", source: "builtin", gallery: { kind: "team", id: slug } });
      expect(preview!.members.map(member => member.template)).toEqual([
        `builtin:${SUPER_SUPPORT_BOT.id}`, ...profile.roles.map(role => `builtin:${slug}-${role.slug}`),
      ]);
      await expect(chief.resolve(`team:${slug}`)).rejects.toThrow("Thư viện nhóm");
      await expect(chief.resolve(`team:${slug}/care`)).rejects.toThrow(preview!.name);
    }
    expect(github.asked).toEqual([]);
  });

  it("finds a single bot for a single job, with a stable id, its kind and apps, and reads only the listings", async () => {
    const { github, chief } = templates();
    const { results, unavailable } = await chief.search("viết bài SEO cho website");
    expect(unavailable).toEqual([]);
    expect(results[0]).toMatchObject({ id: "bot:seo-writer", kind: "bot", source: "github-bot", name: "Bút SEO", apps: ["wordpress"] });
    expect(github.asked.every((url) => url.endsWith("/catalog.json"))).toBe(true);
    expect(results.some((hit) => hit.id === "bot:BAD ID")).toBe(false);
  });

  it("finds a team for work with roles that work together, matching without Vietnamese marks too", async () => {
    const { chief } = templates();
    const { results } = await chief.search("tim khach hang va email chao hang");
    expect(results[0]).toMatchObject({ id: "team:sales-desk", kind: "team", source: "github-team", roles: 2, apps: ["gmail", "hubspot"] });
  });

  it("limits the results and reads full details only for the chosen ids, each role with its own template id", async () => {
    const { github, chief } = templates();
    expect((await chief.search("")).results.length).toBeLessThanOrEqual(8);
    github.asked.length = 0;
    const [team, bot] = await chief.details(["team:sales-desk", "bot:inbox-helper"]);
    expect(team!.members.map((member) => member.template)).toEqual(["team:sales-desk/hunter", "team:sales-desk/closer"]);
    expect(bot!.members[0]).toMatchObject({ template: "bot:inbox-helper", name: "Hộp Thư", apps: ["gmail"] });
    expect(github.asked.filter((url) => !url.endsWith("/catalog.json")).sort()).toEqual([
      "https://raw.githubusercontent.com/leomieo/limix-bot-teams/main/teams/sales-desk/team.mausteam.json",
      "https://raw.githubusercontent.com/leomieo/limix-bot-templates/main/bots/inbox-helper.json",
    ]);
    await expect(chief.details(["a", "b", "c", "d"])).rejects.toBeInstanceOf(TemplateIdError);
  });

  it("still answers with the built-in bots and names the library that is down", async () => {
    const { github, chief } = templates();
    github.down.bots = true;
    github.down.teams = true;
    const { results, unavailable } = await chief.search("research");
    expect(unavailable).toEqual(["bots", "teams"]);
    expect(results.every((hit) => hit.source === "builtin")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("resolves a template id to checked fields only, and refuses an id that is malformed, unknown or a whole team", async () => {
    const { chief } = templates();
    const bot = await chief.resolve("bot:seo-writer");
    expect(bot).toMatchObject({ id: "bot:seo-writer", source: "github-bot", name: "Bút SEO", apps: ["wordpress"], fields: { name: "Bút SEO", title: "Người viết bài SEO" } });
    expect(Object.keys(bot.fields).sort()).toEqual(["description", "name", "soul", "title"]);
    const role = await chief.resolve("team:sales-desk/closer");
    expect(role).toMatchObject({ id: "team:sales-desk/closer", name: "Phòng Bán Hàng · Chốt Đơn", fields: { name: "Chốt Đơn", title: "Viết email chào hàng" } });
    expect(role.fields.soul).toContain("Chốt Đơn");
    expect((await chief.resolve("research")).id).toBe("builtin:research");
    for (const bad of ["../etc/passwd", "bot:", "team:sales-desk/../x", "bot:nope", "team:sales-desk", "team:sales-desk/ghost", "builtin:nope", "https://evil.example/x"]) {
      await expect(chief.resolve(bad), bad).rejects.toBeInstanceOf(TemplateIdError);
    }
    expect(() => parseTemplateId("team:Sales")).toThrow(TemplateIdError);
  });
});
