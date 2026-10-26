import type { Invoice, InvoicePayment } from './types';
import { cashInvoicePayments } from './income';

// Keep stable internal IDs for ledger ownership; expose a readable document number.
export function paymentReceiptNumber(payment:InvoicePayment):string {
  if(payment.receiptNo)return payment.receiptNo;
  if(!payment.id.startsWith('retail:'))return payment.id;
  const prefix=payment.refund?'REF':payment.mode==='Return credit'?'SET':'RCP';
  const invoice=payment.invoiceNo.replace(/^CR-/, '');
  return `${prefix}-${invoice.replace(/^QS-/, '')}`;
}

export function schoolCashReceipts(payments:InvoicePayment[],collections:string[][],schoolNames:string[]) {
  const names=new Set([...schoolNames,...collections.map(row=>row[2])]);
  const direct=cashInvoicePayments(payments,collections).filter(payment=>names.has(payment.customer));
  return [
    ...collections.map(collection=>({number:collection[0],date:collection[1],school:collection[2],mode:collection[3],amount:Number((String(collection[4]||'').match(/\d[\d,]*(?:\.\d+)?/)?.[0]||'0').replace(/,/g,'')),remarks:collection[5]||'',collection,payment:undefined as InvoicePayment|undefined})),
    ...direct.map(payment=>({number:paymentReceiptNumber(payment),date:payment.date,school:payment.customer,mode:payment.mode,amount:Number(payment.amount),remarks:payment.remarks,payment,collection:undefined as string[]|undefined}))
  ];
}

export function nextPaymentNumber(payments:InvoicePayment[]):string {
 const next=payments.reduce((max,row)=>Math.max(max,Number(/^PAY-(\d+)$/.exec(row.receiptNo||row.id)?.[1]||0)),0)+1;
 return `PAY-${String(next).padStart(6,'0')}`;
}
export function numberLegacyPayments(payments:InvoicePayment[]):InvoicePayment[] {
 let numbered=[...payments];
 for(const payment of [...payments].filter(row=>row.id.startsWith('IP-')&&!row.receiptNo).sort((a,b)=>a.id.localeCompare(b.id))){
  const receiptNo=nextPaymentNumber(numbered);numbered=numbered.map(row=>row.id===payment.id?{...row,receiptNo}:row);
 }
 return numbered;
}

/** Current invoice balances; a receipt amount is intentionally not cumulative paid. */
export function receiptInvoiceTotals(invoiceNos:string[],invoices:Invoice[],payments:InvoicePayment[]) {
 const linked=invoices.filter(invoice=>new Set(invoiceNos).has(invoice.invoiceNo));
 if(!linked.length)return null;
 return {total:linked.reduce((sum,invoice)=>sum+invoice.totalAmount,0),pending:linked.reduce((sum,invoice)=>sum+Math.max(0,invoice.totalAmount-payments.filter(payment=>payment.invoiceNo===invoice.invoiceNo).reduce((paid,payment)=>paid+Number(payment.amount||0)+Number(payment.discount||0),0)),0)};
}

export function validatePaymentEntry(amount:number,discount:number,balance:number){
 if(!Number.isFinite(amount)||!Number.isFinite(discount)||amount<0||discount<0)throw Error('Payment and discount must be valid non-negative amounts.');
 if(amount+discount<=0)throw Error('Enter an amount to receive or an explicitly agreed discount.');
 if(Math.round((amount+discount)*100)>Math.round(balance*100))throw Error('Payment plus discount cannot exceed the pending balance.');
}
export function paymentBalanceHistory(invoice:Invoice,payments:InvoicePayment[]){
 const chronological=payments.filter(row=>row.invoiceNo===invoice.invoiceNo).map((payment,index)=>({payment,index})).sort((a,b)=>{
  const day=a.payment.date.localeCompare(b.payment.date);if(day)return day;
  const order=(row:InvoicePayment)=>row.id.startsWith('retail:')?0:row.createdAt?4:row.id.startsWith('IP-')?1:/^PAY-/.test(row.id)?2:3;
  return order(a.payment)-order(b.payment)||(a.payment.createdAt||a.payment.id).localeCompare(b.payment.createdAt||b.payment.id,undefined,{numeric:true})||b.index-a.index;
 });
 let settled=0,cash=0;
 return chronological.map(({payment})=>{const balanceBefore=Math.max(0,invoice.totalAmount-settled);const paidBefore=cash;cash+=Number(payment.amount||0);settled+=Number(payment.amount||0)+Number(payment.discount||0);return {payment,balanceBefore,paidBefore,paidToDate:cash,balanceAfter:Math.max(0,Math.round((invoice.totalAmount-settled)*100)/100)};});
}
