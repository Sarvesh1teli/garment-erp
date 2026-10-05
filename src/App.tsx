import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Users, Scissors, ClipboardList, CalendarCheck, Boxes, ReceiptText, WalletCards, Truck, BarChart3, Settings, UserCog, ListChecks, Calculator, LogOut, MessageSquare, Network, Menu, X } from 'lucide-react';
import { StaffManagement } from './modules/staff/StaffManagement';
import { SettingsPage, type CompanySettings, type ModuleSettings } from './modules/settings/SettingsPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { AssignmentsPage } from './modules/assignments/AssignmentsPage';
import { InventoryPage } from './modules/inventory/InventoryPage';
import { ExpensesPage } from './modules/expenses/ExpensesPage';
import { DeliveryPage } from './modules/delivery/DeliveryPage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { CustomersSchools } from './modules/customers/CustomersSchools';
import { Measurements } from './modules/measurements/MeasurementsPage';
import { BillingPaymentsPage } from './modules/billing/BillingPaymentsPage';
import { WagePage } from './modules/wages/WagePage';
import { AttendancePage } from './modules/attendance/AttendancePage';
import { SchoolOrdersPage } from './modules/network/SchoolOrdersPage';
import { GatewaySettingsPage } from './modules/settings/GatewaySettingsPage';
import { defaultAdvances, defaultAssignments, defaultAttendance, defaultCompanySettings, defaultCustomers, defaultGarmentPrices, defaultModuleSettings, defaultSalaryHistory, defaultSchools, defaultStudents, defaultWorkEntries, defaultWorkTypes, employees } from './shared/defaults';
import type { AdvanceEntry, Assignment, AttendanceEntry, Employee, GarmentPrice, SalaryPayment, School, Student, WorkEntry, WorkType } from './shared/types';
import { Placeholder } from './shared/ui';
import { useStoredState } from './shared/utils';

const nav = [['Dashboard',LayoutDashboard],['School Orders',Network],['SMS Gateway',MessageSquare],['Customers & Schools',Users],['Measurements',ClipboardList],['Production',Scissors],['Staff Management',UserCog],['Work Assignment',ListChecks],['Work Calculation / Salary',Calculator],['Attendance',CalendarCheck],['Inventory',Boxes],['Billing & Payments',ReceiptText],['Expenses',WalletCards],['Delivery',Truck],['Reports',BarChart3],['Settings',Settings]] as const;
const moduleLabels=nav.map(([label])=>label);

type AppProps = {
  currentUser?: { name?: string; email?: string; role?: string } | null;
  onLogout?: () => void;
};

export function App({ currentUser, onLogout }: AppProps) {
  const [page, setPage] = useState('Dashboard');
  const [staffTab, setStaffTab] = useState<'list' | 'add'>('list');
  const [navParams, setNavParams] = useState<Record<string, unknown> | null>(null);
  const [customerResetKey, setCustomerResetKey] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (targetPage: string, params?: Record<string, unknown>) => {
    if (params) setNavParams(params); else setNavParams(null);
    if (targetPage === 'Customers & Schools') setCustomerResetKey(k => k + 1);
    setPage(targetPage);
    setMobileOpen(false);
  };

  const [employeeRecords, setEmployeeRecords] = useStoredState<Employee[]>('garment-employees', employees);
  const [workTypes, setWorkTypes] = useStoredState<WorkType[]>('garment-work-types', defaultWorkTypes);
  const [advances, setAdvances] = useStoredState<AdvanceEntry[]>('garment-advances', defaultAdvances);
  const [workEntries, setWorkEntries] = useStoredState<WorkEntry[]>('garment-work-entries', defaultWorkEntries);
  const [workTypeHistory, setWorkTypeHistory] = useStoredState<string[][]>('garment-work-type-history', []);
  const [salaryHistory, setSalaryHistory] = useStoredState<SalaryPayment[]>('garment-salary-history', defaultSalaryHistory);
  const [attendance, setAttendance] = useStoredState<AttendanceEntry[]>('garment-attendance', defaultAttendance);
  const [assignments, setAssignments] = useStoredState<Assignment[]>('garment-assignments', defaultAssignments);
  const [customers, setCustomers] = useStoredState<string[][]>('garment-customers', defaultCustomers);
  const [schools, setSchools] = useStoredState<School[]>('garment-schools', defaultSchools);
  const [students, setStudents] = useStoredState<Student[]>('garment-students', defaultStudents);
  const [companySettings, setCompanySettings] = useStoredState<CompanySettings>('garment-company-settings', defaultCompanySettings);
  const [moduleSettings, setModuleSettings] = useStoredState<ModuleSettings>('garment-module-settings', defaultModuleSettings);
  const [garmentPrices, setGarmentPrices] = useStoredState<GarmentPrice[]>('garment-prices', defaultGarmentPrices);

  const visibleNav = useMemo(() => nav.filter(([label]) => label === 'Dashboard' || label === 'Settings' || moduleSettings[label] !== false), [moduleSettings]);

  useEffect(() => {
    if (!visibleNav.some(([label]) => label === page)) setPage('Dashboard');
  }, [page, visibleNav]);

  const displayName = currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Rahul Teli');
  const displayEmail = currentUser?.email || 'rahul@teliappareals.com';
  const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'RT';

  return (
    <div className="app">
      {/* 📱 Mobile Top Header Bar */}
      <div className="mobile-header-bar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <img src="/threadflow-logo.png" alt="Logo" style={{ height: 26, background: '#fff', padding: '2px 6px', borderRadius: 4, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '-0.3px' }}>{page}</span>
        </div>
        {onLogout && (
          <button onClick={onLogout} title="Log Out" style={{ background: 'none', border: 'none', color: '#fda4af', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <LogOut size={20} />
          </button>
        )}
      </div>

      {/* 📱 Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <div className="brand app-logo-brand">
          <img src="/threadflow-logo.png" alt="ThreadFlow Garment ERP" />
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {visibleNav.map(([label, Icon]) => (
            <button
              className={page === label ? 'active' : ''}
              onClick={() => {
                setNavParams(null);
                setPage(label);
                setMobileOpen(false);
                if (label === 'Staff Management') setStaffTab('list');
                if (label === 'Customers & Schools') setCustomerResetKey(k => k + 1);
              }}
              key={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="profile" style={{ flexShrink: 0, padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div className="avatar" style={{ background: '#007c68', color: '#fff', fontWeight: 700, borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              <strong style={{ display: 'block', fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</strong>
              <span style={{ fontSize: 11, color: '#a7f3d0', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayEmail}</span>
            </div>
          </div>

          {onLogout && (
            <button onClick={onLogout} title="Log Out" style={{ background: 'none', border: 'none', color: '#fda4af', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      <main>
        {page === 'Dashboard' ? <DashboardPage assignments={assignments} schools={schools} students={students} /> :
          page === 'School Orders' ? <SchoolOrdersPage /> :
          page === 'SMS Gateway' ? <GatewaySettingsPage company={companySettings} /> :
          page === 'Customers & Schools' ? <CustomersSchools key={`customers-${customerResetKey}`} company={companySettings} customers={customers} setCustomers={setCustomers} schools={schools} setSchools={setSchools} students={students} garmentPrices={garmentPrices} onNavigate={handleNavigate} navParams={navParams} /> :
          page === 'Measurements' ? <Measurements company={companySettings} schools={schools} students={students} setStudents={setStudents} /> :
          page === 'Production' ? <CustomersSchools productionMode company={companySettings} customers={customers} setCustomers={setCustomers} schools={schools} setSchools={setSchools} students={students} garmentPrices={garmentPrices} onNavigate={handleNavigate} navParams={navParams} /> :
          page === 'Staff Management' ? <StaffManagement employees={employeeRecords} setEmployees={setEmployeeRecords} workTypes={workTypes} advances={advances} activeTab={staffTab} onTabChange={setStaffTab} /> :
          page === 'Work Assignment' ? <AssignmentsPage employees={employeeRecords} workTypes={workTypes} customers={customers} assignments={assignments} setAssignments={setAssignments} /> :
          page === 'Work Calculation / Salary' ? <WagePage employees={employeeRecords} workTypes={workTypes} setWorkTypes={setWorkTypes} advances={advances} setAdvances={setAdvances} workEntries={workEntries} setWorkEntries={setWorkEntries} workTypeHistory={workTypeHistory} setWorkTypeHistory={setWorkTypeHistory} salaryHistory={salaryHistory} setSalaryHistory={setSalaryHistory} attendance={attendance} company={companySettings} garmentPrices={garmentPrices} setGarmentPrices={setGarmentPrices} /> :
          page === 'Attendance' ? <AttendancePage employees={employeeRecords} attendance={attendance} setAttendance={setAttendance} company={companySettings} /> :
          page === 'Inventory' ? <InventoryPage company={companySettings} customers={customers} schools={schools} navParams={navParams} onNavigate={handleNavigate} /> :
          page === 'Billing & Payments' ? <BillingPaymentsPage company={companySettings} customers={customers} schools={schools} students={students} navParams={navParams} onNavigate={handleNavigate} /> :
          page === 'Expenses' ? <ExpensesPage /> :
          page === 'Delivery' ? <DeliveryPage company={companySettings} customers={customers} /> :
          page === 'Reports' ? <ReportsPage employees={employeeRecords} workTypes={workTypes} advances={advances} workEntries={workEntries} assignments={assignments} customers={customers} /> :
          page === 'Settings' ? <SettingsPage company={companySettings} setCompany={setCompanySettings} modules={moduleSettings} setModules={setModuleSettings} moduleLabels={moduleLabels} /> :
          <Placeholder title={page} />}
      </main>
    </div>
  );
}
