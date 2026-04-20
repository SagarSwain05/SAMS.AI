# Student Management System — Knowledge Graph for Claude

> This file is the **single source of truth** for Claude Code sessions.
> Read this first. Never re-scan node_modules, __pycache__, or dist.
> All code is at: `/Users/sagarswain/StudentManagementSystem/`

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (User)                           │
│         http://localhost:5173  (Vite + React + TS)          │
│         http://localhost:5173/kiosk  (Public Kiosk)         │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/REST + WebSocket (socket.io)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND  http://localhost:5001                  │
│         Flask 3.0 + Flask-SocketIO + SQLAlchemy             │
│                                                             │
│  Blueprints: /api/auth  /api/students  /api/attendance      │
│              /api/recognition  /api/subjects  /api/notifications│
│                                                             │
│  ML Pipeline:                                               │
│   Camera (OpenCV) → FaceDetector (Haar) → FaceRecognizer    │
│   (LBPH) → Attendance Marking → SocketIO Broadcast          │
└──────────────────┬──────────────────────────────────────────┘
                   │ psycopg (psql driver)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│         PostgreSQL 15  (attendance_system DB)               │
│         Tables: users, students, subjects,                  │
│                 attendance_logs, face_embeddings,            │
│                 notifications                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Services & Ports

| Service    | Port | Start Command                                                                 |
|-----------|------|-------------------------------------------------------------------------------|
| PostgreSQL | 5432 | `brew services start postgresql@15` (already running via LaunchAgent)         |
| Backend    | 5001 | `cd backend && source venv/bin/activate && python run.py`                     |
| Frontend   | 5173 | `cd frontend && npm run dev`                                                  |

**Quick start (all at once):**
```bash
# Terminal 1 — Backend
cd /Users/sagarswain/StudentManagementSystem/backend
source venv/bin/activate
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
python run.py

# Terminal 2 — Frontend
cd /Users/sagarswain/StudentManagementSystem/frontend
npm run dev
```

**Or use the script** (opens new Terminal tabs):
```bash
./start.sh     # starts all
./stop.sh      # stops all
```

**Health check:**
```bash
curl http://localhost:5001/api/health   # {"status":"ok","database":"connected"}
curl http://localhost:5173/             # 200 OK
```

---

## Login Credentials

| Role    | Username      | Password      | Notes                          |
|---------|--------------|---------------|--------------------------------|
| Admin   | college_admin | Admin@2024    | Full system access             |
| Teacher | tmat001      | Teacher@2024  | Dr. Rajesh Kumar (Math)        |
| Teacher | tcse001      | Teacher@2024  | Dr. Sanjay Mishra (CSE)        |
| Student | cse2024001   | Stud@2024     | CSE-A Section A, Roll 001      |
| Student | csaiml2024001| Stud@2024     | CSAIML-A, Roll 001             |

**All 712 users exist. Credential files in:** `credentials/` folder at project root.
- `credentials/admin/admin_credentials.txt`
- `credentials/teachers/ALL_TEACHERS.csv` (35 teachers)
- `credentials/teachers/{DEPT}_teachers.csv` (per department)
- `credentials/students/{BRANCH}/Section_{A|B|C}.csv` (45 per section)
- `credentials/timetables/Timetable_{BRANCH}_{SECTION}.csv` (15 timetables)

---

## File Tree (Source Files Only)

```
StudentManagementSystem/
├── CLAUDE.md                          ← THIS FILE (knowledge graph)
├── start.sh / stop.sh                 ← Service management scripts
├── package.json                       ← Root workspace config
│
├── backend/
│   ├── run.py                         ← Entry point (socketio.run on PORT env)
│   ├── seed.py                        ← DB seeder with demo data
│   ├── requirements.txt               ← Python deps
│   ├── .env                           ← Env vars (PORT=5001, DB_URL, JWT keys)
│   ├── venv/                          ← Python 3.14 virtualenv
│   ├── dataset/                       ← Face images: dataset/student_{id}/face_*.jpg
│   ├── models/                        ← Trained ML: face_recognizer.yml + face_labels.pkl
│   └── app/
│       ├── __init__.py                ← App factory: create_app(), Flask+CORS+SocketIO init
│       ├── config.py                  ← Dev/Prod/Test config classes
│       ├── sockets.py                 ← WebSocket event handlers
│       ├── models/
│       │   ├── __init__.py            ← db = SQLAlchemy()
│       │   ├── user.py                ← User (id, username, password_hash, role, name, email)
│       │   ├── student.py             ← Student (id, user_id FK, roll_number, reg_number, dept, class, section)
│       │   ├── attendance.py          ← AttendanceLog (student_id, subject_id, date, status, confidence)
│       │   ├── subject.py             ← Subject (id, name, code, class_name, section)
│       │   ├── face_embedding.py      ← FaceEmbedding (student_id, embedding_data, model_name)
│       │   └── notification.py        ← Notification (student_id, title, message, type, read_status)
│       ├── routes/
│       │   ├── auth.py                ← /api/auth: login, logout, verify, refresh + @token_required decorator
│       │   ├── students.py            ← /api/students: CRUD + register with face
│       │   ├── attendance.py          ← /api/attendance: records, mark, stats, export CSV
│       │   ├── recognition.py         ← /api/recognition: start/stop session, video_feed, train, capture
│       │   ├── subjects.py            ← /api/subjects: CRUD
│       │   └── notifications.py       ← /api/notifications: get, send, mark read
│       └── ml/
│           ├── camera.py              ← Camera (OpenCV) + CameraStream (MJPEG, 640x480@10fps, threading)
│           ├── face_detector.py       ← FaceDetector: Haar cascade, quality checks (size, blur, brightness)
│           ├── face_recognizer.py     ← FaceRecognizer: LBPH (radius=1, neighbors=8, grid 8x8)
│           └── model_trainer.py       ← ModelTrainer: save face images, train LBPH, load dataset
│
└── frontend/
    ├── package.json                   ← React 18, TypeScript, Vite, Tailwind, socket.io-client, axios
    ├── vite.config.ts                 ← No proxy; frontend calls backend directly on port 5001
    ├── index.html                     ← Single HTML entry
    └── src/
        ├── main.tsx                   ← React DOM render root
        ├── App.tsx                    ← Root: AuthProvider→SocketProvider→NotificationProvider→AppContent
        │                                Role routing: admin→AdminDashboard, teacher→TeacherDashboardIntegrated, student→StudentDashboard
        │                                /kiosk path → RecognitionKiosk (no auth)
        ├── types/index.ts             ← All TypeScript types: User, Student, Subject, AttendanceLog, etc.
        ├── services/
        │   ├── api.ts                 ← Axios client (baseURL: http://localhost:5001/api, JWT interceptor)
        │   │                            Exports: authAPI, studentAPI, attendanceAPI, subjectAPI, notificationAPI, recognitionAPI
        │   └── kioskAPI.ts            ← Public API calls (no auth) for kiosk mode
        ├── contexts/
        │   ├── AuthContext.tsx         ← JWT auth state, login/logout, token verify on mount
        │   ├── SocketContext.tsx       ← socket.io-client connection to localhost:5001
        │   └── NotificationContext.tsx ← Toast notification state
        └── components/
            ├── LoginPage.tsx           ← Login form (username + password)
            ├── AdminDashboard.tsx      ← Admin: student list, registration, attendance, recognition controls
            ├── TeacherDashboard.tsx    ← Teacher dashboard (legacy, kept for reference)
            ├── TeacherDashboardIntegrated.tsx ← Teacher: current active version
            ├── StudentDashboard.tsx    ← Student: own attendance stats
            ├── RecognitionKiosk.tsx    ← Public kiosk: live camera feed, no auth needed
            ├── RecognitionControls.tsx ← Start/Stop recognition session UI
            ├── CameraFeed.tsx          ← MJPEG stream: <img src="http://localhost:5001/api/recognition/video_feed">
            ├── StudentRegistration.tsx ← Register student form + face capture
            └── AttendanceModal.tsx     ← Manual attendance marking modal
```

---

## API Endpoints Reference

### Auth `/api/auth`
| Method | Path        | Auth | Notes                          |
|--------|-------------|------|--------------------------------|
| POST   | /login      | No   | body: {username, password} → {token, user} |
| POST   | /login_face | No   | body: {image: base64}          |
| POST   | /logout     | Yes  | client-side token deletion     |
| GET    | /verify     | Yes  | → {valid: bool, user}          |
| POST   | /refresh    | Yes  | → {token}                      |

### Students `/api/students`
| Method | Path         | Auth  | Notes                           |
|--------|--------------|-------|---------------------------------|
| GET    | /            | Yes   | ?section=&class=&search=        |
| GET    | /{id}        | Yes   |                                 |
| POST   | /register    | Admin | body: StudentData + face_images |
| PUT    | /{id}        | Admin |                                 |
| DELETE | /{id}        | Admin |                                 |

### Attendance `/api/attendance`
| Method | Path    | Auth    | Notes                              |
|--------|---------|---------|------------------------------------|
| GET    | /       | Yes     | ?student_id=&subject_id=&date_from=&date_to=&status= |
| POST   | /mark   | Teacher | body: {student_id, subject_id, status, notes} |
| PUT    | /{id}   | Teacher |                                    |
| GET    | /stats  | Yes     | ?student_id= (required)            |
| GET    | /export | Teacher | CSV download                       |

### Recognition `/api/recognition`
| Method | Path           | Auth  | Notes                                    |
|--------|----------------|-------|------------------------------------------|
| POST   | /start         | Admin | body: {subject_id} → starts camera+LBPH |
| POST   | /stop          | Admin | stops session, returns summary           |
| GET    | /video_feed    | No    | MJPEG stream (used by CameraFeed.tsx)    |
| GET    | /status        | Admin |                                          |
| GET    | /status_public | No    | for kiosk                                |
| POST   | /mark_attendance| Admin| marks all recognized faces               |
| POST   | /capture       | Yes   | body: {student_id, image: base64}        |
| POST   | /train         | Admin | trains LBPH model from dataset/          |
| GET    | /model_info    | Yes   |                                          |

### Subjects `/api/subjects`
| Method | Path   | Auth    | Notes |
|--------|--------|---------|-------|
| GET    | /      | Yes     | ?class=&section= |
| GET    | /{id}  | Yes     |       |
| POST   | /      | Teacher |       |
| PUT    | /{id}  | Teacher |       |
| DELETE | /{id}  | Teacher |       |

### Notifications `/api/notifications`
| Method | Path                        | Auth | Notes |
|--------|-----------------------------|------|-------|
| GET    | /{student_id}               | Yes  |       |
| GET    | /student/{id}/unread_count  | Yes  |       |
| POST   | /                           | Yes  | body: {student_id, title, message, type} |
| POST   | /bulk                       | Yes  | body: {student_ids[], message, type} |
| PUT    | /{id}/read                  | Yes  |       |

---

## Database Schema (Full CAMS Schema)

```sql
-- users (711 rows: 1 admin + 35 teachers + 675 students)
id, username (unique), password_hash (bcrypt), role (admin/teacher/student),
name, email, created_at, updated_at

-- branches (7 rows: CSE, CST, CSAIML, ETC, EEE, CIVIL, MECH)
id, name, code (unique), description, total_semesters, created_at, updated_at

-- sections (15 rows)
id, branch_id (FK→branches), name (A/B/C), current_semester, capacity(45),
room_number, global_index (0-14, used for timetable algorithm), created_at, updated_at
UNIQUE: (branch_id, name), (global_index)

-- time_slots (7 rows: 6 teaching + 1 break)
id, slot_number (0-6), label, start_time, end_time, is_break
Slots: P1=10-11, P2=11-12, P3=12-13, BREAK=13-14, P4=14-15, P5=15-16, P6=16-17

-- teacher_profiles (35 rows + 1 extra = 36)
id, user_id (FK→users unique), employee_id (unique, e.g. TMAT001),
branch_id (FK→branches), department, qualification, specialization, joining_date

-- subjects (42 rows: 6 per branch × 7 branches)
id, name, code (unique, e.g. CSE-MAT101), branch_id (FK→branches),
semester_number, credits, subject_index (0-5 = timetable position),
class_name (legacy), section (legacy), description

-- schedules (450 rows: 15 sections × 5 days × 6 slots)
id, section_id, subject_id, teacher_id, time_slot_id, day_of_week (0=Mon..4=Fri),
academic_year (2024-25), semester, room_number
UNIQUE: (section_id, time_slot_id, day_of_week, academic_year) — no section double-booking
UNIQUE: (teacher_id, time_slot_id, day_of_week, academic_year) — no teacher double-booking

-- students (675 rows, 45 per section)
id, user_id (FK→users unique), roll_number (e.g. CSE2024001), reg_number,
department, college, class_name (legacy branch code), section (legacy A/B/C),
branch_id (FK→branches), section_id (FK→sections), current_semester,
contact, photo_url

-- attendance_logs
id, student_id (FK→students), subject_id (FK→subjects), date, time,
status (present/absent/late), confidence_score, marked_by, entry_time, exit_time, notes

-- face_embeddings
id, student_id, embedding_data, model_name, image_path, capture_date, is_active

-- notifications
id, student_id, title, message, type (info/alert/warning/success), read_status
```

**Timetable Algorithm (Rolling Schedule)**
```
Section k, day d (0=Mon..4=Fri), slot position s (0-5):
  subject_index = (s + d + k) % 6
This ensures ZERO teacher-time conflicts (verified by DB UniqueConstraint).
Teacher conflict code: (subject_index - section_global_index) % 6
One teacher can safely cover sections that all have different conflict codes.
```

**DB Commands:**
```bash
/opt/homebrew/opt/postgresql@15/bin/psql attendance_system  # connect
python backend/seed_college.py  # FULL college seed (drops & recreates all tables)
python backend/seed.py          # old demo seed (do NOT use — replaced by seed_college.py)
```

**Verify no conflicts:**
```sql
-- Teacher conflicts (should return 0 rows)
SELECT teacher_id, time_slot_id, day_of_week, COUNT(*) FROM schedules
GROUP BY teacher_id, time_slot_id, day_of_week HAVING COUNT(*) > 1;
```

---

## Face Recognition Pipeline

```
1. Camera (OpenCV VideoCapture, 640x480, 10fps)
   → background thread captures frames continuously

2. FaceDetector (Haar Cascade)
   → detect_faces() → [(x,y,w,h), ...]
   → Quality checks:
      - min size: 80x80px
      - brightness: 50-200 mean
      - blur: Laplacian variance > 100

3. FaceRecognizer (LBPH)
   → recognize(face_roi) → (student_id, confidence)
   → confidence < 100  = RECOGNIZED
   → Normalized 0-1 scale for API

4. Model files:
   → backend/models/face_recognizer.yml  (trained LBPH)
   → backend/models/face_labels.pkl      (label→student_id map)

5. Training:
   → Student face images: backend/dataset/student_{id}/face_{n}_{timestamp}.jpg
   → Preprocessed: detected → extracted → 160x160 grayscale
   → POST /api/recognition/train  (retrain from scratch)

6. Real-time loop (CameraStream):
   → Detect → Recognize → Broadcast via SocketIO
   → MJPEG stream served at /api/recognition/video_feed
```

---

## Authentication & Security

- **JWT** (PyJWT, HS256, 24h expiry, 30d refresh)
- **Passwords**: bcrypt (12 rounds)
- **RBAC roles**: admin > teacher > student
- **Decorators**: `@token_required`, `@admin_required` in `routes/auth.py`
- **CORS**: Allowed origins: `http://localhost:5173`, `http://localhost:3000`
- **Token storage**: localStorage (`token`, `user` keys)
- **401 auto-redirect**: axios interceptor in `services/api.ts`

---

## Environment Variables (`backend/.env`)

```env
FLASK_ENV=development
PORT=5001
SECRET_KEY=your-secret-key-here-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-here-change-in-production
DATABASE_URL=postgresql+psycopg://sagarswain@localhost/attendance_system
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
CAMERA_INDEX=0
FACE_RECOGNITION_THRESHOLD=0.85
```

Frontend uses `VITE_API_URL` env var (defaults to `http://localhost:5001/api`).

---

## Key Dependencies

### Backend (Python 3.14, venv at `backend/venv/`)
- Flask 3.0, Flask-CORS 4.0, Flask-SocketIO 5.3.5
- SQLAlchemy 2.0.23, psycopg2-binary 2.9.9
- opencv-python + opencv-contrib-python ≥4.8
- bcrypt 4.1.1, PyJWT 2.8.0
- numpy, Pillow, python-dotenv, python-dateutil
- Optional: deepface, tensorflow, mtcnn, retina-face

### Frontend (Node.js, `frontend/node_modules/`)
- React 18.3.1, TypeScript 5.5.3, Vite 5.4.2
- Tailwind CSS 3.4.1
- axios 1.13.2, socket.io-client 4.8.1
- lucide-react, framer-motion, react-hot-toast
- react-webcam, recharts, date-fns

---

## WebSocket Events (SocketIO)

Backend (`app/sockets.py`) emits:
- `attendance_marked` — when a student is marked via face recognition
- `recognition_status` — session start/stop
- `new_recognition` — real-time recognition result

Frontend (`contexts/SocketContext.tsx`) connects to `http://localhost:5001`.

---

## Known Issues / Gotchas

1. **Camera not releasing**: Stop recognition from UI BEFORE closing browser tab.
   Fix: `release_camera_stream()` called in recognition.py stop endpoint.

2. **Port in run.py**: `run.py` defaults to `PORT=5000` env var, but `.env` sets `PORT=5001`.
   Always load `.env` or set `PORT=5001` manually.

3. **Python 3.14 + opencv**: Some packages may have compatibility issues.
   Use `backend/venv/` which has tested versions.

4. **Model not trained**: First-run has no trained model. Must register students with
   face images then call `POST /api/recognition/train`.

5. **Seed data**: Run `python backend/seed.py` to get demo users/students/subjects.

6. **TeacherDashboard.tsx vs TeacherDashboardIntegrated.tsx**: The integrated version
   is the current one used in App.tsx. The other is legacy.

---

## How to Debug

```bash
# Backend logs (live)
tail -f /tmp/backend.log

# Frontend logs (live)
tail -f /tmp/frontend.log

# Test API directly
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin1","password":"admin123"}'

# DB direct access
/opt/homebrew/opt/postgresql@15/bin/psql attendance_system -c "SELECT * FROM users;"

# Kill services
pkill -f "python run.py"   # kill backend
pkill -f "vite"            # kill frontend
```

---

## Kisko Platform

The kiosk interface (`/kiosk` route) is a **public, no-auth** face recognition terminal:
- Component: `frontend/src/components/RecognitionKiosk.tsx`
- API service: `frontend/src/services/kioskAPI.ts`
- Uses: `GET /api/recognition/status_public` + MJPEG video feed
- Designed for: physical attendance terminals/displays
- No JWT required — students walk up and face is recognized automatically

---

## Graphify Knowledge Graph Note

This `CLAUDE.md` **IS your knowledge graph** for this project.

**In future Claude sessions — start by reading this file:**
```
Read /Users/sagarswain/StudentManagementSystem/CLAUDE.md
```
Then navigate directly to specific files using the map above.
This eliminates the need to re-scan the entire codebase.

**If you need specific file content**, jump directly to:
- A route: `backend/app/routes/<name>.py`
- A model: `backend/app/models/<name>.py`  
- A component: `frontend/src/components/<Name>.tsx`
- ML logic: `backend/app/ml/<name>.py`

**Never scan `node_modules/`, `__pycache__/`, `dist/`, `venv/`, `dataset/`, `models/`.**
