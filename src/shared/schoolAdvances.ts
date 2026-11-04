import type { InvoicePayment } from './types';

const cents = (value:number) => Math.round(value * 100);
const receiptAmount = (value:string) => Number((String(value || '').match(/-?\d[\d,]*(?:\.\d+)?/)?.[0] || '0').replace(/,/g, ''));
export const cashPaymentAmount = (payment:InvoicePayment) => Math.round((payment.amount - (payment.advanceAmount || 0)) * 100) / 100;

export function availableSchoolAdvances(school:string, collections:string[][], payments:InvoicePayment[], date:string) {
  const receipts = collections.filter(row => row[2] === school && row[1] <= date);
  return receipts.map(row => {
    // Existing invoice collections already have payment allocations. Any unallocated remainder is a deposit.
    const allocated = payments.filter(payment => payment.customer === school && payment.reference === row[0] && payment.date === row[1])
      .reduce((sum, payment) => sum + cents(cashPaymentAmount(payment)), 0);
    const applied = payments.filter(payment => payment.customer === school).reduce((sum, payment) =>
      sum + (payment.advanceSources || []).filter(source => source.receipt === row[0]).reduce((total, source) => total + cents(source.amount), 0), 0);
    return { receipt: row[0], date: row[1], available: Math.max(0, cents(receiptAmount(row[4])) - allocated - applied) / 100 };
  }).filter(row => row.available > 0).sort((a,b) => a.date.localeCompare(b.date) || a.receipt.localeCompare(b.receipt));
}

export function allocateSchoolAdvance(school:string, amount:number, collections:string[][], payments:InvoicePayment[], date:string) {
  if (!Number.isFinite(amount) || amount < 0) throw Error('Enter a valid advance amount.');
  let remaining = cents(amount);
  const sources:{receipt:string;amount:number}[] = [];
  for (const receipt of availableSchoolAdvances(school, collections, payments, date)) {
    const applied = Math.min(remaining, cents(receipt.available));
    if (applied > 0) sources.push({receipt:receipt.receipt, amount:applied / 100});
    remaining -= applied;
  }
  if (remaining > 0) throw Error('The available school advance has changed. Reduce the advance amount and try again.');
  return sources;
}
