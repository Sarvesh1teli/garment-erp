import { addPurchase, addPurchasePayment, correctPurchaseRate, purchaseItems, purchaseReceipts, purchaseExpenses, type MaterialPurchase, type PurchasePayment } from './materialPurchases';
import { normalizeMaterials, projectJobMaterials, projectJobMaterialHistory, storeJobMaterials, storeJobMaterialHistory } from './jobMaterials';
import { projectJobReadyStock, mergeJobSchoolStock, mergeJobCustomerStock, storeJobSchoolStock, storeJobCustomerStock } from './jobReadyStock';
import type { ProductionJob } from './productionJobs';
import { allocateSchoolAdvance } from './schoolAdvances';
import { createContext, useContext, useMemo, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useStoredState } from './utils';
import type { CustomerStock, Invoice, InvoicePayment, SchoolStock, StockSale } from './types';
import { closeRetailSale, createRetailSale, isRetailRecord, projectRetail, readyBalances, retailInvoiceNumbers, type QuickSaleDraft, type RetailSale } from './commerce';

type CommerceContextValue={
  purchases:MaterialPurchase[];
  correctPurchaseRate:(id:string,rate:number,reason:string)=>void;
  savePurchase:(draft:Parameters<typeof addPurchase>[4])=>void;
  payPurchase:(id:string,payment:PurchasePayment)=>void;
  ledger:RetailSale[];schoolStock:SchoolStock[];customerStock:CustomerStock[];sales:StockSale[];invoices:Invoice[];payments:InvoicePayment[];
  state:<T>(key:string)=>readonly[T,Dispatch<SetStateAction<T>>]|null;
  addStock:(school:SchoolStock[],customer:CustomerStock[])=>void;
  save:(draft:QuickSaleDraft)=>RetailSale;
  customerAdvances:string[][];
  recordCustomerAdvance:(customer:string,date:string,amount:number,mode:string,remarks:string,id:string)=>void;
  recordAdvancePayment:(payment:InvoicePayment,owner?:'school'|'customer')=>InvoicePayment;
  transition:(id:string,action:'dispatch'|'return',reason?:string)=>void;
  managedInvoice:(number:string)=>boolean;
};
const Context=createContext<CommerceContextValue|null>(null);
export const useCommerce=()=>useContext(Context);
export function CommerceProvider({children}:{children:ReactNode}){
  const [ledger,setLedger]=useStoredState<RetailSale[]>('garment-retail-ledger',[]);
  const [storedSchoolStock,setSchoolStock]=useStoredState<SchoolStock[]>('garment-school-stock',[]);
  const [storedCustomerStock,setCustomerStock]=useStoredState<CustomerStock[]>('garment-customer-stock',[]);
  const [jobs]=useStoredState<ProductionJob[]>('garment-production-job-cards',[]);
  const [purchases,setPurchases]=useStoredState<MaterialPurchase[]>('garment-material-purchases',[]);
  const [vendors]=useStoredState<string[][]>('garment-expense-vendors',[]);
  const [expenses,setExpenses]=useStoredState<string[][]>('garment-expenses',[]);
  const [materialItems,setMaterialItems]=useStoredState<string[][]>('garment-inventory-items',[]);
  const [materialIn,setMaterialIn]=useStoredState<string[][]>('garment-stock-in',[]);
  const [materialOut,setMaterialOut]=useStoredState<string[][]>('garment-stock-out',[]);
  const jobStock=useMemo(()=>projectJobReadyStock(jobs),[jobs]);
  const schoolStock=useMemo(()=>mergeJobSchoolStock(storedSchoolStock,jobStock.school),[storedSchoolStock,jobStock.school]);
  const customerStock=useMemo(()=>mergeJobCustomerStock(storedCustomerStock,jobStock.customer),[storedCustomerStock,jobStock.customer]);
  const [invoices,setInvoices]=useStoredState<Invoice[]>('garment-invoices',[]);
  const [payments,setPayments]=useStoredState<InvoicePayment[]>('garment-invoice-payments',[]);
  const [collections]=useStoredState<string[][]>('garment-school-collections',[]);
  const [customerAdvances,setCustomerAdvances]=useStoredState<string[][]>('garment-customer-advances',[]);
  const [sales,setSales]=useStoredState<StockSale[]>('garment-stock-sales',[]);
  const latest=useRef({ledger,schoolStock,customerStock,storedSchoolStock,storedCustomerStock,jobStock,jobs,materialItems,materialIn,materialOut,invoices,payments,sales,collections,customerAdvances,purchases,vendors,expenses});latest.current={ledger,schoolStock,customerStock,storedSchoolStock,storedCustomerStock,jobStock,jobs,materialItems,materialIn,materialOut,invoices,payments,sales,collections,customerAdvances,purchases,vendors,expenses};
  const projected=useMemo(()=>projectRetail(ledger,payments),[ledger,payments]);
  const allInvoices=useMemo(()=>{
    const closedLegacy=new Set(ledger.filter(row=>row.legacyInvoice&&row.returnDate).map(row=>row.invoice.invoiceNo));
    return [...projected.invoices,...invoices.map(row=>closedLegacy.has(row.invoiceNo)?{...row,status:'Paid' as const}:row)];
  },[projected.invoices,invoices,ledger]);
  const allPayments=useMemo(()=>[...projected.payments,...payments],[projected.payments,payments]);
  const allSales=useMemo(()=>[...projected.sales,...sales],[projected.sales,sales]);
  const updateSchoolStock:Dispatch<SetStateAction<SchoolStock[]>>=update=>{
    const snapshot=latest.current;
    const proposed=typeof update==='function'?update(snapshot.schoolStock):update;
    const stored=storeJobSchoolStock(snapshot.storedSchoolStock,snapshot.jobStock.school,proposed);
    latest.current={...snapshot,storedSchoolStock:stored,schoolStock:mergeJobSchoolStock(stored,snapshot.jobStock.school)};
    setSchoolStock(stored);
  };
  const updateCustomerStock:Dispatch<SetStateAction<CustomerStock[]>>=update=>{
    const snapshot=latest.current;
    const proposed=typeof update==='function'?update(snapshot.customerStock):update;
    const stored=storeJobCustomerStock(snapshot.storedCustomerStock,snapshot.jobStock.customer,proposed);
    latest.current={...snapshot,storedCustomerStock:stored,customerStock:mergeJobCustomerStock(stored,snapshot.jobStock.customer)};
    setCustomerStock(stored);
  };
  const state:CommerceContextValue['state']=<T,>(key:string)=>{
    if(key==='garment-inventory-items')return [projectJobMaterials(purchaseItems(normalizeMaterials(materialItems),purchases),jobs) as T,((update:SetStateAction<string[][]>)=>{
      const snapshot=latest.current;
      const current=projectJobMaterials(purchaseItems(normalizeMaterials(snapshot.materialItems),snapshot.purchases),snapshot.jobs);
      const proposed=typeof update==='function'?update(current):update;
      const stored=purchaseItems(storeJobMaterials(proposed,snapshot.jobs),snapshot.purchases,-1);
      latest.current={...snapshot,materialItems:stored};setMaterialItems(stored);
    }) as Dispatch<SetStateAction<T>>];
    if(key==='garment-stock-in'||key==='garment-stock-out'){
      const isIn=key==='garment-stock-in';
      const projectedRows=[...projectJobMaterialHistory(jobs,isIn?'return':'issue'),...(isIn?purchaseReceipts(purchases):[])];
      return [[...projectedRows,...(isIn?materialIn:materialOut)] as T,((update:SetStateAction<string[][]>)=>{
        const snapshot=latest.current;
        const derived=[...projectJobMaterialHistory(snapshot.jobs,isIn?'return':'issue'),...(isIn?purchaseReceipts(snapshot.purchases):[])];
        const current=[...derived,...(isIn?snapshot.materialIn:snapshot.materialOut)];
        const proposed=typeof update==='function'?update(current):update;
        const stored=storeJobMaterialHistory(proposed,derived).filter(row=>!row[0].startsWith('PIN-'));
        latest.current={...snapshot,...(isIn?{materialIn:stored}:{materialOut:stored})};
        if(isIn)setMaterialIn(stored);else setMaterialOut(stored);
      }) as Dispatch<SetStateAction<T>>];
    }
    if(key==='garment-expenses')return [[...purchaseExpenses(purchases),...expenses] as T,((update:SetStateAction<string[][]>)=>{
      const snapshot=latest.current,derived=purchaseExpenses(snapshot.purchases),current=[...derived,...snapshot.expenses];
      const proposed=typeof update==='function'?update(current):update;
      for(const row of derived)if(!proposed.some(entry=>JSON.stringify(entry)===JSON.stringify(row)))throw Error('Manage purchase payments from Purchase History.');
      for(const purchase of snapshot.purchases)for(const payment of purchase.payments)if(payment.expenseId){const original=snapshot.expenses.find(row=>row[0]===payment.expenseId);if(!proposed.some(row=>JSON.stringify(row)===JSON.stringify(original)))throw Error('This expense is linked to a purchase payment.');}
      const stored=proposed.filter(row=>!row[0].startsWith('PEXP-'));latest.current={...snapshot,expenses:stored};setExpenses(stored);
    }) as Dispatch<SetStateAction<T>>];
    if(key==='garment-school-stock')return [schoolStock as T,updateSchoolStock as Dispatch<SetStateAction<T>>];
    if(key==='garment-customer-stock')return [customerStock as T,updateCustomerStock as Dispatch<SetStateAction<T>>];
    if(key==='garment-invoices')return [allInvoices as T,((update:SetStateAction<Invoice[]>)=>setInvoices(current=>{
      const active=latest.current.ledger,next=typeof update==='function'?update([...projectRetail(active,latest.current.payments).invoices,...current]):update;
      const owned=retailInvoiceNumbers(active);return next.filter(row=>!owned.has(row.invoiceNo));
    })) as Dispatch<SetStateAction<T>>];
    if(key==='garment-invoice-payments')return [allPayments as T,((update:SetStateAction<InvoicePayment[]>)=>setPayments(current=>{
      const next=typeof update==='function'?update([...projectRetail(latest.current.ledger,current).payments,...current]):update;
      return next.filter(row=>!isRetailRecord(row.id));
    })) as Dispatch<SetStateAction<T>>];
    if(key==='garment-stock-sales')return [allSales as T,((update:SetStateAction<StockSale[]>)=>setSales(current=>{
      const next=typeof update==='function'?update([...projectRetail(latest.current.ledger).sales,...current]):update;
      return next.filter(row=>!isRetailRecord(row.id));
    })) as Dispatch<SetStateAction<T>>];
    return null;
  };
  const save=(draft:QuickSaleDraft)=>{
    const snapshot=latest.current,projection=projectRetail(snapshot.ledger,snapshot.payments);
    if(draft.reuseInvoiceNo&&snapshot.sales.some(row=>row.invoiceNo===draft.reuseInvoiceNo))throw Error('This invoice already has stock issues. Use its existing delivery history.');
    const sale=createRetailSale(snapshot.ledger,readyBalances(snapshot.schoolStock,snapshot.customerStock,[...projection.sales,...snapshot.sales]),snapshot.invoices,draft,crypto.randomUUID());
    if(draft.advanceAmount){
      if(!sale.payment)throw Error('The invoice payment could not be created.');
      sale.payment.advanceSources=allocateSchoolAdvance(sale.invoice.customer,draft.advanceAmount,sale.lines[0]?.owner==='customer'?snapshot.customerAdvances:snapshot.collections,[...projection.payments,...snapshot.payments],draft.date);
    }
    const next=[sale,...snapshot.ledger];latest.current={...snapshot,ledger:next};setLedger(next);return sale;
  };
  const recordAdvancePayment=(payment:InvoicePayment,owner:'school'|'customer'='school')=>{
    const snapshot=latest.current;
    if(snapshot.payments.some(row=>row.id===payment.id))throw Error('This payment has already been recorded.');
    const projection=projectRetail(snapshot.ledger,snapshot.payments);
    const currentPayments=[...projection.payments,...snapshot.payments];
    const invoice=[...projection.invoices,...snapshot.invoices].find(row=>row.invoiceNo===payment.invoiceNo);
    if(!invoice||invoice.customer!==payment.customer)throw Error('Invoice is unavailable for the selected account.');
    const pending=invoice.totalAmount-currentPayments.filter(row=>row.invoiceNo===invoice.invoiceNo).reduce((sum,row)=>sum+row.amount+(row.discount||0),0);
    if(payment.amount<0||!Number.isFinite(payment.amount)||payment.amount+(payment.discount||0)>pending+.001)throw Error('Payment plus advance and discount cannot exceed the pending bill.');
    if((payment.advanceAmount||0)>payment.amount)throw Error('Advance cannot exceed the total payment.');
    const saved={...payment,advanceSources:allocateSchoolAdvance(payment.customer,payment.advanceAmount||0,owner==='customer'?snapshot.customerAdvances:snapshot.collections,currentPayments,payment.date)};
    const next=[saved,...snapshot.payments];
    latest.current={...snapshot,payments:next};
    setPayments(next);
    return saved;
  };
  const recordCustomerAdvance=(customer:string,date:string,amount:number,mode:string,remarks:string,id:string)=>{
    const snapshot=latest.current;
    if(snapshot.customerAdvances.some(row=>row[6]===id))return;
    if(!customer.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)-amount*100)>0.000001)throw Error('Enter a customer, date and positive amount with up to two decimals.');
    if(!['Cash','UPI','Bank'].includes(mode))throw Error('Select a valid payment mode.');
    const next=snapshot.customerAdvances.reduce((max,row)=>Math.max(max,Number(/^CAD-(\d+)$/.exec(row[0])?.[1]||0)),0)+1;
    const receipt=`CAD-${String(next).padStart(6,'0')}`;
    const rows=[[receipt,date,customer,mode,String(amount),remarks,id],...snapshot.customerAdvances];
    latest.current={...snapshot,customerAdvances:rows};setCustomerAdvances(rows);
  };
  const transition=(id:string,action:'dispatch'|'return',reason='')=>{
    const snapshot=latest.current;
    const current=snapshot.ledger.find(row=>row.id===id);
    if(action==='return'&&current&&snapshot.invoices.some(row=>row.invoiceNo===`CR-${current.invoice.invoiceNo}`))throw Error('A credit note with this number already exists. Review the existing credit note first.');
    const next=closeRetailSale(snapshot.ledger,id,action,new Date().toISOString().slice(0,10),[...projectRetail(snapshot.ledger).payments,...snapshot.payments],reason);
    latest.current={...snapshot,ledger:next};setLedger(next);
  };
  return <Context.Provider value={{purchases,correctPurchaseRate:(id,rate,reason)=>{const snapshot=latest.current;const purchase=snapshot.purchases.find(row=>row.id===id);if(!purchase)throw Error('Purchase is unavailable.');const saved=correctPurchaseRate(purchase,rate,reason);const next=snapshot.purchases.map(row=>row.id===id?saved:row);latest.current={...snapshot,purchases:next};setPurchases(next);},savePurchase:draft=>{const snapshot=latest.current;const next=addPurchase(snapshot.purchases,projectJobMaterials(purchaseItems(normalizeMaterials(snapshot.materialItems),snapshot.purchases),snapshot.jobs),snapshot.vendors,snapshot.expenses,draft);latest.current={...snapshot,purchases:next};setPurchases(next);},payPurchase:(id,payment)=>{const snapshot=latest.current;const purchase=snapshot.purchases.find(row=>row.id===id);if(!purchase)throw Error('Purchase is unavailable.');const saved=addPurchasePayment(purchase,payment,snapshot.purchases,snapshot.expenses);const next=snapshot.purchases.map(row=>row.id===id?saved:row);latest.current={...snapshot,purchases:next};setPurchases(next);},ledger,schoolStock,customerStock,sales:allSales,invoices:allInvoices,payments:allPayments,customerAdvances,recordCustomerAdvance,state,save,recordAdvancePayment,transition,managedInvoice:number=>retailInvoiceNumbers(ledger,true).has(number),addStock:(school,customer)=>{if(school.length)updateSchoolStock(current=>[...school,...current]);if(customer.length)updateCustomerStock(current=>[...customer,...current]);}}}>{children}</Context.Provider>;
}

// Legacy screens keep their original storage keys. New bills are read-only projections
// from one ledger entry, so invoice, payment and stock movement cannot be saved halfway.
export function useCommerceState<T>(key:string,initial:T){
  const context=useContext(Context);
  const stored=useStoredState<T>(key,initial);
  return context?.state<T>(key)||stored;
}
