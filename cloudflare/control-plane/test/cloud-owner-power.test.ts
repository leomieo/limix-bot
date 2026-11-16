import { env } from 'cloudflare:workers';
import { afterEach, expect, it, vi } from 'vitest';
import { cloudOwnerRoute } from '../src/cloud-owner';
import { sampleHomePower, wakeHome } from '../src/cloud-power-admin';
import { cloudSummary } from '../src/limix-cloud-admin';
const bindings = { ...env, LIMIX_ACCOUNT_URL: 'https://accounts.test', LIMIX_BETA_HOST_TOKEN: 'fixture-host-token-'.repeat(3) };
function request(name: string, body?: object) { return new Request('https://cloud.test/api/cloud/owner/decision', { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer limix.' + btoa('one') + '.token-' + name, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
afterEach(async () => { vi.restoreAllMocks(); await env.DB.batch(['managed_cloud_beta', 'limix_cloud_requests', 'limix_cloud_devices'].map(t => env.DB.prepare(`DELETE FROM ${t}`))); });
it('owner authorization, approval, rejection and revocation are enforced server-side', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => Response.json({ valid: true, username: JSON.parse(String(init?.body)).token.slice(6) }));
    await env.DB.prepare("INSERT INTO limix_cloud_requests(principal,requested_at) VALUES ('limix:alice',1)").run();
    await expect(cloudOwnerRoute('/api/cloud/owner/requests', request('alice'), bindings)).rejects.toMatchObject({ status: 403 });
    await expect(cloudOwnerRoute('/api/cloud/owner/requests', request('tqtuan'), bindings)).rejects.toMatchObject({ status: 403 });
    const action = (decision: string) => cloudOwnerRoute('/api/cloud/owner/decision', request('Leox', { principal: 'limix:alice', decision }), bindings);
    expect((await action('approve')).status).toBe(200);
    expect(await env.DB.prepare("SELECT principal FROM managed_cloud_beta WHERE principal='limix:alice'").first()).toBeTruthy();
    expect((await action('approve')).status).toBe(200);
    const listed = await cloudOwnerRoute('/api/cloud/owner/requests', request('Leox'), bindings);
    expect(await listed.json()).toMatchObject({ requests: [{ principal: 'limix:alice', decision: 'approved' }] });
    await action('revoke');
    expect(await env.DB.prepare('SELECT principal FROM managed_cloud_beta').first()).toBeNull();
    expect(await env.DB.prepare('SELECT decision FROM limix_cloud_requests').first()).toEqual({ decision: 'declined' });
    await action('approve');
    await action('decline');
    expect(await env.DB.prepare('SELECT principal FROM managed_cloud_beta').first()).toBeNull();
});
it('sleep requires an idle signed read and accepted handshake; gateway blocks sleep; due work wakes early', async () => {
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO managed_cloud_beta(principal,workspace_id,runtime_state,sleep_enabled,sleep_blocked,requested_at) VALUES ('limix:a',?,'running',1,0,'fixture')").bind(id).run();
    const row = () => env.DB.prepare('SELECT workspace_id AS id, * FROM managed_cloud_beta').first<any>();
    const fetcher = vi.fn(async (input: any, init: any) => {
        expect(init.headers['x-omb-cloud-signature']).toMatch(/^v1=/);
        return Response.json(String(input).endsWith('/sleep') ? { ok: true, nextDueAt: Date.now() + 600000 } : { v: 1, idle: true });
    });
    await sampleHomePower(bindings, { ...await row(), sleep_blocked: 1 }, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    await sampleHomePower(bindings, await row(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await row()).power_desired).toBe('asleep');
    expect(cloudSummary({ ...await row(), power_observed: 'asleep' }, 'https://fixture', true).power).toMatchObject({ state: 'asleep' });
    await sampleHomePower(bindings, { ...await row(), next_due_at: Date.now() + 10000 }, fetcher);
    expect((await row()).power_desired).toBe('awake');
    const refused = vi.fn(async () => Response.json({ error: 'busy' }, { status: 409 }));
    await sampleHomePower(bindings, await row(), refused);
    expect((await row()).power_desired).toBe('awake');
    await wakeHome(bindings, id);
    expect((await row()).power_desired).toBe('awake');
});
it('concurrent customer activity cancels the pending sleep decision', async () => {
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO managed_cloud_beta(principal,workspace_id,runtime_state,sleep_enabled,sleep_blocked,requested_at) VALUES ('limix:a',?,'running',1,0,'fixture')").bind(id).run();
    const row = await env.DB.prepare('SELECT workspace_id AS id, * FROM managed_cloud_beta').first<any>();
    await sampleHomePower(bindings, row, async (input: any) => { if (String(input).endsWith('/sleep')) {
        await wakeHome(bindings, id);
        return Response.json({ ok: true, nextDueAt: null });
    } return Response.json({ v: 1, idle: true }); });
    expect(await env.DB.prepare('SELECT power_desired FROM managed_cloud_beta').first()).toEqual({ power_desired: 'awake' });
});

it('owner page contains no account data and unauthenticated APIs are refused',async()=>{
  const response=await cloudOwnerRoute('/cloud-admin',new Request('https://cloud.test/cloud-admin'),bindings);
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  const html = await response.text();
  expect(html).not.toContain('id="token"');
  expect(html).toContain("history.replaceState");
  expect(html).toContain("location.replace('https://admin.limixmedia.com/#cloud')");
  expect(html).not.toContain("get('session')");
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  await expect(cloudOwnerRoute('/api/cloud/owner/requests',new Request('https://cloud.test/api/cloud/owner/requests'),bindings)).rejects.toMatchObject({status:401});
});
