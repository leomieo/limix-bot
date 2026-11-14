import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encodeSnapshot, decodeSnapshot, skillPath } from './protocol.mjs';
import { createAccountSnapshotStore } from './store.mjs';
import { createAccountSyncHandler } from './service.mjs';
import { createAccountSyncClient } from './client.mjs';
import { captureSkill, stageSkills } from './skills.mjs';

const snapshot = () => ({ format: 'limix.account-sync', version: 1, team: { bots: [{ name: 'Khách hàng', memory: 'Ghi nhớ' }] }, skills: [{ owner: 'library', name: 'example', files: [{ path: 'SKILL.md', text: 'Instructions' }] }] });
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'limix-account-sync-'));
  const file = join(directory, 'sync.db'), store = createAccountSnapshotStore(file, randomBytes(32));
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const handler = createAccountSyncHandler({ enabled: true, store, authenticate: async req => ({ 'Bearer alice': 'account-1', 'Bearer bob': 'account-2' })[req.headers.get('authorization')], validateTeam: team => { assert.ok(Array.isArray(team.bots)); } });
  return { directory, file, store, handler };
}
const endpoint = 'https://fixture.invalid/api/limixbot/data/snapshot';

test('compressed portable snapshot round trip', () => assert.deepEqual(decodeSnapshot(encodeSnapshot(snapshot())), snapshot()));
test('reject traversal, media, secret paths and Windows collisions', () => {
  for (const path of ['../SKILL.md', '/SKILL.md', '.env', 'tokens.json', 'node_modules/a.js', 'image.png', 'CON.md', 'a\\b.md']) assert.equal(skillPath(path), false, path);
  const value = snapshot(); value.skills[0].files.push({ path: 'skill.md', text: 'duplicate' });
  assert.throws(() => encodeSnapshot(value), /Invalid skill file/);
});
test('hidden service does not authenticate or touch storage', async () => {
  const handler = createAccountSyncHandler({ authenticate: () => { throw Error('must not run'); } });
  assert.equal((await handler(new Request(endpoint))).status, 404);
});
test('hidden client never reads the session or calls network', async () => {
  const client = createAccountSyncClient({ session: () => { throw Error('must not run'); } });
  assert.deepEqual(await client.sync(), { status: 'hidden' });
});
test('store isolates accounts, encrypts content and refuses stale revisions', t => {
  const { store, file } = fixture(t), bytes = encodeSnapshot(snapshot());
  store.put('alice', 0, bytes);
  assert.equal(store.latest('bob'), null);
  assert.deepEqual(store.latest('alice').bytes, bytes);
  assert.throws(() => store.put('alice', 0, bytes), /conflict/);
  assert.equal(readFileSync(file + '-wal').includes(bytes), false);
  for (let i = 1; i <= 8; i++) store.put('alice', i, bytes);
  assert.equal(store.latest('alice').revision, 9);
});
test('service requires authentication and revision before upload', async t => {
  const { handler } = fixture(t);
  assert.equal((await handler(new Request(endpoint))).status, 401);
  assert.equal((await handler(new Request(endpoint, { method: 'PUT', headers: { authorization: 'Bearer alice' } }))).status, 428);
});
test('two computers upload and restore using authenticated service and real encrypted database', async t => {
  const { handler } = fixture(t);
  let restored;
  const states = new Map();
  const options = { enabled: true, endpoint, session: async () => ({ accountId: 'account-1', authorization: 'Bearer alice' }),
    state: { read: async id => states.get(id), write: async (id, value) => states.set(id, value) },
    capture: async () => snapshot(), restore: async data => { restored = data; },
    fetcher: async (url, init) => handler(new Request(url, init)) };
  const pc1 = createAccountSyncClient({ ...options, isEmpty: async () => false });
  assert.equal((await pc1.sync()).status, 'uploaded');
  const pc2 = createAccountSyncClient({ ...options, isEmpty: async () => true });
  assert.equal((await pc2.sync()).status, 'restored');
  assert.deepEqual(restored, snapshot());
  const stale = createAccountSyncClient({ ...options, isEmpty: async () => false, state: { read: async () => ({ revision: 0 }), write: async () => { throw Error('conflict must not write'); } } });
  assert.equal((await stale.sync()).status, 'conflict');
});
test('account switch during download cannot restore another account', async t => {
  const { handler, store } = fixture(t); store.put('account-1', 0, encodeSnapshot(snapshot()));
  let count = 0;
  const client = createAccountSyncClient({ enabled: true, endpoint, session: async () => ({ accountId: ++count === 1 ? 'account-1' : 'account-2', authorization: 'Bearer alice' }),
    state: { read: async () => null }, isEmpty: async () => true, restore: () => { throw Error('must not restore'); }, fetcher: async (url, init) => handler(new Request(url, init)) });
  await assert.rejects(client.sync(), /Account changed/);
});
test('captures installed skill source, excludes media/dependencies and stages for review', t => {
  const { directory } = fixture(t), root = join(directory, 'skill'); mkdirSync(root);
  writeFileSync(join(root, 'SKILL.md'), 'private-value'); writeFileSync(join(root, 'video.mp4'), 'media');
  mkdirSync(join(root, 'node_modules')); writeFileSync(join(root, 'node_modules', 'a.js'), 'dependency');
  const skill = captureSkill({ owner: 'library', name: 'example', directory: root }, text => text.replace('private-value', '[redacted]'));
  assert.equal(skill.files.length, 1); assert.equal(skill.files[0].text, '[redacted]');
  const value = snapshot(); value.skills = [skill]; const staged = stageSkills(value, join(directory, 'quarantine'));
  assert.ok(JSON.parse(readFileSync(join(staged, 'manifest.json'))).reviewRequired);
  assert.equal(readdirSync(join(staged, '0')).length, 1);
});
