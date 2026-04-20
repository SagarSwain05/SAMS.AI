# 🔧 Troubleshooting Guide

Complete troubleshooting guide for common issues in the AI-Powered Student Attendance Management System.

---

## 📋 Table of Contents

- [Backend Issues](#backend-issues)
- [Frontend Issues](#frontend-issues)
- [Database Issues](#database-issues)
- [Face Recognition Issues](#face-recognition-issues)
- [Camera Issues](#camera-issues)
- [Network & CORS Issues](#network--cors-issues)
- [Performance Issues](#performance-issues)

---

## Backend Issues

### Issue: Backend Won't Start

**Symptoms:**
```
ModuleNotFoundError: No module named 'flask'
```

**Solution:**
```bash
# Ensure virtual environment is activated
cd backend
source venv/bin/activate

# Verify activation
which python
# Should show: /path/to/backend/venv/bin/python

# Reinstall dependencies
pip install -r requirements.txt
```

---

### Issue: Port 5001 Already in Use

**Symptoms:**
```
OSError: [Errno 48] Address already in use
```

**Solution:**
```bash
# Find process using port 5001
lsof -ti:5001

# Kill the process
lsof -ti:5001 | xargs kill -9

# Or change port in backend/run.py
# Edit line: socketio.run(app, debug=True, port=5002)
```

---

### Issue: Import Error with OpenCV

**Symptoms:**
```
ImportError: DLL load failed while importing cv2
```

**Solution:**
```bash
# Uninstall all OpenCV packages
pip uninstall opencv-python opencv-contrib-python

# Install only opencv-contrib-python
pip install opencv-contrib-python==4.12.0.88

# Verify installation
python -c "import cv2; print(cv2.__version__)"
```

---

### Issue: psycopg2 Installation Error

**Symptoms:**
```
Error: pg_config executable not found
```

**Solution:**
```bash
# Add PostgreSQL to PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Add to shell profile permanently
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zprofile

# Use binary version instead
pip uninstall psycopg2
pip install psycopg2-binary
```

---

### Issue: JWT Token Errors

**Symptoms:**
```
jwt.exceptions.InvalidTokenError: Invalid token
```

**Solution:**
```bash
# Ensure JWT_SECRET_KEY is set in backend/app/config.py

# Check if token format is correct (Bearer <token>)
# Example:
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1..." http://localhost:5001/api/students

# Token may have expired - login again to get new token
```

---

## Frontend Issues

### Issue: Frontend Won't Start

**Symptoms:**
```
Error: Cannot find module '@vitejs/plugin-react'
```

**Solution:**
```bash
cd frontend

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Start dev server
npm run dev
```

---

### Issue: TypeScript Compilation Errors

**Symptoms:**
```
TS2307: Cannot find module './components/AdminDashboard'
```

**Solution:**
```bash
# Check if file exists
ls -la src/components/AdminDashboard.tsx

# Verify tsconfig.json paths
cat tsconfig.json

# Restart TypeScript server in VSCode
# Cmd+Shift+P -> "TypeScript: Restart TS Server"

# Or rebuild
npm run build
```

---

### Issue: Tailwind CSS Not Working

**Symptoms:**
- Styling not applied
- CSS classes not working

**Solution:**
```bash
# Check tailwind.config.js content paths
cat tailwind.config.js

# Should include:
# content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']

# Restart dev server
npm run dev
```

---

### Issue: Module Not Found Errors

**Symptoms:**
```
Module not found: Can't resolve 'react-hot-toast'
```

**Solution:**
```bash
# Install missing package
npm install react-hot-toast

# Or install all dependencies
npm install

# Check package.json for all required packages
```

---

## Database Issues

### Issue: PostgreSQL Not Running

**Symptoms:**
```
psycopg2.OperationalError: could not connect to server
```

**Solution:**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql@15

# Verify it's running
psql -d attendance_db -c "SELECT version();"

# If still not working, restart
brew services restart postgresql@15
```

---

### Issue: Database Does Not Exist

**Symptoms:**
```
psycopg2.OperationalError: database "attendance_db" does not exist
```

**Solution:**
```bash
# Create database
createdb attendance_db

# Verify creation
psql -l | grep attendance_db

# Run seed script to populate
cd backend
source venv/bin/activate
python seed.py
```

---

### Issue: Permission Denied on Database

**Symptoms:**
```
psycopg2.OperationalError: FATAL: role "yourusername" does not exist
```

**Solution:**
```bash
# Create PostgreSQL user
createuser -s $(whoami)

# Or create with password
createuser -P yourusername

# Update DATABASE_URL in config.py
# DATABASE_URL = 'postgresql://yourusername:password@localhost:5432/attendance_db'
```

---

### Issue: Table Already Exists Error

**Symptoms:**
```
sqlalchemy.exc.ProgrammingError: relation "users" already exists
```

**Solution:**
```bash
# Drop database and recreate
dropdb attendance_db
createdb attendance_db

# Run seed script
cd backend
source venv/bin/activate
python seed.py

# Or use migrations (if implemented)
flask db upgrade
```

---

### Issue: Foreign Key Constraint Errors

**Symptoms:**
```
IntegrityError: insert or update on table "students" violates foreign key constraint
```

**Solution:**
```bash
# Ensure parent records exist before inserting child records
# Example: User must exist before creating Student

# Check if user exists
psql -d attendance_db -c "SELECT * FROM users WHERE id = 1;"

# Create user first, then student
# Or use CASCADE on foreign keys
```

---

## Face Recognition Issues

### Issue: Model Not Found

**Symptoms:**
```
Face recognition model not found. Please train the model first.
```

**Solution:**
```bash
# Check if model file exists
ls -la backend/app/ml/models/face_recognizer.yml

# Train model via API
curl -X POST http://localhost:5001/api/recognition/train \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or via admin panel:
# Login as admin → Settings tab → Click "Train Model"
```

---

### Issue: No Faces Detected During Registration

**Symptoms:**
```
No faces detected in uploaded images
```

**Solutions:**

1. **Check Image Quality:**
   - Ensure face is clearly visible
   - Use proper lighting
   - Face should be frontal (not profile)
   - Image resolution should be at least 640x480

2. **Test Haar Cascade:**
```bash
cd backend
source venv/bin/activate
python -c "
import cv2
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
print('Cascade loaded:', face_cascade.empty() == False)
"
```

3. **Try Different Images:**
   - Use multiple angles
   - Ensure single face per image
   - Good lighting conditions

---

### Issue: Low Recognition Confidence

**Symptoms:**
```
Face recognized with low confidence: 45.2%
```

**Solutions:**

1. **Capture More Training Images:**
```bash
# Register student with at least 5-10 images
# From different angles and lighting conditions
```

2. **Adjust Confidence Threshold:**
```python
# In backend/app/routes/recognition.py
# Lower threshold for less strict recognition
confidence_threshold = 80  # Default: 85
```

3. **Retrain Model:**
```bash
# After adding more images
curl -X POST http://localhost:5001/api/recognition/train \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **Check Image Quality:**
   - Use consistent lighting
   - Capture at similar distances
   - Ensure face is clearly visible

---

### Issue: Face Recognition Very Slow

**Symptoms:**
- Video feed lagging
- Recognition taking > 5 seconds per frame

**Solutions:**

1. **Reduce Frame Processing:**
```python
# In backend/app/ml/camera_stream.py
# Process every Nth frame instead of every frame
if frame_count % 3 == 0:  # Process every 3rd frame
    # Recognition code
```

2. **Reduce Image Size:**
```python
# Resize frame before processing
frame = cv2.resize(frame, (320, 240))
```

3. **Use Smaller Haar Cascade Scale:**
```python
# In face detection
faces = face_cascade.detectMultiScale(
    gray,
    scaleFactor=1.3,  # Increase from 1.1 for faster detection
    minNeighbors=5,
    minSize=(50, 50)  # Increase minimum face size
)
```

---

## Camera Issues

### Issue: Camera Access Denied

**Symptoms:**
```
Can't open camera
cv2.error: Camera not accessible
```

**Solutions:**

1. **Grant Camera Permissions:**
   - macOS: System Preferences → Security & Privacy → Camera
   - Check Terminal and Browser

2. **Check Camera Index:**
```bash
# Test different camera indices
python -c "
import cv2
for i in range(3):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        print(f'Camera {i}: Available')
        cap.release()
    else:
        print(f'Camera {i}: Not available')
"
```

3. **Close Other Applications Using Camera:**
```bash
# Close FaceTime, Photo Booth, Zoom, etc.
# Then restart backend server
```

---

### Issue: Video Feed Timeout

**Symptoms:**
```
TimeoutError: Camera feed timeout after 3000ms
```

**Solutions:**

1. **Increase Timeout:**
```python
# In frontend/src/services/api.ts
timeout: 10000  # Increase from 3000ms
```

2. **Check Camera Connection:**
```bash
# Test camera availability
ls /dev/video*  # Linux
system_profiler SPCameraDataType  # macOS
```

3. **Restart Backend:**
```bash
# Stop backend (Ctrl+C)
# Restart
python run.py
```

---

### Issue: Video Feed Not Displaying in Kiosk

**Symptoms:**
- Black screen in kiosk mode
- Image element shows broken icon

**Solutions:**

1. **Check Recognition Session:**
```bash
# Verify recognition session is active
curl http://localhost:5001/api/recognition/status_public

# Should return: {"status": "active"}
```

2. **Test Video Feed URL:**
```bash
# Open in browser
open http://localhost:5001/api/recognition/video_feed

# Should show MJPEG stream
```

3. **Check CORS Settings:**
```python
# In backend/app/__init__.py
CORS(app, resources={r"/*": {"origins": "*"}})
```

---

## Network & CORS Issues

### Issue: CORS Errors in Browser

**Symptoms:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solutions:**

1. **Check CORS Configuration:**
```python
# In backend/app/__init__.py
from flask_cors import CORS

CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

2. **Verify API URL:**
```bash
# Check frontend .env
cat frontend/.env

# Should be:
VITE_API_URL=http://localhost:5001/api
```

3. **Restart Both Servers:**
```bash
# Stop backend and frontend
# Restart both servers
```

---

### Issue: API Requests Failing

**Symptoms:**
```
Network Error
ERR_CONNECTION_REFUSED
```

**Solutions:**

1. **Verify Backend is Running:**
```bash
# Check if backend is running on port 5001
lsof -i :5001

# Test API health
curl http://localhost:5001/api/health
```

2. **Check Firewall:**
```bash
# macOS Firewall
# System Preferences → Security & Privacy → Firewall
# Allow Python and Node
```

3. **Verify Network:**
```bash
# Test localhost connection
ping localhost

# Check if port is accessible
nc -zv localhost 5001
```

---

### Issue: WebSocket Connection Failing

**Symptoms:**
```
WebSocket connection to 'ws://localhost:5001' failed
```

**Solutions:**

1. **Check SocketIO Configuration:**
```python
# In backend/run.py
socketio = SocketIO(app, cors_allowed_origins="*")
```

2. **Verify WebSocket URL:**
```typescript
// In frontend/src/contexts/SocketContext.tsx
const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling']
});
```

3. **Check Backend Logs:**
```bash
# Look for WebSocket connection messages
# Should see: "Client connected" or similar
```

---

## Performance Issues

### Issue: High CPU Usage

**Symptoms:**
- Backend consuming > 80% CPU
- System lagging

**Solutions:**

1. **Reduce Frame Processing Rate:**
```python
# In camera_stream.py
time.sleep(0.1)  # Add delay between frames
```

2. **Lower Video Resolution:**
```python
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
```

3. **Stop Recognition When Not Needed:**
```bash
# Stop recognition session via API
curl -X POST http://localhost:5001/api/recognition/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Issue: High Memory Usage

**Symptoms:**
- Backend using > 1GB RAM
- System memory pressure

**Solutions:**

1. **Clear Recognition History:**
```python
# In recognition routes
recognition_results = []  # Clear after marking attendance
```

2. **Limit Image Storage:**
```bash
# Remove old face images periodically
find backend/app/ml/dataset -type f -mtime +30 -delete
```

3. **Restart Backend Periodically:**
```bash
# Stop and restart backend every few hours
# Or use process manager like systemd
```

---

### Issue: Slow Database Queries

**Symptoms:**
- API responses taking > 2 seconds
- Attendance page loading slowly

**Solutions:**

1. **Add Database Indexes:**
```sql
-- Connect to database
psql -d attendance_db

-- Add indexes
CREATE INDEX idx_attendance_date ON attendance_logs(date);
CREATE INDEX idx_attendance_student ON attendance_logs(student_id);
CREATE INDEX idx_students_roll ON students(roll_number);
```

2. **Optimize Queries:**
```python
# Use eager loading for relationships
students = Student.query.options(
    db.joinedload(Student.user)
).all()
```

3. **Pagination:**
```python
# Add pagination to large result sets
page = request.args.get('page', 1, type=int)
per_page = 20
students = Student.query.paginate(page=page, per_page=per_page)
```

---

## Getting More Help

If your issue is not listed here:

1. **Check Logs:**
   - Backend: Check terminal output
   - Frontend: Check browser console (F12)
   - Database: Check PostgreSQL logs

2. **Enable Debug Mode:**
```python
# In backend/run.py
app.config['DEBUG'] = True

# In frontend, check network tab in browser dev tools
```

3. **Test Individual Components:**
   - Test database connection
   - Test camera separately
   - Test API endpoints with cURL

4. **Check GitHub Issues:**
   - Search for similar issues
   - Create new issue with error details

---

## Common Error Messages Reference

| Error Message | Likely Cause | Solution |
|---------------|--------------|----------|
| `Token is missing` | No Authorization header | Include `Authorization: Bearer <token>` |
| `Admin access required` | Non-admin accessing admin route | Login as admin user |
| `Student not found` | Invalid student ID | Verify student exists in database |
| `No faces detected` | Poor image quality | Use better lighting, clearer face |
| `Model not trained` | No recognition model | Train model in admin settings |
| `Camera not available` | Camera permissions or in use | Grant permissions, close other apps |
| `Port already in use` | Server already running | Kill existing process |
| `Database connection failed` | PostgreSQL not running | Start PostgreSQL service |
| `Module not found` | Missing dependencies | Run `pip install -r requirements.txt` |
| `CORS error` | Cross-origin request blocked | Check CORS configuration |

---

Built with ❤️ for educational purposes
