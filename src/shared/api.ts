const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.protocol !== 'file:' ? `http://${window.location.hostname}:47831` : 'http://127.0.0.1:47831')).replace(/\/$/, '');

const fileAsDataUrl = (file:File) => new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||''));
  reader.onerror=()=>reject(reader.error||new Error('Unable to read image'));
  reader.readAsDataURL(file);
});

export const assetUrl=(value:string)=>{
  if(!value)return '';
  if(/^(?:https?:|blob:|data:)/i.test(value))return value;
  return `${API_BASE_URL}${value.startsWith('/')?'':'/'}${value}`;
};

export async function uploadSchoolMedia(file:File,schoolId:string,category:'school-logo'|'boys-dress'|'girls-dress'){
  const response=await fetch(`${API_BASE_URL}/api/media`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({schoolId,category,filename:file.name,dataUrl:await fileAsDataUrl(file)}),
  });
  const body=await response.json() as {data?:{url:string};message?:string};
  if(!response.ok||!body.data)throw new Error(body.message||'Image upload failed');
  return body.data.url;
}

export async function deleteMedia(value:string){
  const match=value.match(/\/api\/media\/([0-9a-f-]+)$/i);
  if(!match)return;
  const response=await fetch(`${API_BASE_URL}/api/media/${match[1]}`,{method:'DELETE'});
  if(!response.ok&&response.status!==404)throw new Error('Unable to delete image');
}

export type BackupManifest={
  id:string;
  createdAt:string;
  applicationVersion:string;
  counts:Record<string,number>;
};

async function backupRequest(path='',options?:RequestInit){
  const response=await fetch(`${API_BASE_URL}/api/backups${path}`,options);
  const body=await response.json() as {data?:unknown;message?:string};
  if(!response.ok)throw new Error(body.message||'Backup operation failed');
  return body.data;
}

export const listBackups=()=>backupRequest() as Promise<{items:BackupManifest[];directory:string}>;
export const createBackup=()=>backupRequest('',{method:'POST'}) as Promise<BackupManifest>;
export const restoreBackup=(id:string)=>backupRequest(`/${encodeURIComponent(id)}/restore`,{method:'POST'});

export const importBackup=async(file:File)=>{
  const response=await fetch(`${API_BASE_URL}/api/backups/import`,{method:'POST',body:file});
  const body=await response.json() as {data?:BackupManifest;message?:string};
  if(!response.ok||!body.data)throw new Error(body.message||'Backup import failed');
  return body.data;
};

export const downloadBackup=async(id:string)=>{
  const response=await fetch(`${API_BASE_URL}/api/backups/${encodeURIComponent(id)}/download`);
  if(!response.ok){let message='Backup download failed';try{message=(await response.json()).message||message}catch{}throw new Error(message)}
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`ThreadFlow-backup-${id}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
};

export type SubscriptionInfo={planName:string;fromDate:string;toDate:string;status:'Active'|'Expired'|'Not Started';licenseHint:string};
export type BootstrapInfo={subscription:SubscriptionInfo|null;hasUser:boolean};
async function publicRequest<T>(path:string,options?:RequestInit){const response=await fetch(`${API_BASE_URL}${path}`,options);const body=await response.json() as {data?:T;message?:string};if(!response.ok)throw new Error(body.message||'Request failed');return body.data as T}
export const getBootstrap=()=>publicRequest<BootstrapInfo>('/api/bootstrap');
export const getSubscription=()=>publicRequest<SubscriptionInfo|null>('/api/subscription');
export const activateSubscription=(value:{activationMode:'password'|'license';licenseKey:string;softwarePassword:string;planName:string;fromDate:string;toDate:string;ownerName?:string;email?:string})=>publicRequest<SubscriptionInfo>('/api/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
export const loginDesktop=(email:string,password:string)=>publicRequest<{token:string;user:{id:string;name:string;email:string;role:string}}>('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
export const verifyMaster=(username:string,password:string)=>publicRequest<{username:string;role:string}>('/api/auth/verify-master',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
export const deleteSalaryPayment=(id:string,username:string,password:string)=>publicRequest<import('./types').SalaryPayment[]>('/api/salary-payments/'+encodeURIComponent(id),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
