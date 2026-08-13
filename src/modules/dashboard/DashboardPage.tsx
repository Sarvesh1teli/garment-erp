import { useState } from 'react';
import { AlertTriangle, PackageCheck, Scissors, Users, WalletCards } from 'lucide-react';
import { Table, Stats } from '../../shared/ui';
import { money, workTypeCode } from '../../shared/utils';
import { defaultWorkTypes } from '../../shared/defaults';
import type { AdvanceEntry, Assignment, Employee, WorkEntry, WorkType } from '../../shared/types';

type Status='Pending'|'In Progress'|'Completed';
const statusOf=(a:Assignment):Status=>a.works.length&&a.works.every(w=>w.done>=w.qty)?'Completed':a.works.some(w=>w.done>0)?'In Progress':'Pending';
const workTotal=(a:Assignment)=>a.works.reduce((s,w)=>s+w.qty,0);
const workDone=(a:Assignment)=>a.works.reduce((s,w)=>s+Math.min(w.done,w.qty),0);
const workRate=(workTypes:WorkType[],id:string)=>{const wt=workTypes.find(x=>x.id===id)||defaultWorkTypes.find(x=>x.id===id);return wt?.rate||0};
const workTypeName=(workTypes:WorkType[],id:string)=>{const wt=workTypes.find(x=>x.id===id)||defaultWorkTypes.find(x=>x.id===id);return wt?`${workTypeCode(wt)} - ${wt.name}`:'-'};

export function DashboardPage({employees,workTypes,advances,workEntries,assignments,customers}:{employees:Employee[];workTypes:WorkType[];advances:AdvanceEntry[];workEntries:WorkEntry[];assignments:Assignment[];customers:string[][]}){
  const [fy,setFy]=useState(()=>{const now=new Date();return `${now.getFullYear()}-${String((now.getFullYear()+1)%100).padStart(2,'0')}`});
  const [from,setFrom]=useState(()=>`${new Date().getFullYear()}-04-01`);
  const [to,setTo]=useState(()=>`${new Date().getFullYear()+1}-03-31`);
  const changeFy=(value:string)=>{setFy(value);const y=Number(value.slice(0,4));setFrom(`${y}-04-01`);setTo(`${y+1}-03-31`)};
  const activeStaff=employees.filter(e=>e.status==='Active');
  const periodAssignments=assignments.filter(a=>a.date>=from&&a.date<=to);
  const periodWork=workEntries.filter(w=>w.date>=from&&w.date<=to);
  const periodAdvances=advances.filter(a=>a.date>=from&&a.date<=to);
  const activeAssignments=periodAssignments.filter(a=>statusOf(a)!=='Completed');
  const completedAssignments=periodAssignments.filter(a=>statusOf(a)==='Completed');
  const totalAssigned=periodAssignments.reduce((s,a)=>s+workTotal(a),0);
  const totalDone=periodAssignments.reduce((s,a)=>s+workDone(a),0);
  const workAmount=periodWork.reduce((s,w)=>s+w.quantity*workRate(workTypes,w.workTypeId),0);
  const advancesTotal=periodAdvances.reduce((s,a)=>s+a.amount,0);
  const stageData=workTypes.filter(wt=>wt.status==='Active').map(wt=>{const assigned=periodAssignments.reduce((s,a)=>s+a.works.filter(w=>w.workTypeId===wt.id).reduce((x,w)=>x+w.qty,0),0);const done=periodAssignments.reduce((s,a)=>s+a.works.filter(w=>w.workTypeId===wt.id).reduce((x,w)=>x+Math.min(w.done,w.qty),0),0);return {name:workTypeName(workTypes,wt.id),assigned,done}}).filter(x=>x.assigned>0);
  const jobs=activeAssignments.slice(0,6).map(a=>[a.id,a.cuttingNo,customerName(customers,a.customerId),nameOf(employees,a.employeeId),a.works.map(w=>workTypeName(workTypes,w.workTypeId)).join(', '),`${workDone(a)}/${workTotal(a)}`,statusOf(a)]);
  const completion=totalAssigned?Math.round(totalDone/totalAssigned*100):0;
  const today=new Date().toISOString().slice(0,10);
  const todayEntries=periodWork.filter(w=>w.date===today);
  return <section className="content dashboard-page">
    <div className="filterbar salary-filter yearwise-filter"><span className="yearwise-title">YEARWISE</span><label>Financial Year<select value={fy} onChange={e=>changeFy(e.target.value)}><option>2026-27</option><option>2025-26</option></select></label><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
    <Stats values={[['Active Assignments',String(activeAssignments.length),`${completedAssignments.length} completed`],['Pieces Assigned',String(totalAssigned),'across all cuttings'],['Pieces Completed',String(totalDone),`${completion}% of assigned`],['Wage Value',money(workAmount),`${todayEntries.length} entries today`]]}/>
    <div className="grid">
      <article className="card production"><div className="cardhead"><div><h2>Production overview</h2><p>Assigned vs completed pieces by work type</p></div></div><div className="stageTotal"><div><small>TOTAL IN PRODUCTION</small><strong>{totalAssigned}<em> pieces</em></strong></div><span>{completion}% done</span></div><div className="stages">{stageData.map(s=><div key={s.name}><div className="stageLabel"><span>{s.name}</span><strong>{s.done} / {s.assigned}</strong></div><div className="bar"><i style={{width:`${s.assigned?Math.round(s.done/s.assigned*100):0}%`}}/></div></div>)}</div></article>
      <article className="card activity"><div className="cardhead"><div><h2>Work floor summary</h2><p>People, work and money</p></div></div><div className="activityrow"><div className="dot green"><Users/></div><div><strong>{activeStaff.length} / {employees.length}</strong><span>Active staff members</span></div><b>{employees.length?Math.round(activeStaff.length/employees.length*100):0}%</b></div><div className="activityrow"><div className="dot blue"><PackageCheck/></div><div><strong>{totalDone} pcs</strong><span>Completed across cuttings</span></div><b>{completion}%</b></div><div className="activityrow"><div className="dot amber"><Scissors/></div><div><strong>{activeAssignments.length}</strong><span>Work in progress</span></div><b>{activeAssignments.length}</b></div><div className="activityrow"><div className="dot amber"><WalletCards/></div><div><strong>{money(advancesTotal)}</strong><span>Advances given</span></div><b>{advances.length}</b></div></article>
    </div>
    <Table title="Priority work" copy="Active cuttings needing attention" headers={['ASSIGNMENT','CUTTING','CUSTOMER','ASSIGNED TO','WORKS','DONE / QTY','STATUS']} rows={jobs}/>
  </section>
}
function nameOf(employees:Employee[],id:string){return employees.find(e=>e.id===id)?.name||'-'}
function customerName(customers:string[][],id:string){return customers.find(c=>c[0]===id)?.[1]||'-'}
