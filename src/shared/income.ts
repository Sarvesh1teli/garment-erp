import type { Invoice, InvoicePayment } from './types';

export type IncomeEntry = {date:string;type:string;ref:string;party:string;description:string;mode:string;amount:number};

// A school receipt is the cash source; invoice allocations only settle its bills.
export function cashInvoicePayments(payments:InvoicePayment[], collections:string[][]):InvoicePayment[] {
  const normalize=(value:string)=>String(value||'').trim().toLowerCase();
  const receiptKey=(ref:string,party:string,date:string)=>JSON.stringify([normalize(ref),normalize(party),date]);
  const receipts=new Set(collections.filter(row=>row[0]?.trim()).map(row=>receiptKey(row[0],row[2],row[1])));
  return payments.filter(payment=>
    (Number(payment.amount)>0 || (payment.refund===true&&Number(payment.amount)<0)) && normalize(payment.mode)!=='advance adjustment' &&
    !receipts.has(receiptKey(payment.reference,payment.customer,payment.date))
  );
}

export function buildIncomeEntries(invoices:Invoice[], payments:InvoicePayment[], collections:string[][]):IncomeEntry[] {
  const invoiceEntries=cashInvoicePayments(payments,collections).map(payment=>({
    date:payment.date,type:'Invoice Payment',ref:payment.invoiceNo,party:payment.customer,
    description:invoices.find(invoice=>invoice.invoiceNo===payment.invoiceNo)?.product||'Invoice payment',
    mode:payment.mode,amount:Number(payment.amount)
  }));
  const schoolEntries=collections.map(row=>({
    date:row[1],type:'School Collection',ref:row[0],party:row[2],
    description:row[5]&&row[5]!=='-'?row[5]:'School collection',mode:row[3],
    amount:Number((String(row[4]||'').match(/\d[\d,]*(?:\.\d+)?/)?.[0]||'0').replace(/,/g,''))
  })).filter(row=>row.amount>0);
  return [...invoiceEntries,...schoolEntries];
}
