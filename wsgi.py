"""
WSGI entrypoint for gunicorn + eventlet (production).

IMPORTANT: eventlet.monkey_patch() MUST be called before any other imports.
This file is used by the Dockerfile CMD:
  gunicorn --worker-class eventlet -w 1 wsgi:app
"""
import eventlet
eventlet.monkey_patch()

from app import create_app, socketio  # noqa: E402

app = create_app()
