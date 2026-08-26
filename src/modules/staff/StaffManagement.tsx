import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { AlertTriangle, CheckCircle2, IndianRupee, ListFilter, Plus, Save, Users } from 'lucide-react';
import type { Employee as StaffEmployee, SalaryType } from '../../shared/types';

export type { StaffEmployee };
type WorkType={id:string;name:string;rate:number;status:'Active'|'Inactive';unit:string};
type AdvanceEntry={id:string;date:string;employeeId:string;amount:number;mode:'Cash'|'UPI'|'Bank';remarks:string};
type StaffTab='list'|'add';

type StaffManagementProps={
  employees:StaffEmployee[];
  setEmployees:Dispatch<SetStateAction<StaffEmployee[]>>;
  workTypes:WorkType[];
  advances:AdvanceEntry[];
  activeTab:StaffTab;
  onTabChange:(tab:StaffTab)=>void;
};

const money=(value:number)=>`Rs. ${value.toLocaleString('en-IN')}`;

export function StaffManagement({employees,setEmployees,workTypes,advances,activeTab,onTabChange}:StaffManagementProps){
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState<'All'|'Active'|'Inactive'|'Left'>('All');
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(10);
  const [savedToast,setSavedToast]=useState('');
  const [staffForm,setStaffForm]=useState<Omit<StaffEmployee,'id'|'type'>>({
    name:'',
    mobile:'',
    address:'',
    joiningDate:new Date().toISOString().slice(0,10),
    status:'Active',
    salaryType:'Piece Rate',
    monthlySalary:0,
    dailyRate:0
  });

  const visibleEmployees=employees.filter(e=>(statusFilter==='All'||e.status===statusFilter)&&`${e.id} ${e.name} ${e.mobile}`.toLowerCase().includes(search.toLowerCase()));
  const totalPages=Math.max(1,Math.ceil(visibleEmployees.length/pageSize));
  const pageEmployees=useMemo(()=>visibleEmployees.slice((page-1)*pageSize,page*pageSize),[visibleEmployees,page,pageSize]);
  const active=employees.filter(e=>e.status==='Active').length;
  useEffect(()=>setPage(1),[search,statusFilter,pageSize]);
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages]);
  
  const updateEmployee=(id:string,changes:Partial<StaffEmployee>)=>setEmployees(current=>current.map(e=>e.id===id?{...e,...changes}:e));
  
  const saveEmployeeRow=(emp:StaffEmployee)=>{
    setEmployees(current=>current.map(e=>e.id===emp.id?{...emp}:e));
    setSavedToast(`✓ Saved salary details for ${emp.id} ${emp.name}`);
    window.setTimeout(()=>setSavedToast(''),3500);
  };

  const addStaff=()=>{
    if(!staffForm.name.trim())return;
    const newEmp:StaffEmployee={
      id:`EMP-${String(employees.length+1).padStart(3,'0')}`,
      type:'Staff',
      ...staffForm,
      name:staffForm.name.trim()
    };
    setEmployees(current=>[newEmp,...current]);
    setStaffForm({
      name:'',
      mobile:'',
      address:'',
      joiningDate:new Date().toISOString().slice(0,10),
      status:'Active',
      salaryType:'Piece Rate',
      monthlySalary:0,
      dailyRate:0
    });
    setSavedToast(`✓ Created staff record for ${newEmp.id} ${newEmp.name}`);
    window.setTimeout(()=>setSavedToast(''),3500);
    onTabChange('list');
  };

  return <section className="content">
    <div className="measurement-tabs staff-tabs"><button className={activeTab==='list'?'active':''} onClick={()=>onTabChange('list')}><ListFilter size={16}/><span>Staff List<small>{employees.length} records</small></span></button><button className={activeTab==='add'?'active':''} onClick={()=>onTabChange('add')}><Plus size={16}/><span>Add Staff<small>Create record</small></span></button></div>
    {savedToast&&<div className="salary-success" style={{marginBottom:'16px'}}><CheckCircle2 size={16}/> {savedToast}</div>}
    {activeTab==='add'&&<article className="card staff-form"><div className="cardhead"><div><h2>Add staff</h2><p>Create a staff record with salary structure options (Piece Rate, Fixed Monthly, or Daily Wage).</p></div><button className="outline" onClick={()=>onTabChange('list')}>Back to list</button></div><div className="advance-form staff-entry-form"><label>Staff name<input value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})} placeholder="Enter staff name"/></label><label>Mobile number<input value={staffForm.mobile} onChange={e=>setStaffForm({...staffForm,mobile:e.target.value})} placeholder="Optional"/></label><label>Salary Type<select value={staffForm.salaryType||'Piece Rate'} onChange={e=>setStaffForm({...staffForm,salaryType:e.target.value as SalaryType})}><option value="Piece Rate">Piece Rate (Work Entry)</option><option value="Fixed Monthly">Fixed Monthly Salary</option><option value="Daily Wage">Daily Wage (Per Day)</option></select></label>{staffForm.salaryType==='Fixed Monthly'&&<label>Monthly Salary (Rs.)<input type="number" min="0" value={staffForm.monthlySalary||0} onChange={e=>setStaffForm({...staffForm,monthlySalary:Number(e.target.value)})} placeholder="e.g. 15000"/></label>}{staffForm.salaryType==='Daily Wage'&&<label>Daily Rate (Rs.)<input type="number" min="0" value={staffForm.dailyRate||0} onChange={e=>setStaffForm({...staffForm,dailyRate:Number(e.target.value)})} placeholder="e.g. 600"/></label>}<label>Joining date<input type="date" value={staffForm.joiningDate} onChange={e=>setStaffForm({...staffForm,joiningDate:e.target.value})}/></label><label>Status<select value={staffForm.status} onChange={e=>setStaffForm({...staffForm,status:e.target.value as StaffEmployee['status']})}><option>Active</option><option>Inactive</option><option>Left</option></select></label><label className="wide">Address<input value={staffForm.address} onChange={e=>setStaffForm({...staffForm,address:e.target.value})} placeholder="Optional"/></label><button className="primary" onClick={addStaff}><Plus size={16}/> Save staff</button></div></article>}
    {activeTab==='list'&&<>
      <div className="filterbar labour-filter"><label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, ID, mobile"/></label><label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as 'All'|'Active'|'Inactive'|'Left')}><option>All</option><option>Active</option><option>Inactive</option><option>Left</option></select></label></div>
      <div className="metrics"><Metric title="Total Staff" value={String(employees.length)} note={`${active} active`} icon={<Users/>} tone="blue"/><Metric title="Active Staff" value={String(active)} note="available for entries" icon={<Users/>} tone="purple"/><Metric title="Inactive / Left" value={String(employees.filter(e=>e.status!=='Active').length)} note="not shown as active" icon={<AlertTriangle/>} tone="orange"/><Metric title="Pending Advances" value={money(advances.reduce((a,b)=>a+b.amount,0))} note="before recoveries" icon={<IndianRupee/>} tone="green"/></div>
      <article className="card jobs module-table"><div className="cardhead"><div><h2>Staff master</h2><p>Configure salary type (Piece Rate, Fixed Monthly, Daily Wage) and click Save to store.</p></div></div><table><thead><tr><th>EMPLOYEE ID</th><th>STAFF</th><th>MOBILE</th><th>SALARY TYPE</th><th>RATE / SALARY</th><th>JOINING DATE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{pageEmployees.map(e=>{const st=e.salaryType||'Piece Rate';return <tr key={e.id}><td><strong>{e.id}</strong></td><td>{e.name}</td><td>{e.mobile||'-'}</td><td><select className="status-select" value={st} onChange={event=>updateEmployee(e.id,{salaryType:event.target.value as SalaryType})}><option value="Piece Rate">Piece Rate</option><option value="Fixed Monthly">Fixed Monthly</option><option value="Daily Wage">Daily Wage</option></select></td><td>{st==='Fixed Monthly'?<input type="number" style={{width:'110px',padding:'4px 6px',border:'1px solid #dfe5e2',borderRadius:'6px'}} value={e.monthlySalary||0} onChange={event=>updateEmployee(e.id,{monthlySalary:Number(event.target.value)})} placeholder="Monthly Rs."/>:st==='Daily Wage'?<input type="number" style={{width:'110px',padding:'4px 6px',border:'1px solid #dfe5e2',borderRadius:'6px'}} value={e.dailyRate||0} onChange={event=>updateEmployee(e.id,{dailyRate:Number(event.target.value)})} placeholder="Daily Rs."/>:'Work Entries'}</td><td>{e.joiningDate}</td><td><select className={'status-select '+e.status.toLowerCase()} value={e.status} onChange={event=>updateEmployee(e.id,{status:event.target.value as StaffEmployee['status']})}><option>Active</option><option>Inactive</option><option>Left</option></select></td><td><button className="save-btn" onClick={()=>saveEmployeeRow(e)} style={{padding:'4px 10px',display:'inline-flex',alignItems:'center',gap:'4px'}}><Save size={14}/> Save</button></td></tr>})}</tbody></table><div className="table-footer paginated-footer"><span>Showing {visibleEmployees.length?`${(page-1)*pageSize+1}-${Math.min(page*pageSize,visibleEmployees.length)}`:'0'} of {visibleEmployees.length} staff</span><div className="pager"><label>Rows<select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><button className="outline" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button><strong>{page} / {totalPages}</strong><button className="outline" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button></div></div></article>
      <article className="card jobs module-table"><div className="cardhead"><div><h2>Work type master</h2><p>Set rates in Work Calculation / Salary. Saved rates stay active until changed.</p></div></div><table><thead><tr><th>WORK TYPE</th><th>RATE</th><th>UNIT</th><th>STATUS</th></tr></thead><tbody>{workTypes.map(w=><tr key={w.id}><td><strong>{w.name}</strong></td><td>{money(w.rate)}</td><td>{w.unit}</td><td><span className={'status '+w.status.toLowerCase()}>{w.status}</span></td></tr>)}</tbody></table></article>
    </>}
  </section>;
}

function Metric({title,value,note,icon,tone}:{title:string;value:string;note:string;icon:React.ReactNode;tone:string}){return <article className="metric"><div className={'metricicon '+tone}>{icon}</div><div><span>{title}</span><strong>{value}</strong><small>{note}</small></div></article>}
