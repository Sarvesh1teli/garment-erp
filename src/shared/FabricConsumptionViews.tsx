import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStoredState } from './utils';
import { useGarmentTypes } from './GarmentTypes';
import { garmentNamesForGender } from './garmentCatalog';
import { Table } from './ui';
import { fabricMetres, matchingFabricRates, saveFabricRate, type FabricConsumptionRate, type FabricEstimate } from './fabricConsumption';

export function FabricEstimateFields({ value, rates, garment, size, gender, quantity, onChange }: {
  value?: FabricEstimate; rates: FabricConsumptionRate[]; garment: string; size: string; gender: string; quantity: number;
  onChange: (value: FabricEstimate) => void;
}) {
  const matches = matchingFabricRates(rates, garment, size, gender);
  return <section className="job-stage-setup fabric-estimate-fields">
    <h3>Fabric Estimate (optional)</h3>
    <div className="form-grid">
      <label>Fabric width (inches)<input type="number" min="0.1" step="any" value={value?.widthInches||''} onChange={event=>{
        const widthInches=Number(event.target.value);
        const rate=matches.find(row=>row.widthInches===widthInches);
        onChange({widthInches,metresPerPiece:rate?.metresPerPiece||0,masterId:rate?.id});
      }}/></label>
      <label>Fabric per piece (metres)<input type="number" min="0.001" step="0.001" value={value?.metresPerPiece||''} onChange={event=>onChange({widthInches:value?.widthInches||0,metresPerPiece:Number(event.target.value)})}/></label>
      <label>Estimated total<div className="readonly-field">{value?.metresPerPiece?`${fabricMetres(quantity,value)} m for ${quantity} garments`:'Not set'}</div></label>
    </div>
    <p>{matches.length>0?`Master widths available: ${matches.map(row=>`${row.widthInches} inches`).join(', ')}.`:'No matching active master rate. Enter fabric details when required.'} {value?.masterId?'Master rate selected.':'Job-specific values can be entered manually.'}</p>
  </section>;
}

export function FabricConsumptionMaster() {
  const [rates,setRates]=useStoredState<FabricConsumptionRate[]>('garment-fabric-consumption',[]);
  const latest=useRef(rates);latest.current=rates;
  const catalog=useGarmentTypes();
  const [garment,setGarment]=useState(''),[gender,setGender]=useState(''),[size,setSize]=useState('');
  const [draft,setDraft]=useState<FabricConsumptionRate|null>(null),[error,setError]=useState('');
  const filtered=rates.filter(row=>(!garment||row.garment===garment)&&(!gender||row.gender===gender)&&(!size||row.size===size));
  const save=()=>{
    if(!draft)return;
    try {
      const next=saveFabricRate(latest.current,draft);
      latest.current=next;setRates(next);setDraft(null);setError('');
    }catch(cause){setError((cause as Error).message)}
  };
  return <>
    <div className="filterbar job-card-filters">
      <label>Garment<select value={garment} onChange={event=>{setGarment(event.target.value);setSize('')}}><option value="">All garments</option>{Array.from(new Set(rates.map(row=>row.garment))).sort().map(name=><option key={name}>{name}</option>)}</select></label>
      <label>Gender<select value={gender} onChange={event=>setGender(event.target.value)}><option value="">All genders</option><option>Boys</option><option>Girls</option><option>Common</option></select></label>
      <label>Size<select value={size} onChange={event=>setSize(event.target.value)}><option value="">All sizes</option>{Array.from(new Set(rates.filter(row=>!garment||row.garment===garment).map(row=>row.size))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(value=><option key={value}>{value}</option>)}</select></label>
      <button className="outline" onClick={()=>{setGarment('');setGender('');setSize('')}}>Clear Filters</button>
      <button className="primary" onClick={()=>{setDraft({id:crypto.randomUUID(),garment:'',size:'',gender:'Common',widthInches:0,metresPerPiece:0,active:true});setError('')}}>+ Add Fabric Rate</button>
    </div>
    <Table title="Fabric Consumption" copy="Configure metres per garment by size, gender and fabric width. Saved jobs retain their recorded estimates." headers={['GARMENT','SIZE','GENDER','WIDTH (INCHES)','METRES / PIECE','STATUS']} rows={filtered.map(row=>[row.garment,row.size,row.gender,String(row.widthInches),String(row.metresPerPiece),row.active?'Active':'Inactive'])} paged sortable actions={cells=>{
      const rate=filtered.find(row=>row.garment===cells[0]&&row.size===cells[1]&&row.gender===cells[2]&&String(row.widthInches)===cells[3]);
      return rate?<div className="job-table-actions"><button className="outline" onClick={()=>{setDraft({...rate});setError('')}}>Edit</button><button className="outline" onClick={()=>setRates(current=>current.map(row=>row.id===rate.id?{...row,active:!row.active}:row))}>{rate.active?'Deactivate':'Activate'}</button></div>:null;
    }}/>
    {draft&&createPortal(<div className="job-dialog-overlay" onClick={()=>setDraft(null)}><article className="card job-dialog fabric-rate-dialog" role="dialog" aria-modal="true" aria-label="Fabric consumption rate" onClick={event=>event.stopPropagation()}>
      <div className="form-title"><h2>Fabric Consumption Rate</h2><button className="outline" onClick={()=>setDraft(null)}>Close</button></div>
      <div className="form-grid">
        <label>Gender<select value={draft.gender} onChange={event=>setDraft({...draft,gender:event.target.value as FabricConsumptionRate['gender'],garment:''})}><option>Common</option><option>Boys</option><option>Girls</option></select></label>
        <label>Garment<select value={draft.garment} onChange={event=>setDraft({...draft,garment:event.target.value})}><option value="">Select garment</option>{Array.from(new Set([...garmentNamesForGender(catalog.records,draft.gender),...(draft.garment?[draft.garment]:[])])).map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Size<input value={draft.size} onChange={event=>setDraft({...draft,size:event.target.value})}/></label>
        <label>Fabric width (inches)<input type="number" min="0.1" step="any" value={draft.widthInches||''} onChange={event=>setDraft({...draft,widthInches:Number(event.target.value)})}/></label>
        <label>Fabric per piece (metres)<input type="number" min="0.001" step="0.001" value={draft.metresPerPiece||''} onChange={event=>setDraft({...draft,metresPerPiece:Number(event.target.value)})}/></label>
      </div>
      {error&&<p role="alert" className="stock-form-error">{error}</p>}
      <div className="form-actions"><button className="outline" onClick={()=>setDraft(null)}>Cancel</button><button className="primary" onClick={save}>Save Fabric Rate</button></div>
    </article></div>,document.body)}
  </>;
}
