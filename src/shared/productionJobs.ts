export type JobOperation = {
  id: string;
  workTypeId: string;
  name: string;
  target: number;
  employeeId: string;
};

export type JobProgress = {
  id: string;
  operationId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  quantity: number;
  remarks: string;
  createdAt: string;
  salary?: { workTypeId: string; name: string; rate: number; code?: string; unit: string };
  voided?: boolean;
};

export type ProductionJob = {
  id: string;
  reference: string;
  date: string;
  requiredDate: string;
  owner: 'school' | 'customer' | 'common';
  party: string;
  orderReference: string;
  garment: string;
  gender: string;
  size: string;
  quantity: number;
  operations: JobOperation[];
  progress: JobProgress[];
  audit?: { progressId: string; previous: JobProgress; reason: string; at: string }[];
};

export const operationCompleted = (job: ProductionJob, operationId: string) =>
  job.progress.filter(entry => !entry.voided && entry.operationId === operationId).reduce((sum, entry) => sum + entry.quantity, 0);

export function jobStatus(job: ProductionJob) {
  if (job.operations.every(operation => operationCompleted(job, operation.id) >= operation.target)) return 'Completed';
  return job.progress.some(entry => !entry.voided) ? 'In Progress' : 'Pending';
}

export function validateProductionJob(job: ProductionJob) {
  if (!job.date || !job.garment.trim() || !job.size.trim() || !Number.isSafeInteger(job.quantity) || job.quantity <= 0) {
    throw Error('Enter a date, garment, size and positive whole garment quantity.');
  }
  if (job.owner !== 'common' && !job.party.trim()) throw Error('Select a school or customer.');
  if (job.requiredDate && job.requiredDate < job.date) throw Error('Required date cannot be before the job date.');
  if (!job.operations.length || job.operations.some(operation => !operation.name.trim() || !Number.isSafeInteger(operation.target) || operation.target <= 0)) {
    throw Error('Add operations with a name and positive whole target quantity.');
  }
  if (new Set(job.operations.map(operation => operation.name.trim().toLowerCase())).size !== job.operations.length) throw Error('Use a different name for each operation.');
  if (new Set(job.operations.map(operation => operation.id)).size !== job.operations.length) throw Error('Operation identifiers must be unique.');
  return job;
}

export function addJobProgress(jobs: ProductionJob[], jobId: string, entry: JobProgress) {
  const job = jobs.find(row => row.id === jobId);
  if (!job) throw Error('Job card is no longer available.');
  if (job.progress.some(row => row.id === entry.id)) return jobs;
  const operation = job.operations.find(row => row.id === entry.operationId);
  if (!operation) throw Error('Select an operation from this job.');
  if (!entry.employeeId || !entry.date || entry.date < job.date || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
    throw Error('Select an employee, date on or after the job date, and a positive whole quantity.');
  }
  if (operationCompleted(job, operation.id) + entry.quantity > operation.target) {
    throw Error('Completed quantity cannot exceed this operation’s remaining target.');
  }
  return jobs.map(row => row.id === job.id ? { ...row, progress: [...row.progress, entry] } : row);
}
