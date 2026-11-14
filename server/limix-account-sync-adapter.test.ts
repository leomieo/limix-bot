import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, expect, it } from 'vitest';
import { DATA_DIR } from './config.ts';
import { Store } from './store.ts';
import { RoutineManager } from './routines.ts';
import { writeMemoryFile, readMemoryFile } from './workspace.ts';
import { createBotDataAdapter } from '../limix/account-sync/adapter.ts';

const selection = { instanceId: 'fixture', model: 'fixture-model' };
function fixture() {
  const store = new Store(() => selection);
  const routines = new RoutineManager({ botState: id => store.bot(id) ? 'ready' : 'missing',
    goalState: () => 'missing', createTask: (id, title) => store.createTask(id, title),
    startTurn: async () => { throw new Error('Restore must never run a bot'); } });
  return { store, routines };
}
beforeEach(() => { rmSync(DATA_DIR, { recursive: true, force: true }); mkdirSync(DATA_DIR, { recursive: true }); });
it('captures real bot memory/history and stages restored skill source in an empty fixture', () => {
  const source = fixture(), bot = source.store.createBot({ name: 'Customer bot' }, { seedMessages: false });
  source.store.appendMessage(bot.threadId, { role: 'user', kind: 'text', text: 'Remember the customer', at: 100 });
  writeMemoryFile(bot.id, 'Customer prefers concise replies');
  const folder = join(DATA_DIR, 'fixture-skill'); mkdirSync(folder);
  writeFileSync(join(folder, 'SKILL.md'), '---\nname: learned\ndescription: Fixture\n---\nVerify before reporting.');
  const exporting = createBotDataAdapter({ ...source, selection, stagingRoot: join(DATA_DIR, 'quarantine'), installedSkills: () => [{ owner: `bot:${bot.id}`, name: 'learned', directory: folder }] });
  const snapshot = exporting.capture();
  source.store.deleteBot(bot.id);
  const target = source, importing = createBotDataAdapter({ ...target, selection, stagingRoot: join(DATA_DIR, 'quarantine'), installedSkills: () => [] });
  expect(importing.isEmpty()).toBe(true);
  const result = importing.restore(snapshot);
  const restored = result.bots[0]!;
  expect(readMemoryFile(restored.id).text).toContain('concise replies');
  expect(target.store.messagesFor(restored.threadId).some(message => message.text === 'Remember the customer')).toBe(true);
  expect(readFileSync(join(result.stagedSkills, '0', 'SKILL.md'), 'utf8')).toContain('Verify before reporting');
  expect(result.botIds[bot.id]).toBe(restored.id);
  expect(result.skillsRequireReview).toBe(true);
  expect(() => importing.restore(snapshot)).toThrow(/fresh empty profile/);
});
