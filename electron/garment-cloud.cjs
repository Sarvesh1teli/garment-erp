const fs=require('fs'),path=require('path'),crypto=require('crypto');
const CLOUD='https://garment.telisoftware.com';
const valid=value=>value&&/^[0-9a-f-]{36}$/i.test(value.businessId)&&/^[a-f0-9]{64}$/.test(value.secret);
function setupGarmentCloud({app,ipcMain,dialog,safeStorage,getWindow}){
  const identityPath=()=>path.join(app.getPath('userData'),'garment-business-identity.json');
  let cache;
  let resetting=false;
  function save(identity){
    if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure credential storage is unavailable. Restart Windows and try again.');
    const payload={version:1,encrypted:safeStorage.encryptString(JSON.stringify(identity)).toString('base64')};
    fs.mkdirSync(app.getPath('userData'),{recursive:true});
    fs.writeFileSync(identityPath()+'.tmp',JSON.stringify(payload),{mode:0o600});fs.renameSync(identityPath()+'.tmp',identityPath());cache=identity;
  }
  function load(){
    if(cache)return cache;
    if(fs.existsSync(identityPath())){try{const p=JSON.parse(fs.readFileSync(identityPath(),'utf8').replace(/^\uFEFF/,''));const identity=JSON.parse(safeStorage.decryptString(Buffer.from(p.encrypted,'base64')));if(!valid(identity))throw Error();cache=identity;return identity;}catch{cache=undefined;throw Error('Cannot read this computer’s business identity. It may belong to another Windows computer/account or be damaged. In Manage Connection, import this business’s private link file. Existing identities are never replaced automatically.');}}

    const identity={businessId:crypto.randomUUID(),secret:crypto.randomBytes(32).toString('hex'),installationId:crypto.randomUUID()};save(identity);return identity;
  }
  const allowed=/^\/api\/garment\/(?:connection|connection-history(?:\?[a-zA-Z0-9%=&+_.-]*)?|school-links(?:\/[0-9a-f-]+\/(?:approve|reject))?|school-orders(?:\/[0-9a-f-]+\/(?:accept|reject|message))?)$/i;
  async function request(identity,endpoint,options={}){
    const headers={'Content-Type':'application/json',Authorization:`Bearer ${identity.businessId}.${identity.secret}`,'X-Installation-ID':identity.installationId};
    const response=await fetch(CLOUD+endpoint,{method:options.method||'GET',headers,body:options.body,signal:AbortSignal.timeout(20000)});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.message||'Unable to connect to garment cloud');return body;
  }
  let registering,registeredId;
  async function register(businessName){
    const id=load();if(registeredId===id.businessId)return;
    if(!registering){registering=request(id,'/api/garment/register',{method:'POST',body:JSON.stringify({businessId:id.businessId,secret:id.secret,installationId:id.installationId,businessName})}).then(result=>{registeredId=id.businessId;return result;}).finally(()=>registering=null);}
    return registering;
  }
  const trusted=event=>{const win=getWindow();if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted request');};
  const snapshotPath=()=>path.join(app.getPath('userData'),'garment-cloud-cache.json');
  function readSnapshot(){try{const raw=JSON.parse(fs.readFileSync(snapshotPath(),'utf8'));const data=JSON.parse(safeStorage.decryptString(Buffer.from(raw.encrypted,'base64')));return data.businessId===load().businessId?data:{businessId:load().businessId};}catch{return {businessId:load().businessId};}}
  ipcMain.handle('garment-cloud-snapshot',async event=>{trusted(event);const data=readSnapshot();return {connection:data.connection,links:data.links,orders:data.orders,updatedAt:data.updatedAt};});
  let syncing;
  let publishing;
  function flushCatalog(){
    if(publishing)return publishing;
    publishing=(async()=>{if(!fs.existsSync(identityPath()))return;const id=load();while(id.pendingGarmentTypes&&load()===id){const types=id.pendingGarmentTypes;await register();await request(id,'/api/garment/garment-types',{method:'POST',body:JSON.stringify({types})});if(load()!==id)return;if(id.pendingGarmentTypes===types){delete id.pendingGarmentTypes;save(id);}}})().finally(()=>publishing=null);return publishing;
  }
  ipcMain.handle('garment-catalog-publish',async(event,types)=>{trusted(event);if(!Array.isArray(types)||types.length>500||types.some(r=>!r||typeof r.name!=='string'||!r.name.trim()||r.name.length>100||!['All','Boys','Girls'].includes(r.gender)||typeof r.active!=='boolean'))throw Error('Invalid garment types');const id=load();id.pendingGarmentTypes=types.map(r=>({name:r.name,gender:r.gender,active:r.active}));save(id);try{await flushCatalog();return {synced:!load().pendingGarmentTypes};}catch{return {synced:false};}});
  function flushName(){
    if(syncing)return syncing;
    syncing=(async()=>{
      if(!fs.existsSync(identityPath()))return;
      const id=load();
      while(id.pendingBusinessName&&load()===id){
        const name=id.pendingBusinessName;await register(name);
        await request(id,'/api/garment/profile',{method:'POST',body:JSON.stringify({businessName:name})});
        if(load()!==id)return;
        if(id.pendingBusinessName===name){delete id.pendingBusinessName;save(id);}
      }
    })().finally(()=>syncing=null);return syncing;
  }
  const retry=setInterval(()=>{void flushName().catch(()=>{});void flushCatalog().catch(()=>{});},60000);retry.unref();
  app.on?.('before-quit',()=>clearInterval(retry));
  ipcMain.handle('garment-business-name',async(event,name)=>{
    trusted(event);if(typeof name!=='string'||!name.trim()||name.trim().length>120)throw Error('Enter a garment name between 1 and 120 characters.');
    const id=load();id.pendingBusinessName=name.trim();save(id);
    try{await flushName();return {synced:!load().pendingBusinessName};}
    catch{return {synced:false};}
  });
  ipcMain.handle('garment-cloud-request',async(event,endpoint,options={})=>{
    trusted(event);if(typeof endpoint!=='string'||!allowed.test(endpoint)||!['GET','POST'].includes(options.method||'GET')||options.body&&options.body.length>16000)throw Error('Unsupported garment operation');
    const id=load();await register(options.businessName);const result=await request(id,endpoint,options);
    const key={'/api/garment/connection':'connection','/api/garment/school-links':'links','/api/garment/school-orders':'orders'}[endpoint];
    if(key&&(!options.method||options.method==='GET')&&load().businessId===id.businessId){try{const data=readSnapshot();data[key]=result.data;data.updatedAt=new Date().toISOString();const encrypted=safeStorage.encryptString(JSON.stringify(data)).toString('base64');fs.writeFileSync(snapshotPath(),JSON.stringify({encrypted}),{mode:0o600});}catch{/* A cache failure must not fail a successful cloud request. */}}
    return result;
  });
  ipcMain.handle('garment-business-export',async event=>{
    trusted(event);const id=load();await register();const result=await dialog.showSaveDialog(getWindow(),{title:'Private business link file — keep secret; only share with computers of this business',defaultPath:'garment-business-link.json',filters:[{name:'Business link',extensions:['json']}]});
    if(result.canceled||!result.filePath)return false;
    fs.writeFileSync(result.filePath,JSON.stringify({type:'threadflow-business-link',businessId:id.businessId,secret:id.secret}),{mode:0o600});return true;
  });
  ipcMain.handle('garment-business-reset',async(event,businessName='')=>{
    trusted(event);if(resetting)throw Error('Connection reset is already in progress.');
    if(typeof businessName!=='string'||businessName.trim().length>120)throw Error('Invalid business name');
    resetting=true;
    try{
      const answer=await dialog.showMessageBox(getWindow(),{type:'warning',buttons:['Cancel','Back up and reset connection'],defaultId:0,cancelId:0,message:'Generate a new Garment Connection ID?',detail:'The previous identity will be preserved in a recovery file. Existing school links and cloud orders will stay under the old ID; schools must connect again using the new ID. Local stock, invoices, payments, measurements and salaries are unchanged. After resetting, export the new private business link and keep it safe.'});
      if(answer.response!==1)return false;
      if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure credential storage is unavailable. Restart Windows and try again.');
      await Promise.allSettled([registering,syncing,publishing].filter(Boolean));
      const identity={businessId:crypto.randomUUID(),secret:crypto.randomBytes(32).toString('hex'),installationId:crypto.randomUUID()};
      if(businessName.trim())identity.pendingBusinessName=businessName.trim();
      // Verify encryption before touching the current identity; preserve original bytes.
      safeStorage.encryptString(JSON.stringify(identity));
      fs.mkdirSync(app.getPath('userData'),{recursive:true});
      const suffix='.before-reset-'+Date.now()+'-'+crypto.randomUUID();
      if(fs.existsSync(identityPath()))fs.copyFileSync(identityPath(),identityPath()+suffix,fs.constants.COPYFILE_EXCL);
      if(fs.existsSync(snapshotPath()))fs.copyFileSync(snapshotPath(),snapshotPath()+suffix,fs.constants.COPYFILE_EXCL);
      save(identity);registeredId=undefined;
      // Registration uses this persisted identity on the next sync, including offline retry.
      return true;
    }finally{resetting=false;}
  });
  ipcMain.handle('garment-business-import',async event=>{
    trusted(event);const selected=await dialog.showOpenDialog(getWindow(),{title:'Link this computer to an existing garment business',properties:['openFile'],filters:[{name:'Private business link file',extensions:['json']}]});
    if(selected.canceled||!selected.filePaths[0])return false;
    if(fs.statSync(selected.filePaths[0]).size>10000)throw Error('Invalid business link file');
    const input=JSON.parse(fs.readFileSync(selected.filePaths[0],'utf8').replace(/^\uFEFF/,''));if(input.type!=='threadflow-business-link'||!valid(input))throw Error('Invalid business link file');
    const identity={businessId:input.businessId,secret:input.secret,installationId:crypto.randomUUID()};
    // Validate before replacing the local identity. Local stock/invoices are unchanged.
    await request(identity,'/api/garment/connection');
    const existing=fs.existsSync(identityPath());
    const confirmation=await dialog.showMessageBox(getWindow(),{type:'warning',buttons:['Cancel','Link business'],defaultId:0,cancelId:0,message:'Use this business for school connections on this computer?',detail:'Only use a link file from your own business. Local records are not transferred. '+(existing?'The current cloud identity will be saved as an encrypted recovery file.':'')});
    if(confirmation.response!==1)return false;
    if(existing)fs.copyFileSync(identityPath(),identityPath()+'.previous-'+Date.now());save(identity);return true;
  });
}
module.exports={setupGarmentCloud};
