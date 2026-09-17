import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Building2, Boxes, Cloud, CreditCard, DatabaseBackup, Download, Link2, RotateCcw, Save, Settings, ShieldCheck, Unlink, Upload } from 'lucide-react';
import { activateSubscription, connectGoogleDrive, createBackup, disconnectGoogleDrive, downloadBackup, downloadGoogleDriveBackup, getGoogleDriveBackupStatus, getSubscription, importBackup, listBackups, listGoogleDriveBackups, restoreBackup, runGoogleDriveBackup, saveGoogleDriveSchedule, type BackupManifest, type GoogleDriveBackupFile, type GoogleDriveBackupStatus, type SubscriptionInfo } from '../../shared/api';
import { SaaSOnboardingModal } from '../saas/SaaSOnboardingModal';

export type CompanySettings = {
  name: string;
  gst: string;
  address: string;
  phone: string;
  logo?: string;
};

export type ModuleSettings = Record<string, boolean>;

type SettingsPageProps = {
  company: CompanySettings;
  setCompany: Dispatch<SetStateAction<CompanySettings>>;
  modules: ModuleSettings;
  setModules: Dispatch<SetStateAction<ModuleSettings>>;
  moduleLabels: string[];
};

const lockedModules = new Set(['Dashboard', 'Settings']);
const renewalDates=()=>{const from=new Date();const to=new Date(from);to.setFullYear(to.getFullYear()+1);const value=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);return{fromDate:value(from),toDate:value(to)}};
const subscriptionDate=(value:string)=>{const [year,month,day]=value.slice(0,10).split('-');return `${day}-${month}-${year}`};
const remainingDays=(value:string)=>Math.max(0,Math.ceil((new Date(value).getTime()-Date.now())/86400000));

export function SettingsPage({ company, setCompany, modules, setModules, moduleLabels }: SettingsPageProps) {
  const [tab, setTab] = useState<'garment' | 'modules' | 'backup' | 'subscription'>('garment');
  const [companyDraft, setCompanyDraft] = useState<CompanySettings>(company);
  const [savedMessage, setSavedMessage] = useState('');
  const [backups, setBackups] = useState<BackupManifest[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [drive, setDrive] = useState<GoogleDriveBackupStatus|null>(null);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveBackupFile[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMessage, setDriveMessage] = useState('');
  const [subscription, setSubscription] = useState<SubscriptionInfo|null>(null);
  const [renewal, setRenewal] = useState({activationMode:'password' as 'password'|'license',licenseKey:'',softwarePassword:'',planName:'Desktop Annual',...renewalDates()});
  const [renewalMessage, setRenewalMessage] = useState('');
  const [showSaaSModal, setShowSaaSModal] = useState(false);
  const [serverUrlMode, setServerUrlMode] = useState<'cloud' | 'local' | 'custom'>(() => {
    const current = localStorage.getItem('garment_api_url_override');
    if (!current || current.includes('garment.telicampus.in')) return 'cloud';
    if (current.includes('127.0.0.1') || current.includes('localhost')) return 'local';
    return 'custom';
  });
  const [customUrl, setCustomUrl] = useState(() => (localStorage.getItem('garment_api_url_override') || 'https://garment.telicampus.in').replace(/\/api\/?$/i,''));
  const enabledCount = moduleLabels.filter(label => modules[label] !== false || lockedModules.has(label)).length;

  useEffect(() => setCompanyDraft(company), [company]);
  useEffect(() => {
    if (tab !== 'backup') return;
    listBackups().then(result => setBackups(result.items)).catch(error => setBackupMessage(error instanceof Error ? error.message : 'Unable to load backups'));
    getGoogleDriveBackupStatus().then(value=>{setDrive(value);if(value.connected)listGoogleDriveBackups().then(x=>setDriveFiles(x.items)).catch(()=>{})}).catch(()=>setDrive(null));
  }, [tab]);
  useEffect(()=>{if(tab==='subscription')getSubscription().then(setSubscription).catch(error=>setRenewalMessage(error instanceof Error?error.message:'Unable to load subscription'))},[tab]);

  const toggleModule = (label: string) => {
    if (lockedModules.has(label)) return;
    setModules(current => ({ ...current, [label]: current[label] === false }));
  };

  const saveCompany = () => {
    setCompany(companyDraft);
    if (serverUrlMode === 'cloud') {
      localStorage.setItem('garment_api_url_override', 'https://garment.telicampus.in');
    } else if (serverUrlMode === 'local') {
      localStorage.setItem('garment_api_url_override', 'http://127.0.0.1:47831');
    } else {
      localStorage.setItem('garment_api_url_override', customUrl.trim().replace(/\/$/,'').replace(/\/api$/i,''));
    }
    setSavedMessage('Saved');
    window.setTimeout(() => setSavedMessage(''), 1800);
  };

  const uploadLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCompanyDraft(current => ({ ...current, logo: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const makeBackup = async () => {
    setBackupBusy(true);
    setBackupMessage('');
    try {
      await createBackup();
      const result = await listBackups();
      setBackups(result.items);
      setBackupMessage('Backup created successfully. Only the 2 most recent backups are kept.');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Backup failed');
    } finally { setBackupBusy(false); }
  };

  const applyBackup = async (backup: BackupManifest) => {
    if (!window.confirm(`Restore backup from ${new Date(backup.createdAt).toLocaleString()}? Current data will be replaced.`)) return;
    setBackupBusy(true);
    setBackupMessage('');
    try {
      await restoreBackup(backup.id);
      window.alert('Backup restored successfully. The application will reload.');
      window.location.reload();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Restore failed');
      setBackupBusy(false);
    }
  };

  const saveBackup = async (backup: BackupManifest) => {
    setBackupBusy(true);
    setBackupMessage('');
    try {
      await downloadBackup(backup.id);
      setBackupMessage('Backup downloaded as a .zip file');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Download failed');
    } finally { setBackupBusy(false); }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setImportBusy(true);
    setImportMessage('Uploading & restoring database backup...');
    try {
      await importBackup(file);
      const result = await listBackups();
      setBackups(result.items);
      setImportMessage('✅ Backup imported & restored successfully! Application reloaded with your data.');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      setImportMessage(error instanceof Error ? `❌ ${error.message}` : 'Import failed');
    } finally { setImportBusy(false); }
  };
  const beginDrive=async()=>{setDriveBusy(true);setDriveMessage('');try{const result=await connectGoogleDrive();window.location.href=result.authorizationUrl}catch(error){setDriveMessage(error instanceof Error?error.message:'Unable to connect Google Drive');setDriveBusy(false)}};
  const removeDrive=async()=>{if(!window.confirm('Disconnect this garment account from Google Drive?'))return;setDriveBusy(true);try{setDrive(await disconnectGoogleDrive());setDriveFiles([]);setDriveMessage('Google Drive disconnected.')}catch(error){setDriveMessage(error instanceof Error?error.message:'Unable to disconnect')}finally{setDriveBusy(false)}};
  const saveDrive=async()=>{if(!drive)return;setDriveBusy(true);try{setDrive(await saveGoogleDriveSchedule({scheduleEnabled:drive.scheduleEnabled,scheduleTime:drive.scheduleTime,timezone:drive.timezone}));setDriveMessage('Backup schedule saved.')}catch(error){setDriveMessage(error instanceof Error?error.message:'Unable to save schedule')}finally{setDriveBusy(false)}};
  const runDrive=async()=>{setDriveBusy(true);setDriveMessage('Creating and uploading backup…');try{await runGoogleDriveBackup();const [status,files]=await Promise.all([getGoogleDriveBackupStatus(),listGoogleDriveBackups()]);setDrive(status);setDriveFiles(files.items);setDriveMessage('Backup uploaded to Google Drive.')}catch(error){setDriveMessage(error instanceof Error?error.message:'Google Drive backup failed')}finally{setDriveBusy(false)}};
  const renew=async()=>{setRenewalMessage('');try{const result=await activateSubscription(renewal);setSubscription(result);setRenewal({...renewal,licenseKey:'',softwarePassword:''});setRenewalMessage('Subscription renewed successfully.')}catch(error){setRenewalMessage(error instanceof Error?error.message:'Renewal failed')}};

  return (
    <section className="content settings-page">
      <div className="measurement-tabs settings-tabs">
        <button className={tab === 'garment' ? 'active' : ''} onClick={() => setTab('garment')}>
          <Building2 size={16} />
          <span>Garment Details<small>receipt information</small></span>
        </button>
        <button className={tab === 'modules' ? 'active' : ''} onClick={() => setTab('modules')}>
          <Boxes size={16} />
          <span>Modules<small>{enabledCount} visible menus</small></span>
        </button>
        <button className={tab === 'backup' ? 'active' : ''} onClick={() => setTab('backup')}>
          <DatabaseBackup size={16} />
          <span>Backup & Restore<small>{backups.length} local backups</small></span>
        </button>
        <button className={tab === 'subscription' ? 'active' : ''} onClick={() => setTab('subscription')}>
          <CreditCard size={16} />
          <span>Subscription<small>{subscription?.status||'desktop license'}</small></span>
        </button>
      </div>

      {tab === 'garment' && (
        <article className="card settings-panel">
          <div className="cardhead">
            <div>
              <h2>Garment master</h2>
              <p>These details are saved locally now and will map to tenant/company settings later.</p>
            </div>
            <div className="settings-save">
              {savedMessage && <span>{savedMessage}</span>}
              <button className="primary" onClick={saveCompany}><Save size={16} /> Save</button>
            </div>
          </div>
          <div className="settings-form">
            <label className="logo-upload">Garment logo
              <input type="file" accept="image/*" onChange={event => uploadLogo(event.target.files?.[0])} />
              <span>{companyDraft.logo ? 'Logo selected' : 'Upload logo for receipts and print'}</span>
            </label>
            {companyDraft.logo && (
              <div className="logo-preview">
                <img src={companyDraft.logo} alt="Garment logo preview" />
                <button className="outline" onClick={() => setCompanyDraft(current => ({ ...current, logo: '' }))}>Remove</button>
              </div>
            )}
            <label>Garment name<input value={companyDraft.name} onChange={event => setCompanyDraft(current => ({ ...current, name: event.target.value }))} placeholder="Enter garment name" /></label>
            <label>GST / GT No.<input value={companyDraft.gst} onChange={event => setCompanyDraft(current => ({ ...current, gst: event.target.value }))} placeholder="GSTIN or local tax number" /></label>
            <label>Phone<input value={companyDraft.phone} onChange={event => setCompanyDraft(current => ({ ...current, phone: event.target.value }))} placeholder="Receipt phone number" /></label>
            <label className="wide">Address<textarea value={companyDraft.address} onChange={event => setCompanyDraft(current => ({ ...current, address: event.target.value }))} placeholder="Full address shown in receipt" /></label>
            <div style={{gridColumn:'1 / -1',marginTop:'12px',paddingTop:'16px',borderTop:'1px solid #dce8e4'}}>
              <h3 style={{fontSize:'14px',fontWeight:700,marginBottom:'4px',color:'#0b3f37'}}>Server Connection Mode & SaaS Portal</h3>
              <p style={{fontSize:'12px',color:'#5f736d',marginBottom:'10px'}}>Configure whether ThreadFlow connects to the Cloud Server (https://garment.telicampus.in) or a Local Machine.</p>
              <div style={{display:'flex',gap:'16px',flexWrap:'wrap',alignItems:'center'}}>
                <label style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <input type="radio" name="serverMode" checked={serverUrlMode==='cloud'} onChange={()=>setServerUrlMode('cloud')}/>
                  Cloud Server (https://garment.telicampus.in)
                </label>
                <label style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <input type="radio" name="serverMode" checked={serverUrlMode==='local'} onChange={()=>setServerUrlMode('local')}/>
                  Local Offline Machine (http://127.0.0.1:47831)
                </label>
                <label style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <input type="radio" name="serverMode" checked={serverUrlMode==='custom'} onChange={()=>setServerUrlMode('custom')}/>
                  Custom API URL
                </label>
              </div>
              {serverUrlMode==='custom'&&(
                <input style={{marginTop:'10px',width:'100%',maxWidth:'450px',fontSize:'12px',padding:'6px 10px',border:'1px solid #c9d8d3',borderRadius:'6px'}} value={customUrl} onChange={e=>setCustomUrl(e.target.value)} placeholder="https://api.yourdomain.com"/>
              )}
            </div>
          </div>
        </article>
      )}

      {tab === 'modules' && (
        <article className="card settings-panel">
          <div className="cardhead">
            <div>
              <h2>Subscription modules</h2>
              <p>Selected modules appear in the left menu. Dashboard and Settings stay visible for all tenants.</p>
            </div>
            <Settings size={18} />
          </div>
          <div className="module-toggle-list">
            {moduleLabels.map(label => {
              const locked = lockedModules.has(label);
              const checked = modules[label] !== false || locked;
              return (
                <label className={locked ? 'module-toggle locked' : 'module-toggle'} key={label}>
                  <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggleModule(label)} />
                  <span>
                    <strong>{label}</strong>
                    <small>{locked ? 'Always enabled' : checked ? 'Visible in menu' : 'Hidden for this tenant'}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </article>
      )}

      {tab === 'backup' && (
        <>
        {drive&&<article className="card settings-panel drive-backup-panel">
          <div className="cardhead">
            <div><h2><Cloud size={19}/> Google Drive Backup</h2><p>Each garment account stores its own portable backups in the connected Google Drive.</p></div>
            <div className="version-actions">
              {!drive?.connected?<button className="primary" disabled={driveBusy||drive?.configured===false} onClick={beginDrive}><Link2 size={15}/> Connect Google Drive</button>:<><button className="primary" disabled={driveBusy} onClick={runDrive}><Cloud size={15}/> {driveBusy?'Working…':'Backup Now'}</button><button className="outline mini-action" disabled={driveBusy} onClick={removeDrive}><Unlink size={14}/> Disconnect</button></>}
            </div>
          </div>
          {!drive?.configured&&drive&&<div className="backup-notice error">Google Drive is not configured yet. Please ask the platform Super Admin to configure it in Platform Settings.</div>}
          {drive?.connected&&<>
            <div className="drive-status"><span><strong>Connected account</strong>{drive.connectedEmail}</span><span><strong>Drive folder</strong>{drive.folderName}</span><span><strong>Last backup</strong>{drive.lastBackupAt?new Date(drive.lastBackupAt).toLocaleString():'Not run yet'}</span><span className={drive.lastBackupStatus==='FAILED'?'failed':'success'}><strong>Status</strong>{drive.lastBackupStatus.replace('_',' ')}</span></div>
            <div className="drive-schedule"><label className="module-toggle"><input type="checkbox" checked={drive.scheduleEnabled} onChange={e=>setDrive({...drive,scheduleEnabled:e.target.checked})}/><span><strong>Automatic daily backup</strong><small>Runs even when the browser is closed</small></span></label><label>Backup time<input type="time" value={drive.scheduleTime} onChange={e=>setDrive({...drive,scheduleTime:e.target.value})}/></label><button className="outline" disabled={driveBusy} onClick={saveDrive}><Save size={14}/> Save Schedule</button></div>
            <div className="version-list drive-files">{driveFiles.map(file=><div className="version-row" key={file.id}><div className="version-meta"><strong>{file.fileName}</strong><span>{new Date(file.createdAt).toLocaleString()} · {(file.sizeBytes/1024/1024).toFixed(2)} MB</span></div><button className="outline mini-action" onClick={()=>downloadGoogleDriveBackup(file)}><Download size={14}/> Download for Desktop</button></div>)}{!driveFiles.length&&<p className="photo-empty">No Google Drive backups created yet.</p>}</div>
          </>}
          {driveMessage&&<div className="backup-notice">{driveMessage}</div>}
        </article>}
        <article className="card settings-panel">
          <div className="cardhead">
            <div>
              <h2>Backup and restore</h2>
              <p>Create a consistent package containing the SQLite database and all school images.</p>
            </div>
            <div className="settings-save">
              {backupMessage && <span>{backupMessage}</span>}
              <button className="primary" disabled={backupBusy} onClick={makeBackup}><DatabaseBackup size={16} /> {backupBusy ? 'Working…' : 'Create backup'}</button>
            </div>
          </div>
          <div className="version-list">
            {backups.map(backup => (
              <div className="version-row" key={backup.id}>
                <div className="version-meta">
                  <strong>{new Date(backup.createdAt).toLocaleString()}</strong>
                  <span>{backup.counts.schools || 0} schools · {backup.counts.students || 0} students · {backup.counts.media_assets || 0} images</span>
                </div>
                <div className="version-actions">
                  <button className="outline mini-action" disabled={backupBusy} onClick={() => saveBackup(backup)}><Download size={14} /> Download</button>
                  <button className="outline mini-action" disabled={backupBusy} onClick={() => applyBackup(backup)}><RotateCcw size={14} /> Restore</button>
                </div>
              </div>
            ))}
            {!backups.length && <p className="photo-empty">No backups created yet.</p>}
          </div>
          <div className="backup-import" style={{ marginTop: 24, padding: '20px', background: '#f8fafc', borderRadius: 12, border: '2px dashed #cbd5e1' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>Import & Restore Backup</div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>Restore data from a downloaded backup (.zip) file created on any device or customer installation.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <label className="file-input" style={{ background: '#007c68', color: '#fff', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 4px rgba(0,124,104,0.2)' }}>
                <Upload size={16} /> {importBusy ? 'Importing & Restoring Database…' : 'Select Backup (.zip) File to Import'}
                <input type="file" accept=".zip,application/zip" disabled={importBusy} onChange={event => importFile(event.target.files?.[0])} style={{ display: 'none' }} />
              </label>
              {importMessage && (
                <div style={{ background: importMessage.includes('✅') ? '#ecfdf5' : importMessage.includes('❌') ? '#fff1f2' : '#e0f2fe', color: importMessage.includes('✅') ? '#047857' : importMessage.includes('❌') ? '#be123c' : '#0369a1', border: '1px solid', borderColor: importMessage.includes('✅') ? '#a7f3d0' : importMessage.includes('❌') ? '#fecdd3' : '#7dd3fc', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                  {importMessage}
                </div>
              )}
            </div>
          </div>
        </article>
        </>
      )}

      {tab === 'subscription' && (
        <article className="card settings-panel subscription-manager">
          <div className="subscription-heading"><div><h2>Subscription Management</h2><p>View or renew the offline desktop subscription.</p></div><div className="subscription-brand"><img src="./threadflow-logo.png" alt="Teli ThreadFlow ERP"/><strong>Teli ThreadFlow ERP</strong></div></div>
          {subscription&&<div className="subscription-summary"><div><span>Subscription Start Date</span><strong>{subscriptionDate(subscription.fromDate)}</strong></div><div><span>Subscription End Date</span><strong>{subscriptionDate(subscription.toDate)}</strong></div><div><span>Subscription Status</span><strong className={subscription.status==='Active'?'subscription-active':'subscription-blocked'}>{subscription.status}</strong></div><div><span>Remaining Days</span><strong>{remainingDays(subscription.toDate)}</strong></div></div>}
          <div className="subscription-note">Software Owner authentication is required to change dates or renew the subscription.</div>
          <div className="subscription-renew-form">
            <label>Authentication<select value={renewal.activationMode} onChange={event=>setRenewal({...renewal,activationMode:event.target.value as 'password'|'license'})}><option value="password">Software Owner Password</option><option value="license">License Key</option></select></label>
            {renewal.activationMode==='password'?<label>Software Owner Password<input type="password" value={renewal.softwarePassword} onChange={event=>setRenewal({...renewal,softwarePassword:event.target.value})}/></label>:<label>License Key<input value={renewal.licenseKey} onChange={event=>setRenewal({...renewal,licenseKey:event.target.value.toUpperCase()})} placeholder="Enter license key"/></label>}
            <label>From Date<input type="date" value={renewal.fromDate} max={renewal.toDate} onChange={event=>setRenewal({...renewal,fromDate:event.target.value})}/></label>
            <label>To Date<input type="date" value={renewal.toDate} min={renewal.fromDate} onChange={event=>setRenewal({...renewal,toDate:event.target.value})}/></label>
          </div>
          <div className="subscription-actions">{renewalMessage&&<span>{renewalMessage}</span>}<button className="primary" onClick={renew}><CreditCard size={16}/> Renew Subscription</button></div>
          <div className="subscription-support">Support: <strong>Sarvesh Teli</strong> · <strong>9880306309</strong></div>
        </article>
      )}
    </section>
  );
}
