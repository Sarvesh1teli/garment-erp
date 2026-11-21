import { qualitySummary, stageSummary, validateProductionJob, type ProductionJob } from './productionJobs';

export type ProductionLine = { id: string; garment: string; gender: string; size: string; colour?: string; quantity: number; done: number };
export type ProductionOrder = { id: string; reference: string; date: string; requiredDate?: string; customer: string; remarks: string; lines: ProductionLine[] };
export const orderLineKey = (line: ProductionLine, index: number) => line.id || `legacy-line-${index}`;

export function lineOrderJobs(order: ProductionOrder, lineId: string, jobs: ProductionJob[]) {
  return jobs.filter(job => job.sourceOrderId === order.id && job.sourceOrderLineId === lineId);
}

export function lineOrderBalance(order: ProductionOrder, index: number, jobs: ProductionJob[]) {
  const line = order.lines[index], linked = lineOrderJobs(order,orderLineKey(line,index),jobs);
  const assigned = linked.reduce((sum,job) => sum + job.quantity,0);
  const completed = linked.reduce((sum,job) => {
    if (job.qualityCheck) return sum + qualitySummary(job).passed;
    const stages = Array.from(new Set(job.operations.map(operation => operation.stage || 'stitching')));
    return sum + (stages.length ? Math.min(...stages.map(stage => stageSummary(job,stage).completed)) : 0);
  },0);
  return { assigned, completed:Math.min(line.quantity,(line.done || 0)+completed), available:Math.max(0,line.quantity-(line.done || 0)-assigned) };
}

export function orderJobDraft(order: ProductionOrder, index: number, jobs: ProductionJob[], blank: ProductionJob) {
  const line = order.lines[index];
  if (!line) throw Error('Order line is unavailable.');
  const available = lineOrderBalance(order,index,jobs).available;
  if (!available) throw Error('This order line is already assigned or completed.');
  return { ...blank, sourceOrderId:order.id, sourceOrderLineId:orderLineKey(line,index), orderReference:order.reference, date:order.date,
    requiredDate:order.requiredDate || '', owner:order.customer === 'General Stock' || !order.customer ? 'common' as const : 'customer' as const,
    party:order.customer === 'General Stock' ? '' : order.customer, garment:line.garment, gender:line.gender, size:line.size, colour:line.colour || '', quantity:available,
    operations:blank.operations.map(operation => ({ ...operation,target:available })),
  };
}

export function appendProductionJob(jobs: ProductionJob[], orders: ProductionOrder[], draft: ProductionJob) {
  if (jobs.some(job => job.id === draft.id)) return jobs;
  validateProductionJob(draft);
  if (draft.sourceOrderId) {
    const order = orders.find(row => row.id === draft.sourceOrderId);
    const index = order?.lines.findIndex((line,index) => orderLineKey(line,index) === draft.sourceOrderLineId) ?? -1;
    if (!order || index < 0) throw Error('The source order line is unavailable.');
    const line = order.lines[index];
    if (draft.quantity > lineOrderBalance(order,index,jobs).available) throw Error('Job quantity exceeds the unassigned order quantity.');
    const owner = order.customer === 'General Stock' || !order.customer ? 'common' : 'customer';
    if (draft.owner !== owner || draft.party !== (owner === 'common' ? '' : order.customer) || draft.garment !== line.garment || draft.gender !== line.gender || draft.size !== line.size || (draft.colour || '').trim() !== (line.colour || '').trim()) throw Error('Customer, garment, size, gender and colour must match the source order line.');
  }
  const number = jobs.reduce((max,job) => Math.max(max,Number(/^JOB-(\d+)$/.exec(job.reference)?.[1] || 0)),0)+1;
  const saved = { ...draft, reference:`JOB-${String(number).padStart(6,'0')}`, garment:draft.garment.trim(), size:draft.size.trim(), colour:draft.colour?.trim() || undefined, orderReference:draft.orderReference.trim(), operations:draft.operations.map(operation => ({ ...operation,name:operation.name.trim() })) };
  return [saved,...jobs];
}
