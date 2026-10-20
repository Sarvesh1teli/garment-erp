export type MaterialRow=[string,string,string,string,string];
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
  const code=input.code.trim()||family[0]?.[0]||`ITM-${String(existing.length+1).padStart(3,'0')}`;
  if(existing.some(r=>r[0].toLowerCase()===code.toLowerCase()&&r[1].toLowerCase()!==name.toLowerCase()))throw Error('This item code belongs to another item.');
  if(family.some(r=>r[0]!==code||r[3]!==unit))throw Error('Use the existing item code and unit when adding subcategories.');
  const seen=new Set(family.map(r=>r[2].toLowerCase()));
  const additions=input.variants.map(v=>{
    const category=v.name.trim()||'-';
    if(seen.has(category.toLowerCase()))throw Error(`Subcategory ${category} already exists for this item.`);
    if(!Number.isFinite(v.openingQty)||v.openingQty<0)throw Error('Opening quantities must be zero or greater.');
    seen.add(category.toLowerCase());
    return [code,family[0]?.[1]||name,category,unit,String(v.openingQty)] as MaterialRow;
  });
  return [...existing,...additions];
}
export function moveMaterialStock(rows:MaterialRow[],name:string,subcategory:string,delta:number):MaterialRow[]{
  if(!Number.isFinite(delta)||delta===0)throw Error('Enter a quantity greater than zero.');
  const found=rows.filter(r=>materialKey(r[1],r[2])===materialKey(name,subcategory));
  if(found.length!==1)throw Error('Select a valid item and subcategory.');
  if(Number(found[0][4])+delta<0)throw Error('Not enough stock in this subcategory.');
  return rows.map(r=>r===found[0]?[r[0],r[1],r[2],r[3],String(Number(r[4])+delta)]:r);
}
