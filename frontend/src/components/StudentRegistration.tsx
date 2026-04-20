import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { X, Camera, CheckCircle, User, Mail, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

import { API_BASE as API } from '../config';

interface Branch  { id: number; name: string; code: string; total_semesters: number; }
interface Section { id: number; name: string; branch_id: number; display: string; current_semester: number; }

const DEPARTMENTS = [
  'Computer Science', 'Electronics', 'Electrical', 'Civil', 'Mechanical',
  'Mathematics', 'Physics', 'Chemistry', 'English', 'Drawing',
];

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

interface StudentRegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const StudentRegistration: React.FC<StudentRegistrationProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roll_number: '',
    reg_number: '',
    department: '',
    college: 'College of Engineering',
    contact: '',
    password: 'Stud@2024',
    branch_id: '',
    section_id: '',
    semester: '',
  });
  const [faceImages, setFaceImages] = useState<string[]>([]);
  const [captureCount, setCaptureCount] = useState(0);
  const webcamRef = useRef<Webcam>(null);
  const TARGET_IMAGES = 5;

  useEffect(() => {
    if (!isOpen) return;
    apiFetch('/branches').then(setBranches).catch(() => {});
  }, [isOpen]);

  const handleBranchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branchId = e.target.value;
    setFormData(p => ({ ...p, branch_id: branchId, section_id: '' }));
    if (branchId) {
      const res = await apiFetch(`/sections?branch_id=${branchId}`).catch(() => []);
      if (Array.isArray(res)) setSections(res);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      name: '', email: '', roll_number: '', reg_number: '',
      department: '', college: 'College of Engineering',
      contact: '', password: 'Stud@2024',
      branch_id: '', section_id: '', semester: '',
    });
    setFaceImages([]);
    setCaptureCount(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.roll_number || !formData.reg_number) {
      toast.error('Please fill in all required fields'); return;
    }
    if (!formData.branch_id || !formData.section_id) {
      toast.error('Please select Branch and Section'); return;
    }
    setStep(2);
  };

  const captureFaceImage = useCallback(() => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) { toast.error('Failed to capture image'); return; }

    const newImages = [...faceImages, imageSrc];
    setFaceImages(newImages);
    setCaptureCount(newImages.length);
    toast.success(`Image ${newImages.length}/${TARGET_IMAGES} captured`);

    if (newImages.length >= TARGET_IMAGES) {
      setTimeout(() => handleRegistrationSubmit(newImages), 500);
    }
  }, [faceImages]);

  const handleRegistrationSubmit = async (images: string[]) => {
    try {
      setLoading(true);
      const payload = {
        ...formData,
        branch_id: parseInt(formData.branch_id),
        section_id: parseInt(formData.section_id),
        semester: formData.semester ? parseInt(formData.semester) : undefined,
        face_images: images,
      };
      const res = await apiFetch('/users/create-student', { method: 'POST', body: JSON.stringify(payload) });
      toast.success(`Student registered! Login: ${res.username} / ${res.password}${res.faces_enrolled > 0 ? ` · ${res.faces_enrolled} faces enrolled` : ''}`);
      setStep(3);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredSections = sections.filter(s => !formData.branch_id || s.branch_id === parseInt(formData.branch_id));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={() => { if (!loading) { resetForm(); onClose(); } }}
        />

        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg">
                <User className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Student Registration</h3>
                <p className="text-sm text-indigo-100">Step {step} of 3</p>
              </div>
            </div>
            <button
              onClick={() => { if (!loading) { resetForm(); onClose(); } }}
              disabled={loading}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-gray-200">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div className="px-6 py-6">
            {/* Step 1: Form */}
            {step === 1 && (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" name="name" required value={formData.name} onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Ravi Kumar" />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="email" name="email" required value={formData.email} onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="ravi@college.edu" />
                    </div>
                  </div>

                  {/* Roll Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" name="roll_number" required value={formData.roll_number} onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="CSE2024076" />
                    </div>
                  </div>

                  {/* Reg Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" name="reg_number" required value={formData.reg_number} onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="24BTCSE076" />
                    </div>
                  </div>

                  {/* Branch picklist */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
                    <select name="branch_id" value={formData.branch_id} onChange={handleBranchChange} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                      <option value="">— Select Branch —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                    </select>
                  </div>

                  {/* Section picklist */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section <span className="text-red-500">*</span></label>
                    <select name="section_id" value={formData.section_id} onChange={handleInputChange} required
                      disabled={!formData.branch_id}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400">
                      <option value="">— Select Section —</option>
                      {filteredSections.map(s => <option key={s.id} value={s.id}>{s.display}</option>)}
                    </select>
                  </div>

                  {/* Department picklist */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select name="department" value={formData.department} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                      <option value="">— Select —</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* Semester picklist */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <select name="semester" value={formData.semester} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                      <option value="">— Auto from section —</option>
                      {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Semester {n}</option>)}
                    </select>
                  </div>

                  {/* College */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">College</label>
                    <input type="text" name="college" value={formData.college} onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="College of Engineering" />
                  </div>

                  {/* Contact */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                    <input type="text" name="contact" value={formData.contact} onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="+91 9876543210" />
                  </div>

                  {/* Password */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="text" name="password" value={formData.password} onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Stud@2024" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { resetForm(); onClose(); }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Next: Capture Face
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Face Capture */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Capture Face Images</h4>
                  <p className="text-sm text-gray-600">
                    We need {TARGET_IMAGES} face images for accurate recognition.
                    Look directly at the camera and capture from slightly different angles.
                  </p>
                </div>

                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                  <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                    className="w-full" videoConstraints={{ width: 640, height: 480, facingMode: 'user' }} />
                  {/* Face guide oval */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-blue-400/70 rounded-full" style={{ width: '38%', height: '72%' }} />
                  </div>
                  <div className="absolute top-4 right-4 bg-black/70 rounded-lg px-4 py-2">
                    <p className="text-white font-medium">{captureCount} / {TARGET_IMAGES}</p>
                  </div>
                </div>

                {faceImages.length > 0 && (
                  <div className="grid grid-cols-5 gap-2">
                    {faceImages.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img} alt={`Capture ${i + 1}`} className="w-full h-20 object-cover rounded-lg border-2 border-green-500" />
                        <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-4">
                  <button type="button" onClick={() => setStep(1)} disabled={loading}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
                    Back
                  </button>
                  <button type="button" onClick={captureFaceImage}
                    disabled={loading || captureCount >= TARGET_IMAGES}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    <Camera className="h-5 w-5" />
                    {loading ? 'Processing...' : `Capture (${captureCount}/${TARGET_IMAGES})`}
                  </button>
                  <button type="button"
                    onClick={() => handleRegistrationSubmit(faceImages)}
                    disabled={loading || faceImages.length === 0}
                    className="px-4 py-2 text-indigo-600 border border-indigo-500 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                    Skip &amp; Submit
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Registration Complete!</h4>
                <p className="text-gray-600">Student registered successfully with face recognition enabled.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegistration;
