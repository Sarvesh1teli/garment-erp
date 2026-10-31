import { useMemo, useState } from 'react';
import type { BulkOrder } from './bulkOrders';
import type { Student, StockSale } from './types';
import { schoolOrderHistory, type OrderDelivery } from './schoolOrderHistory';
import { Table } from './ui';
import { displayDate } from './dateDisplay';
export function SchoolOrderHistoryView({school,orders,students,sales,year,gender,garment,size}:{school:string;orders:BulkOrder[];students:Student[];sales:StockSale[];year:string;gender:string;garment:string;size:string}){
 const [tab,setTab]=useState('active'),[detail,setDetail]=useState<{title:string;deliveries:OrderDelivery[]}|null>(null);
 const history=useMemo(()=>schoolOrderHistory(school,orders,students,sales),[school,orders,students,sales]);
 const matches=(row:{year:string;gender:string;garment:string;size:string})=>(year==='All'||year===row.year)&&(gender==='All'||gender===row.gender)&&(garment==='All'||garment===row.garment)&&(size==='All'||size===row.size);
 const filtered=history.orders.filter(matches),active=filtered.filter(row=>row.pendingDel>0),completed=filtered.filter(row=>row.pendingDel===0);
 const shown=tab==='active'?active:completed;
 const orderRows=shown.map(row=>[row.reference,row.date?displayDate(row.date):'Previous records',row.gender,row.garment,row.size,String(row.required),String(row.delivered),String(row.pendingDel),row.pendingDel===0?'Completed':row.delivered>0?'Partially Delivered':'Pending']);
 const groups=new Map<string,{gender:string;garment:string;size:string;deliveries:OrderDelivery[]}>();
 for(const row of [...filtered,...history.unmatched.filter(matches)]){const id=JSON.stringify([row.gender,row.garment,row.size]);const group=groups.get(id)||{gender:row.gender,garment:row.garment,size:row.size,deliveries:[]};group.deliveries.push(...row.deliveries);groups.set(id,group);}
 const summaries=Array.from(groups.values()).filter(row=>row.deliveries.length);
 return <section className="school-order-history"><div className="inventory-line-tabs" role="tablist" aria-label="School order history">{[['active',`Active Orders (${active.length})`],['history',`Order History (${completed.length})`],['deliveries','Delivery Summary']].map(([value,label])=><button key={value} role="tab" aria-selected={tab===value} className={tab===value?'active':''} onClick={()=>setTab(value)}>{label}</button>)}</div>
 <p className="school-order-note">Deliveries are allocated to the oldest pending order first. Completed orders stay in history; partially delivered orders remain active.</p>
 {tab==='deliveries'?<Table title="Delivery Summary" copy="Combined deliveries by garment and size. Click a row for delivery dates and invoices." headers={['GENDER','GARMENT','SIZE','TOTAL DELIVERED']} rows={summaries.map(row=>[row.gender,row.garment,row.size,String(row.deliveries.reduce((sum,item)=>sum+item.quantity,0))])} paged sortable onRowClick={cells=>{const row=summaries.find(row=>row.gender===cells[0]&&row.garment===cells[1]&&row.size===cells[2]);if(row)setDetail({title:`${row.garment} / ${row.size}`,deliveries:row.deliveries});}}/>:
 <Table title={tab==='active'?'Active Orders':'Completed Order History'} copy="Separate order references remain separate, including repeat orders for the same garment and size." headers={['ORDER','ORDER DATE','GENDER','GARMENT','SIZE','ORDERED','DELIVERED','PENDING','STATUS']} rows={orderRows} paged sortable actions={cells=>{const row=shown[orderRows.indexOf(cells)];return row?<><button className="outline" onClick={()=>setDetail({title:`${row.reference} — ${row.garment} / ${row.size}`,deliveries:row.deliveries})}>Delivery details</button></>:null;}}/>}
 {detail&&<div className="stock-modal-overlay" onClick={()=>setDetail(null)}><article className="card entry-modal" role="dialog" aria-modal="true" aria-label="Order delivery details" onClick={event=>event.stopPropagation()}><div className="form-title"><div><h2>{detail.title}</h2><p>Delivery dates, quantities and original invoice references.</p></div><button className="outline" onClick={()=>setDetail(null)}>Close</button></div><Table title="Delivery details" copy="Original billing records are unchanged." headers={['DELIVERY DATE','INVOICE','QUANTITY']} rows={detail.deliveries.map(item=>[displayDate(item.date),item.invoice,String(item.quantity)])} paged sortable/></article></div>}
 </section>;
}
