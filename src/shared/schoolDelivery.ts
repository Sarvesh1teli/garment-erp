import type { ReadyBalance } from './commerce';
import type { ProductDetails } from './types';
export type SchoolDeliveryItem = ProductDetails & { garment:string; size:string; gender:string; colour?:string; quantity:number; rate:number; ordered?:number; delivered?:number; orderPending?:number };
export type SchoolRequirement = { garment:string; size:string; gender:string; required:number; delivered:number; pendingDel:number };
export const schoolOrderKey=(row:{garment:string;size:string;gender:string})=>JSON.stringify([row.garment,row.size,row.gender]);
export function schoolDeliveryItems(requirements:SchoolRequirement[], balances:ReadyBalance[], school:string, price:(garment:string,size:string,gender:string)=>number):SchoolDeliveryItem[]{
  const groups=new Map<string,SchoolRequirement>();
  for(const row of requirements){const key=schoolOrderKey(row),old=groups.get(key);groups.set(key,{...row,required:(old?.required||0)+row.required,delivered:(old?.delivered||0)+row.delivered,pendingDel:(old?.pendingDel||0)+row.pendingDel});}
  const result:SchoolDeliveryItem[]=[];
  for(const requirement of groups.values()){
    let remaining=requirement.pendingDel;
    for(const stock of balances.filter(row=>row.owner==='school'&&row.party===school&&row.available>0&&schoolOrderKey(row)===schoolOrderKey(requirement))){
      const quantity=Math.min(stock.available,Math.max(0,remaining));remaining-=quantity;
      result.push({garment:stock.garment,size:stock.size,gender:stock.gender,colour:stock.colour,productId:stock.productId,productName:stock.productName,brand:stock.brand,quantity,rate:price(stock.garment,stock.size,stock.gender),ordered:requirement.required,delivered:requirement.delivered,orderPending:requirement.pendingDel});
    }
  }
  return result;
}
