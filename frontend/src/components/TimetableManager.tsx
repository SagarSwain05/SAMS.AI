/**
 * TimetableManager — Admin view of the full college timetable
 *
 * - Branch + Section filter dropdowns
 * - Full grid: rows = time slots, columns = Mon-Fri
 * - Current active slot highlighted in indigo with "Now" label
 * - Click any filled cell to edit subject/teacher with mandatory reason
 * - "Running Now" panel shows all active classes
 */
import React, { useEffect, useState, useCallback } from 'react';
import { BookOpen, Clock, ChevronDown, Users, AlertCircle, Edit2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { API_BASE as API } from '../config';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Types ──────────────────────────────────────────────────────────────────────

interface TimeSlot {
  id: number;
  slot_number: number;
  label: string;
  start_time: string;
  end_time: string;
}

interface CellData {
  slot_id: number;
  label: string;
  start_time: string;
  end_time: string;
  schedule_id: number | null;
  subject: { id: number; name: string; code: string } | null;
  teacher: { id: number; name: string; emp_id: string } | null;
}

interface SectionGrid {
  section_id: number;
  branch_id?: number;
  branch_code: string;
  branch_name: string;
  display: string;
  current_semester: number;
  grid: Record<string, Record<string, CellData>>;
}

interface FullTimetable {
  slots: TimeSlot[];
  sections: SectionGrid[];
}

interface Branch  { id: number; name: string; code: string; }
interface Section { id: number; name: string; display: string; }

interface CurrentSection {
  section_id: number;
  display: string;
  current_subject: { name: string } | null;
  current_teacher: { name: string } | null;
  active_slot: { label: string; start_time: string; end_time: string } | null;
}

interface CurrentData {
  day: string;
  current_time: string;
  active_slot: { label: string; start_time: string; end_time: string } | null;
  sections: CurrentSection[];
}

interface SubjectOption { id: number; name: string; code: string; }
interface TeacherOption { id: number; name: string; employee_id: string; department: string; }

// ── Edit Modal ─────────────────────────────────────────────────────────────────

interface EditTarget {
  schedule_id: number;
  section_display: string;
  day: string;
  slot_label: string;
  current_subject: { id: number; name: string } | null;
  current_teacher: { id: number; name: string } | null;
  branch_id: number | null;
}

const EditModal: React.FC<{
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}> = ({ target, onClose, onSaved }) => {
  const [subjects,  setSubjects]  = useState<SubjectOption[]>([]);
  const [teachers,  setTeachers]  = useState<TeacherOption[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [reason,    setReason]    = useState('');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    const qs = target.branch_id ? `?branch_id=${target.branch_id}` : '';
    Promise.all([
      apiFetch(`/timetable/subjects${qs}`).catch(() => []),
      apiFetch(`/timetable/teachers${qs}`).catch(() => []),
    ]).then(([s, t]) => { setSubjects(s); setTeachers(t); });
  }, [target.branch_id]);

  const handleSave = async () => {
    if (!reason.trim()) { toast.error('A reason is required for timetable changes'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { reason: reason.trim() };
      if (subjectId) body.subject_id = Number(subjectId);
      if (teacherId) body.teacher_id = Number(teacherId);
      await apiFetch(`/timetable/schedule/${target.schedule_id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      toast.success('Timetable slot updated');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Edit Timetable Slot</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {target.section_display} · {target.day} · {target.slot_label}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Current values */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-500">
              Current: <span className="font-medium text-gray-800">{target.current_subject?.name || '—'}</span>
              {target.current_teacher && <span className="text-gray-500"> · {target.current_teacher.name}</span>}
            </p>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Subject</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
            >
              <option value="">— keep current —</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Teacher */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Teacher</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              value={teacherId}
              onChange={e => setTeacherId(e.target.value)}
            >
              <option value="">— keep current —</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
              ))}
            </select>
          </div>

          {/* Reason — required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 resize-none"
              rows={3}
              placeholder="e.g. Teacher on medical leave, room change, syllabus adjustment..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Stored with the change for audit purposes.</p>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !reason.trim()}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium
                       hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <><Save className="h-4 w-4" /> Save Change</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Cell component ─────────────────────────────────────────────────────────────

const Cell: React.FC<{
  cell: CellData | null;
  isActive: boolean;
  sectionDisplay: string;
  day: string;
  branchId: number | null;
  onEdit: (t: EditTarget) => void;
}> = ({ cell, isActive, sectionDisplay, day, branchId, onEdit }) => {
  if (!cell?.subject) {
    return (
      <div className={`h-full min-h-[72px] rounded-lg border flex items-center justify-center
        ${isActive ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50'}`}>
        <span className="text-gray-200 text-xs">—</span>
      </div>
    );
  }

  const canEdit = !!cell.schedule_id;

  return (
    <div
      onClick={() => {
        if (!canEdit) return;
        onEdit({
          schedule_id:     cell.schedule_id!,
          section_display: sectionDisplay,
          day,
          slot_label:      cell.label,
          current_subject: cell.subject ? { id: cell.subject.id, name: cell.subject.name } : null,
          current_teacher: cell.teacher ? { id: cell.teacher.id, name: cell.teacher.name } : null,
          branch_id:       branchId,
        });
      }}
      className={`group h-full min-h-[72px] rounded-lg border p-2 flex flex-col justify-between
        relative transition-all
        ${canEdit ? 'cursor-pointer' : ''}
        ${isActive
          ? 'border-indigo-400 bg-indigo-50 shadow-sm hover:border-indigo-500'
          : 'border-blue-100 bg-blue-50/60 hover:border-blue-300 hover:bg-blue-50'}`}
    >
      {canEdit && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Edit2 className="h-3 w-3 text-indigo-400" />
        </div>
      )}
      <div>
        <p className={`text-xs font-bold leading-tight pr-4 truncate
          ${isActive ? 'text-indigo-800' : 'text-blue-800'}`}>
          {cell.subject.name}
        </p>
        <p className={`text-[10px] ${isActive ? 'text-indigo-500' : 'text-blue-400'}`}>
          {cell.subject.code}
        </p>
      </div>
      {cell.teacher && (
        <p className="text-[10px] text-gray-500 truncate mt-1">{cell.teacher.name}</p>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const TimetableManager: React.FC = () => {
  const [timetable, setTimetable]   = useState<FullTimetable | null>(null);
  const [current, setCurrent]       = useState<CurrentData | null>(null);
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [sections, setSections]     = useState<Section[]>([]);
  const [branchId, setBranchId]     = useState('');
  const [sectionId, setSectionId]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showNow, setShowNow]       = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  useEffect(() => {
    apiFetch('/branches').then((d: Branch[]) => setBranches(d)).catch(() => {});
  }, []);

  useEffect(() => {
    setSectionId('');
    if (!branchId) { setSections([]); return; }
    apiFetch(`/sections?branch_id=${branchId}`)
      .then((d: Section[]) => setSections(d))
      .catch(() => setSections([]));
  }, [branchId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (branchId)  params.set('branch_id',  branchId);
      if (sectionId) params.set('section_id', sectionId);
      const qs = params.toString() ? `?${params}` : '';
      const [ttData, curData] = await Promise.all([
        apiFetch(`/timetable${qs}`),
        apiFetch('/timetable/current').catch(() => null),
      ]);
      setTimetable(ttData as FullTimetable);
      setCurrent(curData as CurrentData | null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, sectionId]);

  useEffect(() => { load(); }, [load]);

  const activeSlotLabel = current?.active_slot?.label ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {error}
        <button onClick={load} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {editTarget && (
        <EditModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={load}
        />
      )}

      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Timetable Management</h2>
          {current && (
            <p className="text-sm text-gray-500 mt-0.5">
              {current.day} · {current.current_time}
              {current.active_slot
                ? ` · ${current.active_slot.label} (${current.active_slot.start_time}–${current.active_slot.end_time})`
                : ' · No active slot'}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Edit2 className="h-3 w-3" /> Click any slot to edit subject or teacher
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400"
            value={branchId} onChange={e => setBranchId(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 disabled:opacity-40"
            value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!branchId}
          >
            <option value="">All Sections</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.display || s.name}</option>)}
          </select>

          <button onClick={load}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Refresh
          </button>
        </div>
      </div>

      {/* Running Now panel */}
      {current?.active_slot && (current.sections?.length ?? 0) > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => setShowNow(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">
                Running Now — {current.active_slot.label} ({current.active_slot.start_time}–{current.active_slot.end_time})
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-indigo-500 transition-transform ${showNow ? 'rotate-180' : ''}`} />
          </button>

          {showNow && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {current.sections
                .filter(s => !timetable || timetable.sections.some(ts => ts.section_id === s.section_id))
                .map(sec => (
                  <div key={sec.section_id} className="bg-white border border-indigo-200 rounded-lg p-3 shadow-sm">
                    <p className="text-xs font-bold text-indigo-700">{sec.display}</p>
                    {sec.current_subject ? (
                      <>
                        <p className="text-xs text-gray-700 font-medium mt-1 truncate">{sec.current_subject.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{sec.current_teacher?.name || '—'}</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">No class</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Grid per section */}
      {timetable?.sections.map(sec => (
        <div key={sec.section_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
            <div className="bg-indigo-100 rounded-lg p-2">
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{sec.display}</h3>
              <p className="text-xs text-gray-500">{sec.branch_name} · Semester {sec.current_semester}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 bg-gray-50 border-b border-r border-gray-100 w-28">
                    Slot
                  </th>
                  {DAYS.map(day => (
                    <th key={day}
                      className={`px-3 py-2 text-xs font-semibold text-center border-b border-gray-100
                        ${current?.day === day ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-500'}`}>
                      {day.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timetable.slots.map(slot => {
                  const isActive = slot.label === activeSlotLabel;
                  return (
                    <tr key={slot.id} className={isActive ? 'bg-indigo-50/30' : ''}>
                      <td className={`px-3 py-2 border-r border-gray-100 border-b border-gray-50
                        ${isActive ? 'bg-indigo-100/60' : 'bg-gray-50'}`}>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${isActive ? 'text-indigo-700' : 'text-gray-700'}`}>
                            {slot.label}
                          </span>
                          <span className="text-[10px] text-gray-400">{slot.start_time}–{slot.end_time}</span>
                          {isActive && <span className="text-[9px] text-indigo-500 font-semibold uppercase mt-0.5">Now</span>}
                        </div>
                      </td>

                      {DAYS.map(day => {
                        const cell = sec.grid[day]?.[String(slot.slot_number)] ?? null;
                        const isTodayActive = isActive && current?.day === day;
                        return (
                          <td key={day} className="p-1.5 border-b border-gray-50 align-top">
                            <Cell
                              cell={cell}
                              isActive={isTodayActive}
                              sectionDisplay={sec.display}
                              day={day}
                              branchId={sec.branch_id ?? null}
                              onEdit={setEditTarget}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {timetable?.sections.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No timetable data for selected filters.</p>
        </div>
      )}
    </div>
  );
};

export default TimetableManager;
