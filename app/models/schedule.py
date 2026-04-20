"""
Schedule model — the weekly timetable entry linking Section + Subject + Teacher + TimeSlot + Day
"""
from datetime import datetime
from . import db

DAY_NAMES = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday'}


class Schedule(db.Model):
    """
    One row = one recurring class per week.
    Constraints enforced by DB:
      - A section cannot have two classes at the same time on the same day.
      - A teacher cannot be in two classes at the same time on the same day.
    """
    __tablename__ = 'schedules'

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey('sections.id'), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teacher_profiles.id'),
                           nullable=False, index=True)
    time_slot_id = db.Column(db.Integer, db.ForeignKey('time_slots.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)   # 0=Monday … 4=Friday
    academic_year = db.Column(db.String(10), nullable=False, default='2024-25')
    semester = db.Column(db.Integer, nullable=False, default=1)
    room_number   = db.Column(db.String(20), nullable=True)
    change_reason = db.Column(db.Text, nullable=True)   # last edit reason (admin)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False,
                           default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    section = db.relationship('Section', back_populates='schedules')
    subject = db.relationship('Subject', back_populates='schedules')
    teacher = db.relationship('TeacherProfile', back_populates='schedules')
    time_slot = db.relationship('TimeSlot', back_populates='schedules')

    __table_args__ = (
        # No two subjects for the same section at the same time on the same day
        db.UniqueConstraint('section_id', 'time_slot_id', 'day_of_week', 'academic_year',
                            name='uq_section_slot_day'),
        # Teacher cannot be in two places at the same time
        db.UniqueConstraint('teacher_id', 'time_slot_id', 'day_of_week', 'academic_year',
                            name='uq_teacher_slot_day'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'section_id': self.section_id,
            'section': self.section.to_dict(include_branch=True) if self.section else None,
            'subject_id': self.subject_id,
            'subject': self.subject.to_dict() if self.subject else None,
            'teacher_id': self.teacher_id,
            'teacher': self.teacher.to_dict() if self.teacher else None,
            'time_slot_id': self.time_slot_id,
            'time_slot': self.time_slot.to_dict() if self.time_slot else None,
            'day_of_week': self.day_of_week,
            'day_name': DAY_NAMES.get(self.day_of_week, 'Unknown'),
            'academic_year': self.academic_year,
            'semester': self.semester,
            'room_number': self.room_number,
        }

    def __repr__(self):
        return (f'<Schedule Section={self.section_id} Subject={self.subject_id} '
                f'Day={DAY_NAMES.get(self.day_of_week)} Slot={self.time_slot_id}>')
