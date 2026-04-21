"""
WebSocket (Socket.IO) Event Handlers

Auto-stop recognition when the last watcher (admin/kiosk) disconnects.
College session uses section_id=0 sentinel via MultiCameraStreamManager.
"""
import threading
from flask_socketio import emit, join_room, leave_room
from flask import request

# ── Recognition watcher tracking ─────────────────────────────────────────────
_watcher_sids: set = set()
_grace_timer: threading.Timer | None = None
_GRACE_SECONDS = 300  # 5 minutes — survives page refresh, tab navigation, network hiccups


def _cancel_grace():
    global _grace_timer
    if _grace_timer is not None:
        _grace_timer.cancel()
        _grace_timer = None


def _stop_all_sessions(app, socketio):
    """Actually stop recognition — called after grace period with no watchers."""
    global _grace_timer
    _grace_timer = None
    if _watcher_sids:
        return   # a watcher reconnected during the grace window — abort

    try:
        with app.app_context():
            from .ml.face_recognition_v2 import get_stream_manager
            mgr = get_stream_manager()
            active = list(mgr._streams.keys())
            if not active:
                return
            for sid in active:
                try:
                    mgr.stop_session(sid)
                except Exception as exc:
                    import logging
                    logging.getLogger(__name__).warning(
                        "AutoStop: error stopping section %s: %s", sid, exc
                    )
            print(f"[AutoStop] Stopped sessions: {active}")
            socketio.emit('recognition_auto_stopped', {
                'reason': 'All viewers disconnected',
                'message': 'Recognition stopped — browser closed',
            }, broadcast=True)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("AutoStop error: %s", exc)


def _schedule_auto_stop(app, socketio):
    global _grace_timer
    _cancel_grace()
    t = threading.Timer(_GRACE_SECONDS, _stop_all_sessions, args=(app, socketio))
    t.daemon = True
    t.start()
    _grace_timer = t


def register_events(socketio):
    """Register Socket.IO event handlers"""

    from flask import current_app

    @socketio.on('connect')
    def handle_connect():
        print(f'Client connected: {request.sid}')
        emit('connected', {'message': 'Connected to attendance system',
                           'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        sid = request.sid
        print(f'Client disconnected: {sid}')
        if sid in _watcher_sids:
            _watcher_sids.discard(sid)
            print(f'[Watcher] Removed {sid}. Remaining: {len(_watcher_sids)}')
            if not _watcher_sids:
                app = current_app._get_current_object()
                _schedule_auto_stop(app, socketio)

    @socketio.on('join_room')
    def handle_join_room(data):
        room = data.get('room')
        if room:
            join_room(room)
            emit('room_joined', {'room': room}, room=request.sid)

    @socketio.on('leave_room')
    def handle_leave_room(data):
        room = data.get('room')
        if room:
            leave_room(room)

    @socketio.on('ping')
    def handle_ping():
        emit('pong', {'message': 'pong'})

    # ── Recognition watcher registration ─────────────────────────────────────

    @socketio.on('watch_recognition')
    def handle_watch_recognition():
        sid = request.sid
        _watcher_sids.add(sid)
        _cancel_grace()   # abort any pending auto-stop
        print(f'[Watcher] {sid} registered. Total: {len(_watcher_sids)}')
        emit('watch_ack', {'watching': True, 'watchers': len(_watcher_sids)})

    @socketio.on('unwatch_recognition')
    def handle_unwatch_recognition():
        sid = request.sid
        was_watching = sid in _watcher_sids
        _watcher_sids.discard(sid)
        if was_watching:
            print(f'[Watcher] {sid} unwatched. Remaining: {len(_watcher_sids)}')
            if not _watcher_sids:
                app = current_app._get_current_object()
                _schedule_auto_stop(app, socketio)

    # ── Broadcast helpers ─────────────────────────────────────────────────────

    def broadcast_attendance_marked(attendance_data, room=None):
        if room:
            socketio.emit('attendance_marked', attendance_data, room=room)
        else:
            socketio.emit('attendance_marked', attendance_data, broadcast=True)

    def broadcast_notification(notification_data, room=None):
        if room:
            socketio.emit('notification_sent', notification_data, room=room)
        else:
            socketio.emit('notification_sent', notification_data, broadcast=True)

    def broadcast_recognition_status(status_data, room=None):
        if room:
            socketio.emit('recognition_status', status_data, room=room)
        else:
            socketio.emit('recognition_status', status_data, broadcast=True)

    socketio.broadcast_attendance    = broadcast_attendance_marked
    socketio.broadcast_notification  = broadcast_notification
    socketio.broadcast_recognition_status = broadcast_recognition_status

    return socketio
