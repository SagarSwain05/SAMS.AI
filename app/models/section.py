"""
Section model — a specific class section within a branch (e.g. CSE-A, CSE-B)
"""
from datetime import datetime
from . import db


class Section(db.Model):
    """Section within a Branch"""
    __tablename__ = 'sections'

    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    name = db.Column(db.String(10), nullable=False)           # A, B, C
    current_semester = db.Column(db.Integer, default=1)
    capacity = db.Column(db.Integer, default=50)
    room_number = db.Column(db.String(20), nullable=True)     # e.g. CSE-101
    # Global ordering index used by schedule algorithm (set during seeding)
    global_index = db.Column(db.Integer, nullable=True, unique=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False,
                           default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    branch = db.relationship('Branch', back_populates='sections')
    schedules = db.relationship('Schedule', back_populates='section',
                                cascade='all, delete-orphan', lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('branch_id', 'name', name='uq_branch_section'),
    )

    def to_dict(self, include_branch=True):
        data = {
            'id': self.id,
            'branch_id': self.branch_id,
            'name': self.name,
            'current_semester': self.current_semester,
            'capacity': self.capacity,
            'room_number': self.room_number,
            'global_index': self.global_index,
        }
        if include_branch and self.branch:
            data['branch_code'] = self.branch.code
            data['branch_name'] = self.branch.name
            data['display'] = f"{self.branch.code}-{self.name}"
        return data

    def __repr__(self):
        branch_code = self.branch.code if self.branch else '?'
        return f'<Section {branch_code}-{self.name}>'
