"""
Admin Utility Routes
====================
POST /api/admin/seed-attendance   — Generate 3 months of realistic attendance data
GET  /api/admin/seed-status       — Check seeding progress
"""
from __future__ import annotations

import random
import threading
from datetime import date, time as time_cls, timedelta, datetime

from flask import Blueprint, jsonify, current_app

from .auth import admin_required
from ..models import db, Student, Section, Schedule, TimeSlot

bp = Blueprint('admin_utils', __name__)

# ── Seeding state ─────────────────────────────────────────────────────────────
_seed_state = {
    'running':  False,
    'done':     False,
    'total':    0,
    'inserted': 0,
    'error':    None,
    'started_at': None,
    'finished_at': None,
}
_seed_lock = threading.Lock()

# ── Parameters (same as simulate_attendance.py) ────────────────────────────────

START_DATE = date(2026, 2, 2)
END_DATE   = date(2026, 4, 18)

HOLIDAYS = {
    date(2026, 2, 19),
    date(2026, 3, 10),
    date(2026, 3, 25),
    date(2026, 4, 6),
    date(2026, 4, 10),
    date(2026, 4, 14),
}

BATCH_SIZE = 5_000


def _school_days(start: date, end: date):
    d = start
    while d <= end:
        if d.weekday() < 5 and d not in HOLIDAYS:
            yield d
        d += timedelta(days=1)


def _base_rate(student_id: int) -> float:
    rng = random.Random(student_id * 31337 + 7919)
    bucket = rng.random()
    if bucket < 0.10:
        return rng.uniform(0.55, 0.67)
    elif bucket < 0.30:
        return rng.uniform(0.68, 0.74)
    elif bucket < 0.80:
        return rng.uniform(0.75, 0.88)
    else:
        return rng.uniform(0.89, 0.97)


def _is_sick(student_id: int, iso_week: int) -> bool:
    r = random.Random(student_id * 999983 + iso_week * 7)
    return r.random() < 0.04


def _day_record_time(start_time_str: str, offset_minutes: int = 5) -> time_cls:
    try:
        h, m = map(int, start_time_str.split(':'))
        return time_cls(h, min(m + offset_minutes, 59))
    except Exception:
        return time_cls(10, 5)


def _run_seed(app):
    """Background thread that generates attendance data."""
    global _seed_state
    try:
        with app.app_context():
            # 1. Clear previous simulation records in range
            db.session.execute(
                db.text("DELETE FROM attendance_logs WHERE date >= :s AND date <= :e"),
                {'s': START_DATE, 'e': END_DATE}
            )
            db.session.commit()

            # 2. Load schedule data
            sections = Section.query.order_by(Section.global_index).all()
            slots_by_id = {s.id: s for s in TimeSlot.query.all()}

            sched_index: dict = {}
            for sched in Schedule.query.all():
                sched_index.setdefault(sched.section_id, {}) \
                           .setdefault(sched.day_of_week, []) \
                           .append((sched.subject_id, sched.time_slot_id))

            student_index: dict = {}
            for stu in Student.query.all():
                if stu.section_id:
                    student_index.setdefault(stu.section_id, []).append(stu.id)

            all_days = list(_school_days(START_DATE, END_DATE))
            total_expected = sum(
                len(student_index.get(sec.id, [])) *
                len(sched_index.get(sec.id, {}).get(d.weekday(), []))
                for d in all_days
                for sec in sections
            )

            with _seed_lock:
                _seed_state['total'] = total_expected

            # 3. Pre-compute profiles
            profiles = {
                stu_id: _base_rate(stu_id)
                for stu_ids in student_index.values()
                for stu_id in stu_ids
            }

            # 4. Generate records
            batch: list = []
            total_inserted = 0

            for day in all_days:
                dow = day.weekday()
                iso_week = day.isocalendar()[1]
                days_ago = (END_DATE - day).days

                for sec in sections:
                    sec_id = sec.id
                    day_scheds = sched_index.get(sec_id, {}).get(dow, [])
                    if not day_scheds:
                        continue
                    students_in_sec = student_index.get(sec_id, [])
                    if not students_in_sec:
                        continue

                    for stu_id in students_in_sec:
                        rate     = profiles.get(stu_id, 0.80)
                        sick     = _is_sick(stu_id, iso_week)
                        day_rng  = random.Random(stu_id * 179426549 + day.toordinal())
                        week_rng = random.Random(stu_id * 104723 + iso_week)
                        weekly_drift = week_rng.uniform(-0.06, 0.06)
                        effective_rate = max(0.0, min(1.0, rate + weekly_drift))

                        for subj_id, slot_id in day_scheds:
                            if sick:
                                status     = 'absent'
                                confidence = None
                                marked_by  = 'manual'
                            else:
                                roll = day_rng.random()
                                if roll < effective_rate * 0.96:
                                    status = 'present'
                                elif roll < effective_rate:
                                    status = 'late'
                                else:
                                    status = 'absent'

                                if days_ago <= 21:
                                    marked_by  = 'face_recognition'
                                    confidence = (round(day_rng.uniform(0.81, 0.99), 3)
                                                  if status == 'present' else None)
                                else:
                                    marked_by  = 'manual'
                                    confidence = None

                            slot = slots_by_id.get(slot_id)
                            rec_time = _day_record_time(
                                slot.start_time if slot else '10:00',
                                day_rng.randint(0, 12)
                            )

                            batch.append({
                                'student_id':       stu_id,
                                'subject_id':       subj_id,
                                'date':             day,
                                'time':             rec_time,
                                'status':           status,
                                'confidence_score': confidence,
                                'marked_by':        marked_by,
                                'entry_time':       None,
                                'exit_time':        None,
                                'notes':            None,
                                'created_at':       datetime.utcnow(),
                                'updated_at':       datetime.utcnow(),
                            })

                            if len(batch) >= BATCH_SIZE:
                                db.session.execute(
                                    db.text(
                                        "INSERT INTO attendance_logs "
                                        "(student_id, subject_id, date, time, status, "
                                        " confidence_score, marked_by, entry_time, exit_time, "
                                        " notes, created_at, updated_at) "
                                        "VALUES (:student_id, :subject_id, :date, :time, :status, "
                                        " :confidence_score, :marked_by, :entry_time, :exit_time, "
                                        " :notes, :created_at, :updated_at)"
                                    ),
                                    batch
                                )
                                db.session.commit()
                                total_inserted += len(batch)
                                batch = []
                                with _seed_lock:
                                    _seed_state['inserted'] = total_inserted

            # Final batch
            if batch:
                db.session.execute(
                    db.text(
                        "INSERT INTO attendance_logs "
                        "(student_id, subject_id, date, time, status, "
                        " confidence_score, marked_by, entry_time, exit_time, "
                        " notes, created_at, updated_at) "
                        "VALUES (:student_id, :subject_id, :date, :time, :status, "
                        " :confidence_score, :marked_by, :entry_time, :exit_time, "
                        " :notes, :created_at, :updated_at)"
                    ),
                    batch
                )
                db.session.commit()
                total_inserted += len(batch)

        with _seed_lock:
            _seed_state['inserted']    = total_inserted
            _seed_state['running']     = False
            _seed_state['done']        = True
            _seed_state['finished_at'] = datetime.utcnow().isoformat()

    except Exception as exc:
        with _seed_lock:
            _seed_state['running'] = False
            _seed_state['error']   = str(exc)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@bp.route('/seed-attendance', methods=['POST'])
@admin_required
def seed_attendance(current_user):
    """
    Trigger background generation of 3 months of realistic attendance data.
    Safe to call multiple times — previous data in the date range is cleared first.
    Returns immediately; poll /api/admin/seed-status for progress.
    """
    global _seed_state

    with _seed_lock:
        if _seed_state['running']:
            return jsonify({
                'message':  'Seeding already in progress',
                'inserted': _seed_state['inserted'],
                'total':    _seed_state['total'],
            }), 200

        _seed_state = {
            'running':     True,
            'done':        False,
            'total':       0,
            'inserted':    0,
            'error':       None,
            'started_at':  datetime.utcnow().isoformat(),
            'finished_at': None,
        }

    app = current_app._get_current_object()
    thread = threading.Thread(target=_run_seed, args=(app,), daemon=True, name='attendance-seed')
    thread.start()

    return jsonify({
        'message':    'Attendance seeding started in background',
        'date_range': f'{START_DATE} → {END_DATE}',
        'status_url': '/api/admin/seed-status',
    }), 202


@bp.route('/seed-status', methods=['GET'])
@admin_required
def seed_status(current_user):
    """Return current seeding progress."""
    with _seed_lock:
        state = dict(_seed_state)
    pct = round(state['inserted'] / max(state['total'], 1) * 100, 1) if state['total'] else 0
    state['percent'] = pct
    return jsonify(state), 200
