"""
TeacherProfile model — extended profile for users with role='teacher'
"""
from datetime import datetime
from . import db


class TeacherProfile(db.Model):
    """Extended teacher information linked to User account"""
    __tablename__ = 'teacher_profiles'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                        nullable=False, unique=True, index=True)
    employee_id = db.Column(db.String(20), unique=True, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    department = db.Column(db.String(100), nullable=True)   # e.g. "Mathematics", "CSE"
    qualification = db.Column(db.String(200), nullable=True)
    specialization = db.Column(db.String(200), nullable=True)
    joining_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False,
                           default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])
    branch = db.relationship('Branch', back_populates='teacher_profiles')
    schedules = db.relationship('Schedule', back_populates='teacher',
                                cascade='all, delete-orphan', lazy='dynamic')

    def to_dict(self, include_user=True):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'employee_id': self.employee_id,
            'branch_id': self.branch_id,
            'department': self.department,
            'qualification': self.qualification,
            'specialization': self.specialization,
            'joining_date': self.joining_date.isoformat() if self.joining_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_user and self.user:
            data['name'] = self.user.name
            data['email'] = self.user.email
            data['username'] = self.user.username
        if self.branch:
            data['branch_code'] = self.branch.code
            data['branch_name'] = self.branch.name
        return data

    def __repr__(self):
        name = self.user.name if self.user else 'Unknown'
        return f'<TeacherProfile {self.employee_id} - {name}>'
