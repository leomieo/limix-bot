import { activeLocale } from "@/lib/i18n";
import type { Routine } from "@/lib/routines";
import { api, type Action, type Bot, type Group } from "@/state/store";

export interface AddedTemplate {
  bots: Bot[];
  groups?: Group[];
  routines?: Routine[];
  connections?: unknown[];
  presets?: unknown[];
  /** The first visible bot, now selected. */
  first?: Bot;
}

/** The server installs a bundled toolkit only for the exact built-in package shown in the preview. */
export async function addTemplate(manifest: unknown, dispatch: (action: Action) => void, builtInTeam?: string): Promise<AddedTemplate> {
  const target = builtInTeam ? `&builtInTeam=${encodeURIComponent(builtInTeam)}&locale=${activeLocale()}` : "";
  const response = (await api(`/api/teams/import?mode=add${target}`, { method: "POST", body: JSON.stringify(manifest) })) as AddedTemplate;
  for (const bot of response.bots) dispatch({ type: "botAdded", bot });
  for (const group of response.groups ?? []) dispatch({ type: "groupPatched", group });
  for (const routine of response.routines ?? []) dispatch({ type: "routinePatched", routine });
  const first = response.bots.find((bot) => !bot.hidden);
  if (first) dispatch({ type: "select", id: first.id });
  return { ...response, ...(first ? { first } : {}) };
}
