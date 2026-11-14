import { lstatSync, readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { skillPath, validateSnapshot } from './protocol.mjs';

/** Capture only explicit installed skill roots, never the remote catalog or any linked directory. `redact` is the app's secret scrubber. */
export function captureSkill({ owner, name, directory }, redact) {
  if (lstatSync(directory).isSymbolicLink()) throw new Error('Linked skill root');
  const files = [];
  function walk(folder, prefix = '', depth = 0) {
    if (depth > 20) throw new Error('Skill directory too deep');
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      if (item.isSymbolicLink()) continue;
      const relative = prefix + item.name;
      if (item.isDirectory()) {
        if (!/^(?:node_modules|\.git|\.venv|venv|__pycache__|\.cache|\.limixbot-secrets)$/i.test(item.name)) walk(join(folder, item.name), relative + '/', depth + 1);
      } else if (item.isFile() && skillPath(relative)) {
        const file = join(folder, item.name);
        if (lstatSync(file).size > 2 * 1024 * 1024) throw new Error('Skill file too large');
        const bytes = readFileSync(file);
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { continue; }
        if (text.includes('\0')) continue;
        files.push({ path: relative, text: redact(text) });
        if (files.length > 1000) throw new Error('Too many skill files');
      }
    }
  }
  walk(directory);
  const skill = { owner, name, files };
  validateSnapshot({ format: 'limix.account-sync', version: 1, team: {}, skills: [skill] });
  return skill;
}

/** Restore into a fresh quarantine outside active skills. The app must review executable skills before activation. */
export function stageSkills(snapshot, root) {
  validateSnapshot(snapshot);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error('Invalid staging root');
  const id = randomUUID(), temporary = join(root, `.${id}`), final = join(root, id);
  mkdirSync(temporary, { mode: 0o700 });
  try {
    snapshot.skills.forEach((skill, index) => {
      const folder = join(temporary, String(index));
      mkdirSync(folder, { mode: 0o700 });
      for (const file of skill.files) {
        const parts = file.path.split('/');
        mkdirSync(join(folder, ...parts.slice(0, -1)), { recursive: true, mode: 0o700 });
        writeFileSync(join(folder, ...parts), file.text, { mode: 0o600, flag: 'wx' });
      }
    });
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify({ version: 1, reviewRequired: true,
      skills: snapshot.skills.map(({ owner, name }, index) => ({ owner, name, folder: String(index) })) }), { mode: 0o600, flag: 'wx' });
    renameSync(temporary, final);
    return final;
  } catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
}
