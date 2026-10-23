import type { BulkOrder } from './bulkOrders';
import { validateBulkOrder } from './bulkOrders';
import type { Student } from './types';

export type RequirementLine={id:string;className:string;otherClass:string;gender:string;garment:string;size:string;quantity:number};
export const measurementClasses=['Nursery','LKG','UKG',...Array.from({length:12},(_,index)=>`Class ${index+1}`),'Other'];
export const measurementClassName=(value:string)=>{
  const name=String(value||'').trim(),match=/^(?:class\s*)?([1-9]|1[0-2])$/i.exec(name);
  return match?`Class ${Number(match[1])}`:name;
};
export function createMeasurementRequirements(current:BulkOrder[],school:string,year:string,lines:RequirementLine[],batchId:string):BulkOrder[]{
  if(!school.trim()||!/^\d{4}$/.test(year))throw Error('Select a school and year.');
  if(!lines.length)throw Error('Add at least one garment row.');
  const groups=new Map<string,BulkOrder['lines']>();
  for(const [index,row] of lines.entries()){
    const className=measurementClassName(row.className==='Other'?row.otherClass:row.className);
    if(!measurementClasses.includes(row.className)||!className)throw Error(`Row ${index+1}: select a class. Enter the class name when choosing Other.`);
    if(!['Boys','Girls','Common'].includes(row.gender))throw Error(`Row ${index+1}: select Boys, Girls or Common.`);
    if(!row.garment.trim()||!row.size.trim()||!Number.isSafeInteger(row.quantity)||row.quantity<=0)throw Error(`Row ${index+1}: enter a garment, size and positive whole quantity. Nothing has been saved.`);
    const group=groups.get(className)||[];
    group.push({gender:row.gender,garment:row.garment.trim(),size:row.size.trim(),quantity:row.quantity});groups.set(className,group);
  }
  let sequence=current.reduce((max,order)=>Math.max(max,Number(/^MEAS-(\d+)$/.exec(order.reference)?.[1]||0)),0);
  return Array.from(groups,([className,group],index)=>validateBulkOrder({id:`${batchId}-${index}`,source:'measurement',reference:`MEAS-${String(++sequence).padStart(6,'0')}`,school:school.trim(),year,className,requiredDate:'',mode:'additional',createdAt:new Date().toISOString(),lines:group}));
}

export type RequirementSummary={school:string;year:string;className:string;gender:string;garment:string;size:string;quantity:number};
export type RequirementFilters={school?:string;year?:string;className?:string;section?:string;gender?:string;garment?:string};
export function buildMeasurementRequirementSummary(students:Student[],orders:BulkOrder[],filters:RequirementFilters={}):RequirementSummary[]{
  const result=new Map<string,RequirementSummary>();
  const add=(row:RequirementSummary)=>{
    row={...row,className:measurementClassName(row.className)};
    if((filters.school&&row.school!==filters.school)||(filters.year&&row.year!==filters.year)||(filters.className&&row.className!==measurementClassName(filters.className))||(filters.gender&&row.gender!==filters.gender)||(filters.garment&&row.garment!==filters.garment))return;
    const key=JSON.stringify([row.school,row.year,row.className,row.gender,row.garment,row.size]);
    const existing=result.get(key);if(existing)existing.quantity+=row.quantity;else result.set(key,{...row});
  };
  students.filter(student=>!filters.section||student.section===filters.section).forEach(student=>Object.entries(student.sizes||{}).forEach(([garment,size])=>{if(size)add({school:student.school,year:student.year||'',className:student.className,gender:student.gender,garment,size,quantity:1});}));
  if(!filters.section)orders.filter(order=>order.mode==='additional').forEach(order=>order.lines.forEach(row=>add({school:order.school,year:order.year,className:order.className,...row})));
  return Array.from(result.values()).sort((a,b)=>a.school.localeCompare(b.school)||a.year.localeCompare(b.year)||a.className.localeCompare(b.className,undefined,{numeric:true})||a.gender.localeCompare(b.gender)||a.garment.localeCompare(b.garment)||a.size.localeCompare(b.size,undefined,{numeric:true}));
}
