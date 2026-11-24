// Limix Bot: the Chief of Staff looks up the ready-made single bots and teams on GitHub (the same sources, readers and
// checks as the Templates page) and the built-in bots, by what the person needs. A search returns a few light listings;
// only the templates the Chief picks are read in full. Everything here is template data: only checked fields (name,
// title, description, standing instructions, the apps it suggests) reach a proposal, and nothing is created, connected or
// granted before the person approves the card.
import { READY_BOTS } from "../shared/ready-bots.ts";
import { INDUSTRY_BOTS, industryTemplate, SUPER_SUPPORT_BOT } from "../shared/industry-templates.ts";
import { INDUSTRY_PROFILES } from "../shared/industry-profiles.ts";
import { industryTeamCatalog, industryTeam } from "./industry-teams.ts";
import { upgradeV1 } from "./bot-package.ts";
import { fetchBotListing, fetchLibraryBot, type LibraryBot, type LibraryBotListing } from "./limix-bot-library.ts";
import { fetchLibraryTeam, fetchTeamCatalog, type ParsedShareableTeam, type TeamCatalog } from "./team-library.ts";
import { PACKAGE_V1_VERSION } from "../shared/package-format.ts";

export type TemplateSource = "builtin" | "github-bot" | "github-team";
type GalleryTarget = { kind: "bot" | "team"; id: string; name: string };

export interface TemplateHit {
  id: string;
  kind: "bot" | "team";
  source: TemplateSource;
  name: string;
  title?: string;
  description: string;
  category?: string;
  /** A team's roles by name; read in full with details. */
  roles?: number;
  apps: string[];
  gallery?: GalleryTarget;
}

export interface TemplateMember { template: string; name: string; title: string; does: string; lead?: true; apps: string[] }
export interface TemplateDetail { id: string; kind: "bot" | "team"; source: TemplateSource; name: string; description: string; members: TemplateMember[]; apps: string[]; gallery?: GalleryTarget }

/** What a create operation takes from its template. */
export interface ResolvedTemplate {
  id: string;
  source: TemplateSource;
  /** The template's name as the person sees it in the library. */
  name: string;
  fields: { name: string; title: string; description: string; soul: string };
  apps: string[];
}

export interface ChiefTemplateSources {
  bots(): Promise<LibraryBotListing[]>;
  bot(id: string): Promise<LibraryBot>;
  teams(): Promise<TeamCatalog>;
  team(slug: string): Promise<ParsedShareableTeam>;
}

export const SEARCH_LIMIT = 8;
export const DETAILS_LIMIT = 3;
const ROLE_TEXT = 280;
const DESCRIPTION_MAX = 4_000;
const SLUG = "[a-z0-9][a-z0-9-]{0,79}";
const KEY = "[a-z0-9][a-z0-9_-]{0,63}";
const TEMPLATE_ID = new RegExp(`^(?:builtin:(${SLUG})|bot:(${SLUG})|team:(${SLUG})(?:/(${KEY}))?|(${SLUG}))$`, "u");

export class TemplateIdError extends Error {}

export function industryGalleryTarget(raw: string): GalleryTarget | undefined {
  const match = TEMPLATE_ID.exec(raw.trim());
  if (!match) return;
  if (match[3]) {
    const team = industryTeamCatalog.find(entry => entry.slug === match[3]);
    if (team) return { kind: "team", id: team.slug, name: team.name };
    return;
  }
  const bot = industryTemplate(match[1] ?? match[2] ?? match[5]);
  if (bot) return { kind: "bot", id: bot.id, name: bot.name };
}

export function industryGalleryInstruction(target: Pick<GalleryTarget, "kind" | "name">): string {
  return target.kind === "team"
    ? `Mở Thư viện nhóm → ${target.name} → Dùng mẫu để xem và nhập nhóm cùng bộ công cụ CSKH.`
    : `Mở Thư viện bot → ${target.name} → Dùng mẫu để tạo bot với bộ công cụ CSKH.`;
}

/** `builtin:<id>` (or a bare built-in id), `bot:<id>`, `team:<slug>` for a whole team, `team:<slug>/<role key>` for one role. */
export function parseTemplateId(id: string): { source: TemplateSource; id: string; role?: string } {
  const match = TEMPLATE_ID.exec(id.trim());
  if (!match) throw new TemplateIdError(`Template id ${JSON.stringify(id)} is not valid. Use an id exactly as list_team_library returned it.`);
  if (match[1] || match[5]) return { source: "builtin", id: (match[1] ?? match[5])! };
  if (match[2]) return { source: "github-bot", id: match[2] };
  return { source: "github-team", id: match[3]!, ...(match[4] ? { role: match[4] } : {}) };
}

export const githubSources = (fetcher?: typeof fetch): ChiefTemplateSources => ({
  bots: () => fetchBotListing(fetcher),
  bot: (id) => fetchLibraryBot(id, fetcher),
  teams: () => fetchTeamCatalog(fetcher),
  team: (slug) => fetchLibraryTeam(slug, fetcher),
});

const oneLine = (text: string, max: number) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const words = (text: string) => [...new Set(fold(text).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 2))];

function score(query: string[], ...fields: Array<string | undefined>): number {
  if (!query.length) return 0;
  const indexed = new Set(words(fields.filter(Boolean).join(" ")));
  return query.reduce((sum, word) => sum + Number(indexed.has(word)), 0);
}

function teamMembers(team: ParsedShareableTeam): Array<{ key: string; name: string; title: string; description: string; soul?: string; lead: boolean; apps: string[] }> {
  if (!("package" in team)) return team.team.members.map((member) => ({ key: member.key, name: member.name, title: member.title, description: member.description, ...(member.soul ? { soul: member.soul } : {}), lead: false, apps: [] }));
  const pkg = team.version === PACKAGE_V1_VERSION ? upgradeV1(team).package : team.package;
  const labels = new Map((pkg.connections ?? []).map((connection) => [connection.key, connection.label]));
  return pkg.agents.map((agent) => ({
    key: agent.key, name: agent.name, title: agent.title?.trim() || "Specialist", description: agent.description?.trim() ?? "",
    ...(agent.soul?.trim() ? { soul: agent.soul } : {}), lead: agent.key === pkg.team?.leader,
    apps: (agent.connections ?? []).map((key) => labels.get(key) ?? key),
  }));
}

export function createChiefTemplates(sources: ChiefTemplateSources = githubSources()) {
  async function communityTeamEntry(slug: string) {
    const catalog = await sources.teams();
    if (catalog.communityAvailable === false) throw new Error("The community team library is unavailable.");
    const entry = catalog.teams.find(team => team.slug === slug);
    if (!entry) throw new TemplateIdError(`No ready-made team "team:${slug}".`);
    return entry;
  }

  /** Best matches for what the person needs from both GitHub libraries and the built-in bots; `unavailable` names a
   * library that could not be read, so the Chief says where its proposal came from. */
  async function search(query: string, limit = SEARCH_LIMIT): Promise<{ results: TemplateHit[]; unavailable: Array<"bots" | "teams"> }> {
    const phrase = fold(query);
    const wanted = words(phrase.replace(/\b(goi y|phong ban|ban be|bo phan|nganh nghe|doanh nghiep|tro ly|cua toi)\b/gu, " "))
      .filter(word => !["toi", "cho", "cua", "muon", "can", "theo", "nganh", "mau", "bot", "nhom", "va", "mot", "tim", "tren", "team"].includes(word));
    const [bots, teams] = await Promise.allSettled([sources.bots(), sources.teams()]);
    const scored: Array<{ hit: TemplateHit; score: number; order: number }> = [];
    if (teams.status === "fulfilled") teams.value.teams.filter(team => !industryGalleryTarget(`team:${team.slug}`)).forEach((team, order) => scored.push({ order, score: score(wanted, team.name, team.summary, team.category, team.outcome),
      hit: { id: `team:${team.slug}`, kind: "team", source: "github-team", name: team.name, description: team.summary, category: team.category, roles: team.members, apps: team.requires.apps } }));
    if (bots.status === "fulfilled") bots.value.filter(bot => !industryTemplate(bot.id)).forEach((bot, order) => scored.push({ order: 100 + order, score: score(wanted, bot.name, bot.title, bot.description, bot.category, bot.try),
      hit: { id: `bot:${bot.id}`, kind: "bot", source: "github-bot", name: bot.name, title: bot.title, description: bot.description, category: bot.category, apps: bot.apps } }));
    READY_BOTS.forEach((bot, order) => scored.push({ order: 200 + order, score: score(wanted, bot.id, bot.name, bot.title, bot.description, bot.category),
      hit: { id: `builtin:${bot.id}`, kind: "bot", source: "builtin", name: bot.name, title: bot.title, description: bot.description, category: bot.category, apps: bot.apps } }));
    const wantsTeam = /\b(nhom|doi nhom|team)\b/u.test(phrase);
    const wantsRole = /\b(phong ban|ban be|bo phan|department)\b/u.test(phrase);
    industryTeamCatalog.forEach((team, order) => {
      const gallery = { kind: "team", id: team.slug, name: team.name } as const;
      const relevance = score(wanted, team.slug, team.name, team.summary, INDUSTRY_PROFILES[order]?.vi.name, INDUSTRY_PROFILES[order]?.vi.description);
      scored.push({ order: 300 + order, score: relevance + (wantsTeam && (relevance || !wanted.length) ? 3 : 0),
        hit: { id: `team:${team.slug}`, source: "builtin", kind: "team", name: team.name, description: team.summary,
          category: team.category, roles: team.members, apps: [], gallery } });
    });
    INDUSTRY_BOTS.forEach((bot, order) => {
      const gallery = { kind: "bot", id: bot.id, name: bot.name } as const;
      const superSupport = bot.id === SUPER_SUPPORT_BOT.id;
      const vi = industryTemplate(bot.id, "vi")!;
      const relevance = score(wanted, bot.id, bot.name, bot.title, bot.description, vi.name, vi.title, vi.description, superSupport ? "Zalo Facebook Messenger Telegram customer service omnichannel" : undefined);
      const named = phrase.includes(fold(bot.name)) || phrase.includes(fold(vi.name));
      scored.push({ order: 400 + order, score: relevance + (named ? 5 : 0) + (wantsRole && !superSupport && (relevance || !wanted.length) ? 2 : 0),
        hit: { id: `builtin:${bot.id}`, source: "builtin", kind: "bot", name: bot.name, title: bot.title, description: bot.description, apps: [], gallery } });
    });
    const matched = wanted.length ? scored.filter((entry) => entry.score > 0) : scored;
    matched.sort((a, b) => b.score - a.score || a.order - b.order);
    return {
      results: matched.slice(0, Math.max(1, Math.min(limit, SEARCH_LIMIT))).map((entry) => entry.hit),
      unavailable: [...(bots.status === "rejected" ? ["bots" as const] : []), ...(teams.status === "rejected" || teams.value.communityAvailable === false ? ["teams" as const] : [])],
    };
  }

  /** The chosen templates in full: each role with the template id a create operation uses. */
  async function details(ids: readonly string[]): Promise<TemplateDetail[]> {
    if (ids.length > DETAILS_LIMIT) throw new TemplateIdError(`Read at most ${DETAILS_LIMIT} templates at a time.`);
    return Promise.all(ids.map(async (raw) => {
      const id = parseTemplateId(raw);
      const gallery = industryGalleryTarget(raw);
      if (gallery?.kind === "team") {
        const team = industryTeam(gallery.id)!;
        const members = teamMembers(team);
        const profile = INDUSTRY_PROFILES.find(item => `industry-${item.slug}` === gallery.id)!;
        return { id: `team:${gallery.id}`, kind: "team" as const, source: "builtin" as const, name: gallery.name,
          description: profile.description, apps: [], gallery, members: members.map(member => ({
            template: `builtin:${member.key === "care" ? SUPER_SUPPORT_BOT.id : `${gallery.id}-${member.key}`}`,
            name: member.name, title: member.title, does: oneLine(member.description, ROLE_TEXT), apps: member.apps,
          })) };
      }
      if (gallery?.kind === "bot") {
        const bot = industryTemplate(gallery.id)!;
        return { id: `builtin:${bot.id}`, kind: "bot" as const, source: "builtin" as const, name: bot.name, description: bot.description, apps: bot.apps, gallery,
          members: [{ template: `builtin:${bot.id}`, name: bot.name, title: bot.title, does: oneLine(bot.description, ROLE_TEXT), apps: bot.apps }] };
      }
      if (id.source === "builtin") {
        const bot = READY_BOTS.find((entry) => entry.id === id.id);
        if (!bot) throw new TemplateIdError(`No built-in bot ${JSON.stringify(raw)}.`);
        return { id: `builtin:${bot.id}`, kind: "bot" as const, source: id.source, name: bot.name, description: bot.description, apps: bot.apps,
          members: [{ template: `builtin:${bot.id}`, name: bot.name, title: bot.title, does: oneLine(bot.description, ROLE_TEXT), apps: bot.apps }] };
      }
      if (id.source === "github-bot") {
        const bot = await sources.bot(id.id);
        return { id: `bot:${bot.id}`, kind: "bot" as const, source: id.source, name: bot.name, description: bot.description, apps: bot.apps,
          members: [{ template: `bot:${bot.id}`, name: bot.name, title: bot.title, does: oneLine(bot.description, ROLE_TEXT), apps: bot.apps }] };
      }
      const entry = await communityTeamEntry(id.id);
      const members = teamMembers(await sources.team(id.id));
      return { id: `team:${entry.slug}`, kind: "team" as const, source: id.source, name: entry.name, description: entry.summary, apps: entry.requires.apps,
        members: members.map((member) => ({ template: `team:${entry.slug}/${member.key}`, name: member.name, title: member.title, does: oneLine(member.description, ROLE_TEXT),
          ...(member.lead ? { lead: true as const } : {}), apps: member.apps })) };
    }));
  }

  /** The checked fields one create operation takes from its template id. */
  async function resolve(raw: string): Promise<ResolvedTemplate> {
    const id = parseTemplateId(raw);
    const gallery = industryGalleryTarget(raw);
    if (gallery) throw new TemplateIdError(industryGalleryInstruction(gallery));
    if (id.source === "builtin") {
      const bot = READY_BOTS.find((entry) => entry.id === id.id);
      if (!bot) throw new TemplateIdError(`No built-in bot ${JSON.stringify(raw)}. Use an id exactly as list_team_library returned it.`);
      return { id: `builtin:${bot.id}`, source: "builtin", name: bot.name, fields: { name: bot.name, title: bot.title, description: bot.description, soul: bot.soul }, apps: bot.apps };
    }
    if (id.source === "github-bot") {
      const bot = await sources.bot(id.id).catch((error: unknown) => { throw (error as { status?: number }).status === 404 ? new TemplateIdError(`No template bot ${JSON.stringify(raw)}.`) : error; });
      return { id: `bot:${bot.id}`, source: "github-bot", name: bot.name, fields: { name: bot.name, title: bot.title, description: bot.description, soul: bot.soul }, apps: bot.apps };
    }
    if (!id.role) throw new TemplateIdError(`${JSON.stringify(raw)} is a whole team: give each new bot one role's id, team:<slug>/<role key>, from list_team_library details.`);
    const entry = await communityTeamEntry(id.id);
    const member = teamMembers(await sources.team(id.id)).find((candidate) => candidate.key === id.role);
    if (!member) throw new TemplateIdError(`Team ${entry.name} has no role ${JSON.stringify(id.role)}.`);
    const description = member.description.slice(0, DESCRIPTION_MAX);
    return { id: `team:${entry.slug}/${member.key}`, source: "github-team", name: `${entry.name} · ${member.name}`, apps: member.apps,
      fields: { name: member.name, title: member.title, description, soul: member.soul?.trim() || `You are ${member.name}, ${member.title} in the ${entry.name} team. ${description}`.trim() } };
  }

  return { search, details, resolve };
}

export type ChiefTemplates = ReturnType<typeof createChiefTemplates>;

export const SOURCE_LABEL: Record<TemplateSource, string> = { builtin: "built-in bot", "github-bot": "GitHub bot library", "github-team": "GitHub team library" };
