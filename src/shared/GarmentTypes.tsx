import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useStoredState} from './utils';
import {parseGarmentSizes,collectGarmentNames,defaultGarmentNames,garmentIdentity,mergeGarmentTypes,type GarmentType} from './garmentCatalog';
const defaults=mergeGarmentTypes([],defaultGarmentNames);
type Catalog={records:GarmentType[];names:string[];add:(name:string,gender?:string,sizes?:string[])=>string;update:(name:string,patch:Partial<Pick<GarmentType,'active'|'gender'|'sizes'>>)=>void};
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
  const add=(raw:string,gender?:string,sizes?:string[])=>{const name=raw.trim().replace(/\s+/g,' ');if(!name)throw Error('Enter a garment name.');const existing=records.find(r=>garmentIdentity(r.name)===garmentIdentity(name));if(existing&&!existing.active)throw Error('This garment type is inactive. Activate it in Master → Garment Types.');if(existing&&gender&&existing.gender!=='All'&&existing.gender!==gender)throw Error(`${name} is configured for ${existing.gender}. Check Master → Garment Types.`);setRecords(current=>{const next=mergeGarmentTypes(current,[name]);return existing?next:next.map(row=>garmentIdentity(row.name)===garmentIdentity(name)?{...row,gender:(gender||'All') as GarmentType['gender'],sizes:sizes||[]}:row);});return existing?.name||name;};
  const update:Catalog['update']=(name,patch)=>setRecords(current=>current.map(row=>row.name===name?{...row,...patch}:row));
  return <Context.Provider value={{records,names,add,update}}>{children}</Context.Provider>;
}
export function GarmentTypesMaster(){
  const catalog=useGarmentTypes();
  const [garment,setGarment]=useState(''),[gender,setGender]=useState(''),[size,setSize]=useState('');
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(5),[message,setMessage]=useState('');
  const sizes=Array.from(new Set(catalog.records.filter(row=>!garment||row.name===garment).flatMap(row=>row.sizes||[]))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const filtered=catalog.records.filter(row=>(!garment||row.name===garment)&&(!gender||row.gender===gender)&&(!size||row.sizes?.includes(size)));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pages);
  const visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize);
  useEffect(()=>{setPage(current=>Math.min(current,pages));},[pages]);
  return <section className="card measurement-form garment-types-master"><div className="form-title"><div><h2>Garment Types</h2><p>Shared garment names and optional size suggestions. Manual sizes and existing records remain supported.</p></div></div>
    <form className="garment-type-add garment-type-add-compact" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const input=form.elements.namedItem('garmentName') as HTMLInputElement;const applicable=form.elements.namedItem('applicableGender') as HTMLSelectElement;const sizesInput=form.elements.namedItem('garmentSizes') as HTMLInputElement;try{const existed=catalog.records.some(row=>garmentIdentity(row.name)===garmentIdentity(input.value));const name=catalog.add(input.value,applicable.value,parseGarmentSizes(sizesInput.value));setGarment(name);setGender('');setSize('');setPage(1);setMessage(existed?`${name} already exists — edit its sizes below.`:`${name} added.`);form.reset();}catch(error){setMessage(error instanceof Error?error.message:'Unable to add garment');}}}>
      <label>Garment name<input name="garmentName" required maxLength={100} placeholder="Example: Suit Pant"/></label>
      <label>Applicable gender<select name="applicableGender" defaultValue="All"><option value="All">All genders</option><option>Boys</option><option>Girls</option><option>Common</option></select></label>
      <label>Sizes (optional)<input name="garmentSizes" placeholder="26, 28, 30, 32" maxLength={500}/></label><button className="primary" type="submit">Add Garment Type</button>
    </form>
    {message&&<p role="status">{message}</p>}
    <div className="filterbar garment-type-list-filter">
      <label>Garment<select value={garment} onChange={e=>{setGarment(e.target.value);setSize('');setPage(1);}}><option value="">All Garments</option>{catalog.records.map(row=><option key={row.name}>{row.name}</option>)}</select></label>
      <label>Gender<select value={gender} onChange={e=>{setGender(e.target.value);setPage(1);}}><option value="">All</option><option value="All">Applicable to all genders</option><option>Boys</option><option>Girls</option><option>Common</option></select></label>
      <label>Size<select value={size} onChange={e=>{setSize(e.target.value);setPage(1);}}><option value="">All Sizes</option>{sizes.map(value=><option key={value}>{value}</option>)}</select></label>
      <button className="outline" onClick={()=>{setGarment('');setGender('');setSize('');setPage(1);setMessage('');}}>Clear Filters</button>
    </div>
    <div className="connection-history-table"><table><thead><tr><th>Garment</th><th>Applicable gender</th><th>Available sizes (optional)</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(row=><tr key={garmentIdentity(row.name)}><td>{row.name}</td><td><select aria-label={`Gender for ${row.name}`} value={row.gender} onChange={e=>catalog.update(row.name,{gender:e.target.value as GarmentType['gender']})}><option value="All">All genders</option><option>Boys</option><option>Girls</option><option>Common</option></select></td><td><input key={`${row.name}:${(row.sizes||[]).join(',')}`} aria-label={`Sizes for ${row.name}`} defaultValue={(row.sizes||[]).join(', ')} placeholder="Any size / enter sizes" maxLength={500} onBlur={e=>catalog.update(row.name,{sizes:parseGarmentSizes(e.target.value)})}/></td><td>{row.active?'Active':'Inactive'}</td><td><button className="outline" onClick={()=>catalog.update(row.name,{active:!row.active})}>{row.active?'Deactivate':'Activate'}</button></td></tr>)}{!visible.length&&<tr><td colSpan={5}>No garment types match your filters.</td></tr>}</tbody></table></div>
    <p className="school-order-note">Separate sizes with commas. Size changes save when you leave the field. Blank means any size.</p>
    <div className="table-footer paginated-footer"><span>Showing {filtered.length?(safePage-1)*pageSize+1:0}–{Math.min(safePage*pageSize,filtered.length)} of {filtered.length} garments</span><div className="pager"><label>Rows<select aria-label="Garment types rows per page" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[5,10,20,50].map(size=><option key={size} value={size}>{size}</option>)}</select></label><button className="outline" disabled={safePage===1} onClick={()=>setPage(safePage-1)}>Prev</button><span>Page {safePage} / {pages}</span><button className="outline" disabled={safePage===pages} onClick={()=>setPage(safePage+1)}>Next</button></div></div>
  </section>;
}
