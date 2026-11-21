import { qualitySummary, validateJobInspections, type JobReadyTransfer, type ProductionJob } from './productionJobs';
import type { CustomerStock, SchoolStock } from './types';

export const isJobReadyStock = (id: string) => id.startsWith('job-stock:');

export function jobReadyBalance(job: ProductionJob, date?: string) {
  const passed = qualitySummary(job, date).passed;
  const transferred = (job.readyTransfers || []).reduce((sum, entry) => sum + entry.quantity, 0);
  return { passed, transferred, available: Math.max(0, passed - transferred) };
}

export function addJobReadyTransfer(jobs: ProductionJob[], jobId: string, draft: Pick<JobReadyTransfer, 'id' | 'date' | 'quantity' | 'remarks' | 'createdAt'>) {
  const job = jobs.find(row => row.id === jobId);
  if (!job) throw Error('Job card is no longer available.');
  if (job.readyTransfers?.some(entry => entry.id === draft.id)) return jobs;
  if (!job.qualityCheck) throw Error('Enable Quality Check and record passed garments before transferring.');
  validateJobInspections(job);
  if (!draft.date || draft.date < job.date || !Number.isSafeInteger(draft.quantity) || draft.quantity <= 0) throw Error('Select a valid date and positive whole transfer quantity.');
  if ((job.readyTransfers || []).some(entry => entry.date > draft.date)) throw Error('Transfer date must be on or after the latest stock transfer date.');
  if (draft.quantity > jobReadyBalance(job, draft.date).available) throw Error('Transfer quantity exceeds QC-passed garments available on this date.');
  if (job.owner !== 'common' && !job.party.trim()) throw Error('The job needs a school or customer before stock can be transferred.');
  const transfer: JobReadyTransfer = { ...draft, colour:job.colour?.trim()||undefined, remarks: draft.remarks.trim(), owner: job.owner, party: job.party, garment: job.garment, gender: job.gender, size: job.size };
  return jobs.map(row => row.id === job.id ? { ...row, readyTransfers: [...(row.readyTransfers || []), transfer] } : row);
}

export function projectJobReadyStock(jobs: ProductionJob[]) {
  const school: SchoolStock[] = [], customer: CustomerStock[] = [];
  for (const job of jobs) {
    for (const transfer of job.readyTransfers || []) {
      const receipt = { id: `job-stock:${job.id}:${transfer.id}`, date: transfer.date, colour:transfer.colour, gender: transfer.gender, garment: transfer.garment, size: transfer.size, count: transfer.quantity, remarks: `${job.reference} · QC-approved stock${transfer.remarks ? ` · ${transfer.remarks}` : ''}` };
      if (transfer.owner === 'customer') customer.push({ ...receipt, customer: transfer.party });
      else school.push({ ...receipt, school: transfer.owner === 'common' ? '' : transfer.party, className: 'General' });
    }
  }
  return { school, customer };
}

// Allocations are kept in the existing stock record. The job remains the receipt's
// source, so saving a transfer never requires two separate stock/job writes.
export function mergeJobSchoolStock(stored: SchoolStock[], projected: SchoolStock[]) {
  const projectedIds = new Set(projected.map(row => row.id));
  return [...projected.map(receipt => {
    const allocations = stored.find(row => row.id === receipt.id)?.commonAllocations;
    return allocations?.length ? { ...receipt, commonAllocations: allocations, count: receipt.count - allocations.reduce((sum, row) => sum + row.count, 0) } : receipt;
  }), ...stored.filter(row => !projectedIds.has(row.id))];
}

export function mergeJobCustomerStock(stored: CustomerStock[], projected: CustomerStock[]) {
  const projectedIds = new Set(projected.map(row => row.id));
  return [...projected, ...stored.filter(row => !projectedIds.has(row.id))];
}

function assertReceiptUnchanged<T extends SchoolStock | CustomerStock>(current: T, next: T | undefined) {
  if (!next) throw Error('Job stock transfers cannot be deleted from Inventory.');
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (key !== 'count' && key !== 'commonAllocations' && JSON.stringify(current[key]) !== JSON.stringify(next[key])) throw Error('Job stock details come from the recorded transfer and cannot be edited here.');
  }
}

export function storeJobSchoolStock(stored: SchoolStock[], projected: SchoolStock[], next: SchoolStock[]) {
  for (const current of mergeJobSchoolStock(stored, projected).filter(row => isJobReadyStock(row.id))) {
    const updated = next.find(row => row.id === current.id);
    assertReceiptUnchanged(current, updated);
    const before = current.commonAllocations || [], after = updated!.commonAllocations || [];
    if (after.length < before.length || before.some((row, index) => JSON.stringify(row) !== JSON.stringify(after[index]))) throw Error('Recorded school allocations cannot be removed or changed.');
    if (current.school && after.length) throw Error('Only common stock can be allocated to a school.');
    let allocated = 0;
    for (const [index, allocation] of after.entries()) {
      const destination = next.find(row => row.id === allocation.allocatedStockId);
      if (!Number.isSafeInteger(allocation.count) || allocation.count <= 0 || allocation.date < current.date || !destination || destination.count !== allocation.count || destination.school !== allocation.school || destination.allocationSourceId !== current.id || destination.allocationId !== allocation.id || destination.garment !== current.garment || destination.size !== current.size || destination.gender !== current.gender) throw Error('Job stock allocations must include their matching school stock entry.');
      if (index >= before.length) allocated += allocation.count;
    }
    if (updated!.count !== current.count - allocated || updated!.count < 0) throw Error('Job stock quantity can only change through a school allocation.');
  }
  return next.filter(row => !isJobReadyStock(row.id) || row.commonAllocations?.length);
}

export function storeJobCustomerStock(stored: CustomerStock[], projected: CustomerStock[], next: CustomerStock[]) {
  for (const current of mergeJobCustomerStock(stored, projected).filter(row => isJobReadyStock(row.id))) {
    const updated = next.find(row => row.id === current.id);
    assertReceiptUnchanged(current, updated);
    if (updated!.count !== current.count) throw Error('Job stock quantity comes from the recorded transfer.');
  }
  return next.filter(row => !isJobReadyStock(row.id));
}
