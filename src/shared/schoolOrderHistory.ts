import type { BulkOrder } from './bulkOrders';
import type { StockSale, Student } from './types';
export type OrderDelivery={date:string;invoice:string;quantity:number};
export type SchoolOrderRow={id:string;reference:string;date:string;year:string;gender:string;garment:string;size:string;required:number;delivered:number;pendingDel:number;deliveries:OrderDelivery[]};
const yearOf=(date:string)=>{const year=Number(date.slice(0,4));return Number(date.slice(5,7))>=4?`${year}-${String(year+1).slice(-2)}`:`${year-1}-${String(year).slice(-2)}`;};
const normalizeYear=(year:string)=>year.includes('-')?year:`${year}-${String(Number(year)+1).slice(-2)}`;
const key=(row:{gender:string;garment:string;size:string})=>JSON.stringify([row.gender||'Boys',row.garment,row.size]);
export function schoolOrderHistory(school:string,orders:BulkOrder[],students:Student[],sales:StockSale[]){
 const rows:SchoolOrderRow[]=[];
 const timestamps=new Map<string,string>();
 for(const order of orders.filter(order=>order.school===school&&order.mode==='additional')){
  order.lines.forEach((line,index)=>{timestamps.set(`${order.id}:${index}`,order.createdAt||'');rows.push({id:`${order.id}:${index}`,reference:order.reference,date:order.createdAt?.slice(0,10)||'',year:normalizeYear(order.year),gender:line.gender,garment:line.garment,size:line.size,required:line.quantity,delivered:0,pendingDel:line.quantity,deliveries:[]});});
 }
 // Individual measurements have no reliable order reference: keep their original date/batch grouped as previous records.
 for(const student of students.filter(student=>student.school===school))for(const [garment,size] of Object.entries(student.sizes||{})){
  if(!garment||!size)continue;const gender=student.gender||'Boys',year=normalizeYear(student.year||yearOf(student.date||new Date().toISOString().slice(0,10))),date=student.date||'';
  const id=JSON.stringify(['previous',year,student.batch||date,gender,garment,size]);let row=rows.find(row=>row.id===id);
  if(!row){row={id,reference:student.batch?`Previous records / ${student.batch}`:'Previous records',date,year,gender,garment,size,required:0,delivered:0,pendingDel:0,deliveries:[]};rows.push(row);}row.required++;row.pendingDel++;
 }
 rows.sort((a,b)=>(timestamps.get(a.id)||a.date).localeCompare(timestamps.get(b.id)||b.date)||a.id.localeCompare(b.id));
 const unmatched=new Map<string,{gender:string;garment:string;size:string;year:string;deliveries:OrderDelivery[]}>();
 for(const sale of sales.filter(sale=>sale.type==='School'&&sale.party===school&&sale.fulfilment!=='reserved').slice().sort((a,b)=>a.date.localeCompare(b.date)||Number(a.count<0)-Number(b.count<0)||a.id.localeCompare(b.id))){
  const items=sale.items?.length?sale.items.map(item=>({...item,gender:item.gender||sale.gender||'Boys'})):[{garment:sale.garment,size:sale.size,gender:sale.gender||'Boys',qty:sale.count}];
  for(const item of items){let remaining=item.qty;
   const candidates=rows.filter(row=>key(row)===key(item)&&(!row.date||row.date<=sale.date));
   if(remaining>0)for(const row of candidates){const quantity=Math.min(row.pendingDel,remaining);if(quantity<=0)continue;row.deliveries.push({date:sale.date,invoice:sale.invoiceNo,quantity});row.delivered+=quantity;row.pendingDel-=quantity;remaining-=quantity;}
   // Credit notes reverse their original invoice allocation, including excess deliveries.
   if(remaining<0){
    const original=sale.invoiceNo.startsWith('CR-')?sale.invoiceNo.slice(3):'';
    for(const prior of unmatched.values())if(key(prior)===key(item)){
     const available=prior.deliveries.filter(entry=>!original||entry.invoice===original||entry.invoice===sale.invoiceNo).reduce((sum,entry)=>sum+entry.quantity,0);
     const quantity=Math.min(Math.max(0,available),-remaining);if(quantity){prior.deliveries.push({date:sale.date,invoice:sale.invoiceNo,quantity:-quantity});remaining+=quantity;}
    }
    for(const row of candidates.slice().reverse()){
     const available=original?row.deliveries.filter(entry=>entry.invoice===original||entry.invoice===sale.invoiceNo).reduce((sum,entry)=>sum+entry.quantity,0):row.delivered;
     const quantity=Math.min(Math.max(0,available),-remaining);if(quantity<=0)continue;row.deliveries.push({date:sale.date,invoice:sale.invoiceNo,quantity:-quantity});row.delivered-=quantity;row.pendingDel+=quantity;remaining+=quantity;
    }
   }
   if(remaining){const id=JSON.stringify([yearOf(sale.date),key(item)]);const prior=unmatched.get(id)||{...item,year:yearOf(sale.date),deliveries:[]};prior.deliveries.push({date:sale.date,invoice:sale.invoiceNo,quantity:remaining});unmatched.set(id,prior);}
  }
 }
 return {orders:rows,unmatched:Array.from(unmatched.values())};
}
