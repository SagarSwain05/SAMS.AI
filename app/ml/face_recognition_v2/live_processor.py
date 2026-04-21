"""
ClassroomStreamProcessor — Live Attendance via Temporal Voting
==============================================================
Key architecture (lag-free design):
  capture_thread   → reads camera at max fps, stores latest frame
  stream_thread    → encodes + pushes annotated frames at STREAM_FPS (15 fps)
                     uses CACHED recognition results → no recognition delay in stream
  recognition_thread → runs FaceRecognitionPipeline every N seconds, updates cache
                       does NOT push to MJPEG (stream_thread handles that)

This ensures the live feed is always fluid even when recognition runs every 2-3 s.
"""
from __future__ import annotations

import base64
import threading
import logging
import time
import uuid
from collections import deque, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, date, timezone, timedelta
from typing import Optional

# HF Spaces / gunicorn runs on UTC. Force IST for all schedule checks and display.
_IST = timezone(timedelta(hours=5, minutes=30))

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Temporal Voting Buffer
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class VoteRecord:
    student_id: int
    similarity: float
    timestamp: float        # time.monotonic()


class TemporalVotingBuffer:
    """
    Per-student independent vote accumulator.

    Each student is confirmed based solely on their OWN vote history —
    completely independent of how many other students are in the frame.

    OLD (broken): confirmation required `ratio = student_votes / total_votes >= 0.70`
      → With 2 students each at 4 votes: ratio = 4/8 = 0.50 < 0.70 → neither confirmed.
      → With 4 students:  ratio = 0.25  → nobody ever gets confirmed in a classroom.

    NEW (correct): each student confirmed independently when they have ≥ MIN_VOTES
    votes within WINDOW_SECONDS AND average similarity ≥ MIN_AVG_SIMILARITY.
    Unknown faces no longer participate in any ratio calculation — they are simply ignored.
    """

    WINDOW_SECONDS:     float = 8.0   # sliding time window for votes
    MIN_VOTES:          int   = 1    # 1 confirmed recognition ≥70% sim is sufficient for ArcFace R100
                                     # (previously 2 — but caused multi-person deadlock when
                                     #  accumulation interleaved differently per student)
    MIN_AVG_SIMILARITY: float = 0.60 # average similarity must be ≥ 60%

    def __init__(self):
        self._votes: dict[int, deque[VoteRecord]] = defaultdict(deque)
        self._confirmed: set[int] = set()
        self._lock = threading.Lock()

    def add_vote(self, student_id: int, similarity: float) -> None:
        """Record one recognition hit for a student."""
        now = time.monotonic()
        with self._lock:
            dq = self._votes[student_id]
            dq.append(VoteRecord(student_id, similarity, now))
            self._evict(dq, now)
        logger.debug(
            "VOTE: sid=%d sim=%.3f total_votes=%d confirmed=%s",
            student_id, similarity, len(dq), student_id in self._confirmed
        )

    def add_unknown_vote(self) -> None:
        """No-op — unknown faces do not affect any student's confirmation."""
        # Previously: self.add_vote(0, 0.0) — this was diluting per-student ratios.
        # Now: simply discard unknown votes.
        pass

    def get_confirmed_students(self) -> list[int]:
        """
        Return list of student IDs newly confirmed this cycle.
        Each student evaluated independently — no cross-student comparison.
        """
        now = time.monotonic()
        newly_confirmed: list[int] = []
        with self._lock:
            for sid, dq in list(self._votes.items()):
                if sid == 0:
                    continue
                self._evict(dq, now)
                if not dq:
                    continue

                n_votes = len(dq)
                if n_votes < self.MIN_VOTES:
                    continue   # not enough evidence yet

                avg_sim = sum(v.similarity for v in dq) / n_votes
                if avg_sim < self.MIN_AVG_SIMILARITY:
                    continue   # votes present but quality too low

                # This student has been consistently seen with good similarity
                if sid not in self._confirmed:
                    self._confirmed.add(sid)
                    newly_confirmed.append(sid)

        return newly_confirmed

    def is_confirmed(self, student_id: int) -> bool:
        return student_id in self._confirmed

    def unconfirm(self, student_id: int) -> None:
        """
        Remove a student from the confirmed set so they can accumulate new votes.
        Called when _write_attendance can't find their active class — allows a
        retry on the next recognition cycle instead of silently blocking them.
        """
        with self._lock:
            self._confirmed.discard(student_id)
            # Also clear their accumulated votes so we start fresh
            self._votes.pop(student_id, None)

    def reset(self) -> None:
        with self._lock:
            self._votes.clear()
            self._confirmed.clear()

    def snapshot(self) -> dict:
        now = time.monotonic()
        with self._lock:
            result = {}
            for sid, dq in self._votes.items():
                if sid == 0:
                    continue
                self._evict(dq, now)
                if not dq:
                    continue
                n_votes = len(dq)
                avg_sim = sum(v.similarity for v in dq) / n_votes if dq else 0.0
                result[sid] = {
                    'votes':          n_votes,
                    'confirmed':      sid in self._confirmed,
                    'avg_similarity': round(avg_sim, 3),
                    'ready':          n_votes >= self.MIN_VOTES and avg_sim >= self.MIN_AVG_SIMILARITY,
                }
        return result

    def _evict(self, dq: deque, now: float) -> None:
        cutoff = now - self.WINDOW_SECONDS
        while dq and dq[0].timestamp < cutoff:
            dq.popleft()


# ─────────────────────────────────────────────────────────────────────────────
# Frame Annotator
# ─────────────────────────────────────────────────────────────────────────────

class FrameAnnotator:
    # BGR color palette
    CONFIRMED_COLOR     = (30,  210,  30)   # green  — high confidence match
    REVIEW_COLOR        = (0,   165, 255)   # orange — borderline, teacher review
    UNKNOWN_COLOR       = (0,    40, 220)   # RED    — no match (was grey, now unmistakably red)
    SPOOFED_COLOR       = (128,   0, 128)   # purple — anti-spoof triggered
    SPOOF_REJECT_COLOR  = (0,   165, 255)   # orange
    NO_CLASS_COLOR      = (180, 180,   0)   # teal/yellow — recognised but off-hours
    TEXT_BG             = (0,     0,   0)   # black text backdrop
    FONT                = cv2.FONT_HERSHEY_SIMPLEX
    FONT_SCALE          = 0.52
    THICKNESS           = 2
    BANNER_H            = 32

    @classmethod
    def annotate(
        cls,
        frame: np.ndarray,
        recognition_results: list[dict],
        vote_snapshot: dict,
        session_info: Optional[dict] = None,
    ) -> np.ndarray:
        out = frame.copy()
        h, w = out.shape[:2]

        # ── Top banner ─────────────────────────────────────────────────────
        cv2.rectangle(out, (0, 0), (w, cls.BANNER_H), (20, 20, 20), -1)
        ts = datetime.now(_IST).strftime('%H:%M:%S')  # IST — HF Spaces runs UTC
        if session_info:
            banner = (f"{session_info.get('section','Campus')} | "
                      f"{session_info.get('subject','Auto')} | {ts}")
        else:
            banner = ts
        cv2.putText(out, banner, (6, 22), cls.FONT, 0.50,
                    (200, 200, 200), 1, cv2.LINE_AA)

        for res in recognition_results:
            bbox   = res.get('bbox')
            status = res.get('status', 'unknown')
            name   = res.get('name', '')
            sim    = res.get('similarity', 0.0)
            dist   = res.get('debug_dist', res.get('distance', 1.0))
            sid    = res.get('student_id')
            if bbox is None:
                continue

            x1, y1, x2, y2 = [int(v) for v in bbox]
            has_class     = res.get('has_class', True)
            schedule_note = res.get('schedule_note', '')

            # ── Pick box color ────────────────────────────────────────────
            if status in ('spoofed', 'spoof_rejected'):
                color = cls.SPOOFED_COLOR
            elif status == 'unknown':
                color = cls.UNKNOWN_COLOR          # red — face seen, no match
            elif not has_class:
                color = cls.NO_CLASS_COLOR         # off-hours
            elif status == 'confirmed':
                color = cls.CONFIRMED_COLOR        # green
            elif status == 'review':
                color = cls.REVIEW_COLOR           # orange
            else:
                color = cls.UNKNOWN_COLOR

            cv2.rectangle(out, (x1, y1), (x2, y2), color, cls.THICKNESS)

            vote_count = vote_snapshot.get(sid, {}).get('votes', 0) if sid else 0
            already    = vote_snapshot.get(sid, {}).get('confirmed', False) if sid else False

            # ── Build overlay label ────────────────────────────────────────
            # Always show similarity% so admin/teacher can see the raw score.
            # CRITICAL: never show a student name when status == 'unknown'.
            sim_pct = int(sim * 100)

            if status in ('spoofed', 'spoof_rejected'):
                text = "Liveness fail"

            elif status == 'unknown':
                # Show score so admins can see how far off we are
                text = f"Unknown ({sim_pct}% sim)"

            elif status == 'confirmed':
                if not has_class:
                    # Recognised but outside class hours — show name + note,
                    # but mark clearly so admin knows attendance was NOT marked.
                    text = f"{name} ({sim_pct}%) | {schedule_note or 'No Class'}"
                else:
                    marker = " [PRESENT]" if already else f" v{vote_count}"
                    text = f"{name} ({sim_pct}%){marker}"

            elif status == 'review':
                if not has_class:
                    text = f"? {name} ({sim_pct}%) | {schedule_note or 'No Class'}"
                else:
                    text = f"? {name} ({sim_pct}%)"

            else:
                text = f"Unknown ({sim_pct}%)"

            (tw, th), _ = cv2.getTextSize(text, cls.FONT, cls.FONT_SCALE, 1)
            ty = max(y1 - 6, th + 4)
            cv2.rectangle(out, (x1, ty - th - 4), (x1 + tw + 8, ty + 2),
                          cls.TEXT_BG, -1)
            cv2.putText(out, text, (x1 + 2, ty - 2),
                        cls.FONT, cls.FONT_SCALE, color, 1, cv2.LINE_AA)

        return out


# ─────────────────────────────────────────────────────────────────────────────
# MJPEG Buffer — low-latency single-slot producer/consumer
# ─────────────────────────────────────────────────────────────────────────────

class MJPEGBuffer:
    """Thread-safe buffer holding the latest annotated JPEG frame."""

    JPEG_QUALITY  = 70          # lower = smaller payload = less network lag
    STREAM_WIDTH  = 640         # output resolution for MJPEG (not capture res)
    STREAM_HEIGHT = 480

    def __init__(self):
        self._frame_bytes: Optional[bytes] = None
        self._lock    = threading.Lock()
        self._event   = threading.Event()  # signals new frame available
        self._stopped = False              # set True when session ends

    def push(self, bgr_frame: np.ndarray) -> None:
        if self._stopped:
            return
        # Resize to fixed stream resolution to keep bandwidth predictable
        h, w = bgr_frame.shape[:2]
        if w != self.STREAM_WIDTH or h != self.STREAM_HEIGHT:
            bgr_frame = cv2.resize(bgr_frame, (self.STREAM_WIDTH, self.STREAM_HEIGHT),
                                   interpolation=cv2.INTER_LINEAR)
        ok, buf = cv2.imencode(
            '.jpg', bgr_frame,
            [cv2.IMWRITE_JPEG_QUALITY, self.JPEG_QUALITY,
             cv2.IMWRITE_JPEG_OPTIMIZE, 1]
        )
        if ok:
            with self._lock:
                self._frame_bytes = bytes(buf)
            self._event.set()

    def stop(self) -> None:
        """Signal generator to terminate — called when session ends."""
        self._stopped = True
        self._frame_bytes = None   # clear stale frame so it is never served again
        self._event.set()          # unblock any waiting generator

    def reset(self) -> None:
        """Re-arm buffer for a new session (clears stopped flag)."""
        self._stopped = False
        self._frame_bytes = None
        self._event.clear()

    def latest(self) -> Optional[bytes]:
        with self._lock:
            return self._frame_bytes

    def stream_generator(self):
        """
        Yields multipart/x-mixed-replace chunks.
        Exits cleanly when stop() is called (session ends).
        """
        boundary = b'--frame\r\nContent-Type: image/jpeg\r\n\r\n'
        while not self._stopped:
            # Wait up to 1 s for a new frame, then re-check stopped flag
            self._event.wait(timeout=1.0)
            self._event.clear()
            if self._stopped:
                break
            data = self.latest()
            if data:
                yield boundary + data + b'\r\n'


# ─────────────────────────────────────────────────────────────────────────────
# Classroom Stream Processor
# ─────────────────────────────────────────────────────────────────────────────

class ClassroomStreamProcessor:
    """
    Three-thread design for lag-free live feeds:
      1. capture_thread   — reads frames from camera at max rate
      2. stream_thread    — encodes & pushes to MJPEG at STREAM_FPS using cached recog results
      3. recognition_thread — runs heavy ML every recognition_interval seconds, updates cache

    college_mode : bool
        When True, subject_id is resolved per-student from the active timetable
        instead of using a fixed subject_id. Used for campus-wide gate scanning.
    """

    STREAM_FPS                   = 20       # target fps for MJPEG stream
    DEFAULT_RECOGNITION_INTERVAL = 1.5     # seconds between recognition passes
                                           # 2 votes × 1.5s = 3s to confirm attendance
    CAPTURE_TIMEOUT              = 10.0
    RECONNECT_DELAY              = 3.0     # base delay; grows with backoff
    MAX_RECONNECT_ATTEMPTS       = 30      # ~3 min of retries before giving up

    def __init__(
        self,
        recognition_interval: float = DEFAULT_RECOGNITION_INTERVAL,
        college_mode: bool = False,
    ):
        self.recognition_interval = recognition_interval
        self.college_mode = college_mode

        # Headless mode: no physical camera — frames are pushed via IoT endpoint
        self._headless: bool = False

        self._source: str | int | None     = None
        self._section_id: Optional[int]    = None
        self._subject_id: Optional[int]    = None
        self._schedule_id: Optional[int]   = None
        self._session_info: dict           = {}
        self._session_active               = False
        self._session_start: Optional[datetime] = None

        self._buffer   = TemporalVotingBuffer()
        self._mjpeg    = MJPEGBuffer()
        self._cap: Optional[cv2.VideoCapture] = None

        # Three background threads
        self._capture_thread:     Optional[threading.Thread] = None
        self._recognition_thread: Optional[threading.Thread] = None
        self._stream_thread:      Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # Latest raw frame (from capture → stream/recognition)
        self._latest_frame: Optional[np.ndarray] = None
        self._frame_lock  = threading.Lock()
        self._frame_event = threading.Event()

        # Cached recognition results (from recognition → stream thread)
        self._recog_results: list[dict] = []
        self._recog_lock       = threading.Lock()
        self._recog_timestamp  = 0.0   # monotonic time of last recognition run

        # Attendance tracking
        self._attendance_marked: set[int] = set()
        self._pending_review:   list[dict] = []
        self._pipeline = None

    # ── Session Control ────────────────────────────────────────────────────

    def start_session(
        self,
        section_id:   int,
        subject_id:   int,
        schedule_id:  int,
        source:       str | int,
        session_info: Optional[dict] = None,
    ) -> dict:
        if self._session_active:
            return {'success': False, 'error': 'Session already active'}

        self._section_id  = section_id
        self._subject_id  = subject_id
        self._schedule_id = schedule_id
        self._source      = source
        self._session_info = session_info or {}
        self._session_start = datetime.utcnow()

        self._stop_event.clear()
        self._mjpeg.reset()         # re-arm MJPEG buffer (clears _stopped flag)
        self._buffer.reset()
        self._attendance_marked.clear()
        self._pending_review.clear()
        with self._recog_lock:
            self._recog_results = []

        if self._pipeline is None:
            from .pipeline import get_pipeline
            self._pipeline = get_pipeline()

        # Pre-load embeddings synchronously while we are still inside the HTTP
        # request context. This guarantees the in-memory store is populated before
        # the background recognition thread touches it (fixes "all Unknown" bug).
        self._pipeline.store.load_from_db()

        # Detect headless mode: source == 'headless' OR source is None
        # In headless mode the session runs without a physical camera.
        # Frames are pushed externally via POST /api/v2/recognition/iot_frame/<section_id>
        self._headless = (source == 'headless' or source is None)

        if not self._headless:
            # Claim the physical camera device before opening VideoCapture.
            # This forces the old CameraStream to release VideoCapture(0) so we
            # never have two simultaneous readers on the same device (SIGSEGV risk).
            try:
                from app.ml.camera import set_v2_camera_active
                set_v2_camera_active(True)
            except Exception:
                pass

            if not self._open_capture(source):
                # Camera unavailable — fall back to headless mode automatically
                logger.warning(
                    "Camera source %s unavailable — falling back to headless mode "
                    "(frames accepted via POST /api/v2/recognition/iot_frame/%d)",
                    source, section_id,
                )
                self._headless = True
                try:
                    from app.ml.camera import set_v2_camera_active
                    set_v2_camera_active(False)
                except Exception:
                    pass

        self._session_active = True

        if self._headless:
            # Headless: use a lightweight stub capture thread that just waits for
            # frames pushed via _frame_event (IoT frame endpoint or webcam upload)
            self._capture_thread = threading.Thread(
                target=self._headless_capture_loop,
                name=f'cap-headless-sec{section_id}', daemon=True)
        else:
            self._capture_thread = threading.Thread(
                target=self._capture_loop,
                name=f'cap-sec{section_id}', daemon=True)

        self._stream_thread = threading.Thread(
            target=self._stream_loop,
            name=f'stream-sec{section_id}', daemon=True)
        self._recognition_thread = threading.Thread(
            target=self._recognition_loop,
            name=f'recog-sec{section_id}', daemon=True)

        self._capture_thread.start()
        self._stream_thread.start()
        self._recognition_thread.start()

        logger.info("Session started | section=%d subject=%d source=%s college_mode=%s",
                    section_id, subject_id, source, self.college_mode)
        return {
            'success':     True,
            'section_id':  section_id,
            'subject_id':  subject_id,
            'started_at':  self._session_start.isoformat(),
            'headless':    self._headless,
            'iot_endpoint': f'/api/v2/recognition/iot_frame/{section_id}' if self._headless else None,
        }

    def stop_session(self) -> dict:
        if not self._session_active:
            return {'success': False, 'error': 'No active session'}

        self._session_active = False

        # ── Step 1: signal all threads to exit ────────────────────────────
        self._stop_event.set()

        # Flush the MJPEG buffer so no stale frame is served after stop.
        self._mjpeg.stop()

        # Unblock any thread sleeping on _frame_event.wait()
        self._frame_event.set()

        # ── Step 2: wait for the CAPTURE thread to exit and self-release cap ─
        #
        # CRITICAL — we must NEVER call cap.release() from this (HTTP request)
        # thread while _capture_loop is blocked inside cap.read() in the capture
        # thread.  On macOS AVFoundation that is a cross-thread C++ call into a
        # freed object → EXC_BAD_ACCESS / SIGSEGV → Python process dies.
        #
        # Instead: _capture_loop owns the VideoCapture object and releases it
        # itself in its `finally` block when _stop_event is set.  We simply
        # wait here (up to 8 s — enough for ONNX inference to finish if it
        # started just before stop was requested).
        if self._capture_thread and self._capture_thread.is_alive():
            timeout = 2.0 if self._headless else 8.0
            self._capture_thread.join(timeout=timeout)
            if not self._headless and self._capture_thread.is_alive():
                # Thread did not exit in time — last-resort release.
                # At this point the capture thread is stuck (camera hung),
                # so calling release() is the only remaining option.
                logger.warning(
                    "Capture thread did not exit in 8 s — force-releasing cap")
                cap = self._cap
                self._cap = None
                if cap is not None:
                    try:
                        cap.release()
                    except Exception:
                        pass

        # ── Step 3: wait for stream + recognition threads ──────────────────
        for t in (self._stream_thread, self._recognition_thread):
            if t and t.is_alive():
                t.join(timeout=5.0)

        # ── Step 4: release camera ownership so old CameraStream can reopen ─
        try:
            from app.ml.camera import set_v2_camera_active
            set_v2_camera_active(False)
        except Exception:
            pass

        summary = {
            'success':          True,
            'section_id':       self._section_id,
            'subject_id':       self._subject_id,
            'attendance_count': len(self._attendance_marked),
            'present_ids':      list(self._attendance_marked),
            'pending_review':   len(self._pending_review),
        }
        logger.info("Session ended | section=%d present=%d",
                    self._section_id, len(self._attendance_marked))
        return summary

    def live_feed_generator(self):
        return self._mjpeg.stream_generator()

    @property
    def is_active(self) -> bool:
        """
        True only when the session is intentionally running AND the capture
        thread is still alive.  If the capture thread died unexpectedly
        (camera lost, MAX_RECONNECT_ATTEMPTS exceeded) we synchronise the
        flag here so callers always get a consistent answer.
        """
        if not self._session_active:
            return False
        # If the capture thread has exited without stop_session() being called,
        # the session is effectively dead — update the flag so any subsequent
        # is_active check (health monitor, REST status endpoint) sees False.
        cap_thread = self._capture_thread
        if cap_thread is not None and not cap_thread.is_alive():
            logger.warning("Capture thread found dead while session_active=True — "
                           "auto-correcting session state")
            self._session_active = False
            self._mjpeg.stop()
            return False
        return True

    @property
    def attendance_status(self) -> dict:
        return {
            'section_id':     self._section_id,
            'subject_id':     self._subject_id,
            'present':        sorted(self._attendance_marked),
            'vote_snapshot':  self._buffer.snapshot(),
            'pending_review': len(self._pending_review),
            'session_active': self._session_active,
            'college_mode':   self.college_mode,
            'uptime_seconds': (
                (datetime.utcnow() - self._session_start).total_seconds()
                if self._session_start else 0
            ),
        }

    @property
    def pending_review_items(self) -> list[dict]:
        return list(self._pending_review)

    def clear_review_item(self, item_id: str) -> None:
        self._pending_review = [
            i for i in self._pending_review if i.get('id') != item_id
        ]

    # ── Thread 1a: Headless Capture (keep-alive for no-camera deployments) ────

    def _headless_capture_loop(self) -> None:
        """
        Lightweight keep-alive loop used when no physical camera is available.
        - Stays alive until _stop_event is set so is_active returns True.
        - Does NOT interact with _frame_event (let recognition_loop handle it).
        - Frames arrive from the IoT endpoint (/api/v2/recognition/iot_frame/<id>)
          which writes directly to _latest_frame and sets _frame_event.
        - A one-time placeholder frame is set so the MJPEG stream shows
          something before the first real frame arrives.
        """
        logger.info("Headless capture loop started — awaiting pushed frames via IoT endpoint")

        # Prime a static placeholder so the stream is not empty
        placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(placeholder, "Recognition Server ACTIVE",
                    (100, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 100), 2, cv2.LINE_AA)
        cv2.putText(placeholder, "Send frames via client webcam",
                    (80, 270), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 255), 2, cv2.LINE_AA)
        with self._frame_lock:
            if self._latest_frame is None:
                self._latest_frame = placeholder
        self._frame_event.set()   # wake stream_loop once so it renders the placeholder

        # Just stay alive — external frames are pushed by IoT endpoint directly
        while not self._stop_event.is_set():
            self._stop_event.wait(timeout=1.0)

        logger.info("Headless capture loop stopped")

    # ── Thread 1: Capture (reads frames as fast as camera allows) ──────────

    def _capture_loop(self) -> None:
        """
        Owns VideoCapture for its entire lifetime.
        Releases it in the finally block — NEVER from another thread.
        This is the only safe pattern on macOS AVFoundation / OpenCV.
        """
        reconnect_count = 0
        try:
            while not self._stop_event.is_set():
                cap = self._cap
                if cap is None:
                    break

                # Use grab()+retrieve() split so we can check _stop_event
                # between the two calls. grab() is fast (~1-2 ms on macOS AVFoundation);
                # retrieve() does the actual pixel decode. This lets us exit within
                # one frame interval (~33 ms at 30fps) instead of waiting for cap.read()
                # to block until the NEXT frame arrives.
                try:
                    grabbed = cap.grab()
                except Exception as exc:
                    logger.warning("cap.grab() raised %s — stopping capture", exc)
                    break

                if self._stop_event.is_set():
                    break   # exit immediately — skip expensive retrieve()

                if not grabbed:
                    ret, frame = False, None
                else:
                    try:
                        ret, frame = cap.retrieve()
                    except Exception as exc:
                        logger.warning("cap.retrieve() raised %s", exc)
                        ret, frame = False, None

                if self._stop_event.is_set():
                    break   # exit cleanly before touching frame data

                if not ret:
                    logger.warning("Frame grab failed — reconnecting (%d/%d)",
                                   reconnect_count + 1, self.MAX_RECONNECT_ATTEMPTS)

                    # Release THIS cap from THIS thread (safe — same thread as read)
                    try:
                        cap.release()
                    except Exception:
                        pass
                    self._cap = None

                    reconnect_count += 1
                    if reconnect_count >= self.MAX_RECONNECT_ATTEMPTS:
                        logger.error("Camera lost after %d attempts — giving up; "
                                     "marking session inactive", self.MAX_RECONNECT_ATTEMPTS)
                        # Mark session dead BEFORE setting stop event so that
                        # any health-monitor or caller checking is_active sees
                        # False immediately and can react (e.g. surface an error
                        # in the UI or attempt a restart).
                        self._session_active = False
                        self._mjpeg.stop()      # unblock any waiting MJPEG clients
                        self._stop_event.set()
                        break

                    # Interruptible sleep with exponential backoff (cap at 30s)
                    backoff = min(self.RECONNECT_DELAY * (1.5 ** (reconnect_count - 1)), 30.0)
                    deadline = time.monotonic() + backoff
                    while time.monotonic() < deadline:
                        if self._stop_event.is_set():
                            return
                        time.sleep(0.05)

                    if self._stop_event.is_set():
                        break
                    if not self._open_capture(self._source):
                        continue
                    reconnect_count = 0
                    continue

                reconnect_count = 0
                with self._frame_lock:
                    self._latest_frame = frame
                self._frame_event.set()

        finally:
            # ── Always release VideoCapture from THIS thread ──────────────
            # This is the ONLY place cap.release() is called.
            # stop_session() never calls cap.release() — it just sets _stop_event
            # and waits for this finally block to run.
            cap = self._cap
            self._cap = None
            if cap is not None:
                try:
                    cap.release()
                    logger.debug("VideoCapture released by capture thread")
                except Exception as exc:
                    logger.warning("cap.release() error in finally: %s", exc)

    # ── Thread 2: Stream (encodes + pushes MJPEG at STREAM_FPS) ───────────

    def _stream_loop(self) -> None:
        """
        Push annotated frames to the MJPEG buffer at STREAM_FPS.
        Uses CACHED recognition results — never blocks on recognition.
        """
        target_interval = 1.0 / self.STREAM_FPS
        last_push = 0.0

        while not self._stop_event.is_set():
            now = time.monotonic()
            sleep_needed = target_interval - (now - last_push)
            if sleep_needed > 0:
                time.sleep(sleep_needed)
                continue

            with self._frame_lock:
                frame = self._latest_frame

            if frame is None:
                time.sleep(0.02)
                continue

            with self._recog_lock:
                cached_results = list(self._recog_results)
                result_age = time.monotonic() - self._recog_timestamp

            # Don't overlay stale bboxes — if results are older than 1.2× recognition
            # interval, the person has likely moved so boxes would be misaligned.
            if result_age > self.recognition_interval * 1.2:
                cached_results = []

            try:
                annotated = FrameAnnotator.annotate(
                    frame, cached_results,
                    self._buffer.snapshot(), self._session_info
                )
                self._mjpeg.push(annotated)
            except Exception as exc:
                logger.debug("Stream annotate error: %s", exc)
                # Push raw frame as fallback
                self._mjpeg.push(frame)

            last_push = time.monotonic()

    # ── Thread 3: Recognition (heavy ML, runs every N seconds) ────────────

    def _recognition_loop(self) -> None:
        """Run face recognition every recognition_interval s, cache results."""
        last_run = 0.0

        while not self._stop_event.is_set():
            now = time.monotonic()
            if now - last_run < self.recognition_interval:
                time.sleep(0.1)
                continue

            # Get latest frame
            self._frame_event.wait(timeout=5.0)
            self._frame_event.clear()
            with self._frame_lock:
                frame = self._latest_frame

            if frame is None:
                continue

            last_run = time.monotonic()

            try:
                # check_liveness=False for live webcam — anti-spoof is for photo uploads;
                # JPEG compression in video streams triggers false spoof flags.
                results = self._pipeline.recognize_frame(frame, check_liveness=False)
            except Exception as exc:
                logger.exception("Recognition error: %s", exc)
                continue

            # Enrich results with student names (batch DB lookup)
            results = self._enrich_with_names(results)

            # Tag each result with current schedule status (off-hours / weekend / no class).
            # Attendance is never marked on off-hours — but the face is still shown on screen.
            results = self._tag_schedule_status(results)

            # Update cached results for stream thread
            with self._recog_lock:
                self._recog_results = results
                self._recog_timestamp = time.monotonic()

            # Process votes → confirm attendance (skips no_class results)
            # Wrapped in try/except so ANY exception (DB, model, etc.) never
            # kills this thread — recognition continues and retries next cycle.
            try:
                newly_confirmed = self._process_results(frame, results)
                if newly_confirmed:
                    self._write_attendance(newly_confirmed)
            except Exception as exc:
                logger.exception(
                    "Attendance processing error (recognition thread continues): %s", exc
                )

    # ── Schedule Status Tag ────────────────────────────────────────────────

    def _tag_schedule_status(self, results: list[dict]) -> list[dict]:
        """
        Add 'has_class' bool and 'schedule_note' string to each recognized result.
        On weekends, outside class hours, or in college_mode with no active slot,
        recognized students show on screen but NO attendance is written.
        This runs in the recognition thread (already inside app context via write_attendance).
        """
        # Use IST — HF Spaces / cloud servers run on UTC.
        # datetime.now() without tz would give UTC, making a 9 AM IST class
        # appear as 3:30 AM and never match any teaching slot.
        now = datetime.now(_IST)
        day = now.weekday()   # 0=Mon..6=Sun
        is_weekend = day >= 5

        if is_weekend:
            schedule_note = 'Weekend — No Classes'
            for r in results:
                if r.get('student_id'):
                    r['has_class'] = False
                    r['schedule_note'] = schedule_note
            return results

        # Weekday — check if current time falls in any teaching slot
        current_hm = now.strftime('%H:%M')
        flask_app = getattr(self._pipeline.store, '_flask_app', None)

        def _check():
            from app.models import TimeSlot
            slots = TimeSlot.query.filter_by(is_break=False).all()
            for slot in slots:
                if slot.start_time <= current_hm <= slot.end_time:
                    return True, f"{slot.label} ({slot.start_time}–{slot.end_time})"
            return False, f"No class scheduled at {current_hm}"

        try:
            if flask_app:
                with flask_app.app_context():
                    in_slot, note = _check()
            else:
                in_slot, note = _check()
        except Exception:
            in_slot, note = True, ''   # fail-open: don't block attendance

        for r in results:
            if r.get('student_id'):
                r['has_class'] = in_slot
                r['schedule_note'] = '' if in_slot else note

        return results

    # ── Attendance Logic ───────────────────────────────────────────────────

    # Minimum similarity to count a vote at full weight.
    # Matches user requirement: "similarity ≥ 70% → mark present".
    # Any recognized student at ≥70% sim gets a full-weight vote regardless
    # of whether the pipeline labelled them 'confirmed' or 'review' (the
    # pipeline's confirmed/review boundary can oscillate ±2% due to frame
    # variation — we bypass that oscillation here with a direct sim check).
    FULL_WEIGHT_SIM = 0.70

    def _process_results(self, frame: np.ndarray, results: list[dict]) -> list[int]:
        logger.info("_process_results: %d face(s) detected", len(results))

        for res in results:
            status   = res.get('status')
            sid      = res.get('student_id')
            sim      = res.get('similarity', 0.0)
            name     = res.get('name', '?')
            has_cls  = res.get('has_class', True)

            logger.info(
                "  face: %s (sid=%s) sim=%.2f status=%s has_class=%s already_marked=%s",
                name, sid, sim, status, has_cls, sid in self._attendance_marked
            )

            # Never mark attendance for off-hour / weekend recognitions
            if not has_cls:
                logger.info("    → skipped (no class / off-hours)")
                continue

            if sid and status not in ('unknown', 'spoofed', 'spoof_rejected', None):
                if sim >= self.FULL_WEIGHT_SIM:
                    # ≥70% similarity: full-weight vote regardless of confirmed/review
                    self._buffer.add_vote(sid, sim)
                    logger.info("    → full-weight vote (sim=%.2f >= %.2f)", sim, self.FULL_WEIGHT_SIM)
                elif status == 'review':
                    self._buffer.add_vote(sid, sim * 0.8)
                    logger.info("    → review vote (sim=%.2f * 0.8 = %.2f)", sim, sim * 0.8)
                    if sid not in self._attendance_marked:
                        self._queue_for_review(frame, res)
                elif status == 'confirmed':
                    self._buffer.add_vote(sid, sim)
                    logger.info("    → confirmed vote (sim=%.2f)", sim)
            else:
                logger.info("    → ignored (status=%s sid=%s)", status, sid)
                if status in ('unknown', 'spoofed'):
                    self._buffer.add_unknown_vote()

        buf_snap = self._buffer.snapshot()
        logger.info("Buffer snapshot: %s", buf_snap)

        newly = [
            sid for sid in self._buffer.get_confirmed_students()
            if sid not in self._attendance_marked
        ]
        if newly:
            logger.info("Newly confirmed for attendance: %s", newly)
        return newly

    def _queue_for_review(self, frame: np.ndarray, res: dict) -> None:
        sid = res.get('student_id')
        if any(r['student_id'] == sid for r in self._pending_review):
            return
        bbox = res.get('bbox')
        face_crop = None
        if bbox is not None:
            x1, y1, x2, y2 = [max(0, int(v)) for v in bbox]
            face_crop_bgr = frame[y1:y2, x1:x2]
            ok, buf = cv2.imencode('.jpg', face_crop_bgr,
                                   [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                face_crop = base64.b64encode(bytes(buf)).decode()

        self._pending_review.append({
            'id':           str(uuid.uuid4()),
            'student_id':   sid,
            'name':         res.get('name', '?'),
            'similarity':   res.get('similarity', 0.0),
            'timestamp':    datetime.utcnow().isoformat(),
            'face_jpeg_b64': face_crop,
        })

    def _enrich_with_names(self, results: list[dict]) -> list[dict]:
        """
        Add 'name' field to recognition results using a single batch DB lookup.
        Uses the stored flask_app reference to push an app context from background threads.
        """
        student_ids = [r['student_id'] for r in results if r.get('student_id')]
        if not student_ids:
            return results

        flask_app = getattr(self._pipeline.store, '_flask_app', None)

        def _do_enrich():
            from app.models import Student
            students = Student.query.filter(
                Student.id.in_(student_ids)
            ).all()
            name_map = {
                s.id: (s.user.name if s.user else f'Student #{s.id}')
                for s in students
            }
            for r in results:
                sid = r.get('student_id')
                if sid:
                    r['name'] = name_map.get(sid, f'ID:{sid}')

        try:
            if flask_app is not None:
                with flask_app.app_context():
                    _do_enrich()
            else:
                _do_enrich()
        except RuntimeError:
            for r in results:
                sid = r.get('student_id')
                if sid and 'name' not in r:
                    r['name'] = f'Student {sid}'
        except Exception as exc:
            logger.debug("Name enrichment error: %s", exc)
        return results

    def _write_attendance(self, student_ids: list[int]) -> None:
        if not student_ids:
            return

        # Final safety check — never write attendance on weekends regardless of
        # how we got here (belt-and-suspenders, main guard is _tag_schedule_status).
        if datetime.now(_IST).weekday() >= 5:
            logger.info("_write_attendance: weekend guard (IST) — refusing to write %s", student_ids)
            return

        flask_app = getattr(self._pipeline.store, '_flask_app', None)

        def _do_write():
            from app.models import db, AttendanceLog
            now_ist = datetime.now(_IST)   # Use IST for date and time columns
            today   = now_ist.date()       # IST date (avoids UTC midnight edge-case)
            now     = now_ist              # time() will be IST local time
            newly_written: list[int] = []   # track who was queued this batch

            logger.info("_write_attendance: processing %d students: %s", len(student_ids), student_ids)

            for sid in student_ids:
                if sid in self._attendance_marked:
                    continue

                # College mode: resolve subject from live timetable
                subject_id = self._subject_id
                if self.college_mode or subject_id is None:
                    subject_id = self._resolve_subject_for_student(sid)
                    if subject_id is None:
                        # No active class found RIGHT NOW for this student.
                        # Don't permanently block them — reset buffer so they can
                        # be re-confirmed when their class starts (or on retry).
                        logger.info(
                            "No active class for student=%d — will retry next cycle",
                            sid
                        )
                        self._buffer.unconfirm(sid)   # allow re-accumulation
                        # Do NOT add to _attendance_marked here: that would
                        # prevent any future marking for this session.
                        continue

                existing = AttendanceLog.query.filter_by(
                    student_id=sid,
                    subject_id=subject_id,
                    date=today,
                    status='present',
                ).first()
                if existing:
                    self._attendance_marked.add(sid)
                    continue

                log = AttendanceLog(
                    student_id=sid,
                    subject_id=subject_id,
                    date=today,
                    time=now.time(),
                    status='present',
                    marked_by='face_recognition',
                )
                db.session.add(log)
                newly_written.append(sid)
                logger.info("Queued attendance: student=%d subject=%d", sid, subject_id)

            db.session.commit()
            # Only mark as done AFTER successful DB commit — prevents stuck state
            # where a failed commit leaves students confirmed-but-unmarked forever
            for sid in newly_written:
                self._attendance_marked.add(sid)
                logger.info("Attendance committed: student=%d", sid)

        try:
            if flask_app is not None:
                with flask_app.app_context():
                    _do_write()
            else:
                _do_write()
        except RuntimeError:
            for sid in student_ids:
                self._attendance_marked.add(sid)
        except Exception as exc:
            logger.exception("Failed to write attendance: %s", exc)
            # Unconfirm so get_confirmed_students returns them again next cycle
            for sid in student_ids:
                if sid not in self._attendance_marked:
                    self._buffer.unconfirm(sid)
            try:
                from app.models import db
                db.session.rollback()
            except Exception:
                pass

    def _resolve_subject_for_student(self, student_id: int) -> Optional[int]:
        """
        College mode: find which subject this student has right now,
        based on their section's timetable and the current wall-clock time.

        Handles section_id=None by falling back to legacy class_name + section
        fields to find the section from the Branch/Section tables.
        """
        try:
            from app.models import Student, TimeSlot, Schedule, Section, Branch

            student = Student.query.get(student_id)
            if not student:
                return None

            # ── Resolve section_id (with fallback for legacy records) ────────
            sec_id = student.section_id
            if not sec_id:
                # Legacy fields: class_name = branch code (e.g. "CSE"),
                # section = "A" / "B" / "C"
                branch = Branch.query.filter_by(code=student.class_name).first()
                if branch:
                    sec_obj = Section.query.filter_by(
                        branch_id=branch.id,
                        name=student.section,
                    ).first()
                    sec_id = sec_obj.id if sec_obj else None
                if not sec_id:
                    logger.warning(
                        "Cannot resolve section for student=%d "
                        "(class_name=%s section=%s section_id=None) — "
                        "will not mark attendance",
                        student_id, student.class_name, student.section
                    )
                    return None

            # Use IST — slot strings in DB are stored in IST (10:00, 11:00, …).
            # datetime.now() on HF Spaces returns UTC (offset by -5:30).
            now = datetime.now(_IST)
            # weekday() → 0=Mon .. 4=Fri; skip weekends
            day = now.weekday()
            if day > 4:
                return None

            current_hm = now.strftime('%H:%M')

            time_slots = TimeSlot.query.filter_by(is_break=False).all()
            active_slot = None
            for slot in time_slots:
                if slot.start_time <= current_hm <= slot.end_time:
                    active_slot = slot
                    break

            if not active_slot:
                return None

            schedule = Schedule.query.filter_by(
                section_id=sec_id,
                time_slot_id=active_slot.id,
                day_of_week=day,
            ).first()

            if schedule:
                return schedule.subject_id
            logger.info(
                "No schedule entry for student=%d section=%d slot=%d day=%d",
                student_id, sec_id, active_slot.id, day
            )
            return None

        except Exception as exc:
            logger.warning("Subject resolve error for student=%d: %s", student_id, exc)
            return None

    # ── Camera Helpers ─────────────────────────────────────────────────────

    def _open_capture(self, source: str | int) -> bool:
        try:
            cap = cv2.VideoCapture(source)
            if not cap.isOpened():
                logger.error("VideoCapture failed to open: %s", source)
                return False

            # Low-latency settings
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if isinstance(source, int):
                # Webcam: set resolution + fps for low latency
                cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cap.set(cv2.CAP_PROP_FPS, 30)
                # NOTE: Do NOT force MJPEG codec here — on macOS it causes AVFoundation
                # to allocate internal buffers that interfere with Python GC and trigger
                # EXC_BAD_ACCESS crashes after ~2 minutes of use.

            deadline = time.monotonic() + self.CAPTURE_TIMEOUT
            while time.monotonic() < deadline:
                ret, _ = cap.read()
                if ret:
                    self._cap = cap
                    return True
                time.sleep(0.1)

            cap.release()
            logger.error("No frames from source within %.0f s: %s",
                         self.CAPTURE_TIMEOUT, source)
            return False

        except Exception as exc:
            logger.exception("Exception opening capture: %s", exc)
            return False
