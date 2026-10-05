import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardList, Copy, RefreshCw, School, X } from "lucide-react";
import { getStoredTenantId } from "../../shared/utils";

const SCHOOL_ORDER_CLOUD_URL = "https://garment.telicampus.in";

type Link = {
  id: string;
  status: string;
  schoolId: string;
  schoolName: string;
  email: string;
  mobile: string;
  requestedAt: string;
  rejectionReason?: string;
};
type Order = {
  id: string;
  orderNo: string;
  schoolName: string;
  orderDate: string;
  requiredDate?: string;
  notes: string;
  status: string;
  totalQuantity: number;
  items: { garmentType: string; size: string; quantity: number }[];
  garmentRemark?: string;
  rejectionReason?: string;
};
const showDate = (value?: string) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN")
    : "-";

export function SchoolOrdersPage() {
  const [code, setCode] = useState("");
  const [links, setLinks] = useState<Link[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"orders" | "connections">("orders");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [orderAction, setOrderAction] = useState<{
    order: Order;
    action: "accept" | "reject";
  } | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const actionAbort = useRef<AbortController | null>(null);
  const headers = () => ({
    "Content-Type": "application/json",
    "X-Tenant-ID": getStoredTenantId(),
  });
  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${SCHOOL_ORDER_CLOUD_URL}${path}`, {
        ...options,
        headers: { ...headers(), ...(options.headers || {}) },
      }),
      body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Request failed");
    return body;
  };
  const sync = async () => {
    setBusy(true);
    try {
      const [connection, linkList, orderList] = await Promise.all([
        request("/api/garment/connection"),
        request("/api/garment/school-links"),
        request("/api/garment/school-orders"),
      ]);
      setCode(connection.data.connectionCode);
      setLinks(linkList.data || []);
      setOrders(orderList.data || []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to sync school orders",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    sync();
    const timer = setInterval(sync, 60000);
    return () => clearInterval(timer);
  }, []);
  const actLink = async (link: Link, action: "approve" | "reject") => {
    const reason =
      action === "reject"
        ? window.prompt(`Reason for rejecting ${link.schoolName}:`, "")
        : "";
    if (action === "reject" && !reason) return;
    await request(`/api/garment/school-links/${link.id}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setNotice(
      action === "approve"
        ? `${link.schoolName} connected successfully.`
        : "Connection request rejected.",
    );
    sync();
  };
  const openOrderAction = (order: Order, action: "accept" | "reject") => {
    setOrderAction({ order, action });
    setActionMessage(action === "accept" ? "Order received and accepted." : "");
    setActionError("");
  };
  const closeOrderAction = () => {
    actionAbort.current?.abort();
    actionAbort.current = null;
    setBusy(false);
    setActionError("");
    setOrderAction(null);
  };
  const actOrder = async () => {
    if (!orderAction) return;
    const { order, action } = orderAction;
    if (action === "reject" && !actionMessage.trim()) {
      setActionError("Please enter a reason for rejecting this order.");
      return;
    }
    setBusy(true);
    setNotice("");
    setActionError("");
    const controller = new AbortController();
    actionAbort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      await request(`/api/garment/school-orders/${order.id}/${action}`, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify(
          action === "accept"
            ? { remark: actionMessage.trim(), performedBy: "Garment Admin" }
            : { reason: actionMessage.trim(), performedBy: "Garment Admin" },
        ),
      });
      setNotice(
        action === "accept"
          ? `Order ${order.orderNo} accepted successfully.`
          : `Order ${order.orderNo} rejected successfully.`,
      );
      window.clearTimeout(timeout);
      actionAbort.current = null;
      setOrderAction(null);
      setSelected(null);
      await sync();
    } catch (error) {
      setActionError(
        error instanceof DOMException && error.name === "AbortError"
          ? "The request took too long or was cancelled. Please check the connection and try again."
          : error instanceof Error
            ? error.message
            : "Unable to update order",
      );
    } finally {
      window.clearTimeout(timeout);
      actionAbort.current = null;
      setBusy(false);
    }
  };
  const filtered = useMemo(
    () =>
      orders.filter(
        (order) =>
          (status === "ALL" || order.status === status) &&
          (!search ||
            `${order.orderNo} ${order.schoolName}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [orders, status, search],
  );
  const submitted = orders.filter(
      (order) => order.status === "SUBMITTED",
    ).length,
    accepted = orders.filter((order) => order.status === "ACCEPTED").length,
    rejected = orders.filter((order) => order.status === "REJECTED").length;
  return (
    <section className="content garment-school-orders">
      <div className="school-order-toolbar">
        <div className="garment-code">
          <span>GARMENT CONNECTION ID</span>
          <strong>{code || "Loading..."}</strong>
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setNotice("Connection ID copied.");
            }}
          >
            <Copy /> Copy
          </button>
        </div>
      </div>
      {notice && (
        <div className="school-notice closable">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <div className="measurement-tabs wage-tabs">
        <button
          className={tab === "orders" ? "active" : ""}
          onClick={() => setTab("orders")}
        >
          <ClipboardList />
          <span>
            School Orders<small>{submitted} new submitted</small>
          </span>
        </button>
        <button
          className={tab === "connections" ? "active" : ""}
          onClick={() => setTab("connections")}
        >
          <School />
          <span>
            School Connections
            <small>
              {links.filter((link) => link.status === "PENDING").length}{" "}
              requests
            </small>
          </span>
        </button>
      </div>
      {tab === "orders" && (
        <>
          <div className="metrics">
            <div className="metric">
              <div>
                <span>New Orders</span>
                <strong>{submitted}</strong>
                <small>waiting for review</small>
              </div>
            </div>
            <div className="metric">
              <div>
                <span>Accepted</span>
                <strong>{accepted}</strong>
                <small>acknowledged</small>
              </div>
            </div>
            <div className="metric">
              <div>
                <span>Rejected</span>
                <strong>{rejected}</strong>
                <small>with reason</small>
              </div>
            </div>
            <div className="metric">
              <div>
                <span>Total Orders</span>
                <strong>{orders.length}</strong>
                <small>permanent history</small>
              </div>
            </div>
          </div>
          <div className="filterbar">
            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order number / school"
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option>SUBMITTED</option>
                <option>ACCEPTED</option>
                <option>REJECTED</option>
              </select>
            </label>
            <button className="outline" onClick={sync}>
              <RefreshCw /> {busy ? "Syncing..." : "Sync Now"}
            </button>
          </div>
          <article className="card jobs module-table">
            <table>
              <thead>
                <tr>
                  <th>ORDER NO</th>
                  <th>SCHOOL</th>
                  <th>ORDER DATE</th>
                  <th>REQUIRED DATE</th>
                  <th>ORDER DETAILS</th>
                  <th>TOTAL QTY</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNo}</strong>
                    </td>
                    <td>{order.schoolName}</td>
                    <td>{showDate(order.orderDate)}</td>
                    <td>{showDate(order.requiredDate)}</td>
                    <td>
                      {order.items.slice(0, 3).map((item, index) => (
                        <div key={index}>
                          {item.garmentType} ({item.size}) × {item.quantity}
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <small>+{order.items.length - 3} more</small>
                      )}
                    </td>
                    <td>
                      <strong>{order.totalQuantity}</strong>
                    </td>
                    <td>
                      <span
                        className={`status ${order.status === "ACCEPTED" ? "completed" : order.status === "REJECTED" ? "left" : "pending"}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="outline mini-action"
                        onClick={() => setSelected(order)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      No school orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </article>
        </>
      )}
      {tab === "connections" && (
        <article className="card jobs module-table">
          <div className="cardhead">
            <div>
              <h2>School connection requests</h2>
              <p>Approve a school before it can submit garment orders.</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>SCHOOL</th>
                <th>EMAIL</th>
                <th>MOBILE</th>
                <th>REQUESTED</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <strong>{link.schoolName}</strong>
                  </td>
                  <td>{link.email}</td>
                  <td>{link.mobile || "-"}</td>
                  <td>{showDate(link.requestedAt)}</td>
                  <td>
                    <span
                      className={`status ${link.status === "APPROVED" ? "completed" : link.status === "REJECTED" ? "left" : "pending"}`}
                    >
                      {link.status}
                    </span>
                  </td>
                  <td>
                    {link.status === "PENDING" ? (
                      <div className="row-actions">
                        <button
                          className="save-btn"
                          onClick={() => actLink(link, "approve")}
                        >
                          <Check /> Approve
                        </button>
                        <button
                          className="danger-btn"
                          onClick={() => actLink(link, "reject")}
                        >
                          <X /> Reject
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {!links.length && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No school connection requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      )}
      {selected && (
        <div className="stock-modal-overlay" onClick={() => setSelected(null)}>
          <article
            className="card measurement-form stock-modal school-order-detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-title">
              <div>
                <h2>{selected.orderNo}</h2>
                <p>
                  {selected.schoolName} · {selected.status}
                </p>
              </div>
              <button className="outline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="detail-grid">
              <div>
                <span>Order Date</span>
                <strong>{showDate(selected.orderDate)}</strong>
              </div>
              <div>
                <span>Required Date</span>
                <strong>{showDate(selected.requiredDate)}</strong>
              </div>
              <div>
                <span>Total Quantity</span>
                <strong>{selected.totalQuantity}</strong>
              </div>
              <div>
                <span>School Notes</span>
                <strong>{selected.notes || "-"}</strong>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>GARMENT TYPE</th>
                  <th>SIZE</th>
                  <th>QUANTITY</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.garmentType}</td>
                    <td>{item.size}</td>
                    <td>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selected.garmentRemark && (
              <div className="school-ack">
                <b>Acknowledgement</b>
                {selected.garmentRemark}
              </div>
            )}
            {selected.rejectionReason && (
              <div className="school-reject">
                <b>Rejection reason</b>
                {selected.rejectionReason}
              </div>
            )}
            {selected.status === "SUBMITTED" && (
              <div className="form-actions">
                <button
                  className="danger-btn"
                  onClick={() => openOrderAction(selected, "reject")}
                >
                  <X /> Reject Order
                </button>
                <button
                  className="primary"
                  onClick={() => openOrderAction(selected, "accept")}
                >
                  <Check /> Accept Order
                </button>
              </div>
            )}
          </article>
        </div>
      )}
      {orderAction && (
        <div className="order-confirm-overlay" onClick={closeOrderAction}>
          <article className={`order-confirm-card ${orderAction.action}`} onClick={(event) => event.stopPropagation()}>
            <div className="order-confirm-icon">{orderAction.action === "accept" ? <Check /> : <X />}</div>
            <div className="order-confirm-copy">
              <span>{orderAction.action === "accept" ? "ACCEPT ORDER" : "REJECT ORDER"}</span>
              <h2>{orderAction.order.orderNo}</h2>
              <p>{orderAction.action === "accept" ? `Confirm that you want to accept this order from ${orderAction.order.schoolName}.` : `Confirm that you want to reject this order from ${orderAction.order.schoolName}.`}</p>
            </div>
            <div className="order-confirm-summary"><span>School<strong>{orderAction.order.schoolName}</strong></span><span>Total quantity<strong>{orderAction.order.totalQuantity} pcs</strong></span></div>
            <label>{orderAction.action === "accept" ? "Acknowledgement message (optional)" : "Rejection reason (required)"}<textarea autoFocus value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} placeholder={orderAction.action === "accept" ? "Message visible to the school" : "Explain why this order is being rejected"} /></label>
            {actionError && <div className="order-confirm-error">{actionError}</div>}
            <div className="order-confirm-actions"><button className="outline" onClick={closeOrderAction}>{busy ? "Cancel Request" : "Cancel"}</button><button className={orderAction.action === "accept" ? "primary" : "danger-btn"} disabled={busy} onClick={actOrder}>{busy ? "Updating order..." : orderAction.action === "accept" ? "Yes, Accept Order" : "Yes, Reject Order"}</button></div>
          </article>
        </div>
      )}
    </section>
  );
}
