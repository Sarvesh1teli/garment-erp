export function expenseDisplayNumbers(expenses:readonly (readonly string[])[]){
  const result=new Map<string,string>();
  const used=new Set<number>();
  const sorted=expenses.slice().sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
  for(const row of sorted){
    const match=/^(?:EXP|PEX)-(\d{1,6})$/.exec(row[9]||row[0]);
    const number=match?Number(match[1]):0;
    if(number>0&&!used.has(number)){used.add(number);result.set(row[0],String(number).padStart(6,'0'));}
  }
  let next=1;
  for(const row of sorted)if(!result.has(row[0])){while(used.has(next))next++;used.add(next);result.set(row[0],String(next++).padStart(6,'0'));}
  return result;
}
