import type { InvoicePayment } from './types';
import { cashInvoicePayments } from './income';

// Keep stable internal IDs for ledger ownership; expose a readable document number.
export function paymentReceiptNumber(payment:InvoicePayment):string {
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
