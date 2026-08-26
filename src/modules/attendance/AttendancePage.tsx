import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Calendar, CalendarCheck, CheckCircle2, FileText, Printer, UserCheck, XCircle } from 'lucide-react';
import type { AttendanceEntry, AttendanceStatus, Employee } from '../../shared/types';
import type { CompanySettings } from '../settings/SettingsPage';
import { PrintPreview, SalaryPrintFooter, SalaryPrintHeader, Stats, Table } from '../../shared/ui';

type AttendancePageProps = {
  employees: Employee[];
  attendance: AttendanceEntry[];
  setAttendance: Dispatch<SetStateAction<AttendanceEntry[]>>;
  company: CompanySettings;
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function AttendancePage({ employees, attendance, setAttendance, company }: AttendancePageProps) {
  const [tab, setTab] = useState<'mark' | 'register' | 'reports'>('mark');
  const [markDate, setMarkDate] = useState(todayDate);
  const [dailyDraft, setDailyDraft] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [toast, setToast] = useState('');
  
  const currentYearNum = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYearNum));
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('All');
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active'), [employees]);

  // Sync dailyDraft when date changes or attendance loads
  useEffect(() => {
    const draft: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    activeEmployees.forEach(e => {
      const existing = attendance.find(a => a.employeeId === e.id && a.date === markDate);
      draft[e.id] = {
        status: existing ? existing.status : 'Present',
        remarks: existing?.remarks || ''
      };
    });
    setDailyDraft(draft);
  }, [markDate, activeEmployees, attendance]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const markAllStatus = (status: AttendanceStatus) => {
    setDailyDraft(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(empId => {
        next[empId] = { ...next[empId], status };
      });
      return next;
    });
  };

  const setEmployeeDraft = (empId: string, changes: Partial<{ status: AttendanceStatus; remarks: string }>) => {
    setDailyDraft(prev => ({
      ...prev,
      [empId]: {
        status: prev[empId]?.status || 'Present',
        remarks: prev[empId]?.remarks || '',
        ...changes
      }
    }));
  };

  const saveDailyAttendance = () => {
    const newEntries: AttendanceEntry[] = [];
    activeEmployees.forEach(e => {
      const draft = dailyDraft[e.id];
      if (draft) {
        newEntries.push({
          id: `ATT-${markDate}-${e.id}`,
          date: markDate,
          employeeId: e.id,
          status: draft.status,
          remarks: draft.remarks.trim() || undefined
        });
      }
    });

    setAttendance(current => {
      const filtered = current.filter(a => a.date !== markDate);
      return [...newEntries, ...filtered];
    });

    showToast(`Attendance saved for ${activeEmployees.length} staff members on ${markDate}`);
  };

  // Calculations for Monthly Register & Reports
  const daysInMonth = useMemo(() => {
    const year = Number(selectedYear);
    return new Date(year, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const monthFormatted = String(selectedMonth + 1).padStart(2, '0');
  const monthPrefix = `${selectedYear}-${monthFormatted}`;

  const monthAttendance = useMemo(() => {
    return attendance.filter(a => a.date.startsWith(monthPrefix));
  }, [attendance, monthPrefix]);

  const filteredEmployeesForRegister = useMemo(() => {
    if (selectedEmployeeId === 'All') return employees;
    return employees.filter(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Attendance stats for selected month & year
  const monthlyStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;

    monthAttendance.forEach(a => {
      if (selectedEmployeeId !== 'All' && a.employeeId !== selectedEmployeeId) return;
      if (a.status === 'Present') present++;
      else if (a.status === 'Absent') absent++;
      else if (a.status === 'Half Day') halfDay++;
      else if (a.status === 'Leave') leave++;
    });

    const totalMarked = present + absent + halfDay + leave;
    const rate = totalMarked ? Math.round(((present + halfDay * 0.5) / totalMarked) * 100) : 0;

    return { present, absent, halfDay, leave, totalMarked, rate };
  }, [monthAttendance, selectedEmployeeId]);

  const yearsOptions = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(String(currentYearNum));
    attendance.forEach(a => {
      const y = a.date.slice(0, 4);
      if (y) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort().reverse();
  }, [attendance, currentYearNum]);

  // Printable Report Doc
  const reportDoc = (
    <div className="tax-doc salary-doc">
      <SalaryPrintHeader company={company} />
      <h1>STAFF MONTHLY ATTENDANCE REGISTER</h1>
      <div className="doc-meta salary-meta">
        <div><b>Period</b><span>{MONTHS[selectedMonth]} {selectedYear}</span></div>
        <div><b>Total Staff</b><span>{filteredEmployeesForRegister.length}</span></div>
        <div><b>Total Present</b><span>{monthlyStats.present}</span></div>
        <div><b>Total Absent</b><span>{monthlyStats.absent}</span></div>
        <div><b>Attendance Rate</b><span>{monthlyStats.rate}%</span></div>
      </div>
      <div className="salary-breakup" style={{ gridTemplateColumns: '1fr' }}>
        <table className="doc-table">
          <thead>
            <tr>
              <th>STAFF</th>
              <th>CATEGORY</th>
              <th>PRESENT</th>
              <th>HALF DAY</th>
              <th>LEAVE</th>
              <th>ABSENT</th>
              <th>ATTENDANCE %</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployeesForRegister.map(e => {
              const staffEntries = monthAttendance.filter(a => a.employeeId === e.id);
              const p = staffEntries.filter(a => a.status === 'Present').length;
              const hd = staffEntries.filter(a => a.status === 'Half Day').length;
              const l = staffEntries.filter(a => a.status === 'Leave').length;
              const abs = staffEntries.filter(a => a.status === 'Absent').length;
              const total = p + hd + l + abs;
              const pct = total ? Math.round(((p + hd * 0.5) / total) * 100) : 0;
              return (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong> ({e.id})</td>
                  <td>{e.type}</td>
                  <td><span className="status active">{p} days</span></td>
                  <td><span className="status pending">{hd} days</span></td>
                  <td><span className="status inactive">{l} days</span></td>
                  <td><span className="status left">{abs} days</span></td>
                  <td><strong>{pct}%</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="doc-footer salary-footer">
        <div><h3>Authorised Signatory</h3><span>Garment Production ERP</span></div>
      </div>
      <SalaryPrintFooter />
    </div>
  );

  return (
    <section className="content wage-workspace">
      {/* Navigation Tabs */}
      <div className="measurement-tabs wage-tabs">
        <button className={tab === 'mark' ? 'active' : ''} onClick={() => setTab('mark')}>
          <CalendarCheck size={16} />
          <span>Daily Marking<small>Mark present/absent per day</small></span>
        </button>
        <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>
          <Calendar size={16} />
          <span>Monthly Register<small>31-day matrix view</small></span>
        </button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          <FileText size={16} />
          <span>Reports & Print<small>Staff attendance summary</small></span>
        </button>
      </div>

      {/* Tab 1: Daily Marking */}
      {tab === 'mark' && (
        <>
          <div className="filterbar salary-filter compact-wage-filter">
            <label>
              Attendance Date
              <input type="date" value={markDate} onChange={e => setMarkDate(e.target.value)} />
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button className="outline" onClick={() => markAllStatus('Present')}>
                <UserCheck size={15} /> All Present
              </button>
              <button className="outline" onClick={() => markAllStatus('Absent')}>
                <XCircle size={15} /> All Absent
              </button>
              <button className="primary" onClick={saveDailyAttendance}>
                <CheckCircle2 size={16} /> Save Attendance
              </button>
            </div>
          </div>

          <article className="card jobs module-table">
            <div className="cardhead">
              <div>
                <h2>Daily Staff Attendance Marking</h2>
                <p>Mark attendance for {activeEmployees.length} active staff members on <strong>{markDate}</strong></p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE ID</th>
                  <th>STAFF NAME</th>
                  <th>MOBILE</th>
                  <th>ATTENDANCE STATUS</th>
                  <th>REMARKS / NOTES</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map(emp => {
                  const draft = dailyDraft[emp.id] || { status: 'Present', remarks: '' };
                  return (
                    <tr key={emp.id}>
                      <td><strong>{emp.id}</strong></td>
                      <td><strong>{emp.name}</strong></td>
                      <td>{emp.mobile || '-'}</td>
                      <td>
                        <div className="row-actions" style={{ gap: '6px' }}>
                          <button
                            className={`mini-action ${draft.status === 'Present' ? 'save-btn' : 'outline'}`}
                            onClick={() => setEmployeeDraft(emp.id, { status: 'Present' })}
                          >
                            Present
                          </button>
                          <button
                            className={`mini-action ${draft.status === 'Absent' ? 'danger-btn' : 'outline'}`}
                            onClick={() => setEmployeeDraft(emp.id, { status: 'Absent' })}
                          >
                            Absent
                          </button>
                          <button
                            className={`mini-action ${draft.status === 'Half Day' ? 'primary' : 'outline'}`}
                            style={{ backgroundColor: draft.status === 'Half Day' ? '#f59e0b' : undefined, borderColor: '#f59e0b' }}
                            onClick={() => setEmployeeDraft(emp.id, { status: 'Half Day' })}
                          >
                            Half Day
                          </button>
                          <button
                            className={`mini-action ${draft.status === 'Leave' ? 'primary' : 'outline'}`}
                            style={{ backgroundColor: draft.status === 'Leave' ? '#7256cc' : undefined, borderColor: '#7256cc' }}
                            onClick={() => setEmployeeDraft(emp.id, { status: 'Leave' })}
                          >
                            Leave
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          style={{ width: '100%', minWidth: '160px', padding: '6px 8px', border: '1px solid #dfe5e2', borderRadius: '6px' }}
                          value={draft.remarks}
                          placeholder="Optional notes"
                          onChange={e => setEmployeeDraft(emp.id, { remarks: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!activeEmployees.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
                      No active staff found. Add staff members in <strong>Staff Management</strong> module.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-footer paginated-footer">
              <span>Showing {activeEmployees.length} active staff members</span>
              <button className="primary" onClick={saveDailyAttendance}>
                <CheckCircle2 size={16} /> Save Attendance
              </button>
            </div>
          </article>
        </>
      )}

      {/* Tab 2: Monthly Register Matrix */}
      {tab === 'register' && (
        <>
          <div className="filterbar salary-filter compact-wage-filter">
            <label>
              Year
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                {yearsOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label>
              Month
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
              </select>
            </label>
            <label>
              Staff Member
              <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}>
                <option value="All">All Staff</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          </div>

          <Stats
            values={[
              ['Total Marked Days', String(monthlyStats.totalMarked), `${MONTHS[selectedMonth]} ${selectedYear}`],
              ['Present Days', String(monthlyStats.present), `${monthlyStats.halfDay} half days`],
              ['Absences & Leaves', String(monthlyStats.absent + monthlyStats.leave), `${monthlyStats.absent} absent, ${monthlyStats.leave} leave`],
              ['Attendance Rate', `${monthlyStats.rate}%`, 'overall present ratio']
            ]}
          />

          <article className="card jobs module-table">
            <div className="cardhead">
              <div>
                <h2>Monthly Attendance Register ({MONTHS[selectedMonth]} {selectedYear})</h2>
                <p>Day-by-day attendance grid (P = Present, A = Absent, HD = Half Day, L = Leave)</p>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '1200px', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '150px', position: 'sticky', left: 0, background: '#e5f1ed', zIndex: 2 }}>STAFF</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                      <th key={d} style={{ width: '32px', textAlign: 'center', padding: '6px 2px' }}>{d}</th>
                    ))}
                    <th style={{ width: '45px', textAlign: 'center' }}>P</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>A</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>HD</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>L</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployeesForRegister.map(emp => {
                    const staffEntries = monthAttendance.filter(a => a.employeeId === emp.id);
                    let pCount = 0, aCount = 0, hdCount = 0, lCount = 0;

                    return (
                      <tr key={emp.id}>
                        <td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1, fontWeight: 700 }}>
                          {emp.name}
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                          const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
                          const match = staffEntries.find(a => a.date === dateStr);
                          let symbol = '-';
                          let bg = 'transparent';
                          let color = '#81908b';

                          if (match) {
                            if (match.status === 'Present') { symbol = 'P'; bg = '#e8f7f0'; color = '#16825e'; pCount++; }
                            else if (match.status === 'Absent') { symbol = 'A'; bg = '#ffecec'; color = '#c13d42'; aCount++; }
                            else if (match.status === 'Half Day') { symbol = 'HD'; bg = '#fff3df'; color = '#c57414'; hdCount++; }
                            else if (match.status === 'Leave') { symbol = 'L'; bg = '#f1edff'; color = '#7256cc'; lCount++; }
                          }

                          return (
                            <td key={d} style={{ textAlign: 'center', padding: '6px 2px', background: bg, color, fontWeight: 700 }}>
                              {symbol}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#16825e' }}>{pCount}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#c13d42' }}>{aCount}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#c57414' }}>{hdCount}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#7256cc' }}>{lCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      {/* Tab 3: Reports & Print */}
      {tab === 'reports' && (
        <>
          <div className="filterbar salary-filter compact-wage-filter">
            <label>
              Year
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                {yearsOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label>
              Month
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
              </select>
            </label>
            <button className="primary" style={{ marginLeft: 'auto' }} onClick={() => setShowPrintPreview(true)}>
              <Printer size={16} /> Print Register Slip
            </button>
          </div>

          <Table
            title={`Attendance Summary (${MONTHS[selectedMonth]} ${selectedYear})`}
            copy="Staff-wise attendance totals and percentages for the selected month"
            headers={['EMPLOYEE', 'TYPE', 'PRESENT DAYS', 'HALF DAYS', 'LEAVES', 'ABSENT DAYS', 'ATTENDANCE %']}
            rows={filteredEmployeesForRegister.map(e => {
              const staffEntries = monthAttendance.filter(a => a.employeeId === e.id);
              const p = staffEntries.filter(a => a.status === 'Present').length;
              const hd = staffEntries.filter(a => a.status === 'Half Day').length;
              const l = staffEntries.filter(a => a.status === 'Leave').length;
              const abs = staffEntries.filter(a => a.status === 'Absent').length;
              const total = p + hd + l + abs;
              const pct = total ? Math.round(((p + hd * 0.5) / total) * 100) : 0;
              return [
                e.name,
                e.type,
                `${p} days`,
                `${hd} days`,
                `${l} days`,
                `${abs} days`,
                `${pct}%`
              ];
            })}
          />
        </>
      )}

      {toast && <div className="toast"><span className="toast-dot"></span>{toast}</div>}
      {showPrintPreview && <PrintPreview doc={reportDoc} onClose={() => setShowPrintPreview(false)} />}
    </section>
  );
}
