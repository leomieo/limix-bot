import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const MAX_BYTES = 64 * 1024 * 1024;
export const MAX_WIRE_BYTES = MAX_BYTES + 65536;
const EXTENSIONS = /\.(?:md|json|txt|py|js|mjs|cjs|ts|tsx|jsx|yaml|yml|toml|sh|ps1|css|html)$/i;
const PRIVATE = /(?:^|\/)(?:\.env(?:\..*)?|node_modules|\.git|\.venv|venv|__pycache__|\.cache|\.limixbot-secrets|credentials?|secrets?|tokens?)(?:\/|\.|$)/i;

/** Portable skill files are relative UTF-8 source files; binaries, environment secrets and installed dependencies stay local. */
export function skillPath(value) {
  return typeof value === 'string' && value.length <= 500 && value === value.normalize('NFC')
    && !/[\\:\x00-\x1f<>"|?*]/.test(value) && !PRIVATE.test(value) && EXTENSIONS.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part)
      && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part));
}

export function validateSnapshot(value) {
  if (!value || value.format !== 'limix.account-sync' || value.version !== 1 || !value.team
    || !Array.isArray(value.skills) || value.skills.length > 10000) throw new Error('Invalid account snapshot');
  const seen = new Set();
  for (const skill of value.skills) {
    if (!skill || typeof skill.owner !== 'string' || !/^(?:library|bot:[\w-]{1,200})$/.test(skill.owner)
      || typeof skill.name !== 'string' || !/^[a-z0-9][a-z0-9-]{0,100}$/.test(skill.name)
      || !Array.isArray(skill.files) || skill.files.length > 1000) throw new Error('Invalid skill');
    const identity = `${skill.owner}/${skill.name}`;
    if (seen.has(identity)) throw new Error('Duplicate skill');
    seen.add(identity);
    const paths = new Set();
    for (const file of skill.files) {
      if (!skillPath(file.path) || typeof file.text !== 'string' || file.text.includes('\0')
        || Buffer.byteLength(file.text) > 2 * 1024 * 1024 || paths.has(file.path.toLowerCase())) throw new Error('Invalid skill file');
      paths.add(file.path.toLowerCase());
    }
    if (!paths.has('skill.md')) throw new Error('Missing SKILL.md');
  }
  return value;
}

export function encodeSnapshot(value) {
  const bytes = Buffer.from(JSON.stringify(validateSnapshot(value)));
  if (bytes.length > MAX_BYTES) throw new Error('Snapshot quota exceeded');
  return gzipSync(bytes);
}

export function decodeSnapshot(bytes) {
  if (bytes.length > MAX_WIRE_BYTES) throw new Error('Snapshot quota exceeded');
  return validateSnapshot(JSON.parse(gunzipSync(bytes, { maxOutputLength: MAX_BYTES }).toString('utf8')));
}

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
