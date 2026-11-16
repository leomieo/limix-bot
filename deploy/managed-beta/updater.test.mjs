import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {checkUpdate,updateHome,recoverHome,homeVolume,newer,UPDATE_INTERVAL_MS} from './updater.mjs';
const old='sha256:'+'a'.repeat(64),target='sha256:'+'b'.repeat(64);
const store=()=>({state:{homes:{},checked:0},save(){}});
function fixture(fail=false){
 const id=randomUUID(),calls=[],state=store();let image=old;
 const command=async args=>{calls.push(args);if(args[0]==='inspect'&&args.length===2)return JSON.stringify([{Image:old,State:{Health:{Status:'healthy'}},Mounts:[{Type:'volume',Name:'limix-home-'+id+'_cloud',Destination:'/data'}]}]);if(args[0]==='inspect')return fail&&image===target?'unhealthy':'healthy';return '';};
 const compose=async(id,args,next)=>{calls.push(args);if(args[0]==='up')image=next;return args.includes('-q')?'fixture':'';};
 return {id,calls,store:state,command,compose,target,tag:'v0.3.57',prepare:async()=>true,pause:async()=>{}};
}
test('six-hour interval avoids network and pull',async()=>{const s=store();s.state.checked=100;await checkUpdate({command:assert.fail,fetchImpl:assert.fail,store:s,now:100+UPDATE_INTERVAL_MS-1});});
test('only stable managed image identity is accepted',async()=>{const s=store();let pulled='';await checkUpdate({store:s,now:UPDATE_INTERVAL_MS,fetchImpl:async()=>Response.json({tag_name:'v0.3.57'}),command:async args=>{if(args[0]==='pull')pulled=args[1];return JSON.stringify([{Id:target,Config:{Labels:{'com.limix.managed-update':'1','org.opencontainers.image.version':'0.3.57'}}}]);}});assert.equal(pulled,'ghcr.io/leomieo/limix-bot:managed-v0.3.57');assert.equal(s.state.candidate.image,target);});
test('rejects wrong image target and retries five minutes later',async()=>{const s=store();await assert.rejects(checkUpdate({store:s,now:UPDATE_INTERVAL_MS,fetchImpl:async()=>Response.json({tag_name:'v0.3.57'}),command:async()=>JSON.stringify([{Id:target,Config:{Labels:{}}}])}),/identity mismatch/);assert.equal(s.state.checked,300000);assert.equal(s.state.candidate,undefined);});
test('version comparison prevents candidate downgrade',()=>{assert.equal(newer('v0.3.57','v0.3.56'),true);assert.equal(newer('v0.3.55','v0.3.56'),false);});
test('updates a home only after a stopped-volume backup',async()=>{const f=fixture();await updateHome(f);assert.equal(f.store.state.homes[f.id].image,target);assert.equal(f.store.state.homes[f.id].pending,undefined);assert(f.calls.findIndex(a=>a.includes('-czf'))<f.calls.findIndex(a=>a.includes('--force-recreate')));assert(!f.calls.some(a=>a.includes('down')||a.includes('-v')));});
test('failed start restores snapshot and pins old image',async()=>{const f=fixture(true);await assert.rejects(updateHome(f),/health check/);const entry=f.store.state.homes[f.id];assert.equal(entry.image,old);assert.equal(entry.blocked,'v0.3.57');assert(f.calls.some(a=>a.some(s=>s.includes('tar -tzf'))));});
test('crash recovery before backup preserves original volume',async()=>{const f=fixture();f.store.state.homes[f.id]={pending:{old,target,backup:'limix-update-'+f.id,volume:'limix-home-'+f.id+'_cloud',stage:'stopping'}};await recoverHome(f);assert.equal(f.store.state.homes[f.id].image,old);assert(!f.calls.some(a=>a.some(s=>s.includes('tar -tzf'))));});
test('unknown mount layout is refused before stopping',()=>{assert.throws(()=>homeVolume(randomUUID(),{Image:old,Mounts:[{Type:'bind'}]}),/Unsupported/);});
test('busy home is deferred without stopping or snapshotting',async()=>{const f=fixture();f.prepare=async()=>false;await updateHome(f);assert(!f.calls.some(a=>a.includes('stop')||a.includes('-czf')));assert.equal(f.store.state.homes[f.id].image,undefined);});
test('failed restore retains journal and stops rollout',async()=>{const f=fixture(true),command=f.command;f.command=async args=>{if(args.some(a=>a.includes('tar -tzf')))throw new Error('restore failed');return command(args);};await assert.rejects(updateHome(f),/restore failed/);assert(f.store.state.homes[f.id].pending);});
