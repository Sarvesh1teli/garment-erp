import { BulkOrderPanel } from '../../shared/BulkOrderPanel';
import { ConnectionHistory } from '../../shared/ConnectionHistory';
import type { BulkOrder } from '../../shared/bulkOrders';
import type { School as LocalSchool } from '../../shared/types';
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardList, Copy, RefreshCw, School, X } from "lucide-react";
import { useStoredState } from "../../shared/utils";



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

export function SchoolOrdersPage({schools,businessName}:{schools:LocalSchool[];businessName:string}) {
  const [bulkOrders]=useStoredState<BulkOrder[]>('garment-bulk-orders',[]);
  const [productionOrder,setProductionOrder]=useState<Order|null>(null);
  const [code, setCode] = useState("");
  const [links, setLinks] = useState<Link[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderPage,setOrderPage]=useState(1);
  const [orderPageSize,setOrderPageSize]=useState(5);
  const [tab, setTab] = useState<"orders" | "connections" | "connection-history">("orders");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [orderFrom,setOrderFrom] = useState("");
  const [orderTo,setOrderTo] = useState("");
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
  const request = async (path:string,options:RequestInit={}) => {
    if(!window.threadflow?.garmentCloudRequest)throw Error('School connections require the updated desktop app with a private business identity.');
    return window.threadflow.garmentCloudRequest(path,{method:options.method||'GET',body:typeof options.body==='string'?options.body:undefined,businessName});
  };
  const syncLock=useRef(false),syncGeneration=useRef(0),alive=useRef(true);
  const [lastSync,setLastSync]=useState('');
  const sync = async () => {
    if(syncLock.current)return;syncLock.current=true;setBusy(true);const generation=syncGeneration.current;
    const current=()=>alive.current&&generation===syncGeneration.current;
    try {
      const results=await Promise.allSettled([
        request('/api/garment/connection').then(r=>{if(current())setCode(r.data.connectionCode);}),
        request('/api/garment/school-links').then(r=>{if(current())setLinks(r.data||[]);}),
        request('/api/garment/school-orders').then(r=>{if(current())setOrders(r.data||[]);}),
      ]);
      if(current()){
        const failure=results.find(r=>r.status==='rejected');
        if(failure?.status==='rejected')setNotice(failure.reason instanceof Error?failure.reason.message:'Unable to refresh school data.');
        else setLastSync(new Date().toISOString());
      }
    }finally{if(current()){syncLock.current=false;setBusy(false);}}
  };
  useEffect(() => {
    alive.current=true;
    void (async()=>{
      try{const cached=await window.threadflow?.garmentCloudSnapshot?.();if(alive.current&&cached){if(cached.connection)setCode(cached.connection.connectionCode);if(cached.links)setLinks(cached.links);if(cached.orders)setOrders(cached.orders);if(cached.updatedAt)setLastSync(cached.updatedAt);}}catch{}
      if(alive.current)void sync();
    })();
    const timer=setInterval(()=>void sync(),60000);
    return()=>{alive.current=false;syncLock.current=false;syncGeneration.current++;clearInterval(timer);};
  }, []);  const actLink = async (link: Link, action: "approve" | "reject") => {
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
          (!orderFrom || order.orderDate.slice(0,10) >= orderFrom) &&
          (!orderTo || order.orderDate.slice(0,10) <= orderTo) &&
          (!search ||
            `${order.orderNo} ${order.schoolName}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [orders, status, search, orderFrom, orderTo],
  );
  const orderPageCount=Math.max(1,Math.ceil(filtered.length/orderPageSize));
  const safeOrderPage=Math.min(orderPage,orderPageCount);
  const visibleOrders=filtered.slice((safeOrderPage-1)*orderPageSize,safeOrderPage*orderPageSize);
  useEffect(()=>{setOrderPage(1);},[status,search,orderFrom,orderTo,orderPageSize]);
  useEffect(()=>{setOrderPage(page=>Math.min(page,orderPageCount));},[orderPageCount]);
  const submitted = orders.filter(
      (order) => order.status === "SUBMITTED",
    ).length,
    accepted = orders.filter((order) => order.status === "ACCEPTED").length,
    rejected = orders.filter((order) => order.status === "REJECTED").length;
  return (
    <section className="content garment-school-orders">
      <div className="school-order-toolbar">
        <details className="garment-business-manager"><summary>Manage Connection</summary><div className="garment-business-actions"><button className="outline" onClick={async()=>{try{if(await window.threadflow?.exportGarmentBusiness())setNotice('Private business link file saved. Keep it secret; use only on another computer belonging to this business.');}catch(e){setNotice(e instanceof Error?e.message:'Export failed');}}}>Link another computer: Export</button><button className="outline" onClick={async()=>{try{if(await window.threadflow?.importGarmentBusiness()){syncGeneration.current++;syncLock.current=false;setLastSync('');setCode('');setOrders([]);setLinks([]);setSelected(null);setProductionOrder(null);await sync();}}catch(e){setNotice(e instanceof Error?e.message:'Link failed');}}}>Use existing business: Import</button>{window.threadflow?.resetGarmentBusiness&&<button className="outline" disabled={busy} onClick={async()=>{setBusy(true);try{if(await window.threadflow?.resetGarmentBusiness?.(businessName)){syncGeneration.current++;syncLock.current=false;setLastSync('');setCode('');setOrders([]);setLinks([]);setSelected(null);setProductionOrder(null);setNotice('Old identity backed up. Connecting with the new identity. Once the ID appears, use Export to save its private business link.');await sync();}}catch(e){setNotice(e instanceof Error?e.message:'Connection reset failed');}finally{setBusy(false);}}}>Reset Connection</button>}</div></details>
        <div className="garment-code">
          <span>GARMENT CONNECTION ID</span>
          <strong>{code || "Loading..."}</strong>
          <button className="outline connection-copy" disabled={!code} onClick={async()=>{try{await navigator.clipboard.writeText(code);setNotice("Connection ID copied.");}catch{setNotice("Unable to copy. Select and copy the connection ID.");}}}
          >
            <Copy /> Copy
          </button>
        </div>
      </div>
      <p className="school-sync-status" role="status">{busy?"Refreshing in the background…":lastSync?`Last updated ${new Date(lastSync).toLocaleString("en-IN")}`:"Connecting to your garment business…"}</p>
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
        <button className={tab==='connection-history'?'active':''} onClick={()=>setTab('connection-history')}><ClipboardList/><span>Connection History</span></button>
      </div>
      {tab === "connection-history" && <><button className="outline" onClick={()=>setTab('connections')}>Back to School Connections</button><ConnectionHistory request={request}/></>}
      {tab === "orders" && (
        <>
          <div className="metrics school-order-summary">
            <div className="metric summary-new">
              <div>
                <span>New Orders</span>
                <strong>{submitted}</strong>
                <small>waiting for review</small>
              </div>
            </div>
            <div className="metric summary-accepted">
              <div>
                <span>Accepted</span>
                <strong>{accepted}</strong>
                <small>acknowledged</small>
              </div>
            </div>
            <div className="metric summary-rejected">
              <div>
                <span>Rejected</span>
                <strong>{rejected}</strong>
                <small>with reason</small>
              </div>
            </div>
            <div className="metric summary-total">
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
            <label>From date<input type="date" value={orderFrom} max={orderTo||undefined} onChange={e=>setOrderFrom(e.target.value)}/></label>
            <label>To date<input type="date" value={orderTo} min={orderFrom||undefined} onChange={e=>setOrderTo(e.target.value)}/></label>
            <button className="outline" onClick={()=>{setOrderFrom("");setOrderTo("");setSearch("");setStatus("ALL");}}>Clear Filters</button>
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
                {visibleOrders.map((order) => (
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
            <div className="table-footer paginated-footer"><span>Showing {filtered.length?(safeOrderPage-1)*orderPageSize+1:0}–{Math.min(safeOrderPage*orderPageSize,filtered.length)} of {filtered.length} orders</span><div className="pager"><label>Rows<select aria-label="School orders rows per page" value={orderPageSize} onChange={e=>setOrderPageSize(Number(e.target.value))}>{[5,10,20,50].map(size=><option key={size} value={size}>{size}</option>)}</select></label><button className="outline" disabled={safeOrderPage===1} onClick={()=>setOrderPage(page=>Math.max(1,page-1))}>Prev</button><span>Page {safeOrderPage} / {orderPageCount}</span><button className="outline" disabled={safeOrderPage===orderPageCount} onClick={()=>setOrderPage(page=>Math.min(orderPageCount,page+1))}>Next</button></div></div>
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
                      <div className="connection-request-actions">
                        <button
                          className="connection-action connection-action-approve"
                          onClick={() => actLink(link, "approve")}
                        >
                          <Check size={15} aria-hidden="true" /><span>Approve</span>
                        </button>
                        <button
                          className="connection-action connection-action-reject"
                          onClick={() => actLink(link, "reject")}
                        >
                          <X size={15} aria-hidden="true" /><span>Reject</span>
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
            {selected.status!=='DRAFT'&&<div className="form-actions"><button className="outline" disabled={busy} onClick={async()=>{const message=window.prompt('Message to this school about '+selected.orderNo);if(!message?.trim())return;setBusy(true);try{await request(`/api/garment/school-orders/${selected.id}/message`,{method:'POST',signal:AbortSignal.timeout(15000),body:JSON.stringify({message:message.trim()})});setNotice('Message sent to school.');setSelected(null);}catch(e){setNotice(e instanceof Error?e.message:'Unable to send message');}finally{setBusy(false);}}}>Send message to school</button></div>}
            {selected.status!=='REJECTED'&&<div className="form-actions"><button className="primary" disabled={bulkOrders.some(o=>o.sourceOrderId===selected.id)} onClick={()=>setProductionOrder(selected)}>{bulkOrders.some(o=>o.sourceOrderId===selected.id)?'Added to Production':selected.status==='SUBMITTED'?'Accept & Add to Production':'Add to Production'}</button></div>}
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
      {productionOrder&&<div className="stock-modal-overlay"><article className="card bulk-import-modal"><button className="outline" onClick={()=>setProductionOrder(null)}>Close</button><BulkOrderPanel schools={schools} source={{id:productionOrder.id,reference:productionOrder.orderNo,school:productionOrder.schoolName,requiredDate:productionOrder.requiredDate,lines:productionOrder.items.map(r=>({gender:'',garment:r.garmentType,size:r.size,quantity:r.quantity}))}} onBeforeSave={async()=>{if(productionOrder.status==='SUBMITTED'){await request(`/api/garment/school-orders/${productionOrder.id}/accept`,{method:'POST',signal:AbortSignal.timeout(15000),body:JSON.stringify({remark:'Accepted for production.',performedBy:'Garment Admin'})});setOrders(rows=>rows.map(o=>o.id===productionOrder.id?{...o,status:'ACCEPTED'}:o));}}} onSaved={()=>{setNotice(`Order ${productionOrder.orderNo} added to production.`);setProductionOrder(null);setSelected(null);}}/></article></div>}
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
