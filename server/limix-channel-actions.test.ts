import {it,expect,vi} from "vitest";
vi.mock("./limix-owner-lane.ts",()=>({channelOwnerTransportToken:()=>"fixture-owner"}));
import {channelActionRoute} from "./limix-channel-actions.ts";
import type {RouteContext} from "./routes/table.ts";
async function run(unlocked:boolean,known=true){
 let output:any;const request=vi.fn(async(_url:unknown,_init?:unknown)=>Response.json({delivered:true}));const record=vi.fn();
 const ctx={path:"/api/limix/channel-action",method:"POST",req:{},res:{},auth:{scopes:["admin"],channelReviewUntil:unlocked?Date.now()+10000:0},readBody:async()=>({threadId:"thread",mode:"direct",text:"hello"}),json:(_:unknown,status:number,body:unknown)=>{output={status,body};}} as unknown as RouteContext;
 await channelActionRoute(ctx,{channelThread:()=>known,record,fetch:request as typeof fetch});return {output,request,record};
}
it("requires an active password-verified owner grant",async()=>{const r=await run(false);expect(r.output.status).toBe(403);expect(r.request).not.toHaveBeenCalled();});
it("refuses unknown or non-channel threads before network",async()=>{const r=await run(true,false);expect(r.output.status).toBe(404);expect(r.request).not.toHaveBeenCalled();});
it("records only after confirmed channel delivery",async()=>{const r=await run(true);expect(r.output.status).toBe(200);expect(r.record).toHaveBeenCalledWith("thread","hello");expect(r.request.mock.calls[0][0]).toContain("127.0.0.1:");});
