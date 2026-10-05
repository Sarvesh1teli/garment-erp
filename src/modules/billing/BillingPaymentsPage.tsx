import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Eye, MessageCircle, Pencil, Plus, Printer, ReceiptText, RotateCcw, Save, Send, Trash2, Users } from 'lucide-react';
import type { CompanySettings } from '../settings/SettingsPage';
import type { Invoice, InvoiceItem, InvoicePayment, School, StockSale, Student } from '../../shared/types';
import { CompanyPrintHeader, GarmentPrintHeader, PrintPreview, Stats, Table } from '../../shared/ui';
import { money, useStoredState } from '../../shared/utils';
import { openWhatsApp, formatInvoiceWhatsAppMessage, formatPaymentReceiptWhatsAppMessage } from '../../shared/whatsapp';

type Props={company:CompanySettings;customers:string[][];schools:School[];students:Student[]};
type Tab='invoices'|'create'|'payments'|'school';

const today=()=>new Date().toISOString().slice(0,10);
const getAcademicYearFromDate=(dateStr?:string)=>{
  if(!dateStr)return '';
  const d=new Date(dateStr);
  if(Number.isNaN(d.getTime()))return '';
  const y=d.getFullYear();
  return d.getMonth()>=3?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;
};
const emptyInvoice=(customers:string[][]):Invoice=>{const first=customers.find(c=>(c[5]||'Active')==='Active')||customers[0];return {invoiceNo:'',invoiceDate:today(),dueDate:'',state:'',reverseCharge:'NO',customer:first?.[1]||'',customerPhone:first?.[3]||'',customerGst:'',customerAddress:first?.[4]||'',shipTo:first?.[1]||'',shipAddress:first?.[4]||'',shipGst:'',product:'',hsn:'',qty:0,unit:'PCS',rate:0,cgst:0,sgst:0,taxableAmount:0,totalAmount:0,status:'Pending',terms:'This is an electronically generated document. All disputes are subject to local jurisdiction.'}};

function numberToWords(num: number): string {
  if (!num || num <= 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)];
        if (n % 10 > 0) str += ' ' + a[n % 10];
      }
    }
    return str.trim();
  };

  const rounded = Math.round(num);
  return `${inWords(rounded)} Rupees Only`;
}

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const numA = parseFloat(a.replace(/[^\d.]/g, ''));
    const numB = parseFloat(b.replace(/[^\d.]/g, ''));
    const hasNumA = !isNaN(numA) && /\d/.test(a);
    const hasNumB = !isNaN(numB) && /\d/.test(b);
    if (hasNumA && hasNumB) {
      if (numA !== numB) return numA - numB;
    }
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];
    const idxA = order.indexOf(a.toUpperCase());
    const idxB = order.indexOf(b.toUpperCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function extractInvoiceItems(invoice: Invoice, allSales?: StockSale[]): InvoiceItem[] {
  if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
    return invoice.items;
  }

  let sales = allSales;
  if (!sales || sales.length === 0) {
    try {
      const raw = localStorage.getItem('garment-stock-sales');
      if (raw) sales = JSON.parse(raw) as StockSale[];
    } catch {
      sales = [];
    }
  }

  if (sales && sales.length > 0) {
    const matched = sales.filter(s => s.invoiceNo && s.invoiceNo.trim() === invoice.invoiceNo.trim());
    if (matched.length > 0) {
      const itemsList: InvoiceItem[] = [];
      matched.forEach(s => {
        if (s.items && s.items.length > 0) {
          itemsList.push(...s.items);
        } else {
          itemsList.push({
            garment: s.garment,
            size: s.size,
            qty: s.count,
            rate: s.rate,
            amount: s.total || s.count * s.rate,
            gender: s.gender
          });
        }
      });
      if (itemsList.length > 0) return itemsList;
    }
  }

  if (invoice.product && typeof invoice.product === 'string') {
    const regex = /([^,()]+)\s*\(([^)]+)\)\s*[×x*]\s*(\d+)/g;
    const parsed: InvoiceItem[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(invoice.product)) !== null) {
      const garment = match[1].trim();
      const size = match[2].trim();
      const qty = parseInt(match[3], 10) || 0;
      if (qty > 0) {
        const approxRate = invoice.qty > 0 && invoice.taxableAmount > 0
          ? Math.round(invoice.taxableAmount / invoice.qty)
          : (invoice.rate || 0);
        parsed.push({
          garment,
          size,
          qty,
          rate: approxRate,
          amount: qty * approxRate
        });
      }
    }
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
}

export function InvoiceDocument({invoice,company,garment,sales}:{invoice:Invoice;company:CompanySettings;garment?:boolean;sales?:StockSale[]}){
  const cgst=invoice.taxableAmount*invoice.cgst/100,sgst=invoice.taxableAmount*invoice.sgst/100;
  const garmentName=(invoice.product||'').replace(/\s*\([^)]*\)\s*$/,'');
  const items = extractInvoiceItems(invoice, sales);
  const gstPercent = invoice.gstPercent !== undefined ? invoice.gstPercent : ((invoice.cgst || 0) + (invoice.sgst || 0));

  const garmentGroups = items.reduce<Record<string, InvoiceItem[]>>((acc, item) => {
    if (!item.qty || item.qty <= 0) return acc;
    const g = item.garment.trim();
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  const garmentNames = Object.keys(garmentGroups);

  return (
    <div className="tax-doc">
      {garment?<GarmentPrintHeader company={company} garment={garmentName}/>:<CompanyPrintHeader company={company}/>}
      <h1>TAX INVOICE</h1>
      <div className="doc-meta">
        <div><b>Invoice Number</b><span>{invoice.invoiceNo}</span></div>
        <div><b>Invoice Date</b><span>{invoice.invoiceDate}</span></div>
        <div><b>Due Date</b><span>{invoice.dueDate||'-'}</span></div>
        <div><b>State</b><span>{invoice.state||'-'}</span></div>
        <div><b>Status</b><span>{invoice.status}</span></div>
      </div>
      <div className="doc-parties">
        <div>
          <h3>Details of Receiver | Billed to</h3>
          <p><b>Name:</b> {invoice.customer}</p>
          <p><b>Address:</b> {invoice.customerAddress}</p>
          <p><b>Mobile:</b> {invoice.customerPhone}</p>
          <p><b>GSTIN:</b> {invoice.customerGst}</p>
        </div>
        <div>
          <h3>Details of Consignee | Shipped to</h3>
          <p><b>Name:</b> {invoice.shipTo}</p>
          <p><b>Address:</b> {invoice.shipAddress}</p>
          <p><b>GSTIN:</b> {invoice.shipGst}</p>
          <p><b>Reverse charge:</b> {invoice.reverseCharge}</p>
        </div>
      </div>

      {garmentNames.length > 0 ? (
        <div className="doc-garment-breakdowns" style={{ padding: '8px 12px' }}>
          {garmentNames.map((gName, gIdx) => {
            const rawItems = garmentGroups[gName];
            const sizeMap: Record<string, { qty: number; rate: number; amount: number }> = {};
            rawItems.forEach(it => {
              const sz = it.size.trim();
              if (!sizeMap[sz]) {
                sizeMap[sz] = { qty: 0, rate: it.rate, amount: 0 };
              }
              sizeMap[sz].qty += it.qty;
              sizeMap[sz].amount += (it.amount || (it.qty * it.rate));
              if (it.rate > 0) sizeMap[sz].rate = it.rate;
            });

            // Display ONLY sizes where Qty > 0
            const activeSizes = sortSizes(Object.keys(sizeMap).filter(sz => sizeMap[sz].qty > 0));
            const totalGarmentQty = activeSizes.reduce((sum, sz) => sum + sizeMap[sz].qty, 0);
            const totalGarmentAmount = activeSizes.reduce((sum, sz) => sum + sizeMap[sz].amount, 0);
            const totalGarmentWithGst = Math.round((totalGarmentAmount + (totalGarmentAmount * gstPercent / 100)) * 100) / 100;

            return (
              <div key={gName} style={{ marginBottom: gIdx < garmentNames.length - 1 ? 16 : 10, pageBreakInside: 'avoid' }}>
                <div style={{ background: '#f1f5f9', padding: '6px 10px', border: '1.5px solid #0f172a', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px' }}>
                    👔 {gName}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 11, color: '#334155' }}>
                    Total: <strong style={{ color: '#0284c7' }}>{totalGarmentQty} Pcs</strong> • Subtotal: <strong>{money(totalGarmentAmount)}</strong>
                  </span>
                </div>
                <table className="doc-table matrix-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 130, textAlign: 'left', fontWeight: 800, background: '#e2e8f0', color: '#0f172a' }}>Size</th>
                      {activeSizes.map(sz => (
                        <th key={sz} style={{ textAlign: 'center', fontWeight: 800, background: '#f1f5f9', color: '#0f172a' }}>{sz}</th>
                      ))}
                      <th style={{ width: 95, textAlign: 'right', fontWeight: 800, background: '#e2e8f0', color: '#0f172a' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, textAlign: 'left', background: '#f8fafc' }}>Qty</td>
                      {activeSizes.map(sz => (
                        <td key={sz} style={{ textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{sizeMap[sz].qty}</td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#0284c7', background: '#f1f5f9' }}>{totalGarmentQty}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, textAlign: 'left', background: '#f8fafc' }}>Rate</td>
                      {activeSizes.map(sz => (
                        <td key={sz} style={{ textAlign: 'center' }}>₹{sizeMap[sz].rate.toLocaleString('en-IN')}</td>
                      ))}
                      <td style={{ textAlign: 'right', background: '#f1f5f9', color: '#64748b' }}>-</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, textAlign: 'left', background: '#f8fafc' }}>Amount</td>
                      {activeSizes.map(sz => (
                        <td key={sz} style={{ textAlign: 'center', fontWeight: 700 }}>₹{sizeMap[sz].amount.toLocaleString('en-IN')}</td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 800, background: '#f1f5f9' }}>₹{totalGarmentAmount.toLocaleString('en-IN')}</td>
                    </tr>
                    {gstPercent > 0 && (
                      <tr style={{ background: '#f0fdf4' }}>
                        <td style={{ fontWeight: 700, textAlign: 'left', color: '#166534' }}>with GST %{gstPercent}</td>
                        {activeSizes.map(sz => {
                          const baseAmt = sizeMap[sz].amount;
                          const withGstAmt = Math.round((baseAmt + (baseAmt * gstPercent / 100)) * 100) / 100;
                          return (
                            <td key={sz} style={{ textAlign: 'center', fontWeight: 700, color: '#166534' }}>
                              ₹{withGstAmt.toLocaleString('en-IN')}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#166534', background: '#dcfce7' }}>
                          ₹{totalGarmentWithGst.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="doc-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', border: '1.5px solid #0f172a', marginTop: 10 }}>
            <div style={{ padding: '10px 14px', borderRight: '1.5px solid #0f172a', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <b style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount in Words:</b>
                <p style={{ margin: '4px 0 0', fontWeight: 800, fontSize: 12, color: '#0f172a' }}>
                  {numberToWords(invoice.totalAmount)}
                </p>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>
                Total Garment Types: <strong>{garmentNames.length}</strong> • Total Items Delivered: <strong>{invoice.qty} Pcs</strong>
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#475569' }}>Total Quantity:</span>
                <strong style={{ color: '#0f172a' }}>{invoice.qty} Pcs</strong>
              </div>
              {Boolean(invoice.discount && invoice.discount > 0) && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#475569' }}>Gross Subtotal:</span>
                    <strong style={{ color: '#0f172a' }}>₹{Number(invoice.grossAmount || ((invoice.taxableAmount || 0) + (invoice.discount || 0))).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #e2e8f0', color: '#dc2626' }}>
                    <span>Bill Discount:</span>
                    <strong>- ₹{Number(invoice.discount).toLocaleString('en-IN')}</strong>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#475569' }}>Taxable Amount:</span>
                <strong style={{ color: '#0f172a' }}>₹{Number(invoice.taxableAmount || 0).toLocaleString('en-IN')}</strong>
              </div>
              {gstPercent > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#475569' }}>CGST ({gstPercent / 2}%):</span>
                    <strong style={{ color: '#475569' }}>₹{Number(cgst).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#475569' }}>SGST ({gstPercent / 2}%):</span>
                    <strong style={{ color: '#475569' }}>₹{Number(sgst).toLocaleString('en-IN')}</strong>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 2px', fontSize: 14, fontWeight: 800, color: '#0284c7' }}>
                <span>Final Grand Total:</span>
                <span>₹{Number(invoice.totalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <table className="doc-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>HSN</th>
              <th>QTY</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Taxable</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.product}</td>
              <td>{invoice.hsn}</td>
              <td>{invoice.qty}</td>
              <td>{invoice.unit}</td>
              <td>{money(invoice.rate)}</td>
              <td>{money(invoice.taxableAmount)}</td>
              <td>{money(cgst)}</td>
              <td>{money(sgst)}</td>
              <td>{money(invoice.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="doc-footer">
        <div>
          <b>Terms and conditions</b>
          <p>{invoice.terms}</p>
        </div>
        <div>
          <h3>For, {company.name||'Teli Apparels'}</h3>
          <span>Authorized Signatory</span>
        </div>
      </div>
      <div className="doc-invoice-bottom-footer">
        <div className="footer-left">
          <img className="footer-threadflow-logo" src="./threadflow-logo.png" alt="ThreadFlow logo"/>
          <div>
            <span className="powered-text">Powered by <strong>Teli Threadflow garment</strong></span>
            <span className="contact-text">Contact / Support: 9880306309</span>
          </div>
        </div>
        <div className="footer-right">Electronically Generated Invoice</div>
      </div>
    </div>
  );
}

function PaymentDocument({payment,invoice,company}:{payment:InvoicePayment;invoice?:Invoice;company:CompanySettings}){
  return <div className="tax-doc receipt-doc"><CompanyPrintHeader company={company}/><h1>INVOICE PAYMENT RECEIPT</h1><div className="doc-meta"><div><b>Receipt</b><span>{payment.id}</span></div><div><b>Date</b><span>{payment.date}</span></div><div><b>Invoice</b><span>{payment.invoiceNo}</span></div><div><b>Mode</b><span>{payment.mode}</span></div><div><b>Amount</b><span>{money(payment.amount)}</span></div></div><div className="doc-parties single"><div><h3>Customer details</h3><p><b>Customer:</b> {payment.customer}</p><p><b>Reference:</b> {payment.reference||'-'}</p><p><b>Remarks:</b> {payment.remarks||'-'}</p><p><b>Invoice total:</b> {invoice?money(invoice.totalAmount):'-'}</p></div></div><div className="doc-footer"><div><b>Received with thanks</b><p>{money(payment.amount)}</p></div><div><h3>For, {company.name}</h3><span>Authorized Signatory</span></div></div></div>;
}

export function BillingPaymentsPage({company,customers,schools,students,navParams,onNavigate}:Props & {navParams?:Record<string,unknown>|null;onNavigate?:(page:string,params?:Record<string,unknown>)=>void}){
  const [tab,setTab]=useState<Tab>('invoices');
  const [invoices,setInvoices]=useStoredState<Invoice[]>('garment-invoices',[]);
  const [invoiceFilterYear,setInvoiceFilterYear]=useState('All');
  const [invoiceFilterSchool,setInvoiceFilterSchool]=useState('All');
  const [invoiceFilterStatus,setInvoiceFilterStatus]=useState('All');

  useEffect(()=>{
    if(navParams?.tab==='school'){
      setTab('school');
      if(navParams?.school)setSchoolPayment(f=>({...f,school:String(navParams.school)}));
    }
    if(navParams?.fromSchool){
      setInvoiceFilterSchool(String(navParams.fromSchool));
    } else if(navParams?.school && navParams?.tab==='invoices'){
      setInvoiceFilterSchool(String(navParams.school));
    }
  },[navParams]);
  const [payments,setPayments]=useStoredState<InvoicePayment[]>('garment-invoice-payments',[]);
  const [schoolSales]=useStoredState<StockSale[]>('garment-stock-sales',[]);
  const [schoolCollections,setSchoolCollections]=useStoredState<string[][]>('garment-school-collections',[]);
  const [form,setForm]=useState<Invoice>(()=>emptyInvoice(customers));
  const [originalInvoiceNo,setOriginalInvoiceNo]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const [previewInvoice,setPreviewInvoice]=useState<Invoice|null>(null);
  const [viewInvoice,setViewInvoice]=useState<Invoice|null>(null);
  const [paymentPreview,setPaymentPreview]=useState<InvoicePayment|null>(null);
  const [paymentSubTab,setPaymentSubTab]=useState<'record'|'history'>('record');
  const [paymentHistorySchool,setPaymentHistorySchool]=useState('All');
  const [paymentHistoryFrom,setPaymentHistoryFrom]=useState('');
  const [paymentHistoryTo,setPaymentHistoryTo]=useState('');
  const [paymentSchool,setPaymentSchool]=useState('');
  const [paymentForm,setPaymentForm]=useState({invoiceNo:'',date:today(),amount:0,discount:0,mode:'Cash',reference:'',remarks:''});
  const [schoolPayment,setSchoolPayment]=useState({school:'',date:today(),amount:0,settlementDiscount:0,paymentMode:'Cash',receiptNo:'',remarks:''});
  const [collectionAlert,setCollectionAlert]=useState<string[]|null>(null);
  const [openInvoiceAction, setOpenInvoiceAction] = useState<string | null>(null);
  const [invoiceDropdownPos, setInvoiceDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [openPaymentAction,setOpenPaymentAction]=useState<string|null>(null);
  const [paymentDropdownPos,setPaymentDropdownPos]=useState<{top:number;left:number}|null>(null);

  useEffect(()=>{
    if(navParams?.tab!=='invoices')return;
    setTab('invoices');
    if(!navParams?.invoiceNo)return;
    const invoice=invoices.find(item=>item.invoiceNo===String(navParams.invoiceNo));
    if(invoice)setViewInvoice(invoice);
  },[navParams,invoices]);

  useEffect(() => {
    const handleClose = () => {
      setOpenInvoiceAction(null);
      setInvoiceDropdownPos(null);
      setOpenPaymentAction(null);
      setPaymentDropdownPos(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, []);

  const paidFor=(invoiceNo:string)=>payments.filter(p=>p.invoiceNo===invoiceNo).reduce((sum,p)=>sum+p.amount+(p.discount||0),0);
  const pendingTotal=invoices.reduce((sum,invoice)=>sum+Math.max(0,invoice.totalAmount-paidFor(invoice.invoiceNo)),0);
  const paidTotal=payments.reduce((sum,payment)=>sum+payment.amount,0);
  const selectedPaymentInvoice=invoices.find(invoice=>invoice.invoiceNo===paymentForm.invoiceNo);

  const availableInvoiceYears = useMemo(() => {
    const years = new Set<string>();
    invoices.forEach(inv => {
      const yr = getAcademicYearFromDate(inv.invoiceDate);
      if (yr) years.add(yr);
      if (inv.invoiceDate && inv.invoiceDate.length >= 4) {
        years.add(inv.invoiceDate.slice(0, 4));
      }
    });
    const d = new Date();
    const y = d.getFullYear();
    const curAcad = d.getMonth() >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
    years.add(curAcad);
    return Array.from(years).sort().reverse();
  }, [invoices]);

  const invoiceSchoolOptions = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(inv => { if (inv.customer) set.add(inv.customer.trim()); });
    schools.forEach(s => { if (s.name) set.add(s.name.trim()); });
    customers.forEach(c => { if (c[1]) set.add(c[1].trim()); });
    return Array.from(set).filter(Boolean).sort();
  }, [invoices, schools, customers]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (invoiceFilterYear !== 'All') {
        const acad = getAcademicYearFromDate(inv.invoiceDate);
        const cal = inv.invoiceDate ? inv.invoiceDate.slice(0, 4) : '';
        if (acad !== invoiceFilterYear && cal !== invoiceFilterYear && !inv.invoiceDate?.startsWith(invoiceFilterYear)) {
          return false;
        }
      }
      if (invoiceFilterSchool !== 'All') {
        if ((inv.customer || '').trim().toLowerCase() !== invoiceFilterSchool.trim().toLowerCase()) {
          return false;
        }
      }
      if (invoiceFilterStatus !== 'All') {
        const balance = Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo));
        const effectiveStatus = balance > 0 && inv.dueDate && inv.dueDate < today() ? 'Overdue' : inv.status;
        if (effectiveStatus !== invoiceFilterStatus) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, invoiceFilterYear, invoiceFilterSchool, invoiceFilterStatus, payments]);

  const filteredPendingTotal = filteredInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo)), 0);
  const filteredPaidTotal = filteredInvoices.reduce((sum, invoice) => sum + paidFor(invoice.invoiceNo), 0);
  const filteredTotalAmount = filteredInvoices.reduce((sum, item) => sum + item.totalAmount, 0);

  const updateForm=(patch:Partial<Invoice>)=>setForm(current=>{const next={...current,...patch};const taxable=next.qty*next.rate;return{...next,taxableAmount:taxable,totalAmount:taxable+(taxable*next.cgst/100)+(taxable*next.sgst/100)}});
  const pickCustomer=(id:string)=>{const customer=customers.find(item=>item[0]===id);if(customer)updateForm({customer:customer[1],customerPhone:customer[3],customerAddress:customer[4],shipTo:customer[1],shipAddress:customer[4]})};
  const saveInvoice=()=>{
    const number=form.invoiceNo.trim();
    if(!number||!form.customer.trim()||!form.product.trim()||form.qty<=0){setMessage('Invoice number, customer, product and quantity are required.');return}
    if(invoices.some(invoice=>invoice.invoiceNo===number&&invoice.invoiceNo!==originalInvoiceNo)){setMessage('Invoice number already exists.');return}
    const paid=originalInvoiceNo?paidFor(originalInvoiceNo):0;
    const status:Invoice['status']=paid<=0?'Pending':paid>=form.totalAmount?'Paid':'Partially Paid';
    const saved={...form,invoiceNo:number,status};
    setInvoices(current=>[saved,...current.filter(invoice=>invoice.invoiceNo!==originalInvoiceNo&&invoice.invoiceNo!==number)]);
    if(originalInvoiceNo&&originalInvoiceNo!==number)setPayments(current=>current.map(payment=>payment.invoiceNo===originalInvoiceNo?{...payment,invoiceNo:number,customer:saved.customer}:payment));
    setForm(emptyInvoice(customers));setOriginalInvoiceNo(null);setMessage('Invoice saved successfully.');setTab('invoices');
  };
  const editInvoice=(invoice:Invoice)=>{setForm(invoice);setOriginalInvoiceNo(invoice.invoiceNo);setTab('create')};
  const deleteInvoice=(invoice:Invoice)=>{if(payments.some(payment=>payment.invoiceNo===invoice.invoiceNo)){setMessage('Delete invoice payments before deleting this invoice.');return}if(window.confirm(`Delete invoice ${invoice.invoiceNo}?`))setInvoices(current=>current.filter(item=>item.invoiceNo!==invoice.invoiceNo))};
  const [collectionType, setCollectionType] = useState<'invoice' | 'advance'>('invoice');
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string>('all');

  const addPayment=()=>{
    const invoice=selectedPaymentInvoice;
    const amountVal = Number(paymentForm.amount) || 0;
    const discountVal = Number(paymentForm.discount) || 0;
    if(!invoice || (amountVal <= 0 && discountVal <= 0)){
      setMessage('Select an invoice and enter a payment amount or discount.');
      return;
    }
    const balance = Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo));
    if ((amountVal + discountVal) > balance) {
      setMessage(`Payment + Discount cannot exceed balance ${money(balance)}.`);
      return;
    }
    const receiptRef = paymentForm.reference && paymentForm.reference !== '-' ? paymentForm.reference : `COL-${String(schoolCollections.length+1).padStart(3,'0')}`;
    const payment:InvoicePayment = {
      id: `IP-${Date.now()}`,
      date: paymentForm.date,
      invoiceNo: invoice.invoiceNo,
      customer: invoice.customer,
      mode: paymentForm.mode,
      amount: amountVal,
      discount: discountVal,
      reference: receiptRef,
      remarks: paymentForm.remarks || '-'
    };
    const newPaid = paidFor(invoice.invoiceNo) + amountVal + discountVal;
    setPayments(current => [payment, ...current]);
    setInvoices(current => current.map(item => item.invoiceNo === invoice.invoiceNo ? { ...item, status: newPaid >= item.totalAmount ? 'Paid' : 'Partially Paid' } : item));
    
    // Automatically sync with school collections if invoice belongs to a school
    const isSchool = schools.some(s => s.name.trim().toLowerCase() === invoice.customer.trim().toLowerCase());
    if (isSchool && (amountVal > 0 || discountVal > 0)) {
      const discountNote = discountVal > 0 ? ` [Discount: ${money(discountVal)}]` : '';
      const remark = paymentForm.remarks && paymentForm.remarks !== '-' ? `${paymentForm.remarks}${discountNote}` : `Payment for ${invoice.invoiceNo}${discountNote}`;
      setSchoolCollections(current => [[receiptRef, paymentForm.date, invoice.customer, paymentForm.mode, money(amountVal), remark], ...current]);
    }
    
    setPaymentForm({ ...paymentForm, amount: 0, discount: 0, reference: '', remarks: '' });
    setPaymentPreview(payment);
    setMessage('Invoice payment recorded and synced.');
  };
  const deletePayment=(payment:InvoicePayment)=>{
    if(!window.confirm(`Delete payment ${payment.id}?`))return;
    const remaining=paidFor(payment.invoiceNo)-(payment.amount + (payment.discount || 0));
    setPayments(current=>current.filter(item=>item.id!==payment.id));
    setInvoices(current=>current.map(invoice=>invoice.invoiceNo===payment.invoiceNo?{...invoice,status:remaining<=0?'Pending':remaining>=invoice.totalAmount?'Paid':'Partially Paid'}:invoice));
    if(payment.reference && payment.reference !== '-') {
      setSchoolCollections(current => current.filter(r => r[0] !== payment.reference));
    }
  };
  const deleteSchoolCollection = (receiptNo: string) => {
    if (!window.confirm(`Delete school collection receipt ${receiptNo}?`)) return;
    const linkedPayments = payments.filter(p => p.reference === receiptNo);
    if (linkedPayments.length > 0) {
      const linkedInvNos = Array.from(new Set(linkedPayments.map(p => p.invoiceNo)));
      setPayments(current => current.filter(p => p.reference !== receiptNo));
      setInvoices(current => current.map(inv => {
        if (!linkedInvNos.includes(inv.invoiceNo)) return inv;
        const remainingPaid = payments
          .filter(p => p.invoiceNo === inv.invoiceNo && p.reference !== receiptNo)
          .reduce((sum, p) => sum + p.amount + (p.discount || 0), 0);
        return {
          ...inv,
          status: remainingPaid <= 0 ? 'Pending' : remainingPaid >= inv.totalAmount ? 'Paid' : 'Partially Paid'
        };
      }));
    }
    setSchoolCollections(current => current.filter(r => r[0] !== receiptNo));
    setMessage(`Collection receipt ${receiptNo} deleted and invoices updated.`);
    setTimeout(() => setMessage(''), 3000);
  };
  const addSchoolCollection = () => {
    const missing: string[] = [];
    if (!schoolPayment.school.trim()) missing.push('School');
    const receipt = schoolPayment.receiptNo.trim() || `COL-${String(schoolCollections.length + 1).padStart(3, '0')}`;
    const amountToCollect = Number(schoolPayment.amount) || 0;
    const settlementDiscount = Number(schoolPayment.settlementDiscount) || 0;

    if (amountToCollect <= 0 && settlementDiscount <= 0) {
      missing.push('Amount or Settlement Discount');
    }
    if (missing.length) { setCollectionAlert(missing); return; }

    const paymentDate = schoolPayment.date || today();
    const schoolName = schoolPayment.school.trim();
    const mode = schoolPayment.paymentMode;
    let finalRemarks = schoolPayment.remarks?.trim() || '';

    // If Invoice Settlement
    if (collectionType === 'invoice') {
      const pendingSchoolInvoices = invoices
        .filter(inv => inv.customer === schoolName && (inv.totalAmount - paidFor(inv.invoiceNo)) > 0)
        .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));

      if (selectedInvoiceNo && selectedInvoiceNo !== 'all') {
        const targetInv = invoices.find(inv => inv.invoiceNo === selectedInvoiceNo);
        if (targetInv) {
          const invDue = Math.max(0, targetInv.totalAmount - paidFor(targetInv.invoiceNo));
          const totalSettle = amountToCollect + settlementDiscount;
          if (totalSettle > invDue) {
            setMessage(`Total settlement (${money(totalSettle)}) cannot exceed pending balance (${money(invDue)}).`);
            setTimeout(() => setMessage(''), 4000);
            return;
          }
          const payAmt = amountToCollect;
          const discAmt = settlementDiscount;
          const newPayment: InvoicePayment = {
            id: `IP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: paymentDate,
            invoiceNo: targetInv.invoiceNo,
            customer: schoolName,
            mode: mode,
            amount: payAmt,
            discount: discAmt,
            reference: receipt,
            remarks: finalRemarks || (discAmt > 0 ? `Settled via ${receipt} (incl. ${money(discAmt)} discount)` : `Settlement via receipt ${receipt}`)
          };
          const updatedPaid = paidFor(targetInv.invoiceNo) + payAmt + discAmt;
          setPayments(current => [newPayment, ...current]);
          setInvoices(current => current.map(item =>
            item.invoiceNo === targetInv.invoiceNo
              ? { ...item, status: updatedPaid >= item.totalAmount ? 'Paid' : 'Partially Paid' }
              : item
          ));
          if (!finalRemarks) {
            finalRemarks = discAmt > 0
              ? `Payment for ${targetInv.invoiceNo} [Discount: ${money(discAmt)}]`
              : `Payment for ${targetInv.invoiceNo}`;
          }
        }
      } else if (pendingSchoolInvoices.length > 0) {
        let remainingCash = amountToCollect;
        let remainingDisc = settlementDiscount;
        const newPayList: InvoicePayment[] = [];
        const settledInvNos: string[] = [];
        const invoiceStatusUpdates: Record<string, 'Paid' | 'Partially Paid'> = {};

        for (const inv of pendingSchoolInvoices) {
          if (remainingCash <= 0 && remainingDisc <= 0) break;
          const invDue = Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo));
          if (invDue <= 0) continue;

          const allocTotal = Math.min(invDue, remainingCash + remainingDisc);
          const payCash = Math.min(remainingCash, allocTotal);
          const payDisc = allocTotal - payCash;

          if (payCash > 0 || payDisc > 0) {
            newPayList.push({
              id: `IP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              date: paymentDate,
              invoiceNo: inv.invoiceNo,
              customer: schoolName,
              mode: mode,
              amount: payCash,
              discount: payDisc,
              reference: receipt,
              remarks: finalRemarks || (payDisc > 0 ? `Auto-allocated via ${receipt} (incl. ${money(payDisc)} discount)` : `Auto-allocated via receipt ${receipt}`)
            });
            const newTotalPaid = paidFor(inv.invoiceNo) + payCash + payDisc;
            invoiceStatusUpdates[inv.invoiceNo] = newTotalPaid >= inv.totalAmount ? 'Paid' : 'Partially Paid';
            settledInvNos.push(inv.invoiceNo);
            remainingCash -= payCash;
            remainingDisc -= payDisc;
          }
        }

        if (newPayList.length > 0) {
          setPayments(current => [...newPayList, ...current]);
          setInvoices(current => current.map(item =>
            invoiceStatusUpdates[item.invoiceNo]
              ? { ...item, status: invoiceStatusUpdates[item.invoiceNo] }
              : item
          ));
          if (!finalRemarks) {
            const discNote = settlementDiscount > 0 ? ` [Total Discount: ${money(settlementDiscount)}]` : '';
            finalRemarks = `Payment for ${settledInvNos.join(', ')}${discNote}`;
          }
        }
      }
    } else {
      if (!finalRemarks) {
        finalRemarks = 'Advance payment / General deposit';
      }
    }

    setSchoolCollections(current => [
      [receipt, paymentDate, schoolName, mode, money(amountToCollect), finalRemarks],
      ...current
    ]);

    setSchoolPayment({
      school: schoolPayment.school,
      date: today(),
      amount: 0,
      settlementDiscount: 0,
      paymentMode: 'Cash',
      receiptNo: `COL-${String(schoolCollections.length + 2).padStart(3, '0')}`,
      remarks: ''
    });
    setSelectedInvoiceNo('all');
    const msgDiscount = settlementDiscount > 0 ? ` (Settlement Discount: ${money(settlementDiscount)})` : '';
    setMessage(`Recorded collection receipt ${receipt} (${money(amountToCollect)})${msgDiscount} for ${schoolName}.`);
    setTimeout(() => setMessage(''), 4000);
  };

  const invoiceRows=filteredInvoices.map(invoice=>{const balance=Math.max(0,invoice.totalAmount-paidFor(invoice.invoiceNo));const status=balance>0&&invoice.dueDate&&invoice.dueDate<today()?'Overdue':invoice.status;return[invoice.invoiceNo,invoice.invoiceDate,invoice.customer,invoice.product,String(invoice.qty),money(invoice.totalAmount),money(paidFor(invoice.invoiceNo)),money(balance),status]});
  const paymentRows=payments.map(payment=>[payment.id,payment.date,payment.invoiceNo,payment.customer,payment.mode,money(payment.amount),payment.discount?money(payment.discount):'-',payment.reference,payment.remarks]);
  const paymentHistorySchools=Array.from(new Set(payments.map(payment=>payment.customer).filter(Boolean))).sort();
  const filteredPaymentRows=payments.filter(payment=>{
    if(paymentHistorySchool!=='All'&&payment.customer!==paymentHistorySchool)return false;
    if(paymentHistoryFrom&&payment.date<paymentHistoryFrom)return false;
    if(paymentHistoryTo&&payment.date>paymentHistoryTo)return false;
    return true;
  }).map(payment=>[payment.id,payment.date,payment.invoiceNo,payment.customer,payment.mode,money(payment.amount),payment.discount?money(payment.discount):'-',payment.reference,payment.remarks]);
  const schoolRows=schoolCollections;
  const schoolTotal=schoolCollections.reduce((sum,row)=>sum+Number((row[4].match(/\d[\d,]*(?:\.\d+)?/)?.[0]||'0').replace(/,/g,'')),0);
  const activeSchools=schools.filter(s=>s.status==='Active');
  const activeCustomers=customers.filter(c=>(c[5]||'Active')==='Active');
  const schoolOptions=(()=>{const list=[...activeSchools];if(schoolPayment.school&&!list.some(s=>s.name===schoolPayment.school)){const s=schools.find(x=>x.name===schoolPayment.school);if(s)list.push(s)}return list.map(school=><option key={school.id} value={school.name}>{school.name}</option>)})();
  const invoiceCustomerOptions=(()=>{const list=[...activeCustomers];if(form.customer&&!list.some(c=>c[1]===form.customer)){const c=customers.find(x=>x[1]===form.customer);if(c)list.push(c)}return list.map(c=><option key={c[0]} value={c[0]}>{c[1]}</option>)})();
  const studentCount=useMemo(()=>students.filter(student=>student.school===schoolPayment.school).length,[students,schoolPayment.school]);

  return <section className="content billing-page">{message&&<div className="toast"><span className="toast-dot"/>{message}</div>}
    {Boolean(navParams?.fromSchool) && onNavigate && (
      <div className="return-to-school-bar" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',background:'#e5f1ed',border:'2px solid #007c68',borderRadius:'10px',marginBottom:'16px'}}>
        <span style={{font:'600 14px Manrope',color:'#123d35',display:'flex',alignItems:'center',gap:8}}>
          📍 Working on collections for <strong>{String(navParams?.fromSchool)}</strong>
        </span>
        <button className="primary" style={{display:'flex',alignItems:'center',gap:6,fontSize:13,padding:'8px 16px',borderRadius:8}} onClick={()=>onNavigate(String(navParams?.fromPage || 'Customers & Schools'),{openSchool:String(navParams?.fromSchool)})}>
          <ArrowLeft size={16}/> Back to {String(navParams?.fromSchool)} Dashboard
        </button>
      </div>
    )}<div className="measurement-tabs wage-tabs"><button className={tab==='invoices'?'active':''} onClick={()=>setTab('invoices')}><ReceiptText size={16}/><span>Invoices<small>{invoices.length} records</small></span></button><button className={tab==='create'?'active':''} onClick={()=>{setForm(emptyInvoice(customers));setOriginalInvoiceNo(null);setTab('create')}}><Plus size={16}/><span>Create Invoice<small>complete GST details</small></span></button><button className={tab==='payments'?'active':''} onClick={()=>setTab('payments')}><Save size={16}/><span>Invoice Payments<small>{payments.length} receipts</small></span></button><button className={tab==='school'?'active':''} onClick={()=>setTab('school')}><Users size={16}/><span>School Collections<small>{schoolCollections.length} receipts</small></span></button></div>
    {tab==='invoices'&&<>
      <div className="filterbar salary-filter" style={{flexWrap:'wrap',gap:'12px',alignItems:'flex-end',marginBottom:'14px'}}>
        <label style={{minWidth:140}}>
          Year
          <select value={invoiceFilterYear} onChange={e=>setInvoiceFilterYear(e.target.value)}>
            <option value="All">All Years</option>
            {availableInvoiceYears.map(yr=>(
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </label>
        <label style={{minWidth:180,flex:1}}>
          School / Customer
          <select value={invoiceFilterSchool} onChange={e=>setInvoiceFilterSchool(e.target.value)}>
            <option value="All">All Schools / Customers</option>
            {invoiceSchoolOptions.map(name=>(
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label style={{minWidth:140}}>
          Status
          <select value={invoiceFilterStatus} onChange={e=>setInvoiceFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </label>
        {(invoiceFilterYear!=='All'||invoiceFilterSchool!=='All'||invoiceFilterStatus!=='All')&&(
          <button
            type="button"
            className="outline"
            style={{padding:'7px 14px',height:'38px',alignSelf:'flex-end',fontSize:'12px',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}
            onClick={()=>{
              setInvoiceFilterYear('All');
              setInvoiceFilterSchool('All');
              setInvoiceFilterStatus('All');
            }}
          >
            <RotateCcw size={13}/> Clear Filters
          </button>
        )}
      </div>
      <Stats values={[
        ['Invoices',String(filteredInvoices.length),(invoiceFilterYear!=='All'||invoiceFilterSchool!=='All'||invoiceFilterStatus!=='All')?'matching filters':'saved invoices'],
        ['Invoice Total',money(filteredTotalAmount),(invoiceFilterYear!=='All'||invoiceFilterSchool!=='All'||invoiceFilterStatus!=='All')?'filtered total':'all invoices'],
        ['Paid',money(filteredPaidTotal),'recorded payments'],
        ['Pending',money(filteredPendingTotal),'outstanding balance']
      ]}/>
      <Table paged={true} title="Tax invoice list" copy={(invoiceFilterYear!=='All'||invoiceFilterSchool!=='All'||invoiceFilterStatus!=='All')?`Showing ${filteredInvoices.length} of ${invoices.length} invoices`:"Complete invoices with paid and outstanding balances"} headers={['INVOICE','DATE','CUSTOMER','PRODUCT','QTY','TOTAL','PAID','BALANCE','STATUS']} rows={invoiceRows} actions={row=>{const invoice=invoices.find(item=>item.invoiceNo===row[0]);if(!invoice)return null;const isOpen=openInvoiceAction===invoice.invoiceNo;return <div className="dropdown-action-cell"><button type="button" className="outline mini-action dropdown-trigger" onClick={e=>{e.stopPropagation();const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();const pos={top:rect.bottom+4,left:Math.max(8,rect.right-160)};setInvoiceDropdownPos(isOpen?null:pos);setOpenInvoiceAction(isOpen?null:invoice.invoiceNo)}}>Actions <span className="dropdown-arrow"/></button>{isOpen&&invoiceDropdownPos&&<div className="dropdown-menu" style={{top:invoiceDropdownPos.top,left:invoiceDropdownPos.left}}><button type="button" className="dropdown-item" onClick={()=>{setOpenInvoiceAction(null);setInvoiceDropdownPos(null);setViewInvoice(invoice)}}><Eye size={14}/> View</button><button type="button" className="dropdown-item" onClick={()=>{setOpenInvoiceAction(null);setInvoiceDropdownPos(null);editInvoice(invoice)}}><Pencil size={14}/> Edit</button><button type="button" className="dropdown-item danger" onClick={()=>{setOpenInvoiceAction(null);setInvoiceDropdownPos(null);deleteInvoice(invoice)}}><Trash2 size={14}/> Delete</button><button type="button" className="dropdown-item" style={{color:'#16a34a'}} onClick={()=>{setOpenInvoiceAction(null);setInvoiceDropdownPos(null);openWhatsApp({phone:invoice.customerPhone,message:formatInvoiceWhatsAppMessage(invoice,company)})}}><Send size={14}/> Send</button></div>}</div>}}/>
    </>}
    {tab==='create'&&<article className="card measurement-form"><div className="form-title"><div><h2>{originalInvoiceNo?'Edit invoice':'Create tax invoice'}</h2><p>All invoice, GST, customer and shipping details are stored.</p></div><button className="primary" onClick={()=>setPreviewInvoice(form)}><Printer size={16}/> Preview</button></div><div className="form-grid"><label>Invoice No<input value={form.invoiceNo} onChange={e=>updateForm({invoiceNo:e.target.value})}/></label><label>Invoice Date<input type="date" value={form.invoiceDate} onChange={e=>updateForm({invoiceDate:e.target.value})}/></label><label>Due Date<input type="date" value={form.dueDate} onChange={e=>updateForm({dueDate:e.target.value})}/></label><label>State<input value={form.state} onChange={e=>updateForm({state:e.target.value})}/></label><label>Reverse Charge<select value={form.reverseCharge} onChange={e=>updateForm({reverseCharge:e.target.value})}><option>NO</option><option>YES</option></select></label><label>Customer<select value={customers.find(c=>c[1]===form.customer)?.[0]||''} onChange={e=>pickCustomer(e.target.value)}><option value="">Select customer</option>{invoiceCustomerOptions}</select></label><label>Phone<input value={form.customerPhone} onChange={e=>updateForm({customerPhone:e.target.value})}/></label><label>Customer GST<input value={form.customerGst} onChange={e=>updateForm({customerGst:e.target.value})}/></label><label className="wide">Billing Address<input value={form.customerAddress} onChange={e=>updateForm({customerAddress:e.target.value})}/></label><label>Ship To<input value={form.shipTo} onChange={e=>updateForm({shipTo:e.target.value})}/></label><label>Shipping GST<input value={form.shipGst} onChange={e=>updateForm({shipGst:e.target.value})}/></label><label className="wide">Shipping Address<input value={form.shipAddress} onChange={e=>updateForm({shipAddress:e.target.value})}/></label><label>Product<input value={form.product} onChange={e=>updateForm({product:e.target.value})}/></label><label>HSN / SAC<input value={form.hsn} onChange={e=>updateForm({hsn:e.target.value})}/></label><label>Quantity<input type="number" min="0" value={form.qty} onChange={e=>updateForm({qty:Number(e.target.value)})}/></label><label>Unit<input value={form.unit} onChange={e=>updateForm({unit:e.target.value})}/></label><label>Rate<input type="number" min="0" value={form.rate} onChange={e=>updateForm({rate:Number(e.target.value)})}/></label><label>CGST %<input type="number" min="0" value={form.cgst} onChange={e=>updateForm({cgst:Number(e.target.value)})}/></label><label>SGST %<input type="number" min="0" value={form.sgst} onChange={e=>updateForm({sgst:Number(e.target.value)})}/></label><label className="wide">Terms<input value={form.terms} onChange={e=>updateForm({terms:e.target.value})}/></label></div><Stats values={[[ 'Taxable',money(form.taxableAmount),'quantity × rate'],['CGST',money(form.taxableAmount*form.cgst/100),`${form.cgst}%`],['SGST',money(form.taxableAmount*form.sgst/100),`${form.sgst}%`],['Total',money(form.totalAmount),'invoice total' ]]}/><div className="form-actions"><button className="primary" onClick={saveInvoice}><Save size={16}/> Save invoice</button></div></article>}
    {tab==='payments'&&(()=>{
      const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid');
      const filteredUnpaidInvoices = paymentSchool
        ? unpaidInvoices.filter(inv => inv.customer === paymentSchool)
        : unpaidInvoices;

      return (
        <article className="card payment-workspace">
          <div className="underline-tabs-nav payment-subtabs">
            <button type="button" className={`underline-tab-btn ${paymentSubTab==='record'?'active':''}`} onClick={()=>setPaymentSubTab('record')}><Plus size={15}/><span>Invoice Record</span></button>
            <button type="button" className={`underline-tab-btn ${paymentSubTab==='history'?'active':''}`} onClick={()=>setPaymentSubTab('history')}><ReceiptText size={15}/><span>Invoice History</span></button>
          </div>
          {paymentSubTab==='record'&&<div className="measurement-form payment-workspace-pane">
            <div className="form-title">
              <div>
                <h2>Record invoice payment</h2>
                <p>Select school/customer to view and settle their pending invoices.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                School / Customer
                <select
                  value={paymentSchool}
                  onChange={e => {
                    const sch = e.target.value;
                    setPaymentSchool(sch);
                    setPaymentForm(f => ({ ...f, invoiceNo: '', amount: 0, discount: 0 }));
                  }}
                >
                  <option value="">All Schools / Customers ({unpaidInvoices.length} pending)</option>
                  {invoiceSchoolOptions.map(name => {
                    const count = unpaidInvoices.filter(i => i.customer === name).length;
                    return (
                      <option key={name} value={name}>
                        {name} {count > 0 ? `(${count} pending)` : '(0 pending)'}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Invoice
                <select
                  value={paymentForm.invoiceNo}
                  onChange={e => {
                    const invNo = e.target.value;
                    const inv = invoices.find(i => i.invoiceNo === invNo);
                    const bal = inv ? Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo)) : 0;
                    setPaymentForm(f => ({
                      ...f,
                      invoiceNo: invNo,
                      amount: bal,
                      discount: 0
                    }));
                    if (inv && !paymentSchool) {
                      setPaymentSchool(inv.customer);
                    }
                  }}
                >
                  <option value="">
                    {filteredUnpaidInvoices.length > 0
                      ? `Select invoice (${filteredUnpaidInvoices.length} available)`
                      : 'No pending invoices'}
                  </option>
                  {filteredUnpaidInvoices.map(invoice => (
                    <option key={invoice.invoiceNo} value={invoice.invoiceNo}>
                      {invoice.invoiceNo} · {invoice.customer} · {invoice.product} · balance {money(invoice.totalAmount - paidFor(invoice.invoiceNo))}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                />
              </label>

              <label>
                Amount (₹)
                <input
                  type="number"
                  min="0"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                />
              </label>

              <label>
                Settlement Discount (₹)
                <input
                  type="number"
                  min="0"
                  value={paymentForm.discount || ''}
                  placeholder="0"
                  onChange={e => {
                    const balance = selectedPaymentInvoice
                      ? Math.max(0, selectedPaymentInvoice.totalAmount - paidFor(selectedPaymentInvoice.invoiceNo))
                      : 0;
                    const discount = Math.min(balance, Math.max(0, Number(e.target.value)));
                    setPaymentForm(f => ({ ...f, discount, amount: Math.max(0, balance - discount) }));
                  }}
                />
              </label>

              <label>
                Mode
                <select
                  value={paymentForm.mode}
                  onChange={e => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank</option>
                  <option>Cheque</option>
                </select>
              </label>

              <label>
                Reference
                <input
                  value={paymentForm.reference}
                  placeholder="e.g. COL-001 or UTR no"
                  onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                />
              </label>

              <label className="wide">
                Remarks
                <input
                  value={paymentForm.remarks}
                  placeholder="Payment notes"
                  onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="primary" onClick={addPayment}>
                <Plus size={16}/> Record payment
              </button>
            </div>
          </div>}

          {paymentSubTab==='history'&&<><div className="filterbar salary-filter payment-history-filters">
            <label>School / Customer<select value={paymentHistorySchool} onChange={e=>setPaymentHistorySchool(e.target.value)}><option value="All">All Schools / Customers</option>{paymentHistorySchools.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
            <label>From Date<input type="date" value={paymentHistoryFrom} onChange={e=>setPaymentHistoryFrom(e.target.value)}/></label>
            <label>To Date<input type="date" value={paymentHistoryTo} min={paymentHistoryFrom||undefined} onChange={e=>setPaymentHistoryTo(e.target.value)}/></label>
            {(paymentHistorySchool!=='All'||paymentHistoryFrom||paymentHistoryTo)&&<button type="button" className="outline" onClick={()=>{setPaymentHistorySchool('All');setPaymentHistoryFrom('');setPaymentHistoryTo('')}}>Clear Filters</button>}
          </div><Table
            title="Invoice payment history"
            copy={`Showing ${filteredPaymentRows.length} of ${payments.length} payment receipts`}
            headers={['PAYMENT', 'DATE', 'INVOICE', 'CUSTOMER', 'MODE', 'AMOUNT', 'DISCOUNT', 'REFERENCE', 'REMARKS']}
            rows={filteredPaymentRows}
            actions={row => {
              const payment = payments.find(item => item.id === row[0])!;
              const inv = invoices.find(item => item.invoiceNo === payment.invoiceNo);
              const isOpen=openPaymentAction===payment.id;
              return <div className="dropdown-action-cell"><button type="button" className="outline mini-action dropdown-trigger" onClick={e=>{e.stopPropagation();const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();setPaymentDropdownPos(isOpen?null:{top:rect.bottom+4,left:Math.max(8,rect.right-160)});setOpenPaymentAction(isOpen?null:payment.id)}}>Actions <span className="dropdown-arrow"/></button>{isOpen&&paymentDropdownPos&&<div className="dropdown-menu" style={{top:paymentDropdownPos.top,left:paymentDropdownPos.left}}><button type="button" className="dropdown-item" onClick={()=>{setOpenPaymentAction(null);setPaymentDropdownPos(null);setPaymentPreview(payment)}}><Printer size={14}/> Print</button><button type="button" className="dropdown-item" style={{color:'#16a34a'}} onClick={()=>{setOpenPaymentAction(null);setPaymentDropdownPos(null);openWhatsApp({phone:inv?.customerPhone,message:formatPaymentReceiptWhatsAppMessage(payment,inv,company)})}}><Send size={14}/> Send</button><button type="button" className="dropdown-item danger" onClick={()=>{setOpenPaymentAction(null);setPaymentDropdownPos(null);deletePayment(payment)}}><Trash2 size={14}/> Delete</button></div>}</div>;
            }}
          /></>}
        </article>
      );
    })()}
    {tab==='school'&&(()=>{
      const selSchool = schoolPayment.school.trim();
      const schoolInvoices = invoices.filter(inv => inv.customer === selSchool);
      const schoolPendingInvs = schoolInvoices.filter(inv => (inv.totalAmount - paidFor(inv.invoiceNo)) > 0);
      const schoolBilled = schoolInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const schoolColls = schoolCollections.filter(c => c[2] === selSchool);
      const schoolCollTotal = schoolColls.reduce((sum, c) => {
        const m = (c[4] || '').match(/\d[\d,]*(?:\.\d+)?/);
        return sum + (m ? Number(m[0].replace(/,/g, '')) : 0);
      }, 0);
      const schoolPending = schoolInvoices.reduce(
        (sum, inv) => sum + Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo)),
        0
      );
      const schoolAdvance = Math.max(0, schoolCollTotal - schoolBilled);

      return (
        <>
          <Stats values={selSchool ? [
            ['Receipts', String(schoolColls.length), `for ${selSchool}`],
            ['Total Collected', money(schoolCollTotal), `for ${selSchool}`],
            [
              schoolPending > 0 ? 'Pending Due' : schoolAdvance > 0 ? 'Advance Credit' : 'Balance Due',
              money(schoolPending > 0 ? schoolPending : schoolAdvance > 0 ? schoolAdvance : 0),
              schoolPending > 0 ? 'outstanding due' : schoolAdvance > 0 ? 'available credit' : 'fully cleared'
            ],
            ['Total Invoiced', money(schoolBilled), `${schoolInvoices.length} invoice${schoolInvoices.length === 1 ? '' : 's'}`]
          ] : [
            ['Receipts', String(schoolCollections.length), 'all school collections'],
            ['Total Collected', money(schoolTotal), 'across all schools'],
            ['Selected School', 'All Schools', 'select school below'],
            ['Schools', String(schools.length), 'registered institutions']
          ]}/>

          <article className="card measurement-form">
            <div className="form-title">
              <div>
                <h2>Record School Payment / Advance</h2>
                <p>Record invoice payment collections (settles invoices) or advance deposits received from schools.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                School
                <select
                  value={schoolPayment.school}
                  onChange={e => {
                    const s = e.target.value;
                    const due = invoices
                      .filter(inv => inv.customer === s)
                      .reduce((sum, inv) => sum + Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo)), 0);
                    setSchoolPayment(f => ({ ...f, school: s, amount: due, settlementDiscount: 0 }));
                    setSelectedInvoiceNo('all');
                  }}
                >
                  <option value="">Select school</option>
                  {schoolOptions}
                </select>
              </label>

              <label>
                Payment / Collection Type
                <select
                  value={collectionType}
                  onChange={e => {
                    const t = e.target.value as 'invoice' | 'advance';
                    setCollectionType(t);
                    if (t === 'advance') {
                      setSchoolPayment(f => ({ ...f, remarks: f.remarks || 'Advance deposit for uniform order' }));
                    }
                  }}
                >
                  <option value="invoice">Invoice Settlement (Pay Invoices)</option>
                  <option value="advance">School Advance (Pre-delivery Deposit)</option>
                </select>
              </label>

              {collectionType === 'invoice' && (
                <label className="wide">
                  Target Invoice
                  <select
                    value={selectedInvoiceNo}
                    onChange={e => {
                      const invNo = e.target.value;
                      setSelectedInvoiceNo(invNo);
                      if (invNo && invNo !== 'all') {
                        const inv = invoices.find(i => i.invoiceNo === invNo);
                        if (inv) {
                          const bal = Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo));
                          setSchoolPayment(f => ({ ...f, amount: bal, settlementDiscount: 0, remarks: `Payment for ${inv.invoiceNo}` }));
                        }
                      } else {
                        setSchoolPayment(f => ({ ...f, amount: schoolPending, settlementDiscount: 0, remarks: '' }));
                      }
                    }}
                  >
                    <option value="all">Auto-allocate across oldest pending invoices (Total Due: {money(schoolPending)})</option>
                    {schoolPendingInvs.map(inv => {
                      const bal = Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo));
                      return (
                        <option key={inv.invoiceNo} value={inv.invoiceNo}>
                          {inv.invoiceNo} · {inv.product} · Balance Due: {money(bal)} (Total: {money(inv.totalAmount)})
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              <label>
                Receipt No
                <input
                  value={schoolPayment.receiptNo}
                  placeholder={`e.g. COL-${String(schoolCollections.length + 1).padStart(3, '0')}`}
                  onChange={e => setSchoolPayment({ ...schoolPayment, receiptNo: e.target.value })}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={schoolPayment.date}
                  onChange={e => setSchoolPayment({ ...schoolPayment, date: e.target.value })}
                />
              </label>
              <label>
                Amount (₹)
                <input
                  type="number"
                  min="0"
                  value={schoolPayment.amount}
                  onChange={e => setSchoolPayment({ ...schoolPayment, amount: Number(e.target.value) })}
                />
              </label>
              {collectionType === 'invoice' && (
                <label>
                  Settlement Discount / Waiver (₹)
                  <input
                    type="number"
                    min="0"
                    value={schoolPayment.settlementDiscount || ''}
                    placeholder="e.g. 2000"
                    onChange={e => {
                      const targetBalance = selectedInvoiceNo !== 'all'
                        ? (() => {
                            const inv = invoices.find(i => i.invoiceNo === selectedInvoiceNo);
                            return inv ? Math.max(0, inv.totalAmount - paidFor(inv.invoiceNo)) : 0;
                          })()
                        : schoolPending;
                      const settlementDiscount = Math.min(targetBalance, Math.max(0, Number(e.target.value)));
                      setSchoolPayment(f => ({
                        ...f,
                        settlementDiscount,
                        amount: Math.max(0, targetBalance - settlementDiscount)
                      }));
                    }}
                  />
                </label>
              )}
              <label>
                Payment Mode
                <select
                  value={schoolPayment.paymentMode}
                  onChange={e => setSchoolPayment({ ...schoolPayment, paymentMode: e.target.value })}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank</option>
                  <option>Cheque</option>
                </select>
              </label>
              <label className="wide">
                Remarks
                <input
                  value={schoolPayment.remarks}
                  placeholder={collectionType === 'advance' ? 'e.g. Opening season advance' : 'e.g. Bank transfer ref / payment note'}
                  onChange={e => setSchoolPayment({ ...schoolPayment, remarks: e.target.value })}
                />
              </label>
              {collectionType === 'invoice' && (Number(schoolPayment.amount) > 0 || Number(schoolPayment.settlementDiscount) > 0) && (
                <div style={{ gridColumn: '1 / -1', background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span>
                    Amount due: <strong>{money((Number(schoolPayment.amount) || 0) + (Number(schoolPayment.settlementDiscount) || 0))}</strong>
                    {Number(schoolPayment.settlementDiscount) > 0 && <> &minus; Discount/Waiver: <strong style={{ color: '#b91c1c' }}>{money(schoolPayment.settlementDiscount)}</strong></>}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#047857' }}>
                    Cash/Bank to Receive: {money(Number(schoolPayment.amount) || 0)}
                  </span>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button className="primary" onClick={addSchoolCollection}>
                <Plus size={16}/> Record Collection Receipt
              </button>
            </div>
          </article>

          <Table
            paged={true}
            title="School collection history"
            copy="Receipts collected directly from schools (synced with invoice payments &amp; advance credits)"
            headers={['RECEIPT', 'DATE', 'SCHOOL', 'MODE', 'AMOUNT', 'REMARKS']}
            rows={schoolRows}
            actions={row => (
              <div className="table-actions">
                <button
                  className="outline mini-action danger"
                  title="Delete Collection"
                  onClick={() => deleteSchoolCollection(row[0])}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            )}
          />
        </>
      );
    })()}
    {previewInvoice&&<PrintPreview doc={<InvoiceDocument invoice={previewInvoice} company={company} sales={schoolSales}/>} onClose={()=>setPreviewInvoice(null)} extra={<button className="primary" style={{background:'#16a34a',borderColor:'#15803d',display:'flex',alignItems:'center',gap:6,fontWeight:700}} onClick={()=>openWhatsApp({phone:previewInvoice.customerPhone,message:formatInvoiceWhatsAppMessage(previewInvoice,company)})}><MessageCircle size={14}/> Send on WhatsApp</button>}/>} {viewInvoice&&<PrintPreview doc={<InvoiceDocument invoice={viewInvoice} company={company} sales={schoolSales}/>} onClose={()=>setViewInvoice(null)} extra={<><button className="primary" style={{background:'#16a34a',borderColor:'#15803d',display:'flex',alignItems:'center',gap:6,fontWeight:700}} onClick={()=>openWhatsApp({phone:viewInvoice.customerPhone,message:formatInvoiceWhatsAppMessage(viewInvoice,company)})}><MessageCircle size={14}/> Send on WhatsApp</button><button className="outline" onClick={()=>editInvoice(viewInvoice)}><Pencil size={14}/> Edit</button></>}/>} {paymentPreview&&<PrintPreview doc={<PaymentDocument payment={paymentPreview} invoice={invoices.find(invoice=>invoice.invoiceNo===paymentPreview.invoiceNo)} company={company}/>} onClose={()=>setPaymentPreview(null)} extra={<button className="primary" style={{background:'#16a34a',borderColor:'#15803d',display:'flex',alignItems:'center',gap:6,fontWeight:700}} onClick={()=>{const inv=invoices.find(item=>item.invoiceNo===paymentPreview.invoiceNo);openWhatsApp({phone:inv?.customerPhone,message:formatPaymentReceiptWhatsAppMessage(paymentPreview,inv,company)})}}><MessageCircle size={14}/> Send Receipt on WhatsApp</button>}/>}
    {collectionAlert&&<div className="stock-modal-overlay" onClick={()=>setCollectionAlert(null)}><article className="card measurement-form entry-modal" onClick={e=>e.stopPropagation()}><div className="form-title"><div><h2>Missing required fields</h2><p>Please fill the following to add this collection.</p></div><button className="outline" onClick={()=>setCollectionAlert(null)}>Close</button></div><div className="alert-list">{collectionAlert.map(field=><div key={field}><AlertTriangle size={15}/><span>{field} is required</span></div>)}</div><div className="form-actions"><button className="primary" onClick={()=>setCollectionAlert(null)}>OK</button></div></article></div>}</section>;
}
