const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function setupTeliAdmin({app,ipcMain,safeStorage,getWindow,getSubscriptionSync=()=>null,ownerPassword,openExternal=async()=>{throw Error('Download browser unavailable');}}){
  const file=()=>path.join(app.getPath('userData'),'teli-admin-installation.json');
  let busy=false,lastError='';
  let latestRelease=null,updateError='',updateChecking;
  function read(){if(!fs.existsSync(file()))return null;const wrapper=JSON.parse(fs.readFileSync(file(),'utf8'));return JSON.parse(safeStorage.decryptString(Buffer.from(wrapper.encrypted,'base64')));}
  function save(value){if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure credential storage is unavailable.');fs.mkdirSync(path.dirname(file()),{recursive:true});fs.writeFileSync(file()+'.tmp',JSON.stringify({encrypted:safeStorage.encryptString(JSON.stringify(value)).toString('base64')}),{mode:0o600});fs.renameSync(file()+'.tmp',file());}
  function serverUrl(value){const url=new URL(value);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw Error('Use an HTTPS admin server address (HTTP is allowed only for localhost).');return url.origin;}
  const trusted=event=>{const win=getWindow();if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted request');};
  const view=value=>({installationId:value?.installationId,customerId:value?.customerId,serverUrl:value?.serverUrl,registered:!!value?.customerId,lastSync:value?.lastSync,lastError});
  async function request(value,endpoint,body){const response=await fetch(value.serverUrl+endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+value.installationToken},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok)throw Error(result.message||'Admin server request failed');if(result.installationId!==value.installationId)throw Error('Admin response does not match this installation');return result;}
  require('./customer-notifications.cjs').setupCustomerNotifications({app,ipcMain,safeStorage,read,request,trusted});
  function validRelease(release){if(!release)return null;const url=new URL(release.downloadUrl);if(release.product!=='garment'||!/^\d+\.\d+\.\d+$/.test(release.version)||url.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(url.hostname)||url.username||url.password||url.hash)throw Error('Invalid update response');return release;}
  async function checkUpdate(){if(updateChecking)return updateChecking;updateChecking=(async()=>{const value=read();if(!value?.customerId){latestRelease=null;return;}try{const response=await request(value,'/api/desktop/update',{installationId:value.installationId,version:app.getVersion()});latestRelease=validRelease(response.release);updateError='';}catch(error){latestRelease=null;updateError=error.message;}})().finally(()=>updateChecking=null);return updateChecking;}
  ipcMain.handle('teli-admin-update',async event=>{trusted(event);await checkUpdate();return {release:latestRelease,error:updateError,currentVersion:app.getVersion()};});
  ipcMain.handle('teli-admin-update-shown',async(event,releaseId)=>{trusted(event);if(!latestRelease||latestRelease.id!==releaseId)return;const value=read();await request(value,'/api/desktop/update-event',{installationId:value.installationId,releaseId,event:'SHOWN'});});
  ipcMain.handle('teli-admin-update-download',async(event,releaseId)=>{trusted(event);const value=read();if(!value?.customerId)throw Error('Register this desktop first');await checkUpdate();if(!latestRelease||latestRelease.id!==releaseId)throw Error('This update is no longer available. Check for updates again.');const response=await request(value,'/api/desktop/update-event',{installationId:value.installationId,releaseId,event:'DOWNLOAD_CLICKED'});const release=validRelease(response.release);await openExternal(release.downloadUrl);return {opened:true};});
  async function subscriptionCheck(value){const local=getSubscriptionSync();if(!local)return;const renewal=local.outgoing();const result=await request(value,'/api/desktop/subscription',{installationId:value.installationId,renewal,signature:renewal?local.sign(value.installationId,renewal):undefined});if(result.customerId!==value.customerId)throw Error('Subscription response does not match this customer');if(!result.installationActive){local.connectionDisabled?.();throw Error('Cloud connection is disabled in Teli Admin. Local desktop work is unaffected.');}local.apply(result);}
  async function sync(){if(busy)return;busy=true;try{const value=read();if(!value?.customerId)return;await subscriptionCheck(value);await request(value,'/api/desktop/heartbeat',{installationId:value.installationId,version:app.getVersion()});value.lastSync=new Date().toISOString();save(value);lastError='';}catch(error){lastError=error.message;}finally{busy=false;}}
  ipcMain.handle('teli-admin-status',event=>{trusted(event);return view(read());});
  ipcMain.handle('teli-admin-register',async(event,input)=>{
    trusted(event);if(busy)throw Error('An admin connection request is already running.');
    if(!input||typeof input.serverUrl!=='string'||typeof input.code!=='string'||!input.code.trim()||input.code.length>100)throw Error('Enter the admin server address and activation code.');
    const origin=serverUrl(input.serverUrl);busy=true;
    try{
      let value=read();const reconnect=!!value?.customerId&&input.reconnect===true;
      if(value?.customerId&&!reconnect)throw Error('This desktop is already registered. Contact the software owner to transfer it.');
      if(reconnect){if(typeof ownerPassword!=='string'||!crypto.timingSafeEqual(crypto.createHash('sha256').update(String(input.ownerPassword||'')).digest(),crypto.createHash('sha256').update(ownerPassword).digest()))throw Error('Invalid software owner password');value={...value};}
      if(value&&value.serverUrl!==origin)throw Error('A registration is pending for another server. Contact the software owner.');
      if(!value){value={installationId:crypto.randomUUID(),installationToken:crypto.randomBytes(32).toString('hex'),serverUrl:origin};save(value);}
      const result=await request(value,'/api/desktop/register',{installationId:value.installationId,installationToken:value.installationToken,code:input.code.trim(),version:app.getVersion()});
      if(result.product!=='garment'||typeof result.customerId!=='string')throw Error('Invalid admin registration response');
      if(reconnect&&value.customerId!==result.customerId)getSubscriptionSync()?.resetBinding?.();
      value.customerId=result.customerId;value.lastSync=new Date().toISOString();save(value);lastError='';return view(value);
    }catch(error){lastError=error.message;throw error;}finally{busy=false;}
  });
  ipcMain.handle('teli-admin-sync',async event=>{trusted(event);await sync();return view(read());});
  const timer=setInterval(()=>{void sync();void checkUpdate();},60000);timer.unref();app.on('before-quit',()=>clearInterval(timer));void sync();void checkUpdate();
}
module.exports={setupTeliAdmin};
