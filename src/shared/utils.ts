import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { InvoiceItem, StockSale, WorkType } from './types';

export const money=(value:number)=>`Rs. ${value.toLocaleString('en-IN')}`;
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('garment_api_url_override');
    if (override && override.trim()) {
      const normalized=override.trim().replace(/\/$/, '').replace(/\/api$/i, '');
      if(normalized!==override.trim().replace(/\/$/, ''))localStorage.setItem('garment_api_url_override',normalized);
      return normalized;
    }
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    const isHttps = window.location.protocol === 'https:';
    if (isHttps || window.location.hostname === 'garment.telicampus.in') {
      return `${window.location.protocol}//${window.location.hostname}`;
    }
    return `http://${window.location.hostname}:47831`;
  }
  return 'http://127.0.0.1:47831';
}

export const API_BASE_URL = getApiBaseUrl();
const DOMAIN_ENDPOINTS:Record<string,string>={
  'garment-customers':'customers',
  'garment-schools':'schools',
  'garment-students':'students',
  'garment-employees':'employees',
  'garment-work-types':'work-types',
  'garment-assignments':'assignments',
  'garment-work-entries':'work-entries',
  'garment-advances':'advances',
  'garment-salary-history':'salary-payments',
  'garment-inventory-items':'inventory-items',
  'garment-stock-in':'stock-receipts',
  'garment-stock-out':'stock-issues',
  'garment-expense-vendors':'expense-vendors',
  'garment-expense-categories':'expense-categories',
  'garment-expenses':'expenses',
  'garment-company-settings':'company-settings',
  'garment-module-settings':'module-settings',
  'garment-school-collections':'school-collections',
  'garment-invoices':'invoices',
  'garment-invoice-payments':'invoice-payments',
  'garment-delivery-challans':'delivery-challans',
  'garment-attendance':'attendance',
};
const stateEndpoint=(key:string)=>DOMAIN_ENDPOINTS[key]
  ?`${API_BASE_URL}/api/${DOMAIN_ENDPOINTS[key]}`
  :`${API_BASE_URL}/api/state/${encodeURIComponent(key)}`;
const stateCache=new Map<string,unknown>();
const stateListeners=new Map<string,Set<(value:unknown)=>void>>();

export function getStoredTenantId(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const s = sessionStorage.getItem('garment_session') || localStorage.getItem('garment_session');
    if (s) {
      const p = JSON.parse(s);
      const tid = p.tenantId || p.currentUser?.email?.toLowerCase();
      if (tid === 'admin' || tid === 'default') return 'default';
      return tid || 'default';
    }
  } catch {}
  return 'default';
}

function publishState<T>(key:string,value:T){
  const tenantId = getStoredTenantId();
  stateCache.set(`${tenantId}:${key}`,value);
  try {
    if (typeof window !== 'undefined') localStorage.setItem(`garment_data_${tenantId}_${key}`, JSON.stringify(value));
  } catch {}
  stateListeners.get(key)?.forEach(listener=>listener(value));
}

async function saveState<T>(key:string,value:T){
  const tenantId = getStoredTenantId();
  try {
    const response=await fetch(stateEndpoint(key),{
      method:'PUT',
      headers:{'Content-Type':'application/json', 'X-Tenant-ID': tenantId},
      body:JSON.stringify(value)
    });
    if(!response.ok)throw new Error(`Unable to save backend state for ${key}`);
  } catch (err) {
    console.warn(`Backend state save error for ${key}:`, err);
    throw err;
  }
}

export function useStoredState<T>(key:string,initialValue:T){
  const [value,setValue]=useState<T>(()=>{
    const tenantId = getStoredTenantId();
    const cacheKey = `${tenantId}:${key}`;
    if (stateCache.has(cacheKey)) return stateCache.get(cacheKey) as T;
    try {
      const local = typeof window !== 'undefined'
        ? (localStorage.getItem(`garment_data_${tenantId}_${key}`) || (tenantId === 'default' ? localStorage.getItem(`garment_data_${key}`) : null))
        : null;
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed !== null && parsed !== undefined && (Array.isArray(parsed) ? parsed.length > 0 : true)) {
          stateCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch {}
    return initialValue;
  });
  const latest=useRef(value);
  const changedLocally=useRef(false);
  latest.current=value;

  useEffect(()=>{
    const listener=(next:unknown)=>{
      latest.current=next as T;
      setValue(next as T);
    };
    const listeners=stateListeners.get(key)??new Set();
    listeners.add(listener);
    stateListeners.set(key,listeners);
    return()=>{
      listeners.delete(listener);
      if(!listeners.size)stateListeners.delete(key);
    };
  },[key]);

  useEffect(()=>{
    let active=true;
    const tenantId = getStoredTenantId();
    const loadCloudState=()=>fetch(stateEndpoint(key), {headers: { 'X-Tenant-ID': tenantId }})
      .then(async response=>{
        if(response.status===404)return null;
        if(!response.ok)throw new Error(`Unable to load ${key}`);
        const body=await response.json() as {data:T};
        return body.data;
      })
      .then(data=>{
        if(!active || !data)return;
        if(!changedLocally.current)publishState(key,data);
      })
      .catch(console.error);
    loadCloudState();
    const onFocus=()=>loadCloudState();
    const onVisibility=()=>{if(document.visibilityState==='visible')loadCloudState()};
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisibility);
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')loadCloudState()},15000);
    return()=>{active=false;window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);window.clearInterval(timer)};
  },[key]);

  const updateValue=useCallback<Dispatch<SetStateAction<T>>>(update=>{
    changedLocally.current=true;
    const next=typeof update==='function'?(update as (current:T)=>T)(latest.current):update;
    latest.current=next;
    publishState(key,next);
    const onError=(error:unknown)=>{console.error(`Unable to save ${key}:`,error);};
    saveState(key,next).then(()=>{changedLocally.current=false}).catch(onError);
  },[key]);

  return [value,updateValue] as const;
}
export const workTypeCode=(workType:WorkType)=>workType.code||String(Number(workType.id.replace(/\D/g,''))||'');
export const inRange=(date:string,from:string,to:string)=>date>=from&&date<=to;

export const cleanupPrintClasses=()=>{
  if(typeof document!=='undefined'){
    document.body.classList.remove('printing-preview');
  }
};

export const printPage=()=>{
  if(typeof document==='undefined')return;
  document.body.classList.add('printing-preview');
  const onAfterPrint=()=>{
    cleanupPrintClasses();
    window.removeEventListener('afterprint',onAfterPrint);
  };
  window.addEventListener('afterprint',onAfterPrint,{once:true});
  try{
    window.print();
  }finally{
    setTimeout(cleanupPrintClasses,500);
  }
};

export const savePdf=async()=>{
  if(typeof document==='undefined')return false;
  document.body.classList.add('printing-preview');
  const onAfterPrint=()=>{
    cleanupPrintClasses();
    window.removeEventListener('afterprint',onAfterPrint);
  };
  window.addEventListener('afterprint',onAfterPrint,{once:true});
  try{
    if(window.threadflow?.savePdf){
      const result=await window.threadflow.savePdf();
      cleanupPrintClasses();
      if(result?.saved){
        console.log(`PDF saved to ${result.filePath}`);
      }
      return result?.saved??false;
    }
    window.print();
    return false;
  }catch(err){
    console.error('Error in savePdf:',err);
    return false;
  }finally{
    setTimeout(cleanupPrintClasses,500);
  }
};

export function consolidateStockSales(sales: StockSale[]): StockSale[] {
  const result: StockSale[] = [];
  const invoiceGroups = new Map<string, StockSale[]>();

  sales.forEach(sale => {
    const inv = sale.invoiceNo?.trim();
    if (inv && inv !== '-') {
      const group = invoiceGroups.get(inv) || [];
      group.push(sale);
      invoiceGroups.set(inv, group);
    } else {
      result.push(sale);
    }
  });

  invoiceGroups.forEach((group, invNo) => {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const first = group[0];
      const allItems: InvoiceItem[] = [];
      let totalCount = 0;
      let totalAmount = 0;

      group.forEach(s => {
        if (s.items && s.items.length > 0) {
          s.items.forEach(it => {
            allItems.push(it);
            totalCount += it.qty;
            totalAmount += it.amount;
          });
        } else {
          allItems.push({
            gender: s.gender,
            garment: s.garment,
            size: s.size,
            qty: s.count,
            rate: s.rate,
            amount: s.total
          });
          totalCount += s.count;
          totalAmount += s.total;
        }
      });

      const uniqueGarments = Array.from(new Set(allItems.map(it => it.garment)));
      const uniqueSizes = Array.from(new Set(allItems.map(it => it.size)));
      const uniqueGenders = Array.from(new Set(allItems.map(it => it.gender).filter(Boolean)));

      const consolidated: StockSale = {
        id: first.id,
        date: first.date,
        type: first.type,
        party: first.party,
        gender: uniqueGenders.length === 1 ? uniqueGenders[0] : (uniqueGenders.length > 1 ? 'Mixed' : first.gender),
        garment: uniqueGarments.join(', '),
        size: uniqueSizes.join(', '),
        count: totalCount,
        rate: totalCount > 0 ? Math.round(totalAmount / totalCount) : 0,
        total: totalAmount,
        invoiceNo: invNo,
        remarks: first.remarks,
        items: allItems
      };
      result.push(consolidated);
    }
  });

  return result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
