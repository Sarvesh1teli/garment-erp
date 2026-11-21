import { materialKey, moveMaterialStock, type MaterialRow } from './materialStock';
import { currentFinancialYear } from './financialYear';

export type PurchasePayment={id:string;date:string;amount:number;mode:string;expenseId?:string;expenseNumber?:string};
export function purchaseExpenseNumbers(purchases:MaterialPurchase[]){
  const numbers=new Map<string,string>();
  const payments=purchases.slice().sort((a,b)=>a.number.localeCompare(b.number)).flatMap(row=>row.payments).filter(row=>!row.expenseId);
  const used=new Set(payments.flatMap(row=>row.expenseNumber?[row.expenseNumber]:[]));
  let next=1;
  for(const payment of payments){
    if(payment.expenseNumber){numbers.set(payment.id,payment.expenseNumber);continue;}
    while(used.has(`PEX-${String(next).padStart(6,'0')}`))next++;
    const number=`PEX-${String(next++).padStart(6,'0')}`;used.add(number);numbers.set(payment.id,number);
  }
  return numbers;
}
export type MaterialPurchase={id:string;number:string;date:string;item:string;subcategory:string;unit:string;quantity:number;vendorId:string;vendor:string;rate:number;total:number;bill:string;remarks:string;payments:PurchasePayment[];rateChanges?:{at:string;before:number;after:number;reason:string}[]};
export function correctPurchaseRate(purchase:MaterialPurchase,rate:number,reason:string){
  if(!Number.isFinite(rate)||rate<=0||Math.abs(rate*100-Math.round(rate*100))>0.000001)throw Error('Enter a positive rate with up to two decimals.');
  if(!reason.trim())throw Error('Enter a reason for this rate correction.');
  const total=Math.round(purchase.quantity*rate*100)/100;
  if(total<purchasePaid(purchase))throw Error('The corrected total cannot be below payments already recorded.');
  if(rate===purchase.rate)return purchase;
  return {...purchase,rate,total,rateChanges:[...(purchase.rateChanges||[]),{at:new Date().toISOString(),before:purchase.rate,after:rate,reason:reason.trim()}]};
}
export const purchasePaid=(purchase:MaterialPurchase)=>Math.round(purchase.payments.reduce((sum,row)=>sum+row.amount,0)*100)/100;
export const purchasePending=(purchase:MaterialPurchase)=>Math.max(0,Math.round((purchase.total-purchasePaid(purchase))*100)/100);
const amountValid=(value:number)=>Number.isFinite(value)&&value>=0&&Math.abs(value*100-Math.round(value*100))<0.000001;
export function addPurchase(purchases:MaterialPurchase[],items:MaterialRow[],vendors:string[][],expenses:string[][],draft:Omit<MaterialPurchase,'number'|'unit'|'total'|'vendor'>){
  if(purchases.some(row=>row.id===draft.id))return purchases;
  const vendor=vendors.find(row=>row[0]===draft.vendorId);
  const material=items.find(row=>materialKey(row[1],row[2])===materialKey(draft.item,draft.subcategory));
  if(!vendor||!material)throw Error('Select a current vendor, material and subcategory.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||!amountValid(draft.rate)||draft.rate<=0)throw Error('Enter a date and positive purchase rate with up to two decimals.');
  moveMaterialStock(items,draft.item,draft.subcategory,draft.quantity);
  if(draft.quantity<=0)throw Error('Enter a positive purchase quantity.');
  if(draft.bill.trim()&&purchases.some(row=>row.vendorId===draft.vendorId&&row.bill.trim().toLowerCase()===draft.bill.trim().toLowerCase()))throw Error('This vendor bill is already linked to a purchase.');
  const next=purchases.reduce((max,row)=>Math.max(max,Number(/^PUR-(\d+)$/.exec(row.number)?.[1]||0)),0)+1;
  let purchase:MaterialPurchase={...draft,vendor:vendor[1],unit:material[3],total:Math.round(draft.quantity*draft.rate*100)/100,number:`PUR-${String(next).padStart(6,'0')}`,payments:[]};
  for(const payment of draft.payments)purchase=addPurchasePayment(purchase,payment,purchases,expenses);
  return [purchase,...purchases];
}
export function addPurchasePayment(purchase:MaterialPurchase,payment:PurchasePayment,purchases:MaterialPurchase[],expenses:string[][]){
  if(purchase.payments.some(row=>row.id===payment.id))return purchase;
  if(!amountValid(payment.amount)||payment.amount<=0||payment.amount>purchasePending(purchase))throw Error('Payment must be positive and cannot exceed the pending purchase amount.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(payment.date)||payment.date<purchase.date||!['Cash','UPI','Bank'].includes(payment.mode))throw Error('Select a valid payment date and mode.');
  if(payment.expenseId){
    const expense=expenses.find(row=>row[0]===payment.expenseId);
    const value=Number((String(expense?.[6]||'').match(/-?\d[\d,]*(?:\.\d+)?/)?.[0]||'0').replace(/,/g,''));
    if(!expense||expense[1]!==purchase.vendor||expense[5]!==payment.date||expense[7]!==payment.mode||value!==payment.amount||!['Material Purchase','Accessories Purchase'].includes(expense[3]))throw Error('The linked expense must match the vendor, date, mode and paid amount.');
    if([...purchases,purchase].some(row=>row.payments.some(entry=>entry.expenseId===payment.expenseId)))throw Error('This expense is already linked to a purchase.');
  }
  const numbers=purchaseExpenseNumbers([...purchases.filter(row=>row.id!==purchase.id),purchase]);
  const highest=Math.max(Array.from(numbers.values()).reduce((max,value)=>Math.max(max,Number(value.slice(4))),0),expenses.reduce((max,row)=>Math.max(max,Number(/^(?:EXP|PEX)-(\d+)$/.exec(row[9]||row[0])?.[1]||0)),0));
  return {...purchase,payments:[...purchase.payments,{...payment,expenseNumber:payment.expenseId?undefined:`PEX-${String(highest+1).padStart(6,'0')}`}]};
}
export function purchaseItems(items:MaterialRow[],purchases:MaterialPurchase[],direction=1):MaterialRow[]{
  const totals=new Map<string,number>();
  for(const row of purchases){const key=materialKey(row.item,row.subcategory);totals.set(key,(totals.get(key)||0)+row.quantity);}
  for(const key of totals.keys())if(!items.some(row=>materialKey(row[1],row[2])===key))throw Error('A purchased material cannot be removed.');
  return items.map(row=>[row[0],row[1],row[2],row[3],String(Number((Number(row[4])+direction*(totals.get(materialKey(row[1],row[2]))||0)).toPrecision(15)))]);
}
export const purchaseReceipts=(purchases:MaterialPurchase[])=>purchases.map(row=>[`PIN-${row.number}`,row.date,row.item,row.subcategory,String(row.quantity),row.vendor,[row.number,row.bill,row.remarks].filter(Boolean).join(' · ')]);
export const purchaseExpenses=(purchases:MaterialPurchase[])=>{const numbers=purchaseExpenseNumbers(purchases);return purchases.flatMap(row=>row.payments.filter(payment=>!payment.expenseId).map(payment=>[`PEXP-${payment.id}`,row.vendor,currentFinancialYear(new Date(payment.date)),'Material Purchase',`${row.number} · ${row.item} / ${row.subcategory}`,payment.date,String(payment.amount),payment.mode,row.bill||row.number,numbers.get(payment.id)!]));};
