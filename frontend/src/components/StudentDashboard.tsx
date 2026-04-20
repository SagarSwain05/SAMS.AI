/**
 * StudentDashboard — Full-featured student portal
 *
 * Tabs:
 *  Home        — Profile card + Today's schedule with live attendance status
 *  Attendance  — Monthly grid + Subject-wise detailed view
 *  Analytics   — Trend charts + at-risk subjects
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  User as UserIcon, LogOut, Calendar, BookOpen, TrendingUp,
  Clock, Award, AlertTriangle, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Send, ChevronDown, ChevronUp, Building2, Hash,
  Sparkles, ExternalLink, Home, BarChart3, ChevronLeft, ChevronRight,
  Star, Grid,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const AURA_AUDIT_URL = 'https://aura-audit-app.vercel.app/';
import { User } from '../App';
import ISTClock from './ISTClock';
import toast from 'react-hot-toast';

import { API_BASE as API } from '../config';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { headers: extraH, ...rest } = opts;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { ...authHeader(), ...(extraH as Record<string, string> ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any).message || `HTTP ${res.status}`);
  return json;
}

interface StudentDashboardProps {
  user: User;
  onLogout: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: number; name: string; email: string;
  roll_number: string; reg_number: string;
  department: string; college: string; college_name: string;
  class: string; section: string; current_semester: number;
  academic_year_label: string; branch_code: string; branch_name: string;
  section_display: string; total_semesters: number; contact: string;
}

interface TodayPeriod {
  schedule_id: number; slot_label: string;
  start_time: string; end_time: string;
  is_active: boolean; is_past: boolean;
  subject: { id: number; name: string; code: string } | null;
  teacher: { name: string; emp_id: string } | null;
  attendance: { id: number; status: string; marked_by: string; time: string | null } | null;
}

interface TodayData {
  date: string; day: string; is_weekend: boolean;
  periods: TodayPeriod[];
}

interface SubjectAttendance {
  subject_id: number; subject_name: string; subject_code: string;
  present: number; absent: number; late: number; total: number;
  percentage: number; classes_needed_for_75: number;
  recent_logs: Array<{ date: string; status: string; marked_by: string }>;
}

interface AttendanceSummary {
  period: string; from_date: string; to_date: string;
  overall: { total_classes: number; attended: number; percentage: number };
  by_subject: SubjectAttendance[];
}

interface MonthlyGridRow {
  subject_id: number; subject_name: string; subject_code: string;
  slot_label: string;
  days: Record<string, string | null>;
}

interface MonthlyGrid {
  year: number; month: number;
  days: string[];
  rows: MonthlyGridRow[];
  summary: { present: number; late: number; absent: number; total: number; rate: number };
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function pctColor(p: number) {
  if (p >= 90) return 'text-green-600';
  if (p >= 75) return 'text-orange-500';
  return 'text-red-600';
}
function barColor(p: number) {
  if (p >= 90) return 'bg-green-500';
  if (p >= 75) return 'bg-orange-500';
  return 'bg-red-500';
}
function statusLabel(p: number): { text: string; bg: string; icon: React.ReactNode } {
  if (p >= 90) return { text: 'Excellent', bg: 'bg-green-100 text-green-700', icon: <Award className="h-4 w-4" /> };
  if (p >= 75) return { text: 'Good',      bg: 'bg-orange-100 text-orange-700', icon: <TrendingUp className="h-4 w-4" /> };
  return        { text: 'At Risk',   bg: 'bg-red-100 text-red-700',    icon: <AlertTriangle className="h-4 w-4" /> };
}

// ─── Attendance status badge ──────────────────────────────────────────────────

function AttBadge({ status }: { status?: string | null }) {
  if (!status || status === 'future')
    return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />—</span>;
  if (status === 'present')
    return <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium"><CheckCircle className="h-3 w-3" />Present</span>;
  if (status === 'late')
    return <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium"><AlertCircle className="h-3 w-3" />Late</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium"><XCircle className="h-3 w-3" />Absent</span>;
}

// ─── Grid cell ────────────────────────────────────────────────────────────────

function GridCell({ status }: { status: string | null | undefined }) {
  if (!status) return <td className="px-1 py-1.5 text-center"><span className="text-gray-200 text-xs">—</span></td>;
  if (status === 'future') return <td className="px-1 py-1.5 text-center"><span className="text-gray-300 text-xs">·</span></td>;
  if (status === 'present') return <td className="px-1 py-1.5 text-center"><span className="w-5 h-5 inline-flex items-center justify-center rounded bg-green-100 text-green-700 text-[10px] font-bold">P</span></td>;
  if (status === 'late')    return <td className="px-1 py-1.5 text-center"><span className="w-5 h-5 inline-flex items-center justify-center rounded bg-orange-100 text-orange-600 text-[10px] font-bold">L</span></td>;
  // absent
  return <td className="px-1 py-1.5 text-center"><span className="w-5 h-5 inline-flex items-center justify-center rounded bg-red-100 text-red-600 text-[10px] font-bold">A</span></td>;
}

// ─── Monthly grid view ────────────────────────────────────────────────────────

function MonthlyGridView({ studentId }: { studentId: number }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [grid, setGrid]   = useState<MonthlyGrid | null>(null);
  const [loading, setLoading] = useState(false);

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const fetch = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/attendance/my-monthly-grid?year=${y}&month=${m}`);
      setGrid(data as MonthlyGrid);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load monthly grid');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(year, month); }, [year, month, fetch]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const n = new Date(); if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth() + 1)) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mr-2" />
      <span className="text-gray-500">Loading grid…</span>
    </div>
  );
  if (!grid) return null;

  const days = grid.days.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return { iso: d, day: dt.getDate(), dow: dt.toLocaleDateString('en-US', { weekday: 'short' }) };
  });

  const isWeekend = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return d.getDay() === 0 || d.getDay() === 6; };
  const isToday   = (iso: string) => iso === new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900">{monthNames[month - 1]} {year}</h3>
          <p className="text-sm text-gray-500">
            {grid.summary.present}P · {grid.summary.absent}A · {grid.summary.late}L · {grid.summary.rate}%
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs flex-wrap">
        <span className="flex items-center gap-1"><span className="w-5 h-5 inline-flex items-center justify-center rounded bg-green-100 text-green-700 font-bold text-[10px]">P</span> Present</span>
        <span className="flex items-center gap-1"><span className="w-5 h-5 inline-flex items-center justify-center rounded bg-red-100 text-red-600 font-bold text-[10px]">A</span> Absent</span>
        <span className="flex items-center gap-1"><span className="w-5 h-5 inline-flex items-center justify-center rounded bg-orange-100 text-orange-600 font-bold text-[10px]">L</span> Late</span>
        <span className="flex items-center gap-1 text-gray-400">— No class</span>
      </div>

      {/* Scrollable grid */}
      {grid.rows.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Grid className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No schedule data for this month</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-max text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600 border-r border-gray-200 min-w-[130px]">Subject</th>
                {days.map(d => (
                  <th key={d.iso}
                    className={`px-1 py-2 text-center font-medium min-w-[32px] ${
                      isWeekend(d.iso) ? 'text-gray-300' :
                      isToday(d.iso)   ? 'text-indigo-700 bg-indigo-50' :
                      'text-gray-500'
                    }`}>
                    <div>{d.day}</div>
                    <div className="text-[9px] opacity-70">{d.dow}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grid.rows.map(row => {
                const rowTotal  = days.filter(d => !isWeekend(d.iso) && row.days[d.iso] !== null && row.days[d.iso] !== 'future').length;
                const rowPres   = days.filter(d => row.days[d.iso] === 'present').length;
                const rowRate   = rowTotal > 0 ? Math.round(rowPres / rowTotal * 100) : 0;
                return (
                  <tr key={row.subject_id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white hover:bg-gray-50/50 px-3 py-2 border-r border-gray-200">
                      <p className="font-medium text-gray-800 truncate max-w-[110px]">{row.subject_name}</p>
                      <p className="text-[10px] text-gray-400">{row.slot_label} · <span className={pctColor(rowRate)}>{rowRate}%</span></p>
                    </td>
                    {days.map(d => (
                      isWeekend(d.iso)
                        ? <td key={d.iso} className="px-1 py-1.5 bg-gray-50/30" />
                        : <GridCell key={d.iso} status={row.days[d.iso]} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Analytics view ───────────────────────────────────────────────────────────

function AnalyticsView({ subjects }: { subjects: SubjectAttendance[] }) {
  if (!subjects.length) return (
    <div className="text-center py-12 text-gray-400">
      <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No data yet</p>
    </div>
  );

  const barData = subjects.map(s => ({
    name: s.subject_name.length > 14 ? s.subject_name.slice(0, 12) + '…' : s.subject_name,
    rate: s.percentage,
    fill: s.percentage >= 90 ? '#10b981' : s.percentage >= 75 ? '#f59e0b' : '#ef4444',
  }));

  const atRisk   = subjects.filter(s => s.percentage < 75);
  const excellent = subjects.filter(s => s.percentage >= 90);

  return (
    <div className="space-y-6">
      {/* Subject bar chart */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-white/30">
        <h3 className="text-base font-bold text-gray-900 mb-4">Attendance Rate by Subject</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'Attendance']} />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
              {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* 75% reference line label */}
        <p className="text-xs text-gray-400 mt-1 text-center">Minimum requirement: 75%</p>
      </div>

      {/* Risk / Excellence cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {atRisk.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <h4 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4" /> At Risk ({atRisk.length} subjects)
            </h4>
            <div className="space-y-2">
              {atRisk.map(s => (
                <div key={s.subject_id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.subject_name}</p>
                    {s.classes_needed_for_75 > 0 && (
                      <p className="text-xs text-red-500">Need {s.classes_needed_for_75} more classes for 75%</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-red-600">{s.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {excellent.length > 0 && (
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <h4 className="text-sm font-bold text-green-700 flex items-center gap-2 mb-3">
              <Star className="h-4 w-4" /> Excellent ({excellent.length} subjects)
            </h4>
            <div className="space-y-2">
              {excellent.map(s => (
                <div key={s.subject_id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-100">
                  <p className="text-sm font-medium text-gray-800">{s.subject_name}</p>
                  <span className="text-lg font-bold text-green-600">{s.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'analytics'>('home');
  const [attendanceView, setAttendanceView] = useState<'monthly' | 'subjects'>('monthly');

  // Profile & schedule
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Attendance
  const [period, setPeriod]     = useState<'semester' | 'month' | 'week'>('semester');
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [expandedSubj, setExpandedSubj] = useState<number | null>(null);

  // Correction request
  const [reqDate, setReqDate]   = useState(new Date().toISOString().split('T')[0]);
  const [reqReason, setReqReason] = useState('');
  const [reqLoading, setReqLoading] = useState(false);
  const [showReqForm, setShowReqForm] = useState<number | null>(null); // subject_id

  // Request from today view (period)
  const [todayReqPeriod, setTodayReqPeriod] = useState<TodayPeriod | null>(null);
  const [todayReqReason, setTodayReqReason] = useState('');
  const [todayReqLoading, setTodayReqLoading] = useState(false);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [profileData, todayRes] = await Promise.allSettled([
        apiFetch('/students/my-profile'),
        apiFetch('/attendance/my-today-attendance'),
      ]);
      if (profileData.status === 'fulfilled') setProfile(profileData.value as Profile);
      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value as TodayData);
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchAttendance = useCallback(async (p: string) => {
    try {
      const data = await apiFetch(`/attendance/my-attendance?period=${p}`);
      setAttendance(data as AttendanceSummary);
    } catch (e: any) {
      console.error('Attendance fetch error:', e.message);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchAttendance(period); }, [period, fetchAttendance]);

  const submitRequest = async (subjectId: number, date: string, reason: string, onDone?: () => void) => {
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    try {
      await apiFetch('/attendance/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: subjectId, date, reason }),
      });
      toast.success('Request submitted to teacher');
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-indigo-600">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="text-lg font-medium">Loading your dashboard…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 mb-4">{error}</p>
          <button onClick={() => fetchAll()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const overall  = attendance?.overall;
  const subjects = attendance?.by_subject ?? [];
  const initials = (profile?.name || user.name).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const studentId = profile?.id ?? parseInt(user.id);

  const TABS = [
    { id: 'home'       as const, label: 'Home',       icon: <Home className="h-4 w-4" /> },
    { id: 'attendance' as const, label: 'Attendance', icon: <Calendar className="h-4 w-4" /> },
    { id: 'analytics'  as const, label: 'Analytics',  icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

      {/* ─── Header ─── */}
      <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">{initials}</span>
              </div>
              <div>
                <h1 className="text-base font-semibold text-gray-900">Student Portal</h1>
                <p className="text-xs text-gray-400">Trident Academy of Technology</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ISTClock variant="light" />
              <a href={AURA_AUDIT_URL} target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-all group">
                <Sparkles className="h-4 w-4 text-violet-500 group-hover:animate-pulse" />
                Aura Audit
                <ExternalLink className="h-3 w-3 text-violet-400" />
              </a>
              <a href={AURA_AUDIT_URL} target="_blank" rel="noopener noreferrer"
                className="sm:hidden flex items-center justify-center w-8 h-8 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg">
                <Sparkles className="h-4 w-4 text-violet-500" />
              </a>
              <button onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Tab nav ─── */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <nav className="flex space-x-1 py-2">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-white/70'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════
            HOME TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'home' && (
          <>
            {/* Profile */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="h-16 w-16 bg-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-indigo-600">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">{profile?.name || user.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{profile?.roll_number || '—'}</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{profile?.branch_name || profile?.department || '—'}</span>
                    <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" />Section {profile?.section || '—'} · Sem {profile?.current_semester || '—'}</span>
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{profile?.college_name || 'Trident Academy of Technology'}</span>
                  </div>
                  {profile?.reg_number && <p className="text-xs text-gray-400 mt-1">Reg: {profile.reg_number}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Academic Year</p>
                  <p className="text-base font-semibold text-gray-900">2024–25</p>
                  {profile?.academic_year_label && <p className="text-xs text-indigo-500 font-medium mt-0.5">{profile.academic_year_label}</p>}
                </div>
              </div>
            </div>

            {/* Mini attendance cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/30">
                <p className="text-xs text-gray-500">Overall</p>
                <p className={`text-3xl font-bold mt-0.5 ${pctColor(overall?.percentage ?? 0)}`}>
                  {overall?.percentage?.toFixed(1) ?? '—'}%
                </p>
                <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${barColor(overall?.percentage ?? 0)}`}
                    style={{ width: `${overall?.percentage ?? 0}%` }} />
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/30">
                <p className="text-xs text-gray-500">Classes Attended</p>
                <p className="text-3xl font-bold text-gray-900 mt-0.5">{overall?.attended ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-1">of {overall?.total_classes ?? '—'} total</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/30">
                <p className="text-xs text-gray-500">At Risk</p>
                <p className="text-3xl font-bold text-red-500 mt-0.5">{subjects.filter(s => s.percentage < 75).length}</p>
                <p className="text-xs text-gray-400 mt-1">subjects below 75%</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/30">
                <p className="text-xs text-gray-500">Subjects</p>
                <p className="text-3xl font-bold text-gray-900 mt-0.5">{subjects.length}</p>
                <p className="text-xs text-green-600 mt-1">{subjects.filter(s => s.percentage >= 90).length} excellent</p>
              </div>
            </div>

            {/* Today's schedule with attendance */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-500" />
                  Today's Classes
                  {todayData && !todayData.is_weekend && (
                    <span className="text-sm font-normal text-gray-400">{todayData.day}</span>
                  )}
                </h3>
                <button onClick={() => fetchAll(true)} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>

              {!todayData || todayData.is_weekend ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <Calendar className="h-12 w-12 mb-2 opacity-30" />
                  <p className="font-medium">No Classes Today</p>
                  <p className="text-sm mt-1">{todayData?.is_weekend ? 'Enjoy your weekend!' : 'Schedule unavailable'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayData.periods.map(period => {
                    const att = period.attendance;
                    const isAbsent = !att || att.status === 'absent';
                    const isPast   = period.is_past;
                    const showReq  = todayReqPeriod?.schedule_id === period.schedule_id;

                    return (
                      <div key={period.schedule_id}
                        className={`rounded-xl border transition-all ${
                          period.is_active  ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' :
                          isPast            ? 'border-gray-100 bg-gray-50' :
                          'border-gray-200 bg-white'
                        }`}>
                        <div className="flex items-center gap-3 p-3">
                          {/* Period label */}
                          <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-xs font-bold ${
                            period.is_active ? 'bg-indigo-100 text-indigo-700' :
                            isPast           ? 'bg-gray-100 text-gray-400' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            <span>{period.slot_label}</span>
                            <span className="text-[9px] font-normal mt-0.5">{period.start_time}</span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            {period.subject ? (
                              <>
                                <p className={`text-sm font-semibold truncate ${period.is_active ? 'text-indigo-700' : 'text-gray-800'}`}>
                                  {period.subject.name}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {period.teacher?.name || '—'}
                                  <span className="ml-2 text-[10px] bg-gray-100 px-1 py-0.5 rounded">{period.subject.code}</span>
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-gray-400">Free period</p>
                            )}
                          </div>

                          {/* Attendance status */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <AttBadge status={att?.status} />
                            {/* Request button — only for past periods that are absent */}
                            {isPast && isAbsent && period.subject && (
                              <button
                                onClick={() => {
                                  if (showReq) { setTodayReqPeriod(null); setTodayReqReason(''); }
                                  else { setTodayReqPeriod(period); setTodayReqReason(''); }
                                }}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700 underline"
                              >
                                {showReq ? 'Cancel' : 'Request Correction'}
                              </button>
                            )}
                            {period.is_active && (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline correction request form */}
                        {showReq && period.subject && (
                          <div className="border-t border-indigo-100 bg-indigo-50/50 p-3">
                            <p className="text-xs font-semibold text-gray-700 mb-2">
                              Request for: {period.subject.name} · {todayData.date}
                            </p>
                            <textarea
                              rows={2}
                              value={todayReqReason}
                              onChange={e => setTodayReqReason(e.target.value)}
                              placeholder="e.g. I was present but not marked due to a system error."
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                            />
                            <button
                              onClick={async () => {
                                if (!todayReqReason.trim()) { toast.error('Please provide a reason'); return; }
                                setTodayReqLoading(true);
                                try {
                                  await submitRequest(period.subject!.id, todayData.date, todayReqReason, () => {
                                    setTodayReqPeriod(null);
                                    setTodayReqReason('');
                                  });
                                } finally { setTodayReqLoading(false); }
                              }}
                              disabled={todayReqLoading || !todayReqReason.trim()}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {todayReqLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              {todayReqLoading ? 'Submitting…' : 'Submit Request'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ATTENDANCE TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'attendance' && (
          <>
            {/* Period selector + sub-view toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Period:</span>
                {(['semester', 'month', 'week'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                      period === p ? 'bg-indigo-600 text-white' : 'bg-white/80 text-gray-600 hover:bg-white border border-gray-200'
                    }`}>
                    {p === 'semester' ? 'Semester' : p === 'month' ? 'This Month' : 'This Week'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white/80 rounded-xl border border-gray-200 p-1">
                <button onClick={() => setAttendanceView('monthly')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    attendanceView === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Grid className="h-3.5 w-3.5" /> Monthly Grid
                </button>
                <button onClick={() => setAttendanceView('subjects')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    attendanceView === 'subjects' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <BookOpen className="h-3.5 w-3.5" /> Subject-wise
                </button>
              </div>
            </div>

            {/* ── Monthly grid ── */}
            {attendanceView === 'monthly' && (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-white/30">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Grid className="h-5 w-5 text-indigo-500" />
                  Monthly Attendance Grid
                </h3>
                <MonthlyGridView studentId={studentId} />
              </div>
            )}

            {/* ── Subject-wise ── */}
            {attendanceView === 'subjects' && (
              <div className="space-y-4">
                {/* Overall stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/90 rounded-2xl p-4 shadow-sm border border-white/30 text-center">
                    <p className={`text-3xl font-bold ${pctColor(overall?.percentage ?? 0)}`}>
                      {overall?.percentage?.toFixed(1) ?? '—'}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Overall</p>
                    <p className="text-xs text-gray-400">{overall?.attended}/{overall?.total_classes} classes</p>
                  </div>
                  <div className="bg-white/90 rounded-2xl p-4 shadow-sm border border-white/30 text-center">
                    <p className="text-3xl font-bold text-green-600">{subjects.filter(s => s.percentage >= 75).length}</p>
                    <p className="text-xs text-gray-500 mt-1">Above 75%</p>
                  </div>
                  <div className="bg-white/90 rounded-2xl p-4 shadow-sm border border-white/30 text-center">
                    <p className="text-3xl font-bold text-red-500">{subjects.filter(s => s.percentage < 75).length}</p>
                    <p className="text-xs text-gray-500 mt-1">At Risk</p>
                  </div>
                </div>

                {/* Subject cards */}
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-white/30 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900">Subject-wise Attendance</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Click a subject to see details and request corrections</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {subjects.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>No attendance records found</p>
                      </div>
                    ) : subjects.map(subj => {
                      const sl = statusLabel(subj.percentage);
                      const isExpanded = expandedSubj === subj.subject_id;
                      const showingReqForm = showReqForm === subj.subject_id;
                      return (
                        <div key={subj.subject_id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-all">
                          <button className="w-full text-left" onClick={() => setExpandedSubj(isExpanded ? null : subj.subject_id)}>
                            <div className="p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-base font-semibold text-gray-900">{subj.subject_name}</h4>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{subj.subject_code}</span>
                                  </div>
                                  <p className="text-sm text-gray-400 mt-0.5">
                                    {subj.present + subj.late}/{subj.total} classes attended
                                    {subj.late > 0 && ` (${subj.late} late)`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sl.bg}`}>
                                    {sl.icon}<span className="ml-1">{sl.text}</span>
                                  </span>
                                  <p className={`text-2xl font-bold ${pctColor(subj.percentage)}`}>{subj.percentage.toFixed(1)}%</p>
                                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                </div>
                              </div>
                              <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                                <div className={`h-2 rounded-full ${barColor(subj.percentage)} transition-all duration-500`}
                                  style={{ width: `${subj.percentage}%` }} />
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                {[
                                  { label: 'Present', val: subj.present, color: 'text-green-600' },
                                  { label: 'Late',    val: subj.late,    color: 'text-orange-500' },
                                  { label: 'Absent',  val: subj.absent,  color: 'text-red-500' },
                                  { label: 'Total',   val: subj.total,   color: 'text-gray-700' },
                                ].map(item => (
                                  <div key={item.label} className="bg-white rounded-lg p-3 text-center border border-gray-100">
                                    <p className={`text-2xl font-bold ${item.color}`}>{item.val}</p>
                                    <p className="text-xs text-gray-400">{item.label}</p>
                                  </div>
                                ))}
                              </div>

                              {subj.percentage < 75 && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
                                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                  <span>
                                    Below 75% minimum.
                                    {subj.classes_needed_for_75 > 0 &&
                                      ` Attend ${subj.classes_needed_for_75} consecutive classes to reach 75%.`}
                                  </span>
                                </div>
                              )}

                              {subj.recent_logs.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-2">Recent Activity</p>
                                  <div className="space-y-1">
                                    {subj.recent_logs.map((log, i) => (
                                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-gray-100 text-xs">
                                        <span className="text-gray-600">{log.date}</span>
                                        <span className={`flex items-center gap-1 font-medium ${
                                          log.status === 'present' ? 'text-green-600' :
                                          log.status === 'late'    ? 'text-orange-500' : 'text-red-500'
                                        }`}>
                                          {log.status === 'present' ? <CheckCircle className="h-3 w-3" /> :
                                           log.status === 'late'    ? <AlertCircle className="h-3 w-3" /> :
                                           <XCircle className="h-3 w-3" />}
                                          {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                                        </span>
                                        <span className="text-gray-400 capitalize">
                                          {log.marked_by === 'face_recognition' ? 'AI Recognition' : log.marked_by || 'Manual'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Correction request */}
                              <div>
                                <button
                                  onClick={() => setShowReqForm(showingReqForm ? null : subj.subject_id)}
                                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                                  <Send className="h-4 w-4" />
                                  {showingReqForm ? 'Cancel Request' : 'Request Attendance Correction'}
                                </button>
                                {showingReqForm && (
                                  <div className="mt-3 bg-white border border-indigo-100 rounded-xl p-4 space-y-3">
                                    <p className="text-sm font-semibold text-gray-700">Request for: {subj.subject_name}</p>
                                    <div>
                                      <label className="text-xs text-gray-500 mb-1 block">Date of absence</label>
                                      <input type="date" value={reqDate} max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setReqDate(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 mb-1 block">Reason <span className="text-red-500">*</span></label>
                                      <textarea rows={2} value={reqReason} onChange={e => setReqReason(e.target.value)}
                                        placeholder="e.g. I was present but not marked."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                    </div>
                                    <button
                                      onClick={async () => {
                                        setReqLoading(true);
                                        try {
                                          await submitRequest(subj.subject_id, reqDate, reqReason, () => {
                                            setShowReqForm(null); setReqReason('');
                                          });
                                        } finally { setReqLoading(false); }
                                      }}
                                      disabled={reqLoading || !reqReason.trim()}
                                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                      {reqLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                      {reqLoading ? 'Submitting…' : 'Submit Request'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ANALYTICS TAB
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">My Analytics</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Period:</span>
                {(['semester', 'month', 'week'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${
                      period === p ? 'bg-indigo-600 text-white' : 'bg-white/80 text-gray-600 border border-gray-200'
                    }`}>
                    {p === 'semester' ? 'Sem' : p === 'month' ? 'Month' : 'Week'}
                  </button>
                ))}
              </div>
            </div>
            <AnalyticsView subjects={subjects} />
          </>
        )}

      </div>
    </div>
  );
};

export default StudentDashboard;
