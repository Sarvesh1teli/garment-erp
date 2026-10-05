import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Building2, Boxes, Cloud, CreditCard, DatabaseBackup, Download, Link2, RotateCcw, Save, Settings, ShieldCheck, Unlink, Upload, Clock, FileText, Info, Eye, EyeOff, Copy, Check, X } from 'lucide-react';
import { activateSubscription, connectGoogleDrive, createBackup, disconnectGoogleDrive, downloadBackup, downloadGoogleDriveBackup, getGoogleDriveBackupStatus, getSubscription, importBackup, listBackups, listGoogleDriveBackups, restoreBackup, restoreGoogleDriveBackup, runGoogleDriveBackup, runLocalBackup, saveGoogleDriveOAuth, saveGoogleDriveSchedule, type BackupManifest, type GoogleDriveBackupFile, type GoogleDriveBackupStatus, type SubscriptionInfo } from '../../shared/api';
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

const formatBackupDate = (dateVal: string | null | undefined) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
  } catch {
    return String(dateVal);
  }
};

export function SettingsPage({ company, setCompany, modules, setModules, moduleLabels }: SettingsPageProps) {
  const [tab, setTab] = useState<'garment' | 'modules' | 'backup' | 'subscription'>('garment');
  const [backupSubTab, setBackupSubTab] = useState<'automatic' | 'manual'>('automatic');
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupTime, setAutoBackupTime] = useState('22:00');
  const [keepLocalBackups, setKeepLocalBackups] = useState(3);
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [googleDriveBackupEnabled, setGoogleDriveBackupEnabled] = useState(true);

  const [saveScheduleBusy, setSaveScheduleBusy] = useState(false);
  const [localBackupBusy, setLocalBackupBusy] = useState(false);
  const [localBackupMessage, setLocalBackupMessage] = useState('');
  const [driveBackupBusy, setDriveBackupBusy] = useState(false);
  const [driveBackupMessage, setDriveBackupMessage] = useState('');
  const [restoreDriveBusy, setRestoreDriveBusy] = useState<string | null>(null);

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

  const loadDriveStatus = async () => {
    try {
      const status = await getGoogleDriveBackupStatus();
      setDrive(status);
      setAutoBackupEnabled(Boolean(status.localBackupEnabled));
      if (status.scheduleTime) setAutoBackupTime(status.scheduleTime);
      if (status.keepLocalBackups) setKeepLocalBackups(status.keepLocalBackups);
      setCloudBackupEnabled(Boolean(status.cloudBackupEnabled));
      setGoogleDriveBackupEnabled(status.googleDriveBackupEnabled ?? status.scheduleEnabled ?? true);
      if (status.clientId) setOauthClientId(status.clientId);
      if (status.connected) {
        listGoogleDriveBackups().then(x => setDriveFiles(x.items)).catch(() => {});
      }
    } catch {
      setDrive(null);
    }
  };

  useEffect(() => setCompanyDraft(company), [company]);
  useEffect(() => {
    if (tab !== 'backup') return;
    listBackups().then(result => setBackups(result.items)).catch(error => setBackupMessage(error instanceof Error ? error.message : 'Unable to load backups'));
    loadDriveStatus();
  }, [tab]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'GOOGLE_DRIVE_CONNECTED') {
        loadDriveStatus();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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
  const handleConnectDrive = async () => {
    if (!drive?.configured) {
      setShowOAuthModal(true);
      return;
    }
    setDriveBusy(true);
    setDriveBackupMessage('');
    try {
      const result = await connectGoogleDrive();
      if (result.authorizationUrl) {
        const popup = window.open(result.authorizationUrl, 'GoogleDriveOAuth', 'width=560,height=680,menubar=no,toolbar=no');
        const pollTimer = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(pollTimer);
            loadDriveStatus();
          }
        }, 1500);
      }
    } catch (error) {
      setDriveBackupMessage(error instanceof Error ? error.message : 'Unable to connect Google Drive');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!window.confirm('Disconnect this garment account from Google Drive?')) return;
    setDriveBusy(true);
    try {
      const updated = await disconnectGoogleDrive();
      setDrive(updated);
      setDriveFiles([]);
      setDriveBackupMessage('Google Drive disconnected.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to disconnect Google Drive');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleSaveOAuth = async () => {
    if (!oauthClientId.trim()) {
      alert('Please enter Google Client ID');
      return;
    }
    if (!oauthClientSecret.trim()) {
      alert('Please enter Google Client Secret');
      return;
    }
    setDriveBusy(true);
    try {
      const status = await saveGoogleDriveOAuth({
        clientId: oauthClientId.trim(),
        clientSecret: oauthClientSecret.trim(),
        redirectUri: drive?.redirectUri || 'http://localhost:47831/api/settings/google-drive/callback'
      });
      setDrive(status);
      setShowOAuthModal(false);
      setDriveBackupMessage('OAuth credentials saved. You can now click Connect Google Drive.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save OAuth settings');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSaveScheduleBusy(true);
    try {
      const updated = await saveGoogleDriveSchedule({
        scheduleEnabled: googleDriveBackupEnabled,
        scheduleTime: autoBackupTime,
        localBackupEnabled: autoBackupEnabled,
        cloudBackupEnabled: cloudBackupEnabled,
        googleDriveBackupEnabled: googleDriveBackupEnabled,
        keepLocalBackups: keepLocalBackups
      });
      setDrive(updated);
      setLocalBackupMessage('Backup schedule saved successfully.');
      setTimeout(() => setLocalBackupMessage(''), 3000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setSaveScheduleBusy(false);
    }
  };

  const handleRunLocalBackupNow = async () => {
    setLocalBackupBusy(true);
    setLocalBackupMessage('Creating local backup snapshot…');
    try {
      await runLocalBackup();
      const [status, localList] = await Promise.all([getGoogleDriveBackupStatus(), listBackups()]);
      setDrive(status);
      setBackups(localList.items);
      setLocalBackupMessage('Local backup completed');
    } catch (error) {
      setLocalBackupMessage(error instanceof Error ? error.message : 'Local backup failed');
    } finally {
      setLocalBackupBusy(false);
    }
  };

  const handleRunDriveBackupNow = async () => {
    if (!drive?.connected) {
      alert('Please connect Google Drive first.');
      return;
    }
    setDriveBackupBusy(true);
    setDriveBackupMessage('Creating snapshot and uploading to Google Drive…');
    try {
      await runGoogleDriveBackup();
      const [status, files] = await Promise.all([getGoogleDriveBackupStatus(), listGoogleDriveBackups()]);
      setDrive(status);
      setDriveFiles(files.items);
      setDriveBackupMessage('Google Drive backup uploaded');
    } catch (error) {
      setDriveBackupMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Google Drive backup failed');
    } finally {
      setDriveBackupBusy(false);
    }
  };

  const handleRestoreDriveBackup = async (id: string) => {
    if (!window.confirm('Restore this backup from Google Drive? Current database data will be replaced.')) return;
    setRestoreDriveBusy(id);
    setDriveBackupMessage('Downloading and restoring database from Google Drive…');
    try {
      await restoreGoogleDriveBackup(id);
      alert('Backup restored successfully from Google Drive! Application will reload.');
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Google Drive restore failed');
      setDriveBackupMessage(error instanceof Error ? error.message : 'Restore failed');
    } finally {
      setRestoreDriveBusy(null);
    }
  };
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
          <div className="underline-tabs-nav">
            <button
              type="button"
              className={`underline-tab-btn ${backupSubTab === 'automatic' ? 'active' : ''}`}
              onClick={() => setBackupSubTab('automatic')}
            >
              Automatic Backup
            </button>
            <button
              type="button"
              className={`underline-tab-btn ${backupSubTab === 'manual' ? 'active' : ''}`}
              onClick={() => setBackupSubTab('manual')}
            >
              Manual Backup
            </button>
          </div>

          {backupSubTab === 'automatic' && (
            <>
              {/* Card 1: Automatic Local Backup */}
              <div className="backup-section-card">
                <h3 className="backup-card-title">Automatic Local Backup</h3>
                <div className="backup-controls-row">
                  <div className="backup-control-item">
                    <span>Automatic Backup</span>
                    <label className="ios-toggle">
                      <input
                        type="checkbox"
                        checked={autoBackupEnabled}
                        onChange={e => setAutoBackupEnabled(e.target.checked)}
                      />
                      <span className="ios-toggle-slider">
                        <span className="ios-toggle-text on">On</span>
                        <span className="ios-toggle-text off">Off</span>
                      </span>
                    </label>
                  </div>

                  <div className="backup-control-item">
                    <span>Backup Time</span>
                    <div className="backup-time-input-wrap">
                      <input
                        type="time"
                        value={autoBackupTime}
                        onChange={e => setAutoBackupTime(e.target.value)}
                      />
                      <Clock size={15} />
                    </div>
                  </div>

                  <div className="backup-control-item">
                    <span>Keep Local Backups</span>
                    <select
                      className="backup-select"
                      value={keepLocalBackups}
                      onChange={e => setKeepLocalBackups(Number(e.target.value))}
                    >
                      <option value={2}>2 backups</option>
                      <option value={3}>3 backups</option>
                      <option value={5}>5 backups</option>
                      <option value={7}>7 backups</option>
                      <option value={10}>10 backups</option>
                    </select>
                  </div>

                  <div className="backup-control-item">
                    <span>Cloud Backup</span>
                    <label className="ios-toggle">
                      <input
                        type="checkbox"
                        checked={cloudBackupEnabled}
                        onChange={e => setCloudBackupEnabled(e.target.checked)}
                      />
                      <span className="ios-toggle-slider">
                        <span className="ios-toggle-text on">On</span>
                        <span className="ios-toggle-text off">Off</span>
                      </span>
                    </label>
                  </div>

                  <div className="backup-control-item">
                    <span>Google Drive Backup</span>
                    <label className="ios-toggle">
                      <input
                        type="checkbox"
                        checked={googleDriveBackupEnabled}
                        onChange={e => setGoogleDriveBackupEnabled(e.target.checked)}
                      />
                      <span className="ios-toggle-slider">
                        <span className="ios-toggle-text on">On</span>
                        <span className="ios-toggle-text off">Off</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="backup-action-btns" style={{ marginBottom: 18 }}>
                  <button
                    type="button"
                    className="btn-purple-save"
                    onClick={handleSaveSchedule}
                    disabled={saveScheduleBusy}
                  >
                    <Save size={15} /> Save Schedule
                  </button>
                  <button
                    type="button"
                    className="btn-white-action"
                    onClick={handleRunLocalBackupNow}
                    disabled={localBackupBusy}
                  >
                    <FileText size={15} /> {localBackupBusy ? 'Running Backup…' : 'Run Backup Now'}
                  </button>
                </div>

                <div className="backup-status-line">
                  <span>Last backup: <strong>{formatBackupDate(drive?.lastLocalBackupAt || drive?.lastBackupAt)}</strong></span>
                  <span>Size: <strong>{drive?.lastLocalBackupSize || drive?.lastBackupSize || '—'}</strong></span>
                  <span>
                    Status:{' '}
                    <span className={`status-pill ${drive?.lastLocalBackupStatus === 'FAILED' ? 'failed' : 'success'}`}>
                      {drive?.lastLocalBackupStatus || 'SUCCESS'}
                    </span>
                  </span>
                  <span>{localBackupMessage || 'Local backup completed'}</span>
                </div>
              </div>

              {/* Card 2: Google Drive Backup */}
              <div className="backup-section-card gdrive-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                  <div>
                    <h3 className="backup-card-title" style={{ margin: '0 0 6px 0' }}>Google Drive Backup</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
                      Uses Google approval once. ThreadFlow stores an encrypted refresh token, never a Gmail password.
                    </p>
                  </div>
                  <div className="backup-action-btns">
                    <button
                      type="button"
                      className="btn-white-action"
                      onClick={() => setShowOAuthModal(true)}
                    >
                      <Settings size={15} /> OAuth Settings
                    </button>
                    <button
                      type="button"
                      className="btn-purple-save"
                      onClick={handleRunDriveBackupNow}
                      disabled={driveBackupBusy || !drive?.connected}
                      title={!drive?.connected ? 'Please connect Google Drive first' : ''}
                    >
                      <FileText size={15} /> {driveBackupBusy ? 'Uploading to Drive…' : 'Run Google Drive Backup Now'}
                    </button>
                    {!drive?.connected ? (
                      <button
                        type="button"
                        className="btn-white-action"
                        onClick={handleConnectDrive}
                        disabled={driveBusy}
                      >
                        <Link2 size={15} /> Connect Google Drive
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn-white-action"
                          onClick={handleConnectDrive}
                          disabled={driveBusy}
                        >
                          Change Account
                        </button>
                        <button
                          type="button"
                          className="btn-danger-outline"
                          onClick={handleDisconnectDrive}
                          disabled={driveBusy}
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: 13, color: '#334155', borderTop: '1px solid #f1f5f9', paddingTop: 14, marginBottom: 12 }}>
                  <span>
                    Connection:{' '}
                    <span className={`status-pill ${drive?.connected ? 'success' : 'disconnected'}`}>
                      {drive?.connected ? 'CONNECTED' : 'NOT CONNECTED'}
                    </span>
                  </span>
                  <span>Gmail: <strong style={{ color: '#0f172a' }}>{drive?.connectedEmail || '—'}</strong></span>
                  <span>Drive folder: <strong style={{ color: '#0f172a' }}>{drive?.folderName || 'ThreadFlow Garment Backups'}</strong></span>
                  <span>Last Google Drive backup: <strong style={{ color: '#0f172a' }}>{drive?.lastBackupAt ? formatBackupDate(drive.lastBackupAt) : 'Not run yet'}</strong></span>
                  <span>
                    Status:{' '}
                    <span className={`status-pill ${drive?.lastBackupStatus === 'FAILED' ? 'failed' : 'success'}`}>
                      {drive?.lastBackupStatus || 'SUCCESS'}
                    </span>
                  </span>
                </div>

                {driveBackupMessage && (
                  <div style={{ fontSize: 13, color: driveBackupMessage.includes('fail') || driveBackupMessage.includes('Error') ? '#dc2626' : '#16a34a', fontWeight: 600, marginBottom: 12 }}>
                    {driveBackupMessage}
                  </div>
                )}

                <table className="gdrive-table">
                  <thead>
                    <tr>
                      <th>Google Drive Backup</th>
                      <th>Date</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driveFiles.map(file => (
                      <tr key={file.id}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{file.fileName}</td>
                        <td style={{ color: '#475569' }}>{formatBackupDate(file.createdAt)}</td>
                        <td style={{ color: '#475569' }}>{file.sizeStr || (file.sizeBytes ? (file.sizeBytes / 1024 / 1024).toFixed(1) + ' MB' : '—')}</td>
                        <td>
                          <span className={`status-pill ${file.status === 'FAILED' ? 'failed' : 'success'}`}>
                            {file.status || 'SUCCESS'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn-white-action"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                              onClick={() => downloadGoogleDriveBackup(file)}
                            >
                              <Download size={13} /> Download
                            </button>
                            <button
                              type="button"
                              className="btn-danger-outline"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                              disabled={restoreDriveBusy === file.id}
                              onClick={() => handleRestoreDriveBackup(file.id)}
                            >
                              {restoreDriveBusy === file.id ? 'Restoring…' : 'Restore'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {driveFiles.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
                          {drive?.connected
                            ? 'No Google Drive backups created yet. Click "Run Google Drive Backup Now" to create one.'
                            : 'Connect Google Drive above to view cloud backups.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {backupSubTab === 'manual' && (
            <article className="card settings-panel">
              <div className="cardhead">
                <div>
                  <h2>Backup and restore</h2>
                  <p>Create a consistent package containing the SQLite database and all school images.</p>
                </div>
                <div className="settings-save">
                  {backupMessage && <span>{backupMessage}</span>}
                  <button type="button" className="primary" disabled={backupBusy} onClick={makeBackup}>
                    <DatabaseBackup size={16} /> {backupBusy ? 'Working…' : 'Create backup'}
                  </button>
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
                      <button type="button" className="outline mini-action" disabled={backupBusy} onClick={() => saveBackup(backup)}>
                        <Download size={14} /> Download
                      </button>
                      <button type="button" className="outline mini-action" disabled={backupBusy} onClick={() => applyBackup(backup)}>
                        <RotateCcw size={14} /> Restore
                      </button>
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
          )}

          {/* Modal: Configure Google Drive OAuth */}
          {showOAuthModal && (
            <div className="gdrive-modal-overlay" onClick={() => setShowOAuthModal(false)}>
              <div className="gdrive-modal-card" onClick={e => e.stopPropagation()}>
                <div className="gdrive-modal-header">
                  <h3>Configure Google Drive OAuth</h3>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                    onClick={() => setShowOAuthModal(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="gdrive-modal-body">
                  <div className="gdrive-info-callout">
                    <Info size={18} />
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>Use the Google Cloud OAuth Web application credentials.</p>
                      <p>The client secret is never displayed after saving. ThreadFlow generates and securely stores the token protection key automatically. Changing these values disconnects the current Google Drive account.</p>
                    </div>
                  </div>

                  <div className="gdrive-form-group">
                    <label><span className="required">*</span> Google Client ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 355010200355-...apps.googleusercontent.com"
                      value={oauthClientId}
                      onChange={e => setOauthClientId(e.target.value)}
                    />
                  </div>

                  <div className="gdrive-form-group">
                    <label><span className="required">*</span> Google Client Secret</label>
                    <div className="gdrive-input-with-action">
                      <input
                        type={showClientSecret ? 'text' : 'password'}
                        placeholder={drive?.clientSecretConfigured ? '••••••••••••••••••••••••' : 'Enter client secret from Google Console'}
                        value={oauthClientSecret}
                        onChange={e => setOauthClientSecret(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowClientSecret(!showClientSecret)}>
                        {showClientSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="gdrive-form-group">
                    <label><span className="required">*</span> Authorized Redirect URI</label>
                    <div className="gdrive-input-with-action">
                      <input
                        type="text"
                        readOnly
                        value={drive?.redirectUri || 'http://localhost:47831/api/settings/google-drive/callback'}
                        style={{ backgroundColor: '#f8fafc', color: '#475569', cursor: 'text' }}
                      />
                      <button
                        type="button"
                        title="Copy Redirect URI"
                        onClick={() => {
                          navigator.clipboard.writeText(drive?.redirectUri || 'http://localhost:47831/api/settings/google-drive/callback');
                          setCopiedRedirectUri(true);
                          setTimeout(() => setCopiedRedirectUri(false), 2000);
                        }}
                      >
                        {copiedRedirectUri ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Copy &amp; paste this exact URI under <strong>Authorized redirect URIs</strong> in your Google Cloud Console.
                    </span>
                  </div>
                </div>

                <div className="gdrive-modal-footer">
                  <button type="button" className="btn-white-action" onClick={() => setShowOAuthModal(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-purple-save" onClick={handleSaveOAuth} disabled={driveBusy}>
                    Save OAuth Settings
                  </button>
                </div>
              </div>
            </div>
          )}
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
