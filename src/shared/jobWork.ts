import type { SalaryPayment, WorkEntry } from './types';
import { addJobProgress, type JobProgress, type ProductionJob } from './productionJobs';

export const projectJobWork = (jobs: ProductionJob[]): WorkEntry[] => jobs.flatMap(job => job.progress
  .filter(entry => entry.salary && !entry.voided)
  .map(entry => ({
    id: `job:${job.id}:${entry.id}`, jobId: job.id, progressId: entry.id,
    date: entry.date, employeeId: entry.employeeId, workTypeId: entry.salary!.workTypeId,
    quantity: entry.quantity, rateSnapshot: entry.salary!.rate,
    remarks: `${job.reference} · ${job.party || 'Common Stock'} · ${job.garment} / ${job.size}${entry.remarks ? ` · ${entry.remarks}` : ''}`,
  })));

export function assertUnpaidJobWork(entry: Pick<WorkEntry, 'employeeId' | 'date'>, salaries: SalaryPayment[]) {
  if (salaries.some(salary => salary.employeeId === entry.employeeId && entry.date >= salary.from && entry.date <= salary.to)) {
    throw Error('This work date is included in a recorded salary. Use an adjustment in an unpaid period.');
  }
}

export function saveJobWork(jobs: ProductionJob[], jobId: string, entry: JobProgress, salaries: SalaryPayment[]) {
  if (jobs.find(job => job.id === jobId)?.progress.some(row => row.id === entry.id)) return jobs;
  if (entry.salary) {
    assertUnpaidJobWork(entry, salaries);
    if (!entry.salary.workTypeId || !Number.isFinite(entry.salary.rate) || entry.salary.rate < 0) throw Error('Select a valid salary work type and rate.');
  }
  return addJobProgress(jobs, jobId, entry);
}

export function correctJobWork(jobs: ProductionJob[], work: WorkEntry, replacement: Pick<WorkEntry, 'date' | 'quantity'> | null, reason: string, salaries: SalaryPayment[]) {
  if (!reason.trim()) throw Error('Enter a correction reason.');
  const job = jobs.find(row => row.id === work.jobId);
  const previous = job?.progress.find(row => row.id === work.progressId && !row.voided && row.salary);
  if (!job || !previous) throw Error('Linked job work is unavailable.');
  assertUnpaidJobWork(previous, salaries);
  if (replacement) assertUnpaidJobWork({ employeeId: previous.employeeId, date: replacement.date }, salaries);
  const amended = { ...previous, ...(replacement || {}), voided: !replacement };
  const withoutPrevious = jobs.map(row => row.id === job.id ? { ...row, progress: row.progress.filter(entry => entry.id !== previous.id) } : row);
  const checked = replacement ? addJobProgress(withoutPrevious, job.id, amended) : withoutPrevious.map(row => row.id === job.id ? { ...row, progress: [...row.progress, amended] } : row);
  return checked.map(row => row.id === job.id ? { ...row, audit: [...(row.audit || []), { progressId: previous.id, previous, reason: reason.trim(), at: new Date().toISOString() }] } : row);
}
