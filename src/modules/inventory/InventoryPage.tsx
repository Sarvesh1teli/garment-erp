import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, FileText, GraduationCap, ListPlus, Pencil, Plus, Printer, Save, ShoppingBag, Trash2, Truck, Users } from 'lucide-react';
import type { CompanySettings } from '../settings/SettingsPage';
import type { CustomerStock, Invoice, School, SchoolStock, StockSale } from '../../shared/types';
import { InvoiceDocument } from '../billing/BillingPaymentsPage';
import { PrintPreview, Stats, Table } from '../../shared/ui';
import { money, useStoredState, API_BASE_URL } from '../../shared/utils';

type InventoryItem=[string,string,string,string,string]|[string,string,string,string];
type StockInRow=[string,string,string,string,string,string,string]|[string,string,string,string,string,string];
type StockOutRow=[string,string,string,string,string,string,string]|[string,string,string,string,string,string];
type InventoryTab='stock'|'in'|'out'|'items';
type StockInTab='add'|'school'|'customer';
type StockOutTab='general'|'school'|'customer';
type StockView='material'|'school'|'customer';
type PartyKind='School'|'Customer';
type PartyForm={type:PartyKind;date:string;party:string;gender:string;className:string;garment:string;size:string;count:number;remarks:string;customGarment:string;customSize:string};
type SaleForm={type:PartyKind;date:string;party:string;gender:string;garment:string;size:string;count:number;rate:number;remarks:string;customGarment:string;customSize:string;invoiceNo:string};

const defaultItems:InventoryItem[]=[];
const defaultStockIn:StockInRow[]=[];
const defaultStockOut:StockOutRow[]=[];
const defaultGarments=['Shirt','Half Pant','Full Pant','Blouse','Skirt','Track Suit','Jacket'];
const defaultSizes=['26','28','30','32','34','36','38','40','42','S','M','L','XL','XXL','Free Size'];
const today=()=>new Date().toISOString().slice(0,10);
const sortSizes=(a:string,b:string)=>{const na=Number(a),nb=Number(b);if(!Number.isNaN(na)&&!Number.isNaN(nb))return na-nb;if(!Number.isNaN(na))return -1;if(!Number.isNaN(nb))return 1;return a.localeCompare(b)};
const emptyPartyForm=():PartyForm=>({type:'School',date:today(),party:'',gender:'Boys',className:'',garment:defaultGarments[0],size:'',count:0,remarks:'',customGarment:'',customSize:''});
const emptySaleForm=():SaleForm=>({type:'School',date:today(),party:'',gender:'Boys',garment:'',size:'',count:0,rate:0,remarks:'',customGarment:'',customSize:'',invoiceNo:''});

export function InventoryPage({company,customers,schools}:{company:CompanySettings;customers:string[][];schools:School[]}){
  const [tab,setTab]=useState<InventoryTab>('stock');
  const [stockView,setStockView]=useState<StockView>('material');
  const [inTab,setInTab]=useState<StockInTab>('add');
  const [outTab,setOutTab]=useState<StockOutTab>('general');
  const [items,setItems]=useStoredState<InventoryItem[]>('garment-inventory-items',defaultItems);
  const [stockIn,setStockIn]=useStoredState<StockInRow[]>('garment-stock-in',defaultStockIn);
  const [stockOut,setStockOut]=useStoredState<StockOutRow[]>('garment-stock-out',defaultStockOut);
  const [customGarments,setCustomGarments]=useStoredState<string[]>('garment-inventory-custom-garments',[]);
  const [schoolStock,setSchoolStock]=useStoredState<SchoolStock[]>('garment-school-stock',[]);
  const [customerStock,setCustomerStock]=useStoredState<CustomerStock[]>('garment-customer-stock',[]);
  const [sales,setSales]=useStoredState<StockSale[]>('garment-stock-sales',[]);
  const [invoices,setInvoices]=useStoredState<Invoice[]>('garment-invoices',[]);
  const [form,setForm]=useState({date:today(),item:items[0]?.[1]||'',subcategory:'',qty:0,vendor:'',remarks:''});
  const [itemForm,setItemForm]=useState({code:'',name:'',subcategory:'',unit:'Piece',openingQty:0});
  const [partyForm,setPartyForm]=useState<PartyForm>(emptyPartyForm());
  const [saleForm,setSaleForm]=useState<SaleForm>(emptySaleForm());
  const [previewInvoice,setPreviewInvoice]=useState<Invoice|null>(null);
  const [message,setMessage]=useState('');
  const [summaryParty,setSummaryParty]=useState('');
  const [summaryType,setSummaryType]=useState<PartyKind>('School');
  const [entriesGender,setEntriesGender]=useState('');
  const [entriesGarment,setEntriesGarment]=useState('');
  const [entriesSize,setEntriesSize]=useState('');
  const [entriesYear,setEntriesYear]=useState('');
  const [outYear,setOutYear]=useState('');
  const [outParty,setOutParty]=useState('');
  const [outGender,setOutGender]=useState('');
  const [outGarment,setOutGarment]=useState('');
  const [outSize,setOutSize]=useState('');
  const [itemPage,setItemPage]=useState(1);
  const [editEntry,setEditEntry]=useState<SchoolStock|CustomerStock|null>(null);
  const [confirmStock,setConfirmStock]=useState<SchoolStock|null>(null);
  const garments=[...defaultGarments,...customGarments];

  const normalizedItems=useMemo(()=>items.map(item=>item.length===4?[item[0],item[1],'-',item[2],item[3]] as InventoryItem:item),[items]);
  const hasOldItemRows=useMemo(()=>items.some(item=>item.length===4),[items]);
  useEffect(()=>{if(hasOldItemRows)setItems(normalizedItems)},[hasOldItemRows,normalizedItems,setItems]);
  useEffect(()=>{if(!normalizedItems.some(item=>item[1]===form.item))setForm(current=>({...current,item:normalizedItems[0]?.[1]||'',subcategory:normalizedItems[0]?.[2]||''}))},[normalizedItems,form.item]);
  useEffect(()=>{let active=true;fetch(`${API_BASE_URL}/api/ready-school-stock`).then(async response=>{if(response.status===404)return [];if(!response.ok)throw new Error('Unable to load ready stock');const body=await response.json();return body.data as SchoolStock[]}).then(rows=>{if(!active)return;setSchoolStock(current=>{const map=new Map(current.map(s=>[s.id,s]));rows.forEach(row=>{map.set(row.id,row)});return [...map.values()]})}).catch(error=>console.error(error));return()=>{active=false}},[]);

  const updateItemQty=(itemName:string,delta:number)=>setItems(current=>current.map(item=>{const row=item.length===4?[item[0],item[1],'-',item[2],item[3]] as InventoryItem:item;return row[1]===itemName?[row[0],row[1],row[2],row[3],String(Math.max(0,Number(row[4]||0)+delta))]:row}));
  const selectedItem=normalizedItems.find(item=>item[1]===form.item);
  const selectedSubcategory=form.subcategory.trim()||selectedItem?.[2]||'-';
  const changeStockItem=(itemName:string)=>{const nextItem=normalizedItems.find(item=>item[1]===itemName);setForm(current=>({...current,item:itemName,subcategory:nextItem?.[2]||''}))};
  const normalizedStockIn=stockIn.map(row=>row.length===6?[row[0],row[1],row[2],normalizedItems.find(item=>item[1]===row[2])?.[2]||'-',row[3],row[4],row[5]]:row);
  const normalizedStockOut=stockOut.map(row=>row.length===6?[row[0],row[1],row[2],normalizedItems.find(item=>item[1]===row[2])?.[2]||'-',row[3],row[4],row[5]]:row);
  const addStockIn=()=>{if(!form.item||form.qty<=0)return;setStockIn(current=>[[`SIN-${String(current.length+1).padStart(3,'0')}`,form.date,form.item,selectedSubcategory,String(form.qty),form.vendor,form.remarks||'-'],...current]);updateItemQty(form.item,Number(form.qty));setForm({...form,qty:0,remarks:''})};
  const addStockOut=()=>{if(!form.item||form.qty<=0)return;setStockOut(current=>[[`SOUT-${String(current.length+1).padStart(3,'0')}`,form.date,form.item,selectedSubcategory,String(form.qty),form.remarks||'-','Production'],...current]);updateItemQty(form.item,-Number(form.qty));setForm({...form,qty:0,remarks:''})};
  const addItem=()=>{const name=itemForm.name.trim();if(!name)return;const exists=normalizedItems.some(item=>item[1].toLowerCase()===name.toLowerCase()||item[0].toLowerCase()===itemForm.code.trim().toLowerCase());if(exists){window.alert('This item code or item name already exists.');return}const nextCode=itemForm.code.trim()||`ITM-${String(normalizedItems.length+1).padStart(3,'0')}`;setItems(current=>[...current,[nextCode,name,itemForm.subcategory.trim()||'-',itemForm.unit.trim()||'Piece',String(Number(itemForm.openingQty)||0)]]);setForm(current=>({...current,item:name}));setItemForm({code:'',name:'',subcategory:'',unit:'Piece',openingQty:0})};
  const deleteItem=(item:InventoryItem)=>{const used=stockIn.some(row=>row[2]===item[1])||stockOut.some(row=>row[2]===item[1]);if(used){window.alert(`${item[1]} is already used in stock entries. Keep it in Item Head for history.`);return}if(!window.confirm(`Delete item ${item[1]}?`))return;setItems(current=>current.filter(row=>row[0]!==item[0]))};
  const itemOptions=normalizedItems.map(item=><option key={item[0]} value={item[1]}>{item[0]} - {item[1]}{item[2]&&item[2]!=='-'?` (${item[2]})`:''}</option>);

  const stockRows=summaryType==='School'?schoolStock:customerStock;
  const partyField=summaryType==='School'?'school':'customer';
  const summarySchools=Array.from(new Set(stockRows.map(s=>(s as SchoolStock)[partyField as 'school']||(s as CustomerStock).customer).filter(Boolean)));
  const summaryOptions=summarySchools.map(s=><option key={s} value={s}>{s}</option>);
  const schoolGarmentOptions=Array.from(new Set(schoolStock.map(s=>s.garment))).sort();
  const schoolSizeOptions=Array.from(new Set(schoolStock.map(s=>s.size))).sort(sortSizes);
  const customerGarmentOptions=Array.from(new Set(customerStock.map(s=>s.garment))).sort();
  const customerSizeOptions=Array.from(new Set(customerStock.map(s=>s.size))).sort(sortSizes);

  const stockForParty=(type:PartyKind,party:string)=>type==='School'?schoolStock.filter(s=>s.school===party):customerStock.filter(s=>s.customer===party);
  const availableQty=(type:PartyKind,party:string,garment:string,size:string,gender='')=>{
    const inQty=stockForParty(type,party).filter(s=>s.garment===garment&&s.size===size&&(!gender||type!=='School'||(s as SchoolStock).gender===gender)).reduce((a,s)=>a+s.count,0);
    const outQty=sales.filter(s=>s.type===type&&s.party===party&&s.garment===garment&&s.size===size&&(!gender||type!=='School'||s.gender===gender)).reduce((a,s)=>a+s.count,0);
    return Math.max(0,inQty-outQty);
  };
  const summaryRows=useMemo(()=>{
    const map:Record<string,{party:string;garment:string;size:string;added:number;issued:number}>={};
    stockRows.forEach(row=>{const party=summaryType==='School'?(row as SchoolStock).school:(row as CustomerStock).customer;if(summaryParty&&party!==summaryParty)return;if(entriesYear&&(row.date||'').slice(0,4)!==entriesYear)return;if(summaryType==='School'&&entriesGender&&(row as SchoolStock).gender!==entriesGender)return;if(entriesGarment&&row.garment!==entriesGarment)return;if(entriesSize&&row.size!==entriesSize)return;const k=`${party}||${row.garment}||${row.size}`;map[k]=map[k]||{party,garment:row.garment,size:row.size,added:0,issued:0};map[k].added+=row.count});
    sales.filter(s=>s.type===summaryType).forEach(s=>{if(summaryParty&&s.party!==summaryParty)return;if(entriesYear&&(s.date||'').slice(0,4)!==entriesYear)return;if(summaryType==='School'&&entriesGender&&s.gender!==entriesGender)return;if(entriesGarment&&s.garment!==entriesGarment)return;if(entriesSize&&s.size!==entriesSize)return;const k=`${s.party}||${s.garment}||${s.size}`;map[k]=map[k]||{party:s.party,garment:s.garment,size:s.size,added:0,issued:0};map[k].issued+=s.count});
    return Object.values(map).map(r=>({...r,available:r.added-r.issued})).sort((a,b)=>a.party.localeCompare(b.party)||a.garment.localeCompare(b.garment)||a.size.localeCompare(b.size));
  },[stockRows,summaryType,summaryParty,entriesYear,entriesGender,entriesGarment,entriesSize,sales]);
  const itemPageSize=10;
  const itemPageCount=Math.max(1,Math.ceil(normalizedItems.length/itemPageSize));
  const safeItemPage=Math.min(itemPage,itemPageCount);
  const visibleItems=normalizedItems.slice((safeItemPage-1)*itemPageSize,safeItemPage*itemPageSize);
  useEffect(()=>{if(itemPage>itemPageCount)setItemPage(itemPageCount)},[itemPage,itemPageCount]);

  const schoolRows=schoolStock.map(s=>[s.id,s.date||'-',s.school,s.gender,s.garment,s.size,String(s.count),s.remarks||'-']);
  const customerRows=customerStock.map(s=>[s.id,s.date,s.customer,s.garment,s.size,String(s.count),s.remarks||'-']);
  const summaryLevelRows=summaryRows.map(r=>[r.party,r.garment,r.size,String(r.added),String(r.issued),String(r.available)]);
  const totalAvailable=summaryRows.reduce((a,r)=>a+r.available,0);
  const schoolSaleRows=sales.filter(s=>s.type==='School').filter(s=>(!outYear||(s.date||'').slice(0,4)===outYear)&&(!outParty||s.party===outParty)&&(!outGender||s.gender===outGender)&&(!outGarment||s.garment===outGarment)&&(!outSize||s.size===outSize)).map(s=>[s.id,s.date,s.gender||'-',s.party,s.garment,s.size,String(s.count),money(s.rate),money(s.total),s.invoiceNo]);
  const customerSaleRows=sales.filter(s=>s.type==='Customer').map(s=>[s.id,s.date,s.party,s.garment,s.size,String(s.count),money(s.rate),money(s.total),s.invoiceNo]);
  const saleCount=(rows:StockSale[])=>rows.reduce((a,s)=>a+s.count,0);
  const saleValue=(rows:StockSale[])=>rows.reduce((a,s)=>a+s.total,0);
  const schoolSales=sales.filter(s=>s.type==='School');
  const customerSales=sales.filter(s=>s.type==='Customer');
  const schoolYears=Array.from(new Set([...schoolStock.map(s=>(s.date||'').slice(0,4)),...schoolSales.map(s=>(s.date||'').slice(0,4))].filter(Boolean))).sort().reverse();
  const customerYears=Array.from(new Set([...customerStock.map(s=>(s.date||'').slice(0,4)),...customerSales.map(s=>(s.date||'').slice(0,4))].filter(Boolean))).sort().reverse();
  const outSchoolYears=schoolYears;
  const outSchoolOptions=Array.from(new Set(schoolSales.map(s=>s.party))).sort();
  const outGenderOptions=Array.from(new Set(schoolSales.map(s=>s.gender).filter(Boolean))).sort();
  const outGarmentOptions=Array.from(new Set(schoolSales.map(s=>s.garment))).sort();
  const outSizeOptions=Array.from(new Set(schoolSales.map(s=>s.size))).sort(sortSizes);
  const materialQty=normalizedItems.reduce((sum,item)=>sum+Number(item[4]||0),0);
  const schoolAdded=schoolStock.reduce((sum,row)=>sum+row.count,0);
  const customerAdded=customerStock.reduce((sum,row)=>sum+row.count,0);
  const schoolIssued=saleCount(schoolSales);
  const customerIssued=saleCount(customerSales);
  const summaryAdded=summaryRows.reduce((a,r)=>a+r.added,0);
  const summaryIssued=summaryRows.reduce((a,r)=>a+r.issued,0);
  const summaryPartyCount=new Set(summaryRows.map(r=>r.party)).size;
  const stockSummary=stockView==='material'
    ? [['Stock Items',String(normalizedItems.length),'materials'],['Total Qty',String(materialQty),'available material'],['Stock In',String(stockIn.length),'entries'],['Stock Out',String(stockOut.length),'entries']]
    : stockView==='school'
      ? [['Schools',String(summaryPartyCount),'with ready stock'],['Pieces Added',String(summaryAdded),'school pieces'],['Issued',String(summaryIssued),'pieces sold'],['Available',String(Math.max(0,summaryAdded-summaryIssued)),'ready pieces']]
      : [['Customers',String(summaryPartyCount),'with ready stock'],['Pieces Added',String(summaryAdded),'customer pieces'],['Issued',String(summaryIssued),'pieces sold'],['Available',String(Math.max(0,summaryAdded-summaryIssued)),'ready pieces']];

  const partyOptions=partyForm.type==='School'?schools.map(s=><option key={s.id} value={s.name}>{s.name}</option>):customers.map(c=><option key={c[0]} value={c[1]}>{c[1]}</option>);
  const salePartyOptions=saleForm.type==='School'?schools.map(s=><option key={s.id} value={s.name}>{s.name}</option>):customers.map(c=><option key={c[0]} value={c[1]}>{c[1]}</option>);
  const garmentOptions=garments.map(g=><option key={g} value={g}>{g}</option>);
  const sizeOptions=defaultSizes.map(s=><option key={s} value={s}>{s}</option>);

  const availableCombos=useMemo(()=>{
    if(!saleForm.party)return [];
    const seen=new Set<string>();const result:{garment:string;size:string;available:number}[]=[];
    stockForParty(saleForm.type,saleForm.party).filter(s=>saleForm.type!=='School'||!saleForm.gender||(s as SchoolStock).gender===saleForm.gender).forEach(s=>{const key=`${s.garment}||${s.size}`;if(seen.has(key))return;seen.add(key);const available=availableQty(saleForm.type,saleForm.party,s.garment,s.size,saleForm.type==='School'?saleForm.gender:'');if(available>0)result.push({garment:s.garment,size:s.size,available})});
    return result.sort((a,b)=>a.garment.localeCompare(b.garment)||a.size.localeCompare(b.size));
  },[saleForm.type,saleForm.party,saleForm.gender,schoolStock,customerStock,sales]);
  const saleGarments=Array.from(new Set(availableCombos.map(c=>c.garment)));
  const saleSizes=Array.from(new Set(availableCombos.filter(c=>!saleForm.garment||c.garment===saleForm.garment).map(c=>c.size)));
  const selectedCombo=availableCombos.find(c=>c.garment===saleForm.garment&&c.size===saleForm.size);
  const selectedGarmentName=saleForm.garment==='Other'?saleForm.customGarment.trim():saleForm.garment;
  const selectedSizeName=saleForm.size==='Custom'?saleForm.customSize.trim():saleForm.size;

  const switchInTab=(next:StockInTab)=>{setInTab(next);setEditEntry(null);if(next!=='add'){const type:PartyKind=next==='school'?'School':'Customer';setPartyForm(current=>({...current,type,party:type==='School'?schools[0]?.name||'':customers[0]?.[1]||'',garment:defaultGarments[0],size:'',className:''}))}};
  const switchStockView=(next:StockView)=>{setStockView(next);setEditEntry(null);setEntriesGender('');setEntriesGarment('');setEntriesSize('');setEntriesYear('');if(next!=='material'){const type:PartyKind=next==='school'?'School':'Customer';setSummaryParty('');setSummaryType(type)}};
  const switchOutTab=(next:StockOutTab)=>{setOutTab(next);if(next!=='general'){const type:PartyKind=next==='school'?'School':'Customer';setSaleForm(current=>({...current,type,party:type==='School'?schools[0]?.name||'':customers[0]?.[1]||'',garment:'',size:'',count:0,rate:0}))}};

  const addPartyStock=async()=>{
    const garment=partyForm.garment==='Other'?partyForm.customGarment.trim():partyForm.garment;
    const size=partyForm.size==='Custom'?partyForm.customSize.trim():partyForm.size;
    if(!partyForm.party||!garment||!size||partyForm.count<=0){setMessage('Select party, garment and size, then enter a valid count.');return}
    if(!garments.some(g=>g.toLowerCase()===garment.toLowerCase()))setCustomGarments(current=>[...current,garment]);
    if(partyForm.type==='School'){
      const payload={school:partyForm.party,className:partyForm.className.trim()||'General',date:partyForm.date,gender:partyForm.gender,garment,size,count:Number(partyForm.count),remarks:partyForm.remarks.trim()||'-'};
      try{
        const response=await fetch(editEntry?`${API_BASE_URL}/api/ready-school-stock/${editEntry.id}`:`${API_BASE_URL}/api/ready-school-stock`,{method:editEntry?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(!response.ok)throw new Error('Unable to save school ready stock');
        const body=await response.json();
        const entry:SchoolStock={id:body.data.id,...payload};
        setSchoolStock(current=>editEntry?current.map(s=>s.id===entry.id?entry:s):[entry,...current]);
      }catch(error){setMessage(error instanceof Error?error.message:'Unable to save school ready stock');return}
    }else{
      const entry:CustomerStock=editEntry?{...editEntry as CustomerStock,date:partyForm.date,customer:partyForm.party,garment,size,count:Number(partyForm.count),remarks:partyForm.remarks.trim()||'-'}:{id:`CUSSTK-${Date.now()}`,date:partyForm.date,customer:partyForm.party,garment,size,count:Number(partyForm.count),remarks:partyForm.remarks.trim()||'-'};
      setCustomerStock(current=>editEntry?current.map(s=>s.id===entry.id?entry:s):[entry,...current]);
    }
    setPartyForm(current=>({...current,count:0,remarks:'',customGarment:'',customSize:''}));
    setEditEntry(null);
    setMessage(`${garment} (${size}) × ${partyForm.count} ${editEntry?'updated':'added'} as ${partyForm.type==='School'?'school':'customer'} ready stock.`);
  };
  const deleteSchoolStock=(entry:SchoolStock)=>setConfirmStock(entry);
  const confirmDeleteSchoolStock=async()=>{if(!confirmStock)return;try{await fetch(`${API_BASE_URL}/api/ready-school-stock/${confirmStock.id}`,{method:'DELETE'})}catch(error){console.error(error)}setSchoolStock(current=>current.filter(s=>s.id!==confirmStock.id));setMessage(`Deleted ${confirmStock.school} — ${confirmStock.garment} (${confirmStock.size}) × ${confirmStock.count} from school ready stock.`);setConfirmStock(null)};
  const deleteCustomerStock=(id:string)=>{if(window.confirm('Delete this customer ready stock entry?'))setCustomerStock(current=>current.filter(s=>s.id!==id))};
  const startEdit=(entry:SchoolStock|CustomerStock)=>{const isSchool='school' in entry;const known=garments.some(g=>g===entry.garment);setPartyForm({type:isSchool?'School':'Customer',date:entry.date||today(),party:isSchool?entry.school:entry.customer,gender:isSchool?entry.gender:'Boys',className:isSchool?entry.className||'':'',garment:known?entry.garment:'Other',size:defaultSizes.includes(entry.size)?entry.size:'Custom',count:entry.count,remarks:entry.remarks&&entry.remarks!=='-'?entry.remarks:'',customGarment:known?'':entry.garment,customSize:defaultSizes.includes(entry.size)?'':entry.size});setEditEntry(entry)};
  const addSale=()=>{
    const garment=selectedGarmentName,size=selectedSizeName;
    if(!saleForm.party||!garment||!size||saleForm.count<=0){setMessage('Select party, garment, size and enter a valid count.');return}
    const available=availableQty(saleForm.type,saleForm.party,garment,size);
    if(saleForm.count>available){setMessage(`Only ${available} piece${available===1?'':'s'} available for ${garment} (${size}).`);return}
    const total=saleForm.count*saleForm.rate;
    const number=saleForm.invoiceNo.trim()||`INV-${String(invoices.length+1).padStart(3,'0')}`;
    if(invoices.some(inv=>inv.invoiceNo===number)){setMessage('Invoice number already exists. Use a different number.');return}
    const sale:StockSale={id:`SS-${Date.now()}`,date:saleForm.date,type:saleForm.type,party:saleForm.party,gender:saleForm.type==='School'?saleForm.gender:'',garment,size,count:saleForm.count,rate:saleForm.rate,total,invoiceNo:number,remarks:saleForm.remarks.trim()||'-'};
    const invoice:Invoice={invoiceNo:number,invoiceDate:saleForm.date,dueDate:'',state:'',reverseCharge:'NO',customer:saleForm.party,customerPhone:'',customerGst:'',customerAddress:'',shipTo:saleForm.party,shipAddress:'',shipGst:'',product:`${garment} (${size})`,hsn:'',qty:saleForm.count,unit:'PCS',rate:saleForm.rate,cgst:0,sgst:0,taxableAmount:total,totalAmount:total,status:'Pending',terms:'This is an electronically generated document. All disputes are subject to local jurisdiction.'};
    setSales(current=>[sale,...current]);
    setInvoices(current=>[invoice,...current]);
    setMessage(`Stock issued to ${saleForm.party}. Invoice ${number} created for ${money(total)}.`);
    setSaleForm(current=>({...current,count:0,rate:0,remarks:'',invoiceNo:'',garment:'',size:''}));
    setPreviewInvoice(invoice);
  };
  const deleteSale=(sale:StockSale)=>{if(!window.confirm(`Delete stock issue ${sale.invoiceNo}? This also removes its invoice.`))return;setSales(current=>current.filter(s=>s.id!==sale.id));setInvoices(current=>current.filter(inv=>inv.invoiceNo!==sale.invoiceNo))};

  const partyStockForm=<article className="card measurement-form">
    <div className="form-title"><div><h2>{editEntry?'Edit ':'Add '}{partyForm.type==='School'?'ready stock for school':'ready stock for customer'}</h2><p>{editEntry?'Update the ready pieces and save the changes.':(partyForm.type==='School'?'Record school-wise ready pieces by gender, garment and size.':'Record customer-wise ready pieces by garment and size.')}</p></div><span className="batch-no">{partyForm.type==='School'?schoolStock.length:customerStock.length} ENTRIES</span></div>
    <div className="form-grid">
      <label>Date<input type="date" value={partyForm.date} onChange={e=>setPartyForm({...partyForm,date:e.target.value})}/></label>
      <label>{partyForm.type==='School'?'School name':'Customer'}<select value={partyForm.party} onChange={e=>setPartyForm({...partyForm,party:e.target.value})}><option value="">Select {partyForm.type==='School'?'school':'customer'}</option>{partyOptions}</select></label>
      {partyForm.type==='School'&&<label>Gender<select value={partyForm.gender} onChange={e=>setPartyForm({...partyForm,gender:e.target.value})}><option>Boys</option><option>Girls</option></select></label>}
      {partyForm.type==='School'&&<label>Class<select value={partyForm.className} onChange={e=>setPartyForm({...partyForm,className:e.target.value})}><option value="">General</option>{['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12'].map(x=><option key={x}>{x}</option>)}</select></label>}
      <label>Garment<select value={partyForm.garment} onChange={e=>setPartyForm({...partyForm,garment:e.target.value,customGarment:''})}><option value="">Select garment</option>{garmentOptions}<option value="Other">Other...</option></select></label>
      <label>Size<select value={partyForm.size} onChange={e=>setPartyForm({...partyForm,size:e.target.value,customSize:''})}><option value="">Select size</option>{sizeOptions}<option value="Custom">Custom...</option></select></label>
      <label>Count<input type="number" min="0" value={partyForm.count} onChange={e=>setPartyForm({...partyForm,count:Number(e.target.value)})}/></label>
      {partyForm.garment==='Other'&&<label>New garment name<input value={partyForm.customGarment} onChange={e=>setPartyForm({...partyForm,customGarment:e.target.value})} placeholder="Enter garment name"/></label>}
      {partyForm.size==='Custom'&&<label>New size<input value={partyForm.customSize} onChange={e=>setPartyForm({...partyForm,customSize:e.target.value})} placeholder="Enter size"/></label>}
      <label>Optional / Remarks<input value={partyForm.remarks} onChange={e=>setPartyForm({...partyForm,remarks:e.target.value})} placeholder="Optional notes"/></label>
    </div>
    <div className="form-actions">{editEntry&&<button className="outline" onClick={()=>{setEditEntry(null);setPartyForm(current=>({...current,count:0,remarks:'',customGarment:'',customSize:''}))}}>Cancel</button>}<button className="primary" onClick={addPartyStock}>{editEntry?<Save size={16}/>:<Plus size={16}/>} {editEntry?'Save changes':'Add stock'}</button></div>
  </article>;

  const saleFormUI=<article className="card measurement-form">
    <div className="form-title"><div><h2>{saleForm.type==='School'?'Issue stock to school':'Issue stock to customer'}</h2><p>Issue ready stock and automatically create a tax invoice.</p></div><span className="batch-no">AVAILABLE {selectedCombo?selectedCombo.available:0} PCS</span></div>
    <div className="form-grid">
      <label>Date<input type="date" value={saleForm.date} onChange={e=>setSaleForm({...saleForm,date:e.target.value})}/></label>
      <label>{saleForm.type==='School'?'School name':'Customer'}<select value={saleForm.party} onChange={e=>setSaleForm({...saleForm,party:e.target.value,garment:'',size:''})}><option value="">Select {saleForm.type==='School'?'school':'customer'}</option>{salePartyOptions}</select></label>
      {saleForm.type==='School'&&<label>Gender<select value={saleForm.gender} onChange={e=>setSaleForm({...saleForm,gender:e.target.value,garment:'',size:''})}><option>Boys</option><option>Girls</option></select></label>}
      <label>Garment<select value={saleForm.garment} onChange={e=>setSaleForm({...saleForm,garment:e.target.value,size:''})}><option value="">Select garment</option>{saleGarments.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
      <label>Size<select value={saleForm.size} onChange={e=>setSaleForm({...saleForm,size:e.target.value})}><option value="">Select size</option>{saleSizes.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
      <label>Count<input type="number" min="0" max={selectedCombo?.available||0} value={saleForm.count} onChange={e=>setSaleForm({...saleForm,count:Number(e.target.value)})}/></label>
      <label>Price (per piece)<input type="number" min="0" value={saleForm.rate} onChange={e=>setSaleForm({...saleForm,rate:Number(e.target.value)})}/></label>
      <label>Total amount<input value={money(saleForm.count*saleForm.rate)} disabled/></label>
      <label>Invoice No<input value={saleForm.invoiceNo} onChange={e=>setSaleForm({...saleForm,invoiceNo:e.target.value})} placeholder="Auto: next INV number"/></label>
      <label>Remarks<input value={saleForm.remarks} onChange={e=>setSaleForm({...saleForm,remarks:e.target.value})} placeholder="Optional"/></label>
    </div>
    <div className="form-actions"><button className="primary" onClick={addSale} disabled={!selectedCombo}><FileText size={16}/> Issue stock & create invoice</button></div>
  </article>;

  return <section className="content inventory-page">{message&&<div className="toast"><span className="toast-dot"/>{message}</div>}
    <div className="measurement-tabs wage-tabs">
      <button className={tab==='stock'?'active':''} onClick={()=>setTab('stock')}><Boxes size={16}/><span>Current Stock<small>{normalizedItems.length} items</small></span></button>
      <button className={tab==='in'?'active':''} onClick={()=>setTab('in')}><Plus size={16}/><span>Stock In<small>material & ready stock</small></span></button>
      <button className={tab==='out'?'active':''} onClick={()=>setTab('out')}><Truck size={16}/><span>Stock Out<small>issue + invoice</small></span></button>
      <button className={tab==='items'?'active':''} onClick={()=>setTab('items')}><ListPlus size={16}/><span>Item Head<small>item master</small></span></button>
    </div>
    {tab==='stock'&&<div className="inventory-view-panel"><div className="inventory-line-tabs" role="tablist" aria-label="Current stock views"><button className={stockView==='material'?'active':''} onClick={()=>switchStockView('material')}>Material Stock</button><button className={stockView==='school'?'active':''} onClick={()=>switchStockView('school')}>School Stock</button><button className={stockView==='customer'?'active':''} onClick={()=>switchStockView('customer')}>Customer Stock</button></div><div className="inventory-tab-content">{stockView==='school'&&<div className="filterbar ready-stock-filter"><label>Year<select value={entriesYear} onChange={e=>setEntriesYear(e.target.value)}><option value="">All years</option>{schoolYears.map(y=><option key={y}>{y}</option>)}</select></label><label>School name<select value={summaryParty} onChange={e=>setSummaryParty(e.target.value)}><option value="">All schools</option>{summaryOptions}</select></label><label>Gender<select value={entriesGender} onChange={e=>setEntriesGender(e.target.value)}><option value="">All</option><option>Boys</option><option>Girls</option></select></label><label>Garment<select value={entriesGarment} onChange={e=>setEntriesGarment(e.target.value)}><option value="">All garments</option>{schoolGarmentOptions.map(g=><option key={g}>{g}</option>)}</select></label><label>Size<select value={entriesSize} onChange={e=>setEntriesSize(e.target.value)}><option value="">All sizes</option>{schoolSizeOptions.map(s=><option key={s}>{s}</option>)}</select></label></div>}{stockView==='customer'&&<div className="filterbar ready-stock-filter"><label>Year<select value={entriesYear} onChange={e=>setEntriesYear(e.target.value)}><option value="">All years</option>{customerYears.map(y=><option key={y}>{y}</option>)}</select></label><label>Customer<select value={summaryParty} onChange={e=>setSummaryParty(e.target.value)}><option value="">All customers</option>{summaryOptions}</select></label><label>Garment<select value={entriesGarment} onChange={e=>setEntriesGarment(e.target.value)}><option value="">All garments</option>{customerGarmentOptions.map(g=><option key={g}>{g}</option>)}</select></label><label>Size<select value={entriesSize} onChange={e=>setEntriesSize(e.target.value)}><option value="">All sizes</option>{customerSizeOptions.map(s=><option key={s}>{s}</option>)}</select></label></div>}<Stats values={stockSummary}/>{stockView==='material'&&<Table title="Current stock" copy="Material balance view" headers={['ITEM CODE','ITEM','SUBCATEGORY','UNIT','AVAILABLE QTY']} rows={normalizedItems} paged/>}{stockView==='school'&&<Table title="School stock" copy="Added, issued and available pieces combined by school, garment and size" headers={['SCHOOL','GARMENT','SIZE','ADDED','ISSUED','AVAILABLE']} rows={summaryLevelRows} paged total={`Total available: ${totalAvailable} pcs`}/>}{stockView==='customer'&&<Table title="Customer stock" copy="Added, issued and available pieces combined by customer, garment and size" headers={['CUSTOMER','GARMENT','SIZE','ADDED','ISSUED','AVAILABLE']} rows={summaryLevelRows} paged total={`Total available: ${totalAvailable} pcs`}/>}</div></div>}
    {tab==='in'&&<div className="inventory-view-panel">
      <div className="inventory-line-tabs" role="tablist" aria-label="Stock in views">
        <button className={inTab==='add'?'active':''} onClick={()=>switchInTab('add')}>Material Stock In</button>
        <button className={inTab==='school'?'active':''} onClick={()=>switchInTab('school')}>School Stock In</button>
        <button className={inTab==='customer'?'active':''} onClick={()=>switchInTab('customer')}>Customer Stock In</button>
      </div>
      <div className="inventory-tab-content">
      {inTab==='add'&&<><article className="card measurement-form"><div className="form-title"><div><h2>Add stock in</h2><p>Record material received from vendor.</p></div></div><div className="form-grid"><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Item<select value={form.item} onChange={e=>changeStockItem(e.target.value)}>{itemOptions}</select></label><label>Subcategory<input value={form.subcategory} onChange={e=>setForm({...form,subcategory:e.target.value})} placeholder={selectedItem?.[2]||'Manual subcategory'}/></label><label>Quantity<input type="number" min="0" value={form.qty} onChange={e=>setForm({...form,qty:Number(e.target.value)})}/></label><label>Vendor<input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})}/></label><label className="wide">Bill / Remarks<input value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label></div><div className="form-actions"><button className="primary" onClick={addStockIn}><Plus size={16}/> Add stock in</button></div></article><Table title="Stock in history" copy="Material received entries" headers={['ENTRY','DATE','ITEM','SUBCATEGORY','QTY','VENDOR','BILL / REMARKS']} rows={normalizedStockIn} paged/></>}
      {inTab==='school'&&<><Stats values={[['Schools',String(new Set(schoolStock.map(s=>s.school)).size),'with ready stock'],['Pieces Added',String(schoolStock.reduce((a,s)=>a+s.count,0)),'school pieces'],['Issued',String(schoolSales.reduce((a,s)=>a+s.count,0)),'pieces sold'],['Available',String(schoolStock.reduce((a,s)=>a+s.count,0)-schoolSales.reduce((a,s)=>a+s.count,0)),'ready pieces']]}/>{partyStockForm}<Table title="School ready stock entries" copy="Date, school, gender, garment, size and count records" headers={['ID','DATE','SCHOOL','GENDER','GARMENT','SIZE','COUNT','REMARKS']} rows={schoolRows} paged actions={row=>{const entry=schoolStock.find(s=>s.id===row[0]);return entry?<div className="table-actions"><button className="outline mini-action" onClick={()=>startEdit(entry)}><Pencil size={14}/></button><button className="outline mini-action danger" onClick={()=>deleteSchoolStock(entry)}><Trash2 size={14}/></button></div>:null}}/></>}
      {inTab==='customer'&&<><Stats values={[['Customers',String(new Set(customerStock.map(s=>s.customer)).size),'with ready stock'],['Pieces Added',String(customerStock.reduce((a,s)=>a+s.count,0)),'customer pieces'],['Issued',String(customerSales.reduce((a,s)=>a+s.count,0)),'pieces sold'],['Available',String(customerStock.reduce((a,s)=>a+s.count,0)-customerSales.reduce((a,s)=>a+s.count,0)),'ready pieces']]}/>{partyStockForm}<Table title="Customer ready stock entries" copy="Date, customer, garment, size and count records" headers={['ID','DATE','CUSTOMER','GARMENT','SIZE','COUNT','REMARKS']} rows={customerRows} paged actions={row=>{const entry=customerStock.find(s=>s.id===row[0]);return entry?<div className="table-actions"><button className="outline mini-action" onClick={()=>startEdit(entry)}><Pencil size={14}/></button><button className="outline mini-action danger" onClick={()=>deleteCustomerStock(entry.id)}><Trash2 size={14}/></button></div>:null}}/></>}
      </div>
    </div>}
    {tab==='out'&&<div className="inventory-view-panel">
      <div className="inventory-line-tabs" role="tablist" aria-label="Stock out views">
        <button className={outTab==='general'?'active':''} onClick={()=>switchOutTab('general')}>Stock Out</button>
        <button className={outTab==='school'?'active':''} onClick={()=>switchOutTab('school')}>School</button>
        <button className={outTab==='customer'?'active':''} onClick={()=>switchOutTab('customer')}>Customer</button>
      </div>
      <div className="inventory-tab-content">
      {outTab==='general'&&<><article className="card measurement-form"><div className="form-title"><div><h2>Add stock out</h2><p>Record material issued to production/order.</p></div></div><div className="form-grid"><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Item<select value={form.item} onChange={e=>changeStockItem(e.target.value)}>{itemOptions}</select></label><label>Subcategory<input value={form.subcategory} onChange={e=>setForm({...form,subcategory:e.target.value})} placeholder={selectedItem?.[2]||'Manual subcategory'}/></label><label>Quantity<input type="number" min="0" value={form.qty} onChange={e=>setForm({...form,qty:Number(e.target.value)})}/></label><label className="wide">Order / Remarks<input value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label></div><div className="form-actions"><button className="primary" onClick={addStockOut}><Plus size={16}/> Add stock out</button></div></article><Table title="Stock out history" copy="Material issue entries" headers={['ENTRY','DATE','ITEM','SUBCATEGORY','QTY','ORDER / REMARKS','PURPOSE']} rows={normalizedStockOut} paged/></>}
      {outTab==='school'&&<><Stats values={[['School Sales',String(schoolSales.length),'invoices'],['Pieces Issued',String(saleCount(schoolSales)),'school pieces'],['Total Value',money(saleValue(schoolSales)),'school invoices'],['Available',String(schoolStock.reduce((a,s)=>a+s.count,0)-saleCount(schoolSales)),'ready pieces']]}/>{saleFormUI}<div className="filterbar ready-stock-filter"><label>Year<select value={outYear} onChange={e=>setOutYear(e.target.value)}><option value="">All years</option>{outSchoolYears.map(y=><option key={y}>{y}</option>)}</select></label><label>School<select value={outParty} onChange={e=>setOutParty(e.target.value)}><option value="">All schools</option>{outSchoolOptions.map(s=><option key={s}>{s}</option>)}</select></label><label>Gender<select value={outGender} onChange={e=>setOutGender(e.target.value)}><option value="">All</option>{outGenderOptions.map(g=><option key={g}>{g}</option>)}</select></label><label>Garment<select value={outGarment} onChange={e=>setOutGarment(e.target.value)}><option value="">All garments</option>{outGarmentOptions.map(g=><option key={g}>{g}</option>)}</select></label><label>Size<select value={outSize} onChange={e=>setOutSize(e.target.value)}><option value="">All sizes</option>{outSizeOptions.map(s=><option key={s}>{s}</option>)}</select></label></div><Table title="School stock issues" copy="Issued ready stock with generated tax invoices" headers={['ID','DATE','GENDER','SCHOOL','GARMENT','SIZE','COUNT','PRICE','TOTAL','INVOICE']} rows={schoolSaleRows} paged actions={row=>{const sale=sales.find(s=>s.id===row[0]);const invoice=sale?invoices.find(inv=>inv.invoiceNo===sale.invoiceNo):undefined;return <div className="table-actions">{invoice&&<button className="outline mini-action" onClick={()=>setPreviewInvoice(invoice)}><Printer size={14}/></button>}{sale&&<button className="outline mini-action danger" onClick={()=>deleteSale(sale)}><Trash2 size={14}/></button>}</div>}}/></>}
      {outTab==='customer'&&<><Stats values={[['Customer Sales',String(customerSales.length),'invoices'],['Pieces Issued',String(saleCount(customerSales)),'customer pieces'],['Total Value',money(saleValue(customerSales)),'customer invoices'],['Available',String(customerStock.reduce((a,s)=>a+s.count,0)-saleCount(customerSales)),'ready pieces']]}/>{saleFormUI}<Table title="Customer stock issues" copy="Issued ready stock with generated tax invoices" headers={['ID','DATE','TYPE','CUSTOMER','GARMENT','SIZE','COUNT','PRICE','TOTAL','INVOICE']} rows={customerSaleRows} paged actions={row=>{const sale=sales.find(s=>s.id===row[0]);const invoice=sale?invoices.find(inv=>inv.invoiceNo===sale.invoiceNo):undefined;return <div className="table-actions">{invoice&&<button className="outline mini-action" onClick={()=>setPreviewInvoice(invoice)}><Printer size={14}/></button>}{sale&&<button className="outline mini-action danger" onClick={()=>deleteSale(sale)}><Trash2 size={14}/></button>}</div>}}/></>}
      </div>
    </div>}
    {tab==='items'&&<div className="masters-grid"><article className="card measurement-form"><div className="form-title"><div><h2>Item head</h2><p>Add inventory items once. They will appear in Stock In and Stock Out.</p></div></div><div className="form-grid"><label>Item code<input value={itemForm.code} onChange={e=>setItemForm({...itemForm,code:e.target.value})} placeholder="Example: FAB-002"/></label><label>Item name<input value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})} placeholder="Example: Blue Fabric"/></label><label>Subcategory<input value={itemForm.subcategory} onChange={e=>setItemForm({...itemForm,subcategory:e.target.value})} placeholder="Example: Fabric, Button, Zip"/></label><label>Unit<select value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}><option>Piece</option><option>Meter</option><option>Kg</option><option>Box</option><option>Roll</option></select></label><label>Opening qty<input type="number" min="0" value={itemForm.openingQty} onChange={e=>setItemForm({...itemForm,openingQty:Number(e.target.value)})}/></label></div><div className="form-actions"><button className="primary" onClick={addItem}><Save size={16}/> Save item</button></div></article><article className="card jobs module-table"><div className="cardhead"><div><h2>Item head list</h2><p>These items are used in stock in and stock out dropdowns.</p></div></div><table><thead><tr><th>ITEM CODE</th><th>ITEM</th><th>SUBCATEGORY</th><th>UNIT</th><th>AVAILABLE QTY</th><th>ACTION</th></tr></thead><tbody>{visibleItems.map(item=><tr key={item[0]}><td><strong>{item[0]}</strong></td><td>{item[1]}</td><td>{item[2]}</td><td>{item[3]}</td><td>{item[4]}</td><td><button className="danger-btn" onClick={()=>deleteItem(item)}><Trash2 size={14}/> Delete</button></td></tr>)}</tbody></table>{normalizedItems.length>0&&<div className="table-footer paginated-footer"><span>Showing {((safeItemPage-1)*itemPageSize)+1}-{Math.min(safeItemPage*itemPageSize,normalizedItems.length)} of {normalizedItems.length} entries</span><div className="pager"><button className="outline" disabled={safeItemPage===1} onClick={()=>setItemPage(p=>Math.max(1,p-1))}>Prev</button><span>Page {safeItemPage} / {itemPageCount}</span><button className="outline" disabled={safeItemPage===itemPageCount} onClick={()=>setItemPage(p=>Math.min(itemPageCount,p+1))}>Next</button></div></div>}</article></div>}
    {confirmStock&&<div className="salary-modal-overlay" onClick={()=>setConfirmStock(null)}><div className="salary-modal confirm-dialog" onClick={e=>e.stopPropagation()}><div className="confirm-icon"><AlertTriangle size={22}/></div><h3>Delete ready stock entry?</h3><p>This permanently removes <strong>{confirmStock.school}</strong> · <strong>{confirmStock.garment} (size {confirmStock.size})</strong> × <strong>{confirmStock.count} pcs</strong> from school ready stock. This action cannot be undone.</p><div className="salary-modal-actions"><button className="outline" onClick={()=>setConfirmStock(null)}>Cancel</button><button className="danger-btn" onClick={confirmDeleteSchoolStock}><Trash2 size={14}/> Yes, delete entry</button></div></div></div>}
    {previewInvoice&&<PrintPreview doc={<InvoiceDocument invoice={previewInvoice} company={company} garment/>} onClose={()=>setPreviewInvoice(null)}/>}
  </section>;
}
