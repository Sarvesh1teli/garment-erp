import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Calculator, CheckCircle2, ClipboardList, Eye, IndianRupee, Pencil, Plus, Printer, ReceiptText, RotateCcw, Save, Search, Settings, Tag, Trash2, WalletCards } from 'lucide-react';
import type React from 'react';
import type { AdvanceEntry, AttendanceEntry, Employee, GarmentPrice, LeaveDeductionMode, SalaryPayment, WorkEntry, WorkType } from '../../shared/types';
import type { CompanySettings } from '../settings/SettingsPage';
import { deleteSalaryPayment } from '../../shared/api';
import { defaultGarmentPrices, defaultWorkTypes } from '../../shared/defaults';
import { PrintPreview, SalaryPrintFooter, SalaryPrintHeader, Stats, Table } from '../../shared/ui';
import { inRange, money, useStoredState, workTypeCode } from '../../shared/utils';

export function WagePage({employees,workTypes,setWorkTypes,advances,setAdvances,workEntries,setWorkEntries,workTypeHistory,setWorkTypeHistory,salaryHistory,setSalaryHistory,attendance,company,garmentPrices:propGarmentPrices,setGarmentPrices:propSetGarmentPrices}:{employees:Employee[];workTypes:WorkType[];setWorkTypes:React.Dispatch<React.SetStateAction<WorkType[]>>;advances:AdvanceEntry[];setAdvances:React.Dispatch<React.SetStateAction<AdvanceEntry[]>>;workEntries:WorkEntry[];setWorkEntries:React.Dispatch<React.SetStateAction<WorkEntry[]>>;workTypeHistory:string[][];setWorkTypeHistory:React.Dispatch<React.SetStateAction<string[][]>>;salaryHistory:SalaryPayment[];setSalaryHistory:React.Dispatch<React.SetStateAction<SalaryPayment[]>>;attendance?:AttendanceEntry[];company:CompanySettings;garmentPrices?:GarmentPrice[];setGarmentPrices?:React.Dispatch<React.SetStateAction<GarmentPrice[]>>}){
  const [from,setFrom]=useState(()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`});
  const [to,setTo]=useState(()=>new Date().toISOString().slice(0,10));
  const [employeeId,setEmployeeId]=useState('');
  const [recover,setRecover]=useState(0);
  const [mode,setMode]=useState<'Cash'|'UPI'|'Bank'>('Cash');
  const [wageTab,setWageTab]=useState<'work'|'advance'|'salary'|'history'|'masters'|'reports'>('work');
  const [masterSubTab,setMasterSubTab]=useState<'work-type'|'rate-history'|'garment-price'>('work-type');
  const [storedGarmentPrices,setStoredGarmentPrices]=useStoredState<GarmentPrice[]>('garment-prices',defaultGarmentPrices);
  const garmentPrices=propGarmentPrices??storedGarmentPrices;
  const setGarmentPrices=propSetGarmentPrices??setStoredGarmentPrices;
  const [garmentPricePage,setGarmentPricePage]=useState(1);
  const [garmentPricePageSize,setGarmentPricePageSize]=useState(10);
  const [garmentPriceSearch,setGarmentPriceSearch]=useState('');
  const [garmentPriceFilterGarment,setGarmentPriceFilterGarment]=useState('All');
  const [garmentPriceFilterQuality,setGarmentPriceFilterQuality]=useState('All');
  const [newGarmentPrice,setNewGarmentPrice]=useState<Omit<GarmentPrice,'id'>>({quality:'Standard',garmentType:'Shirt',size:'28',price:0,remarks:''});
  const [editingPriceId,setEditingPriceId]=useState<string|null>(null);
  const [editGarmentPriceDraft,setEditGarmentPriceDraft]=useState<GarmentPrice|null>(null);
  const [garmentPriceSuccess,setGarmentPriceSuccess]=useState('');
  const [workTypePage,setWorkTypePage]=useState(1);
  const [workTypePageSize,setWorkTypePageSize]=useState(10);
  const [workReportPage,setWorkReportPage]=useState(1);
  const [workReportPageSize,setWorkReportPageSize]=useState(5);
  const [summaryPage,setSummaryPage]=useState(1);
  const [summaryPageSize,setSummaryPageSize]=useState(5);
  const [breakdownPage,setBreakdownPage]=useState(1);
  const [breakdownPageSize,setBreakdownPageSize]=useState(5);
  const [salarySaved,setSalarySaved]=useState(false);
  const [confirmRecordAgain,setConfirmRecordAgain]=useState(false);
  const [salaryDeleted,setSalaryDeleted]=useState('');
  const [deleteTarget,setDeleteTarget]=useState<SalaryPayment|null>(null);
  const [masterAuth,setMasterAuth]=useState({username:'',password:''});
  const [masterError,setMasterError]=useState('');
  const [masterBusy,setMasterBusy]=useState(false);
  const payLock=useRef(false);
  const [workTypeDrafts,setWorkTypeDrafts]=useState<Record<string,WorkType>>({});
  const [menuPos,setMenuPos]=useState<{key:string;x:number;y:number}|null>(null);
  const [viewEntry,setViewEntry]=useState<(WorkEntry&{workType:WorkType;amount:number})|null>(null);
  const [editEntry,setEditEntry]=useState<(WorkEntry&{workType:WorkType;amount:number})|null>(null);
  const [editForm,setEditForm]=useState<{date:string;workTypeId:string;quantity:number;remarks:string}|null>(null);
  const [deleteEntry,setDeleteEntry]=useState<(WorkEntry&{workType:WorkType;amount:number})|null>(null);
  const [newWorkType,setNewWorkType]=useState({code:'',name:'',rate:0,unit:'piece',status:'Active' as 'Active'|'Inactive'});
  const [advanceForm,setAdvanceForm]=useState({date:new Date().toISOString().slice(0,10),employeeId:'',amount:0,mode:'Cash' as 'Cash'|'UPI'|'Bank',remarks:''});
  const [workForm,setWorkForm]=useState({date:new Date().toISOString().slice(0,10),employeeId:'',workTypeId:'',quantity:0,remarks:''});
  const [showSalaryPrint,setShowSalaryPrint]=useState(false);
  const [showWorkBreakdown,setShowWorkBreakdown]=useState(false);
  const [showWorkBreakdownPrint,setShowWorkBreakdownPrint]=useState(false);
  const [breakdownShowRate,setBreakdownShowRate]=useState(true);
  const [viewHistory,setViewHistory]=useState<SalaryPayment|null>(null);
  const [leaveDays,setLeaveDays]=useState(0);
  const [leaveDeductionMode,setLeaveDeductionMode]=useState<LeaveDeductionMode>('None');
  const [manualDeduction,setManualDeduction]=useState(0);
  const [showSalaryPayment,setShowSalaryPayment]=useState(false);
  const [openHistoryAction,setOpenHistoryAction]=useState<string|null>(null);
  const [historyDropdownPos,setHistoryDropdownPos]=useState<{top:number;left:number}|null>(null);
  const [openPriceAction,setOpenPriceAction]=useState<string|null>(null);
  const [priceDropdownPos,setPriceDropdownPos]=useState<{top:number;left:number}|null>(null);
  const [viewPrice,setViewPrice]=useState<GarmentPrice|null>(null);

  useEffect(()=>{
    const handleClose=()=>{
      setOpenHistoryAction(null);
      setHistoryDropdownPos(null);
      setOpenPriceAction(null);
      setPriceDropdownPos(null);
    };
    window.addEventListener('click',handleClose);
    window.addEventListener('scroll',handleClose,true);
    return ()=>{
      window.removeEventListener('click',handleClose);
      window.removeEventListener('scroll',handleClose,true);
    };
  },[]);
  
  const selectedEmp=employees.find(e=>e.id===employeeId);
  const salaryType=selectedEmp?.salaryType||'Piece Rate';

  // Auto-sync attendance absent days when employee, date range, or attendance changes
  useEffect(()=>{
    if(!employeeId||salaryType!=='Fixed Monthly')return;
    const periodAttendance=(attendance||[]).filter(a=>a.employeeId===employeeId&&inRange(a.date,from,to));
    const absentDays=periodAttendance.filter(a=>a.status==='Absent'||a.status==='Leave').length;
    const halfDays=periodAttendance.filter(a=>a.status==='Half Day').length*0.5;
    const totalAbsences=absentDays+halfDays;
    setLeaveDays(totalAbsences);
    if(totalAbsences>0){
      setLeaveDeductionMode('Auto');
    }
  },[employeeId,from,to,attendance,salaryType]);

  const employee=employees.find(e=>e.id===employeeId)||{id:'',name:'No staff selected',mobile:'',address:'',joiningDate:'',type:'Labour',status:'Active'};
  const activeStaff=employees.filter(e=>e.status==='Active');
  const activeWorkTypes=workTypes.filter(w=>w.status==='Active');
  useEffect(()=>{setWorkForm(form=>({...form,employeeId}));setAdvanceForm(form=>({...form,employeeId}))},[employeeId]);
  const periodWork=workEntries.filter(w=>w.employeeId===employeeId&&inRange(w.date,from,to));
  const workRows=periodWork.map(w=>{const wt=workTypes.find(x=>x.id===w.workTypeId)||defaultWorkTypes.find(x=>x.id===w.workTypeId)!;return {...w,workType:wt,amount:w.quantity*wt.rate}});
  const summary=useMemo(()=>workTypes.map(wt=>{const rows=workRows.filter(w=>w.workTypeId===wt.id);const qty=rows.reduce((a,b)=>a+b.quantity,0);return {name:`${workTypeCode(wt)} - ${wt.name}`,qty,rate:wt.rate,amount:qty*wt.rate}}).filter(x=>x.qty>0),[workTypes,workRows]);
  const updateWorkTypeDraft=(workType:WorkType,changes:Partial<WorkType>)=>setWorkTypeDrafts(current=>{const base=current[workType.id]||workType;return {...current,[workType.id]:{...base,...changes,rate:changes.rate===undefined?base.rate:Number(changes.rate)}}});
  const clearWorkTypeDraft=(id:string)=>setWorkTypeDrafts(current=>{const next={...current};delete next[id];return next});
  const saveWorkType=(id:string)=>{const draft=workTypeDrafts[id];const original=workTypes.find(w=>w.id===id);if(!draft||!original||!draft.name.trim())return;const clean={...draft,name:draft.name.trim(),code:String(draft.code||'').trim(),unit:String(draft.unit||'piece').trim(),rate:Number(draft.rate)||0};const changed=['name','code','rate','unit','status'].filter(key=>String(original[key as keyof WorkType]??'')!==String(clean[key as keyof WorkType]??''));if(changed.length){setWorkTypes(current=>current.map(w=>w.id===id?clean:w));setWorkTypeHistory(history=>[[new Date().toLocaleString(),`${workTypeCode(original)} - ${original.name}`,changed.join(', '),money(Number(original.rate)),money(Number(clean.rate)),clean.status],...history])}clearWorkTypeDraft(id)};
  const deleteWorkType=(workType:WorkType)=>{const usedCount=workEntries.filter(entry=>entry.workTypeId===workType.id).length;if(usedCount){window.alert(`${workTypeCode(workType)} - ${workType.name} is used in ${usedCount} daily work entr${usedCount===1?'y':'ies'}. Please mark it Inactive instead of deleting.`);return}if(!window.confirm(`Delete work type ${workTypeCode(workType)} - ${workType.name}?`))return;setWorkTypes(current=>current.filter(w=>w.id!==workType.id));clearWorkTypeDraft(workType.id);setWorkTypeHistory(history=>[[new Date().toLocaleString(),`${workTypeCode(workType)} - ${workType.name}`,'Deleted',money(workType.rate),'-',workType.status],...history])};
  const startEditEntry=(entry:WorkEntry&{workType:WorkType;amount:number})=>{setEditEntry(entry);setEditForm({date:entry.date,workTypeId:entry.workTypeId,quantity:entry.quantity,remarks:entry.remarks})};
  const saveEditedEntry=()=>{if(!editEntry||!editForm||!editForm.workTypeId||editForm.quantity<=0)return;const updated={...editEntry,date:editForm.date,workTypeId:editForm.workTypeId,quantity:Number(editForm.quantity),remarks:editForm.remarks};setWorkEntries(current=>current.map(w=>w.id===updated.id?updated:w));setEditEntry(null);setEditForm(null)};
  const confirmDeleteEntry=()=>{if(!deleteEntry)return;setWorkEntries(current=>current.filter(w=>w.id!==deleteEntry.id));setDeleteEntry(null)};
  const addWorkType=()=>{if(!newWorkType.name.trim())return;const created={id:nextEntryId(workTypes,'WT'),code:newWorkType.code.trim()||String(workTypes.length+1),name:newWorkType.name.trim(),rate:Number(newWorkType.rate)||0,unit:newWorkType.unit||'piece',status:newWorkType.status};setWorkTypes(current=>[...current,created]);setWorkTypeHistory(history=>[[new Date().toLocaleString(),`${workTypeCode(created)} - ${created.name}`,'Created','-',money(created.rate),created.status],...history]);setNewWorkType({code:'',name:'',rate:0,unit:'piece',status:'Active'})};
  const nextEntryId=(entries:ReadonlyArray<{id?:string}>,prefix:string)=>`${prefix}-${String(entries.reduce((max,entry)=>{const n=Number(String(entry.id||'').replace(/\D/g,''));return Number.isFinite(n)&&n>max?n:max},0)+1).padStart(3,'0')}`;
  const addAdvance=()=>{if(!advanceForm.employeeId||advanceForm.amount<=0){window.alert('Select an employee and enter an advance amount greater than zero.');return}setAdvances(current=>[{id:nextEntryId(current,'ADV'),...advanceForm,amount:Number(advanceForm.amount)},...current]);setEmployeeId(advanceForm.employeeId);setAdvanceForm({...advanceForm,amount:0,remarks:''})};
  const addWorkEntry=()=>{if(!workForm.employeeId||!workForm.workTypeId||workForm.quantity<=0){window.alert('Select an employee, a work type, and enter a quantity greater than zero.');return}setWorkEntries(current=>[{id:nextEntryId(current,'DW'),...workForm,quantity:Number(workForm.quantity)},...current]);setEmployeeId(workForm.employeeId);setWorkForm({...workForm,quantity:0,remarks:''})};
  
  const totalProduction=periodWork.reduce((a,w)=>a+w.quantity,0);
  const periodAttendance = useMemo(() => {
    return (attendance || []).filter(a => a.employeeId === employeeId && inRange(a.date, from, to));
  }, [attendance, employeeId, from, to]);
  const attendancePresentDays = periodAttendance.filter(a => a.status === 'Present').length;
  const attendanceHalfDays = periodAttendance.filter(a => a.status === 'Half Day').length * 0.5;
  const attendanceWorkedDays = attendancePresentDays + attendanceHalfDays;
  const workedDaysCount = attendanceWorkedDays > 0 ? attendanceWorkedDays : new Set(periodWork.map(w => w.date)).size;
  const pieceWorkTotal=summary.reduce((a,b)=>a+b.amount,0);
  const fixedMonthlySalary=selectedEmp?.monthlySalary||0;
  const dailyWageRate=selectedEmp?.dailyRate||0;
  
  const autoLeaveDeduction=Math.round(leaveDays*(fixedMonthlySalary/30));
  const leaveDeductionAmount=leaveDeductionMode==='Auto'?autoLeaveDeduction:leaveDeductionMode==='Manual'?manualDeduction:0;
  const grossBeforeDeduction=salaryType==='Fixed Monthly'?fixedMonthlySalary:salaryType==='Daily Wage'?(dailyWageRate*workedDaysCount):pieceWorkTotal;
  const totalWork=Math.max(0,grossBeforeDeduction-(salaryType==='Fixed Monthly'?leaveDeductionAmount:0));

  const advancesBefore=advances.filter(a=>a.employeeId===employeeId&&a.date<from).reduce((a,b)=>a+b.amount,0);
  const priorRecoveries=salaryHistory.filter(s=>s.employeeId===employeeId&&s.to<from).reduce((a,b)=>a+b.recover,0);
  const openingAdvance=Math.max(0,advancesBefore-priorRecoveries);
  const advanceDuring=advances.filter(a=>a.employeeId===employeeId&&inRange(a.date,from,to)).reduce((a,b)=>a+b.amount,0);
  const pendingAdvance=openingAdvance+advanceDuring;
  const maxRecover=Math.min(totalWork,pendingAdvance);
  const safeRecover=Math.min(Math.max(0,recover),maxRecover);
  const netPayable=totalWork-safeRecover;
  const closingAdvance=pendingAdvance-safeRecover;
  const ledger=[
    ...advances.filter(a=>a.employeeId===employeeId&&a.date<=to).map(a=>({date:a.date,type:'Advance Given',amount:a.amount,delta:a.amount})),
    ...salaryHistory.filter(s=>s.employeeId===employeeId&&s.to<=to).map(s=>({date:s.paidDate,type:'Advance Recovered',amount:s.recover,delta:-s.recover})),
    {date:to,type:'Current Salary Recovery',amount:safeRecover,delta:-safeRecover}
  ].sort((a,b)=>a.date.localeCompare(b.date));
  let ledgerBalance=0;
  const ledgerRows=ledger.map(l=>{ledgerBalance=Math.max(0,ledgerBalance+l.delta);return [l.date,l.type,money(l.amount),money(ledgerBalance)]});
  const employeeSalaryRows=[employee].map(e=>{const rows=workEntries.filter(w=>w.employeeId===e.id&&inRange(w.date,from,to));const gross=rows.reduce((sum,w)=>{const wt=workTypes.find(x=>x.id===w.workTypeId)||defaultWorkTypes.find(x=>x.id===w.workTypeId)!;return sum+w.quantity*wt.rate},0);const adv=advances.filter(a=>a.employeeId===e.id&&a.date<=to).reduce((a,b)=>a+b.amount,0);const rec=safeRecover;return [e.name,money(gross),money(adv),money(rec),money(Math.max(0,gross-rec))]});
  const workReportPageCount=Math.max(1,Math.ceil(workRows.length/workReportPageSize));
  const summaryPageCount=Math.max(1,Math.ceil(summary.length/summaryPageSize));
  const pagedWorkRows=workRows.slice((workReportPage-1)*workReportPageSize,workReportPage*workReportPageSize);
  const pagedSummary=summary.slice((summaryPage-1)*summaryPageSize,summaryPage*summaryPageSize);
  const breakdownPageCount=Math.max(1,Math.ceil(workRows.length/breakdownPageSize));
  const safeBreakdownPage=Math.min(breakdownPage,breakdownPageCount);
  const pagedBreakdownRows=workRows.slice((safeBreakdownPage-1)*breakdownPageSize,safeBreakdownPage*breakdownPageSize);
  const workTypePageCount=Math.max(1,Math.ceil(workTypes.length/workTypePageSize));
  const safeWorkTypePage=Math.min(Math.max(1,workTypePage),workTypePageCount);
  const pagedWorkTypes=useMemo(()=>{
    const start=(safeWorkTypePage-1)*workTypePageSize;
    return workTypes.slice(start,start+workTypePageSize);
  },[workTypes,safeWorkTypePage,workTypePageSize]);
  useEffect(()=>{setWorkReportPage(1);setSummaryPage(1);setBreakdownPage(1)},[employeeId,from,to]);
  useEffect(()=>{setMenuPos(null);setViewEntry(null);setEditEntry(null);setEditForm(null);setDeleteEntry(null)},[employeeId,from,to]);
  useEffect(()=>{const close=()=>setMenuPos(null);window.addEventListener('click',close);window.addEventListener('pointerdown',close);return()=>{window.removeEventListener('click',close);window.removeEventListener('pointerdown',close);}},[]);
  useEffect(()=>{setWorkReportPage(page=>Math.min(page,workReportPageCount));setSummaryPage(page=>Math.min(page,summaryPageCount));setBreakdownPage(page=>Math.min(page,breakdownPageCount));setWorkTypePage(p=>Math.min(Math.max(1,p),workTypePageCount))},[workReportPageCount,summaryPageCount,breakdownPageCount,workTypePageCount]);

  const filteredGarmentPrices = useMemo(() => {
    return garmentPrices.filter(p => {
      if (garmentPriceFilterGarment !== 'All' && p.garmentType !== garmentPriceFilterGarment) return false;
      if (garmentPriceFilterQuality !== 'All' && p.quality !== garmentPriceFilterQuality) return false;
      if (garmentPriceSearch.trim()) {
        const q = garmentPriceSearch.trim().toLowerCase();
        const matches = p.garmentType.toLowerCase().includes(q) ||
          p.size.toLowerCase().includes(q) ||
          p.quality.toLowerCase().includes(q) ||
          String(p.price).includes(q) ||
          (p.remarks || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [garmentPrices, garmentPriceFilterGarment, garmentPriceFilterQuality, garmentPriceSearch]);

  const garmentPricePageCount = Math.max(1, Math.ceil(filteredGarmentPrices.length / garmentPricePageSize));
  const safeGarmentPricePage = Math.min(Math.max(1, garmentPricePage), garmentPricePageCount);
  const pagedGarmentPrices = useMemo(() => {
    const start = (safeGarmentPricePage - 1) * garmentPricePageSize;
    return filteredGarmentPrices.slice(start, start + garmentPricePageSize);
  }, [filteredGarmentPrices, safeGarmentPricePage, garmentPricePageSize]);

  useEffect(() => {
    setGarmentPricePage(p => Math.min(Math.max(1, p), garmentPricePageCount));
  }, [garmentPricePageCount]);

  const handleAddGarmentPrice = () => {
    if (!newGarmentPrice.garmentType.trim() || !newGarmentPrice.size.trim() || newGarmentPrice.price <= 0) {
      window.alert('Please enter Garment Type, Size, and a Price greater than 0.');
      return;
    }
    const id = `GP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const created: GarmentPrice = {
      id,
      quality: newGarmentPrice.quality.trim() || 'Standard',
      garmentType: newGarmentPrice.garmentType.trim(),
      size: newGarmentPrice.size.trim(),
      price: Number(newGarmentPrice.price),
      remarks: newGarmentPrice.remarks?.trim() || ''
    };
    setGarmentPrices(current => [created, ...current]);
    setNewGarmentPrice(prev => ({ ...prev, price: 0, remarks: '' }));
    setGarmentPriceSuccess(`Added price for ${created.garmentType} (Size ${created.size}) — ${money(created.price)}.`);
    setTimeout(() => setGarmentPriceSuccess(''), 3500);
  };

  const handleSaveEditGarmentPrice = () => {
    if (!editGarmentPriceDraft || !editGarmentPriceDraft.garmentType.trim() || !editGarmentPriceDraft.size.trim() || editGarmentPriceDraft.price <= 0) {
      window.alert('Please enter Garment Type, Size, and a Price greater than 0.');
      return;
    }
    setGarmentPrices(current => current.map(p => p.id === editGarmentPriceDraft.id ? {
      ...editGarmentPriceDraft,
      quality: editGarmentPriceDraft.quality.trim() || 'Standard',
      garmentType: editGarmentPriceDraft.garmentType.trim(),
      size: editGarmentPriceDraft.size.trim(),
      price: Number(editGarmentPriceDraft.price),
      remarks: editGarmentPriceDraft.remarks?.trim() || ''
    } : p));
    setEditingPriceId(null);
    setEditGarmentPriceDraft(null);
    setGarmentPriceSuccess('Garment price updated successfully.');
    setTimeout(() => setGarmentPriceSuccess(''), 3500);
  };

  const handleDeleteGarmentPrice = (item: GarmentPrice) => {
    if (!window.confirm(`Delete price for ${item.garmentType} (Size ${item.size}, ${item.quality}) — ${money(item.price)}?`)) return;
    setGarmentPrices(current => current.filter(p => p.id !== item.id));
    if (editingPriceId === item.id) {
      setEditingPriceId(null);
      setEditGarmentPriceDraft(null);
    }
    setGarmentPriceSuccess(`Deleted price entry for ${item.garmentType} (Size ${item.size}).`);
    setTimeout(() => setGarmentPriceSuccess(''), 3500);
  };
  const renderWorkTypeRow=(w:WorkType)=>{const draft=workTypeDrafts[w.id]||w;const changed=!!workTypeDrafts[w.id];return <div key={w.id} className={changed?'master-row draft-master-row':'master-row'}><input value={draft.name} onChange={e=>updateWorkTypeDraft(w,{name:e.target.value})}/><input value={workTypeCode(draft)} onChange={e=>updateWorkTypeDraft(w,{code:e.target.value})}/><input type="number" min="0" value={draft.rate} onChange={e=>updateWorkTypeDraft(w,{rate:Number(e.target.value)})}/><input value={draft.unit} onChange={e=>updateWorkTypeDraft(w,{unit:e.target.value})}/><select value={draft.status} onChange={e=>updateWorkTypeDraft(w,{status:e.target.value as 'Active'|'Inactive'})}><option>Active</option><option>Inactive</option></select><div className="row-actions"><button className="save-btn" disabled={!changed} onClick={()=>saveWorkType(w.id)}><Save size={14}/> Save</button>{changed&&<button className="outline mini-action" onClick={()=>clearWorkTypeDraft(w.id)}>Cancel</button>}<button className="danger-btn" onClick={()=>deleteWorkType(w)}>Delete</button></div></div>};
  const renderWorkEntryRow=(w:WorkEntry&{workType:WorkType;amount:number})=>{const open=menuPos?.key===w.id;return <tr key={w.id}><td>{w.date}</td><td><strong>{employee.name}</strong></td><td><strong>{workTypeCode(w.workType)} - {w.workType.name}</strong></td><td>{w.quantity}</td><td>{money(w.workType.rate)}</td><td><strong>{money(w.amount)}</strong></td><td>{w.remarks||'-'}</td><td><div className="action-menu"><button className="action-menu-btn" title="Actions" onClick={e=>{e.stopPropagation();if(open){setMenuPos(null)}else{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPos({key:w.id,x:Math.min(r.right-132,window.innerWidth-150),y:r.bottom+5})}}}>⋯</button>{open&&<div className="action-menu-drop" style={{left:menuPos.x,top:menuPos.y}} onClick={e=>e.stopPropagation()}><button onClick={()=>{setViewEntry(w);setMenuPos(null)}}><Eye size={14}/> View</button><button onClick={()=>{startEditEntry(w);setMenuPos(null)}}><Pencil size={14}/> Edit</button><button className="danger" onClick={()=>{setDeleteEntry(w);setMenuPos(null)}}><Trash2 size={14}/> Delete</button></div>}</div></td></tr>};
  const nextSalId=`SAL-${String(salaryHistory.length+1).padStart(3,'0')}`;
  
  const slipDoc=(p:SalaryPayment,no=p.id)=>{
    const emp=employees.find(e=>e.id===p.employeeId)||selectedEmp||{id:'',name:'-',type:'-',mobile:'-',address:'',joiningDate:'',status:'Active' as const,dailyRate:0,monthlySalary:0};
    const daysWorked=p.workedDays??(p.id==='CURRENT'?workedDaysCount:0);
    const st=p.salaryType||(p.id==='CURRENT'?salaryType:'Piece Rate');
    const salaryTypeLabel=st==='Fixed Monthly'?'Fixed Monthly':st==='Daily Wage'?'Daily Wage':'Piece Rate';
    const lDays=p.leaveDays??(p.id==='CURRENT'?leaveDays:0);
    const lDeduct=p.leaveDeductionAmount??(p.id==='CURRENT'?leaveDeductionAmount:0);

    return <div className="tax-doc salary-doc"><SalaryPrintHeader company={company}/><h1>SALARY SLIP</h1><div className="doc-meta salary-meta"><div><b>Slip No</b><span>{no}</span></div><div><b>Pay Period</b><span>{p.from} to {p.to}</span></div><div><b>Salary Type</b><span>{salaryTypeLabel}</span></div><div><b>Days Worked</b><span>{daysWorked} Days</span></div><div><b>Pieces Completed</b><span>{p.pieces} pcs</span></div><div><b>Payment Mode</b><span>{p.mode}</span></div></div><div className="doc-parties"><div><h3>EMPLOYEE DETAILS</h3><p><strong>{emp.name}</strong></p><p>Employee ID: {p.employeeId}</p><p>Category: {emp.type}</p><p>Salary Structure: <strong>{salaryTypeLabel}</strong></p></div><div><h3>PAYMENT SUMMARY</h3><p>Gross work salary: <strong>{money(p.gross)}</strong></p><p>Opening advance balance: {money(p.openingAdvance)}</p><p>Advance during period: {money(p.advanceDuring)}</p><p>Pending advance before recovery: {money(p.pendingAdvance)}</p></div></div><div className="salary-breakup"><table className="doc-table"><thead><tr><th>EARNINGS TYPE</th><th>CALCULATION DETAIL</th><th>AMOUNT</th></tr></thead><tbody><tr><td>{salaryTypeLabel} ({p.from} to {p.to})</td><td>{st==='Fixed Monthly'?`Base Monthly Pay (${money(emp.monthlySalary||fixedMonthlySalary)})`:st==='Daily Wage'?`Daily Rate (${money(emp.dailyRate||dailyWageRate)}/day × ${daysWorked} Days)`:`${daysWorked} Days • ${p.pieces} pcs`}</td><td>{money(st==='Fixed Monthly'?(emp.monthlySalary||fixedMonthlySalary):p.gross)}</td></tr>{st==='Fixed Monthly'&&lDeduct>0&&<tr><td>Less: Leave Deduction</td><td>{lDays} Days absent ({p.leaveDeductionMode==='Auto'?`Auto: ${money(emp.monthlySalary||fixedMonthlySalary)}/30 per day`:'Manual deduction'})</td><td>- {money(lDeduct)}</td></tr>}<tr className="salary-breakup-total"><td colSpan={2}>Total Gross Earnings</td><td>{money(p.gross)}</td></tr></tbody></table><table className="doc-table"><thead><tr><th>DEDUCTIONS</th><th>AMOUNT</th></tr></thead><tbody><tr><td>Advance recovered</td><td>{money(p.recover)}</td></tr><tr className="salary-breakup-total"><td>Total Deductions</td><td>{money(p.recover)}</td></tr></tbody></table></div><div className="doc-totals salary-total"><div><p>Net salary paid<strong>{money(p.netPayable)}</strong></p></div><div><p>Closing advance balance<strong>{money(p.closingAdvance)}</strong></p></div></div><div className="doc-footer salary-footer"><div><h3>Authorised Signatory</h3><span>Garment Production ERP</span></div><div><h3>Employee Signature</h3></div></div><div className="doc-top-note"><p>{p.remarks||`${salaryTypeLabel} salary generated for pay period.`}</p></div><SalaryPrintFooter/></div>;
  };
  
  const salaryDoc=slipDoc({id:'CURRENT',paidDate:new Date().toISOString().slice(0,10),employeeId,from,to,recover:safeRecover,mode,remarks:'',gross:totalWork,openingAdvance,advanceDuring,pendingAdvance,netPayable,closingAdvance,pieces:totalProduction,workedDays:workedDaysCount,salaryType,leaveDays,leaveDeductionMode,leaveDeductionAmount},nextSalId);
  const workBreakdownDoc=<div className="tax-doc salary-doc"><SalaryPrintHeader company={company}/><h1>SALARY WORK BREAKDOWN</h1><div className="doc-meta salary-meta"><div><b>Employee</b><span>{employee.name}</span></div><div><b>Period</b><span>{from} to {to}</span></div><div><b>Salary Structure</b><span>{salaryType}</span></div><div><b>Worked Days</b><span>{workedDaysCount} Days</span></div><div><b>Total Entries</b><span>{workRows.length}</span></div></div><div className="doc-parties"><div><h3>EMPLOYEE</h3><p><strong>{employee.name}</strong></p><p>Employee ID: {employee.id}</p><p>Category: {employee.type}</p><p>Mobile: {employee.mobile}</p></div><div><h3>SUMMARY</h3><p>Total work amount: <strong>{money(totalWork)}</strong></p><p>Total pieces: <strong>{totalProduction}</strong></p></div></div><div className="salary-breakup"><table className="doc-table"><thead><tr><th>DATE</th><th>WORK TYPE</th><th>QTY</th>{breakdownShowRate&&<th>RATE</th>}<th>AMOUNT</th></tr></thead><tbody>{workRows.map(w=><tr key={w.id}><td>{w.date}</td><td><strong>{workTypeCode(w.workType)} - {w.workType.name}</strong></td><td>{w.quantity}</td>{breakdownShowRate&&<td>{money(w.workType.rate)}</td>}<td><strong>{money(w.amount)}</strong></td></tr>)}{!workRows.length&&<tr><td colSpan={breakdownShowRate?5:4} style={{textAlign:'center'}}>No work entries found for this employee and period.</td></tr>}</tbody></table></div><div className="doc-totals salary-total"><div><p>Total work amount<strong>{money(totalWork)}</strong></p></div></div><div className="doc-footer salary-footer"><div><h3>Authorised Signatory</h3><span>Garment Production ERP</span></div></div><div className="doc-top-note">Daily work breakdown for salary calculation.</div><SalaryPrintFooter/></div>;
  const filteredSalaryHistory = useMemo(() => {
    return salaryHistory.filter(s => (!employeeId || s.employeeId === employeeId) && typeof s.gross === 'number');
  }, [salaryHistory, employeeId]);

  const salaryHistoryRows = useMemo(() => {
    return filteredSalaryHistory.map(s => {
      const emp = employees.find(e => e.id === s.employeeId);
      const empName = emp ? emp.name : (s.employeeId || '-');
      return [
        s.id,
        empName,
        s.paidDate,
        `${s.from} to ${s.to}`,
        s.salaryType || 'Piece Rate',
        s.workedDays ? `${s.workedDays} Days` : '-',
        `${s.pieces} pcs`,
        money(s.gross),
        money(s.recover),
        money(s.netPayable),
        s.mode
      ];
    });
  }, [filteredSalaryHistory, employees]);
  
  const recordSalary=()=>{
    const record:SalaryPayment={
      id:nextSalId,
      paidDate:new Date().toISOString().slice(0,10),
      employeeId,
      from,
      to,
      recover:safeRecover,
      mode,
      remarks:leaveDeductionAmount>0?`Salary ${from} to ${to} paid (Fixed Monthly - ${money(leaveDeductionAmount)} leave deduction)`:`Salary ${from} to ${to} paid (${salaryType})`,
      gross:totalWork,
      openingAdvance,
      advanceDuring,
      pendingAdvance,
      netPayable,
      closingAdvance,
      pieces:totalProduction,
      workedDays:workedDaysCount,
      salaryType,
      leaveDays,
      leaveDeductionMode,
      leaveDeductionAmount
    };
    setSalaryHistory(current=>[record,...current]);
    setSalarySaved(true);
    window.setTimeout(()=>setSalarySaved(false),4000);
  };

  const paySalary=()=>{if(payLock.current)return;payLock.current=true;window.setTimeout(()=>{payLock.current=false},800);if(netPayable<=0)return;if(salaryHistory.some(s=>s.employeeId===employeeId&&s.from===from&&s.to===to)){setConfirmRecordAgain(true);return}recordSalary()};
  const confirmMasterDelete=async()=>{if(!deleteTarget)return;setMasterBusy(true);setMasterError('');try{const updated=await deleteSalaryPayment(deleteTarget.id,masterAuth.username,masterAuth.password);setSalaryHistory(updated);setDeleteTarget(null);setMasterAuth({username:'',password:''});setSalaryDeleted(deleteTarget.id);window.setTimeout(()=>setSalaryDeleted(''),4000)}catch(error){setMasterError(error instanceof Error?error.message:'Delete failed — only master can delete salary slips')}finally{setMasterBusy(false)}};
  const editWorkType=editForm?workTypes.find(wt=>wt.id===editForm.workTypeId)||editEntry?.workType:null;
  const editAmount=editForm&&editWorkType?Number(editForm.quantity||0)*editWorkType.rate:0;
  return <section className="content wage-workspace">
    <div className="measurement-tabs wage-tabs"><button className={wageTab==='work'?'active':''} onClick={()=>setWageTab('work')}><ClipboardList size={16}/><span>Work Entry<small>daily work + summary</small></span></button><button className={wageTab==='advance'?'active':''} onClick={()=>setWageTab('advance')}><WalletCards size={16}/><span>Advance<small>payment + history</small></span></button><button className={wageTab==='salary'?'active':''} onClick={()=>setWageTab('salary')}><Calculator size={16}/><span>Salary<small>payment slip</small></span></button><button className={wageTab==='history'?'active':''} onClick={()=>setWageTab('history')}><ReceiptText size={16}/><span>Salary History<small>{salaryHistory.length} slips</small></span></button><button className={wageTab==='masters'?'active':''} onClick={()=>setWageTab('masters')}><Settings size={16}/><span>Masters<small>work type rates</small></span></button><button className={wageTab==='reports'?'active':''} onClick={()=>setWageTab('reports')}><BarChart3 size={16}/><span>Reports<small>production + ledger</small></span></button></div>
    {wageTab!=='masters'&&<div className="filterbar salary-filter compact-wage-filter"><label>Employee<select value={employeeId} onChange={e=>{const id=e.target.value;setEmployeeId(id);setWorkForm(f=>({...f,employeeId:id}));}}><option value="">All Staff / Select employee</option>{activeStaff.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{wageTab==="salary"&&<>{salaryType==='Fixed Monthly'&&<><label>Leave / Absent Days<input type="number" min="0" style={{width:'90px'}} value={leaveDays} onChange={e=>setLeaveDays(Number(e.target.value))}/></label><label>Leave Deduction Option<select value={leaveDeductionMode} onChange={e=>setLeaveDeductionMode(e.target.value as LeaveDeductionMode)}><option value="None">No Deduction (Full Pay)</option><option value="Auto">Automatic (Sal / 30 per day)</option><option value="Manual">Manual Deduction Entry</option></select></label>{leaveDeductionMode==='Manual'&&<label>Deduct Amount (Rs.)<input type="number" min="0" style={{width:'110px'}} value={manualDeduction} onChange={e=>setManualDeduction(Number(e.target.value))}/></label>}</>}<label>Recover this month<input type="number" min="0" value={recover} onChange={e=>setRecover(Number(e.target.value))}/></label><label>Payment mode<select value={mode} onChange={e=>setMode(e.target.value as "Cash"|"UPI"|"Bank")}><option>Cash</option><option>UPI</option><option>Bank</option></select></label><div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}><button type="button" className="primary" style={{ margin: 0, whiteSpace: 'nowrap' }} onClick={()=>setShowWorkBreakdown(v=>!v)}><Calculator size={16}/> Calculate salary</button><button type="button" className={showSalaryPayment ? "primary" : "outline"} style={{ margin: 0, whiteSpace: 'nowrap' }} onClick={()=>setShowSalaryPayment(v=>!v)} title="Open / Hide Salary payment screen"><ReceiptText size={16}/> Salary payment screen</button></div></>}</div>}
    {wageTab==='work'&&<><div className="advance-grid">
      <article className="card salary-panel"><div className="cardhead"><div><h2>Daily work entry</h2><p>Enter one completed work type at a time for each staff member.</p></div><ClipboardList size={18}/></div><div className="advance-form"><label>Date<input type="date" value={workForm.date} onChange={e=>setWorkForm({...workForm,date:e.target.value})}/></label><label>Employee<select value={workForm.employeeId} onChange={e=>{const id=e.target.value;setWorkForm({...workForm,employeeId:id});setEmployeeId(id);}}><option value="">Select employee</option>{activeStaff.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label><label>Work code<select value={workForm.workTypeId} onChange={e=>setWorkForm({...workForm,workTypeId:e.target.value})}><option value="">Select work type</option>{activeWorkTypes.map(w=><option value={w.id} key={w.id}>{workTypeCode(w)}</option>)}</select></label><label>Work type<select value={workForm.workTypeId} onChange={e=>setWorkForm({...workForm,workTypeId:e.target.value})}><option value="">Select work type</option>{activeWorkTypes.map(w=><option value={w.id} key={w.id}>{workTypeCode(w)} - {w.name} - {money(w.rate)} / {w.unit}</option>)}</select></label><label>Quantity<input type="number" min="0" value={workForm.quantity} onChange={e=>setWorkForm({...workForm,quantity:Number(e.target.value)})}/></label><label className="wide">Remarks<input value={workForm.remarks} onChange={e=>setWorkForm({...workForm,remarks:e.target.value})} placeholder="Batch, order, or notes"/></label><button className="primary" onClick={addWorkEntry}><Plus size={16}/> Add work</button></div></article>
      <Table title="Daily work entry history" copy={`Saved entries for ${employee.name} in the selected date range`} headers={['ENTRY ID','DATE','EMPLOYEE','WORK TYPE','QTY','AMOUNT']} rows={periodWork.map(w=>{const wt=workTypes.find(x=>x.id===w.workTypeId)||defaultWorkTypes.find(x=>x.id===w.workTypeId)!;return [w.id,w.date,employee.name,`${workTypeCode(wt)} - ${wt.name}`,String(w.quantity),money(w.quantity*wt.rate)]})} paged/>
    </div><article className="card jobs module-table editable-work-report"><div className="cardhead"><div><h2>Daily employee work report</h2><p>Use Actions to view, edit or delete an entry.</p></div></div><table><thead><tr><th>DATE</th><th>EMPLOYEE</th><th>WORK TYPE</th><th>QUANTITY</th><th>RATE</th><th>AMOUNT</th><th>REMARKS</th><th>ACTION</th></tr></thead><tbody>{pagedWorkRows.map(renderWorkEntryRow)}{!workRows.length&&<tr><td colSpan={8}>No work entries found for this employee and date range.</td></tr>}</tbody></table><div className="table-footer paginated-footer"><span>Showing {workRows.length?((workReportPage-1)*workReportPageSize)+1:0}-{Math.min(workReportPage*workReportPageSize,workRows.length)} of {workRows.length} work entries</span><div className="pager"><label>Rows<select value={workReportPageSize} onChange={e=>{setWorkReportPageSize(Number(e.target.value));setWorkReportPage(1)}}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><button className="outline" disabled={workReportPage===1} onClick={()=>setWorkReportPage(page=>Math.max(1,page-1))}>Prev</button><span>Page {workReportPage} / {workReportPageCount}</span><button className="outline" disabled={workReportPage===workReportPageCount} onClick={()=>setWorkReportPage(page=>Math.min(workReportPageCount,page+1))}>Next</button></div></div></article><article className="card jobs module-table"><div className="cardhead"><div><h2>Employee work summary</h2><p>Work-type-wise salary calculation for the selected employee and date range</p></div></div><table><thead><tr><th>WORK TYPE</th><th>TOTAL QTY</th><th>RATE</th><th>TOTAL AMOUNT</th></tr></thead><tbody>{pagedSummary.map(s=><tr key={s.name}><td><strong>{s.name}</strong></td><td>{String(s.qty)}</td><td>{money(s.rate)}</td><td>{money(s.amount)}</td></tr>)}{!summary.length&&<tr><td colSpan={4}>No summary found for this employee and date range.</td></tr>}</tbody></table><div className="table-footer paginated-footer"><span>Showing {summary.length?((summaryPage-1)*summaryPageSize)+1:0}-{Math.min(summaryPage*summaryPageSize,summary.length)} of {summary.length} work types</span><div className="pager"><label>Rows<select value={summaryPageSize} onChange={e=>{setSummaryPageSize(Number(e.target.value));setSummaryPage(1)}}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><button className="outline" disabled={summaryPage===1} onClick={()=>setSummaryPage(page=>Math.max(1,page-1))}>Prev</button><span>Page {summaryPage} / {summaryPageCount}</span><button className="outline" disabled={summaryPage===summaryPageCount} onClick={()=>setSummaryPage(page=>Math.min(summaryPageCount,page+1))}>Next</button></div></div></article></>}
    {wageTab==='advance'&&<div className="advance-grid">
      <article className="card salary-panel"><div className="cardhead"><div><h2>Advance payment</h2><p>Add employee advance here. It is not deducted until recovery is entered in salary.</p></div><WalletCards size={18}/></div><div className="advance-form"><label>Date<input type="date" value={advanceForm.date} onChange={e=>setAdvanceForm({...advanceForm,date:e.target.value})}/></label><label>Employee<select value={advanceForm.employeeId} onChange={e=>setAdvanceForm({...advanceForm,employeeId:e.target.value})}><option value="">Select employee</option>{activeStaff.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label><label>Advance amount<input type="number" min="0" value={advanceForm.amount} onChange={e=>setAdvanceForm({...advanceForm,amount:Number(e.target.value)})}/></label><label>Payment mode<select value={advanceForm.mode} onChange={e=>setAdvanceForm({...advanceForm,mode:e.target.value as 'Cash'|'UPI'|'Bank'})}><option>Cash</option><option>UPI</option><option>Bank</option></select></label><label className="wide">Remarks<input value={advanceForm.remarks} onChange={e=>setAdvanceForm({...advanceForm,remarks:e.target.value})} placeholder="Optional"/></label><button className="primary" onClick={addAdvance}><Plus size={16}/> Add advance</button></div></article>
      <Table paged={true} title="Advance payment history" copy={`Advance entries for ${employee.name} in the selected date range`} headers={['DATE','EMPLOYEE','AMOUNT','MODE','REMARKS']} rows={advances.filter(a=>a.employeeId===employeeId&&inRange(a.date,from,to)).map(a=>[a.date,employee.name,money(a.amount),a.mode,a.remarks||'-'])}/>
    </div>}
    {wageTab==='salary'&&<>
      {salaryType==='Fixed Monthly'&&(
        <div style={{background:'#f0fdf4',color:'#166534',padding:'12px 16px',borderRadius:'8px',marginBottom:'16px',fontSize:'0.92rem',display:'flex',alignItems:'center',justifyContent:'space-between',border:'1px solid #bbf7d0',flexWrap:'wrap',gap:'8px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <Calculator size={18}/>
            <span>
              <strong>Fixed Monthly Salary ({money(fixedMonthlySalary)}/mo):</strong>{' '}
              {leaveDeductionMode==='Auto'
                ?`Auto-detected ${leaveDays} days absent from Attendance. Deducting ${money(autoLeaveDeduction)} (${leaveDays} days × ${money(Math.round(fixedMonthlySalary/30))}/day).`
                :leaveDeductionMode==='Manual'
                  ?`Manual Deduction: Deducting ${money(manualDeduction)} for ${leaveDays} days absent.`
                  :`Paying Full Salary (${money(fixedMonthlySalary)}) with 0 leave deduction.`}
            </span>
          </div>
          <span style={{fontWeight:600,background:'#ffffff',padding:'4px 12px',borderRadius:'6px',border:'1px solid #bbf7d0',color:'#15803d'}}>
            Work Amount: {money(totalWork)}
          </span>
        </div>
      )}
      <Stats className="salary-tab-metrics" values={[[ 'Total Work Amount',money(totalWork),salaryType==='Fixed Monthly'?(leaveDeductionAmount>0?`${money(fixedMonthlySalary)} base - ${money(leaveDeductionAmount)} leave`:`${money(fixedMonthlySalary)} monthly base`):`${workRows.length} daily entries`],[ 'Pending Advance',money(pendingAdvance),`${money(openingAdvance)} opening + ${money(advanceDuring)}`],[ 'Net Salary Payable',money(netPayable),`${money(safeRecover)} recovery`],[ 'Closing Advance',money(closingAdvance),'after manual recovery' ]]}/>
      {recover!==safeRecover&&<div className="salary-warning"><AlertTriangle size={16}/> Recover amount is limited to the lower of total work amount and pending advance: {money(maxRecover)}.</div>}
      {salarySaved&&<div className="salary-success"><CheckCircle2 size={16}/> Salary for {employee.name} recorded for {from} to {to}. {money(netPayable)} paid & slip added to Salary History.</div>}
      {showWorkBreakdown&&<div className="salary-breakdown">
        <article className="card jobs module-table"><div className="cardhead"><div><h2>Salary work breakdown</h2><p>{employee.name} • {from} to {to} • {workRows.length} daily entries</p></div><div className="salary-panel-actions"><label className="print-option"><input type="checkbox" checked={breakdownShowRate} onChange={e=>setBreakdownShowRate(e.target.checked)}/> Rate</label><button className="print-btn no-print" onClick={()=>setShowWorkBreakdownPrint(true)}><Printer size={16}/> Print breakdown</button></div></div><table><thead><tr><th>DATE</th><th>WORK TYPE</th><th>QUANTITY</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>{pagedBreakdownRows.map(w=><tr key={`${w.id}-${w.date}`}><td>{w.date}</td><td><strong>{workTypeCode(w.workType)} - {w.workType.name}</strong></td><td>{w.quantity}</td><td>{money(w.workType.rate)}</td><td><strong>{money(w.amount)}</strong></td></tr>)}{!workRows.length&&<tr><td colSpan={5}>No work entries found for this employee and period.</td></tr>}{workRows.length&&<tr className="total-row"><td colSpan={4}><strong>Total work amount</strong></td><td><strong>{money(totalWork)}</strong></td></tr>}</tbody></table><div className="table-footer paginated-footer"><span>Showing {workRows.length?((safeBreakdownPage-1)*breakdownPageSize)+1:0}-{Math.min(safeBreakdownPage*breakdownPageSize,workRows.length)} of {workRows.length} work entries</span><div className="pager"><label>Rows<select value={breakdownPageSize} onChange={e=>{setBreakdownPageSize(Number(e.target.value));setBreakdownPage(1)}}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><button className="outline" disabled={safeBreakdownPage===1} onClick={()=>setBreakdownPage(p=>Math.max(1,p-1))}>Prev</button><span>Page {safeBreakdownPage} / {breakdownPageCount}</span><button className="outline" disabled={safeBreakdownPage===breakdownPageCount} onClick={()=>setBreakdownPage(p=>Math.min(breakdownPageCount,p+1))}>Next</button></div></div></article>
      </div>}
      {showSalaryPayment && (
        <div className="salary-grid">
          <article className="card salary-panel print-surface"><div className="cardhead"><div><h2>Salary payment screen</h2><p>Owner controls advance recovery before payment.</p></div><div className="salary-panel-actions"><button className="print-btn no-print" onClick={paySalary}><ReceiptText size={16}/> Pay & record</button><button className="print-btn no-print" onClick={()=>setShowSalaryPrint(true)}><Printer size={16}/> Print slip</button></div></div>{salaryDoc}</article>
        </div>
      )}</>}
    {wageTab==='history'&&<>{salaryDeleted&&<div className="salary-success"><CheckCircle2 size={16}/> Salary slip {salaryDeleted} deleted from Salary History.</div>}<Stats values={[[ 'Payments',String(salaryHistoryRows.length),employeeId ? 'for selected employee' : 'all employees'],[ 'Total Gross',money(filteredSalaryHistory.reduce((a,b)=>a+(b.gross||0),0)),'total work amount'],[ 'Total Net Paid',money(filteredSalaryHistory.reduce((a,b)=>a+(b.netPayable||0),0)),'after recovery'],[ 'Last Paid',filteredSalaryHistory[0]?.paidDate||'-','most recent' ]]}/><Table paged={true} title="Salary history" copy="Each payment snapshots its slip values and can be reprinted" headers={['SAL ID','EMPLOYEE','PAID DATE','PERIOD','SALARY TYPE','WORK DAYS','PIECES','GROSS','RECOVERED','NET PAYABLE','MODE']} rows={salaryHistoryRows} actions={r=>{const pay=salaryHistory.find(x=>x.id===r[0]);return pay?<div className="dropdown-action-cell"><button type="button" className="outline mini-action dropdown-trigger" onClick={e=>{e.stopPropagation();const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();const pos={top:rect.bottom+4,left:Math.max(8,rect.right-160)};setHistoryDropdownPos(openHistoryAction===pay.id?null:pos);setOpenHistoryAction(openHistoryAction===pay.id?null:pay.id)}}>Actions <span className="dropdown-arrow"/></button>{openHistoryAction===pay.id&&historyDropdownPos&&<div className="dropdown-menu" style={{top:historyDropdownPos.top,left:historyDropdownPos.left}}><button type="button" className="dropdown-item" onClick={()=>{setOpenHistoryAction(null);setHistoryDropdownPos(null);setViewHistory(pay)}}><Printer size={14}/> Print Slip</button><button type="button" className="dropdown-item danger" onClick={()=>{setOpenHistoryAction(null);setHistoryDropdownPos(null);setDeleteTarget(pay);setMasterAuth({username:'',password:''});setMasterError('')}}><Trash2 size={14}/> Delete</button></div>}</div>:null}}/></>}
    {wageTab==='masters'&&<>
      <div className="measurement-tabs wage-tabs" style={{marginBottom:'16px'}}>
        <button
          type="button"
          className={masterSubTab==='work-type'?'active':''}
          onClick={()=>setMasterSubTab('work-type')}
        >
          <Settings size={16}/>
          <span>Work Type Master<small>Configure piece rates & units ({workTypes.length})</small></span>
        </button>
        <button
          type="button"
          className={masterSubTab==='rate-history'?'active':''}
          onClick={()=>setMasterSubTab('rate-history')}
        >
          <ReceiptText size={16}/>
          <span>Work Type Rate History<small>Log of rate, unit & status modifications ({workTypeHistory.length})</small></span>
        </button>
        <button
          type="button"
          className={masterSubTab==='garment-price'?'active':''}
          onClick={()=>setMasterSubTab('garment-price')}
        >
          <Tag size={16}/>
          <span>Price for Garment<small>Selling rates by quality & size ({garmentPrices.length})</small></span>
        </button>
      </div>

      {masterSubTab==='work-type'&&(
        <article className="card salary-panel module-table">
          <div className="cardhead">
            <div>
              <h2>Work type master</h2>
              <p>Edit a row, then click Save. Rates remain until changed again.</p>
            </div>
            <Settings size={18}/>
          </div>
          <div className="master-editor">
            <div className="master-row master-head">
              <span>Work type</span>
              <span>Code</span>
              <span>Rate</span>
              <span>Unit</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {pagedWorkTypes.map(renderWorkTypeRow)}
            <div className="master-row add-row">
              <input
                placeholder="New work type"
                value={newWorkType.name}
                onChange={e=>setNewWorkType({...newWorkType,name:e.target.value})}
              />
              <input
                placeholder="Code"
                value={newWorkType.code}
                onChange={e=>setNewWorkType({...newWorkType,code:e.target.value})}
              />
              <input
                type="number"
                min="0"
                value={newWorkType.rate}
                onChange={e=>setNewWorkType({...newWorkType,rate:Number(e.target.value)})}
              />
              <input
                value={newWorkType.unit}
                onChange={e=>setNewWorkType({...newWorkType,unit:e.target.value})}
              />
              <select
                value={newWorkType.status}
                onChange={e=>setNewWorkType({...newWorkType,status:e.target.value as 'Active'|'Inactive'})}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <button className="mini-add" onClick={addWorkType} title="Add new work type">
                <Plus size={15}/>
              </button>
            </div>
          </div>
          <div className="table-footer paginated-footer" style={{marginTop:'14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span>Rows per page:</span>
              <select
                value={workTypePageSize}
                onChange={e=>{
                  setWorkTypePageSize(Number(e.target.value));
                  setWorkTypePage(1);
                }}
                style={{padding:'4px 8px',borderRadius:'4px',border:'1px solid #dfe5e2'}}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>
                Showing {workTypes.length===0?0:(safeWorkTypePage-1)*workTypePageSize+1} - {Math.min(safeWorkTypePage*workTypePageSize,workTypes.length)} of {workTypes.length} work types
              </span>
            </div>
            <div className="pager" style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <button
                className="outline"
                disabled={safeWorkTypePage<=1}
                onClick={()=>setWorkTypePage(p=>Math.max(1,p-1))}
              >
                Prev
              </button>
              <span style={{fontSize:'12px',fontWeight:600,padding:'0 6px'}}>
                Page {safeWorkTypePage} / {workTypePageCount}
              </span>
              <button
                className="outline"
                disabled={safeWorkTypePage>=workTypePageCount}
                onClick={()=>setWorkTypePage(p=>Math.min(workTypePageCount,p+1))}
              >
                Next
              </button>
            </div>
          </div>
        </article>
      )}

      {masterSubTab==='rate-history'&&(
        <Table
          paged={true}
          title="Work type rate history"
          copy="Rate, unit, status and code changes kept across sessions"
          headers={['DATE / TIME','WORK TYPE','CHANGE','OLD RATE','NEW RATE','STATUS']}
          rows={workTypeHistory.length?workTypeHistory:[[ '-','No changes yet','Update a work type to capture history','-','-','-' ]]}
        />
      )}

      {masterSubTab==='garment-price'&&(
        <article className="card salary-panel module-table">
          <div className="cardhead" style={{flexWrap:'wrap',gap:10}}>
            <div>
              <h2><IndianRupee size={18} style={{verticalAlign:'middle',marginRight:6,color:'#0284c7'}}/> Price for Garment Master</h2>
              <p>Define selling / delivery rate per garment by Quality, Garment Type, and Size. Automatically picked during stock delivery & billing.</p>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button
                type="button"
                className="outline mini-action"
                style={{fontSize:12,padding:'6px 12px'}}
                onClick={()=>{
                  if(window.confirm('Reset/Load standard default garment prices? This will merge standard rates for Shirts, Pants, Skirts, etc.')){
                    const existingMap = new Map(garmentPrices.map(p => [`${p.garmentType.toLowerCase()}__${p.size.toLowerCase()}__${p.quality.toLowerCase()}`, p]));
                    const merged = [...garmentPrices];
                    defaultGarmentPrices.forEach(def => {
                      const key = `${def.garmentType.toLowerCase()}__${def.size.toLowerCase()}__${def.quality.toLowerCase()}`;
                      if(!existingMap.has(key)){
                        merged.push(def);
                      }
                    });
                    setGarmentPrices(merged);
                    setGarmentPriceSuccess('Loaded standard garment price presets.');
                    setTimeout(()=>setGarmentPriceSuccess(''),3500);
                  }
                }}
              >
                <RotateCcw size={13}/> Load Presets
              </button>
            </div>
          </div>

          {garmentPriceSuccess && (
            <div className="salary-success" style={{margin:'8px 0 12px 0'}}>
              <CheckCircle2 size={16}/> {garmentPriceSuccess}
            </div>
          )}

          {/* Quick Metrics */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:10,marginBottom:16}}>
            <div style={{background:'#f8fafc',padding:'10px 14px',borderRadius:8,border:'1px solid #e2e8f0'}}>
              <span style={{fontSize:11,color:'#64748b',fontWeight:600}}>TOTAL RATES</span>
              <strong style={{display:'block',fontSize:18,color:'#0f172a',marginTop:2}}>{garmentPrices.length}</strong>
            </div>
            <div style={{background:'#f0fdf4',padding:'10px 14px',borderRadius:8,border:'1px solid #bbf7d0'}}>
              <span style={{fontSize:11,color:'#166534',fontWeight:600}}>GARMENT TYPES</span>
              <strong style={{display:'block',fontSize:18,color:'#15803d',marginTop:2}}>
                {new Set(garmentPrices.map(p => p.garmentType)).size}
              </strong>
            </div>
            <div style={{background:'#eff6ff',padding:'10px 14px',borderRadius:8,border:'1px solid #bfdbfe'}}>
              <span style={{fontSize:11,color:'#1e40af',fontWeight:600}}>SIZES</span>
              <strong style={{display:'block',fontSize:18,color:'#1d4ed8',marginTop:2}}>
                {new Set(garmentPrices.map(p => p.size)).size}
              </strong>
            </div>
            <div style={{background:'#fdf4ff',padding:'10px 14px',borderRadius:8,border:'1px solid #f5d0fe'}}>
              <span style={{fontSize:11,color:'#86198f',fontWeight:600}}>QUALITIES</span>
              <strong style={{display:'block',fontSize:18,color:'#a21caf',marginTop:2}}>
                {new Set(garmentPrices.map(p => p.quality)).size}
              </strong>
            </div>
          </div>

          {/* Filters */}
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:14,background:'#f8fafc',padding:'10px 12px',borderRadius:8,border:'1px solid #e2e8f0'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flex:1,minWidth:200}}>
              <Search size={14} color="#64748b"/>
              <input
                type="text"
                placeholder="Search garment, size, quality..."
                value={garmentPriceSearch}
                onChange={e=>{setGarmentPriceSearch(e.target.value);setGarmentPricePage(1);}}
                style={{width:'100%',padding:'6px 10px',fontSize:12,border:'1px solid #cbd5e1',borderRadius:6}}
              />
            </div>
            <label style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontWeight:600,color:'#475569'}}>Garment:</span>
              <select
                value={garmentPriceFilterGarment}
                onChange={e=>{setGarmentPriceFilterGarment(e.target.value);setGarmentPricePage(1);}}
                style={{padding:'5px 10px',fontSize:12,border:'1px solid #cbd5e1',borderRadius:6}}
              >
                <option value="All">All Garments</option>
                {Array.from(new Set(garmentPrices.map(p=>p.garmentType))).sort().map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontWeight:600,color:'#475569'}}>Quality:</span>
              <select
                value={garmentPriceFilterQuality}
                onChange={e=>{setGarmentPriceFilterQuality(e.target.value);setGarmentPricePage(1);}}
                style={{padding:'5px 10px',fontSize:12,border:'1px solid #cbd5e1',borderRadius:6}}
              >
                <option value="All">All Qualities</option>
                {Array.from(new Set(garmentPrices.map(p=>p.quality))).sort().map(q=><option key={q} value={q}>{q}</option>)}
              </select>
            </label>
            {(garmentPriceSearch || garmentPriceFilterGarment!=='All' || garmentPriceFilterQuality!=='All') && (
              <button
                type="button"
                className="outline mini-action"
                style={{fontSize:11,padding:'4px 8px'}}
                onClick={()=>{setGarmentPriceSearch('');setGarmentPriceFilterGarment('All');setGarmentPriceFilterQuality('All');setGarmentPricePage(1);}}
              >
                Reset
              </button>
            )}
          </div>

          {/* Add New Price Form Card */}
          <div style={{background:'#f0fdf4',border:'1.5px dashed #86efac',borderRadius:8,padding:'12px 14px',marginBottom:16}}>
            <strong style={{display:'block',fontSize:13,color:'#166534',marginBottom:8}}>
              + Add Garment Price Entry
            </strong>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',gap:10,alignItems:'end'}}>
              <label style={{fontSize:11,fontWeight:700,color:'#166534'}}>
                Quality:
                <input
                  list="quality-presets"
                  placeholder="e.g. Standard"
                  value={newGarmentPrice.quality}
                  onChange={e=>setNewGarmentPrice({...newGarmentPrice,quality:e.target.value})}
                  style={{display:'block',width:'100%',marginTop:4,padding:'6px 8px',border:'1px solid #86efac',borderRadius:6,fontSize:12}}
                />
                <datalist id="quality-presets">
                  <option value="Standard"/>
                  <option value="Premium"/>
                  <option value="Super Fine"/>
                  <option value="Cotton"/>
                  <option value="Poly Cotton"/>
                  <option value="Matty"/>
                  <option value="Polyester"/>
                </datalist>
              </label>

              <label style={{fontSize:11,fontWeight:700,color:'#166534'}}>
                Garment Type:
                <input
                  list="garment-presets"
                  placeholder="e.g. Shirt"
                  value={newGarmentPrice.garmentType}
                  onChange={e=>setNewGarmentPrice({...newGarmentPrice,garmentType:e.target.value})}
                  style={{display:'block',width:'100%',marginTop:4,padding:'6px 8px',border:'1px solid #86efac',borderRadius:6,fontSize:12}}
                />
                <datalist id="garment-presets">
                  <option value="Shirt"/>
                  <option value="Full Pant"/>
                  <option value="Half Pant"/>
                  <option value="Skirt"/>
                  <option value="Blouse"/>
                  <option value="Track Suit"/>
                  <option value="Jacket"/>
                  <option value="T-Shirt"/>
                  <option value="Blazer"/>
                  <option value="Salwar"/>
                  <option value="Kurta"/>
                  <option value="Tie"/>
                  <option value="Belt"/>
                  <option value="Socks"/>
                </datalist>
              </label>

              <label style={{fontSize:11,fontWeight:700,color:'#166534'}}>
                Size:
                <input
                  list="size-presets"
                  placeholder="e.g. 32"
                  value={newGarmentPrice.size}
                  onChange={e=>setNewGarmentPrice({...newGarmentPrice,size:e.target.value})}
                  style={{display:'block',width:'100%',marginTop:4,padding:'6px 8px',border:'1px solid #86efac',borderRadius:6,fontSize:12}}
                />
                <datalist id="size-presets">
                  <option value="20"/><option value="22"/><option value="24"/><option value="26"/>
                  <option value="28"/><option value="30"/><option value="32"/><option value="34"/>
                  <option value="36"/><option value="38"/><option value="40"/><option value="42"/>
                  <option value="S"/><option value="M"/><option value="L"/><option value="XL"/><option value="XXL"/>
                </datalist>
              </label>

              <label style={{fontSize:11,fontWeight:700,color:'#166534'}}>
                Price / Rate (₹):
                <input
                  type="number"
                  min="0"
                  placeholder="280"
                  value={newGarmentPrice.price || ''}
                  onChange={e=>setNewGarmentPrice({...newGarmentPrice,price:Math.max(0,parseFloat(e.target.value)||0)})}
                  style={{display:'block',width:'100%',marginTop:4,padding:'6px 8px',border:'1px solid #86efac',borderRadius:6,fontSize:12,fontWeight:700}}
                />
              </label>

              <label style={{fontSize:11,fontWeight:700,color:'#166534'}}>
                Remarks:
                <input
                  placeholder="Optional notes"
                  value={newGarmentPrice.remarks}
                  onChange={e=>setNewGarmentPrice({...newGarmentPrice,remarks:e.target.value})}
                  style={{display:'block',width:'100%',marginTop:4,padding:'6px 8px',border:'1px solid #86efac',borderRadius:6,fontSize:12}}
                />
              </label>

              <button
                type="button"
                className="primary"
                style={{height:34,padding:'0 14px',fontSize:12,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}
                disabled={!newGarmentPrice.garmentType.trim() || !newGarmentPrice.size.trim() || newGarmentPrice.price <= 0}
                onClick={handleAddGarmentPrice}
              >
                <Plus size={15}/> Add Price
              </button>
            </div>
          </div>

          {/* Table */}
          <table style={{width:'100%'}}>
            <thead>
              <tr>
                <th>GARMENT TYPE</th>
                <th>SIZE</th>
                <th>QUALITY</th>
                <th>PRICE / RATE (₹)</th>
                <th>REMARKS</th>
                <th style={{width:130,textAlign:'center'}}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pagedGarmentPrices.map(item => {
                const isEditing = editingPriceId === item.id;
                if(isEditing && editGarmentPriceDraft){
                  return (
                    <tr key={item.id} style={{background:'#eff6ff'}}>
                      <td>
                        <input
                          value={editGarmentPriceDraft.garmentType}
                          onChange={e=>setEditGarmentPriceDraft({...editGarmentPriceDraft,garmentType:e.target.value})}
                          style={{padding:'4px 6px',fontSize:12,width:'100%'}}
                        />
                      </td>
                      <td>
                        <input
                          value={editGarmentPriceDraft.size}
                          onChange={e=>setEditGarmentPriceDraft({...editGarmentPriceDraft,size:e.target.value})}
                          style={{padding:'4px 6px',fontSize:12,width:70}}
                        />
                      </td>
                      <td>
                        <input
                          value={editGarmentPriceDraft.quality}
                          onChange={e=>setEditGarmentPriceDraft({...editGarmentPriceDraft,quality:e.target.value})}
                          style={{padding:'4px 6px',fontSize:12,width:'100%'}}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={editGarmentPriceDraft.price}
                          onChange={e=>setEditGarmentPriceDraft({...editGarmentPriceDraft,price:Math.max(0,parseFloat(e.target.value)||0)})}
                          style={{padding:'4px 6px',fontSize:12,fontWeight:700,width:90}}
                        />
                      </td>
                      <td>
                        <input
                          value={editGarmentPriceDraft.remarks || ''}
                          onChange={e=>setEditGarmentPriceDraft({...editGarmentPriceDraft,remarks:e.target.value})}
                          style={{padding:'4px 6px',fontSize:12,width:'100%'}}
                        />
                      </td>
                      <td style={{textAlign:'center'}}>
                        <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                          <button
                            type="button"
                            className="save-btn"
                            style={{padding:'4px 8px',fontSize:11}}
                            onClick={handleSaveEditGarmentPrice}
                          >
                            <Save size={12}/> Save
                          </button>
                          <button
                            type="button"
                            className="outline mini-action"
                            style={{padding:'4px 8px',fontSize:11}}
                            onClick={()=>{setEditingPriceId(null);setEditGarmentPriceDraft(null);}}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id}>
                    <td><strong style={{color:'#007c68'}}>{item.garmentType}</strong></td>
                    <td><span style={{fontWeight:700,background:'#e0f2fe',color:'#0369a1',padding:'2px 8px',borderRadius:4,fontSize:12}}>{item.size}</span></td>
                    <td><span style={{fontSize:12,color:'#334155'}}>{item.quality || 'Standard'}</span></td>
                    <td><strong style={{color:'#047857',fontSize:13}}>{money(item.price)}</strong></td>
                    <td style={{fontSize:12,color:'#64748b'}}>{item.remarks || '-'}</td>
                    <td style={{textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                      <div className="dropdown-action-cell" style={{display:'inline-block'}}>
                        <button
                          type="button"
                          className="outline mini-action dropdown-trigger"
                          onClick={e=>{
                            e.stopPropagation();
                            const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();
                            const pos={top:rect.bottom+4,left:Math.max(8,rect.right-140)};
                            setPriceDropdownPos(openPriceAction===item.id?null:pos);
                            setOpenPriceAction(openPriceAction===item.id?null:item.id);
                          }}
                        >
                          Actions <span className="dropdown-arrow"/>
                        </button>
                        {openPriceAction===item.id&&priceDropdownPos&&(
                          <div className="dropdown-menu" style={{top:priceDropdownPos.top,left:priceDropdownPos.left}}>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={()=>{
                                setOpenPriceAction(null);
                                setPriceDropdownPos(null);
                                setViewPrice(item);
                              }}
                            >
                              <Eye size={14}/> View
                            </button>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={()=>{
                                setOpenPriceAction(null);
                                setPriceDropdownPos(null);
                                setEditingPriceId(item.id);
                                setEditGarmentPriceDraft({...item});
                              }}
                            >
                              <Pencil size={14}/> Edit
                            </button>
                            <button
                              type="button"
                              className="dropdown-item danger"
                              onClick={()=>{
                                setOpenPriceAction(null);
                                setPriceDropdownPos(null);
                                handleDeleteGarmentPrice(item);
                              }}
                            >
                              <Trash2 size={14}/> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pagedGarmentPrices.length === 0 && (
                <tr>
                  <td colSpan={6} style={{textAlign:'center',padding:'24px 12px',color:'#64748b'}}>
                    No garment prices match your search or filter. Add a new garment price above or click "Load Presets".
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="table-footer paginated-footer" style={{marginTop:'14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span>Rows per page:</span>
              <select
                value={garmentPricePageSize}
                onChange={e=>{
                  setGarmentPricePageSize(Number(e.target.value));
                  setGarmentPricePage(1);
                }}
                style={{padding:'4px 8px',borderRadius:'4px',border:'1px solid #dfe5e2'}}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>
                Showing {filteredGarmentPrices.length===0?0:(safeGarmentPricePage-1)*garmentPricePageSize+1} - {Math.min(safeGarmentPricePage*garmentPricePageSize,filteredGarmentPrices.length)} of {filteredGarmentPrices.length} garment prices
              </span>
            </div>
            <div className="pager" style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <button
                type="button"
                className="outline"
                disabled={safeGarmentPricePage<=1}
                onClick={()=>setGarmentPricePage(p=>Math.max(1,p-1))}
              >
                Prev
              </button>
              <span style={{fontSize:'12px',fontWeight:600,padding:'0 6px'}}>
                Page {safeGarmentPricePage} / {garmentPricePageCount}
              </span>
              <button
                type="button"
                className="outline"
                disabled={safeGarmentPricePage>=garmentPricePageCount}
                onClick={()=>setGarmentPricePage(p=>Math.min(garmentPricePageCount,p+1))}
              >
                Next
              </button>
            </div>
          </div>
        </article>
      )}
    </>}
    {wageTab==='reports'&&<><div className="report-grid">
      <Table paged={true} title="Staff-wise salary report" copy="Gross work, advances, recovery and net payable" headers={['STAFF','WORK AMOUNT','ADVANCE','RECOVERED','NET PAYABLE']} rows={employeeSalaryRows}/>
      <Table paged={true} title="Employee ledger report" copy="Advance given and recovered balance trail" headers={['DATE','TYPE','AMOUNT','BALANCE ADVANCE']} rows={ledgerRows}/>
    </div>
    <div className="report-grid">
      <Table paged={true} title="Work-type-wise production report" copy={`${totalProduction} pieces completed by ${employee.name} between selected dates`} headers={['WORK TYPE','TOTAL QTY','RATE','AMOUNT']} rows={workTypes.map(wt=>{const rows=periodWork.filter(w=>w.workTypeId===wt.id);const qty=rows.reduce((a,b)=>a+b.quantity,0);return [`${workTypeCode(wt)} - ${wt.name}`,String(qty),money(wt.rate),money(qty*wt.rate)]})}/>
      <Table title="Advance balance report" copy="Pending advance after selected salary recovery" headers={['EMPLOYEE','ADVANCE GIVEN','RECOVERED','PENDING']} rows={[[employee.name,money(advances.filter(a=>a.employeeId===employeeId&&a.date<=to).reduce((a,b)=>a+b.amount,0)),money(safeRecover),money(Math.max(0,advances.filter(a=>a.employeeId===employeeId&&a.date<=to).reduce((a,b)=>a+b.amount,0)-safeRecover))]]}/>
    </div></>}
  {deleteTarget&&<div className="salary-modal-overlay" onClick={()=>setDeleteTarget(null)}><div className="salary-modal salary-delete-modal" onClick={e=>e.stopPropagation()}><h3><Trash2 size={18}/> Delete salary slip</h3><p>Deleting slip <strong>{deleteTarget.id}</strong> for <strong>{deleteTarget.from} to {deleteTarget.to}</strong> removes it permanently. Only the <strong>master</strong> user can delete salary slips.</p><div className="simple-form"><label>Username<input autoFocus value={masterAuth.username} onChange={e=>setMasterAuth({...masterAuth,username:e.target.value})} placeholder="master"/></label><label>Password<input type="password" value={masterAuth.password} onChange={e=>setMasterAuth({...masterAuth,password:e.target.value})} onKeyDown={e=>{if(e.key==='Enter')confirmMasterDelete()}} placeholder="Password"/></label></div>{masterError&&<p className="startup-error">{masterError}</p>}<div className="salary-modal-actions"><button className="outline" onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="danger-btn" disabled={masterBusy||!masterAuth.username||!masterAuth.password} onClick={confirmMasterDelete}><Trash2 size={14}/> {masterBusy?'Deleting...':'Verify & delete'}</button></div></div></div>}
  {confirmRecordAgain&&<div className="salary-modal-overlay" onClick={()=>setConfirmRecordAgain(false)}><div className="salary-modal" onClick={e=>e.stopPropagation()}><h3><AlertTriangle size={18}/> Salary already recorded</h3><p>A salary slip for <strong>{employee.name}</strong> already exists for <strong>{from} to {to}</strong>. Recording again will create a duplicate slip in Salary History.</p><div className="salary-modal-actions"><button className="outline" onClick={()=>setConfirmRecordAgain(false)}>Cancel</button><button className="danger-btn" onClick={()=>{setConfirmRecordAgain(false);recordSalary()}}>Record anyway</button></div></div></div>}
  {showSalaryPrint&&<PrintPreview doc={salaryDoc} onClose={()=>setShowSalaryPrint(false)}/>}
  {showWorkBreakdownPrint&&<PrintPreview doc={workBreakdownDoc} onClose={()=>setShowWorkBreakdownPrint(false)}/>}
  {viewHistory&&<PrintPreview doc={slipDoc(viewHistory as SalaryPayment)} onClose={()=>setViewHistory(null)}/>}
  {viewEntry&&<div className="stock-modal-overlay" onClick={()=>setViewEntry(null)}><article className="card measurement-form detail-modal" onClick={e=>e.stopPropagation()}><div className="form-title"><div><h2>Work entry details</h2><p>{employee.name} • {viewEntry.date}</p></div><button className="outline" onClick={()=>setViewEntry(null)}>Close</button></div><div className="detail-grid"><div><span>Date</span><strong>{viewEntry.date}</strong></div><div><span>Employee</span><strong>{employee.name}</strong></div><div><span>Work type</span><strong>{workTypeCode(viewEntry.workType)} - {viewEntry.workType.name}</strong></div><div><span>Quantity</span><strong>{viewEntry.quantity}</strong></div><div><span>Rate</span><strong>{money(viewEntry.workType.rate)}</strong></div><div><span>Amount</span><strong>{money(viewEntry.amount)}</strong></div><div><span>Remarks</span><strong>{viewEntry.remarks||'-'}</strong></div></div><div className="form-actions"><button className="primary" onClick={()=>setViewEntry(null)}>Close</button></div></article></div>}
  {editEntry&&editForm&&<div className="stock-modal-overlay" onClick={()=>{setEditEntry(null);setEditForm(null)}}><article className="card measurement-form entry-modal" onClick={e=>e.stopPropagation()}><div className="form-title"><div><h2>Edit work entry</h2><p>Update the entry for {employee.name}. Salary totals update on save.</p></div><button className="outline" onClick={()=>{setEditEntry(null);setEditForm(null)}}>Close</button></div><div className="form-grid"><label>Date<input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})}/></label><label>Work type<select value={editForm.workTypeId} onChange={e=>setEditForm({...editForm,workTypeId:e.target.value})}>{workTypes.map(wt=><option value={wt.id} key={wt.id}>{workTypeCode(wt)} - {wt.name} - {money(wt.rate)} / {wt.unit}</option>)}</select></label><label>Quantity<input type="number" min="0" value={editForm.quantity} onChange={e=>setEditForm({...editForm,quantity:Number(e.target.value)})}/></label><label>Rate<div className="readonly-field">{money(editWorkType?.rate||0)}</div></label><label>Amount<div className="readonly-field"><strong>{money(editAmount)}</strong></div></label><label className="wide">Remarks<input value={editForm.remarks} onChange={e=>setEditForm({...editForm,remarks:e.target.value})} placeholder="Batch, order, or notes"/></label></div><div className="form-actions"><button className="outline" onClick={()=>{setEditEntry(null);setEditForm(null)}}>Cancel</button><button className="primary" disabled={!editForm.workTypeId||editForm.quantity<=0} onClick={saveEditedEntry}><Save size={14}/> Update entry</button></div></article></div>}
  {deleteEntry&&<div className="salary-modal-overlay" onClick={()=>setDeleteEntry(null)}><div className="salary-modal confirm-dialog" onClick={e=>e.stopPropagation()}><div className="confirm-icon"><Trash2 size={26}/></div><h3>Delete work entry?</h3><p>This permanently removes the work entry for <strong>{employee.name}</strong> on <strong>{deleteEntry.date}</strong> — <strong>{workTypeCode(deleteEntry.workType)} - {deleteEntry.workType.name}</strong>, qty <strong>{deleteEntry.quantity}</strong>. Salary totals will update.</p><div className="salary-modal-actions"><button className="outline" onClick={()=>setDeleteEntry(null)}>Cancel</button><button className="danger-btn" onClick={confirmDeleteEntry}><Trash2 size={14}/> Delete entry</button></div></div></div>}
  {viewPrice&&(
    <div className="stock-modal-overlay" onClick={()=>setViewPrice(null)}>
      <article className="card measurement-form detail-modal" onClick={e=>e.stopPropagation()}>
        <div className="form-title">
          <div>
            <h2>Garment Price Details</h2>
            <p>{viewPrice.garmentType} (Size {viewPrice.size}) • {viewPrice.id}</p>
          </div>
          <button className="outline" onClick={()=>setViewPrice(null)}>Close</button>
        </div>
        <div className="detail-grid">
          <div><span>Garment Type</span><strong>{viewPrice.garmentType}</strong></div>
          <div><span>Size</span><strong>{viewPrice.size}</strong></div>
          <div><span>Quality</span><strong>{viewPrice.quality||'Standard'}</strong></div>
          <div><span>Price / Rate</span><strong style={{color:'#047857'}}>{money(viewPrice.price)}</strong></div>
          <div><span>Remarks / Note</span><strong>{viewPrice.remarks||'-'}</strong></div>
          <div><span>Record ID</span><strong>{viewPrice.id}</strong></div>
        </div>
        <div className="form-actions">
          <button
            className="outline"
            onClick={()=>{
              const target=viewPrice;
              setViewPrice(null);
              setEditingPriceId(target.id);
              setEditGarmentPriceDraft({...target});
            }}
          >
            <Pencil size={14}/> Edit Price
          </button>
          <button className="primary" onClick={()=>setViewPrice(null)}>Close</button>
        </div>
      </article>
    </div>
  )}
  </section>
}


