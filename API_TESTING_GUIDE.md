# API Testing Guide - Face Recognition System

**Last Updated**: November 6, 2025

This guide provides examples for testing all API endpoints, with special focus on the new face recognition features.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Student Management](#student-management)
3. [Face Recognition](#face-recognition)
4. [Attendance Management](#attendance-management)
5. [Subjects](#subjects)
6. [Notifications](#notifications)

---

## Prerequisites

- Backend server running on `http://localhost:5001`
- PostgreSQL database seeded with demo data
- Valid JWT token (obtained from login)

---

## Authentication

### 1. Login as Teacher

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "teacher1",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "teacher1",
    "name": "Dr. John Smith",
    "role": "teacher",
    "email": "john.smith@university.edu"
  }
}
```

### 2. Login as Student

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "cs2024001",
    "password": "student123"
  }'
```

### 3. Verify Token

```bash
TOKEN="your-token-here"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/auth/verify
```

---

## Student Management

### 1. Get All Students

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/students
```

### 2. Get Students by Section

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/students?section=A"
```

### 3. Search Students

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/students?search=Aarav"
```

### 4. Get Single Student

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/students/26
```

### 5. Register New Student (with face images)

```bash
curl -X POST http://localhost:5001/api/students/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Student",
    "email": "test.student@university.edu",
    "roll_number": "CS2024026",
    "reg_number": "REG2024026",
    "department": "Computer Science",
    "section": "A",
    "class_name": "Final Year",
    "contact": "9876543210",
    "password": "student123",
    "face_images": [
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
    ]
  }'
```

**Note**: Face images should be base64-encoded JPEG images. At least 3 images recommended for good recognition accuracy.

**Response:**
```json
{
  "message": "Student registered successfully",
  "student": {
    "id": 51,
    "roll_number": "CS2024026",
    "name": "Test Student",
    "department": "Computer Science",
    "section": "A"
  },
  "username": "cs2024026",
  "face_images_saved": 3,
  "note": "Default password is student123. Please change it on first login."
}
```

### 6. Update Student

```bash
curl -X PUT http://localhost:5001/api/students/26 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": "9999999999",
    "section": "B"
  }'
```

---

## Face Recognition

### 1. Get Model Information

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/recognition/model_info
```

**Response:**
```json
{
  "students_count": 25,
  "student_ids": [26, 27, 28, ...],
  "model_exists": true,
  "model_path": "/path/to/models/face_recognizer.yml",
  "labels_path": "/path/to/models/face_labels.pkl"
}
```

### 2. Train Face Recognition Model

```bash
curl -X POST http://localhost:5001/api/recognition/train \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "message": "Model trained successfully",
  "statistics": {
    "total_students": 25,
    "total_images": 125,
    "images_per_student": {
      "26": 5,
      "27": 5,
      ...
    },
    "trained_at": "2025-11-06T10:30:00"
  }
}
```

### 3. Capture Face Image

```bash
curl -X POST http://localhost:5001/api/recognition/capture \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 26,
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
  }'
```

**Response:**
```json
{
  "message": "Face captured successfully",
  "student_id": 26,
  "faces_detected": 1,
  "quality_check": "Good quality",
  "saved_paths": ["/path/to/dataset/26/face_001.jpg"],
  "face_bounds": {"x": 120, "y": 80, "w": 200, "h": 200}
}
```

### 4. Start Recognition Session

```bash
curl -X POST http://localhost:5001/api/recognition/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": 1
  }'
```

**Response:**
```json
{
  "message": "Face recognition session started",
  "subject_id": 1,
  "status": "active",
  "video_feed_url": "/api/recognition/video_feed"
}
```

### 5. Get Recognition Status

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/recognition/status
```

**Response:**
```json
{
  "status": "active",
  "subject_id": 1,
  "current_detections": [
    {
      "student_id": 26,
      "confidence": 87.5,
      "bbox": [120, 80, 200, 200],
      "timestamp": "2025-11-06T10:35:00"
    }
  ],
  "total_recognitions": 5
}
```

### 6. Mark Attendance from Recognition

```bash
curl -X POST http://localhost:5001/api/recognition/mark_attendance \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "message": "Attendance marked for 3 students",
  "marked_students": [
    {
      "student_id": 26,
      "name": "Aarav Sharma",
      "confidence": 87.5
    },
    {
      "student_id": 27,
      "name": "Vivaan Patel",
      "confidence": 92.3
    }
  ]
}
```

### 7. Stop Recognition Session

```bash
curl -X POST http://localhost:5001/api/recognition/stop \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "message": "Face recognition session stopped",
  "summary": {
    "subject_id": 1,
    "total_recognitions": 15,
    "unique_students": 10,
    "results": [...]
  }
}
```

### 8. Video Feed (MJPEG Stream)

Access the live video feed with face recognition overlay:

```
http://localhost:5001/api/recognition/video_feed
```

**Usage in HTML:**
```html
<img src="http://localhost:5001/api/recognition/video_feed" alt="Camera Feed">
```

**Note**: This endpoint streams MJPEG video. It should be accessed after starting a recognition session.

---

## Attendance Management

### 1. Mark Attendance Manually

```bash
curl -X POST http://localhost:5001/api/attendance/mark \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 26,
    "subject_id": 1,
    "status": "present"
  }'
```

### 2. Get Attendance Records

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/attendance?subject_id=1&date=2025-11-06"
```

### 3. Get Attendance Statistics

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/attendance/stats?student_id=26"
```

**Response:**
```json
{
  "student_id": 26,
  "total_classes": 30,
  "present_count": 27,
  "absent_count": 3,
  "attendance_percentage": 90.0,
  "subject_wise": {
    "1": {"present": 9, "total": 10, "percentage": 90.0},
    "2": {"present": 8, "total": 10, "percentage": 80.0}
  }
}
```

### 4. Update Attendance

```bash
curl -X PUT http://localhost:5001/api/attendance/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "absent"
  }'
```

---

## Subjects

### 1. Get All Subjects

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/subjects
```

### 2. Get Single Subject

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/subjects/1
```

### 3. Create Subject

```bash
curl -X POST http://localhost:5001/api/subjects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Artificial Intelligence",
    "code": "CS401",
    "department": "Computer Science",
    "credits": 4
  }'
```

### 4. Update Subject

```bash
curl -X PUT http://localhost:5001/api/subjects/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credits": 5
  }'
```

### 5. Delete Subject

```bash
curl -X DELETE http://localhost:5001/api/subjects/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Notifications

### 1. Get Student Notifications

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/notifications/26
```

### 2. Get Unread Count

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/notifications/student/26/unread_count
```

### 3. Send Notification

```bash
curl -X POST http://localhost:5001/api/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 26,
    "title": "Low Attendance Alert",
    "message": "Your attendance is below 75% in Data Structures",
    "type": "alert"
  }'
```

### 4. Send Bulk Notifications

```bash
curl -X POST http://localhost:5001/api/notifications/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_ids": [26, 27, 28],
    "title": "Class Cancelled",
    "message": "Today'\''s class is cancelled due to holiday",
    "type": "announcement"
  }'
```

### 5. Mark as Read

```bash
curl -X PUT http://localhost:5001/api/notifications/123/read \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing Face Recognition Flow

### Complete Workflow Test

Here's a complete workflow to test the face recognition system:

#### Step 1: Login as Teacher

```bash
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher1","password":"password123"}' \
  | jq -r '.token')
```

#### Step 2: Check Model Status

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/recognition/model_info
```

#### Step 3: Start Recognition Session

```bash
curl -X POST http://localhost:5001/api/recognition/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject_id": 1}'
```

#### Step 4: View Video Feed

Open in browser:
```
http://localhost:5001/api/recognition/video_feed
```

#### Step 5: Check Recognition Status

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/recognition/status
```

#### Step 6: Mark Attendance

```bash
curl -X POST http://localhost:5001/api/recognition/mark_attendance \
  -H "Authorization: Bearer $TOKEN"
```

#### Step 7: Stop Recognition

```bash
curl -X POST http://localhost:5001/api/recognition/stop \
  -H "Authorization: Bearer $TOKEN"
```

---

## WebSocket Testing

### Connect to WebSocket

```javascript
const socket = io('http://localhost:5001', {
  transports: ['websocket'],
  auth: {
    token: 'your-jwt-token-here'
  }
});

// Listen for attendance events
socket.on('attendance_marked', (data) => {
  console.log('Attendance marked:', data);
});

// Listen for notification events
socket.on('notification_sent', (data) => {
  console.log('Notification received:', data);
});

// Listen for recognition status updates
socket.on('recognition_status', (data) => {
  console.log('Recognition status:', data);
});
```

---

## Error Responses

Common error responses:

### 400 Bad Request
```json
{
  "message": "subject_id is required"
}
```

### 401 Unauthorized
```json
{
  "message": "Token is missing or invalid"
}
```

### 403 Forbidden
```json
{
  "message": "Only teachers can start recognition"
}
```

### 404 Not Found
```json
{
  "message": "Student not found"
}
```

### 409 Conflict
```json
{
  "message": "Recognition session already active"
}
```

### 500 Internal Server Error
```json
{
  "message": "Failed to start recognition: Camera not available"
}
```

---

## Tips for Testing

1. **Use jq for JSON parsing**: Install `jq` to parse JSON responses easily
   ```bash
   brew install jq  # macOS
   ```

2. **Store token in variable**: Makes subsequent requests easier
   ```bash
   TOKEN="your-token-here"
   ```

3. **Test with Postman**: Import these curl commands into Postman for easier testing

4. **Check server logs**: Monitor `backend/run.py` output for errors

5. **Test face quality**: Ensure good lighting and clear face visibility

6. **Multiple face angles**: Capture faces from different angles during registration

7. **Test confidence threshold**: Adjust threshold in model if false positives/negatives occur

---

## Next Steps

After testing the API:

1. Integrate frontend with these endpoints
2. Implement real-time updates using WebSocket
3. Add error handling in frontend
4. Implement face capture UI in student registration
5. Create recognition dashboard for teachers

---

## Troubleshooting

### Camera Issues

If video feed doesn't work:
```bash
# Check if camera is available
ls /dev/video*

# Test with OpenCV
python3 -c "import cv2; cap = cv2.VideoCapture(0); print('Camera OK' if cap.isOpened() else 'Camera Failed')"
```

### Model Training Issues

If model training fails:
```bash
# Check dataset directory
ls -la backend/app/ml/dataset/

# Verify face images exist
find backend/app/ml/dataset/ -name "*.jpg" | wc -l
```

### Recognition Accuracy Issues

To improve recognition:
- Capture at least 5-10 images per student
- Ensure consistent lighting
- Capture from multiple angles
- Adjust confidence threshold (default: 100)
- Retrain model after adding new students

---

**End of API Testing Guide**
