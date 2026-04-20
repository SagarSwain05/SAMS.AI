"""
Students Routes
"""
from flask import Blueprint, request, jsonify, current_app
from ..models import db, User, Student
from .auth import token_required, admin_required
import bcrypt
import base64
import cv2
import numpy as np

bp = Blueprint('students', __name__)


@bp.route('', methods=['GET'])
@token_required
def get_students(current_user):
    """Get all students with optional filters"""
    try:
        # Get query parameters
        section = request.args.get('section')
        class_name = request.args.get('class')
        search = request.args.get('search')

        # Build query
        query = Student.query

        if section:
            query = query.filter_by(section=section)

        if class_name:
            query = query.filter_by(class_name=class_name)

        if search:
            # Search by name, roll number, or reg number
            query = query.join(User).filter(
                (User.name.ilike(f'%{search}%')) |
                (Student.roll_number.ilike(f'%{search}%')) |
                (Student.reg_number.ilike(f'%{search}%'))
            )

        students = query.all()

        return jsonify({
            'students': [student.to_dict() for student in students],
            'count': len(students)
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to fetch students: {str(e)}'}), 500


@bp.route('/<int:student_id>', methods=['GET'])
@token_required
def get_student(current_user, student_id):
    """Get a specific student by ID"""
    try:
        student = Student.query.get(student_id)

        if not student:
            return jsonify({'message': 'Student not found'}), 404

        return jsonify(student.to_dict()), 200

    except Exception as e:
        return jsonify({'message': f'Failed to fetch student: {str(e)}'}), 500


@bp.route('/my-profile', methods=['GET'])
@token_required
def my_profile(current_user):
    """
    Student: Get own full profile including branch, section, semester details.
    """
    if current_user.role != 'student':
        return jsonify({'message': 'Only students can access this endpoint'}), 403

    stu = Student.query.filter_by(user_id=current_user.id).first()
    if not stu:
        return jsonify({'message': 'Student profile not found'}), 404

    data = stu.to_dict()
    # Enrich with section details
    if stu.section_ref:
        data['section_display'] = f"{stu.branch.code if stu.branch else '?'}-{stu.section}"
        data['section_id'] = stu.section_id
        data['room_number'] = stu.section_ref.room_number
    if stu.branch:
        data['branch_full_name'] = stu.branch.name
        data['total_semesters'] = stu.branch.total_semesters
    # Academic year derived from current semester
    sem = stu.current_semester or 1
    year = (sem + 1) // 2
    data['academic_year_label'] = f"Year {year}"
    data['college_name'] = stu.college or 'Trident Academy of Technology'

    return jsonify(data), 200


@bp.route('/my-schedule', methods=['GET'])
@token_required
def my_schedule(current_user):
    """
    Student: Get today's schedule for the student's section.
    """
    from ..models import Schedule, TimeSlot, Section
    from datetime import datetime

    if current_user.role != 'student':
        return jsonify({'message': 'Only students can access this endpoint'}), 403

    stu = Student.query.filter_by(user_id=current_user.id).first()
    if not stu or not stu.section_id:
        return jsonify({'message': 'Student profile or section not found'}), 404

    now = datetime.now()
    day = now.weekday()
    current_hm = now.strftime('%H:%M')

    if day > 4:
        return jsonify({
            'is_weekend': True,
            'day': 'Weekend',
            'section_id': stu.section_id,
            'display': f"{stu.branch.code if stu.branch else '?'}-{stu.section}",
            'periods': [],
        }), 200

    slots = TimeSlot.query.filter_by(is_break=False).order_by(TimeSlot.slot_number).all()
    schedules = Schedule.query.filter_by(section_id=stu.section_id, day_of_week=day).all()
    sched_index = {s.time_slot_id: s for s in schedules}

    periods = []
    for slot in slots:
        sched = sched_index.get(slot.id)
        is_active = slot.start_time <= current_hm <= slot.end_time
        is_past   = slot.end_time < current_hm
        periods.append({
            'slot_number': slot.slot_number,
            'label':       slot.label,
            'start_time':  slot.start_time,
            'end_time':    slot.end_time,
            'is_active':   is_active,
            'is_past':     is_past,
            'subject': {
                'id':   sched.subject_id,
                'name': sched.subject.name if sched.subject else '—',
                'code': sched.subject.code if sched.subject else '',
            } if sched else None,
            'teacher': {
                'name': sched.teacher.user.name if sched and sched.teacher and sched.teacher.user else '—',
                'emp_id': sched.teacher.employee_id if sched and sched.teacher else '',
            } if sched else None,
            'room': sched.room_number if sched else None,
        })

    return jsonify({
        'is_weekend': False,
        'day': ['Monday','Tuesday','Wednesday','Thursday','Friday'][day],
        'section_id': stu.section_id,
        'display': f"{stu.branch.code if stu.branch else '?'}-{stu.section}",
        'current_semester': stu.current_semester,
        'periods': periods,
    }), 200


@bp.route('/my-students', methods=['GET'])
@token_required
def my_students(current_user):
    """
    Teacher: Get all students in sections the teacher is assigned to.
    Optionally filter by ?section_id= or ?subject_id=
    """
    from ..models import Schedule, TeacherProfile

    if current_user.role != 'teacher':
        return jsonify({'message': 'Only teachers can access this endpoint'}), 403

    tp = TeacherProfile.query.filter_by(user_id=current_user.id).first()
    if not tp:
        return jsonify({'message': 'Teacher profile not found'}), 404

    # Get all sections this teacher teaches
    schedules = Schedule.query.filter_by(teacher_id=tp.id).all()
    my_section_ids = list({s.section_id for s in schedules})
    my_subject_ids = list({s.subject_id for s in schedules})

    section_id_filter = request.args.get('section_id', type=int)
    subject_id_filter = request.args.get('subject_id', type=int)

    query = Student.query
    if section_id_filter and section_id_filter in my_section_ids:
        query = query.filter_by(section_id=section_id_filter)
    elif section_id_filter:
        return jsonify({'message': 'You are not assigned to that section'}), 403
    else:
        query = query.filter(Student.section_id.in_(my_section_ids))

    students = query.order_by(Student.roll_number).all()

    return jsonify({
        'students':       [s.to_dict() for s in students],
        'count':          len(students),
        'my_section_ids': my_section_ids,
        'my_subject_ids': my_subject_ids,
    }), 200


@bp.route('/register', methods=['POST'])
@admin_required
def register_student(current_user):
    """Register a new student with face data (admin only)"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'message': 'No data provided'}), 400

        # Required fields
        required_fields = ['name', 'email', 'roll_number', 'reg_number', 'department', 'college', 'section']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'{field} is required'}), 400

        # Check if user already exists
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            return jsonify({'message': 'Email already registered'}), 409

        existing_student = Student.query.filter_by(roll_number=data['roll_number']).first()
        if existing_student:
            return jsonify({'message': 'Roll number already registered'}), 409

        existing_reg = Student.query.filter_by(reg_number=data['reg_number']).first()
        if existing_reg:
            return jsonify({'message': 'Registration number already registered'}), 409

        # Generate username from roll number (lowercase)
        username = data['roll_number'].lower()

        # Check if username already exists
        existing_username = User.query.filter_by(username=username).first()
        if existing_username:
            return jsonify({'message': 'Username already exists'}), 409

        # Default password (should be changed on first login)
        default_password = data.get('password', 'student123')

        # Create user account
        user = User(
            username=username,
            password=default_password,
            role='student',
            name=data['name'],
            email=data['email']
        )

        db.session.add(user)
        db.session.flush()  # Get user ID

        # Create student record
        student = Student(
            user_id=user.id,
            roll_number=data['roll_number'],
            reg_number=data['reg_number'],
            department=data['department'],
            college=data['college'],
            section=data['section'],
            class_name=data.get('class_name', 'Final Year'),
            contact=data.get('contact')
        )

        db.session.add(student)
        db.session.flush()  # Get student ID

        # Process face images if provided
        face_images_saved = 0
        if 'face_images' in data and data['face_images']:
            from ..ml.face_detector import get_face_detector
            from ..ml.model_trainer import get_model_trainer

            detector = get_face_detector()
            trainer = get_model_trainer()

            face_images = []

            # Process each base64 image
            for idx, image_data in enumerate(data['face_images']):
                try:
                    # Remove data URL prefix if present
                    if ',' in image_data:
                        image_data = image_data.split(',')[1]

                    # Decode base64
                    image_bytes = base64.b64decode(image_data)
                    nparr = np.frombuffer(image_bytes, np.uint8)
                    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                    if image is None:
                        continue

                    # Detect face
                    faces = detector.detect_faces(image)
                    if len(faces) != 1:
                        continue  # Skip images with 0 or multiple faces

                    # Extract face ROI
                    face_roi = detector.extract_face_roi(image, faces[0])

                    # Check quality
                    is_good, _ = detector.is_face_quality_good(face_roi)
                    if not is_good:
                        continue

                    face_images.append(face_roi)

                except Exception as e:
                    print(f"Error processing face image {idx}: {e}")
                    continue

            # Save face images
            if face_images:
                saved_count, saved_paths = trainer.save_face_images(student.id, face_images)
                face_images_saved = saved_count

                # Train/update model if we have enough images
                if saved_count >= 3:
                    try:
                        result = trainer.add_student_to_model(student.id, face_images)
                        print(f"Model updated for student {student.id}: {result}")
                    except Exception as e:
                        print(f"Warning: Failed to update model: {e}")

        db.session.commit()

        return jsonify({
            'message': 'Student registered successfully',
            'student': student.to_dict(),
            'username': username,
            'password': default_password,
            'faces_enrolled': face_images_saved,
            'face_images_saved': face_images_saved,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Registration failed: {str(e)}'}), 500


@bp.route('/<int:student_id>', methods=['PUT'])
@admin_required
def update_student(current_user, student_id):
    """Update student information (admin only)"""
    try:

        student = Student.query.get(student_id)

        if not student:
            return jsonify({'message': 'Student not found'}), 404

        data = request.get_json()

        # Update allowed fields
        if 'contact' in data:
            student.contact = data['contact']
        if 'department' in data:
            student.department = data['department']
        if 'section' in data:
            student.section = data['section']

        db.session.commit()

        return jsonify({
            'message': 'Student updated successfully',
            'student': student.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to update student: {str(e)}'}), 500


@bp.route('/<int:student_id>', methods=['DELETE'])
@admin_required
def delete_student(current_user, student_id):
    """Delete a student (admin only)"""
    try:

        student = Student.query.get(student_id)

        if not student:
            return jsonify({'message': 'Student not found'}), 404

        # Delete associated user
        user = student.user
        db.session.delete(student)
        if user:
            db.session.delete(user)

        db.session.commit()

        return jsonify({'message': 'Student deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to delete student: {str(e)}'}), 500
