import { useEffect, useState, type ReactNode } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { API_BASE_URL, activateSubscription, getBootstrap, loginDesktop, type BootstrapInfo } from './shared/api';
import { SaaSControlCenter } from './modules/saas/SaaSControlCenter';
import { App } from './App';

const inputDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const displayDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
};
const defaultDates = () => {
  const from = new Date();
  const to = new Date(from);
  to.setFullYear(to.getFullYear() + 1);
  return { fromDate: inputDate(from), toDate: inputDate(to) };
};

function Brand() {
  return (
    <div className="simple-brand">
      <img src="./threadflow-logo.png" alt="Teli ThreadFlow ERP" />
      <div><strong>Teli ThreadFlow ERP</strong><span>Garment Management System</span></div>
    </div>
  );
}

function Support() {
  return <div className="simple-support">Support: <strong>Sarvesh Teli</strong> · <strong>9880306309</strong></div>;
}

export function DesktopGate({ children }: { children: ReactNode }) {
  const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.threadflow);
  const [bootstrap, setBootstrap] = useState<BootstrapInfo | null>(null);
  
  // For desktop app: do not persist session across app restarts in localStorage.
  // Whenever the user closes the app, it must prompt for login on restart.
  const savedSessionStr = typeof window !== 'undefined'
    ? (isDesktopRuntime ? sessionStorage.getItem('garment_session') : localStorage.getItem('garment_session'))
    : null;
  const savedSession = savedSessionStr ? JSON.parse(savedSessionStr) : null;
  const savedTenantId = String(savedSession?.tenantId || '');
  const hasValidSaasTenant = savedTenantId === '_superadmin' || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedTenantId);
  const savedSessionValid = Boolean(savedSession?.loggedIn) && (isDesktopRuntime ? Boolean(savedSession?.loggedIn) : hasValidSaasTenant);

  const [loggedIn, setLoggedIn] = useState<boolean>(savedSessionValid);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(!isDesktopRuntime && (['superadmin', 'master'].includes(savedSession?.currentUser?.email?.toLowerCase() || '') || savedSession?.currentUser?.role === 'SuperAdmin' || savedSession?.currentUser?.role === 'Master'));
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(savedSession?.currentUser || null);

  useEffect(() => {
    if (isDesktopRuntime && typeof window !== 'undefined') {
      // Clear persistent localStorage session so closing the app always requires login
      localStorage.removeItem('garment_session');
    }
  }, [isDesktopRuntime]);

  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regForm, setRegForm] = useState({ businessName: '', contactPerson: '', email: '', phone: '', plan: 'Professional' });
  const [activation, setActivation] = useState({
    activationMode: 'password' as 'password' | 'license',
    licenseKey: '', softwarePassword: '', planName: 'Desktop Annual',
    ...defaultDates(), ownerName: 'Admin', email: 'admin',
  });
  const [login, setLogin] = useState({ email: 'admin', password: '' });

  const load = () => {
    setBusy(true);
    getBootstrap().then(setBootstrap).catch(error => setMessage(error instanceof Error ? error.message : 'Unable to start application')).finally(() => setBusy(false));
  };
  useEffect(load, []);

  const activate = async () => {
    setBusy(true); setMessage('');
    try {
      await activateSubscription(activation);
      setBootstrap(await getBootstrap());
      setLogin({ email: 'admin', password: '' });
      setMessage('Subscription saved. Login with admin / 1234.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation failed');
    } finally { setBusy(false); }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('garment_session');
      sessionStorage.removeItem('garment_session');
    }
    setLoggedIn(false);
    setIsSuperAdmin(false);
    setCurrentUser(null);
  };

  const submitLogin = async () => {
    setBusy(true); setMessage('');
    try {
      const email = login.email.trim().toLowerCase();
      const authResult = await loginDesktop(login.email, login.password);
      const user = authResult.user;
      // In Desktop app, never navigate to superadmin; admin goes straight into the ERP.
      const isSuperAdminUser = !isDesktopRuntime && (['superadmin', 'master'].includes(email) || user?.role === 'SuperAdmin' || user?.role === 'Master');
      setCurrentUser(user);
      setIsSuperAdmin(isSuperAdminUser);
      setLoggedIn(true);

      const tenantId = authResult.tenantId || (isSuperAdminUser ? '_superadmin' : (email === 'admin' ? 'default' : email));
      const sessionData = JSON.stringify({
        loggedIn: true,
        isSuperAdmin: isSuperAdminUser,
        token: authResult.token,
        tenantId,
        currentUser: user
      });

      if (isDesktopRuntime) {
        sessionStorage.setItem('garment_session', sessionData);
        localStorage.removeItem('garment_session');
      } else {
        localStorage.setItem('garment_session', sessionData);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setBusy(false); }
  };

  if (loggedIn) {
    if (isSuperAdmin) {
      return <SaaSControlCenter onSignOut={handleLogout} />;
    }
    return <App currentUser={currentUser} onLogout={handleLogout} />;
  }
  if (busy && !bootstrap) return <div className="startup-screen simple-auth"><div className="startup-card simple-loading"><RefreshCw className="startup-spin"/><span>Starting Teli ThreadFlow ERP...</span></div></div>;

  const subscription = bootstrap?.subscription;
  // License activation belongs to the offline Electron desktop build only.
  // Hosted browser/PWA customers must first register or sign in to an
  // approved PostgreSQL tenant; they do not have a tenant before login.
  const needsActivation = isDesktopRuntime && (!subscription || subscription.status !== 'Active');

  if (needsActivation) {
    const renewal = Boolean(subscription);
    return (
      <div className="startup-screen simple-auth">
        <div className="startup-card simple-card">
          <Brand />
          <div className="simple-title"><h2>{renewal ? 'Subscription Renewal' : 'First Installation'}</h2><p>{renewal ? `Subscription is ${subscription?.status}. Renew it to continue.` : 'Activate the desktop application.'}</p></div>
          {renewal && <div className="simple-period">Current period: <strong>{displayDate(subscription!.fromDate)}</strong> to <strong>{displayDate(subscription!.toDate)}</strong></div>}
          <div className="simple-form two-column">
            <label>From Date<input type="date" value={activation.fromDate} max={activation.toDate} onChange={e => setActivation({...activation, fromDate:e.target.value})}/></label>
            <label>To Date<input type="date" value={activation.toDate} min={activation.fromDate} onChange={e => setActivation({...activation, toDate:e.target.value})}/></label>
            <label>Activation Method<select value={activation.activationMode} onChange={e => setActivation({...activation, activationMode:e.target.value as 'password'|'license'})}><option value="password">Software Owner Password</option><option value="license">License Key</option></select></label>
            {activation.activationMode === 'password'
              ? <label>Software Owner Password<input type="password" value={activation.softwarePassword} onChange={e => setActivation({...activation, softwarePassword:e.target.value})}/></label>
              : <label>License Key<input value={activation.licenseKey} onChange={e => setActivation({...activation, licenseKey:e.target.value.toUpperCase()})}/></label>}
          </div>
          {!renewal && <div className="simple-admin">Default login: <strong>admin</strong> &nbsp; Password: <strong>1234</strong></div>}
          {message && <p className="startup-error">{message}</p>}
          <button className="simple-primary" disabled={busy} onClick={activate}><KeyRound size={16}/>{busy ? 'Saving...' : renewal ? 'Renew Subscription' : 'Activate'}</button>
          <Support />
        </div>
      </div>
    );
  }

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.businessName || !regForm.email || !regForm.phone) {
      setMessage('Please fill in Business Name, Email and Phone.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Registration failed');
      setMessage(`✅ ${body.message || `Registration submitted for "${regForm.businessName}".`}`);
      setRegForm({ businessName: '', contactPerson: '', email: '', phone: '', plan: 'Professional' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Registration failed');
    } finally { setBusy(false); }
  };

  if (mode === 'register') {
    return (
      <div className="startup-screen simple-auth">
        <div className="startup-card simple-card simple-login" style={{ maxWidth: '440px' }}>
          <Brand />
          <div className="simple-title">
            <h2>New Customer Registration</h2>
            <p>Start 14-Day Free Trial for your Garment Business</p>
          </div>

          <form onSubmit={submitRegister} className="simple-form">
            <label>Business Name *<input required value={regForm.businessName} onChange={e => setRegForm({ ...regForm, businessName: e.target.value })} placeholder="e.g. Royal Uniforms" /></label>
            <label>Contact Person<input value={regForm.contactPerson} onChange={e => setRegForm({ ...regForm, contactPerson: e.target.value })} placeholder="e.g. Meena Shah" /></label>
            <label>Email Address *<input required type="email" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} placeholder="meena@royaluniforms.com" /></label>
            <label>Mobile Number *<input required value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} placeholder="+91 98989 89898" /></label>

            {message && <p className="startup-error" style={{ color: message.startsWith('✅') ? '#059669' : '#e11d48', background: message.startsWith('✅') ? '#ecfdf5' : '#fff1f2', border: '1px solid', borderColor: message.startsWith('✅') ? '#a7f3d0' : '#fecdd3', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>{message}</p>}

            <button type="submit" className="simple-primary" disabled={busy}>
              <KeyRound size={16} />{busy ? 'Submitting...' : 'Submit Registration'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="outline" style={{ border: 'none', background: 'none', color: '#007c68', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }} onClick={() => { setMode('login'); setMessage(''); }}>
              Already registered? Click here to Sign In
            </button>
          </div>
          <Support />
        </div>
      </div>
    );
  }

  return (
    <div className="startup-screen simple-auth">
      <div className="startup-card simple-card simple-login">
        <Brand />
        <div className="simple-title"><h2>Login</h2><p>Sign in to Teli ThreadFlow ERP</p></div>
        <div className="simple-form">
          <label>Username / Email<input autoFocus value={login.email} onChange={e => setLogin({...login, email:e.target.value})}/></label>
          <label>Password<input type="password" value={login.password} onChange={e => setLogin({...login, password:e.target.value})} onKeyDown={e => { if (e.key === 'Enter') submitLogin(); }}/></label>
        </div>
        {isDesktopRuntime && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            Default Login: <strong style={{ color: '#0f172a' }}>admin</strong> &nbsp;|&nbsp; Password: <strong style={{ color: '#0f172a' }}>1234</strong>
          </div>
        )}
        {message && <p className="startup-error">{message}</p>}
        <button className="simple-primary" disabled={busy} onClick={submitLogin}><KeyRound size={16}/>{busy ? 'Signing in...' : 'Login'}</button>
        {!isDesktopRuntime && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button className="outline" style={{ border: 'none', background: 'none', color: '#007c68', fontWeight: 700, cursor: 'pointer', fontSize: 12 }} onClick={() => { setMode('register'); setMessage(''); }}>
              New Customer? Register your Garment Business here
            </button>
          </div>
        )}
        <Support />
      </div>
    </div>
  );
}
