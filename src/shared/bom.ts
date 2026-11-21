import { materialKey, materialUnit, pieceUnit } from './materialStock';
import type { ProductionJob } from './productionJobs';

export type BomLine={item:string;subcategory:string;unit:string;perGarment:number};
export type BomTemplate={id:string;name:string;garment:string;gender:string;size:string;active:boolean;lines:BomLine[]};
export type BomSnapshot={templateId:string;name:string;lines:BomLine[]};
export function bomMatches(template:BomTemplate,job:Pick<ProductionJob,'garment'|'gender'|'size'>){
  return template.active&&template.garment===job.garment&&(template.gender==='All'||template.gender===job.gender)&&(!template.size||template.size===job.size);
}
export function snapshotBom(template:BomTemplate,job:Pick<ProductionJob,'garment'|'gender'|'size'>,materials:string[][]):BomSnapshot{
  if(!bomMatches(template,job))throw Error('Select an active material template matching this garment, gender and size.');
  if(!template.name.trim()||!template.lines.length)throw Error('Enter a template name and materials.');
  const seen=new Set<string>();
  for(const line of template.lines){
    const key=materialKey(line.item,line.subcategory);
    const matches=materials.filter(row=>materialKey(row[1],row[2])===key);
    if(matches.length!==1||materialUnit(matches[0][3])!==materialUnit(line.unit))throw Error('A template material or unit has changed. Update the template.');
    if(seen.has(key))throw Error('Use each material subcategory once.');
    seen.add(key);
    if(!Number.isFinite(line.perGarment)||line.perGarment<=0||Math.abs(line.perGarment*1000-Math.round(line.perGarment*1000))>0.000001)throw Error('Enter positive consumption with up to three decimals.');
    if(pieceUnit(line.unit)&&!Number.isSafeInteger(line.perGarment))throw Error('Pieces per garment must be a whole number.');
    if(!pieceUnit(line.unit)&&materialUnit(line.unit)!=='Meter')throw Error('Use materials measured in metres or pieces.');
  }
  return {templateId:template.id,name:template.name,lines:template.lines.map(line=>({...line}))};
}
export function bomRequirements(job:ProductionJob,materials:string[][]){
  return (job.bom?.lines||[]).map(line=>{
    const stock=materials.find(row=>materialKey(row[1],row[2])===materialKey(line.item,line.subcategory)&&materialUnit(row[3])===materialUnit(line.unit));
    const required=Math.round(line.perGarment*job.quantity*1000)/1000;
    const movements=(job.materialMovements||[]).filter(row=>materialKey(row.item,row.subcategory)===materialKey(line.item,line.subcategory));
    const issued=movements.filter(row=>row.kind==='issue').reduce((sum,row)=>sum+row.quantity,0);
    const returned=movements.filter(row=>row.kind==='return').reduce((sum,row)=>sum+row.quantity,0);
    const remaining=Math.max(0,Math.round((required-issued+returned)*1000)/1000);
    const available=Number(stock?.[4]||0);
    return {...line,required,issued,returned,remaining,available,shortage:Math.max(0,Math.round((remaining-available)*1000)/1000)};
  });
}
