import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useStoredState } from './utils';
import { useCommerceState } from './CommerceContext';
import { useGarmentTypes } from './GarmentTypes';
import { snapshotBom, type BomTemplate } from './bom';
import { materialUnit } from './materialStock';
import { Stats, Table } from './ui';

export function BomMaster(){
  const [templates,setTemplates]=useStoredState<BomTemplate[]>('garment-bom-templates',[]);
  const [materials]=useCommerceState<string[][]>('garment-inventory-items',[]);
  const catalog=useGarmentTypes();
  const [draft,setDraft]=useState<BomTemplate|null>(null);
  const [menu,setMenu]=useState<{id:string;top:number;left:number}|null>(null);
  useEffect(()=>{if(!menu)return;const close=()=>setMenu(null);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true)}},[menu]);
  const [error,setError]=useState('');
  const [garment,setGarment]=useState('');
  const [gender,setGender]=useState('');
  const [size,setSize]=useState('');
  const [status,setStatus]=useState('');
  const filtered=templates.filter(row=>(!garment||row.garment===garment)&&(!gender||row.gender===gender)&&(!size||row.size===size)&&(!status||(row.active?'Active':'Inactive')===status));
  const openTemplate=()=>{setError('');setDraft({id:crypto.randomUUID(),name:'',garment:garment||'',gender:gender||'All',size:size||'',active:true,lines:[]})};
  const options=materials.filter(row=>['Meter','Piece'].includes(materialUnit(row[3])));
  const save=()=>{if(!draft)return;try{if(templates.some(row=>row.id!==draft.id&&row.name.trim().toLowerCase()===draft.name.trim().toLowerCase()))throw Error('Use a unique template name.');snapshotBom({...draft,active:true},draft,materials);setTemplates(current=>[draft,...current.filter(row=>row.id!==draft.id)]);setDraft(null);setError('');}catch(cause){setError((cause as Error).message)}};
  return <section className="bom-master">
    <div className="filterbar salary-filter"><label>Garment<select value={garment} onChange={event=>setGarment(event.target.value)}><option value="">All garments</option>{Array.from(new Set([...catalog.names,...templates.map(row=>row.garment)])).sort().map(value=><option key={value}>{value}</option>)}</select></label><label>Gender<select value={gender} onChange={event=>setGender(event.target.value)}><option value="">All genders</option>{['All','Boys','Girls','Common'].map(value=><option key={value}>{value}</option>)}</select></label><label>Size<select value={size} onChange={event=>setSize(event.target.value)}><option value="">All sizes</option>{Array.from(new Set(templates.map(row=>row.size).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(value=><option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option><option>Active</option><option>Inactive</option></select></label><button className="outline" onClick={()=>{setGarment('');setGender('');setSize('');setStatus('')}}>Clear Filters</button><button className="primary" onClick={openTemplate}>Add Template</button></div>
    <Stats values={[
      ['Templates',String(filtered.length),'matching filters'],
      ['Active',String(filtered.filter(row=>row.active).length),'matching templates'],
      ['Garments',String(new Set(filtered.map(row=>row.garment)).size),'matching garment types'],
      ['Materials',String(new Set(filtered.flatMap(row=>row.lines.map(line=>JSON.stringify([line.item,line.subcategory])))).size),'distinct material variants'],
    ]}/>
    <Table title="Material Requirements (BOM)" copy="Quantities per garment. Select a template when creating a Job Card." headers={['TEMPLATE','GARMENT','GENDER','SIZE','MATERIALS','STATUS']} rows={filtered.map(row=>[row.id,row.name,row.garment,row.gender,row.size||'Any size',String(row.lines.length),row.active?'Active':'Inactive']).map(row=>row.slice(1))} paged sortable actions={row=>{const template=templates.find(item=>item.name===row[0]);return template?<button className="outline mini-action" aria-haspopup="menu" aria-expanded={menu?.id===template.id} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();setMenu(menu?.id===template.id?null:{id:template.id,top:Math.min(rect.bottom+4,window.innerHeight-110),left:Math.max(8,Math.min(rect.right-155,window.innerWidth-163))})}}>Actions ▾</button>:null;}}/>
    {menu&&createPortal(<div className="bom-menu-backdrop" onClick={()=>setMenu(null)}><div className="dropdown-menu bom-action-menu" role="menu" style={{position:'fixed',top:menu.top,left:menu.left,width:155}} onClick={event=>event.stopPropagation()}><button className="dropdown-item" role="menuitem" onClick={()=>{const template=templates.find(row=>row.id===menu.id);if(template){setError('');setDraft({...template,lines:template.lines.map(line=>({...line}))})}setMenu(null)}}>Edit</button><button className="dropdown-item" role="menuitem" onClick={()=>{setTemplates(current=>current.map(row=>row.id===menu.id?{...row,active:!row.active}:row));setMenu(null)}}>{templates.find(row=>row.id===menu.id)?.active?'Deactivate':'Activate'}</button></div></div>,document.body)}
    {draft&&createPortal(<div className="stock-modal-overlay bom-modal-overlay" onClick={()=>setDraft(null)}><section className="card measurement-form bom-template-modal" role="dialog" aria-modal="true" aria-label="Material template" onClick={event=>event.stopPropagation()}><div className="form-title"><h3>{templates.some(row=>row.id===draft.id)?'Edit':'Add'} Material Template</h3><button className="outline" onClick={()=>setDraft(null)}>Close</button></div><div className="bom-template-fields"><label>Template name<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label><label>Garment<select value={draft.garment} onChange={event=>setDraft({...draft,garment:event.target.value})}><option value="">Select garment</option>{catalog.names.map(name=><option key={name}>{name}</option>)}</select></label><label>Gender<select value={draft.gender} onChange={event=>setDraft({...draft,gender:event.target.value})}>{['All','Boys','Girls','Common'].map(value=><option key={value}>{value}</option>)}</select></label><label>Size (optional)<input value={draft.size} onChange={event=>setDraft({...draft,size:event.target.value.trim()})}/></label></div>
    {draft.lines.map((line,index)=><div className="bom-material-row" key={index}><label>Material / Subcategory<select value={options.findIndex(row=>row[1]===line.item&&row[2]===line.subcategory)} onChange={event=>{const material=options[Number(event.target.value)];if(!material)return;setDraft({...draft,lines:draft.lines.map((row,i)=>i===index?{...row,item:material[1],subcategory:material[2],unit:material[3]}:row)})}}><option value="-1">Select material</option>{options.map((row,i)=><option key={i} value={i}>{row[1]} / {row[2]} · {row[3]}</option>)}</select></label><label>Per garment<input type="number" min="0.001" step="0.001" value={line.perGarment||''} onChange={event=>setDraft({...draft,lines:draft.lines.map((row,i)=>i===index?{...row,perGarment:Number(event.target.value)}:row)})}/></label><button className="outline" onClick={()=>setDraft({...draft,lines:draft.lines.filter((_,i)=>i!==index)})}>Remove</button></div>)}
    <button className="outline" onClick={()=>setDraft({...draft,lines:[...draft.lines,{item:'',subcategory:'',unit:'',perGarment:1}]})}>Add Material</button>{error&&<p role="alert" className="stock-form-error">{error}</p>}<div className="form-actions"><button className="outline" onClick={()=>setDraft(null)}>Cancel</button><button className="primary" onClick={save}>Save Template</button></div></section></div>,document.body)}
  </section>;
}
