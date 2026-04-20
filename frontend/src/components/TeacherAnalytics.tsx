/**
 * TeacherAnalytics — Attendance analytics for a teacher's own subjects/sections
 *
 * Shows analytics scoped to the logged-in teacher's subjects via teacher_user_id param.
 * Charts: daily trend, subject bar, student table
 * Downloads: full detail, student summary, subject summary
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  TrendingUp, Download, AlertTriangle, Award,
  RefreshCw, BarChart3, BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

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

interface AnalyticsData {
  date_from: string;
  date_to: string;
  summary: { total_records: number; total_present: number; total_absent: number; overall_rate: number; unique_students: number };
  daily_trend: { date: string; present: number; absent: number; rate: number }[];
  subject_stats: { subject_id: number; subject_name: string; subject_code: string; present: number; absent: number; total: number; rate: number }[];
  low_performers:  { student_id: number; name: string; roll_number: string; section: string; present: number; absent: number; total: number; rate: number; risk: boolean }[];
  high_performers: { student_id: number; name: string; roll_number: string; section: string; present: number; absent: number; total: number; rate: number; risk: boolean }[];
}

const rateColor   = (r: number) => r >= 75 ? 'text-green-600' : r >= 50 ? 'text-yellow-600' : 'text-red-600';
const rateBarColor = (r: number) => r >= 75 ? '#10b981' : r >= 50 ? '#f59e0b' : '#ef4444';

interface TeacherAnalyticsProps {
  teacherUserId: number | string;
}

const TeacherAnalytics: React.FC<TeacherAnalyticsProps> = ({ teacherUserId }) => {
  const today      = new Date().toISOString().split('T')[0];
  const thirtyAgo  = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];

  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(thirtyAgo);
  const [dateTo,   setDateTo]   = useState(today);
  const [sectionId, setSectionId] = useState<string>('');
  const [mySections, setMySections] = useState<{ id: number; display: string }[]>([]);

  // Load teacher's assigned sections from their schedule
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API}/timetable/my-schedule`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const secs = d.my_sections || [];
        setMySections(secs.map((s: any) => ({ id: s.id, display: s.display || `${s.branch_code}-${s.name}` })));
      })
      .catch(() => {});
  }, [teacherUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        teacher_user_id: String(teacherUserId),
      });
      if (sectionId) params.set('section_id', sectionId);
      const d = await apiFetch(`/attendance/analytics?${params}`);
      setData(d);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, teacherUserId, sectionId]);

  useEffect(() => { load(); }, [load]);

  const download = async (reportType: string) => {
    try {
      const params = new URLSearchParams({
        report_type: reportType,
        date_from: dateFrom,
        date_to: dateTo,
        teacher_user_id: String(teacherUserId),
      });
      if (sectionId) params.set('section_id', sectionId);
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API}/attendance/report/download?${params}`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my_attendance_${reportType}_${dateFrom}_to_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header + Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Attendance Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Analytics scoped to your assigned subjects</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {mySections.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Section</label>
              <select value={sectionId} onChange={e => setSectionId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400">
                <option value="">All My Sections</option>
                {mySections.map(s => (
                  <option key={s.id} value={s.id}>{s.display}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Apply
          </button>
        </div>
      </div>

      {/* Download */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Full Detail CSV',    type: 'summary' },
          { label: 'Student Summary',    type: 'student_detail' },
          { label: 'Subject Summary',    type: 'subject_detail' },
        ].map(btn => (
          <button key={btn.type} onClick={() => download(btn.type)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700
                       rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4" /> {btn.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Overall Rate',     value: `${data.summary.overall_rate}%`, color: rateColor(data.summary.overall_rate) },
              { label: 'Present',          value: data.summary.total_present,      color: 'text-green-600' },
              { label: 'Absent',           value: data.summary.total_absent,       color: 'text-red-500' },
              { label: 'Total Records',    value: data.summary.total_records,      color: 'text-gray-800' },
              { label: 'Unique Students',  value: data.summary.unique_students,    color: 'text-indigo-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
                <p className={`text-2xl font-extrabold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Daily trend + Subject bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.daily_trend.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" /> Daily Attendance Trend
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.daily_trend} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Rate']} />
                    <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {data.subject_stats.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" /> Subject-wise Rate
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.subject_stats} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="subject_code" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Rate']}
                      labelFormatter={l => data.subject_stats.find(s => s.subject_code === l)?.subject_name || l} />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {data.subject_stats.map((entry, i) => (
                        <Cell key={i} fill={rateBarColor(entry.rate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Subject detail table */}
          {data.subject_stats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-teal-500" /> Subject Detail
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Subject', 'Code', 'Present', 'Absent', 'Total', 'Rate'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.subject_stats.map(s => (
                    <tr key={s.subject_id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{s.subject_name}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{s.subject_code}</td>
                      <td className="px-3 py-2 text-green-600 font-semibold">{s.present}</td>
                      <td className="px-3 py-2 text-red-500">{s.absent}</td>
                      <td className="px-3 py-2 text-gray-600">{s.total}</td>
                      <td className="px-3 py-2">
                        <span className={`font-bold ${rateColor(s.rate)}`}>{s.rate}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Low / High Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> At-Risk Students (&lt;75%)
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {data.low_performers.filter(s => s.risk).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No at-risk students</p>
                ) : (
                  data.low_performers.filter(s => s.risk).map(s => (
                    <div key={s.student_id}
                      className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.roll_number} · {s.section}</p>
                      </div>
                      <span className="text-red-600 font-bold text-sm">{s.rate}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-green-500" /> Top Performers
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {data.high_performers.map((s, i) => (
                  <div key={s.student_id}
                    className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-700 w-5">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.roll_number} · {s.section}</p>
                      </div>
                    </div>
                    <span className="text-green-600 font-bold text-sm">{s.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherAnalytics;
