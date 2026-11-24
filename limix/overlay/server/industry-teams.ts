import { industryTeamLabel, industryWords } from "../shared/industry-display.ts";
import { INDUSTRY_PROFILES, type IndustryProfile } from "../shared/industry-profiles.ts";
import { industryRoleBot, industrySkillsForTemplate, industryTemplate, INDUSTRY_CARE_SKILL } from "../shared/industry-templates.ts";
import type { ReadyBot } from "../shared/ready-bots.ts";
import { parsePackageDocument, type PackageDocument } from "../shared/package-format.ts";
import type { TeamCatalogEntry } from "./team-library.ts";

const teamSlug = (profile: IndustryProfile) => `industry-${profile.slug}`;


export const industryTeamCatalog: TeamCatalogEntry[] = INDUSTRY_PROFILES.map((profile) => ({
  slug: teamSlug(profile), ...industryTeamLabel(profile), members: profile.roles.length + 1, skills: industrySkillsForTemplate(teamSlug(profile)),
  requires: { apps: [] }, manifest: `/api/team-library/teams/${teamSlug(profile)}`, builtIn: true,
}));

export function industryTeam(slug: string, locale = "en"): PackageDocument | undefined {
  const profile = INDUSTRY_PROFILES.find((item) => teamSlug(item) === slug);
  if (!profile) return undefined;
  const label = industryTeamLabel(profile, locale);
  const words = industryWords(locale);
  const roster = profile.roles.map(role => `${role.name} — ${role.description}`).join("\n");
  const handoff = [
    "Triage each request and select one department from the roster. In internal rooms, mention the assigned member using @ and their exact current display name. On customer channels, prepare only a handoff summary.",
    "Record the receiving department, open questions and checked sources. Share only necessary details authorized for this room.",
    "Separate customer replies from internal notes. Confirm assignment or record changes only after system acknowledgement.",
    "If approval, private data or conflicting decisions are involved, stop forwarding and ask the responsible human.",
    roster,
  ].join("\n");
  const agent = (key: string, bot: ReadyBot) => ({
    key, name: bot.name, title: bot.title, description: bot.description, soul: bot.soul,
    appearance: bot.look, approval: "ask", playbooks: ["handoff"],
  });
  const lead = agent("care", industryTemplate(INDUSTRY_CARE_SKILL, locale)!);
  lead.soul += `\n\n${profile.name}\n${handoff}`;
  const agents = [lead, ...profile.roles.map((role) => agent(role.slug, industryRoleBot(profile, role, locale)))];
  return parsePackageDocument({
    format: "openmaus.package", version: 2,
    package: {
      id: slug, release: "1.1.0", name: label.name, tagline: label.summary, summary: label.summary,
      category: label.category, author: { name: "Limix Bot" }, license: "Apache-2.0",
      outcomes: [words.supportDescription], setupMinutes: 5,
      requirements: { apps: [], capabilities: [] },
      team: { name: label.name, brief: handoff },
      agents,
      rooms: [{ key: "care-desk", name: `${words.intake} · ${label.category}`, members: agents.map((a) => a.key),
        bulletin: handoff, defaultResponder: { kind: "agent", agent: lead.key } }],
      playbooks: [{ key: "handoff", name: words.intake, summary: label.summary,
        triggers: ["department transfer", "shift handoff", "approval required"], instructions: handoff }],
    },
  });
}
