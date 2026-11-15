import { DEFAULT_BOT_NAME, LEGACY_DEFAULT_BOT_NAMES } from "../shared/default-bot.ts";
import type { BotRecord } from "./store.ts";

const plain = (name: string) => name.trim().toLowerCase();

/** The built-in helper takes the current name only while it still has an old default one; a name the person chose stays. */
export function renameLegacyDefaultBots(store: { bots: readonly BotRecord[]; patchBot(id: string, patch: Partial<BotRecord>): unknown }): string[] {
  const legacy = new Set(LEGACY_DEFAULT_BOT_NAMES.map(plain));
  const renamed: string[] = [];
  for (const bot of store.bots) {
    if (!bot.defaultBot || !legacy.has(plain(bot.name))) continue;
    const section = bot.section?.trim() ?? "";
    const taken = store.bots.some((other) => other.id !== bot.id && !other.defaultBot && !other.hidden && (other.section?.trim() ?? "") === section && plain(other.name) === plain(DEFAULT_BOT_NAME));
    if (taken) continue;
    store.patchBot(bot.id, { name: DEFAULT_BOT_NAME });
    renamed.push(bot.id);
  }
  return renamed;
}
