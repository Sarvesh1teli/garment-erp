import type { BomSnapshot } from './bom';
import { validateFabricEstimate, type FabricEstimate } from './fabricConsumption';

export type ProductionStage = 'cutting' | 'stitching' | 'finishing';

export type JobOperation = {
  stage?: ProductionStage;
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

export type JobInspection = {
  id: string;
  date: string;
  createdAt: string;
  employeeId: string;
  employeeName: string;
  kind: 'initial' | 'reinspection';
  inspected: number;
  passed: number;
  rework: number;
  rejected: number;
  remarks: string;
};

export type JobReadyTransfer = {
  colour?: string;
  id: string;
  date: string;
  createdAt: string;
  quantity: number;
  remarks: string;
  owner: 'school' | 'customer' | 'common';
  party: string;
  garment: string;
  gender: string;
  size: string;
};

export type JobMaterialMovement = {
  id: string;
  kind: 'issue' | 'return';
  sourceIssueId?: string;
  date: string;
  createdAt: string;
  code: string;
  item: string;
  subcategory: string;
  unit: string;
  quantity: number;
  remarks: string;
};

export type ProductionJob = {
  bom?: BomSnapshot;
  colour?: string;
  sourceOrderId?: string;
  sourceOrderLineId?: string;
  schoolOrderLineId?: string;
  fabric?: FabricEstimate;
  fabricIssuedMetres?: number;
  fabricChanges?: { at: string; estimate?: FabricEstimate; issuedMetres?: number }[];
  stageTracking?: boolean;
  qualityCheck?: boolean;
  inspections?: JobInspection[];
  readyTransfers?: JobReadyTransfer[];
  materialMovements?: JobMaterialMovement[];
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

export function stageSummary(job: ProductionJob, stage: ProductionStage) {
  const operations = job.operations.filter(operation => (operation.stage || 'stitching') === stage);
  const completed = operations.length ? Math.min(...operations.map(operation =>
    Math.min(job.quantity, Math.floor(operationCompleted(job, operation.id) * job.quantity / operation.target)))) : 0;
  const started = operations.some(operation => operationCompleted(job, operation.id) > 0);
  return { completed, remaining: job.quantity - completed, status: completed >= job.quantity ? 'Completed' : started ? 'In Progress' : 'Pending' };
}

function upstreamOperationLimit(job: ProductionJob, operation: JobOperation) {
  const stage = operation.stage || 'stitching';
  if (!job.stageTracking || stage === 'cutting') return operation.target;
  const cut = stageSummary(job, 'cutting').completed;
  const garments = stage === 'finishing' ? Math.min(cut, stageSummary(job, 'stitching').completed) : cut;
  return Math.floor(garments * operation.target / job.quantity);
}

export function operationAvailable(job: ProductionJob, operationId: string, date?: string) {
  const operation = job.operations.find(row => row.id === operationId);
  if (!operation) return 0;
  const remaining = operation.target - operationCompleted(job, operationId);
  if (!job.stageTracking || operation.stage === 'cutting') return Math.max(0, remaining);
  const dates = date ? Array.from(new Set([date, ...job.progress.filter(row => !row.voided && row.date >= date).map(row => row.date)])) : [''];
  const limits = dates.map(checkpoint => {
    const dated = checkpoint ? { ...job, progress: job.progress.filter(row => row.date <= checkpoint) } : job;
    return upstreamOperationLimit(dated, operation) - operationCompleted(dated, operationId);
  });
  return Math.max(0, Math.min(remaining, ...limits));
}

export function stageProgressProblems(job: ProductionJob) {
  if (!job.stageTracking) return [];
  const dates = Array.from(new Set(job.progress.filter(row => !row.voided).map(row => row.date))).sort();
  return job.operations.flatMap(operation => {
    for (const date of dates) {
      const dated = { ...job, progress: job.progress.filter(row => row.date <= date) };
      const completed = operationCompleted(dated, operation.id), limit = upstreamOperationLimit(dated, operation);
      if (completed > limit) return [{ operation: operation.name, date, completed, limit }];
    }
    return [];
  });
}

export function validateStageProgressChange(before: ProductionJob, after: ProductionJob) {
  if (!after.stageTracking) return after;
  const dates = Array.from(new Set([...before.progress, ...after.progress].filter(row => !row.voided).map(row => row.date)));
  for (const date of dates) {
    const old = { ...before, progress: before.progress.filter(row => row.date <= date) };
    const next = { ...after, progress: after.progress.filter(row => row.date <= date) };
    for (const operation of after.operations) {
      const excess = Math.max(0, operationCompleted(next, operation.id) - upstreamOperationLimit(next, operation));
      const oldExcess = Math.max(0, operationCompleted(old, operation.id) - upstreamOperationLimit(old, operation));
      if (excess > oldExcess) {
        const upstream = operation.stage === 'finishing' ? 'fully stitched garments' : 'cut garments';
        throw Error(`${operation.name} exceeds available ${upstream} on ${date}. Record earlier-stage progress first, or correct the dependent progress.`);
      }
    }
  }
  return after;
}

export function jobStatus(job: ProductionJob) {
  const quality = job.qualityCheck ? qualitySummary(job) : null;
  const qualityResolved = !quality || (quality.initialInspected === job.quantity && quality.rework === 0);
  if (qualityResolved && job.operations.every(operation => operationCompleted(job, operation.id) >= operation.target)) return 'Completed';
  return job.progress.some(entry => !entry.voided) ? 'In Progress' : 'Pending';
}

export function validateProductionJob(job: ProductionJob) {
  if (job.fabric) validateFabricEstimate(job.fabric);
  if (job.fabricIssuedMetres !== undefined && (!Number.isFinite(job.fabricIssuedMetres) || job.fabricIssuedMetres < 0)) throw Error('Actual fabric issued must be zero or greater.');
  if (!job.date || !job.garment.trim() || !job.size.trim() || !Number.isSafeInteger(job.quantity) || job.quantity <= 0) {
    throw Error('Enter a date, garment, size and positive whole garment quantity.');
  }
  if (job.owner !== 'common' && !job.party.trim()) throw Error('Select a school or customer.');
  if (job.requiredDate && job.requiredDate < job.date) throw Error('Required date cannot be before the job date.');
  if (!job.operations.length || job.operations.some(operation => !operation.name.trim() || !Number.isSafeInteger(operation.target) || operation.target <= 0)) {
    throw Error('Add operations with a name and positive whole target quantity.');
  }
  if (job.stageTracking) {
    const cutting = job.operations.filter(operation => operation.stage === 'cutting');
    if (cutting.length !== 1 || cutting[0].target !== job.quantity) throw Error('Cutting target must match the job garment quantity.');
    if (!job.operations.some(operation => (operation.stage || 'stitching') === 'stitching')) throw Error('Add at least one stitching operation.');
    if (job.operations.some(operation => operation.stage === 'finishing' && operation.target !== job.quantity)) throw Error('Finishing targets must match the job garment quantity.');
  }
  if (job.qualityCheck && (!job.stageTracking || !job.operations.some(operation => operation.stage === 'finishing'))) throw Error('Enable Finishing before adding Quality Check.');
  if (new Set(job.operations.map(operation => operation.name.trim().toLowerCase())).size !== job.operations.length) throw Error('Use a different name for each operation.');
  if (new Set(job.operations.map(operation => operation.id)).size !== job.operations.length) throw Error('Operation identifiers must be unique.');
  return job;
}

export function qualitySummary(job: ProductionJob, throughDate?: string) {
  const datedJob = throughDate ? { ...job, progress: job.progress.filter(entry => entry.date <= throughDate) } : job;
  const stages = Array.from(new Set(job.operations.map(operation => operation.stage || 'stitching')));
  const eligible = stages.length ? Math.min(...stages.map(stage => stageSummary(datedJob, stage).completed)) : 0;
  const inspections = (job.inspections || []).filter(entry => !throughDate || entry.date <= throughDate);
  const initialInspected = inspections.filter(entry => entry.kind === 'initial').reduce((sum, entry) => sum + entry.inspected, 0);
  const passed = inspections.reduce((sum, entry) => sum + entry.passed, 0);
  const rejected = inspections.reduce((sum, entry) => sum + entry.rejected, 0);
  const rework = inspections.reduce((sum, entry) => sum + entry.rework - (entry.kind === 'reinspection' ? entry.inspected : 0), 0);
  return { eligible, initialInspected, passed, rejected, rework, available: Math.max(0, eligible - initialInspected), uninspected: job.quantity - initialInspected };
}

function validateInspection(job: ProductionJob, entry: JobInspection) {
  if (!job.qualityCheck) throw Error('Enable Quality Check for this job first.');
  if (!entry.employeeId || !entry.date || entry.date < job.date || (entry.kind !== 'initial' && entry.kind !== 'reinspection')) throw Error('Select an inspector, valid inspection type and date on or after the job date.');
  if (![entry.inspected, entry.passed, entry.rework, entry.rejected].every(value => Number.isSafeInteger(value) && value >= 0) || entry.inspected <= 0) throw Error('Enter positive whole inspected quantity and non-negative whole result quantities.');
  if (entry.passed + entry.rework + entry.rejected !== entry.inspected) throw Error('Passed, rework and rejected quantities must add up to the inspected quantity.');
  const previous = job.inspections || [];
  if (previous.some(row => row.date > entry.date)) throw Error('Inspection date must be on or after the latest inspection date.');
  const balance = qualitySummary(job, entry.date);
  if (entry.kind === 'initial' && entry.inspected > balance.available) throw Error('Inspected quantity exceeds completed garments awaiting first inspection on this date.');
  if (entry.kind === 'reinspection' && entry.inspected > balance.rework) throw Error('Reinspection quantity exceeds garments awaiting rework inspection.');
}

export function validateJobInspections(job: ProductionJob) {
  let checked: ProductionJob = { ...job, inspections: [] };
  for (const entry of job.inspections || []) {
    validateInspection(checked, entry);
    checked = { ...checked, inspections: [...checked.inspections!, entry] };
  }
  return job;
}

export function addJobInspection(jobs: ProductionJob[], jobId: string, entry: JobInspection) {
  const job = jobs.find(row => row.id === jobId);
  if (!job) throw Error('Job card is no longer available.');
  if (job.inspections?.some(row => row.id === entry.id)) return jobs;
  validateProductionJob(job);
  validateInspection(job, entry);
  return jobs.map(row => row.id === job.id ? { ...row, inspections: [...(row.inspections || []), entry] } : row);
}

export function addJobProgress(jobs: ProductionJob[], jobId: string, entry: JobProgress, stageBaseline?: ProductionJob) {
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
  const amended = validateStageProgressChange(stageBaseline || job, { ...job, progress: [...job.progress, entry] });
  return jobs.map(row => row.id === job.id ? amended : row);
}
