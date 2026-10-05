import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, Copy, FileText, KeyRound, MessageCircle, Network, Package, Plus, Send, Truck, XCircle, Zap } from 'lucide-react';
import { openWhatsApp, formatOrderWhatsAppMessage } from '../../shared/whatsapp';
import type { CompanySettings } from '../settings/SettingsPage';
import { SmsComposerModal, type SmsDraft } from '../../shared/SmsComposerModal';
import { formatOrderStatusSms, sendSmsViaGateway } from '../../shared/sms';
import { API_BASE_URL, useStoredState } from '../../shared/utils';
import type { SchoolStock } from '../../shared/types';

export type SchoolConnection = {
  id: string;
  garmentCode: string;
  schoolCode: string;
  schoolName: string;
  schoolApiUrl: string;
  apiKey: string;
  status: 'pending_inbound' | 'pending_outbound' | 'connected' | 'disconnected' | 'rejected';
  initiatedBy: 'school' | 'garment';
  createdAt: string;
};

export type UniformOrderItem = {
  id: string;
  itemType: string;
  size: string;
  quantity: number;
  unitPrice?: number;
  remarks?: string;
};

export type UniformOrder = {
  id: string;
  connectionId: string;
  schoolCode: string;
  schoolName: string;
  schoolOrderId: string;
  orderNo?: string;
  dressColorDesign: string;
  requiredDeliveryDate: string;
  status: 'Received' | 'Accepted' | 'Quoted' | 'School Approved' | 'In Production' | 'Ready' | 'Dispatched' | 'Delivered' | 'Cancelled';
  totalItemsCount: number;
  totalAmount: number;
  remarks: string;
  items: UniformOrderItem[];
  attachments?: { filename: string; url: string }[];
  createdAt: string;
};

export function SchoolNetworkPage({company}:{company:CompanySettings}) {
  const [activeTab, setActiveTab] = useState<'connections' | 'orders' | 'logs'>('connections');
  const [garmentCode] = useState('GARMENT-5028');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, setSchoolStock] = useStoredState<SchoolStock[]>('garment-school-stock', []);
  const [smsDraft, setSmsDraft] = useState<SmsDraft | null>(null);
  const [sendingSms, setSendingSms] = useState(false);

  const [connections, setConnections] = useState<SchoolConnection[]>([]);

  const [orders, setOrders] = useState<UniformOrder[]>([]);

  const fetchConnections = () => {
    fetch(`${API_BASE_URL}/api/v1/school-connections`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.connections)) setConnections(data.connections);
      })
      .catch(() => {});
  };

  const fetchOrders = () => {
    fetch(`${API_BASE_URL}/api/v1/uniform-orders`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.orders)) setOrders(data.orders);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchConnections();
    fetchOrders();
    const timer = setInterval(() => {
      fetchConnections();
      fetchOrders();
    }, 3000);
    return () => clearInterval(timer);
  }, []);



  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [newSchoolCode, setNewSchoolCode] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<UniformOrder | null>(null);
  const [quoteModalOrder, setQuoteModalOrder] = useState<UniformOrder | null>(null);
  const [quotationPrice, setQuotationPrice] = useState<number>(0);

  const copyGarmentCode = () => {
    navigator.clipboard.writeText(garmentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolCode || !newSchoolName) return;
    const newConn: SchoolConnection = {
      id: `conn_${Date.now()}`,
      garmentCode,
      schoolCode: newSchoolCode,
      schoolName: newSchoolName,
      schoolApiUrl: `https://${newSchoolCode.toLowerCase()}.telicampus.in/api/v1/garment/callbacks`,
      apiKey: `key_${Date.now()}`,
      status: 'pending_outbound',
      initiatedBy: 'garment',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    setConnections([newConn, ...connections]);
    setShowConnectModal(false);
    setNewSchoolCode('');
    setNewSchoolName('');
    setNotice(`Connection request sent to ${newSchoolName} (${newSchoolCode})`);
  };

  const handleApproveConnection = (connId: string) => {
    fetch(`${API_BASE_URL}/api/v1/school-connections/requests/${connId}`, { method: 'PATCH' })
      .then(res => res.json())
      .then(() => fetchConnections())
      .catch(() => {});
    setConnections(connections.map(c => c.id === connId ? { ...c, status: 'connected' } : c));
    setNotice('🟢 Connection request approved! Network link is now active.');
  };

  const handleDisconnect = (connId: string) => {
    setConnections(connections.map(c => c.id === connId ? { ...c, status: 'disconnected' } : c));
    setNotice('🔴 School connection disconnected. New order creation is stopped.');
  };

  const handleReconnect = (connId: string) => {
    setConnections(connections.map(c => c.id === connId ? { ...c, status: 'connected' } : c));
    setNotice('🟢 School reconnected successfully.');
  };

  const handleTestConnection = async (conn: SchoolConnection) => {
    setNotice(`⏳ Probing connection to ${conn.schoolName}...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/school-connections/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolCode: conn.schoolCode,
          schoolName: conn.schoolName,
          schoolApiUrl: conn.schoolApiUrl
        })
      });
      const data = await res.json();
      setNotice(data.message || (data.alive ? `⚡ Ping test to ${conn.schoolName}: Online (${data.responseTime})` : `❌ Ping test to ${conn.schoolName} failed.`));
    } catch (err: any) {
      setNotice(`❌ Ping probe error: ${err?.message || 'Could not reach local API'}`);
    }
  };

  const [contacts, setContacts] = useState<Record<string, string>>({
    'SCH-56191': '+919876543210',
    'SCH-XAVIER-01': '+919876543211',
    'SCH-APEX-02': '+919876543212'
  });
  const [lastUpdatedOrder, setLastUpdatedOrder] = useState<UniformOrder | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/sms-settings`)
      .then(res => res.json())
      .then(data => {
        if (data.contacts) setContacts(prev => ({ ...prev, ...data.contacts }));
      })
      .catch(() => {});
  }, []);

  const handleShareWhatsApp = (ord: UniformOrder, overrideStatus?: string, customRemarks?: string) => {
    let phone = contacts[ord.schoolCode] || contacts['SCH-56191'] || '';
    if (!phone) {
      const input = window.prompt(`Enter WhatsApp mobile number for ${ord.schoolName}:`, '9876543210');
      if (!input) return;
      phone = input;
      setContacts(prev => ({ ...prev, [ord.schoolCode]: phone }));
    }
    const message = formatOrderWhatsAppMessage(ord, overrideStatus, customRemarks, company.name || 'Your Business');
    openWhatsApp({ phone, message });
    setNotice(`📲 WhatsApp message opened for ${ord.schoolName} (${phone})`);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: UniformOrder['status'], amount?: number) => {
    let remarks = '';
    if (newStatus === 'Cancelled') {
      const reasonInput = window.prompt('Enter rejection / cancellation reason for School ERP notification:', 'Fabric out of stock for requested dress color');
      if (reasonInput === null) return; // User cancelled prompt
      remarks = reasonInput;
    }
    const updatedAmount = amount || orders.find(o => o.id === orderId)?.totalAmount || 0;
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder) {
      const updated = { ...targetOrder, status: newStatus, totalAmount: updatedAmount, remarks: remarks || targetOrder.remarks };
      setLastUpdatedOrder(updated);
      const orderRef = updated.schoolOrderId || updated.orderNo || updated.id;
      if (newStatus === 'Ready') {
        const stockMarker = `Order ${orderRef}`;
        setSchoolStock(current => {
          if (current.some(row => row.school === updated.schoolName && row.remarks.includes(stockMarker))) return current;
          const date = new Date().toISOString().slice(0, 10);
          const readyRows: SchoolStock[] = updated.items.map((item, index) => ({
            id: `SST-${Date.now()}-${index + 1}`,
            date,
            school: updated.schoolName,
            className: 'General',
            gender: /girl/i.test(item.itemType) ? 'Girls' : 'Boys',
            garment: item.itemType,
            size: item.size,
            count: item.quantity,
            remarks: `${stockMarker} - stitching completed`
          }));
          return [...readyRows, ...current];
        });
      }
      setSmsDraft({
        recipientName: updated.schoolName,
        recipientPhone: contacts[updated.schoolCode] || '',
        title: `Order ${orderRef} - ${newStatus}`,
        message: formatOrderStatusSms({ schoolName: updated.schoolName, orderRef, status: newStatus, totalQty: updated.totalItemsCount, totalAmount: updatedAmount, deliveryDate: updated.requiredDeliveryDate, remarks: updated.remarks, companyName: company.name || 'Your Business' })
      });
    }
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus, totalAmount: updatedAmount, remarks: remarks || o.remarks } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus, totalAmount: updatedAmount, remarks: remarks || selectedOrder.remarks });
    }
    fetch(`${API_BASE_URL}/api/v1/uniform-orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, totalAmount: updatedAmount, remarks })
    }).catch(() => {});
    setNotice(newStatus === 'Ready' ? 'Order marked Ready and pieces added to school Ready Stock. Choose whether to send an SMS.' : `Order status updated to "${newStatus}". Choose whether to send an SMS.`);
  };

  const handleSendStatusSms = async () => {
    if (!smsDraft) return;
    setSendingSms(true);
    const result = await sendSmsViaGateway({ recipientName: smsDraft.recipientName, recipientPhone: smsDraft.recipientPhone, message: smsDraft.message, referenceType: 'uniform_order_status', referenceId: smsDraft.title });
    setSendingSms(false);
    setNotice(result.message);
    if (result.ok) setSmsDraft(null);
  };

  const handleSendQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteModalOrder) return;
    handleUpdateOrderStatus(quoteModalOrder.id, 'Quoted', quotationPrice);
    setNotice(`Quotation ₹${quotationPrice.toLocaleString()} submitted for Order ${quoteModalOrder.schoolOrderId}.`);
    setQuoteModalOrder(null);
  };

  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const pendingCount = connections.filter(c => c.status.startsWith('pending')).length;

  // Connection Table Pagination State
  const [connPage, setConnPage] = useState(1);
  const connPerPage = 5;
  const totalConnPages = Math.max(1, Math.ceil(connections.length / connPerPage));
  const paginatedConnections = connections.slice((connPage - 1) * connPerPage, connPage * connPerPage);

  // Orders Table Pagination State
  const [orderPage, setOrderPage] = useState(1);
  const orderPerPage = 5;
  const totalOrderPages = Math.max(1, Math.ceil(orders.length / orderPerPage));
  const paginatedOrders = orders.slice((orderPage - 1) * orderPerPage, orderPage * orderPerPage);

  return (
    <section className="content">
      {/* Compact Top Banner Panel */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: 14, background: 'linear-gradient(135deg, #0b3f37 0%, #007c68 100%)', color: '#fff', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Network size={22} style={{ color: '#6ee7b7' }} />
              <h2 style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 800 }}>School Network & B2B Order Hub</h2>
            </div>
            <p style={{ margin: '2px 0 0', opacity: 0.9, fontSize: 12 }}>
              Connect with schools, process uniform orders, and dispatch real-time status updates.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '6px 12px', borderRadius: 8, backdropFilter: 'blur(4px)' }}>
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, fontWeight: 700, display: 'block' }}>Garment Code</span>
              <strong style={{ fontSize: 14, letterSpacing: '1px', color: '#6ee7b7' }}>{garmentCode}</strong>
            </div>
            <button className="outline" onClick={() => setShowApiModal(true)} style={{ background: '#fff', border: 'none', color: '#0b3f37', padding: '7px 12px', fontSize: 11.5, fontWeight: 700, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <KeyRound size={14} /> View Credentials
            </button>
          </div>
        </div>
      </div>

      <div className="measurement-tabs" style={{ marginBottom: 16 }}>
        <button className={activeTab === 'connections' ? 'active' : ''} onClick={() => setActiveTab('connections')}>
          <Building2 size={16} />
          <span>School Connections<small>{connectedCount} connected · {pendingCount} pending</small></span>
        </button>
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
          <Package size={16} />
          <span>Uniform Orders (B2B)<small>{orders.length} active orders</small></span>
        </button>
        <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>
          <Zap size={16} />
          <span>API Callbacks & Notifications<small>Webhooks & In-App Alerts</small></span>
        </button>
      </div>

      {notice && (
        <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span>{notice}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastUpdatedOrder && (
              <button
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                onClick={() => handleShareWhatsApp(lastUpdatedOrder)}
                title="Send status update on WhatsApp"
              >
                <MessageCircle size={14} /> Send on WhatsApp
              </button>
            )}
            <button style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 700, fontSize: 14 }} onClick={() => setNotice(null)}>✕</button>
          </div>
        </div>
      )}

      {activeTab === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, color: '#0b3f37', margin: 0, fontWeight: 700 }}>Network Connection Manager</h3>
            <button className="primary" onClick={() => setShowConnectModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <Plus size={16} /> Connect New School
            </button>
          </div>

          {pendingCount > 0 && (
            <div className="card" style={{ padding: 16, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={16} /> Inbound Connection Requests Waiting for Your Authorization ({pendingCount})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {connections.filter(c => c.status.startsWith('pending')).map(c => (
                  <div key={c.id} style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, border: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 15, color: '#1e293b', display: 'block' }}>{c.schoolName}</strong>
                      <span style={{ fontSize: 12, color: '#64748b' }}>School Code: <code>{c.schoolCode}</code> | Callback API: {c.schoolApiUrl}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button className="primary" style={{ background: '#10b981', borderColor: '#059669', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleApproveConnection(c.id)}>
                        <CheckCircle2 size={15} /> Authorize & Connect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="doc-table summary-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>SCHOOL NAME</th>
                  <th>SCHOOL CODE</th>
                  <th>CONNECTION ID</th>
                  <th>STATUS</th>
                  <th>CONNECTED ON</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedConnections.map(c => (
                  <tr key={c.id}>
                    <td><strong style={{ fontSize: 14, color: '#0f172a' }}>{c.schoolName}</strong></td>
                    <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{c.schoolCode}</code></td>
                    <td><small style={{ color: '#64748b' }}>{c.id}</small></td>
                    <td>
                      <span className={`status ${c.status === 'connected' ? 'completed' : c.status.startsWith('pending') ? 'in-progress' : 'pending'}`}>
                        {c.status === 'connected' ? '🟢 Connected' : c.status === 'disconnected' ? '🔴 Disconnected' : '🟡 Pending'}
                      </span>
                    </td>
                    <td>{c.createdAt}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.status === 'connected' && (
                          <>
                            <button
                              className="outline mini-action"
                              style={{ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' }}
                              title="Chat with School on WhatsApp"
                              onClick={() => {
                                const phone = contacts[c.schoolCode] || contacts['SCH-56191'] || '';
                                openWhatsApp({
                                  phone,
                                  message: `Hello ${c.schoolName} Admin, this is ${company.name || 'our team'} regarding your uniform orders.`
                                });
                              }}
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </button>
                            <button className="outline mini-action" title="Test Connection Ping" onClick={() => handleTestConnection(c)}>
                              <Zap size={14} /> Test Ping
                            </button>
                            <button className="outline mini-action" style={{ color: '#ef4444' }} title="Disconnect School" onClick={() => handleDisconnect(c.id)}>
                              <XCircle size={14} /> Disconnect
                            </button>
                          </>
                        )}
                        {c.status === 'disconnected' && (
                          <button className="outline mini-action" style={{ color: '#10b981' }} onClick={() => handleReconnect(c.id)}>
                            Reconnect
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Always Visible Pagination Controls */}
            {connections.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 12.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b' }}>
                  <span>
                    Showing <strong>{connections.length > 0 ? ((connPage - 1) * connPerPage) + 1 : 0}</strong> to <strong>{Math.min(connPage * connPerPage, connections.length)}</strong> of <strong>{connections.length}</strong> connections
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="outline mini-action" disabled={connPage <= 1} onClick={() => setConnPage(connPage - 1)} style={{ padding: '4px 10px', fontSize: 12 }}>
                    Previous
                  </button>
                  {Array.from({ length: totalConnPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={connPage === p ? 'primary mini-action' : 'outline mini-action'} onClick={() => setConnPage(p)} style={{ padding: '4px 10px', fontSize: 12, fontWeight: connPage === p ? 700 : 400 }}>
                      {p}
                    </button>
                  ))}
                  <button className="outline mini-action" disabled={connPage >= totalConnPages} onClick={() => setConnPage(connPage + 1)} style={{ padding: '4px 10px', fontSize: 12 }}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, color: '#0b3f37', margin: 0, fontWeight: 700 }}>Incoming B2B Uniform Orders</h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>Showing {orders.length} order requests from connected schools</span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="doc-table summary-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>ORDER REF & SCHOOL</th>
                  <th>REQUIRED DATE</th>
                  <th>DRESS & SIZES</th>
                  <th>TOTAL AMOUNT</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map(ord => (
                  <tr key={ord.id}>
                    <td>
                      <code style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        {ord.schoolOrderId || ord.orderNo}
                      </code>
                      <strong style={{ fontSize: 13.5, color: '#0f172a', display: 'block', marginTop: 2 }}>{ord.schoolName}</strong>
                    </td>
                    <td><small style={{ color: '#475569', fontWeight: 600 }}>{ord.requiredDeliveryDate}</small></td>
                    <td>
                      <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>{ord.dressColorDesign}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {ord.items.map(item => (
                          <span key={item.id} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#475569' }}>
                            {item.itemType} {item.size}: <strong>{item.quantity} Qty</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: '#007c68', fontSize: 14 }}>₹{ord.totalAmount.toLocaleString()}</strong>
                      <small style={{ display: 'block', color: '#64748b' }}>({ord.totalItemsCount} pcs)</small>
                    </td>
                    <td>
                      <span className={`status ${ord.status === 'Received' ? 'in-progress' : ord.status === 'Cancelled' ? 'pending' : 'completed'}`} style={{ fontSize: 11.5, fontWeight: 700 }}>
                        {ord.status === 'Cancelled' ? '🔴 Cancelled' : ord.status === 'Received' ? '🟡 Received' : `🟢 ${ord.status}`}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="outline mini-action" onClick={() => setSelectedOrder(ord)} title="View Details">
                          <FileText size={13} />
                        </button>
                        <button
                          className="outline mini-action"
                          style={{ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' }}
                          onClick={() => handleShareWhatsApp(ord)}
                          title="Share Status on WhatsApp"
                        >
                          <MessageCircle size={13} />
                        </button>

                        {ord.status === 'Received' && (
                          <>
                            <button className="primary mini-action" style={{ background: '#10b981', borderColor: '#059669' }} onClick={() => handleUpdateOrderStatus(ord.id, 'Accepted')}>
                              Accept
                            </button>
                            <button className="primary mini-action" style={{ background: '#0284c7', borderColor: '#0369a1' }} onClick={() => { setQuoteModalOrder(ord); setQuotationPrice(ord.totalAmount); }}>
                              Quote
                            </button>
                            <button className="outline mini-action" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleUpdateOrderStatus(ord.id, 'Cancelled')}>
                              Reject
                            </button>
                          </>
                        )}

                        {(ord.status === 'Accepted' || ord.status === 'Quoted') && (
                          <>
                            <button className="primary mini-action" style={{ background: '#7c3aed' }} onClick={() => handleUpdateOrderStatus(ord.id, 'In Production')}>
                              Production
                            </button>
                            <button className="outline mini-action" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleUpdateOrderStatus(ord.id, 'Cancelled')}>
                              Cancel
                            </button>
                          </>
                        )}

                        {ord.status === 'In Production' && (
                          <>
                            <button className="primary mini-action" style={{ background: '#059669' }} onClick={() => handleUpdateOrderStatus(ord.id, 'Ready')}>
                              <Package size={13} /> Stitching Ready
                            </button>
                            <button className="outline mini-action" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleUpdateOrderStatus(ord.id, 'Cancelled')}>
                              Cancel
                            </button>
                          </>
                        )}

                        {ord.status === 'Ready' && (
                          <button className="primary mini-action" style={{ background: '#0284c7' }} onClick={() => handleUpdateOrderStatus(ord.id, 'Dispatched')}>
                            <Truck size={13} /> Dispatch
                          </button>
                        )}

                        {ord.status === 'Dispatched' && (
                          <button className="primary mini-action" style={{ background: '#10b981' }} onClick={() => handleUpdateOrderStatus(ord.id, 'Delivered')}>
                            Delivered
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Always Visible Orders Pagination Controls */}
            {orders.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 12.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b' }}>
                  <span>
                    Showing <strong>{orders.length > 0 ? ((orderPage - 1) * orderPerPage) + 1 : 0}</strong> to <strong>{Math.min(orderPage * orderPerPage, orders.length)}</strong> of <strong>{orders.length}</strong> orders
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="outline mini-action" disabled={orderPage <= 1} onClick={() => setOrderPage(orderPage - 1)} style={{ padding: '4px 10px', fontSize: 12 }}>
                    Previous
                  </button>
                  {Array.from({ length: totalOrderPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={orderPage === p ? 'primary mini-action' : 'outline mini-action'} onClick={() => setOrderPage(p)} style={{ padding: '4px 10px', fontSize: 12, fontWeight: orderPage === p ? 700 : 400 }}>
                      {p}
                    </button>
                  ))}
                  <button className="outline mini-action" disabled={orderPage >= totalOrderPages} onClick={() => setOrderPage(orderPage + 1)} style={{ padding: '4px 10px', fontSize: 12 }}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {smsDraft && <SmsComposerModal draft={smsDraft} setDraft={setSmsDraft} onClose={() => setSmsDraft(null)} onSend={handleSendStatusSms} sending={sendingSms} cancelLabel="Skip SMS" />}

      {activeTab === 'logs' && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, color: '#0b3f37', margin: '0 0 12px' }}>Network Event Log & Webhook Delivery Audit</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5 }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>[WEBHOOK DISPATCHED 200 OK]</span> Sent order status update <code>"In Production"</code> for SO-APX-2026-012 to Apex International.
            </div>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5 }}>
              <span style={{ color: '#2563eb', fontWeight: 700 }}>[INBOUND REST API]</span> Received new uniform order <code>SO-XAV-2026-089</code> (200 pieces) from St. Xavier High School.
            </div>
          </div>
        </div>
      )}

      {showConnectModal && (
        <div className="stock-modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="card detail-modal" style={{ maxWidth: 480, width: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="cardhead">
              <h2>Connect with School</h2>
              <button className="outline" onClick={() => setShowConnectModal(false)}>✕</button>
            </div>
            <form onSubmit={handleConnectRequest} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <label>School Code *
                <input required value={newSchoolCode} onChange={e => setNewSchoolCode(e.target.value.toUpperCase())} placeholder="e.g. SCH-GREEN-04" style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }} />
              </label>
              <label>School Name *
                <input required value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="e.g. Green Valley Public School" style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1' }} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button type="button" className="outline" onClick={() => setShowConnectModal(false)}>Cancel</button>
                <button type="submit" className="primary">Send Connection Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quoteModalOrder && (
        <div className="stock-modal-overlay" onClick={() => setQuoteModalOrder(null)}>
          <div className="card detail-modal" style={{ maxWidth: 480, width: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="cardhead">
              <h2>Send Price Quotation</h2>
              <button className="outline" onClick={() => setQuoteModalOrder(null)}>✕</button>
            </div>
            <form onSubmit={handleSendQuotation} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Order: <strong>{quoteModalOrder.schoolOrderId}</strong> ({quoteModalOrder.totalItemsCount} pieces)
              </p>
              <label>Total Quotation Price (₹) *
                <input required type="number" value={quotationPrice} onChange={e => setQuotationPrice(Number(e.target.value))} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 16, fontWeight: 700 }} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button type="button" className="outline" onClick={() => setQuoteModalOrder(null)}>Cancel</button>
                <button type="submit" className="primary">Submit Quotation to School</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="stock-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="card detail-modal" style={{ maxWidth: 680, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="cardhead">
              <h2>Order Details & Size Matrix: {selectedOrder.schoolOrderId}</h2>
              <button className="outline" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 14 }}><strong>School:</strong> {selectedOrder.schoolName}</p>
              <p style={{ margin: '0 0 6px', fontSize: 13 }}><strong>Design & Fabric:</strong> {selectedOrder.dressColorDesign}</p>
              <p style={{ margin: '0 0 14px', fontSize: 13 }}><strong>Target Delivery Date:</strong> {selectedOrder.requiredDeliveryDate}</p>

              <h4 style={{ fontSize: 13, color: '#0b3f37', marginBottom: 8 }}>Item Size & Quantity Breakup Table</h4>
              <table className="doc-table summary-table" style={{ width: '100%', marginBottom: 14 }}>
                <thead>
                  <tr>
                    <th>ITEM TYPE</th>
                    <th>SIZE</th>
                    <th>QUANTITY</th>
                    <th>UNIT PRICE</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map(i => (
                    <tr key={i.id}>
                      <td><strong>{i.itemType}</strong></td>
                      <td>{i.size}</td>
                      <td><strong style={{ color: '#007c68' }}>{i.quantity} pcs</strong></td>
                      <td>₹{i.unitPrice || 0}</td>
                      <td>₹{((i.unitPrice || 0) * i.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <button
                  className="primary"
                  style={{ background: '#16a34a', borderColor: '#15803d', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  onClick={() => handleShareWhatsApp(selectedOrder)}
                >
                  <MessageCircle size={15} /> Send Order & Size Breakup on WhatsApp
                </button>
                <button className="outline" onClick={() => setSelectedOrder(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApiModal && (
        <div className="stock-modal-overlay" onClick={() => setShowApiModal(false)}>
          <div className="card detail-modal" style={{ maxWidth: 540, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="cardhead">
              <h2>🔑 Garment ERP B2B API Credentials</h2>
              <button className="outline" onClick={() => setShowApiModal(false)}>✕</button>
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Share these 4 credential values with your School Client to enter under <strong>Setup ➔ Garment Network</strong>:
              </p>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>1. GARMENT VENDOR CODE *</span>
                  <strong style={{ color: '#0b3f37', fontSize: 15 }}>GARMENT-5028</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>2. GARMENT API URL *</span>
                  <code style={{ background: '#fff', padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', display: 'block', wordBreak: 'break-all' }}>http://127.0.0.1:47831/api/v1/school-connections/requests</code>
                  <small style={{ color: '#059669', display: 'block', marginTop: 2 }}>Production: https://garment.telicampus.in/api/v1/school-connections/requests</small>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>3. API KEY IDENTIFIER</span>
                  <strong style={{ color: '#0f172a' }}>key_teliapparels_5028</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>4. API SECRET (AES ENCRYPTED)</span>
                  <strong style={{ color: '#0f172a' }}>secret_teliapparels</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="primary" onClick={() => {
                  const text = `Garment Vendor Code: GARMENT-5028\nGarment API URL: http://127.0.0.1:47831/api/v1/school-connections/requests\nAPI Key Identifier: key_teliapparels_5028\nAPI Secret: secret_teliapparels`;
                  navigator.clipboard.writeText(text);
                  setNotice('📋 API credentials copied to clipboard!');
                  setShowApiModal(false);
                }}>
                  <Copy size={14} /> Copy All Credentials for School
                </button>
                <button className="outline" onClick={() => setShowApiModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
