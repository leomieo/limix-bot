// Limix Bot: skills are chosen per bot. A new bot starts with only Limix's core skills (learning new skills, reading
// links with Agent Reach, operating Windows, the phone helpers) plus the skills it learns itself; everything else waits
// in the store ("Kho Kĩ Năng (Skills)") until a person adds it to one bot. Settings → Kĩ Năng (Skills) only downloads and
// installs skills into the store; it never turns a skill on for every bot.
//
// Three kinds of skill can be added to a bot from the store:
//   bundled  — shipped in skills/<id> (ui-ux-pro-max, data-dashboards…): the bot's picks live in
//              <data>/skill-state/<bot>/limix-bundled.json; core ones are always on and cannot be removed.
//   library  — installed from the Limix Skill Hub or pasted in Settings: the bot's assignedSkills.
//   imported — brought in from this computer's Claude Code or Codex: the bot's own switch (opt-in in Limix).
// `/name` calls any skill the bot has, bundled ones included (limixSelectBundled).
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isSkillName } from "../shared/skill-md.ts";
import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";
import { importedSkillListings, setImportedSkillEnabled } from "./imported-skills.ts";
import {
  listLibrarySkills, loadBundledSkills, mergeSkills, readSkillLibraryIndex, selectBundledSkills, setLibrarySkillEveryBot,
  setLibrarySkillOptOut, setLibrarySkillReviewState, unassignLibrarySkill, type BundledSkill,
} from "./skill-library.ts";

/** Always on for every bot. "Learning new skills" itself is the skill-authoring feature, on for every bot already. */
export const LIMIX_CORE_SKILLS: ReadonlySet<string> = new Set([
  "create-verification-skill", "agent-reach", "windows-computer-automation", "phone-connection", "phone-harness",
]);

const BOT_ID = /^[\w-]+$/;
const picksPath = (botId: string) => join(DATA_DIR, "skill-state", botId, "limix-bundled.json");

export function bundledPicks(botId: string): Set<string> {
  if (!BOT_ID.test(botId)) return new Set();
  try {
    const parsed: unknown = JSON.parse(readFileSync(picksPath(botId), "utf8"));
    return new Set(Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string" && isSkillName(name)) : []);
  } catch {
    return new Set();
  }
}

function setBundledPick(botId: string, id: string, on: boolean): void {
  if (!BOT_ID.test(botId) || !isSkillName(id)) return;
  const picks = bundledPicks(botId);
  if (picks.has(id) === on) return;
  if (on) picks.add(id);
  else picks.delete(id);
  mkdirSync(join(DATA_DIR, "skill-state", botId), { recursive: true, mode: 0o700 });
  writeFileAtomic(picksPath(botId), `${JSON.stringify([...picks].sort(), null, 2)}\n`, { mode: 0o600 });
}

/** The shipped skills one bot has: the core ones and the ones a person added to it. */
export function limixBundledFor(botId: string, skills: readonly BundledSkill[]): BundledSkill[] {
  const picks = bundledPicks(botId);
  return skills.filter(({ manifest }) => LIMIX_CORE_SKILLS.has(manifest.id) || picks.has(manifest.id));
}

const slashCalled = (text: string, id: string) => new RegExp(`(^|\\s)/${id.replace(/[-]/g, "\\-")}(?=$|[\\s.,:;!?])`, "m").test(text);

/** selectBundledSkills, plus every skill of `skills` the text calls by `/id`. */
export function limixSelectBundled(text: string, capabilities: Iterable<string>, skills: readonly BundledSkill[]): BundledSkill[] {
  const available = new Set(capabilities);
  const called = skills.filter(({ manifest }) =>
    manifest.requiredCapabilities.every((capability) => available.has(capability)) && slashCalled(text, manifest.id));
  return mergeSkills(selectBundledSkills(text, available, skills), called);
}

export interface BundledListing {
  name: string; description: string; enabled: true; editable: false; source: string; sha256: string; importedAt: string;
  warnings: string[]; skippedFiles: string[]; origin: "bundled"; core: boolean;
}

/** The bot's shipped skills as rows of its Skills page. */
export function limixBundledListings(botId: string): BundledListing[] {
  return limixBundledFor(botId, loadBundledSkills()).map(({ manifest }) => ({
    name: manifest.id, description: manifest.description, enabled: true, editable: false,
    source: LIMIX_CORE_SKILLS.has(manifest.id) ? "Kĩ năng gốc của Limix Bot" : "Kho Kĩ Năng (Skills) · có sẵn",
    sha256: "", importedAt: "", warnings: [], skippedFiles: [], origin: "bundled", core: LIMIX_CORE_SKILLS.has(manifest.id),
  }));
}

/** A bot's switch for one of its shipped skills: off takes an added one away; a core one stays. Null: not shipped. */
export function limixBundledSwitch(botId: string, name: string, enabled: boolean): { status: number; body: unknown } | null {
  if (!loadBundledSkills().some(({ manifest }) => manifest.id === name)) return null;
  if (LIMIX_CORE_SKILLS.has(name)) {
    return enabled ? { status: 200, body: { skill: limixBundledListings(botId).find((skill) => skill.name === name) } }
      : { status: 409, body: { error: "Kĩ năng gốc của Limix Bot luôn bật cho mọi bot." } };
  }
  setBundledPick(botId, name, enabled);
  return { status: 200, body: { skill: { ...limixBundledListings(botId).find((skill) => skill.name === name), name, enabled } } };
}

export interface StoreBots {
  bot(id: string | undefined): { id: string; name?: string; description?: string; assignedSkills?: string[] } | undefined;
  patchBot(id: string, patch: { assignedSkills: string[] }): unknown;
}

type Kind = "bundled" | "library" | "imported";
interface StoreItem { name: string; description: string; kind: Kind; added: boolean; core: boolean; ready: boolean; warnings: number; source: string }

function storeItems(bots: StoreBots, botId: string): StoreItem[] {
  const bot = bots.bot(botId)!;
  const assigned = new Set(bot.assignedSkills ?? []);
  const picks = bundledPicks(botId);
  const items = new Map<string, StoreItem>();
  for (const { manifest } of loadBundledSkills()) {
    const core = LIMIX_CORE_SKILLS.has(manifest.id);
    items.set(manifest.id, { name: manifest.id, description: manifest.description, kind: "bundled", added: core || picks.has(manifest.id), core, ready: true, warnings: 0, source: "Có sẵn trong Limix Bot" });
  }
  for (const skill of listLibrarySkills()) {
    if (items.has(skill.name)) continue;
    const intact = !skill.warnings.some((warning) => warning.includes("enablement is blocked"));
    items.set(skill.name, {
      name: skill.name, description: skill.description, kind: "library", added: assigned.has(skill.name) && skill.enabled, core: false,
      ready: intact, warnings: skill.warnings.length, source: skill.source.startsWith("limix-hub:") ? "Thư viện kĩ năng Limix" : "Đã cài trong Cài đặt",
    });
  }
  for (const skill of importedSkillListings(botId, new Set())) {
    if (items.has(skill.name)) continue;
    items.set(skill.name, { name: skill.name, description: skill.description, kind: "imported", added: skill.enabled, core: false, ready: true, warnings: skill.warnings.length, source: skill.source || "Từ máy tính này" });
  }
  return [...items.values()].sort((a, b) => Number(b.core) - Number(a.core) || a.name.localeCompare(b.name));
}

/** Add one skill to one bot, or take it away. `kind` may be left out: the store finds the name. */
export function limixStoreSet(bots: StoreBots, botId: string, name: string, add: boolean, kind?: Kind): { ok: true } | { error: string } {
  const bot = bots.bot(botId);
  if (!bot) return { error: "Không tìm thấy bot." };
  if (!isSkillName(name)) return { error: "Tên kĩ năng không hợp lệ." };
  const item = storeItems(bots, botId).find((entry) => entry.name === name && (!kind || entry.kind === kind));
  if (!item) return { error: `Kho chưa có kĩ năng "${name}".` };
  if (item.kind === "bundled") {
    if (item.core) return add ? { ok: true } : { error: "Kĩ năng gốc của Limix Bot luôn bật cho mọi bot." };
    setBundledPick(botId, name, add);
    return { ok: true };
  }
  if (item.kind === "imported") {
    const result = setImportedSkillEnabled(botId, name, add);
    return "error" in result ? { error: result.error } : { ok: true };
  }
  const assigned = bot.assignedSkills ?? [];
  if (add) {
    // Adding from the store is the person's choice for this bot, so a skill installed but not yet switched on is switched on.
    const listing = listLibrarySkills().find((skill) => skill.name === name);
    if (listing && !listing.enabled) {
      const approved = setLibrarySkillReviewState(name, "approved");
      if ("error" in approved) return { error: approved.error };
    }
    setLibrarySkillOptOut(botId, name, false);
    if (!assigned.includes(name)) bots.patchBot(botId, { assignedSkills: [...assigned, name] });
    return { ok: true };
  }
  const result = unassignLibrarySkill(botId, name, assigned);
  if ("unassigned" in result && result.assignedSkills) bots.patchBot(botId, { assignedSkills: result.assignedSkills });
  return { ok: true };
}

/** GET /api/limix/skill-store/<bot> lists the store for that bot; POST {name, add, kind?} adds or takes away one skill. */
export function handleLimixSkillStore(bots: StoreBots, method: string, path: string, body: unknown): { status: number; body: unknown } | null {
  const m = path.match(/^\/api\/limix\/skill-store\/([\w-]+)$/);
  if (!m) return null;
  const botId = m[1]!;
  if (!bots.bot(botId)) return { status: 404, body: { error: "Không tìm thấy bot." } };
  if (method === "GET") return { status: 200, body: { skills: storeItems(bots, botId) } };
  if (method === "POST") {
    const raw = (body && typeof body === "object" ? body : {}) as { name?: unknown; add?: unknown; kind?: unknown };
    const kind = raw.kind === "bundled" || raw.kind === "library" || raw.kind === "imported" ? raw.kind : undefined;
    if (typeof raw.name !== "string" || typeof raw.add !== "boolean") return { status: 400, body: { error: "Cần tên kĩ năng và add." } };
    const result = limixStoreSet(bots, botId, raw.name, raw.add, kind);
    return "error" in result ? { status: 422, body: result } : { status: 200, body: { skills: storeItems(bots, botId) } };
  }
  return { status: 405, body: { error: "method not allowed" } };
}

/** Once: skills that earlier versions turned on for every bot go back to the store. */
export function limixSkillDefaultsMigration(): void {
  const marker = join(DATA_DIR, "skill-state", "limix-skill-defaults-v1.json");
  if (existsSync(marker)) return;
  try {
    for (const [name, entry] of Object.entries(readSkillLibraryIndex())) if (entry.everyBot) setLibrarySkillEveryBot(name, false);
    mkdirSync(join(DATA_DIR, "skill-state"), { recursive: true, mode: 0o700 });
    writeFileAtomic(marker, `${JSON.stringify({ at: new Date().toISOString() })}\n`, { mode: 0o600 });
  } catch {
    // Retried at the next start.
  }
}
