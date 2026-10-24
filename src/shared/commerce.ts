import type { CustomerStock, Invoice, InvoiceItem, InvoicePayment, SchoolStock, StockSale } from './types';

export type BusinessMode='shop'|'school'|'both';
export type StockOwner='general'|'school'|'customer';
export type ReadyBalance={colour?:string;key:string;owner:StockOwner;party:string;gender:string;garment:string;size:string;added:number;physical:number;reserved:number;available:number};
export type RetailLine={colour?:string;stockKey:string;owner:StockOwner;party:string;gender:string;garment:string;size:string;quantity:number;rate:number};
export type RetailSale={id:string;invoice:Invoice;legacyInvoice?:boolean;lines:RetailLine[];payment?:InvoicePayment;status:'reserved'|'dispatched'|'returned'|'cancelled';dispatchDate?:string;returnDate?:string;refund?:InvoicePayment;credit?:InvoicePayment;reason?:string};
export type QuickSaleDraft={reuseInvoiceNo?:string;date:string;customer:string;phone:string;mode:'Cash'|'UPI'|'Bank'|'Credit';dispatch:'now'|'later';tax:number;amountReceived?:number;discount?:number;discountType?:'flat'|'percentage';lines:{stockKey:string;quantity:number;rate:number}[]};
export const stockKey=(owner:StockOwner,party:string,gender:string,garment:string,size:string,colour='')=>JSON.stringify(colour.trim()?[owner,party,gender,garment,size,colour.trim().toLowerCase()]:[owner,party,gender,garment,size]);
export const isRetailRecord=(value:string)=>value.startsWith('retail:');
export const retailInvoiceNumbers=(ledger:RetailSale[],includeLegacy=false)=>new Set(ledger.flatMap(sale=>[...(!sale.legacyInvoice||includeLegacy?[sale.invoice.invoiceNo]:[]),...(sale.returnDate?[`CR-${sale.invoice.invoiceNo}`]:[])]));

export function projectRetail(ledger:RetailSale[],extraPayments:InvoicePayment[]=[]){
  const invoices:Invoice[]=[],payments:InvoicePayment[]=[],sales:StockSale[]=[];
  for(const sale of ledger){
    if(sale.payment)payments.push(sale.payment);
    if(sale.refund)payments.push(sale.refund);
    if(sale.credit)payments.push(sale.credit);
    const paid=[...extraPayments,...payments.filter(row=>row.invoiceNo===sale.invoice.invoiceNo)].filter(row=>row.invoiceNo===sale.invoice.invoiceNo).reduce((sum,row)=>sum+row.amount+(row.discount||0),0);
    if(!sale.legacyInvoice)invoices.push({...sale.invoice,status:paid>=sale.invoice.totalAmount?'Paid':paid>0?'Partially Paid':'Pending'});
    if(sale.returnDate){
      invoices.push({...sale.invoice,invoiceNo:`CR-${sale.invoice.invoiceNo}`,invoiceDate:sale.returnDate,product:`Credit note for ${sale.invoice.invoiceNo}`,qty:-sale.invoice.qty,taxableAmount:-sale.invoice.taxableAmount,totalAmount:-sale.invoice.totalAmount,status:'Paid',items:sale.invoice.items?.map(row=>({...row,qty:-row.qty,amount:-row.amount})),terms:sale.reason||'Full return / cancellation credit note.'});
    }
    if(sale.status==='cancelled')continue;
    const first=sale.lines[0];if(!first)continue;
    const items:InvoiceItem[]=sale.lines.map(row=>({colour:row.colour,gender:row.gender,garment:row.garment,size:row.size,qty:row.quantity,rate:row.rate,amount:round(row.quantity*row.rate)}));
    const issued:StockSale={id:`retail:${sale.id}`,date:sale.dispatchDate||sale.invoice.invoiceDate,type:first.owner==='customer'?'Customer':'School',party:first.party,gender:first.gender,garment:items.map(row=>row.garment).join(', '),size:items.map(row=>row.size).join(', '),count:sale.invoice.qty,rate:0,total:sale.invoice.totalAmount,invoiceNo:sale.invoice.invoiceNo,remarks:sale.status==='reserved'?'Reserved for later delivery':'Quick Sale dispatch',items,fulfilment:sale.status==='reserved'?'reserved':'delivered'};
    sales.push(issued);
    if(sale.status==='returned')sales.push({...issued,id:`retail:${sale.id}:return`,invoiceNo:`CR-${sale.invoice.invoiceNo}`,date:sale.returnDate!,count:-issued.count,total:-issued.total,items:items.map(row=>({...row,qty:-row.qty,amount:-row.amount})),remarks:'Full return — stock restored',fulfilment:'returned'});
  }
  return {invoices,payments,sales};
}
const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

export function readyBalances(school:SchoolStock[],customer:CustomerStock[],sales:StockSale[]):ReadyBalance[]{
  const groups=new Map<string,ReadyBalance>();
  const add=(owner:StockOwner,party:string,gender:string,garment:string,size:string,qty:number,colour='')=>{
    const key=stockKey(owner,party,gender,garment,size,colour),current=groups.get(key);
    if(current){current.added+=qty;current.physical+=qty;}else groups.set(key,{key,owner,party,gender,garment,size,colour:colour.trim(),added:qty,physical:qty,reserved:0,available:qty});
  };
  school.forEach(row=>add(row.school?'school':'general',row.school||'',row.gender||'Common',row.garment,row.size,Number(row.count)||0,row.colour));
  customer.forEach(row=>add('customer',row.customer,row.gender||'Common',row.garment,row.size,Number(row.count)||0,row.colour));
  for(const sale of sales){
    const owner:StockOwner=sale.type==='Customer'?'customer':sale.party?'school':'general';
    for(const item of sale.items?.length?sale.items:[{garment:sale.garment,size:sale.size,gender:sale.gender,qty:sale.count,colour:sale.colour}]){
      let matches=Array.from(groups.values()).filter(row=>row.owner===owner&&row.party===sale.party&&row.garment===item.garment&&row.size===item.size);
      const colour=item.colour??sale.colour;
      if(colour!==undefined)matches=matches.filter(row=>(row.colour||'').trim().toLowerCase()===colour.trim().toLowerCase());
      else {const uncoloured=matches.filter(row=>!row.colour);if(uncoloured.length)matches=uncoloured;}
      const gender=item.gender||sale.gender;
      const exact=gender?matches.filter(row=>row.gender===gender):[];if(exact.length)matches=exact;
      let remaining=Number(item.qty)||0;
      for(let index=0;index<matches.length;index++){
        const row=matches[index],available=row.physical-row.reserved;
        const take=index===matches.length-1?remaining:remaining>=0?Math.min(remaining,Math.max(0,available)):remaining;
        if(sale.fulfilment==='reserved')row.reserved+=take;else row.physical-=take;
        remaining-=take;if(!remaining)break;
      }
    }
  }
  return Array.from(groups.values()).map(row=>({...row,available:Math.max(0,round(row.physical-row.reserved))}));
}

export function createRetailSale(ledger:RetailSale[],balances:ReadyBalance[],existingInvoices:Invoice[],draft:QuickSaleDraft,id:string):RetailSale{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||!draft.lines.length)throw Error('Select a date and add at least one garment.');
  if(!Number.isFinite(draft.tax)||draft.tax<0||draft.tax>100)throw Error('Enter a tax percentage between 0 and 100.');
  const requested=new Map<string,number>();
  const lines:RetailLine[]=draft.lines.map((row,index)=>{
    const stock=balances.find(item=>item.key===row.stockKey);
    if(!stock||!Number.isSafeInteger(row.quantity)||row.quantity<=0||!Number.isFinite(row.rate)||row.rate<0)throw Error(`Row ${index+1}: select available stock, whole quantity and valid price.`);
    requested.set(stock.key,(requested.get(stock.key)||0)+row.quantity);
    if(requested.get(stock.key)!>stock.available)throw Error(`Only ${stock.available} available for ${stock.garment}, size ${stock.size}.`);
    return {stockKey:stock.key,colour:stock.colour,owner:stock.owner,party:stock.party,gender:stock.gender,garment:stock.garment,size:stock.size,quantity:row.quantity,rate:round(row.rate)};
  });
  const first=lines[0];if(lines.some(row=>row.owner!==first.owner||row.party!==first.party))throw Error('Use one stock owner per bill.');
  const gross=round(lines.reduce((sum,row)=>sum+row.quantity*row.rate,0));
  const enteredDiscount=draft.discount??0;
  if(!Number.isFinite(enteredDiscount)||enteredDiscount<0||(draft.discountType==='percentage'&&enteredDiscount>100))throw Error('Enter a valid discount.');
  const discount=round(draft.discountType==='percentage'?gross*enteredDiscount/100:enteredDiscount);
  if(discount>gross)throw Error('Discount cannot exceed the bill subtotal.');
  if(draft.reuseInvoiceNo&&discount>0)throw Error('Discount cannot be changed while dispatching an existing invoice.');
  const taxable=round(gross-discount),total=round(taxable*(1+draft.tax/100));
  if(total<=0)throw Error('Enter the selling price.');
  const received=draft.mode==='Credit'?0:round(draft.amountReceived??total);
  if(!Number.isFinite(received)||received<0||received>total)throw Error('Amount received must be between zero and the bill total.');
  const numbers=[...existingInvoices,...ledger.map(row=>row.invoice)];
  const next=numbers.reduce((max,row)=>Math.max(max,Number(/^QS-(\d+)$/i.exec(row.invoiceNo)?.[1]||0)),0)+1;
  const invoiceNo=`QS-${String(next).padStart(6,'0')}`,customer=first.owner==='general'?(draft.customer.trim()||'Walk-in Customer'):first.party;
  const items=lines.map(row=>({colour:row.colour,gender:row.gender,garment:row.garment,size:row.size,qty:row.quantity,rate:row.rate,amount:round(row.quantity*row.rate)}));
  const invoice:Invoice={invoiceNo,invoiceDate:draft.date,dueDate:'',state:'',reverseCharge:'NO',customer,customerPhone:draft.phone.trim(),customerGst:'',customerAddress:'',shipTo:customer,shipAddress:'',shipGst:'',product:items.map(row=>`${row.garment} (${row.size})${row.colour?` / ${row.colour}`:''}`).join(', '),hsn:'',qty:lines.reduce((sum,row)=>sum+row.quantity,0),unit:'PCS',rate:0,cgst:draft.tax/2,sgst:draft.tax/2,gstPercent:draft.tax,taxableAmount:taxable,totalAmount:total,status:received>=total?'Paid':received>0?'Partially Paid':'Pending',terms:'Goods sold from available ready stock.',discount,discountType:'flat',grossAmount:gross,items};
  if(draft.reuseInvoiceNo){
    const existing=existingInvoices.find(row=>row.invoiceNo===draft.reuseInvoiceNo);
    if(!existing||ledger.some(row=>row.invoice.invoiceNo===draft.reuseInvoiceNo))throw Error('This invoice is unavailable or already linked to a dispatch.');
    if(existing.customer!==customer||existing.qty!==invoice.qty||Math.abs(existing.taxableAmount-taxable)>.01)throw Error('Customer, stock quantities and prices must match the existing invoice.');
    if(existing.items?.length){
      const quantities=(rows:{garment:string;size:string;qty:number}[])=>{const groups=new Map<string,number>();for(const row of rows){const key=JSON.stringify([row.garment,row.size]);groups.set(key,(groups.get(key)||0)+row.qty);}return JSON.stringify(Array.from(groups).sort());};
      if(quantities(existing.items)!==quantities(items))throw Error('Garments and sizes must match the existing invoice.');
    }
    return {id,invoice:{...existing},legacyInvoice:true,lines,status:draft.dispatch==='now'?'dispatched':'reserved',dispatchDate:draft.dispatch==='now'?draft.date:undefined};
  }
  return {id,invoice,lines,status:draft.dispatch==='now'?'dispatched':'reserved',dispatchDate:draft.dispatch==='now'?draft.date:undefined,payment:received===0?undefined:{id:`retail:${id}:payment`,date:draft.date,invoiceNo,customer,mode:draft.mode,amount:received,reference:invoiceNo,remarks:'Quick Sale payment'}};
}

export function closeRetailSale(sale:RetailSale[],id:string,action:'dispatch'|'return',date:string,payments:InvoicePayment[],reason=''):RetailSale[]{
  const current=sale.find(row=>row.id===id);if(!current)throw Error('Sale not found.');
  if(action==='dispatch'){
    if(current.status!=='reserved')throw Error('This bill has already been dispatched or closed.');
    return sale.map(row=>row.id===id?{...row,status:'dispatched',dispatchDate:date}:row);
  }
  if(current.status!=='reserved'&&current.status!=='dispatched')throw Error('This bill has already been returned or cancelled.');
  const paid=round(payments.filter(row=>row.invoiceNo===current.invoice.invoiceNo).reduce((sum,row)=>sum+row.amount,0));
  const settled=payments.filter(row=>row.invoiceNo===current.invoice.invoiceNo).reduce((sum,row)=>sum+row.amount+(row.discount||0),0);
  return sale.map(row=>row.id!==id?row:{...row,status:row.status==='reserved'?'cancelled':'returned',returnDate:date,reason:reason.trim()||'Full return / cancellation',refund:paid>0?{id:`retail:${id}:refund`,date,invoiceNo:`CR-${row.invoice.invoiceNo}`,customer:row.invoice.customer,mode:'Refund',amount:-paid,reference:row.invoice.invoiceNo,remarks:reason||'Full sale refund',refund:true}:undefined,credit:settled<row.invoice.totalAmount?{id:`retail:${id}:credit`,date,invoiceNo:row.invoice.invoiceNo,customer:row.invoice.customer,mode:'Return credit',amount:0,discount:round(row.invoice.totalAmount-settled),reference:`CR-${row.invoice.invoiceNo}`,remarks:'Credit note settlement; not a cash discount'}:undefined});
}
