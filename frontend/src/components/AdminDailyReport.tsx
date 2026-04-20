/**
 * AdminDailyReport — Browse attendance for any date by section/branch.
 * Shows a period-grid (P1–P6) per student: ✓ present, ✗ absent, — no class.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Calendar, Users, CheckCircle, XCircle,
  ChevronDown, ChevronUp, RefreshCw, Filter, BookOpen, Clock,
} from 'lucide-react';

import { API_BASE as API } from '../config';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string) {
  const res = await fetch(`${API}${path}`, { headers: authHeader() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

interface LogEntry {
  subject_id:   number;
  subject_name: string;
  subject_code: string;
  status:       string;
  marked_by:    string;
  time:         string | null;
}

interface StudentRow {
  student_id:  number;
  name:        string;
  roll_number: string;
  reg_number:  string;
  status:      'present' | 'absent' | 'late' | null;
  all_logs:    LogEntry[];
}

interface ScheduledSubject {
  subject_id:   number;
  subject_name: string;
  subject_code: string;
  start_time:   string;
  end_time:     string;
  label:        string;    // P1, P2, … P6
  teacher_name: string;
}

interface SectionReport {
  section_id:         number;
  display:            string;
  branch_code:        string;
  branch_name:        string;
  current_semester:   number;
  total:              number;
  present:            number;
  absent:             number;
  is_weekend:         boolean;
  scheduled_subjects: ScheduledSubject[];
  students:           StudentRow[];
}

interface ReportData {
  date:       string;
  day_name:   string;
  is_weekend: boolean;
  sections:   SectionReport[];
}

interface BranchSection {
  code:     string;
  sections: Array<{ id: number; display: string }>;
}

// ── Period cell ──────────────────────────────────────────────────────────────

const PeriodCell: React.FC<{
  subjectId: number;
  logs:      LogEntry[];
  tooltip:   string;
}> = ({ subjectId, logs, tooltip }) => {
  const match = logs.find(lg => lg.subject_id === subjectId);

  if (!match) {
    // Scheduled but no attendance log — Absent
    return (
      <td className="px-1 py-2 text-center" title={`${tooltip} — Absent`}>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100">
          <XCircle className="h-4 w-4 text-red-500" />
        </span>
      </td>
    );
  }

  if (match.status === 'present') {
    return (
      <td className="px-1 py-2 text-center" title={`${tooltip} — Present${match.time ? ` at ${match.time}` : ''}`}>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
          <CheckCircle className="h-4 w-4 text-green-600" />
        </span>
      </td>
    );
  }

  if (match.status === 'late') {
    return (
      <td className="px-1 py-2 text-center" title={`${tooltip} — Late`}>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100">
          <Clock className="h-4 w-4 text-orange-500" />
        </span>
      </td>
    );
  }

  // absent log
  return (
    <td className="px-1 py-2 text-center" title={`${tooltip} — Absent`}>
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100">
        <XCircle className="h-4 w-4 text-red-500" />
      </span>
    </td>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const AdminDailyReport: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [branchFilter, setBranchFilter]   = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [data, setData]       = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [branches, setBranches] = useState<BranchSection[]>([]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/attendance/daily-report?date=${selectedDate}`;
      if (sectionFilter) url += `&section_id=${sectionFilter}`;
      else if (branchFilter) url += `&branch_code=${branchFilter}`;
      const json = await apiFetch(url);
      setData(json);
      setExpandedSections(new Set(json.sections.map((s: SectionReport) => s.section_id)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, branchFilter, sectionFilter]);

  useEffect(() => {
    apiFetch('/attendance/daily-report')
      .then(d => {
        const bMap: Record<string, BranchSection> = {};
        for (const sec of d.sections as SectionReport[]) {
          if (!bMap[sec.branch_code])
            bMap[sec.branch_code] = { code: sec.branch_code, sections: [] };
          bMap[sec.branch_code].sections.push({ id: sec.section_id, display: sec.display });
        }
        setBranches(Object.values(bMap));
        setData(d);
        setExpandedSections(new Set(d.sections.map((s: SectionReport) => s.section_id)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredBranchSections = branchFilter
    ? branches.find(b => b.code === branchFilter)?.sections ?? []
    : [];

  const filteredSections = data
    ? data.sections.filter(sec => {
        if (branchFilter && sec.branch_code !== branchFilter) return false;
        if (sectionFilter && String(sec.section_id) !== sectionFilter) return false;
        return true;
      })
    : [];

  const totalStudents = filteredSections.reduce((a, s) => a + s.total, 0);
  const totalPresent  = filteredSections.reduce((a, s) => a + s.present, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-indigo-500" />
          Daily Attendance Report
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Period-wise grid — hover a cell to see subject & time
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
            <select
              value={branchFilter}
              onChange={e => { setBranchFilter(e.target.value); setSectionFilter(''); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.code} value={b.code}>{b.code}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={!branchFilter}
            >
              <option value="">All Sections</option>
              {filteredBranchSections.map(s => (
                <option key={s.id} value={String(s.id)}>{s.display}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
          {error} <button onClick={fetchReport} className="ml-2 underline">Retry</button>
        </div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Date',     value: data.date,                sub: data.day_name,                                     color: 'from-slate-500 to-slate-600' },
              { label: 'Sections', value: filteredSections.length,  sub: `of ${data.sections.length} total`,                color: 'from-indigo-500 to-indigo-600' },
              { label: 'Present',  value: totalPresent,             sub: `${totalStudents ? Math.round(totalPresent/totalStudents*100) : 0}% attendance`, color: 'from-green-500 to-green-600' },
              { label: 'Absent',   value: totalStudents-totalPresent, sub: `of ${totalStudents} students`,                  color: 'from-red-500 to-red-600' },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl p-4 text-white`}>
                <p className="text-xs opacity-75">{c.label}</p>
                <p className="text-2xl font-bold mt-0.5">{c.value}</p>
                <p className="text-xs opacity-70 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {data.is_weekend && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 text-sm">
              Weekend — no classes scheduled.
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-4 py-2 w-fit shadow-sm">
            <span className="font-semibold text-gray-700">Legend:</span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" /> Present
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" /> Absent
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-orange-500" /> Late
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3.5 h-3.5 rounded bg-gray-200" /> No class
            </span>
          </div>

          {/* Section cards */}
          <div className="space-y-4">
            {filteredSections.map(sec => {
              const isExpanded = expandedSections.has(sec.section_id);
              // Periods sorted by time
              const periods = [...sec.scheduled_subjects].sort((a, b) =>
                a.start_time.localeCompare(b.start_time)
              );

              return (
                <div key={sec.section_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(sec.section_id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-base">{sec.display}</h3>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            Sem {sec.current_semester}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{sec.branch_name}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-green-600 font-semibold">
                          <CheckCircle className="h-4 w-4" /> {sec.present}
                        </span>
                        <span className="flex items-center gap-1 text-red-500 font-semibold">
                          <XCircle className="h-4 w-4" /> {sec.absent}
                        </span>
                        <span className="text-gray-400 text-xs">/ {sec.total}</span>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${sec.total ? (sec.present / sec.total * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {sec.total ? Math.round(sec.present / sec.total * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Period pills */}
                      <div className="hidden md:flex gap-1">
                        {periods.slice(0, 4).map(p => (
                          <span key={p.subject_id}
                            className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                            {p.label}
                          </span>
                        ))}
                        {periods.length > 4 && (
                          <span className="text-[10px] text-gray-400">+{periods.length - 4}</span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {/* Period header legend */}
                      {periods.length > 0 && (
                        <div className="px-5 py-3 bg-slate-50 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" /> Today's Schedule
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {periods.map(p => (
                              <div key={p.subject_id}
                                className="bg-white border border-indigo-100 rounded-lg px-3 py-1.5 text-xs">
                                <span className="font-bold text-indigo-700">{p.label}</span>
                                <span className="text-gray-400 mx-1">·</span>
                                <span className="text-gray-700 font-medium">{p.subject_name}</span>
                                <span className="text-gray-400 ml-1">({p.start_time}–{p.end_time})</span>
                                <span className="text-gray-400 ml-1">· {p.teacher_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Period Grid Table */}
                      <div className="overflow-x-auto">
                        {periods.length === 0 ? (
                          <div className="px-5 py-8 text-center text-gray-400 text-sm">
                            {sec.is_weekend ? 'Weekend — no classes' : 'No schedule data for this day'}
                          </div>
                        ) : (
                          <table className="min-w-full text-sm border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[80px]">
                                  Roll
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[140px]">
                                  Name
                                </th>
                                {periods.map(p => (
                                  <th key={p.subject_id}
                                    className="px-1 py-2.5 text-center min-w-[72px]"
                                    title={`${p.subject_name} (${p.start_time}–${p.end_time})`}
                                  >
                                    <div className="text-xs font-bold text-indigo-700">{p.label}</div>
                                    <div className="text-[10px] text-gray-400 font-normal truncate max-w-[64px] mx-auto">
                                      {p.subject_code || p.subject_name.split(' ')[0]}
                                    </div>
                                    <div className="text-[9px] text-gray-300">{p.start_time}</div>
                                  </th>
                                ))}
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[72px]">
                                  Score
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {sec.students.length === 0 ? (
                                <tr>
                                  <td colSpan={periods.length + 3}
                                    className="px-4 py-8 text-center text-gray-400 text-sm">
                                    No students in this section
                                  </td>
                                </tr>
                              ) : sec.students.map(stu => {
                                // Count how many periods student is present
                                const presentPeriods = periods.filter(p =>
                                  stu.all_logs.some(lg => lg.subject_id === p.subject_id && lg.status === 'present')
                                ).length;
                                const pct = periods.length ? Math.round(presentPeriods / periods.length * 100) : 0;

                                return (
                                  <tr key={stu.student_id}
                                    className={`hover:bg-gray-50 ${
                                      stu.status === 'present' ? 'bg-green-50/20' :
                                      stu.status === 'absent'  ? 'bg-red-50/10'  : ''
                                    }`}
                                  >
                                    {/* Roll */}
                                    <td className="px-4 py-2 font-mono text-gray-600 text-xs sticky left-0 bg-white">
                                      {stu.roll_number}
                                    </td>
                                    {/* Name */}
                                    <td className="px-4 py-2">
                                      <div className="font-medium text-gray-900 text-sm">{stu.name}</div>
                                      <div className="text-xs text-gray-400">{stu.reg_number}</div>
                                    </td>
                                    {/* Period cells */}
                                    {periods.map(p => (
                                      <PeriodCell
                                        key={p.subject_id}
                                        subjectId={p.subject_id}
                                        logs={stu.all_logs}
                                        tooltip={`${p.label} · ${p.subject_name}`}
                                      />
                                    ))}
                                    {/* Overall score */}
                                    <td className="px-4 py-2 text-center">
                                      <div className={`text-sm font-bold ${
                                        pct >= 75 ? 'text-green-600' :
                                        pct >= 50 ? 'text-orange-500' : 'text-red-500'
                                      }`}>
                                        {presentPeriods}/{periods.length}
                                      </div>
                                      <div className="text-[10px] text-gray-400">{pct}%</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                          <span>{sec.students.length} students</span>
                          <span>
                            Present: {sec.present} · Absent: {sec.absent} · Rate: {sec.total ? Math.round(sec.present/sec.total*100) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSections.length === 0 && !loading && (
              <div className="text-center py-16 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No sections found for the selected filters</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDailyReport;
