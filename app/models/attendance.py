"""
Attendance Log model
"""
from datetime import datetime, date
from . import db


class AttendanceLog(db.Model):
    """Attendance record model"""
    __tablename__ = 'attendance_logs'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    time = db.Column(db.Time, nullable=False, default=datetime.utcnow().time)
    status = db.Column(db.String(20), nullable=False)  # 'present', 'absent', 'late'
    confidence_score = db.Column(db.Float, nullable=True)  # Face recognition confidence (0-1)
    marked_by = db.Column(db.String(20), nullable=False, default='auto')  # 'auto' or 'manual'
    entry_time = db.Column(db.String(10), nullable=True)  # e.g., "09:30 AM"
    exit_time = db.Column(db.String(10), nullable=True)  # e.g., "11:30 AM"
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student = db.relationship('Student', back_populates='attendance_logs')
    subject = db.relationship('Subject', back_populates='attendance_logs')

    # Composite index for efficient queries
    __table_args__ = (
        db.Index('idx_student_date_subject', 'student_id', 'date', 'subject_id'),
    )

    def to_dict(self, include_student=False, include_subject=False):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'student_id': self.student_id,
            'subject_id': self.subject_id,
            'date': self.date.isoformat() if self.date else None,
            'time': self.time.isoformat() if self.time else None,
            'status': self.status,
            'confidence_score': self.confidence_score,
            'marked_by': self.marked_by,
            'entry_time': self.entry_time,
            'exit_time': self.exit_time,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

        if include_student and self.student:
            data['student'] = {
                'id': self.student.id,
                'name': self.student.user.name if self.student.user else None,
                'roll_number': self.student.roll_number,
                'reg_number': self.student.reg_number,
                'section': self.student.section
            }

        if include_subject and self.subject:
            data['subject'] = {
                'id': self.subject.id,
                'name': self.subject.name,
                'code': self.subject.code
            }

        return data

    @staticmethod
    def check_duplicate(student_id, subject_id, date_obj=None):
        """Check if attendance already marked for student/subject/date"""
        if date_obj is None:
            date_obj = date.today()

        existing = AttendanceLog.query.filter_by(
            student_id=student_id,
            subject_id=subject_id,
            date=date_obj
        ).first()

        return existing is not None

    def __repr__(self):
        return f'<AttendanceLog {self.student_id} - {self.date} - {self.status}>'
