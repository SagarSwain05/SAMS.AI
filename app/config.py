"""
Configuration settings for the Flask application
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration"""
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('FLASK_ENV', 'development') == 'development'

    # Database — handle all common URL formats:
    #   postgres://...       → Neon/Heroku shorthand
    #   postgresql://...     → standard format (defaults to psycopg2 in SA)
    #   postgresql+psycopg2://... → explicit psycopg2
    #   postgresql+psycopg://... → psycopg v3 (local dev)
    _raw_db_url = os.getenv('DATABASE_URL', 'postgresql+psycopg://sagarswain@localhost/attendance_system')
    if _raw_db_url.startswith('postgres://'):
        # Neon/Heroku shorthand → psycopg2
        SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://' + _raw_db_url[len('postgres://'):]
    elif _raw_db_url.startswith('postgresql://') and '+' not in _raw_db_url.split('?')[0].split('//')[0] + '//':
        # Standard postgresql:// without explicit driver → add psycopg2
        SQLALCHEMY_DATABASE_URI = _raw_db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    else:
        SQLALCHEMY_DATABASE_URI = _raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = DEBUG

    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # File Upload
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dataset')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

    # Face Recognition
    FACE_RECOGNITION_THRESHOLD = 0.85  # 85% confidence threshold
    FACE_DETECTION_MODEL = 'mtcnn'  # Options: 'mtcnn', 'retinaface'
    FACE_RECOGNITION_MODEL = 'Facenet'  # DeepFace model

    # Model Storage
    MODEL_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')

    # SocketIO
    SOCKETIO_CORS_ALLOWED_ORIGINS = os.getenv(
        'CORS_ORIGINS',
        'http://localhost:5173'
    ).split(',')

    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')

    # Camera
    CAMERA_INDEX = int(os.getenv('CAMERA_INDEX', 0))  # Default webcam
    FRAME_WIDTH = 640
    FRAME_HEIGHT = 480
    FPS = 10  # Frames per second for recognition

    # Attendance
    DUPLICATE_ATTENDANCE_PREVENTION = True  # Prevent same student marking twice per day/subject

    # IoT Camera API key (blank = no check, set in .env for production)
    IOT_CAMERA_KEY = os.getenv('IOT_CAMERA_KEY', '')

    # Security
    BCRYPT_LOG_ROUNDS = 12


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_ECHO = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    SQLALCHEMY_ECHO = False
    # In production, ensure SECRET_KEY and JWT_SECRET_KEY are set via environment variables


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'  # In-memory database for tests


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Get configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])
