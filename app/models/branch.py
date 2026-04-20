"""
Branch model — represents an engineering/science department
"""
from datetime import datetime
from . import db


class Branch(db.Model):
    """Branch / Department model (CSE, CST, CS(AI/ML), ETC, EEE, CIVIL, MECH)"""
    __tablename__ = 'branches'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)          # Full name
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)  # e.g. CSE
    description = db.Column(db.Text, nullable=True)
    total_semesters = db.Column(db.Integer, default=8)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False,
                           default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sections = db.relationship('Section', back_populates='branch',
                               cascade='all, delete-orphan', lazy='dynamic')
    teacher_profiles = db.relationship('TeacherProfile', back_populates='branch', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'total_semesters': self.total_semesters,
            'section_count': self.sections.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<Branch {self.code} - {self.name}>'
