const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const CLOUD = 'https://grm-bill-sms.telisoftware.com';

function createGarmentSmsRelay({ database: db, dataDirectory, subscriptionActive, companyName, legacySettings, fetchImpl = fetch }) {
  db.exec(`CREATE TABLE IF NOT EXISTS garment_cloud_sms_config(tenant TEXT PRIMARY KEY, installation TEXT NOT NULL, code TEXT NOT NULL DEFAULT '', secret TEXT NOT NULL, settings TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS garment_cloud_sms_outbox(id TEXT PRIMARY KEY,tenant TEXT NOT NULL,reference TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',cloud_id TEXT,error TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_try INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,UNIQUE(tenant,reference));`);
  let secure;
  try { const electron = require('electron'); if (electron.safeStorage?.isEncryptionAvailable()) secure = electron.safeStorage; } catch {}
  const keyPath = path.join(dataDirectory, 'garment-sms-encryption.key');
  let key;
  function localKey() {
    if (!key) {
      if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32), { mode: 0o600, flag: 'wx' });
      key = fs.readFileSync(keyPath);
    }
    return key;
  }
  const seal = value => {
    if (secure) return 'dpapi:' + secure.encryptString(value).toString('base64');
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', localKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return 'aes:' + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  };
  const open = value => {
    if (value.startsWith('dpapi:')) { if (!secure) throw new Error('Open SMS settings on the original desktop account.'); return secure.decryptString(Buffer.from(value.slice(6), 'base64')); }
    const bytes = Buffer.from(value.slice(4), 'base64'), decipher = crypto.createDecipheriv('aes-256-gcm', localKey(), bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
  };
  function get(tenant) {
    let row = db.prepare('SELECT * FROM garment_cloud_sms_config WHERE tenant=?').get(tenant);
    if (!row) {
      const previous = tenant === 'default' ? legacySettings() : {};
      const settings = { enabled: false, language: 'english', contacts: previous.contacts || {}, triggers: previous.triggers || {}, autoInvoice: false, machine: os.hostname() };
      db.prepare('INSERT INTO garment_cloud_sms_config VALUES(?,?,?,?,?)').run(tenant,crypto.randomUUID(),'','',JSON.stringify(settings));
      row = db.prepare('SELECT * FROM garment_cloud_sms_config WHERE tenant=?').get(tenant);
    }
    const settings=JSON.parse(row.settings);
    let transferred=Boolean(settings.machine && settings.machine!==os.hostname());
    if(row.secret){try{open(row.secret);}catch{transferred=true;}}
    if(transferred){
      db.prepare("UPDATE garment_cloud_sms_outbox SET status='RESTORED_HOLD' WHERE tenant=? AND status IN ('PENDING','QUEUED','IN_PROGRESS','UNKNOWN')").run(tenant);
      db.prepare("UPDATE garment_cloud_sms_config SET installation=?,code='',secret='',settings=? WHERE tenant=?").run(crypto.randomUUID(),JSON.stringify({...settings,enabled:false,autoInvoice:false,machine:os.hostname()}),tenant);
      row=db.prepare('SELECT * FROM garment_cloud_sms_config WHERE tenant=?').get(tenant);
    }
    return { ...row, settings: JSON.parse(row.settings) };
  }
  function assertActive() { if (!subscriptionActive()) throw new Error('An active desktop subscription is required for SMS.'); }
  async function cloud(row, endpoint, body) {
    const response = await fetchImpl(CLOUD + '/api/v1/billing' + endpoint, { method: body ? 'POST' : 'GET', headers: { 'Content-Type':'application/json', Authorization:'Bearer '+open(row.secret), 'X-Shop-Code':row.code }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Garment SMS server returned ${response.status}. Check connection and registration.`);
    return response.json();
  }
  async function register(tenant) {
    assertActive(); let row = get(tenant);
    if (!row.secret) { row.secret = seal(crypto.randomBytes(40).toString('base64url')); db.prepare('UPDATE garment_cloud_sms_config SET secret=? WHERE tenant=?').run(row.secret,tenant); }
    const result = await cloud(row,'/enrollments',{ installationId:row.installation,shopName:companyName(tenant) || 'Garment business' });
    db.prepare('UPDATE garment_cloud_sms_config SET code=? WHERE tenant=?').run(result.shopCode,tenant);
    return result;
  }
  function enqueue(tenant, job) {
    assertActive(); const row = get(tenant);
    if (!row.code || !row.secret) throw new Error('Register this desktop in Settings > SMS Gateway and pair a phone first.');
    const phone = String(job.recipientPhone || '').replace(/[^0-9+]/g,''), message = String(job.message || '').trim();
    if (!/^\+?\d{10,15}$/.test(phone) || !message || message.length > 1000) throw new Error('Use a valid mobile number and a message of 1–1000 characters.');
    const reference = job.referenceId ? `${job.referenceType || 'manual'}:${job.referenceId}` : `manual:${crypto.randomUUID()}`;
    const existing = db.prepare('SELECT * FROM garment_cloud_sms_outbox WHERE tenant=? AND reference=?').get(tenant,reference);
    if (existing) return { id:existing.id,status:existing.status,alreadyQueued:true };
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO garment_cloud_sms_outbox(id,tenant,reference,name,phone,message,created) VALUES(?,?,?,?,?,?,?)').run(id,tenant,reference,String(job.recipientName || phone),phone,message,new Date().toISOString());
    return { id,status:'PENDING' };
  }
  let busy = false;
  async function flush() {
    if (busy || !subscriptionActive()) return;
    busy = true;
    try {
      const jobs = db.prepare("SELECT * FROM garment_cloud_sms_outbox WHERE status='PENDING' AND next_try<=? ORDER BY created LIMIT 10").all(Date.now());
      for (const job of jobs) {
        if (!subscriptionActive()) break;
        try {
          const row = get(job.tenant), result = await cloud(row,'/jobs/sms',{ referenceId:`${row.installation}:${job.reference}`,recipientName:job.name,recipientPhone:job.phone,message:job.message });
          db.prepare('UPDATE garment_cloud_sms_outbox SET status=?,cloud_id=?,error=NULL WHERE id=?').run(result.status==='PENDING'?'QUEUED':result.status,result.jobId,job.id);
        } catch (error) { db.prepare('UPDATE garment_cloud_sms_outbox SET attempts=attempts+1,error=?,next_try=? WHERE id=?').run(error.message,Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts,7)),job.id); }
      }
      for (const job of db.prepare("SELECT * FROM garment_cloud_sms_outbox WHERE status IN ('QUEUED','IN_PROGRESS','UNKNOWN') AND cloud_id IS NOT NULL ORDER BY created LIMIT 30").all()) {
        try { const result = await cloud(get(job.tenant),'/jobs/'+encodeURIComponent(job.cloud_id)); db.prepare('UPDATE garment_cloud_sms_outbox SET status=?,error=? WHERE id=?').run(result.status==='PENDING'?'QUEUED':result.status,result.errorMessage||null,job.id); } catch {}
      }
    } finally { busy = false; }
  }
  function settings(tenant) {
    const row=get(tenant), jobs=db.prepare('SELECT * FROM garment_cloud_sms_outbox WHERE tenant=? ORDER BY created DESC LIMIT 30').all(tenant);
    return { ...row.settings,organizationCode:row.code,installationId:row.installation,cloudUrl:CLOUD,appCode:'GARMENTERP',deviceKeyConfigured:Boolean(row.code),devices:[],lastHeartbeat:null,deviceInfo:null,pending:jobs.filter(j=>['PENDING','QUEUED','IN_PROGRESS'].includes(j.status)).length,sentToday:jobs.filter(j=>j.status==='SUBMITTED'&&j.created.slice(0,10)===new Date().toISOString().slice(0,10)).length,failedCount:jobs.filter(j=>['FAILED','UNKNOWN'].includes(j.status)).length,recentJobs:jobs.map(j=>({id:j.id,reference:j.reference,recipientName:j.name,recipientPhone:j.phone,message:j.message,status:j.status,createdAt:j.created,error:j.error})) };
  }
  function update(tenant, patch) {
    const row=get(tenant), next={...row.settings};
    for(const key of ['enabled','autoInvoice','contacts','triggers','language']) if(patch[key]!==undefined)next[key]=patch[key];
    if(!['english','kannada','hindi','both','hindi_english'].includes(next.language))throw new Error('Invalid SMS language');
    db.prepare('UPDATE garment_cloud_sms_config SET settings=? WHERE tenant=?').run(JSON.stringify(next),tenant);
    return settings(tenant);
  }
  async function devices(tenant) {
    const row=get(tenant);if(!row.code)return [];
    return (await cloud(row,'/devices')).map(d=>({id:d.id,deviceName:d.name,status:d.revoked?'REVOKED':'ACTIVE',lastSeenAt:new Date(d.last_seen*1000).toISOString(),createdAt:new Date(d.last_seen*1000).toISOString()}));
  }
  function automaticInvoices(tenant, before, after) {
    const row=get(tenant); if(!row.settings.autoInvoice || !row.code || !subscriptionActive())return;
    const known=new Set(before.map(i=>i.invoiceNo));
    for(const invoice of after){
      if(known.has(invoice.invoiceNo)||!/^\+?\d{10,15}$/.test(String(invoice.customerPhone||'').replace(/[^0-9+]/g,'')))continue;
      enqueue(tenant,{recipientName:invoice.customer,recipientPhone:invoice.customerPhone,message:invoiceMessage(invoice,companyName(tenant),row.settings.language),referenceType:'invoice',referenceId:invoice.invoiceNo});
    }
  }
  const timer=setInterval(()=>void flush().catch(()=>{}),30000);timer.unref();
  return {get,register,enqueue,flush,settings,update,devices,automaticInvoices,cloud,close:()=>clearInterval(timer)};
}
function invoiceMessage(invoice, company, language='english') {
  const money=value=>Number(value||0).toFixed(2);
  const items=invoice.items?.length?invoice.items:[{garment:invoice.product,size:'',qty:invoice.qty}];
  const summary=items.slice(0,3).map(i=>`${String(i.garment||'Item').slice(0,40)}${i.size?` (${i.size})`:''} x ${i.qty} ${invoice.unit||'PCS'}`).join(', ');
  const more=Math.max(0,items.length-3);
  const en=`${String(company||'Garment business').slice(0,80)}: Invoice ${invoice.invoiceNo}, ${invoice.invoiceDate}. Items: ${summary}${more?`, +${more} more items`:''}. Total Rs.${money(invoice.totalAmount)}. Thank you.`;
  const kn=`${String(company||'Garment business').slice(0,80)}: ಬಿಲ್ ${invoice.invoiceNo}, ${invoice.invoiceDate}. ಉತ್ಪನ್ನಗಳು: ${summary}${more?`, ಇನ್ನೂ ${more} ಉತ್ಪನ್ನಗಳು`:''}. ಒಟ್ಟು ರೂ.${money(invoice.totalAmount)}. ಧನ್ಯವಾದಗಳು.`;
  const hi=`${company||'Garment business'}: बिल ${invoice.invoiceNo}, ${invoice.invoiceDate}. वस्तुएं: ${summary}. कुल रु.${money(invoice.totalAmount)}. धन्यवाद.`;
  return language==='hindi'?hi:language==='hindi_english'?hi+'\n\n'+en:language==='kannada'?kn:language==='both'?kn+'\n\n'+en:en;
}
module.exports={createGarmentSmsRelay,invoiceMessage,CLOUD};
