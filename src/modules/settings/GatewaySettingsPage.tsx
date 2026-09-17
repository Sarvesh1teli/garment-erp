import { useEffect, useState } from "react";
import { CheckCircle2, Globe, MessageSquare, Phone, Plus, RefreshCw, Send, Settings, Trash2, Wifi, WifiOff } from "lucide-react";
import { sendSmsViaGateway, formatSalarySms, formatStockOutSms, formatPaymentReceiptSms, formatOrderStatusSms, type SmsLanguage } from "../../shared/sms";
import { API_BASE_URL, getStoredTenantId } from "../../shared/utils";
import type { CompanySettings } from "./SettingsPage";

type SmsContact = { schoolCode: string; phone: string };
type SmsJob = { id: string; recipientName: string; recipientPhone: string; message: string; status: string; createdAt: string };
type GatewayDevice = { id: string; deviceName: string; mobileNumber?: string; status: string; lastSeenAt: string; createdAt: string };

type SmsSettings = {
  enabled: boolean;
  organizationCode: string;
  deviceKeyConfigured: boolean;
  devices: GatewayDevice[];
  contacts: Record<string, string>;
  triggers: Record<string, boolean>;
  lastHeartbeat: string | null;
  deviceInfo: string | null;
  sentToday: number;
  failedCount: number;
  pending: number;
  recentJobs: SmsJob[];
};

export function GatewaySettingsPage({company}:{company:CompanySettings}) {
  const [settings, setSettings] = useState<SmsSettings | null>(null);
  const [contacts, setContacts] = useState<SmsContact[]>([]);
  const [newContact, setNewContact] = useState({ schoolCode: "", phone: "" });
  const [deviceKey, setDeviceKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Quick SMS Dispatcher State
  const [quickRecipientName, setQuickRecipientName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickLang, setQuickLang] = useState<SmsLanguage>("english");
  const [quickTemplate, setQuickTemplate] = useState<"custom" | "salary" | "stockout" | "payment" | "order">("salary");
  const [quickCustomMsg, setQuickCustomMsg] = useState("");
  const [sendingQuickSms, setSendingQuickSms] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sms-settings`, { headers: { "X-Tenant-ID": getStoredTenantId() } });
      if (!res.ok) throw new Error("Unable to load gateway settings");
      const data: SmsSettings = await res.json();
      setSettings(data);
      setContacts(
        Object.entries(data.contacts || {}).map(([schoolCode, phone]) => ({
          schoolCode,
          phone: phone as string,
        }))
      );
    } catch { /* offline */ }
  }

  async function saveSettings(patch: Partial<SmsSettings>) {
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/api/v1/sms-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": getStoredTenantId() },
        body: JSON.stringify(patch),
      });
      await fetchSettings();
      setNotice("Settings saved successfully!");
    } catch {
      setNotice("Failed to save - is the API server running?");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleEnabled() {
    saveSettings({ enabled: !settings?.enabled });
  }

  function handleToggleTrigger(trigger: string) {
    const next = { ...(settings?.triggers || {}), [trigger]: !(settings?.triggers?.[trigger]) };
    saveSettings({ triggers: next });
  }

  function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContact.schoolCode || !newContact.phone) return;
    const next = { ...(settings?.contacts || {}), [newContact.schoolCode]: newContact.phone };
    saveSettings({ contacts: next });
    setNewContact({ schoolCode: "", phone: "" });
  }

  function handleRemoveContact(schoolCode: string) {
    const next = { ...(settings?.contacts || {}) };
    delete next[schoolCode];
    saveSettings({ contacts: next });
  }

  async function handleGenerateDeviceKey() {
    if (settings?.deviceKeyConfigured && !window.confirm("Generate a new key? Phones will need the new key the next time they sign in.")) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sms-gateway/key`, { method: "POST", headers: { "X-Tenant-ID": getStoredTenantId() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not generate key");
      setDeviceKey(data.deviceKey);
      setNotice("New reusable device key generated. Copy it now and use it on any gateway phone.");
      await fetchSettings();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not generate key");
    } finally { setSaving(false); }
  }

  async function revokeDevice(id: string) {
    if (!window.confirm("Revoke this phone? Other phones using the same key will continue working.")) return;
    await fetch(`${API_BASE_URL}/api/v1/sms-gateway/devices/${encodeURIComponent(id)}/revoke`, { method: "POST", headers: { "X-Tenant-ID": getStoredTenantId() } });
    await fetchSettings();
  }

  // Generate live template text based on selected template & language
  const generatedMessage = (() => {
    const name = quickRecipientName.trim() || "Customer / Staff";
    if (quickTemplate === "salary") {
      return formatSalarySms({
        employeeName: name,
        from: "2026-08-01",
        to: "2026-08-31",
        gross: 18500,
        recover: 2000,
        netPayable: 16500,
        mode: "UPI",
        companyName: company.name || "Your Business",
        language: quickLang,
      });
    }
    if (quickTemplate === "stockout") {
      return formatStockOutSms({
        partyName: name,
        date: new Date().toISOString().slice(0, 10),
        garment: "School Uniform Shirt",
        size: "32",
        count: 50,
        challanNo: "DC-901",
        companyName: company.name || "Your Business",
        language: quickLang,
      });
    }
    if (quickTemplate === "payment") {
      return formatPaymentReceiptSms({
        customerName: name,
        receiptId: "REC-4401",
        invoiceNo: "INV-2026-0042",
        amount: 25000,
        mode: "Bank Transfer",
        companyName: company.name || "Your Business",
        language: quickLang,
      });
    }
    if (quickTemplate === "order") {
      return formatOrderStatusSms({
        schoolName: name,
        orderRef: "ORD-2026-0003",
        status: "Accepted",
        totalQty: 100,
        deliveryDate: "2026-09-15",
        companyName: company.name || "Your Business",
        language: quickLang,
      });
    }
    return quickCustomMsg;
  })();

  useEffect(() => {
    if (quickTemplate !== "custom") setQuickCustomMsg(generatedMessage);
  }, [quickTemplate, quickLang, quickRecipientName, company.name]);

  async function handleSendQuickSms(e: React.FormEvent) {
    e.preventDefault();
    if (!quickPhone.trim()) {
      alert("Please enter recipient phone number");
      return;
    }
    const messageToSend = quickCustomMsg || generatedMessage;
    if (!messageToSend.trim()) {
      alert("Please enter or select a message to send");
      return;
    }
    setSendingQuickSms(true);
    try {
      const res = await sendSmsViaGateway({
        recipientName: quickRecipientName || quickPhone,
        recipientPhone: quickPhone,
        message: messageToSend,
        referenceType: quickTemplate,
      });
      if (res.ok) {
        setNotice(`📱 SMS queued successfully in ${quickLang.toUpperCase()} for ${quickPhone} via TeliGateway!`);
        await fetchSettings();
      } else {
        setNotice(`❌ Failed to send SMS: ${res.message}`);
      }
    } finally {
      setSendingQuickSms(false);
    }
  }

  const activeDevices = (settings?.devices || []).filter(device => device.status === "ACTIVE");
  const latestSeen = activeDevices.map(device => new Date(device.lastSeenAt).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
  const isOnline = !!latestSeen && Date.now() - latestSeen < 60000;
  const lastSeen = latestSeen ? new Date(latestSeen).toLocaleString() : "Never";
  const statusColor = (s: string) => ({ PENDING: "#f59e0b", SENT: "#10b981", FAILED: "#ef4444" }[s] || "#94a3b8");

  const triggerEvents = [
    { key: "Accepted", label: "Order Accepted", desc: "Factory accepted the order" },
    { key: "Quoted", label: "Quotation Sent", desc: "Quotation submitted to school" },
    { key: "Dispatched", label: "Order Dispatched", desc: "Items dispatched via courier" },
    { key: "Delivered", label: "Order Delivered", desc: "Items delivered to school" },
    { key: "Cancelled", label: "Order Rejected/Cancelled", desc: "Order cancelled or rejected" },
  ];

  return (
    <section className="content">
      {/* Page Header */}
      <div className="card" style={{ padding: "12px 18px", marginBottom: 14, background: "linear-gradient(135deg, #0b3f37 0%, #007c68 100%)", color: "#fff", borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={22} style={{ color: "#6ee7b7" }} />
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: "#fff", fontWeight: 800 }}>SMS Gateway & Multi-Language Dispatcher</h2>
              <p style={{ margin: "2px 0 0", opacity: 0.9, fontSize: 12 }}>
                TeliGateway SIM SMS integration • English, ಕನ್ನಡ (Kannada), and Bilingual Support
              </p>
            </div>
          </div>
          <button onClick={fetchSettings} style={{ background: "#fff", border: "none", color: "#0b3f37", padding: "7px 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 6, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: "10px 16px", background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#065f46", borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{notice}</span>
          <button style={{ background: "none", border: "none", color: "#065f46", cursor: "pointer", fontWeight: 700, fontSize: 16, lineHeight: 1 }} onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      {/* ── QUICK SMS DISPATCHER BOX WITH MULTI-LANGUAGE ── */}
      <div className="card" style={{ padding: 16, marginBottom: 14, border: "2px solid #007c68", background: "#f8fdfb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#0b3f37", display: "flex", alignItems: "center", gap: 6, fontWeight: 800 }}>
            <Send size={18} style={{ color: "#007c68" }} />
            ⚡ Quick SMS Dispatcher (English / ಕನ್ನಡ / Both)
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>SMS Language:</span>
            <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: "1px solid #cbd5e1" }}>
              {(["english", "kannada", "both"] as SmsLanguage[]).map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setQuickLang(lang)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    background: quickLang === lang ? "#0b3f37" : "#fff",
                    color: quickLang === lang ? "#fff" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {lang === "english" ? "English" : lang === "kannada" ? "ಕನ್ನಡ" : "Both / ಎರಡೂ"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSendQuickSms}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Template Type</label>
              <select
                value={quickTemplate}
                onChange={e => setQuickTemplate(e.target.value as any)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff" }}
              >
                <option value="salary">💵 Salary Slip Notification</option>
                <option value="stockout">📦 Stock Out / Dispatch Alert</option>
                <option value="order">👗 Uniform Order Status Alert</option>
                <option value="payment">💳 Payment Receipt Acknowledgment</option>
                <option value="custom">✏️ Custom Message</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Recipient Name / Title</label>
              <input
                value={quickRecipientName}
                onChange={e => setQuickRecipientName(e.target.value)}
                placeholder="e.g. Rahul Sharma / Greenwood Academy"
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #cbd5e1" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Mobile Number *</label>
              <input
                value={quickPhone}
                onChange={e => setQuickPhone(e.target.value)}
                placeholder="e.g. 9876543210 or +919876543210"
                required
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #cbd5e1", fontFamily: "monospace", fontWeight: 700 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
              Message Preview ({quickLang.toUpperCase()})
            </label>
            <textarea
              value={quickCustomMsg || generatedMessage}
              onChange={e => setQuickCustomMsg(e.target.value)}
              placeholder="Type or edit your SMS message here..."
              rows={3}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #cbd5e1", fontFamily: "sans-serif" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="submit"
              disabled={sendingQuickSms}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 800,
                background: "#007c68",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <Send size={15} />
              {sendingQuickSms ? "Queueing..." : "Send SMS via TeliGateway"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Device Status Panel */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#0b3f37", display: "flex", alignItems: "center", gap: 6 }}>
            {isOnline ? <Wifi size={16} style={{ color: "#10b981" }} /> : <WifiOff size={16} style={{ color: "#ef4444" }} />}
            Gateway Device Status
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Connection</span>
              <span style={{ fontWeight: 700, color: isOnline ? "#10b981" : "#ef4444" }}>
                {isOnline ? "Online" : `${activeDevices.length} registered`}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Last Heartbeat</span>
              <span style={{ fontWeight: 600 }}>{lastSeen}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Sent Today</span>
              <span style={{ fontWeight: 700, color: "#007c68" }}>{settings?.sentToday || 0} SMS</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Pending Queue</span>
              <span style={{ fontWeight: 700, color: "#f59e0b" }}>{settings?.pending || 0} SMS</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Failed</span>
              <span style={{ fontWeight: 700, color: "#ef4444" }}>{settings?.failedCount || 0}</span>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                Organization Code
              </label>
              <div style={{ padding: "7px 9px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, fontFamily: "monospace", fontWeight: 800 }}>{settings?.organizationCode || "-"}</div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                Reusable Device Key
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={deviceKey || (settings?.deviceKeyConfigured ? "Key already generated" : "No key generated")}
                  readOnly
                  style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "monospace" }}
                />
                <button onClick={handleGenerateDeviceKey} disabled={saving} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, background: "#007c68", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                  {settings?.deviceKeyConfigured ? "Rotate" : "Generate"}
                </button>
              </div>
              <small style={{ color: "#64748b" }}>The same key can register multiple phones. The key is shown only when generated.</small>
            </div>
            {activeDevices.length > 0 && <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
              <strong style={{ fontSize: 12 }}>Registered phones</strong>
              {activeDevices.map(device => <div key={device.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: 8, border: "1px solid #e2e8f0", borderRadius: 7 }}>
                <span><b>{device.deviceName}</b><small style={{ display: "block", color: "#64748b" }}>Last seen {new Date(device.lastSeenAt).toLocaleString()}</small></span>
                <button onClick={() => revokeDevice(device.id)} style={{ border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>Revoke</button>
              </div>)}
            </div>}
          </div>
        </div>

        {/* SMS Triggers */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#0b3f37", display: "flex", alignItems: "center", gap: 6 }}>
              <Settings size={16} /> Automated Order Triggers
            </h3>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: settings?.enabled ? "#10b981" : "#ef4444" }}>
                {settings?.enabled ? "Enabled" : "Disabled"}
              </span>
              <input type="checkbox" checked={!!settings?.enabled} onChange={handleToggleEnabled} />
            </label>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
            Select which order events trigger an SMS to the school contact:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {triggerEvents.map(t => (
              <label key={t.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings?.triggers?.[t.key] !== false}
                  onChange={() => handleToggleTrigger(t.key)}
                  disabled={!settings?.enabled}
                />
                <div>
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  <small style={{ display: "block", color: "#94a3b8", fontSize: 11 }}>{t.desc}</small>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* School Phone Contacts */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#0b3f37", display: "flex", alignItems: "center", gap: 6 }}>
          <Phone size={16} /> School Contact Phone Numbers
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
          Map each school code to the phone number that receives SMS notifications.
        </p>
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11 }}>SCHOOL CODE</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11 }}>PHONE NUMBER</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11 }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b", padding: 20, fontSize: 13 }}>
                    No contacts configured. Add a school phone number below.
                  </td>
                </tr>
              )}
              {contacts.map(c => (
                <tr key={c.schoolCode} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 14px" }}>
                    <code style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                      {c.schoolCode}
                    </code>
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <strong style={{ fontSize: 13 }}>{c.phone}</strong>
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <button onClick={() => handleRemoveContact(c.schoolCode)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff1f2", border: "1px solid #fecaca", color: "#a31313", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={handleAddContact} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newContact.schoolCode}
            onChange={e => setNewContact({ ...newContact, schoolCode: e.target.value })}
            placeholder="School Code (e.g. SCH-56191)"
            required
            style={{ flex: 1, minWidth: 160, border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          />
          <input
            value={newContact.phone}
            onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
            placeholder="Phone (+91 9876543210)"
            required
            style={{ flex: 1, minWidth: 180, border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          />
          <button type="submit" disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, background: "#007c68", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            <Plus size={14} /> Add Contact
          </button>
        </form>
      </div>

      {/* SMS Job Log */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#0b3f37", display: "flex", alignItems: "center", gap: 6 }}>
          <Send size={16} /> Recent SMS Job Log (All Modules: Salary, Stock Out, Orders)
        </h3>
        <div style={{ overflow: "hidden", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11 }}>RECIPIENT</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11 }}>MESSAGE</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11 }}>STATUS</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11 }}>QUEUED AT</th>
              </tr>
            </thead>
            <tbody>
              {(!settings?.recentJobs || settings.recentJobs.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#64748b", padding: 24, fontSize: 13 }}>
                    No SMS jobs in queue yet. Use the Quick SMS Dispatcher above or generate a salary to trigger one.
                  </td>
                </tr>
              )}
              {(settings?.recentJobs || []).map(job => (
                <tr key={job.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 14px" }}>
                    <strong style={{ fontSize: 13 }}>{job.recipientName}</strong>
                    <small style={{ display: "block", color: "#64748b" }}>{job.recipientPhone}</small>
                  </td>
                  <td style={{ padding: "8px 14px", maxWidth: 300 }}>
                    <small style={{ color: "#475569", fontSize: 12, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                      {job.message && job.message.length > 120 ? job.message.slice(0, 120) + "..." : job.message}
                    </small>
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: statusColor(job.status) }}>
                      {job.status === "SENT" ? "✅ SENT" : job.status === "FAILED" ? "❌ FAILED" : "⏳ PENDING"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <small style={{ color: "#64748b" }}>
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How to Connect Instructions */}
      <div className="card" style={{ padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
        <strong style={{ display: "block", marginBottom: 8, color: "#0b3f37", fontSize: 13 }}>
          📱 How to Connect ThreadFlow Gateway App
        </strong>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#475569", lineHeight: 2, fontSize: 13 }}>
          <li>Install <code>threadflow-gateway.apk</code> on any Android phone with an active SIM card.</li>
          <li>Open the app and enter <strong>ERP Backend URL</strong>: <code>http://YOUR_IP:47831</code> or <code>https://garment.telicampus.in</code></li>
          <li>Enter the <strong>Organization Code</strong> shown above.</li>
          <li>Enter <strong>Device Key</strong>: the key shown above in Device Status panel</li>
          <li>Tap <strong>Connect</strong>, then tap <strong>Start</strong> - the phone will now send SMS in English, Kannada, or Both automatically!</li>
        </ol>
      </div>
    </section>
  );
}
