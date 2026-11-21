import { purchaseItems, type MaterialPurchase } from './materialPurchases';
import { normalizeMaterials } from './jobMaterials';
import { appendProductionJob, type ProductionOrder } from './customerProductionOrders';
import { addJobMaterialMovement, projectJobMaterials, type JobMaterialDraft } from './jobMaterials';
import type { MaterialRow } from './materialStock';
import { createContext, useContext, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { defaultWorkEntries, defaultSalaryHistory } from './defaults';
import { useStoredState } from './utils';
import { projectJobWork, saveJobWork, correctJobWork, correctJobProgress } from './jobWork';
import type { JobProgress, ProductionJob } from './productionJobs';
import type { SalaryPayment, WorkEntry } from './types';

type JobWorkContextValue = {
  jobs: ProductionJob[];
  setJobs: Dispatch<SetStateAction<ProductionJob[]>>;
  createJob:(draft:ProductionJob)=>ProductionJob;
  entries: WorkEntry[];
  materials: MaterialRow[];
  recordMaterial: (jobId:string,draft:JobMaterialDraft)=>void;
  saveProgress: (jobId: string, entry: JobProgress) => void;
  correctProgress: (jobId:string,progressId:string,replacement:Pick<WorkEntry,'date'|'quantity'>|null,reason:string)=>void;
  correctWork: (entry: WorkEntry, replacement: Pick<WorkEntry, 'date' | 'quantity'> | null, reason: string) => void;
};
const Context = createContext<JobWorkContextValue | null>(null);
export const useJobWork = () => useContext(Context);

export function JobWorkProvider({ children }: { children: ReactNode }) {
  const [jobs, setStoredJobs] = useStoredState<ProductionJob[]>('garment-production-job-cards', []);
  const [orders]=useStoredState<ProductionOrder[]>('garment-general-production',[]);
  const [storedMaterials]=useStoredState<string[][]>('garment-inventory-items',[]);
  const [purchases]=useStoredState<MaterialPurchase[]>('garment-material-purchases',[]);
  const materials=purchaseItems(normalizeMaterials(storedMaterials),purchases);
  const [manualEntries] = useStoredState<WorkEntry[]>('garment-work-entries', defaultWorkEntries);
  const [salaries] = useStoredState<SalaryPayment[]>('garment-salary-history', defaultSalaryHistory);
  const latest = useRef({ jobs, salaries, materials, orders });
  latest.current = { jobs, salaries, materials, orders };
  const setJobs: Dispatch<SetStateAction<ProductionJob[]>> = update => {
    const next = typeof update === 'function' ? update(latest.current.jobs) : update;
    latest.current = { ...latest.current, jobs: next };
    setStoredJobs(next);
  };
  return <Context.Provider value={{ jobs, setJobs, createJob:draft=>{
      const next=appendProductionJob(latest.current.jobs,latest.current.orders,draft);
      setJobs(next);return next.find(job=>job.id===draft.id)!;
    }, entries: [...manualEntries, ...projectJobWork(jobs)],
    materials:projectJobMaterials(materials,jobs),
    recordMaterial:(jobId,draft)=>setJobs(addJobMaterialMovement(latest.current.jobs,latest.current.materials,jobId,draft)),
    saveProgress: (jobId, entry) => setJobs(saveJobWork(latest.current.jobs, jobId, entry, latest.current.salaries)),
    correctProgress:(jobId,progressId,replacement,reason)=>setJobs(correctJobProgress(latest.current.jobs,jobId,progressId,replacement,reason,latest.current.salaries)),
    correctWork: (entry, replacement, reason) => setJobs(correctJobWork(latest.current.jobs, entry, replacement, reason, latest.current.salaries)),
  }}>{children}</Context.Provider>;
}
