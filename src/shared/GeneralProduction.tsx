import { currentFinancialYear, inFinancialYear } from './financialYear';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGarmentTypes } from './GarmentTypes';
import { useJobWork } from './JobWorkContext';
import { garmentNamesForGender } from './garmentCatalog';
import { useStoredState } from './utils';
import { displayDate } from './dateDisplay';
import { Stats, Table } from './ui';
import { orderLineKey, lineOrderBalance, type ProductionLine, type ProductionOrder } from './customerProductionOrders';
export type { ProductionOrder } from './customerProductionOrders';

const blank=():ProductionLine=>({id:crypto.randomUUID(),garment:'',gender:'Common',size:'',colour:'',quantity:1,done:0});
export function validateGeneralProduction(lines:ProductionLine[]){
  if(!lines.length||lines.some(row=>!row.garment.trim()||!row.size.trim()||!Number.isSafeInteger(row.quantity)||row.quantity<=0||!Number.isSafeInteger(row.done)||row.done<0||row.done>row.quantity))throw Error('Each row needs garment, size, whole quantity, and completed pieces between zero and the required quantity.');
}

export function GeneralProduction({customers,onInventory,onCreateJobs,initialCustomer}:{initialCustomer?:string;customers:string[][];onInventory:()=>void;onCreateJobs?:(orderId:string)=>void}){
  const catalog=useGarmentTypes();
  const jobs=useJobWork()?.jobs||[];
  const [orders,setOrders]=useStoredState<ProductionOrder[]>('garment-general-production',[]);
  const [actionMenu,setActionMenu]=useState<{id:string;top:number;left:number}|null>(null);
  useEffect(()=>{if(!actionMenu)return;const close=()=>setActionMenu(null);const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close()};window.addEventListener('scroll',close,true);window.addEventListener('resize',close);window.addEventListener('keydown',key);return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);window.removeEventListener('keydown',key)}},[actionMenu]);
  const [show,setShow]=useState(false),[edit,setEdit]=useState<string|null>(null),[customer,setCustomer]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[requiredDate,setRequiredDate]=useState(''),[remarks,setRemarks]=useState('');
  const [lines,setLines]=useState<ProductionLine[]>(()=>[blank()]),[error,setError]=useState('');
  const [filterCustomer,setFilterCustomer]=useState(initialCustomer||'');
  const [filterYear,setFilterYear]=useState(currentFinancialYear());
  const [filterStatus,setFilterStatus]=useState('');
  const [filterGarment,setFilterGarment]=useState('');
  useEffect(()=>{setFilterCustomer(initialCustomer||'');setFilterYear(currentFinancialYear());setFilterStatus('');setFilterGarment('')},[initialCustomer]);
  const savedLines=useRef<ProductionLine[]|null>(null);
  const update=(id:string,patch:Partial<ProductionLine>)=>setLines(current=>current.map(row=>row.id===id?{...row,...patch}:row));
  const currentOrder=orders.find(row=>row.id===edit);
  const save=()=>{
    if(savedLines.current===lines)return;
    try{
      if(!date)throw Error('Select a date.');
      if(requiredDate&&requiredDate<date)throw Error('Required date must be on or after the order date.');
      validateGeneralProduction(lines);
      if(!edit&&lines.some(row=>!garmentNamesForGender(catalog.records,row.gender).includes(row.garment)))throw Error('Select active garment types from Master.');
      if(currentOrder&&lines.some((line,index)=>line.done>line.quantity-lineOrderBalance(currentOrder,index,jobs).assigned))throw Error('Manual completion plus quantities assigned to Job Cards cannot exceed the ordered quantity.');
      const clean=lines.map(line=>({...line,colour:line.colour?.trim()||undefined}));
      if(edit)setOrders(current=>current.map(row=>row.id===edit?{...row,requiredDate,lines:clean}:row));
      else{
        const next=orders.reduce((max,row)=>Math.max(max,Number(/^GP-(\d+)$/.exec(row.reference)?.[1]||0)),0)+1;
        setOrders(current=>[{id:crypto.randomUUID(),reference:`GP-${String(next).padStart(6,'0')}`,date,requiredDate,customer:customer.trim()||'General Stock',remarks,lines:clean},...current]);
      }
      savedLines.current=lines;setShow(false);setError('');
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save production order.');}
  };
  const completedFor=(order:ProductionOrder)=>order.lines.reduce((sum,_,index)=>sum+lineOrderBalance(order,index,jobs).completed,0);
  const statusFor=(order:ProductionOrder)=>{const total=order.lines.reduce((sum,line)=>sum+line.quantity,0),completed=completedFor(order);return completed===total?'Completed':completed?'In Progress':'Pending'};
  const filtered=orders.filter(order=>(!filterCustomer||order.customer===filterCustomer)&&(!filterYear||inFinancialYear(order.date,filterYear))&&(!filterStatus||statusFor(order)===filterStatus)&&(!filterGarment||order.lines.some(line=>line.garment===filterGarment)));
  const required=filtered.reduce((sum,row)=>sum+row.lines.reduce((sum,item)=>sum+item.quantity,0),0);
  const done=filtered.reduce((sum,order)=>sum+completedFor(order),0);
  const years=Array.from(new Set([currentFinancialYear(),...orders.map(order=>{const date=new Date(`${order.date}T12:00:00`);return currentFinancialYear(date)})])).sort().reverse();
  const addOrder=()=>{setShow(true);setEdit(null);setCustomer(filterCustomer==='General Stock'?'':filterCustomer);setRequiredDate('');setDate(new Date().toISOString().slice(0,10));setRemarks('');setLines([blank()]);setError('')};
  return <section className="content general-production-page">
    <div className="filterbar job-card-filters customer-production-filters">
      <label>Year<select value={filterYear} onChange={event=>setFilterYear(event.target.value)}><option value="">All years</option>{years.map(year=><option key={year}>{year}</option>)}</select></label>
      <label>Customer<select value={filterCustomer} onChange={event=>setFilterCustomer(event.target.value)}><option value="">All customers / General Stock</option>{Array.from(new Set(['General Stock',...customers.map(row=>row[1]),...orders.map(order=>order.customer),...(initialCustomer?[initialCustomer]:[])])).sort().map(name=><option key={name}>{name}</option>)}</select></label>
      <label>Garment<select value={filterGarment} onChange={event=>setFilterGarment(event.target.value)}><option value="">All garments</option>{Array.from(new Set(orders.flatMap(order=>order.lines.map(line=>line.garment)))).sort().map(name=><option key={name}>{name}</option>)}</select></label>
      <label>Status<select value={filterStatus} onChange={event=>setFilterStatus(event.target.value)}><option value="">All statuses</option><option>Pending</option><option>In Progress</option><option>Completed</option></select></label>
      <button className="outline" onClick={()=>{setFilterCustomer('');setFilterYear(currentFinancialYear());setFilterStatus('');setFilterGarment('')}}>Clear Filters</button>
      <button className="primary" onClick={addOrder}>+ Add Order</button>
    </div>
    <Stats values={[["Orders",String(filtered.length),filterCustomer||"matching filters"],["Required",String(required),"pieces ordered"],["Completed",String(done),"pieces made"],["Pending",String(required-done),"pieces remaining"]]}/>
    <div className="production-order-table"><Table paged sortable title="Production orders" copy="Create Job Cards against each garment row and track their assigned quantities and production progress." headers={['ORDER','DATE','DUE','CUSTOMER','GARMENTS','ORDERED','ASSIGNED','DONE','STATUS']} rows={filtered.map(order=>{
      const total=order.lines.reduce((sum,item)=>sum+item.quantity,0);
      const completed=order.lines.reduce((sum,_,index)=>sum+lineOrderBalance(order,index,jobs).completed,0);
      const assigned=order.lines.reduce((sum,_,index)=>sum+lineOrderBalance(order,index,jobs).assigned,0);
      return [order.reference,displayDate(order.date),order.requiredDate?displayDate(order.requiredDate):'-',order.customer,order.lines.map(item=>`${item.garment} (${item.size})${item.colour?` / ${item.colour}`:''} x ${item.quantity}`).join(', '),String(total),String(assigned),String(completed),completed===total?'Completed':completed?'In Progress':'Pending'];
    })} actions={cells=>{
      const order=orders.find(row=>row.reference===cells[0]);
      if(!order)return null;
      const available=order.lines.reduce((sum,_,index)=>sum+lineOrderBalance(order,index,jobs).available,0);
      const assigned=order.lines.reduce((sum,_,index)=>sum+lineOrderBalance(order,index,jobs).assigned,0);
      return <div className="production-order-actions">
        {onCreateJobs&&<button className="primary" disabled={!available&&!assigned} onClick={()=>{setActionMenu(null);onCreateJobs(order.id)}}>{available?'Create Job Card':'View Job Cards'}</button>}
        <button type="button" className="outline production-order-more" aria-label={`More actions for ${order.reference}`} aria-haspopup="menu" aria-expanded={actionMenu?.id===order.id} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();setActionMenu(actionMenu?.id===order.id?null:{id:order.id,top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-70)),left:Math.max(8,Math.min(rect.right-170,window.innerWidth-178))})}}>⋯</button>
      </div>;
    }}/></div>
    <div className="form-actions"><button className="outline" onClick={onInventory}>Open Ready Garments</button></div>
    {actionMenu&&createPortal(<div className="production-menu-backdrop" onClick={()=>setActionMenu(null)}><div role="menu" className="dropdown-menu production-order-menu" style={{position:'fixed',top:actionMenu.top,left:actionMenu.left,width:170}} onClick={event=>event.stopPropagation()}><button type="button" role="menuitem" className="dropdown-item" onClick={()=>{const order=orders.find(row=>row.id===actionMenu.id);if(order){setEdit(order.id);setLines(order.lines.map((item,index)=>({...item,id:orderLineKey(item,index)})));setDate(order.date);setRequiredDate(order.requiredDate||'');setCustomer(order.customer);setRemarks(order.remarks);setError('');setShow(true)}setActionMenu(null)}}>Update Progress</button></div></div>,document.body)}
    {show&&createPortal(<div className="stock-modal-overlay material-entry-overlay" onClick={()=>setShow(false)}><article className="card measurement-form entry-modal customer-order-dialog" role="dialog" aria-modal="true" aria-label="General production order" onClick={event=>event.stopPropagation()}>
      <div className="form-title"><h2>{edit?'Update Production Progress':'Add General / Customer Order'}</h2><button className="outline" onClick={()=>setShow(false)}>Close</button></div>
      <div className="form-grid">
        <label>Order date<input type="date" disabled={Boolean(edit)} value={date} onChange={event=>setDate(event.target.value)}/></label>
        <label>Required date (optional)<input type="date" min={date} value={requiredDate} onChange={event=>setRequiredDate(event.target.value)}/></label>
        <label>For / Customer (optional)<input disabled={Boolean(edit)} list="general-production-customers" value={customer} placeholder="General Stock" onChange={event=>setCustomer(event.target.value)}/><datalist id="general-production-customers">{customers.map(row=><option key={row[0]} value={row[1]}/>)}</datalist></label>
        <label>Remarks<input disabled={Boolean(edit)} value={remarks} onChange={event=>setRemarks(event.target.value)}/></label>
      </div>
      <fieldset className="bulk-order-lines customer-order-lines"><legend>Garments</legend>
        {lines.map((row,index)=>{
          const assigned=currentOrder?lineOrderBalance(currentOrder,index,jobs).assigned:0;
          return <div className="quick-sale-line" key={row.id||index}>
            <label>Gender<select disabled={Boolean(edit)} value={row.gender} onChange={event=>update(row.id,{gender:event.target.value,garment:''})}><option>Common</option><option>Boys</option><option>Girls</option></select></label>
            <label>Garment<select disabled={Boolean(edit)} value={row.garment} onChange={event=>update(row.id,{garment:event.target.value})}><option value="">Select</option>{Array.from(new Set([...garmentNamesForGender(catalog.records,row.gender),row.garment].filter(Boolean))).map(name=><option key={name}>{name}</option>)}</select></label>
            <label>Size<input disabled={Boolean(edit)} value={row.size} onChange={event=>update(row.id,{size:event.target.value})}/></label>
            <label>Colour (optional)<input disabled={Boolean(edit)} value={row.colour||''} onChange={event=>update(row.id,{colour:event.target.value})}/></label>
            <label>Required<input disabled={Boolean(edit)} type="number" min="1" step="1" value={row.quantity||''} onChange={event=>update(row.id,{quantity:Number(event.target.value)})}/></label>
            {edit?<label>{assigned?'Manual completed':'Completed'}<input type="number" min="0" step="1" max={row.quantity-assigned} value={row.done} onChange={event=>update(row.id,{done:Number(event.target.value)})}/></label>:<button className="outline" disabled={lines.length===1} onClick={()=>setLines(current=>current.filter(item=>item.id!==row.id))}>Remove</button>}
          </div>;
        })}
        {!edit&&<button className="outline" onClick={()=>setLines(current=>[...current,blank()])}>+ Add Row</button>}
      </fieldset>
      {edit&&<p className="job-quality-note">Job Card production contributes automatically. Enter manual completion only for pieces handled outside those jobs.</p>}
      {error&&<p className="stock-form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="outline" onClick={()=>setShow(false)}>Cancel</button><button className="primary" onClick={save}>Save</button></div>
    </article></div>,document.body)}
  </section>;
}
