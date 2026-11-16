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
    return new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Limix Cloud — Duyệt dùng thử</title>
  <style nonce="${nonce}">body{background:#111;color:#eee;font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px}button,input{font:inherit;padding:10px;background:#222;color:#eee;border:1px solid #555;border-radius:8px;margin:4px}article{border-bottom:1px solid #444;padding:16px}#requests{overflow-wrap:anywhere}</style>
  <h1>Limix Cloud · Duyệt dùng thử</h1><p>Chỉ tài khoản chủ dự án được quản lý yêu cầu. Đăng nhập Leox trong Limix Bot → Cài đặt → Limix Bot Cloud → Quản trị Limix Cloud. Đóng hoặc tải lại trang sẽ kết thúc phiên.</p>
  <button id="logout" hidden>Đăng xuất</button><p id="status" role="status"></p><section id="requests"></section>
  <script nonce="${nonce}">
  let bearer='';const status=document.getElementById('status'),list=document.getElementById('requests');
  async function api(path,body){const response=await fetch('/api/cloud/owner/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+bearer,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(!response.ok){const failure=await response.json().catch(()=>({}));if(failure.error==='origin_not_allowed')throw new Error('Địa chỉ trang quản trị chưa được máy chủ cho phép. Vui lòng liên hệ quản trị hệ thống.');throw new Error(response.status===403?'Tài khoản không có quyền quản trị.':response.status===401?'Phiên đăng nhập không hợp lệ.':'Không thực hiện được yêu cầu ('+response.status+').')}return response.json()}
  async function load(){list.replaceChildren();const data=await api('requests');for(const row of data.requests){const card=document.createElement('article'),label=document.createElement('p');label.textContent=row.principal+' · '+(row.decision||'Chờ duyệt');card.append(label);for(const [decision,text]of [['approve','Duyệt'],['decline','Từ chối'],['revoke','Thu hồi']]){const button=document.createElement('button');button.textContent=text;button.onclick=async()=>{if(!confirm(text+' quyền Cloud của '+row.principal+'?'))return;button.disabled=true;try{await api('decision',{principal:row.principal,decision});await load()}catch(e){status.textContent=e.message}finally{button.disabled=false}};card.append(button)}list.append(card)}status.textContent=data.requests.length+' yêu cầu';}
  const handoff=new URLSearchParams(location.hash.slice(1)).get('session');
  history.replaceState(null,'',location.pathname);
  if(handoff){bearer=handoff;load().then(()=>{document.getElementById('logout').hidden=false}).catch(e=>{bearer='';status.textContent=e.message})}
  document.getElementById('logout').onclick=()=>{bearer='';list.replaceChildren();status.textContent='Đã đăng xuất';document.getElementById('logout').hidden=true};
  </script></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
            'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` } });
}
