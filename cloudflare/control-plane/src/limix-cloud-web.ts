// Limix Cloud's page for customers: https://cloud.limixmedia.com (also at /cloud, for apps before 0.3.73). The desktop app (Settings → Limix Cloud →
// "Manage in your browser") asks for a one-time code with its device token and opens the page with the code in the
// address's fragment, which never reaches a server log. The page trades it for a short browser sign-in (a device row with
// platform "web") and then reads the same session the desktop reads: the plan, the Cloud's state, and the computers signed
// in. A browser sign-in can only read, wake the Cloud, ask for a trial, and sign devices out; nothing that moves bots.
import { HTTPError, json, readOptionalBoundedJSON, type JSONValue } from "./http";

export const WEB_CODE_MS = 5 * 60_000;
export const WEB_SESSION_MS = 2 * 3600_000;
const CODE = /^[A-Za-z0-9_-]{43}$/;
const ID = /^[0-9a-f-]{36}$/;
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async (value: string) => base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));

/** What a browser sign-in may ask of /api/cloud/desktop/… (the rest is the desktop's own). */
export const WEB_ROUTES = new Set(["session", "wake", "trial", "devices", "devices/revoke"]);

/** A one-time code for this account's page, asked by a signed-in desktop. */
export async function webCode(env: Env, principal: string, now = Date.now()): Promise<Response> {
  const code = random();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM limix_cloud_web_codes WHERE expires_at < ?").bind(now - WEB_CODE_MS),
    env.DB.prepare("INSERT INTO limix_cloud_web_codes(code_hash, principal, expires_at) VALUES (?, ?, ?)").bind(await sha256(code), principal, now + WEB_CODE_MS),
  ]);
  return json({ cloudContractVersion: 1, code, expiresAt: now + WEB_CODE_MS });
}

/** The page trades its code, once, for a browser sign-in. */
async function exchange(request: Request, env: Env, now = Date.now()): Promise<Response> {
  if (request.method !== "POST") throw new HTTPError(405, "method_not_allowed");
  const input = (await readOptionalBoundedJSON(request)) as { code?: unknown } | undefined;
  if (typeof input?.code !== "string" || !CODE.test(input.code)) throw new HTTPError(400, "invalid_request");
  const hash = await sha256(input.code);
  const taken = await env.DB.prepare("UPDATE limix_cloud_web_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING principal")
    .bind(now, hash, now).first<{ principal: string }>();
  if (!taken) throw new HTTPError(401, "invalid_code");
  const token = `omc_${random()}`, id = crypto.randomUUID(), expiresAt = now + WEB_SESSION_MS;
  await env.DB.prepare("INSERT INTO limix_cloud_devices(id, principal, token_hash, name, platform, created_at, expires_at) VALUES (?, ?, ?, ?, 'web', ?, ?)")
    .bind(id, taken.principal, await sha256(token), "Trình duyệt", now, expiresAt).run();
  return json({ cloudContractVersion: 1, accessToken: token, expiresAt });
}

/** The computers (and browsers) signed in to this account's Cloud now. */
export async function devices(env: Env, found: { id: string; principal: string }, now = Date.now()): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, platform, created_at, expires_at FROM limix_cloud_devices WHERE principal = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 100",
  ).bind(found.principal, now).all<{ id: string; name: string; platform: string; created_at: number; expires_at: number }>();
  return json({
    cloudContractVersion: 1,
    devices: results.map((row) => ({ id: row.id, name: row.name, platform: row.platform, createdAt: row.created_at, expiresAt: row.expires_at, current: row.id === found.id })) as JSONValue,
  });
}

/** Signs one of this account's devices out; never another account's. */
export async function revokeDevice(request: Request, env: Env, found: { id: string; principal: string }, now = Date.now()): Promise<Response> {
  const input = (await readOptionalBoundedJSON(request)) as { id?: unknown } | undefined;
  if (typeof input?.id !== "string" || !ID.test(input.id)) throw new HTTPError(400, "invalid_request");
  const done = await env.DB.prepare("UPDATE limix_cloud_devices SET revoked_at = ? WHERE id = ? AND principal = ? AND revoked_at IS NULL").bind(now, input.id, found.principal).run();
  if (!done.meta.changes) throw new HTTPError(404, "not_found");
  return devices(env, found, now);
}

/** Null for a path that is not the page's. */
export function limixCloudWebRoute(path: string, request: Request, env: Env): Promise<Response> | null {
  if ((path === "/" || path === "/cloud") && request.method === "GET") return Promise.resolve(page());
  if (path === "/api/cloud/web/exchange") return exchange(request, env);
  return null;
}

function page(): Response {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(18)));
  return new Response(PAGE.replaceAll("{{nonce}}", nonce), {
    headers: {
      "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    },
  });
}

const PAGE = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Limix Cloud</title>
<style nonce="{{nonce}}">
:root{--bg:#f6f6f8;--card:#fff;--ink:#16161a;--soft:#5d5d66;--line:#e4e4ea;--accent:#2b6cff;--ok:#1a8a4a;--warn:#b86e00;--bad:#c42b2b}
@media (prefers-color-scheme:dark){:root{--bg:#0c0c0f;--card:#17171c;--ink:#f1f1f4;--soft:#a3a3ad;--line:#2a2a32;--accent:#6b9bff;--ok:#4cc27e;--warn:#e7a43c;--bad:#ff6b6b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 16px 64px}h1{font-size:24px;margin:0 0 4px}.sub{color:var(--soft);margin:0 0 24px}
section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:16px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--soft);margin:0 0 10px;font-weight:600}
.big{font-size:18px;font-weight:600;margin:0}.muted{color:var(--soft);font-size:13px;margin:4px 0 0}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;vertical-align:1px;background:var(--soft)}
.ok{background:var(--ok)}.warn{background:var(--warn)}.bad{background:var(--bad)}
button,a.btn{font:inherit;font-size:14px;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:999px;padding:7px 14px;cursor:pointer;text-decoration:none;display:inline-block}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}button:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line)}.row:first-of-type{border-top:0}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.addr{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all;color:var(--soft)}
.err{color:var(--bad);margin:8px 0 0}[hidden]{display:none!important}footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
</style></head><body><main>
<h1>Limix Cloud</h1><p class="sub" id="who"></p>
<section id="signin" hidden><h2 data-t="signinTitle"></h2><p data-t="signinBody"></p></section>
<div id="app" hidden>
<section><h2 data-t="plan"></h2><p class="big" id="plan"></p><p class="muted" id="planMore"></p>
<div class="actions"><button class="primary" id="trial" hidden data-t="askTrial"></button></div></section>
<section id="cloudBox" hidden><h2 data-t="cloud"></h2><p class="big"><span class="dot" id="dot"></span><span id="cloudState"></span></p><p class="muted" id="cloudMore"></p>
<p class="addr" id="addr"></p><div class="actions"><button id="wake" hidden data-t="wake"></button><button id="reload" data-t="reload"></button></div></section>
<section><h2 data-t="devices"></h2><div id="devices"></div></section>
<p class="err" id="err" role="alert"></p>
<footer><a class="btn" id="admin" hidden href="https://admin.limixmedia.com/#cloud" data-t="admin"></a><button id="out" data-t="signOut"></button></footer>
</div></main>
<script nonce="{{nonce}}">
"use strict";
const vi=!/^en/i.test(navigator.language||"vi");
const T=vi?{signinTitle:"Mở trang này từ ứng dụng Limix Bot",signinBody:"Trong ứng dụng, vào Cài đặt → Limix Cloud → Quản lý trong trình duyệt của bạn. Liên kết chỉ dùng được một lần và hết hạn sau 5 phút.",
plan:"Gói dịch vụ",cloud:"Máy Cloud",devices:"Thiết bị đã đăng nhập",askTrial:"Xin dùng thử Limix Cloud",wake:"Đánh thức Cloud",reload:"Làm mới",admin:"Trang quản trị",signOut:"Đăng xuất khỏi trang này",
active:"Personal đang hoạt động",inactive:"Chưa có gói Cloud",pending:"Yêu cầu dùng thử đang chờ duyệt.",declined:"Yêu cầu dùng thử trước đã bị từ chối. Bạn có thể gửi lại.",none:"Gửi yêu cầu dùng thử để được cấp máy Cloud.",renew:"Gói tự gia hạn, hiện chưa thu phí.",
ready:"Đang chạy",asleep:"Đang ngủ",waking:"Đang thức dậy",setting:"Đang chuẩn bị",failed:"Gặp lỗi, đang tự thử lại",unreachable:"Không phản hồi",
readyMore:"Bot trên Cloud vẫn chạy khi máy tính của bạn tắt.",asleepMore:"Cloud ngủ khi không dùng để tiết kiệm tài nguyên; nó tự thức khi có việc.",settingMore:"Máy Cloud đang được dựng, thường mất vài phút.",
unreachableMore:"Máy chủ chưa báo về một lúc. Thử đánh thức hoặc chờ vài phút.",failedMore:"Hệ thống sẽ tự khởi động lại.",signedIn:"Đăng nhập ",until:" · hết hạn ",thisBrowser:"Trình duyệt này",signOutDevice:"Đăng xuất",
expired:"Phiên đã hết hạn. Hãy mở lại trang từ ứng dụng Limix Bot.",failedLoad:"Không tải được. Thử lại sau.",account:"Tài khoản ",confirm:"Đăng xuất thiết bị này? Máy đó sẽ phải đăng nhập lại Limix Cloud."}
:{signinTitle:"Open this page from the Limix Bot app",signinBody:"In the app, go to Settings → Limix Cloud → Manage in your browser. The link works once and expires after 5 minutes.",
plan:"Plan",cloud:"Cloud machine",devices:"Signed-in devices",askTrial:"Ask for a Limix Cloud trial",wake:"Wake the Cloud",reload:"Refresh",admin:"Admin",signOut:"Sign out of this page",
active:"Personal is active",inactive:"No Cloud plan yet",pending:"Your trial request is waiting for review.",declined:"Your earlier trial request was declined. You can ask again.",none:"Ask for a trial to get a Cloud machine.",renew:"The plan renews by itself; nothing is charged yet.",
ready:"Running",asleep:"Asleep",waking:"Waking up",setting:"Getting ready",failed:"Failed, retrying by itself",unreachable:"Not answering",
readyMore:"Bots on the Cloud keep running while your computer is off.",asleepMore:"The Cloud sleeps when idle to save resources and wakes when there is work.",settingMore:"The Cloud machine is being set up; this usually takes a few minutes.",
unreachableMore:"The host has not reported for a while. Try waking it or wait a few minutes.",failedMore:"It restarts by itself.",signedIn:"Signed in ",until:" · expires ",thisBrowser:"This browser",signOutDevice:"Sign out",
expired:"This session has ended. Open the page again from the Limix Bot app.",failedLoad:"Could not load. Try again later.",account:"Account ",confirm:"Sign this device out? It will have to sign in to Limix Cloud again."};
for(const el of document.querySelectorAll("[data-t]"))el.textContent=T[el.dataset.t];
const $=id=>document.getElementById(id);const KEY="limix-cloud-web";
const store={get(){try{return JSON.parse(sessionStorage.getItem(KEY)||"null")}catch{return null}},set(v){try{v?sessionStorage.setItem(KEY,JSON.stringify(v)):sessionStorage.removeItem(KEY)}catch{}}};
let token=null;
const day=at=>new Date(at).toLocaleString(vi?"vi-VN":undefined,{dateStyle:"medium",timeStyle:"short"});
const platform=p=>({win32:"Windows",darwin:"macOS",linux:"Linux",web:vi?"Trình duyệt":"Browser"})[p]||p;
function signedOut(msg){store.set(null);token=null;$("app").hidden=true;$("signin").hidden=false;$("who").textContent=msg||""}
async function call(path,method="GET",body){
  const r=await fetch("/api/cloud/desktop/"+path,{method,credentials:"omit",cache:"no-store",headers:{authorization:"Bearer "+token,accept:"application/json",...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  if(r.status===401){signedOut(T.expired);throw new Error("expired")}
  const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data&&data.error||String(r.status));return data}
function showSession(s){
  $("who").textContent=T.account+(s.account&&s.account.email||"");
  const on=s.entitlement&&s.entitlement.status==="active";
  $("plan").textContent=on?T.active:T.inactive;
  $("planMore").textContent=on?T.renew:T[s.limixTrial]||T.none;
  $("trial").hidden=on||s.limixTrial==="pending";
  $("admin").hidden=!(s.account&&s.account.id==="limix:leox");
  const c=s.cloud;$("cloudBox").hidden=!c;if(!c)return;
  let state="setting",tone="warn";
  if(c.state==="ready"){if(c.power&&c.power.state==="asleep"){state="asleep";tone=""}else if(c.power&&c.power.state==="waking"){state="waking";tone="warn"}else if(c.unreachable){state="unreachable";tone="bad"}else{state="ready";tone="ok"}}
  else if(c.state==="failed"){state="failed";tone="bad"}
  $("dot").className="dot "+tone;$("cloudState").textContent=T[state];
  $("cloudMore").textContent=T[(state==="waking"?"asleep":state)+"More"]||"";
  $("addr").textContent=c.origin||"";$("wake").hidden=!(state==="asleep"||state==="unreachable");
}
function showDevices(list){
  const box=$("devices");box.replaceChildren();
  for(const d of list){const row=document.createElement("div");row.className="row";
    const left=document.createElement("div");const name=document.createElement("div");name.textContent=d.current?T.thisBrowser:d.name+" · "+platform(d.platform);
    const more=document.createElement("div");more.className="muted";more.textContent=T.signedIn+day(d.createdAt)+T.until+day(d.expiresAt);left.append(name,more);row.append(left);
    if(!d.current){const b=document.createElement("button");b.textContent=T.signOutDevice;b.onclick=()=>{if(!confirm(T.confirm))return;b.disabled=true;
      call("devices/revoke","POST",{id:d.id}).then(x=>showDevices(x.devices)).catch(e=>{b.disabled=false;fail(e)})};row.append(b)}
    box.append(row)}}
function fail(e){if(e&&e.message!=="expired")$("err").textContent=T.failedLoad}
async function load(){$("err").textContent="";const [s,d]=await Promise.all([call("session"),call("devices")]);showSession(s);showDevices(d.devices);$("signin").hidden=true;$("app").hidden=false}
async function start(){
  const code=new URLSearchParams(location.hash.slice(1)).get("code");history.replaceState(null,"",location.pathname);
  if(code){const r=await fetch("/api/cloud/web/exchange",{method:"POST",credentials:"omit",cache:"no-store",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({code})});
    const data=await r.json().catch(()=>null);if(r.ok&&data&&data.accessToken)store.set({token:data.accessToken,expiresAt:data.expiresAt})}
  const kept=store.get();if(!kept||!kept.token||kept.expiresAt<=Date.now())return signedOut(code?T.expired:"");
  token=kept.token;await load().catch(fail)}
$("reload").onclick=()=>load().catch(fail);
$("wake").onclick=()=>{$("wake").disabled=true;call("wake","POST",{}).then(showSession).catch(fail).finally(()=>{$("wake").disabled=false})};
$("trial").onclick=()=>{$("trial").disabled=true;call("trial","POST",{}).then(showSession).catch(fail).finally(()=>{$("trial").disabled=false})};
$("out").onclick=()=>{call("session","DELETE",{}).catch(()=>{}).finally(()=>signedOut(""))};
start().catch(()=>signedOut(T.failedLoad));
</script></body></html>`;
