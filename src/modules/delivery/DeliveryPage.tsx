import { useState } from 'react';
import { Eye, MessageSquare, Pencil, Plus, Printer, Save, Trash2, Truck } from 'lucide-react';
import type { CompanySettings } from '../settings/SettingsPage';
import type { DeliveryChallan } from '../../shared/types';
import { CompanyPrintHeader, PrintPreview, Stats, Table } from '../../shared/ui';
import { useStoredState } from '../../shared/utils';
import { sendSmsViaGateway, formatStockOutSms, type SmsLanguage } from '../../shared/sms';
import { SmsComposerModal, type SmsDraft } from '../../shared/SmsComposerModal';

const today=()=>new Date().toISOString().slice(0,10);
const emptyChallan=(customers:string[][]):DeliveryChallan=>{const first=customers.find(c=>(c[5]||'Active')==='Active')||customers[0];return {challanNo:'',date:today(),customer:first?.[1]||'',phone:first?.[3]||'',address:first?.[4]||'',gst:'',vehicle:'',driver:'',deliveryMode:'By vehicle',product:'',qty:0,unit:'PCS',remarks:'',status:'Ready'}};

function ChallanDocument({challan,company}:{challan:DeliveryChallan;company:CompanySettings}){
  return <div className="tax-doc"><CompanyPrintHeader company={company}/><h1>DELIVERY CHALLAN</h1><div className="doc-meta"><div><b>Challan Number</b><span>{challan.challanNo}</span></div><div><b>Date</b><span>{challan.date}</span></div><div><b>Status</b><span>{challan.status}</span></div><div><b>Delivery Mode</b><span>{challan.deliveryMode}</span></div></div><div className="doc-parties single"><div><h3>Delivery details</h3><p><b>Customer:</b> {challan.customer}</p><p><b>Phone:</b> {challan.phone}</p><p><b>Address:</b> {challan.address}</p><p><b>GSTIN:</b> {challan.gst}</p><p><b>Vehicle:</b> {challan.vehicle||'-'}</p><p><b>Driver:</b> {challan.driver||'-'}</p></div></div><table className="doc-table"><thead><tr><th>Product</th><th>Quantity</th><th>Unit</th><th>Remarks</th></tr></thead><tbody><tr><td>{challan.product}</td><td>{challan.qty}</td><td>{challan.unit}</td><td>{challan.remarks||'-'}</td></tr></tbody></table><div className="doc-footer"><div><b>Receiver acknowledgement</b><p>Name, signature and date</p></div><div><h3>For, {company.name}</h3><span>Authorized Signatory</span></div></div></div>;
}

export function DeliveryPage({company,customers}:{company:CompanySettings;customers:string[][]}){
  const [tab,setTab]=useState<'challans'|'create'>('challans');
  const [challans,setChallans]=useStoredState<DeliveryChallan[]>('garment-delivery-challans',[]);
  const [form,setForm]=useState<DeliveryChallan>(()=>emptyChallan(customers));
  const [originalNo,setOriginalNo]=useState<string|null>(null);
  const [preview,setPreview]=useState<DeliveryChallan|null>(null);
  const [message,setMessage]=useState('');
  const [smsLang,setSmsLang]=useState<SmsLanguage>('english');
  const [smsDraft,setSmsDraft]=useState<(SmsDraft&{referenceId:string})|null>(null);
  const [smsSending,setSmsSending]=useState(false);

  const pickCustomer=(id:string)=>{const customer=customers.find(item=>item[0]===id);if(customer)setForm(current=>({...current,customer:customer[1],phone:customer[3],address:customer[4]}))};
  const activeCustomers=customers.filter(c=>(c[5]||'Active')==='Active');
  const challanCustomerOptions=(()=>{const list=[...activeCustomers];if(form.customer&&!list.some(c=>c[1]===form.customer)){const c=customers.find(x=>x[1]===form.customer);if(c)list.push(c)}return list.map(customer=><option key={customer[0]} value={customer[0]}>{customer[1]}</option>)})();

  const reviewChallanSms=(c:DeliveryChallan,lang:SmsLanguage=smsLang)=>{
    if(!c.phone||c.phone==='-'){
      const phoneInput=window.prompt(`Enter mobile number for ${c.customer}:`,'9876543210');
      if(!phoneInput)return;
      c.phone=phoneInput;
    }
    const text=formatStockOutSms({
      partyName:c.customer,
      date:c.date,
      garment:c.product,
      size:c.unit,
      count:c.qty,
      challanNo:c.challanNo,
      companyName:company.name||'Your Business',
      language:lang
    });
    setSmsDraft({title:'Delivery Alert',recipientName:c.customer,recipientPhone:c.phone,message:text,referenceId:c.challanNo});
  };
  const confirmChallanSms=async()=>{
    if(!smsDraft)return;setSmsSending(true);
    const res=await sendSmsViaGateway({...smsDraft,referenceType:'delivery_challan'});setSmsSending(false);
    if(res.ok){setMessage(`Delivery SMS queued for ${smsDraft.recipientName} via TeliGateway.`);setSmsDraft(null)}else setMessage(`Failed to send SMS: ${res.message}`);
  };

  const saveChallan=async()=>{
    const number=form.challanNo.trim();
    if(!number||!form.customer.trim()||!form.product.trim()||form.qty<=0){setMessage('Challan number, customer, product and quantity are required.');return}
    if(challans.some(challan=>challan.challanNo===number&&challan.challanNo!==originalNo)){setMessage('Challan number already exists.');return}
    const saved={...form,challanNo:number};
    setChallans(current=>[saved,...current.filter(challan=>challan.challanNo!==originalNo&&challan.challanNo!==number)]);
    setForm(emptyChallan(customers));
    setOriginalNo(null);
    setMessage(`Delivery challan ${number} saved.`);
    if(saved.phone){
      reviewChallanSms(saved,smsLang);
    }
    setTab('challans');
  };

  const editChallan=(challan:DeliveryChallan)=>{setForm(challan);setOriginalNo(challan.challanNo);setTab('create')};
  const deleteChallan=(challan:DeliveryChallan)=>{if(window.confirm(`Delete challan ${challan.challanNo}?`))setChallans(current=>current.filter(item=>item.challanNo!==challan.challanNo))};
  const rows=challans.map(challan=>[challan.challanNo,challan.date,challan.customer,challan.product,`${challan.qty} ${challan.unit}`,challan.vehicle||'-',challan.status]);

  return <section className="content delivery-page">
    {message&&<div className="toast"><span className="toast-dot"/>{message}</div>}
    <div className="measurement-tabs wage-tabs">
      <button className={tab==='challans'?'active':''} onClick={()=>setTab('challans')}><Truck size={16}/><span>Delivery Challans<small>{challans.length} records</small></span></button>
      <button className={tab==='create'?'active':''} onClick={()=>{setForm(emptyChallan(customers));setOriginalNo(null);setTab('create')}}><Plus size={16}/><span>Create Challan<small>complete dispatch details</small></span></button>
    </div>
    {tab==='challans'&&<>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <Stats values={[[ 'Challans',String(challans.length),'dispatch records'],['Ready',String(challans.filter(item=>item.status==='Ready').length),'to deliver'],['Delivered',String(challans.filter(item=>item.status==='Delivered').length),'completed'],['Cancelled',String(challans.filter(item=>item.status==='Cancelled').length),'cancelled' ]]}/>
        <div style={{display:'flex',alignItems:'center',gap:6,background:'#fff',padding:'6px 12px',borderRadius:8,border:'1px solid #cbd5e1'}}>
          <span style={{fontSize:12,fontWeight:700,color:'#475569'}}>SMS Language:</span>
          <select value={smsLang} onChange={e=>setSmsLang(e.target.value as SmsLanguage)} style={{padding:'4px 8px',fontSize:12,borderRadius:6,border:'1px solid #cbd5e1'}}>
            <option value="english">English</option>
            <option value="kannada">ಕನ್ನಡ (Kannada)</option>
            <option value="both">Both / ಎರಡೂ</option>
          </select>
        </div>
      </div>
      <Table title="Delivery challan list" copy="Complete dispatch and transport information" headers={['CHALLAN','DATE','CUSTOMER','PRODUCT','QTY','VEHICLE','STATUS']} rows={rows} actions={row=>{const challan=challans.find(item=>item.challanNo===row[0])!;return <div className="table-actions"><button className="outline mini-action" onClick={()=>setPreview(challan)} title="View / Print"><Eye size={14}/></button><button className="outline mini-action" style={{color:'#0b3f37'}} onClick={()=>reviewChallanSms(challan,smsLang)} title="Send SMS Delivery Alert"><MessageSquare size={14}/></button><button className="outline mini-action" onClick={()=>editChallan(challan)}><Pencil size={14}/></button><button className="outline mini-action danger" onClick={()=>deleteChallan(challan)}><Trash2 size={14}/></button></div>}}/>
    </>}
    {tab==='create'&&<article className="card measurement-form">
      <div className="form-title">
        <div>
          <h2>{originalNo?'Edit delivery challan':'Create delivery challan'}</h2>
          <p>Customer, transport and dispatch details are stored in SQLite.</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:12,fontWeight:700,color:'#475569'}}>SMS:</label>
          <select value={smsLang} onChange={e=>setSmsLang(e.target.value as SmsLanguage)} style={{padding:'4px 8px',fontSize:12,borderRadius:6,border:'1px solid #cbd5e1'}}>
            <option value="english">English</option>
            <option value="kannada">ಕನ್ನಡ (Kannada)</option>
            <option value="both">Both / ಎರಡೂ</option>
          </select>
          <button className="primary" onClick={()=>setPreview(form)}><Printer size={16}/> Preview</button>
        </div>
      </div>
      <div className="form-grid">
        <label>Challan No<input value={form.challanNo} onChange={e=>setForm({...form,challanNo:e.target.value})}/></label>
        <label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as DeliveryChallan['status']})}><option>Ready</option><option>Delivered</option><option>Cancelled</option></select></label>
        <label>Customer<select value={customers.find(c=>c[1]===form.customer)?.[0]||''} onChange={e=>pickCustomer(e.target.value)}><option value="">Select customer</option>{challanCustomerOptions}</select></label>
        <label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>GSTIN<input value={form.gst} onChange={e=>setForm({...form,gst:e.target.value})}/></label>
        <label className="wide">Delivery Address<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
        <label>Delivery Mode<input value={form.deliveryMode} onChange={e=>setForm({...form,deliveryMode:e.target.value})}/></label>
        <label>Vehicle No<input value={form.vehicle} onChange={e=>setForm({...form,vehicle:e.target.value})}/></label>
        <label>Driver<input value={form.driver} onChange={e=>setForm({...form,driver:e.target.value})}/></label>
        <label>Product<input value={form.product} onChange={e=>setForm({...form,product:e.target.value})}/></label>
        <label>Quantity<input type="number" min="0" value={form.qty} onChange={e=>setForm({...form,qty:Number(e.target.value)})}/></label>
        <label>Unit<input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></label>
        <label className="wide">Remarks<input value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
      </div>
      <div className="form-actions">
        <button className="primary" onClick={saveChallan}><Save size={16}/> Save challan & Send SMS</button>
      </div>
    </article>}
    {preview&&<PrintPreview doc={<ChallanDocument challan={preview} company={company}/>} onClose={()=>setPreview(null)} extra={<><button className="primary" style={{background:'#0b3f37',color:'#fff',display:'inline-flex',alignItems:'center',gap:6}} onClick={()=>reviewChallanSms(preview,smsLang)}><MessageSquare size={14}/> Send SMS Alert</button>{challans.some(item=>item.challanNo===preview.challanNo)?<button className="outline" onClick={()=>editChallan(preview)}><Pencil size={14}/> Edit</button>:undefined}</>}/>} 
    {smsDraft&&<SmsComposerModal draft={smsDraft} setDraft={draft=>setSmsDraft({...smsDraft,...draft})} onClose={()=>setSmsDraft(null)} onSend={confirmChallanSms} sending={smsSending}/>} 
  </section>;
}
