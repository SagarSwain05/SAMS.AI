/**
 * AdminLiveView — All-section attendance grid + live camera feed
 *
 * Shows a grid of ALL 15 sections with:
 *   - Section name + current subject (from live timetable)
 *   - Present / absent count (from V2 attendance status or daily summary)
 *   - LIVE badge if recognition session is active for that section / college mode
 *
 * The physical camera feed (college session section_id=0) is shown at the top.
 * Section tiles below show attendance data only (no separate video per section
 * when there is only one physical camera).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Radio, Users, BookOpen, Camera, Wifi } from 'lucide-react';

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

interface SectionStatus {
  section_id: number;
  display: string;
  branch_code: string;
  branch_name: string;
  current_semester: number;
  current_subject: { id: number; name: string; code: string } | null;
  current_teacher: { name: string; emp_id: string } | null;
  present_today: number;
  total_students: number;
  has_live_session: boolean;
  live_present: number | null;
}

interface CollegeStatus {
  college_session_active: boolean;
  present_count?: number;
  uptime_seconds?: number;
}

function pct(p: number, t: number) {
  return t ? Math.round((p / t) * 100) : 0;
}

// ── Section Tile ──────────────────────────────────────────────────────────────

const SectionTile: React.FC<{ sec: SectionStatus; collegeActive: boolean }> = ({ sec, collegeActive }) => {
  const present = sec.live_present ?? sec.present_today;
  const absent  = Math.max(0, sec.total_students - present);
  const p       = pct(present, sec.total_students);
  const isLive  = sec.has_live_session || collegeActive;

  const barColor = p >= 75 ? 'bg-green-500' : p >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`relative bg-gray-900 rounded-xl border overflow-hidden
      ${isLive ? 'border-green-500/60' : 'border-gray-700'} transition-colors`}>

      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 border border-green-500/50 rounded-full px-2 py-0.5">
          <Radio className="h-3 w-3 text-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-semibold">LIVE</span>
        </div>
      )}

      <div className="p-4">
        {/* Section header */}
        <div className="mb-3">
          <h3 className="text-white font-bold text-lg leading-tight">{sec.display}</h3>
          <p className="text-gray-400 text-xs">Sem {sec.current_semester} · {sec.total_students} students</p>
        </div>

        {/* Current subject */}
        {sec.current_subject ? (
          <div className="flex items-start gap-2 mb-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-2">
            <BookOpen className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-indigo-300 text-xs font-semibold truncate">{sec.current_subject.name}</p>
              <p className="text-gray-500 text-xs">{sec.current_teacher?.name || '—'}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-4 bg-gray-800 rounded-lg p-2">
            <BookOpen className="h-4 w-4 text-gray-600" />
            <p className="text-gray-600 text-xs">No class scheduled now</p>
          </div>
        )}

        {/* Attendance counts */}
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-green-900/30 border border-green-700/30 rounded-lg py-2">
            <p className="text-green-400 font-bold text-xl leading-tight">{present}</p>
            <p className="text-gray-500 text-xs">Present</p>
          </div>
          <div className="bg-red-900/30 border border-red-700/30 rounded-lg py-2">
            <p className="text-red-400 font-bold text-xl leading-tight">{absent}</p>
            <p className="text-gray-500 text-xs">Absent</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg py-2">
            <p className="text-gray-300 font-bold text-xl leading-tight">{p}%</p>
            <p className="text-gray-500 text-xs">Rate</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${p}%` }} />
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const AdminLiveView: React.FC = () => {
  const [sections, setSections] = useState<SectionStatus[]>([]);
  const [college, setCollege]   = useState<CollegeStatus>({ college_session_active: false });
  const [error, setError]       = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imgRef  = useRef<HTMLImageElement>(null);

  const load = async (silent = false) => {
    try {
      // Use allSettled so a single endpoint failure doesn't blank the whole page
      const [collegeRes, summaryRes, ttRes] = await Promise.allSettled([
        apiFetch('/v2/recognition/college/status'),
        apiFetch('/attendance/daily_summary'),
        apiFetch('/timetable/current'),
      ]);

      const collegeData = collegeRes.status === 'fulfilled'
        ? collegeRes.value
        : { college_session_active: false };
      const summaryData = summaryRes.status === 'fulfilled'
        ? summaryRes.value
        : { branches: [] };
      const ttData = ttRes.status === 'fulfilled'
        ? ttRes.value
        : { sections: [] };

      // Report error only when the attendance summary itself fails
      if (summaryRes.status === 'rejected' && !silent) {
        setError((summaryRes.reason as Error)?.message ?? 'Failed to load data');
        return;
      }

      setCollege(collegeData);

      // Build index of current subjects per section_id
      const ttIndex: Record<number, { subject: { id: number; name: string; code: string } | null; teacher: { name: string; emp_id: string } | null }> = {};
      for (const sec of (ttData.sections || [])) {
        ttIndex[sec.section_id] = {
          subject: sec.current_subject,
          teacher: sec.current_teacher,
        };
      }

      // Flatten daily summary into sections
      const flat: SectionStatus[] = [];
      for (const branch of (summaryData.branches || [])) {
        for (const sec of branch.sections) {
          const tt = ttIndex[sec.id] || { subject: null, teacher: null };
          flat.push({
            section_id:       sec.id,
            display:          sec.display,
            branch_code:      branch.code,
            branch_name:      branch.name,
            current_semester: sec.current_semester,
            current_subject:  tt.subject,
            current_teacher:  tt.teacher,
            present_today:    sec.present_today,
            total_students:   sec.total_students,
            has_live_session: sec.has_live_session,
            live_present:     sec.live_present,
          });
        }
      }
      setSections(flat);
      setError('');
    } catch (e: any) {
      if (!silent) setError(e.message);
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Reload MJPEG when tab becomes visible again
  useEffect(() => {
    const bust = () => {
      if (imgRef.current && college.college_session_active) {
        imgRef.current.src = `${API}/v2/recognition/live_feed/0?t=${Date.now()}`;
      }
    };
    document.addEventListener('visibilitychange', bust);
    return () => document.removeEventListener('visibilitychange', bust);
  }, [college.college_session_active]);

  const branches = Array.from(new Set(sections.map(s => s.branch_code))).sort();
  const filtered = branchFilter ? sections.filter(s => s.branch_code === branchFilter) : sections;

  if (error) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-700 rounded-xl text-red-300 text-sm">
        Error loading data: {error}
        <button onClick={() => load()} className="ml-3 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="min-h-[600px] text-white p-2">
      {/* Top: live campus camera */}
      <div className="mb-6">
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-indigo-400" />
              <span className="font-semibold text-gray-200">Campus Camera Feed</span>
              {college.college_session_active && (
                <span className="flex items-center gap-1 text-xs bg-green-500/20 border border-green-500/50 rounded-full px-2 py-0.5">
                  <Radio className="h-3 w-3 text-green-400 animate-pulse" />
                  <span className="text-green-400 font-semibold">LIVE</span>
                </span>
              )}
            </div>
            {college.college_session_active && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  <Users className="h-4 w-4 inline mr-1 text-green-400" />
                  {college.present_count ?? 0} identified today
                </span>
                <span className="text-gray-500 text-xs">
                  Uptime {Math.floor((college.uptime_seconds ?? 0) / 60)}m
                </span>
              </div>
            )}
          </div>

          <div className="relative bg-black" style={{ height: '360px' }}>
            {college.college_session_active ? (
              <img
                ref={imgRef}
                src={`${API}/v2/recognition/live_feed/0`}
                alt="Campus Live Feed"
                className="w-full h-full object-contain"
                onError={() => {
                  if (imgRef.current) imgRef.current.alt = 'Feed unavailable';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-600">
                <Wifi className="h-16 w-16 mb-3 opacity-30" />
                <p className="text-lg font-medium">Recognition Server Offline</p>
                <p className="text-sm mt-1">Go to "Face Recognition" tab → Start College Recognition</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section grid header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-lg font-bold text-gray-200">
          All Sections · Attendance Today
        </h2>
        <div className="flex items-center gap-3">
          <select
            className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none"
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(sec => (
          <SectionTile
            key={sec.section_id}
            sec={sec}
            collegeActive={college.college_session_active}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No sections found</p>
        </div>
      )}
    </div>
  );
};

export default AdminLiveView;
