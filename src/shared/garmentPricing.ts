import type { GarmentPrice } from './types';
export function findGarmentPrice(prices:GarmentPrice[],garment:string,size:string,gender='Common'){
 const matching=prices.filter(row=>row.status!=='Inactive'&&row.garmentType===garment&&row.size===size);
 return matching.find(row=>(row.gender||'Common')===gender)||matching.find(row=>!row.gender||row.gender==='Common');
}
