"""
Attendance Routes
"""
from flask import Blueprint, request, jsonify
from ..models import db, AttendanceLog, Student, Subject
from ..models.user import User
from .auth import token_required, admin_required
from datetime import date as date_cls

bp = Blueprint('attendance', __name__)


@bp.route('', methods=['GET'])
@token_required
def get_attendance(current_user):
    """Get attendance records with filters"""
    try:
        # Get query parameters
        student_id = request.args.get('student_id')
        subject_id = request.args.get('subject_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        status = request.args.get('status')

        # Build query
        query = AttendanceLog.query

        if student_id:
            query = query.filter_by(student_id=int(student_id))

        if subject_id:
            query = query.filter_by(subject_id=int(subject_id))

        if status:
            query = query.filter_by(status=status)

        # TODO: Add date range filtering

        attendance = query.order_by(AttendanceLog.date.desc()).limit(100).all()

        return jsonify({
            'attendance': [record.to_dict(include_student=True, include_subject=True) for record in attendance],
            'count': len(attendance)
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to fetch attendance: {str(e)}'}), 500


@bp.route('/mark', methods=['POST'])
@token_required
def mark_attendance(current_user):
    """Mark attendance (manual or automatic)"""
    try:
        if current_user.role != 'teacher':
            return jsonify({'message': 'Only teachers can mark attendance'}), 403

        data = request.get_json()

        # Validate required fields
        required_fields = ['student_id', 'subject_id', 'status']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'{field} is required'}), 400

        # Check for duplicate
        if AttendanceLog.check_duplicate(data['student_id'], data['subject_id']):
            return jsonify({'message': 'Attendance already marked for today'}), 409

        # Create attendance record
        attendance = AttendanceLog(
            student_id=data['student_id'],
            subject_id=data['subject_id'],
            status=data['status'],
            marked_by=data.get('marked_by', 'manual'),
            confidence_score=data.get('confidence_score'),
            entry_time=data.get('entry_time'),
            exit_time=data.get('exit_time'),
            notes=data.get('notes')
        )

        db.session.add(attendance)
        db.session.commit()

        return jsonify({
            'message': 'Attendance marked successfully',
            'attendance': attendance.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to mark attendance: {str(e)}'}), 500


@bp.route('/<int:attendance_id>', methods=['PUT'])
@token_required
def update_attendance(current_user, attendance_id):
    """Update attendance record (teachers only, with 48h rule for teachers)"""
    try:
        if current_user.role not in ('teacher', 'admin'):
            return jsonify({'message': 'Only teachers or admins can update attendance'}), 403

        attendance = AttendanceLog.query.get(attendance_id)

        if not attendance:
            return jsonify({'message': 'Attendance record not found'}), 404

        # Enforce 48-hour edit window for teachers
        if current_user.role == 'teacher':
            from datetime import datetime as dt_cls2, time as time_cls
            record_dt = dt_cls2.combine(
                attendance.date,
                attendance.time if attendance.time else time_cls(0, 0),
            )
            hours_since = (dt_cls2.utcnow() - record_dt).total_seconds() / 3600
            if hours_since > 48:
                return jsonify({
                    'message': (
                        'Attendance record is older than 48 hours. '
                        'Please submit an approval request.'
                    ),
                    'requires_approval': True,
                    'attendance_id': attendance_id,
                }), 403

        data = request.get_json()

        # Update fields
        if 'status' in data:
            attendance.status = data['status']
        if 'entry_time' in data:
            attendance.entry_time = data['entry_time']
        if 'exit_time' in data:
            attendance.exit_time = data['exit_time']
        if 'notes' in data:
            attendance.notes = data['notes']

        attendance.marked_by = 'manual'  # Mark as manually edited

        db.session.commit()

        return jsonify({
            'message': 'Attendance updated successfully',
            'attendance': attendance.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to update attendance: {str(e)}'}), 500


@bp.route('/stats', methods=['GET'])
@token_required
def get_statistics(current_user):
    """Get attendance statistics"""
    try:
        student_id = request.args.get('student_id')
        subject_id = request.args.get('subject_id')

        if not student_id:
            return jsonify({'message': 'student_id is required'}), 400

        student = Student.query.get(int(student_id))

        if not student:
            return jsonify({'message': 'Student not found'}), 404

        stats = student.get_attendance_stats(subject_id=int(subject_id) if subject_id else None)

        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'message': f'Failed to get statistics: {str(e)}'}), 500


@bp.route('/export', methods=['GET'])
@token_required
def export_attendance(current_user):
    """Export attendance data (CSV format)"""
    try:
        if current_user.role != 'teacher':
            return jsonify({'message': 'Only teachers can export attendance'}), 403

        # Get query parameters
        student_id = request.args.get('student_id')
        subject_id = request.args.get('subject_id')
        date = request.args.get('date')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        section = request.args.get('section')

        # Build query with joins
        query = db.session.query(AttendanceLog, Student, Subject).join(
            Student, AttendanceLog.student_id == Student.id
        ).join(
            Subject, AttendanceLog.subject_id == Subject.id
        )

        # Apply filters
        if student_id:
            query = query.filter(AttendanceLog.student_id == int(student_id))

        if subject_id:
            query = query.filter(AttendanceLog.subject_id == int(subject_id))

        if date:
            query = query.filter(AttendanceLog.date == date)

        if date_from:
            query = query.filter(AttendanceLog.date >= date_from)

        if date_to:
            query = query.filter(AttendanceLog.date <= date_to)

        if section:
            query = query.filter(Student.section == section)

        # Execute query
        results = query.order_by(AttendanceLog.date.desc(), Student.roll_number).all()

        # Generate CSV
        import io
        import csv
        from flask import Response

        si = io.StringIO()
        writer = csv.writer(si)

        # Write header
        writer.writerow([
            'Date',
            'Time',
            'Student Name',
            'Roll Number',
            'Registration Number',
            'Department',
            'Section',
            'Subject',
            'Subject Code',
            'Status',
            'Marked By',
            'Confidence Score',
            'Entry Time',
            'Exit Time',
            'Notes'
        ])

        # Write data
        for attendance, student, subject in results:
            writer.writerow([
                str(attendance.date),
                str(attendance.time) if attendance.time else '',
                student.name,
                student.roll_number,
                student.reg_number,
                student.department or '',
                student.section or '',
                subject.name,
                subject.code,
                attendance.status,
                attendance.marked_by,
                f"{attendance.confidence_score:.2f}" if attendance.confidence_score else '',
                attendance.entry_time or '',
                attendance.exit_time or '',
                attendance.notes or ''
            ])

        # Create response
        output = si.getvalue()
        si.close()

        response = Response(output, mimetype='text/csv')
        response.headers['Content-Disposition'] = f'attachment; filename=attendance_export_{date or "all"}.csv'

        return response

    except Exception as e:
        return jsonify({'message': f'Failed to export attendance: {str(e)}'}), 500


@bp.route('/daily_summary', methods=['GET'])
@admin_required
def daily_summary(current_user):
    """
    Return today's attendance summary grouped by branch → section.
    Also returns live V2 counts from active streams where available.

    Response:
      {
        "date": "2026-04-18",
        "branches": [
          {
            "id": 1, "name": "CSE", "code": "CSE",
            "sections": [
              {
                "id": 3, "name": "A", "display": "CSE-A",
                "total_students": 45,
                "present_today": 12, "absent_today": 33,
                "live_present": 12,  // from V2 stream (if active, else null)
                "has_live_session": false
              }
            ]
          }
        ]
      }
    """
    from ..models import Branch, Section
    from ..ml.face_recognition_v2 import get_stream_manager
    import sqlalchemy as sa

    today = date_cls.today()

    # Fetch live stream attendance counts (keyed by section_id)
    try:
        manager = get_stream_manager()
        live_sections = {s['section_id']: s for s in manager.get_active_sections()}
    except Exception:
        live_sections = {}

    # Count students per section
    section_totals = dict(
        db.session.execute(
            sa.select(Student.section_id, sa.func.count(Student.id))
            .group_by(Student.section_id)
        ).all()
    )

    # Count today's present records per section
    # JOIN attendance_logs → students to get section_id
    present_counts = dict(
        db.session.execute(
            sa.select(Student.section_id, sa.func.count(sa.distinct(AttendanceLog.student_id)))
            .join(Student, AttendanceLog.student_id == Student.id)
            .where(AttendanceLog.date == today, AttendanceLog.status == 'present')
            .group_by(Student.section_id)
        ).all()
    )

    branches = Branch.query.order_by(Branch.name).all()
    result = []
    for branch in branches:
        sections_data = []
        for sec in sorted(branch.sections, key=lambda s: s.name):
            total   = section_totals.get(sec.id, 0)
            present = present_counts.get(sec.id, 0)
            live    = live_sections.get(sec.id)
            sections_data.append({
                'id':               sec.id,
                'name':             sec.name,
                'display':          f"{branch.code}-{sec.name}",
                'current_semester': sec.current_semester,
                'total_students':   total,
                'present_today':    present,
                'absent_today':     max(0, total - present),
                'live_present':     live['present_count'] if live else None,
                'has_live_session': live is not None,
                'uptime_seconds':   live.get('uptime_seconds') if live else None,
            })
        result.append({
            'id':       branch.id,
            'name':     branch.name,
            'code':     branch.code,
            'sections': sections_data,
        })

    return jsonify({
        'date':     today.isoformat(),
        'branches': result,
    }), 200


@bp.route('/analytics', methods=['GET'])
@token_required
def analytics(current_user):
    """
    Comprehensive attendance analytics for admin/teacher dashboards.

    Query params:
      date_from  YYYY-MM-DD  (default: 30 days ago)
      date_to    YYYY-MM-DD  (default: today)
      branch_id  int         (optional filter)
      section_id int         (optional filter)
      teacher_user_id int    (optional — for teacher's own analytics)
    """
    import sqlalchemy as sa
    from datetime import timedelta, datetime
    from ..models import Branch, Section, Schedule, TeacherProfile

    today = date_cls.today()
    default_from = today - timedelta(days=29)

    # Parse strings → date objects so PostgreSQL gets proper DATE comparisons
    def _parse_date(s, fallback):
        try:
            return datetime.strptime(s, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return fallback

    date_from  = _parse_date(request.args.get('date_from'), default_from)
    date_to    = _parse_date(request.args.get('date_to'),   today)
    branch_id  = request.args.get('branch_id',        type=int)
    section_id = request.args.get('section_id',       type=int)
    teacher_uid = request.args.get('teacher_user_id', type=int)

    # ── helpers ───────────────────────────────────────────────────────────────

    def _base(only_section=None):
        q = (
            db.session.query(AttendanceLog.status, AttendanceLog.date,
                             AttendanceLog.subject_id,
                             Student.section_id, Student.branch_id, Student.id.label('sid'))
            .join(Student, AttendanceLog.student_id == Student.id)
            .filter(AttendanceLog.date >= date_from,
                    AttendanceLog.date <= date_to)
        )
        if branch_id:
            q = q.filter(Student.branch_id == branch_id)
        if section_id or only_section:
            q = q.filter(Student.section_id == (only_section or section_id))
        if teacher_uid:
            # Limit to subjects assigned to this teacher
            tp = TeacherProfile.query.filter_by(user_id=teacher_uid).first()
            if tp:
                subj_ids = [s.subject_id for s in
                            Schedule.query.filter_by(teacher_id=tp.id).all()]
                if subj_ids:
                    q = q.filter(AttendanceLog.subject_id.in_(subj_ids))
        return q

    def _rate(present, total):
        return round(present / total * 100, 1) if total else 0.0

    # ── overall summary ───────────────────────────────────────────────────────

    rows = _base().all()
    total_records  = len(rows)
    total_present  = sum(1 for r in rows if r.status == 'present')
    total_absent   = sum(1 for r in rows if r.status == 'absent')
    overall_rate   = _rate(total_present, total_records)

    # unique_students = total enrolled in the filtered scope (not just those with records)
    _enrolled_q = Student.query
    if branch_id:
        _enrolled_q = _enrolled_q.filter(Student.branch_id == branch_id)
    if section_id:
        _enrolled_q = _enrolled_q.filter(Student.section_id == section_id)
    unique_students = _enrolled_q.count()

    # ── daily trend (last 30 days) ────────────────────────────────────────────

    daily_index: dict = {}
    for r in rows:
        d = str(r.date)
        if d not in daily_index:
            daily_index[d] = {'date': d, 'present': 0, 'absent': 0}
        if r.status == 'present':
            daily_index[d]['present'] += 1
        else:
            daily_index[d]['absent'] += 1

    daily_trend = sorted(daily_index.values(), key=lambda x: x['date'])
    for d in daily_trend:
        tot = d['present'] + d['absent']
        d['rate'] = _rate(d['present'], tot)

    # ── by branch ─────────────────────────────────────────────────────────────

    branch_index: dict = {}
    for r in rows:
        bid = r.branch_id
        if bid not in branch_index:
            branch_index[bid] = {'present': 0, 'total': 0}
        branch_index[bid]['total'] += 1
        if r.status == 'present':
            branch_index[bid]['present'] += 1

    branch_stats = []
    for branch in Branch.query.order_by(Branch.name).all():
        bi = branch_index.get(branch.id, {'present': 0, 'total': 0})
        branch_stats.append({
            'branch_id':   branch.id,
            'branch_name': branch.name,
            'branch_code': branch.code,
            'present':     bi['present'],
            'absent':      bi['total'] - bi['present'],
            'total':       bi['total'],
            'rate':        _rate(bi['present'], bi['total']),
        })

    # ── by section ────────────────────────────────────────────────────────────

    sec_index: dict = {}
    for r in rows:
        sid = r.section_id
        if sid not in sec_index:
            sec_index[sid] = {'present': 0, 'total': 0}
        sec_index[sid]['total'] += 1
        if r.status == 'present':
            sec_index[sid]['present'] += 1

    section_stats = []
    from ..models import Section as Sec
    for sec in Sec.query.order_by(Sec.id).all():
        si = sec_index.get(sec.id, {'present': 0, 'total': 0})
        section_stats.append({
            'section_id':   sec.id,
            'display':      f"{sec.branch.code if sec.branch else '?'}-{sec.name}",
            'branch_code':  sec.branch.code if sec.branch else '?',
            'present':      si['present'],
            'absent':       si['total'] - si['present'],
            'total':        si['total'],
            'rate':         _rate(si['present'], si['total']),
        })
    section_stats = [s for s in section_stats if s['total'] > 0]

    # ── by subject ────────────────────────────────────────────────────────────

    subj_index: dict = {}
    for r in rows:
        sbid = r.subject_id
        if sbid not in subj_index:
            subj_index[sbid] = {'present': 0, 'total': 0}
        subj_index[sbid]['total'] += 1
        if r.status == 'present':
            subj_index[sbid]['present'] += 1

    subject_stats = []
    for subj in Subject.query.order_by(Subject.name).all():
        si = subj_index.get(subj.id, {'present': 0, 'total': 0})
        if si['total'] == 0:
            continue
        subject_stats.append({
            'subject_id':   subj.id,
            'subject_name': subj.name,
            'subject_code': subj.code,
            'present':      si['present'],
            'absent':       si['total'] - si['present'],
            'total':        si['total'],
            'rate':         _rate(si['present'], si['total']),
        })

    # ── by student (top / bottom performers) — includes ALL enrolled students ─

    student_index: dict = {}
    for r in rows:
        sid = r.sid
        if sid not in student_index:
            student_index[sid] = {'present': 0, 'total': 0}
        student_index[sid]['total'] += 1
        if r.status == 'present':
            student_index[sid]['present'] += 1

    # Query ALL students in the filtered scope (not only those with records)
    all_stu_q = Student.query
    if branch_id:
        all_stu_q = all_stu_q.filter(Student.branch_id == branch_id)
    if section_id:
        all_stu_q = all_stu_q.filter(Student.section_id == section_id)
    if teacher_uid:
        tp = TeacherProfile.query.filter_by(user_id=teacher_uid).first()
        if tp:
            tp_section_ids = list({
                s.section_id for s in Schedule.query.filter_by(teacher_id=tp.id).all()
            })
            if tp_section_ids:
                all_stu_q = all_stu_q.filter(Student.section_id.in_(tp_section_ids))

    student_stats = []
    for stu in all_stu_q.all():
        si   = student_index.get(stu.id, {'present': 0, 'total': 0})
        rate = _rate(si['present'], si['total']) if si['total'] > 0 else 0.0
        student_stats.append({
            'student_id':   stu.id,
            'name':         stu.user.name if stu.user else '?',
            'roll_number':  stu.roll_number,
            'section':      f"{stu.branch.code if stu.branch else '?'}-{stu.section or '?'}",
            'present':      si['present'],
            'absent':       si['total'] - si['present'],
            'total':        si['total'],
            'rate':         rate,
            'risk':         rate < 75,
        })

    # Sort: worst rate first; students with no records (total=0) are riskiest
    student_stats.sort(key=lambda x: (x['total'] > 0, x['rate']))
    low_performers  = student_stats[:10]
    high_performers = sorted(
        [s for s in student_stats if s['total'] > 0],
        key=lambda x: -x['rate']
    )[:10]

    return jsonify({
        'date_from':       date_from.isoformat(),
        'date_to':         date_to.isoformat(),
        'summary': {
            'total_records':    total_records,
            'total_present':    total_present,
            'total_absent':     total_absent,
            'overall_rate':     overall_rate,
            'unique_students':  unique_students,
        },
        'daily_trend':     daily_trend,
        'branch_stats':    branch_stats,
        'section_stats':   section_stats,
        'subject_stats':   subject_stats,
        'low_performers':  low_performers,
        'high_performers': high_performers,
    }), 200


@bp.route('/daily-report', methods=['GET'])
@token_required
def daily_report(current_user):
    """
    Admin/Teacher: For any date, show all students and their attendance per section.

    Query params:
      date        YYYY-MM-DD  (default: today)
      section_id  int         (optional)
      branch_id   int         (optional)

    Response:
      {
        "date": "...",
        "sections": [
          {
            "section_id": 3, "display": "CSE-A",
            "students": [
              { "student_id": 12, "name": "...", "roll": "...",
                "status": "present"|"absent"|"late"|null,
                "subject": {...}, "marked_by": "...", "time": "..." }
            ],
            "present": 30, "absent": 15, "total": 45
          }
        ]
      }
    """
    import sqlalchemy as sa
    from datetime import datetime as dt_cls2
    from ..models import Branch, Section, Schedule, TimeSlot

    # Parse date
    date_str = request.args.get('date')
    try:
        report_date = dt_cls2.strptime(date_str, '%Y-%m-%d').date() if date_str else date_cls.today()
    except (ValueError, TypeError):
        report_date = date_cls.today()

    section_id_filter = request.args.get('section_id', type=int)
    branch_id_filter  = request.args.get('branch_id',  type=int)

    # Find what day of week the report_date was
    day_of_week = report_date.weekday()  # 0=Mon..4=Fri

    # Get sections
    sec_q = Section.query.order_by(Section.global_index)
    if section_id_filter:
        sec_q = sec_q.filter_by(id=section_id_filter)
    elif branch_id_filter:
        sec_q = sec_q.filter_by(branch_id=branch_id_filter)
    sections = sec_q.all()

    # Get all attendance logs for that date
    logs_on_date = (
        AttendanceLog.query
        .filter(AttendanceLog.date == report_date)
        .all()
    )
    # Index: student_id → list of logs (may have multiple subjects)
    log_index: dict = {}
    for log in logs_on_date:
        log_index.setdefault(log.student_id, []).append(log)

    # Get schedules for that day (to know what subject each section had)
    schedules_on_day = Schedule.query.filter_by(day_of_week=day_of_week).all() if day_of_week < 5 else []
    # Index: section_id → list of schedule entries
    sec_sched_index: dict = {}
    for s in schedules_on_day:
        sec_sched_index.setdefault(s.section_id, []).append(s)

    result_sections = []
    for sec in sections:
        students_in_sec = (
            Student.query
            .filter_by(section_id=sec.id)
            .order_by(Student.roll_number)
            .all()
        )

        student_rows = []
        present_count = 0
        for stu in students_in_sec:
            stu_logs = log_index.get(stu.id, [])
            # Determine primary status: present > late > absent > null
            status = None
            primary_log = None
            for log in stu_logs:
                if log.status == 'present':
                    status = 'present'
                    primary_log = log
                    break
                elif log.status == 'late' and status != 'present':
                    status = 'late'
                    primary_log = log
                elif log.status == 'absent' and status not in ('present', 'late'):
                    status = 'absent'
                    primary_log = log

            if status in ('present', 'late'):
                present_count += 1

            student_rows.append({
                'student_id': stu.id,
                'name':       stu.user.name if stu.user else '?',
                'roll_number': stu.roll_number,
                'reg_number': stu.reg_number,
                'status':     status,
                'subject': {
                    'id':   primary_log.subject_id,
                    'name': primary_log.subject.name if primary_log and primary_log.subject else '?',
                    'code': primary_log.subject.code if primary_log and primary_log.subject else '',
                } if primary_log else None,
                'marked_by': primary_log.marked_by if primary_log else None,
                'marked_time': str(primary_log.time) if primary_log and primary_log.time else None,
                'all_logs': [
                    {
                        'subject_id':   lg.subject_id,
                        'subject_name': lg.subject.name if lg.subject else '?',
                        'subject_code': lg.subject.code if lg.subject else '',
                        'status':       lg.status,
                        'marked_by':    lg.marked_by,
                        'time':         str(lg.time) if lg.time else None,
                    } for lg in stu_logs
                ],
            })

        # Scheduled subjects for this section on this day
        scheduled_subjects = []
        for sched in sec_sched_index.get(sec.id, []):
            slot = sched.time_slot
            scheduled_subjects.append({
                'subject_id':   sched.subject_id,
                'subject_name': sched.subject.name if sched.subject else '?',
                'subject_code': sched.subject.code if sched.subject else '',
                'start_time':   slot.start_time if slot else '',
                'end_time':     slot.end_time if slot else '',
                'label':        slot.label if slot else '',
                'teacher_name': sched.teacher.user.name if sched.teacher and sched.teacher.user else '?',
            })
        scheduled_subjects.sort(key=lambda x: x.get('start_time', ''))

        result_sections.append({
            'section_id':       sec.id,
            'display':          f"{sec.branch.code if sec.branch else '?'}-{sec.name}",
            'branch_code':      sec.branch.code if sec.branch else '?',
            'branch_name':      sec.branch.name if sec.branch else '?',
            'current_semester': sec.current_semester,
            'total':            len(students_in_sec),
            'present':          present_count,
            'absent':           len(students_in_sec) - present_count,
            'is_weekend':       day_of_week >= 5,
            'scheduled_subjects': scheduled_subjects,
            'students':         student_rows,
        })

    return jsonify({
        'date':       report_date.isoformat(),
        'day_name':   ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][day_of_week],
        'is_weekend': day_of_week >= 5,
        'sections':   result_sections,
    }), 200


@bp.route('/my-attendance', methods=['GET'])
@token_required
def my_attendance(current_user):
    """
    Student: Get own attendance records grouped by subject.

    The total denominator is derived from scheduled class occurrences in the
    date range — NOT from existing log rows. This means even if a teacher never
    explicitly marks a student absent (no log row), the missing classes still
    count against the attendance percentage.

    Query params:
      period     'semester'|'month'|'week'  (default: semester)
      subject_id  int  (optional, filter to one subject)
    """
    from datetime import datetime as dt_cls2, timedelta
    from ..models import Schedule, Subject

    if current_user.role != 'student':
        return jsonify({'message': 'Only students can access this endpoint'}), 403

    stu = Student.query.filter_by(user_id=current_user.id).first()
    if not stu:
        return jsonify({'message': 'Student profile not found'}), 404

    period = request.args.get('period', 'semester')
    subj_filter = request.args.get('subject_id', type=int)

    today = date_cls.today()
    if period == 'week':
        from_date = today - timedelta(days=today.weekday())
    elif period == 'month':
        from_date = today.replace(day=1)
    else:
        # semester: approximate start — Aug (odd) or Jan (even)
        if today.month >= 8:
            from_date = today.replace(month=8, day=1)
        else:
            from_date = today.replace(month=1, day=1)

    # ── 1. Count scheduled occurrences per subject (denominator) ─────────────
    def _weekday_count(fd, td, weekday):
        """How many times does `weekday` (0=Mon..4=Fri) fall in [fd, td]?"""
        total_days = (td - fd).days + 1
        full_weeks, rem = divmod(total_days, 7)
        count = full_weeks
        for i in range(rem):
            if (fd + timedelta(days=i)).weekday() == weekday:
                count += 1
        return count

    schedules_q = Schedule.query.filter_by(section_id=stu.section_id)
    if subj_filter:
        schedules_q = schedules_q.filter_by(subject_id=subj_filter)
    schedules = schedules_q.all()

    # subject_id → { scheduled, subject_name, subject_code }
    sched_map: dict = {}
    for sched in schedules:
        sid = sched.subject_id
        if sid not in sched_map:
            sched_map[sid] = {
                'subject_id':   sid,
                'subject_name': sched.subject.name if sched.subject else '?',
                'subject_code': sched.subject.code if sched.subject else '',
                'scheduled':    0,
            }
        # Only weekdays 0-4 are valid class days
        if 0 <= sched.day_of_week <= 4:
            sched_map[sid]['scheduled'] += _weekday_count(from_date, today, sched.day_of_week)

    # ── 2. Fetch actual logs ──────────────────────────────────────────────────
    logs_q = AttendanceLog.query.filter(
        AttendanceLog.student_id == stu.id,
        AttendanceLog.date >= from_date,
        AttendanceLog.date <= today,
    )
    if subj_filter:
        logs_q = logs_q.filter(AttendanceLog.subject_id == subj_filter)
    logs = logs_q.order_by(AttendanceLog.date.desc()).all()

    # subject_id → {present, absent, late, recent_logs}
    log_map: dict = {}
    for log in logs:
        sid = log.subject_id
        if sid not in log_map:
            log_map[sid] = {'present': 0, 'absent': 0, 'late': 0, 'recent_logs': []}
        if log.status == 'present':
            log_map[sid]['present'] += 1
        elif log.status == 'late':
            log_map[sid]['late'] += 1
        else:
            log_map[sid]['absent'] += 1
        if len(log_map[sid]['recent_logs']) < 10:
            log_map[sid]['recent_logs'].append({
                'date':      str(log.date),
                'status':    log.status,
                'marked_by': log.marked_by,
            })

    # ── 3. Merge: use scheduled count as total ────────────────────────────────
    subjects_list = []
    for sid, info in sched_map.items():
        lm = log_map.get(sid, {'present': 0, 'absent': 0, 'late': 0, 'recent_logs': []})
        scheduled = info['scheduled']  # true denominator
        attended  = lm['present'] + lm['late']
        # absent = scheduled - attended (may exceed explicit absent logs)
        absent_real = max(scheduled - attended, lm['absent'])
        pct = round(attended / scheduled * 100, 1) if scheduled > 0 else 0.0
        needed = 0
        if pct < 75 and scheduled > 0:
            # classes_needed so that (attended + x) / (scheduled + x) >= 0.75
            if 0.75 * scheduled > attended:
                needed = max(0, int((0.75 * scheduled - attended) / 0.25) + 1)

        subjects_list.append({
            'subject_id':   sid,
            'subject_name': info['subject_name'],
            'subject_code': info['subject_code'],
            'present':      lm['present'],
            'late':         lm['late'],
            'absent':       absent_real,
            'total':        scheduled,          # denominator = scheduled classes
            'percentage':   pct,
            'classes_needed_for_75': needed,
            'recent_logs':  lm['recent_logs'],
        })

    subjects_list.sort(key=lambda x: x['percentage'])

    # ── 4. Overall ────────────────────────────────────────────────────────────
    total_all   = sum(d['total']   for d in subjects_list)
    present_all = sum(d['present'] + d['late'] for d in subjects_list)
    overall_pct = round(present_all / total_all * 100, 1) if total_all > 0 else 0.0

    return jsonify({
        'student_id': stu.id,
        'period':     period,
        'from_date':  from_date.isoformat(),
        'to_date':    today.isoformat(),
        'overall': {
            'total_classes': total_all,
            'attended':      present_all,
            'percentage':    overall_pct,
        },
        'by_subject': subjects_list,
    }), 200


@bp.route('/request', methods=['POST'])
@token_required
def request_attendance(current_user):
    """
    Student: Request attendance correction from teacher.
    Creates a notification to the teacher.

    Body: { subject_id, date, reason }
    """
    from ..models import Schedule, TeacherProfile
    from ..models.notification import Notification

    if current_user.role != 'student':
        return jsonify({'message': 'Only students can request attendance'}), 403

    stu = Student.query.filter_by(user_id=current_user.id).first()
    if not stu:
        return jsonify({'message': 'Student profile not found'}), 404

    data = request.get_json() or {}
    subject_id = data.get('subject_id')
    req_date   = data.get('date')
    reason     = (data.get('reason') or '').strip()

    if not subject_id or not req_date:
        return jsonify({'message': 'subject_id and date are required'}), 400

    # Find teacher assigned to this subject for student's section
    day_of_week = None
    try:
        from datetime import datetime as dt_cls2
        d = dt_cls2.strptime(req_date, '%Y-%m-%d').date()
        day_of_week = d.weekday()
    except Exception:
        pass

    teacher_notif_sent = False
    if day_of_week is not None and day_of_week < 5:
        sched = Schedule.query.filter_by(
            section_id=stu.section_id,
            subject_id=subject_id,
            day_of_week=day_of_week,
        ).first()
        if sched and sched.teacher and sched.teacher.user:
            # Send notification to teacher (stored in notifications table)
            subject_name = sched.subject.name if sched.subject else f'Subject #{subject_id}'
            msg = (
                f"Attendance request from {stu.user.name if stu.user else 'student'} "
                f"({stu.roll_number}) for {subject_name} on {req_date}. "
                f"Reason: {reason or 'No reason provided'}"
            )
            notif = Notification(
                student_id=stu.id,
                title=f"Attendance Request — {subject_name}",
                message=msg,
                type='alert',
            )
            db.session.add(notif)
            db.session.commit()
            teacher_notif_sent = True

    if not teacher_notif_sent:
        # Still log as a generic notification
        subject_obj = Subject.query.get(subject_id)
        subject_name = subject_obj.name if subject_obj else f'Subject #{subject_id}'
        msg = (
            f"Attendance request from {stu.user.name if stu.user else 'student'} "
            f"({stu.roll_number}) for {subject_name} on {req_date}. "
            f"Reason: {reason or 'No reason provided'}"
        )
        notif = Notification(
            student_id=stu.id,
            title=f"Attendance Request — {subject_name}",
            message=msg,
            type='alert',
        )
        db.session.add(notif)
        db.session.commit()

    return jsonify({
        'message': 'Attendance request submitted successfully',
        'teacher_notified': teacher_notif_sent,
    }), 201


@bp.route('/report/download', methods=['GET'])
@token_required
def download_report(current_user):
    """
    Download attendance report as CSV.

    Query params:
      report_type   summary | student_detail | subject_detail  (default: summary)
      date_from     YYYY-MM-DD
      date_to       YYYY-MM-DD
      branch_id     int (optional)
      section_id    int (optional)
      teacher_user_id int (optional)
    """
    import io
    import csv
    from datetime import timedelta
    from flask import Response
    from ..models import Schedule, TeacherProfile

    from datetime import datetime as dt_cls2
    today = date_cls.today()
    default_from = today - timedelta(days=29)

    def _pd(s, fallback):
        try:
            return dt_cls2.strptime(s, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return fallback

    report_type = request.args.get('report_type', 'summary')
    date_from   = _pd(request.args.get('date_from'), default_from)
    date_to     = _pd(request.args.get('date_to'),   today)
    branch_id   = request.args.get('branch_id',  type=int)
    section_id  = request.args.get('section_id', type=int)
    teacher_uid = request.args.get('teacher_user_id', type=int)

    # Build base query
    query = (
        db.session.query(AttendanceLog, Student, Subject)
        .join(Student, AttendanceLog.student_id == Student.id)
        .join(Subject, AttendanceLog.subject_id == Subject.id)
        .filter(AttendanceLog.date >= date_from,
                AttendanceLog.date <= date_to)
    )
    if branch_id:
        query = query.filter(Student.branch_id == branch_id)
    if section_id:
        query = query.filter(Student.section_id == section_id)
    if teacher_uid:
        tp = TeacherProfile.query.filter_by(user_id=teacher_uid).first()
        if tp:
            subj_ids = [s.subject_id for s in Schedule.query.filter_by(teacher_id=tp.id).all()]
            if subj_ids:
                query = query.filter(AttendanceLog.subject_id.in_(subj_ids))

    results = query.order_by(
        AttendanceLog.date.desc(), Student.roll_number
    ).all()

    si = io.StringIO()
    writer = csv.writer(si)
    filename = f"attendance_{report_type}_{date_from}_to_{date_to}.csv"

    if report_type == 'student_detail':
        # Per-student per-subject summary
        from collections import defaultdict
        data: dict = defaultdict(lambda: defaultdict(lambda: {'present': 0, 'total': 0}))
        student_info: dict = {}
        subject_info: dict = {}
        for log, stu, subj in results:
            data[stu.id][subj.id]['total'] += 1
            if log.status == 'present':
                data[stu.id][subj.id]['present'] += 1
            student_info[stu.id] = stu
            subject_info[subj.id] = subj

        subjects_sorted = sorted(subject_info.values(), key=lambda x: x.name)
        writer.writerow(
            ['Student Name', 'Roll Number', 'Section'] +
            [s.name for s in subjects_sorted] +
            ['Overall Present', 'Overall Total', 'Overall Rate (%)']
        )
        for sid, stu in sorted(student_info.items(), key=lambda x: x[1].roll_number):
            row = [
                stu.user.name if stu.user else '?',
                stu.roll_number,
                f"{stu.branch.code if stu.branch else '?'}-{stu.section or '?'}",
            ]
            total_p = total_t = 0
            for subj in subjects_sorted:
                d = data[sid][subj.id]
                row.append(f"{d['present']}/{d['total']} ({round(d['present']/d['total']*100,1) if d['total'] else 0}%)")
                total_p += d['present']
                total_t += d['total']
            overall_rate = round(total_p / total_t * 100, 1) if total_t else 0
            row += [total_p, total_t, overall_rate]
            writer.writerow(row)

    elif report_type == 'subject_detail':
        # Per-subject attendance
        from collections import defaultdict
        data: dict = defaultdict(lambda: {'present': 0, 'total': 0, 'students': set()})
        subject_info: dict = {}
        for log, stu, subj in results:
            data[subj.id]['total'] += 1
            data[subj.id]['students'].add(stu.id)
            if log.status == 'present':
                data[subj.id]['present'] += 1
            subject_info[subj.id] = subj

        writer.writerow(['Subject', 'Code', 'Total Records', 'Present', 'Absent',
                         'Attendance Rate (%)', 'Unique Students'])
        for sid, subj in sorted(subject_info.items(), key=lambda x: x[1].name):
            d = data[sid]
            rate = round(d['present'] / d['total'] * 100, 1) if d['total'] else 0
            writer.writerow([
                subj.name, subj.code,
                d['total'], d['present'], d['total'] - d['present'],
                rate, len(d['students'])
            ])

    else:
        # Default: full detail
        writer.writerow([
            'Date', 'Student Name', 'Roll Number', 'Section',
            'Subject', 'Subject Code', 'Status', 'Marked By', 'Confidence Score'
        ])
        for log, stu, subj in results:
            writer.writerow([
                str(log.date),
                stu.user.name if stu.user else '?',
                stu.roll_number,
                f"{stu.branch.code if stu.branch else '?'}-{stu.section or '?'}",
                subj.name, subj.code,
                log.status,
                log.marked_by or '',
                f"{log.confidence_score:.3f}" if log.confidence_score else '',
            ])

    output = si.getvalue()
    si.close()
    response = Response(output, mimetype='text/csv')
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# ---------------------------------------------------------------------------
# Teacher-scoped attendance routes (new — added after existing routes)
# ---------------------------------------------------------------------------

@bp.route('/teacher/daily', methods=['GET'])
@token_required
def teacher_daily_view(current_user):
    """
    Teacher daily attendance view.

    GET /api/attendance/teacher/daily?date=YYYY-MM-DD&section_id=N

    Returns the teacher's schedule for the requested day along with all
    students in each scheduled section and their attendance status for
    that subject on that date.
    """
    from datetime import datetime as dt_cls2, timedelta, time as time_cls
    from ..models import Schedule, TeacherProfile, Section, TimeSlot
    from ..models.notification import Notification

    if current_user.role not in ('teacher', 'admin'):
        return jsonify({'message': 'Only teachers or admins can access this endpoint'}), 403

    # Parse query params
    date_str = request.args.get('date')
    section_id_filter = request.args.get('section_id', type=int)

    try:
        report_date = dt_cls2.strptime(date_str, '%Y-%m-%d').date() if date_str else date_cls.today()
    except (ValueError, TypeError):
        report_date = date_cls.today()

    day_of_week = report_date.weekday()  # 0=Mon … 6=Sun
    day_name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day_of_week]
    is_weekend = day_of_week >= 5

    # Locate the teacher's TeacherProfile
    tp = TeacherProfile.query.filter_by(user_id=current_user.id).first()
    if not tp and current_user.role == 'teacher':
        return jsonify({'message': 'Teacher profile not found'}), 404

    # Build schedule query for this teacher on this day
    if is_weekend:
        # No classes on weekends
        return jsonify({
            'date': report_date.isoformat(),
            'day_name': day_name,
            'is_weekend': True,
            'periods': [],
        }), 200

    sched_q = Schedule.query.filter_by(day_of_week=day_of_week)
    if tp:
        sched_q = sched_q.filter_by(teacher_id=tp.id)
    if section_id_filter:
        sched_q = sched_q.filter_by(section_id=section_id_filter)

    schedules = sched_q.order_by(Schedule.time_slot_id).all()

    # Pre-fetch attendance logs for this date across all scheduled subjects/sections
    subject_ids = list({s.subject_id for s in schedules})
    section_ids = list({s.section_id for s in schedules})

    logs_on_date = []
    if subject_ids and section_ids:
        # Fetch logs for all relevant students on this date
        relevant_student_ids = [
            stu.id for stu in
            Student.query.filter(Student.section_id.in_(section_ids)).all()
        ]
        if relevant_student_ids:
            logs_on_date = AttendanceLog.query.filter(
                AttendanceLog.date == report_date,
                AttendanceLog.student_id.in_(relevant_student_ids),
                AttendanceLog.subject_id.in_(subject_ids),
            ).all()

    # Index: (student_id, subject_id) → log
    log_index: dict = {}
    for lg in logs_on_date:
        log_index[(lg.student_id, lg.subject_id)] = lg

    now_utc = dt_cls2.utcnow()

    periods = []
    for sched in schedules:
        slot = sched.time_slot
        sec = sched.section
        subj = sched.subject
        branch = sec.branch if sec else None

        # Students in this section
        students_in_sec = (
            Student.query
            .filter_by(section_id=sched.section_id)
            .order_by(Student.roll_number)
            .all()
        )

        student_rows = []
        present_count = 0
        absent_count = 0

        for stu in students_in_sec:
            lg = log_index.get((stu.id, sched.subject_id))

            attendance_info = None
            if lg:
                record_dt = dt_cls2.combine(lg.date, lg.time if lg.time else time_cls(0, 0))
                hours_since = (now_utc - record_dt).total_seconds() / 3600
                can_edit = hours_since <= 48
                attendance_info = {
                    'id': lg.id,
                    'status': lg.status,
                    'marked_by': lg.marked_by,
                    'time': str(lg.time) if lg.time else None,
                    'can_edit': can_edit,
                    'hours_since': round(hours_since, 2),
                }
                if lg.status == 'present':
                    present_count += 1
                else:
                    absent_count += 1
            else:
                absent_count += 1

            student_rows.append({
                'student_id': stu.id,
                'name': stu.user.name if stu.user else '?',
                'roll_number': stu.roll_number,
                'reg_number': stu.reg_number,
                'branch_code': branch.code if branch else '?',
                'section_name': sec.name if sec else '?',
                'attendance': attendance_info,
            })

        periods.append({
            'slot_label': slot.label if slot else '',
            'start_time': slot.start_time if slot else '',
            'end_time': slot.end_time if slot else '',
            'slot_id': slot.id if slot else None,
            'schedule_id': sched.id,
            'section': {
                'id': sec.id if sec else None,
                'display': f"{branch.code if branch else '?'}-{sec.name if sec else '?'}",
                'branch_code': branch.code if branch else '?',
                'name': sec.name if sec else '?',
            },
            'subject': {
                'id': subj.id if subj else None,
                'name': subj.name if subj else '?',
                'code': subj.code if subj else '',
            },
            'students': student_rows,
            'present_count': present_count,
            'absent_count': absent_count,
            'total': len(students_in_sec),
        })

    return jsonify({
        'date': report_date.isoformat(),
        'day_name': day_name,
        'is_weekend': is_weekend,
        'periods': periods,
    }), 200


@bp.route('/bulk-mark', methods=['POST'])
@token_required
def bulk_mark_attendance(current_user):
    """
    Bulk mark or upsert attendance.

    POST /api/attendance/bulk-mark
    Body: {
        "section_id": N,
        "subject_id": N,
        "date": "YYYY-MM-DD",
        "entries": [{"student_id": N, "status": "present|absent|late"}, ...]
    }

    For each entry: insert if no existing record, update if exists (48h rule enforced on updates).
    Returns {"marked": N, "skipped": N, "skipped_ids": [...]}
    """
    from datetime import datetime as dt_cls2, time as time_cls

    if current_user.role not in ('teacher', 'admin'):
        return jsonify({'message': 'Only teachers or admins can bulk-mark attendance'}), 403

    data = request.get_json() or {}
    section_id = data.get('section_id')
    subject_id = data.get('subject_id')
    date_str = data.get('date')
    entries = data.get('entries', [])

    if not subject_id or not date_str or not entries:
        return jsonify({'message': 'subject_id, date, and entries are required'}), 400

    try:
        mark_date = dt_cls2.strptime(date_str, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return jsonify({'message': 'Invalid date format. Use YYYY-MM-DD'}), 400

    valid_statuses = {'present', 'absent', 'late'}
    now_utc = dt_cls2.utcnow()

    marked = 0
    skipped = 0
    skipped_ids = []

    for entry in entries:
        student_id = entry.get('student_id')
        status = entry.get('status')

        if not student_id or status not in valid_statuses:
            skipped += 1
            if student_id:
                skipped_ids.append(student_id)
            continue

        existing = AttendanceLog.query.filter_by(
            student_id=student_id,
            subject_id=subject_id,
            date=mark_date,
        ).first()

        if existing:
            # Enforce 48h rule for updates (teachers only)
            if current_user.role == 'teacher':
                record_dt = dt_cls2.combine(existing.date, existing.time if existing.time else time_cls(0, 0))
                hours_since = (now_utc - record_dt).total_seconds() / 3600
                if hours_since > 48:
                    skipped += 1
                    skipped_ids.append(student_id)
                    continue

            existing.status = status
            existing.marked_by = 'manual'
            marked += 1
        else:
            new_log = AttendanceLog(
                student_id=student_id,
                subject_id=subject_id,
                date=mark_date,
                status=status,
                marked_by='manual',
            )
            db.session.add(new_log)
            marked += 1

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to save attendance: {str(e)}'}), 500

    return jsonify({
        'marked': marked,
        'skipped': skipped,
        'skipped_ids': skipped_ids,
    }), 200


@bp.route('/approval-request', methods=['POST'])
@token_required
def create_approval_request(current_user):
    """
    Teacher requests an edit on a >48h attendance record.

    POST /api/attendance/approval-request
    Body: {"attendance_id": N, "new_status": "present|absent|late", "reason": "..."}
    """
    import json
    from datetime import datetime as dt_cls2
    from ..models import Schedule, TeacherProfile
    from ..models.notification import Notification

    if current_user.role != 'teacher':
        return jsonify({'message': 'Only teachers can submit approval requests'}), 403

    data = request.get_json() or {}
    attendance_id = data.get('attendance_id')
    new_status = data.get('new_status')
    reason = (data.get('reason') or '').strip()

    if not attendance_id or not new_status:
        return jsonify({'message': 'attendance_id and new_status are required'}), 400

    valid_statuses = {'present', 'absent', 'late'}
    if new_status not in valid_statuses:
        return jsonify({'message': f'new_status must be one of: {", ".join(valid_statuses)}'}), 400

    attendance = AttendanceLog.query.get(attendance_id)
    if not attendance:
        return jsonify({'message': 'Attendance record not found'}), 404

    # Validate teacher owns the class (their subject appears in schedule for student's section)
    tp = TeacherProfile.query.filter_by(user_id=current_user.id).first()
    if not tp:
        return jsonify({'message': 'Teacher profile not found'}), 404

    student = Student.query.get(attendance.student_id)
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    # Check teacher is assigned to this subject for the student's section
    day_of_week = attendance.date.weekday()
    owns_class = Schedule.query.filter_by(
        teacher_id=tp.id,
        subject_id=attendance.subject_id,
        section_id=student.section_id,
        day_of_week=day_of_week,
    ).first()

    if not owns_class:
        return jsonify({'message': 'You are not assigned to this class/subject'}), 403

    subject = Subject.query.get(attendance.subject_id)
    subject_name = subject.name if subject else f'Subject #{attendance.subject_id}'

    message_payload = json.dumps({
        'attendance_id': attendance_id,
        'new_status': new_status,
        'reason': reason,
        'teacher_user_id': current_user.id,
        'teacher_name': current_user.name,
        'student_name': student.user.name if student.user else '?',
        'roll_number': student.roll_number,
        'subject_name': subject_name,
        'date': attendance.date.isoformat(),
        'requested_at': dt_cls2.utcnow().isoformat(),
        'state': 'pending',
    })

    notif = Notification(
        student_id=attendance.student_id,
        title='ATTN_APPROVAL_REQUEST',
        message=message_payload,
        type='alert',
        read_status=False,
    )
    db.session.add(notif)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to submit approval request: {str(e)}'}), 500

    return jsonify({'message': 'Approval request submitted'}), 201


@bp.route('/approval-requests', methods=['GET'])
@admin_required
def list_approval_requests(current_user):
    """
    Admin: List all pending attendance approval requests.

    GET /api/attendance/approval-requests
    """
    import json
    from ..models.notification import Notification

    pending = Notification.query.filter_by(
        title='ATTN_APPROVAL_REQUEST',
        read_status=False,
    ).order_by(Notification.id.desc()).all()

    results = []
    for notif in pending:
        try:
            payload = json.loads(notif.message)
        except (ValueError, TypeError):
            payload = {}
        results.append({
            'notification_id': notif.id,
            'student_id': notif.student_id,
            **payload,
        })

    return jsonify({'requests': results, 'count': len(results)}), 200


@bp.route('/approval-requests/<int:notif_id>', methods=['PUT'])
@admin_required
def process_approval_request(current_user, notif_id):
    """
    Admin: Approve or reject an attendance approval request.

    PUT /api/attendance/approval-requests/<notif_id>
    Body: {"action": "approve"|"reject", "admin_notes": "..."}
    """
    import json
    from datetime import datetime as dt_cls2
    from ..models.notification import Notification

    data = request.get_json() or {}
    action = data.get('action')
    admin_notes = (data.get('admin_notes') or '').strip()

    if action not in ('approve', 'reject'):
        return jsonify({'message': 'action must be "approve" or "reject"'}), 400

    notif = Notification.query.get(notif_id)
    if not notif or notif.title != 'ATTN_APPROVAL_REQUEST':
        return jsonify({'message': 'Approval request not found'}), 404

    try:
        payload = json.loads(notif.message)
    except (ValueError, TypeError):
        return jsonify({'message': 'Malformed approval request payload'}), 500

    attendance_id = payload.get('attendance_id')
    new_status = payload.get('new_status')

    if action == 'approve':
        attendance = AttendanceLog.query.get(attendance_id)
        if not attendance:
            return jsonify({'message': 'Attendance record not found'}), 404
        attendance.status = new_status
        attendance.marked_by = 'admin_approved'
        attendance.notes = (
            f"Admin approved change to '{new_status}'. "
            + (f"Notes: {admin_notes}" if admin_notes else '')
        ).strip()

    # Mark the approval notification as read (resolved)
    notif.read_status = True

    # Notify student about the outcome
    outcome_msg = (
        f"Your attendance for {payload.get('subject_name', 'a subject')} "
        f"on {payload.get('date', '')} has been "
        f"{'updated to ' + new_status if action == 'approve' else 'rejected'}."
    )
    if admin_notes:
        outcome_msg += f" Admin notes: {admin_notes}"

    outcome_notif = Notification(
        student_id=notif.student_id,
        title=f"Attendance {'Approved' if action == 'approve' else 'Rejected'}",
        message=outcome_msg,
        type='success' if action == 'approve' else 'alert',
        read_status=False,
    )
    db.session.add(outcome_notif)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to process request: {str(e)}'}), 500

    return jsonify({
        'message': f'Approval request {action}d successfully',
        'attendance_id': attendance_id,
        'action': action,
    }), 200


# ---------------------------------------------------------------------------
# Student-scoped endpoints
# ---------------------------------------------------------------------------

@bp.route('/my-today-attendance', methods=['GET'])
@token_required
def my_today_attendance(current_user):
    """
    Student: Get today's scheduled periods with attendance status.

    Returns each period from the student's section schedule today,
    along with attendance log info (present/absent/late/unmarked).
    """
    from datetime import datetime as dt_cls2, time as time_cls
    from ..models import Schedule, Section, TimeSlot

    if current_user.role != 'student':
        return jsonify({'message': 'Only students can access this endpoint'}), 403

    stu = Student.query.filter_by(user_id=current_user.id).first()
    if not stu:
        return jsonify({'message': 'Student profile not found'}), 404

    today = date_cls.today()
    day_of_week = today.weekday()
    day_name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day_of_week]
    is_weekend = day_of_week >= 5

    if is_weekend:
        return jsonify({'is_weekend': True, 'day': day_name, 'periods': []}), 200

    # Get schedule for student's section today
    schedules = (
        Schedule.query
        .filter_by(section_id=stu.section_id, day_of_week=day_of_week)
        .order_by(Schedule.time_slot_id)
        .all()
    )

    subject_ids = [s.subject_id for s in schedules]
    logs = []
    if subject_ids:
        logs = AttendanceLog.query.filter(
            AttendanceLog.student_id == stu.id,
            AttendanceLog.date == today,
            AttendanceLog.subject_id.in_(subject_ids),
        ).all()

    log_index = {lg.subject_id: lg for lg in logs}
    now_time = dt_cls2.utcnow().strftime('%H:%M')

    periods = []
    for sched in schedules:
        slot = sched.time_slot
        subj = sched.subject
        lg = log_index.get(sched.subject_id)
        teacher = sched.teacher

        is_active = False
        is_past = False
        if slot:
            is_active = slot.start_time <= now_time <= slot.end_time
            is_past   = slot.end_time < now_time

        periods.append({
            'schedule_id':  sched.id,
            'slot_label':   slot.label if slot else '',
            'start_time':   slot.start_time if slot else '',
            'end_time':     slot.end_time if slot else '',
            'is_active':    is_active,
            'is_past':      is_past,
            'subject': {
                'id':   subj.id if subj else None,
                'name': subj.name if subj else '?',
                'code': subj.code if subj else '',
            } if subj else None,
            'teacher': {
                'name':   teacher.user.name if teacher and teacher.user else '?',
                'emp_id': teacher.employee_id if teacher else '',
            } if teacher else None,
            'attendance': {
                'id':        lg.id,
                'status':    lg.status,
                'marked_by': lg.marked_by,
                'time':      str(lg.time) if lg.time else None,
            } if lg else None,
        })

    return jsonify({
        'date':       today.isoformat(),
        'day':        day_name,
        'is_weekend': is_weekend,
        'periods':    periods,
    }), 200


@bp.route('/my-monthly-grid', methods=['GET'])
@token_required
def my_monthly_grid(current_user):
    """
    Student: Get monthly attendance grid.

    GET /api/attendance/my-monthly-grid?year=YYYY&month=MM

    Returns a grid: rows = subjects (scheduled for student's section),
    columns = each calendar day of the month.
    Cell values: 'present' | 'absent' | 'late' | null (no class).
    """
    import calendar
    from datetime import datetime as dt_cls2
    from ..models import Schedule

    if current_user.role != 'student':
        return jsonify({'message': 'Only students can access this endpoint'}), 403

    stu = Student.query.filter_by(user_id=current_user.id).first()
    if not stu:
        return jsonify({'message': 'Student profile not found'}), 404

    today = date_cls.today()
    try:
        year  = int(request.args.get('year',  today.year))
        month = int(request.args.get('month', today.month))
    except (ValueError, TypeError):
        year, month = today.year, today.month

    # All days in this month
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [date_cls(year, month, d) for d in range(1, days_in_month + 1)]

    # Get all scheduled subjects for student's section (across all days)
    schedules = Schedule.query.filter_by(section_id=stu.section_id).all()

    # subject_id → {day_of_week → slot_label}
    subj_days: dict = {}
    for sched in schedules:
        sid = sched.subject_id
        if sid not in subj_days:
            subj_days[sid] = {
                'subject_id':   sid,
                'subject_name': sched.subject.name if sched.subject else '?',
                'subject_code': sched.subject.code if sched.subject else '',
                'slot_label':   sched.time_slot.label if sched.time_slot else '',
                'scheduled_days': set(),
            }
        subj_days[sid]['scheduled_days'].add(sched.day_of_week)

    # Fetch all attendance logs for student in this month
    month_start = date_cls(year, month, 1)
    month_end   = date_cls(year, month, days_in_month)
    logs = AttendanceLog.query.filter(
        AttendanceLog.student_id == stu.id,
        AttendanceLog.date >= month_start,
        AttendanceLog.date <= month_end,
    ).all()

    # Index: (subject_id, date_isoformat) → status
    log_index: dict = {(lg.subject_id, lg.date.isoformat()): lg.status for lg in logs}

    # Build grid rows
    rows = []
    for sid, info in sorted(subj_days.items(), key=lambda x: x[1]['slot_label']):
        scheduled_days = info['scheduled_days']  # set of day_of_week ints
        day_cells: dict = {}
        for d in all_dates:
            if d > today:
                day_cells[d.isoformat()] = 'future'
            elif d.weekday() in scheduled_days:
                status = log_index.get((sid, d.isoformat()))
                day_cells[d.isoformat()] = status if status else 'absent'
            else:
                day_cells[d.isoformat()] = None  # no class
        rows.append({
            'subject_id':   sid,
            'subject_name': info['subject_name'],
            'subject_code': info['subject_code'],
            'slot_label':   info['slot_label'],
            'days':         day_cells,
        })

    # Summary
    present_count = sum(1 for lg in logs if lg.status == 'present')
    late_count    = sum(1 for lg in logs if lg.status == 'late')
    absent_count  = sum(1 for lg in logs if lg.status == 'absent')
    total_count   = len(logs)

    return jsonify({
        'year':    year,
        'month':   month,
        'days':    [d.isoformat() for d in all_dates],
        'rows':    rows,
        'summary': {
            'present': present_count,
            'late':    late_count,
            'absent':  absent_count,
            'total':   total_count,
            'rate':    round((present_count + late_count) / total_count * 100, 1) if total_count else 0.0,
        },
    }), 200
