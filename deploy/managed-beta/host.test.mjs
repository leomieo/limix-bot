import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { desktopToken, ensureTunnel, homeBootstrapSecret, reconcile, TUNNEL_CONTAINER } from "./host.mjs";

test("applies per-account CPU and RAM independently of plan", async () => {
  const id = randomUUID(), envs=[];
  await reconcile([id],1,()=>{},async(args,env)=>{
    if(args.includes("up"))envs.push(env);
    return args[0]==="inspect"?"healthy":args.includes("-q")?"fixture":"";
  },{origins:{[id]:`https://lc-${id.replaceAll('-','')}.limixmedia.com`},hostToken:"fixture",resources:{[id]:{cpus:3,memoryGb:7}}});
  assert.equal(envs[0].LIMIX_HOME_CPUS,"3");assert.equal(envs[0].LIMIX_HOME_MEMORY_GB,"7");
});
test("invalid resource overrides fail before Docker mutation",async()=>{
  await assert.rejects(reconcile([randomUUID()],1,assert.fail,assert.fail,{resources:{bad:{cpus:1000,memoryGb:4}}}),/Invalid resource/);
});

test("caps active homes, stops a revoked home, and never removes a volume", async () => {
  const [a, b, revoked] = Array.from({ length: 3 }, () => randomUUID());
  const calls = [], reports = [];
  const origins = { [a]: `https://lc-${a.replace(/-/g, "")}.limixmedia.com` };
  await reconcile([a, b], 1, (...args) => reports.push(args), async args => {
    calls.push(args);
    if (args[0] === "ps") return "limix-home-" + revoked;
    if (args.includes("-q")) return "fixture";
    if (args[0] === "inspect") return "healthy";
    return "";
  }, { origins, hostToken: "fixture-host-token-".repeat(3) });
  assert.deepEqual(reports, [[a, "running"], [b, "waiting_capacity"]]);
  assert(calls.some(args => args.includes("limix-home-" + revoked) && args.includes("stop")));
  assert(!calls.some(args => args.includes("down") || args.includes("-v")));
});

test("invalid registry snapshots cannot modify Docker", async () => {
  await assert.rejects(reconcile(["../other"], 1, assert.fail, assert.fail), /Invalid host/);
});

test("gives each home only its own address and its own bootstrap secret", async () => {
  const [a, b] = [randomUUID(), randomUUID()];
  const envs = new Map(), reports = [];
  const hostToken = "fixture-host-token-".repeat(3);
  const origins = { [a]: `https://lc-${a.replace(/-/g, "")}.limixmedia.com`, [b]: `https://lc-${a.replace(/-/g, "")}.limixmedia.com` };
  await reconcile([a, b], 2, (...args) => reports.push(args), async (args, env) => {
    if (args[0] === "compose" && args.includes("up")) envs.set(args[args.indexOf("-p") + 1], env);
    return args[0] === "inspect" ? "healthy" : args.includes("-q") ? "fixture" : "";
  }, { origins, hostToken });
  assert.deepEqual(envs.get("limix-home-" + a), { LIMIX_HOME_ID: a, LIMIX_HOME_ORIGIN: origins[a], LIMIX_DESKTOP_TOKEN: desktopToken(hostToken, a), LIMIX_HOME_SECRET: homeBootstrapSecret(hostToken, a), LIMIX_HOME_GATEWAY: "1" });
  assert(!envs.has("limix-home-" + b), "a home whose address names another workspace waits");
  assert.deepEqual(reports, [[a, "running"], [b, "starting"]]);
});

test("starts the tunnel connector once with the token only in its environment", async () => {
  const calls = [];
  let state = "";
  const command = async (args, env) => {
    calls.push({ args, env });
    if (args[0] === "network" && args[1] === "ls") return "";
    if (args[0] === "ps") return state;
    if (args[0] === "run") state = "running";
    return "";
  };
  assert.equal(await ensureTunnel("fixture-connector-token-value", command), "created");
  const started = calls.find(call => call.args[0] === "run");
  assert(!started.args.includes("fixture-connector-token-value"));
  assert.deepEqual(started.env, { TUNNEL_TOKEN: "fixture-connector-token-value" });
  assert(started.args.includes(TUNNEL_CONTAINER) && started.args.includes("limix-managed-edge"));
  assert(calls.some(call => call.args.join(" ") === "network create limix-managed-edge"));
  assert.equal(await ensureTunnel("fixture-connector-token-value", command), "running");
  await assert.rejects(ensureTunnel("bad token", command), /Invalid tunnel token/);
});

test("derives each home's own 256-bit bootstrap secret from the host token", () => {
  const token = "fixture-host-token-".repeat(3), id = randomUUID();
  assert.match(homeBootstrapSecret(token, id), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(homeBootstrapSecret(token, id), homeBootstrapSecret(token, id));
  assert.notEqual(homeBootstrapSecret(token, id), homeBootstrapSecret(token, randomUUID()));
});

test('sleep stops only assigned homes, leaves volumes, and does not consume an awake slot', async () => {
  const [asleep,awake]=[randomUUID(),randomUUID()],calls=[],reports=[];
  const origins=Object.fromEntries([asleep,awake].map(id=>[id,`https://lc-${id.replaceAll('-','')}.limixmedia.com`]));
  await reconcile([asleep,awake],1,(...r)=>reports.push(r),async args=>{calls.push(args);if(args[0]==='exec')return 'prepared';if(args[0]==='ps')return 'limix-home-'+asleep;if(args.includes('-q'))return 'fixture';if(args[0]==='inspect')return 'healthy';return ''},{origins,hostToken:'fixture'.repeat(10),power:{[asleep]:'asleep'},gateway:'0'});
  assert(calls.some(a=>a.includes('limix-home-'+asleep)&&a.includes('stop')));
  assert(!calls.some(a=>a.includes('down')||a.includes('-v')));
  assert.deepEqual(reports,[[asleep,'asleep'],[awake,'running']]);
});
test('an enabled messaging gateway refuses a sleep assignment',async()=>{
  const id=randomUUID(),reports=[],calls=[];
  await reconcile([id],1,(...r)=>reports.push(r),async args=>{calls.push(args);if(args[0]==='ps')return 'limix-home-'+id;if(args.includes('-q'))return 'fixture';if(args[0]==='inspect')return 'healthy';return ''},{origins:{[id]:`https://lc-${id.replaceAll('-','')}.limixmedia.com`},hostToken:'fixture'.repeat(10),power:{[id]:'asleep'}});
  assert(!calls.some(a=>a.includes('stop')));assert.deepEqual(reports,[[id,'running']]);
});

test('activity after the Admin handshake prevents a stale sleep stop',async()=>{
  const id=randomUUID(),reports=[],calls=[];
  await reconcile([id],1,(...r)=>reports.push(r),async args=>{calls.push(args);if(args[0]==='ps')return 'limix-home-'+id;if(args.includes('-q'))return 'fixture';if(args[0]==='exec')return 'awake';return ''},{origins:{[id]:`https://lc-${id.replaceAll('-','')}.limixmedia.com`},hostToken:'fixture'.repeat(10),power:{[id]:'asleep'},gateway:'0'});
  assert(!calls.some(a=>a.includes('stop')));assert.deepEqual(reports,[[id,'running']]);
});
