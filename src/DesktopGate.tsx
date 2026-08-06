import { useEffect, useState, type ReactNode } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { activateSubscription, getBootstrap, loginDesktop, type BootstrapInfo } from './shared/api';

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
  const [bootstrap, setBootstrap] = useState<BootstrapInfo | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [activation, setActivation] = useState({
    activationMode: 'password' as 'password' | 'license',
    licenseKey: '', softwarePassword: '', planName: 'Desktop Annual',
    ...defaultDates(), ownerName: 'Admin', email: 'admin',
  });
  const [login, setLogin] = useState({ email: '', password: '' });

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
      setLogin({ email: '', password: '' });
      setMessage('Subscription saved. Login with admin / 1234.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation failed');
    } finally { setBusy(false); }
  };

  const submitLogin = async () => {
    setBusy(true); setMessage('');
    try { await loginDesktop(login.email, login.password); setLoggedIn(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setBusy(false); }
  };

  if (loggedIn) return <>{children}</>;
  if (busy && !bootstrap) return <div className="startup-screen simple-auth"><div className="startup-card simple-loading"><RefreshCw className="startup-spin"/><span>Starting Teli ThreadFlow ERP...</span></div></div>;

  const subscription = bootstrap?.subscription;
  const needsActivation = !subscription || subscription.status !== 'Active';

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

  return (
    <div className="startup-screen simple-auth">
      <div className="startup-card simple-card simple-login">
        <Brand />
        <div className="simple-title"><h2>Login</h2><p>Sign in to Teli ThreadFlow ERP</p></div>
        <div className="simple-form">
          <label>Username<input autoFocus value={login.email} onChange={e => setLogin({...login, email:e.target.value})}/></label>
          <label>Password<input type="password" value={login.password} onChange={e => setLogin({...login, password:e.target.value})} onKeyDown={e => { if (e.key === 'Enter') submitLogin(); }}/></label>
        </div>
        {message && <p className="startup-error">{message}</p>}
        <button className="simple-primary" disabled={busy} onClick={submitLogin}><KeyRound size={16}/>{busy ? 'Signing in...' : 'Login'}</button>
        <Support />
      </div>
    </div>
  );
}
