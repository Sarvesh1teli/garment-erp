import { useEffect, useMemo, useState } from 'react';
import { Boxes, ListPlus, Plus, Save, Trash2, Truck } from 'lucide-react';
import { Stats, Table } from '../../shared/ui';
import { useStoredState } from '../../shared/utils';

type InventoryItem=[string,string,string,string,string]|[string,string,string,string];
type StockInRow=[string,string,string,string,string,string,string]|[string,string,string,string,string,string];
type StockOutRow=[string,string,string,string,string,string,string]|[string,string,string,string,string,string];
type InventoryTab='stock'|'in'|'out'|'items';

const defaultItems:InventoryItem[]=[];
const defaultStockIn:StockInRow[]=[];
const defaultStockOut:StockOutRow[]=[];

export function InventoryPage(){
  const [tab,setTab]=useState<InventoryTab>('stock');
  const [items,setItems]=useStoredState<InventoryItem[]>('garment-inventory-items',defaultItems);
  const [stockIn,setStockIn]=useStoredState<StockInRow[]>('garment-stock-in',defaultStockIn);
  const [stockOut,setStockOut]=useStoredState<StockOutRow[]>('garment-stock-out',defaultStockOut);
  const [form,setForm]=useState({date:new Date().toISOString().slice(0,10),item:items[0]?.[1]||'',subcategory:'',qty:0,vendor:'',remarks:''});
  const [itemForm,setItemForm]=useState({code:'',name:'',subcategory:'',unit:'Piece',openingQty:0});
  const normalizedItems=useMemo(()=>items.map(item=>item.length===4?[item[0],item[1],'-',item[2],item[3]] as InventoryItem:item),[items]);
  const hasOldItemRows=useMemo(()=>items.some(item=>item.length===4),[items]);

  useEffect(()=>{if(hasOldItemRows)setItems(normalizedItems)},[hasOldItemRows,normalizedItems,setItems]);
  useEffect(()=>{if(!normalizedItems.some(item=>item[1]===form.item))setForm(current=>({...current,item:normalizedItems[0]?.[1]||'',subcategory:normalizedItems[0]?.[2]||''}))},[normalizedItems,form.item]);

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

  return <section className="content"><div className="wage-heading">Inventory</div>
    <div className="measurement-tabs wage-tabs">
      <button className={tab==='stock'?'active':''} onClick={()=>setTab('stock')}><Boxes size={16}/><span>Current Stock<small>{normalizedItems.length} items</small></span></button>
      <button className={tab==='in'?'active':''} onClick={()=>setTab('in')}><Plus size={16}/><span>Stock In<small>material received</small></span></button>
      <button className={tab==='out'?'active':''} onClick={()=>setTab('out')}><Truck size={16}/><span>Stock Out<small>material issued</small></span></button>
      <button className={tab==='items'?'active':''} onClick={()=>setTab('items')}><ListPlus size={16}/><span>Item Head<small>item master</small></span></button>
    </div>
    {tab==='stock'&&<><Stats values={[['Stock Items',String(normalizedItems.length),'materials'],['Stock In',String(stockIn.length),'entries'],['Stock Out',String(stockOut.length),'entries'],['Low Stock',String(normalizedItems.filter(item=>Number(item[4]||0)<=0).length),'alerts']]}/><Table title="Current stock" copy="Material balance view for UI planning" headers={['ITEM CODE','ITEM','SUBCATEGORY','UNIT','AVAILABLE QTY']} rows={normalizedItems}/></>}
    {tab==='in'&&<><article className="card measurement-form"><div className="form-title"><div><h2>Add stock in</h2><p>Record material received from vendor.</p></div></div><div className="form-grid"><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Item<select value={form.item} onChange={e=>changeStockItem(e.target.value)}>{itemOptions}</select></label><label>Subcategory<input value={form.subcategory} onChange={e=>setForm({...form,subcategory:e.target.value})} placeholder={selectedItem?.[2]||'Manual subcategory'}/></label><label>Quantity<input type="number" min="0" value={form.qty} onChange={e=>setForm({...form,qty:Number(e.target.value)})}/></label><label>Vendor<input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})}/></label><label className="wide">Bill / Remarks<input value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label></div><div className="form-actions"><button className="primary" onClick={addStockIn}><Plus size={16}/> Add stock in</button></div></article><Table title="Stock in history" copy="Material received entries" headers={['ENTRY','DATE','ITEM','SUBCATEGORY','QTY','VENDOR','BILL / REMARKS']} rows={normalizedStockIn}/></>}
    {tab==='out'&&<><article className="card measurement-form"><div className="form-title"><div><h2>Add stock out</h2><p>Record material issued to production/order.</p></div></div><div className="form-grid"><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Item<select value={form.item} onChange={e=>changeStockItem(e.target.value)}>{itemOptions}</select></label><label>Subcategory<input value={form.subcategory} onChange={e=>setForm({...form,subcategory:e.target.value})} placeholder={selectedItem?.[2]||'Manual subcategory'}/></label><label>Quantity<input type="number" min="0" value={form.qty} onChange={e=>setForm({...form,qty:Number(e.target.value)})}/></label><label className="wide">Order / Remarks<input value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label></div><div className="form-actions"><button className="primary" onClick={addStockOut}><Plus size={16}/> Add stock out</button></div></article><Table title="Stock out history" copy="Material issue entries" headers={['ENTRY','DATE','ITEM','SUBCATEGORY','QTY','ORDER / REMARKS','PURPOSE']} rows={normalizedStockOut}/></>}
    {tab==='items'&&<div className="masters-grid"><article className="card measurement-form"><div className="form-title"><div><h2>Item head</h2><p>Add inventory items once. They will appear in Stock In and Stock Out.</p></div></div><div className="form-grid"><label>Item code<input value={itemForm.code} onChange={e=>setItemForm({...itemForm,code:e.target.value})} placeholder="Example: FAB-002"/></label><label>Item name<input value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})} placeholder="Example: Blue Fabric"/></label><label>Subcategory<input value={itemForm.subcategory} onChange={e=>setItemForm({...itemForm,subcategory:e.target.value})} placeholder="Example: Fabric, Button, Zip"/></label><label>Unit<select value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}><option>Piece</option><option>Meter</option><option>Kg</option><option>Box</option><option>Roll</option></select></label><label>Opening qty<input type="number" min="0" value={itemForm.openingQty} onChange={e=>setItemForm({...itemForm,openingQty:Number(e.target.value)})}/></label></div><div className="form-actions"><button className="primary" onClick={addItem}><Save size={16}/> Save item</button></div></article><article className="card jobs module-table"><div className="cardhead"><div><h2>Item head list</h2><p>These items are used in stock in and stock out dropdowns.</p></div></div><table><thead><tr><th>ITEM CODE</th><th>ITEM</th><th>SUBCATEGORY</th><th>UNIT</th><th>AVAILABLE QTY</th><th>ACTION</th></tr></thead><tbody>{normalizedItems.map(item=><tr key={item[0]}><td><strong>{item[0]}</strong></td><td>{item[1]}</td><td>{item[2]}</td><td>{item[3]}</td><td>{item[4]}</td><td><button className="danger-btn" onClick={()=>deleteItem(item)}><Trash2 size={14}/> Delete</button></td></tr>)}</tbody></table></article></div>}
  </section>;
}
