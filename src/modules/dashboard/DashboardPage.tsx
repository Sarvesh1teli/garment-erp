import { useJobWork } from '../../shared/JobWorkContext';
import { schoolOrderHistory } from '../../shared/schoolOrderHistory';
import type { BulkOrder } from '../../shared/bulkOrders';
import { readyBalances } from '../../shared/commerce';
import type { BusinessMode } from '../../shared/commerce';
import type { ProductionOrder } from '../../shared/GeneralProduction';
import { useState } from 'react';
import { Stats, Table } from '../../shared/ui';
import { money } from '../../shared/utils';
import { useCommerceState, useCommerce } from '../../shared/CommerceContext';
import type { Assignment, Employee, WorkEntry, SalaryPayment, School, SchoolStock, StockSale, Student } from '../../shared/types';

const parseMoney = (value = '') => Number((value.match(/\d[\d,]*(?:\.\d+)?/)?.[0] || '0').replace(/,/g, ''));
const assignmentQty = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + work.qty, 0);
const assignmentDone = (assignment: Assignment) => assignment.works.reduce((sum, work) => sum + Math.min(work.done, work.qty), 0);

export function DashboardPage({ assignments, schools, students, onNavigate }: { assignments: Assignment[]; schools: School[]; students: Student[]; onNavigate?:(page:string,params?:Record<string,unknown>)=>void }) {
  const commerce=useCommerce();
  const [businessMode]=useCommerceState<BusinessMode>('garment-business-mode','both');
  const [generalOrders]=useCommerceState<ProductionOrder[]>('garment-general-production',[]);
  const [customers]=useCommerceState<string[][]>('garment-customers',[]);
  const [employees]=useCommerceState<Employee[]>('garment-employees',[]);
  const [manualWorkEntries]=useCommerceState<WorkEntry[]>('garment-work-entries',[]);
  const workEntries=useJobWork()?.entries||manualWorkEntries;
  const [bulkOrders]=useCommerceState<BulkOrder[]>('garment-bulk-orders',[]);
  const [chartHover,setChartHover] = useState<string|null>(null);
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFy] = useState(`${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`);
  const [from, setFrom] = useState(`${currentFyStart}-04-01`);
  const [to, setTo] = useState(`${currentFyStart + 1}-03-31`);
  const [schoolStock] = useCommerceState<SchoolStock[]>('garment-school-stock', []);
  const [sales] = useCommerceState<StockSale[]>('garment-stock-sales', []);
  const [expenses] = useCommerceState<string[][]>('garment-expenses', []);
  const [salaryHistory] = useCommerceState<SalaryPayment[]>('garment-salary-history', []);

  const changeFy = (value: string) => { const year = Number(value.slice(0, 4)); setFy(value); setFrom(`${year}-04-01`); setTo(`${year + 1}-03-31`); };
  const inPeriod = (date?: string) => !!date && date >= from && date <= to;
  const periodSales = sales.filter(sale => sale.fulfilment!=='reserved' && inPeriod(sale.date));
  const periodExpenses = expenses.filter(row => inPeriod(row[5]));
  const periodSalaries = salaryHistory.filter(payment => inPeriod(payment.paidDate));
  const staffSalaryTotal = periodSalaries.reduce((sum, payment) => sum + payment.netPayable, 0);
  const expenseTotal = periodExpenses.reduce((sum, row) => sum + parseMoney(row[6]), 0) + staffSalaryTotal;
  const expenseEntryCount = periodExpenses.length + periodSalaries.length;
  const deliveredPieces = periodSales.reduce((sum, sale) => sum + Number(sale.count || 0), 0);
  const readyPieces = commerce?readyBalances(commerce.schoolStock,commerce.customerStock,commerce.sales).reduce((sum,row)=>sum+row.available,0):schoolStock.reduce((sum, stock) => sum + Math.max(0, Number(stock.count || 0)), 0);
  const activeSchools = schools.filter(school => school.status === 'Active').length;
  const assignedPieces = assignments.reduce((sum, assignment) => sum + assignmentQty(assignment), 0)+(businessMode==='shop'?generalOrders.reduce((sum,order)=>sum+order.lines.reduce((sum,row)=>sum+row.quantity,0),0):0);
  const completedPieces = assignments.reduce((sum, assignment) => sum + assignmentDone(assignment), 0)+(businessMode==='shop'?generalOrders.reduce((sum,order)=>sum+order.lines.reduce((sum,row)=>sum+row.done,0),0):0);

  const schoolProgress = schools.map(school => {
    const history=schoolOrderHistory(school.name,bulkOrders,students,sales);
    const orders=history.orders.filter(order=>order.year===fy&&(!order.date||inPeriod(order.date)));
    const orderGroups = new Map<string, { required: number; delivered: number }>();
    for (const order of orders) {
      const group = orderGroups.get(order.reference) || { required: 0, delivered: 0 };
      group.required += order.required;
      group.delivered += order.delivered;
      orderGroups.set(order.reference, group);
    }
    const orderStatuses = Array.from(orderGroups.values());
    const statusCounts = {
      pending: orderStatuses.filter(order => order.delivered === 0).length,
      partial: orderStatuses.filter(order => order.delivered > 0 && order.delivered < order.required).length,
      completed: orderStatuses.filter(order => order.delivered >= order.required).length,
    };
    const ordered=orders.reduce((sum,order)=>sum+order.required,0);
    const pending=orders.reduce((sum,order)=>sum+order.pendingDel,0);
    const delivered=orders.reduce((sum,order)=>sum+order.delivered,0);
    const groups=new Map<string,number>();
    orders.forEach(order=>{const key=JSON.stringify([order.gender,order.garment,order.size]);groups.set(key,(groups.get(key)||0)+order.required);});
    let produced=0;
    for(const [key,required] of groups){const [gender,garment,size]=JSON.parse(key) as string[];const count=schoolStock.filter(stock=>stock.school===school.name&&stock.gender===gender&&stock.garment===garment&&stock.size===size&&inPeriod(stock.date)).reduce((sum,stock)=>sum+stock.count,0);produced+=Math.min(required,Math.max(0,count));}
    return {statusCounts,name:school.name,ordered,produced,delivered,pending,production:Math.max(0,ordered-Math.max(produced,delivered)),active:new Set(orders.filter(order=>order.pendingDel>0).map(order=>order.reference)).size};
  });
  const statusTotals = schoolProgress.reduce((totals, school) => ({
    pending: totals.pending + school.statusCounts.pending,
    partial: totals.partial + school.statusCounts.partial,
    completed: totals.completed + school.statusCounts.completed,
  }), { pending: 0, partial: 0, completed: 0 });
  const statusSegments = [
    { label: 'Pending', count: statusTotals.pending, colour: '#f59e0b' },
    { label: 'Partially Delivered', count: statusTotals.partial, colour: '#3b82f6' },
    { label: 'Completed', count: statusTotals.completed, colour: '#22c55e' },
  ];
  const statusOrderTotal = statusSegments.reduce((sum, segment) => sum + segment.count, 0);
  let statusAngle = 0;
  const statusGradient = statusOrderTotal ? `conic-gradient(${statusSegments.map(segment => {
    const start = statusAngle;
    statusAngle += segment.count / statusOrderTotal * 100;
    return `${segment.colour} ${start}% ${statusAngle}%`;
  }).join(', ')})` : '#e4eeeb';
  const activeOrderCount=schoolProgress.reduce((sum,row)=>sum+row.active,0);
  const orderPieces=schoolProgress.reduce((sum,row)=>sum+row.ordered,0);
  const producedOrderPieces=schoolProgress.reduce((sum,row)=>sum+Math.max(row.produced,row.delivered),0);
  const pendingDelivery=schoolProgress.reduce((sum,row)=>sum+row.pending,0);
  const pendingProduction=businessMode==='shop'?Math.max(0,assignedPieces-completedPieces):schoolProgress.reduce((sum,row)=>sum+row.production,0);
  const attentionSchools=schoolProgress.filter(row=>row.pending>0||row.production>0).sort((a,b)=>b.production-a.production||b.pending-a.pending||a.name.localeCompare(b.name));
  const output=employees.map(employee=>({name:employee.name,quantity:workEntries.filter(entry=>entry.employeeId===employee.id&&inPeriod(entry.date)).reduce((sum,entry)=>sum+entry.quantity,0)})).filter(row=>row.quantity>0).sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name));
  const totalOutput=output.reduce((sum,row)=>sum+row.quantity,0);
  const expenseCategories=new Map<string,{name:string;amount:number}>();
  const addExpense=(category:string,amount:number)=>{if(!Number.isFinite(amount)||amount<=0)return;const name=category.trim()||'Other expenses';const key=name.toLowerCase();const current=expenseCategories.get(key);expenseCategories.set(key,{name:current?.name||name,amount:(current?.amount||0)+amount});};
  periodExpenses.forEach(row=>addExpense(row[3]||'Other expenses',parseMoney(row[6])));
  addExpense('Staff salaries',staffSalaryTotal);
  const palette=['#f59e0b','#14b8a6','#22c55e','#3b82f6','#a855f7','#f43f5e','#06b6d4','#84cc16'];
  const chartTotal=Array.from(expenseCategories.values()).reduce((sum,row)=>sum+row.amount,0);
  let cumulative=0;
  const expenseSlices=Array.from(expenseCategories.values()).sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name)).map((row,index)=>{const start=cumulative;const percent=chartTotal?row.amount/chartTotal*100:0;cumulative+=percent;return {...row,percent,start,end:cumulative,colour:palette[index%palette.length]};});
  const hoveredExpense=expenseSlices.find(row=>row.name===chartHover);
  const chartBackground=expenseSlices.length?`conic-gradient(${expenseSlices.map(row=>`${row.colour} ${row.start}% ${row.end}%`).join(', ')})`:'#e4eeeb';

  return <section className="content dashboard-page business-dashboard">
    <div className="dashboard-heading"><div><h1 className="dashboard-colour-title">Garment ERP Dashboard</h1></div><div className="filterbar salary-filter yearwise-filter"><label>Financial Year<select value={fy} onChange={event => changeFy(event.target.value)}><option>{`${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`}</option><option>{`${currentFyStart - 1}-${String(currentFyStart % 100).padStart(2, '0')}`}</option></select></label><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div></div>
    <Stats className="dashboard-compact-summary" values={[
      [businessMode==='shop'?'Customers':'Active Schools',String(businessMode==='shop'?customers.filter(row=>(row[5]||'Active')==='Active').length:activeSchools),'active records'],
      [businessMode==='shop'?'Active Production Orders':'Active School Orders',String(businessMode==='shop'?generalOrders.filter(order=>order.lines.some(line=>line.done<line.quantity)).length:activeOrderCount),'pending or partially delivered'],
      ['Pending Production',`${pendingProduction} Pcs`,'still to produce'],
      ['Ready Stock',`${readyPieces} Pcs`,'available for delivery'],
      ['Pending Delivery',`${businessMode==='shop'?(commerce?readyBalances(commerce.schoolStock,commerce.customerStock,commerce.sales).reduce((sum,row)=>sum+row.reserved,0):0):pendingDelivery} Pcs`,businessMode==='shop'?'reserved for delivery':'ordered pieces remaining'],
      ['Active Staff',String(employees.filter(employee=>employee.status==='Active').length),'active employees']
    ]}/>
    <div className={`dashboard-main-panels ${businessMode==='shop'?'shop-dashboard-panels':''}`}>


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

      <article className="card dashboard-staff-output"><div className="cardhead"><div><h2>Top Staff by Output</h2><p>Work pieces completed in the selected period</p></div></div>{output.slice(0,5).map(row=><div className="dashboard-output-row" key={row.name}><span>{row.name}</span><div className="dashboard-progress-track"><span style={{width:`${row.quantity/(output[0]?.quantity||1)*100}%`,background:'#3b82f6'}}/></div><strong>{row.quantity} pcs</strong></div>)}{!output.length&&<p className="dashboard-empty">No work entries in the selected period.</p>}<div className="dashboard-stock-note"><span>Total staff output</span><b>{totalOutput} work pcs</b></div></article>
      {businessMode!=='shop'&&<article className="card dashboard-order-status">
        <div className="cardhead"><div><h2>School Order Status</h2><p>Orders in the selected year and date range</p></div></div>
        <div className="dashboard-order-status-body">
          <div className="dashboard-finance-pie" style={{background:statusGradient}} role="img" aria-label={statusOrderTotal ? statusSegments.map(segment=>`${segment.label}: ${segment.count} orders`).join(', ') : 'No school orders in the selected period'}>
            <div className="dashboard-donut-center"><strong>{statusOrderTotal}</strong><span>Total orders</span></div>
          </div>
          <div className="dashboard-status-legend">{statusSegments.map(segment=><div key={segment.label}><i style={{background:segment.colour}}/><span>{segment.label}</span><strong>{segment.count}</strong><small>{statusOrderTotal?Math.round(segment.count/statusOrderTotal*100):0}%</small></div>)}</div>
        </div>
        {!statusOrderTotal&&<p className="dashboard-empty">No school orders in the selected period.</p>}
      </article>}

    </div>

    {businessMode==='shop'&&commerce?<Table title="Ready garment availability" copy="Available stock after sales and reservations" headers={['STOCK FOR','GARMENT','SIZE','ON HAND','RESERVED','AVAILABLE']} rows={readyBalances(commerce.schoolStock,commerce.customerStock,commerce.sales).map(row=>[row.party||'General Stock',row.garment,row.size,String(row.physical),String(row.reserved),String(row.available)])} paged/>:
      <Table title="Schools Needing Attention" copy={attentionSchools.length?'Up to five schools with pending production or delivery':'All school orders completed.'} headers={['SCHOOL','PENDING PRODUCTION','PENDING DELIVERY']} rows={attentionSchools.slice(0,5).map(row=>[row.name,`${row.production} pcs`,`${row.pending} pcs`])} action={<button className="outline" onClick={()=>onNavigate?.('Production',{tab:'schools',attentionSchools:attentionSchools.map(row=>row.name)})}>View All</button>}/>}


  </section>;
}
