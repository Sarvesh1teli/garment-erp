import { useEffect, useRef, useState } from 'react';
import type { WorkType } from './types';

export const money=(value:number)=>`Rs. ${value.toLocaleString('en-IN')}`;
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:47831').replace(/\/$/, '');
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
};
const stateEndpoint=(key:string)=>DOMAIN_ENDPOINTS[key]
  ?`${API_BASE_URL}/api/${DOMAIN_ENDPOINTS[key]}`
  :`${API_BASE_URL}/api/state/${encodeURIComponent(key)}`;

async function saveState<T>(key:string,value:T){
  const response=await fetch(stateEndpoint(key),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  if(!response.ok)throw new Error(`Unable to save ${key}`);
}

export function useStoredState<T>(key:string,initialValue:T){
  const [value,setValue]=useState<T>(initialValue);
  const hydrated=useRef(false);
  const latest=useRef(value);
  latest.current=value;

  useEffect(()=>{
    let active=true;
    fetch(stateEndpoint(key))
      .then(async response=>{
        if(response.status===404){await saveState(key,initialValue);return initialValue;}
        if(!response.ok)throw new Error(`Unable to load ${key}`);
        const body=await response.json() as {data:T};
        return body.data;
      })
      .then(data=>{if(active){setValue(data);hydrated.current=true;}})
      .catch(error=>{console.error(error);if(active)hydrated.current=true;});
    return()=>{active=false};
  },[key]);

  useEffect(()=>{
    if(!hydrated.current)return;
    const timeout=window.setTimeout(()=>saveState(key,latest.current).catch(console.error),150);
    return()=>window.clearTimeout(timeout);
  },[key,value]);

  return [value,setValue] as const;
}
export const workTypeCode=(workType:WorkType)=>workType.code||String(Number(workType.id.replace(/\D/g,''))||'');
export const inRange=(date:string,from:string,to:string)=>date>=from&&date<=to;
export const printPage=()=>{document.body.classList.add('printing-preview');window.print();setTimeout(()=>document.body.classList.remove('printing-preview'),300);};
export const savePdf=async()=>{
  const hasPreview=document.body.classList.contains('printing-preview');
  document.body.classList.add('printing-preview');
  try{
    if(window.threadflow?.savePdf){const result=await window.threadflow.savePdf();if(result?.saved){window.alert(`PDF saved to ${result.filePath}`)}return result?.saved??false}
    window.print();return false;
  }finally{if(!hasPreview)setTimeout(()=>document.body.classList.remove('printing-preview'),300);}
};
