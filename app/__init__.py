"""
Flask Application Factory
"""
import os
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from .config import get_config
from .models import db

# In production gunicorn+eventlet, the worker must be monkey-patched BEFORE
# any other imports. wsgi.py does that. Here we just pick the async mode.
_ASYNC_MODE = 'eventlet' if os.getenv('FLASK_ENV') == 'production' else 'threading'

# Initialize SocketIO
socketio = SocketIO()


def create_app(config_name=None):
    """Create and configure the Flask application"""
    app = Flask(__name__)

    # Load configuration
    if config_name is None:
        config = get_config()
    else:
        from .config import config as config_dict
        config = config_dict.get(config_name, config_dict['default'])

    app.config.from_object(config)

    # Initialize extensions
    db.init_app(app)

    # Initialize CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })

    # Initialize SocketIO
    socketio.init_app(
        app,
        cors_allowed_origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'],
        async_mode=_ASYNC_MODE
    )

    # Register blueprints
    from .routes import auth, students, attendance, recognition, subjects, notifications
    from .routes import recognition_v2
    from .routes import timetable
    from .routes import teachers as teachers_route
    from .routes.users import bp_branches, bp_sections, bp_users

    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(students.bp, url_prefix='/api/students')
    app.register_blueprint(attendance.bp, url_prefix='/api/attendance')
    app.register_blueprint(recognition.bp, url_prefix='/api/recognition')
    app.register_blueprint(subjects.bp, url_prefix='/api/subjects')
    app.register_blueprint(notifications.bp, url_prefix='/api/notifications')
    app.register_blueprint(recognition_v2.bp, url_prefix='/api/v2/recognition')
    app.register_blueprint(timetable.bp, url_prefix='/api/timetable')
    app.register_blueprint(teachers_route.bp, url_prefix='/api/teachers')
    app.register_blueprint(bp_branches, url_prefix='/api/branches')
    app.register_blueprint(bp_sections, url_prefix='/api/sections')
    app.register_blueprint(bp_users,    url_prefix='/api/users')

    # Register SocketIO events
    from . import sockets
    sockets.register_events(socketio)

    # Wire SocketIO into the multi-camera stream manager
    from .ml.face_recognition_v2 import get_stream_manager, get_pipeline
    get_stream_manager().init_socketio(socketio)

    # Inject Flask app into the EmbeddingStore so background recognition threads
    # can push an app context when loading embeddings from PostgreSQL.
    get_pipeline().store.set_app(app)

    # Create database tables
    with app.app_context():
        db.create_all()
        print("Database tables created successfully!")

    # ── Frontend static file serving ─────────────────────────────────────────
    # Serve the pre-built React app from frontend_dist/ so the entire SAMS.AI
    # lives at one URL (https://sagarswain-sams-ai.hf.space).
    # API routes (/api/*) are still served by Flask blueprints above.
    import os as _os
    from flask import send_from_directory as _sfd

    _FRONTEND_DIR = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), 'frontend_dist')

    if _os.path.isdir(_FRONTEND_DIR):
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_frontend(path):
            # API routes handled by blueprints — don't intercept
            if path.startswith('api/'):
                from flask import abort
                abort(404)
            # Serve static assets (JS, CSS, images)
            full = _os.path.join(_FRONTEND_DIR, path)
            if path and _os.path.isfile(full):
                return _sfd(_FRONTEND_DIR, path)
            # All other routes → index.html (React Router handles them)
            return _sfd(_FRONTEND_DIR, 'index.html')
    else:
        @app.route('/')
        def health_check():
            return {
                'status': 'ok',
                'message': 'AI-Powered Attendance System API is running',
                'version': '1.0.0'
            }

    @app.route('/api/health')
    def api_health():
        return {
            'status': 'ok',
            'database': 'connected',
            'message': 'API is healthy'
        }

    return app
