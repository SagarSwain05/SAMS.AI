/**
 * AdminAnalytics — Comprehensive attendance analytics for admin
 *
 * Charts (recharts): daily trend line, branch bar, section bar, subject bar
 * Tables: top/bottom performers, section stats
 * Downloads: full detail CSV, student-detail CSV, subject-detail CSV
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Download, AlertTriangle, Award, Users,
  RefreshCw, BarChart3, BookOpen, Filter
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
  branch_stats: { branch_id: number; branch_name: string; branch_code: string; present: number; absent: number; total: number; rate: number }[];
  section_stats: { section_id: number; display: string; branch_code: string; present: number; absent: number; total: number; rate: number }[];
  subject_stats: { subject_id: number; subject_name: string; subject_code: string; present: number; absent: number; total: number; rate: number }[];
  low_performers:  { student_id: number; name: string; roll_number: string; section: string; present: number; absent: number; total: number; rate: number; risk: boolean }[];
  high_performers: { student_id: number; name: string; roll_number: string; section: string; present: number; absent: number; total: number; rate: number; risk: boolean }[];
}

interface Branch { id: number; name: string; code: string; }
interface Section { id: number; name: string; display: string; }

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

const rateColor = (r: number) => r >= 75 ? 'text-green-600' : r >= 50 ? 'text-yellow-600' : 'text-red-600';
const rateBarColor = (r: number) => r >= 75 ? '#10b981' : r >= 50 ? '#f59e0b' : '#ef4444';

// ── Summary Card ──────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{ label: string; value: string | number; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
    <p className={`text-3xl font-extrabold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const AdminAnalytics: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];
  const thirtyAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];

  const [data, setData]         = useState<AnalyticsData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [dateFrom, setDateFrom]   = useState(thirtyAgo);
  const [dateTo, setDateTo]       = useState(today);
  const [branchId, setBranchId]   = useState('');
  const [sectionId, setSectionId] = useState('');

  useEffect(() => {
    apiFetch('/branches').then((d: Branch[]) => setBranches(d)).catch(() => {});
  }, []);

  useEffect(() => {
    setSectionId('');
    if (!branchId) { setSections([]); return; }
    apiFetch(`/sections?branch_id=${branchId}`).then((d: Section[]) => setSections(d)).catch(() => {});
  }, [branchId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (branchId)  params.set('branch_id',  branchId);
      if (sectionId) params.set('section_id', sectionId);
      const d = await apiFetch(`/attendance/analytics?${params}`);
      setData(d);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, branchId, sectionId]);

  useEffect(() => { load(); }, [load]);

  const download = async (reportType: string) => {
    try {
      const params = new URLSearchParams({
        report_type: reportType, date_from: dateFrom, date_to: dateTo,
      });
      if (branchId)  params.set('branch_id',  branchId);
      if (sectionId) params.set('section_id', sectionId);
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API}/attendance/report/download?${params}`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${reportType}_${dateFrom}_to_${dateTo}.csv`;
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
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Attendance Analytics</h2>
          {data && <p className="text-sm text-gray-500 mt-0.5">{data.date_from} to {data.date_to}</p>}
        </div>

        <div className="flex flex-wrap items-end gap-3">
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
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white">
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
          <select value={sectionId} onChange={e => setSectionId(e.target.value)}
            disabled={!branchId}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white disabled:opacity-40">
            <option value="">All Sections</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.display || s.name}</option>)}
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Apply
          </button>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Full Detail CSV', type: 'summary' },
          { label: 'Student Summary CSV', type: 'student_detail' },
          { label: 'Subject Summary CSV', type: 'subject_detail' },
        ].map(btn => (
          <button key={btn.type} onClick={() => download(btn.type)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm
                       hover:bg-gray-50 hover:border-gray-400 transition-colors">
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
            <SummaryCard label="Overall Rate"      value={`${data.summary.overall_rate}%`} color={rateColor(data.summary.overall_rate)} />
            <SummaryCard label="Present"           value={data.summary.total_present}       color="text-green-600" />
            <SummaryCard label="Absent"            value={data.summary.total_absent}        color="text-red-500" />
            <SummaryCard label="Total Records"     value={data.summary.total_records}       color="text-gray-800" />
            <SummaryCard label="Unique Students"   value={data.summary.unique_students}     color="text-indigo-600" />
          </div>

          {/* Daily Trend */}
          {data.daily_trend.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" /> Daily Attendance Trend
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.daily_trend} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }}
                    tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Rate']}
                    labelFormatter={l => `Date: ${l}`} />
                  <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2}
                    dot={{ fill: '#6366f1', r: 3 }} name="Attendance %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Branch + Subject side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branch Bar */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-500" /> Branch-wise Attendance
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.branch_stats} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="branch_code" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Rate']} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Attendance %">
                    {data.branch_stats.map((entry, i) => (
                      <Cell key={i} fill={rateBarColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie: present vs absent */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-pink-500" /> Present vs Absent Distribution
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Present', value: data.summary.total_present },
                      { name: 'Absent',  value: data.summary.total_absent  },
                    ]}
                    cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                    labelLine={false}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Stats */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" /> Subject-wise Attendance
            </h3>
            <div className="overflow-x-auto">
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
                      <td className="px-3 py-2 text-gray-500 text-xs">{s.subject_code}</td>
                      <td className="px-3 py-2 text-green-600 font-semibold">{s.present}</td>
                      <td className="px-3 py-2 text-red-500">{s.absent}</td>
                      <td className="px-3 py-2 text-gray-600">{s.total}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.rate}%`, backgroundColor: rateBarColor(s.rate) }} />
                          </div>
                          <span className={`font-semibold ${rateColor(s.rate)}`}>{s.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section Stats */}
          {data.section_stats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4 text-teal-500" /> Section-wise Attendance
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {data.section_stats.map(s => (
                  <div key={s.section_id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-bold text-gray-700">{s.display}</p>
                    <p className={`text-2xl font-extrabold mt-1 ${rateColor(s.rate)}`}>{s.rate}%</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.present}/{s.total}</p>
                    <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.rate}%`, backgroundColor: rateBarColor(s.rate) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low / High Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* At Risk */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> At-Risk Students (&lt;75%)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.low_performers.filter(s => s.risk).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No at-risk students in this period</p>
                ) : (
                  data.low_performers.filter(s => s.risk).map(s => (
                    <div key={s.student_id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2">
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

            {/* Top Performers */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-green-500" /> Top Performers
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.high_performers.map((s, i) => (
                  <div key={s.student_id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
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

export default AdminAnalytics;
