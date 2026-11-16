import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {updateHome,waitHealthy} from './updater.mjs';
const id=randomUUID(),project='limix-home-'+id,network='limix-update-fixture-'+id;
const temp=mkdtempSync(join(tmpdir(),'limix-update-fixture-'));
const file=fileURLToPath(new URL('./compose.yaml',import.meta.url));
const override=join(temp,'override.json');
const initial=process.env.LIMIX_HOME_IMAGE || 'limix-managed-home:beta';
const good='limix-update-fixture:'+id,bad=good+'-bad';
writeFileSync(override,JSON.stringify({networks:{edge:{name:network}}}));
const command=async args=>execFileSync('docker',args,{encoding:'utf8',timeout:300000,env:process.env}).trim();
const compose=async(_id,args,image=initial)=>execFileSync('docker',['compose','-f',file,'-f',override,'-p',project,...args],{encoding:'utf8',timeout:300000,env:{...process.env,LIMIX_HOME_ID:id,LIMIX_HOME_IMAGE:image,LIMIX_HOME_ORIGIN:'https://lc-'+id.replaceAll('-','')+'.fixture.invalid',LIMIX_HOME_SECRET:randomUUID()+randomUUID(),LIMIX_HOME_GATEWAY:'0'}}).trim();
const store={state:{homes:{},checked:0},save(){}};
try {
 await command(['network','create',network]);
 await compose(id,['up','-d','--no-build','home']);
 await waitHealthy(command,await compose(id,['ps','-q','home']));
 await compose(id,['exec','-T','--user','0','home','sh','-c','echo original > /data/update-fixture.txt']);
 writeFileSync(join(temp,'Dockerfile'),`FROM ${initial}\nLABEL com.limix.fixture="${id}"\n`);
 await command(['build','-t',good,temp]);
 const target=(JSON.parse(await command(['image','inspect',good])))[0].Id;
 await updateHome({id,target,tag:'v0.0.1',command,compose,store,prepare:async()=>true});
 assert.equal(store.state.homes[id].image,target);
 writeFileSync(join(temp,'Dockerfile'),`FROM ${good}\nHEALTHCHECK --interval=1s --timeout=1s --start-period=1s --retries=1 CMD exit 1\n`);
 await command(['build','-t',bad,temp]);
 const broken=(JSON.parse(await command(['image','inspect',bad])))[0].Id;
 const mutate=async(home,args,image)=>{
   const result=await compose(home,args,image);
   if(args[0]==='up' && image===broken)await compose(id,['exec','-T','--user','0','home','sh','-c','echo changed > /data/update-fixture.txt'],broken);
   return result;
 };
 await assert.rejects(updateHome({id,target:broken,tag:'v0.0.2',command,compose:mutate,store,prepare:async()=>true}),/health check/);
 assert.equal(store.state.homes[id].image,target);
 assert.equal(await compose(id,['exec','-T','home','cat','/data/update-fixture.txt'],target),'original');
 console.log('PASS real isolated Docker update, failed health check and snapshot restore');
} finally {
 await compose(id,['down','-v']).catch(()=>{});
 await command(['volume','rm','limix-update-'+id]).catch(()=>{});
 await command(['network','rm',network]).catch(()=>{});
 await command(['image','rm',bad,good]).catch(()=>{});
 rmSync(temp,{recursive:true,force:true});
}
