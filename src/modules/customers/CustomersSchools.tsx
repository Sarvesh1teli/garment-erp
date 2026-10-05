import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Boxes, CheckCircle2, CheckSquare, ClipboardList, CreditCard, ExternalLink, Eye, Factory, FileText, Filter, IndianRupee, MessageSquare, Pencil, Plus, Printer, Scissors, Search, Trash2, Truck, Users, WalletCards, X } from 'lucide-react';
import { Table } from '../../shared/ui';
import type { DressVersion, GarmentPrice, Invoice, InvoiceItem, InvoicePayment, School, SchoolStock, StockSale, Student } from '../../shared/types';
import { assetUrl, uploadSchoolMedia } from '../../shared/api';
import { defaultGarmentPrices } from '../../shared/defaults';
import { consolidateStockSales, money, useStoredState } from '../../shared/utils';
import { SmsComposerModal, type SmsDraft } from '../../shared/SmsComposerModal';
import { sendSmsViaGateway } from '../../shared/sms';
import type { CompanySettings } from '../settings/SettingsPage';

const academicYear=()=>{const d=new Date();const y=d.getFullYear();return d.getMonth()>=3?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`};
const getAcademicYearFromDate=(dateStr?:string)=>{
  if(!dateStr)return academicYear();
  const d=new Date(dateStr);
  if(Number.isNaN(d.getTime()))return academicYear();
  const y=d.getFullYear();
  return d.getMonth()>=3?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`;
};
const normalizeAcademicYear=(yr?:string)=>{
  if(!yr)return academicYear();
  const cleaned=yr.trim();
  if(/^\d{4}$/.test(cleaned)){
    const y=Number(cleaned);
    return `${y}-${String(y+1).slice(2)}`;
  }
  return cleaned;
};
const emptyDressVersion=():DressVersion=>({id:'',year:'',note:'',date:'',boysPhotos:[],girlsPhotos:[]});
const schoolDressVersions=(school?:School|null):DressVersion[]=>Array.isArray(school?.dressVersions)?school.dressVersions:[];
const activeDress=(school:School):DressVersion=>{
  const versions=schoolDressVersions(school);
  const active=versions[versions.length-1];
  return active?{...active,boysPhotos:Array.isArray(active.boysPhotos)?active.boysPhotos:[],girlsPhotos:Array.isArray(active.girlsPhotos)?active.girlsPhotos:[]}:emptyDressVersion();
};

export function CustomersSchools({customers,setCustomers,schools,setSchools,students=[],onNavigate,navParams,productionMode=false,company,garmentPrices:propGarmentPrices}:{customers:string[][];setCustomers:React.Dispatch<React.SetStateAction<string[][]>>;schools:School[];setSchools:React.Dispatch<React.SetStateAction<School[]>>;students?:Student[];onNavigate?:(page:string,params?:Record<string,unknown>)=>void;navParams?:Record<string,unknown>|null;productionMode?:boolean;company?:CompanySettings;garmentPrices?:GarmentPrice[]}){
  const nextSchoolId=()=>{const max=schools.reduce((m,s)=>{const match=s.id.match(/SCH-(\d+)$/);return match?Math.max(m,Number(match[1])):m},0);return `SCH-${String(max+1).padStart(3,'0')}`};
  const [tab,setTab]=useState<'customers'|'schools'>(()=>{
    if(navParams?.tab==='schools') return 'schools';
    if(navParams?.tab==='customers') return 'customers';
    return 'schools';
  });
  const [storedGarmentPrices]=useStoredState<GarmentPrice[]>('garment-prices',defaultGarmentPrices);
  const garmentPrices=propGarmentPrices??storedGarmentPrices;
  const [smsDraft,setSmsDraft]=useState<SmsDraft|null>(null);
  const [sendingSms,setSendingSms]=useState(false);
  const [showCustomerForm,setShowCustomerForm]=useState(false);
  const [showSchoolForm,setShowSchoolForm]=useState(false);
  const [photoView,setPhotoView]=useState<School|null>(null);
  const [viewCustomer,setViewCustomer]=useState<string[]|null>(null);
  const [viewSchool,setViewSchool]=useState<School|null>(null);
  const lastOpenedSchoolRef = useRef<string | null>(null);

  const handleCloseSchoolModal = () => {
    setViewSchool(null);
    lastOpenedSchoolRef.current = null;
    if (onNavigate) {
      onNavigate('Customers & Schools', { tab: 'schools' });
    } else {
      setTab('schools');
    }
  };

  useEffect(() => {
    if (navParams?.tab === 'schools' || navParams?.tab === 'customers') {
      setTab(navParams.tab as 'customers' | 'schools');
    }
  }, [navParams?.tab]);

  useEffect(()=>{
    if(navParams?.openSchool){
      const targetName = String(navParams.openSchool);
      if(lastOpenedSchoolRef.current !== targetName){
        lastOpenedSchoolRef.current = targetName;
        setTab('schools');
        const sch=schools.find(s=>s.name===targetName);
        if(sch && viewSchool?.name !== sch.name) setViewSchool(sch);
      }
    }else{
      lastOpenedSchoolRef.current = null;
      if(productionMode&&schools.length){
        setTab('schools');
        if(!viewSchool || !schools.some(s=>s.name===viewSchool.name)){
          setViewSchool(schools[0]);
        }
      }else if(!productionMode){
        if(viewSchool) setViewSchool(null);
      }
    }
  },[navParams?.openSchool,schools,productionMode,viewSchool?.name]);
  const [schoolStock,setSchoolStock]=useStoredState<SchoolStock[]>('garment-school-stock',[]);
  const [schoolSales,setSchoolSales]=useStoredState<StockSale[]>('garment-stock-sales',[]);
  useEffect(() => {
    if (schoolSales.length > 1) {
      const seen = new Set<string>();
      const hasDuplicates = schoolSales.some(s => {
        const inv = s.invoiceNo?.trim();
        if (inv && inv !== '-') {
          if (seen.has(inv)) return true;
          seen.add(inv);
        }
        return false;
      });
      if (hasDuplicates) {
        setSchoolSales(current => consolidateStockSales(current));
      }
    }
  }, [schoolSales, setSchoolSales]);
  const [schoolCollections]=useStoredState<string[][]>('garment-school-collections',[]);
  const [invoices,setInvoices]=useStoredState<Invoice[]>('garment-invoices',[]);
  const [payments,setPayments]=useStoredState<InvoicePayment[]>('garment-invoice-payments',[]);
  const [autoAdjustAdvance,setAutoAdjustAdvance]=useState(true);
  const [selectedSummaryRow,setSelectedSummaryRow]=useState<{year?:string;gender?:string;garment:string;size:string}|null>(null);
  const [selectedRowKeys,setSelectedRowKeys]=useState<Set<string>>(new Set());
  const [showMultiAddModal,setShowMultiAddModal]=useState(false);
  const [multiAddDate,setMultiAddDate]=useState('');
  const [multiAddRemarks,setMultiAddRemarks]=useState('');
  const [multiAddItems,setMultiAddItems]=useState<Record<string,number>>({});
  const [showMultiDeliverModal,setShowMultiDeliverModal]=useState(false);
  const [multiDeliverDate,setMultiDeliverDate]=useState('');
  const [multiDeliverInvoiceNo,setMultiDeliverInvoiceNo]=useState('');
  const [multiDeliverRemarks,setMultiDeliverRemarks]=useState('');
  const [multiDeliverItems,setMultiDeliverItems]=useState<Record<string,{deliverQty:number;rate:number}>>({});
  const [multiDeliverGst,setMultiDeliverGst]=useState<number>(0);
  const [multiDeliverDiscount,setMultiDeliverDiscount]=useState<number>(0);
  const [multiDeliverDiscountType,setMultiDeliverDiscountType]=useState<'flat'|'percentage'>('flat');
  const [deliveryHelperNotice,setDeliveryHelperNotice]=useState('');
  const [showSchoolStatementModal,setShowSchoolStatementModal]=useState<boolean>(false);
  const [summaryFilterYear,setSummaryFilterYear]=useState(academicYear);
  const [summaryFilterGender,setSummaryFilterGender]=useState('All');
  const [summaryFilterGarment,setSummaryFilterGarment]=useState('All');
  const [summaryFilterSize,setSummaryFilterSize]=useState('All');
  const [summaryFilterStatus,setSummaryFilterStatus]=useState('All');
  const [summaryPage,setSummaryPage]=useState(1);
  const [summaryRowsPerPage,setSummaryRowsPerPage]=useState(5);
  type SummarySortField = 'year' | 'gender' | 'garment' | 'size' | 'required' | 'ready' | 'stitched' | 'delivered' | 'deliveryStatus';
  type SummarySortDir = 'asc' | 'desc';
  const [summarySortField,setSummarySortField]=useState<SummarySortField>('garment');
  const [summarySortDir,setSummarySortDir]=useState<SummarySortDir>('asc');
  type ActiveMetricModal = 'students' | 'required' | 'readyStock' | 'pendingProd' | 'delivered' | 'collected' | 'pendingBal' | null;
  const [activeMetricModal, setActiveMetricModal] = useState<ActiveMetricModal>(null);
  const [metricModalSearch, setMetricModalSearch] = useState('');
  const [readyStockTab, setReadyStockTab] = useState<'variants' | 'inward'>('variants');

  const prevSchoolNameRef = useRef<string | undefined>(viewSchool?.name);
  useEffect(()=>{
    if (viewSchool?.name !== prevSchoolNameRef.current) {
      prevSchoolNameRef.current = viewSchool?.name;
      setSelectedRowKeys(new Set());
      setSummaryPage(1);
    }
  },[viewSchool?.name]);

  useEffect(()=>{
    setSummaryPage(1);
  },[summaryFilterYear,summaryFilterGender,summaryFilterGarment,summaryFilterSize,summaryFilterStatus]);
  const [versionView,setVersionView]=useState<{schoolName:string;version:DressVersion}|null>(null);
  const [viewSchoolTab,setViewSchoolTab]=useState<'details'|'photos'>('details');
  const [toast,setToast]=useState('');
  const [deliveryInvoiceLink,setDeliveryInvoiceLink]=useState<{invoiceNo:string;school:string}|null>(null);
  const [customerSearch,setCustomerSearch]=useState('');
  const [customerType,setCustomerType]=useState('All');
  const [customerStatus,setCustomerStatus]=useState('All');
  const [schoolSearch,setSchoolSearch]=useState('');
  const [schoolStatus,setSchoolStatus]=useState('All');
  const [customerForm,setCustomerForm]=useState({name:'',type:'Retail',phone:'',location:'',status:'Active'});
  const [schoolForm,setSchoolForm]=useState({name:'',contact:'',phone:'',location:'',uniform:'',status:'Active',logo:'',boysPhotos:[] as string[],girlsPhotos:[] as string[],versionYear:academicYear(),versionNote:'',versionAction:'new' as 'new'|'update'});
  const [mediaSchoolId,setMediaSchoolId]=useState(nextSchoolId);
  const [editCustomerId,setEditCustomerId]=useState<string|null>(null);
  const [editSchoolId,setEditSchoolId]=useState<string|null>(null);
  const [menuPos,setMenuPos]=useState<{key:string;x:number;y:number}|null>(null);
  useEffect(()=>{const close=()=>setMenuPos(null);window.addEventListener('click',close);return()=>window.removeEventListener('click',close)},[]);


  const computeProductSummary = useCallback((schoolName: string) => {
    const reqMap=new Map<string,{year:string;gender:string;garment:string;size:string;qty:number}>();
    (students||[]).filter(st=>st.school===schoolName).forEach(st=>{
      if(st.sizes){
        const gender=st.gender||'Boys';
        const rawYear=st.year||academicYear();
        const year=normalizeAcademicYear(rawYear);
        Object.entries(st.sizes).forEach(([garment,size])=>{
          if(garment&&size){
            const key=`${year}||${gender}||${garment}||${size}`;
            const cur=reqMap.get(key) || {year,gender,garment,size,qty:0};
            cur.qty+=1;
            reqMap.set(key,cur);
          }
        });
      }
    });

    const readyTotalsMap=new Map<string,number>();
    schoolStock.filter(s=>s.school===schoolName).forEach(s=>{
      const gender=s.gender||'Boys';
      const year=normalizeAcademicYear(getAcademicYearFromDate(s.date));
      const key=`${year}||${gender}||${s.garment}||${s.size}`;
      readyTotalsMap.set(key,(readyTotalsMap.get(key)||0)+s.count);
    });

    const deliveredTotalsMap=new Map<string,number>();
    schoolSales.filter(s=>s.type==='School'&&s.party===schoolName).forEach(s=>{
      if (s.items && s.items.length > 0) {
        s.items.forEach(it => {
          const gender = it.gender || s.gender || 'Boys';
          const year = normalizeAcademicYear(getAcademicYearFromDate(s.date));
          const key = `${year}||${gender}||${it.garment}||${it.size}`;
          deliveredTotalsMap.set(key, (deliveredTotalsMap.get(key) || 0) + it.qty);
        });
      } else {
        const gender = s.gender || 'Boys';
        const year = normalizeAcademicYear(getAcademicYearFromDate(s.date));
        const key = `${year}||${gender}||${s.garment}||${s.size}`;
        deliveredTotalsMap.set(key, (deliveredTotalsMap.get(key) || 0) + s.count);
      }
    });

    const comboKeys=new Set<string>();
    reqMap.forEach(v=>comboKeys.add(`${v.gender}||${v.garment}||${v.size}`));
    readyTotalsMap.forEach((_,k)=>{
      const parts=k.split('||');
      comboKeys.add(`${parts[1]}||${parts[2]}||${parts[3]}`);
    });
    deliveredTotalsMap.forEach((_,k)=>{
      const parts=k.split('||');
      comboKeys.add(`${parts[1]}||${parts[2]}||${parts[3]}`);
    });

    const resultList:{school:string;year:string;gender:string;garment:string;size:string;required:number;stitched:number;ready:number;pendingProd:number;delivered:number;pendingDel:number}[]=[];

    comboKeys.forEach(combo=>{
      const [gender,garment,size]=combo.split('||');

      const reqRows=Array.from(reqMap.values()).filter(r=>r.gender===gender&&r.garment===garment&&r.size===size);

      const totalComboStitched=Array.from(readyTotalsMap.entries())
        .filter(([k])=>k.endsWith(`||${gender}||${garment}||${size}`))
        .reduce((sum,[,c])=>sum+c,0);

      const totalComboDelivered=Array.from(deliveredTotalsMap.entries())
        .filter(([k])=>k.endsWith(`||${gender}||${garment}||${size}`))
        .reduce((sum,[,c])=>sum+c,0);

      if(reqRows.length>0){
        let remStitched=totalComboStitched;
        let remDelivered=totalComboDelivered;

        reqRows.forEach((reqRow,idx)=>{
          const isLast=idx===reqRows.length-1;
          const rStitched=isLast?remStitched:Math.min(reqRow.qty,remStitched);
          remStitched=Math.max(0,remStitched-rStitched);

          const rDelivered=isLast?remDelivered:Math.min(reqRow.qty,remDelivered);
          remDelivered=Math.max(0,remDelivered-rDelivered);

          const availableReady=Math.max(0,rStitched-rDelivered);

          resultList.push({
            school:schoolName,
            year:reqRow.year,
            gender:reqRow.gender,
            garment:reqRow.garment,
            size:reqRow.size,
            required:reqRow.qty,
            stitched:rStitched,
            ready:availableReady,
            pendingProd:Math.max(0,reqRow.qty-rStitched),
            delivered:rDelivered,
            pendingDel:Math.max(0,reqRow.qty-rDelivered)
          });
        });
      }else{
        const sampleKey=Array.from(readyTotalsMap.keys()).find(k=>k.endsWith(`||${gender}||${garment}||${size}`)) || Array.from(deliveredTotalsMap.keys()).find(k=>k.endsWith(`||${gender}||${garment}||${size}`));
        const year=sampleKey?sampleKey.split('||')[0]:academicYear();
        resultList.push({
          school:schoolName,
          year,
          gender,
          garment,
          size,
          required:0,
          stitched:totalComboStitched,
          ready:Math.max(0,totalComboStitched-totalComboDelivered),
          pendingProd:0,
          delivered:totalComboDelivered,
          pendingDel:0
        });
      }
    });

    return resultList;
  },[students,schoolStock,schoolSales]);

  const productSummary=useMemo(()=>{
    if(!viewSchool)return [];
    return computeProductSummary(viewSchool.name);
  },[viewSchool,computeProductSummary]);

  const availableYears=useMemo(()=>Array.from(new Set(productSummary.map(r=>r.year))).sort().reverse(),[productSummary]);
  const availableGarments=useMemo(()=>Array.from(new Set(productSummary.map(r=>r.garment))).sort(),[productSummary]);
  const availableSizes=useMemo(()=>Array.from(new Set(productSummary.map(r=>r.size))).sort((a,b)=>(Number(a)||0)-(Number(b)||0)),[productSummary]);

  const filteredProductSummary=useMemo(()=>{
    return productSummary.filter(row=>{
      if(summaryFilterYear!=='All'&&row.year!==summaryFilterYear)return false;
      if(summaryFilterGender!=='All'&&row.gender!==summaryFilterGender)return false;
      if(summaryFilterGarment!=='All'&&row.garment!==summaryFilterGarment)return false;
      if(summaryFilterSize!=='All'&&row.size!==summaryFilterSize)return false;
      if(summaryFilterStatus!=='All'){
        if(summaryFilterStatus==='available'&&!(row.ready>0))return false;
        if(summaryFilterStatus==='zero-ready'&&!(row.ready<=0))return false;
        if(summaryFilterStatus==='ready'&&!(row.stitched>=row.required&&row.required>0))return false;
        if(summaryFilterStatus==='partial-ready'&&!(row.stitched>0&&row.stitched<row.required))return false;
        if(summaryFilterStatus==='pending-prod'&&!(row.pendingProd>0))return false;
        if(summaryFilterStatus==='delivered'&&!(row.delivered>=row.required&&row.required>0))return false;
        if(summaryFilterStatus==='partial-del'&&!(row.delivered>0&&row.delivered<row.required))return false;
        if(summaryFilterStatus==='pending-del'&&!(row.pendingDel>0))return false;
      }
      return true;
    });
  },[productSummary,summaryFilterYear,summaryFilterGender,summaryFilterGarment,summaryFilterSize,summaryFilterStatus]);

  const handleSortSummary=(field:SummarySortField)=>{
    if(summarySortField===field){
      setSummarySortDir(d=>d==='asc'?'desc':'asc');
    }else{
      setSummarySortField(field);
      setSummarySortDir('asc');
    }
    setSummaryPage(1);
  };

  const sortedProductSummary=useMemo(()=>{
    const list=[...filteredProductSummary];
    if(!summarySortField) return list;

    return list.sort((a,b)=>{
      let cmp=0;
      if(summarySortField==='garment'){
        cmp=a.garment.localeCompare(b.garment);
      } else if(summarySortField==='year'){
        cmp=a.year.localeCompare(b.year);
      } else if(summarySortField==='gender'){
        cmp=a.gender.localeCompare(b.gender);
      } else if(summarySortField==='size'){
        const numA=parseFloat(a.size.replace(/[^\d.]/g,''));
        const numB=parseFloat(b.size.replace(/[^\d.]/g,''));
        if(!isNaN(numA)&&!isNaN(numB)&&/\d/.test(a.size)&&/\d/.test(b.size)){
          cmp=numA-numB;
        }else{
          cmp=a.size.localeCompare(b.size);
        }
      } else if(summarySortField==='required'){
        cmp=a.required-b.required;
      } else if(summarySortField==='ready'){
        cmp=a.ready-b.ready;
      } else if(summarySortField==='stitched'){
        cmp=a.stitched-b.stitched;
      } else if(summarySortField==='delivered'){
        cmp=a.delivered-b.delivered;
      } else if(summarySortField==='deliveryStatus'){
        cmp=a.pendingDel-b.pendingDel;
      }

      if(cmp===0 && summarySortField!=='garment'){
        cmp=a.garment.localeCompare(b.garment);
      }
      if(cmp===0 && summarySortField!=='size'){
        const numA=parseFloat(a.size.replace(/[^\d.]/g,''));
        const numB=parseFloat(b.size.replace(/[^\d.]/g,''));
        if(!isNaN(numA)&&!isNaN(numB)&&/\d/.test(a.size)&&/\d/.test(b.size)){
          cmp=numA-numB;
        }else{
          cmp=a.size.localeCompare(b.size);
        }
      }

      return summarySortDir==='asc'?cmp:-cmp;
    });
  },[filteredProductSummary,summarySortField,summarySortDir]);

  const summaryTotalPages=useMemo(()=>Math.max(1,Math.ceil(sortedProductSummary.length/summaryRowsPerPage)),[sortedProductSummary,summaryRowsPerPage]);
  const pagedProductSummary=useMemo(()=>{
    const start=(summaryPage-1)*summaryRowsPerPage;
    return sortedProductSummary.slice(start,start+summaryRowsPerPage);
  },[sortedProductSummary,summaryPage,summaryRowsPerPage]);

  const renderSortHeader = (field: SummarySortField, label: string, style?: React.CSSProperties) => {
    const isActive = summarySortField === field;
    return (
      <th
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          color: isActive ? '#007c68' : undefined,
          background: isActive ? '#e6f7f3' : undefined,
          transition: 'all 0.15s ease',
          ...style
        }}
        onClick={() => handleSortSummary(field)}
        title={`Click to sort by ${label} (${isActive && summarySortDir === 'asc' ? 'descending' : 'ascending'})`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: style?.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
          <span>{label}</span>
          {isActive ? (
            summarySortDir === 'asc' ? <ArrowUp size={13} color="#007c68" strokeWidth={2.5} /> : <ArrowDown size={13} color="#007c68" strokeWidth={2.5} />
          ) : (
            <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
          )}
        </div>
      </th>
    );
  };

  const selectedRowsList=useMemo(()=>{
    return productSummary.filter(r=>selectedRowKeys.has(`${r.year}||${r.gender}||${r.garment}||${r.size}`));
  },[productSummary,selectedRowKeys]);

  const selectedMetrics=useMemo(()=>{
    return {
      required: selectedRowsList.reduce((a,b)=>a+b.required,0),
      stitched: selectedRowsList.reduce((a,b)=>a+b.stitched,0),
      ready: selectedRowsList.reduce((a,b)=>a+b.ready,0),
      pendingProd: selectedRowsList.reduce((a,b)=>a+b.pendingProd,0),
      delivered: selectedRowsList.reduce((a,b)=>a+b.delivered,0),
      pendingDel: selectedRowsList.reduce((a,b)=>a+b.pendingDel,0),
    };
  },[selectedRowsList]);

  const isAllCurrentPageSelected = pagedProductSummary.length > 0 && pagedProductSummary.every(r=>selectedRowKeys.has(`${r.year}||${r.gender}||${r.garment}||${r.size}`));
  const isSomeCurrentPageSelected = pagedProductSummary.some(r=>selectedRowKeys.has(`${r.year}||${r.gender}||${r.garment}||${r.size}`));

  const toggleRowSelect=(key:string)=>{
    setSelectedRowKeys(prev=>{
      const next=new Set(prev);
      if(next.has(key))next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectCurrentPage=()=>{
    setSelectedRowKeys(prev=>{
      const next=new Set(prev);
      if(isAllCurrentPageSelected){
        pagedProductSummary.forEach(r=>next.delete(`${r.year}||${r.gender}||${r.garment}||${r.size}`));
      }else{
        pagedProductSummary.forEach(r=>next.add(`${r.year}||${r.gender}||${r.garment}||${r.size}`));
      }
      return next;
    });
  };

  const selectAllFiltered=()=>{
    setSelectedRowKeys(new Set(sortedProductSummary.map(r=>`${r.year}||${r.gender}||${r.garment}||${r.size}`)));
  };

  const clearSelection=()=>{
    setSelectedRowKeys(new Set());
  };

  const openMultiAddStockModal=()=>{
    if(!selectedRowsList.length)return;
    const initialQty:Record<string,number>={};
    selectedRowsList.forEach(r=>{
      const k=`${r.year}||${r.gender}||${r.garment}||${r.size}`;
      initialQty[k]=r.pendingProd>0?r.pendingProd:(r.required>0?r.required:1);
    });
    setMultiAddItems(initialQty);
    setMultiAddDate(new Date().toISOString().slice(0,10));
    setMultiAddRemarks('Batch production ready stock');
    setShowMultiAddModal(true);
  };

  const saveMultiAddStock=()=>{
    if(!viewSchool)return;
    let totalPcs=0;
    let itemsCount=0;
    const dateStr=multiAddDate||new Date().toISOString().slice(0,10);
    const remarksStr=multiAddRemarks?.trim()||'Multi-row ready stock';

    setSchoolStock(current=>{
      let updated=[...current];
      selectedRowsList.forEach(r=>{
        const k=`${r.year}||${r.gender}||${r.garment}||${r.size}`;
        const qty=Number(multiAddItems[k])||0;
        if(qty<=0)return;
        totalPcs+=qty;
        itemsCount+=1;
        const existingIdx=updated.findIndex(s=>
          s.school===viewSchool.name &&
          (s.gender||'Boys').toLowerCase()===r.gender.toLowerCase() &&
          s.garment.toLowerCase()===r.garment.toLowerCase() &&
          s.size===r.size
        );
        if(existingIdx!==-1){
          updated[existingIdx]={
            ...updated[existingIdx],
            count:updated[existingIdx].count+qty,
            date:dateStr,
            remarks:remarksStr||updated[existingIdx].remarks
          };
        }else{
          const entry:SchoolStock={
            id:`RST-${Date.now()}-${itemsCount}-${Math.random().toString(36).slice(2,7)}`,
            school:viewSchool.name,
            className:'General',
            date:dateStr,
            gender:r.gender,
            garment:r.garment,
            size:r.size,
            count:qty,
            remarks:remarksStr
          };
          updated=[entry,...updated];
        }
      });
      return updated;
    });

    setToast(`Added ${totalPcs} ready stock pieces across ${itemsCount} items.`);
    setTimeout(()=>setToast(''),3000);
    setShowMultiAddModal(false);
    setSelectedRowKeys(new Set());
  };

  const getGarmentMasterPrice = (garmentName: string, sizeName: string): number => {
    if (!garmentPrices || !garmentPrices.length) return 0;
    const gNorm = garmentName.trim().toLowerCase();
    const sNorm = sizeName.trim().toLowerCase();

    // 1. Exact match on garment type & size
    const exact = garmentPrices.find(p =>
      p.garmentType.trim().toLowerCase() === gNorm &&
      p.size.trim().toLowerCase() === sNorm
    );
    if (exact && exact.price > 0) return exact.price;

    // 2. Substring match on garment type & exact size
    const partial = garmentPrices.find(p => {
      const pType = p.garmentType.trim().toLowerCase();
      return (gNorm.includes(pType) || pType.includes(gNorm)) &&
        p.size.trim().toLowerCase() === sNorm;
    });
    if (partial && partial.price > 0) return partial.price;

    // 3. Match garment type alone fallback
    const garmentOnly = garmentPrices.find(p => {
      const pType = p.garmentType.trim().toLowerCase();
      return gNorm === pType || gNorm.includes(pType) || pType.includes(gNorm);
    });
    if (garmentOnly && garmentOnly.price > 0) return garmentOnly.price;

    return 0;
  };

  const openDeliverAllReadyStockModal=()=>{
    if(!viewSchool)return;
    const readyStockRows = productSummary.filter(r => r.ready > 0);
    if (!readyStockRows.length) {
      setToast('No ready stock available to deliver for this school.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    const allReadyKeys = new Set(readyStockRows.map(r => `${r.year}||${r.gender}||${r.garment}||${r.size}`));
    setSelectedRowKeys(allReadyKeys);
    const initialData: Record<string, { deliverQty: number; rate: number }> = {};
    readyStockRows.forEach(r => {
      const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
      const autoRate = getGarmentMasterPrice(r.garment, r.size);
      initialData[k] = {
        deliverQty: r.ready,
        rate: autoRate
      };
    });
    setMultiDeliverItems(initialData);
    setDeliveryHelperNotice('');
    setMultiDeliverDiscount(0);
    setMultiDeliverDiscountType('flat');
    setMultiDeliverDate(new Date().toISOString().slice(0, 10));
    setMultiDeliverInvoiceNo(`INV-${String(invoices.length + 1).padStart(3, '0')}`);
    setMultiDeliverRemarks('Deliver all ready uniform stock');
    setShowMultiDeliverModal(true);
  };

  const openMultiDeliverStockModal=()=>{
    if(!selectedRowsList.length)return;
    const initialData:Record<string,{deliverQty:number;rate:number}>={};
    selectedRowsList.forEach(r=>{
      const k=`${r.year}||${r.gender}||${r.garment}||${r.size}`;
      const deliverable=Math.max(0,Math.min(r.ready,r.pendingDel>0?r.pendingDel:r.ready));
      const autoRate = getGarmentMasterPrice(r.garment, r.size);
      initialData[k]={
        deliverQty:deliverable,
        rate:autoRate
      };
    });
    setMultiDeliverItems(initialData);
    setDeliveryHelperNotice('');
    setMultiDeliverDiscount(0);
    setMultiDeliverDiscountType('flat');
    setMultiDeliverDate(new Date().toISOString().slice(0,10));
    setMultiDeliverInvoiceNo(`INV-${String(invoices.length+1).padStart(3,'0')}`);
    setMultiDeliverRemarks('Delivered to school');
    setShowMultiDeliverModal(true);
  };

  const saveMultiDelivery=async()=>{
    if(!viewSchool)return;
    const deliverEntries:{row:typeof selectedRowsList[0];qty:number;rate:number}[]=[];
    selectedRowsList.forEach(r=>{
      const k=`${r.year}||${r.gender}||${r.garment}||${r.size}`;
      const item=multiDeliverItems[k];
      const qty=Number(item?.deliverQty)||0;
      const rate=Number(item?.rate)||0;
      if(qty>0){
        deliverEntries.push({row:r,qty,rate});
      }
    });

    if(deliverEntries.length===0){
      setToast('Please enter delivery quantity greater than 0 for at least one item.');
      setTimeout(()=>setToast(''),3000);
      return;
    }

    for (const e of deliverEntries) {
      if (e.qty > e.row.ready) {
        setToast(`Cannot deliver ${e.qty} Pcs of ${e.row.garment} (${e.row.size}). Available ready stock is only ${e.row.ready} Pcs.`);
        setTimeout(()=>setToast(''),4000);
        return;
      }
    }

    const invNumber=multiDeliverInvoiceNo.trim()||`INV-${String(invoices.length+1).padStart(3,'0')}`;
    if(invoices.some(inv=>inv.invoiceNo===invNumber)){
      setToast(`Invoice ${invNumber} already exists. Please choose a different invoice number.`);
      setTimeout(()=>setToast(''),3000);
      return;
    }

    const deliveryDateStr=multiDeliverDate||new Date().toISOString().slice(0,10);
    const totalPieces=deliverEntries.reduce((a,b)=>a+b.qty,0);
    const grossSubtotal=deliverEntries.reduce((a,b)=>a+(b.qty*b.rate),0);
    const discountAmount = multiDeliverDiscountType === 'percentage'
      ? Math.round((grossSubtotal * (Number(multiDeliverDiscount) || 0) / 100) * 100) / 100
      : Math.min(Number(multiDeliverDiscount) || 0, grossSubtotal);
    const taxableAmount = Math.max(0, grossSubtotal - discountAmount);
    const gstPct=Number(multiDeliverGst)||0;
    const halfGst=gstPct/2;
    const taxAmount=taxableAmount*(gstPct/100);
    const totalAmount=Math.round((taxableAmount+taxAmount)*100)/100;

    const invoiceItems:InvoiceItem[]=deliverEntries.map(e=>({
      garment:e.row.garment,
      size:e.row.size,
      qty:e.qty,
      rate:e.rate,
      amount:e.qty*e.rate,
      gender:e.row.gender
    }));

    const uniqueGenders = Array.from(new Set(deliverEntries.map(e => e.row.gender).filter(Boolean)));
    const uniqueGarments = Array.from(new Set(deliverEntries.map(e => e.row.garment)));
    const uniqueSizes = Array.from(new Set(deliverEntries.map(e => e.row.size)));

    // Generate ONLY ONE StockSale issue entry for this delivery
    const newSale: StockSale = {
      id: `SS-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      date: deliveryDateStr,
      type: 'School',
      party: viewSchool.name,
      gender: uniqueGenders.length === 1 ? uniqueGenders[0] : 'Mixed',
      garment: uniqueGarments.length === 1 ? uniqueGarments[0] : uniqueGarments.join(', '),
      size: uniqueSizes.length === 1 ? uniqueSizes[0] : uniqueSizes.join(', '),
      count: totalPieces,
      rate: totalPieces > 0 ? Math.round(taxableAmount / totalPieces) : 0,
      total: taxableAmount,
      invoiceNo: invNumber,
      remarks: multiDeliverRemarks?.trim() || '-',
      items: invoiceItems
    };

    const productSummaryText=deliverEntries.map(e=>`${e.row.garment} (${e.row.size}) × ${e.qty}`).join(', ');

    const newInvoice:Invoice={
      invoiceNo:invNumber,
      invoiceDate:deliveryDateStr,
      dueDate:'',
      state:'',
      reverseCharge:'NO',
      customer:viewSchool.name,
      customerPhone:viewSchool.phone||'',
      customerGst:'',
      customerAddress:viewSchool.location||'',
      shipTo:viewSchool.name,
      shipAddress:viewSchool.location||'',
      shipGst:'',
      product:productSummaryText,
      hsn:'',
      qty:totalPieces,
      unit:'PCS',
      rate:totalPieces>0?Math.round(taxableAmount/totalPieces):0,
      cgst:halfGst,
      sgst:halfGst,
      grossAmount:grossSubtotal,
      discount:discountAmount,
      discountType:multiDeliverDiscountType,
      taxableAmount:taxableAmount,
      totalAmount:totalAmount,
      status:'Pending' as Invoice['status'],
      terms:'This is an electronically generated document. All disputes are subject to local jurisdiction.',
      items:invoiceItems,
      gstPercent:gstPct
    };

    const currentAdvanceCredit = Math.max(0, schoolCollectedTotal - schoolDeliveredTotal);
    let advanceAdjustAmt = 0;

    if (autoAdjustAdvance && currentAdvanceCredit > 0) {
      advanceAdjustAmt = Math.min(totalAmount, currentAdvanceCredit);
      if (advanceAdjustAmt > 0) {
        newInvoice.status = advanceAdjustAmt >= totalAmount ? 'Paid' : 'Partially Paid';
        const advPay: InvoicePayment = {
          id: `IP-ADV-${Date.now()}`,
          date: deliveryDateStr,
          invoiceNo: invNumber,
          customer: viewSchool.name,
          mode: 'Advance Adjustment',
          amount: advanceAdjustAmt,
          reference: 'Advance Credit',
          remarks: `Auto-settled against available school advance credit (${money(advanceAdjustAmt)})`
        };
        setPayments(current => [advPay, ...current]);
      }
    }

    setSchoolSales(current=>[newSale,...current]);
    setInvoices(current=>[newInvoice,...current]);

    const statusNote = advanceAdjustAmt >= totalAmount
      ? ` (Settled from advance credit: ${money(advanceAdjustAmt)})`
      : advanceAdjustAmt > 0
      ? ` (${money(advanceAdjustAmt)} adjusted from advance, balance ${money(totalAmount - advanceAdjustAmt)} due)`
      : '';
    const discountNote = discountAmount > 0 ? ` (Discount: ${money(discountAmount)})` : '';
    const deliveredSchool=viewSchool.name;
    setToast(`Delivered ${totalPieces} pcs to ${deliveredSchool}. Invoice ${invNumber} created${discountNote}${statusNote}.`);
    setDeliveryInvoiceLink({invoiceNo:invNumber,school:deliveredSchool});
    setTimeout(()=>{
      setToast('');
      setDeliveryInvoiceLink(current=>current?.invoiceNo===invNumber?null:current);
    },8000);
    setShowMultiDeliverModal(false);
    setSelectedRowKeys(new Set());
  };

  const schoolDeliveredTotal=useMemo(()=>{
    if(!viewSchool)return 0;
    return schoolSales
      .filter(s=>s.type==='School'&&s.party===viewSchool.name)
      .reduce((sum,s)=>sum+s.total,0);
  },[viewSchool,schoolSales]);

  const schoolCollectedTotal=useMemo(()=>{
    if(!viewSchool)return 0;
    return schoolCollections
      .filter(c=>c[2]===viewSchool.name)
      .reduce((sum,c)=>{
        const match=(c[4]||'').match(/\d[\d,]*(?:\.\d+)?/);
        const val=match?Number(match[0].replace(/,/g,'')):0;
        return sum+val;
      },0);
  },[viewSchool,schoolCollections]);

  const schoolPendingBalance=Math.max(0,schoolDeliveredTotal-schoolCollectedTotal);
  const schoolAdvanceBalance=Math.max(0,schoolCollectedTotal-schoolDeliveredTotal);

  const selectedRowBreakdown=useMemo(()=>{
    if(!viewSchool||!selectedSummaryRow)return null;
    const {year,gender,garment,size}=selectedSummaryRow;
    const schoolName=viewSchool.name;

    const matchingStudents=(students||[]).filter(st=>{
      if(st.school!==schoolName)return false;
      if(!st.sizes||st.sizes[garment]!==size)return false;
      if(gender&&st.gender&&st.gender!==gender)return false;
      if(year&&st.year&&normalizeAcademicYear(st.year)!==normalizeAcademicYear(year))return false;
      return true;
    });

    const batchesMap=new Map<string,{date:string;year:string;className:string;studentCount:number;studentNames:string[]}>();

    matchingStudents.forEach(st=>{
      const d=(st as any).date||(st as any).createdAt||(st.year?`Academic Year ${st.year}`:'Initial Batch');
      const batchKey=`${d}||${st.className||'General'}`;
      const cur=batchesMap.get(batchKey) || {
        date:d,
        year:st.year||'-',
        className:st.className||'All Classes',
        studentCount:0,
        studentNames:[] as string[]
      };
      cur.studentCount+=1;
      if(st.name)cur.studentNames.push(`${st.name}${st.admission?` (${st.admission})`:''}`);
      batchesMap.set(batchKey,cur);
    });

    const totalDeliveredForGarmentSize=schoolSales
      .filter(s=>s.type==='School'&&s.party===schoolName)
      .reduce((sum,s)=>{
        if(s.items && s.items.length > 0){
          const matches = s.items.filter(it => (!gender||!it.gender||it.gender.toLowerCase()===gender.toLowerCase()) && it.garment.toLowerCase()===garment.toLowerCase() && it.size===size);
          return sum + matches.reduce((a,it)=>a+it.qty,0);
        }
        if((!gender||!s.gender||s.gender.toLowerCase()===gender.toLowerCase()) && s.garment.toLowerCase()===garment.toLowerCase() && s.size===size){
          return sum + s.count;
        }
        return sum;
      },0);

    let remainingDelivered=totalDeliveredForGarmentSize;

    const batchList=Array.from(batchesMap.values()).map(b=>{
      const del=Math.min(b.studentCount,remainingDelivered);
      remainingDelivered-=del;
      const pending=Math.max(0,b.studentCount-del);
      return {
        ...b,
        delivered:del,
        pending
      };
    });

    return {
      gender,
      garment,
      size,
      totalMeasured:matchingStudents.length,
      totalDelivered:totalDeliveredForGarmentSize,
      totalPending:Math.max(0,matchingStudents.length-totalDeliveredForGarmentSize),
      batches:batchList
    };
  },[viewSchool,selectedSummaryRow,students,schoolSales]);

  const emptySchoolForm=()=>setSchoolForm({name:'',contact:'',phone:'',location:'',uniform:'',status:'Active',logo:'',boysPhotos:[],girlsPhotos:[],versionYear:academicYear(),versionNote:'',versionAction:'new'});
  const customerRows=customers.filter(c=>c.join(' ').toLowerCase().includes(customerSearch.toLowerCase())&&(customerType==='All'||c[2]===customerType)&&(customerStatus==='All'||c[5]===customerStatus));
  const schoolRows=schools.filter(s=>[s.id,s.name,s.contact,s.phone,s.location,s.uniform,s.status].join(' ').toLowerCase().includes(schoolSearch.toLowerCase())&&(schoolStatus==='All'||s.status===schoolStatus));
  const uploadSchoolLogo=async(file?:File)=>{if(!file)return;try{const url=await uploadSchoolMedia(file,mediaSchoolId,'school-logo');setSchoolForm(current=>({...current,logo:url}))}catch(error){setToast(error instanceof Error?error.message:'Logo upload failed')}};
  const openProductionSms=(school:School)=>setSmsDraft({recipientName:school.contact||school.name,recipientPhone:school.phone==='-'?'':school.phone,title:`Production update - ${school.name}`,message:`Dear ${school.contact||school.name}, the uniform production status for ${school.name} has been updated. Please contact us for details. - ${company?.name||'Your Business'}`});
  const sendProductionSms=async()=>{if(!smsDraft)return;setSendingSms(true);const result=await sendSmsViaGateway({recipientName:smsDraft.recipientName,recipientPhone:smsDraft.recipientPhone,message:smsDraft.message,referenceType:'school_production',referenceId:smsDraft.title});setSendingSms(false);setToast(result.message);if(result.ok)setSmsDraft(null)};
  const openSchoolProduction=(school:School)=>onNavigate?.('Production',{openSchool:school.name});
  const uploadPhotos=async(key:'boysPhotos'|'girlsPhotos',files?:FileList|null)=>{if(!files||!files.length)return;try{const category=key==='boysPhotos'?'boys-dress':'girls-dress';const urls=await Promise.all(Array.from(files).map(file=>uploadSchoolMedia(file,mediaSchoolId,category)));setSchoolForm(current=>({...current,[key]:[...current[key],...urls]}))}catch(error){setToast(error instanceof Error?error.message:'Photo upload failed')}};
  const removePhoto=(key:'boysPhotos'|'girlsPhotos',index:number)=>setSchoolForm(current=>({...current,[key]:current[key].filter((_,i)=>i!==index)}));
  const startEditCustomer=(row:string[])=>{setCustomerForm({name:row[1],type:row[2],phone:row[3],location:row[4],status:row[5]});setEditCustomerId(row[0]);setShowCustomerForm(true)};
  const closeCustomerForm=()=>{setShowCustomerForm(false);setEditCustomerId(null);setCustomerForm({name:'',type:'Retail',phone:'',location:'',status:'Active'})};
  const startEditSchool=(s:School)=>{const active=activeDress(s);setMediaSchoolId(s.id);setSchoolForm({name:s.name,contact:s.contact,phone:s.phone,location:s.location,uniform:s.uniform,status:s.status,logo:s.logo,boysPhotos:[...active.boysPhotos],girlsPhotos:[...active.girlsPhotos],versionYear:academicYear(),versionNote:'',versionAction:'new'});setEditSchoolId(s.id);setShowSchoolForm(true)};
  const closeSchoolForm=()=>{setShowSchoolForm(false);setEditSchoolId(null);emptySchoolForm()};
  const saveCustomer=()=>{if(!customerForm.name.trim())return;const id=editCustomerId||`CUS-${String(customers.length+1).padStart(3,'0')}`;const row=[id,customerForm.name.trim(),customerForm.type,customerForm.phone||'-',customerForm.location||'-',customerForm.status];if(editCustomerId){setCustomers(current=>current.map(c=>c[0]===editCustomerId?row:c))}else{setCustomers(current=>[row,...current])}setCustomerForm({name:'',type:'Retail',phone:'',location:'',status:'Active'});setEditCustomerId(null);setShowCustomerForm(false);setToast(`${row[1]} ${editCustomerId?'updated':'saved'} successfully`);window.setTimeout(()=>setToast(''),2500)};
  const saveSchool=()=>{if(!schoolForm.name.trim())return;const today=new Date().toISOString().slice(0,10);const year=schoolForm.versionYear.trim()||academicYear();const note=schoolForm.versionNote.trim();const base={name:schoolForm.name.trim(),contact:schoolForm.contact||'-',phone:schoolForm.phone||'-',location:schoolForm.location||'-',uniform:schoolForm.uniform||'-',status:schoolForm.status,logo:schoolForm.logo};if(editSchoolId){const id=editSchoolId;setSchools(current=>current.map(s=>{if(s.id!==id)return s;if(schoolForm.versionAction==='new'){return{...s,...base,dressVersions:[...s.dressVersions,{id:`DV-${Date.now()}`,year,note,date:today,boysPhotos:[...schoolForm.boysPhotos],girlsPhotos:[...schoolForm.girlsPhotos]}]}}return{...s,...base,dressVersions:s.dressVersions.map((v,i)=>i===s.dressVersions.length-1?{...v,year,note,boysPhotos:[...schoolForm.boysPhotos],girlsPhotos:[...schoolForm.girlsPhotos]}:v)}}))}else{setSchools(current=>[{id:mediaSchoolId,...base,dressVersions:[{id:`DV-${Date.now()}`,year,note,date:today,boysPhotos:[...schoolForm.boysPhotos],girlsPhotos:[...schoolForm.girlsPhotos]}]},...current])}emptySchoolForm();setMediaSchoolId(nextSchoolId());setEditSchoolId(null);setShowSchoolForm(false);setToast(`${schoolForm.name.trim()} ${editSchoolId?'updated':'saved'} successfully`);window.setTimeout(()=>setToast(''),2500)};
  const deleteCustomer=(id:string)=>{const name=customers.find(c=>c[0]===id)?.[1]||'Customer';setCustomers(current=>current.filter(c=>c[0]!==id));setToast(`${name} deleted`);window.setTimeout(()=>setToast(''),2500)};
  const deleteSchool=(id:string)=>{const name=schools.find(s=>s.id===id)?.name||'School';setSchools(current=>current.filter(s=>s.id!==id));setToast(`${name} deleted`);window.setTimeout(()=>setToast(''),2500)};
  const photoPreview=(key:'boysPhotos'|'girlsPhotos')=>schoolForm[key].length?<div className="photo-preview-list">{schoolForm[key].map((p,i)=><div key={i}><img src={assetUrl(p)} alt=""/><button className="mini-remove" onClick={()=>removePhoto(key,i)}>×</button></div>)}</div>:null;
  const dressPhotoGroup=(title:string,photos:string[],empty:string,alt:string)=>(<div className="photo-group"><h3>{title}<small>{photos.length}</small></h3>{photos.length?<div className="photo-grid">{photos.map((p,i)=><img key={i} src={assetUrl(p)} alt={alt}/>)}</div>:<p className="photo-empty">{empty}</p>}</div>);
  const ActionMenu=({rowKey,onView,onEdit,onDelete}:{rowKey:string;onView:()=>void;onEdit:()=>void;onDelete:()=>void})=>{
    const open=menuPos?.key===rowKey;
    return <div className="action-menu"><button className="action-menu-btn" title="Actions" onClick={e=>{e.stopPropagation();if(open){setMenuPos(null)}else{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPos({key:rowKey,x:Math.min(r.right-132,window.innerWidth-150),y:r.bottom+5})}}}>⋯</button>{open&&<div className="action-menu-drop" style={{left:menuPos.x,top:menuPos.y}} onClick={e=>e.stopPropagation()}><button onClick={()=>{onView();setMenuPos(null)}}><Eye size={14}/> View</button><button onClick={()=>{onEdit();setMenuPos(null)}}><Pencil size={14}/> Edit</button><button className="danger" onClick={()=>{onDelete();setMenuPos(null)}}><Trash2 size={14}/> Delete</button></div>}</div>;
  };
  return <section className="content">
    {!productionMode&&<nav className="customer-school-tabs" aria-label="Customers and schools"><button type="button" className={tab==='schools'?'active':''} aria-current={tab==='schools'?'page':undefined} onClick={()=>setTab('schools')}><Factory size={15}/><span>Schools</span><small>{schools.length}</small></button><button type="button" className={tab==='customers'?'active':''} aria-current={tab==='customers'?'page':undefined} onClick={()=>setTab('customers')}><Users size={15}/><span>Customers</span><small>{customers.length}</small></button></nav>}
    {tab==='customers'&&<><div className="filterbar salary-filter"><label>Search<input value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Zudio, Redflame, phone"/></label><label>Type<select value={customerType} onChange={e=>setCustomerType(e.target.value)}><option>All</option><option>Retail</option><option>Corporate</option></select></label><label>Status<select value={customerStatus} onChange={e=>setCustomerStatus(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label><button className="primary" onClick={()=>{setEditCustomerId(null);setCustomerForm({name:'',type:'Retail',phone:'',location:'',status:'Active'});setShowCustomerForm(true)}}><Plus size={16}/> Add customer</button></div>{showCustomerForm&&<div className="stock-modal-overlay" onClick={closeCustomerForm}><article className="card measurement-form entry-modal" onClick={e=>e.stopPropagation()}><div className="form-title"><div><h2>{editCustomerId?'Edit customer':'Add customer'}</h2><p>Create retail or corporate customer details.</p></div><button className="outline" onClick={closeCustomerForm}>Close</button></div><div className="form-grid"><label>Customer name<input value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})} placeholder="Zudio, Redflame"/></label><label>Type<select value={customerForm.type} onChange={e=>setCustomerForm({...customerForm,type:e.target.value})}><option>Retail</option><option>Corporate</option></select></label><label>Phone<input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})} placeholder="Mobile / phone"/></label><label>Location<input value={customerForm.location} onChange={e=>setCustomerForm({...customerForm,location:e.target.value})} placeholder="City or area"/></label><label>Status<select value={customerForm.status} onChange={e=>setCustomerForm({...customerForm,status:e.target.value})}><option>Active</option><option>Inactive</option></select></label></div><div className="form-actions"><button className="outline" onClick={closeCustomerForm}>Cancel</button><button className="primary" onClick={saveCustomer}><Plus size={16}/> {editCustomerId?'Update customer':'Save customer'}</button></div></article></div>}<Table title="Customer list" copy="Customer records used for orders and billing" headers={['CUSTOMER ID','CUSTOMER','TYPE','PHONE','LOCATION','STATUS']} rows={customerRows} actions={r=><ActionMenu rowKey={'cus-'+r[0]} onView={()=>setViewCustomer(r)} onEdit={()=>startEditCustomer(r)} onDelete={()=>deleteCustomer(r[0])}/>}/>{viewCustomer&&<div className="stock-modal-overlay" onClick={()=>setViewCustomer(null)}><div className="card detail-modal" onClick={e=>e.stopPropagation()}><div className="cardhead"><div><h2>{viewCustomer[1]}</h2><p>{viewCustomer[0]} · Customer details</p></div><button className="outline" onClick={()=>setViewCustomer(null)}>Close</button></div><div className="detail-grid"><div><span>Customer ID</span><strong>{viewCustomer[0]}</strong></div><div><span>Type</span><strong>{viewCustomer[2]}</strong></div><div><span>Phone</span><strong>{viewCustomer[3]}</strong></div><div><span>Location</span><strong>{viewCustomer[4]}</strong></div><div><span>Status</span><strong>{viewCustomer[5]}</strong></div></div></div></div>}</>}
    {tab==='schools'&&<>
      {!productionMode&&<>
      <div className="filterbar salary-filter"><label>Search<input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} placeholder="School, contact, phone"/></label><label>Status<select value={schoolStatus} onChange={e=>setSchoolStatus(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label><button className="primary" onClick={()=>{setEditSchoolId(null);setMediaSchoolId(nextSchoolId());emptySchoolForm();setShowSchoolForm(true)}}><Plus size={16}/> Add school</button></div>
      {showSchoolForm&&<div className="stock-modal-overlay" onClick={closeSchoolForm}><article className="card measurement-form entry-modal" onClick={e=>e.stopPropagation()}>
        <div className="form-title"><div><h2>{editSchoolId?'Edit school':'Add school'}</h2><p>Add school details with logo and dress photos.</p></div><button className="outline" onClick={closeSchoolForm}>Close</button></div>
        <div className="form-grid">
          <label>School name<input value={schoolForm.name} onChange={e=>setSchoolForm({...schoolForm,name:e.target.value})} placeholder="Enter school name"/></label>
          <label>Contact person<input value={schoolForm.contact} onChange={e=>setSchoolForm({...schoolForm,contact:e.target.value})} placeholder="Principal / admin contact"/></label>
          <label>Phone<input value={schoolForm.phone} onChange={e=>setSchoolForm({...schoolForm,phone:e.target.value})} placeholder="School phone"/></label>
          <label>Location<input value={schoolForm.location} onChange={e=>setSchoolForm({...schoolForm,location:e.target.value})} placeholder="City or area"/></label>
          <label>Uniform type<input value={schoolForm.uniform} onChange={e=>setSchoolForm({...schoolForm,uniform:e.target.value})} placeholder="Uniform set, sports uniform"/></label>
          <label>Status<select value={schoolForm.status} onChange={e=>setSchoolForm({...schoolForm,status:e.target.value})}><option>Active</option><option>Inactive</option></select></label>
        </div>
        <div className="garment-heading"><div><h3>Dress photos</h3><p>Upload current dress photos. For a design change choose 'Save as new version' to keep history.</p></div></div>
        <div className="form-grid">
          <label className="logo-upload">School logo<input type="file" accept="image/*" onChange={e=>uploadSchoolLogo(e.target.files?.[0])}/><span>{schoolForm.logo?'Logo selected':'Upload school logo'}</span></label>
          {schoolForm.logo&&<div className="logo-preview"><img src={assetUrl(schoolForm.logo)} alt="School logo preview"/><button className="outline" onClick={()=>setSchoolForm({...schoolForm,logo:''})}>Remove</button></div>}
          <label>Dress version year<input value={schoolForm.versionYear} onChange={e=>setSchoolForm({...schoolForm,versionYear:e.target.value})} placeholder="e.g. 2025-26"/></label>
          <label>Change note<input value={schoolForm.versionNote} onChange={e=>setSchoolForm({...schoolForm,versionNote:e.target.value})} placeholder="e.g. collar style changed"/></label>
          {editSchoolId&&<label>Save as<select value={schoolForm.versionAction} onChange={e=>setSchoolForm({...schoolForm,versionAction:e.target.value as 'new'|'update'})}><option value="new">New version (keep history)</option><option value="update">Update current version</option></select></label>}
          <label className="logo-upload">Boys dress photos<input type="file" accept="image/*" multiple onChange={e=>uploadPhotos('boysPhotos',e.target.files)}/><span>{schoolForm.boysPhotos.length?`${schoolForm.boysPhotos.length} photo${schoolForm.boysPhotos.length>1?'s':''} selected`:'Upload boys dress photos'}</span></label>
          {photoPreview('boysPhotos')}
          <label className="logo-upload">Girls dress photos<input type="file" accept="image/*" multiple onChange={e=>uploadPhotos('girlsPhotos',e.target.files)}/><span>{schoolForm.girlsPhotos.length?`${schoolForm.girlsPhotos.length} photo${schoolForm.girlsPhotos.length>1?'s':''} selected`:'Upload girls dress photos'}</span></label>
          {photoPreview('girlsPhotos')}
        </div>
        <div className="form-actions"><button className="outline" onClick={closeSchoolForm}>Cancel</button><button className="primary" onClick={saveSchool}><Plus size={16}/> {editSchoolId?'Update school':'Save school'}</button></div>
      </article></div>}
      <article className="card jobs module-table">
        <div className="cardhead"><div><h2>School list</h2><p>School details for measurements and uniform orders</p></div><input className="smallsearch" placeholder="Search..."/></div>
        <table>
          <thead><tr><th>SCHOOL ID</th><th>SCHOOL</th><th>CONTACT</th><th>PHONE</th><th>LOCATION</th><th>STATUS</th><th>SCHOOL SUMMARY</th><th>ACTIONS</th></tr></thead>
          <tbody>{schoolRows.map(s=><tr key={s.id} onClick={()=>openSchoolProduction(s)} style={{cursor:'pointer'}}>
            <td><strong>{s.id}</strong></td>
            <td><div className="school-cell">{s.logo&&<img className="table-thumb" src={assetUrl(s.logo)} alt=""/>}<span style={{color:'#007c68',fontWeight:700,textDecoration:'underline'}}>{s.name}</span></div></td>
            <td>{s.contact}</td>
            <td>{s.phone}</td>
            <td>{s.location}</td>
            <td><span className={'status '+s.status.toLowerCase()}>{s.status}</span></td>
            <td><button className="primary mini-action" onClick={e=>{e.stopPropagation();openSchoolProduction(s)}}>Open Production</button></td>
            <td onClick={e=>e.stopPropagation()}><div className="action-menu"><ActionMenu rowKey={'sch-'+s.id} onView={()=>openSchoolProduction(s)} onEdit={()=>startEditSchool(s)} onDelete={()=>deleteSchool(s.id)}/></div></td>
          </tr>)}</tbody>
        </table>
      </article>
      {photoView&&<div className="stock-modal-overlay" onClick={()=>setPhotoView(null)}>
        <div className="card photo-modal" onClick={e=>e.stopPropagation()}>
          <div className="cardhead"><div><h2>{photoView.name}</h2><p>{photoView.id} · Current uniform photos</p></div><button className="outline" onClick={()=>setPhotoView(null)}>Close</button></div>
          <div className="photo-group"><h3>School logo</h3>{photoView.logo?<img className="photo-item" src={assetUrl(photoView.logo)} alt="School logo"/>:<p className="photo-empty">No logo uploaded</p>}</div>
          {dressPhotoGroup('Current boys dress photos',activeDress(photoView).boysPhotos,'No boys dress photos uploaded','Boys dress photo')}
          {dressPhotoGroup('Current girls dress photos',activeDress(photoView).girlsPhotos,'No girls dress photos uploaded','Girls dress photo')}
        </div>
      </div>}
      </>}
      {productionMode&&!viewSchool&&<article className="card production-empty-state">
        <div className="production-empty-icon"><Scissors size={28}/></div>
        <h2>Production workspace</h2>
        <p>{schools.length?'Select a school to open its production summary.':'Add a school first to start measurements and production tracking.'}</p>
        {schools.length?<div className="production-school-picker">{schools.map(s=><button type="button" className="outline" key={s.id} onClick={()=>setViewSchool(s)}><Factory size={16}/>{s.name}</button>)}</div>:<button type="button" className="primary" onClick={()=>onNavigate?.('Customers & Schools',{tab:'schools'})}><Plus size={16}/> Add school</button>}
      </article>}
      {viewSchool&&<div className={productionMode?'school-production-page':'stock-modal-overlay'} onClick={()=>{if(!productionMode)handleCloseSchoolModal()}}>
        <div className="card detail-modal school-360-modal" style={productionMode?{maxWidth:'none',width:'100%',maxHeight:'none',overflow:'visible'}:{maxWidth:'980px',width:'96vw',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          <div className="cardhead" style={{alignItems:'center',flexWrap:'wrap',gap:12}}>
            <div className="school-header-title" style={{display:'flex',alignItems:'center',gap:12}}>
              {viewSchool.logo&&<img className="school-modal-logo" src={assetUrl(viewSchool.logo)} alt="" style={{width:52,height:52,borderRadius:10,objectFit:'cover'}}/>}
              <div>
                <h2 style={{margin:0,fontSize:20}}>{viewSchool.name}</h2>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:4,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:'#52605c',fontWeight:600}}>{viewSchool.id}</span>
                  {productSummary.reduce((a,b)=>a+b.required,0)>0&&<span className={'status '+(productSummary.reduce((a,b)=>a+b.stitched,0)>=productSummary.reduce((a,b)=>a+b.required,0)?'completed':productSummary.reduce((a,b)=>a+b.stitched,0)>0?'pending':'danger')}>
                    {productSummary.reduce((a,b)=>a+b.stitched,0)>=productSummary.reduce((a,b)=>a+b.required,0)?'🟢 Fully Ready':productSummary.reduce((a,b)=>a+b.stitched,0)>0?`🟡 Partial Ready (${productSummary.reduce((a,b)=>a+b.stitched,0)}/${productSummary.reduce((a,b)=>a+b.required,0)} Pcs)`:`⚪ 0 Pcs Ready (${productSummary.reduce((a,b)=>a+b.required,0)} Pcs)`}
                  </span>}
                  {productSummary.reduce((a,b)=>a+b.required,0)>0&&<span className={'status '+(productSummary.reduce((a,b)=>a+b.delivered,0)>=productSummary.reduce((a,b)=>a+b.required,0)?'completed':productSummary.reduce((a,b)=>a+b.delivered,0)>0?'in-progress':'pending')}>
                    {productSummary.reduce((a,b)=>a+b.delivered,0)>=productSummary.reduce((a,b)=>a+b.required,0)?'🟢 Fully Delivered':productSummary.reduce((a,b)=>a+b.delivered,0)>0?`🔵 Partial Delivered (${productSummary.reduce((a,b)=>a+b.delivered,0)}/${productSummary.reduce((a,b)=>a+b.required,0)} Pcs)`:`⚪ 0 Pcs Delivered`}
                  </span>}
                </div>
              </div>
            </div>
            <div style={{marginLeft:'auto'}}>
              <button
                className="outline"
                style={{whiteSpace:'nowrap',padding:'6px 14px',fontSize:13,fontWeight:600,display:'inline-flex',alignItems:'center',gap:6,cursor:'pointer'}}
                title={productionMode?'Back to Schools':'Close'}
                onClick={handleCloseSchoolModal}
              >
                {productionMode && <ArrowLeft size={15}/>} {productionMode?'Back to Schools':'Close'}
              </button>
            </div>
          </div>

          <div className="school-view-tabs" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginTop:12,marginBottom:12,borderBottom:'2px solid #e5eae8',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <button className={viewSchoolTab==='details'?'primary':'outline'} style={{borderRadius:'8px 8px 0 0',padding:'8px 18px',fontSize:13,fontWeight:700,borderBottom:viewSchoolTab==='details'?'none':'1px solid #c5d4cf'}} onClick={()=>setViewSchoolTab('details')}>
                📋 Production Summary
              </button>
              <button className={viewSchoolTab==='photos'?'primary':'outline'} style={{borderRadius:'8px 8px 0 0',padding:'8px 18px',fontSize:13,fontWeight:700,borderBottom:viewSchoolTab==='photos'?'none':'1px solid #c5d4cf'}} onClick={()=>setViewSchoolTab('photos')}>
                🖼️ Uniform & School Photos ({ (viewSchool.logo ? 1 : 0) + (activeDress(viewSchool).boysPhotos?.length || 0) + (activeDress(viewSchool).girlsPhotos?.length || 0) })
              </button>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'nowrap',alignItems:'center',marginBottom:4,whiteSpace:'nowrap',overflowX:'auto'}}>
              <button className="primary" style={{whiteSpace:'nowrap',padding:'6px 12px',fontSize:12,background:selectedRowKeys.size>0?'#10b981':undefined,borderColor:selectedRowKeys.size>0?'#059669':undefined}} title={selectedRowKeys.size>0?`Add ready stock for ${selectedRowKeys.size} selected items`:'Add Ready Stock'} onClick={()=>{if(selectedRowKeys.size>0){openMultiAddStockModal()}else{const name=viewSchool.name;setViewSchool(null);lastOpenedSchoolRef.current=null;onNavigate?.('Inventory',{stockView:'ready',party:name,fromSchool:name,fromPage:productionMode?'Production':'Customers & Schools'})}}}><Plus size={14}/> Add Stock{selectedRowKeys.size>0?` (${selectedRowKeys.size})`:''}</button>
              <button className="primary" style={{background:'#0284c7',borderColor:'#0284c7',whiteSpace:'nowrap',padding:'6px 12px',fontSize:12}} title={selectedRowKeys.size>0?`Deliver stock for ${selectedRowKeys.size} selected items`:'Deliver Stock (Partial/Full)'} onClick={()=>{if(selectedRowKeys.size>0){openMultiDeliverStockModal()}else{const name=viewSchool.name;setViewSchool(null);lastOpenedSchoolRef.current=null;onNavigate?.('Inventory',{stockView:'out',outTab:'school',party:name,fromSchool:name,fromPage:productionMode?'Production':'Customers & Schools'})}}}><Truck size={14}/> Deliver Stock{selectedRowKeys.size>0?` (${selectedRowKeys.size})`:''}</button>
              <button className="outline" style={{whiteSpace:'nowrap',padding:'6px 12px',fontSize:12}} title="Collect Payment" onClick={()=>{const name=viewSchool.name;setViewSchool(null);lastOpenedSchoolRef.current=null;onNavigate?.('Billing & Payments',{tab:'school',school:name,fromSchool:name,fromPage:productionMode?'Production':'Customers & Schools'})}}><CreditCard size={14}/> Payment</button>
              <button className="outline" style={{whiteSpace:'nowrap',padding:'6px 12px',fontSize:12}} title="Send SMS" onClick={()=>openProductionSms(viewSchool)}><MessageSquare size={14}/> SMS</button>
            </div>
          </div>

          {viewSchoolTab==='details' && <>
            <div className="school-info-strip" style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',padding:'8px 14px',background:'#f4f8f6',border:'1px solid #cddbd6',borderRadius:8,marginTop:4}}>
              <div><span style={{fontSize:11,color:'#5f736d'}}>Contact:</span> <strong style={{fontSize:12.5,color:'#123d35'}}>{viewSchool.contact}</strong></div>
              <div style={{color:'#c5d4cf'}}>|</div>
              <div><span style={{fontSize:11,color:'#5f736d'}}>Phone:</span> <strong style={{fontSize:12.5,color:'#123d35'}}>{viewSchool.phone}</strong></div>
              <div style={{color:'#c5d4cf'}}>|</div>
              <div><span style={{fontSize:11,color:'#5f736d'}}>Location:</span> <strong style={{fontSize:12.5,color:'#123d35'}}>{viewSchool.location}</strong></div>
              <div style={{color:'#c5d4cf'}}>|</div>
              <div><span style={{fontSize:11,color:'#5f736d'}}>Uniform:</span> <strong style={{fontSize:12.5,color:'#123d35'}}>{viewSchool.uniform}</strong></div>
            </div>

            <div className="school-summary-filter-strip" style={{marginTop:12,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,background:'#f4f8f6',padding:'8px 12px',borderRadius:8,border:'1px solid #cddbd6'}}>
              <h3 style={{font:'700 14px Manrope',color:'#123d35',display:'flex',alignItems:'center',gap:8,margin:0}}><Scissors size={15}/> Product & Stock Filters</h3>
              <div className="summary-filters" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{font:'700 11px Manrope',color:'#5f736d',display:'flex',alignItems:'center',gap:4}}><Filter size={13}/> Filter:</span>
                <select
                  value={viewSchool.name}
                  onChange={e=>{
                    const next=schools.find(s=>s.name===e.target.value);
                    if(next){
                      setViewSchool(next);
                      setSelectedRowKeys(new Set());
                    }
                  }}
                  style={{padding:'4px 8px',borderRadius:6,border:'1.5px solid #007c68',fontSize:11,background:'#fff',fontWeight:700,color:'#007c68'}}
                  title="Switch school production view"
                >
                  {schools.map(s=><option key={s.id} value={s.name}>🏫 {s.name}</option>)}
                </select>
                <select value={summaryFilterYear} onChange={e=>setSummaryFilterYear(e.target.value)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #c5d4cf',fontSize:11,background:'#fff',fontWeight:600,color:'#123d35'}}>
                  <option value="All">All Years ({availableYears.length})</option>
                  {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                <select value={summaryFilterGender} onChange={e=>setSummaryFilterGender(e.target.value)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #c5d4cf',fontSize:11,background:'#fff',fontWeight:600,color:'#123d35'}}>
                  <option value="All">All Genders</option>
                  <option value="Boys">👦 Boys</option>
                  <option value="Girls">👧 Girls</option>
                </select>
                <select value={summaryFilterGarment} onChange={e=>setSummaryFilterGarment(e.target.value)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #c5d4cf',fontSize:11,background:'#fff',fontWeight:600,color:'#123d35'}}>
                  <option value="All">All Garments ({availableGarments.length})</option>
                  {availableGarments.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
                <select value={summaryFilterSize} onChange={e=>setSummaryFilterSize(e.target.value)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #c5d4cf',fontSize:11,background:'#fff',fontWeight:600,color:'#123d35'}}>
                  <option value="All">All Sizes ({availableSizes.length})</option>
                  {availableSizes.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <select value={summaryFilterStatus} onChange={e=>setSummaryFilterStatus(e.target.value)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #c5d4cf',fontSize:11,background:'#fff',fontWeight:600,color:'#123d35'}}>
                  <option value="All">All Statuses</option>
                  <option value="available">🟢 Ready Stock Available (&gt; 0)</option>
                  <option value="zero-ready">⚪ 0 Ready Stock</option>
                  <option value="ready">🟢 Fully Ready</option>
                  <option value="partial-ready">🟡 Partial Ready</option>
                  <option value="pending-prod">⚪ Pending Production</option>
                  <option value="delivered">🟢 Fully Delivered</option>
                  <option value="partial-del">🔵 Partial Delivered</option>
                  <option value="pending-del">⚪ Pending Delivery</option>
                </select>
                {(summaryFilterYear!=='All'||summaryFilterGender!=='All'||summaryFilterGarment!=='All'||summaryFilterSize!=='All'||summaryFilterStatus!=='All')&&(
                  <button className="outline mini-action" style={{padding:'4px 8px',fontSize:11}} onClick={()=>{setSummaryFilterYear(academicYear());setSummaryFilterGender('All');setSummaryFilterGarment('All');setSummaryFilterSize('All');setSummaryFilterStatus('All')}}>Clear Filters</button>
                )}
              </div>
            </div>

            {(() => {
              const totalRequired = productSummary.reduce((a, b) => a + b.required, 0);
              const totalStitched = productSummary.reduce((a, b) => a + b.stitched, 0);
              const totalAvailableReady = productSummary.reduce((a, b) => a + b.ready, 0);
              const totalRemainingRequired = Math.max(0, totalRequired - totalStitched);
              const totalDelivered = productSummary.reduce((a, b) => a + b.delivered, 0);

              return (
                <div className="metrics school-compact-metrics" style={{marginTop:8,marginBottom:12,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}>
                  <div
                    className="metric"
                    style={{padding:'6px 10px',gap:8,minHeight:48,alignItems:'center',cursor:'pointer',userSelect:'none',transition:'transform 0.1s, box-shadow 0.1s'}}
                    title="Click to view all enrolled students and measurements"
                    onClick={()=>{setActiveMetricModal('students');setMetricModalSearch('')}}
                  >
                    <div className="metricicon green" style={{width:28,height:28,borderRadius:6}}><ClipboardList size={14}/></div>
                    <div>
                      <span style={{fontSize:10}}>Students ↗</span>
                      <strong style={{fontSize:15,margin:0}}>{students?.filter(s=>s.school===viewSchool.name).length||0}</strong>
                    </div>
                  </div>
                  <div
                    className="metric"
                    style={{padding:'6px 10px',gap:8,minHeight:48,alignItems:'center',cursor:'pointer',userSelect:'none',transition:'transform 0.1s, box-shadow 0.1s'}}
                    title={`Total Order: ${totalRequired} Pcs · Total Stitched: ${totalStitched} Pcs. Click to view order requirement breakdown`}
                    onClick={()=>{setActiveMetricModal('required');setMetricModalSearch('')}}
                  >
                    <div className="metricicon blue" style={{width:28,height:28,borderRadius:6}}><Boxes size={14}/></div>
                    <div>
                      <span style={{fontSize:10}}>Required ↗</span>
                      <strong style={{fontSize:15,margin:0}}>{totalRemainingRequired} Pcs</strong>
                      <small style={{display:'block',fontSize:9,color:'#5f736d'}}>Order: {totalRequired} · Stitched: {totalStitched}</small>
                    </div>
                  </div>
                  <div
                    className="metric"
                    style={{padding:'6px 10px',gap:8,minHeight:48,alignItems:'center',cursor:'pointer',userSelect:'none',transition:'transform 0.1s, box-shadow 0.1s'}}
                    title={`Available in stock to deliver: ${totalAvailableReady} Pcs (Total Stitched: ${totalStitched} · Total Delivered: ${totalDelivered}). Click to view ready stock details`}
                    onClick={()=>{
                      setMetricModalSearch('');
                      setReadyStockTab('variants');
                      setActiveMetricModal('readyStock');
                    }}
                  >
                    <div className="metricicon purple" style={{width:28,height:28,borderRadius:6}}><CheckCircle2 size={14}/></div>
                    <div>
                      <span style={{fontSize:10}}>Ready Stock ↗</span>
                      <strong style={{fontSize:15,margin:0}}>{totalAvailableReady} Pcs</strong>
                      <small style={{display:'block',fontSize:9,color:'#5f736d'}}>Available ({totalDelivered} Del)</small>
                    </div>
                  </div>
                  <div
                    className="metric"
                    style={{padding:'6px 10px',gap:8,minHeight:48,alignItems:'center',cursor:'pointer',userSelect:'none',transition:'transform 0.1s, box-shadow 0.1s'}}
                    title="Click to view pending production breakdown"
                    onClick={()=>{setActiveMetricModal('pendingProd');setMetricModalSearch('')}}
                  >
                    <div className="metricicon orange" style={{width:28,height:28,borderRadius:6}}><AlertTriangle size={14}/></div>
                    <div>
                      <span style={{fontSize:10}}>Pending Prod ↗</span>
                      <strong style={{fontSize:15,margin:0}}>{totalRemainingRequired} Pcs</strong>
                    </div>
                  </div>
                  <div
                    className="metric"
                    style={{padding:'6px 10px',gap:8,minHeight:48,alignItems:'center',cursor:'pointer',userSelect:'none',transition:'transform 0.1s, box-shadow 0.1s'}}
                    title="Click to view delivery history and dispatched value"
                    onClick={()=>{setActiveMetricModal('delivered');setMetricModalSearch('')}}
                  >
                    <div className="metricicon green" style={{width:28,height:28,borderRadius:6}}><IndianRupee size={14}/></div>
                    <div>
                      <span style={{fontSize:10}}>Delivered Value ↗</span>
                      <strong style={{fontSize:15,margin:0}}>{money(schoolDeliveredTotal)}</strong>
                    </div>
                  </div>
                  <div
                    className="metric"
                    style={{padding:'6px 10px',gap:8,minHeight:48,alignItems:'center',cursor:'pointer',userSelect:'none',transition:'transform 0.1s, box-shadow 0.1s'}}
                    title="Click to view payment collections and receipts"
                    onClick={()=>{setActiveMetricModal('collected');setMetricModalSearch('')}}
                  >
                    <div className="metricicon blue" style={{width:28,height:28,borderRadius:6}}><WalletCards size={14}/></div>
                    <div>
                      <span style={{fontSize:10}}>Collected ↗</span>
                      <strong style={{fontSize:15,margin:0}}>{money(schoolCollectedTotal)}</strong>
                    </div>
                  </div>
                  <div
                    className="metric"
                    style={{
                      padding:'6px 10px',
                      gap:8,
                      minHeight:48,
                      alignItems:'center',
                      border: schoolAdvanceBalance > 0 ? '1.5px solid #16a34a' : schoolPendingBalance > 0 ? '1.5px solid #e5484d' : '1px solid #cbd5e1',
                      background: schoolAdvanceBalance > 0 ? '#f0fdf4' : schoolPendingBalance > 0 ? '#fff5f5' : '#f8fafc',
                      cursor:'pointer',
                      userSelect:'none',
                      transition:'transform 0.1s, box-shadow 0.1s'
                    }}
                    title={schoolAdvanceBalance > 0 ? "Advance credit available. Click to view balance ledger & collections" : "Click to view outstanding balance ledger & invoices"}
                    onClick={()=>{setActiveMetricModal('pendingBal');setMetricModalSearch('')}}
                  >
                    <div
                      className="metricicon orange"
                      style={{
                        width:28,
                        height:28,
                        borderRadius:6,
                        background: schoolAdvanceBalance > 0 ? '#dcfce7' : schoolPendingBalance > 0 ? '#ffecec' : '#f1f5f9',
                        color: schoolAdvanceBalance > 0 ? '#15803d' : schoolPendingBalance > 0 ? '#d93d42' : '#475569'
                      }}
                    >
                      <IndianRupee size={14}/>
                    </div>
                    <div>
                      <span style={{fontSize:10,color: schoolAdvanceBalance > 0 ? '#15803d' : schoolPendingBalance > 0 ? '#b91c1c' : '#475569',fontWeight:700}}>
                        {schoolAdvanceBalance > 0 ? 'Advance Credit ↗' : 'Pending Bal ↗'}
                      </span>
                      <strong style={{fontSize:15,margin:0,color: schoolAdvanceBalance > 0 ? '#15803d' : schoolPendingBalance > 0 ? '#d93d42' : '#166534'}}>
                        {money(schoolAdvanceBalance > 0 ? schoolAdvanceBalance : schoolPendingBalance)}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="school-prod-summary-section" style={{marginTop:10,marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,margin:'0 0 8px'}}>
                <h3 style={{font:'700 15px Manrope',color:'#123d35',display:'flex',alignItems:'center',gap:8,margin:0}}><Scissors size={16}/> Product Summary — Ready, Pending & Delivery Details</h3>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  {(() => {
                    const totalReadyAvail = productSummary.reduce((a, b) => a + b.ready, 0);
                    return totalReadyAvail > 0 ? (
                      <button
                        type="button"
                        className="primary"
                        style={{ background: '#0284c7', borderColor: '#0284c7', fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                        onClick={openDeliverAllReadyStockModal}
                        title="Deliver all completed ready garments across all classes/sizes in one single invoice"
                      >
                        <Truck size={14} /> Deliver All Ready Stock ({totalReadyAvail} Pcs)
                      </button>
                    ) : null;
                  })()}
                  <button
                    type="button"
                    className="outline"
                    style={{ fontSize: 12, padding: '5px 12px', background: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                    onClick={() => setShowSchoolStatementModal(true)}
                    title="View complete statement of account, deliveries, payments, discounts and final settlement"
                  >
                    <FileText size={14} color="#007c68" /> Statement / Summary Slip
                  </button>
                  <span style={{fontSize:11,color:'#5f736d'}}>
                    Select rows to add ready stock or deliver in bulk
                  </span>
                </div>
              </div>

              {selectedRowKeys.size > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#e6f7f3',
                  border: '1.5px solid #007c68',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#123d35', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckSquare size={16} color="#007c68" /> {selectedRowKeys.size} {selectedRowKeys.size === 1 ? 'row' : 'rows'} selected
                    </span>
                    <span style={{ fontSize: 11.5, color: '#3d5c54' }}>
                      ({selectedMetrics.required} Pcs Req · <strong style={{ color: '#166534' }}>{selectedMetrics.ready} Pcs Available Ready</strong> · <strong style={{ color: '#d97706' }}>{selectedMetrics.pendingProd} Pcs Pending Prod</strong> · <strong style={{ color: '#0284c7' }}>{selectedMetrics.delivered} Pcs Delivered</strong> · <strong style={{ color: '#dc2626' }}>{selectedMetrics.pendingDel} Pcs Pending Del</strong>)
                    </span>
                    {selectedRowKeys.size < sortedProductSummary.length && (
                      <button
                        type="button"
                        className="outline"
                        style={{ padding: '3px 8px', fontSize: 11, background: '#fff', borderRadius: 6 }}
                        onClick={selectAllFiltered}
                      >
                        Select All {sortedProductSummary.length} Rows
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="primary"
                      style={{ background: '#10b981', borderColor: '#059669', fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={openMultiAddStockModal}
                    >
                      <Plus size={14} /> Add Ready Stock ({selectedRowKeys.size})
                    </button>
                    <button
                      type="button"
                      className="primary"
                      style={{ background: '#0284c7', borderColor: '#0284c7', fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={openMultiDeliverStockModal}
                    >
                      <Truck size={14} /> Deliver Stock ({selectedRowKeys.size})
                    </button>
                    <button
                      type="button"
                      className="outline"
                      style={{ fontSize: 12, padding: '6px 12px', background: '#fff' }}
                      onClick={clearSelection}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <table className="doc-table summary-table" style={{width:'100%',margin:'8px 0'}}>
                <thead>
                  <tr>
                    <th style={{ width: 42, textAlign: 'center', padding: '8px 10px' }}>
                      <input
                        type="checkbox"
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#007c68' }}
                        checked={isAllCurrentPageSelected}
                        ref={input => {
                          if (input) input.indeterminate = isSomeCurrentPageSelected && !isAllCurrentPageSelected;
                        }}
                        onChange={toggleSelectCurrentPage}
                        title={isAllCurrentPageSelected ? "Deselect all on this page" : "Select all on this page"}
                      />
                    </th>
                    {renderSortHeader('gender', 'GENDER')}
                    {renderSortHeader('garment', 'GARMENT TYPE')}
                    {renderSortHeader('size', 'SIZE')}
                    {renderSortHeader('required', 'REQUIRED (ORDER)')}
                    {renderSortHeader('ready', 'READY STOCK')}
                    {renderSortHeader('stitched', 'PRODUCTION STATUS')}
                    {renderSortHeader('delivered', 'DELIVERED')}
                    {renderSortHeader('deliveryStatus', 'DELIVERY STATUS')}
                  </tr>
                </thead>
                <tbody>
                  {pagedProductSummary.map(row=>{
                    const rowKey = `${row.year}||${row.gender}||${row.garment}||${row.size}`;
                    const isSelected = selectedRowKeys.has(rowKey);
                    return (
                      <tr
                        key={rowKey}
                        onClick={()=>toggleRowSelect(rowKey)}
                        style={{
                          cursor:'pointer',
                          background: isSelected ? '#eefbf6' : undefined,
                          borderLeft: isSelected ? '3px solid #007c68' : undefined
                        }}
                        title="Click row or checkbox to select · Click Garment name for details"
                      >
                        <td style={{ textAlign: 'center', padding: '8px 10px' }} onClick={e=>e.stopPropagation()}>
                          <input
                            type="checkbox"
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#007c68' }}
                            checked={isSelected}
                            onChange={()=>toggleRowSelect(rowKey)}
                          />
                        </td>
                        <td><span className={'status '+(row.gender==='Girls'?'inactive':'in-progress')}>{row.gender==='Girls'?'👧 Girls':'👦 Boys'}</span></td>
                        <td>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#007c68',
                              fontWeight: 700,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                            onClick={e=>{
                              e.stopPropagation();
                              setSelectedSummaryRow({year:row.year,gender:row.gender,garment:row.garment,size:row.size});
                            }}
                            title="Click to view measurement dates & batch details"
                          >
                            {row.garment}
                          </button>
                        </td>
                        <td><strong>{row.size}</strong></td>
                        <td
                          onClick={e=>{e.stopPropagation();setActiveMetricModal('required');setMetricModalSearch(row.garment)}}
                          title={`Click to view requirement details for ${row.garment}`}
                          style={{cursor:'pointer'}}
                        >
                          <span style={{textDecoration:'underline',color:'#007c68',fontWeight:600}}>{row.required} Pcs</span>
                        </td>
                        <td
                          onClick={e=>{
                            e.stopPropagation();
                            setMetricModalSearch(row.garment);
                            setReadyStockTab('variants');
                            setActiveMetricModal('readyStock');
                          }}
                          title={`Click to view ready stock details for ${row.garment}`}
                          style={{cursor:'pointer'}}
                        >
                          <strong style={{color: row.ready > 0 ? '#166534' : '#dc2626', textDecoration:'underline'}}>
                            {row.ready} Pcs
                          </strong>
                          {row.stitched > row.ready && (
                            <small style={{display:'block',fontSize:10,color:'#5f736d'}}>
                              ({row.stitched} stitched)
                            </small>
                          )}
                        </td>
                        <td
                          onClick={e=>{e.stopPropagation();setActiveMetricModal('pendingProd');setMetricModalSearch(row.garment)}}
                          title={`Click to view pending production for ${row.garment}`}
                          style={{cursor:'pointer'}}
                        >
                          {row.stitched>=row.required&&row.required>0?<span className="status completed">🟢 Fully Ready ({row.stitched}/{row.required})</span>:row.stitched>0?<span className="status pending">🟡 Partial Ready ({row.stitched}/{row.required})</span>:<span className="status danger">⚪ Pending ({row.pendingProd} Pcs)</span>}
                        </td>
                        <td
                          onClick={e=>{e.stopPropagation();setActiveMetricModal('delivered');setMetricModalSearch(row.garment)}}
                          title={`Click to view delivery history for ${row.garment}`}
                          style={{cursor:'pointer'}}
                        >
                          <strong style={{textDecoration:'underline',color:'#0284c7'}}>{row.delivered} Pcs</strong>
                        </td>
                        <td
                          onClick={e=>{e.stopPropagation();setActiveMetricModal('delivered');setMetricModalSearch(row.garment)}}
                          title={`Click to view delivery history for ${row.garment}`}
                          style={{cursor:'pointer'}}
                        >
                          {row.delivered>=row.required&&row.required>0?<span className="status completed">🟢 Fully Delivered ({row.delivered}/{row.required})</span>:row.delivered>0?<span className="status in-progress">🔵 Partial Delivered ({row.delivered}/{row.required})</span>:<span className="status pending">⚪ Pending ({row.pendingDel} Pcs)</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!sortedProductSummary.length&&(
                    <tr><td colSpan={9} style={{textAlign:'center',padding:'16px'}}>No summary records match the selected filters.</td></tr>
                  )}
                </tbody>
              </table>

              <div className="paginated-footer" style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginTop:10,padding:'6px 4px'}}>
                <span style={{fontSize:11,color:'#5f736d',fontWeight:600}}>
                  Showing {sortedProductSummary.length ? (summaryPage - 1) * summaryRowsPerPage + 1 : 0} to {Math.min(summaryPage * summaryRowsPerPage, sortedProductSummary.length)} of {sortedProductSummary.length} entries
                </span>
                <div className="pager" style={{display:'flex',alignItems:'center',gap:8}}>
                  <label style={{fontSize:11,color:'#5f736d',display:'flex',alignItems:'center',gap:6,fontWeight:600}}>
                    Rows per page:
                    <select value={summaryRowsPerPage} onChange={e=>{setSummaryRowsPerPage(Number(e.target.value));setSummaryPage(1)}} style={{padding:'3px 6px',borderRadius:6,border:'1px solid #c5d4cf',fontSize:11,background:'#fff',fontWeight:600,color:'#123d35'}}>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                  <button className="outline" style={{padding:'4px 10px',fontSize:11,borderRadius:6,cursor:summaryPage<=1?'not-allowed':'pointer'}} disabled={summaryPage <= 1} onClick={()=>setSummaryPage(p=>p-1)}>Prev</button>
                  <span style={{fontSize:11,fontWeight:700,color:'#123d35'}}>Page {summaryPage} of {summaryTotalPages}</span>
                  <button className="outline" style={{padding:'4px 10px',fontSize:11,borderRadius:6,cursor:summaryPage>=summaryTotalPages?'not-allowed':'pointer'}} disabled={summaryPage >= summaryTotalPages} onClick={()=>setSummaryPage(p=>p+1)}>Next</button>
                </div>
              </div>
            </div>
          </>}

          {viewSchoolTab==='photos' && <>
            <div className="photo-group" style={{marginTop:10}}><h3>School logo</h3>{viewSchool.logo?<img className="photo-item" src={assetUrl(viewSchool.logo)} alt="School logo"/>:<p className="photo-empty">No logo uploaded</p>}</div>
            {dressPhotoGroup('Current boys dress photos',activeDress(viewSchool).boysPhotos,'No boys dress photos uploaded','Boys dress photo')}
            {dressPhotoGroup('Current girls dress photos',activeDress(viewSchool).girlsPhotos,'No girls dress photos uploaded','Girls dress photo')}
            <div className="photo-group"><h3>Dress version history<small>{schoolDressVersions(viewSchool).length}</small></h3>
              <div className="version-list">{[...schoolDressVersions(viewSchool)].reverse().map((v,i)=>(
                <div key={v.id} className={'version-row'+(i===0?' current':'')}>
                  <div className="version-meta"><strong>{v.year}</strong><span>{v.date}{v.note?` · ${v.note}`:''}</span></div>
                  {i===0&&<em>Current</em>}
                  <button className="outline mini-action" onClick={()=>setVersionView({schoolName:viewSchool.name,version:v})}>View photos</button>
                </div>
              ))}</div>
            </div>
          </>}
        </div>
      </div>}
      {selectedRowBreakdown&&<div className="stock-modal-overlay" onClick={()=>setSelectedSummaryRow(null)}>
        <div className="card detail-modal" style={{maxWidth:'840px',width:'95vw'}} onClick={e=>e.stopPropagation()}>
          <div className="cardhead" style={{alignItems:'center'}}>
            <div>
              <h2>{viewSchool?.name} — {selectedRowBreakdown.garment} (Size {selectedRowBreakdown.size})</h2>
              <p>Measurement Dates, Delivery Batches & Pending Breakdown</p>
            </div>
            <button className="outline" onClick={()=>setSelectedSummaryRow(null)}>Close</button>
          </div>

          <div className="metrics" style={{marginTop:'14px',marginBottom:'14px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
            <div className="metric"><div className="metricicon blue"><Boxes size={18}/></div><div><span>Total Measured</span><strong>{selectedRowBreakdown.totalMeasured} Pcs</strong><small>across all dates</small></div></div>
            <div className="metric"><div className="metricicon green"><CheckCircle2 size={18}/></div><div><span>Delivered</span><strong>{selectedRowBreakdown.totalDelivered} Pcs</strong><small>issued to students</small></div></div>
            <div className="metric" style={{border:'2px solid #f59e0b',background:'#fffbeb'}}><div className="metricicon orange" style={{background:'#fef3c7',color:'#d97706'}}><AlertTriangle size={18}/></div><div><span style={{color:'#b45309',fontWeight:700}}>Pending Delivery</span><strong style={{color:'#d97706'}}>{selectedRowBreakdown.totalPending} Pcs</strong><small>to be delivered</small></div></div>
          </div>

          <h3 style={{font:'700 14px Manrope',color:'#123d35',margin:'14px 0 8px'}}>📅 Measurement Dates & Batch Details</h3>
          <table className="doc-table summary-table" style={{width:'100%'}}>
            <thead>
              <tr>
                <th>MEASUREMENT DATE / BATCH</th>
                <th>CLASS</th>
                <th>MEASURED QTY</th>
                <th>DELIVERED QTY</th>
                <th>PENDING QTY</th>
                <th>STUDENTS</th>
              </tr>
            </thead>
            <tbody>
              {selectedRowBreakdown.batches.map((batch,idx)=>(
                <tr key={idx}>
                  <td><strong>{batch.date}</strong></td>
                  <td>{batch.className}</td>
                  <td><strong>{batch.studentCount} Pcs</strong></td>
                  <td><strong style={{color:'#166534'}}>{batch.delivered} Pcs</strong></td>
                  <td>{batch.pending>0?<span className="status pending">{batch.pending} Pcs Pending</span>:<span className="status completed">🟢 Fully Delivered</span>}</td>
                  <td><small>{batch.studentNames.slice(0,3).join(', ')}{batch.studentNames.length>3?` +${batch.studentNames.length-3} more`:''}</small></td>
                </tr>
              ))}
              {!selectedRowBreakdown.batches.length&&(
                <tr><td colSpan={6} style={{textAlign:'center',padding:'16px'}}>No measurement date records found.</td></tr>
              )}
            </tbody>
          </table>

          <div style={{marginTop:'16px',display:'flex',justifyContent:'flex-end',flexWrap:'wrap',gap:8}}>
            <button className="primary" style={{background:'#10b981',borderColor:'#059669',whiteSpace:'nowrap'}} onClick={()=>{const schoolName=viewSchool?.name;setSelectedSummaryRow(null);setViewSchool(null);onNavigate?.('Inventory',{stockView:'in',party:schoolName,gender:selectedRowBreakdown.gender||'Boys',garment:selectedRowBreakdown.garment,size:selectedRowBreakdown.size,count:selectedRowBreakdown.totalPending||1,fromSchool:schoolName})}}>
              <Plus size={15}/> Add Stock ({selectedRowBreakdown.totalPending} Pcs)
            </button>
            <button className="primary" style={{whiteSpace:'nowrap'}} onClick={()=>{const schoolName=viewSchool?.name;setSelectedSummaryRow(null);setViewSchool(null);onNavigate?.('Inventory',{stockView:'out',outTab:'school',party:schoolName,garment:selectedRowBreakdown.garment,size:selectedRowBreakdown.size,count:selectedRowBreakdown.totalPending,fromSchool:schoolName})}}>
              <Truck size={15}/> Deliver Stock ({selectedRowBreakdown.totalPending} Pcs)
            </button>
          </div>
        </div>
      </div>}
      {versionView&&<div className="stock-modal-overlay" onClick={()=>setVersionView(null)}>
        <div className="card photo-modal" onClick={e=>e.stopPropagation()}>
          <div className="cardhead"><div><h2>{versionView.schoolName} · {versionView.version.year}</h2><p>Changed on {versionView.version.date}{versionView.version.note?` · ${versionView.version.note}`:''}</p></div><button className="outline" onClick={()=>setVersionView(null)}>Close</button></div>
          {dressPhotoGroup('Boys dress photos',versionView.version.boysPhotos,'No boys dress photos in this version','Boys dress photo')}
          {dressPhotoGroup('Girls dress photos',versionView.version.girlsPhotos,'No girls dress photos in this version','Girls dress photo')}
        </div>
      </div>}
      {showMultiAddModal && viewSchool && (
        <div className="stock-modal-overlay" onClick={() => setShowMultiAddModal(false)}>
          <div className="card detail-modal" style={{ maxWidth: '920px', width: '96vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="cardhead" style={{ alignItems: 'center' }}>
              <div>
                <h2><Plus size={18} color="#10b981" /> Add Ready Stock — {viewSchool.name}</h2>
                <p>Add completed production pieces into ready stock for <strong>{selectedRowsList.length}</strong> selected garments.</p>
              </div>
              <button className="outline mini-action" onClick={() => setShowMultiAddModal(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12, marginBottom: 14, background: '#f4f8f6', padding: '12px 14px', borderRadius: 8, border: '1px solid #cddbd6' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#123d35' }}>
                Stock Entry Date:
                <input
                  type="date"
                  value={multiAddDate}
                  onChange={e => setMultiAddDate(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #c5d4cf', borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#123d35' }}>
                Remarks / Note:
                <input
                  type="text"
                  value={multiAddRemarks}
                  onChange={e => setMultiAddRemarks(e.target.value)}
                  placeholder="e.g. Batch completed"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #c5d4cf', borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <div className="stock-helper-actions" style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  className="outline mini-action"
                  style={{ fontSize: 11, fontWeight: 600, background: '#fff' }}
                  onClick={() => {
                    const updated: Record<string, number> = {};
                    selectedRowsList.forEach(r => {
                      const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                      updated[k] = r.pendingProd > 0 ? r.pendingProd : (r.required > 0 ? r.required : 1);
                    });
                    setMultiAddItems(updated);
                  }}
                >
                  Fill Pending Prod
                </button>
                <button
                  type="button"
                  className="outline mini-action"
                  style={{ fontSize: 11, fontWeight: 600, background: '#fff' }}
                  onClick={() => {
                    const updated: Record<string, number> = {};
                    selectedRowsList.forEach(r => {
                      const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                      updated[k] = 0;
                    });
                    setMultiAddItems(updated);
                  }}
                >
                  Reset to 0
                </button>
              </div>
            </div>

            <table className="doc-table summary-table" style={{ width: '100%', margin: '10px 0' }}>
              <thead>
                <tr>
                  <th>YEAR</th>
                  <th>GENDER</th>
                  <th>GARMENT</th>
                  <th>SIZE</th>
                  <th>REQUIRED</th>
                  <th>CURRENT READY</th>
                  <th>PENDING PROD</th>
                  <th style={{ width: 130 }}>+ ADD READY QTY</th>
                </tr>
              </thead>
              <tbody>
                {selectedRowsList.map(r => {
                  const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                  const addQty = multiAddItems[k] ?? 0;
                  return (
                    <tr key={k}>
                      <td><strong style={{ fontSize: 11, color: '#5f736d' }}>{r.year}</strong></td>
                      <td><span className={'status ' + (r.gender === 'Girls' ? 'inactive' : 'in-progress')}>{r.gender === 'Girls' ? '👧 Girls' : '👦 Boys'}</span></td>
                      <td><strong style={{ color: '#007c68' }}>{r.garment}</strong></td>
                      <td><strong>{r.size}</strong></td>
                      <td>{r.required} Pcs</td>
                      <td><strong style={{ color: '#166534' }}>{r.ready} Pcs</strong></td>
                      <td><span className={r.pendingProd > 0 ? 'status danger' : 'status completed'}>{r.pendingProd} Pcs</span></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={addQty}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setMultiAddItems(prev => ({ ...prev, [k]: val }));
                          }}
                          style={{ width: 90, padding: '5px 8px', border: '1.5px solid #10b981', borderRadius: 6, fontWeight: 700, fontSize: 13, textAlign: 'center' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f0faf6', fontWeight: 700 }}>
                  <td colSpan={7} style={{ textAlign: 'right', padding: '10px 14px', fontSize: 13 }}>
                    Total Ready Stock Pieces to Add:
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 16, color: '#10b981' }}>
                    {Object.values(multiAddItems).reduce((a, b) => a + (Number(b) || 0), 0)} Pcs
                  </td>
                </tr>
              </tfoot>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="outline" onClick={() => setShowMultiAddModal(false)}>Cancel</button>
              <button
                type="button"
                className="primary"
                style={{ background: '#10b981', borderColor: '#059669', padding: '8px 18px', fontWeight: 700 }}
                disabled={Object.values(multiAddItems).reduce((a, b) => a + (Number(b) || 0), 0) <= 0}
                onClick={saveMultiAddStock}
              >
                <Plus size={16} /> Save Ready Stock ({Object.values(multiAddItems).reduce((a, b) => a + (Number(b) || 0), 0)} Pcs)
              </button>
            </div>
          </div>
        </div>
      )}

      {showMultiDeliverModal && viewSchool && (
        <div className="stock-modal-overlay" onClick={() => setShowMultiDeliverModal(false)}>
          <div className="card detail-modal" style={{ maxWidth: '980px', width: '96vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="cardhead" style={{ alignItems: 'center' }}>
              <div>
                <h2><Truck size={18} color="#0284c7" /> Deliver Stock & Create Invoice — {viewSchool.name}</h2>
                <p>Issue ready stock to school and record delivery for <strong>{selectedRowsList.length}</strong> selected garments.</p>
              </div>
              <button className="outline mini-action" onClick={() => setShowMultiDeliverModal(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 12, marginBottom: 14, background: '#f0f7fa', padding: '12px 14px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>
                Delivery Date:
                <input
                  type="date"
                  value={multiDeliverDate}
                  onChange={e => setMultiDeliverDate(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>
                Invoice / Challan No:
                <input
                  type="text"
                  value={multiDeliverInvoiceNo}
                  onChange={e => setMultiDeliverInvoiceNo(e.target.value)}
                  placeholder="INV-001"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>
                GST Rate:
                <select
                  value={multiDeliverGst}
                  onChange={e => setMultiDeliverGst(Number(e.target.value))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 12, background: '#fff', fontWeight: 700, color: '#0369a1' }}
                >
                  <option value={0}>0% (No GST)</option>
                  <option value={5}>5% (CGST 2.5% + SGST 2.5%)</option>
                  <option value={12}>12% (CGST 6% + SGST 6%)</option>
                  <option value={18}>18% (CGST 9% + SGST 9%)</option>
                  <option value={28}>28% (CGST 14% + SGST 14%)</option>
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>
                Remarks / Note:
                <input
                  type="text"
                  value={multiDeliverRemarks}
                  onChange={e => setMultiDeliverRemarks(e.target.value)}
                  placeholder="e.g. Delivered batch"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>
                Discount on Bill:
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <select
                    value={multiDeliverDiscountType}
                    onChange={e => setMultiDeliverDiscountType(e.target.value as 'flat' | 'percentage')}
                    style={{ width: 72, padding: '6px 4px', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 11, background: '#fff', fontWeight: 700, color: '#0369a1' }}
                  >
                    <option value="flat">₹ Flat</option>
                    <option value="percentage">% Pct</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={multiDeliverDiscount || ''}
                    placeholder="0"
                    onChange={e => setMultiDeliverDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 12, fontWeight: 700 }}
                  />
                </div>
              </label>
              {schoolAdvanceBalance > 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  background: '#ecfdf5',
                  border: '1.5px solid #6ee7b7',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  margin: '4px 0'
                }}>
                  <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                    💰 School has <strong>{money(schoolAdvanceBalance)}</strong> advance credit available.
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#047857', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoAdjustAdvance}
                      onChange={e => setAutoAdjustAdvance(e.target.checked)}
                    />
                    Auto-settle invoice from advance credit
                  </label>
                </div>
              )}
              <div className="delivery-helper-actions" style={{ gridColumn: 'span 3' }}>
                <button
                  type="button"
                  className="outline mini-action"
                  style={{ fontSize: 11, fontWeight: 600, background: '#fff' }}
                  onClick={() => {
                    const updated: Record<string, { deliverQty: number; rate: number }> = {};
                    let totalFilled = 0;
                    selectedRowsList.forEach(r => {
                      const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                      const cur = multiDeliverItems[k] || { rate: 0, deliverQty: 0 };
                      const maxDeliverable = Math.max(0, Math.min(r.ready, r.pendingDel));
                      updated[k] = {
                        rate: cur.rate,
                        deliverQty: maxDeliverable > 0 ? maxDeliverable : (r.ready > 0 ? r.ready : 0)
                      };
                      totalFilled += updated[k].deliverQty;
                    });
                    setMultiDeliverItems(updated);
                    setDeliveryHelperNotice(totalFilled>0?`Filled ${totalFilled} available ready piece${totalFilled===1?'':'s'}.`:'No available ready stock to fill. Add ready stock first.');
                  }}
                >
                  Fill Available Ready
                </button>
                <button
                  type="button"
                  className="outline mini-action"
                  style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: '#fff' }}
                  onClick={() => {
                    const updated: Record<string, { deliverQty: number; rate: number }> = {};
                    let ratesFound = 0;
                    selectedRowsList.forEach(r => {
                      const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                      const cur = multiDeliverItems[k] || { rate: 0, deliverQty: 0 };
                      const autoRate = getGarmentMasterPrice(r.garment, r.size);
                      updated[k] = {
                        deliverQty: cur.deliverQty,
                        rate: autoRate > 0 ? autoRate : cur.rate
                      };
                      if(autoRate>0)ratesFound+=1;
                    });
                    setMultiDeliverItems(updated);
                    setDeliveryHelperNotice(ratesFound>0?`Master rates refreshed for ${ratesFound} item${ratesFound===1?'':'s'}.`:'No matching garment master rates were found.');
                  }}
                  title="Re-populate selling rates from Garment Price Master"
                >
                  <IndianRupee size={12}/> Fetch Master Rates
                </button>
                <button
                  type="button"
                  className="outline mini-action"
                  style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: '#fff' }}
                  onClick={() => {
                    const updated: Record<string, { deliverQty: number; rate: number }> = {};
                    selectedRowsList.forEach(r => {
                      const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                      const cur = multiDeliverItems[k] || { rate: 0, deliverQty: 0 };
                      updated[k] = { rate: cur.rate, deliverQty: 0 };
                    });
                    setMultiDeliverItems(updated);
                    setDeliveryHelperNotice('All delivery quantities reset to 0.');
                  }}
                >
                  Reset to 0
                </button>
              </div>
              {deliveryHelperNotice&&<div className="delivery-helper-notice" style={{gridColumn:'1 / -1'}}>{deliveryHelperNotice}</div>}
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '7px 12px', marginBottom: 12, fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IndianRupee size={14} style={{ flexShrink: 0 }} />
              <span>Selling rates are <strong>automatically populated</strong> from <strong>Price for Garment Master</strong> based on garment type and size. You can edit any rate or quantity directly.</span>
            </div>

            <table className="doc-table summary-table" style={{ width: '100%', margin: '10px 0' }}>
              <thead>
                <tr>
                  <th>YEAR</th>
                  <th>GENDER</th>
                  <th>GARMENT</th>
                  <th>SIZE</th>
                  <th>REQUIRED</th>
                  <th>READY STOCK</th>
                  <th>ALREADY DELIVERED</th>
                  <th>PENDING DEL</th>
                  <th style={{ width: 110 }}>DELIVER QTY</th>
                  <th style={{ width: 105 }}>RATE / PC (₹)</th>
                  <th style={{ width: 100 }}>TOTAL (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedRowsList.map(r => {
                  const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                  const item = multiDeliverItems[k] || { deliverQty: 0, rate: 0 };
                  const isOverReady = item.deliverQty > r.ready;
                  const lineTotal = (item.deliverQty || 0) * (item.rate || 0);

                  return (
                    <tr key={k} style={{ background: isOverReady ? '#fff5f5' : undefined }}>
                      <td><strong style={{ fontSize: 11, color: '#5f736d' }}>{r.year}</strong></td>
                      <td><span className={'status ' + (r.gender === 'Girls' ? 'inactive' : 'in-progress')}>{r.gender === 'Girls' ? '👧 Girls' : '👦 Boys'}</span></td>
                      <td><strong style={{ color: '#007c68' }}>{r.garment}</strong></td>
                      <td><strong>{r.size}</strong></td>
                      <td>{r.required} Pcs</td>
                      <td>
                        <strong style={{ color: r.ready > 0 ? '#166534' : '#dc2626' }}>
                          {r.ready} Pcs
                        </strong>
                        <small style={{ display: 'block', fontSize: 10, color: '#5f736d' }}>Available</small>
                      </td>
                      <td>{r.delivered} Pcs</td>
                      <td><span className={r.pendingDel > 0 ? 'status pending' : 'status completed'}>{r.pendingDel} Pcs</span></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={r.ready}
                          value={item.deliverQty}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setMultiDeliverItems(prev => ({
                              ...prev,
                              [k]: { ...(prev[k] || { rate: 0 }), deliverQty: val }
                            }));
                          }}
                          style={{
                            width: 80,
                            padding: '5px 8px',
                            border: isOverReady ? '2px solid #ef4444' : '1.5px solid #0284c7',
                            background: isOverReady ? '#fef2f2' : undefined,
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: 13,
                            textAlign: 'center'
                          }}
                        />
                        {isOverReady && <small style={{ display: 'block', color: '#dc2626', fontSize: 10, marginTop: 2, fontWeight: 700 }}>Exceeds available ({r.ready} Pcs)</small>}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={e => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setMultiDeliverItems(prev => ({
                              ...prev,
                              [k]: { ...(prev[k] || { deliverQty: 0 }), rate: val }
                            }));
                          }}
                          style={{ width: 80, padding: '5px 8px', border: item.rate > 0 ? '1.5px solid #10b981' : '1px solid #c5d4cf', borderRadius: 6, fontSize: 12, textAlign: 'center', fontWeight: 700, color: item.rate > 0 ? '#047857' : '#000' }}
                        />
                        {item.rate > 0 && <small style={{ display: 'block', color: '#059669', fontSize: 10, marginTop: 2, textAlign: 'center' }}>Auto Rate</small>}
                      </td>
                      <td>
                        <strong style={{ color: '#1e3a8a', fontSize: 12 }}>{money(lineTotal)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const totalPcs = Object.values(multiDeliverItems).reduce((a, b) => a + (Number(b.deliverQty) || 0), 0);
                  const grossSubtotal = Object.values(multiDeliverItems).reduce((a, b) => a + ((Number(b.deliverQty) || 0) * (Number(b.rate) || 0)), 0);
                  const discountAmount = multiDeliverDiscountType === 'percentage'
                    ? Math.round((grossSubtotal * (Number(multiDeliverDiscount) || 0) / 100) * 100) / 100
                    : Math.min(Number(multiDeliverDiscount) || 0, grossSubtotal);
                  const taxableAmount = Math.max(0, grossSubtotal - discountAmount);
                  const gstPct = Number(multiDeliverGst) || 0;
                  const gstAmount = taxableAmount * (gstPct / 100);
                  const grandTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
                  return (
                    <>
                      <tr style={{ background: '#f0f7fa', fontWeight: 700 }}>
                        <td colSpan={8} style={{ textAlign: 'right', padding: '9px 14px', fontSize: 13 }}>
                          Gross Amount:
                        </td>
                        <td style={{ padding: '9px 14px', fontSize: 14, color: '#0284c7', fontWeight: 800 }}>
                          {totalPcs} Pcs
                        </td>
                        <td></td>
                        <td style={{ padding: '9px 14px', fontSize: 14, color: '#1e3a8a', fontWeight: 800 }}>
                          {money(grossSubtotal)}
                        </td>
                      </tr>
                      {discountAmount > 0 && (
                        <tr style={{ background: '#fef2f2', fontWeight: 700, color: '#dc2626' }}>
                          <td colSpan={10} style={{ textAlign: 'right', padding: '7px 14px', fontSize: 12 }}>
                            Bill Discount {multiDeliverDiscountType === 'percentage' ? `(${multiDeliverDiscount}%)` : ''}:
                          </td>
                          <td style={{ padding: '7px 14px', fontSize: 13, fontWeight: 800 }}>
                            - {money(discountAmount)}
                          </td>
                        </tr>
                      )}
                      <tr style={{ background: '#f8fafc', fontWeight: 700, color: '#334155' }}>
                        <td colSpan={10} style={{ textAlign: 'right', padding: '7px 14px', fontSize: 12 }}>
                          Taxable Amount:
                        </td>
                        <td style={{ padding: '7px 14px', fontSize: 13, fontWeight: 800 }}>
                          {money(taxableAmount)}
                        </td>
                      </tr>
                      {gstPct > 0 && (
                        <>
                          <tr style={{ background: '#f8fafc', fontWeight: 600, fontSize: 12 }}>
                            <td colSpan={10} style={{ textAlign: 'right', padding: '6px 14px', color: '#475569' }}>
                              CGST ({gstPct / 2}%):
                            </td>
                            <td style={{ padding: '6px 14px', color: '#475569', fontWeight: 700 }}>
                              {money(gstAmount / 2)}
                            </td>
                          </tr>
                          <tr style={{ background: '#f8fafc', fontWeight: 600, fontSize: 12 }}>
                            <td colSpan={10} style={{ textAlign: 'right', padding: '6px 14px', color: '#475569' }}>
                              SGST ({gstPct / 2}%):
                            </td>
                            <td style={{ padding: '6px 14px', color: '#475569', fontWeight: 700 }}>
                              {money(gstAmount / 2)}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr style={{ background: '#e0f2fe', fontWeight: 800 }}>
                        <td colSpan={10} style={{ textAlign: 'right', padding: '10px 14px', fontSize: 13, color: '#0369a1' }}>
                          Final Total Amount {gstPct > 0 ? `(with ${gstPct}% GST)` : ''}:
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 15, color: '#0369a1', fontWeight: 800 }}>
                          {money(grandTotal)}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tfoot>
            </table>

            {(() => {
              const hasOverDeliver = selectedRowsList.some(r => {
                const k = `${r.year}||${r.gender}||${r.garment}||${r.size}`;
                const qty = Number(multiDeliverItems[k]?.deliverQty) || 0;
                return qty > r.ready;
              });
              const totalDeliverQty = Object.values(multiDeliverItems).reduce((a, b) => a + (Number(b.deliverQty) || 0), 0);

              return (
                <>
                  {hasOverDeliver && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', color: '#b91c1c', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                      <AlertTriangle size={16} color="#dc2626" />
                      <span>Delivery quantity cannot exceed available ready stock. Please correct the highlighted items before delivering.</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                    <button type="button" className="outline" onClick={() => setShowMultiDeliverModal(false)}>Cancel</button>
                    <button
                      type="button"
                      className="primary"
                      style={{ background: hasOverDeliver ? '#94a3b8' : '#0284c7', borderColor: hasOverDeliver ? '#94a3b8' : '#0284c7', padding: '8px 18px', fontWeight: 700, cursor: hasOverDeliver ? 'not-allowed' : 'pointer' }}
                      disabled={totalDeliverQty <= 0 || hasOverDeliver}
                      onClick={saveMultiDelivery}
                    >
                      <Truck size={16} /> Confirm Delivery & Issue Stock ({totalDeliverQty} Pcs)
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {activeMetricModal && viewSchool && (
        <div className="stock-modal-overlay" onClick={() => setActiveMetricModal(null)}>
          <div
            className="card detail-modal"
            style={{ maxWidth: '960px', width: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 1. STUDENTS MODAL */}
            {activeMetricModal === 'students' && (() => {
              const schoolStudents = (students || []).filter(s => s.school === viewSchool.name);
              const q = metricModalSearch.toLowerCase().trim();
              const filteredStudents = schoolStudents.filter(st => {
                if (!q) return true;
                const matchName = (st.name || '').toLowerCase().includes(q);
                const matchAdm = (st.admission || '').toLowerCase().includes(q);
                const matchClass = (st.className || '').toLowerCase().includes(q);
                const matchGender = (st.gender || '').toLowerCase().includes(q);
                const matchSizes = Object.entries(st.sizes || {}).some(([g, sz]) => `${g} ${sz}`.toLowerCase().includes(q));
                return matchName || matchAdm || matchClass || matchGender || matchSizes;
              });

              return (
                <>
                  <div className="cardhead" style={{ alignItems: 'center' }}>
                    <div>
                      <h2><ClipboardList size={20} color="#007c68" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Students & Measurements — {viewSchool.name}</h2>
                      <p>Total <strong>{schoolStudents.length}</strong> students enrolled with uniform measurements.</p>
                    </div>
                    <button className="outline mini-action" onClick={() => setActiveMetricModal(null)}><X size={16} /></button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, margin: '12px 0 10px' }}>
                    <div style={{ position: 'relative', flex: '1 1 260px' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5f736d' }} />
                      <input
                        type="text"
                        placeholder="Search by student name, admission no, class, size..."
                        value={metricModalSearch}
                        onChange={e => setMetricModalSearch(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid #c5d4cf', fontSize: 12 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                      <span className="status in-progress">👦 Boys: {schoolStudents.filter(s => s.gender === 'Boys').length}</span>
                      <span className="status inactive">👧 Girls: {schoolStudents.filter(s => s.gender === 'Girls').length}</span>
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '55vh', border: '1px solid #e5eae8', borderRadius: 6 }}>
                    <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>STUDENT NAME</th>
                          <th>ADM / ROLL NO</th>
                          <th>CLASS</th>
                          <th>GENDER</th>
                          <th>MEASURED SIZES</th>
                          <th>YEAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map(st => (
                          <tr key={st.id}>
                            <td><strong>{st.name}</strong></td>
                            <td>{st.admission || '-'}</td>
                            <td><span className="status in-progress">{st.className || '-'}</span></td>
                            <td><span className={'status ' + (st.gender === 'Girls' ? 'inactive' : 'in-progress')}>{st.gender === 'Girls' ? '👧 Girls' : '👦 Boys'}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {st.sizes && Object.entries(st.sizes).map(([g, sz]) => (
                                  <span key={g} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>
                                    {g}: <strong>{sz}</strong>
                                  </span>
                                ))}
                                {(!st.sizes || Object.keys(st.sizes).length === 0) && <span style={{ color: '#94a3b8', fontSize: 11 }}>No measurements</span>}
                              </div>
                            </td>
                            <td><small>{st.year || '-'}</small></td>
                          </tr>
                        ))}
                        {!filteredStudents.length && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#5f736d' }}>No students match the search filter.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: '#5f736d' }}>
                      Showing {filteredStudents.length} of {schoolStudents.length} students
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary"
                        onClick={() => {
                          const schoolName = viewSchool.name;
                          setActiveMetricModal(null);
                          setViewSchool(null);
                          lastOpenedSchoolRef.current = null;
                          onNavigate?.('Measurements', { school: schoolName, fromSchool: schoolName });
                        }}
                      >
                        <ExternalLink size={14} /> Open Measurements Page
                      </button>
                      <button className="outline" onClick={() => setActiveMetricModal(null)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* 2. REQUIRED MODAL */}
            {activeMetricModal === 'required' && (() => {
              const totalRequired = productSummary.reduce((a, b) => a + b.required, 0);
              const totalStitched = productSummary.reduce((a, b) => a + b.stitched, 0);
              const totalRemainingRequired = Math.max(0, totalRequired - totalStitched);
              const q = metricModalSearch.toLowerCase().trim();
              const filteredList = productSummary.filter(r => {
                if (!q) return true;
                return r.garment.toLowerCase().includes(q) || r.size.toLowerCase().includes(q) || r.year.toLowerCase().includes(q) || r.gender.toLowerCase().includes(q);
              });

              return (
                <>
                  <div className="cardhead" style={{ alignItems: 'center' }}>
                    <div>
                      <h2><Boxes size={20} color="#0284c7" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Order Requirements — {viewSchool.name}</h2>
                      <p>Total uniform quantities ordered, stitched, and balance remaining to produce.</p>
                    </div>
                    <button className="outline mini-action" onClick={() => setActiveMetricModal(null)}><X size={16} /></button>
                  </div>

                  <div className="metrics" style={{ marginTop: 10, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon blue"><Boxes size={16} /></div>
                      <div><span>Total Required</span><strong>{totalRequired} Pcs</strong><small>total ordered</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon green"><CheckCircle2 size={16} /></div>
                      <div><span>Total Stitched</span><strong>{totalStitched} Pcs</strong><small>production done</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px', border: '1.5px solid #f59e0b', background: '#fffbeb' }}>
                      <div className="metricicon orange" style={{ background: '#fef3c7', color: '#d97706' }}><AlertTriangle size={16} /></div>
                      <div><span style={{ color: '#b45309', fontWeight: 700 }}>Pending Prod</span><strong style={{ color: '#d97706' }}>{totalRemainingRequired} Pcs</strong><small>balance left</small></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ position: 'relative', flex: '1 1 260px' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5f736d' }} />
                      <input
                        type="text"
                        placeholder="Search garment type, size, year..."
                        value={metricModalSearch}
                        onChange={e => setMetricModalSearch(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid #c5d4cf', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '50vh', border: '1px solid #e5eae8', borderRadius: 6 }}>
                    <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>YEAR</th>
                          <th>GENDER</th>
                          <th>GARMENT TYPE</th>
                          <th>SIZE</th>
                          <th>REQUIRED (ORDER)</th>
                          <th>STITCHED</th>
                          <th>REMAINING TO PRODUCE</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredList.map((r, idx) => (
                          <tr key={idx}>
                            <td><strong>{r.year}</strong></td>
                            <td><span className={'status ' + (r.gender === 'Girls' ? 'inactive' : 'in-progress')}>{r.gender === 'Girls' ? '👧 Girls' : '👦 Boys'}</span></td>
                            <td><strong>{r.garment}</strong></td>
                            <td>{r.size}</td>
                            <td><strong style={{ color: '#007c68' }}>{r.required} Pcs</strong></td>
                            <td><strong style={{ color: '#166534' }}>{r.stitched} Pcs</strong></td>
                            <td>
                              <strong style={{ color: r.pendingProd > 0 ? '#dc2626' : '#166534' }}>
                                {r.pendingProd} Pcs
                              </strong>
                            </td>
                            <td>
                              {r.stitched >= r.required && r.required > 0 ? (
                                <span className="status completed">🟢 Fully Ready</span>
                              ) : r.stitched > 0 ? (
                                <span className="status pending">🟡 Partial Ready</span>
                              ) : (
                                <span className="status danger">⚪ Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!filteredList.length && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#5f736d' }}>No garment requirement records match filter.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: '#5f736d' }}>Showing {filteredList.length} items</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {totalRemainingRequired > 0 && (
                        <button
                          className="outline"
                          onClick={() => {
                            setActiveMetricModal(null);
                            setSummaryFilterStatus('pending-prod');
                          }}
                        >
                          <Filter size={14} /> Filter Table to Pending ({totalRemainingRequired} Pcs)
                        </button>
                      )}
                      <button
                        className="primary"
                        style={{ background: '#10b981', borderColor: '#059669' }}
                        onClick={() => {
                          setActiveMetricModal(null);
                          openMultiAddStockModal();
                        }}
                      >
                        <Plus size={14} /> Add Ready Stock
                      </button>
                      <button className="outline" onClick={() => setActiveMetricModal(null)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* 3. READY STOCK MODAL (Only for active school, displaying only available ready stock) */}
            {activeMetricModal === 'readyStock' && (() => {
              const totalStitched = productSummary.reduce((a, b) => a + b.stitched, 0);
              const totalAvailableReady = productSummary.reduce((a, b) => a + b.ready, 0);
              const totalDelivered = productSummary.reduce((a, b) => a + b.delivered, 0);
              const schoolStockList = schoolStock.filter(s => s.school === viewSchool.name);
              const q = metricModalSearch.toLowerCase().trim();

              // ONLY display variants where available ready stock > 0
              const availableVariants = productSummary.filter(r => r.ready > 0);
              const filteredVariants = availableVariants.filter(r => {
                if (!q) return true;
                return r.garment.toLowerCase().includes(q) || r.size.toLowerCase().includes(q) || r.year.toLowerCase().includes(q) || r.gender.toLowerCase().includes(q);
              });

              const filteredInward = schoolStockList.filter(s => {
                if (!q) return true;
                return s.garment.toLowerCase().includes(q) || s.size.toLowerCase().includes(q) || (s.remarks || '').toLowerCase().includes(q) || (s.id || '').toLowerCase().includes(q) || (s.date || '').toLowerCase().includes(q);
              });

              return (
                <>
                  <div className="cardhead" style={{ alignItems: 'center' }}>
                    <div>
                      <h2>
                        <CheckCircle2 size={20} color="#166534" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Ready Stock Inventory — {viewSchool.name}
                      </h2>
                      <p>Finished goods ready in stock (showing available pieces) and stitched inward history.</p>
                    </div>
                    <button className="outline mini-action" onClick={() => setActiveMetricModal(null)}><X size={16} /></button>
                  </div>

                  <div className="metrics" style={{ marginTop: 10, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <div className="metric" style={{ padding: '8px 12px', border: '1.5px solid #16a34a', background: '#f0fdf4' }}>
                      <div className="metricicon green"><CheckCircle2 size={16} /></div>
                      <div>
                        <span style={{ color: '#166534', fontWeight: 700 }}>Available Ready Stock</span>
                        <strong style={{ color: '#166534' }}>{totalAvailableReady} Pcs</strong>
                        <small>{availableVariants.length} variant{availableVariants.length === 1 ? '' : 's'} available to deliver</small>
                      </div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon purple"><Boxes size={16} /></div>
                      <div><span>Total Stitched</span><strong>{totalStitched} Pcs</strong><small>total completed production</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon blue"><Truck size={16} /></div>
                      <div><span>Total Delivered</span><strong>{totalDelivered} Pcs</strong><small>dispatched to school</small></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={readyStockTab === 'variants' ? 'primary' : 'outline'}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => setReadyStockTab('variants')}
                      >
                        📦 Available Ready Stock ({filteredVariants.length} with stock)
                      </button>
                      <button
                        className={readyStockTab === 'inward' ? 'primary' : 'outline'}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => setReadyStockTab('inward')}
                      >
                        📥 Stitched Inward History ({schoolStockList.length} entries)
                      </button>
                    </div>
                    <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5f736d' }} />
                      <input
                        type="text"
                        placeholder="Filter garment, size..."
                        value={metricModalSearch}
                        onChange={e => setMetricModalSearch(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid #c5d4cf', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '48vh', border: '1px solid #e5eae8', borderRadius: 6 }}>
                    {readyStockTab === 'variants' ? (
                      <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                        <thead>
                          <tr>
                            <th>YEAR</th>
                            <th>GENDER</th>
                            <th>GARMENT TYPE</th>
                            <th>SIZE</th>
                            <th>STITCHED</th>
                            <th>DELIVERED</th>
                            <th>AVAILABLE READY STOCK</th>
                            <th>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredVariants.map((r, idx) => (
                            <tr key={idx} style={{ background: '#f0fdf4' }}>
                              <td><strong>{r.year}</strong></td>
                              <td><span className={'status ' + (r.gender === 'Girls' ? 'inactive' : 'in-progress')}>{r.gender === 'Girls' ? '👧 Girls' : '👦 Boys'}</span></td>
                              <td><strong>{r.garment}</strong></td>
                              <td>{r.size}</td>
                              <td>{r.stitched} Pcs</td>
                              <td>{r.delivered} Pcs</td>
                              <td>
                                <strong style={{ fontSize: 13, color: '#166534' }}>
                                  {r.ready} Pcs 🟢 Available
                                </strong>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="outline mini-action"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  onClick={() => {
                                    setSelectedRowKeys(new Set([`${r.year}||${r.gender}||${r.garment}||${r.size}`]));
                                    setActiveMetricModal(null);
                                    setTimeout(() => openMultiDeliverStockModal(), 50);
                                  }}
                                  title="Deliver this item"
                                >
                                  Deliver
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!filteredVariants.length && (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#5f736d' }}>
                                {availableVariants.length === 0 ? 'No ready stock currently available for this school.' : 'No available stock matches your search filter.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th>INWARD REF / ID</th>
                            <th>GENDER</th>
                            <th>GARMENT TYPE</th>
                            <th>SIZE</th>
                            <th>QTY STITCHED</th>
                            <th>REMARKS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInward.map(entry => (
                            <tr key={entry.id}>
                              <td><strong>{entry.date}</strong></td>
                              <td><code style={{ fontSize: 11 }}>{entry.id}</code></td>
                              <td><span className={'status ' + (entry.gender === 'Girls' ? 'inactive' : 'in-progress')}>{entry.gender || 'Boys'}</span></td>
                              <td><strong>{entry.garment}</strong></td>
                              <td>{entry.size}</td>
                              <td><strong style={{ color: '#166534' }}>+{entry.count} Pcs</strong></td>
                              <td><small>{entry.remarks || '-'}</small></td>
                            </tr>
                          ))}
                          {!filteredInward.length && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#5f736d' }}>No stitched inward stock records found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <span style={{ fontSize: 11.5, color: '#5f736d' }}>
                      Available ready to deliver: <strong style={{ color: '#166534' }}>{totalAvailableReady} Pcs</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary"
                        style={{ background: '#10b981', borderColor: '#059669' }}
                        onClick={() => {
                          setActiveMetricModal(null);
                          openMultiAddStockModal();
                        }}
                      >
                        <Plus size={14} /> Add Ready Stock
                      </button>
                      <button
                        className="primary"
                        style={{ background: '#0284c7', borderColor: '#0284c7' }}
                        onClick={() => {
                          setActiveMetricModal(null);
                          openMultiDeliverStockModal();
                        }}
                      >
                        <Truck size={14} /> Deliver Stock
                      </button>
                      <button
                        className="outline"
                        onClick={() => {
                          const schoolName = viewSchool.name;
                          setActiveMetricModal(null);
                          setViewSchool(null);
                          lastOpenedSchoolRef.current = null;
                          onNavigate?.('Inventory', { stockView: 'ready', party: schoolName, fromSchool: schoolName });
                        }}
                      >
                        <ExternalLink size={14} /> Open Inventory Page
                      </button>
                      <button className="outline" onClick={() => setActiveMetricModal(null)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* 4. PENDING PROD MODAL */}
            {activeMetricModal === 'pendingProd' && (() => {
              const pendingVariants = productSummary.filter(r => r.pendingProd > 0);
              const totalPendingPieces = pendingVariants.reduce((a, b) => a + b.pendingProd, 0);
              const q = metricModalSearch.toLowerCase().trim();
              const filteredPending = pendingVariants.filter(r => {
                if (!q) return true;
                return r.garment.toLowerCase().includes(q) || r.size.toLowerCase().includes(q) || r.year.toLowerCase().includes(q) || r.gender.toLowerCase().includes(q);
              });

              return (
                <>
                  <div className="cardhead" style={{ alignItems: 'center' }}>
                    <div>
                      <h2><AlertTriangle size={20} color="#d97706" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Pending Production Work — {viewSchool.name}</h2>
                      <p>List of garments and sizes awaiting stitching and finishing.</p>
                    </div>
                    <button className="outline mini-action" onClick={() => setActiveMetricModal(null)}><X size={16} /></button>
                  </div>

                  <div className="metrics" style={{ marginTop: 10, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    <div className="metric" style={{ padding: '8px 12px', border: '1.5px solid #f59e0b', background: '#fffbeb' }}>
                      <div className="metricicon orange" style={{ background: '#fef3c7', color: '#d97706' }}><AlertTriangle size={16} /></div>
                      <div><span style={{ color: '#b45309', fontWeight: 700 }}>Total Pending Pieces</span><strong style={{ color: '#d97706' }}>{totalPendingPieces} Pcs</strong><small>across all sizes</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon blue"><Boxes size={16} /></div>
                      <div><span>Pending Variants</span><strong>{pendingVariants.length} items</strong><small>garment & size combinations</small></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ position: 'relative', flex: '1 1 260px' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5f736d' }} />
                      <input
                        type="text"
                        placeholder="Search garment type or size..."
                        value={metricModalSearch}
                        onChange={e => setMetricModalSearch(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid #c5d4cf', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '50vh', border: '1px solid #e5eae8', borderRadius: 6 }}>
                    <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>YEAR</th>
                          <th>GENDER</th>
                          <th>GARMENT TYPE</th>
                          <th>SIZE</th>
                          <th>REQUIRED</th>
                          <th>ALREADY STITCHED</th>
                          <th>PENDING TO STITCH</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPending.map((r, idx) => (
                          <tr key={idx}>
                            <td><strong>{r.year}</strong></td>
                            <td><span className={'status ' + (r.gender === 'Girls' ? 'inactive' : 'in-progress')}>{r.gender === 'Girls' ? '👧 Girls' : '👦 Boys'}</span></td>
                            <td><strong>{r.garment}</strong></td>
                            <td>{r.size}</td>
                            <td>{r.required} Pcs</td>
                            <td>{r.stitched} Pcs</td>
                            <td>
                              <strong style={{ color: '#dc2626', fontSize: 13 }}>
                                {r.pendingProd} Pcs Pending
                              </strong>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="primary mini-action"
                                style={{ background: '#10b981', borderColor: '#059669', fontSize: 11, padding: '3px 8px' }}
                                onClick={() => {
                                  setSelectedRowKeys(new Set([`${r.year}||${r.gender}||${r.garment}||${r.size}`]));
                                  setActiveMetricModal(null);
                                  setTimeout(() => openMultiAddStockModal(), 50);
                                }}
                              >
                                + Add Stock
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!filteredPending.length && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#166534', fontWeight: 700 }}>🎉 Great! All production requirements are fully stitched. Zero pending production.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: '#5f736d' }}>Pending variants: {filteredPending.length}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {pendingVariants.length > 0 && (
                        <button
                          className="primary"
                          style={{ background: '#10b981', borderColor: '#059669' }}
                          onClick={() => {
                            const pendingKeys = new Set(pendingVariants.map(r => `${r.year}||${r.gender}||${r.garment}||${r.size}`));
                            setSelectedRowKeys(pendingKeys);
                            setActiveMetricModal(null);
                            setTimeout(() => openMultiAddStockModal(), 50);
                          }}
                        >
                          <Plus size={14} /> Add Ready Stock for All Pending ({totalPendingPieces} Pcs)
                        </button>
                      )}
                      <button
                        className="outline"
                        onClick={() => {
                          setActiveMetricModal(null);
                          setSummaryFilterStatus('pending-prod');
                        }}
                      >
                        <Filter size={14} /> Filter Main Table
                      </button>
                      <button className="outline" onClick={() => setActiveMetricModal(null)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* 5. DELIVERED VALUE MODAL */}
            {activeMetricModal === 'delivered' && (() => {
              const totalDelivered = productSummary.reduce((a, b) => a + b.delivered, 0);
              const schoolSalesList = schoolSales.filter(s => s.type === 'School' && s.party === viewSchool.name);
              const q = metricModalSearch.toLowerCase().trim();
              const filteredSales = schoolSalesList.filter(s => {
                if (!q) return true;
                return (s.invoiceNo || '').toLowerCase().includes(q) || s.garment.toLowerCase().includes(q) || s.size.toLowerCase().includes(q) || (s.remarks || '').toLowerCase().includes(q) || (s.date || '').toLowerCase().includes(q);
              });

              return (
                <>
                  <div className="cardhead" style={{ alignItems: 'center' }}>
                    <div>
                      <h2><Truck size={20} color="#0284c7" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Delivery & Dispatch History — {viewSchool.name}</h2>
                      <p>Dispatched uniform items, invoice numbers, and total delivery billing value.</p>
                    </div>
                    <button className="outline mini-action" onClick={() => setActiveMetricModal(null)}><X size={16} /></button>
                  </div>

                  <div className="metrics" style={{ marginTop: 10, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon green"><IndianRupee size={16} /></div>
                      <div><span>Delivered Value</span><strong style={{ color: '#007c68' }}>{money(schoolDeliveredTotal)}</strong><small>total invoiced / dispatched</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon blue"><Truck size={16} /></div>
                      <div><span>Total Delivered</span><strong>{totalDelivered} Pcs</strong><small>total pieces issued</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon purple"><Boxes size={16} /></div>
                      <div><span>Dispatch Entries</span><strong>{schoolSalesList.length}</strong><small>dispatch batches</small></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ position: 'relative', flex: '1 1 260px' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5f736d' }} />
                      <input
                        type="text"
                        placeholder="Search invoice no, garment, size, date..."
                        value={metricModalSearch}
                        onChange={e => setMetricModalSearch(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid #c5d4cf', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '50vh', border: '1px solid #e5eae8', borderRadius: 6 }}>
                    <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>DATE</th>
                          <th>INVOICE / REF NO</th>
                          <th>GENDER</th>
                          <th>GARMENT TYPE</th>
                          <th>SIZE</th>
                          <th>DELIVERED QTY</th>
                          <th>RATE (₹)</th>
                          <th>AMOUNT (₹)</th>
                          <th>REMARKS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map(s => {
                          const hasMulti = Boolean(s.items && s.items.length > 1);
                          return (
                            <tr key={s.id}>
                              <td><strong>{s.date}</strong></td>
                              <td><strong style={{ color: '#0284c7' }}>{s.invoiceNo || '-'}</strong></td>
                              <td><span className={'status ' + (s.gender === 'Girls' ? 'inactive' : 'in-progress')}>{s.gender || 'Boys'}</span></td>
                              <td>
                                <strong>{s.garment}</strong>
                                {hasMulti && (
                                  <small style={{ display: 'block', color: '#5f736d', fontSize: 10, marginTop: 2 }}>
                                    {s.items!.map(it => `${it.garment} (${it.size}) × ${it.qty}`).join(', ')}
                                  </small>
                                )}
                              </td>
                              <td>{s.size}</td>
                              <td><strong style={{ color: '#0284c7' }}>{s.count} Pcs</strong></td>
                              <td>{hasMulti ? '-' : money(s.rate || 0)}</td>
                              <td><strong>{money(s.total || (s.count * (s.rate || 0)))}</strong></td>
                              <td><small>{s.remarks || '-'}</small></td>
                            </tr>
                          );
                        })}
                        {!filteredSales.length && (
                          <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: '#5f736d' }}>No delivery dispatch records found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: '#5f736d' }}>Showing {filteredSales.length} records</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary"
                        style={{ background: '#0284c7', borderColor: '#0284c7' }}
                        onClick={() => {
                          setActiveMetricModal(null);
                          openMultiDeliverStockModal();
                        }}
                      >
                        <Truck size={14} /> Deliver Stock
                      </button>
                      <button
                        className="outline"
                        onClick={() => {
                          const schoolName = viewSchool.name;
                          setActiveMetricModal(null);
                          setViewSchool(null);
                          lastOpenedSchoolRef.current = null;
                          onNavigate?.('Billing & Payments', { tab: 'invoices', fromSchool: schoolName });
                        }}
                      >
                        <ExternalLink size={14} /> Open Invoices & Delivery Page
                      </button>
                      <button className="outline" onClick={() => setActiveMetricModal(null)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* 6. COLLECTED MODAL */}
            {activeMetricModal === 'collected' && (() => {
              const schoolCollectionsList = schoolCollections.filter(c => c[2] === viewSchool.name);
              const q = metricModalSearch.toLowerCase().trim();
              const filteredCollections = schoolCollectionsList.filter(c => {
                if (!q) return true;
                return c.some(cell => (cell || '').toLowerCase().includes(q));
              });

              return (
                <>
                  <div className="cardhead" style={{ alignItems: 'center' }}>
                    <div>
                      <h2><WalletCards size={20} color="#007c68" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Payment Collections & Receipts — {viewSchool.name}</h2>
                      <p>Recorded payment receipts and collections for this institution.</p>
                    </div>
                    <button className="outline mini-action" onClick={() => setActiveMetricModal(null)}><X size={16} /></button>
                  </div>

                  <div className="metrics" style={{ marginTop: 10, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon green"><IndianRupee size={16} /></div>
                      <div><span>Total Collected</span><strong style={{ color: '#007c68' }}>{money(schoolCollectedTotal)}</strong><small>total payments received</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon blue"><WalletCards size={16} /></div>
                      <div><span>Receipts Count</span><strong>{schoolCollectionsList.length}</strong><small>receipt vouchers</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px', border: schoolPendingBalance > 0 ? '1.5px solid #ef4444' : undefined, background: schoolPendingBalance > 0 ? '#fef2f2' : undefined }}>
                      <div className="metricicon orange" style={schoolPendingBalance > 0 ? { background: '#fee2e2', color: '#dc2626' } : {}}><CreditCard size={16} /></div>
                      <div><span style={schoolPendingBalance > 0 ? { color: '#b91c1c', fontWeight: 700 } : {}}>Pending Balance</span><strong style={{ color: schoolPendingBalance > 0 ? '#dc2626' : '#166534' }}>{money(schoolPendingBalance)}</strong><small>{schoolPendingBalance > 0 ? 'due to collect' : 'fully paid'}</small></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ position: 'relative', flex: '1 1 260px' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5f736d' }} />
                      <input
                        type="text"
                        placeholder="Search receipt no, mode, remarks..."
                        value={metricModalSearch}
                        onChange={e => setMetricModalSearch(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid #c5d4cf', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '50vh', border: '1px solid #e5eae8', borderRadius: 6 }}>
                    <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>RECEIPT NO</th>
                          <th>DATE</th>
                          <th>PAYMENT MODE</th>
                          <th>AMOUNT</th>
                          <th>REMARKS / REF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCollections.map((c, idx) => (
                          <tr key={idx}>
                            <td><strong style={{ color: '#007c68' }}>{c[0]}</strong></td>
                            <td>{c[1]}</td>
                            <td><span className="status in-progress">{c[3]}</span></td>
                            <td><strong style={{ color: '#166534', fontSize: 13 }}>{c[4]}</strong></td>
                            <td><small>{c[5] || '-'}</small></td>
                          </tr>
                        ))}
                        {!filteredCollections.length && (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#5f736d' }}>No payment collection receipts recorded yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: '#5f736d' }}>Showing {filteredCollections.length} receipts</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary"
                        onClick={() => {
                          const schoolName = viewSchool.name;
                          setActiveMetricModal(null);
                          setViewSchool(null);
                          lastOpenedSchoolRef.current = null;
                          onNavigate?.('Billing & Payments', { tab: 'school', school: schoolName, fromSchool: schoolName, fromPage: productionMode ? 'Production' : 'Customers & Schools' });
                        }}
                      >
                        <CreditCard size={14} /> Record Payment Collection
                      </button>
                      <button className="outline" onClick={() => setActiveMetricModal(null)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* 7. PENDING BAL MODAL */}
            {activeMetricModal === 'pendingBal' && (() => {
              const schoolInvoices = invoices.filter(inv => inv.customer === viewSchool.name);
              const q = metricModalSearch.toLowerCase().trim();
              const filteredInvoices = schoolInvoices.filter(inv => {
                if (!q) return true;
                return (inv.invoiceNo || '').toLowerCase().includes(q) || (inv.product || '').toLowerCase().includes(q) || (inv.status || '').toLowerCase().includes(q) || (inv.invoiceDate || '').toLowerCase().includes(q);
              });

              return (
                <>
                  <div className="cardhead" style={{ alignItems: 'center' }}>
                    <div>
                      <h2><IndianRupee size={20} color="#d93d42" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Financial Balance & Ledger — {viewSchool.name}</h2>
                      <p>Outstanding payment balance calculation, billed value, and invoice ledger.</p>
                    </div>
                    <button className="outline mini-action" onClick={() => setActiveMetricModal(null)}><X size={16} /></button>
                  </div>

                  <div className="metrics" style={{ marginTop: 10, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon green"><IndianRupee size={16} /></div>
                      <div><span>Delivered Value</span><strong style={{ color: '#007c68' }}>{money(schoolDeliveredTotal)}</strong><small>total billed / dispatched</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px' }}>
                      <div className="metricicon blue"><WalletCards size={16} /></div>
                      <div><span>Total Collected</span><strong style={{ color: '#0284c7' }}>{money(schoolCollectedTotal)}</strong><small>total receipts</small></div>
                    </div>
                    <div className="metric" style={{ padding: '8px 12px', border: '1.5px solid #ef4444', background: '#fef2f2' }}>
                      <div className="metricicon orange" style={{ background: '#fee2e2', color: '#dc2626' }}><AlertTriangle size={16} /></div>
                      <div><span style={{ color: '#b91c1c', fontWeight: 700 }}>Pending Balance Due</span><strong style={{ color: '#dc2626' }}>{money(schoolPendingBalance)}</strong><small>outstanding due</small></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    {schoolPendingBalance > 0 ? (
                      <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={18} color="#dc2626" />
                        <span>Outstanding balance of <strong>{money(schoolPendingBalance)}</strong> is pending collection from {viewSchool.name}.</span>
                      </div>
                    ) : (
                      <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#166534', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CheckCircle2 size={18} color="#16a34a" />
                        <span>All delivered uniforms have been fully paid for. No outstanding balance.</span>
                      </div>
                    )}
                  </div>

                  <h3 style={{ font: '700 13px Manrope', color: '#123d35', margin: '6px 0 8px' }}>📄 Invoices for {viewSchool.name} ({schoolInvoices.length})</h3>

                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '42vh', border: '1px solid #e5eae8', borderRadius: 6 }}>
                    <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>INVOICE NO</th>
                          <th>DATE</th>
                          <th>ITEMS / DETAILS</th>
                          <th>QTY (PCS)</th>
                          <th>TAXABLE</th>
                          <th>GST %</th>
                          <th>TOTAL AMOUNT</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map(inv => (
                          <tr key={inv.invoiceNo}>
                            <td><strong style={{ color: '#0284c7' }}>{inv.invoiceNo}</strong></td>
                            <td>{inv.invoiceDate}</td>
                            <td><small>{inv.product}</small></td>
                            <td><strong>{inv.qty} Pcs</strong></td>
                            <td>{money(inv.taxableAmount)}</td>
                            <td>{inv.gstPercent ? `${inv.gstPercent}%` : '0%'}</td>
                            <td><strong style={{ color: '#1e3a8a' }}>{money(inv.totalAmount)}</strong></td>
                            <td>
                              <span className={'status ' + (inv.status === 'Paid' ? 'completed' : inv.status === 'Partially Paid' ? 'in-progress' : 'pending')}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!filteredInvoices.length && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: '#5f736d' }}>No invoices found for this school.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: '#5f736d' }}>Showing {filteredInvoices.length} invoices</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary"
                        onClick={() => {
                          const schoolName = viewSchool.name;
                          setActiveMetricModal(null);
                          setViewSchool(null);
                          lastOpenedSchoolRef.current = null;
                          onNavigate?.('Billing & Payments', { tab: 'school', school: schoolName, fromSchool: schoolName, fromPage: productionMode ? 'Production' : 'Customers & Schools' });
                        }}
                      >
                        <CreditCard size={14} /> Collect Payment Now
                      </button>
                      <button
                        className="outline"
                        onClick={() => {
                          const schoolName = viewSchool.name;
                          setActiveMetricModal(null);
                          setViewSchool(null);
                          lastOpenedSchoolRef.current = null;
                          onNavigate?.('Billing & Payments', { tab: 'invoices', fromSchool: schoolName });
                        }}
                      >
                        <ExternalLink size={14} /> View All Invoices
                      </button>
                      <button className="outline" onClick={() => setActiveMetricModal(null)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {showSchoolStatementModal && viewSchool && (() => {
        const schoolInvoices = invoices.filter(inv => inv.customer === viewSchool.name);
        const schoolInvNos = new Set(schoolInvoices.map(i => i.invoiceNo));
        const schoolPaymentsList = payments.filter(p => p.customer === viewSchool.name || schoolInvNos.has(p.invoiceNo));
        const totalDeliveredPieces = schoolInvoices.reduce((sum, inv) => sum + (Number(inv.qty) || 0), 0);
        const grossBilledTotal = schoolInvoices.reduce((sum, inv) => sum + (Number(inv.grossAmount) || (Number(inv.taxableAmount || 0) + (Number(inv.discount) || 0))), 0);
        const upfrontDiscountTotal = schoolInvoices.reduce((sum, inv) => sum + (Number(inv.discount) || 0), 0);
        const netBilledTotal = schoolInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
        const cashCollectedTotal = schoolPaymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const settlementDiscountsTotal = schoolPaymentsList.reduce((sum, p) => sum + (Number(p.discount) || 0), 0);
        const totalSettledAmount = cashCollectedTotal + settlementDiscountsTotal;
        const netBalanceOutstanding = Math.max(0, netBilledTotal - totalSettledAmount);
        const advanceBalanceCredit = Math.max(0, totalSettledAmount - netBilledTotal);

        return (
          <div className="stock-modal-overlay" onClick={() => setShowSchoolStatementModal(false)}>
            <div
              className="card detail-modal"
              style={{ maxWidth: '1000px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#fff' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="cardhead" style={{ alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#0284c7', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Statement of Account
                    </span>
                    <span style={{ color: '#64748b', fontSize: 12 }}>
                      Dated: <strong>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                    </span>
                  </div>
                  <h1 style={{ margin: '6px 0 2px', fontSize: 22, color: '#0f172a', fontWeight: 800 }}>
                    🏫 {viewSchool.name}
                  </h1>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                    {viewSchool.location ? `📍 ${viewSchool.location} • ` : ''}
                    {viewSchool.phone ? `📞 ${viewSchool.phone} • ` : ''}
                    {viewSchool.contact ? `👤 Contact: ${viewSchool.contact}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="primary"
                    style={{ background: '#0f172a', borderColor: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
                    onClick={() => window.print()}
                    title="Print Statement of Account"
                  >
                    <Printer size={15} /> Print Statement
                  </button>
                  <button className="outline mini-action" onClick={() => setShowSchoolStatementModal(false)}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* 4 Financial Highlight Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '14px 0 16px' }}>
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total Billed Value</span>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{money(netBilledTotal)}</div>
                  <small style={{ fontSize: 10, color: '#64748b' }}>{totalDeliveredPieces} Pcs across {schoolInvoices.length} inv</small>
                </div>
                <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Payments Collected</span>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#15803d', marginTop: 2 }}>{money(cashCollectedTotal)}</div>
                  <small style={{ fontSize: 10, color: '#166534' }}>{schoolPaymentsList.length} payment receipts</small>
                </div>
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>Discounts &amp; Waivers</span>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#d97706', marginTop: 2 }}>{money(upfrontDiscountTotal + settlementDiscountsTotal)}</div>
                  <small style={{ fontSize: 10, color: '#b45309' }}>Upfront: {money(upfrontDiscountTotal)} • Waiver: {money(settlementDiscountsTotal)}</small>
                </div>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: netBalanceOutstanding > 0 ? '1.5px solid #ef4444' : '1.5px solid #22c55e',
                  background: netBalanceOutstanding > 0 ? '#fef2f2' : '#f0fdf4'
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: netBalanceOutstanding > 0 ? '#b91c1c' : '#15803d' }}>
                    {netBalanceOutstanding > 0 ? 'Outstanding Balance' : advanceBalanceCredit > 0 ? 'Advance Credit' : 'Balance Status'}
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: netBalanceOutstanding > 0 ? '#dc2626' : '#16a34a', marginTop: 2 }}>
                    {netBalanceOutstanding > 0 ? money(netBalanceOutstanding) : advanceBalanceCredit > 0 ? `+${money(advanceBalanceCredit)}` : '₹0 (CLEARED)'}
                  </div>
                  <small style={{ fontSize: 10, color: netBalanceOutstanding > 0 ? '#b91c1c' : '#166534', fontWeight: 600 }}>
                    {netBalanceOutstanding > 0 ? 'Pending payment collection' : 'All deliveries fully settled'}
                  </small>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                {/* 1. Invoices & Delivery Bills */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      1. Invoices &amp; Delivery Bills ({schoolInvoices.length})
                    </h3>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Delivered items and issued invoices
                    </span>
                  </div>
                  <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>INVOICE NO</th>
                        <th>GARMENTS &amp; SIZES</th>
                        <th style={{ textAlign: 'center' }}>QTY</th>
                        <th style={{ textAlign: 'right' }}>GROSS (₹)</th>
                        <th style={{ textAlign: 'right' }}>DISCOUNT (₹)</th>
                        <th style={{ textAlign: 'right' }}>NET INVOICE (₹)</th>
                        <th style={{ textAlign: 'right' }}>SETTLED (₹)</th>
                        <th style={{ textAlign: 'right' }}>BALANCE (₹)</th>
                        <th style={{ textAlign: 'center' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolInvoices.map(inv => {
                        const invPaid = payments.filter(p => p.invoiceNo === inv.invoiceNo).reduce((s, p) => s + p.amount + (p.discount || 0), 0);
                        const invBal = Math.max(0, inv.totalAmount - invPaid);
                        const invGross = Number(inv.grossAmount) || (Number(inv.taxableAmount || 0) + (Number(inv.discount) || 0));
                        return (
                          <tr key={inv.invoiceNo}>
                            <td><strong>{inv.invoiceDate}</strong></td>
                            <td><strong style={{ color: '#0284c7' }}>{inv.invoiceNo}</strong></td>
                            <td style={{ maxWidth: 220, fontSize: 11 }}>{inv.product}</td>
                            <td style={{ textAlign: 'center' }}><strong>{inv.qty} Pcs</strong></td>
                            <td style={{ textAlign: 'right' }}>{money(invGross)}</td>
                            <td style={{ textAlign: 'right', color: inv.discount ? '#dc2626' : '#64748b' }}>
                              {inv.discount ? `- ${money(inv.discount)}` : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(inv.totalAmount)}</td>
                            <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 600 }}>{money(invPaid)}</td>
                            <td style={{ textAlign: 'right', color: invBal > 0 ? '#dc2626' : '#166534', fontWeight: 700 }}>
                              {money(invBal)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={'status ' + (inv.status === 'Paid' ? 'completed' : inv.status === 'Partially Paid' ? 'in-progress' : 'pending')}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {!schoolInvoices.length && (
                        <tr><td colSpan={10} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No delivery invoices generated yet for this school.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Payment Collections & Settlement Waivers */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. Payment Collections &amp; Settlement Waivers ({schoolPaymentsList.length})
                    </h3>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Cash/Bank receipts &amp; final settlement concessions
                    </span>
                  </div>
                  <table className="doc-table summary-table" style={{ width: '100%', margin: 0 }}>
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>RECEIPT / REF NO</th>
                        <th>TARGET INVOICE</th>
                        <th>PAYMENT MODE</th>
                        <th style={{ textAlign: 'right' }}>AMOUNT PAID (₹)</th>
                        <th style={{ textAlign: 'right' }}>SETTLEMENT WAIVER (₹)</th>
                        <th style={{ textAlign: 'right' }}>TOTAL SETTLED (₹)</th>
                        <th>REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolPaymentsList.map(pay => {
                        const totalSettledLine = pay.amount + (pay.discount || 0);
                        return (
                          <tr key={pay.id}>
                            <td><strong>{pay.date}</strong></td>
                            <td><strong style={{ color: '#0284c7' }}>{pay.reference || pay.id}</strong></td>
                            <td><code>{pay.invoiceNo}</code></td>
                            <td><span className="status in-progress">{pay.mode}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{money(pay.amount)}</td>
                            <td style={{ textAlign: 'right', fontWeight: pay.discount ? 700 : 400, color: pay.discount ? '#dc2626' : '#64748b' }}>
                              {pay.discount ? money(pay.discount) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{money(totalSettledLine)}</td>
                            <td style={{ fontSize: 11, color: '#475569' }}>{pay.remarks || '-'}</td>
                          </tr>
                        );
                      })}
                      {!schoolPaymentsList.length && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No payment receipts recorded yet for this school.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 3. Final Settlement Calculation Box */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #0f172a', borderRadius: 8, padding: '14px 18px', marginBottom: 14 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Final Account Clearance Summary
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Gross Value of Goods:</span>
                      <strong>{money(grossBilledTotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Upfront Bill Discounts:</span>
                      <strong style={{ color: '#dc2626' }}>- {money(upfrontDiscountTotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Net Invoiced Total:</span>
                      <strong>{money(netBilledTotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Total Payments Received:</span>
                      <strong style={{ color: '#15803d' }}>- {money(cashCollectedTotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Settlement Waivers/Discounts:</span>
                      <strong style={{ color: '#dc2626' }}>- {money(settlementDiscountsTotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '2px solid #0f172a', fontSize: 14, fontWeight: 800, color: netBalanceOutstanding > 0 ? '#dc2626' : '#16a34a' }}>
                      <span>Net Balance Due:</span>
                      <span>{money(netBalanceOutstanding)}</span>
                    </div>
                  </div>
                </div>

                {/* Signatures for Print */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginTop: 24, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: 40 }}></div>
                    <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6, fontWeight: 700, fontSize: 12, color: '#334155' }}>
                      Authorized Signatory (Garments ERP)
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: 40 }}></div>
                    <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6, fontWeight: 700, fontSize: 12, color: '#334155' }}>
                      School Principal / Authorized Signature &amp; Seal
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  All values in INR (₹). System generated accounting statement.
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {netBalanceOutstanding > 0 && (
                    <button
                      type="button"
                      className="primary"
                      style={{ background: '#0284c7', borderColor: '#0284c7', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                      onClick={() => {
                        const schoolName = viewSchool.name;
                        setShowSchoolStatementModal(false);
                        setViewSchool(null);
                        lastOpenedSchoolRef.current = null;
                        onNavigate?.('Billing & Payments', { tab: 'school', school: schoolName, fromSchool: schoolName, fromPage: productionMode ? 'Production' : 'Customers & Schools' });
                      }}
                    >
                      <CreditCard size={14} /> Record Payment / Settlement
                    </button>
                  )}
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setShowSchoolStatementModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>}
    {smsDraft&&<SmsComposerModal draft={smsDraft} setDraft={setSmsDraft} onClose={()=>setSmsDraft(null)} onSend={sendProductionSms} sending={sendingSms} cancelLabel="Skip SMS"/>}
    {toast&&<div className="toast"><span className="toast-dot"></span><span>{toast}</span>{deliveryInvoiceLink&&<button type="button" className="toast-link" onClick={()=>{const link=deliveryInvoiceLink;setDeliveryInvoiceLink(null);setToast('');onNavigate?.('Billing & Payments',{tab:'invoices',invoiceNo:link.invoiceNo,school:link.school})}}>View invoice</button>}</div>}
  </section>
}
