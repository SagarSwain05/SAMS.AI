"""
Notification model
"""
from datetime import datetime
from . import db


class Notification(db.Model):
    """Notification/Alert model for students"""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=True)  # Optional title for the notification
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'warning', 'info', 'alert', 'success', 'approval_request'
    read_status = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    student = db.relationship('Student', back_populates='notifications')

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'student_id': self.student_id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'read_status': self.read_status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def mark_as_read(self):
        """Mark notification as read"""
        self.read_status = True
        db.session.commit()

    def __repr__(self):
        return f'<Notification {self.id} - {self.type}>'
