import { describe, expect, it } from "vitest";
import { INDUSTRY_BOTS, industryTemplate } from "./industry-templates";
import { INDUSTRY_PROFILES } from "./industry-profiles";
import { industryTeam } from "../server/industry-teams";
import { localeChoices } from "../src/locales";

describe("bundled industry templates", () => {
  for (const { code } of localeChoices) it(`uses ${code} display copy with the English workflow`, () => {
    for (const bot of INDUSTRY_BOTS) {
      const shown = industryTemplate(bot.id, code)!;
      expect(shown.soul).toBe(bot.soul);
      expect(bot.soul).not.toMatch(/[ạ-ỹđ]/iu);
      if (code !== "en") {
        expect(shown.name).not.toBe(bot.name);
        expect(shown.tryAsking[0]).not.toBe(bot.tryAsking[0]);
      }
    }
    for (const profile of INDUSTRY_PROFILES) {
      const id = `industry-${profile.slug}`;
      const canonical = industryTeam(id)!.package;
      const shown = industryTeam(id, code)!.package;
      expect(shown.playbooks[0]!.instructions).toBe(canonical.playbooks[0]!.instructions);
      expect(shown.agents.map(agent => agent.soul)).toEqual(canonical.agents.map(agent => agent.soul));
      if (code !== "en") expect(shown.name).not.toBe(canonical.name);
    }
  });
});
