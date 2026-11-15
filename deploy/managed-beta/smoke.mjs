import { createHmac, createHash, randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { wakeProxy } from './wake-proxy.mjs';
import { homeBootstrapSecret } from './host.mjs';
const file = fileURLToPath(new URL('./compose.yaml', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'limix-cloud-smoke-'));
const override = join(temp, 'ports.json');
writeFileSync(override, JSON.stringify({ services: { home: { ports: ['127.0.0.1::8080'] } } }));
const hostToken = randomUUID() + randomUUID();
const ids = [randomUUID(), randomUUID()];
const projects = ids.map(id => 'limix-fixture-' + id);
const origin = id => `https://lc-${id.replaceAll('-', '')}.fixture.invalid`;
function compose(i, ...args) {
    return execFileSync('docker', ['compose', '-f', file, '-f', override, '-p', projects[i], ...args], {
        encoding: 'utf8', windowsHide: true, timeout: 240000,
        env: { ...process.env, LIMIX_HOME_IMAGE: process.env.LIMIX_HOME_IMAGE || 'limix-managed-home:beta', LIMIX_HOME_ID: ids[i], LIMIX_HOME_ORIGIN: origin(ids[i]), LIMIX_HOME_SECRET: homeBootstrapSecret(hostToken, ids[i]) }
    }).trim();
}
function signed(i, method, path, body = '') {
    const timestamp = String(Math.floor(Date.now() / 1000)), nonce = randomUUID();
    const hash = createHash('sha256').update(body).digest('base64url');
    const signature = createHmac('sha256', homeBootstrapSecret(hostToken, ids[i])).update(`v1\n${timestamp}\n${nonce}\n${method}\n${path}\n${hash}`).digest('base64url');
    return { 'x-omb-cloud-timestamp': timestamp, 'x-omb-cloud-nonce': nonce, 'x-omb-cloud-signature': 'v1=' + signature };
}
function api(i, path, { body, token, signature } = {}) {
    const address = compose(i, 'port', 'home', '8080');
    assert.match(address, /^127\.0\.0\.1:\d+$/);
    return new Promise((resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port: Number(address.split(':')[1]), path, method: body === undefined ? 'GET' : 'POST', headers: { host: new URL(origin(ids[i])).host, 'x-forwarded-proto': 'https', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: 'Bearer ' + token } : {}), ...signature } }, res => {
            let text = '';
            res.on('data', c => text += c);
            res.on('end', () => { let value; try {
                value = JSON.parse(text);
            }
            catch {
                value = text;
            } resolve({ status: res.statusCode, body: value }); });
        });
        req.setTimeout(20000, () => req.destroy(new Error('fixture request timeout')));
        req.on('error', reject);
        req.end(body);
    });
}
const execute = (i, ...args) => compose(i, 'exec', '-T', 'home', ...args);
try {
    execFileSync('docker', ['network', 'inspect', 'limix-managed-edge'], { stdio: 'ignore', windowsHide: true });
}
catch {
    execFileSync('docker', ['network', 'create', 'limix-managed-edge'], { stdio: 'ignore', windowsHide: true });
}
try {
    for (let i = 0; i < 2; i++) {
        compose(i, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '180');
        const health = await api(i, '/api/health');
        assert.equal(health.status, 200);
        assert.equal(health.body.app, 'openmausbot');
        const logs = compose(i, 'logs', '--no-color', 'home');
        assert(!logs.includes('codeTrustProblem'));
        assert.match(logs, /limix gateway:/i);
        console.log(logs.split('\n').filter(line => /hidepid|bot.box|userns/.test(line)).join('\n'));
        assert.equal(JSON.parse(execute(i, 'curl', '-fsS', 'http://127.0.0.1:8790/healthz')).app, 'limix-bot');
        console.log('PASS home', i, 'health, launcher, gateway; engines:', execute(i, 'codex', '--version'), execute(i, 'claude', '--version'));
    }
    const body = JSON.stringify({ label: 'Cloud isolation fixture', ttlSeconds: 300 });
    const cross = await api(1, '/api/cloud/pairing', { body, signature: signed(0, 'POST', '/api/cloud/pairing', body) });
    assert([401, 403].includes(cross.status), 'B rejects A signature');
    const issuedB = await api(1, '/api/cloud/pairing', { body, signature: signed(1, 'POST', '/api/cloud/pairing', body) });
    assert.equal(issuedB.status, 200);
    const issued = await api(0, '/api/cloud/pairing', { body, signature: signed(0, 'POST', '/api/cloud/pairing', body) });
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    const pairBody = JSON.stringify({ code: issued.body.code, label: 'fixture A' });
    assert([400, 401, 403, 404].includes((await api(1, '/api/auth/pair', { body: pairBody })).status), 'B rejects A code');
    const paired = await api(0, '/api/auth/pair', { body: pairBody });
    assert.equal(paired.status, 200);
    const token = paired.body.token;
    assert.equal(typeof token, 'string');
    assert.equal((await api(0, '/api/bots', { token })).status, 200);
    assert([401, 403].includes((await api(1, '/api/bots', { token })).status), 'B rejects A session');
    const fakeKey = 'fixture-' + randomUUID();
    const created = await api(0, '/api/instances/openai-compat', { token, body: JSON.stringify({ displayName: 'Isolation fixture', url: 'https://example.invalid/v1', models: ['fixture'], key: fakeKey }) });
    assert.equal(created.status, 201);
    assert(!JSON.stringify(created.body).includes(fakeKey));
    const instance = created.body.instanceId;
    assert.match(instance, /^openai-compat-/);
    const verify = `const fs=require('node:fs');const p='/data/.openmausbot/config.json';const cfg=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{};process.exit(cfg.instances?.[process.argv[1]]?.config?.key===process.argv[2]?0:1)`;
    execute(1, 'node', '-e', verify, instance);
    execute(0, 'sh', '-ec', 'mkdir -p /data/.codex; echo fixture > /data/.codex/limix-isolation-test');
    execute(1, 'sh', '-ec', 'test ! -e /data/.codex/limix-isolation-test');
    compose(0, 'up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '180');
    assert.equal(execute(0, 'cat', '/data/.codex/limix-isolation-test'), 'fixture');
    execute(0, 'node', '-e', verify, instance, fakeKey);
    assert.equal((await api(0, '/api/bots', { token })).status, 200);
    console.log('PASS: cross-home HMAC, pairing-code and session rejection; API-key and Codex HOME isolation; key, HOME and session survive recreation');
    if (process.env.LIMIX_SMOKE_POWER === '1') {
        process.env.LIMIX_HOME_GATEWAY = '0';
        compose(0, 'up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '180');
        for (let step = 0; step < 5; step++) {
            console.log('Power smoke: waiting for real idle guard', step + 1, '/5');
            await delay(26000);
        }
        const path = '/api/cloud/power?idleMinutes=1';
        const power = await api(0, path, {signature: signed(0, 'GET', path)});
        assert.equal(power.body.idle, true, JSON.stringify(power.body));
        const sleepBody = JSON.stringify({v: 1, idleMinutes: 1});
        const prepared = await api(0, '/api/cloud/power/sleep', {body: sleepBody, signature: signed(0, 'POST', '/api/cloud/power/sleep', sleepBody)});
        assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
        assert.equal(prepared.body.ok, true);
        compose(0, 'stop', 'home');
        let woke = false;
        const proxy = wakeProxy({suffix: 'fixture.invalid', wake: async id => {
            assert.equal(id, ids[0]);
            if (!woke) { compose(0, 'start', 'home'); woke = true; }
            return true;
        }, dial: () => connect({host: '127.0.0.1', port: Number(compose(0, 'port', 'home', '8080').split(':')[1])})});
        await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
        try {
            const status = await new Promise((resolve, reject) => {
                const req = request({hostname: '127.0.0.1', port: proxy.address().port, path: '/api/health', headers: {host: new URL(origin(ids[0])).host}}, res => {
                    res.resume();res.on('end', () => resolve(res.statusCode));
                });req.on('error', reject);req.end();
            });
            assert.equal(status, 200);assert.equal(woke, true);
            console.log('PASS: real signed idle read/sleep handshake, Docker stop, incoming HTTP wakes and reaches the real home');
        } finally {proxy.closeAllConnections();await new Promise(resolve => proxy.close(resolve));}
    }

}
finally {
    for (let i = 0; i < 2; i++) {
        try {
            compose(i, 'down', '-v');
        }
        catch {
            console.error('Fixture cleanup failed:', projects[i]);
        }
    }
    rmSync(temp, { recursive: true, force: true });
}
