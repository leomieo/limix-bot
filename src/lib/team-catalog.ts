// The community templates catalog (/api/team-library/catalog). Its names and
// summaries come in English; the built-in teams show in the app's language.
import { industryLabel, industryTeamLabel, industryWords, roleLabel } from "../../shared/industry-display";
import { INDUSTRY_PROFILES } from "../../shared/industry-profiles";
import { activeLocale, t } from "./i18n";
import type { LocaleKey } from "@/locales";

export interface TeamCatalogEntry {
  slug: string;
  name: string;
  summary: string;
  category: string;
  outcome?: string;
  setupMinutes?: number;
  featured?: boolean;
  package?: string;
  manifest: string;
  readme?: string;
  builtIn?: true;
  members: number;
  skills: string[];
  requires: { apps: string[] };
}

export interface TeamCatalog {
  repositoryUrl: string;
  teams: TeamCatalogEntry[];
  communityAvailable?: false;
}

const CATALOG_COPY: Record<string, string> = {
  "seo growth team": "seoGrowth",
  "engineering team": "engineering",
  "100x marketing team": "marketing100x",
  "reddit lead miner": "redditLeadMiner",
  "competitor watch": "competitorWatch",
  "inbox follow-up": "inboxFollowup",
};

export function catalogCopy(entry: TeamCatalogEntry): TeamCatalogEntry {
  const profile = entry.builtIn && INDUSTRY_PROFILES.find(p => `industry-${p.slug}` === entry.slug);
  if (profile) return { ...entry, ...industryTeamLabel(profile, activeLocale()) };
  const id = CATALOG_COPY[entry.name.trim().toLowerCase()];
  return id ? { ...entry, name: t(`templates.catalog.${id}.name` as LocaleKey), summary: t(`templates.catalog.${id}.summary` as LocaleKey), outcome: entry.outcome ? t(`templates.catalog.${id}.outcome` as LocaleKey) : undefined } : entry;
}

/** Search matches a team by its localized name and summary as well as its English ones, its category, skills and apps. */
export function catalogMatches(entry: TeamCatalogEntry, search: string): boolean {
  const copy = catalogCopy(entry);
  return `${copy.name} ${copy.summary} ${entry.name} ${entry.summary} ${entry.category} ${entry.skills.join(" ")} ${entry.requires.apps.join(" ")}`
    .toLowerCase()
    .includes(search);
}

export function industrySkillLabel(id: string): string {
  const locale = activeLocale();
  if (id === "industry-customer-care") return industryWords(locale).intake;
  const profile = INDUSTRY_PROFILES.find(p => `industry-${p.slug}` === id);
  return profile ? `${industryLabel(profile, locale).name} · ${profile.roles.map(role => roleLabel(role, locale).name).join(", ")}` : id;
}
