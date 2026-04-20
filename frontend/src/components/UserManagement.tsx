/**
 * UserManagement — Admin CRUD for Students and Teachers
 * Features:
 *  - List all users (filterable by role/search)
 *  - Add Student: full form with branch/section picklists + face enrollment webcam
 *  - Add Teacher: form with branch picklist
 *  - Edit user (name, email, reset password)
 *  - Delete user
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';

import { API_BASE as API } from '../config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch  { id: number; name: string; code: string; total_semesters: number; }
interface Section { id: number; name: string; branch_id: number; branch_code: string; display: string; current_semester: number; }

interface UserRow {
  id: number; username: string; name: string; email: string; role: string;
  student?: { id: number; roll_number: string; section: string; department: string; branch_id: number; };
  teacher?: { id: number; employee_id: string; department: string; branch_id: number; };
}

type Modal = 'none' | 'add-student' | 'add-teacher' | 'edit';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const DEPARTMENTS = ['Mathematics', 'Physics', 'Chemistry', 'English', 'Drawing',
  'Computer Science', 'Electronics', 'Electrical', 'Civil', 'Mechanical'];

// ── Student Form ──────────────────────────────────────────────────────────────

interface StudentFormProps {
  branches: Branch[];
  sections: Section[];
  onSectionsLoad: (branchId: number) => void;
  onSuccess: () => void;
  onClose: () => void;
}

const StudentForm: React.FC<StudentFormProps> = ({ branches, sections, onSectionsLoad, onSuccess, onClose }) => {
  const [form, setForm] = useState({
    name: '', email: '', roll_number: '', reg_number: '',
    branch_id: '', section_id: '', department: '', college: 'College of Engineering',
    contact: '', password: 'Stud@2024', semester: '',
  });
  const [faceImages, setFaceImages] = useState<string[]>([]);
  const [step, setStep] = useState<'form' | 'face'>('form');
  const [loading, setLoading] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm(p => ({ ...p, branch_id: e.target.value, section_id: '' }));
    if (e.target.value) onSectionsLoad(parseInt(e.target.value));
  };

  const capture = () => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) return;
    setFaceImages(p => [...p, img].slice(0, 8));
    toast.success(`Frame ${faceImages.length + 1} captured`);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.roll_number || !form.branch_id || !form.section_id) {
      toast.error('Fill all required fields'); return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        branch_id: parseInt(form.branch_id),
        section_id: parseInt(form.section_id),
        semester: form.semester ? parseInt(form.semester) : undefined,
        face_images: faceImages,
      };
      const res = await apiFetch('/users/create-student', { method: 'POST', body: JSON.stringify(payload) });
      toast.success(`Student created! Login: ${res.username} / ${res.password}${res.faces_enrolled > 0 ? ` · ${res.faces_enrolled} face(s) enrolled` : ''}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredSections = sections.filter(s => !form.branch_id || s.branch_id === parseInt(form.branch_id));

  if (step === 'face') {
    return (
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">
          Capture Face Images <span className="text-gray-400 text-sm">(optional, {faceImages.length}/8)</span>
        </h3>
        <div className="rounded-xl overflow-hidden bg-black relative">
          <Webcam ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={0.9}
            videoConstraints={{ width: 480, height: 360, facingMode: 'user' }}
            className="w-full" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-blue-400/60 rounded-full" style={{ width: '40%', height: '68%' }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {faceImages.map((img, i) => (
            <div key={i} className="relative group">
              <img src={img} className="w-14 h-14 object-cover rounded border border-gray-300" />
              <button onClick={() => setFaceImages(p => p.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full
                           opacity-0 group-hover:opacity-100 flex items-center justify-center">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={capture} disabled={faceImages.length >= 8}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm disabled:opacity-40">
            Capture Frame
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm disabled:opacity-40">
            {loading ? 'Creating…' : 'Create Student'}
          </button>
        </div>
        <button onClick={() => setStep('form')} className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700">
          ← Back to form
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[
        { label: 'Full Name *', key: 'name', ph: 'Ravi Kumar' },
        { label: 'Email *', key: 'email', ph: 'ravi@college.edu' },
        { label: 'Roll Number *', key: 'roll_number', ph: 'CSE2024001' },
        { label: 'Registration Number *', key: 'reg_number', ph: '24BTCSE001' },
        { label: 'College', key: 'college', ph: 'College of Engineering' },
        { label: 'Contact', key: 'contact', ph: '9999999999' },
        { label: 'Password', key: 'password', ph: 'Stud@2024' },
      ].map(({ label, key, ph }) => (
        <div key={key}>
          <label className="block text-xs text-gray-600 mb-0.5">{label}</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
            placeholder={ph} value={form[key as keyof typeof form]} onChange={set(key)} />
        </div>
      ))}

      {/* Branch picklist */}
      <div>
        <label className="block text-xs text-gray-600 mb-0.5">Branch *</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={form.branch_id} onChange={handleBranchChange}>
          <option value="">— Select Branch —</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
        </select>
      </div>

      {/* Section picklist */}
      <div>
        <label className="block text-xs text-gray-600 mb-0.5">Section *</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={form.section_id} onChange={set('section_id')} disabled={!form.branch_id}>
          <option value="">— Select Section —</option>
          {filteredSections.map(s => <option key={s.id} value={s.id}>{s.display}</option>)}
        </select>
      </div>

      {/* Department */}
      <div>
        <label className="block text-xs text-gray-600 mb-0.5">Department</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={form.department} onChange={set('department')}>
          <option value="">— Select —</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Semester */}
      <div>
        <label className="block text-xs text-gray-600 mb-0.5">Semester</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={form.semester} onChange={set('semester')}>
          <option value="">— Auto (from section) —</option>
          {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Semester {n}</option>)}
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={() => setStep('face')}
          disabled={!form.name || !form.email || !form.roll_number || !form.branch_id || !form.section_id}
          className="px-4 border border-blue-500 text-blue-600 py-2 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-40">
          + Add Face
        </button>
        <button onClick={handleSubmit} disabled={loading || !form.name || !form.email || !form.roll_number || !form.branch_id || !form.section_id}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm disabled:opacity-40">
          {loading ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>
  );
};

// ── Teacher Form ──────────────────────────────────────────────────────────────

interface TeacherFormProps {
  branches: Branch[];
  onSuccess: () => void;
  onClose: () => void;
}

const TeacherForm: React.FC<TeacherFormProps> = ({ branches, onSuccess, onClose }) => {
  const [form, setForm] = useState({
    name: '', email: '', employee_id: '', branch_id: '',
    department: '', qualification: '', specialization: '', password: 'Teacher@2024',
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.employee_id || !form.branch_id || !form.department) {
      toast.error('Fill all required fields'); return;
    }
    setLoading(true);
    try {
      const payload = { ...form, branch_id: parseInt(form.branch_id) };
      const res = await apiFetch('/users/create-teacher', { method: 'POST', body: JSON.stringify(payload) });
      toast.success(`Teacher created! Login: ${res.username} / ${res.password}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {[
        { label: 'Full Name *', key: 'name', ph: 'Dr. Rajesh Kumar' },
        { label: 'Email *', key: 'email', ph: 'rajesh@college.edu' },
        { label: 'Employee ID *', key: 'employee_id', ph: 'TCSE006' },
        { label: 'Qualification', key: 'qualification', ph: 'M.Tech, Ph.D' },
        { label: 'Specialization', key: 'specialization', ph: 'Machine Learning' },
        { label: 'Password', key: 'password', ph: 'Teacher@2024' },
      ].map(({ label, key, ph }) => (
        <div key={key}>
          <label className="block text-xs text-gray-600 mb-0.5">{label}</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
            placeholder={ph} value={form[key as keyof typeof form]} onChange={set(key)} />
        </div>
      ))}

      <div>
        <label className="block text-xs text-gray-600 mb-0.5">Branch *</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={form.branch_id} onChange={set('branch_id')}>
          <option value="">— Select Branch —</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-0.5">Department *</label>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={form.department} onChange={set('department')}>
          <option value="">— Select —</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm disabled:opacity-40">
          {loading ? 'Creating…' : 'Create Teacher'}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const UserManagement: React.FC = () => {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading]   = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState<Modal>('none');
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (search)     params.set('search', search);
      const res = await apiFetch(`/users?${params}`);
      setUsers(res.users);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    apiFetch('/branches').then(setBranches).catch(() => {});
    apiFetch('/sections').then(setSections).catch(() => {});
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const loadSectionsForBranch = async (branchId: number) => {
    const res = await apiFetch(`/sections?branch_id=${branchId}`).catch(() => ({ }));
    if (Array.isArray(res)) setSections(res);
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      toast.success('User deleted');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, password: '' });
    setModal('edit');
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    try {
      await apiFetch(`/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      toast.success('User updated');
      setModal('none');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEnrollFace = async (studentId: number) => {
    // Open enrollment panel in modal — just redirect admin to Enroll tab
    toast('Open the "Enroll Faces" tab and select this student to add face images.', { icon: '💡', duration: 4000 });
  };

  const roleColor = (role: string) =>
    role === 'admin' ? 'bg-purple-100 text-purple-700' :
    role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500">{users.length} users found</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('add-student')}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
            + Add Student
          </button>
          <button onClick={() => setModal('add-teacher')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
            + Add Teacher
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:border-blue-500 outline-none"
          placeholder="Search name or username…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
      </div>

      {/* User Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Username', 'Email', 'Role', 'Details', 'Face', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(u.role)}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.student ? `${u.student.roll_number} · ${u.student.section}` :
                     u.teacher ? u.teacher.employee_id : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'student' && (
                      <button onClick={() => u.student && handleEnrollFace(u.student.id)}
                        className="text-xs text-blue-600 hover:underline">
                        + Face
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(u)}
                        className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => handleDelete(u.id, u.username)}
                        className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {(modal === 'add-student' || modal === 'add-teacher' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {modal === 'add-student' ? 'Add New Student' :
                 modal === 'add-teacher' ? 'Add New Teacher' : `Edit — ${editUser?.name}`}
              </h2>
              <button onClick={() => setModal('none')} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5">
              {modal === 'add-student' && (
                <StudentForm
                  branches={branches} sections={sections}
                  onSectionsLoad={loadSectionsForBranch}
                  onSuccess={() => { setModal('none'); fetchUsers(); }}
                  onClose={() => setModal('none')}
                />
              )}
              {modal === 'add-teacher' && (
                <TeacherForm
                  branches={branches}
                  onSuccess={() => { setModal('none'); fetchUsers(); }}
                  onClose={() => setModal('none')}
                />
              )}
              {modal === 'edit' && editUser && (
                <div className="space-y-3">
                  {[
                    { label: 'Name', key: 'name' },
                    { label: 'Email', key: 'email' },
                    { label: 'New Password (leave blank to keep)', key: 'password' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-600 mb-0.5">{label}</label>
                      <input
                        type={key === 'password' ? 'password' : 'text'}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                        value={editForm[key as keyof typeof editForm]}
                        onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setModal('none')}
                      className="flex-1 border border-gray-300 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleEditSave}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm">Save</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
