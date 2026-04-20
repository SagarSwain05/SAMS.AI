import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LogOut, Users, Camera, Settings, UserPlus, Shield, BarChart3,
  MonitorPlay, ScanFace, Home, Calendar, CheckCircle, TrendingUp, ClipboardList,
  Users2, X, Eye, Lock, BookOpen, Briefcase, Phone, Mail,
} from 'lucide-react';
import { recognitionAPI } from '../services/api';
import StudentRegistration from './StudentRegistration';
import CameraFeed from './CameraFeed';
import RecognitionControls from './RecognitionControls';
import AdminLiveView from './AdminLiveView';
import EnrollmentPanel from './EnrollmentPanel';
import UserManagement from './UserManagement';
import AttendanceOverview from './AttendanceOverview';
import TodaySchedule from './TodaySchedule';
import AdminDailyReport from './AdminDailyReport';
import TimetableManager from './TimetableManager';
import AdminAnalytics from './AdminAnalytics';
import ISTClock from './ISTClock';
import toast from 'react-hot-toast';

import { API_BASE as API } from '../config';

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiFetch(path: string, options: RequestInit = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { ...authHeader(), ...(extraHeaders as Record<string, string> ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

interface AdminDashboardProps {
  user: { id: string; username: string; role: string; name: string };
  onLogout: () => void;
}

type TabType = 'overview' | 'students' | 'teachers' | 'recognition' | 'live_feeds' | 'timetable' | 'analytics' | 'daily_report' | 'enrollment' | 'users' | 'settings';

// ── Helpers ───────────────────────────────────────────────────────────────────

function semesterToYear(sem: number) {
  return Math.ceil(sem / 2) || 1;
}

// ── Student Row type ─────────────────────────────────────────────────────────

interface StudentRow {
  id: number;
  name: string;
  email: string;
  roll_number: string;
  department: string;
  section: string;
  class_name: string;
  contact: string;
  current_semester: number;
  branch_id: number | null;
  section_id: number | null;
  branch_code?: string;
  branch_name?: string;
}

// ── Teacher Row type ──────────────────────────────────────────────────────────

interface TeacherSection {
  id: number; name: string; display: string; semester: number;
}
interface TeacherSubject {
  id: number; name: string; code: string;
}
interface TeacherRow {
  id: number;
  user_id: number;
  employee_id: string;
  name: string;
  email: string;
  username: string;
  department: string;
  qualification: string;
  specialization: string;
  joining_date: string | null;
  branch_id: number | null;
  branch_code: string;
  branch_name: string;
  default_password: string;
  sections: TeacherSection[];
  subjects: TeacherSubject[];
  total_classes_per_week: number;
  stats_30d: { present: number; absent: number; total: number; rate: number };
}

// ── Student Detail Modal ──────────────────────────────────────────────────────

interface StudentDetail {
  id: number; name: string; email: string; username?: string;
  roll_number: string; reg_number?: string; department: string;
  college_name?: string; college?: string;
  branch_code?: string; branch_name?: string; section: string;
  section_display?: string; current_semester?: number;
  contact?: string; academic_year_label?: string;
  default_password?: string;
  attendance_summary?: { present: number; absent: number; late: number; total: number; percentage: number };
}

const StudentDetailModal: React.FC<{ studentId: number; onClose: () => void }> = ({ studentId, onClose }) => {
  const [data, setData] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/teachers/student/${studentId}/detail`)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{loading ? 'Loading…' : data?.name}</h3>
              <p className="text-indigo-200 text-xs">Student Details</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading student details…</div>
        ) : !data ? (
          <div className="p-8 text-center text-red-400">Failed to load student details.</div>
        ) : (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Credentials box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
                <Lock className="h-4 w-4" /> Login Credentials
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Username</span>
                <span className="font-mono font-semibold text-gray-800">{data.username || data.roll_number?.toLowerCase()}</span>
                <span className="text-gray-500">Password</span>
                <span className="font-mono font-semibold text-amber-700">{data.default_password || 'Stud@2024'}</span>
              </div>
            </div>

            {/* Profile info */}
            <div className="space-y-3">
              {[
                [<Mail className="h-4 w-4"/>, 'Email', data.email],
                [<BookOpen className="h-4 w-4"/>, 'Roll Number', data.roll_number],
                [<Briefcase className="h-4 w-4"/>, 'Reg Number', data.reg_number || '—'],
                [<Phone className="h-4 w-4"/>, 'Contact', data.contact || '—'],
              ].map(([icon, label, value]: any, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="text-indigo-500 mt-0.5">{icon}</div>
                  <div className="flex-1 flex justify-between">
                    <span className="text-gray-500 text-sm">{label}</span>
                    <span className="text-gray-800 text-sm font-medium text-right">{value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Academic */}
            <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Academic Info</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Branch</span>
                <span className="font-semibold">{data.branch_name || data.department}</span>
                <span className="text-gray-500">Section</span>
                <span className="font-semibold">{data.section_display || data.section}</span>
                <span className="text-gray-500">Semester</span>
                <span className="font-semibold">{data.current_semester || '—'}</span>
                <span className="text-gray-500">Year</span>
                <span className="font-semibold">{data.academic_year_label || '—'}</span>
                <span className="text-gray-500">College</span>
                <span className="font-semibold text-xs">{data.college_name || data.college || 'Trident Academy'}</span>
              </div>
            </div>

            {/* Attendance summary */}
            {data.attendance_summary && (
              <div className="bg-green-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Attendance (This Semester)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Present</span>
                  <span className="font-semibold text-green-700">{data.attendance_summary.present}</span>
                  <span className="text-gray-500">Absent</span>
                  <span className="font-semibold text-red-600">{data.attendance_summary.absent}</span>
                  <span className="text-gray-500">Late</span>
                  <span className="font-semibold text-orange-600">{data.attendance_summary.late}</span>
                  <span className="text-gray-500">Percentage</span>
                  <span className={`font-bold ${data.attendance_summary.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.attendance_summary.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full ${data.attendance_summary.percentage >= 75 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, data.attendance_summary.percentage)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Teacher Detail Modal ──────────────────────────────────────────────────────

const TeacherDetailModal: React.FC<{ teacher: TeacherRow; onClose: () => void }> = ({ teacher, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Users2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">{teacher.name}</h3>
            <p className="text-emerald-200 text-xs">Teacher Details</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Credentials box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
            <Lock className="h-4 w-4" /> Login Credentials
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Username</span>
            <span className="font-mono font-semibold text-gray-800">{teacher.username}</span>
            <span className="text-gray-500">Employee ID</span>
            <span className="font-mono font-semibold text-gray-800">{teacher.employee_id}</span>
            <span className="text-gray-500">Password</span>
            <span className="font-mono font-semibold text-amber-700">{teacher.default_password}</span>
          </div>
        </div>

        {/* Profile info */}
        <div className="space-y-3">
          {[
            [<Mail className="h-4 w-4"/>, 'Email', teacher.email],
            [<Briefcase className="h-4 w-4"/>, 'Department', teacher.department || '—'],
            [<BookOpen className="h-4 w-4"/>, 'Qualification', teacher.qualification || '—'],
            [<Eye className="h-4 w-4"/>, 'Specialization', teacher.specialization || '—'],
            [<Calendar className="h-4 w-4"/>, 'Joining Date', teacher.joining_date || '—'],
          ].map(([icon, label, value]: any, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="text-emerald-500 mt-0.5">{icon}</div>
              <div className="flex-1 flex justify-between">
                <span className="text-gray-500 text-sm">{label}</span>
                <span className="text-gray-800 text-sm font-medium text-right">{value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Branch */}
        <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Branch</p>
          <p className="font-semibold text-gray-800">{teacher.branch_name} <span className="text-gray-400 font-normal">({teacher.branch_code})</span></p>
        </div>

        {/* Assigned Sections */}
        {teacher.sections.length > 0 && (
          <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Assigned Sections ({teacher.sections.length})</p>
            <div className="flex flex-wrap gap-2">
              {teacher.sections.map(sec => (
                <span key={sec.id} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-semibold">
                  {sec.display}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Assigned Subjects */}
        {teacher.subjects.length > 0 && (
          <div className="bg-purple-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Teaching Subjects ({teacher.subjects.length})</p>
            <div className="space-y-1">
              {teacher.subjects.map(sub => (
                <div key={sub.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-800">{sub.name}</span>
                  <span className="font-mono text-xs text-purple-600">{sub.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Attendance Stats (Last 30 Days)</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Classes/Week</span>
            <span className="font-semibold">{teacher.total_classes_per_week}</span>
            <span className="text-gray-500">Present</span>
            <span className="font-semibold text-green-600">{teacher.stats_30d.present}</span>
            <span className="text-gray-500">Absent</span>
            <span className="font-semibold text-red-600">{teacher.stats_30d.absent}</span>
            <span className="text-gray-500">Attendance Rate</span>
            <span className={`font-bold ${teacher.stats_30d.rate >= 75 ? 'text-green-600' : 'text-red-600'}`}>
              {teacher.stats_30d.rate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Tab button ────────────────────────────────────────────────────────────────

const Tab: React.FC<{
  id: TabType; active: TabType; icon: React.ReactNode; label: string;
  onClick: (t: TabType) => void;
}> = ({ id, active, icon, label, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      active === id
        ? 'border-indigo-600 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

// ── Settings Tab ─────────────────────────────────────────────────────────────

interface ModelInfo {
  model: string;
  embedding_dim: number;
  confirm_threshold: number;
  review_threshold: number;
  anti_spoofing: boolean;
  engine_ready: boolean;
  embedding_cache: { students_cached: number; students_in_db: number; total_embeddings: number };
  active_streams: number;
}

const SettingsTab: React.FC<{
  students: StudentRow[];
  uniqueBranches: [string, string][];
  uniqueSections: string[];
  trainLoading: boolean;
  onTrain: () => void;
}> = ({ students, uniqueBranches, uniqueSections, trainLoading, onTrain }) => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchModelInfo = async () => {
    setModelLoading(true);
    try {
      const d = await apiFetch('/v2/recognition/info');
      setModelInfo(d);
    } catch { /* engine may not be ready */ }
    finally { setModelLoading(false); }
  };

  const refreshEmbeddings = async () => {
    setRefreshing(true);
    try {
      await apiFetch('/v2/recognition/embeddings/refresh', { method: 'POST' });
      toast.success('Embedding cache refreshed');
      fetchModelInfo();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setRefreshing(false); }
  };

  useEffect(() => { fetchModelInfo(); }, []);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">System Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Model info card */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Face Recognition Engine</h3>
            <button onClick={fetchModelInfo} className="text-xs text-indigo-600 hover:underline">Refresh</button>
          </div>

          {modelLoading ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-100 rounded" />)}
            </div>
          ) : modelInfo ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Model</span>
                <span className="font-medium text-gray-800 text-right text-xs max-w-[60%] truncate" title={modelInfo.model}>{modelInfo.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Engine Status</span>
                <span className={`font-semibold ${modelInfo.engine_ready ? 'text-green-600' : 'text-red-500'}`}>
                  {modelInfo.engine_ready ? '✓ Ready' : '✗ Not Loaded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Embedding Dim</span>
                <span className="font-medium">{modelInfo.embedding_dim}D</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Confirm Threshold</span>
                <span className="font-medium">dist &lt; {modelInfo.confirm_threshold} ({Math.round((1-modelInfo.confirm_threshold)*100)}% similarity)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Anti-Spoofing</span>
                <span className={`font-semibold ${modelInfo.anti_spoofing ? 'text-green-600' : 'text-gray-400'}`}>
                  {modelInfo.anti_spoofing ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Students Enrolled</span>
                  <span className="font-semibold text-indigo-600">{modelInfo.embedding_cache.students_cached}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Face Embeddings</span>
                  <span className="font-medium">{modelInfo.embedding_cache.total_embeddings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Streams</span>
                  <span className="font-medium">{modelInfo.active_streams}</span>
                </div>
              </div>
              <button
                onClick={refreshEmbeddings}
                disabled={refreshing}
                className="w-full mt-2 py-2 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
              >
                {refreshing ? 'Refreshing…' : 'Refresh Embedding Cache'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Could not load model info — engine may still be loading.</p>
          )}
        </div>

        {/* DB stats */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Database Stats</h3>
          <div className="space-y-2 text-sm">
            {([
              ['Total Students', students.length],
              ['Branches', uniqueBranches.length],
              ['Sections', uniqueSections.length],
            ] as [string, number][]).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-gray-500">Backend</span>
              <span className="text-green-600 font-semibold flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Connected
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">LBPH Fallback Model</h4>
            <p className="text-xs text-gray-400 mb-3">
              Retrain the OpenCV LBPH fallback from face images in dataset/. InsightFace (primary) uses DB embeddings and never needs retraining.
            </p>
            <button
              onClick={onTrain}
              disabled={trainLoading}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg
                         hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 text-sm"
            >
              {trainLoading ? 'Training…' : 'Train LBPH Model'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

// Map URL segment → tab id
const TAB_PATHS: Record<string, TabType> = {
  '':             'overview',
  'overview':     'overview',
  'students':     'students',
  'teachers':     'teachers',
  'recognition':  'recognition',
  'live-feeds':   'live_feeds',
  'timetable':    'timetable',
  'analytics':    'analytics',
  'daily-report': 'daily_report',
  'enrollment':   'enrollment',
  'users':        'users',
  'settings':     'settings',
};
const TAB_TO_PATH: Record<TabType, string> = {
  overview:      '/admin',
  students:      '/admin/students',
  teachers:      '/admin/teachers',
  recognition:   '/admin/recognition',
  live_feeds:    '/admin/live-feeds',
  timetable:     '/admin/timetable',
  analytics:     '/admin/analytics',
  daily_report:  '/admin/daily-report',
  enrollment:    '/admin/enrollment',
  users:         '/admin/users',
  settings:      '/admin/settings',
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // Derive active tab from URL path segment after /admin/
  const pathSegment = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const activeTab: TabType = TAB_PATHS[pathSegment] ?? 'overview';
  const setActiveTab = (tab: TabType) => navigate(TAB_TO_PATH[tab], { replace: false });

  // ── Student state ─────────────────────────────────────────────────────────
  const [students, setStudents]       = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  // Student filters
  const [searchTerm, setSearch]       = useState('');
  const [branchFilter, setBranch]     = useState('');
  const [sectionFilter, setSection]   = useState('');
  const [yearFilter, setYear]         = useState('');

  // ── Teacher state ─────────────────────────────────────────────────────────
  const [teachers, setTeachers]           = useState<TeacherRow[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherBranchFilter, setTeacherBranch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const fetchTeachers = async () => {
    setTeachersLoading(true);
    try {
      const res = await apiFetch('/teachers');
      setTeachers(res.teachers || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load teachers');
    } finally {
      setTeachersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'teachers' && teachers.length === 0) fetchTeachers();
  }, [activeTab]);

  const uniqueTeacherBranches = Array.from(
    new Map(teachers.map(t => [t.branch_code, t.branch_name]))
  );

  const filteredTeachers = teachers.filter(t => {
    const matchSearch = !teacherSearch ||
      t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      t.employee_id.toLowerCase().includes(teacherSearch.toLowerCase());
    const matchBranch = !teacherBranchFilter || t.branch_code === teacherBranchFilter;
    return matchSearch && matchBranch;
  });

  // ── Recognition state ─────────────────────────────────────────────────────
  const [isRecognitionActive, setRecognitionActive] = useState(false);
  const [recognitionResults, setRecognitionResults] = useState<unknown[]>([]);

  // ── Settings state ────────────────────────────────────────────────────────
  const [trainLoading, setTrainLoading] = useState(false);

  // Fetch students once on mount (and on demand)
  const fetchStudents = async () => {
    setStudentsLoading(true);
    try {
      const res = await apiFetch('/students');
      setStudents(res.students || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  // ── Derived filters ───────────────────────────────────────────────────────
  const uniqueBranches = Array.from(
    new Map(students.map(s => [s.branch_code || s.class_name, s.branch_name || s.class_name]))
  );
  const uniqueSections = Array.from(new Set(students.map(s => s.section).filter(Boolean))).sort();
  const uniqueYears    = [1, 2, 3, 4];

  const filtered = students.filter(s => {
    const matchSearch  = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase())
      || s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchBranch  = !branchFilter || (s.branch_code || s.class_name) === branchFilter;
    const matchSection = !sectionFilter || s.section === sectionFilter;
    const matchYear    = !yearFilter || semesterToYear(s.current_semester) === Number(yearFilter);
    return matchSearch && matchBranch && matchSection && matchYear;
  });

  // ── Delete student ────────────────────────────────────────────────────────
  const handleDeleteStudent = async (studentId: number) => {
    if (!window.confirm('Delete this student? This cannot be undone.')) return;
    try {
      await fetch(`${API}/students/${studentId}`, { method: 'DELETE', headers: authHeader() });
      toast.success('Student deleted');
      fetchStudents();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  // ── Train model ───────────────────────────────────────────────────────────
  const handleTrainModel = async () => {
    setTrainLoading(true);
    const tid = toast.loading('Training model…');
    try {
      await recognitionAPI.trainModel();
      toast.dismiss(tid);
      toast.success('Model trained successfully!');
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.message || 'Training failed');
    } finally {
      setTrainLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">

      {/* Header */}
      <header className="bg-white shadow-md border-b-2 border-indigo-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Clock bar */}
          <div className="flex justify-center mb-2 pb-2 border-b border-gray-100">
            <ISTClock variant="light" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Trident Academy of Technology</p>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Full System Control &amp; Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">

          {/* Tab bar */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
              <Tab id="overview"     active={activeTab} onClick={setActiveTab} icon={<Home className="h-4 w-4" />}        label="Overview" />
              <Tab id="students"     active={activeTab} onClick={setActiveTab} icon={<Users className="h-4 w-4" />}       label="Students" />
              <Tab id="teachers"     active={activeTab} onClick={setActiveTab} icon={<Users2 className="h-4 w-4" />}      label="Teachers" />
              <Tab id="recognition"  active={activeTab} onClick={setActiveTab} icon={<Camera className="h-4 w-4" />}      label="Recognition" />
              <Tab id="live_feeds"   active={activeTab} onClick={setActiveTab} icon={<MonitorPlay className="h-4 w-4" />} label="Live Feeds" />
              <Tab id="timetable"    active={activeTab} onClick={setActiveTab} icon={<Calendar className="h-4 w-4" />}    label="Timetable" />
              <Tab id="analytics"    active={activeTab} onClick={setActiveTab} icon={<TrendingUp className="h-4 w-4" />}     label="Analytics" />
              <Tab id="daily_report" active={activeTab} onClick={setActiveTab} icon={<ClipboardList className="h-4 w-4" />} label="Daily Report" />
              <Tab id="enrollment"   active={activeTab} onClick={setActiveTab} icon={<ScanFace className="h-4 w-4" />}      label="Enroll Faces" />
              <Tab id="users"        active={activeTab} onClick={setActiveTab} icon={<UserPlus className="h-4 w-4" />}    label="User Management" />
              <Tab id="settings"     active={activeTab} onClick={setActiveTab} icon={<Settings className="h-4 w-4" />}    label="Settings" />
            </nav>
          </div>

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Attendance Overview</h2>
                <p className="text-sm text-gray-400">Branch &amp; section wise · live</p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: attendance summary (takes 2/3 width on xl) */}
                <div className="xl:col-span-2">
                  <AttendanceOverview />
                </div>
                {/* Right: today's class schedule */}
                <div className="xl:col-span-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <TodaySchedule />
                </div>
              </div>
            </div>
          )}

          {/* ── STUDENTS ─────────────────────────────────────────────────── */}
          {activeTab === 'students' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Student Database</h2>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  <UserPlus className="h-4 w-4" /> Register Student
                </button>
              </div>

              {/* Filters row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="Search name / roll…"
                  value={searchTerm}
                  onChange={e => setSearch(e.target.value)}
                  className="col-span-2 md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <select value={branchFilter} onChange={e => setBranch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">All Branches</option>
                  {uniqueBranches.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <select value={sectionFilter} onChange={e => setSection(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">All Sections</option>
                  {uniqueSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
                <select value={yearFilter} onChange={e => setYear(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">All Years</option>
                  {uniqueYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Students', value: students.length, color: 'from-blue-500 to-blue-600' },
                  { label: 'Filtered', value: filtered.length, color: 'from-indigo-500 to-indigo-600' },
                  { label: 'Branches', value: uniqueBranches.length, color: 'from-purple-500 to-purple-600' },
                  { label: 'Sections', value: uniqueSections.length, color: 'from-pink-500 to-pink-600' },
                ].map(c => (
                  <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-lg p-4 text-white`}>
                    <p className="text-xs opacity-80">{c.label}</p>
                    <p className="text-3xl font-bold mt-1">{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Student', 'Roll Number', 'Branch', 'Section', 'Year / Sem', 'Contact', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentsLoading ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
                      ) : filtered.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No students found</td></tr>
                      ) : filtered.map(s => {
                        const year = semesterToYear(s.current_semester);
                        return (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedStudentId(s.id)}
                                className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline text-left"
                              >
                                {s.name}
                              </button>
                              <div className="text-xs text-gray-400">{s.email}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700">{s.roll_number}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {s.branch_name || s.department || s.class_name}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold">
                                {s.section}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              <span className="font-semibold text-purple-700">Y{year}</span>
                              <span className="text-gray-400 ml-1">/ Sem {s.current_semester}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{s.contact || '—'}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleDeleteStudent(s.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium">
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TEACHERS ─────────────────────────────────────────────────── */}
          {activeTab === 'teachers' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Teacher Directory</h2>
                <button
                  onClick={fetchTeachers}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Refresh
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Search name / employee ID…"
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <select value={teacherBranchFilter} onChange={e => setTeacherBranch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">All Branches</option>
                  {uniqueTeacherBranches.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Teachers', value: teachers.length, color: 'from-emerald-500 to-emerald-600' },
                  { label: 'Filtered', value: filteredTeachers.length, color: 'from-teal-500 to-teal-600' },
                  { label: 'Branches', value: uniqueTeacherBranches.length, color: 'from-cyan-500 to-cyan-600' },
                  { label: 'Total Classes/Week', value: teachers.reduce((a, t) => a + (t.total_classes_per_week || 0), 0), color: 'from-blue-500 to-blue-600' },
                ].map(c => (
                  <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-lg p-4 text-white`}>
                    <p className="text-xs opacity-80">{c.label}</p>
                    <p className="text-3xl font-bold mt-1">{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Teacher', 'Employee ID', 'Branch', 'Sections', 'Subjects', 'Classes/Wk', '30d Rate', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {teachersLoading ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading teachers…</td></tr>
                      ) : filteredTeachers.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No teachers found</td></tr>
                      ) : filteredTeachers.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedTeacher(t)}
                              className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline text-left"
                            >
                              {t.name}
                            </button>
                            <div className="text-xs text-gray-400">{t.email}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700 text-xs">{t.employee_id}</td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">
                              {t.branch_code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {t.sections.slice(0, 3).map(sec => (
                                <span key={sec.id} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">
                                  {sec.display}
                                </span>
                              ))}
                              {t.sections.length > 3 && (
                                <span className="text-xs text-gray-400">+{t.sections.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {t.subjects.slice(0, 2).map(sub => (
                                <span key={sub.id} className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                                  {sub.code}
                                </span>
                              ))}
                              {t.subjects.length > 2 && (
                                <span className="text-xs text-gray-400">+{t.subjects.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-700">{t.total_classes_per_week}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold text-sm ${t.stats_30d.rate >= 75 ? 'text-green-600' : 'text-red-500'}`}>
                              {t.stats_30d.rate}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedTeacher(t)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-900"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RECOGNITION ──────────────────────────────────────────────── */}
          {activeTab === 'recognition' && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Face Recognition Center</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Start the campus-wide recognition server — attendance marks automatically per timetable.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Camera feed */}
                <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                    <span className="text-white text-sm font-medium">Campus Camera</span>
                    {isRecognitionActive && (
                      <span className="flex items-center gap-1.5 text-green-400 text-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        LIVE
                      </span>
                    )}
                  </div>
                  {isRecognitionActive ? (
                    <img
                      src={`${API}/v2/recognition/live_feed/0`}
                      alt="Campus Live Feed"
                      className="w-full object-contain"
                      style={{ minHeight: '280px', background: '#000' }}
                    />
                  ) : (
                    <div className="aspect-video flex flex-col items-center justify-center text-gray-400 bg-gray-800">
                      <Camera className="h-16 w-16 mb-4 opacity-50" />
                      <p className="text-sm">Camera Feed Inactive</p>
                      <p className="text-xs mt-1 opacity-75">Start recognition to view campus feed</p>
                    </div>
                  )}
                </div>
                {/* Controls */}
                <RecognitionControls
                  onSessionStart={() => setRecognitionActive(true)}
                  onSessionStop={() => setRecognitionActive(false)}
                  onRecognitionUpdate={setRecognitionResults}
                />
              </div>
            </div>
          )}

          {/* ── LIVE FEEDS ────────────────────────────────────────────────── */}
          {activeTab === 'live_feeds' && (
            <div className="p-4 bg-gray-950 min-h-[600px]">
              <AdminLiveView />
            </div>
          )}

          {/* ── TIMETABLE ────────────────────────────────────────────────── */}
          {activeTab === 'timetable' && (
            <div className="p-6">
              <TimetableManager />
            </div>
          )}

          {/* ── ANALYTICS ───────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="p-6">
              <AdminAnalytics />
            </div>
          )}

          {/* ── DAILY REPORT ─────────────────────────────────────────────── */}
          {activeTab === 'daily_report' && (
            <div className="p-6">
              <AdminDailyReport />
            </div>
          )}

          {/* ── ENROLL FACES ─────────────────────────────────────────────── */}
          {activeTab === 'enrollment' && (
            <div className="p-6">
              <EnrollmentPanel />
            </div>
          )}

          {/* ── USER MANAGEMENT ──────────────────────────────────────────── */}
          {activeTab === 'users' && (
            <UserManagement />
          )}

          {/* ── SETTINGS ─────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <SettingsTab
              students={students}
              uniqueBranches={uniqueBranches}
              uniqueSections={uniqueSections}
              trainLoading={trainLoading}
              onTrain={handleTrainModel}
            />
          )}

        </div>
      </div>

      {/* Registration modal */}
      <StudentRegistration
        isOpen={showRegistration}
        onClose={() => setShowRegistration(false)}
        onSuccess={() => { setShowRegistration(false); fetchStudents(); }}
      />

      {/* Student detail modal */}
      {selectedStudentId !== null && (
        <StudentDetailModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      )}

      {/* Teacher detail modal */}
      {selectedTeacher !== null && (
        <TeacherDetailModal
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
