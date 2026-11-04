import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { API_BASE_URL } from './shared/api';
import { enableSchoolPush, disableSchoolPush, listenSchoolPush, setPushSchool, type SchoolNotice } from './shared/schoolPushClient';

export function SchoolNotifications({token,schoolId,onOrder,visible=false,onViewAll,onUnread,orders=[]}:{token:string;schoolId:string;onOrder:(id:string)=>void;visible?:boolean;onViewAll?:()=>void;onUnread?:(count:number)=>void;orders?:{id:string;orderNo:string}[]}){
  const [filter,setFilter]=useState('all'),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(10);
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
  const unread=notices.filter(row=>!row.readAt).length;
  useEffect(()=>{onUnread?.(unread);},[unread,onUnread]);
  const read=async(notice:SchoolNotice)=>{await api(`/api/school/notifications/${encodeURIComponent(notice.id)}/read`,{method:'POST'});setNotices(rows=>rows.map(row=>row.id===notice.id?{...row,readAt:row.readAt||new Date().toISOString()}:row));};
  const view=async(notice:SchoolNotice)=>{try{await read(notice);}catch{setMessage('Could not mark notification as read.');}onOrder(notice.orderId);setOpen(false);};
  const filtered=notices.filter(row=>filter==='all'||(filter==='unread'?!row.readAt:Boolean(row.readAt))).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pages);
  const date=(value:string)=>new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  return <section className={visible?'school-page-card school-notifications-page':'school-notification-panel'}>
    {!visible?<><button className="school-view-btn" onClick={()=>setOpen(!open)}><Bell size={17}/> Notifications ({unread})</button>{open&&<div className="school-notification-list">{notices.slice(0,3).map(notice=><button key={notice.id} onClick={()=>void view(notice)}><strong>{!notice.readAt?'● ':''}{notice.title}</strong><span>{notice.body}</span><small>{date(notice.createdAt)}</small></button>)}{!notices.length&&<p>No notifications yet.</p>}<button onClick={()=>{setOpen(false);onViewAll?.();}}>View all notifications</button></div>}</>:
    <><div className="school-page-head"><div><h2>Notifications</h2><p>Uniform order updates and messages from your garment supplier.</p></div></div>
    <div className="school-notification-actions"><label>Status<select value={filter} onChange={event=>{setFilter(event.target.value);setPage(1);}}><option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option></select></label><button disabled={busy||!unread} onClick={async()=>{setBusy(true);try{for(const notice of notices.filter(row=>!row.readAt))await read(notice);}catch{setMessage('Some notifications could not be marked as read. Please retry.');}finally{setBusy(false);}}}>Mark all read</button><button disabled={busy} onClick={enable}>{busy?'Please wait…':enabled?'Refresh alerts':'Enable alerts'}</button>{enabled&&<button disabled={busy} onClick={disable}>Disable device</button>}</div>
    <div className="school-history-table-wrap"><table className="school-history-table"><thead><tr><th>Date &amp; Time</th><th>Order No.</th><th>Notification</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.slice((safePage-1)*pageSize,safePage*pageSize).map(notice=><tr key={notice.id}><td>{date(notice.createdAt)}</td><td>{orders.find(order=>order.id===notice.orderId)?.orderNo||'—'}</td><td><strong>{notice.title}</strong><div>{notice.body}</div></td><td>{notice.readAt?'Read':'Unread'}</td><td><button className="school-view-btn" onClick={()=>void view(notice)}>View Order</button></td></tr>)}{!filtered.length&&<tr><td colSpan={5}>No notifications found.</td></tr>}</tbody></table></div>
    <div className="school-pagination"><span>Showing {filtered.length?(safePage-1)*pageSize+1:0}–{Math.min(safePage*pageSize,filtered.length)} of {filtered.length}</span><label>Rows<select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1);}}>{[5,10,20,50].map(size=><option key={size}>{size}</option>)}</select></label><button disabled={safePage===1} onClick={()=>setPage(safePage-1)}>Previous</button><span>{safePage} / {pages}</span><button disabled={safePage===pages} onClick={()=>setPage(safePage+1)}>Next</button></div></>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
