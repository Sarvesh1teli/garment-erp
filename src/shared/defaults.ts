import type { AdvanceEntry, Assignment, AttendanceEntry, Employee, GarmentPrice, SalaryPayment, School, Student, WorkEntry, WorkType } from './types';
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

export const defaultGarmentPrices:GarmentPrice[]=[
  {id:'GP-001',quality:'Standard',garmentType:'Shirt',size:'26',price:240,remarks:'Regular uniform'},
  {id:'GP-002',quality:'Standard',garmentType:'Shirt',size:'28',price:260,remarks:'Regular uniform'},
  {id:'GP-003',quality:'Standard',garmentType:'Shirt',size:'30',price:280,remarks:'Regular uniform'},
  {id:'GP-004',quality:'Standard',garmentType:'Shirt',size:'32',price:300,remarks:'Regular uniform'},
  {id:'GP-005',quality:'Standard',garmentType:'Shirt',size:'34',price:320,remarks:'Regular uniform'},
  {id:'GP-006',quality:'Standard',garmentType:'Shirt',size:'36',price:340,remarks:'Regular uniform'},
  {id:'GP-007',quality:'Standard',garmentType:'Shirt',size:'38',price:360,remarks:'Regular uniform'},
  {id:'GP-008',quality:'Standard',garmentType:'Full Pant',size:'26',price:290,remarks:'Uniform trousers'},
  {id:'GP-009',quality:'Standard',garmentType:'Full Pant',size:'28',price:320,remarks:'Uniform trousers'},
  {id:'GP-010',quality:'Standard',garmentType:'Full Pant',size:'30',price:350,remarks:'Uniform trousers'},
  {id:'GP-011',quality:'Standard',garmentType:'Full Pant',size:'32',price:380,remarks:'Uniform trousers'},
  {id:'GP-012',quality:'Standard',garmentType:'Full Pant',size:'34',price:410,remarks:'Uniform trousers'},
  {id:'GP-013',quality:'Standard',garmentType:'Full Pant',size:'36',price:440,remarks:'Uniform trousers'},
  {id:'GP-014',quality:'Standard',garmentType:'Half Pant',size:'26',price:220,remarks:'Uniform shorts'},
  {id:'GP-015',quality:'Standard',garmentType:'Half Pant',size:'28',price:240,remarks:'Uniform shorts'},
  {id:'GP-016',quality:'Standard',garmentType:'Half Pant',size:'30',price:260,remarks:'Uniform shorts'},
  {id:'GP-017',quality:'Standard',garmentType:'Half Pant',size:'32',price:280,remarks:'Uniform shorts'},
  {id:'GP-018',quality:'Standard',garmentType:'Skirt',size:'26',price:260,remarks:'Girls pleated skirt'},
  {id:'GP-019',quality:'Standard',garmentType:'Skirt',size:'28',price:280,remarks:'Girls pleated skirt'},
  {id:'GP-020',quality:'Standard',garmentType:'Skirt',size:'30',price:300,remarks:'Girls pleated skirt'},
  {id:'GP-021',quality:'Standard',garmentType:'Skirt',size:'32',price:320,remarks:'Girls pleated skirt'},
  {id:'GP-022',quality:'Standard',garmentType:'Blouse',size:'28',price:230,remarks:'Girls uniform blouse'},
  {id:'GP-023',quality:'Standard',garmentType:'Blouse',size:'30',price:250,remarks:'Girls uniform blouse'},
  {id:'GP-024',quality:'Standard',garmentType:'Blouse',size:'32',price:270,remarks:'Girls uniform blouse'},
  {id:'GP-025',quality:'Standard',garmentType:'Track Suit',size:'30',price:420,remarks:'Sports track suit'},
  {id:'GP-026',quality:'Standard',garmentType:'Track Suit',size:'32',price:450,remarks:'Sports track suit'},
  {id:'GP-027',quality:'Standard',garmentType:'Track Suit',size:'34',price:480,remarks:'Sports track suit'},
  {id:'GP-028',quality:'Standard',garmentType:'Jacket',size:'32',price:550,remarks:'Winter jacket'},
  {id:'GP-029',quality:'Standard',garmentType:'Jacket',size:'34',price:600,remarks:'Winter jacket'},
];
