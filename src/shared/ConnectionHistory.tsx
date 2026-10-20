import {useEffect,useRef,useState} from 'react';
type Entry={id:string;schoolName:string;businessName:string;connectionCode:string;status:string;action:string;reason?:string;eventAt:string};
export function ConnectionHistory({request,school=false}:{request:(path:string)=>Promise<any>;school?:boolean}){
  const loader=useRef(request);loader.current=request;
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[status,setStatus]=useState('ALL'),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
  const [result,setResult]=useState<{data:Entry[];total:number;page:number}>({data:[],total:0,page:1}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;setBusy(true);setError('');
    const params=new URLSearchParams({from,to,status,page:String(page)});
    loader.current(`/api/${school?'school':'garment'}/connection-history?${params}`).then(r=>{if(active)setResult(r);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load history');}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[from,to,status,page,refresh,school]);
  return <section className="card connection-history"><h2>Connection History</h2><p>Earlier connections and changes. Existing records are labelled “Recorded state”; earlier events were not tracked.</p>
    <div className="connection-history-filters">
      <label>From<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label>
      <label>To<input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label>
      <label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>{['ALL','PENDING','APPROVED','REJECTED','DISCONNECTED'].map(s=><option key={s} value={s}>{s==='ALL'?'All statuses':s==='PENDING'?'Requested':s}</option>)}</select></label>
      <button onClick={()=>{setFrom('');setTo('');setStatus('ALL');setPage(1);}}>Clear Filters</button><button disabled={busy} onClick={()=>setRefresh(r=>r+1)}>Refresh</button>
    </div>
    {error&&<p role="alert">{error}</p>}
    {busy?<p role="status">Loading history…</p>:!error&&<>
      <div className="connection-history-table"><table><thead><tr><th>{school?'Garment business':'School'}</th><th>Connection ID</th><th>Date & time</th><th>Status</th><th>Details</th></tr></thead><tbody>
      {result.data.map(row=><tr key={row.id}><td>{school?row.businessName:row.schoolName}</td><td>{row.connectionCode}</td><td>{new Date(row.eventAt).toLocaleString('en-IN')}</td><td>{row.status==='PENDING'?'REQUESTED':row.status}</td><td>{row.action==='RECORDED'?'Recorded state':row.action==='REQUESTED'?'Connection requested':row.action==='DISCONNECTED'?'Connection ended':row.action==='APPROVED'?'Connection approved':'Connection rejected'}{row.reason&&<div>{row.reason}</div>}</td></tr>)}
      {!result.data.length&&<tr><td colSpan={5}>No connection history for these filters.</td></tr>}
      </tbody></table></div>
      <div className="connection-history-pagination"><span>{result.total} events · 5 rows per page</span><button disabled={result.page<=1} onClick={()=>setPage(result.page-1)}>Previous</button><span>Page {result.page} / {Math.max(1,Math.ceil(result.total/5))}</span><button disabled={result.page*5>=result.total} onClick={()=>setPage(result.page+1)}>Next</button></div>
    </>}
  </section>;
}
