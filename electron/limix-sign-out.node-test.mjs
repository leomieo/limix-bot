import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimixSignOutHandler } from './limix-sign-out.mjs';
test('does not sign out a changed account or an unconfirmed request', async () => {
  const handler = createLimixSignOutHandler({ info: () => ({ username: 'alice' }), signOut: () => { throw Error('must not run'); } });
  assert.equal(await handler('bob'), false);
  assert.equal(await handler(undefined), false);
});
test('serializes sign-out and restarts only once after completion', async () => {
  let release, calls = 0, restarts = 0;
  const handler = createLimixSignOutHandler({ info: () => ({ username: 'alice' }), signOut: () => { calls++; return new Promise(resolve => { release = resolve; }); }, relaunch: () => { restarts++; } });
  const first = handler('alice');
  assert.equal(await handler('alice'), false);
  assert.equal(restarts, 0); release();
  assert.equal(await first, true); assert.equal(calls, 1); assert.equal(restarts, 1);
});
