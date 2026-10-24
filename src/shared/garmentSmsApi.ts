import { API_BASE_URL, getStoredTenantId } from './utils';

export async function garmentSmsRequest(endpoint:string, options:{method?:string;body?:string}={}) {
  const tenantId=getStoredTenantId();
  if(window.threadflow?.garmentSmsRequest)return window.threadflow.garmentSmsRequest(endpoint,{...options,tenantId});
  if(location.protocol==='file:' || navigator.userAgent.includes('Electron'))throw new Error('Restart the updated garment desktop app to load the SMS connection.');
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  const base=local?`http://${location.hostname}:47831`:API_BASE_URL;
  const response=await fetch(base+endpoint,{...options,headers:{'Content-Type':'application/json','X-Tenant-ID':tenantId}});
  const text=await response.text();let result;
  try{result=JSON.parse(text);}catch{throw new Error('This address returned a web page instead of the SMS API. Use the updated garment desktop app for SMS, or start its local backend.');}
  if(!response.ok)throw new Error(result.error||result.message||`SMS request failed (${response.status})`);
  return result;
}
