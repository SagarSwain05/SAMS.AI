"""
Subject model
"""
from datetime import datetime
from . import db


class Subject(db.Model):
    """Subject/Course model"""
    __tablename__ = 'subjects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(30), unique=True, nullable=False, index=True)  # e.g. CSE-MAT101
    class_name = db.Column(db.String(50), nullable=True)   # legacy
    section = db.Column(db.String(10), nullable=True)       # legacy

    # New fields
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True, index=True)
    semester_number = db.Column(db.Integer, default=1)
    credits = db.Column(db.Integer, default=4)
    subject_index = db.Column(db.Integer, nullable=True)  # 0-5 position in branch timetable
    description = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False,
                           default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    branch = db.relationship('Branch', foreign_keys=[branch_id])
    attendance_logs = db.relationship('AttendanceLog', back_populates='subject',
                                      cascade='all, delete-orphan')
    schedules = db.relationship('Schedule', back_populates='subject', lazy='dynamic')

    def to_dict(self):
        data = {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'class': self.class_name,
            'section': self.section,
            'branch_id': self.branch_id,
            'semester_number': self.semester_number,
            'credits': self.credits,
            'subject_index': self.subject_index,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if self.branch:
            data['branch_code'] = self.branch.code
            data['branch_name'] = self.branch.name
        return data

    def __repr__(self):
        return f'<Subject {self.code} - {self.name}>'
