"""
Face Recognition V2 — API Routes
==================================
All endpoints are under /api/v2/recognition/

Endpoints:
  POST  /enroll                        Admin: upload face image(s) for a student
  POST  /recognize                     Kiosk: recognize a single photo
  POST  /session/start                 Admin/Teacher: open a classroom camera session
  POST  /session/stop                  Admin/Teacher: close a session and finalize attendance
  GET   /live_feed/<section_id>        MJPEG stream (admin dashboard)
  GET   /attendance_status             All active sections status
  GET   /attendance_status/<section_id> One section status
  GET   /active_streams                Admin: list every live stream
  GET   /review                        Teacher: pending uncertain matches
  POST  /review/<item_id>              Teacher: approve or reject a review item
  POST  /embeddings/refresh            Admin: force reload embeddings from DB
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime

import cv2
import numpy as np
from flask import Blueprint, Response, current_app, jsonify, request

from .auth import admin_required, token_required
from ..models import db, Student, FaceEmbedding

logger = logging.getLogger(__name__)

bp = Blueprint('recognition_v2', __name__)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _decode_image(data_or_b64: str) -> np.ndarray | None:
    """
    Accept either:
      - A base64 string (raw or with data:image/... prefix)
      - Returns a BGR numpy array or None on failure.
    """
    try:
        if ',' in data_or_b64:
            data_or_b64 = data_or_b64.split(',', 1)[1]
        raw = base64.b64decode(data_or_b64)
        arr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as exc:
        logger.debug("Image decode failed: %s", exc)
        return None


def _get_pipeline():
    from ..ml.face_recognition_v2 import get_pipeline
    return get_pipeline()


def _get_manager():
    from ..ml.face_recognition_v2 import get_stream_manager
    return get_stream_manager()


# ─────────────────────────────────────────────────────────────────────────────
# Enrollment  (admin only)
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/enroll', methods=['POST'])
@admin_required
def enroll_student(current_user):
    """
    Enroll a student's face embedding into the system.

    Request JSON:
      {
        "student_id": 42,
        "images": ["<base64>", "<base64>", ...]   // 1-10 images recommended
      }
    OR multipart/form-data with fields:
      student_id, images[] (file uploads)

    The pipeline runs face detection + ArcFace embedding on each image,
    averages surviving embeddings, L2-normalises, and stores in DB.
    """
    try:
        images: list[np.ndarray] = []

        # ── JSON body ──────────────────────────────────────────────────────
        if request.is_json:
            data = request.get_json()
            student_id = data.get('student_id')
            raw_images = data.get('images', [])
            if not student_id:
                return jsonify({'message': 'student_id is required'}), 400
            for b64 in raw_images:
                img = _decode_image(b64)
                if img is not None:
                    images.append(img)

        # ── Form-data (file upload) ────────────────────────────────────────
        else:
            student_id = request.form.get('student_id', type=int)
            if not student_id:
                return jsonify({'message': 'student_id is required'}), 400
            for file in request.files.getlist('images'):
                data = file.read()
                arr = np.frombuffer(data, np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img is not None:
                    images.append(img)

        if not images:
            return jsonify({'message': 'No valid images provided'}), 400

        # Verify student exists
        student = db.session.get(Student, student_id)
        if not student:
            return jsonify({'message': f'Student {student_id} not found'}), 404

        pipeline = _get_pipeline()
        successes = []
        last_error = None
        for img in images:
            res = pipeline.enroll_student(
                student_id=student_id,
                image_source=img,
                save_to_db=True,
            )
            if res.get('success'):
                successes.append(res)
            else:
                last_error = res.get('reason', 'unknown')

        if not successes:
            return jsonify({
                'message': f'Enrollment failed for all images: {last_error}'
            }), 422

        return jsonify({
            'message':           'Enrollment successful',
            'student_id':        student_id,
            'images_used':       len(successes),
            'images_submitted':  len(images),
            'embedding_quality': successes[-1].get('quality', 'good'),
        }), 200

    except Exception as exc:
        logger.exception("Enrollment error: %s", exc)
        return jsonify({'message': f'Enrollment failed: {exc}'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Kiosk Recognition  (single image upload)
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/recognize', methods=['POST'])
@token_required
def recognize_image(current_user):
    """
    Recognize a student from a single uploaded photo (Kiosk / manual).

    Request:
      JSON: { "image": "<base64>" }
      OR multipart with field "image"

    Returns:
      confirmed  → student info + similarity score
      review     → low-confidence match, teacher must confirm
      unknown    → no match
      spoofed    → liveness check failed
    """
    try:
        img: np.ndarray | None = None

        if request.is_json:
            data = request.get_json()
            b64 = data.get('image')
            if not b64:
                return jsonify({'message': 'image field is required'}), 400
            img = _decode_image(b64)
        else:
            file = request.files.get('image')
            if file:
                raw = file.read()
                arr = np.frombuffer(raw, np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'message': 'Invalid or missing image'}), 400

        pipeline = _get_pipeline()
        result   = pipeline.recognize_image(img)

        # Enrich with student data if matched
        if result.get('student_id'):
            student = db.session.get(Student, result['student_id'])
            if student:
                result['student'] = student.to_dict()

        return jsonify(result), 200

    except Exception as exc:
        logger.exception("Kiosk recognition error: %s", exc)
        return jsonify({'message': f'Recognition failed: {exc}'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Classroom Session Control
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/session/start', methods=['POST'])
@admin_required
def start_session(current_user):
    """
    Open a classroom camera and start automatic attendance.

    Request JSON:
      {
        "section_id":  3,
        "subject_id":  12,
        "schedule_id": 7,
        "source": "rtsp://192.168.0.20/stream"  // or 0 for webcam
        "recognition_interval": 2.0             // optional, default 2 s
      }
    """
    try:
        data = request.get_json() or {}
        section_id  = data.get('section_id')
        subject_id  = data.get('subject_id')
        schedule_id = data.get('schedule_id')
        source      = data.get('source', 0)
        interval    = float(data.get('recognition_interval', 2.0))

        if not all([section_id, subject_id, schedule_id]):
            return jsonify({
                'message': 'section_id, subject_id, schedule_id are required'
            }), 400

        # Collect section/subject labels for the annotator
        from ..models import Section, Subject, Schedule
        section = db.session.get(Section, section_id)
        subject = db.session.get(Subject, subject_id)
        session_info = {
            'section': f"{section.branch.code}-{section.name}" if section else str(section_id),
            'subject': subject.name if subject else str(subject_id),
        }

        manager = _get_manager()
        result  = manager.start_session(
            section_id=section_id,
            subject_id=subject_id,
            schedule_id=schedule_id,
            source=source,
            session_info=session_info,
            recognition_interval=interval,
        )

        if not result.get('success'):
            return jsonify({'message': result.get('error', 'Failed to start session')}), 500

        result['live_feed_url'] = f'/api/v2/recognition/live_feed/{section_id}'
        return jsonify(result), 200

    except Exception as exc:
        logger.exception("Start session error: %s", exc)
        return jsonify({'message': f'Failed to start session: {exc}'}), 500


@bp.route('/session/stop', methods=['POST'])
@admin_required
def stop_session(current_user):
    """
    Stop a classroom session and persist final attendance.

    Request JSON:  { "section_id": 3 }
    """
    try:
        data = request.get_json() or {}
        section_id = data.get('section_id')
        if not section_id:
            return jsonify({'message': 'section_id is required'}), 400

        result = _get_manager().stop_session(section_id)
        if not result.get('success'):
            return jsonify({'message': result.get('error')}), 404
        return jsonify(result), 200

    except Exception as exc:
        logger.exception("Stop session error: %s", exc)
        return jsonify({'message': f'Failed to stop session: {exc}'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# MJPEG Live Feed
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/live_feed/<int:section_id>', methods=['GET'])
def live_feed(section_id: int):
    """
    MJPEG stream for the admin dashboard.
    No auth wrapper here — stream consumers (browser <img> tags) can't
    easily pass Authorization headers; rely on session cookie / CORS policy.
    """
    gen = _get_manager().live_feed_generator(section_id)
    if gen is None:
        return jsonify({'message': f'No active feed for section {section_id}'}), 404

    return Response(
        gen,
        mimetype='multipart/x-mixed-replace; boundary=frame',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma':        'no-cache',
            'Expires':       '0',
            'X-Accel-Buffering': 'no',   # disable nginx buffering for MJPEG
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Attendance Status
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/attendance_status', methods=['GET'])
@token_required
def all_attendance_status(current_user):
    """All active sections — attendance snapshot."""
    return jsonify(_get_manager().get_all_statuses()), 200


@bp.route('/attendance_status/<int:section_id>', methods=['GET'])
@token_required
def section_attendance_status(current_user, section_id: int):
    """Single section attendance snapshot."""
    status = _get_manager().get_attendance_status(section_id)
    if status is None:
        return jsonify({'message': f'No active session for section {section_id}'}), 404
    return jsonify(status), 200


@bp.route('/active_streams', methods=['GET'])
@admin_required
def active_streams(current_user):
    """Admin overview: every live camera stream with attendance counts."""
    return jsonify(_get_manager().get_active_sections()), 200


@bp.route('/public_status', methods=['GET'])
def public_status():
    """
    Public (no-auth) endpoint for kiosk displays.
    Returns whether any session is active and the first live feed URL.
    Does NOT return sensitive student data — only names of confirmed attendees.
    """
    try:
        manager = _get_manager()
        sections = manager.get_active_sections()
        if not sections:
            return jsonify({'active': False, 'message': 'No active session'}), 200

        # Prefer college session (section_id=0) so the kiosk always shows
        # the campus-wide feed label, not a stale per-section session.
        college_entries = [s for s in sections if s.get('section_id') == 0]
        first = college_entries[0] if college_entries else sections[0]
        section_id = first.get('section_id')
        status = manager.get_attendance_status(section_id) or {}

        # Build lightweight list of confirmed students (name only, no student IDs)
        confirmed_names = []
        for sid in status.get('present', []):
            from ..models import Student
            student = db.session.get(Student, sid)
            if student and student.user:
                confirmed_names.append({
                    'name': student.user.name,
                    'roll_number': student.roll_number,
                })

        # Check if session is headless (no server camera — client pushes frames)
        with manager._lock:
            entry = manager._streams.get(section_id)
        is_headless = entry.processor._headless if entry else False

        session_info = first.get('session_info', {})
        return jsonify({
            'active':        True,
            'section_id':    section_id,
            'section_label': session_info.get('section', str(section_id)),
            'subject_label': session_info.get('subject', ''),
            'live_feed_url': f'/api/v2/recognition/live_feed/{section_id}',
            'present_count': len(status.get('present', [])),
            'recent_attendees': confirmed_names[-10:],  # last 10
            'headless':      is_headless,
            'iot_endpoint':  f'/v2/recognition/iot_frame/{section_id}' if is_headless else None,
        }), 200

    except Exception as exc:
        logger.exception("Public status error: %s", exc)
        return jsonify({'active': False, 'error': str(exc)}), 200


# ─────────────────────────────────────────────────────────────────────────────
# IoT Camera Frame Push
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/iot_frame/<int:section_id>', methods=['POST'])
def iot_frame(section_id: int):
    """
    Endpoint for IoT cameras that PUSH frames over HTTP instead of RTSP pull.

    The camera posts a JPEG frame; the processor runs recognition on it.
    Auth: API-key header X-Camera-Key checked against config.

    Request:  multipart/form-data with field "frame" (JPEG file)
              OR JSON with field "frame" (base64)
    """
    # Light API-key check for embedded devices (no JWT overhead)
    api_key = request.headers.get('X-Camera-Key', '')
    expected = current_app.config.get('IOT_CAMERA_KEY', '')
    if expected and api_key != expected:
        return jsonify({'message': 'Unauthorized'}), 401

    try:
        img: np.ndarray | None = None
        if request.is_json:
            data = request.get_json()
            img = _decode_image(data.get('frame', ''))
        else:
            file = request.files.get('frame')
            if file:
                arr = np.frombuffer(file.read(), np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'message': 'Invalid frame'}), 400

        manager = _get_manager()
        with manager._lock:
            entry = manager._streams.get(section_id)

        if entry is None:
            return jsonify({'message': 'No active session for this section'}), 404

        # Inject the frame directly into the processor's latest_frame slot
        with entry.processor._frame_lock:
            entry.processor._latest_frame = img
        entry.processor._frame_event.set()

        return jsonify({'success': True}), 200

    except Exception as exc:
        logger.exception("IoT frame error: %s", exc)
        return jsonify({'message': f'Frame processing failed: {exc}'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Teacher Review Queue
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/review', methods=['GET'])
@token_required
def get_review_queue(current_user):
    """
    Return all pending uncertain-match items.
    Teachers see only their assigned sections; admins see all.
    """
    section_id = request.args.get('section_id', type=int)
    items = _get_manager().get_pending_reviews(section_id)
    # Strip raw face JPEG data from list view (large payload)
    for item in items:
        item.pop('face_jpeg_b64', None)
    return jsonify({'count': len(items), 'items': items}), 200


@bp.route('/review/<item_id>', methods=['POST'])
@token_required
def resolve_review(current_user, item_id: str):
    """
    Teacher approves or rejects an uncertain match.

    Request JSON:
      { "section_id": 3, "decision": "approve" | "reject" }
    """
    try:
        data = request.get_json() or {}
        section_id = data.get('section_id')
        decision   = data.get('decision')

        if not section_id or decision not in ('approve', 'reject'):
            return jsonify({'message': 'section_id and decision (approve|reject) required'}), 400

        result = _get_manager().resolve_review(
            section_id=section_id,
            item_id=item_id,
            decision=decision,
            teacher_id=current_user.id,
        )

        if not result.get('success'):
            return jsonify({'message': result.get('error')}), 404
        return jsonify(result), 200

    except Exception as exc:
        logger.exception("Review resolve error: %s", exc)
        return jsonify({'message': f'Failed to resolve review: {exc}'}), 500


@bp.route('/review/<item_id>/face', methods=['GET'])
@token_required
def get_review_face(current_user, item_id: str):
    """Return the face JPEG crop for a specific review item (base64)."""
    section_id = request.args.get('section_id', type=int)
    items = _get_manager().get_pending_reviews(section_id)
    target = next((i for i in items if i['id'] == item_id), None)
    if not target:
        return jsonify({'message': 'Review item not found'}), 404
    return jsonify({'face_jpeg_b64': target.get('face_jpeg_b64')}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Embedding Management
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/embeddings/refresh', methods=['POST'])
@admin_required
def refresh_embeddings(current_user):
    """Force reload all student embeddings from the database."""
    try:
        pipeline = _get_pipeline()
        pipeline.refresh_embeddings()
        store    = pipeline.store
        count    = len(store._cache) if hasattr(store, '_cache') else -1
        return jsonify({
            'message':        'Embedding store refreshed',
            'students_loaded': count,
            'refreshed_at':   datetime.utcnow().isoformat(),
        }), 200
    except Exception as exc:
        logger.exception("Embedding refresh error: %s", exc)
        return jsonify({'message': f'Refresh failed: {exc}'}), 500


@bp.route('/embeddings/student/<int:student_id>', methods=['DELETE'])
@admin_required
def delete_student_embedding(current_user, student_id: int):
    """Remove all stored face embeddings for a student (admin only)."""
    try:
        deleted = FaceEmbedding.query.filter_by(student_id=student_id).delete()
        db.session.commit()

        # Evict from in-memory cache
        pipeline = _get_pipeline()
        store    = pipeline.store
        with store._lock:
            store._data.pop(student_id, None)

        return jsonify({
            'message':        f'Deleted {deleted} embedding(s) for student {student_id}',
            'student_id':     student_id,
            'deleted_count':  deleted,
        }), 200

    except Exception as exc:
        db.session.rollback()
        logger.exception("Delete embedding error: %s", exc)
        return jsonify({'message': f'Delete failed: {exc}'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# System Info
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/info', methods=['GET'])
@admin_required
def system_info(current_user):
    """Return face recognition system configuration and statistics."""
    try:
        from ..ml.face_recognition_v2.pipeline import CONFIRM_THRESHOLD, REVIEW_THRESHOLD
        pipeline = _get_pipeline()
        store    = pipeline.store

        total_embeddings = FaceEmbedding.query.count()
        enrolled_students = (
            db.session.query(FaceEmbedding.student_id)
            .distinct()
            .count()
        )

        return jsonify({
            'model':              'InsightFace buffalo_l (ArcFace ResNet100 + SCRFD-10G)',
            'embedding_dim':      512,
            'confirm_threshold':  CONFIRM_THRESHOLD,
            'review_threshold':   REVIEW_THRESHOLD,
            'temporal_window_s':  10,
            'confirm_ratio':      0.70,
            'anti_spoofing':      True,
            'engine_ready':       pipeline.is_ready,
            'active_streams':     len(_get_manager()._streams),
            'embedding_cache':    {
                'students_cached':  store.student_count,
                'students_in_db':   enrolled_students,
                'total_embeddings': total_embeddings,
            },
        }), 200

    except Exception as exc:
        logger.exception("System info error: %s", exc)
        return jsonify({'message': f'Failed to get info: {exc}'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# College-Wide Session (timetable-driven, single camera gateway mode)
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/college/start', methods=['POST'])
@admin_required
def start_college_session(current_user):
    """
    Start campus-wide attendance recognition server.
    One camera scans faces; the system auto-resolves each student's
    current subject from the live timetable and marks attendance.

    Request JSON (all optional):
      { "source": 0, "recognition_interval": 3.0 }
    """
    try:
        data     = request.get_json() or {}
        source   = data.get('source', 0)
        interval = float(data.get('recognition_interval', 3.0))

        result = _get_manager().start_college_session(
            source=source,
            recognition_interval=interval,
        )
        if not result.get('success'):
            return jsonify({'message': result.get('message', 'Failed')}), 500
        return jsonify(result), 200

    except Exception as exc:
        logger.exception("Start college session error: %s", exc)
        return jsonify({'message': f'Failed: {exc}'}), 500


@bp.route('/college/stop', methods=['POST'])
@admin_required
def stop_college_session(current_user):
    """
    Stop the campus-wide recognition server.
    Also stops any stale per-section sessions so the camera fully releases.
    Resets the old-style _recognition_active flag so video_feed returns 503.
    """
    try:
        manager = _get_manager()

        # Stop ALL active sessions — college session (0) + any stale per-section ones.
        # This guarantees VideoCapture(0) is released regardless of how a session started.
        all_results = manager.stop_all()

        # Reset the old per-section recognition flag so /api/recognition/video_feed
        # returns 503 instead of falling back to a raw camera stream.
        try:
            from ..routes import recognition as _old_rec_bp
            _old_rec_bp._recognition_active = False
        except Exception:
            pass

        # Also release old-style CameraStream if somehow still open
        try:
            from ..ml.camera import release_camera_stream
            release_camera_stream()
        except Exception:
            pass

        # Report success if the college session (0) was among what we stopped
        college_result = all_results.get(0, {})
        if not college_result.get('success') and not all_results:
            return jsonify({'message': 'No active sessions'}), 404

        present_total = sum(
            r.get('attendance_count', 0) for r in all_results.values()
        )
        return jsonify({
            'success':          True,
            'sessions_stopped': len(all_results),
            'attendance_count': present_total,
        }), 200
    except Exception as exc:
        logger.exception("Stop college session error: %s", exc)
        return jsonify({'message': f'Failed: {exc}'}), 500


@bp.route('/college/status', methods=['GET'])
@admin_required
def college_session_status(current_user):
    """Check whether the college-wide session is running."""
    manager = _get_manager()
    active  = manager.is_college_session_active()
    result  = {'college_session_active': active}
    if active:
        snap = manager.get_attendance_status(0) or {}
        # Return headless state so frontend can auto-reconnect webcam after page reload
        with manager._lock:
            entry = manager._streams.get(0)
        is_headless = entry.processor._headless if entry else False
        result.update({
            'present_count':  len(snap.get('present', [])),
            'uptime_seconds': snap.get('uptime_seconds', 0),
            'live_feed_url':  '/api/v2/recognition/live_feed/0',
            'headless':       is_headless,
            'iot_endpoint':   '/v2/recognition/iot_frame/0' if is_headless else None,
        })
    return jsonify(result), 200
