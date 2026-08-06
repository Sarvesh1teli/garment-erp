import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Building2, Boxes, CreditCard, DatabaseBackup, RotateCcw, Save, Settings } from 'lucide-react';
import { activateSubscription, createBackup, getSubscription, listBackups, restoreBackup, type BackupManifest, type SubscriptionInfo } from '../../shared/api';

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
  const [subscription, setSubscription] = useState<SubscriptionInfo|null>(null);
  const [renewal, setRenewal] = useState({activationMode:'password' as 'password'|'license',licenseKey:'',softwarePassword:'',planName:'Desktop Annual',...renewalDates()});
  const [renewalMessage, setRenewalMessage] = useState('');
  const enabledCount = moduleLabels.filter(label => modules[label] !== false || lockedModules.has(label)).length;

  useEffect(() => setCompanyDraft(company), [company]);
  useEffect(() => {
    if (tab !== 'backup') return;
    listBackups().then(setBackups).catch(error => setBackupMessage(error instanceof Error ? error.message : 'Unable to load backups'));
  }, [tab]);
  useEffect(()=>{if(tab==='subscription')getSubscription().then(setSubscription).catch(error=>setRenewalMessage(error instanceof Error?error.message:'Unable to load subscription'))},[tab]);

  const toggleModule = (label: string) => {
    if (lockedModules.has(label)) return;
    setModules(current => ({ ...current, [label]: current[label] === false }));
  };

  const saveCompany = () => {
    setCompany(companyDraft);
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
      const backup = await createBackup();
      setBackups(current => [backup, ...current]);
      setBackupMessage('Backup created successfully');
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
                <button className="outline mini-action" disabled={backupBusy} onClick={() => applyBackup(backup)}><RotateCcw size={14} /> Restore</button>
              </div>
            ))}
            {!backups.length && <p className="photo-empty">No backups created yet.</p>}
          </div>
        </article>
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
