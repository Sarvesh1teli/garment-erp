import { useState } from 'react';
import { Boxes, CheckCircle2, IndianRupee, ReceiptText } from 'lucide-react';
import { buildIncomeEntries } from '../../shared/income';
import { Stats, Table } from '../../shared/ui';
import { money, useStoredState } from '../../shared/utils';
import type { Assignment, Invoice, InvoicePayment, SalaryPayment, School, SchoolStock, StockSale, Student } from '../../shared/types';

const parseMoney = (value = '') => Number((value.match(/\d[\d,]*(?:\.\d+)?/)?.[0] || '0').replace(/,/g, ''));
const assignmentQty = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + work.qty, 0);
const assignmentDone = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + Math.min(work.done, work.qty), 0);

export function DashboardPage({ assignments, schools, students }: { assignments: Assignment[]; schools: School[]; students: Student[] }) {
  const [chartHover,setChartHover] = useState<'collection'|'expense'|null>(null);
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
  const [salaryHistory] = useStoredState<SalaryPayment[]>('garment-salary-history', []);

  const changeFy = (value: string) => { const year = Number(value.slice(0, 4)); setFy(value); setFrom(`${year}-04-01`); setTo(`${year + 1}-03-31`); };
  const inPeriod = (date?: string) => !!date && date >= from && date <= to;
  const periodInvoices = invoices.filter(invoice => inPeriod(invoice.invoiceDate));
  const periodPayments = payments.filter(payment => inPeriod(payment.date));
  const periodSales = sales.filter(sale => inPeriod(sale.date));
  const periodExpenses = expenses.filter(row => inPeriod(row[5]));
  const paidFor = (invoiceNo: string) => payments.filter(payment => payment.invoiceNo === invoiceNo).reduce((sum, payment) => sum + Number(payment.amount || 0) + Number(payment.discount || 0), 0);
  const totalInvoiced = periodInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const collectionEntries = buildIncomeEntries(invoices, payments, collections).filter(entry => inPeriod(entry.date));
  const totalCollected = collectionEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalDiscounted = periodPayments.reduce((sum, payment) => sum + Number(payment.discount || 0), 0);
  const outstanding = periodInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo)), 0);
  const periodSalaries = salaryHistory.filter(payment => inPeriod(payment.paidDate));
  const staffSalaryTotal = periodSalaries.reduce((sum, payment) => sum + payment.netPayable, 0);
  const expenseTotal = periodExpenses.reduce((sum, row) => sum + parseMoney(row[6]), 0) + staffSalaryTotal;
  const expenseEntryCount = periodExpenses.length + periodSalaries.length;
  const deliveredPieces = periodSales.reduce((sum, sale) => sum + Number(sale.count || 0), 0);
  const readyPieces = schoolStock.reduce((sum, stock) => sum + Math.max(0, Number(stock.count || 0)), 0);
  const measuredStudents = students.filter(student => Object.values(student.sizes || {}).some(Boolean)).length;
  const activeSchools = schools.filter(school => school.status === 'Active').length;
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
  });
  const chartTotal = totalCollected + expenseTotal;
  const collectionPercent = chartTotal > 0 ? totalCollected / chartTotal * 100 : 0;
  const expensePercent = chartTotal > 0 ? expenseTotal / chartTotal * 100 : 0;

  return <section className="content dashboard-page business-dashboard">
    <div className="dashboard-heading"><div><span>BUSINESS OVERVIEW</span><h1>Garment ERP Dashboard</h1><p>Orders, production, stock, delivery and payment position at a glance.</p></div><div className="filterbar salary-filter yearwise-filter"><label>Financial Year<select value={fy} onChange={event => changeFy(event.target.value)}><option>{`${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`}</option><option>{`${currentFyStart - 1}-${String(currentFyStart % 100).padStart(2, '0')}`}</option></select></label><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div></div>
    <Stats values={[["Active Schools", String(activeSchools), `${schools.length} total schools`], ["Students Measured", String(measuredStudents), `${students.length} student records`], ["Ready Stock", `${readyPieces} Pcs`, "available for delivery"], ["Pending Production", `${Math.max(0, assignedPieces - completedPieces)} Pcs`, `${productionPct}% work completed`]]} />
    <Stats className="discount-summary-metrics" values={[["Total Invoiced", money(totalInvoiced), `${periodInvoices.length} invoices`], ["Cash Collected", money(totalCollected), `${collectionEntries.length} receipts`], ["Discounted", money(totalDiscounted), "settlement discounts / waivers"], ["Outstanding Due", money(outstanding), `${pendingInvoices.length} pending invoices`], ["Expenses", money(expenseTotal), `${expenseEntryCount} entries, including ${periodSalaries.length} salary payments`]]} />
    <div className="dashboard-summary-grid">
    <article className="card dashboard-finance-chart">
      <div className="cardhead"><div><h2>Total collection &amp; expenses</h2><p>Cash collected and expenses in the selected period</p></div></div>
      <div className="dashboard-finance-chart-body">
        <div className="dashboard-finance-pie-wrap" onMouseLeave={()=>setChartHover(null)}>
        <div className="dashboard-finance-pie" tabIndex={0} onFocus={()=>setChartHover('expense')} onBlur={()=>setChartHover(null)} onMouseMove={event=>{if(!chartTotal)return;const rect=event.currentTarget.getBoundingClientRect();const angle=(Math.atan2(event.clientX-rect.left-rect.width/2,-(event.clientY-rect.top-rect.height/2))*180/Math.PI+360)%360;setChartHover(angle<collectionPercent*3.6?'collection':'expense')}} role="img" aria-label={chartTotal > 0 ? `Total collection ${money(totalCollected)}, ${collectionPercent.toFixed(1)} percent; expenses ${money(expenseTotal)}, ${expensePercent.toFixed(1)} percent` : 'No collections or expenses in the selected period'} style={{background:chartTotal > 0 ? `conic-gradient(#14b8a6 0% ${collectionPercent}%, #22c55e ${collectionPercent}% 100%)` : '#e4eeeb'}}><div className="dashboard-donut-center"><strong>{money(totalCollected)}</strong><span>Total collection</span><small>{new Date(`${from}T00:00:00`).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})} ? {new Date(`${to}T00:00:00`).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}</small></div></div>
        {chartHover&&chartTotal>0&&<div className="dashboard-chart-tooltip" role="tooltip">{chartHover==='collection'?<><b>Total collection</b><span>{money(totalCollected)}</span></>:<><b>Expenses</b><span>Staff salary: {money(staffSalaryTotal)}</span><span>Other expenses: {money(expenseTotal-staffSalaryTotal)}</span><strong>Total: {money(expenseTotal)}</strong></>}</div>}
        </div>
        <div className="dashboard-finance-legend">
          <div><span className="finance-chart-dot collection"/><span>Total collection<strong>{money(totalCollected)}</strong></span><b>{collectionPercent.toFixed(1)}%</b></div>
          <div><span className="finance-chart-dot expense"/><span>Expenses<strong>{money(expenseTotal)}</strong><small>Staff salary: {money(staffSalaryTotal)}</small></span><b>{expensePercent.toFixed(1)}%</b></div>
          {chartTotal === 0 && <p>No collections or expenses in the selected period.</p>}
        </div>
      </div>
    </article>
      <article className="card dashboard-alert-card"><div className="cardhead"><div><h2>Attention required</h2><p>Items needing follow-up</p></div></div><div className="activityrow"><div className="dot amber"><ReceiptText /></div><div><strong>{pendingInvoices.length} invoices</strong><span>Payment collection pending</span></div><b className="warn">{money(outstanding)}</b></div><div className="activityrow"><div className="dot blue"><Boxes /></div><div><strong>{Math.max(0, assignedPieces - completedPieces)} pieces</strong><span>Production work pending</span></div><b>{productionPct}% done</b></div><div className="activityrow"><div className="dot green"><CheckCircle2 /></div><div><strong>{readyPieces} pieces</strong><span>Ready stock available</span></div><b>{deliveredPieces} delivered</b></div><div className="activityrow"><div className="dot amber"><IndianRupee /></div><div><strong>{money(expenseTotal)}</strong><span>Expenses in selected period</span></div><b>{expenseEntryCount} entries</b></div></article>
    </div>
    <Table title="School-wise status" copy="Students, deliveries, billing and outstanding amount" headers={['SCHOOL', 'STUDENTS', 'MEASURED', 'DELIVERED', 'INVOICED', 'DUE', 'STATUS']} rows={schoolRows} paged />

  </section>;
}
