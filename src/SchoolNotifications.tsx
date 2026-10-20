import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { API_BASE_URL } from './shared/api';
import { enableSchoolPush, disableSchoolPush, listenSchoolPush, setPushSchool, type SchoolNotice } from './shared/schoolPushClient';

export function SchoolNotifications({token,schoolId,onOrder}:{token:string;schoolId:string;onOrder:(id:string)=>void}){
  const [notices,setNotices]=useState<SchoolNotice[]>([]);
  const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [enabled,setEnabled]=useState(Boolean(localStorage.getItem('school_push_token')));
  const api=async(path:string,options:RequestInit={})=>{
    const r=await fetch(`${API_BASE_URL}${path}`,{...options,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}});
    const body=await r.json();if(!r.ok)throw Error(body.message||'Unable to connect');return body;
  };
  useEffect(()=>{
    let active=true,unsubscribe:(()=>void)|undefined;
    const refresh=()=>api('/api/school/notifications').then(b=>{if(active)setNotices(b.data||[]);}).catch(()=>{});
    void setPushSchool(schoolId).catch(()=>{});void refresh();
    // Renew device ownership/token after sign-in, only after prior opt-in.
    if(localStorage.getItem('school_push_token')&&'Notification' in window&&Notification.permission==='granted'){
      void enableSchoolPush(api,schoolId,false).then(()=>listenSchoolPush(api,schoolId,()=>{if(active){void refresh();setMessage('New uniform order update received.');}})).then(stop=>{if(active)unsubscribe=stop;else stop();}).catch(()=>{if(active)setMessage('Device notification registration needs attention. Try Enable notifications again.');});
    }
    const timer=setInterval(refresh,60000);const focus=()=>void refresh();window.addEventListener('focus',focus);
    return()=>{active=false;unsubscribe?.();clearInterval(timer);window.removeEventListener('focus',focus);};
  },[token,schoolId,enabled]);
  const enable=async()=>{setBusy(true);try{await enableSchoolPush(api,schoolId);setEnabled(true);setMessage('Notifications enabled on this device.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to enable notifications');}finally{setBusy(false);}};
  const disable=async()=>{setBusy(true);try{await disableSchoolPush(api);setEnabled(false);setMessage('Notifications disabled on this device.');}catch{setMessage('Could not unregister with the server. Local alerts are paused; retry when online.');}finally{setBusy(false);}};
  return <section className="school-notification-panel">
    <div className="school-notification-actions"><button onClick={()=>setOpen(!open)}><Bell size={17}/> Notifications ({notices.filter(n=>!n.readAt).length})</button><button disabled={busy} onClick={enable}>{busy?'Please wait…':enabled?'Refresh notification setup':'Enable notifications'}</button>{enabled&&<button disabled={busy} onClick={disable}>Disable on this device</button>}</div>
    {message&&<p role="status">{message}</p>}
    {open&&<div className="school-notification-list">{notices.length?notices.map(n=><button key={n.id} onClick={async()=>{try{await api(`/api/school/notifications/${n.id}/read`,{method:'POST'});setNotices(rows=>rows.map(r=>r.id===n.id?{...r,readAt:new Date().toISOString()}:r));}catch{}onOrder(n.orderId);setOpen(false);}}><strong>{!n.readAt?'● ':''}{n.title}</strong><span>{n.body}</span><small>{new Date(n.createdAt).toLocaleString('en-IN')}</small></button>):<p>No notifications yet.</p>}</div>}
  </section>;
}
