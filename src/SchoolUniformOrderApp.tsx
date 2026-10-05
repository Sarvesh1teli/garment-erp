import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  History,
  Home,
  LogOut,
  PackagePlus,
  Plus,
  School,
  Search,
  Trash2,
  Unplug,
  UserRound,
  XCircle,
} from "lucide-react";
import { API_BASE_URL } from "./shared/api";

type SchoolUser = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  connectionStatus?: string;
  garmentName?: string;
};
type OrderItem = { garmentType: string; size: string; quantity: number };
type Order = {
  id: string;
  orderNo: string;
  orderDate: string;
  requiredDate?: string;
  notes: string;
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  totalQuantity: number;
  garmentRemark?: string;
  rejectionReason?: string;
  items: OrderItem[];
  history?: {
    id: string;
    action: string;
    newStatus: string;
    remarks: string;
    performedBy: string;
    createdAt: string;
  }[];
};
type Page = "home" | "create" | "history" | "profile";
const today = () => new Date().toISOString().slice(0, 10);
const displayDate = (value?: string) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export function SchoolUniformOrderApp() {
  const saved = localStorage.getItem("school_uniform_session");
  const initial = saved ? JSON.parse(saved) : null;
  const [token, setToken] = useState<string>(initial?.token || "");
  const [school, setSchool] = useState<SchoolUser | null>(
    initial?.school || null,
  );
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [auth, setAuth] = useState({
    schoolName: "",
    email: "",
    mobile: "",
    password: "",
  });
  const [page, setPage] = useState<Page>("home");
  const [orders, setOrders] = useState<Order[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionCode, setConnectionCode] = useState("");
  const [supplier, setSupplier] = useState<{
    businessName: string;
    contactPerson: string;
    phone: string;
  } | null>(null);
  const [form, setForm] = useState({
    orderDate: today(),
    requiredDate: "",
    notes: "",
    items: [{ garmentType: "Shirt", size: "", quantity: 0 }] as OrderItem[],
  });
  const [filters, setFilters] = useState({ search: "", status: "ALL" });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const api = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("school_uniform_session");
      setToken("");
      setSchool(null);
      throw new Error(body.message || "Your session has expired. Please sign in again.");
    }
    if (!response.ok) throw new Error(body.message || "Request failed");
    return body;
  };
  const load = async () => {
    if (!token) return;
    try {
      const [me, list] = await Promise.all([
        api("/api/school/me"),
        api("/api/school/orders"),
      ]);
      setSchool(me.data);
      setOrders(list.data || []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load school data",
      );
    }
  };
  useEffect(() => {
    load();
  }, [token]);
  const saveSession = (nextToken: string, nextSchool: SchoolUser) => {
    localStorage.setItem(
      "school_uniform_session",
      JSON.stringify({ token: nextToken, school: nextSchool }),
    );
    setToken(nextToken);
    setSchool(nextSchool);
  };
  const login = async () => {
    setBusy(true);
    setNotice("");
    try {
      const body = await api("/api/school/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: auth.email, password: auth.password }),
      });
      saveSession(body.data.token, body.data.school);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };
  const register = async () => {
    setBusy(true);
    setNotice("");
    try {
      await api("/api/school/auth/register", {
        method: "POST",
        body: JSON.stringify(auth),
      });
      setAuthMode("login");
      setNotice("School account created. Sign in to continue.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };
  const logout = () => {
    localStorage.removeItem("school_uniform_session");
    setToken("");
    setSchool(null);
    setOrders([]);
  };
  const verifySupplier = async () => {
    setBusy(true);
    setNotice("");
    try {
      const body = await api(
        `/api/school/supplier/verify?code=${encodeURIComponent(connectionCode)}`,
      );
      setSupplier(body.data);
    } catch (error) {
      setSupplier(null);
      setNotice(error instanceof Error ? error.message : "Supplier not found");
    } finally {
      setBusy(false);
    }
  };
  const requestConnection = async () => {
    setBusy(true);
    try {
      const body = await api("/api/school/supplier/connect", {
        method: "POST",
        body: JSON.stringify({ connectionCode }),
      });
      setNotice(body.message);
      setSupplier(null);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to connect");
    } finally {
      setBusy(false);
    }
  };
  const disconnectSupplier = async () => {
    setBusy(true);
    setNotice("");
    try {
      const body = await api("/api/school/supplier/disconnect", {
        method: "POST",
      });
      setShowDisconnect(false);
      setConnectionCode("");
      setSupplier(null);
      await load();
      setNotice(body.message);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to disconnect supplier",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateItem = (
    index: number,
    key: keyof OrderItem,
    value: string | number,
  ) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index
          ? { ...item, [key]: key === "quantity" ? Number(value) : value }
          : item,
      ),
    }));
  const saveOrder = async (submit: boolean) => {
    const valid = form.items.filter(
      (item) =>
        item.garmentType.trim() && item.size.trim() && item.quantity > 0,
    );
    if (!valid.length) {
      setNotice("Add at least one garment with size and quantity.");
      return;
    }
    setBusy(true);
    try {
      const body = await api("/api/school/orders", {
        method: "POST",
        body: JSON.stringify({ ...form, items: valid, submit }),
      });
      setNotice(body.message);
      setForm({
        orderDate: today(),
        requiredDate: "",
        notes: "",
        items: [{ garmentType: "Shirt", size: "", quantity: 0 }],
      });
      await load();
      setPage("history");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to save order",
      );
    } finally {
      setBusy(false);
    }
  };
  const counts = {
    draft: orders.filter((o) => o.status === "DRAFT").length,
    submitted: orders.filter((o) => o.status === "SUBMITTED").length,
    accepted: orders.filter((o) => o.status === "ACCEPTED").length,
    rejected: orders.filter((o) => o.status === "REJECTED").length,
  };
  const filtered = useMemo(
    () =>
      orders.filter(
        (order) =>
          (filters.status === "ALL" || order.status === filters.status) &&
          (!filters.search ||
            order.orderNo.toLowerCase().includes(filters.search.toLowerCase())),
      ),
    [orders, filters],
  );
  const historyPages = Math.max(
    1,
    Math.ceil(filtered.length / historyPageSize),
  );
  const visibleHistory = filtered.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize,
  );
  useEffect(() => {
    setHistoryPage(1);
  }, [filters.search, filters.status, historyPageSize]);
  useEffect(() => {
    if (historyPage > historyPages) setHistoryPage(historyPages);
  }, [historyPage, historyPages]);
  const totalQty = form.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );

  if (!token)
    return (
      <div className="school-order-app school-auth">
        <main>
          <div className="school-auth-brand">
            <School />
            <div>
              <h1>School Uniform Order</h1>
              <p>School Ordering App</p>
            </div>
          </div>
          <section className="school-auth-card">
            <h2>
              {authMode === "login" ? "School Login" : "Create School Account"}
            </h2>
            {authMode === "register" && (
              <label>
                School Name
                <input
                  value={auth.schoolName}
                  onChange={(e) =>
                    setAuth({ ...auth, schoolName: e.target.value })
                  }
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
              />
            </label>
            {authMode === "register" && (
              <label>
                Mobile
                <input
                  value={auth.mobile}
                  onChange={(e) => setAuth({ ...auth, mobile: e.target.value })}
                />
              </label>
            )}
            <label>
              Password
              <input
                type="password"
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              />
            </label>
            {notice && <div className="school-notice">{notice}</div>}
            <button
              className="school-main-btn"
              disabled={busy}
              onClick={authMode === "login" ? login : register}
            >
              {busy
                ? "Please wait..."
                : authMode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
            <button
              className="school-link-btn"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setNotice("");
              }}
            >
              {authMode === "login"
                ? "Create a school account"
                : "Already registered? Sign in"}
            </button>
          </section>
        </main>
      </div>
    );

  return (
    <div className="school-order-app">
      <header>
        <div className="school-app-title">
          <School />
          <div>
            <strong>School Uniform Order</strong>
            <span>School Ordering App</span>
          </div>
        </div>
        <button onClick={logout}>
          <LogOut /> Sign out
        </button>
      </header>
      <main>
        {notice && (
          <div className="school-notice closable">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {page === "home" && (
          <>
            <div className="school-welcome">
              <span>Welcome, {school?.name}</span>
              <h1>Uniform Orders</h1>
              <p>Create garment orders and follow supplier acknowledgement.</p>
            </div>
            <div className="school-module-grid">
              <button onClick={() => setPage("create")}>
                <i className="blue">
                  <PackagePlus />
                </i>
                <strong>Create Order</strong>
                <small>New garment order</small>
              </button>
              <button onClick={() => setPage("history")}>
                <i className="purple">
                  <History />
                </i>
                <strong>Order History</strong>
                <small>{orders.length} total orders</small>
              </button>
              <button
                onClick={() => {
                  setFilters({ ...filters, status: "SUBMITTED" });
                  setPage("history");
                }}
              >
                <i className="amber">
                  <Clock3 />
                </i>
                <strong>Submitted</strong>
                <small>{counts.submitted} awaiting reply</small>
              </button>
              <button
                onClick={() => {
                  setFilters({ ...filters, status: "ACCEPTED" });
                  setPage("history");
                }}
              >
                <i className="green">
                  <CheckCircle2 />
                </i>
                <strong>Accepted</strong>
                <small>{counts.accepted} acknowledged</small>
              </button>
              <button
                onClick={() => {
                  setFilters({ ...filters, status: "REJECTED" });
                  setPage("history");
                }}
              >
                <i className="red">
                  <XCircle />
                </i>
                <strong>Rejected</strong>
                <small>{counts.rejected} orders</small>
              </button>
              <button onClick={() => setPage("profile")}>
                <i className="blue">
                  <UserRound />
                </i>
                <strong>Supplier</strong>
                <small>{school?.connectionStatus || "Not connected"}</small>
              </button>
            </div>
          </>
        )}
        {page === "create" && (
          <section className="school-page-card">
            <div className="school-page-head">
              <div>
                <h2>Create Uniform Order</h2>
                <p>{school?.name} is automatically selected from your login.</p>
              </div>
            </div>
            <div className="school-form-grid">
              <label>
                School
                <input value={school?.name || ""} readOnly />
              </label>
              <label>
                Order Date
                <input
                  type="date"
                  value={form.orderDate}
                  onChange={(e) =>
                    setForm({ ...form, orderDate: e.target.value })
                  }
                />
              </label>
              <label>
                Required Date (optional)
                <input
                  type="date"
                  min={form.orderDate}
                  value={form.requiredDate}
                  onChange={(e) =>
                    setForm({ ...form, requiredDate: e.target.value })
                  }
                />
              </label>
            </div>
            <h3>Garment Items</h3>
            <div className="school-items">
              {form.items.map((item, index) => (
                <div className="school-item" key={index}>
                  <label>
                    Garment Type
                    <select
                      value={item.garmentType}
                      onChange={(e) =>
                        updateItem(index, "garmentType", e.target.value)
                      }
                    >
                      <option>Shirt</option>
                      <option>Half Pant</option>
                      <option>Full Pant</option>
                      <option>Track Suit</option>
                      <option>Jacket</option>
                      <option>Skirt</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    Size
                    <input
                      value={item.size}
                      onChange={(e) =>
                        updateItem(index, "size", e.target.value)
                      }
                      placeholder="e.g. 32"
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        updateItem(index, "quantity", e.target.value)
                      }
                    />
                  </label>
                  <button
                    className="school-remove"
                    disabled={form.items.length === 1}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="school-add"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  items: [
                    ...current.items,
                    { garmentType: "Shirt", size: "", quantity: 0 },
                  ],
                }))
              }
            >
              <Plus /> Add Item
            </button>
            <label className="school-notes">
              Notes (optional)
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Order instructions"
              />
            </label>
            <div className="school-order-total">
              <span>
                Total Items: <strong>{form.items.length}</strong>
              </span>
              <span>
                Total Quantity: <strong>{totalQty}</strong>
              </span>
            </div>
            <div className="school-form-actions">
              <button onClick={() => saveOrder(false)} disabled={busy}>
                Save Draft
              </button>
              <button
                className="school-main-btn"
                onClick={() => saveOrder(true)}
                disabled={busy}
              >
                Submit Order
              </button>
            </div>
          </section>
        )}
        {page === "history" && (
          <section className="school-page-card">
            <div className="school-page-head">
              <div>
                <h2>Order History</h2>
                <p>All garment orders and supplier acknowledgements.</p>
              </div>
            </div>
            <div className="school-history-filter">
              <label>
                <Search />
                <input
                  placeholder="Search order number"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                />
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="ALL">All Statuses</option>
                <option>DRAFT</option>
                <option>SUBMITTED</option>
                <option>ACCEPTED</option>
                <option>REJECTED</option>
              </select>
            </div>
            <div className="school-history-table-wrap">
              <table className="school-history-table">
                <thead><tr><th>Order No</th><th>Order Date</th><th>Required Date</th><th>Order Details</th><th>Total Qty</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {visibleHistory.map((order) => (
                    <tr key={order.id}>
                      <td><strong>{order.orderNo}</strong></td><td>{displayDate(order.orderDate)}</td><td>{displayDate(order.requiredDate)}</td>
                      <td>{order.items.slice(0, 2).map((item, index) => <div key={index}>{item.garmentType} ({item.size}) × {item.quantity}</div>)}{order.items.length > 2 && <small>+{order.items.length - 2} more</small>}</td>
                      <td><strong>{order.totalQuantity}</strong></td><td><span className={`school-status ${order.status.toLowerCase()}`}>{order.status}</span></td>
                      <td><button className="school-view-btn" onClick={() => setViewOrder(order)}>View</button></td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={7}><div className="school-empty"><ClipboardList /><strong>No orders found</strong><span>Create an order or change the selected filter.</span></div></td></tr>}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && <div className="school-pagination"><span>Showing {(historyPage - 1) * historyPageSize + 1}–{Math.min(historyPage * historyPageSize, filtered.length)} of {filtered.length}</span><label>Rows <select value={historyPageSize} onChange={(e) => setHistoryPageSize(Number(e.target.value))}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label><button disabled={historyPage === 1} onClick={() => setHistoryPage((value) => value - 1)}>Previous</button><strong>{historyPage} / {historyPages}</strong><button disabled={historyPage === historyPages} onClick={() => setHistoryPage((value) => value + 1)}>Next</button></div>}
          </section>
        )}
        {viewOrder && <div className="school-history-modal-overlay" onClick={() => setViewOrder(null)}><section className="school-history-modal" onClick={(event) => event.stopPropagation()}><div className="school-history-modal-head"><div><h2>{viewOrder.orderNo}</h2><p>{school?.name} · Complete order details</p></div><button onClick={() => setViewOrder(null)}>Close</button></div><div className="school-order-meta"><span>Order date<b>{displayDate(viewOrder.orderDate)}</b></span><span>Required date<b>{displayDate(viewOrder.requiredDate)}</b></span><span>Total items<b>{viewOrder.items.length}</b></span><span>Total quantity<b>{viewOrder.totalQuantity}</b></span><span>Status<b><i className={`school-status ${viewOrder.status.toLowerCase()}`}>{viewOrder.status}</i></b></span><span>School notes<b>{viewOrder.notes || "-"}</b></span></div><div className="school-history-table-wrap"><table className="school-history-table"><thead><tr><th>Garment Type</th><th>Size</th><th>Quantity</th></tr></thead><tbody>{viewOrder.items.map((item, index) => <tr key={index}><td>{item.garmentType}</td><td>{item.size}</td><td><strong>{item.quantity}</strong></td></tr>)}</tbody></table></div>{viewOrder.garmentRemark && <div className="school-ack"><b>Garment acknowledgement</b>{viewOrder.garmentRemark}</div>}{viewOrder.rejectionReason && <div className="school-reject"><b>Rejection reason</b>{viewOrder.rejectionReason}</div>}{viewOrder.history?.length ? <div className="school-timeline"><h3>Order timeline</h3>{viewOrder.history.map((event) => <div key={event.id}><i /><span><b>{event.newStatus}</b>{event.remarks && `${event.remarks} · `}{event.performedBy && `${event.performedBy} · `}{new Date(event.createdAt).toLocaleString("en-IN")}</span></div>)}</div> : null}</section></div>}
        {page === "profile" && (
          <section className="school-page-card">
            <div className="school-page-head">
              <div>
                <h2>School & Supplier</h2>
                <p>Your school identity and garment connection.</p>
              </div>
            </div>
            <div className="school-profile">
              <span>
                School Name<strong>{school?.name}</strong>
              </span>
              <span>
                Email<strong>{school?.email}</strong>
              </span>
              <span>
                Connection Status
                <strong>{school?.connectionStatus || "NOT CONNECTED"}</strong>
              </span>
              <span>
                Garment Supplier<strong>{school?.garmentName || "-"}</strong>
              </span>
            </div>
            {school?.connectionStatus === "APPROVED" && (
              <div className="school-connected-actions">
                <div><strong>Connected to {school.garmentName}</strong><span>Your existing orders and history will remain safe if you disconnect.</span></div>
                <button onClick={() => setShowDisconnect(true)}><Unplug /> Disconnect & Connect Again</button>
              </div>
            )}
            {school?.connectionStatus !== "APPROVED" && (
              <div className="school-connect">
                <h3>Connect Garment Supplier</h3>
                <p>
                  Enter the connection ID provided by your garment supplier.
                </p>
                <div>
                  <input
                    value={connectionCode}
                    onChange={(e) =>
                      setConnectionCode(e.target.value.toUpperCase())
                    }
                    placeholder="TFG-XXXX-XXXX"
                  />
                  <button onClick={verifySupplier} disabled={busy}>
                    Verify
                  </button>
                </div>
                {supplier && (
                  <article>
                    <strong>{supplier.businessName}</strong>
                    <span>
                      {supplier.contactPerson} · {supplier.phone}
                    </span>
                    <button
                      className="school-main-btn"
                      onClick={requestConnection}
                    >
                      Send Connection Request
                    </button>
                  </article>
                )}
              </div>
            )}
          </section>
        )}
        {showDisconnect && (
          <div className="school-disconnect-overlay" onClick={() => !busy && setShowDisconnect(false)}>
            <section className="school-disconnect-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="school-disconnect-icon"><Unplug /></div>
              <h2>Disconnect garment supplier?</h2>
              <p>This disconnects <strong>{school?.garmentName}</strong> from <strong>{school?.name}</strong>. Your previous orders and complete order history will not be deleted.</p>
              <div className="school-disconnect-note">After disconnecting, enter another garment connection ID and send a new connection request.</div>
              <div><button disabled={busy} onClick={() => setShowDisconnect(false)}>Keep Connection</button><button className="school-danger-btn" disabled={busy} onClick={disconnectSupplier}>{busy ? "Disconnecting..." : "Yes, Disconnect"}</button></div>
            </section>
          </div>
        )}
      </main>
      <nav>
        {(
          [
            { key: "home", label: "Home", icon: Home },
            { key: "create", label: "Create", icon: Plus },
            { key: "history", label: "History", icon: History },
            { key: "profile", label: "Profile", icon: UserRound },
          ] as const
        ).map((item) => (
          <button
            className={page === item.key ? "active" : ""}
            onClick={() => setPage(item.key)}
            key={item.key}
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
