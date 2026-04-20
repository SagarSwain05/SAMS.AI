"""
Subjects/Courses Routes
"""
from flask import Blueprint, request, jsonify
from ..models import db, Subject
from .auth import token_required

bp = Blueprint('subjects', __name__)


@bp.route('', methods=['GET'])
@token_required
def get_subjects(current_user):
    """Get all subjects with optional filters"""
    try:
        # Get query parameters
        class_name = request.args.get('class')
        section = request.args.get('section')

        # Build query
        query = Subject.query

        if class_name:
            query = query.filter_by(class_name=class_name)

        if section:
            query = query.filter_by(section=section)

        subjects = query.all()

        return jsonify({
            'subjects': [subject.to_dict() for subject in subjects],
            'count': len(subjects)
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to fetch subjects: {str(e)}'}), 500


@bp.route('/<int:subject_id>', methods=['GET'])
@token_required
def get_subject(current_user, subject_id):
    """Get a specific subject by ID"""
    try:
        subject = Subject.query.get(subject_id)

        if not subject:
            return jsonify({'message': 'Subject not found'}), 404

        return jsonify(subject.to_dict()), 200

    except Exception as e:
        return jsonify({'message': f'Failed to fetch subject: {str(e)}'}), 500


@bp.route('', methods=['POST'])
@token_required
def create_subject(current_user):
    """Create a new subject (teachers only)"""
    try:
        if current_user.role != 'teacher':
            return jsonify({'message': 'Only teachers can create subjects'}), 403

        data = request.get_json()

        # Validate required fields
        required_fields = ['name', 'code', 'class_name', 'section']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'message': f'{field} is required'}), 400

        # Check if subject code already exists
        existing = Subject.query.filter_by(code=data['code']).first()
        if existing:
            return jsonify({'message': 'Subject code already exists'}), 409

        # Create new subject
        subject = Subject(
            name=data['name'],
            code=data['code'],
            class_name=data['class_name'],
            section=data['section'],
            description=data.get('description')
        )

        db.session.add(subject)
        db.session.commit()

        return jsonify({
            'message': 'Subject created successfully',
            'subject': subject.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to create subject: {str(e)}'}), 500


@bp.route('/<int:subject_id>', methods=['PUT'])
@token_required
def update_subject(current_user, subject_id):
    """Update a subject (teachers only)"""
    try:
        if current_user.role != 'teacher':
            return jsonify({'message': 'Only teachers can update subjects'}), 403

        subject = Subject.query.get(subject_id)

        if not subject:
            return jsonify({'message': 'Subject not found'}), 404

        data = request.get_json()

        # Update fields
        if 'name' in data:
            subject.name = data['name']
        if 'code' in data:
            # Check if new code already exists
            existing = Subject.query.filter(Subject.code == data['code'], Subject.id != subject_id).first()
            if existing:
                return jsonify({'message': 'Subject code already exists'}), 409
            subject.code = data['code']
        if 'class_name' in data:
            subject.class_name = data['class_name']
        if 'section' in data:
            subject.section = data['section']
        if 'description' in data:
            subject.description = data['description']

        db.session.commit()

        return jsonify({
            'message': 'Subject updated successfully',
            'subject': subject.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to update subject: {str(e)}'}), 500


@bp.route('/<int:subject_id>', methods=['DELETE'])
@token_required
def delete_subject(current_user, subject_id):
    """Delete a subject (teachers only)"""
    try:
        if current_user.role != 'teacher':
            return jsonify({'message': 'Only teachers can delete subjects'}), 403

        subject = Subject.query.get(subject_id)

        if not subject:
            return jsonify({'message': 'Subject not found'}), 404

        db.session.delete(subject)
        db.session.commit()

        return jsonify({
            'message': 'Subject deleted successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to delete subject: {str(e)}'}), 500
