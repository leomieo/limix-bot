// Limix: a bot's own Private desktop size. Used when each bot has its own desktop; a field it leaves out follows the
// workspace setting. A running desktop takes a change when it is next created or started.
import { MAX_DESKTOP_CPUS, MAX_DESKTOP_MEMORY_GB, MIN_DESKTOP_CPUS, MIN_DESKTOP_MEMORY_GB, type DesktopResources } from "./container-limits.ts";

export type BotDesktopResources = { memoryGb?: number; cpus?: number };

/** null clears the bot's own limits. */
export function limixDesktopResources(raw: unknown): { value: BotDesktopResources | undefined } | { error: string } {
  if (raw === null) return { value: undefined };
  if (typeof raw !== "object" || Array.isArray(raw)) return { error: "desktopResources must be an object or null" };
  const out: BotDesktopResources = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    const [min, max] = key === "memoryGb" ? [MIN_DESKTOP_MEMORY_GB, MAX_DESKTOP_MEMORY_GB] : key === "cpus" ? [MIN_DESKTOP_CPUS, MAX_DESKTOP_CPUS] : [NaN, NaN];
    if (Number.isNaN(min)) return { error: `desktopResources takes memoryGb and cpus, not ${key}` };
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) return { error: `desktopResources.${key} must be a whole number from ${min} to ${max}` };
    out[key as keyof BotDesktopResources] = value as number;
  }
  return { value: Object.keys(out).length ? out : undefined };
}

/** The workspace size with this bot's own limits laid over it. */
export function withBotDesktopResources(workspace: DesktopResources, bot: { desktopResources?: BotDesktopResources } | null | undefined): DesktopResources {
  return { memoryGb: bot?.desktopResources?.memoryGb ?? workspace.memoryGb, cpus: bot?.desktopResources?.cpus ?? workspace.cpus };
}
