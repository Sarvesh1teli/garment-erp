import { readyBalances } from '../../shared/commerce';
import type { BusinessMode } from '../../shared/commerce';
import type { ProductionOrder } from '../../shared/GeneralProduction';
import { useState } from 'react';
import { Boxes, CheckCircle2, IndianRupee, ReceiptText } from 'lucide-react';
import { Stats, Table } from '../../shared/ui';
import { money } from '../../shared/utils';
import { useCommerceState, useCommerce } from '../../shared/CommerceContext';
import type { Assignment, Invoice, InvoicePayment, SalaryPayment, School, SchoolStock, StockSale, Student } from '../../shared/types';

const parseMoney = (value = '') => Number((value.match(/\d[\d,]*(?:\.\d+)?/)?.[0] || '0').replace(/,/g, ''));
const assignmentQty = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + work.qty, 0);
const assignmentDone = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + Math.min(work.done, work.qty), 0);

export function DashboardPage({ assignments, schools, students }: { assignments: Assignment[]; schools: School[]; students: Student[] }) {
  const commerce=useCommerce();
  const [businessMode]=useCommerceState<BusinessMode>('garment-business-mode','both');
  const [generalOrders]=useCommerceState<ProductionOrder[]>('garment-general-production',[]);
  const [customers]=useCommerceState<string[][]>('garment-customers',[]);
  const [chartHover,setChartHover] = useState<string|null>(null);
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFy] = useState(`${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`);
  const [from, setFrom] = useState(`${currentFyStart}-04-01`);
  const [to, setTo] = useState(`${currentFyStart + 1}-03-31`);
  const [invoices] = useCommerceState<Invoice[]>('garment-invoices', []);
  const [payments] = useCommerceState<InvoicePayment[]>('garment-invoice-payments', []);
  const [schoolStock] = useCommerceState<SchoolStock[]>('garment-school-stock', []);
  const [sales] = useCommerceState<StockSale[]>('garment-stock-sales', []);
  const [expenses] = useCommerceState<string[][]>('garment-expenses', []);
  const [salaryHistory] = useCommerceState<SalaryPayment[]>('garment-salary-history', []);

  const changeFy = (value: string) => { const year = Number(value.slice(0, 4)); setFy(value); setFrom(`${year}-04-01`); setTo(`${year + 1}-03-31`); };
  const inPeriod = (date?: string) => !!date && date >= from && date <= to;
  const periodInvoices = invoices.filter(invoice => inPeriod(invoice.invoiceDate));
  const periodPayments = payments.filter(payment => inPeriod(payment.date));
  const periodSales = sales.filter(sale => sale.fulfilment!=='reserved' && inPeriod(sale.date));
  const periodExpenses = expenses.filter(row => inPeriod(row[5]));
  const paidFor = (invoiceNo: string) => payments.filter(payment => payment.invoiceNo === invoiceNo).reduce((sum, payment) => sum + Number(payment.amount || 0) + Number(payment.discount || 0), 0);
  const totalDiscounted = periodPayments.filter(payment=>payment.mode!=='Return credit').reduce((sum, payment) => sum + Number(payment.discount || 0), 0);
  const outstanding = periodInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - paidFor(invoice.invoiceNo)), 0);
  const periodSalaries = salaryHistory.filter(payment => inPeriod(payment.paidDate));
  const staffSalaryTotal = periodSalaries.reduce((sum, payment) => sum + payment.netPayable, 0);
  const expenseTotal = periodExpenses.reduce((sum, row) => sum + parseMoney(row[6]), 0) + staffSalaryTotal;
  const expenseEntryCount = periodExpenses.length + periodSalaries.length;
  const deliveredPieces = periodSales.reduce((sum, sale) => sum + Number(sale.count || 0), 0);
  const readyPieces = commerce?readyBalances(commerce.schoolStock,commerce.customerStock,commerce.sales).reduce((sum,row)=>sum+row.available,0):schoolStock.reduce((sum, stock) => sum + Math.max(0, Number(stock.count || 0)), 0);
  const measuredStudents = students.filter(student => Object.values(student.sizes || {}).some(Boolean)).length;
  const activeSchools = schools.filter(school => school.status === 'Active').length;
  const assignedPieces = assignments.reduce((sum, assignment) => sum + assignmentQty(assignment), 0)+(businessMode==='shop'?generalOrders.reduce((sum,order)=>sum+order.lines.reduce((sum,row)=>sum+row.quantity,0),0):0);
  const completedPieces = assignments.reduce((sum, assignment) => sum + assignmentDone(assignment), 0)+(businessMode==='shop'?generalOrders.reduce((sum,order)=>sum+order.lines.reduce((sum,row)=>sum+row.done,0),0):0);
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
  const expenseCategories=new Map<string,{name:string;amount:number}>();
  const addExpense=(category:string,amount:number)=>{if(!Number.isFinite(amount)||amount<=0)return;const name=category.trim()||'Other expenses';const key=name.toLowerCase();const current=expenseCategories.get(key);expenseCategories.set(key,{name:current?.name||name,amount:(current?.amount||0)+amount});};
  periodExpenses.forEach(row=>addExpense(row[3]||'Other expenses',parseMoney(row[6])));
  addExpense('Staff salaries',staffSalaryTotal);
  const palette=['#0f766e','#2563eb','#f59e0b','#9333ea','#e11d48','#0891b2','#65a30d','#c2410c'];
  const chartTotal=Array.from(expenseCategories.values()).reduce((sum,row)=>sum+row.amount,0);
  let cumulative=0;
  const expenseSlices=Array.from(expenseCategories.values()).sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name)).map((row,index)=>{const start=cumulative;const percent=chartTotal?row.amount/chartTotal*100:0;cumulative+=percent;return {...row,percent,start,end:cumulative,colour:palette[index%palette.length]};});
  const hoveredExpense=expenseSlices.find(row=>row.name===chartHover);
  const chartBackground=expenseSlices.length?`conic-gradient(${expenseSlices.map(row=>`${row.colour} ${row.start}% ${row.end}%`).join(', ')})`:'#e4eeeb';

  return <section className="content dashboard-page business-dashboard">
    <div className="dashboard-heading"><div><span>BUSINESS OVERVIEW</span><h1>Garment ERP Dashboard</h1><p>Orders, production, stock, delivery and payment position at a glance.</p></div><div className="filterbar salary-filter yearwise-filter"><label>Financial Year<select value={fy} onChange={event => changeFy(event.target.value)}><option>{`${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`}</option><option>{`${currentFyStart - 1}-${String(currentFyStart % 100).padStart(2, '0')}`}</option></select></label><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div></div>
    <Stats values={[[businessMode==='shop'?"Customers":"Active Schools", String(businessMode==='shop'?customers.filter(row=>(row[5]||'Active')==='Active').length:activeSchools), businessMode==='shop'?"registered customers; walk-ins need no registration":`${schools.length} total schools`], [businessMode==='shop'?"Production Orders":"Students Measured", String(businessMode==='shop'?generalOrders.length:measuredStudents), businessMode==='shop'?"general and customer orders":`${students.length} student records`], ["Ready Stock", `${readyPieces} Pcs`, "available for delivery"], ["Pending Production", `${Math.max(0, assignedPieces - completedPieces)} Pcs`, `${productionPct}% work completed`]]} />
    <Stats values={[["Discounted", money(totalDiscounted), "settlement discounts / waivers"], ["Outstanding Due", money(outstanding), `${pendingInvoices.length} pending invoices`], ["Expenses", money(expenseTotal), `${expenseEntryCount} entries, including ${periodSalaries.length} salary payments`]]} />
    <div className="dashboard-summary-grid">
    <article className="card dashboard-finance-chart">
      <div className="cardhead"><div><h2>Expenses by category</h2><p>Expense entries and staff salaries in the selected period</p></div></div>
      <div className="dashboard-finance-chart-body">
        <div className="dashboard-finance-pie-wrap" onMouseLeave={()=>setChartHover(null)}>
          <div className="dashboard-finance-pie" role="img" aria-label={expenseSlices.length?`Expenses by category: ${expenseSlices.map(row=>`${row.name} ${money(row.amount)}, ${row.percent.toFixed(1)} percent`).join('; ')}`:'No expenses in the selected period'} onMouseMove={event=>{if(!expenseSlices.length)return;const rect=event.currentTarget.getBoundingClientRect();const angle=(Math.atan2(event.clientX-rect.left-rect.width/2,-(event.clientY-rect.top-rect.height/2))*180/Math.PI+360)%360;setChartHover(expenseSlices.find(row=>angle/3.6>=row.start&&angle/3.6<row.end)?.name||null);}} style={{background:chartBackground}}><div className="dashboard-donut-center"><strong>{money(chartTotal)}</strong><span>Total expenses</span><small>{new Date(`${from}T00:00:00`).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})} – {new Date(`${to}T00:00:00`).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}</small></div></div>
          {hoveredExpense&&<div className="dashboard-chart-tooltip" role="tooltip"><b>{hoveredExpense.name}</b><span>{money(hoveredExpense.amount)}</span><span>{hoveredExpense.percent.toFixed(1)}%</span></div>}
        </div>
        <div className="dashboard-finance-legend dashboard-expense-legend">
          {expenseSlices.map(row=><div key={row.name} tabIndex={0} onFocus={()=>setChartHover(row.name)} onBlur={()=>setChartHover(null)} onMouseEnter={()=>setChartHover(row.name)} onMouseLeave={()=>setChartHover(null)}><span className="finance-chart-dot" style={{background:row.colour}}/><span>{row.name}<strong>{money(row.amount)}</strong></span><b>{row.percent.toFixed(1)}%</b></div>)}
          {!expenseSlices.length&&<p>No expenses in the selected period.</p>}
        </div>
      </div>
    </article>
      <article className="card dashboard-alert-card"><div className="cardhead"><div><h2>Attention required</h2><p>Items needing follow-up</p></div></div><div className="activityrow"><div className="dot amber"><ReceiptText /></div><div><strong>{pendingInvoices.length} invoices</strong><span>Payment collection pending</span></div><b className="warn">{money(outstanding)}</b></div><div className="activityrow"><div className="dot blue"><Boxes /></div><div><strong>{Math.max(0, assignedPieces - completedPieces)} pieces</strong><span>Production work pending</span></div><b>{productionPct}% done</b></div><div className="activityrow"><div className="dot green"><CheckCircle2 /></div><div><strong>{readyPieces} pieces</strong><span>Ready stock available</span></div><b>{deliveredPieces} delivered</b></div><div className="activityrow"><div className="dot amber"><IndianRupee /></div><div><strong>{money(expenseTotal)}</strong><span>Expenses in selected period</span></div><b>{expenseEntryCount} entries</b></div></article>
    </div>
    {businessMode==='shop'&&commerce?<Table title="Ready garment availability" copy="Available stock after sales and reservations" headers={['STOCK FOR','GARMENT','SIZE','ON HAND','RESERVED','AVAILABLE']} rows={readyBalances(commerce.schoolStock,commerce.customerStock,commerce.sales).map(row=>[row.party||'General Stock',row.garment,row.size,String(row.physical),String(row.reserved),String(row.available)])} paged/>:<Table title="School-wise status" copy="Students, deliveries, billing and outstanding amount" headers={['SCHOOL', 'STUDENTS', 'MEASURED', 'DELIVERED', 'INVOICED', 'DUE', 'STATUS']} rows={schoolRows} paged />}

  </section>;
}
