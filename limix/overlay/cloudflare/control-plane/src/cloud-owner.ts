import { HTTPError, json, readOptionalBoundedJSON, type JSONValue } from './http';
import { limixSession } from './limix-auth';
const OWNER = 'limix:leox';
export async function cloudOwnerRoute(path: string, request: Request, env: Env): Promise<Response> {
    if (path === '/cloud-admin' && request.method === 'GET')
        return ownerPage();
    const session = await limixSession(request, env);
    if (!session)
        throw new HTTPError(401, 'unauthorized');
    if (session.user.id !== OWNER)
        throw new HTTPError(403, 'forbidden');
    if (path === '/api/cloud/owner/resources') {
        if (request.method === 'GET') {
            const { results } = await env.DB.prepare('SELECT principal,cpus,memory_gb,updated_at FROM limix_cloud_resource_overrides ORDER BY principal').all<Record<string, JSONValue>>();
            return json({ overrides: results });
        }
        if (request.method !== 'POST') throw new HTTPError(405, 'method_not_allowed');
        const input = await readOptionalBoundedJSON(request) as {principal?:unknown;cpus?:unknown;memory_gb?:unknown;reset?:unknown} | undefined;
        if (typeof input?.principal !== 'string' || !/^limix:[a-z0-9._-]{1,64}$/.test(input.principal)) throw new HTTPError(400,'invalid_request');
        if (!(await env.DB.prepare('SELECT 1 FROM managed_cloud_beta WHERE principal=?').bind(input.principal).first())) throw new HTTPError(404,'not_enrolled');
        if (input.reset === true) {
            await env.DB.prepare('DELETE FROM limix_cloud_resource_overrides WHERE principal=?').bind(input.principal).run();
        } else {
            if (!Number.isInteger(input.cpus) || Number(input.cpus)<1 || Number(input.cpus)>16 || !Number.isInteger(input.memory_gb) || Number(input.memory_gb)<2 || Number(input.memory_gb)>32) throw new HTTPError(400,'invalid_resources');
            await env.DB.prepare('INSERT INTO limix_cloud_resource_overrides(principal,cpus,memory_gb,updated_at) VALUES (?,?,?,?) ON CONFLICT(principal) DO UPDATE SET cpus=excluded.cpus,memory_gb=excluded.memory_gb,updated_at=excluded.updated_at').bind(input.principal,Number(input.cpus),Number(input.memory_gb),Date.now()).run();
        }
        return json({ok:true,applies:'next_host_reconciliation'});
    }
    if (path === '/api/cloud/owner/requests' && request.method === 'GET') {
        const { results } = await env.DB.prepare(`SELECT r.principal, r.requested_at, r.decision, r.decided_at,
      b.workspace_id, b.runtime_state FROM limix_cloud_requests r LEFT JOIN managed_cloud_beta b ON b.principal=r.principal
      ORDER BY r.decision IS NOT NULL, r.requested_at LIMIT 1000`).all<Record<string, JSONValue>>();
        return json({ requests: results });
    }
    if (path !== '/api/cloud/owner/decision' || request.method !== 'POST')
        throw new HTTPError(404, 'not_found');
    const input = await readOptionalBoundedJSON(request) as {
        principal?: unknown;
        decision?: unknown;
    } | undefined;
    if (typeof input?.principal !== 'string' || !/^limix:[A-Za-z0-9_.@-]{1,100}$/.test(input.principal) ||
        (typeof input.decision !== 'string' || !['approve', 'decline', 'revoke'].includes(input.decision)))
        throw new HTTPError(400, 'invalid_request');
    const principal = input.principal;
    if (!(await env.DB.prepare('SELECT principal FROM limix_cloud_requests WHERE principal = ?').bind(principal).first()))
        throw new HTTPError(404, 'not_found');
    const approved = input.decision === 'approve';
    await env.DB.batch([
        approved ? env.DB.prepare('INSERT INTO managed_cloud_beta(principal) VALUES (?) ON CONFLICT(principal) DO NOTHING').bind(principal)
            : env.DB.prepare('DELETE FROM managed_cloud_beta WHERE principal = ?').bind(principal),
        env.DB.prepare('UPDATE limix_cloud_requests SET decision = ?, decided_at = ? WHERE principal = ?').bind(approved ? 'approved' : 'declined', Date.now(), principal),
        ...(!approved ? [env.DB.prepare('UPDATE limix_cloud_devices SET revoked_at = ? WHERE principal = ? AND revoked_at IS NULL').bind(Date.now(), principal)] : []),
    ]);
    return json({ ok: true });
}
function ownerPage(): Response {
    const nonce = crypto.randomUUID();
    return new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quản trị Limix</title>
    <h1>Trung tâm quản trị Limix</h1><p>Quản lý tài khoản và Cloud tại <a href="https://admin.limixmedia.com/#cloud">admin.limixmedia.com</a>. Đăng nhập bằng tài khoản quản trị được cấp quyền.</p>
    <script nonce="${nonce}">history.replaceState(null,'',location.pathname);location.replace('https://admin.limixmedia.com/#cloud');</script></html>`, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
            'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` },
    });
}
