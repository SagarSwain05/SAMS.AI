"""
TimeSlot model — the defined periods in a college day (10AM-5PM, 1-2PM break)
"""
from datetime import datetime
from . import db


class TimeSlot(db.Model):
    """Defines each hour-long period in the college day"""
    __tablename__ = 'time_slots'

    id = db.Column(db.Integer, primary_key=True)
    slot_number = db.Column(db.Integer, nullable=False)   # 1-6 for teaching, 0 for break
    label = db.Column(db.String(50), nullable=False)       # e.g. "Period 1", "Lunch Break"
    start_time = db.Column(db.String(10), nullable=False)  # "10:00"
    end_time = db.Column(db.String(10), nullable=False)    # "11:00"
    is_break = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    schedules = db.relationship('Schedule', back_populates='time_slot', lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('slot_number', 'is_break', name='uq_slot_number'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'slot_number': self.slot_number,
            'label': self.label,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'is_break': self.is_break,
            'display': f"{self.start_time} - {self.end_time}"
        }

    def __repr__(self):
        return f'<TimeSlot {self.label} ({self.start_time}-{self.end_time})>'
