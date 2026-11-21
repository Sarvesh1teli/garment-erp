import { CustomerAdvances } from './CustomerAdvances';
import { availableSchoolAdvances } from '../../shared/schoolAdvances';
import { useState } from 'react';
import { useCommerce } from '../../shared/CommerceContext';
import { useJobWork } from '../../shared/JobWorkContext';
import { readyBalances } from '../../shared/commerce';
import { lineOrderBalance, type ProductionOrder } from '../../shared/customerProductionOrders';
import { jobStatus, stageSummary } from '../../shared/productionJobs';
import { paymentReceiptNumber } from '../../shared/paymentReceipts';
import { displayDate } from '../../shared/dateDisplay';
import { currentFinancialYear, inFinancialYear } from '../../shared/financialYear';
import { money, useStoredState } from '../../shared/utils';
import { Stats, Table } from '../../shared/ui';

export function CustomerOverview({customer,onBack,onNavigate,allowFinancial=true}:{customer:string[];onBack:()=>void;onNavigate?:(page:string,params?:Record<string,unknown>)=>void;allowFinancial?:boolean}) {
  const commerce=useCommerce();
  const jobs=useJobWork()?.jobs||[];
  const [orders]=useStoredState<ProductionOrder[]>('garment-general-production',[]);
  const [year,setYear]=useState(currentFinancialYear());
  const [tab,setTab]=useState('Orders');
  const name=customer[1];
  const customerOrders=orders.filter(row=>row.customer===name);
  const customerJobs=jobs.filter(row=>row.owner==='customer'&&row.party===name);
  const invoices=(commerce?.invoices||[]).filter(row=>row.customer===name);
  const invoiceNumbers=new Set(invoices.map(row=>row.invoiceNo));
  const payments=(commerce?.payments||[]).filter(row=>invoiceNumbers.has(row.invoiceNo));
  const invoiceBalance=(number:string,total:number)=>Math.max(0,total-payments.filter(row=>row.invoiceNo===number).reduce((sum,row)=>sum+Number(row.amount||0)+Number(row.discount||0),0));
  const pending=invoices.reduce((sum,row)=>sum+invoiceBalance(row.invoiceNo,row.totalAmount),0);
  const stock=readyBalances(commerce?.schoolStock||[],commerce?.customerStock||[],commerce?.sales||[]).filter(row=>row.owner==='customer'&&row.party===name);
  const deliveries=(commerce?.sales||[]).filter(row=>row.type==='Customer'&&row.party===name&&row.fulfilment!=='reserved');
  const dated=(date:string)=>inFinancialYear(date,year);
  const visibleOrders=customerOrders.filter(row=>dated(row.date));
  const visibleJobs=customerJobs.filter(row=>dated(row.date));
  const visibleInvoices=invoices.filter(row=>dated(row.invoiceDate));
  const visiblePayments=payments.filter(row=>dated(row.date));
  const years=Array.from(new Set([currentFinancialYear(),...customerOrders.map(row=>currentFinancialYear(new Date(row.date))),...customerJobs.map(row=>currentFinancialYear(new Date(row.date))),...invoices.map(row=>currentFinancialYear(new Date(row.invoiceDate)))])).sort().reverse();
  const tabs=['Orders','Job progress','Ready stock','Deliveries',...(allowFinancial?['Bills','Payments','Advances']:[])];

  return <section className="customer-overview">
    <article className="card customer-overview-heading"><div><h2>{name}</h2><p>{customer[0]} · {customer[2]} · {customer[3]||'No phone'} · {customer[4]||'No location'}</p></div><button className="outline" onClick={onBack}>Back to Customers</button></article>
    <div className="filterbar salary-filter"><label>Financial year<select value={year} onChange={event=>setYear(event.target.value)}>{years.map(value=><option key={value}>{value}</option>)}<option value="All">All years</option></select></label><button className="outline" onClick={()=>onNavigate?.('Production',{tab:'general',productionCustomer:name})}>Open Production</button>{allowFinancial&&<button className="primary" onClick={()=>onNavigate?.('Billing & Payments',{tab:'quick',customer:name})}>Create Bill</button>}</div>
    <Stats values={[
      ['Orders',String(visibleOrders.length),'selected year'],
      ['Jobs',String(visibleJobs.length),'selected year'],
      ['Ready stock',`${stock.reduce((sum,row)=>sum+row.available,0)} pcs`,'available now · all years'],
      ...(allowFinancial?[
        ['Billed',money(visibleInvoices.reduce((sum,row)=>sum+row.totalAmount,0)),'net bills · selected year'],
        ['Paid',money(visiblePayments.reduce((sum,row)=>sum+Number(row.amount||0),0)),'payments · selected year'],
        ['Pending',money(pending),'current balance · all years'],
        ['Advance available',money(availableSchoolAdvances(name,commerce?.customerAdvances||[],commerce?.payments||[],new Date().toISOString().slice(0,10)).reduce((sum,row)=>sum+row.available,0)),'unapplied deposits · all years'],
      ]:[]),
    ]}/>
    <nav className="customer-school-tabs" aria-label="Customer overview">{tabs.map(value=><button key={value} className={tab===value?'active':''} onClick={()=>setTab(value)}>{value}</button>)}</nav>
    {tab==='Orders'&&<Table title="Customer orders" copy="Completed quantities include linked Job Card progress." paged sortable headers={['ORDER','DATE','REQUIRED DATE','GARMENTS','ORDERED','COMPLETED','PENDING']} rows={visibleOrders.map(order=>{const required=order.lines.reduce((sum,line)=>sum+line.quantity,0);const completed=order.lines.reduce((sum,_,index)=>sum+lineOrderBalance(order,index,jobs).completed,0);return [order.reference,displayDate(order.date),displayDate(order.requiredDate||''),order.lines.map(line=>`${line.garment} / ${line.size}${line.colour?` / ${line.colour}`:''}`).join(', '),String(required),String(completed),String(Math.max(0,required-completed))];})}/>}
    {tab==='Job progress'&&<Table title="Job progress" copy="Garment quantities completed at each stage." paged sortable headers={['JOB','DATE','GARMENT / SIZE / COLOUR','QUANTITY','CUTTING','STITCHING','FINISHING','STATUS']} rows={visibleJobs.map(job=>[job.reference,displayDate(job.date),[job.garment,job.size,job.colour].filter(Boolean).join(' / '),String(job.quantity),String(stageSummary(job,'cutting').completed),String(stageSummary(job,'stitching').completed),String(stageSummary(job,'finishing').completed),jobStatus(job)])}/>}
    {tab==='Ready stock'&&<Table title="Ready stock" copy="Current customer stock across all years." paged sortable headers={['GARMENT','GENDER','SIZE','COLOUR','ON HAND','RESERVED','AVAILABLE']} rows={stock.map(row=>[row.garment,row.gender,row.size,row.colour||'—',String(row.physical),String(row.reserved),String(row.available)])}/>}
    {tab==='Deliveries'&&<Table title="Deliveries and returns" copy="Delivery movements in the selected year." paged sortable headers={['INVOICE','DATE','GARMENT','SIZE','COLOUR','QUANTITY','STATUS']} rows={deliveries.filter(row=>dated(row.date)).map(row=>[row.invoiceNo,displayDate(row.date),row.garment,row.size,row.colour||'—',String(row.count),row.fulfilment||'delivered'])}/>}
    {allowFinancial&&tab==='Bills'&&<Table title="Customer bills" copy="Current settlement for bills dated in the selected year. Paid includes payments received in later years." paged sortable headers={['INVOICE','DATE','TOTAL','PAID','DISCOUNT / CREDIT','PENDING','STATUS']} rows={visibleInvoices.map(row=>{const linked=payments.filter(payment=>payment.invoiceNo===row.invoiceNo);const paid=linked.reduce((sum,payment)=>sum+Number(payment.amount||0),0);const discount=linked.reduce((sum,payment)=>sum+Number(payment.discount||0),0);const balance=invoiceBalance(row.invoiceNo,row.totalAmount);return [row.invoiceNo,displayDate(row.invoiceDate),money(row.totalAmount),money(paid),money(discount),money(balance),balance===0?'Settled':paid>0?'Partially paid':'Pending'];})}/>}
    {allowFinancial&&tab==='Payments'&&<Table title="Customer payments" copy="Each receipt shows the amount received in that transaction." paged sortable headers={['RECEIPT','DATE','INVOICE','PAID THIS TIME','DISCOUNT THIS TIME','MODE']} rows={visiblePayments.map(row=>[paymentReceiptNumber(row),displayDate(row.date),row.invoiceNo,money(row.amount),money(row.discount||0),row.mode])}/>}
    {allowFinancial&&tab==='Advances'&&<CustomerAdvances customer={name}/>}
  </section>;
}
