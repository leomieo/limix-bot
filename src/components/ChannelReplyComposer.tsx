import {useState} from "react";
import {api} from "@/state/store";
import {t} from "@/lib/i18n";
export function ChannelReplyComposer({threadId,onInternal}:{threadId:string;onInternal:()=>void}) {
  const [text,setText]=useState(""),[mode,setMode]=useState<"direct"|"agent">("direct"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const send=async()=>{
    if(busy||!text.trim())return;setBusy(true);setMessage("");
    try{await api("/api/limix/channel-action",{method:"POST",body:JSON.stringify({threadId,text,mode})});setText("");setMessage(t("chat.channel.delivered"));}
    catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  };
  return <div className="pointer-events-auto mx-5 mb-4 rounded-2xl border border-hairline/60 bg-raised p-4" data-testid="channel-conversation-composer">
    <button type="button" onClick={onInternal} className="mb-2 block text-sm text-ink-secondary">{t("chat.channel.openInternal")}</button>
    <label className="text-sm text-ink">{t("chat.channel.replyMode")}<select className="ml-3 rounded-lg bg-control p-2" disabled={busy} value={mode} onChange={e=>setMode(e.target.value as "direct"|"agent")}>
      <option value="direct">{t("chat.channel.direct")}</option><option value="agent">{t("chat.channel.agent")}</option>
    </select></label>
    <p className="my-2 text-xs text-ink-secondary">{t(mode==="direct"?"chat.channel.directHint":"chat.channel.agentHint")}</p>
    <textarea className="min-h-20 w-full resize-y rounded-xl bg-inset p-3 text-sm text-ink" disabled={busy} maxLength={20000} value={text} onChange={e=>setText(e.target.value)} aria-label={t("chat.channel.replyText")} />
    <button className="mt-2 rounded-full bg-control px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={busy||!text.trim()} onClick={()=>void send()}>{t(busy?"chat.channel.sending":"chat.channel.send")}</button>
    {message&&<p role="status" className="mt-2 text-sm text-ink-secondary">{message}</p>}
  </div>;
}
