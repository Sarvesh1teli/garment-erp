const fs=require('node:fs'),path=require('node:path');
function setupCustomerNotifications({app,ipcMain,safeStorage,read,request,trusted}){
 const file=path.join(app.getPath('userData'),'teli-customer-notifications.json');let busy=null;
 function load(binding){try{const wrapper=JSON.parse(fs.readFileSync(file,'utf8')),value=JSON.parse(safeStorage.decryptString(Buffer.from(wrapper.encrypted,'base64')));if(value.binding===binding)return value;}catch{}return {binding,messages:[],viewed:{},pending:[]};}
 function save(value){if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure storage unavailable');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify({encrypted:safeStorage.encryptString(JSON.stringify(value)).toString('base64')}),{mode:0o600});fs.renameSync(file+'.tmp',file);}
 const binding=value=>value?.serverUrl+'|'+value?.installationId+'|'+value?.customerId;
 const active=message=>!message.expiresAt||message.expiresAt>new Date().toISOString();
 const response=state=>({messages:state.messages.filter(active).map(m=>({...m,viewedAt:state.viewed[m.id]||m.viewedAt||null}))});
 async function flush(value){let state=load(binding(value));for(const id of state.pending){try{await request(value,'/api/desktop/notification-viewed',{installationId:value.installationId,notificationId:id});const current=load(binding(value));current.pending=current.pending.filter(x=>x!==id);save(current);}catch{break;}}}
 async function check(){if(busy)return busy;busy=(async()=>{const value=read();if(!value?.customerId)return {messages:[]};try{await flush(value);const result=await request(value,'/api/desktop/notifications',{installationId:value.installationId});if(!Array.isArray(result.messages)||result.messages.some(m=>typeof m.id!=='string'||typeof m.title!=='string'||typeof m.message!=='string'))throw Error('Invalid notification response');const state=load(binding(value));state.messages=result.messages;for(const m of result.messages)if(m.viewedAt)state.viewed[m.id]=m.viewedAt;save(state);return response(state);}catch(error){return {...response(load(binding(value))),error:error.message};}})().finally(()=>busy=null);return busy;}
 async function markViewed(id){const value=read();if(!value?.customerId)throw Error('Desktop is not registered');const state=load(binding(value));if(typeof id!=='string'||!state.messages.some(m=>m.id===id))throw Error('Notification not found');state.viewed[id]=state.viewed[id]||new Date().toISOString();if(!state.pending.includes(id))state.pending.push(id);save(state);void flush(value);return response(state);}
 ipcMain.handle('teli-admin-notifications',async event=>{trusted(event);return check();});
 ipcMain.handle('teli-admin-notification-viewed',async(event,id)=>{trusted(event);return markViewed(id);});
 return {check};
}
module.exports={setupCustomerNotifications};
