---
title: SAMS AI
emoji: 🎓
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
short_description: AI-Powered Student Attendance Management System
---

# 🎓 AI-Powered Student Attendance Management System

A comprehensive full-stack web application featuring **AI-based face recognition** for automated student attendance tracking with real-time updates and multi-role access control.

![Python](https://img.shields.io/badge/Python-3.14-blue)
![Flask](https://img.shields.io/badge/Flask-3.1-green)
![React](https://img.shields.io/badge/React-18.3-cyan)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)

---

## 📋 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Running the Application](#-running-the-application)
- [User Credentials](#-user-credentials)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### 🔐 **Three-Level Access Control**

1. **Admin Panel**
   - Student registration with face capture (5 images per student)
   - Face recognition session management
   - User management (create teachers/admins)
   - Model training and system settings
   - Full database access

2. **Teacher Dashboard**
   - View attendance records with filters
   - Search students by name/roll number
   - Export attendance to CSV
   - Subject and section-based filtering
   - Manual attendance modifications

3. **Student Portal**
   - Personal attendance history
   - Subject-wise statistics
   - Attendance percentage tracking
   - Real-time notifications

4. **Recognition Kiosk** (Public Interface)
   - Full-screen mode for door/gate placement
   - Real-time face detection and recognition
   - Auto-polling for active sessions
   - No authentication required
   - Live camera feed display

### 🤖 **AI/ML Features**

- **Face Detection**: OpenCV Haar Cascade
- **Face Recognition**: LBPH (Local Binary Patterns Histograms) algorithm
- **Multi-image Training**: 5+ images per student for accuracy
- **Confidence Scoring**: Recognition confidence threshold
- **Real-time Processing**: MJPEG video streaming with overlays

### 📡 **Real-time Features**

- WebSocket integration (Socket.IO)
- Live attendance updates
- Instant notifications
- Real-time camera feed
- Auto-refresh status polling

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript)           │
│  ┌──────────────┬──────────────┬──────────────┬─────────┐  │
│  │ Admin Panel  │   Teacher    │   Student    │  Kiosk  │  │
│  │              │  Dashboard   │   Portal     │  Mode   │  │
│  └──────┬───────┴──────┬───────┴──────┬───────┴────┬────┘  │
│         │              │              │            │        │
│         └──────────────┴──────────────┴────────────┘        │
│                          │                                   │
│                    REST API + WebSocket                      │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                  Backend (Flask + Python)                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Authentication & Authorization (JWT + Role-Based)     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────┬──────────┬────────────┬──────────┬──────────┐   │
│  │ Auth   │ Students │ Attendance │ Subjects │ Notif.   │   │
│  │ Routes │ Routes   │ Routes     │ Routes   │ Routes   │   │
│  └────────┴──────────┴────────────┴──────────┴──────────┘   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │        ML Module (Face Recognition)                    │  │
│  │  - Face Detector    - Face Recognizer                  │  │
│  │  - Model Trainer    - Camera Stream                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│              Database (PostgreSQL 15)                         │
│  ┌─────────┬──────────┬───────────────┬──────────────────┐   │
│  │  Users  │ Students │ Attendance    │  Subjects        │   │
│  │  Table  │ Table    │ Logs Table    │  Table           │   │
│  └─────────┴──────────┴───────────────┴──────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## 💻 Technology Stack

### **Backend**
- **Language**: Python 3.14
- **Framework**: Flask 3.1.2
- **Database**: PostgreSQL 15.14
- **ORM**: SQLAlchemy 2.0.44
- **Authentication**: JWT (PyJWT)
- **Password Hashing**: bcrypt
- **WebSocket**: Flask-SocketIO 5.5.1
- **CORS**: Flask-CORS 5.0.0

### **Machine Learning**
- **Computer Vision**: OpenCV 4.12.0.88 (opencv-contrib-python)
- **Face Detection**: Haar Cascade Classifier
- **Face Recognition**: LBPH Algorithm
- **Image Processing**: NumPy, Pillow

### **Frontend**
- **Framework**: React 18.3.1
- **Language**: TypeScript 5.5.3
- **Build Tool**: Vite 5.4.2
- **Styling**: Tailwind CSS 3.4.1
- **HTTP Client**: Axios 1.7.7
- **WebSocket Client**: Socket.IO Client 4.8.1
- **Notifications**: react-hot-toast
- **Webcam**: react-webcam
- **Icons**: lucide-react

### **Database Schema**
- Users (id, username, password_hash, role, name, email)
- Students (id, user_id, roll_number, reg_number, department, college, section, class_name, contact)
- Attendance Logs (id, student_id, subject_id, date, time, status, marked_by, confidence_score)
- Subjects (id, name, code, class_name, section, description)
- Notifications (id, student_id, title, message, type, read, timestamp)

---

## 📦 Prerequisites

### **Required Software**

1. **Python 3.14+**
   ```bash
   python3 --version
   ```

2. **PostgreSQL 15+**
   ```bash
   psql --version
   ```

3. **Node.js 18+ and npm**
   ```bash
   node --version
   npm --version
   ```

4. **Webcam** (Built-in or external camera for face recognition)

### **macOS Installation**

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Install Python 3.14 (if needed)
brew install python@3.14

# Install Node.js
brew install node
```

---

## 🚀 Installation

### **1. Clone Repository**

```bash
cd /path/to/your/workspace
# (Repository already exists at StudentManagementSystem-main)
cd StudentManagementSystem-main
```

### **2. Database Setup**

```bash
# Ensure PostgreSQL is running
brew services start postgresql@15

# Create database
createdb attendance_db

# Verify database creation
psql -l | grep attendance_db
```

### **3. Backend Setup**

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set PostgreSQL path (macOS)
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Initialize and seed database
python seed.py
```

**Expected Output:**
```
🌱 Starting database seeding...
✓ Created admin user
✓ Created 2 teachers
✓ Created 5 subjects
✓ Created 25 students
✓ Database seeding completed successfully!
```

### **4. Frontend Setup**

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# (Optional) Create .env file for custom API URL
echo "VITE_API_URL=http://localhost:5001/api" > .env
```

---

## ▶️ Running the Application

### **Option 1: Separate Terminals (Recommended)**

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
python run.py
```

**Expected Output:**
```
🚀 Starting AI-Powered Attendance System on port 5001
📊 Dashboard: http://localhost:5001
🔌 WebSocket: Enabled
📡 API: http://localhost:5001/api
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Expected Output:**
```
VITE v5.4.8  ready in 481 ms
➜  Local:   http://localhost:5173/
```

### **Option 2: Background Processes**

```bash
# Start backend in background
cd backend && source venv/bin/activate && \
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH" && \
python run.py > backend.log 2>&1 &

# Start frontend in background
cd frontend && npm run dev > frontend.log 2>&1 &
```

### **Verify Services**

```bash
# Check if both servers are running
lsof -ti:5001 -ti:5173

# Check backend health
curl http://localhost:5001/api/health

# Check frontend accessibility
curl -I http://localhost:5173
```

---

## 🔐 User Credentials

### **Demo Accounts**

| Role | Username | Password | Access Level |
|------|----------|----------|-------------|
| **Admin** | `admin1` | `admin123` | Full system access - registration, recognition, user management |
| **Teacher** | `teacher1` | `password123` | View attendance, filters, CSV export, manual edits |
| **Student** | `cs2024001` - `cs2024025` | `student123` | Personal attendance view only |
| **Kiosk** | No login required | — | Public face recognition interface |

### **Access URLs**

- **Main Application**: http://localhost:5173
- **Recognition Kiosk**: http://localhost:5173/kiosk
- **API Endpoints**: http://localhost:5001/api
- **API Health Check**: http://localhost:5001/api/health

---

## 📁 Project Structure

```
StudentManagementSystem-main/
├── backend/
│   ├── app/
│   │   ├── models/              # Database models (User, Student, Attendance, etc.)
│   │   ├── routes/              # API endpoints (auth, students, attendance, recognition)
│   │   ├── ml/                  # ML modules (face detector, recognizer, trainer, camera)
│   │   ├── config.py            # Configuration settings
│   │   └── __init__.py          # Flask app factory
│   ├── venv/                    # Python virtual environment
│   ├── requirements.txt         # Python dependencies
│   ├── run.py                   # Backend entry point
│   └── seed.py                  # Database seeding script
│
├── frontend/
│   ├── src/
│   │   ├── components/          # React components (Admin, Teacher, Student, Kiosk)
│   │   ├── contexts/            # React contexts (Auth, Socket, Notifications)
│   │   ├── services/            # API clients (api.ts, kioskAPI.ts)
│   │   ├── types/               # TypeScript type definitions
│   │   ├── App.tsx              # Root component with routing
│   │   └── main.tsx             # React entry point
│   ├── package.json             # Node dependencies
│   ├── tsconfig.json            # TypeScript configuration
│   └── vite.config.ts           # Vite build configuration
│
├── README.md                    # This file
├── SETUP_GUIDE.md              # Detailed setup instructions
├── API_TESTING_GUIDE.md        # API testing with examples
├── TROUBLESHOOTING.md          # Common issues and solutions
└── TECHNOLOGY_STACK.md         # Detailed tech stack information
```

---

## 📚 API Documentation

### **Authentication Endpoints**

```
POST   /api/auth/login          # Login with username/password
POST   /api/auth/logout         # Logout (requires token)
GET    /api/auth/verify         # Verify JWT token
POST   /api/auth/refresh        # Refresh JWT token
```

### **Student Management (Admin Only)**

```
GET    /api/students            # Get all students (with filters)
GET    /api/students/:id        # Get student by ID
POST   /api/students/register   # Register new student with face data
PUT    /api/students/:id        # Update student information
DELETE /api/students/:id        # Delete student
```

### **Attendance Management**

```
GET    /api/attendance          # Get attendance records (with filters)
POST   /api/attendance/mark     # Mark attendance manually
PUT    /api/attendance/:id      # Update attendance record
GET    /api/attendance/stats    # Get attendance statistics
GET    /api/attendance/export   # Export attendance to CSV
```

### **Face Recognition (Admin Only)**

```
POST   /api/recognition/start          # Start recognition session
POST   /api/recognition/stop           # Stop recognition session
GET    /api/recognition/status         # Get session status (admin)
POST   /api/recognition/mark_attendance # Mark attendance from recognized faces
POST   /api/recognition/train          # Train/retrain recognition model
GET    /api/recognition/model_info     # Get model information
```

### **Kiosk Endpoints (Public)**

```
GET    /api/recognition/video_feed      # MJPEG video stream (public)
GET    /api/recognition/status_public   # Get session status (public, for kiosk)
```

**See [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) for detailed examples and cURL commands.**

---

## 🐛 Troubleshooting

### **Backend Issues**

**PostgreSQL Connection Error:**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql@15

# Test connection
psql -U $(whoami) -d attendance_db
```

**Port Already in Use:**
```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9
```

**OpenCV/Camera Issues:**
```bash
# Verify OpenCV installation
python -c "import cv2; print(cv2.__version__)"
python -c "import cv2; print(hasattr(cv2, 'face'))"

# Reinstall opencv-contrib-python
pip uninstall opencv-python opencv-contrib-python
pip install opencv-contrib-python==4.12.0.88
```

### **Frontend Issues**

**Compilation Errors:**
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Camera Permission Denied:**
- **Chrome**: Settings → Privacy → Camera → Allow for localhost
- **Safari**: Preferences → Websites → Camera → Allow for localhost

**CORS Errors:**
- Ensure backend is running on port 5001
- Check `VITE_API_URL` in frontend/.env matches backend URL

### **Recognition Issues**

**Model Not Found:**
```bash
# Retrain the model via API
curl -X POST http://localhost:5001/api/recognition/train \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Poor Recognition Accuracy:**
- Ensure good lighting during registration and recognition
- Capture multiple angles during student registration (5+ images)
- Face should be clearly visible and centered
- Register more face images for better accuracy

**See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.**

---

## 📝 License

This project is developed for educational purposes.

---

## 👥 Support

For detailed guides, see:
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Step-by-step setup instructions
- [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) - API testing examples
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and fixes
- [TECHNOLOGY_STACK.md](TECHNOLOGY_STACK.md) - Detailed technology information

---

## 🎯 Quick Start Summary

```bash
# 1. Setup Database
createdb attendance_db

# 2. Backend Setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
python seed.py
python run.py

# 3. Frontend Setup (in new terminal)
cd frontend
npm install
npm run dev

# 4. Access Application
# Main App: http://localhost:5173
# Kiosk: http://localhost:5173/kiosk
# Admin Login: admin1 / admin123
```

---

**Built with ❤️ using Python, React, and OpenCV**
