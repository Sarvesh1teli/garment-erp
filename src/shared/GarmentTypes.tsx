import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useStoredState} from './utils';
import {collectGarmentNames,defaultGarmentNames,garmentIdentity,mergeGarmentTypes,type GarmentType} from './garmentCatalog';
const defaults=mergeGarmentTypes([],defaultGarmentNames);
type Catalog={records:GarmentType[];names:string[];add:(name:string,gender?:string)=>string;update:(name:string,patch:Partial<Pick<GarmentType,'active'|'gender'>>)=>void};
const missingProvider=()=>{throw Error('Garment catalog is unavailable. Restart the updated app and try again.');};
const Context=createContext<Catalog>({records:defaults,names:defaultGarmentNames,add:missingProvider,update:missingProvider});
export const useGarmentTypes=()=>useContext(Context);
export function GarmentTypesProvider({children}:{children:ReactNode}){
  const [records,setRecords]=useStoredState<GarmentType[]>('garment-type-master',defaults);
  const [inventory]=useStoredState<string[]>('garment-inventory-custom-garments',[]);
  const [measurement]=useStoredState<string[]>('garment-measurement-custom-garments',[]);
  const [schoolStock]=useStoredState<unknown[]>('garment-school-stock',[]);
  const [customerStock]=useStoredState<unknown[]>('garment-customer-stock',[]);
  const [students]=useStoredState<unknown[]>('garment-students',[]);
  const [bulk]=useStoredState<unknown[]>('garment-bulk-orders',[]);
  const [sales]=useStoredState<unknown[]>('garment-stock-sales',[]);
  const [prices]=useStoredState<unknown[]>('garment-prices',[]);
  const discovered=useMemo(()=>[...defaultGarmentNames,...inventory,...measurement,...collectGarmentNames([schoolStock,customerStock,students,bulk,sales,prices])],[inventory,measurement,schoolStock,customerStock,students,bulk,sales,prices]);
  useEffect(()=>{const next=mergeGarmentTypes(records,discovered);if(next!==records)setRecords(current=>mergeGarmentTypes(current,discovered));},[records,discovered,setRecords]);
  const names=records.filter(r=>r.active).map(r=>r.name);
  useEffect(()=>{const timer=window.setTimeout(()=>{void window.threadflow?.publishGarmentTypes?.(records).catch(()=>{});},800);return()=>window.clearTimeout(timer);},[records]);
  const add=(raw:string,gender?:string)=>{const name=raw.trim().replace(/\s+/g,' ');if(!name)throw Error('Enter a garment name.');const existing=records.find(r=>garmentIdentity(r.name)===garmentIdentity(name));if(existing&&!existing.active)throw Error('This garment type is inactive. Activate it in Settings → Garment Types.');if(existing&&gender&&existing.gender!=='All'&&existing.gender!==gender)throw Error(`${name} is configured for ${existing.gender}. Check Garment Types in Settings.`);setRecords(current=>mergeGarmentTypes(current,[name]));return existing?.name||name;};
  const update:Catalog['update']=(name,patch)=>setRecords(current=>current.map(row=>row.name===name?{...row,...patch}:row));
  return <Context.Provider value={{records,names,add,update}}>{children}</Context.Provider>;
}
export function GarmentTypesMaster(){
  const catalog=useGarmentTypes();
  const [search,setSearch]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(5),[message,setMessage]=useState('');
  const filtered=catalog.records.filter(row=>garmentIdentity(row.name).includes(garmentIdentity(search)));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pages);
  const visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize);
  useEffect(()=>{setPage(current=>Math.min(current,pages));},[pages]);
  return <section className="card measurement-form"><div className="form-title"><div><h2>Garment Types</h2><p>One list for measurements, production, ready stock, barcode generation and bulk orders. Deactivation preserves existing records.</p></div></div>
    <form className="garment-type-add garment-type-add-compact" onSubmit={e=>{e.preventDefault();const input=e.currentTarget.elements.namedItem('garmentName') as HTMLInputElement;try{const existed=catalog.records.some(row=>garmentIdentity(row.name)===garmentIdentity(input.value));const name=catalog.add(input.value);setSearch(name);setPage(1);setMessage(existed?`${name} already exists — shown below.`:`${name} added — shown below.`);input.value='';}catch(error){setMessage(error instanceof Error?error.message:'Unable to add garment');}}}><label>Garment name<input name="garmentName" required maxLength={100} placeholder="Example: Suit Pant"/></label><button className="primary" type="submit">Add Garment Type</button></form>
    {message&&<p role="status">{message}</p>}
    <div className="filterbar garment-type-list-filter"><label>Search garments<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Garment name"/></label><button className="outline" onClick={()=>{setSearch('');setPage(1);setMessage('');}}>Show All</button></div>
    <div className="connection-history-table"><table><thead><tr><th>Garment</th><th>Applicable gender</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(row=><tr key={garmentIdentity(row.name)}><td>{row.name}</td><td><select aria-label={`Gender for ${row.name}`} value={row.gender} onChange={e=>catalog.update(row.name,{gender:e.target.value as GarmentType['gender']})}><option>All</option><option>Boys</option><option>Girls</option></select></td><td>{row.active?'Active':'Inactive'}</td><td><button className="outline" onClick={()=>catalog.update(row.name,{active:!row.active})}>{row.active?'Deactivate':'Activate'}</button></td></tr>)}{!visible.length&&<tr><td colSpan={4}>No garment types match your search.</td></tr>}</tbody></table></div>
    <div className="table-footer paginated-footer"><span>Showing {filtered.length?(safePage-1)*pageSize+1:0}–{Math.min(safePage*pageSize,filtered.length)} of {filtered.length} garments</span><div className="pager"><label>Rows<select aria-label="Garment types rows per page" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[5,10,20,50].map(size=><option key={size} value={size}>{size}</option>)}</select></label><button className="outline" disabled={safePage===1} onClick={()=>setPage(safePage-1)}>Prev</button><span>Page {safePage} / {pages}</span><button className="outline" disabled={safePage===pages} onClick={()=>setPage(safePage+1)}>Next</button></div></div>
  </section>;
}
