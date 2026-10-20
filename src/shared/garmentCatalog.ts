export type GarmentType={name:string;gender:'All'|'Boys'|'Girls';active:boolean};
export const garmentIdentity=(name:string)=>name.trim().replace(/\s+/g,' ').toLowerCase();
export const defaultGarmentNames=['Shirt','Half Pant','Full Pant','Pant','Blouse','Skirt','Track Suit','Track Pant','Jacket','Suit Pant'];
export const garmentNamesForGender=(records:GarmentType[],gender:string)=>records.filter(row=>row.active&&(!gender||row.gender==='All'||row.gender===gender)).map(row=>row.name);
export function mergeGarmentTypes(current:GarmentType[],names:string[]):GarmentType[]{
  const seen=new Set(current.map(row=>garmentIdentity(row.name))),added:GarmentType[]=[];
  for(const raw of names){const name=String(raw||'').trim().replace(/\s+/g,' '),key=garmentIdentity(name);if(!key||seen.has(key))continue;seen.add(key);added.push({name,gender:'All',active:true});}
  return added.length?[...current,...added]:current;
}
export function collectGarmentNames(value:unknown):string[]{
  if(Array.isArray(value))return value.flatMap(collectGarmentNames);
  if(!value||typeof value!=='object')return [];
  const row=value as Record<string,unknown>;
  return [...(['garment','garmentType'].flatMap(key=>typeof row[key]==='string'&&!(key==='garment'&&Array.isArray(row.items)&&row.items.length)?[row[key] as string]:[])),...(row.sizes&&typeof row.sizes==='object'?Object.keys(row.sizes):[]),...Object.values(row).filter(v=>v&&typeof v==='object').flatMap(collectGarmentNames)];
}
