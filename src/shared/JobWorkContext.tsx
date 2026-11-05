import { createContext, useContext, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { defaultWorkEntries, defaultSalaryHistory } from './defaults';
import { useStoredState } from './utils';
import { projectJobWork, saveJobWork, correctJobWork } from './jobWork';
import type { JobProgress, ProductionJob } from './productionJobs';
import type { SalaryPayment, WorkEntry } from './types';

type JobWorkContextValue = {
  jobs: ProductionJob[];
  setJobs: Dispatch<SetStateAction<ProductionJob[]>>;
  entries: WorkEntry[];
  saveProgress: (jobId: string, entry: JobProgress) => void;
  correctWork: (entry: WorkEntry, replacement: Pick<WorkEntry, 'date' | 'quantity'> | null, reason: string) => void;
};
const Context = createContext<JobWorkContextValue | null>(null);
export const useJobWork = () => useContext(Context);

export function JobWorkProvider({ children }: { children: ReactNode }) {
  const [jobs, setStoredJobs] = useStoredState<ProductionJob[]>('garment-production-job-cards', []);
  const [manualEntries] = useStoredState<WorkEntry[]>('garment-work-entries', defaultWorkEntries);
  const [salaries] = useStoredState<SalaryPayment[]>('garment-salary-history', defaultSalaryHistory);
  const latest = useRef({ jobs, salaries });
  latest.current = { jobs, salaries };
  const setJobs: Dispatch<SetStateAction<ProductionJob[]>> = update => {
    const next = typeof update === 'function' ? update(latest.current.jobs) : update;
    latest.current = { ...latest.current, jobs: next };
    setStoredJobs(next);
  };
  return <Context.Provider value={{ jobs, setJobs, entries: [...manualEntries, ...projectJobWork(jobs)],
    saveProgress: (jobId, entry) => setJobs(saveJobWork(latest.current.jobs, jobId, entry, latest.current.salaries)),
    correctWork: (entry, replacement, reason) => setJobs(correctJobWork(latest.current.jobs, entry, replacement, reason, latest.current.salaries)),
  }}>{children}</Context.Provider>;
}
