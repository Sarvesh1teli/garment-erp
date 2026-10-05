import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, ShieldCheck, UserCheck, UserPlus, X } from 'lucide-react';
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
  status: 'Active' | 'Pending Approval';
  createdAt: string;
  approvedAt?: string;
};

export function SaaSOnboardingModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'register' | 'pending' | 'all'>('pending');
  const [tenants, setTenants] = useState<TenantAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    businessName: '',
    subdomain: '',
    contactPerson: '',
    email: '',
    phone: '',
    plan: 'Professional'
  });

  const loadTenants = () => {
    setLoading(true);
    fetch(`${SUPER_ADMIN_URL}/api/admin/tenants`)
      .then(res => res.json())
      .then(data => setTenants(data.tenants || []))
      .catch(() => setNotice('Unable to connect to Super Admin Server'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email || !form.phone) {
      setNotice('Please fill in Business Name, Email and Phone.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SUPER_ADMIN_URL}/api/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Registration failed');
      setNotice(`✅ Registration submitted for "${form.businessName}"! Status set to Pending Approval.`);
      setForm({ businessName: '', subdomain: '', contactPerson: '', email: '', phone: '', plan: 'Professional' });
      setActiveTab('pending');
      loadTenants();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (tenantId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPER_ADMIN_URL}/api/admin/approve/${tenantId}`, {
        method: 'POST'
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Approval failed');
      setNotice(`🟢 Approval successful! Initial Password: 1234`);
      loadTenants();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Approval error');
    } finally {
      setLoading(false);
    }
  };

  const pendingList = tenants.filter(t => t.status === 'Pending Approval');
  const activeList = tenants.filter(t => t.status === 'Active');

  return (
    <div className="stock-modal-overlay" onClick={onClose}>
      <div className="card detail-modal" style={{ maxWidth: '880px', width: '95vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        
        <div className="cardhead" style={{ alignItems: 'center' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: '#0b3f37' }}>
              <ShieldCheck size={24} style={{ color: '#007c68' }} /> SaaS Customer Registration & Super Admin Approval Test Portal
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5f736d' }}>
              Test new customer signups, view pending registrations, and 1-click approve & issue credentials.
            </p>
          </div>
          <button className="outline" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14, borderBottom: '2px solid #e5eae8' }}>
          <button className={activeTab === 'pending' ? 'primary' : 'outline'} style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 12.5, fontWeight: 700 }} onClick={() => setActiveTab('pending')}>
            <Clock size={15} /> Pending Registrations ({pendingList.length})
          </button>
          <button className={activeTab === 'all' ? 'primary' : 'outline'} style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 12.5, fontWeight: 700 }} onClick={() => setActiveTab('all')}>
            <Building2 size={15} /> Active Customers ({activeList.length})
          </button>
          <button className={activeTab === 'register' ? 'primary' : 'outline'} style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 12.5, fontWeight: 700 }} onClick={() => setActiveTab('register')}>
            <UserPlus size={15} /> + New Customer Signup
          </button>
        </div>

        {notice && (
          <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
            {notice}
          </div>
        )}

        {activeTab === 'pending' && (
          <div>
            <h3 style={{ fontSize: 14, color: '#123d35', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={16} style={{ color: '#d97706' }} /> Customers Waiting for Super Admin Approval
            </h3>

            {!pendingList.length ? (
              <div style={{ padding: '30px', textAlign: 'center', background: '#f8faf9', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>No pending customer registrations!</p>
                <small style={{ color: '#64748b' }}>Click "+ New Customer Signup" tab to test registering a new company.</small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingList.map(t => (
                  <div key={t.tenantId} style={{ padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <strong style={{ fontSize: 15, color: '#92400e', display: 'block' }}>{t.businessName}</strong>
                      <span style={{ fontSize: 12, color: '#78350f' }}>Contact: {t.contactPerson} ({t.email}) | Mobile: {t.phone}</span>
                      <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 11 }}>
                        <span style={{ background: '#fef3c7', padding: '2px 8px', borderRadius: 4, color: '#b45309', fontWeight: 700 }}>Plan: {t.plan}</span>
                        <span style={{ background: '#fef3c7', padding: '2px 8px', borderRadius: 4, color: '#b45309', fontWeight: 700 }}>Subdomain: {t.subdomain}.garment.telicampus.in</span>
                      </div>
                    </div>
                    <button className="primary" style={{ background: '#10b981', borderColor: '#059669', padding: '8px 18px', fontSize: 13, fontWeight: 700 }} onClick={() => handleApprove(t.tenantId)}>
                      <UserCheck size={16} /> Approve & Issue Credentials
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'all' && (
          <div>
            <h3 style={{ fontSize: 14, color: '#123d35', marginBottom: 10 }}>🟢 Active Paying SaaS Customers</h3>
            <table className="doc-table summary-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>COMPANY NAME</th>
                  <th>CONTACT PERSON</th>
                  <th>EMAIL / USERNAME</th>
                  <th>PLAN</th>
                  <th>STATUS</th>
                  <th>LOGIN LINK</th>
                </tr>
              </thead>
              <tbody>
                {activeList.map(t => (
                  <tr key={t.tenantId}>
                    <td><strong>{t.businessName}</strong></td>
                    <td>{t.contactPerson}</td>
                    <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{t.email}</code></td>
                    <td><span className="status in-progress">{t.plan}</span></td>
                    <td><span className="status completed">🟢 Active</span></td>
                    <td><small style={{ color: '#007c68', fontWeight: 700 }}>https://garment.telicampus.in/login</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ gridColumn: '1 / -1', fontWeight: 700, fontSize: 13, color: '#123d35' }}>
              Company / Business Name *
              <input required value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Royal Uniforms & Apparel" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #c5d4cf', marginTop: 4 }} />
            </label>

            <label style={{ fontWeight: 600, fontSize: 12.5, color: '#123d35' }}>
              Contact Person Name
              <input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="e.g. Meena Shah" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #c5d4cf', marginTop: 4 }} />
            </label>

            <label style={{ fontWeight: 600, fontSize: 12.5, color: '#123d35' }}>
              Company Email (Login Username) *
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="meena@royaluniforms.com" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #c5d4cf', marginTop: 4 }} />
            </label>

            <label style={{ fontWeight: 600, fontSize: 12.5, color: '#123d35' }}>
              Mobile Number *
              <input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98989 89898" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #c5d4cf', marginTop: 4 }} />
            </label>

            <label style={{ fontWeight: 600, fontSize: 12.5, color: '#123d35' }}>
              Subscription Plan
              <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #c5d4cf', marginTop: 4 }}>
                <option value="Starter">Starter Plan</option>
                <option value="Professional">Professional Plan</option>
                <option value="Enterprise">Enterprise Plan</option>
              </select>
            </label>

            <div style={{ gridColumn: '1 / -1', marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="outline" onClick={() => setActiveTab('pending')}>Cancel</button>
              <button type="submit" className="primary" disabled={loading} style={{ padding: '8px 24px', fontWeight: 700 }}>
                {loading ? 'Submitting...' : 'Submit Registration'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Super Admin Server: Connected</span>
          <button className="outline" onClick={onClose}>Close Portal</button>
        </div>

      </div>
    </div>
  );
}
