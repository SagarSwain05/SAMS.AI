"""
System health & restart controls.

  GET  /api/system/ping     — liveness only (no DB), used by the external watchdog
  GET  /api/system/status   — public component health (no secrets)
  GET  /api/system/space    — admin: Hugging Face Space runtime stage
  POST /api/system/restart  — admin: {"target": "database" | "worker" | "space" | "space_rebuild"}

Space restarts need HF_TOKEN (Space secret, write access). SPACE_ID is injected by HF.
"""
from __future__ import annotations

import os
import signal
import threading
import time
from datetime import datetime, timezone

import requests
from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import text

from .auth import admin_required
from ..models import db

bp = Blueprint('system', __name__)

_STARTED_AT = time.time()
_HF_API = 'https://huggingface.co/api/spaces'


def _space_id() -> str:
    return os.getenv('SPACE_ID', '')


def _hf_token() -> str:
    return os.getenv('HF_TOKEN', '')


def _gunicorn_master_pid() -> int | None:
    """PID of the gunicorn master if this worker runs under gunicorn (Linux /proc)."""
    ppid = os.getppid()
    try:
        with open(f'/proc/{ppid}/cmdline', 'rb') as fh:
            if b'gunicorn' in fh.read():
                return ppid
    except OSError:
        pass
    return None


def check_database() -> dict:
    t0 = time.perf_counter()
    try:
        db.session.execute(text('SELECT 1'))
        return {'ok': True, 'latency_ms': round((time.perf_counter() - t0) * 1000, 1)}
    except Exception as exc:
        db.session.rollback()
        return {'ok': False, 'error': str(exc).splitlines()[0][:200]}


def _memory_mb() -> float | None:
    try:
        with open('/proc/self/status') as fh:
            for line in fh:
                if line.startswith('VmRSS:'):
                    return round(int(line.split()[1]) / 1024, 1)
    except OSError:
        pass
    try:
        import resource
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return round(rss / (1024 * 1024 if os.uname().sysname == 'Darwin' else 1024), 1)
    except Exception:
        return None


def _ml_status() -> dict:
    try:
        from ..ml.face_recognition_v2 import get_pipeline, get_stream_manager
        p = get_pipeline()
        return {
            'ok': p.is_ready,
            'engine_ready': p.is_ready,
            'students_enrolled': p.store.student_count,
            'active_streams': len(get_stream_manager().get_active_sections()),
        }
    except Exception as exc:
        return {'ok': False, 'error': str(exc)[:200]}


@bp.route('/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'ok', 'uptime_s': round(time.time() - _STARTED_AT)})


@bp.route('/status', methods=['GET'])
def status():
    database = check_database()
    ml = _ml_status()
    frontend_dir = os.path.join(os.path.dirname(current_app.root_path), 'frontend_dist')
    frontend_ok = os.path.isfile(os.path.join(frontend_dir, 'index.html'))
    blueprints = sorted(
        {r.rule.split('/')[2] for r in current_app.url_map.iter_rules() if r.rule.startswith('/api/')}
    )
    overall = 'ok' if database['ok'] else 'degraded'
    return jsonify({
        'status': overall,
        'time': datetime.now(timezone.utc).isoformat(),
        'uptime_s': round(time.time() - _STARTED_AT),
        'components': {
            'backend': {'ok': True, 'pid': os.getpid(), 'memory_mb': _memory_mb()},
            'database': database,
            'frontend': {'ok': frontend_ok},
            'face_recognition': ml,
        },
        'api_groups': blueprints,
        'controls': {
            'worker_restart': _gunicorn_master_pid() is not None,
            'space_restart': bool(_space_id() and _hf_token()),
            'space_id': _space_id() or None,
        },
    }), (200 if database['ok'] else 503)


@bp.route('/space', methods=['GET'])
@admin_required
def space_runtime(current_user):
    sid = _space_id()
    if not sid:
        return jsonify({'available': False, 'message': 'Not running on Hugging Face Spaces'})
    headers = {'Authorization': f'Bearer {_hf_token()}'} if _hf_token() else {}
    try:
        r = requests.get(f'{_HF_API}/{sid}/runtime', headers=headers, timeout=10)
        data = r.json()
        return jsonify({
            'available': True,
            'space_id': sid,
            'stage': data.get('stage'),
            'hardware': (data.get('hardware') or {}).get('current'),
            'error': data.get('errorMessage'),
        })
    except Exception as exc:
        return jsonify({'available': False, 'message': str(exc)[:200]}), 502


def _later(fn, delay: float = 1.0) -> None:
    """Run fn after the HTTP response has been sent."""
    def _run():
        time.sleep(delay)
        fn()
    threading.Thread(target=_run, daemon=True).start()


@bp.route('/restart', methods=['POST'])
@admin_required
def restart(current_user):
    target = (request.get_json(silent=True) or {}).get('target', '')
    print(f'[System] Restart "{target}" requested by {current_user.username}', flush=True)

    if target == 'database':
        db.session.remove()
        db.engine.dispose()
        result = check_database()
        return jsonify({'ok': result['ok'], 'message': 'Database connection pool reset', 'database': result}), \
            (200 if result['ok'] else 503)

    if target == 'worker':
        master = _gunicorn_master_pid()
        if master is None:
            return jsonify({'ok': False, 'message': 'Worker restart is only available under gunicorn '
                                                    '(production). Locally, restart run.py / watchdog.sh.'}), 400
        # SIGHUP → gunicorn boots a fresh worker, then gracefully retires this one.
        _later(lambda: os.kill(master, signal.SIGHUP))
        return jsonify({'ok': True, 'message': 'Backend worker restarting — back in ~15 seconds'})

    if target in ('space', 'space_rebuild'):
        sid, token = _space_id(), _hf_token()
        if not (sid and token):
            return jsonify({'ok': False, 'message': 'Set the HF_TOKEN secret on the Space to enable this'}), 400
        url = f'{_HF_API}/{sid}/restart' + ('?factory=true' if target == 'space_rebuild' else '')
        try:
            r = requests.post(url, headers={'Authorization': f'Bearer {token}'}, timeout=15)
        except Exception as exc:
            return jsonify({'ok': False, 'message': f'Hugging Face API error: {exc}'}), 502
        if not r.ok:
            return jsonify({'ok': False, 'message': f'Hugging Face API returned {r.status_code}'}), 502
        what = 'rebuild' if target == 'space_rebuild' else 'restart'
        return jsonify({'ok': True, 'message': f'Space {what} triggered — back in ~2–5 minutes'})

    return jsonify({'ok': False, 'message': 'target must be database, worker, space or space_rebuild'}), 400
