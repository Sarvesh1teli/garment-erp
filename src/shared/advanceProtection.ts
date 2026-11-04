import type { AdvanceEntry, SalaryPayment } from './types';
// Legacy salary snapshots contain aggregate advances, not individual advance IDs.
// Preserve entries represented in those snapshots so edits/deletes cannot invalidate a salary slip.
export const advanceUsedInSalary=(advance:AdvanceEntry,salaries:SalaryPayment[])=>salaries.some(salary=>salary.employeeId===advance.employeeId&&advance.date<=salary.to&&(salary.pendingAdvance>0||salary.advanceDuring>0||salary.openingAdvance>0||salary.recover>0));
