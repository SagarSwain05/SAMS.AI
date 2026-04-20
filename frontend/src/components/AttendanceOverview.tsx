/**
 * AttendanceOverview — Admin main panel widget
 * Shows branch → section wise today's present / absent counts.
 * If a V2 recognition session is live for a section, shows live count too.
 */
import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, RefreshCw, Radio } from 'lucide-react';

import { API_BASE as API } from '../config';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SectionSummary {
  id: number;
  name: string;
  display: string;
  current_semester: number;
  total_students: number;
  present_today: number;
  absent_today: number;
  live_present: number | null;
  has_live_session: boolean;
  uptime_seconds: number | null;
}

interface BranchSummary {
  id: number;
  name: string;
  code: string;
  sections: SectionSummary[];
}

interface DailySummary {
  date: string;
  branches: BranchSummary[];
}

function pct(present: number, total: number) {
  if (!total) return 0;
  return Math.round((present / total) * 100);
}

function fmtUptime(secs: number | null) {
  if (secs === null) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const AttendanceOverview: React.FC = () => {
  const [data, setData]       = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSummary = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/attendance/daily_summary`, { headers: authHeader() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DailySummary = await res.json();
      setData(json);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    timerRef.current = setInterval(() => fetchSummary(true), 15000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading attendance data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        Failed to load: {error}
        <button onClick={() => fetchSummary()} className="ml-3 underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const today = new Date(data.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Overall totals
  const totalPresent = data.branches.flatMap(b => b.sections).reduce((a, s) => a + s.present_today, 0);
  const totalStudents = data.branches.flatMap(b => b.sections).reduce((a, s) => a + s.total_students, 0);
  const liveCount = data.branches.flatMap(b => b.sections).filter(s => s.has_live_session).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="flex flex-wrap gap-4 mb-2">
        <div className="flex-1 min-w-[160px] bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">Present Today</p>
          <p className="text-3xl font-bold">{totalPresent}</p>
          <p className="text-xs opacity-70">of {totalStudents} students</p>
        </div>
        <div className="flex-1 min-w-[160px] bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">Absent Today</p>
          <p className="text-3xl font-bold">{totalStudents - totalPresent}</p>
          <p className="text-xs opacity-70">{pct(totalPresent, totalStudents)}% attendance rate</p>
        </div>
        <div className="flex-1 min-w-[160px] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">Live Sessions</p>
          <p className="text-3xl font-bold">{liveCount}</p>
          <p className="text-xs opacity-70">active classroom feeds</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{today}</p>
        <button onClick={() => fetchSummary()}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Branch blocks */}
      <div className="space-y-6">
        {data.branches.map(branch => {
          const branchPresent  = branch.sections.reduce((a, s) => a + s.present_today, 0);
          const branchTotal    = branch.sections.reduce((a, s) => a + s.total_students, 0);
          const branchPct      = pct(branchPresent, branchTotal);

          return (
            <div key={branch.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* Branch header */}
              <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <span className="font-bold text-gray-900">{branch.name}</span>
                  <span className="text-xs text-gray-500">({branch.code})</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600 font-semibold">{branchPresent} present</span>
                  <span className="text-red-500 font-semibold">{branchTotal - branchPresent} absent</span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${branchPct}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-xs w-8">{branchPct}%</span>
                </div>
              </div>

              {/* Sections table */}
              <div className="divide-y divide-gray-100">
                {branch.sections.map(sec => {
                  const secPct = pct(sec.present_today, sec.total_students);
                  const liveCount = sec.live_present ?? sec.present_today;

                  return (
                    <div key={sec.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                      {/* Section name */}
                      <div className="w-20 flex-shrink-0">
                        <span className="font-medium text-gray-900">{sec.display}</span>
                        <span className="block text-xs text-gray-400">Sem {sec.current_semester}</span>
                      </div>

                      {/* Live badge */}
                      {sec.has_live_session && (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          <Radio className="h-3 w-3 animate-pulse" /> LIVE
                          {sec.uptime_seconds !== null && (
                            <span className="text-green-500 ml-1">{fmtUptime(sec.uptime_seconds)}</span>
                          )}
                        </span>
                      )}

                      {/* Bar */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              secPct >= 75 ? 'bg-green-500' : secPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${secPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8">{secPct}%</span>
                      </div>

                      {/* Counts */}
                      <div className="flex items-center gap-4 text-sm flex-shrink-0">
                        <div className="text-center">
                          <p className="font-bold text-green-600">
                            {sec.has_live_session ? liveCount : sec.present_today}
                          </p>
                          <p className="text-xs text-gray-400">present</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-red-500">
                            {sec.has_live_session
                              ? Math.max(0, sec.total_students - liveCount)
                              : sec.absent_today}
                          </p>
                          <p className="text-xs text-gray-400">absent</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-gray-600">{sec.total_students}</p>
                          <p className="text-xs text-gray-400">total</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceOverview;
