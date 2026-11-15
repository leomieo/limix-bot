import { homeBootstrapSecret, homeRequestHeaders } from './limix-cloud-admin';
import { managedHostToken } from './managed-host';
import { managedHomeOrigin } from './managed-grant';
import { readConfig } from './config';
import { HTTPError, json, readOptionalBoundedJSON } from './http';
export interface PowerRow {
    id: string;
    power_desired: string;
    power_since: number;
    power_revision: number;
    next_due_at: number | null;
    sleep_enabled: number;
    sleep_blocked: number;
    runtime_state: string | null;
}
export async function wakeHome(env: Env, id: string) {
    await env.DB.prepare("UPDATE managed_cloud_beta SET power_desired = 'awake', power_since = CASE WHEN power_desired = 'asleep' THEN ? ELSE power_since END, power_revision = power_revision + 1 WHERE workspace_id = ?").bind(Date.now(), id).run();
}
export async function wakeHostRequest(request: Request, env: Env) {
    const input = await readOptionalBoundedJSON(request) as {
        id?: unknown;
        wake?: unknown;
    } | undefined;
    if (typeof input?.id !== 'string')
        throw new HTTPError(400, 'invalid_request');
    const row = await env.DB.prepare('SELECT workspace_id FROM managed_cloud_beta WHERE workspace_id = ?').bind(input.id).first();
    if (!row)
        throw new HTTPError(404, 'not_found');
    if (input.wake !== false)
        await wakeHome(env, input.id);
    return json({ ok: true });
}
export async function sampleHomePower(env: Env, row: PowerRow, fetcher: typeof fetch = fetch): Promise<void> {
    if (row.power_desired === 'asleep') {
        if (!row.sleep_enabled || row.sleep_blocked || (row.next_due_at !== null && row.next_due_at <= Date.now() + 180000))
            await wakeHome(env, row.id);
        return;
    }
    if (!row.sleep_enabled || row.sleep_blocked || row.runtime_state !== 'running')
        return;
    const origin = managedHomeOrigin(row.id, readConfig(env).cloudflare.companionHostSuffix);
    const secret = await homeBootstrapSecret(managedHostToken(env), row.id);
    const call = async (path: string, body?: string) => fetcher(origin + path, { method: body ? 'POST' : 'GET', body, redirect: 'manual', headers: { 'content-type': 'application/json', ...await homeRequestHeaders(secret, body ? 'POST' : 'GET', path, body ?? '') }, signal: AbortSignal.timeout(5000) });
    try {
        const response = await call('/api/cloud/power');
        if (!response.ok)
            return;
        const power = await response.json() as {
            v?: number;
            idle?: boolean;
        };
        if (power.v !== 1 || power.idle !== true)
            return;
        const prepared = await call('/api/cloud/power/sleep', JSON.stringify({ v: 1, idleMinutes: 10 }));
        if (!prepared.ok)
            return;
        const result = await prepared.json() as {
            ok?: boolean;
            nextDueAt?: unknown;
        };
        if (result.ok !== true || !(result.nextDueAt === null || Number.isSafeInteger(result.nextDueAt)))
            return;
        if (typeof result.nextDueAt === 'number' && result.nextDueAt <= Date.now() + 180000)
            return;
        await env.DB.prepare("UPDATE managed_cloud_beta SET power_desired='asleep', power_since=?, next_due_at=? WHERE workspace_id=? AND power_desired='awake' AND power_revision=? AND sleep_enabled=1 AND sleep_blocked=0")
            .bind(Date.now(), result.nextDueAt, row.id, row.power_revision).run();
    }
    catch { /* A failed probe must never stop a home. */ }
}
