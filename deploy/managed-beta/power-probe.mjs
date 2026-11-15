import { createHash, createHmac, randomUUID } from 'node:crypto';
import { request } from 'node:http';
const secret = process.env.LIMIX_PROBE_SECRET, host = process.env.LIMIX_PROBE_HOST;
const timestamp = String(Math.floor(Date.now()/1000)), nonce = randomUUID(), path = '/api/cloud/power';
const hash = createHash('sha256').update('').digest('base64url');
const mac = createHmac('sha256',secret).update(`v1\n${timestamp}\n${nonce}\nGET\n${path}\n${hash}`).digest('base64url');
const req = request({host:'127.0.0.1',port:8080,path,headers:{host,'x-omb-cloud-timestamp':timestamp,'x-omb-cloud-nonce':nonce,'x-omb-cloud-signature':'v1='+mac}},res=>{
  let text='';res.on('data',c=>text+=c);res.on('end',()=>{try{process.stdout.write(res.statusCode===200&&JSON.parse(text).sleeping===true?'prepared':'awake')}catch{process.stdout.write('unknown')}});
});
req.setTimeout(5000,()=>req.destroy());req.on('error',()=>{process.stdout.write('unknown')});req.end();
