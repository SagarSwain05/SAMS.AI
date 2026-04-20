import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Clock, Download, Edit3, LogOut, Calendar,
  CheckCircle, XCircle, AlertCircle, TrendingUp,
  ChevronDown, ChevronRight, ShieldAlert, FileText,
  RefreshCw, Send, BookOpen, BarChart3,
} from 'lucide-react';
import { User } from '../App';
import { recognitionV2API, handleApiError } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import TeacherAnalytics from './TeacherAnalytics';
import ISTClock from './ISTClock';
import toast from 'react-hot-toast';

interface TeacherDashboardProps {
  user: User;
  onLogout: () => void;
}

import { API_BASE as API } from '../config';
function authHdr() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: authHdr(), ...opts });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any).message || `HTTP ${res.status}`);
  return json;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentRow {
  student_id: number;
  name: string;
  roll_number: string;
  reg_number: string;
  branch_code: string;
  section_name: string;
  attendance: {
    id: number;
    status: string;
    marked_by: string;
    time: string | null;
    can_edit: boolean;
    hours_since: number;
  } | null;
}

interface Period {
  slot_label: string;
  start_time: string;
  end_time: string;
  slot_id: number | null;
  schedule_id: number;
  section: { id: number | null; display: string; branch_code: string; name: string };
  subject: { id: number | null; name: string; code: string };
  students: StudentRow[];
  present_count: number;
  absent_count: number;
  total: number;
}

interface DailyData {
  date: string;
  day_name: string;
  is_weekend: boolean;
  periods: Period[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-800 border-green-300',
  absent:  'bg-red-100 text-red-800 border-red-300',
  late:    'bg-orange-100 text-orange-800 border-orange-300',
  none:    'bg-gray-100 text-gray-500 border-gray-200',
};
const BTN_ACTIVE: Record<string, string> = {
  present: 'bg-green-600 text-white ring-2 ring-green-400',
  absent:  'bg-red-600 text-white ring-2 ring-red-400',
  late:    'bg-orange-500 text-white ring-2 ring-orange-400',
};
const BTN_IDLE: Record<string, string> = {
  present: 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200',
  absent:  'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
  late:    'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200',
};

function StatusBadge({ status }: { status?: string }) {
  const s = status || 'none';
  const icon = s === 'present' ? <CheckCircle className="h-3 w-3 mr-1" /> :
               s === 'late'    ? <AlertCircle className="h-3 w-3 mr-1" /> :
                                 <XCircle className="h-3 w-3 mr-1" />;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[s] || STATUS_COLORS.none}`}>
      {icon}{s === 'none' ? 'unmarked' : s}
    </span>
  );
}

// ─── Approval Request Modal ───────────────────────────────────────────────────

function ApprovalModal({
  attendanceId,
  studentName,
  currentStatus,
  onClose,
  onSubmit,
}: {
  attendanceId: number;
  studentName: string;
  currentStatus: string;
  onClose: () => void;
  onSubmit: (newStatus: string, reason: string) => Promise<void>;
}) {
  const [newStatus, setNewStatus] = useState<string>(currentStatus);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    setSubmitting(true);
    try {
      await onSubmit(newStatus, reason.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Request Attendance Edit</h3>
        <p className="text-sm text-gray-500 mb-4">
          This record is older than 48 hours. An admin must approve the change for <strong>{studentName}</strong>.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Change status to</label>
          <div className="flex gap-2">
            {(['present', 'absent', 'late'] as const).map(s => (
              <button
                key={s}
                onClick={() => setNewStatus(s)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${newStatus === s ? BTN_ACTIVE[s] : BTN_IDLE[s]}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
            placeholder="Explain why this attendance record needs to be changed..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Period Card ──────────────────────────────────────────────────────────────

function PeriodCard({
  period,
  selectedDate,
  onRefresh,
}: {
  period: Period;
  selectedDate: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [approvalModal, setApprovalModal] = useState<{ attendanceId: number; studentName: string; currentStatus: string } | null>(null);

  // Initialise local statuses from server data
  useEffect(() => {
    const init: Record<number, string> = {};
    period.students.forEach(s => {
      init[s.student_id] = s.attendance?.status || '';
    });
    setLocalStatuses(init);
    setDirty(false);
  }, [period]);

  const setStatus = (studentId: number, status: string) => {
    setLocalStatuses(prev => ({ ...prev, [studentId]: status }));
    setDirty(true);
  };

  const markAll = (status: string) => {
    const next: Record<number, string> = {};
    period.students.forEach(s => { next[s.student_id] = status; });
    setLocalStatuses(next);
    setDirty(true);
  };

  const save = async () => {
    if (!period.subject.id) return;
    setSaving(true);
    try {
      const entries = period.students.map(s => ({
        student_id: s.student_id,
        status: localStatuses[s.student_id] || 'absent',
      }));

      const res = await apiFetch('/attendance/bulk-mark', {
        method: 'POST',
        body: JSON.stringify({
          section_id: period.section.id,
          subject_id: period.subject.id,
          date: selectedDate,
          entries,
        }),
      });

      const skipped = (res as any).skipped || 0;
      if (skipped > 0) {
        toast.success(`Saved ${(res as any).marked} records. ${skipped} skipped (>48h — use approval request).`);
      } else {
        toast.success(`Attendance saved for ${(res as any).marked} students`);
      }
      setDirty(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleSingleEdit = async (student: StudentRow, newStatus: string) => {
    if (!student.attendance) {
      // New record — just update local and let bulk-save handle it
      setStatus(student.student_id, newStatus);
      return;
    }
    if (student.attendance.can_edit) {
      setStatus(student.student_id, newStatus);
    } else {
      // >48h — show approval modal
      setApprovalModal({
        attendanceId: student.attendance.id,
        studentName: student.name,
        currentStatus: student.attendance.status,
      });
    }
  };

  const submitApprovalRequest = async (newStatus: string, reason: string) => {
    if (!approvalModal) return;
    await apiFetch('/attendance/approval-request', {
      method: 'POST',
      body: JSON.stringify({
        attendance_id: approvalModal.attendanceId,
        new_status: newStatus,
        reason,
      }),
    });
    toast.success('Approval request submitted to admin');
  };

  const presentPct = period.total > 0 ? Math.round(period.present_count / period.total * 100) : 0;
  const pctColor = presentPct >= 75 ? 'text-green-600' : presentPct >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow border border-white/20 overflow-hidden">
        {/* Period Header */}
        <div
          className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-indigo-100 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-indigo-700">{period.slot_label}</span>
              <span className="text-xs text-indigo-500">{period.start_time}–{period.end_time}</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{period.subject.name}</p>
              <p className="text-sm text-gray-500">{period.section.display} · {period.subject.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className={`text-xl font-bold ${pctColor}`}>{presentPct}%</p>
              <p className="text-xs text-gray-500">{period.present_count}/{period.total} present</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{period.present_count} P</span>
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{period.absent_count} A</span>
            </div>
            {expanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
          </div>
        </div>

        {/* Expanded student grid */}
        {expanded && (
          <div className="border-t border-gray-100">
            {/* Bulk actions */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 mr-1">Mark all:</span>
                <button onClick={() => markAll('present')} className={`px-3 py-1 rounded-lg text-xs font-medium ${BTN_IDLE.present}`}>Present</button>
                <button onClick={() => markAll('absent')} className={`px-3 py-1 rounded-lg text-xs font-medium ${BTN_IDLE.absent}`}>Absent</button>
                <button onClick={() => markAll('late')} className={`px-3 py-1 rounded-lg text-xs font-medium ${BTN_IDLE.late}`}>Late</button>
              </div>
              {dirty && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>

            {/* Student rows */}
            <div className="divide-y divide-gray-100">
              {period.students.map(student => {
                const local = localStatuses[student.student_id] || '';
                const canEdit = !student.attendance || student.attendance.can_edit;
                const hoursAgo = student.attendance?.hours_since;
                return (
                  <div key={student.student_id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/40">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-indigo-600">{student.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.roll_number} · {student.branch_code}-{student.section_name}</p>
                    </div>
                    {/* Status */}
                    <div className="hidden md:block w-24 text-center">
                      <StatusBadge status={local || undefined} />
                    </div>
                    {/* 48h badge */}
                    {!canEdit && (
                      <span className="hidden sm:inline text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5" title={`${Math.round(hoursAgo || 0)}h ago — needs admin approval`}>
                        &gt;48h
                      </span>
                    )}
                    {/* Status buttons */}
                    <div className="flex items-center gap-1.5">
                      {(['present', 'absent', 'late'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => handleSingleEdit(student, s)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                            local === s ? BTN_ACTIVE[s] : BTN_IDLE[s]
                          } ${!canEdit ? 'opacity-60' : ''}`}
                          title={!canEdit ? 'Older than 48h — will submit approval request' : `Mark ${s}`}
                        >
                          {s.charAt(0).toUpperCase()}
                        </button>
                      ))}
                      {!canEdit && student.attendance && (
                        <button
                          onClick={() => setApprovalModal({
                            attendanceId: student.attendance!.id,
                            studentName: student.name,
                            currentStatus: student.attendance!.status,
                          })}
                          className="p-1.5 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-200"
                          title="Request admin approval to edit"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save bar at bottom */}
            {dirty && (
              <div className="flex justify-end px-5 py-3 bg-indigo-50 border-t border-indigo-100">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {saving ? 'Saving...' : `Save Attendance`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {approvalModal && (
        <ApprovalModal
          attendanceId={approvalModal.attendanceId}
          studentName={approvalModal.studentName}
          currentStatus={approvalModal.currentStatus}
          onClose={() => setApprovalModal(null)}
          onSubmit={submitApprovalRequest}
        />
      )}
    </>
  );
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab({ teacherUserId }: { teacherUserId: number | string }) {
  const today = new Date().toISOString().split('T')[0];
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [reportType, setReportType] = useState<'summary' | 'student_detail' | 'subject_detail'>('summary');
  const [dateFrom, setDateFrom] = useState(thirtyAgo);
  const [dateTo, setDateTo] = useState(today);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        report_type: reportType,
        date_from: dateFrom,
        date_to: dateTo,
        teacher_user_id: String(teacherUserId),
      });
      const res = await fetch(`${API}/attendance/report/download?${params}`, { headers: authHdr() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${reportType}_${dateFrom}_to_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const reportTypes = [
    { value: 'summary',        label: 'Full Detail',       desc: 'Every attendance record with student, subject, date, status' },
    { value: 'student_detail', label: 'Student Summary',    desc: 'Per-student per-subject attendance rate table' },
    { value: 'subject_detail', label: 'Subject Summary',    desc: 'Per-subject total records, present count, and attendance rate' },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-white/20 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 rounded-xl"><FileText className="h-6 w-6 text-indigo-600" /></div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Export Attendance Report</h2>
            <p className="text-sm text-gray-500">Download attendance data for your classes as CSV</p>
          </div>
        </div>

        {/* Report type selection */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Report Type</p>
          <div className="grid gap-3">
            {reportTypes.map(rt => (
              <label
                key={rt.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  reportType === rt.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  value={rt.value}
                  checked={reportType === rt.value}
                  onChange={() => setReportType(rt.value)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{rt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{rt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
          onClick={download}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {downloading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          {downloading ? 'Downloading...' : 'Download CSV'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const TeacherDashboardIntegrated: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'analytics' | 'export'>('attendance');

  // Attendance tab state
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // Today's schedule bar
  const [myScheduleToday, setMyScheduleToday] = useState<Array<{
    slot_number: number; label: string; start_time: string; end_time: string;
    is_active: boolean;
    section: { id: number; name: string; display: string; semester: number } | null;
    subject: { id: number; name: string; code: string } | null;
    room: string | null;
  }>>([]);

  // Face recognition review queue
  const [reviewItems, setReviewItems] = useState<Array<{
    id: string; student_id: number; name: string;
    similarity: number; timestamp: string; section_id: number;
  }>>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { onAttendanceMarked } = useSocket();

  // Load today's schedule bar
  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return;
    const currentHm = now.toTimeString().slice(0, 5);
    fetch(`${API}/timetable/my-schedule`, { headers: authHdr() })
      .then(r => r.json())
      .then(data => {
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const todayName = dayNames[now.getDay() - 1];
        const grid = data.grid?.[todayName] || {};
        const slots = data.slots || [];
        const todaySlots = slots
          .filter((s: any) => grid[s.label])
          .map((s: any) => ({
            ...s,
            is_active: s.start_time <= currentHm && currentHm <= s.end_time,
            ...grid[s.label],
          }));
        setMyScheduleToday(todaySlots);
      })
      .catch(() => {});
  }, []);

  // Fetch daily attendance data
  const fetchDailyData = useCallback(async (date: string) => {
    setLoadingDaily(true);
    try {
      const data = await apiFetch(`/attendance/teacher/daily?date=${date}`);
      setDailyData(data as DailyData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load attendance data');
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyData(selectedDate);
  }, [selectedDate, fetchDailyData]);

  // Refresh attendance when SocketIO fires
  useEffect(() => {
    const cleanup = onAttendanceMarked(() => {
      fetchDailyData(selectedDate);
    });
    return () => { cleanup?.(); };
  }, [onAttendanceMarked, selectedDate, fetchDailyData]);

  // Face review queue
  const fetchReviewQueue = useCallback(async () => {
    try {
      const { items } = await recognitionV2API.getReviewQueue();
      setReviewItems(items);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchReviewQueue();
    reviewPollRef.current = setInterval(fetchReviewQueue, 5000);
    return () => { if (reviewPollRef.current) clearInterval(reviewPollRef.current); };
  }, [fetchReviewQueue]);

  const handleReviewDecision = async (itemId: string, sectionId: number, decision: 'approve' | 'reject') => {
    try {
      await recognitionV2API.resolveReview(itemId, sectionId, decision);
      setReviewItems(prev => prev.filter(r => r.id !== itemId));
      toast.success(decision === 'approve' ? 'Attendance marked present' : 'Match rejected');
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  // Stats summary
  const totalPeriods = dailyData?.periods.length || 0;
  const totalStudents = dailyData?.periods.reduce((s, p) => s + p.total, 0) || 0;
  const totalPresent = dailyData?.periods.reduce((s, p) => s + p.present_count, 0) || 0;
  const overallPct = totalStudents > 0 ? Math.round(totalPresent / totalStudents * 100) : 0;

  const TABS = [
    { id: 'attendance' as const, label: 'Attendance', icon: <Calendar className="h-4 w-4" /> },
    { id: 'analytics'  as const, label: 'Analytics',  icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'export'     as const, label: 'Export',     icon: <Download className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ─── Header ─── */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Trident Academy of Technology</p>
                <h1 className="text-lg font-semibold text-gray-900">Teacher Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ISTClock variant="light" />
              <button
                onClick={onLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Today's schedule bar ─── */}
      {myScheduleToday.length > 0 && (
        <div className="bg-white/70 backdrop-blur-sm border-b border-indigo-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              <span className="text-xs font-semibold text-gray-500 flex-shrink-0">Today:</span>
              {myScheduleToday.map((slot, i) => (
                <div key={i}
                  className={`flex-shrink-0 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border
                    ${slot.is_active ? 'bg-indigo-100 border-indigo-300 text-indigo-700 shadow-sm' :
                      'bg-white/80 border-gray-200 text-gray-600'}`}>
                  <span className="font-bold">{slot.label}</span>
                  <span className="text-gray-400">·</span>
                  <span>{slot.subject?.name || '—'}</span>
                  <span className="text-gray-400">·</span>
                  <span className={slot.is_active ? 'text-indigo-600 font-medium' : 'text-gray-400'}>
                    {slot.section?.display || '—'}
                  </span>
                  {slot.is_active && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab nav ─── */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 py-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-white/70'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ─── Tab content ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Attendance Tab ── */}
        {activeTab === 'attendance' && (
          <div>
            {/* Date picker + stats row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => fetchDailyData(selectedDate)}
                  className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 text-gray-600 ${loadingDaily ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {/* Mini stats */}
              {dailyData && !dailyData.is_weekend && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">{dailyData.day_name}</span>
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{totalPeriods} periods</span>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{totalPresent}/{totalStudents} present</span>
                  <span className={`font-semibold ${overallPct >= 75 ? 'text-green-600' : overallPct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {overallPct}%
                  </span>
                </div>
              )}
            </div>

            {/* Loading */}
            {loadingDaily && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Loading attendance data...</p>
                </div>
              </div>
            )}

            {/* Weekend */}
            {!loadingDaily && dailyData?.is_weekend && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-lg font-medium text-gray-500">No classes on weekends</p>
                <p className="text-sm text-gray-400 mt-1">{dailyData.day_name} — Select a weekday to view attendance</p>
              </div>
            )}

            {/* No periods */}
            {!loadingDaily && dailyData && !dailyData.is_weekend && dailyData.periods.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-lg font-medium text-gray-500">No scheduled classes found</p>
                <p className="text-sm text-gray-400 mt-1">No schedule entries for {dailyData.day_name}, {selectedDate}</p>
              </div>
            )}

            {/* Period cards */}
            {!loadingDaily && dailyData && !dailyData.is_weekend && dailyData.periods.length > 0 && (
              <div className="space-y-4">
                {dailyData.periods.map((period, i) => (
                  <PeriodCard
                    key={`${period.schedule_id}-${i}`}
                    period={period}
                    selectedDate={selectedDate}
                    onRefresh={() => fetchDailyData(selectedDate)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Analytics Tab ── */}
        {activeTab === 'analytics' && (
          <TeacherAnalytics teacherUserId={user.id} />
        )}

        {/* ── Export Tab ── */}
        {activeTab === 'export' && (
          <ExportTab teacherUserId={user.id} />
        )}
      </div>

      {/* ─── Face Recognition Review Queue (floating) ─── */}
      {reviewItems.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 w-80 shadow-2xl">
          <div
            className="bg-yellow-50 border-2 border-yellow-400 rounded-xl overflow-hidden cursor-pointer"
            onClick={() => setReviewOpen(o => !o)}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-yellow-400">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-yellow-900" />
                <span className="font-semibold text-yellow-900 text-sm">
                  Face Review Queue ({reviewItems.length})
                </span>
              </div>
              <span className="text-yellow-900 text-xs">{reviewOpen ? '▼' : '▲'}</span>
            </div>
            {reviewOpen && (
              <div className="max-h-72 overflow-y-auto divide-y divide-yellow-200">
                {reviewItems.map(item => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          Similarity: {(item.similarity * 100).toFixed(0)}% · Section {item.section_id}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                          onClick={e => { e.stopPropagation(); handleReviewDecision(item.id, item.section_id, 'approve'); }}
                        >
                          ✓ Present
                        </button>
                        <button
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                          onClick={e => { e.stopPropagation(); handleReviewDecision(item.id, item.section_id, 'reject'); }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardIntegrated;
