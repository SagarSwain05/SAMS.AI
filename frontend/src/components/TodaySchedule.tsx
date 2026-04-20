/**
 * TodaySchedule — shows today's full class schedule for all sections.
 * Used in the Admin Overview right-side panel.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, BookOpen, User, RefreshCw, Coffee } from 'lucide-react';

import { API_BASE as API } from '../config';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Period {
  slot_number: number;
  label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  subject: { id: number; name: string; code: string } | null;
  teacher: { name: string; emp_id: string } | null;
  room: string | null;
}

interface SectionSchedule {
  section_id: number;
  display: string;
  branch_code: string;
  branch_name: string;
  current_semester: number;
  periods: Period[];
}

interface TodayData {
  is_weekend: boolean;
  day: string;
  current_time: string;
  sections: SectionSchedule[];
}

const TodaySchedule: React.FC = () => {
  const [data, setData]         = useState<TodayData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSchedule = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/timetable/today`, { headers: authHeader() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError('');
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    timerRef.current = setInterval(() => fetchSchedule(true), 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading schedule…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
        {error}
        <button onClick={() => fetchSchedule()} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  if (data.is_weekend) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Coffee className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">Weekend — No Classes</p>
        <p className="text-sm mt-1">Classes resume Monday</p>
      </div>
    );
  }

  const branches = Array.from(new Set(data.sections.map(s => s.branch_code))).sort();
  const filtered = branchFilter ? data.sections.filter(s => s.branch_code === branchFilter) : data.sections;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-500" />
          <div>
            <span className="font-semibold text-gray-800">{data.day}'s Schedule</span>
            <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {data.current_time}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none text-gray-600"
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button onClick={() => fetchSchedule()} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {filtered.map(sec => {
          const activeSlot = sec.periods.find(p => p.is_active);
          return (
            <div key={sec.section_id}
              className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              {/* Section header */}
              <div className={`px-4 py-2 flex items-center justify-between
                ${activeSlot ? 'bg-indigo-50 border-b border-indigo-100' : 'bg-gray-50 border-b border-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-800">{sec.display}</span>
                  <span className="text-xs text-gray-400">Sem {sec.current_semester}</span>
                </div>
                {activeSlot && activeSlot.subject && (
                  <span className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                    </span>
                    NOW: {activeSlot.subject.name}
                  </span>
                )}
              </div>

              {/* Periods */}
              <div className="divide-y divide-gray-50">
                {sec.periods.map(period => (
                  <div key={period.slot_number}
                    className={`px-4 py-2 flex items-start gap-3 transition-colors
                      ${period.is_active ? 'bg-indigo-50/50' : period.is_active === false && period.end_time < data.current_time ? 'opacity-50' : ''}`}>
                    {/* Time */}
                    <div className="flex-shrink-0 text-center min-w-[64px]">
                      <div className={`text-xs font-semibold ${period.is_active ? 'text-indigo-600' : 'text-gray-500'}`}>
                        {period.label}
                      </div>
                      <div className="text-[10px] text-gray-400">{period.start_time}–{period.end_time}</div>
                    </div>
                    {/* Subject */}
                    {period.subject ? (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5">
                          <BookOpen className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${period.is_active ? 'text-indigo-400' : 'text-gray-300'}`} />
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${period.is_active ? 'text-indigo-700' : 'text-gray-700'}`}>
                              {period.subject.name}
                            </p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <User className="h-3 w-3" />
                              {period.teacher?.name || '—'}
                              {period.room && <span className="ml-1 bg-gray-100 px-1 rounded">{period.room}</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 text-xs text-gray-300 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Free period
                      </div>
                    )}
                    {/* Active indicator */}
                    {period.is_active && (
                      <div className="flex-shrink-0">
                        <Clock className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No sections found</div>
        )}
      </div>
    </div>
  );
};

export default TodaySchedule;
