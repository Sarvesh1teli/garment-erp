import { createContext, useContext, useMemo, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useStoredState } from './utils';
import type { CustomerStock, Invoice, InvoicePayment, SchoolStock, StockSale } from './types';
import { closeRetailSale, createRetailSale, isRetailRecord, projectRetail, readyBalances, retailInvoiceNumbers, type QuickSaleDraft, type RetailSale } from './commerce';

type CommerceContextValue={
  ledger:RetailSale[];schoolStock:SchoolStock[];customerStock:CustomerStock[];sales:StockSale[];invoices:Invoice[];payments:InvoicePayment[];
  state:<T>(key:string)=>readonly[T,Dispatch<SetStateAction<T>>]|null;
  addStock:(school:SchoolStock[],customer:CustomerStock[])=>void;
  save:(draft:QuickSaleDraft)=>RetailSale;
  transition:(id:string,action:'dispatch'|'return',reason?:string)=>void;
  managedInvoice:(number:string)=>boolean;
};
const Context=createContext<CommerceContextValue|null>(null);
export const useCommerce=()=>useContext(Context);
export function CommerceProvider({children}:{children:ReactNode}){
  const [ledger,setLedger]=useStoredState<RetailSale[]>('garment-retail-ledger',[]);
  const [schoolStock,setSchoolStock]=useStoredState<SchoolStock[]>('garment-school-stock',[]);
  const [customerStock,setCustomerStock]=useStoredState<CustomerStock[]>('garment-customer-stock',[]);
  const [invoices,setInvoices]=useStoredState<Invoice[]>('garment-invoices',[]);
  const [payments,setPayments]=useStoredState<InvoicePayment[]>('garment-invoice-payments',[]);
  const [sales,setSales]=useStoredState<StockSale[]>('garment-stock-sales',[]);
  const latest=useRef({ledger,schoolStock,customerStock,invoices,payments,sales});latest.current={ledger,schoolStock,customerStock,invoices,payments,sales};
  const projected=useMemo(()=>projectRetail(ledger,payments),[ledger,payments]);
  const allInvoices=useMemo(()=>{
    const closedLegacy=new Set(ledger.filter(row=>row.legacyInvoice&&row.returnDate).map(row=>row.invoice.invoiceNo));
    return [...projected.invoices,...invoices.map(row=>closedLegacy.has(row.invoiceNo)?{...row,status:'Paid' as const}:row)];
  },[projected.invoices,invoices,ledger]);
  const allPayments=useMemo(()=>[...projected.payments,...payments],[projected.payments,payments]);
  const allSales=useMemo(()=>[...projected.sales,...sales],[projected.sales,sales]);
  const state:CommerceContextValue['state']=<T,>(key:string)=>{
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
    const next=[sale,...snapshot.ledger];latest.current={...snapshot,ledger:next};setLedger(next);return sale;
  };
  const transition=(id:string,action:'dispatch'|'return',reason='')=>{
    const snapshot=latest.current;
    const current=snapshot.ledger.find(row=>row.id===id);
    if(action==='return'&&current&&snapshot.invoices.some(row=>row.invoiceNo===`CR-${current.invoice.invoiceNo}`))throw Error('A credit note with this number already exists. Review the existing credit note first.');
    const next=closeRetailSale(snapshot.ledger,id,action,new Date().toISOString().slice(0,10),[...projectRetail(snapshot.ledger).payments,...snapshot.payments],reason);
    latest.current={...snapshot,ledger:next};setLedger(next);
  };
  return <Context.Provider value={{ledger,schoolStock,customerStock,sales:allSales,invoices:allInvoices,payments:allPayments,state,save,transition,managedInvoice:number=>retailInvoiceNumbers(ledger,true).has(number),addStock:(school,customer)=>{if(school.length)setSchoolStock(current=>[...school,...current]);if(customer.length)setCustomerStock(current=>[...customer,...current]);}}}>{children}</Context.Provider>;
}

// Legacy screens keep their original storage keys. New bills are read-only projections
// from one ledger entry, so invoice, payment and stock movement cannot be saved halfway.
export function useCommerceState<T>(key:string,initial:T){
  const context=useContext(Context);
  const stored=useStoredState<T>(key,initial);
  return context?.state<T>(key)||stored;
}
