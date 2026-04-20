"""
MultiCameraStreamManager — Orchestrates All Classroom Streams
=============================================================
Singleton that manages one ClassroomStreamProcessor per active section.

Features:
  • Start / stop individual classroom sessions
  • Broadcast attendance events via Flask-SocketIO
  • Health monitoring (dead-stream detection + auto-restart)
  • MJPEG feed routing per section_id
  • Admin overview API: list all active feeds + attendance counts
  • Thread-safe — all public methods acquire the manager lock

Usage (in Flask route):
    mgr = get_stream_manager()
    mgr.start_session(section_id=3, subject_id=12, schedule_id=7,
                      source="rtsp://192.168.0.20/stream")
    # Then GET /api/v2/recognition/live_feed/3 → MJPEG
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Stream Entry — wrapper kept per active session
# ─────────────────────────────────────────────────────────────────────────────

class StreamEntry:
    __slots__ = (
        'section_id', 'subject_id', 'schedule_id', 'source',
        'processor', 'started_at', 'session_info',
    )

    def __init__(self, section_id, subject_id, schedule_id, source,
                 processor, session_info):
        self.section_id   = section_id
        self.subject_id   = subject_id
        self.schedule_id  = schedule_id
        self.source       = source
        self.processor    = processor
        self.started_at   = time.monotonic()
        self.session_info = session_info


# ─────────────────────────────────────────────────────────────────────────────
# MultiCameraStreamManager
# ─────────────────────────────────────────────────────────────────────────────

class MultiCameraStreamManager:
    """
    Manages the full pool of active classroom camera sessions.

    Singleton — use get_stream_manager() to obtain the instance.
    """

    HEALTH_CHECK_INTERVAL = 30.0    # s between health sweeps
    MAX_DEAD_SECONDS      = 60.0    # stream considered dead after this

    def __init__(self):
        self._streams: dict[int, StreamEntry] = {}   # section_id → StreamEntry
        self._lock    = threading.Lock()
        self._socketio = None    # injected after app creation

        # Health-check thread
        self._health_thread = threading.Thread(
            target=self._health_loop,
            name='stream-health',
            daemon=True,
        )
        self._health_thread.start()

    # ── Injection ──────────────────────────────────────────────────────────

    def init_socketio(self, socketio) -> None:
        """Called from app factory after SocketIO is created."""
        self._socketio = socketio

    # ── Session Lifecycle ──────────────────────────────────────────────────

    def start_session(
        self,
        section_id:   int,
        subject_id:   int,
        schedule_id:  int,
        source:       str | int,
        session_info: Optional[dict] = None,
        recognition_interval: float = 2.0,
    ) -> dict:
        """
        Open a camera stream and start face recognition for a section.

        If a session is already active for this section, returns its status
        without creating a duplicate.
        """
        with self._lock:
            if section_id in self._streams:
                existing = self._streams[section_id]
                return {
                    'success':    True,
                    'message':    'Session already active',
                    'section_id': section_id,
                    'source':     existing.source,
                }

            from .live_processor import ClassroomStreamProcessor
            processor = ClassroomStreamProcessor(
                recognition_interval=recognition_interval
            )

        # Start outside lock (can block while opening camera)
        result = processor.start_session(
            section_id=section_id,
            subject_id=subject_id,
            schedule_id=schedule_id,
            source=source,
            session_info=session_info,
        )

        if not result.get('success'):
            return result

        with self._lock:
            self._streams[section_id] = StreamEntry(
                section_id=section_id,
                subject_id=subject_id,
                schedule_id=schedule_id,
                source=source,
                processor=processor,
                session_info=session_info or {},
            )

        logger.info("Stream started | section=%d source=%s", section_id, source)
        self._emit('stream_started', {
            'section_id': section_id,
            'subject_id': subject_id,
        })
        return result

    def stop_session(self, section_id: int) -> dict:
        """Stop a classroom session and remove it from the pool."""
        with self._lock:
            entry = self._streams.pop(section_id, None)

        if entry is None:
            return {'success': False, 'error': f'No active session for section {section_id}'}

        result = entry.processor.stop_session()

        # Emit final attendance summary
        self._emit('stream_ended', {
            'section_id': section_id,
            'present_ids': result.get('present_ids', []),
            'attendance_count': result.get('attendance_count', 0),
        })

        logger.info("Stream stopped | section=%d present=%d",
                    section_id, result.get('attendance_count', 0))
        return result

    def start_college_session(
        self,
        source: str | int = 0,
        recognition_interval: float = 3.0,
    ) -> dict:
        """
        Campus-wide gate scanner.
        Starts ONE camera session (section_id=0 sentinel) in college_mode.
        The processor resolves each student's current subject from the timetable.
        Returns immediately; recognition runs in background.
        """
        COLLEGE_SECTION_ID = 0   # sentinel — not a real section

        with self._lock:
            if COLLEGE_SECTION_ID in self._streams:
                return {'success': True, 'message': 'College session already active'}

            from .live_processor import ClassroomStreamProcessor
            processor = ClassroomStreamProcessor(
                recognition_interval=recognition_interval,
                college_mode=True,
            )

        session_info = {'section': 'Campus', 'subject': 'Auto (Timetable)'}
        result = processor.start_session(
            section_id=COLLEGE_SECTION_ID,
            subject_id=0,        # resolved per student
            schedule_id=0,
            source=source,
            session_info=session_info,
        )

        if not result.get('success'):
            return result

        with self._lock:
            self._streams[COLLEGE_SECTION_ID] = StreamEntry(
                section_id=COLLEGE_SECTION_ID,
                subject_id=0,
                schedule_id=0,
                source=source,
                processor=processor,
                session_info=session_info,
            )

        headless = result.get('headless', False)
        logger.info("College session started | source=%s headless=%s", source, headless)
        self._emit('college_session_started', {'source': str(source), 'headless': headless})
        return {
            'success': True,
            'message': 'College recognition server started',
            'live_feed_url': '/api/v2/recognition/live_feed/0',
            'headless': headless,
            'iot_endpoint': '/api/v2/recognition/iot_frame/0' if headless else None,
            'mode': 'headless (no server camera — send frames via webcam)' if headless else 'camera',
        }

    def is_college_session_active(self) -> bool:
        with self._lock:
            return 0 in self._streams

    def stop_all(self) -> dict:
        """Stop every active session (e.g., server shutdown)."""
        with self._lock:
            section_ids = list(self._streams.keys())

        results = {}
        for sid in section_ids:
            results[sid] = self.stop_session(sid)
        return results

    # ── Feed Access ────────────────────────────────────────────────────────

    def live_feed_generator(self, section_id: int):
        """
        Returns a generator yielding MJPEG bytes for the given section.
        Returns None if no active session.
        """
        with self._lock:
            entry = self._streams.get(section_id)
        if entry is None:
            return None
        return entry.processor.live_feed_generator()

    def get_attendance_status(self, section_id: int) -> Optional[dict]:
        with self._lock:
            entry = self._streams.get(section_id)
        if entry is None:
            return None
        return entry.processor.attendance_status

    def get_all_statuses(self) -> list[dict]:
        """Return attendance snapshot for every active stream."""
        with self._lock:
            entries = list(self._streams.values())
        return [e.processor.attendance_status for e in entries]

    def get_active_sections(self) -> list[dict]:
        """Overview of all running streams (for admin dashboard)."""
        with self._lock:
            entries = list(self._streams.items())
        result = []
        for sid, entry in entries:
            snap = entry.processor.attendance_status
            result.append({
                'section_id':    sid,
                'subject_id':    entry.subject_id,
                'source':        entry.source,
                'session_info':  entry.session_info,
                'present_count': len(snap.get('present', [])),
                'is_active':     entry.processor.is_active,
                'uptime_seconds': snap.get('uptime_seconds', 0),
            })
        return result

    def get_pending_reviews(self, section_id: Optional[int] = None) -> list[dict]:
        """Items queued for teacher review (uncertain matches)."""
        with self._lock:
            entries = (
                [self._streams[section_id]]
                if section_id and section_id in self._streams
                else list(self._streams.values())
            )
        reviews = []
        for entry in entries:
            items = entry.processor.pending_review_items
            for item in items:
                item['section_id'] = entry.section_id
            reviews.extend(items)
        return reviews

    def resolve_review(
        self,
        section_id: int,
        item_id:    str,
        decision:   str,        # 'approve' | 'reject'
        teacher_id: int,
    ) -> dict:
        """
        Teacher approves or rejects a pending review item.
        If approved → mark attendance in DB and add to confirmed set.
        """
        with self._lock:
            entry = self._streams.get(section_id)

        if entry is None:
            return {'success': False, 'error': 'Section not active'}

        # Find item
        items = entry.processor.pending_review_items
        target = next((i for i in items if i['id'] == item_id), None)
        if target is None:
            return {'success': False, 'error': 'Review item not found'}

        entry.processor.clear_review_item(item_id)

        if decision == 'approve':
            sid = target['student_id']
            # Manually mark present (pipeline has no vote — use direct DB write)
            entry.processor._write_attendance([sid])
            self._emit('attendance_approved', {
                'section_id': section_id,
                'student_id': sid,
                'teacher_id': teacher_id,
            })
            return {'success': True, 'action': 'approved', 'student_id': sid}

        return {'success': True, 'action': 'rejected'}

    # ── SocketIO Events ────────────────────────────────────────────────────

    def _emit(self, event: str, data: dict) -> None:
        """Emit a SocketIO event (best-effort — silently skips if not available)."""
        if self._socketio is None:
            return
        try:
            self._socketio.emit(event, data, namespace='/attendance')
        except Exception as exc:
            logger.debug("SocketIO emit failed (%s): %s", event, exc)

    def broadcast_attendance_update(self, section_id: int) -> None:
        """Manually push current attendance state to WebSocket clients."""
        status = self.get_attendance_status(section_id)
        if status:
            self._emit('attendance_update', status)

    # ── Health Monitor ─────────────────────────────────────────────────────

    def _health_loop(self) -> None:
        """
        Periodically checks for dead streams and attempts to restart them.
        A stream is considered dead when processor.is_active is False
        but it's still registered in _streams.
        """
        while True:
            time.sleep(self.HEALTH_CHECK_INTERVAL)
            try:
                self._health_check()
            except Exception as exc:
                logger.exception("Health check error: %s", exc)

    def _health_check(self) -> None:
        with self._lock:
            dead_entries = [
                (sid, entry)
                for sid, entry in self._streams.items()
                if not entry.processor.is_active
            ]

        for sid, entry in dead_entries:
            elapsed = time.monotonic() - entry.started_at
            logger.warning("Dead stream detected | section=%d uptime=%.0fs",
                           sid, elapsed)

            if elapsed < self.MAX_DEAD_SECONDS:
                # Try restart
                logger.info("Attempting restart | section=%d", sid)
                restart_result = entry.processor.start_session(
                    section_id=entry.section_id,
                    subject_id=entry.subject_id,
                    schedule_id=entry.schedule_id,
                    source=entry.source,
                    session_info=entry.session_info,
                )
                if restart_result.get('success'):
                    logger.info("Stream restarted | section=%d", sid)
                    self._emit('stream_restarted', {'section_id': sid})
                else:
                    logger.error("Restart failed | section=%d", sid)
                    self._remove_dead(sid)
            else:
                # Give up
                self._remove_dead(sid)

    def _remove_dead(self, section_id: int) -> None:
        with self._lock:
            self._streams.pop(section_id, None)
        self._emit('stream_failed', {'section_id': section_id})
        logger.error("Stream permanently removed | section=%d", section_id)


# ─────────────────────────────────────────────────────────────────────────────
# Singleton accessor
# ─────────────────────────────────────────────────────────────────────────────

_manager_instance: Optional[MultiCameraStreamManager] = None
_manager_lock = threading.Lock()


def get_stream_manager() -> MultiCameraStreamManager:
    global _manager_instance
    if _manager_instance is None:
        with _manager_lock:
            if _manager_instance is None:
                _manager_instance = MultiCameraStreamManager()
    return _manager_instance
