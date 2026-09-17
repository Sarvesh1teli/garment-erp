import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Calendar, CalendarCheck, CalendarX, CheckCircle2, FileText, Printer, UserCheck, XCircle } from 'lucide-react';
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
  const [dailyDraft, setDailyDraft] = useState<Record<string, { status: AttendanceStatus | ''; remarks: string }>>({});
  const [toast, setToast] = useState('');
  
  const currentYearNum = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYearNum));
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('All');
  const [dailyStaffFilter, setDailyStaffFilter] = useState<string>('All');
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const uniqueEmployees = useMemo(() => {
    const seenId = new Set<string>();
    const seenName = new Set<string>();
    return employees.filter(e => {
      const idKey = String(e.id || '').trim();
      const nameKey = String(e.name || '').trim().toLowerCase();
      if (!idKey || seenId.has(idKey)) return false;
      if (nameKey && seenName.has(nameKey)) return false;
      seenId.add(idKey);
      if (nameKey) seenName.add(nameKey);
      return true;
    });
  }, [employees]);

  const activeEmployees = useMemo(() => uniqueEmployees.filter(e => e.status === 'Active'), [uniqueEmployees]);

  const filteredDailyEmployees = useMemo(() => {
    if (!dailyStaffFilter || dailyStaffFilter === 'All' || dailyStaffFilter === 'All Staff') {
      return activeEmployees;
    }
    const sel = String(dailyStaffFilter).trim();
    return activeEmployees.filter(e => String(e.id).trim() === sel || e.name === sel);
  }, [activeEmployees, dailyStaffFilter]);

  const isSunday = useMemo(() => {
    if (!markDate) return false;
    const d = new Date(markDate);
    return !Number.isNaN(d.getTime()) && d.getDay() === 0;
  }, [markDate]);

  const [isSaved, setIsSaved] = useState(true);

  // Sync dailyDraft when date changes or attendance loads
  useEffect(() => {
    const draft: Record<string, { status: AttendanceStatus | ''; remarks: string }> = {};
    activeEmployees.forEach(e => {
      const existing = attendance.find(a => a.employeeId === e.id && a.date === markDate);
      draft[e.id] = {
        status: existing ? existing.status : (isSunday ? 'Holiday' : ''),
        remarks: existing?.remarks || ''
      };
    });
    setDailyDraft(draft);
    setIsSaved(true);
  }, [markDate, activeEmployees, attendance, isSunday]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const dailyStats = useMemo(() => {
    let present = 0, absent = 0, halfDay = 0, leave = 0, holiday = 0, unmarked = 0;
    activeEmployees.forEach(e => {
      const st = dailyDraft[e.id]?.status;
      if (st === 'Present') present++;
      else if (st === 'Absent') absent++;
      else if (st === 'Half Day') halfDay++;
      else if (st === 'Leave') leave++;
      else if (st === 'Holiday') holiday++;
      else unmarked++;
    });
    return { present, absent, halfDay, leave, holiday, unmarked, total: activeEmployees.length };
  }, [activeEmployees, dailyDraft]);

  const isAllPresent = useMemo(() => activeEmployees.length > 0 && activeEmployees.every(e => dailyDraft[e.id]?.status === 'Present'), [activeEmployees, dailyDraft]);
  const isAllHoliday = useMemo(() => activeEmployees.length > 0 && activeEmployees.every(e => dailyDraft[e.id]?.status === 'Holiday'), [activeEmployees, dailyDraft]);
  const isAllAbsent = useMemo(() => activeEmployees.length > 0 && activeEmployees.every(e => dailyDraft[e.id]?.status === 'Absent'), [activeEmployees, dailyDraft]);

  const markAllStatus = (status: AttendanceStatus) => {
    setIsSaved(false);
    setDailyDraft(prev => {
      const allCurrentlyMatch = activeEmployees.length > 0 && activeEmployees.every(e => prev[e.id]?.status === status);
      const nextStatus = allCurrentlyMatch ? '' : status;
      const next = { ...prev };
      activeEmployees.forEach(e => {
        next[e.id] = { status: nextStatus, remarks: prev[e.id]?.remarks || '' };
      });
      return next;
    });
  };

  const setEmployeeDraft = (empId: string, changes: Partial<{ status: AttendanceStatus | ''; remarks: string }>) => {
    setIsSaved(false);
    setDailyDraft(prev => ({
      ...prev,
      [empId]: {
        status: prev[empId]?.status || '',
        remarks: prev[empId]?.remarks || '',
        ...changes
      }
    }));
  };

  const toggleEmployeeStatus = (empId: string, targetStatus: AttendanceStatus) => {
    setIsSaved(false);
    setDailyDraft(prev => {
      const current = prev[empId]?.status;
      const nextStatus = current === targetStatus ? '' : targetStatus;
      return {
        ...prev,
        [empId]: {
          status: nextStatus,
          remarks: prev[empId]?.remarks || ''
        }
      };
    });
  };

  const toggleRegisterDayStatus = (empId: string, dateStr: string) => {
    setAttendance(current => {
      const existingIndex = current.findIndex(a => a.employeeId === empId && a.date === dateStr);
      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        const cycle: Record<AttendanceStatus, AttendanceStatus | ''> = {
          'Present': 'Holiday',
          'Holiday': 'Absent',
          'Absent': 'Half Day',
          'Half Day': 'Leave',
          'Leave': ''
        };
        const nextStatus = cycle[existing.status] || '';
        if (!nextStatus) {
          return current.filter(a => !(a.employeeId === empId && a.date === dateStr));
        } else {
          return current.map(a => (a.employeeId === empId && a.date === dateStr ? { ...a, status: nextStatus } : a));
        }
      } else {
        return [{ id: `ATT-${dateStr}-${empId}`, date: dateStr, employeeId: empId, status: 'Present' }, ...current];
      }
    });
  };

  const saveDailyAttendance = () => {
    const newEntries: AttendanceEntry[] = [];
    activeEmployees.forEach(e => {
      const draft = dailyDraft[e.id];
      if (draft?.status) {
        newEntries.push({
          id: `ATT-${markDate}-${e.id}`,
          date: markDate,
          employeeId: e.id,
          status: draft.status as AttendanceStatus,
          remarks: draft.remarks?.trim() || undefined
        });
      }
    });

    setAttendance(current => {
      const filtered = current.filter(a => a.date !== markDate);
      return [...newEntries, ...filtered];
    });

    setIsSaved(true);
    showToast(`✓ Attendance for ${activeEmployees.length} staff members saved and synced on ${markDate}`);
  };

  // Calculations for Monthly Register & Reports
  const daysInMonth = useMemo(() => {
    const year = Number(selectedYear);
    return new Date(year, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const monthFormatted = String(selectedMonth + 1).padStart(2, '0');
  const monthPrefix = `${selectedYear}-${monthFormatted}`;

  const monthAttendance = useMemo(() => {
    const map = new Map<string, AttendanceEntry>();
    attendance.forEach(a => {
      if (a.date && a.date.startsWith(monthPrefix)) {
        const key = `${a.date}__${a.employeeId}`;
        if (!map.has(key)) map.set(key, a);
      }
    });
    return Array.from(map.values());
  }, [attendance, monthPrefix]);

  const filteredEmployeesForRegister = useMemo(() => {
    if (!selectedEmployeeId || selectedEmployeeId === 'All' || selectedEmployeeId === 'All Staff') {
      return uniqueEmployees;
    }
    const sel = String(selectedEmployeeId).trim();
    return uniqueEmployees.filter(e => String(e.id).trim() === sel || e.name === sel);
  }, [uniqueEmployees, selectedEmployeeId]);

  const [registerPage, setRegisterPage] = useState(1);
  const [registerPageSize, setRegisterPageSize] = useState(10);

  const registerPageCount = Math.max(1, Math.ceil(filteredEmployeesForRegister.length / registerPageSize));
  const safeRegisterPage = Math.min(Math.max(1, registerPage), registerPageCount);
  const pagedEmployeesForRegister = useMemo(() => {
    const start = (safeRegisterPage - 1) * registerPageSize;
    return filteredEmployeesForRegister.slice(start, start + registerPageSize);
  }, [filteredEmployeesForRegister, safeRegisterPage, registerPageSize]);

  useEffect(() => {
    setRegisterPage(1);
  }, [selectedYear, selectedMonth, selectedEmployeeId]);

  useEffect(() => {
    setRegisterPage(p => Math.min(Math.max(1, p), registerPageCount));
  }, [registerPageCount]);

  // Attendance stats for selected month & year
  const monthlyStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let holiday = 0;

    const sel = selectedEmployeeId && selectedEmployeeId !== 'All' && selectedEmployeeId !== 'All Staff' ? String(selectedEmployeeId).trim() : '';

    monthAttendance.forEach(a => {
      if (sel) {
        const matchedEmp = uniqueEmployees.find(e => String(e.id).trim() === sel || e.name === sel);
        const matches = matchedEmp
          ? (String(a.employeeId).trim() === String(matchedEmp.id).trim() || a.employeeId === matchedEmp.name)
          : (String(a.employeeId).trim() === sel);
        if (!matches) return;
      }
      if (a.status === 'Present') present++;
      else if (a.status === 'Absent') absent++;
      else if (a.status === 'Half Day') halfDay++;
      else if (a.status === 'Leave') leave++;
      else if (a.status === 'Holiday') holiday++;
    });

    const totalMarked = present + absent + halfDay + leave + holiday;
    const workingDays = present + absent + halfDay + leave;
    const rate = workingDays ? Math.round(((present + halfDay * 0.5) / workingDays) * 100) : 0;

    return { present, absent, halfDay, leave, holiday, totalMarked, rate };
  }, [monthAttendance, selectedEmployeeId, uniqueEmployees]);

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
        <div><b>Holidays</b><span>{monthlyStats.holiday}</span></div>
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
              <th>HOLIDAY</th>
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
              const h = staffEntries.filter(a => a.status === 'Holiday').length;
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
                  <td><span style={{ color: '#0284c7', fontWeight: 700 }}>{h} days</span></td>
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
          <div className="filterbar salary-filter compact-wage-filter" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <label>
              Attendance Date
              <input type="date" value={markDate} onChange={e => setMarkDate(e.target.value)} />
            </label>
            <label>
              Staff Member
              <select value={dailyStaffFilter} onChange={e => setDailyStaffFilter(e.target.value)}>
                <option value="All">All Staff</option>
                {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            {isSunday && (
              <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                📅 Sunday / Weekend (Staff working today can be marked Present)
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={`outline ${isAllPresent ? 'save-btn' : ''}`}
                onClick={() => markAllStatus('Present')}
                title={isAllPresent ? 'Click to deselect all Present' : 'Mark all staff Present'}
              >
                <UserCheck size={15} /> All Present
              </button>
              <button
                className="outline"
                style={{
                  borderColor: '#3b82f6',
                  backgroundColor: isAllHoliday ? '#0284c7' : undefined,
                  color: isAllHoliday ? '#ffffff' : '#2563eb'
                }}
                onClick={() => markAllStatus('Holiday')}
                title={isAllHoliday ? 'Click to deselect all Holiday' : 'Mark all staff Holiday'}
              >
                <CalendarX size={15} /> All Holiday
              </button>
              <button
                className={`outline ${isAllAbsent ? 'danger-btn' : ''}`}
                onClick={() => markAllStatus('Absent')}
                title={isAllAbsent ? 'Click to deselect all Absent' : 'Mark all staff Absent'}
              >
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
                <p>Mark attendance for {filteredDailyEmployees.length} staff member{filteredDailyEmployees.length === 1 ? '' : 's'} on <strong>{markDate}</strong> {isSunday ? '(Sunday)' : ''}</p>
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
                {filteredDailyEmployees.map(emp => {
                  const draft = dailyDraft[emp.id] || { status: '', remarks: '' };
                  const currentStatus = draft.status;
                  return (
                    <tr key={emp.id}>
                      <td><strong>{emp.id}</strong></td>
                      <td><strong>{emp.name}</strong></td>
                      <td>{emp.mobile || '-'}</td>
                      <td>
                        <div className="row-actions" style={{ gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className={`mini-action ${currentStatus === 'Present' ? 'save-btn' : 'outline'}`}
                            onClick={() => toggleEmployeeStatus(emp.id, 'Present')}
                            title={currentStatus === 'Present' ? 'Click to toggle off' : 'Mark Present'}
                          >
                            Present
                          </button>
                          <button
                            className={`mini-action ${currentStatus === 'Absent' ? 'danger-btn' : 'outline'}`}
                            onClick={() => toggleEmployeeStatus(emp.id, 'Absent')}
                            title={currentStatus === 'Absent' ? 'Click to toggle off' : 'Mark Absent'}
                          >
                            Absent
                          </button>
                          <button
                            className={`mini-action ${currentStatus === 'Half Day' ? 'primary' : 'outline'}`}
                            style={{ backgroundColor: currentStatus === 'Half Day' ? '#f59e0b' : undefined, borderColor: '#f59e0b' }}
                            onClick={() => toggleEmployeeStatus(emp.id, 'Half Day')}
                            title={currentStatus === 'Half Day' ? 'Click to toggle off' : 'Mark Half Day'}
                          >
                            Half Day
                          </button>
                          <button
                            className={`mini-action ${currentStatus === 'Leave' ? 'primary' : 'outline'}`}
                            style={{ backgroundColor: currentStatus === 'Leave' ? '#7256cc' : undefined, borderColor: '#7256cc' }}
                            onClick={() => toggleEmployeeStatus(emp.id, 'Leave')}
                            title={currentStatus === 'Leave' ? 'Click to toggle off' : 'Mark Leave'}
                          >
                            Leave
                          </button>
                          <button
                            className={`mini-action ${currentStatus === 'Holiday' ? 'primary' : 'outline'}`}
                            style={{ backgroundColor: currentStatus === 'Holiday' ? '#0284c7' : undefined, borderColor: '#0284c7', color: currentStatus === 'Holiday' ? '#fff' : '#0284c7' }}
                            onClick={() => toggleEmployeeStatus(emp.id, 'Holiday')}
                            title={currentStatus === 'Holiday' ? 'Click to toggle off' : 'Mark Holiday'}
                          >
                            Holiday
                          </button>
                          {!currentStatus && (
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginLeft: '4px' }}>Unmarked</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          style={{ width: '100%', minWidth: '160px', padding: '6px 8px', border: '1px solid #dfe5e2', borderRadius: '6px' }}
                          value={draft.remarks}
                          placeholder={isSunday ? 'e.g. Worked Sunday overtime' : 'Optional notes'}
                          onChange={e => setEmployeeDraft(emp.id, { remarks: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!filteredDailyEmployees.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
                      No staff members found matching filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-footer paginated-footer">
              <span>Showing {filteredDailyEmployees.length} of {activeEmployees.length} active staff members</span>
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
              <select
                value={selectedEmployeeId}
                onChange={e => {
                  setSelectedEmployeeId(e.target.value);
                  setRegisterPage(1);
                }}
              >
                <option value="All">All Staff</option>
                {uniqueEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          </div>

          <Stats
            values={[
              ['Total Marked Days', String(monthlyStats.totalMarked), `${MONTHS[selectedMonth]} ${selectedYear}`],
              ['Present Days', String(monthlyStats.present), `${monthlyStats.halfDay} half days`],
              ['Absences & Leaves', String(monthlyStats.absent + monthlyStats.leave), `${monthlyStats.absent} absent, ${monthlyStats.leave} leave`],
              ['Holidays & Sundays', String(monthlyStats.holiday), 'holidays recorded'],
              ['Attendance Rate', `${monthlyStats.rate}%`, 'working days ratio']
            ]}
          />

          <article className="card jobs module-table">
            <div className="cardhead">
              <div>
                <h2>Monthly Attendance Register ({MONTHS[selectedMonth]} {selectedYear})</h2>
                <p>Day-by-day attendance grid — click any cell to toggle (P → H → A → HD → L → clear)</p>
              </div>
            </div>
            <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', position: 'relative' }}>
              <table style={{ minWidth: '1200px', fontSize: '11px', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '150px', position: 'sticky', left: 0, background: '#e5f1ed', zIndex: 4, boxShadow: '2px 0 5px rgba(0,0,0,0.08)' }}>STAFF</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                      <th key={d} style={{ width: '32px', textAlign: 'center', padding: '6px 2px' }}>{d}</th>
                    ))}
                    <th style={{ width: '40px', textAlign: 'center' }}>P</th>
                    <th style={{ width: '40px', textAlign: 'center' }}>A</th>
                    <th style={{ width: '40px', textAlign: 'center' }}>HD</th>
                    <th style={{ width: '40px', textAlign: 'center' }}>L</th>
                    <th style={{ width: '40px', textAlign: 'center' }}>H</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEmployeesForRegister.map(emp => {
                    const staffEntries = monthAttendance.filter(a => a.employeeId === emp.id);
                    let pCount = 0, aCount = 0, hdCount = 0, lCount = 0, hCount = 0;

                    return (
                      <tr key={emp.id}>
                        <td style={{ position: 'sticky', left: 0, background: '#ffffff', zIndex: 3, fontWeight: 700, boxShadow: '2px 0 5px rgba(0,0,0,0.08)' }}>
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
                            else if (match.status === 'Holiday') { symbol = 'H'; bg = '#e0f2fe'; color = '#0284c7'; hCount++; }
                          }

                          return (
                            <td
                              key={d}
                              onClick={() => toggleRegisterDayStatus(emp.id, dateStr)}
                              style={{ textAlign: 'center', padding: '6px 2px', background: bg, color, fontWeight: 700, cursor: 'pointer' }}
                              title={`Click to cycle/toggle attendance for ${emp.name} on day ${d}`}
                            >
                              {symbol}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#16825e' }}>{pCount}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#c13d42' }}>{aCount}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#c57414' }}>{hdCount}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#7256cc' }}>{lCount}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{hCount}</td>
                      </tr>
                    );
                  })}
                  {!pagedEmployeesForRegister.length && (
                    <tr>
                      <td colSpan={daysInMonth + 6} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No staff members found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer paginated-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Rows per page:</span>
                <select
                  value={registerPageSize}
                  onChange={e => {
                    setRegisterPageSize(Number(e.target.value));
                    setRegisterPage(1);
                  }}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #dfe5e2' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>
                  Showing {filteredEmployeesForRegister.length === 0 ? 0 : (safeRegisterPage - 1) * registerPageSize + 1} - {Math.min(safeRegisterPage * registerPageSize, filteredEmployeesForRegister.length)} of {filteredEmployeesForRegister.length} staff
                </span>
              </div>
              <div className="pager" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="outline"
                  disabled={safeRegisterPage <= 1}
                  onClick={() => setRegisterPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span style={{ fontSize: '12px', fontWeight: 600, padding: '0 6px' }}>
                  Page {safeRegisterPage} / {registerPageCount}
                </span>
                <button
                  className="outline"
                  disabled={safeRegisterPage >= registerPageCount}
                  onClick={() => setRegisterPage(p => Math.min(registerPageCount, p + 1))}
                >
                  Next
                </button>
              </div>
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
            <label>
              Staff Member
              <select
                value={selectedEmployeeId}
                onChange={e => {
                  setSelectedEmployeeId(e.target.value);
                  setRegisterPage(1);
                }}
              >
                <option value="All">All Staff</option>
                {uniqueEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <button className="primary" style={{ marginLeft: 'auto' }} onClick={() => setShowPrintPreview(true)}>
              <Printer size={16} /> Print Register Slip
            </button>
          </div>

          <Table
            title={`Attendance Summary (${MONTHS[selectedMonth]} ${selectedYear})`}
            copy="Staff-wise attendance totals and percentages for the selected month"
            headers={['EMPLOYEE', 'TYPE', 'PRESENT DAYS', 'HALF DAYS', 'LEAVES', 'ABSENT DAYS', 'HOLIDAYS', 'ATTENDANCE %']}
            paged={true}
            rows={filteredEmployeesForRegister.map(e => {
              const staffEntries = monthAttendance.filter(a => a.employeeId === e.id);
              const p = staffEntries.filter(a => a.status === 'Present').length;
              const hd = staffEntries.filter(a => a.status === 'Half Day').length;
              const l = staffEntries.filter(a => a.status === 'Leave').length;
              const abs = staffEntries.filter(a => a.status === 'Absent').length;
              const h = staffEntries.filter(a => a.status === 'Holiday').length;
              const total = p + hd + l + abs;
              const pct = total ? Math.round(((p + hd * 0.5) / total) * 100) : 0;
              return [
                e.name,
                e.type,
                `${p} days`,
                `${hd} days`,
                `${l} days`,
                `${abs} days`,
                `${h} days`,
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
