"""
Teachers Routes — Admin panel: list all teachers with their assigned classes.
GET  /api/teachers          — all teachers with schedule summary
GET  /api/teachers/<id>     — full details for one teacher (by teacher_profile.id)
"""
from flask import Blueprint, jsonify, request
from ..models import db, User
from .auth import token_required, admin_required

bp = Blueprint('teachers', __name__)


def _teacher_dict(tp, include_schedule: bool = False):
    """Build a teacher dict from a TeacherProfile ORM object."""
    from ..models import Schedule

    user = tp.user
    data = {
        'id':           tp.id,
        'user_id':      tp.user_id,
        'employee_id':  tp.employee_id,
        'name':         user.name if user else '?',
        'email':        user.email if user else '',
        'username':     user.username if user else '',
        'department':   tp.department,
        'qualification': tp.qualification,
        'specialization': tp.specialization,
        'joining_date': str(tp.joining_date) if tp.joining_date else None,
        'branch_id':    tp.branch_id,
        'branch_code':  tp.branch.code if tp.branch else '?',
        'branch_name':  tp.branch.name if tp.branch else '?',
        # System default password (generated at seed time; admin can reset)
        'default_password': 'Teacher@2024',
    }

    if include_schedule:
        schedules = Schedule.query.filter_by(teacher_id=tp.id).all()
        # Unique sections
        sections_map: dict = {}
        subjects_map: dict = {}
        for s in schedules:
            if s.section and s.section_id not in sections_map:
                sec = s.section
                sections_map[s.section_id] = {
                    'id':       sec.id,
                    'name':     sec.name,
                    'display':  f"{sec.branch.code if sec.branch else '?'}-{sec.name}",
                    'semester': sec.current_semester,
                }
            if s.subject and s.subject_id not in subjects_map:
                subjects_map[s.subject_id] = {
                    'id':   s.subject.id,
                    'name': s.subject.name,
                    'code': s.subject.code,
                }
        data['sections']     = list(sections_map.values())
        data['subjects']     = list(subjects_map.values())
        data['total_classes_per_week'] = len(schedules)

        # Attendance stats (last 30 days)
        from datetime import date, timedelta
        from ..models import AttendanceLog, Student
        import sqlalchemy as sa
        today     = date.today()
        from_date = today - timedelta(days=29)
        subj_ids  = list(subjects_map.keys())
        if subj_ids:
            stats = db.session.execute(
                sa.select(AttendanceLog.status, sa.func.count(AttendanceLog.id))
                .where(
                    AttendanceLog.subject_id.in_(subj_ids),
                    AttendanceLog.date >= from_date,
                )
                .group_by(AttendanceLog.status)
            ).all()
            counts = {r[0]: r[1] for r in stats}
            total  = sum(counts.values())
            data['stats_30d'] = {
                'present': counts.get('present', 0),
                'absent':  counts.get('absent', 0),
                'total':   total,
                'rate':    round(counts.get('present', 0) / total * 100, 1) if total else 0.0,
            }
        else:
            data['stats_30d'] = {'present': 0, 'absent': 0, 'total': 0, 'rate': 0.0}

    return data


@bp.route('', methods=['GET'])
@token_required
def list_teachers(current_user):
    """
    GET /api/teachers
    Returns all teachers with their branch, sections, and subjects.
    Accessible by admin and teacher roles.
    """
    from ..models import TeacherProfile

    search = request.args.get('search', '').strip()
    branch_id = request.args.get('branch_id', type=int)

    q = TeacherProfile.query.join(TeacherProfile.user)
    if branch_id:
        q = q.filter(TeacherProfile.branch_id == branch_id)
    if search:
        q = q.filter(User.name.ilike(f'%{search}%') | TeacherProfile.employee_id.ilike(f'%{search}%'))

    teachers = q.order_by(TeacherProfile.employee_id).all()

    return jsonify({
        'teachers': [_teacher_dict(t, include_schedule=True) for t in teachers],
        'count':    len(teachers),
    }), 200


@bp.route('/<int:teacher_id>', methods=['GET'])
@token_required
def get_teacher(current_user, teacher_id: int):
    """Full detail for one teacher."""
    from ..models import TeacherProfile
    tp = TeacherProfile.query.get(teacher_id)
    if not tp:
        return jsonify({'message': 'Teacher not found'}), 404
    return jsonify(_teacher_dict(tp, include_schedule=True)), 200


@bp.route('/student/<int:student_id>/detail', methods=['GET'])
@admin_required
def student_detail(current_user, student_id: int):
    """
    Admin: Full details for one student including attendance summary.
    Returns the student's default password (set at registration).
    """
    from ..models import Student, AttendanceLog
    import sqlalchemy as sa
    from datetime import date, timedelta

    stu = Student.query.get(student_id)
    if not stu:
        return jsonify({'message': 'Student not found'}), 404

    data = stu.to_dict()
    data['section_display'] = (
        f"{stu.branch.code if stu.branch else '?'}-{stu.section}"
    )
    data['college_name'] = stu.college or 'Trident Academy of Technology'
    data['academic_year_label'] = f"Year {(stu.current_semester or 1 + 1) // 2}"
    # Default password (set at seed; admin knows this)
    data['default_password'] = 'Stud@2024'

    # Attendance summary (full history)
    today = date.today()
    from_date = date(today.year if today.month >= 7 else today.year - 1,
                     7 if today.month >= 7 else 1, 1)
    stats = db.session.execute(
        sa.select(AttendanceLog.status, sa.func.count(AttendanceLog.id))
        .where(
            AttendanceLog.student_id == stu.id,
            AttendanceLog.date >= from_date,
        )
        .group_by(AttendanceLog.status)
    ).all()
    counts = {r[0]: r[1] for r in stats}
    total  = sum(counts.values())
    data['attendance_summary'] = {
        'present':     counts.get('present', 0),
        'absent':      counts.get('absent', 0),
        'late':        counts.get('late', 0),
        'total':       total,
        'percentage':  round(counts.get('present', 0) / total * 100, 1) if total else 0.0,
    }

    return jsonify(data), 200
