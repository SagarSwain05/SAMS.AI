# 🚀 Quick Running Guide

Simple guide to start and stop the Student Attendance Management System.

---

## ✅ START THE PROJECT

### Step 1: Start Backend (Terminal 1)

```bash
cd /Users/sagarswain/StudentManagementSystem-main/backend
source venv/bin/activate
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
python run.py
```

**✓ Backend running on port 5001**

---

### Step 2: Start Frontend (Terminal 2 - New Window)

```bash
cd /Users/sagarswain/StudentManagementSystem-main/frontend
npm run dev
```

**✓ Frontend running on port 5173**

---

### Step 3: Open Browser

- **Admin Panel**: http://localhost:5173 (login: admin1 / admin123)
- **Teacher Dashboard**: http://localhost:5173 (login: teacher1 / password123)
- **Student Portal**: http://localhost:5173 (login: cs2024001 / student123)
- **Kiosk (Public)**: http://localhost:5173/kiosk (no login)

---

## 🛑 STOP THE PROJECT PROPERLY

### IMPORTANT: Always follow this order!

### Step 1: Stop Face Recognition (In Browser)

1. Go to Admin Panel → Face Recognition tab
2. Click **"Stop Recognition"** button (red button)
3. Wait for message: "Recognition session stopped"
4. **Camera light should turn off**

---

### Step 2: Stop Frontend (Terminal 2)

```bash
# Press Ctrl + C once
Ctrl + C
```

---

### Step 3: Stop Backend (Terminal 1)

```bash
# Press Ctrl + C once
Ctrl + C
```

---

## 🔥 EMERGENCY: Camera Still On?

If camera is still on after stopping:

```bash
# Kill backend process immediately
lsof -ti:5001 | xargs kill -9

# Check if camera is released
lsof | grep -i camera

# If still showing processes, restart Mac
sudo shutdown -r now
```

---

## 🔍 CHECK STATUS

### Check if servers are running:

```bash
# Check backend (port 5001)
lsof -i :5001

# Check frontend (port 5173)
lsof -i :5173

# Check PostgreSQL
brew services list | grep postgresql
```

---

## ⚡ QUICK KILL ALL

If you need to stop everything quickly:

```bash
# Kill backend
lsof -ti:5001 | xargs kill -9

# Kill frontend
lsof -ti:5173 | xargs kill -9

# Kill all Python processes (use carefully!)
pkill -9 python

# Kill all Node processes (use carefully!)
pkill -9 node
```

---

## 📝 BEST PRACTICES

1. ✅ Always stop recognition BEFORE closing browser
2. ✅ Keep terminals open while using the app
3. ✅ Use Ctrl+C (not closing terminal window)
4. ✅ Check camera light is off before leaving
5. ❌ Don't close terminal windows directly
6. ❌ Don't force quit browser with active recognition

---

## 🎯 TROUBLESHOOTING

### Port Already in Use

```bash
# Backend port 5001 busy
lsof -ti:5001 | xargs kill -9

# Frontend port 5173 busy
lsof -ti:5173 | xargs kill -9
```

### Camera Won't Release

```bash
# Force kill backend
lsof -ti:5001 | xargs kill -9

# Wait 5 seconds
sleep 5

# Check camera
lsof | grep -i camera
```

### PostgreSQL Not Running

```bash
# Start PostgreSQL
brew services start postgresql@15

# Check status
brew services list | grep postgresql
```

---

## 🔄 RESTART EVERYTHING

If things get messed up:

```bash
# 1. Kill everything
lsof -ti:5001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
pkill -9 python

# 2. Wait 5 seconds
sleep 5

# 3. Start backend (Terminal 1)
cd /Users/sagarswain/StudentManagementSystem-main/backend
source venv/bin/activate
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
python run.py

# 4. Start frontend (Terminal 2)
cd /Users/sagarswain/StudentManagementSystem-main/frontend
npm run dev
```

---

## ✨ WHAT GOT FIXED

The camera release issue has been fixed in the code:

1. **camera.py**: Now properly releases camera hardware when stopping
2. **recognition.py**: Calls `release_camera_stream()` to free hardware
3. **Proper sequence**: Disables detection → Stops thread → Releases camera

**You must restart the backend for the fix to take effect!**

---

Built with ❤️ - Your camera will now turn off properly!
