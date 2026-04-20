"""
Notifications Routes
"""
from flask import Blueprint, request, jsonify
from ..models import db, Notification, Student
from .auth import token_required
from .. import socketio

bp = Blueprint('notifications', __name__)


@bp.route('/<int:student_id>', methods=['GET'])
@token_required
def get_notifications(current_user, student_id):
    """Get notifications for a student"""
    try:
        # Students can only see their own notifications
        if current_user.role == 'student':
            student = Student.query.filter_by(user_id=current_user.id).first()
            if not student or student.id != student_id:
                return jsonify({'message': 'Unauthorized'}), 403

        # Get query parameters
        unread_only = request.args.get('unread', 'false').lower() == 'true'
        limit = int(request.args.get('limit', 50))

        # Build query
        query = Notification.query.filter_by(student_id=student_id)

        if unread_only:
            query = query.filter_by(read_status=False)

        notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()

        return jsonify({
            'notifications': [notif.to_dict() for notif in notifications],
            'count': len(notifications)
        }), 200

    except Exception as e:
        return jsonify({'message': f'Failed to fetch notifications: {str(e)}'}), 500


@bp.route('', methods=['POST'])
@token_required
def send_notification(current_user):
    """Send a notification to a student (teachers only)"""
    try:
        if current_user.role != 'teacher':
            return jsonify({'message': 'Only teachers can send notifications'}), 403

        data = request.get_json()

        # Validate required fields
        required_fields = ['student_id', 'message', 'type']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'message': f'{field} is required'}), 400

        # Validate notification type
        valid_types = ['warning', 'info', 'alert', 'success']
        if data['type'] not in valid_types:
            return jsonify({'message': f'Invalid type. Must be one of: {", ".join(valid_types)}'}), 400

        # Check if student exists
        student = Student.query.get(data['student_id'])
        if not student:
            return jsonify({'message': 'Student not found'}), 404

        # Create notification
        notification = Notification(
            student_id=data['student_id'],
            message=data['message'],
            type=data['type']
        )

        db.session.add(notification)
        db.session.commit()

        # Broadcast via WebSocket
        if hasattr(socketio, 'broadcast_notification'):
            socketio.broadcast_notification({
                'notification': notification.to_dict(),
                'student_id': student.id
            })

        return jsonify({
            'message': 'Notification sent successfully',
            'notification': notification.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to send notification: {str(e)}'}), 500


@bp.route('/bulk', methods=['POST'])
@token_required
def send_bulk_notifications(current_user):
    """Send notifications to multiple students (teachers only)"""
    try:
        if current_user.role != 'teacher':
            return jsonify({'message': 'Only teachers can send notifications'}), 403

        data = request.get_json()

        # Validate required fields
        required_fields = ['student_ids', 'message', 'type']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'{field} is required'}), 400

        # Validate notification type
        valid_types = ['warning', 'info', 'alert', 'success']
        if data['type'] not in valid_types:
            return jsonify({'message': f'Invalid type. Must be one of: {", ".join(valid_types)}'}), 400

        student_ids = data['student_ids']
        notifications_created = []

        for student_id in student_ids:
            # Check if student exists
            student = Student.query.get(student_id)
            if not student:
                continue

            # Create notification
            notification = Notification(
                student_id=student_id,
                message=data['message'],
                type=data['type']
            )

            db.session.add(notification)
            notifications_created.append(notification)

        db.session.commit()

        # Broadcast via WebSocket
        if hasattr(socketio, 'broadcast_notification'):
            for notif in notifications_created:
                socketio.broadcast_notification({
                    'notification': notif.to_dict(),
                    'student_id': notif.student_id
                })

        return jsonify({
            'message': f'Sent {len(notifications_created)} notifications',
            'count': len(notifications_created)
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to send notifications: {str(e)}'}), 500


@bp.route('/<int:notification_id>/read', methods=['PUT'])
@token_required
def mark_as_read(current_user, notification_id):
    """Mark a notification as read"""
    try:
        notification = Notification.query.get(notification_id)

        if not notification:
            return jsonify({'message': 'Notification not found'}), 404

        # Students can only mark their own notifications
        if current_user.role == 'student':
            student = Student.query.filter_by(user_id=current_user.id).first()
            if not student or student.id != notification.student_id:
                return jsonify({'message': 'Unauthorized'}), 403

        notification.mark_as_read()

        return jsonify({
            'message': 'Notification marked as read',
            'notification': notification.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to mark notification: {str(e)}'}), 500


@bp.route('/student/<int:student_id>/unread_count', methods=['GET'])
@token_required
def get_unread_count(current_user, student_id):
    """Get count of unread notifications"""
    try:
        # Students can only see their own count
        if current_user.role == 'student':
            student = Student.query.filter_by(user_id=current_user.id).first()
            if not student or student.id != student_id:
                return jsonify({'message': 'Unauthorized'}), 403

        count = Notification.query.filter_by(
            student_id=student_id,
            read_status=False
        ).count()

        return jsonify({'unread_count': count}), 200

    except Exception as e:
        return jsonify({'message': f'Failed to get unread count: {str(e)}'}), 500
