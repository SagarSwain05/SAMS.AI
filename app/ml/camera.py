"""
Camera Module for Webcam Access and MJPEG Streaming
"""
import cv2
import threading
import time
from datetime import datetime
import numpy as np


class Camera:
    """Camera class for webcam access and frame capture"""

    def __init__(self, camera_index=0, width=640, height=480):
        """
        Initialize camera

        Args:
            camera_index (int): Camera device index
            width (int): Frame width
            height (int): Frame height
        """
        self.camera_index = camera_index
        self.width = width
        self.height = height

        self.video = None
        self.frame = None
        self.is_running = False
        self._initialized = False
        self.lock = threading.Lock()

    def initialize(self):
        """Initialize the camera (lazy — called on first use)"""
        if self._initialized and self.video is not None and self.video.isOpened():
            return True

        try:
            if self.video is not None:
                self.video.release()

            self.video = cv2.VideoCapture(self.camera_index)

            if not self.video.isOpened():
                raise Exception(f"Failed to open camera {self.camera_index}")

            # Set camera properties
            self.video.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.video.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self.video.set(cv2.CAP_PROP_FPS, 30)

            # Read first frame
            success, frame = self.video.read()

            if not success:
                raise Exception("Failed to read from camera")

            self.frame = frame
            self._initialized = True
            return True

        except Exception as e:
            print(f"Camera initialization error: {e}")
            self._initialized = False
            return False

    def start(self):
        """Start continuous frame capture in background thread"""
        if self.is_running:
            return

        # Lazy-initialize the camera hardware on first start
        if not self._initialized:
            if not self.initialize():
                print("Warning: Camera failed to initialize, stream will show blank frames")

        self.is_running = True
        self.thread = threading.Thread(target=self._update_frame, daemon=True)
        self.thread.start()

    def stop(self):
        """Stop frame capture"""
        self.is_running = False

        if hasattr(self, 'thread'):
            self.thread.join()

    def _update_frame(self):
        """Background thread to continuously update frames"""
        while self.is_running:
            try:
                success, frame = self.video.read()

                if success:
                    with self.lock:
                        self.frame = frame
                else:
                    print("Failed to read frame")
                    time.sleep(0.1)

            except Exception as e:
                print(f"Frame update error: {e}")
                time.sleep(0.1)

    def get_frame(self):
        """
        Get current frame

        Returns:
            numpy.ndarray: Current frame or None
        """
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

    def release(self):
        """Release camera resources"""
        self.stop()

        if self.video is not None:
            self.video.release()
            self.video = None

    def __del__(self):
        """Destructor to ensure camera is released"""
        self.release()


class CameraStream:
    """Camera stream with face detection and recognition"""

    def __init__(self, camera_index=0, face_detector=None, face_recognizer=None):
        """
        Initialize camera stream

        Args:
            camera_index (int): Camera device index
            face_detector: FaceDetector instance
            face_recognizer: FaceRecognizer instance
        """
        self.camera = Camera(camera_index)
        self.face_detector = face_detector
        self.face_recognizer = face_recognizer

        self.detection_enabled = False
        self.recognition_enabled = False

        # Recognition results cache
        self.last_recognition_results = []
        self.results_lock = threading.Lock()

    def start(self):
        """Start camera stream"""
        self.camera.start()

    def stop(self):
        """Stop camera stream and release camera"""
        self.detection_enabled = False
        self.recognition_enabled = False
        self.camera.stop()
        # Actually release the camera hardware
        self.camera.release()

    def enable_detection(self, enabled=True):
        """Enable/disable face detection"""
        self.detection_enabled = enabled

    def enable_recognition(self, enabled=True):
        """Enable/disable face recognition"""
        self.recognition_enabled = enabled

    def get_frame_with_overlay(self, draw_boxes=True, draw_labels=True):
        """
        Get frame with face detection and recognition overlay

        Args:
            draw_boxes (bool): Draw face bounding boxes
            draw_labels (bool): Draw recognition labels

        Returns:
            numpy.ndarray: Frame with overlay
        """
        frame = self.camera.get_frame()

        if frame is None:
            return None

        # Make a copy to draw on
        output_frame = frame.copy()

        recognition_results = []

        # Detect faces if enabled
        if self.detection_enabled and self.face_detector is not None:
            faces = self.face_detector.detect_faces(frame)

            for (x, y, w, h) in faces:
                # Draw box if enabled
                if draw_boxes:
                    color = (0, 255, 0)  # Green by default
                    cv2.rectangle(output_frame, (x, y), (x + w, y + h), color, 2)

                # Recognize face if enabled
                if self.recognition_enabled and self.face_recognizer is not None:
                    face_roi = frame[y:y + h, x:x + w]

                    try:
                        result = self.face_recognizer.recognize_with_details(face_roi)

                        if result['recognized']:
                            student_id = result['student_id']
                            confidence = result['confidence_percentage']

                            recognition_results.append({
                                'student_id': student_id,
                                'confidence': confidence,
                                'bbox': (x, y, w, h),
                                'timestamp': result['timestamp']
                            })

                            # Draw label if enabled
                            if draw_labels:
                                label = f"ID: {student_id} ({confidence:.1f}%)"
                                cv2.putText(
                                    output_frame,
                                    label,
                                    (x, y - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.5,
                                    (0, 255, 0),
                                    2
                                )

                                # Change box color to green for recognized faces
                                cv2.rectangle(output_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                        else:
                            # Unknown face - red box
                            if draw_boxes:
                                cv2.rectangle(output_frame, (x, y), (x + w, y + h), (0, 0, 255), 2)

                            if draw_labels:
                                cv2.putText(
                                    output_frame,
                                    "Unknown",
                                    (x, y - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.5,
                                    (0, 0, 255),
                                    2
                                )

                    except Exception as e:
                        print(f"Recognition error: {e}")

        # Update cached results
        with self.results_lock:
            self.last_recognition_results = recognition_results

        return output_frame

    def get_mjpeg_frame(self):
        """
        Get MJPEG encoded frame for streaming

        Returns:
            bytes: JPEG encoded frame
        """
        frame = self.get_frame_with_overlay()

        if frame is None:
            # Return blank frame if no camera frame available
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(
                frame,
                "No Camera Feed",
                (200, 240),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 255, 255),
                2
            )

        # Encode as JPEG
        ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

        if not ret:
            return None

        return jpeg.tobytes()

    def get_recognition_results(self):
        """
        Get latest recognition results

        Returns:
            list: List of recognition results
        """
        with self.results_lock:
            return self.last_recognition_results.copy()

    def capture_snapshot(self, filepath=None):
        """
        Capture a snapshot from the camera

        Args:
            filepath (str): Path to save the image

        Returns:
            numpy.ndarray: Captured frame
        """
        frame = self.camera.get_frame()

        if frame is not None and filepath:
            cv2.imwrite(filepath, frame)

        return frame

    def release(self):
        """Release camera resources"""
        self.stop()
        self.camera.release()


# Global camera stream instance
_camera_stream = None
_camera_lock = threading.Lock()

# When True the V2 pipeline owns VideoCapture(0); old CameraStream must NOT open it.
_v2_owns_camera = False


def set_v2_camera_active(active: bool) -> None:
    """Called by the V2 pipeline to claim/release the physical camera device."""
    global _v2_owns_camera, _camera_stream
    _v2_owns_camera = active
    if active:
        # Stop and join the old CameraStream thread BEFORE setting the flag so
        # that its _update_frame thread cannot be mid-read when V2 opens the device.
        # macOS AVFoundation will crash (EXC_BAD_ACCESS) if two VideoCapture objects
        # try to read the same camera device concurrently.
        old_stream = None
        with _camera_lock:
            if _camera_stream is not None:
                old_stream = _camera_stream
                _camera_stream = None

        if old_stream is not None:
            try:
                old_stream.release()   # sets is_running=False + releases VideoCapture
            except Exception:
                pass
            # Wait for the background thread to actually exit (with a short timeout)
            try:
                cam = getattr(old_stream, 'camera', None)
                t   = getattr(cam, 'thread', None) if cam else None
                if t and t.is_alive():
                    t.join(timeout=2.0)
            except Exception:
                pass

        # Give macOS AVFoundation time to fully release the device before V2 opens it.
        time.sleep(0.6)


def get_camera_stream(camera_index=0):
    """
    Get or create global camera stream instance.
    Returns None if the V2 pipeline currently owns the camera device.

    Args:
        camera_index (int): Camera device index

    Returns:
        CameraStream | None
    """
    global _camera_stream

    # Guard: never open a second VideoCapture while V2 owns the device.
    if _v2_owns_camera:
        return None

    with _camera_lock:
        if _camera_stream is None:
            # Import here to avoid circular imports
            from .face_detector import get_face_detector
            from .face_recognizer import get_face_recognizer

            detector = get_face_detector()
            recognizer = get_face_recognizer()

            _camera_stream = CameraStream(
                camera_index=camera_index,
                face_detector=detector,
                face_recognizer=recognizer
            )

        return _camera_stream


def release_camera_stream():
    """Release the global camera stream"""
    global _camera_stream

    with _camera_lock:
        if _camera_stream is not None:
            _camera_stream.release()
            _camera_stream = None


def _blank_mjpeg_frame() -> bytes:
    """Return a single MJPEG frame showing 'Camera in use' when V2 owns device."""
    import numpy as np
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(blank, "Camera in use by V2 pipeline",
                (80, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 200), 2)
    _, buf = cv2.imencode('.jpg', blank, [cv2.IMWRITE_JPEG_QUALITY, 60])
    return bytes(buf)


def generate_mjpeg_stream():
    """
    Generator function for MJPEG streaming.
    If V2 pipeline owns the camera, yields a static placeholder frame.

    Yields:
        bytes: MJPEG frame data
    """
    camera_stream = get_camera_stream()

    if camera_stream is None:
        # V2 owns the device — yield placeholder at low rate
        placeholder = _blank_mjpeg_frame()
        while _v2_owns_camera:
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + placeholder + b'\r\n')
            time.sleep(1.0)
        return

    camera_stream.start()
    camera_stream.enable_detection(True)
    camera_stream.enable_recognition(True)

    while True:
        # Re-check: if V2 took over the camera, stop immediately
        if _v2_owns_camera:
            break

        frame_bytes = camera_stream.get_mjpeg_frame()

        if frame_bytes is None:
            time.sleep(0.1)
            continue

        # MJPEG format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

        time.sleep(0.033)  # ~30 FPS
