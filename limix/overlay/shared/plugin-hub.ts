export interface PluginMetadata {
  id: string;
  version: string;
  name: { vi: string; en: string };
  description: { vi: string; en: string };
  requiresMcp: string[];
}
export interface PluginIndexEntry extends PluginMetadata { sha256: string }
export interface InstalledPlugin extends PluginIndexEntry {
  instructions: string;
  teams: string[];
  bots: Record<string, boolean>;
}
export interface PluginLibrary {
  catalog: PluginIndexEntry[];
  installed: InstalledPlugin[];
}
export function pluginEnabled(plugin: InstalledPlugin, bot: { id: string; section?: string }) {
  return Object.hasOwn(plugin.bots, bot.id) ? plugin.bots[bot.id] : plugin.teams.includes(bot.section ?? "");
}
