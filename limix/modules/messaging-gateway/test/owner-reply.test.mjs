import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownerReply} from '../src/owner-reply.mjs';
function fixture(){
 const sent=[],calls=[],threads={};const conn={id:'c',platform:'telegram',enabled:true,tokenRef:'key'};
 const key=JSON.stringify(['c','telegram','private','customer','topic','sender',false]);
 const store={state:{sessions:{[key]:{threadId:'external'}}},getConnection:()=>conn,getThread:k=>threads[k],setThread:(k,v)=>threads[k]=v};
 const deps={store,secrets:{get:()=>''},makeChannel:()=>({maxLength:4096,sendText:async(...args)=>{sent.push(args);return {messageId:1};}}),gateway:{makeEngine:()=>({ownerLaneToken:'fixture',send:async args=>{calls.push(args);args.onThread('owner-thread');return {reply:'Owner result',thread:'owner-thread'};}})}};
 return {deps,sent,calls,threads,conn};
}
test('manual reply reaches only the bound channel and topic',async()=>{const f=fixture();const result=await ownerReply(f.deps,{threadId:'external',mode:'direct',text:'hello'});assert.equal(result.delivered,true);assert.deepEqual(f.sent,[['customer','hello',{topicId:'topic'}]]);assert.equal(f.calls.length,0);});
test('agent instructions use a separate trusted owner conversation',async()=>{const f=fixture();await ownerReply(f.deps,{threadId:'external',mode:'agent',text:'Do the task'});assert.equal(f.calls[0].owner,true);assert.equal(f.calls[0].thread,undefined);assert.equal(f.calls[0].conversation.senderId,'sender');assert.equal(Object.values(f.deps.store.state.sessions)[0].threadId,'external');assert.equal(f.sent[0][1],'Owner result');});
test('unknown thread cannot redirect a reply',async()=>{const f=fixture();await assert.rejects(ownerReply(f.deps,{threadId:'other',mode:'direct',text:'x'}),/not found/);assert.equal(f.sent.length,0);});
test('disabled connections cannot send',async()=>{const f=fixture();f.conn.enabled=false;await assert.rejects(ownerReply(f.deps,{threadId:'external',mode:'direct',text:'x'}),/unavailable/);assert.equal(f.sent.length,0);});
