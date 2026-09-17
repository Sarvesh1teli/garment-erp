export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.protocol !== 'file:' ? (window.location.protocol === 'https:' ? '' : `http://${window.location.hostname}:47831`) : 'http://127.0.0.1:47831')).replace(/\/$/, '');

const compressImage = (file:File) => new Promise<{dataUrl:string;filename:string}>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(reader.error||new Error('Unable to read image'));
  reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('Invalid image file'));image.onload=()=>{
    const maxDimension=1600,scale=Math.min(1,maxDimension/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height);
    resolve({dataUrl:canvas.toDataURL('image/webp',.78),filename:file.name.replace(/\.[^.]+$/, '')+'.webp'});
  };image.src=String(reader.result||'')};
  reader.readAsDataURL(file);
});

export const assetUrl=(value:string)=>{
  if(!value)return '';
  if(/^(?:https?:|blob:|data:)/i.test(value))return value;
  return `${API_BASE_URL}${value.startsWith('/')?'':'/'}${value}`;
};

export async function uploadSchoolMedia(file:File,schoolId:string,category:'school-logo'|'boys-dress'|'girls-dress'){
  const tenantId=getActiveTenantId();
  if(!tenantId||tenantId==='default'||tenantId==='_superadmin')throw new Error('Please sign in to the garment account before uploading');
  const compressed=await compressImage(file);
  void schoolId; void category; void compressed.filename;
  return compressed.dataUrl;
}

export async function deleteMedia(value:string){
  if(value.startsWith('data:'))return;
  const match=value.match(/\/api\/media\/([0-9a-f-]+)/i);
  if(!match)return;
  const response=await fetch(`${API_BASE_URL}/api/media/${match[1]}`,{method:'DELETE',headers:{'X-Tenant-ID':getActiveTenantId()}});
  if(!response.ok&&response.status!==404)throw new Error('Unable to delete image');
}

export type BackupManifest={
  id:string;
  createdAt:string;
  applicationVersion:string;
  counts:Record<string,number>;
};

async function backupRequest(path='',options?:RequestInit){
  const response=await fetch(`${API_BASE_URL}/api/backups${path}`,{...options,headers:{'X-Tenant-ID':getActiveTenantId(),...(options?.headers||{})}});
  const body=await response.json() as {data?:unknown;message?:string};
  if(!response.ok)throw new Error(body.message||'Backup operation failed');
  return body.data;
}

export const listBackups=()=>backupRequest() as Promise<{items:BackupManifest[];directory:string}>;
export const createBackup=()=>backupRequest('',{method:'POST'}) as Promise<BackupManifest>;
export const restoreBackup=(id:string)=>backupRequest(`/${encodeURIComponent(id)}/restore`,{method:'POST'});

export const importBackup=async(file:File)=>{
  const response=await fetch(`${API_BASE_URL}/api/backups/import`,{method:'POST',headers:{'X-Tenant-ID':getActiveTenantId()},body:file});
  const body=await response.json() as {data?:BackupManifest;message?:string};
  if(!response.ok||!body.data)throw new Error(body.message||'Backup import failed');
  return body.data;
};

export const downloadBackup=async(id:string)=>{
  const response=await fetch(`${API_BASE_URL}/api/backups/${encodeURIComponent(id)}/download`,{headers:{'X-Tenant-ID':getActiveTenantId()}});
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

export type GoogleDriveBackupStatus={configured:boolean;connected:boolean;connectedEmail:string;folderName:string;scheduleEnabled:boolean;scheduleTime:string;timezone:string;lastBackupAt:string|null;lastBackupStatus:string;lastBackupMessage:string;lastBackupFile?:string|null};
export type GoogleDriveBackupFile={id:string;fileName:string;sizeBytes:number;createdAt:string;status:string};
export const getGoogleDriveBackupStatus=()=>backupRequest('/google/status') as Promise<GoogleDriveBackupStatus>;
export const connectGoogleDrive=()=>backupRequest('/google/connect',{method:'POST'}) as Promise<{authorizationUrl:string}>;
export const disconnectGoogleDrive=()=>backupRequest('/google/disconnect',{method:'POST'}) as Promise<GoogleDriveBackupStatus>;
export const saveGoogleDriveSchedule=(value:{scheduleEnabled:boolean;scheduleTime:string;timezone:string})=>backupRequest('/google/schedule',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}) as Promise<GoogleDriveBackupStatus>;
export const runGoogleDriveBackup=()=>backupRequest('/google/run',{method:'POST'});
export const listGoogleDriveBackups=()=>backupRequest('/google/files') as Promise<{items:GoogleDriveBackupFile[]}>;
export const downloadGoogleDriveBackup=async(file:GoogleDriveBackupFile)=>{const response=await fetch(`${API_BASE_URL}/api/backups/google/files/${encodeURIComponent(file.id)}/download`,{headers:{'X-Tenant-ID':getActiveTenantId()}});if(!response.ok)throw new Error('Google Drive backup download failed');const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.fileName;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)};

export type SubscriptionInfo={planName:string;fromDate:string;toDate:string;status:'Active'|'Expired'|'Not Started';licenseHint:string};
export type BootstrapInfo={subscription:SubscriptionInfo|null;hasUser:boolean};
export function getActiveTenantId(): string {
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

async function publicRequest<T>(path:string,options?:RequestInit){
  const tenantId = getActiveTenantId();
  const headers = {
    'X-Tenant-ID': tenantId,
    ...(options?.headers || {})
  };
  const response=await fetch(`${API_BASE_URL}${path}`,{ ...options, headers });
  const body=await response.json() as {data?:T;message?:string};
  if(!response.ok)throw new Error(body.message||'Request failed');
  return body.data as T;
}
export const getBootstrap=()=>publicRequest<BootstrapInfo>('/api/bootstrap');
export const getSubscription=()=>publicRequest<SubscriptionInfo|null>('/api/subscription');
export const activateSubscription=(value:{activationMode:'password'|'license';licenseKey:string;softwarePassword:string;planName:string;fromDate:string;toDate:string;ownerName?:string;email?:string})=>publicRequest<SubscriptionInfo>('/api/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
export const loginDesktop=(email:string,password:string)=>publicRequest<{token:string;tenantId?:string;user:{id:string;name:string;email:string;role:string}}>('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
export const verifyMaster=(username:string,password:string)=>publicRequest<{username:string;role:string}>('/api/auth/verify-master',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
export const deleteSalaryPayment=(id:string,username:string,password:string)=>publicRequest<import('./types').SalaryPayment[]>('/api/salary-payments/'+encodeURIComponent(id),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
