import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Student,
  Subject,
  AttendanceLog,
  AttendanceStats,
  Notification,
  RecognitionResult,
  RecognitionSession,
  ModelInfo,
  LoginCredentials,
  LoginResponse,
  RegisterStudentData,
  AttendanceFilters,
  StudentFilters,
} from '../types';

// API Base URL - defaults to localhost, can be overridden with environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear auth and go to landing
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const authAPI = {
  /**
   * Login with username and password
   */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Login with face recognition
   */
  loginWithFace: async (imageData: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login_face', {
      image: imageData,
    });
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * Verify token validity
   */
  verifyToken: async (): Promise<{ valid: boolean; user?: User }> => {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  /**
   * Refresh JWT token
   */
  refreshToken: async (): Promise<{ token: string }> => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
};

// ============================================================================
// STUDENT API
// ============================================================================

export const studentAPI = {
  /**
   * Get all students with optional filters
   */
  getAll: async (filters?: StudentFilters): Promise<{ students: Student[]; count: number }> => {
    const response = await api.get('/students', { params: filters });
    return response.data;
  },

  /**
   * Get single student by ID
   */
  getById: async (id: number): Promise<Student> => {
    const response = await api.get(`/students/${id}`);
    return response.data;
  },

  /**
   * Register new student with optional face images
   */
  register: async (data: RegisterStudentData): Promise<{
    message: string;
    student: Student;
    username: string;
    face_images_saved: number;
  }> => {
    const response = await api.post('/students/register', data);
    return response.data;
  },

  /**
   * Update student information
   */
  update: async (id: number, data: Partial<Student>): Promise<{ message: string; student: Student }> => {
    const response = await api.put(`/students/${id}`, data);
    return response.data;
  },

  /**
   * Delete student
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/students/${id}`);
    return response.data;
  },
};

// ============================================================================
// ATTENDANCE API
// ============================================================================

export const attendanceAPI = {
  /**
   * Get attendance records with filters
   */
  getRecords: async (filters?: AttendanceFilters): Promise<{ attendance: AttendanceLog[]; count: number }> => {
    const response = await api.get('/attendance', { params: filters });
    return response.data;
  },

  /**
   * Mark attendance manually
   */
  mark: async (data: {
    student_id: number;
    subject_id: number;
    status: 'present' | 'absent' | 'late';
    notes?: string;
  }): Promise<{ message: string; attendance: AttendanceLog }> => {
    const response = await api.post('/attendance/mark', data);
    return response.data;
  },

  /**
   * Update attendance record
   */
  update: async (
    id: number,
    data: { status?: string; notes?: string }
  ): Promise<{ message: string; attendance: AttendanceLog }> => {
    const response = await api.put(`/attendance/${id}`, data);
    return response.data;
  },

  /**
   * Get attendance statistics
   */
  getStats: async (params?: { student_id?: number; subject_id?: number }): Promise<AttendanceStats> => {
    const response = await api.get('/attendance/stats', { params });
    return response.data;
  },

  /**
   * Export attendance to CSV
   */
  export: async (filters?: AttendanceFilters): Promise<Blob> => {
    const response = await api.get('/attendance/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Teacher daily period-grid view
   * GET /attendance/teacher/daily?date=YYYY-MM-DD&section_id=N
   */
  teacherDaily: async (params: { date?: string; section_id?: number }) => {
    const response = await api.get('/attendance/teacher/daily', { params });
    return response.data;
  },

  /**
   * Bulk-mark attendance for a period
   */
  bulkMark: async (data: {
    section_id?: number;
    subject_id: number;
    date: string;
    entries: { student_id: number; status: string }[];
  }) => {
    const response = await api.post('/attendance/bulk-mark', data);
    return response.data;
  },

  /**
   * Teacher: submit approval request for >48h attendance edit
   */
  approvalRequest: async (data: {
    attendance_id: number;
    new_status: string;
    reason: string;
  }) => {
    const response = await api.post('/attendance/approval-request', data);
    return response.data;
  },

  /**
   * Admin: list pending approval requests
   */
  listApprovalRequests: async () => {
    const response = await api.get('/attendance/approval-requests');
    return response.data;
  },

  /**
   * Admin: approve or reject an approval request
   */
  processApprovalRequest: async (notifId: number, data: { action: 'approve' | 'reject'; admin_notes?: string }) => {
    const response = await api.put(`/attendance/approval-requests/${notifId}`, data);
    return response.data;
  },

  /**
   * Download attendance report as CSV (teacher-scoped)
   */
  downloadReport: async (params: {
    report_type?: string;
    date_from?: string;
    date_to?: string;
    teacher_user_id?: number | string;
    branch_id?: number;
    section_id?: number;
  }): Promise<Blob> => {
    const response = await api.get('/attendance/report/download', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// ============================================================================
// SUBJECT API
// ============================================================================

export const subjectAPI = {
  /**
   * Get all subjects
   */
  getAll: async (): Promise<{ subjects: Subject[]; count: number }> => {
    const response = await api.get('/subjects');
    return response.data;
  },

  /**
   * Get single subject by ID
   */
  getById: async (id: number): Promise<Subject> => {
    const response = await api.get(`/subjects/${id}`);
    return response.data;
  },

  /**
   * Create new subject
   */
  create: async (data: Partial<Subject>): Promise<{ message: string; subject: Subject }> => {
    const response = await api.post('/subjects', data);
    return response.data;
  },

  /**
   * Update subject
   */
  update: async (id: number, data: Partial<Subject>): Promise<{ message: string; subject: Subject }> => {
    const response = await api.put(`/subjects/${id}`, data);
    return response.data;
  },

  /**
   * Delete subject
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/subjects/${id}`);
    return response.data;
  },
};

// ============================================================================
// NOTIFICATION API
// ============================================================================

export const notificationAPI = {
  /**
   * Get student notifications
   */
  getForStudent: async (studentId: number): Promise<{ notifications: Notification[]; count: number }> => {
    const response = await api.get(`/notifications/${studentId}`);
    return response.data;
  },

  /**
   * Get unread count for student
   */
  getUnreadCount: async (studentId: number): Promise<{ unread_count: number }> => {
    const response = await api.get(`/notifications/student/${studentId}/unread_count`);
    return response.data;
  },

  /**
   * Send notification to student
   */
  send: async (data: {
    student_id: number;
    title?: string;
    message: string;
    type: string;
  }): Promise<{ message: string; notification: Notification }> => {
    const response = await api.post('/notifications', data);
    return response.data;
  },

  /**
   * Send bulk notifications
   */
  sendBulk: async (data: {
    student_ids: number[];
    title?: string;
    message: string;
    type: string;
  }): Promise<{ message: string; sent_count: number }> => {
    const response = await api.post('/notifications/bulk', data);
    return response.data;
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (id: number): Promise<{ message: string }> => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },
};

// ============================================================================
// RECOGNITION API
// ============================================================================

export const recognitionAPI = {
  /**
   * Start face recognition session
   */
  startSession: async (subjectId: number): Promise<{
    message: string;
    subject_id: number;
    status: string;
    video_feed_url: string;
  }> => {
    const response = await api.post('/recognition/start', { subject_id: subjectId });
    return response.data;
  },

  /**
   * Stop face recognition session
   */
  stopSession: async (): Promise<{
    message: string;
    summary: {
      subject_id: number;
      total_recognitions: number;
      unique_students: number;
      results: RecognitionResult[];
    };
  }> => {
    const response = await api.post('/recognition/stop');
    return response.data;
  },

  /**
   * Get recognition session status
   */
  getStatus: async (): Promise<RecognitionSession> => {
    const response = await api.get('/recognition/status');
    return response.data;
  },

  /**
   * Mark attendance from recognized students
   */
  markAttendance: async (): Promise<{
    message: string;
    marked_students: Array<{ student_id: number; name: string; confidence: number }>;
  }> => {
    const response = await api.post('/recognition/mark_attendance');
    return response.data;
  },

  /**
   * Capture face image for registration
   */
  captureFace: async (data: { student_id: number; image: string }): Promise<{
    message: string;
    student_id: number;
    faces_detected: number;
    quality_check: string;
    saved_paths: string[];
    face_bounds: { x: number; y: number; w: number; h: number };
  }> => {
    const response = await api.post('/recognition/capture', data);
    return response.data;
  },

  /**
   * Train face recognition model
   */
  trainModel: async (): Promise<{
    message: string;
    statistics: {
      total_students: number;
      total_images: number;
      images_per_student: Record<string, number>;
      trained_at: string;
    };
  }> => {
    const response = await api.post('/recognition/train');
    return response.data;
  },

  /**
   * Get model information
   */
  getModelInfo: async (): Promise<ModelInfo> => {
    const response = await api.get('/recognition/model_info');
    return response.data;
  },

  /**
   * Get video feed URL
   */
  getVideoFeedUrl: (): string => {
    return `${API_BASE_URL}/recognition/video_feed`;
  },
};

// ============================================================================
// RECOGNITION V2 API  (InsightFace ArcFace pipeline)
// ============================================================================

export const recognitionV2API = {
  /** Enroll student face(s). images = array of base64 strings */
  enroll: async (studentId: number, images: string[]): Promise<{
    message: string;
    student_id: number;
    images_used: number;
    embedding_quality: Record<string, unknown>;
  }> => {
    const response = await api.post('/v2/recognition/enroll', {
      student_id: studentId,
      images,
    });
    return response.data;
  },

  /** Kiosk / manual single-photo recognition */
  recognize: async (imageBase64: string): Promise<{
    status: 'confirmed' | 'review' | 'unknown' | 'spoofed';
    student_id?: number;
    name?: string;
    similarity?: number;
    student?: Student;
    message?: string;
  }> => {
    const response = await api.post('/v2/recognition/recognize', { image: imageBase64 });
    return response.data;
  },

  /** Start a classroom camera session */
  startSession: async (params: {
    section_id: number;
    subject_id: number;
    schedule_id: number;
    source?: string | number;
    recognition_interval?: number;
  }): Promise<{
    success: boolean;
    section_id: number;
    subject_id: number;
    started_at: string;
    live_feed_url: string;
    message?: string;
  }> => {
    const response = await api.post('/v2/recognition/session/start', params);
    return response.data;
  },

  /** Stop a classroom session */
  stopSession: async (sectionId: number): Promise<{
    success: boolean;
    section_id: number;
    attendance_count: number;
    present_ids: number[];
    pending_review: number;
  }> => {
    const response = await api.post('/v2/recognition/session/stop', { section_id: sectionId });
    return response.data;
  },

  /** Attendance snapshot for one section */
  getSectionStatus: async (sectionId: number): Promise<{
    section_id: number;
    subject_id: number;
    present: number[];
    vote_snapshot: Record<string, { votes: number; confirmed: boolean; avg_similarity: number }>;
    pending_review: number;
    session_active: boolean;
    uptime_seconds: number;
  }> => {
    const response = await api.get(`/v2/recognition/attendance_status/${sectionId}`);
    return response.data;
  },

  /** All active section snapshots */
  getAllStatuses: async (): Promise<unknown[]> => {
    const response = await api.get('/v2/recognition/attendance_status');
    return response.data;
  },

  /** Admin: list every live stream */
  getActiveStreams: async (): Promise<Array<{
    section_id: number;
    subject_id: number;
    source: string;
    session_info: Record<string, string>;
    present_count: number;
    is_active: boolean;
    uptime_seconds: number;
  }>> => {
    const response = await api.get('/v2/recognition/active_streams');
    return response.data;
  },

  /** Teacher review queue */
  getReviewQueue: async (sectionId?: number): Promise<{
    count: number;
    items: Array<{
      id: string;
      student_id: number;
      name: string;
      similarity: number;
      timestamp: string;
      section_id: number;
    }>;
  }> => {
    const response = await api.get('/v2/recognition/review', {
      params: sectionId ? { section_id: sectionId } : undefined,
    });
    return response.data;
  },

  /** Teacher approves or rejects a review item */
  resolveReview: async (
    itemId: string,
    sectionId: number,
    decision: 'approve' | 'reject'
  ): Promise<{ success: boolean; action: string; student_id?: number }> => {
    const response = await api.post(`/v2/recognition/review/${itemId}`, {
      section_id: sectionId,
      decision,
    });
    return response.data;
  },

  /** Force refresh embedding cache */
  refreshEmbeddings: async (): Promise<{
    message: string;
    students_loaded: number;
    refreshed_at: string;
  }> => {
    const response = await api.post('/v2/recognition/embeddings/refresh');
    return response.data;
  },

  /** Delete all embeddings for a student */
  deleteStudentEmbedding: async (studentId: number): Promise<{
    message: string;
    deleted_count: number;
  }> => {
    const response = await api.delete(`/v2/recognition/embeddings/student/${studentId}`);
    return response.data;
  },

  /** System info + stats */
  getSystemInfo: async (): Promise<Record<string, unknown>> => {
    const response = await api.get('/v2/recognition/info');
    return response.data;
  },

  /** Build live feed URL for a section (used in <img src=...>) */
  getLiveFeedUrl: (sectionId: number): string =>
    `${API_BASE_URL}/v2/recognition/live_feed/${sectionId}`,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Handle API errors and return user-friendly messages
 */
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

/**
 * Set authentication token
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('token', token);
};

/**
 * Get authentication token
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Clear authentication data
 */
export const clearAuth = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

/**
 * Set current user
 */
export const setCurrentUser = (user: User): void => {
  localStorage.setItem('user', JSON.stringify(user));
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

// Export the axios instance for custom requests
export default api;
