// Limix: bots of one department can share one Private desktop (when each bot otherwise has its own). One screen, so
// they take turns on it. Its size grows with the number of bots unless someone set a size; it never asks for more than
// the machine can give a desktop.
import { MAX_DESKTOP_CPUS, MAX_DESKTOP_MEMORY_GB, MIN_DESKTOP_CPUS, MIN_DESKTOP_MEMORY_GB, type DesktopResources } from "./container-limits.ts";
import type { BotDesktopResources } from "./limix-desktop-resources.ts";

export const TEAM_DESKTOP_EXTRA_MEMORY_GB = 2;
export const TEAM_DESKTOP_EXTRA_CPUS = 1;

export interface TeamDesktopMember { id: string; section?: string; hidden?: boolean; desktopTeam?: boolean; desktopResources?: BotDesktopResources }

/** The department key ("" is General). */
export const teamDesktopKey = (bot: { section?: string }): string => (bot.section ?? "").trim().toLowerCase();

export function teamDesktopMembers<T extends TeamDesktopMember>(bots: readonly T[], team: string): T[] {
  return bots.filter((bot) => bot.desktopTeam && !bot.hidden && teamDesktopKey(bot) === team);
}

/** Suggested: the workspace size plus a share for each bot past the first. */
export function suggestedTeamDesktop(workspace: DesktopResources, members: number): DesktopResources {
  const extra = Math.max(0, members - 1);
  return { memoryGb: workspace.memoryGb + extra * TEAM_DESKTOP_EXTRA_MEMORY_GB, cpus: workspace.cpus + extra * TEAM_DESKTOP_EXTRA_CPUS };
}

/** The size the shared desktop runs with: the largest size a member set, otherwise the suggestion, within the machine. */
export function teamDesktopResources(workspace: DesktopResources, members: readonly TeamDesktopMember[],
  machine?: { memoryGb: number; cpus: number; reservedMemoryGb: number; reservedCpus: number }): DesktopResources & { chosen: "set" | "suggested" } {
  const set = members.filter((bot) => bot.desktopResources?.memoryGb || bot.desktopResources?.cpus);
  const suggested = suggestedTeamDesktop(workspace, members.length);
  const want = set.length
    ? { memoryGb: Math.max(...set.map((bot) => bot.desktopResources?.memoryGb ?? workspace.memoryGb)), cpus: Math.max(...set.map((bot) => bot.desktopResources?.cpus ?? workspace.cpus)) }
    : suggested;
  const roomMemory = machine ? Math.floor(machine.memoryGb - machine.reservedMemoryGb) : MAX_DESKTOP_MEMORY_GB;
  const roomCpus = machine ? Math.floor(machine.cpus - machine.reservedCpus) : MAX_DESKTOP_CPUS;
  const clamp = (value: number, min: number, max: number, room: number) => Math.max(min, Math.min(value, max, Math.max(min, room)));
  return {
    memoryGb: clamp(want.memoryGb, MIN_DESKTOP_MEMORY_GB, MAX_DESKTOP_MEMORY_GB, roomMemory),
    cpus: clamp(want.cpus, MIN_DESKTOP_CPUS, MAX_DESKTOP_CPUS, roomCpus),
    chosen: set.length ? "set" : "suggested",
  };
}
