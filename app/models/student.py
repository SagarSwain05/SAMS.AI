"""
Student model
"""
from datetime import datetime
from . import db


class Student(db.Model):
    """Student information model"""
    __tablename__ = 'students'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    roll_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    reg_number = db.Column(db.String(50), unique=True, nullable=False, index=True)

    # Legacy text fields (kept for backward compatibility)
    department = db.Column(db.String(100), nullable=False)
    college = db.Column(db.String(200), nullable=False)
    class_name = db.Column(db.String(50), nullable=False)  # branch code e.g. "CSE"
    section = db.Column(db.String(10), nullable=False)      # e.g. "A", "B"

    # New FK references to normalized Branch/Section tables
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True, index=True)
    section_id = db.Column(db.Integer, db.ForeignKey('sections.id'), nullable=True, index=True)
    current_semester = db.Column(db.Integer, default=1)

    contact = db.Column(db.String(20), nullable=True)
    photo_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False,
                           default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', back_populates='student')
    branch = db.relationship('Branch', foreign_keys=[branch_id])
    section_ref = db.relationship('Section', foreign_keys=[section_id])
    face_embeddings = db.relationship('FaceEmbedding', back_populates='student',
                                      cascade='all, delete-orphan')
    attendance_logs = db.relationship('AttendanceLog', back_populates='student',
                                      cascade='all, delete-orphan')
    notifications = db.relationship('Notification', back_populates='student',
                                    cascade='all, delete-orphan')

    def to_dict(self, include_user=True):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'roll_number': self.roll_number,
            'reg_number': self.reg_number,
            'department': self.department,
            'college': self.college,
            'class': self.class_name,
            'section': self.section,
            'branch_id': self.branch_id,
            'section_id': self.section_id,
            'current_semester': self.current_semester,
            'contact': self.contact,
            'photo_url': self.photo_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if self.branch:
            data['branch_code'] = self.branch.code
            data['branch_name'] = self.branch.name
        if include_user and self.user:
            data['name'] = self.user.name
            data['email'] = self.user.email
            data['username'] = self.user.username
        return data

    def get_attendance_stats(self, subject_id=None):
        from .attendance import AttendanceLog
        query = AttendanceLog.query.filter_by(student_id=self.id)
        if subject_id:
            query = query.filter_by(subject_id=subject_id)
        total = query.count()
        present = query.filter_by(status='present').count()
        absent = query.filter_by(status='absent').count()
        late = query.filter_by(status='late').count()
        percentage = (present / total * 100) if total > 0 else 0
        return {
            'total_classes': total,
            'attended': present,
            'absent': absent,
            'late': late,
            'percentage': round(percentage, 2)
        }

    def __repr__(self):
        return f'<Student {self.roll_number} - {self.user.name if self.user else "Unknown"}>'
