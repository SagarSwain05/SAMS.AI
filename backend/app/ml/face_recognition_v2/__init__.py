"""
Face Recognition V2 — Professional Grade
=========================================
Architecture:
  Detection  : InsightFace RetinaFace (SCRFD-10G) — finds faces at distance in crowds
  Recognition: InsightFace ArcFace (Buffalo_L / ResNet100) — 512-dim embeddings
  Matching   : NumPy cosine-similarity (< 5 ms for 1000 students)
  Voting     : Temporal buffer — 70% of frames over 10 s → mark Present
  Spoofing   : Texture + frequency analysis (photo vs live face)
  IoT        : RTSP/HTTP/WebSocket + local webcam all supported

Usage:
  from app.ml.face_recognition_v2 import get_pipeline, get_stream_manager
"""
from .pipeline import FaceRecognitionPipeline, get_pipeline
from .live_processor import ClassroomStreamProcessor
from .stream_manager import MultiCameraStreamManager, get_stream_manager

__all__ = [
    'FaceRecognitionPipeline',
    'get_pipeline',
    'ClassroomStreamProcessor',
    'MultiCameraStreamManager',
    'get_stream_manager',
]
