import { useEffect, useState } from 'react';
import { 
  Building2, CheckCircle2, Clock, CreditCard, LayoutDashboard, ShieldCheck, 
  UserCheck, UserPlus, XCircle, LogOut, AlertCircle, Ban, RefreshCw, Plus, X, Key, Calendar, Menu, Cloud, Save
} from 'lucide-react';
import { API_BASE_URL } from '../../shared/api';

const SUPER_ADMIN_URL = API_BASE_URL;

export type TenantAccount = {
  tenantId: string;
  businessName: string;
  subdomain: string;
  contactPerson: string;
  email: string;
  phone: string;
  plan: string;
  status: 'Active' | 'Pending Approval' | 'Trial' | 'Suspended';
  createdAt: string;
  approvedAt?: string;
};

export function SaaSControlCenter({ onSignOut }: { onSignOut?: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'pending' | 'trials' | 'subscriptions' | 'suspended' | 'settings'>('overview');
  const [tenants, setTenants] = useState<TenantAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [autoApprove,setAutoApprove]=useState(false);
  const [settingsBusy,setSettingsBusy]=useState(false);
  const [driveConfig,setDriveConfig]=useState({clientId:'',clientSecret:'',redirectUri:'https://garment.telicampus.in/api/backups/google/callback',clientSecretConfigured:false,configured:false});
  const adminToken=()=>{try{return JSON.parse(localStorage.getItem('garment_session')||'{}').token||''}catch{return ''}};

  const selectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const [newReg, setNewReg] = useState({
    businessName: '',
    contactPerson: '',
    email: '',
    phone: '',
    plan: 'Professional Plan'
  });

  const loadTenants = () => {
    setLoading(true);
    fetch(`${SUPER_ADMIN_URL}/api/admin/tenants`)
      .then(res => res.json())
      .then(data => {
        if (data.tenants) setTenants(data.tenants);
      })
      .catch(() => setNotice('Connected to Super Admin API'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTenants();
    fetch(`${SUPER_ADMIN_URL}/api/admin/platform-settings`,{headers:{Authorization:`Bearer ${adminToken()}`}}).then(async res=>{if(!res.ok)throw new Error('Please sign out and sign in again to manage approval settings.');return res.json()}).then(data=>setAutoApprove(data.registration?.autoApprove===true)).catch(error=>setNotice(error.message));
    fetch(`${SUPER_ADMIN_URL}/api/admin/google-drive-config`,{headers:{Authorization:`Bearer ${adminToken()}`}}).then(async res=>{const body=await res.json();if(!res.ok)throw new Error(body.message||'Unable to load Google Drive settings');return body.data}).then(data=>setDriveConfig(current=>({...current,...data,clientSecret:''}))).catch(error=>setNotice(error.message));
  }, []);

  const saveApprovalMode=async(value:boolean)=>{
    setSettingsBusy(true);
    try{const res=await fetch(`${SUPER_ADMIN_URL}/api/admin/platform-settings`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${adminToken()}`},body:JSON.stringify({registration:{autoApprove:value}})});const body=await res.json();if(!res.ok)throw new Error(body.message||'Unable to save approval mode');setAutoApprove(value);setNotice(value?'Automatic approval enabled. New customers receive a 14-day trial immediately.':'Manual approval enabled. New customers will wait for Super Admin approval.')}catch(error){setNotice(error instanceof Error?error.message:'Unable to save approval mode')}finally{setSettingsBusy(false)}
  };
  const saveDriveConfig=async()=>{setSettingsBusy(true);setNotice(null);try{const res=await fetch(`${SUPER_ADMIN_URL}/api/admin/google-drive-config`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${adminToken()}`},body:JSON.stringify({clientId:driveConfig.clientId,clientSecret:driveConfig.clientSecret,redirectUri:driveConfig.redirectUri})}),body=await res.json();if(!res.ok)throw new Error(body.message||'Unable to save Google Drive settings');setDriveConfig(current=>({...current,...body.data,clientSecret:''}));setNotice('Google Drive OAuth configuration saved. Garment customers can now connect their own Drive accounts.')}catch(error){setNotice(error instanceof Error?error.message:'Unable to save Google Drive settings')}finally{setSettingsBusy(false)}};

  const handleAdminAction = async (action: 'approve_annual' | 'add_trial' | 'suspend' | 'reactivate' | 'reset_password', tenantId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPER_ADMIN_URL}/api/admin/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tenantId })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Action failed');
      setNotice(`🟢 ${body.message}`);
      loadTenants();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Action error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${SUPER_ADMIN_URL}/api/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReg)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Registration failed');
      setNotice(body.message || `Customer "${newReg.businessName}" registered successfully.`);
      setNewReg({ businessName: '', contactPerson: '', email: '', phone: '', plan: 'Professional Plan' });
      setShowAddModal(false);
      loadTenants();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const pendingList = tenants.filter(t => t.status === 'Pending Approval');
  const trialList = tenants.filter(t => t.status === 'Trial' || (t.status === 'Active' && (t.plan?.includes('Trial') || t.plan?.includes('14'))));
  const paidList = tenants.filter(t => t.status === 'Active' && !t.plan?.includes('Trial'));
  const suspendedList = tenants.filter(t => t.status === 'Suspended');

  const filteredTenants = () => {
    switch (activeTab) {
      case 'pending': return pendingList;
      case 'trials': return trialList;
      case 'subscriptions': return paidList;
      case 'suspended': return suspendedList;
      case 'customers': return tenants;
      default: return tenants;
    }
  };
  const tabCopy = {
    overview: ['Platform Overview', 'Customer onboarding, trials, subscriptions and account health.'],
    customers: ['Garment Customers', 'All registered garment businesses and their current access status.'],
    pending: ['Pending Approvals', 'Review new registrations waiting for access.'],
    trials: ['Active Trials', 'Customers currently using a 14-day evaluation period.'],
    subscriptions: ['Paid Subscriptions', 'Customers with an active annual subscription.'],
    suspended: ['Suspended Accounts', 'Accounts whose application access is currently disabled.'],
    settings: ['Platform Settings', 'Super Admin controls and platform configuration.'],
  }[activeTab];
  const visibleTenants = filteredTenants();

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <header className="saas-header" style={{ background: '#007c68', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="saas-mobile-menu-button"
            onClick={() => setMobileNavOpen(open => !open)}
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{ background: '#fff', padding: '4px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
            <img src="./threadflow-logo.png" alt="Teli ThreadFlow ERP" style={{ height: 28, objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>Teli ThreadFlow ERP</h1>
            <span style={{ fontSize: 10, opacity: 0.9, display: 'block' }}>Garment Management System · Super Admin</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onSignOut && (
            <button 
              onClick={onSignOut} 
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          className="saas-mobile-nav-overlay"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* ── Main Workspace (Sidebar + Content) ────────────────────────── */}
      <div className="saas-workspace" style={{ flex: 1, display: 'flex' }}>

        {/* ── Left Sidebar Navigation ──────────────────────────────────── */}
        <aside className={`saas-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} style={{ width: 240, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          
          <button 
            onClick={() => selectTab('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: activeTab === 'overview' ? '#e6f4f1' : 'transparent', color: activeTab === 'overview' ? '#007c68' : '#475569', fontWeight: activeTab === 'overview' ? 700 : 500, fontSize: 13.5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <LayoutDashboard size={18} /> Platform Overview
          </button>

          <button 
            onClick={() => selectTab('customers')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: activeTab === 'customers' ? '#e6f4f1' : 'transparent', color: activeTab === 'customers' ? '#007c68' : '#475569', fontWeight: activeTab === 'customers' ? 700 : 500, fontSize: 13.5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <Building2 size={18} /> Garment Customers
          </button>

          <button 
            onClick={() => selectTab('pending')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: 'none', background: activeTab === 'pending' ? '#e6f4f1' : 'transparent', color: activeTab === 'pending' ? '#007c68' : '#475569', fontWeight: activeTab === 'pending' ? 700 : 500, fontSize: 13.5, cursor: 'pointer', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} /> Pending Approvals
            </div>
            {pendingList.length > 0 && (
              <span style={{ background: '#f97316', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                {pendingList.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => selectTab('trials')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: activeTab === 'trials' ? '#e6f4f1' : 'transparent', color: activeTab === 'trials' ? '#007c68' : '#475569', fontWeight: activeTab === 'trials' ? 700 : 500, fontSize: 13.5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <ShieldCheck size={18} /> Active Trials
          </button>

          <button 
            onClick={() => selectTab('subscriptions')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: activeTab === 'subscriptions' ? '#e6f4f1' : 'transparent', color: activeTab === 'subscriptions' ? '#007c68' : '#475569', fontWeight: activeTab === 'subscriptions' ? 700 : 500, fontSize: 13.5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <CreditCard size={18} /> Paid Subscriptions
          </button>

          <button 
            onClick={() => selectTab('suspended')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: activeTab === 'suspended' ? '#e6f4f1' : 'transparent', color: activeTab === 'suspended' ? '#007c68' : '#475569', fontWeight: activeTab === 'suspended' ? 700 : 500, fontSize: 13.5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <Ban size={18} /> Suspended Accounts
          </button>

          <button 
            onClick={() => selectTab('settings')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: activeTab === 'settings' ? '#e6f4f1' : 'transparent', color: activeTab === 'settings' ? '#007c68' : '#475569', fontWeight: activeTab === 'settings' ? 700 : 500, fontSize: 13.5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <ShieldCheck size={18} /> Platform Settings
          </button>

        </aside>

        {/* ── Main Content Area ────────────────────────────────────────── */}
        <main className="saas-content" style={{ flex: 1, padding: 28, overflowY: 'auto', overflowX: 'hidden' }}>

          {/* Title Header */}
          <div className="saas-page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{tabCopy[0]}</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{tabCopy[1]}</p>
            </div>
            {(activeTab === 'overview' || activeTab === 'customers') && <button 
              onClick={() => setShowAddModal(true)}
              style={{ background: '#007c68', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 4px rgba(0,124,104,0.2)', whiteSpace: 'nowrap' }}
            >
              <Plus size={16} /> New Customer Onboarding
            </button>}
          </div>

          {/* Alert Notice Banner */}
          {notice && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>{notice}</div>
              <button onClick={() => setNotice(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#047857', fontWeight: 700 }}>✕</button>
            </div>
          )}

          {/* ── Metric Summary Cards ────────────────────────────────────── */}
          {activeTab === 'overview' && <div className="saas-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            
            {/* Card 1: Total Customers */}
            <div style={{ background: '#2563eb', borderRadius: 10, padding: 18, color: '#fff', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.5px' }}>🏢 TOTAL CUSTOMERS</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{tenants.length}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>Registered garment accounts</div>
            </div>

            {/* Card 2: Pending Approvals */}
            <div style={{ background: '#f97316', borderRadius: 10, padding: 18, color: '#fff', boxShadow: '0 4px 6px -1px rgba(249,115,22,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.5px' }}>⏳ PENDING APPROVALS</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{pendingList.length}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>Requires Super Admin action</div>
            </div>

            {/* Card 3: Active Trials */}
            <div style={{ background: '#9333ea', borderRadius: 10, padding: 18, color: '#fff', boxShadow: '0 4px 6px -1px rgba(147,51,234,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.5px' }}>🧪 ACTIVE TRIALS</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{trialList.length}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>14-Day trial period active</div>
            </div>

            {/* Card 4: Paid Subscriptions */}
            <div style={{ background: '#16a34a', borderRadius: 10, padding: 18, color: '#fff', boxShadow: '0 4px 6px -1px rgba(22,163,74,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.5px' }}>💳 PAID SUBSCRIPTIONS</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{paidList.length}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>Active recurring plans</div>
            </div>

            {/* Card 5: Suspended Accounts */}
            <div style={{ background: '#dc2626', borderRadius: 10, padding: 18, color: '#fff', boxShadow: '0 4px 6px -1px rgba(220,38,38,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.5px' }}>🚫 SUSPENDED</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{suspendedList.length}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>Access disabled</div>
            </div>

          </div>}

          {activeTab==='settings'&&<div style={{display:'grid',gap:18,maxWidth:820}}><div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><ShieldCheck size={21} color="#007c68"/><div><h3 style={{margin:0,fontSize:16}}>New Customer Approval</h3><p style={{margin:'3px 0 0',fontSize:12,color:'#64748b'}}>Choose what happens when a garment customer registers.</p></div></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
              <button disabled={settingsBusy} onClick={()=>saveApprovalMode(false)} style={{textAlign:'left',padding:16,borderRadius:10,cursor:'pointer',border:`2px solid ${!autoApprove?'#007c68':'#e2e8f0'}`,background:!autoApprove?'#ecfdf5':'#fff',color:'#0f172a'}}><strong style={{display:'block',fontSize:14}}>Manual Approval</strong><span style={{display:'block',fontSize:12,color:'#64748b',marginTop:5}}>Registration stays pending until Super Admin approves it.</span></button>
              <button disabled={settingsBusy} onClick={()=>saveApprovalMode(true)} style={{textAlign:'left',padding:16,borderRadius:10,cursor:'pointer',border:`2px solid ${autoApprove?'#7c3aed':'#e2e8f0'}`,background:autoApprove?'#f5f3ff':'#fff',color:'#0f172a'}}><strong style={{display:'block',fontSize:14}}>Auto Approve · 14-Day Trial</strong><span style={{display:'block',fontSize:12,color:'#64748b',marginTop:5}}>Customer can log in immediately with a 14-day free trial.</span></button>
            </div>
            <div style={{marginTop:14,padding:'10px 12px',borderRadius:8,background:'#f8fafc',fontSize:12,color:'#475569'}}>Current mode: <strong>{autoApprove?'Automatic 14-day trial':'Manual approval'}</strong>. This affects only future registrations.</div>
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><Cloud size={21} color="#007c68"/><div><h3 style={{margin:0,fontSize:16}}>Google Drive Integration</h3><p style={{margin:'3px 0 0',fontSize:12,color:'#64748b'}}>Configure one published OAuth application for every garment customer.</p></div><span style={{marginLeft:'auto',padding:'5px 9px',borderRadius:999,fontSize:11,fontWeight:800,background:driveConfig.configured?'#dcfce7':'#fee2e2',color:driveConfig.configured?'#166534':'#991b1b'}}>{driveConfig.configured?'CONFIGURED':'NOT CONFIGURED'}</span></div>
            <div className="saas-drive-config-grid">
              <label>Google Client ID<input value={driveConfig.clientId} onChange={e=>setDriveConfig({...driveConfig,clientId:e.target.value})} placeholder="OAuth 2.0 Client ID"/></label>
              <label>Google Client Secret<input type="password" value={driveConfig.clientSecret} onChange={e=>setDriveConfig({...driveConfig,clientSecret:e.target.value})} placeholder={driveConfig.clientSecretConfigured?'Saved — leave blank to keep':'Enter client secret'}/></label>
              <label className="full">Authorized Redirect URI<input value={driveConfig.redirectUri} onChange={e=>setDriveConfig({...driveConfig,redirectUri:e.target.value})}/><small>Add this exact URI in Google Cloud Console → OAuth client → Authorized redirect URIs.</small></label>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}><button disabled={settingsBusy} onClick={saveDriveConfig} style={{background:'#007c68',color:'#fff',border:0,borderRadius:8,padding:'10px 16px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}><Save size={15}/>{settingsBusy?'Saving…':'Save Google Settings'}</button></div>
          </div></div>}

          {/* ── Main Data Table View ─────────────────────────────────────── */}
          <div className="saas-tenant-panel" style={{ display:activeTab==='settings'?'none':undefined, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            
            <div className="saas-tenant-panel-head" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="#007c68" />
                {activeTab === 'pending' ? 'Pending Customer Registrations' : activeTab === 'suspended' ? 'Suspended Customer Accounts' : 'Customer Account Manifest'}
                <span className="saas-list-count">{visibleTenants.length}</span>
              </div>
              <button onClick={loadTenants} style={{ border: 'none', background: 'none', color: '#007c68', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={14} /> Refresh List
              </button>
            </div>

            {visibleTenants.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={36} color="#007c68" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>No customer accounts in this section</div>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>Click "+ New Customer Onboarding" to register a new garment business.</p>
              </div>
            ) : (
              <table className="saas-tenant-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px 16px' }}>GARMENT COMPANY & CODE</th>
                    <th style={{ padding: '12px 16px' }}>LOCATION & CONTACT</th>
                    <th style={{ padding: '12px 16px' }}>ADMINISTRATOR</th>
                    <th style={{ padding: '12px 16px' }}>PLAN & STATUS</th>
                    <th style={{ padding: '12px 16px' }}>REGISTERED DATE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>SUPER ADMIN ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTenants.map(tenant => (
                    <tr key={tenant.tenantId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      
                      {/* 1. Company & Code */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{tenant.businessName}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ID: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{tenant.tenantId}</code></div>
                      </td>

                      {/* 2. Location & Contact */}
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        <div style={{ fontWeight: 600 }}>📞 {tenant.phone}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{tenant.subdomain ? `${tenant.subdomain}.garment.telicampus.in` : 'N/A'}</div>
                      </td>

                      {/* 3. Administrator */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{tenant.contactPerson || 'Admin'}</div>
                        <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600 }}>{tenant.email}</div>
                      </td>

                      {/* 4. Plan & Status Badges */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          {tenant.status === 'Pending Approval' && (
                            <span style={{ background: '#ffedd5', color: '#c2410c', padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                              ⏳ PENDING APPROVAL
                            </span>
                          )}
                          {tenant.status === 'Suspended' && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                              🔴 SUSPENDED
                            </span>
                          )}
                          {tenant.status === 'Trial' && (
                            <span style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fef08a', padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                              ⏳ 14-DAY TRIAL
                            </span>
                          )}
                          {tenant.status === 'Active' && !tenant.plan?.includes('Trial') && (
                            <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                              🟢 ANNUAL ENTERPRISE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Registered Date */}
                      <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 600, fontSize: 12 }}>
                        {tenant.createdAt || new Date().toISOString().slice(0, 10)}
                      </td>

                      {/* 6. Super Admin Action Buttons */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div className="saas-tenant-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                          
                          {/* Approve Annual */}
                          <button 
                            onClick={() => handleAdminAction('approve_annual', tenant.tenantId)}
                            style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '5px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Approve 1-Year Subscription"
                          >
                            🟢 Approve Annual
                          </button>

                          {/* +14 Days Trial */}
                          <button 
                            onClick={() => handleAdminAction('add_trial', tenant.tenantId)}
                            style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', padding: '5px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Grant 14-Day Free Trial"
                          >
                            🟡 +14 Days Trial
                          </button>

                          {/* Suspend or Reactivate */}
                          {tenant.status === 'Suspended' ? (
                            <button 
                              onClick={() => handleAdminAction('reactivate', tenant.tenantId)}
                              style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', padding: '5px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                            >
                              🔵 Reactivate
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleAdminAction('suspend', tenant.tenantId)}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '5px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                            >
                              🔴 Suspend
                            </button>
                          )}

                          {/* Temp Password */}
                          <button 
                            onClick={() => handleAdminAction('reset_password', tenant.tenantId)}
                            style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '5px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Reset password to 1234"
                          >
                            🔑 Temp Password
                          </button>

                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>

        </main>
      </div>

      {/* ── Modal for Registering New Customer ───────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 480, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>New Customer Onboarding</h3>
              <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Company / Business Name *</label>
                <input required value={newReg.businessName} onChange={e => setNewReg({ ...newReg, businessName: e.target.value })} placeholder="e.g. Zudio Apparels" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Contact Person Name</label>
                <input value={newReg.contactPerson} onChange={e => setNewReg({ ...newReg, contactPerson: e.target.value })} placeholder="e.g. Sarvesh Teli" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Company Email (Login Username) *</label>
                <input required type="email" value={newReg.email} onChange={e => setNewReg({ ...newReg, email: e.target.value })} placeholder="zudio@garment.com" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Mobile Number *</label>
                <input required value={newReg.phone} onChange={e => setNewReg({ ...newReg, phone: e.target.value })} placeholder="+91 98803 06309" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Subscription Plan</label>
                <select value={newReg.plan} onChange={e => setNewReg({ ...newReg, plan: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
                  <option value="Professional Plan">Professional Plan</option>
                  <option value="Enterprise Plan">Enterprise Plan</option>
                  <option value="Starter Plan">Starter Plan</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 16px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ background: '#007c68', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {loading ? 'Submitting...' : 'Register Customer'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
