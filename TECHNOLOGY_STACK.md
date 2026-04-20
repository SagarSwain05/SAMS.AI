# SAMS.AI — Complete Technology Stack

**Project**: AI-Powered Student Attendance Management System  
**Deployed At**: Trident Academy of Technology, Bhubaneswar, Odisha  
**Scale**: 675 students · 35 teachers · 15 sections · 7 branches · ~200,000 attendance records  

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│   Landing Page  |  Admin  |  Teacher  |  Student  |  Kiosk      │
│   (Public)         (RBAC)    (RBAC)     (RBAC)   (Public/Embed) │
└───────────────────────────┬──────────────────────────────────────┘
                            │  REST/JSON + WebSocket (Socket.IO)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  BACKEND  — Flask 3.0 (Python 3.14)              │
│                                                                  │
│  REST Blueprints:                                                │
│    /api/auth      /api/students   /api/teachers  /api/subjects   │
│    /api/attendance  /api/timetable  /api/notifications           │
│    /api/branches  /api/sections   /api/users                     │
│    /api/v2/recognition  (primary InsightFace pipeline)           │
│    /api/recognition     (legacy LBPH fallback + camera/kiosk)   │
│                                                                  │
│  AI/ML Pipeline:                                                 │
│    Camera (OpenCV) → RetinaFace Detector → ArcFace R100          │
│    (InsightFace/ONNX) → Embedding Compare → Attendance Mark      │
│    ↓ (fallback) OpenCV LBPH face recognizer                      │
│                                                                  │
│  Real-Time:  Flask-SocketIO → WebSocket broadcast               │
└───────────────────────────┬──────────────────────────────────────┘
                            │  psycopg (native async driver)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│              PostgreSQL 15.14  (attendance_system DB)            │
│  Tables: users, branches, sections, time_slots, teacher_profiles │
│          subjects, schedules, students, attendance_logs,         │
│          face_embeddings, notifications                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Backend

### Runtime & Framework

| Technology | Version | Role |
|-----------|---------|------|
| **Python** | 3.14.0 | Runtime language |
| **Flask** | 3.0.0 | Web framework (WSGI, Blueprints, app factory) |
| **Flask-CORS** | 4.0.0 | Cross-Origin Resource Sharing |
| **Flask-SocketIO** | 5.3.5 | WebSocket server (Socket.IO protocol) |
| **python-socketio** | 5.10.0 | Async Socket.IO backend engine |
| **Gunicorn** | — | Production WSGI server (recommended for deploy) |

### ORM & Database

| Technology | Version | Role |
|-----------|---------|------|
| **SQLAlchemy** | 2.0.23 | ORM — model definitions, relationships, queries |
| **psycopg2-binary** | 2.9.9 | PostgreSQL driver for Python |
| **Alembic** | 1.12.1 | Database migration manager |
| **PostgreSQL** | 15.14 | Relational DB — primary data store |

### AI / Machine Learning

| Technology | Version | Role |
|-----------|---------|------|
| **InsightFace** | 0.7.3 | Primary face recognition framework |
| **ArcFace R100** | — | Deep face embedding model (512-D vectors, ONNX) |
| **RetinaFace** | — | Face detector (bundled with InsightFace) |
| **ONNX Runtime** | 1.24.4 | Runs ArcFace R100 model at inference time (CPU) |
| **OpenCV** | ≥ 4.8.0 | LBPH face recognizer (fallback) + camera capture + MJPEG stream |
| **opencv-contrib** | ≥ 4.8.0 | LBPH FaceRecognizer module |
| **NumPy** | ≥ 1.24.0 | Array / image processing |
| **Pillow (PIL)** | ≥ 10.0.0 | Image format conversion & resizing |
| **scikit-learn** | ≥ 1.3.0 | Cosine similarity for embedding comparison |

**Face Recognition Pipeline Detail:**
```
Frame capture (OpenCV, 640×480 @ 10 fps)
  → RetinaFace detection (bounding boxes + landmarks)
  → Alignment & crop to 112×112
  → ArcFace R100 → 512-D L2-normalized embedding
  → Cosine distance vs DB embeddings (threshold 0.5)
  → Match found → mark attendance in PostgreSQL
  → Socket.IO broadcast to all connected dashboards
```

### Authentication & Security

| Technology | Version | Role |
|-----------|---------|------|
| **PyJWT** | 2.8.0 | JWT token generation & verification (HS256, 24h TTL) |
| **bcrypt** | 4.1.1 | Password hashing (12 rounds + auto salt) |
| **RBAC** | custom | Role-based access: admin > teacher > student decorators |

### Utilities

| Technology | Version | Role |
|-----------|---------|------|
| **python-dotenv** | 1.0.0 | .env environment variable loading |
| **python-dateutil** | 2.8.2 | Date parsing and arithmetic |
| **requests** | 2.31.0 | HTTP client for external API calls |

---

## Frontend

### Core

| Technology | Version | Role |
|-----------|---------|------|
| **React** | 18.3.1 | UI library — component-based, hooks, Context API |
| **TypeScript** | 5.5.3 | Type-safe JavaScript — all source code typed |
| **Vite** | 5.4.2 | Build tool — HMR dev server, optimized production bundle |

### Styling

| Technology | Version | Role |
|-----------|---------|------|
| **Tailwind CSS** | 3.4.1 | Utility-first CSS — all components styled with classes |
| **PostCSS** | 8.4.35 | CSS processor (required by Tailwind) |
| **Autoprefixer** | 10.4.18 | Auto vendor prefixes |

### UI Components & Icons

| Technology | Version | Role |
|-----------|---------|------|
| **lucide-react** | 0.344.0 | Icon library (300+ SVG icons as React components) |
| **framer-motion** | 12.38.0 | Animation library — transitions, page animations |
| **react-hot-toast** | 2.6.0 | Toast notification system |
| **recharts** | 3.8.1 | Chart library — bar, line, area charts for analytics |

### Networking & Real-Time

| Technology | Version | Role |
|-----------|---------|------|
| **axios** | 1.15.0 | HTTP client with JWT interceptors |
| **socket.io-client** | 4.8.3 | WebSocket client — real-time attendance updates |
| **react-router-dom** | 7.14.1 | SPA routing — URL-based tab navigation |

### Date & Utilities

| Technology | Version | Role |
|-----------|---------|------|
| **date-fns** | 4.1.0 | Date formatting and arithmetic |

---

## Database Schema (Full CAMS Schema)

```sql
-- 12 tables, normalized schema
users           — 712 rows (1 admin + 35 teachers + 675 students + 1 extra)
branches        — 7 rows  (CSE, CST, CSAIML, ETC, EEE, CIVIL, MECH)
sections        — 15 rows (3 sections per branch: A, B, C)
time_slots      — 7 rows  (P1-P6: 10:00-17:00 + 1 break)
teacher_profiles — 36 rows (employee IDs like TCSE001, department, branch)
subjects        — 42 rows (6 per branch × 7 branches)
schedules       — 450 rows (15 sections × 5 days × 6 periods; zero conflicts guaranteed)
students        — 675 rows (45 per section, linked to users)
attendance_logs — ~200,000 rows (2-3 months simulated + real data from today)
face_embeddings — stores ArcFace 512-D vectors per student
notifications   — student alerts (low attendance, announcements)
```

---

## Key Design Decisions

### Timetable Algorithm — Zero Teacher Conflict
```
Section k, day d (0=Mon..4=Fri), slot s (0-5):
  subject_index = (s + d + k) % 6
```
One deterministic formula ensures no teacher teaches two sections simultaneously.
Enforced at DB level via `UNIQUE(teacher_id, time_slot_id, day_of_week, academic_year)`.

### Simulated Attendance Data
198,744 records generated for Feb 2 – Apr 18, 2026 using deterministic seeding:
```
Student profile = random.Random(student_id × 31337 + 7919)
  → at-risk (10%): 55-67% attendance
  → borderline (20%): 68-74%
  → good (50%): 75-88%
  → excellent (20%): 89-97%
Sick week: 4% chance per student per ISO week → full week absent
Recent ≤21 days: marked_by='face_recognition' with confidence score
Older records: marked_by='manual'
```
Real recognition data writes to the same table — no code change needed.

---

## Deployment Planning

### For Publishing to the Web (Trident Academy)

#### Option A: VPS/Cloud (Recommended — Full Control)
| Service | Provider | Cost/month |
|---------|---------|-----------|
| VM (4 vCPU, 8GB RAM) | DigitalOcean Droplet / AWS EC2 t3.medium | $30-50 |
| Managed PostgreSQL | DO Managed DB / AWS RDS | $15-25 |
| Object Storage (face images) | DO Spaces / AWS S3 | $5-10 |
| SSL + Domain | Cloudflare + Namecheap | $15/yr |
| **Total** | | ~$50-85/month |

#### Option B: Platform-as-a-Service (Simpler setup)
| Layer | Platform | Notes |
|-------|---------|-------|
| Backend API | **Railway.app** or Render | Free tier available; auto-deploy from Git |
| Frontend | **Vercel** | Auto-deploy from Git; free tier |
| Database | **Supabase** | PostgreSQL; free 500MB tier |
| Face images | **Cloudinary** | Free 25GB tier |

#### Option C: Self-Hosted (College Server)
College provides a Linux server → install PostgreSQL + run Flask with Nginx + Gunicorn.

### Production Stack Changes Required

```bash
# 1. Backend: switch to production WSGI server
pip install gunicorn eventlet
gunicorn -w 4 -b 0.0.0.0:5001 --worker-class eventlet "app:create_app()"

# 2. Frontend: build static files
cd frontend && npm run build   # outputs dist/
# Serve dist/ via Nginx or upload to Vercel/Netlify

# 3. Environment variables (update for production)
DATABASE_URL=postgresql+psycopg2://user:pass@db-host:5432/attendance_system
CORS_ORIGINS=https://yourdomain.com
SECRET_KEY=<strong-random-256-bit-key>
JWT_SECRET_KEY=<strong-random-256-bit-key>

# 4. Camera access
# Production face recognition needs physical camera at the server location
# OR: IP camera (RTSP stream) fed into OpenCV
# OR: Client-side capture → upload frames → server-side recognition

# 5. Face images storage
# Move dataset/ to S3/Spaces — reference by URL in face_embeddings table
```

### Nginx Configuration (Production)
```nginx
server {
    listen 80;
    server_name sams.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name sams.yourdomain.com;

    # SSL (Let's Encrypt via Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend (React build)
    location / {
        root /var/www/sams/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API + WebSocket
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker Compose (Optional)
```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: attendance_system
      POSTGRES_PASSWORD: strongpassword
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    command: gunicorn -w 4 -b 0.0.0.0:5001 --worker-class eventlet "app:create_app()"
    environment:
      DATABASE_URL: postgresql+psycopg2://postgres:strongpassword@db:5432/attendance_system
    ports:
      - "5001:5001"
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "80:80"

volumes:
  pgdata:
```

---

## Multi-College Platform (Future Architecture)

When you want to offer SAMS.AI as a SaaS to multiple colleges:

```
┌────────────────────────────────────────────────────────────┐
│                  SAMS.AI Platform                          │
│                                                            │
│  Public Landing Page → "Implement in Your Institute"       │
│       ↓                                                    │
│  College Registration → Onboarding Form → Plan Selection  │
│       ↓                                                    │
│  Tenant Provisioning:                                      │
│    - Dedicated PostgreSQL schema (multi-tenant)            │
│    - OR separate DB per college (enterprise)               │
│    - Subdomain: trident.sams.ai, iiit.sams.ai, etc.       │
│       ↓                                                    │
│  College Admin → seeds their own branches, sections, staff │
└────────────────────────────────────────────────────────────┘
```

**DB Strategy**: PostgreSQL Row-Level Security (RLS) with `college_id` column on all tables.  
**Auth**: JWT payload includes `college_id` → all queries auto-scoped.  
**Subdomains**: Nginx wildcard + Flask config resolves college from subdomain.  
**Face Recognition**: Per-college embedding namespace (isolates recognition).

---

## Summary — Tech Stack at a Glance

```
Language:        Python 3.14 (backend)  |  TypeScript 5.5 (frontend)
Framework:       Flask 3.0              |  React 18.3
Build:           Gunicorn (prod)        |  Vite 5.4
Database:        PostgreSQL 15.14 + SQLAlchemy 2.0
ORM Migrations:  Alembic
Real-Time:       Flask-SocketIO 5.3 + socket.io-client 4.8
AI Model:        InsightFace 0.7.3 (ArcFace R100, 512-D, ONNX Runtime 1.24)
Fallback AI:     OpenCV LBPH (Haar Cascade detection)
Styling:         Tailwind CSS 3.4
Charts:          Recharts 3.8
Icons:           Lucide React
Animation:       Framer Motion 12
Auth:            PyJWT 2.8 + bcrypt 4.1 (HS256, 12 rounds)
HTTP Client:     Axios 1.15
Routing:         React Router v7
Notifications:   react-hot-toast
```

---

## Estimated Deployment Complexity

| Task | Effort | Notes |
|------|--------|-------|
| Deploy backend on VPS | 2-4 hrs | Gunicorn + Nginx + SSL |
| Deploy frontend on Vercel | 30 min | `npm run build` + git push |
| Migrate DB to cloud | 1-2 hrs | `pg_dump` → cloud PostgreSQL |
| Domain + SSL setup | 1 hr | Cloudflare + Certbot |
| Camera config for production | 2-4 hrs | IP camera / USB + server access |
| **Total** | **~1 day** | For a single-college deployment |

---

*SAMS.AI — Currently live at Trident Academy of Technology, Bhubaneswar, Odisha.*  
*Designed for multi-college SaaS expansion.*
