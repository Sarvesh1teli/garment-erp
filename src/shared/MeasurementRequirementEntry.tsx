import { useRef, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useGarmentTypes } from './GarmentTypes';
import { garmentNamesForGender } from './garmentCatalog';
import { createMeasurementRequirements, measurementClasses, type RequirementLine } from './measurementRequirements';
import type { BulkOrder } from './bulkOrders';
import type { School } from './types';
import { useStoredState } from './utils';

const emptyLine=(className='',otherClass='',gender='Boys',garment=''):RequirementLine=>({id:crypto.randomUUID(),className,otherClass,gender,garment,size:'',quantity:1});
export function MeasurementRequirementEntry({schools,onViewSummary}:{schools:School[];onViewSummary:(school:string,year:string)=>void}){
  const catalog=useGarmentTypes();
  const [orders,setOrders]=useStoredState<BulkOrder[]>('garment-bulk-orders',[]);
  const currentYear=new Date().getFullYear();
  const [year,setYear]=useState(String(currentYear));
  const [school,setSchool]=useState('');
  const [lines,setLines]=useState<RequirementLine[]>(()=>[emptyLine()]);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState<{school:string;year:string;rows:number;pieces:number}|null>(null);
  const lock=useRef(false);
  const savedRows=useRef<RequirementLine[]|null>(null);
  const years=Array.from(new Set([year,...Array.from({length:7},(_,index)=>String(currentYear+1-index)),...orders.map(order=>order.year)].filter(value=>/^\d{4}$/.test(value)))).sort().reverse();
  const update=(id:string,patch:Partial<RequirementLine>)=>{setLines(current=>current.map(row=>row.id===id?{...row,...patch}:row));setError('');setSaved(null);};
  const save=()=>{
    if(lock.current||savedRows.current===lines)return;lock.current=true;setError('');setSaved(null);
    try{
      if(!schools.some(item=>item.name===school&&item.status==='Active'))throw Error('Select an active school.');
      for(const [index,row] of lines.entries()){if(!garmentNamesForGender(catalog.records,row.gender).includes(row.garment))throw Error(`Row ${index+1}: select an active garment type. Garment types come from Settings.`);}
      const batchId=crypto.randomUUID();
      createMeasurementRequirements(orders,school,year,lines,batchId);
      setOrders(current=>[...createMeasurementRequirements(current,school,year,lines,batchId),...current]);
      savedRows.current=lines;
      setSaved({school,year,rows:lines.length,pieces:lines.reduce((sum,row)=>sum+row.quantity,0)});
      setLines([emptyLine(lines[0]?.className,lines[0]?.otherClass,lines[0]?.gender,lines[0]?.garment)]);
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save measurements.');}
    finally{lock.current=false;}
  };
  return <article className="card measurement-form measurement-requirement-entry">
    <div className="form-title"><div><h2>Add measurement quantities</h2><p>Select year and school once, then add classes, garments, sizes and quantities. Student names are not required.</p></div></div>
    <div className="filterbar requirement-common-fields"><label>Year<select value={year} onChange={event=>setYear(event.target.value)}>{years.map(value=><option key={value}>{value}</option>)}</select></label><label>School<select value={school} onChange={event=>{setSchool(event.target.value);setError('');}}><option value="">Select school</option>{schools.filter(item=>item.status==='Active').map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label></div>
    <fieldset className="requirement-lines"><legend>Garments and quantities</legend>
      {lines.map((row,index)=><div className="requirement-line" key={row.id}>
        <label>Class<select value={row.className} onChange={event=>update(row.id,{className:event.target.value})}><option value="">Select class</option>{measurementClasses.map(name=><option key={name}>{name}</option>)}</select>{row.className==='Other'&&<input aria-label={`Other class for row ${index+1}`} placeholder="Enter class" value={row.otherClass} onChange={event=>update(row.id,{otherClass:event.target.value})}/>}</label>
        <label>Gender<select value={row.gender} onChange={event=>{const gender=event.target.value;update(row.id,{gender,garment:garmentNamesForGender(catalog.records,gender).includes(row.garment)?row.garment:''});}}><option>Boys</option><option>Girls</option><option>Common</option></select></label>
        <label>Garment type<select value={row.garment} onChange={event=>update(row.id,{garment:event.target.value})}><option value="">Select garment</option>{garmentNamesForGender(catalog.records,row.gender).map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Size<input value={row.size} onChange={event=>update(row.id,{size:event.target.value})} placeholder="e.g. 32"/></label>
        <label>Quantity<input type="number" min="1" step="1" value={row.quantity||''} onChange={event=>update(row.id,{quantity:Number(event.target.value)})}/></label>
        <button type="button" className="outline" disabled={lines.length===1} aria-label={`Remove row ${index+1}`} onClick={()=>setLines(current=>current.filter(item=>item.id!==row.id))}><Trash2 size={15}/></button>
      </div>)}
      <button type="button" className="outline" onClick={()=>{setLines(current=>{const previous=current[current.length-1];const gender=previous?.gender||'Boys';const garment=garmentNamesForGender(catalog.records,gender).includes(previous?.garment)?previous.garment:'';return [...current,emptyLine(previous?.className,previous?.otherClass,gender,garment)];});setError('');setSaved(null);}}><Plus size={15}/> Add Row</button>
    </fieldset>
    {error&&<p className="stock-form-error" role="alert">{error}</p>}
    {saved&&<div className="requirement-saved" role="status"><span>{saved.rows} rows · {saved.pieces} pieces saved to Production Summary.</span><button type="button" className="outline" onClick={()=>onViewSummary(saved.school,saved.year)}>View Prod Summary</button></div>}
    <div className="form-actions"><span>{lines.length} rows · {lines.reduce((sum,row)=>sum+(Number.isFinite(row.quantity)?row.quantity:0),0)} pieces</span><button type="button" className="outline" onClick={()=>{setLines([emptyLine()]);setError('');setSaved(null);}}>Clear</button><button type="button" className="primary" onClick={save}><Save size={15}/> Save All</button></div>
  </article>;
}
