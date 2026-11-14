import { encodeSnapshot, decodeSnapshot, MAX_WIRE_BYTES } from './protocol.mjs';

/** The host supplies account-scoped durable state and serialized capture/restore adapters. Hidden builds never call the network. */
export function createAccountSyncClient({ enabled = false, endpoint, session, state, capture, restore, isEmpty, fetcher = fetch }) {
  let queue = Promise.resolve();
  const serial = operation => {
    const work = queue.then(operation); queue = work.catch(() => {}); return work;
  };
  return {
    sync() { return serial(async () => {
      if (!enabled) return { status: 'hidden' };
      if (!endpoint?.startsWith('https://')) throw new Error('HTTPS sync endpoint required');
      const identity = await session();
      if (!identity?.accountId || !identity.authorization) return { status: 'signed_out' };
      const account = identity.accountId;
      const headers = { authorization: identity.authorization };
      const previous = await state.read(account) ?? { revision: 0 };
      const signal = AbortSignal.timeout(60000);
      if (await isEmpty()) {
        const response = await fetcher(endpoint, { headers, signal, redirect: 'error' });
        if (response.status === 404) return { status: 'empty' };
        if (!response.ok) throw new Error(`Sync download failed (${response.status})`);
        const revision = Number(/^"([1-9][0-9]*)"$/.exec(response.headers.get('etag') ?? '')?.[1]);
        if (!Number.isSafeInteger(revision)) throw new Error('Invalid remote revision');
        const reader = response.body.getReader(), chunks = []; let total = 0;
        try {
          for (;;) {
            const next = await reader.read(); if (next.done) break;
            total += next.value.byteLength;
            if (total > MAX_WIRE_BYTES) { await reader.cancel(); throw new Error('Download quota exceeded'); }
            chunks.push(Buffer.from(next.value));
          }
        } finally { reader.releaseLock(); }
        const snapshot = decodeSnapshot(Buffer.concat(chunks));
        if ((await session())?.accountId !== account) throw new Error('Account changed during sync');
        await restore(snapshot);
        await state.write(account, { revision, lastSyncAt: Date.now() });
        return { status: 'restored', revision };
      }
      const bytes = encodeSnapshot(await capture());
      if ((await session())?.accountId !== account) throw new Error('Account changed during sync');
      const response = await fetcher(endpoint, { method: 'PUT', headers: { ...headers, 'if-match': `"${previous.revision}"`, 'content-type': 'application/gzip' }, body: bytes, signal, redirect: 'error' });
      if (response.status === 409) return { status: 'conflict' };
      if (!response.ok) throw new Error(`Sync upload failed (${response.status})`);
      const result = await response.json();
      if (!Number.isSafeInteger(result.revision) || result.revision !== previous.revision + 1) throw new Error('Invalid upload receipt');
      await state.write(account, { revision: result.revision, lastSyncAt: Date.now() });
      return { status: 'uploaded', revision: result.revision };
    }); },
  };
}
