import { MAX_WIRE_BYTES, decodeSnapshot } from './protocol.mjs';

/** `authenticate` must validate a live Limix machine session and return its stable account ID, never a client-supplied username. */
export function createAccountSyncHandler({ enabled = false, authenticate, store, validateTeam }) {
  return async request => {
    const json = (status, value) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
    if (!enabled) return json(404, { error: 'not_found' });
    if (new URL(request.url).pathname !== '/api/limixbot/data/snapshot') return json(404, { error: 'not_found' });
    try {
      const account = await authenticate(request);
      if (!account) return json(401, { error: 'signed_out' });
      if (request.method === 'GET') {
        const value = store.latest(account);
        if (!value) return json(404, { error: 'no_snapshot' });
        return new Response(value.bytes, { headers: { 'content-type': 'application/gzip', 'cache-control': 'no-store', etag: `"${value.revision}"` } });
      }
      if (request.method !== 'PUT') return json(405, { error: 'method_not_allowed' });
      const match = /^"(0|[1-9][0-9]{0,14})"$/.exec(request.headers.get('if-match') ?? '');
      if (!match) return json(428, { error: 'revision_required' });
      if (Number(request.headers.get('content-length')) > MAX_WIRE_BYTES) return json(413, { error: 'quota_exceeded' });
      const reader = request.body?.getReader();
      if (!reader) return json(400, { error: 'empty_body' });
      const chunks = []; let size = 0;
      try {
        for (;;) {
          const next = await reader.read(); if (next.done) break;
          size += next.value.byteLength;
          if (size > MAX_WIRE_BYTES) { await reader.cancel(); return json(413, { error: 'quota_exceeded' }); }
          chunks.push(Buffer.from(next.value));
        }
      } finally { reader.releaseLock(); }
      const bytes = Buffer.concat(chunks), snapshot = decodeSnapshot(bytes);
      validateTeam(snapshot.team);
      return json(200, store.put(account, Number(match[1]), bytes));
    } catch (error) {
      return json(error.status === 409 ? 409 : 400, { error: error.status === 409 ? 'snapshot_conflict' : 'snapshot_rejected' });
    }
  };
}
