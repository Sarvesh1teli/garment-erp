import { useGarmentTypes } from './GarmentTypes';
import { useRef, useState } from 'react';
import type { School } from './types';
import { useStoredState } from './utils';
import { Table } from './ui';
import { addBulkOrder, type BulkOrder, type BulkOrderLine } from './bulkOrders';

export function BulkOrderPanel({schools,source,onBeforeSave,onSaved}:{schools:School[];source?:{id:string;reference:string;school:string;requiredDate?:string;lines:BulkOrderLine[]};onBeforeSave?:()=>Promise<void>;onSaved?:()=>void}){
  const catalog=useGarmentTypes();
  const [orders,setOrders]=useStoredState<BulkOrder[]>('garment-bulk-orders',[]);
  const [school,setSchool]=useState(schools.find(s=>s.name===source?.school)?.name||'');
  const [reference,setReference]=useState(source?.reference||'');
  const [year,setYear]=useState(String(new Date().getFullYear()));
  const [className,setClassName]=useState('');
  const [requiredDate,setRequiredDate]=useState(source?.requiredDate?.slice(0,10)||'');
  const [mode,setMode]=useState<'additional'|'measured'>('additional');
  const [lines,setLines]=useState<BulkOrderLine[]>(source?.lines||[{gender:'Boys',garment:'Shirt',size:'',quantity:0}]);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const lock=useRef(false);
  const update=(index:number,patch:Partial<BulkOrderLine>)=>setLines(rows=>rows.map((r,i)=>i===index?{...r,...patch}:r));
  const save=async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{
      const order:BulkOrder={id:crypto.randomUUID(),sourceOrderId:source?.id,reference:reference.trim(),school,year,className,requiredDate,mode,createdAt:new Date().toISOString(),lines:lines.map(r=>({...r,garment:r.garment.trim(),size:r.size.trim()}))};
      addBulkOrder(orders,order);order.lines.forEach(row=>catalog.add(row.garment,row.gender));
      if(mode==='measured'&&!window.confirm('This order is already represented by student measurements. Save its reference without adding required quantities?'))return;
      await onBeforeSave?.();
      setOrders(current=>addBulkOrder(current,order));
      setError('Order added to production successfully.');
      if(onSaved)onSaved();else{setReference('');setLines([{gender:'Boys',garment:'Shirt',size:'',quantity:0}]);}
    }catch(e){setError(e instanceof Error?e.message:'Unable to save order');}finally{lock.current=false;setBusy(false);}
  };
  return <>
    <article className="card measurement-form"><div className="form-title"><div><h2>{source?'Review school order for production':'Add bulk order'}</h2><p>Required pieces only. Ready stock is recorded separately.</p></div></div>
    <div className="form-grid"><label>Local school<select value={school} onChange={e=>setSchool(e.target.value)}><option value="">Select school</option>{schools.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></label><label>Order reference<input value={reference} readOnly={Boolean(source)} onChange={e=>setReference(e.target.value)}/></label><label>Year<input value={year} onChange={e=>setYear(e.target.value)} placeholder="2026"/></label><label>Class (optional)<input value={className} onChange={e=>setClassName(e.target.value)}/></label><label>Required date<input type="date" value={requiredDate} onChange={e=>setRequiredDate(e.target.value)}/></label><label>Quantity source<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="additional">Additional bulk requirement</option><option value="measured">Already included in student measurements</option></select></label></div>
    <fieldset disabled={busy} className="bulk-order-lines"><legend>Garments and quantities</legend>{lines.map((r,i)=><div className="bulk-order-line" key={i}><label>Gender<select value={r.gender} onChange={e=>update(i,{gender:e.target.value})}><option value="">Select gender</option><option>Boys</option><option>Girls</option></select></label><label>Garment<select value={r.garment} onChange={e=>update(i,{garment:e.target.value})}><option value="">Select garment</option>{Array.from(new Set([...catalog.names,r.garment].filter(Boolean))).map(name=><option key={name}>{name}</option>)}</select></label><label>Size<input value={r.size} onChange={e=>update(i,{size:e.target.value})}/></label><label>Quantity<input type="number" min="1" step="1" value={r.quantity||''} onChange={e=>update(i,{quantity:Number(e.target.value)})}/></label><button className="outline" disabled={lines.length===1} onClick={()=>setLines(rows=>rows.filter((_,index)=>index!==i))}>Remove</button></div>)}<button className="outline" onClick={()=>setLines(rows=>[...rows,{gender:source?'':'Boys',garment:'Shirt',size:'',quantity:0}])}>+ Add row</button></fieldset>
    {error&&<p role="status">{error}</p>}<div className="form-actions"><button className="primary" disabled={busy} onClick={save}>{busy?'Saving…':source?'Confirm & Add to Production':'Save bulk order'}</button></div></article>
    {!source&&<Table paged title="Bulk order history" copy="Student measurements and additional bulk quantities are tracked separately." headers={['REFERENCE','SCHOOL','YEAR','REQUIRED DATE','SOURCE','PIECES']} rows={orders.map(o=>[o.reference,o.school,o.year,o.requiredDate||'-',o.source==='measurement'?'Measurement quantities':o.mode==='measured'?'Linked measurements':'Additional bulk',String(o.lines.reduce((n,r)=>n+r.quantity,0))])}/>}
  </>;
}
