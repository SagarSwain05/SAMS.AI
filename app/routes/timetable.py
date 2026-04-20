"""
Timetable Management Routes
============================
GET  /api/timetable                    — full timetable for all sections
GET  /api/timetable/current            — what is happening RIGHT NOW per section
GET  /api/timetable/slots              — list all time slots
GET  /api/timetable/section/<id>       — timetable for one section
PUT  /api/timetable/schedule/<id>      — edit a schedule entry (admin, with reason)
GET  /api/timetable/subjects           — list subjects (optionally ?branch_id=)
GET  /api/timetable/teachers           — list teachers (optionally ?branch_id=)
"""
from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request

from ..models import Branch, Schedule, Section, TimeSlot, db
from .auth import token_required, admin_required

bp = Blueprint('timetable', __name__)

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']


# ── Time Slots ────────────────────────────────────────────────────────────────

@bp.route('/slots', methods=['GET'])
@token_required
def list_slots(current_user):
    slots = TimeSlot.query.order_by(TimeSlot.slot_number).all()
    return jsonify([{
        'id':          s.id,
        'slot_number': s.slot_number,
        'label':       s.label,
        'start_time':  s.start_time,
        'end_time':    s.end_time,
        'is_break':    s.is_break,
    } for s in slots]), 200


# ── Current Active Slots ──────────────────────────────────────────────────────

@bp.route('/current', methods=['GET'])
@token_required
def current_timetable(current_user):
    """
    Return the schedule entry currently running for EVERY section,
    based on real wall-clock time.
    """
    now = datetime.now()
    day = now.weekday()          # 0=Mon .. 4=Fri
    current_hm = now.strftime('%H:%M')

    if day > 4:
        return jsonify({'message': 'Weekend — no classes scheduled',
                        'sections': []}), 200

    # Find active time slot
    slots = TimeSlot.query.filter_by(is_break=False).all()
    active_slot = next(
        (s for s in slots if s.start_time <= current_hm <= s.end_time),
        None
    )

    sections = Section.query.order_by(Section.global_index).all()
    result = []
    for sec in sections:
        entry = {
            'section_id':       sec.id,
            'section_name':     sec.name,
            'branch_code':      sec.branch.code if sec.branch else '?',
            'branch_name':      sec.branch.name if sec.branch else '?',
            'display':          f"{sec.branch.code if sec.branch else '?'}-{sec.name}",
            'current_semester': sec.current_semester,
            'active_slot':      None,
            'current_subject':  None,
            'current_teacher':  None,
        }
        if active_slot:
            entry['active_slot'] = {
                'id':         active_slot.id,
                'label':      active_slot.label,
                'start_time': active_slot.start_time,
                'end_time':   active_slot.end_time,
            }
            sched = Schedule.query.filter_by(
                section_id=sec.id,
                time_slot_id=active_slot.id,
                day_of_week=day,
            ).first()
            if sched:
                entry['current_subject'] = {
                    'id':   sched.subject_id,
                    'name': sched.subject.name if sched.subject else '?',
                    'code': sched.subject.code if sched.subject else '?',
                }
                entry['current_teacher'] = {
                    'id':   sched.teacher_id,
                    'name': sched.teacher.user.name if sched.teacher and sched.teacher.user else '?',
                    'emp_id': sched.teacher.employee_id if sched.teacher else '?',
                }
        result.append(entry)

    return jsonify({
        'day':          DAYS[day],
        'current_time': current_hm,
        'active_slot':  {
            'id':         active_slot.id,
            'label':      active_slot.label,
            'start_time': active_slot.start_time,
            'end_time':   active_slot.end_time,
        } if active_slot else None,
        'sections': result,
    }), 200


# ── Full Timetable (all sections × all days × all slots) ─────────────────────

@bp.route('', methods=['GET'])
@token_required
def full_timetable(current_user):
    """
    Full timetable matrix.

    Optional filters:
      ?branch_id=   — filter by branch
      ?section_id=  — filter by section

    Response structure:
    {
      "slots": [...],
      "days":  ["Monday", ...],
      "sections": [
        {
          "section_id": 1,
          "display": "CSE-A",
          "grid": {
            "Monday": { "1": {subject, teacher}, "2": {...}, ... },
            ...
          }
        }
      ]
    }
    """
    branch_id  = request.args.get('branch_id',  type=int)
    section_id = request.args.get('section_id', type=int)

    slots = TimeSlot.query.order_by(TimeSlot.slot_number).all()
    non_break_slots = [s for s in slots if not s.is_break]

    sec_q = Section.query.order_by(Section.global_index)
    if branch_id:
        sec_q = sec_q.filter_by(branch_id=branch_id)
    if section_id:
        sec_q = sec_q.filter_by(id=section_id)
    sections = sec_q.all()

    # Fetch all schedules in one query
    schedule_q = Schedule.query
    if section_id:
        schedule_q = schedule_q.filter_by(section_id=section_id)
    elif branch_id:
        sec_ids = [s.id for s in sections]
        schedule_q = schedule_q.filter(Schedule.section_id.in_(sec_ids))
    all_schedules = schedule_q.all()

    # Index: (section_id, day, slot_id) → Schedule
    sched_index: dict = {}
    for s in all_schedules:
        sched_index[(s.section_id, s.day_of_week, s.time_slot_id)] = s

    sections_data = []
    for sec in sections:
        grid: dict = {}
        for day_i, day_name in enumerate(DAYS):
            grid[day_name] = {}
            for slot in non_break_slots:
                sched = sched_index.get((sec.id, day_i, slot.id))
                grid[day_name][str(slot.slot_number)] = {
                    'slot_id':    slot.id,
                    'label':      slot.label,
                    'start_time': slot.start_time,
                    'end_time':   slot.end_time,
                    'schedule_id': sched.id if sched else None,
                    'subject': {
                        'id':   sched.subject_id,
                        'name': sched.subject.name if sched and sched.subject else '—',
                        'code': sched.subject.code if sched and sched.subject else '',
                    } if sched else None,
                    'teacher': {
                        'id':   sched.teacher_id,
                        'name': sched.teacher.user.name if sched and sched.teacher and sched.teacher.user else '—',
                        'emp_id': sched.teacher.employee_id if sched and sched.teacher else '',
                    } if sched else None,
                }
        sections_data.append({
            'section_id':       sec.id,
            'section_name':     sec.name,
            'branch_id':        sec.branch_id,
            'branch_code':      sec.branch.code if sec.branch else '?',
            'branch_name':      sec.branch.name if sec.branch else '?',
            'display':          f"{sec.branch.code if sec.branch else '?'}-{sec.name}",
            'current_semester': sec.current_semester,
            'grid':             grid,
        })

    return jsonify({
        'slots':    [{'id': s.id, 'slot_number': s.slot_number,
                      'label': s.label, 'start_time': s.start_time,
                      'end_time': s.end_time} for s in non_break_slots],
        'days':     DAYS,
        'sections': sections_data,
    }), 200


# ── One Section ───────────────────────────────────────────────────────────────

@bp.route('/section/<int:section_id>', methods=['GET'])
@token_required
def section_timetable(current_user, section_id: int):
    sec = db.session.get(Section, section_id)
    if not sec:
        return jsonify({'message': 'Section not found'}), 404

    slots    = TimeSlot.query.filter_by(is_break=False).order_by(TimeSlot.slot_number).all()
    schedules = Schedule.query.filter_by(section_id=section_id).all()
    sched_index = {(s.day_of_week, s.time_slot_id): s for s in schedules}

    grid: dict = {}
    for day_i, day_name in enumerate(DAYS):
        grid[day_name] = {}
        for slot in slots:
            sched = sched_index.get((day_i, slot.id))
            grid[day_name][slot.label] = {
                'slot_number': slot.slot_number,
                'start_time':  slot.start_time,
                'end_time':    slot.end_time,
                'subject': {
                    'id':   sched.subject_id,
                    'name': sched.subject.name if sched.subject else '—',
                    'code': sched.subject.code if sched.subject else '',
                } if sched else None,
                'teacher': {
                    'name': sched.teacher.user.name if sched and sched.teacher and sched.teacher.user else '—',
                } if sched else None,
            }

    return jsonify({
        'section_id':   sec.id,
        'display':      f"{sec.branch.code if sec.branch else '?'}-{sec.name}",
        'semester':     sec.current_semester,
        'grid':         grid,
    }), 200


# ── Edit a Schedule Entry ─────────────────────────────────────────────────────

@bp.route('/schedule/<int:schedule_id>', methods=['PUT'])
@admin_required
def update_schedule(current_user, schedule_id: int):
    """
    Edit a single timetable slot (admin only).

    Request JSON:
      {
        "subject_id": 12,      // optional
        "teacher_id": 5,       // optional
        "room_number": "R-201",// optional
        "reason": "Teacher swap due to medical leave"  // required
      }

    Validates teacher double-booking before saving.
    Stores the reason in the schedule row for audit.
    """
    from ..models import Subject, TeacherProfile

    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'message': 'A reason is required to modify the timetable'}), 400

    sched = db.session.get(Schedule, schedule_id)
    if not sched:
        return jsonify({'message': 'Schedule entry not found'}), 404

    new_subject_id = data.get('subject_id')
    new_teacher_id = data.get('teacher_id')
    new_room       = data.get('room_number')

    # Validate subject exists
    if new_subject_id is not None:
        if not db.session.get(Subject, new_subject_id):
            return jsonify({'message': f'Subject {new_subject_id} not found'}), 400
        sched.subject_id = new_subject_id

    # Validate teacher exists + check double-booking
    if new_teacher_id is not None:
        if not db.session.get(TeacherProfile, new_teacher_id):
            return jsonify({'message': f'Teacher {new_teacher_id} not found'}), 400
        # Check teacher conflict (another slot same time/day/year, different schedule)
        conflict = Schedule.query.filter(
            Schedule.teacher_id == new_teacher_id,
            Schedule.time_slot_id == sched.time_slot_id,
            Schedule.day_of_week == sched.day_of_week,
            Schedule.academic_year == sched.academic_year,
            Schedule.id != schedule_id,
        ).first()
        if conflict:
            return jsonify({
                'message': f'Teacher already has a class at this time on '
                           f'{DAYS[sched.day_of_week]} (section {conflict.section_id})'
            }), 409
        sched.teacher_id = new_teacher_id

    if new_room is not None:
        sched.room_number = new_room

    sched.change_reason = f"{datetime.now().strftime('%Y-%m-%d %H:%M')} | {current_user.name}: {reason}"
    sched.updated_at    = datetime.utcnow()

    db.session.commit()
    return jsonify({
        'message':     'Schedule updated successfully',
        'schedule_id': schedule_id,
        'reason':      reason,
        'updated_at':  sched.updated_at.isoformat(),
    }), 200


# ── Today's Full Schedule (all slots, all sections) ──────────────────────────

@bp.route('/today', methods=['GET'])
@token_required
def today_schedule(current_user):
    """
    Return the FULL day schedule (all non-break slots) for every section today.
    Unlike /current which returns only the running slot, this returns all 6 periods.
    Optional ?section_id= to filter to one section.
    """
    now = datetime.now()
    day = now.weekday()   # 0=Mon .. 4=Fri
    current_hm = now.strftime('%H:%M')
    section_id_filter = request.args.get('section_id', type=int)

    if day > 4:
        return jsonify({
            'is_weekend': True,
            'day': 'Weekend',
            'current_time': current_hm,
            'sections': [],
        }), 200

    slots = TimeSlot.query.filter_by(is_break=False).order_by(TimeSlot.slot_number).all()

    sec_q = Section.query.order_by(Section.global_index)
    if section_id_filter:
        sec_q = sec_q.filter_by(id=section_id_filter)
    sections = sec_q.all()

    # Fetch all relevant schedules in one query
    sec_ids = [s.id for s in sections]
    all_schedules = Schedule.query.filter(
        Schedule.section_id.in_(sec_ids),
        Schedule.day_of_week == day,
    ).all() if sec_ids else []

    sched_index = {(s.section_id, s.time_slot_id): s for s in all_schedules}

    result = []
    for sec in sections:
        periods = []
        for slot in slots:
            sched = sched_index.get((sec.id, slot.id))
            is_active = slot.start_time <= current_hm <= slot.end_time
            periods.append({
                'slot_number': slot.slot_number,
                'label':       slot.label,
                'start_time':  slot.start_time,
                'end_time':    slot.end_time,
                'is_active':   is_active,
                'subject': {
                    'id':   sched.subject_id,
                    'name': sched.subject.name if sched.subject else '—',
                    'code': sched.subject.code if sched.subject else '',
                } if sched else None,
                'teacher': {
                    'id':     sched.teacher_id,
                    'name':   sched.teacher.user.name if sched and sched.teacher and sched.teacher.user else '—',
                    'emp_id': sched.teacher.employee_id if sched and sched.teacher else '',
                } if sched else None,
                'room': sched.room_number if sched else None,
            })
        result.append({
            'section_id':       sec.id,
            'section_name':     sec.name,
            'branch_code':      sec.branch.code if sec.branch else '?',
            'branch_name':      sec.branch.name if sec.branch else '?',
            'display':          f"{sec.branch.code if sec.branch else '?'}-{sec.name}",
            'current_semester': sec.current_semester,
            'periods':          periods,
        })

    return jsonify({
        'is_weekend':   False,
        'day':          DAYS[day],
        'current_time': current_hm,
        'sections':     result,
    }), 200


# ── My Schedule (teacher's own weekly timetable) ──────────────────────────────

@bp.route('/my-schedule', methods=['GET'])
@token_required
def my_schedule(current_user):
    """
    Return the logged-in teacher's weekly timetable.
    Returns 403 if caller is not a teacher.
    """
    from ..models import TeacherProfile

    if current_user.role != 'teacher':
        return jsonify({'message': 'Only teachers can access this endpoint'}), 403

    tp = TeacherProfile.query.filter_by(user_id=current_user.id).first()
    if not tp:
        return jsonify({'message': 'Teacher profile not found'}), 404

    schedules = Schedule.query.filter_by(teacher_id=tp.id).all()
    slots = TimeSlot.query.filter_by(is_break=False).order_by(TimeSlot.slot_number).all()

    # Build grid: day → slot_label → entry
    grid: dict = {day: {} for day in DAYS}
    for sched in schedules:
        day_name = DAYS[sched.day_of_week]
        slot = next((s for s in slots if s.id == sched.time_slot_id), None)
        if not slot:
            continue
        grid[day_name][slot.label] = {
            'schedule_id': sched.id,
            'slot_number': slot.slot_number,
            'start_time':  slot.start_time,
            'end_time':    slot.end_time,
            'section': {
                'id':      sched.section.id if sched.section else None,
                'name':    sched.section.name if sched.section else '?',
                'display': (f"{sched.section.branch.code}-{sched.section.name}"
                            if sched.section and sched.section.branch else '?'),
                'semester': sched.section.current_semester if sched.section else None,
            },
            'subject': {
                'id':   sched.subject_id,
                'name': sched.subject.name if sched.subject else '?',
                'code': sched.subject.code if sched.subject else '',
            } if sched.subject else None,
            'room': sched.room_number,
        }

    # Also return list of sections and subjects this teacher is assigned to
    my_sections = list({
        sched.section_id: {
            'id':      sched.section.id,
            'name':    sched.section.name,
            'display': (f"{sched.section.branch.code}-{sched.section.name}"
                        if sched.section and sched.section.branch else '?'),
            'semester': sched.section.current_semester,
        }
        for sched in schedules if sched.section
    }.values())

    my_subjects = list({
        sched.subject_id: {
            'id':   sched.subject.id,
            'name': sched.subject.name,
            'code': sched.subject.code,
        }
        for sched in schedules if sched.subject
    }.values())

    return jsonify({
        'teacher_id':   tp.id,
        'employee_id':  tp.employee_id,
        'teacher_name': current_user.name,
        'slots':        [{'label': s.label, 'start_time': s.start_time,
                          'end_time': s.end_time, 'slot_number': s.slot_number}
                         for s in slots],
        'days':         DAYS,
        'grid':         grid,
        'my_sections':  my_sections,
        'my_subjects':  my_subjects,
    }), 200


# ── Subjects List (for timetable editor dropdowns) ────────────────────────────

@bp.route('/subjects', methods=['GET'])
@token_required
def list_subjects(current_user):
    """List all subjects, optionally filtered by ?branch_id="""
    from ..models import Subject
    branch_id = request.args.get('branch_id', type=int)
    q = Subject.query.order_by(Subject.name)
    if branch_id:
        q = q.filter_by(branch_id=branch_id)
    subjects = q.all()
    return jsonify([{
        'id':       s.id,
        'name':     s.name,
        'code':     s.code,
        'branch_id': s.branch_id,
    } for s in subjects]), 200


# ── Teachers List (for timetable editor dropdowns) ────────────────────────────

@bp.route('/teachers', methods=['GET'])
@token_required
def list_teachers(current_user):
    """List all teachers, optionally filtered by ?branch_id="""
    from ..models import TeacherProfile
    branch_id = request.args.get('branch_id', type=int)
    q = TeacherProfile.query.order_by(TeacherProfile.employee_id)
    if branch_id:
        q = q.filter_by(branch_id=branch_id)
    teachers = q.all()
    return jsonify([{
        'id':          t.id,
        'employee_id': t.employee_id,
        'name':        t.user.name if t.user else '?',
        'department':  t.department,
        'branch_id':   t.branch_id,
    } for t in teachers]), 200
