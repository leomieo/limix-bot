import words from "./industry-display.json" with { type: "json" };
import type { IndustryProfile, IndustryRole } from "./industry-profiles.ts";

interface Words {
  support: string; supportDescription: string; team: string; description: string;
  ask: string; handoffAsk: string; priceAsk: string; intake: string;
  industries: Record<string, string>; roles: Record<string, string>;
}
export function industryWords(locale = "en"): Words {
  const tag = locale.toLowerCase();
  const key = /^zh-(hant|tw|hk|mo)/.test(tag) ? "zh-tw" : tag.startsWith("pt") ? "pt-br" : tag.split("-")[0]!;
  return Object.hasOwn(words, key) ? words[key as keyof typeof words] : words.en;
}
export function industryLabel(p: IndustryProfile, locale = "en") {
  const w = industryWords(locale);
  if (w === words.vi) return p.vi;
  const name = w.industries[p.slug];
  return name ? { name, description: p.roles.map(r => w.roles[r.slug]).join(" · ") } : p;
}
export function roleLabel(r: IndustryRole, locale = "en") {
  const w = industryWords(locale);
  if (w === words.vi) return r.vi;
  const name = w.roles[r.slug];
  return name ? { name, title: name, description: w.description.replace("{role}", name) } : r;
}
export function industryTeamLabel(p: IndustryProfile, locale = "en") {
  const label = industryLabel(p, locale);
  return { name: `${industryWords(locale).team} · ${label.name}`, category: label.name, summary: label.description };
}
