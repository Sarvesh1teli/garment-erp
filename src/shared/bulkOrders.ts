export type BulkOrderLine={gender:string;garment:string;size:string;quantity:number};
export type BulkOrder={id:string;sourceOrderId?:string;source?:'measurement';reference:string;school:string;year:string;className:string;requiredDate:string;mode:'additional'|'measured';createdAt:string;lines:BulkOrderLine[]};
export function validateBulkOrder(order:BulkOrder){
  if(!order.school.trim()||!order.reference.trim()||!/^\d{4}(?:-\d{2})?$/.test(order.year))throw new Error('Select a school, enter an order reference and valid year.');
  if(!order.lines.length||order.lines.some(r=>!r.gender||!r.garment.trim()||!r.size.trim()||!Number.isSafeInteger(r.quantity)||r.quantity<=0))throw new Error('Every row needs gender, garment, size and a positive whole quantity.');
  return order;
}
export function addBulkOrder(current:BulkOrder[],order:BulkOrder){
  validateBulkOrder(order);
  if(current.some(r=>r.id===order.id||(order.sourceOrderId&&r.sourceOrderId===order.sourceOrderId)))throw new Error('This order has already been added to production.');
  if(current.some(r=>r.school===order.school&&r.reference.trim().toLowerCase()===order.reference.trim().toLowerCase()))throw new Error('This school already has that order reference.');
  return [order,...current];
}
