import type { SchoolStock } from './types';

export const COMMON_STOCK = '__common_stock__';
export const isCommonStock = (stock:SchoolStock) => !stock.school;
export type ReadyStockDraft = {gender:string;garment:string;size:string;count:number};
export function createReadyStockBatch(drafts:ReadyStockDraft[],date:string,school:string,className:string,remarks:string,id:string):SchoolStock[] {
  if(!date || !school || !drafts.length)throw new Error('Select a date and school or Common Stock, and add at least one garment.');
  drafts.forEach((row,index)=>{
    if(!row.garment.trim() || !row.size.trim() || !row.gender || !Number.isSafeInteger(row.count) || row.count<=0)
      throw new Error(`Row ${index+1}: select garment, gender and size, and enter a positive whole quantity.`);
  });
  return drafts.map((row,index)=>({id:`${id}-${index}`,date,school:school===COMMON_STOCK?'':school,className:school===COMMON_STOCK?'General':className.trim()||'General',gender:row.gender,garment:row.garment.trim(),size:row.size.trim(),count:row.count,remarks:remarks.trim()||'-'}));
}
export function allocateCommonStock(stock:SchoolStock[],requests:{sourceId:string;count:number}[],target:{school:string;date:string;className:string;remarks:string},id:string):SchoolStock[] {
  if(!target.school.trim() || target.school===COMMON_STOCK || !target.date || !requests.length)throw new Error('Select a school, date and stock to allocate.');
  const seen=new Set<string>();
  requests.forEach(request=>{
    const source=stock.find(row=>row.id===request.sourceId);
    if(seen.has(request.sourceId))throw new Error('The same stock row cannot be allocated twice.');
    seen.add(request.sourceId);
    if(!source || !isCommonStock(source))throw new Error('Only available common stock can be allocated.');
    if(!Number.isSafeInteger(request.count) || request.count<=0 || request.count>source.count)throw new Error(`Enter a whole quantity between 1 and ${source.count} for ${source.garment} (${source.size}).`);
  });
  const destinations:SchoolStock[]=[];
  const updated=stock.map(source=>{
    const index=requests.findIndex(request=>request.sourceId===source.id);
    if(index<0)return source;
    const count=requests[index].count;
    const allocationId=`${id}-${index}`;
    const destinationId=`RST-${allocationId}`;
    const allocation={id:allocationId,date:target.date,school:target.school.trim(),className:target.className.trim()||'General',count,garment:source.garment,gender:source.gender,size:source.size,remarks:target.remarks.trim()||'-',allocatedStockId:destinationId};
    destinations.push({id:destinationId,date:target.date,school:allocation.school,className:allocation.className,gender:source.gender,garment:source.garment,size:source.size,count,remarks:`Allocated from Common Stock (${source.id})${target.remarks.trim()?`: ${target.remarks.trim()}`:''}`,allocationSourceId:source.id,allocationId});
    return {...source,count:source.count-count,commonAllocations:[...(source.commonAllocations||[]),allocation]};
  });
  return [...destinations,...updated];
}
