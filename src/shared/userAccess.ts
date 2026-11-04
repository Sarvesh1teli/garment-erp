import { API_BASE_URL } from './api';
export type AccessUser = {id:string;name:string;email:string;role:string;active:boolean;modules:string[]};
export async function accessRequest(path:string, value?:unknown) {
  const session=JSON.parse(sessionStorage.getItem('garment_session')||localStorage.getItem('garment_session')||'{}');
  const response=await fetch(`${API_BASE_URL}/api/access/${path}`,{method:value?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token||''}`},body:value?JSON.stringify(value):undefined});
  const body=await response.json();
  if(!response.ok)throw Object.assign(Error(body.message||'Unable to load user access.'),{status:response.status});
  return body.data;
}
export const ownerRole=(role?:string)=>!role||['Owner','Admin','Master','SuperAdmin'].includes(role);
