"""
Face Recognition Routes
"""
from flask import Blueprint, request, jsonify, Response, current_app
from .auth import token_required, admin_required
from ..models import db, Student, AttendanceLog
from ..ml.camera import get_camera_stream, generate_mjpeg_stream, release_camera_stream
from ..ml.model_trainer import get_model_trainer
from datetime import datetime
import base64
import cv2
import numpy as np

bp = Blueprint('recognition', __name__)

# Global recognition session state
_recognition_active = False
_recognition_subject_id = None
_recognition_results = []


@bp.route('/start', methods=['POST'])
@admin_required
def start_recognition(current_user):
    """Start face recognition session — uses InsightFace V2 pipeline."""
    global _recognition_active, _recognition_subject_id, _recognition_results

    try:
        data = request.get_json() or {}
        subject_id = data.get('subject_id')
        section_id = data.get('section_id', 1)    # default section 1 if not provided
        schedule_id = data.get('schedule_id', 1)  # default schedule 1 if not provided
        source = data.get('source', 0)

        if not subject_id:
            return jsonify({'message': 'subject_id is required'}), 400

        if _recognition_active:
            return jsonify({
                'message': 'Recognition session already active',
                'subject_id': _recognition_subject_id,
                'status': 'active',
                'video_feed_url': f'/api/v2/recognition/live_feed/{_recognition_section_id}'
            }), 200

        # Use V2 InsightFace pipeline
        from ..ml.face_recognition_v2 import get_stream_manager
        from ..models import Subject
        subject = db.session.get(Subject, subject_id)

        session_info = {
            'section': f'Section {section_id}',
            'subject': subject.name if subject else str(subject_id),
        }

        result = get_stream_manager().start_session(
            section_id=section_id,
            subject_id=subject_id,
            schedule_id=schedule_id,
            source=source,
            session_info=session_info,
        )

        if not result.get('success'):
            return jsonify({'message': result.get('error', 'Failed to start')}), 500

        _recognition_active = True
        _recognition_subject_id = subject_id
        globals()['_recognition_section_id'] = section_id
        _recognition_results = []

        return jsonify({
            'message': 'Face recognition session started',
            'subject_id': subject_id,
            'section_id': section_id,
            'status': 'active',
            'video_feed_url': f'/api/v2/recognition/live_feed/{section_id}',
            'engine': 'InsightFace ArcFace V2',
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to start recognition: {str(e)}'}), 500


@bp.route('/stop', methods=['POST'])
@admin_required
def stop_recognition(current_user):
    """Stop face recognition session."""
    global _recognition_active, _recognition_subject_id, _recognition_results

    try:
        if not _recognition_active:
            return jsonify({'message': 'No active recognition session'}), 404

        section_id = globals().get('_recognition_section_id', 1)

        from ..ml.face_recognition_v2 import get_stream_manager
        result = get_stream_manager().stop_session(section_id)

        results_summary = {
            'subject_id': _recognition_subject_id,
            'total_recognitions': result.get('attendance_count', 0),
            'unique_students': result.get('attendance_count', 0),
            'present_ids': result.get('present_ids', []),
        }

        _recognition_active = False
        _recognition_subject_id = None
        _recognition_results = []

        return jsonify({
            'message': 'Face recognition session stopped',
            'summary': results_summary
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to stop recognition: {str(e)}'}), 500


@bp.route('/video_feed', methods=['GET'])
def video_feed():
    """
    Stream MJPEG for the active V2 session.
    NEVER opens a raw camera fallback — that kept the camera LED on after stopping.
    Returns 503 when no session is active.
    """
    try:
        from ..ml.face_recognition_v2 import get_stream_manager
        manager = get_stream_manager()

        # Try the old-style per-section session first
        section_id = globals().get('_recognition_section_id', None)
        if section_id and _recognition_active:
            gen = manager.live_feed_generator(section_id)
            if gen:
                return Response(gen,
                    mimetype='multipart/x-mixed-replace; boundary=frame',
                    headers={'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0'})

        # Try the college session (section_id=0)
        gen = manager.live_feed_generator(0)
        if gen:
            return Response(gen,
                mimetype='multipart/x-mixed-replace; boundary=frame',
                headers={'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0'})

        # No active session — return 503 so browser stops polling.
        # DO NOT open a raw camera stream here; that's what kept the camera LED
        # on after stopping recognition.
        return Response(status=503)
    except Exception as e:
        return jsonify({'message': f'Failed to get video feed: {str(e)}'}), 500


@bp.route('/status', methods=['GET'])
@admin_required
def recognition_status(current_user):
    """Get recognition session status."""
    global _recognition_active, _recognition_subject_id

    try:
        if not _recognition_active:
            return jsonify({'status': 'inactive', 'message': 'No active recognition session'}), 200

        section_id = globals().get('_recognition_section_id', 1)
        from ..ml.face_recognition_v2 import get_stream_manager
        snap = get_stream_manager().get_attendance_status(section_id) or {}

        return jsonify({
            'status': 'active',
            'subject_id': _recognition_subject_id,
            'section_id': section_id,
            'present_count': len(snap.get('present', [])),
            'present_ids': snap.get('present', []),
            'pending_review': snap.get('pending_review', 0),
            'uptime_seconds': snap.get('uptime_seconds', 0),
            'video_feed_url': f'/api/v2/recognition/live_feed/{section_id}',
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to get status: {str(e)}'}), 500


@bp.route('/status_public', methods=['GET'])
def recognition_status_public():
    """Get current recognition session status (public access for kiosk)."""
    global _recognition_active, _recognition_subject_id

    try:
        if not _recognition_active:
            return jsonify({
                'status': 'inactive',
                'message': 'No active recognition session'
            }), 200

        # Use the V2 stream manager — never touch the old CameraStream here
        # (opening it while V2 owns the camera causes double VideoCapture SIGSEGV)
        section_id = globals().get('_recognition_section_id', None)
        snap = {}
        if section_id is not None:
            from ..ml.face_recognition_v2 import get_stream_manager
            snap = get_stream_manager().get_attendance_status(section_id) or {}

        return jsonify({
            'status': 'active',
            'subject_id': _recognition_subject_id,
            'present_count': len(snap.get('present', [])),
            'current_detections': [],   # real-time detections served via SocketIO, not polling
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to get status: {str(e)}'}), 500


@bp.route('/mark_attendance', methods=['POST'])
@admin_required
def mark_attendance_from_recognition(current_user):
    """Mark attendance for recognized students (admin only)"""
    global _recognition_active, _recognition_subject_id, _recognition_results

    try:

        if not _recognition_active:
            return jsonify({'message': 'No active recognition session'}), 404

        # Get latest recognition results
        camera_stream = get_camera_stream()
        recognized_students = camera_stream.get_recognition_results()

        if not recognized_students:
            return jsonify({'message': 'No students recognized'}), 404

        marked_count = 0
        marked_students = []

        for result in recognized_students:
            student_id = result['student_id']
            confidence = result['confidence']

            # Check if student exists
            student = Student.query.get(student_id)
            if not student:
                continue

            # Check if already marked today for this subject
            today = datetime.utcnow().date()
            existing_attendance = AttendanceLog.query.filter_by(
                student_id=student_id,
                subject_id=_recognition_subject_id,
                date=today
            ).first()

            if existing_attendance:
                continue

            # Create attendance record
            attendance = AttendanceLog(
                student_id=student_id,
                subject_id=_recognition_subject_id,
                date=today,
                time=datetime.utcnow().time(),
                status='present',
                marked_by='face_recognition',
                confidence_score=confidence
            )

            db.session.add(attendance)
            marked_count += 1
            marked_students.append({
                'student_id': student_id,
                'name': student.user.name if student.user else "Unknown",
                'confidence': confidence
            })

            # Add to session results
            _recognition_results.append({
                'student_id': student_id,
                'confidence': confidence,
                'timestamp': datetime.utcnow().isoformat()
            })

        db.session.commit()

        # Emit WebSocket event
        if hasattr(current_app, 'socketio'):
            current_app.socketio.emit('attendance_marked', {
                'subject_id': _recognition_subject_id,
                'count': marked_count,
                'students': marked_students
            }, namespace='/attendance')

        return jsonify({
            'message': f'Attendance marked for {marked_count} students',
            'marked_students': marked_students
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to mark attendance: {str(e)}'}), 500


@bp.route('/capture', methods=['POST'])
def capture_face():
    """Capture face images for registration"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'message': 'No data provided'}), 400

        student_id = data.get('student_id')
        image_data = data.get('image')  # Base64 encoded image

        if not student_id or not image_data:
            return jsonify({'message': 'student_id and image are required'}), 400

        # Decode base64 image
        try:
            # Remove data URL prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                return jsonify({'message': 'Invalid image data'}), 400

        except Exception as e:
            return jsonify({'message': f'Failed to decode image: {str(e)}'}), 400

        # Get face detector
        from ..ml.face_detector import get_face_detector
        detector = get_face_detector()

        # Detect faces in the image
        faces = detector.detect_faces(image)

        if len(faces) == 0:
            return jsonify({'message': 'No face detected in image'}), 400

        if len(faces) > 1:
            return jsonify({'message': 'Multiple faces detected. Please ensure only one face is visible.'}), 400

        # Extract face ROI
        x, y, w, h = faces[0]
        face_roi = detector.extract_face_roi(image, faces[0])

        # Check face quality
        is_good, reason = detector.is_face_quality_good(face_roi)
        if not is_good:
            return jsonify({'message': f'Face quality check failed: {reason}'}), 400

        # Save the captured face
        trainer = get_model_trainer()

        # Save face image to dataset
        saved_count, saved_paths = trainer.save_face_images(student_id, [face_roi])

        return jsonify({
            'message': 'Face captured successfully',
            'student_id': student_id,
            'faces_detected': len(faces),
            'quality_check': reason,
            'saved_paths': saved_paths,
            'face_bounds': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to capture face: {str(e)}'}), 500


@bp.route('/train', methods=['POST'])
@admin_required
def train_model(current_user):
    """Train or retrain the face recognition model (admin only)"""
    try:

        # Get model trainer
        trainer = get_model_trainer()

        # Train the model
        stats = trainer.train_model()

        return jsonify({
            'message': 'Model trained successfully',
            'statistics': stats
        }), 200

    except ValueError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        return jsonify({'message': f'Failed to train model: {str(e)}'}), 500


@bp.route('/model_info', methods=['GET'])
@token_required
def model_info(current_user):
    """Get information about the trained model"""
    try:
        from ..ml.face_recognizer import get_face_recognizer

        recognizer = get_face_recognizer()
        info = recognizer.get_model_info()

        return jsonify(info), 200

    except Exception as e:
        return jsonify({'message': f'Failed to get model info: {str(e)}'}), 500
