import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCommerce } from '../../shared/CommerceContext';
import { availableSchoolAdvances } from '../../shared/schoolAdvances';
import { displayDate } from '../../shared/dateDisplay';
import { money } from '../../shared/utils';
import { Table } from '../../shared/ui';

export function CustomerAdvances({customer}:{customer:string}) {
  const commerce=useCommerce();
  const [show,setShow]=useState(false);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [amount,setAmount]=useState('');
  const [mode,setMode]=useState('Cash');
  const [remarks,setRemarks]=useState('');
  const [error,setError]=useState('');
  const request=useRef('');
  const saving=useRef(false);
  const rows=(commerce?.customerAdvances||[]).filter(row=>row[2]===customer);
  const balances=availableSchoolAdvances(customer,rows,commerce?.payments||[],'9999-12-31');
  const save=()=>{
    if(saving.current)return;
    saving.current=true;
    try {
      if(!commerce)throw Error('Customer advance storage is unavailable.');
      commerce.recordCustomerAdvance(customer,date,Number(amount),mode,remarks,request.current);
      setShow(false);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Unable to record advance.');
    } finally {
      saving.current=false;
    }
  };
  return <>
    <Table title="Customer advance deposits" copy="Deposit history across all years. Applied amounts settle bills using the original deposit." paged sortable headers={['RECEIPT','DATE','RECEIVED','APPLIED','AVAILABLE','MODE','REMARKS']} rows={rows.map(row=>{const remaining=balances.find(balance=>balance.receipt===row[0])?.available||0;return [row[0],displayDate(row[1]),money(Number(row[4])),money(Number(row[4])-remaining),money(remaining),row[3],row[5]||'—'];})} action={<button className="primary" onClick={()=>{request.current=crypto.randomUUID();setAmount('');setRemarks('');setError('');setShow(true);}}>Record Customer Advance</button>}/>
    {show&&createPortal(<div className="stock-modal-overlay" style={{position:'fixed',inset:0,zIndex:15000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><article className="card measurement-form entry-modal" role="dialog" aria-modal="true" aria-label="Record customer advance" style={{width:'min(620px,100%)',maxHeight:'90vh',overflowY:'auto',margin:0}}><div className="form-title"><h2>Record Customer Advance</h2><button className="outline" onClick={()=>setShow(false)}>Close</button></div><p>{customer}</p><div className="form-grid"><label>Date<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>Amount received<input type="number" min="0.01" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>Payment mode<select value={mode} onChange={event=>setMode(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option></select></label><label>Remarks<input value={remarks} onChange={event=>setRemarks(event.target.value)}/></label></div>{error&&<p role="alert" className="stock-form-error">{error}</p>}<div className="form-actions"><button className="outline" onClick={()=>setShow(false)}>Cancel</button><button className="primary" onClick={save}>Save Advance</button></div></article></div>,document.body)}
  </>;
}
