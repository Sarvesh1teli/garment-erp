import { materialKey, pieceUnit, validateMaterialQuantity, type MaterialRow } from './materialStock';
import type { JobMaterialMovement, ProductionJob } from './productionJobs';

const round = (value: number) => Math.round(value * 1000) / 1000;
const balanceValue = (value: number) => Number(value.toPrecision(15));
export const metreUnit = (unit: string) => /^(m|metre|metres|meter|meters|mtr|mtrs)$/i.test(unit.trim());
export const normalizeMaterials = (rows: string[][]): MaterialRow[] => rows.map(row => row.length === 4 ? [row[0],row[1],'-',row[2],row[3]] : [...row] as MaterialRow);
export const netJobFabric = (job: ProductionJob) => round((job.materialMovements || []).filter(row=>metreUnit(row.unit)).reduce((sum, row) => sum + (row.kind === 'issue' ? row.quantity : -row.quantity), 0));
export const unreturnedFabric = (job: ProductionJob, issue: JobMaterialMovement) => round(issue.quantity - (job.materialMovements || []).filter(row => row.kind === 'return' && row.sourceIssueId === issue.id).reduce((sum,row) => sum + row.quantity, 0));

function materialDeductions(jobs: ProductionJob[]) {
  const totals = new Map<string,number>();
  for (const job of jobs) for (const row of job.materialMovements || []) {
    const key = materialKey(row.item,row.subcategory);
    totals.set(key,round((totals.get(key) || 0) + (row.kind === 'issue' ? row.quantity : -row.quantity)));
  }
  return totals;
}

export function projectJobMaterials(stored: string[][], jobs: ProductionJob[]): MaterialRow[] {
  const deductions = materialDeductions(jobs);
  return normalizeMaterials(stored).map(row => {
    const deduction = deductions.get(materialKey(row[1],row[2])) || 0;
    return deduction ? [row[0],row[1],row[2],row[3],String(balanceValue(Number(row[4]) - deduction))] : row;
  });
}

export function storeJobMaterials(next: string[][], jobs: ProductionJob[]): MaterialRow[] {
  const deductions = materialDeductions(jobs);
  const rows = normalizeMaterials(next);
  for (const key of deductions.keys()) if (!rows.some(row => materialKey(row[1],row[2]) === key)) throw Error('This material has linked job history and cannot be removed.');
  return rows.map(row => {
    const quantity = Number(row[4]);
    if (!Number.isFinite(quantity) || quantity < 0) throw Error('Material stock cannot be negative.');
    const deduction = deductions.get(materialKey(row[1],row[2])) || 0;
    return deduction ? [row[0],row[1],row[2],row[3],String(balanceValue(quantity + deduction))] : row;
  });
}

export type JobMaterialDraft = Pick<JobMaterialMovement,'id'|'kind'|'sourceIssueId'|'date'|'createdAt'|'quantity'|'remarks'> & { item: string; subcategory: string };

export function addJobMaterialMovement(jobs: ProductionJob[], stored: string[][], jobId: string, draft: JobMaterialDraft) {
  const job = jobs.find(row => row.id === jobId);
  if (!job) throw Error('Job card is no longer available.');
  if (job.materialMovements?.some(row => row.id === draft.id)) return jobs;
  if (!draft.date || draft.date < job.date || (job.materialMovements || []).some(row => row.date > draft.date)) throw Error('Select a date on or after the job date and latest material movement.');
  if (!Number.isFinite(draft.quantity) || draft.quantity <= 0 || round(draft.quantity) !== draft.quantity) throw Error('Enter a quantity greater than zero, with up to three decimal places.');
  if (draft.kind !== 'issue' && draft.kind !== 'return') throw Error('Select a valid material movement.');
  const source = job.materialMovements?.find(row => row.id === draft.sourceIssueId && row.kind === 'issue');
  const item = draft.kind === 'return' ? source?.item : draft.item;
  const subcategory = draft.kind === 'return' ? source?.subcategory : draft.subcategory;
  const material = projectJobMaterials(stored,jobs).filter(row => materialKey(row[1],row[2]) === materialKey(item || '',subcategory || ''));
  if (material.length !== 1 || !(metreUnit(material[0][3])||pieceUnit(material[0][3]))) throw Error('Select a material measured in metres or pieces.');
  validateMaterialQuantity(draft.quantity,material[0][3]);
  if(metreUnit(material[0][3])&&(!job.stageTracking||!job.operations.some(row=>row.stage==='cutting')))throw Error('Enable Cutting stage tracking before issuing fabric.');
  if (draft.kind === 'issue' && draft.quantity > Number(material[0][4])) throw Error('Not enough available material in this material subcategory.');
  if (draft.kind === 'return' && (!source || draft.quantity > unreturnedFabric(job,source))) throw Error('Return cannot exceed the unreturned quantity from the selected issue.');
  const [code,name,category,unit] = material[0];
  const entry: JobMaterialMovement = { ...draft, code, item:name, subcategory:category, unit, remarks:draft.remarks.trim(), sourceIssueId:draft.kind === 'return' ? source!.id : undefined };
  return jobs.map(row => row.id === job.id ? { ...row, materialMovements:[...(row.materialMovements || []),entry] } : row);
}

export function projectJobMaterialHistory(jobs: ProductionJob[], kind: 'issue' | 'return'): string[][] {
  return jobs.flatMap(job => (job.materialMovements || []).map((entry,index) => ({entry,index,job}))).filter(row => row.entry.kind === kind).sort((a,b) => b.entry.date.localeCompare(a.entry.date) || b.entry.createdAt.localeCompare(a.entry.createdAt)).map(({entry,index,job}) => {
    const id = `${kind === 'issue' ? 'JOUT' : 'JIN'}-${job.reference}-${String(index+1).padStart(3,'0')}`;
    return kind === 'issue' ? [id,entry.date,entry.item,entry.subcategory,String(entry.quantity),`${job.reference} · ${job.party || 'Common Stock'}${entry.remarks ? ` · ${entry.remarks}` : ''}`,metreUnit(entry.unit)?'Cutting':'Materials'] : [id,entry.date,entry.item,entry.subcategory,String(entry.quantity),`Return from ${job.reference}`,entry.remarks || 'Unused material returned'];
  });
}

export function storeJobMaterialHistory(next: string[][], projected: string[][]) {
  for (const receipt of projected) {
    const row = next.find(entry => entry[0] === receipt[0]);
    if (!row || JSON.stringify(row) !== JSON.stringify(receipt)) throw Error('Linked material history is managed from the Job Card.');
  }
  return next.filter(row => !/^J(?:OUT|IN)-/.test(row[0]));
}
