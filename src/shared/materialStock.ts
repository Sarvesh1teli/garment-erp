export type MaterialRow=[string,string,string,string,string];
export function nextMaterialItemCode(rows:readonly (readonly string[])[]){
  const highest=rows.reduce((max,row)=>{
    const match=/^(?:item|itm)-(\d+)$/i.exec(row[0]||'');
    return match?Math.max(max,Number(match[1])):max;
  },0);
  return `Item-${String(highest+1).padStart(3,'0')}`;
}
export const pieceUnit=(unit:string)=>/^(piece|pieces|pc|pcs)$/i.test(unit.trim());
export const materialUnit=(unit:string)=>pieceUnit(unit)?'Piece':/^(m|metre|metres|meter|meters|mtr|mtrs)$/i.test(unit.trim())?'Meter':unit.trim()||'Unknown unit';
export function validateMaterialQuantity(quantity:number,unit:string){
  if(!Number.isFinite(quantity)||quantity<0)throw Error('Material quantities must be zero or greater.');
  if(pieceUnit(unit)&&!Number.isSafeInteger(quantity))throw Error('Enter a whole number of pieces.');
}
export function materialQuantitySummary(entries:{unit:string;quantity:number}[]){
  const totals=new Map<string,number>();
  for(const entry of entries){const unit=materialUnit(entry.unit);totals.set(unit,(totals.get(unit)||0)+entry.quantity);}
  return Array.from(totals).sort(([a],[b])=>a.localeCompare(b)).map(([unit,quantity])=>`${Number(quantity.toPrecision(15))} ${unit}`).join(' · ')||'0';
}
export function nextMaterialEntryNumber(rows:readonly (readonly string[])[],prefix:'SIN'|'SOUT'){
  const pattern=new RegExp(`^${prefix}-(\\d{1,6})$`);
  const highest=rows.reduce((max,row)=>{const match=pattern.exec(row[0]||'');return match?Math.max(max,Number(match[1])):max;},0);
  if(highest>=999999)throw Error(`${prefix} receipt numbers have reached the six-digit limit.`);
  return `${prefix}-${String(highest+1).padStart(6,'0')}`;
}
export const materialKey=(name:string,subcategory:string)=>JSON.stringify([name,subcategory||'-']);
export function addMaterialVariants(existing:MaterialRow[],input:{code:string;name:string;unit:string;variants:{name:string;openingQty:number}[]}):MaterialRow[]{
  const name=input.name.trim(),unit=input.unit.trim()||'Piece';
  if(!name||!input.variants.length)throw Error('Enter an item name and at least one subcategory.');
  const family=existing.filter(r=>r[1].toLowerCase()===name.toLowerCase());
  const code=input.code.trim()||family[0]?.[0]||nextMaterialItemCode(existing);
  if(existing.some(r=>r[0].toLowerCase()===code.toLowerCase()&&r[1].toLowerCase()!==name.toLowerCase()))throw Error('This item code belongs to another item.');
  if(family.some(r=>r[0]!==code||r[3]!==unit))throw Error('Use the existing item code and unit when adding subcategories.');
  const seen=new Set(family.map(r=>r[2].toLowerCase()));
  const additions=input.variants.map(v=>{
    const category=v.name.trim()||'-';
    if(seen.has(category.toLowerCase()))throw Error(`Subcategory ${category} already exists for this item.`);
    if(!Number.isFinite(v.openingQty)||v.openingQty<0)throw Error('Opening quantities must be zero or greater.');
    validateMaterialQuantity(v.openingQty,unit);
    seen.add(category.toLowerCase());
    return [code,family[0]?.[1]||name,category,unit,String(v.openingQty)] as MaterialRow;
  });
  return [...existing,...additions];
}
export function moveMaterialStock(rows:MaterialRow[],name:string,subcategory:string,delta:number):MaterialRow[]{
  if(!Number.isFinite(delta)||delta===0)throw Error('Enter a quantity greater than zero.');
  const found=rows.filter(r=>materialKey(r[1],r[2])===materialKey(name,subcategory));
  if(found.length!==1)throw Error('Select a valid item and subcategory.');
  validateMaterialQuantity(Math.abs(delta),found[0][3]);
  if(Number(found[0][4])+delta<0)throw Error('Not enough stock in this subcategory.');
  return rows.map(r=>r===found[0]?[r[0],r[1],r[2],r[3],String(Number((Number(r[4])+delta).toPrecision(15)))]:r);
}

export function editMaterialVariant(rows:MaterialRow[],original:MaterialRow,draft:{code:string;name:string;subcategory:string;unit:string},history:readonly (readonly string[])[]):MaterialRow[]{
  const current=rows.find(row=>materialKey(row[1],row[2])===materialKey(original[1],original[2]));
  if(!current)throw Error('This material subcategory is no longer available.');
  const code=draft.code.trim(),name=draft.name.trim(),subcategory=draft.subcategory.trim()||'-',unit=draft.unit.trim();
  if(!code||!name||!unit)throw Error('Enter item code, name and unit.');
  const used=history.filter(row=>row[2]===current[1]);
  if(used.length&&(name!==current[1]||unit!==current[3]))throw Error('Item name and unit are linked to stock history. Keep their recorded values.');
  if(used.some(row=>row[3]===current[2]||row[3]==='-')&&subcategory!==current[2])throw Error('This subcategory is linked to stock history. Keep its recorded name.');
  const family=rows.filter(row=>row[1]===current[1]);
  if(unit!==current[3])for(const row of family)validateMaterialQuantity(Number(row[4]),unit);
  if(rows.some(row=>!family.includes(row)&&(row[0].toLowerCase()===code.toLowerCase()||row[1].toLowerCase()===name.toLowerCase())))throw Error('This item code or name belongs to another material.');
  if(family.some(row=>row!==current&&row[2].toLowerCase()===subcategory.toLowerCase()))throw Error('This subcategory already exists for the item.');
  return rows.map(row=>family.includes(row)?[code,name,row===current?subcategory:row[2],unit,row[4]]:row);
}
