// @vitest-environment happy-dom
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
const fixture=vi.hoisted(()=>({api:vi.fn(),review:vi.fn()}));
vi.mock("@/state/store",()=>({api:fixture.api}));
import {ChannelReplyComposer} from "./ChannelReplyComposer";
import {ApiError} from "@/state/api";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:Root;
beforeEach(async()=>{
 sessionStorage.clear();fixture.api.mockReset();fixture.review.mockReset();
 fixture.review.mockResolvedValue({ticket:"verified-ticket"});fixture.api.mockResolvedValue({until:Date.now()+300000});
 (window as any).ogb={limixAccount:{review:fixture.review}};
 host=document.createElement("div");document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(createElement(ChannelReplyComposer,{threadId:"test-thread",onInternal:vi.fn()})));
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();});
async function type(selector:string,value:string){
 const el=host.querySelector(selector) as HTMLInputElement;
 await act(async()=>{Object.getOwnPropertyDescriptor(selector==='textarea'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
}
const send=()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Send')!;
async function unlock(){await type('input','fixture-password');await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it('unlocks inline without sending or losing the draft; sends only on explicit click',async()=>{
 await type('textarea','saved draft');expect(send().disabled).toBe(true);
 await unlock();expect(fixture.review).toHaveBeenCalledWith('fixture-password');
 expect(fixture.api).toHaveBeenCalledWith('/api/limix/channel-review/unlock',expect.objectContaining({body:'{"ticket":"verified-ticket"}'}));
 expect(host.querySelector('textarea')!.value).toBe('saved draft');expect(host.querySelector('input')).toBeNull();expect(send().disabled).toBe(false);
 expect(fixture.api).toHaveBeenCalledTimes(1);
 await act(async()=>send().click());expect(fixture.api).toHaveBeenLastCalledWith('/api/limix/channel-action',expect.objectContaining({body:'{"threadId":"test-thread","text":"saved draft","mode":"direct"}'}));
});
it('clears a rejected password and keeps the draft locked',async()=>{
 fixture.review.mockRejectedValue(new Error('Incorrect password'));await type('textarea','draft');await unlock();
 expect(host.querySelector('input')!.value).toBe('');expect(send().disabled).toBe(true);expect(host.querySelector('textarea')!.value).toBe('draft');expect(fixture.api).not.toHaveBeenCalled();
});
it('reopens password entry after server revocation without retrying the reply',async()=>{
 await type('textarea','draft');await unlock();fixture.api.mockRejectedValue(new ApiError('denied',403));
 await act(async()=>send().click());expect(host.querySelector('input')).not.toBeNull();expect(send().disabled).toBe(true);expect(host.querySelector('textarea')!.value).toBe('draft');
});
it('shows agent waiting separately and bounds the request without automatic resubmission',async()=>{
 await type('textarea','draft');await unlock();
 await act(async()=>{const select=host.querySelector('select')!;select.value='agent';select.dispatchEvent(new Event('change',{bubbles:true}));});
 let reject!:(error:Error)=>void;fixture.api.mockImplementation(()=>new Promise((_resolve,no)=>{reject=no;}));
 await act(async()=>send().click());
 expect(host.textContent).toContain('Waiting for bot');
 expect(fixture.api).toHaveBeenLastCalledWith('/api/limix/channel-action',expect.objectContaining({timeoutMs:720000}));
 await act(async()=>reject(new DOMException('Timed out','TimeoutError')));
 expect(host.textContent).toContain('Check internal chat and the channel before retrying');
 expect(host.querySelector('textarea')!.value).toBe('draft');
 expect(fixture.api.mock.calls.filter(([path])=>path==='/api/limix/channel-action')).toHaveLength(1);
});
