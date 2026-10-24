const ALLOWED=/^\/api\/v1\/(?:sms-settings|sms\/send|sms-gateway\/(?:register|key|devices(?:\/[^/]+\/revoke)?))$/;
function setupGarmentSmsIpc(ipcMain, fetchImpl=fetch){
 ipcMain.handle('garment-sms-request',async(_event,endpoint,options={})=>{
  if(typeof endpoint!=='string'||!ALLOWED.test(endpoint))throw new Error('Unsupported SMS endpoint');
  const method=options.method||'GET';
  if(!['GET','POST','PUT'].includes(method))throw new Error('Unsupported SMS method');
  const body=options.body;
  if(body!==undefined&&(typeof body!=='string'||Buffer.byteLength(body)>8192))throw new Error('SMS request is too large');
  const tenant=String(options.tenantId||'default');
  if(tenant.length>200||/[\r\n]/.test(tenant))throw new Error('Invalid SMS tenant');
  const response=await fetchImpl('http://127.0.0.1:47831'+endpoint,{method,headers:{'Content-Type':'application/json','X-Tenant-ID':tenant},body,signal:AbortSignal.timeout(20000)});
  const text=await response.text();let result;
  try{result=JSON.parse(text);}catch{throw new Error('The local SMS backend returned an unexpected response. Close and restart the updated desktop app.');}
  if(!response.ok)throw new Error(result.error||result.message||`SMS request failed (${response.status})`);
  return result;
 });
}
module.exports={setupGarmentSmsIpc};
