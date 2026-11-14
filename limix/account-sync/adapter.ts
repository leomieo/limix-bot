import { createTeamBackup, importTeamBackup } from '../../server/team-backup.ts';
import { parseTeamBackup } from '../../shared/team-backup.ts';
import { redactSecretsInText } from '../../server/redact.ts';
import type { Store } from '../../server/store.ts';
import type { RoutineManager } from '../../server/routines.ts';
import type { ModelSelection } from '../../server/contracts.ts';
import { captureSkill, stageSkills } from './skills.mjs';

/** Host must freeze writers across capture/restore. Skills are staged for review; routines restore paused through the existing portable importer. */
export function createBotDataAdapter(options: {
  store: Store;
  routines: RoutineManager;
  selection: ModelSelection;
  stagingRoot: string;
  installedSkills: () => Array<{ owner: string; name: string; directory: string }>;
}) {
  return {
    isEmpty: () => options.store.bots.length === 0 && options.store.groups.length === 0,
    capture() {
      const team = parseTeamBackup(createTeamBackup(options.store, options.routines.listRoutines(), 'Limix account backup'));
      const skills = options.installedSkills().map(skill => captureSkill(skill, redactSecretsInText));
      return { format: 'limix.account-sync' as const, version: 1 as const, team, skills };
    },
    restore(snapshot: { team: unknown; skills: Array<{ owner: string; name: string; files: Array<{ path: string; text: string }> }>; format: string; version: number }) {
      if (options.store.bots.length || options.store.groups.length) throw new Error('Restore requires a fresh empty profile');
      const team = parseTeamBackup(snapshot.team);
      const owners = new Set(team.bots.map(bot => `bot:${bot.key}`));
      if (snapshot.skills.some(skill => skill.owner !== 'library' && !owners.has(skill.owner))) throw new Error('Unknown skill owner');
      const stagedSkills = stageSkills(snapshot, options.stagingRoot);
      const result = importTeamBackup(options.store, options.routines, team, options.selection);
      const botIds = Object.fromEntries(team.bots.map((bot, index) => [bot.key, result.bots[index]!.id]));
      return { ...result, stagedSkills, botIds, skillsRequireReview: true };
    },
  };
}
