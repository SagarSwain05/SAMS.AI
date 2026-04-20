// Type definitions for the AI-Powered Attendance System

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  role: 'teacher' | 'student';
  created_at: string;
}

export interface Student {
  id: number;
  user_id: number;
  roll_number: string;
  reg_number: string;
  department: string;
  college: string;
  class_name: string;
  section: string;
  contact?: string;
  photo_url?: string;
  name?: string; // From joined user data
  email?: string; // From joined user data
  created_at: string;
  // Extended fields from normalized schema
  branch_id?: number | null;
  section_id?: number | null;
  current_semester?: number;
  branch_code?: string;
  branch_name?: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  class_name: string;
  section: string;
  description?: string;
  created_at: string;
}

export interface AttendanceLog {
  id: number;
  student_id: number;
  subject_id: number;
  date: string;
  time: string;
  status: 'present' | 'absent' | 'late';
  confidence_score?: number;
  marked_by: string;
  entry_time?: string;
  exit_time?: string;
  notes?: string;
  student?: Student; // Joined data
  subject?: Subject; // Joined data
  created_at: string;
}

export interface AttendanceStats {
  student_id: number;
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count?: number;
  attendance_percentage: number;
  subject_wise?: {
    [subject_id: number]: {
      present: number;
      absent: number;
      late?: number;
      total: number;
      percentage: number;
    };
  };
}

export interface Notification {
  id: number;
  student_id: number;
  title?: string;
  message: string;
  type: 'info' | 'alert' | 'warning' | 'announcement';
  read_status: boolean;
  created_at: string;
}

export interface FaceEmbedding {
  id: number;
  student_id: number;
  embedding_data: string;
  model_name: string;
  image_path?: string;
  capture_date: string;
  is_active: boolean;
}

export interface RecognitionResult {
  student_id: number;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, w, h]
  timestamp: string;
  student?: Student;
}

export interface RecognitionSession {
  status: 'active' | 'inactive';
  subject_id?: number;
  current_detections?: RecognitionResult[];
  total_recognitions?: number;
  message?: string;
}

export interface ModelInfo {
  students_count: number;
  student_ids: number[];
  model_exists: boolean;
  model_path: string;
  labels_path: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterStudentData {
  name: string;
  email: string;
  roll_number: string;
  reg_number: string;
  department: string;
  section: string;
  class_name?: string;
  contact?: string;
  password?: string;
  face_images?: string[]; // Base64 encoded images
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
}

export interface AttendanceFilters {
  student_id?: number;
  subject_id?: number;
  section?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  status?: 'present' | 'absent' | 'late';
  limit?: number;
  offset?: number;
}

export interface StudentFilters {
  section?: string;
  class?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
