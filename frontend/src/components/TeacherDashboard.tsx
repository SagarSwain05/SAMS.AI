import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  FileText, 
  Download, 
  Edit3, 
  LogOut,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Search
} from 'lucide-react';
import { User, Student, AttendanceRecord } from '../App';
import AttendanceModal from './AttendanceModal';

interface TeacherDashboardProps {
  user: User;
  onLogout: () => void;
}

// Mock data
const mockStudents: Student[] = [
  { id: '1', name: 'Arjun Patel', rollNumber: 'CS001', regdNumber: 'REG2024001', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'arjun.patel@iit.ac.in', phone: '+91 9876543210', status: 'present', entryTime: '09:15 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 42, percentage: 93.3, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 38, percentage: 95.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '2', name: 'Sneha Gupta', rollNumber: 'CS002', regdNumber: 'REG2024002', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'sneha.gupta@iit.ac.in', phone: '+91 9876543211', status: 'present', entryTime: '09:10 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 44, percentage: 97.8, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 39, percentage: 97.5, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '3', name: 'Rahul Sharma', rollNumber: 'CS003', regdNumber: 'REG2024003', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'rahul.sharma@iit.ac.in', phone: '+91 9876543212', status: 'late', entryTime: '09:25 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 40, percentage: 88.9, lastAttended: '2025-01-20', status: 'late' }, 'Database Systems': { totalClasses: 40, attendedClasses: 35, percentage: 87.5, lastAttended: '2025-01-18', status: 'absent' } } },
  { id: '4', name: 'Priya Singh', rollNumber: 'CS004', regdNumber: 'REG2024004', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'priya.singh@iit.ac.in', phone: '+91 9876543213', status: 'absent', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 38, percentage: 84.4, lastAttended: '2025-01-18', status: 'absent' }, 'Database Systems': { totalClasses: 40, attendedClasses: 32, percentage: 80.0, lastAttended: '2025-01-17', status: 'absent' } } },
  { id: '5', name: 'Vikram Reddy', rollNumber: 'CS005', regdNumber: 'REG2024005', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'vikram.reddy@iit.ac.in', phone: '+91 9876543214', status: 'present', entryTime: '09:05 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 43, percentage: 95.6, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 37, percentage: 92.5, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '6', name: 'Ananya Iyer', rollNumber: 'CS006', regdNumber: 'REG2024006', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'ananya.iyer@iit.ac.in', phone: '+91 9876543215', status: 'present', entryTime: '09:12 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 45, percentage: 100.0, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 40, percentage: 100.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '7', name: 'Karthik Nair', rollNumber: 'CS007', regdNumber: 'REG2024007', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'B', email: 'karthik.nair@iit.ac.in', phone: '+91 9876543216', status: 'present', entryTime: '09:08 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 41, percentage: 91.1, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 36, percentage: 90.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '8', name: 'Meera Joshi', rollNumber: 'CS008', regdNumber: 'REG2024008', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'B', email: 'meera.joshi@iit.ac.in', phone: '+91 9876543217', status: 'late', entryTime: '09:22 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 39, percentage: 86.7, lastAttended: '2025-01-20', status: 'late' }, 'Database Systems': { totalClasses: 40, attendedClasses: 34, percentage: 85.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '9', name: 'Aditya Agarwal', rollNumber: 'CS009', regdNumber: 'REG2024009', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'B', email: 'aditya.agarwal@iit.ac.in', phone: '+91 9876543218', status: 'present', entryTime: '09:14 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 42, percentage: 93.3, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 38, percentage: 95.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '10', name: 'Kavya Menon', rollNumber: 'CS010', regdNumber: 'REG2024010', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'B', email: 'kavya.menon@iit.ac.in', phone: '+91 9876543219', status: 'absent', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 35, percentage: 77.8, lastAttended: '2025-01-17', status: 'absent' }, 'Database Systems': { totalClasses: 40, attendedClasses: 30, percentage: 75.0, lastAttended: '2025-01-16', status: 'absent' } } },
  { id: '11', name: 'Rohan Verma', rollNumber: 'CS011', regdNumber: 'REG2024011', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'C', email: 'rohan.verma@iit.ac.in', phone: '+91 9876543220', status: 'present', entryTime: '09:11 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 44, percentage: 97.8, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 39, percentage: 97.5, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '12', name: 'Ishita Bansal', rollNumber: 'CS012', regdNumber: 'REG2024012', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'C', email: 'ishita.bansal@iit.ac.in', phone: '+91 9876543221', status: 'present', entryTime: '09:07 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 43, percentage: 95.6, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 38, percentage: 95.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '13', name: 'Siddharth Kapoor', rollNumber: 'CS013', regdNumber: 'REG2024013', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'C', email: 'siddharth.kapoor@iit.ac.in', phone: '+91 9876543222', status: 'late', entryTime: '09:28 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 37, percentage: 82.2, lastAttended: '2025-01-20', status: 'late' }, 'Database Systems': { totalClasses: 40, attendedClasses: 33, percentage: 82.5, lastAttended: '2025-01-18', status: 'present' } } },
  { id: '14', name: 'Tanvi Desai', rollNumber: 'CS014', regdNumber: 'REG2024014', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'C', email: 'tanvi.desai@iit.ac.in', phone: '+91 9876543223', status: 'present', entryTime: '09:13 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 41, percentage: 91.1, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 37, percentage: 92.5, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '15', name: 'Harsh Malhotra', rollNumber: 'CS015', regdNumber: 'REG2024015', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'C', email: 'harsh.malhotra@iit.ac.in', phone: '+91 9876543224', status: 'absent', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 32, percentage: 71.1, lastAttended: '2025-01-15', status: 'absent' }, 'Database Systems': { totalClasses: 40, attendedClasses: 28, percentage: 70.0, lastAttended: '2025-01-14', status: 'absent' } } },
  { id: '16', name: 'Riya Chandra', rollNumber: 'CS016', regdNumber: 'REG2024016', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'D', email: 'riya.chandra@iit.ac.in', phone: '+91 9876543225', status: 'present', entryTime: '09:09 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 44, percentage: 97.8, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 39, percentage: 97.5, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '17', name: 'Aryan Sinha', rollNumber: 'CS017', regdNumber: 'REG2024017', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'D', email: 'aryan.sinha@iit.ac.in', phone: '+91 9876543226', status: 'present', entryTime: '09:16 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 40, percentage: 88.9, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 36, percentage: 90.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '18', name: 'Nisha Rao', rollNumber: 'CS018', regdNumber: 'REG2024018', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'D', email: 'nisha.rao@iit.ac.in', phone: '+91 9876543227', status: 'late', entryTime: '09:24 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 38, percentage: 84.4, lastAttended: '2025-01-20', status: 'late' }, 'Database Systems': { totalClasses: 40, attendedClasses: 34, percentage: 85.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '19', name: 'Varun Tiwari', rollNumber: 'CS019', regdNumber: 'REG2024019', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'D', email: 'varun.tiwari@iit.ac.in', phone: '+91 9876543228', status: 'present', entryTime: '09:06 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 42, percentage: 93.3, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 38, percentage: 95.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '20', name: 'Pooja Bhatt', rollNumber: 'CS020', regdNumber: 'REG2024020', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'D', email: 'pooja.bhatt@iit.ac.in', phone: '+91 9876543229', status: 'absent', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 36, percentage: 80.0, lastAttended: '2025-01-17', status: 'absent' }, 'Database Systems': { totalClasses: 40, attendedClasses: 32, percentage: 80.0, lastAttended: '2025-01-16', status: 'absent' } } },
  { id: '21', name: 'Akash Pandey', rollNumber: 'CS021', regdNumber: 'REG2024021', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'akash.pandey@iit.ac.in', phone: '+91 9876543230', status: 'present', entryTime: '09:17 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 41, percentage: 91.1, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 37, percentage: 92.5, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '22', name: 'Shreya Kulkarni', rollNumber: 'CS022', regdNumber: 'REG2024022', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'A', email: 'shreya.kulkarni@iit.ac.in', phone: '+91 9876543231', status: 'present', entryTime: '09:04 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 45, percentage: 100.0, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 40, percentage: 100.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '23', name: 'Manish Gupta', rollNumber: 'CS023', regdNumber: 'REG2024023', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'B', email: 'manish.gupta@iit.ac.in', phone: '+91 9876543232', status: 'late', entryTime: '09:26 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 39, percentage: 86.7, lastAttended: '2025-01-20', status: 'late' }, 'Database Systems': { totalClasses: 40, attendedClasses: 35, percentage: 87.5, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '24', name: 'Divya Saxena', rollNumber: 'CS024', regdNumber: 'REG2024024', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'B', email: 'divya.saxena@iit.ac.in', phone: '+91 9876543233', status: 'present', entryTime: '09:18 AM', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 43, percentage: 95.6, lastAttended: '2025-01-20', status: 'present' }, 'Database Systems': { totalClasses: 40, attendedClasses: 38, percentage: 95.0, lastAttended: '2025-01-19', status: 'present' } } },
  { id: '25', name: 'Abhishek Jain', rollNumber: 'CS025', regdNumber: 'REG2024025', college: 'Indian Institute of Technology', class: 'B.Tech CSE', section: 'C', email: 'abhishek.jain@iit.ac.in', phone: '+91 9876543234', status: 'absent', subjects: { 'Data Structures': { totalClasses: 45, attendedClasses: 33, percentage: 73.3, lastAttended: '2025-01-16', status: 'absent' }, 'Database Systems': { totalClasses: 40, attendedClasses: 29, percentage: 72.5, lastAttended: '2025-01-15', status: 'absent' } } }
];

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('Data Structures');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.regdNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || student.status === filterStatus;
    const matchesSection = filterSection === 'all' || student.section === filterSection;
    return matchesSearch && matchesFilter && matchesSection;
  });

  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const lateCount = students.filter(s => s.status === 'late').length;
  const attendanceRate = ((presentCount + lateCount) / students.length * 100).toFixed(1);

  const handleEditAttendance = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleUpdateAttendance = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'absent':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'late':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'late':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 75) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Roll Number', 'Status', 'Entry Time', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...students.map(student => [
        student.name,
        student.rollNumber,
        student.status,
        student.entryTime || '',
        student.notes || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">Teacher Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <Clock className="inline h-4 w-4 mr-1" />
                {currentTime.toLocaleTimeString()}
              </div>
              <button
                onClick={onLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-white/20">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Present</p>
                <p className="text-2xl font-bold text-gray-900">{presentCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-white/20">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Absent</p>
                <p className="text-2xl font-bold text-gray-900">{absentCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-white/20">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Late</p>
                <p className="text-2xl font-bold text-gray-900">{lateCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-white/20">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900">{attendanceRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-sm border border-white/20 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, roll no, reg no..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="Data Structures">Data Structures</option>
                <option value="Database Systems">Database Systems</option>
                <option value="Computer Networks">Computer Networks</option>
                <option value="Operating Systems">Operating Systems</option>
              </select>

              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="all">All Students</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>

              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="all">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
                <option value="D">Section D</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-auto">
              <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200">
                <Calendar className="h-4 w-4 mr-2" />
                Reports
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Live Attendance Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-white/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Live Attendance Monitoring - {selectedSubject}</h3>
                <p className="text-sm text-gray-500">Real-time student attendance tracking</p>
              </div>
              <div className="mt-2 sm:mt-0 text-sm text-gray-600">
                Total Students: {filteredStudents.length}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Academic Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Entry Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Attendance %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/50 divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {student.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-500">{student.rollNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                      <div>
                        <div className="text-sm text-gray-900">{student.class}</div>
                        <div className="text-xs text-gray-500">Section {student.section} • {student.regdNumber}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(student.subjects[selectedSubject]?.status || 'absent')}`}>
                        {getStatusIcon(student.subjects[selectedSubject]?.status || 'absent')}
                        <span className="ml-1 capitalize">{student.subjects[selectedSubject]?.status || 'absent'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                      {student.entryTime || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${getProgressBarColor(student.subjects[selectedSubject]?.percentage || 0)}`}
                            style={{ width: `${student.subjects[selectedSubject]?.percentage || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium">
                          {(student.subjects[selectedSubject]?.percentage || 0).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditAttendance(student)}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center text-xs sm:text-sm"
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No students found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={selectedStudent}
        selectedSubject={selectedSubject}
        onUpdate={handleUpdateAttendance}
      />
    </div>
  );
};

export default TeacherDashboard;