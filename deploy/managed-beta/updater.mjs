import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

export const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const imageId = /^sha256:[a-f0-9]{64}$/;
const version = /^v(\d+)\.(\d+)\.(\d+)$/;
export function newer(a,b) {
  if(!version.test(a)||!version.test(b)) return false;
  const x=a.slice(1).split('.').map(Number),y=b.slice(1).split('.').map(Number);
  for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]>y[i];
  return false;
}
export function updateStore(file=process.env.LIMIX_UPDATE_STATE || join(homedir(),'.limix-managed-updates','state.json')) {
  const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{homes:{},checked:0};
  if(!state.homes || typeof state.homes!=='object') throw new Error('Invalid update state');
  return {state,save(){mkdirSync(dirname(file),{recursive:true,mode:0o700});writeFileSync(file+'.tmp',JSON.stringify(state),{mode:0o600});renameSync(file+'.tmp',file);}};
}

export async function waitHealthy(command,container, pause=sleep) {
  for(let i=0;i<60;i++) {
    const health=await command(['inspect','--format','{{.State.Health.Status}}',container]);
    if(health==='healthy')return;
    if(health==='unhealthy')break;
    await pause(3000);
  }
  throw new Error('Updated home failed health check');
}

// Only this exact home volume can be snapshotted or restored; no host bind mounts.
export function homeVolume(id,info) {
  const expected='limix-home-'+id+'_cloud';
  if(!imageId.test(info.Image)||info.Mounts?.length!==1||info.Mounts[0].Type!=='volume'||info.Mounts[0].Name!==expected||info.Mounts[0].Destination!=='/data')throw new Error('Unsupported home mounts/image; update refused');
  return expected;
}

export async function updateHome({id,target,tag,command,compose,store,prepare=async()=>false,pause=sleep}) {
  const entry=store.state.homes[id] ||= {};
  if(entry.blocked===tag)return;
  const container=await compose(id,['ps','-q','home'],entry.image);
  if(!container)return;
  const [info]=JSON.parse(await command(['inspect',container]));
  if(info.State?.Health?.Status!=='healthy')return;
  const volume=homeVolume(id,info);
  if(info.Image===target) { entry.image=target;entry.version=tag;store.save();return; }
  const installed=info.Config?.Labels?.['org.opencontainers.image.version'];
  const current=installed ? 'v'+installed : entry.version;
  if(current && version.test(current) && !newer(tag,current))return;
  if(!await prepare(id,container))return;
  const backup='limix-update-'+id;
  const old=info.Image;
  const task=entry.pending={old,target,backup,volume,stage:'stopping'};
  store.save();
  try {
    await compose(id,['stop','home'],old);
    const oldBackup=await command(['volume','ls','--filter','name=^'+backup+'$','--format','{{.Name}}']);
    if(oldBackup===backup)await command(['volume','rm',backup]);
    await command(['volume','create',backup]);
    await command(['run','--rm','--user','0','--entrypoint','tar','--mount','type=volume,source='+volume+',target=/source,readonly','--mount','type=volume,source='+backup+',target=/backup',old,'-czf','/backup/data.tgz','-C','/source','.']);
    task.stage='backed-up';store.save();
    await compose(id,['up','-d','--no-build','--force-recreate','home'],target);
    await waitHealthy(command,await compose(id,['ps','-q','home'],target),pause);
    entry.image=target;entry.version=tag;delete entry.pending;store.save();
  } catch(error) {
    await recoverHome({id,command,compose,store,pause});
    entry.blocked=tag;store.save();throw error;
  }
}

export async function recoverHome({id,command,compose,store,pause=sleep}) {
  const entry=store.state.homes[id],task=entry?.pending;
  if(!task)return;
  if(!imageId.test(task.old)||task.volume!=='limix-home-'+id+'_cloud'||task.backup!=='limix-update-'+id||!['stopping','backed-up'].includes(task.stage))throw new Error('Invalid recovery journal');
  await compose(id,['stop','home'],task.old);
  if(task.stage==='backed-up') {
    await command(['run','--rm','--user','0','--entrypoint','sh','--mount','type=volume,source='+task.volume+',target=/target','--mount','type=volume,source='+task.backup+',target=/backup,readonly',task.old,'-c','tar -tzf /backup/data.tgz >/dev/null && find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf /backup/data.tgz -C /target']);
  }
  await compose(id,['up','-d','--no-build','--force-recreate','home'],task.old);
  await waitHealthy(command,await compose(id,['ps','-q','home'],task.old),pause);
  entry.image=task.old;entry.blocked=store.state.candidate?.tag;delete entry.pending;store.save();
}

export async function checkUpdate({command,store,fetchImpl=fetch,now=Date.now()}) {
  if(now-store.state.checked<UPDATE_INTERVAL_MS)return;
  store.state.checked=now;store.save();
  try {
    const response=await fetchImpl('https://api.github.com/repos/leomieo/limix-bot/releases/latest',{headers:{accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Release check HTTP '+response.status);
    const release=await response.json(),tag=release.tag_name;
    if(release.draft||release.prerelease||!version.test(tag))throw new Error('Invalid stable release');
    if(store.state.candidate&&!newer(tag,store.state.candidate.tag))return;
    const ref='ghcr.io/leomieo/limix-bot:managed-'+tag;
    await command(['pull',ref]);
    const [image]=JSON.parse(await command(['image','inspect',ref]));
    if(!imageId.test(image.Id)||image.Config?.Labels?.['com.limix.managed-update']!=='1'||image.Config?.Labels?.['org.opencontainers.image.version']!==tag.slice(1))throw new Error('Managed image identity mismatch');
    store.state.candidate={image:image.Id,tag};store.save();
  } catch(error) {
    // A missing just-published image or a network outage retries in five minutes.
    store.state.checked=now-UPDATE_INTERVAL_MS+5*60*1000;store.save();throw error;
  }
}
