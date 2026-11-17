import {useEffect,useState} from "react";
import {api} from "@/state/store";
import {t} from "@/lib/i18n";
import {ApiError} from "@/state/api";
import {lx} from "@/lib/limix-text";
export function ChannelReplyComposer({threadId,onInternal}:{threadId:string;onInternal:()=>void}) {
  const [text,setText]=useState(""),[mode,setMode]=useState<"direct"|"agent">("direct"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [password,setPassword]=useState("");
  const [unlocking,setUnlocking]=useState(false);
  const [until,setUntil]=useState(()=>Number(sessionStorage.getItem("limix-channel-review-until"))||0);
  const unlocked=until>Date.now();
  useEffect(()=>{
    if(!until)return;
    const timer=setTimeout(()=>{setUntil(0);sessionStorage.removeItem("limix-channel-review-until");},Math.max(0,until-Date.now()));
    return ()=>clearTimeout(timer);
  },[until]);
  const unlock=async()=>{
    if(unlocking||!password)return;
    setUnlocking(true);setMessage("");
    try{
      const review=window.ogb?.limixAccount?.review;
      if(!review)throw new Error(lx("Mở Limix Bot trên máy tính để xác thực mật khẩu.","Open the desktop app to verify your password."));
      const ticket=await review(password);
      setPassword("");
      const result=await api<{until:number}>("/api/limix/channel-review/unlock",{method:"POST",body:JSON.stringify(ticket)});
      setUntil(result.until);
      sessionStorage.setItem("limix-channel-review-until",String(result.until));
      setMessage(lx("Đã mở khóa. Bạn có thể gửi nội dung đã soạn.","Unlocked. You can now send your draft."));
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}
    finally{setPassword("");setUnlocking(false);}
  };
  const send=async()=>{
    if(busy||!text.trim()||!unlocked)return;setBusy(true);setMessage("");
    try{await api("/api/limix/channel-action",{method:"POST",body:JSON.stringify({threadId,text,mode})});setText("");setMessage(t("chat.channel.delivered"));}
    catch(error){
      if(error instanceof ApiError && error.status===403){setUntil(0);sessionStorage.removeItem("limix-channel-review-until");setMessage(lx("Phiên mở khóa đã hết hoặc không còn quyền trả lời. Nhập mật khẩu để xác thực lại.","Access expired or was revoked. Verify your password again."));}
      else setMessage(error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  };
  return <div className="pointer-events-auto mx-5 mb-4 rounded-2xl border border-hairline/60 bg-raised p-4" data-testid="channel-conversation-composer">
    <button type="button" onClick={onInternal} className="mb-2 block text-sm text-ink-secondary">{t("chat.channel.openInternal")}</button>
    <label className="text-sm text-ink">{t("chat.channel.replyMode")}<select className="ml-3 rounded-lg bg-control p-2" disabled={busy} value={mode} onChange={e=>setMode(e.target.value as "direct"|"agent")}>
      <option value="direct">{t("chat.channel.direct")}</option><option value="agent">{t("chat.channel.agent")}</option>
    </select></label>
    <p className="my-2 text-xs text-ink-secondary">{t(mode==="direct"?"chat.channel.directHint":"chat.channel.agentHint")}</p>
    {!unlocked ? <form className="my-3 rounded-xl border border-hairline p-3" onSubmit={event=>{event.preventDefault();void unlock();}}>
      <label htmlFor={`channel-password-${threadId}`} className="mb-2 block text-sm text-ink">{lx("Mật khẩu tài khoản Limix","Limix account password")}</label>
      <div className="flex flex-wrap gap-2">
        <input id={`channel-password-${threadId}`} type="password" autoComplete="current-password" value={password} disabled={unlocking} onChange={event=>setPassword(event.target.value)} className="min-w-0 flex-1 rounded-lg bg-inset px-3 py-2 text-sm text-ink" />
        <button type="submit" disabled={unlocking||!password} className="rounded-full bg-control px-4 py-2 text-sm text-ink disabled:opacity-50">{unlocking?lx("Đang xác thực…","Verifying…"):lx("Mở khóa trả lời","Unlock replies")}</button>
      </div>
      <p className="mt-2 text-xs text-ink-secondary">{lx("Xác thực để trả lời khách hoặc giao việc cho bot trong 5 phút. Nội dung đang soạn được giữ nguyên.","Verify for five minutes of replies or bot instructions. Your draft is kept.")}</p>
    </form> : <p className="my-2 text-xs text-ink-secondary" role="status">{lx("Đã mở khóa trả lời đến ","Replies unlocked until ")+new Date(until).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p>}
    <textarea className="min-h-20 w-full resize-y rounded-xl bg-inset p-3 text-sm text-ink" disabled={busy} maxLength={20000} value={text} onChange={e=>setText(e.target.value)} aria-label={t("chat.channel.replyText")} />
    <button className="mt-2 rounded-full bg-control px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={busy||!text.trim()||!unlocked} onClick={()=>void send()}>{t(busy?"chat.channel.sending":"chat.channel.send")}</button>
    {message&&<p role="status" className="mt-2 text-sm text-ink-secondary">{message}</p>}
  </div>;
}
