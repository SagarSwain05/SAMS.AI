"""
Flask Application Entry Point
"""
import os
import signal
import sys
from app import create_app, socketio

# Create Flask app
app = create_app()


def _shutdown(signum, frame):
    """Stop all recognition sessions and release camera on process exit."""
    print("\n[Shutdown] Stopping all recognition sessions...")
    try:
        from app.ml.face_recognition_v2 import get_stream_manager
        from app.ml.camera import set_v2_camera_active
        set_v2_camera_active(False)
        mgr = get_stream_manager()
        # Use a short timeout — don't block shutdown waiting on ONNX threads
        import threading
        done = threading.Event()
        def _stop():
            try:
                mgr.stop_all()
            except Exception as exc:
                print(f"[Shutdown] Stop error: {exc}")
            finally:
                done.set()
        t = threading.Thread(target=_stop, daemon=True)
        t.start()
        done.wait(timeout=5.0)   # give it 5 s max
        print("[Shutdown] Done.")
    except Exception as exc:
        print(f"[Shutdown] Cleanup error: {exc}")
    sys.exit(0)


signal.signal(signal.SIGINT,  _shutdown)
signal.signal(signal.SIGTERM, _shutdown)


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))

    print(f"Starting AI-Powered Attendance System on port {port}")
    print(f"Dashboard: http://localhost:{port}")
    print(f"WebSocket: Enabled")
    print(f"API: http://localhost:{port}/api")

    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=app.config['DEBUG'],
        use_reloader=False,          # reloader forks process — conflicts with signal handlers
        allow_unsafe_werkzeug=True
    )
