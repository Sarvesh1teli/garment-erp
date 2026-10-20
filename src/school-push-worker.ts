/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self:ServiceWorkerGlobalScope & {SCHOOL_FIREBASE:{enabled:boolean;config:Record<string,string>}};
// Existing offline caching and this worker share one scope/registration.
importScripts('/school-orders/sw.js','/school-orders/firebase-config.js');

// Register before Firebase's click handler; only same-origin order links are used.
self.addEventListener('notificationclick',event=>{
  const data=event.notification.data;
  if(!data?.schoolOrderPush)return;
  event.stopImmediatePropagation();event.notification.close();
  event.waitUntil((async()=>{
    const c=await caches.open('school-push-session-v1');
    const session=await (await c.match('/school-orders/push-session'))?.json();
    if(!session?.schoolId||session.schoolId!==data.schoolId)return;
    const url=new URL('/school-orders/',self.location.origin);url.searchParams.set('order',String(data.orderId));
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(w=>new URL(w.url).pathname.startsWith('/school-orders/')) as WindowClient|undefined;
    if(existing){await existing.navigate(url.href);await existing.focus();}else await self.clients.openWindow(url.href);
  })());
});
if(self.SCHOOL_FIREBASE?.enabled){
  const messaging=getMessaging(initializeApp(self.SCHOOL_FIREBASE.config));
  onBackgroundMessage(messaging,async payload=>{
    const d=payload.data;if(!d?.eventId||!d.orderId)return;
    const c=await caches.open('school-push-session-v1');
    const session=await (await c.match('/school-orders/push-session'))?.json();
    if(!session?.schoolId||session.schoolId!==d.schoolId)return;
    // Event tags replace duplicate retry deliveries rather than stacking alerts.
    await self.registration.showNotification(d.title||'Uniform order update',{body:d.body||'Open the app to view your order.',tag:`school-order-${d.eventId}`,icon:'/school-orders/threadflow-icon-512.png',data:{schoolOrderPush:true,orderId:d.orderId,schoolId:d.schoolId}});
  });
}
