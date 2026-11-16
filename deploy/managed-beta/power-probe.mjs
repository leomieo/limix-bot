import { createHash, createHmac, randomUUID } from 'node:crypto';
import { request } from 'node:http';
const secret = process.env.LIMIX_PROBE_SECRET, host = process.env.LIMIX_PROBE_HOST;
const prepare = process.argv.includes('--prepare-update');
const timestamp = String(Math.floor(Date.now()/1000)), nonce = randomUUID(), path = prepare ? '/api/cloud/power/sleep' : '/api/cloud/power';
const method = prepare ? 'POST' : 'GET', body = prepare ? '{}' : '';
const hash = createHash('sha256').update(body).digest('base64url');
const mac = createHmac('sha256',secret).update(`v1\n${timestamp}\n${nonce}\n${method}\n${path}\n${hash}`).digest('base64url');
const req = request({host:'127.0.0.1',port:8080,path,method,headers:{host,'content-type':'application/json','x-omb-cloud-timestamp':timestamp,'x-omb-cloud-nonce':nonce,'x-omb-cloud-signature':'v1='+mac}},res=>{
  let text='';res.on('data',c=>text+=c);res.on('end',()=>{try{const value=JSON.parse(text);process.stdout.write(res.statusCode===200&&(prepare?value.ok===true:value.sleeping===true)?'prepared':'awake')}catch{process.stdout.write('unknown')}});
});
req.setTimeout(5000,()=>req.destroy());req.on('error',()=>{process.stdout.write('unknown')});req.end(body);
