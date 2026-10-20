import { initializeApp, getApps } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import type { MessagePayload } from 'firebase/messaging';

export type SchoolNotice={id:string;orderId:string;title:string;body:string;createdAt:string;readAt?:string};
type Api=(path:string,options?:RequestInit)=>Promise<any>;
const sessionCache='school-push-session-v1';
const timeout=<T,>(promise:Promise<T>,ms=15000):Promise<T>=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Notification setup timed out. Please retry.')),ms);promise.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
export async function setPushSchool(schoolId:string){
  if(!('caches' in window))return;
  const c=await caches.open(sessionCache);
  await c.put('/school-orders/push-session',new Response(JSON.stringify({schoolId})));
}
async function messagingClient(api:Api){
  if(!window.isSecureContext||!await isSupported())throw Error('Notifications are not supported here. Use a supported browser over HTTPS. On iPhone/iPad, install this PWA on the Home Screen first.');
  const settings=await api('/api/school/push/config');
  if(!settings.enabled)throw Error('Notifications are not configured on the server yet.');
  const app=getApps().find(a=>a.name==='school-order-push')||initializeApp(settings.config,'school-order-push');
  return {messaging:getMessaging(app),vapidKey:settings.vapidKey};
}
export async function enableSchoolPush(api:Api,schoolId:string,requestPermission=true){
  if(!('Notification' in window)||!('serviceWorker' in navigator))throw Error('This browser does not support push notifications.');
  // Ask synchronously from the button click, before any network operation.
  const permission=requestPermission?await Notification.requestPermission():Notification.permission;
  if(permission!=='granted')throw Error('Notifications are blocked. Allow them in browser/site settings, then try again.');
  const {messaging,vapidKey}=await messagingClient(api);
  const registration=await navigator.serviceWorker.register('/school-orders/firebase-messaging-sw.js',{scope:'/school-orders/',updateViaCache:'none'});
  await timeout(navigator.serviceWorker.ready);
  const token=await timeout(getToken(messaging,{vapidKey,serviceWorkerRegistration:registration}));
  if(!token)throw Error('Unable to register this device. Try again.');
  await api('/api/school/push/devices',{method:'POST',body:JSON.stringify({token})});
  await setPushSchool(schoolId);
  localStorage.setItem('school_push_token',token);
  return token;
}
export async function disableSchoolPush(api:Api){
  // Stop local display even when the server cannot be reached during logout.
  await setPushSchool('');
  const token=localStorage.getItem('school_push_token');
  if(token){await api('/api/school/push/devices',{method:'DELETE',body:JSON.stringify({token})});localStorage.removeItem('school_push_token');}
  const app=getApps().find(a=>a.name==='school-order-push');
  if(app)await deleteToken(getMessaging(app));
}
export async function listenSchoolPush(api:Api,schoolId:string,callback:(data:MessagePayload)=>void){
  const {messaging}=await messagingClient(api);
  return onMessage(messaging,payload=>{if(payload.data?.schoolId===schoolId)callback(payload);});
}
