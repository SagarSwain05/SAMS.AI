# 🚀 Setup Guide - AI-Powered Student Attendance Management System

Comprehensive step-by-step guide for setting up the project from scratch on macOS.

---

## 📋 Table of Contents

- [System Requirements](#system-requirements)
- [Installing Prerequisites](#installing-prerequisites)
- [Database Setup](#database-setup)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Initial Configuration](#initial-configuration)
- [Verification Steps](#verification-steps)
- [First Run](#first-run)

---

## System Requirements

### Hardware Requirements
- **Webcam**: Built-in or external camera (required for face recognition)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: At least 2GB free space
- **Processor**: Intel/Apple Silicon Mac

### Software Requirements
- **macOS**: 10.15 (Catalina) or later
- **Python**: 3.14 or higher
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **PostgreSQL**: 15.x or higher
- **Xcode Command Line Tools** (for building native modules)

---

## Installing Prerequisites

### Step 1: Install Homebrew

Homebrew is a package manager for macOS that simplifies software installation.

```bash
# Check if Homebrew is installed
which brew

# If not installed, install it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add Homebrew to PATH (Apple Silicon Macs)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Verify installation
brew --version
```

**Expected Output:**
```
Homebrew 4.x.x
```

### Step 2: Install Python 3.14

```bash
# Install Python 3.14
brew install python@3.14

# Verify installation
python3 --version

# Expected: Python 3.14.x

# Verify pip is installed
pip3 --version
```

### Step 3: Install PostgreSQL 15

```bash
# Install PostgreSQL 15
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify PostgreSQL is running
brew services list | grep postgresql

# Add PostgreSQL to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile

# Verify installation
psql --version

# Expected: psql (PostgreSQL) 15.x
```

### Step 4: Install Node.js and npm

```bash
# Install Node.js (includes npm)
brew install node

# Verify Node.js installation
node --version

# Expected: v18.x.x or higher

# Verify npm installation
npm --version

# Expected: 9.x.x or higher
```

### Step 5: Install Xcode Command Line Tools

Required for building native Python modules (like opencv-contrib-python).

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p

# Expected: /Library/Developer/CommandLineTools
```

---

## Database Setup

### Step 1: Create PostgreSQL Database

```bash
# Create database user (if needed)
createuser -s $(whoami)

# Create database
createdb attendance_db

# Verify database creation
psql -l | grep attendance_db
```

**Expected Output:**
```
 attendance_db | yourusername | UTF8     | ...
```

### Step 2: Test Database Connection

```bash
# Connect to database
psql -d attendance_db

# Inside psql, run:
\conninfo

# You should see:
# You are connected to database "attendance_db"

# Exit psql
\q
```

### Step 3: Configure Database Connection (Optional)

If you need to use a different database configuration:

```bash
# Create .env file in backend directory
cd /path/to/StudentManagementSystem-main/backend
touch .env

# Edit .env file with your database credentials
echo "DATABASE_URL=postgresql://username:password@localhost:5432/attendance_db" >> .env
```

---

## Backend Setup

### Step 1: Navigate to Backend Directory

```bash
cd /Users/sagarswain/StudentManagementSystem-main/backend
```

### Step 2: Create Python Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Verify activation (prompt should show (venv))
which python
# Expected: /path/to/backend/venv/bin/python
```

### Step 3: Upgrade pip

```bash
# Upgrade pip to latest version
pip install --upgrade pip

# Verify pip version
pip --version
```

### Step 4: Install Python Dependencies

```bash
# Ensure PostgreSQL bin is in PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Install all dependencies from requirements.txt
pip install -r requirements.txt
```

**This will install:**
- Flask 3.1.2
- SQLAlchemy 2.0.44
- PostgreSQL adapter (psycopg2-binary)
- OpenCV 4.12.0.88 (opencv-contrib-python)
- Flask-SocketIO, Flask-CORS
- bcrypt, PyJWT
- Other required packages

**Expected Output:**
```
Successfully installed Flask-3.1.2 SQLAlchemy-2.0.44 opencv-contrib-python-4.12.0.88 ...
```

### Step 5: Verify OpenCV Installation

```bash
# Test OpenCV import
python -c "import cv2; print(f'OpenCV version: {cv2.__version__}')"

# Expected: OpenCV version: 4.12.0

# Test face module
python -c "import cv2; print('Face module available:', hasattr(cv2, 'face'))"

# Expected: Face module available: True
```

### Step 6: Initialize Database

```bash
# Run seed script to create tables and demo data
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

### Step 7: Verify Database Schema

```bash
# Connect to database and check tables
psql -d attendance_db -c "\dt"

# You should see tables:
# users, students, subjects, attendance_logs, notifications
```

---

## Frontend Setup

### Step 1: Navigate to Frontend Directory

```bash
# Open new terminal or deactivate venv
# Then navigate to frontend
cd /Users/sagarswain/StudentManagementSystem-main/frontend
```

### Step 2: Install Node Dependencies

```bash
# Install all dependencies from package.json
npm install
```

**This will install:**
- React 18.3.1
- TypeScript 5.5.3
- Vite 5.4.2
- Tailwind CSS 3.4.1
- Axios, Socket.IO Client
- Other required packages

**Expected Output:**
```
added 200 packages, and audited 201 packages in 15s
```

### Step 3: Configure API URL (Optional)

By default, frontend connects to `http://localhost:5001/api`. To customize:

```bash
# Create .env file in frontend directory
echo "VITE_API_URL=http://localhost:5001/api" > .env
```

### Step 4: Verify TypeScript Configuration

```bash
# Check TypeScript version
npx tsc --version

# Expected: Version 5.5.3

# Verify no compilation errors
npm run build
```

---

## Initial Configuration

### Step 1: Create Required Directories

```bash
# Navigate to backend
cd /Users/sagarswain/StudentManagementSystem-main/backend

# Create dataset directory for face images
mkdir -p app/ml/dataset

# Create models directory for trained models
mkdir -p app/ml/models

# Verify directories
ls -la app/ml/
```

### Step 2: Configure Camera Access

macOS requires camera permissions for applications.

**For Terminal:**
1. Go to **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Camera** from the left panel
3. Check **Terminal** (or your terminal app)

**For Browser (Chrome/Safari):**
- Chrome: Settings → Privacy and Security → Site Settings → Camera → Allow for localhost
- Safari: Preferences → Websites → Camera → Allow for localhost

### Step 3: Configure Firewall (if enabled)

If macOS Firewall is enabled:

1. Go to **System Preferences** → **Security & Privacy** → **Firewall**
2. Click **Firewall Options**
3. Allow incoming connections for **Python** and **Node**

---

## Verification Steps

### Step 1: Verify Backend Setup

```bash
cd /Users/sagarswain/StudentManagementSystem-main/backend
source venv/bin/activate
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Test database connection
python -c "from app import create_app; app = create_app(); print('✓ Backend configured correctly')"
```

### Step 2: Verify Frontend Setup

```bash
cd /Users/sagarswain/StudentManagementSystem-main/frontend

# Check dependencies
npm list --depth=0

# Expected: List of all installed packages without errors
```

### Step 3: Verify PostgreSQL Service

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql@15

# Should show: postgresql@15 started

# Test connection
psql -d attendance_db -c "SELECT version();"

# Should display PostgreSQL version
```

### Step 4: Verify Camera Access

```bash
# Test camera with OpenCV
cd /Users/sagarswain/StudentManagementSystem-main/backend
source venv/bin/activate

python -c "
import cv2
cap = cv2.VideoCapture(0)
if cap.isOpened():
    print('✓ Camera is accessible')
    cap.release()
else:
    print('✗ Camera access denied or not available')
"
```

---

## First Run

### Terminal 1: Start Backend Server

```bash
# Navigate to backend directory
cd /Users/sagarswain/StudentManagementSystem-main/backend

# Activate virtual environment
source venv/bin/activate

# Set PostgreSQL path
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Start backend server
python run.py
```

**Expected Output:**
```
🚀 Starting AI-Powered Attendance System on port 5001
📊 Dashboard: http://localhost:5001
🔌 WebSocket: Enabled
📡 API: http://localhost:5001/api
 * Running on http://127.0.0.1:5001
```

**Leave this terminal running.**

### Terminal 2: Start Frontend Server

```bash
# Navigate to frontend directory
cd /Users/sagarswain/StudentManagementSystem-main/frontend

# Start frontend development server
npm run dev
```

**Expected Output:**
```
VITE v5.4.8  ready in 481 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

**Leave this terminal running.**

### Step 3: Access the Application

Open your web browser and navigate to:

**Main Application:**
```
http://localhost:5173
```

**Kiosk Mode (Public Access):**
```
http://localhost:5173/kiosk
```

### Step 4: Test Login

**Admin Login:**
- Username: `admin1`
- Password: `admin123`

**Teacher Login:**
- Username: `teacher1`
- Password: `password123`

**Student Login:**
- Username: `cs2024001` to `cs2024025`
- Password: `student123`

---

## Next Steps

After successful setup:

1. **Test Student Registration**: Login as admin and register a new student with face images
2. **Train Face Recognition Model**: In admin panel, go to Settings tab and click "Train Model"
3. **Start Recognition Session**: In admin panel, start face recognition and test with kiosk interface
4. **Test Teacher Dashboard**: Login as teacher and verify attendance viewing features
5. **Test Student Portal**: Login as student and check personal attendance

---

## Troubleshooting Common Setup Issues

### PostgreSQL Won't Start

```bash
# Check if port 5432 is in use
lsof -i :5432

# If needed, kill process
kill -9 <PID>

# Restart PostgreSQL
brew services restart postgresql@15
```

### Python Virtual Environment Issues

```bash
# Delete existing venv
rm -rf venv

# Recreate virtual environment
python3 -m venv venv

# Activate and reinstall
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### OpenCV Installation Fails

```bash
# Install OpenCV dependencies first
brew install cmake pkg-config

# Reinstall OpenCV
pip uninstall opencv-python opencv-contrib-python
pip install opencv-contrib-python==4.12.0.88
```

### Frontend Won't Start

```bash
# Clear npm cache
rm -rf node_modules package-lock.json
npm cache clean --force

# Reinstall dependencies
npm install
```

### Camera Not Accessible

1. Check System Preferences → Security & Privacy → Camera
2. Grant permission to Terminal and Browser
3. Restart terminal/browser after granting permissions
4. Test with: `ls /dev/video*` (Linux) or use OpenCV test script

---

## Environment Variables Reference

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/attendance_db

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ACCESS_TOKEN_EXPIRES=3600

# Flask
FLASK_ENV=development
FLASK_DEBUG=True

# Camera
CAMERA_INDEX=0

# Recognition
CONFIDENCE_THRESHOLD=85
```

### Frontend (.env)

```bash
# API URL
VITE_API_URL=http://localhost:5001/api

# WebSocket URL
VITE_WS_URL=http://localhost:5001
```

---

## Additional Resources

- [README.md](README.md) - Project overview and quick start
- [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) - API endpoint testing
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [TECHNOLOGY_STACK.md](TECHNOLOGY_STACK.md) - Detailed technology information

---

Built with ❤️ for educational purposes
