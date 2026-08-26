import type { AdvanceEntry, Assignment, AttendanceEntry, Employee, SalaryPayment, School, Student, WorkEntry, WorkType } from './types';
import type { CompanySettings, ModuleSettings } from '../modules/settings/SettingsPage';

export const defaultCompanySettings:CompanySettings={name:'ThreadFlow Garments',gst:'',address:'',phone:'',logo:''};
export const defaultModuleSettings:ModuleSettings={'Dashboard':true,'Customers & Schools':true,'Measurements':true,'Production':false,'Staff Management':true,'Work Assignment':true,'Work Calculation / Wages':true,'Attendance':true,'Inventory':true,'Billing & Payments':true,'Expenses':true,'Delivery':true,'Reports':true,'Settings':true};
export const workers:string[][]=[];
export const defaultCustomers:string[][]=[];
export const defaultSchools:School[]=[];
export const defaultStudents:Student[]=[];
export const defaultAssignments:Assignment[]=[];

export const employees:Employee[]=[];
export const defaultWorkTypes:WorkType[]=[];
export const defaultWorkEntries:WorkEntry[]=[];
export const defaultAdvances:AdvanceEntry[]=[];
export const defaultSalaryHistory:SalaryPayment[]=[];
export const defaultAttendance:AttendanceEntry[]=[];
