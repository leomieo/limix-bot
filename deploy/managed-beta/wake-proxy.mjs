import { Agent, createServer, request } from 'node:http';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
export function workspaceFromHost(host, suffix) {
    const match = /^lc-([a-f0-9]{32})\.(.+)$/.exec(host ?? '');
    if (!match || match[2] !== suffix)
        return null;
    const h = match[1], id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id) ? id : null;
}
function ready(id, host, dial) {
    const agent = new Agent();
    agent.createConnection = () => dial(id);
    return new Promise((resolve, reject) => {
        const probe = request({ host, headers: { host }, path: '/api/health', agent, signal: AbortSignal.timeout(3000) }, response => {
            response.resume();
            response.on('error', reject);
            response.on('end', () => response.statusCode === 200 ? resolve() : reject(new Error('Home is starting')));
        });
        probe.on('error', reject);
        probe.on('close', () => agent.destroy());
        probe.end();
    });
}
export function wakeProxy({ suffix, wake, dial = id => connect({ host: 'home-' + id, port: 8080 }) }) {
    async function forward(req, res, head) {
        req.pause();
        const id = workspaceFromHost(req.headers.host, suffix);
        const fail = code => { if (res.writeHead) {
            res.writeHead(code, { 'retry-after': '5' });
            res.end();
        }
        else
            res.end(`HTTP/1.1 ${code} Unavailable\r\nConnection: close\r\n\r\n`); };
        if (!id)
            return fail(404);
        try {
            if (!await wake(id, !/^\/api\/cloud\/power(?:\?|$|\/sleep$)/.test(req.url)))
                return fail(404);
        }
        catch {
            return fail(503);
        }
        let socket;
        const until = Date.now() + 90000;
        while (Date.now() < until && !req.destroyed && !res.destroyed) {
            try {
                await ready(id, req.headers.host, dial);
                socket = await new Promise((resolve, reject) => { const s = dial(id); s.setTimeout(3000, () => s.destroy(new Error('timeout'))); s.once('connect', () => { s.setTimeout(0); resolve(s); }); s.once('error', reject); });
                break;
            }
            catch {
                await delay(1000);
            }
        }
        if (!socket)
            return fail(503);
        if (res.destroyed) {
            socket.destroy();
            return;
        }
        const agent = new Agent();
        agent.createConnection = () => socket;
        const upstream = request({ host: 'home-' + id, port: 8080, path: req.url, method: req.method, headers: req.headers, agent }, reply => {
            if (head) {
                reply.resume();
                return fail(reply.statusCode);
            }
            res.writeHead(reply.statusCode, reply.headers);
            reply.pipe(res);
            reply.on('error', () => res.destroy());
        });
        upstream.on('upgrade', (reply, peer, extra) => {
            res.write(`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n` + Object.entries(reply.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
            if (extra.length)
                res.write(extra);
            if (head?.length)
                peer.write(head);
            peer.pipe(res).pipe(peer);
            peer.on('error', () => res.destroy());
            res.on('error', () => peer.destroy());
        });
        upstream.on('error', () => fail(502));
        res.on('close', () => upstream.destroy());
        if (head)
            upstream.end();
        else {
            req.pipe(upstream);
            req.resume();
        }
    }
    const server = createServer((req, res) => { void forward(req, res); });
    server.on('upgrade', (req, socket, head) => { void forward(req, socket, head); });
    server.maxConnections = 256;
    return server;
}
if (import.meta.main) {
    const token = process.env.LIMIX_WAKE_HOST_TOKEN, suffix = process.env.LIMIX_WAKE_SUFFIX;
    if (!token || !suffix)
        throw new Error('Missing wake proxy configuration');
    wakeProxy({ suffix, wake: async (id, shouldWake) => {
            const response = await fetch('https://accounts.limixmedia.com/v1/managed-cloud/host/assignments?wake=1', { method: 'POST', redirect: 'error', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ id, wake: shouldWake }), signal: AbortSignal.timeout(10000) });
            if (response.status === 404)
                return false;
            if (!response.ok)
                throw new Error('Wake unavailable');
            return true;
        } }).listen(8080, '0.0.0.0');
}
