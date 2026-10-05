import { useState } from 'react';
import { Boxes, CheckCircle2, Clock3, IndianRupee, PackageCheck, ReceiptText, Shirt, Truck, Users } from 'lucide-react';
import { Stats, Table } from '../../shared/ui';
import { money, useStoredState } from '../../shared/utils';
import type { Assignment, Invoice, InvoicePayment, School, SchoolStock, StockSale, Student } from '../../shared/types';

const parseMoney = (value = '') => Number((value.match(/\d[\d,]*(?:\.\d+)?/)?.[0] || '0').replace(/,/g, ''));
const assignmentQty = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + work.qty, 0);
const assignmentDone = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + Math.min(work.done, work.qty), 0);

export function DashboardPage({ assignments, schools, students }: { assignments: Assignment[]; schools: School[]; students: Student[] }) {
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFy] = useState(`${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`);
  const [from, setFrom] = useState(`${currentFyStart}-04-01`);
  const [to, setTo] = useState(`${currentFyStart + 1}-03-31`);
  const [invoices] = useStoredState<Invoice[]>('garment-invoices', []);
  const [payments] = useStoredState<InvoicePayment[]>('garment-invoice-payments', []);
  const [schoolStock] = useStoredState<SchoolStock[]>('garment-school-stock', []);
  const [sales] = useStoredState<StockSale[]>('garment-stock-sales', []);
  const [collections] = useStoredState<string[][]>('garment-school-collections', []);
  const [expenses] = useStoredState<string[][]>('garment-expenses', []);

  const changeFy = (value: string) => { const year = Number(value.slice(0, 4)); setFy(value); setFrom(`${year}-04-01`); setTo(`${year + 1}-03-31`); };
  const inPeriod = (date?: string) => !!date && date >= from && date <= to;
  const periodInvoices = invoices.filter(invoice => inPeriod(invoice.invoiceDate));
  const periodPayments = payments.filter(payment => inPeriod(payment.date));
  const periodSales = sales.filter(sale => inPeriod(sale.date));
  const periodExpenses = expenses.filter(row => inPeriod(row[5]));
  const periodCollections = collections.filter(row => inPeriod(row[1]));
  const paidFor = (invoiceNo: string) => payments.filter(payment => payment.invoiceNo === invoiceNo).reduce((sum, payment) => sum + Number(payment.amount || 0) + Number(payment.discount || 0), 0);
  const totalInvoiced = periodInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const totalCollected = periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstanding = periodInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo)), 0);
  const expenseTotal = periodExpenses.reduce((sum, row) => sum + parseMoney(row[6]), 0);
  const deliveredPieces = periodSales.reduce((sum, sale) => sum + Number(sale.count || 0), 0);
  const readyPieces = schoolStock.reduce((sum, stock) => sum + Math.max(0, Number(stock.count || 0)), 0);
  const measuredStudents = students.filter(student => Object.values(student.sizes || {}).some(Boolean)).length;
  const activeSchools = schools.filter(school => school.status === 'Active').length;
  const activeAssignments = assignments.filter(assignment => assignmentDone(assignment) < assignmentQty(assignment));
  const assignedPieces = assignments.reduce((sum, assignment) => sum + assignmentQty(assignment), 0);
  const completedPieces = assignments.reduce((sum, assignment) => sum + assignmentDone(assignment), 0);
  const productionPct = assignedPieces ? Math.round(completedPieces / assignedPieces * 100) : 0;
  const pendingInvoices = periodInvoices.filter(invoice => Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo)) > 0);

  const schoolRows = schools.map(school => {
    const schoolStudents = students.filter(student => student.school === school.name);
    const measured = schoolStudents.filter(student => Object.values(student.sizes || {}).some(Boolean)).length;
    const delivered = periodSales.filter(sale => sale.party === school.name).reduce((sum, sale) => sum + Number(sale.count || 0), 0);
    const schoolInvoices = periodInvoices.filter(invoice => invoice.customer === school.name);
    const billed = schoolInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const due = schoolInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo)), 0);
    return [school.name, String(schoolStudents.length), String(measured), `${delivered} Pcs`, money(billed), money(due), due > 0 ? 'Payment Due' : billed > 0 ? 'Clear' : 'No Billing'];
  }).filter(row => Number(row[1]) > 0 || row[4] !== money(0)).slice(0, 6);
  const recentInvoiceRows = [...periodInvoices].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).slice(0, 5).map(invoice => {
    const due = Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo));
    return [invoice.invoiceNo, invoice.invoiceDate, invoice.customer, `${invoice.qty} Pcs`, money(invoice.totalAmount), money(due), due <= 0 ? 'Paid' : paidFor(invoice.invoiceNo) > 0 ? 'Partially Paid' : 'Pending'];
  });

  return <section className="content dashboard-page business-dashboard">
    <div className="dashboard-heading"><div><span>BUSINESS OVERVIEW</span><h1>Garment ERP Dashboard</h1><p>Orders, production, stock, delivery and payment position at a glance.</p></div><div className="filterbar salary-filter yearwise-filter"><label>Financial Year<select value={fy} onChange={event => changeFy(event.target.value)}><option>{`${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`}</option><option>{`${currentFyStart - 1}-${String(currentFyStart % 100).padStart(2, '0')}`}</option></select></label><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div></div>
    <Stats values={[["Active Schools", String(activeSchools), `${schools.length} total schools`], ["Students Measured", String(measuredStudents), `${students.length} student records`], ["Ready Stock", `${readyPieces} Pcs`, "available for delivery"], ["Pending Production", `${Math.max(0, assignedPieces - completedPieces)} Pcs`, `${productionPct}% work completed`]]} />
    <Stats values={[["Total Invoiced", money(totalInvoiced), `${periodInvoices.length} invoices`], ["Cash Collected", money(totalCollected), `${periodPayments.length || periodCollections.length} receipts`], ["Outstanding Due", money(outstanding), `${pendingInvoices.length} pending invoices`], ["Expenses", money(expenseTotal), `${periodExpenses.length} expense entries`]]} />
    <div className="dashboard-summary-grid">
      <article className="card dashboard-flow-card"><div className="cardhead"><div><h2>Order fulfilment</h2><p>Current operational position</p></div></div><div className="dashboard-flow"><div><span className="flow-icon blue"><Users /></span><strong>{students.length}</strong><small>Students</small></div><div><span className="flow-icon purple"><Shirt /></span><strong>{measuredStudents}</strong><small>Measured</small></div><div><span className="flow-icon amber"><Clock3 /></span><strong>{activeAssignments.length}</strong><small>Active jobs</small></div><div><span className="flow-icon green"><PackageCheck /></span><strong>{readyPieces}</strong><small>Ready stock</small></div><div><span className="flow-icon blue"><Truck /></span><strong>{deliveredPieces}</strong><small>Delivered</small></div></div></article>
      <article className="card dashboard-alert-card"><div className="cardhead"><div><h2>Attention required</h2><p>Items needing follow-up</p></div></div><div className="activityrow"><div className="dot amber"><ReceiptText /></div><div><strong>{pendingInvoices.length} invoices</strong><span>Payment collection pending</span></div><b className="warn">{money(outstanding)}</b></div><div className="activityrow"><div className="dot blue"><Boxes /></div><div><strong>{Math.max(0, assignedPieces - completedPieces)} pieces</strong><span>Production work pending</span></div><b>{productionPct}% done</b></div><div className="activityrow"><div className="dot green"><CheckCircle2 /></div><div><strong>{readyPieces} pieces</strong><span>Ready stock available</span></div><b>{deliveredPieces} delivered</b></div><div className="activityrow"><div className="dot amber"><IndianRupee /></div><div><strong>{money(expenseTotal)}</strong><span>Expenses in selected period</span></div><b>{periodExpenses.length} entries</b></div></article>
    </div>
    <Table title="School-wise status" copy="Students, deliveries, billing and outstanding amount" headers={['SCHOOL', 'STUDENTS', 'MEASURED', 'DELIVERED', 'INVOICED', 'DUE', 'STATUS']} rows={schoolRows} />
    <Table title="Recent invoices" copy="Latest billing and payment status" headers={['INVOICE', 'DATE', 'SCHOOL / CUSTOMER', 'QTY', 'TOTAL', 'BALANCE', 'STATUS']} rows={recentInvoiceRows} />
  </section>;
}
