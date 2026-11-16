import { z } from "zod";
import { channelOwnerTransportToken } from "./limix-owner-lane.ts";
import type { RouteContext } from "./routes/table.ts";
const input=z.object({threadId:z.string().min(1).max(128),text:z.string().trim().min(1).max(20000),mode:z.enum(["direct","agent"])}).strict();
export async function channelActionRoute(ctx:RouteContext,deps:{channelThread:(id:string)=>boolean;record:(thread:string,text:string)=>void;context?:(id:string)=>unknown;fetch?:typeof fetch}) {
  const {path,method,auth,req,res,json,readBody}=ctx;
  if(path!=="/api/limix/channel-action")return false;
  if(method!=="POST"||!auth.scopes.includes("admin")||!auth.channelReviewUntil||auth.channelReviewUntil<=Date.now()) {json(res,403,{error:"Unlock channel conversations with the owner's password before replying."});return true;}
  const parsed=input.safeParse(await readBody(req,64000));
  if(!parsed.success){json(res,400,{error:"Invalid channel reply"});return true;}
  if(!deps.channelThread(parsed.data.threadId)){json(res,404,{error:"Channel conversation not found"});return true;}
  const token=channelOwnerTransportToken();
  if(!token){json(res,503,{error:"Owner connector is unavailable"});return true;}
  try {
    const response=await (deps.fetch??fetch)(`http://127.0.0.1:${Number(process.env.LIMIX_GATEWAY_PORT)||8790}/api/channel-reply`,{method:"POST",headers:{"content-type":"application/json","x-limix-owner":token},body:JSON.stringify({...parsed.data,context:parsed.data.mode==="agent"?deps.context?.(parsed.data.threadId):undefined}),redirect:"error",signal:AbortSignal.timeout(11*60000)});
    const result=await response.json() as {error?:string;reply?:string;delivered?:boolean};
    if(!response.ok||result.delivered!==true){json(res,response.ok?502:response.status,{error:result.error??"Reply was not confirmed"});return true;}
    deps.record(parsed.data.threadId,parsed.data.mode==="direct"?parsed.data.text:result.reply??"");
    json(res,200,{delivered:true});
  }catch{json(res,502,{error:"Delivery could not be confirmed. Check the channel before retrying to avoid duplicate messages."});}
  return true;
}
