"""
Users / Branches / Sections Routes  (Admin only)
================================================
GET  /api/branches               — list all branches
GET  /api/sections               — list all sections (optionally ?branch_id=)
POST /api/users/create-student   — admin creates student
POST /api/users/create-teacher   — admin creates teacher
GET  /api/users                  — list all users (admin)
DELETE /api/users/<id>           — delete user (admin)
"""
from flask import Blueprint, request, jsonify
from ..models import db, User, Student, Branch, Section, TeacherProfile
from .auth import admin_required, token_required
import re

bp_branches = Blueprint('branches', __name__)
bp_sections = Blueprint('sections', __name__)
bp_users    = Blueprint('users_mgmt', __name__)


# ─────────────────────────────────────────────────────────────────────────────
# Branches
# ─────────────────────────────────────────────────────────────────────────────

@bp_branches.route('', methods=['GET'])
@token_required
def list_branches(current_user):
    branches = Branch.query.order_by(Branch.name).all()
    return jsonify([{
        'id':   b.id,
        'name': b.name,
        'code': b.code,
        'total_semesters': b.total_semesters,
    } for b in branches]), 200


# ─────────────────────────────────────────────────────────────────────────────
# Sections
# ─────────────────────────────────────────────────────────────────────────────

@bp_sections.route('', methods=['GET'])
@token_required
def list_sections(current_user):
    branch_id = request.args.get('branch_id', type=int)
    q = Section.query
    if branch_id:
        q = q.filter_by(branch_id=branch_id)
    sections = q.order_by(Section.global_index).all()
    return jsonify([{
        'id':         s.id,
        'name':       s.name,
        'branch_id':  s.branch_id,
        'branch_code': s.branch.code if s.branch else '',
        'branch_name': s.branch.name if s.branch else '',
        'current_semester': s.current_semester,
        'capacity':   s.capacity,
        'display':    f"{s.branch.code if s.branch else '?'} — Section {s.name}",
    } for s in sections]), 200


# ─────────────────────────────────────────────────────────────────────────────
# User Management
# ─────────────────────────────────────────────────────────────────────────────

@bp_users.route('', methods=['GET'])
@admin_required
def list_users(current_user):
    """List all users with their role details."""
    role = request.args.get('role')    # optional filter
    search = request.args.get('search', '')
    q = User.query
    if role:
        q = q.filter_by(role=role)
    if search:
        q = q.filter(User.name.ilike(f'%{search}%') | User.username.ilike(f'%{search}%'))
    users = q.order_by(User.role, User.name).limit(200).all()
    result = []
    for u in users:
        d = {'id': u.id, 'username': u.username, 'name': u.name,
             'email': u.email, 'role': u.role, 'created_at': u.created_at.isoformat() if u.created_at else None}
        if u.role == 'student' and u.student:
            s = u.student
            d['student'] = {
                'id': s.id,
                'roll_number': s.roll_number,
                'section': s.section,
                'department': s.department,
                'branch_id': s.branch_id,
                'section_id': s.section_id,
            }
        elif u.role == 'teacher':
            t = TeacherProfile.query.filter_by(user_id=u.id).first()
            if t:
                d['teacher'] = {
                    'id': t.id,
                    'employee_id': t.employee_id,
                    'department': t.department,
                    'branch_id': t.branch_id,
                }
        result.append(d)
    return jsonify({'users': result, 'count': len(result)}), 200


@bp_users.route('/create-student', methods=['POST'])
@admin_required
def create_student(current_user):
    """Admin creates a new student account."""
    data = request.get_json() or {}

    required = ['name', 'email', 'roll_number', 'reg_number', 'branch_id', 'section_id']
    for f in required:
        if not data.get(f):
            return jsonify({'message': f'{f} is required'}), 400

    # Duplicate checks
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already registered'}), 409
    username = data['roll_number'].lower()
    if User.query.filter_by(username=username).first():
        return jsonify({'message': f'Username {username} already exists'}), 409
    if Student.query.filter_by(roll_number=data['roll_number']).first():
        return jsonify({'message': 'Roll number already registered'}), 409

    # Resolve branch/section
    branch  = db.session.get(Branch, data['branch_id'])
    section = db.session.get(Section, data['section_id'])
    if not branch or not section:
        return jsonify({'message': 'Invalid branch_id or section_id'}), 400

    password = data.get('password', 'Stud@2024')

    user = User(
        username=username,
        password=password,
        role='student',
        name=data['name'],
        email=data['email'],
    )
    db.session.add(user)
    db.session.flush()

    student = Student(
        user_id=user.id,
        roll_number=data['roll_number'],
        reg_number=data['reg_number'],
        department=data.get('department', branch.name),
        college=data.get('college', 'College'),
        class_name=branch.code,
        section=section.name,
        branch_id=branch.id,
        section_id=section.id,
        current_semester=data.get('semester', section.current_semester),
        contact=data.get('contact'),
    )
    db.session.add(student)
    db.session.flush()

    # Enroll face images via V2 pipeline if provided
    face_count = 0
    face_images_b64 = data.get('face_images', [])
    if face_images_b64:
        try:
            from ..ml.face_recognition_v2 import get_pipeline
            pipeline = get_pipeline()
            import base64, numpy as np, cv2
            for b64 in face_images_b64[:10]:
                try:
                    if ',' in b64:
                        b64 = b64.split(',', 1)[1]
                    raw = base64.b64decode(b64)
                    arr = np.frombuffer(raw, np.uint8)
                    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if img is not None:
                        res = pipeline.enroll_student(student.id, img, save_to_db=True)
                        if res.get('success'):
                            face_count += 1
                except Exception:
                    pass
        except Exception as ex:
            print(f"[create_student] Face enrollment skipped: {ex}")

    db.session.commit()

    return jsonify({
        'message': f'Student created successfully',
        'student_id': student.id,
        'user_id': user.id,
        'username': username,
        'password': password,
        'faces_enrolled': face_count,
    }), 201


@bp_users.route('/create-teacher', methods=['POST'])
@admin_required
def create_teacher(current_user):
    """Admin creates a new teacher account."""
    data = request.get_json() or {}

    required = ['name', 'email', 'employee_id', 'branch_id', 'department']
    for f in required:
        if not data.get(f):
            return jsonify({'message': f'{f} is required'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already registered'}), 409

    # Username from employee_id (lowercase)
    username = data['employee_id'].lower()
    if User.query.filter_by(username=username).first():
        return jsonify({'message': f'Username {username} already exists'}), 409

    if TeacherProfile.query.filter_by(employee_id=data['employee_id'].upper()).first():
        return jsonify({'message': 'Employee ID already exists'}), 409

    branch = db.session.get(Branch, data['branch_id'])
    if not branch:
        return jsonify({'message': 'Invalid branch_id'}), 400

    password = data.get('password', 'Teacher@2024')

    user = User(
        username=username,
        password=password,
        role='teacher',
        name=data['name'],
        email=data['email'],
    )
    db.session.add(user)
    db.session.flush()

    teacher = TeacherProfile(
        user_id=user.id,
        employee_id=data['employee_id'].upper(),
        branch_id=branch.id,
        department=data['department'],
        qualification=data.get('qualification', ''),
        specialization=data.get('specialization', ''),
    )
    db.session.add(teacher)
    db.session.commit()

    return jsonify({
        'message': 'Teacher created successfully',
        'teacher_id': teacher.id,
        'user_id': user.id,
        'username': username,
        'password': password,
    }), 201


@bp_users.route('/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(current_user, user_id):
    """Delete a user (and cascade student/teacher profile)."""
    if user_id == current_user.id:
        return jsonify({'message': 'Cannot delete yourself'}), 400
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': f'User {user.username} deleted'}), 200


@bp_users.route('/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(current_user, user_id):
    """Update basic user info / reset password."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    data = request.get_json() or {}
    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        user.email = data['email']
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    db.session.commit()
    return jsonify({'message': 'User updated', 'user_id': user_id}), 200
