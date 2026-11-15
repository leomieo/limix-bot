import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { wakeProxy, workspaceFromHost } from './wake-proxy.mjs';
const id = '12345678-1234-4123-8123-123456789abc';
const host = 'lc-' + id.replaceAll('-', '') + '.fixture.invalid';
test('wake proxy validates tenant host and forwards the original request after wake', async () => {
    assert.equal(workspaceFromHost(host, 'fixture.invalid'), id);
    assert.equal(workspaceFromHost(host + '.evil', 'fixture.invalid'), null);
    let healthReads = 0, sends = 0;
    const backend = createServer((req, res) => {
        if (req.url === '/api/health') {
            res.writeHead(++healthReads === 1 ? 502 : 200);
            return res.end();
        }
        if (req.url === '/send') sends++;
        let text = ''; req.on('data', c => text += c); req.on('end', () => res.end(JSON.stringify({ host: req.headers.host, body: text }))); });
    await new Promise(r => backend.listen(0, '127.0.0.1', r));
    const wakes = [];
    const proxy = wakeProxy({ suffix: 'fixture.invalid', wake: async (...args) => { wakes.push(args); return true; }, dial: () => connect({ host: '127.0.0.1', port: backend.address().port }) });
    await new Promise(r => proxy.listen(0, '127.0.0.1', r));
    try {
        const url = 'http://127.0.0.1:' + proxy.address().port;
        const fetch = (url, options = {}) => new Promise((resolve, reject) => { const r = request(url, { method: options.method, headers: options.headers }, res => { let text = ''; res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode, json: () => JSON.parse(text) })); }); r.on('error', reject); r.end(options.body); });
        assert.equal((await fetch(url, { headers: { host: 'evil.invalid' } })).status, 404);
        assert.equal(wakes.length, 0);
        const reply = await fetch(url + '/send', { method: 'POST', headers: { host }, body: 'media-fixture' });
        assert.equal(reply.status, 200);
        assert.deepEqual(await reply.json(), { host, body: 'media-fixture' });
        assert.equal(sends, 1);
        assert.equal(healthReads, 2);
        assert.deepEqual(wakes[0], [id, true]);
        await fetch(url + '/api/cloud/power', { headers: { host } });
        assert.deepEqual(wakes[1], [id, false]);
    }
    finally {
        proxy.closeAllConnections();
        backend.closeAllConnections();
        await Promise.all([new Promise(r => proxy.close(r)), new Promise(r => backend.close(r))]);
    }
});
