"""
Database models for the College Attendance Management System (CAMS)
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Core auth/user model
from .user import User

# Branch & Section (college structure)
from .branch import Branch
from .section import Section

# Teacher profile (extends User)
from .teacher_profile import TeacherProfile

# Academic
from .subject import Subject
from .time_slot import TimeSlot
from .schedule import Schedule

# Student (extends User)
from .student import Student

# Attendance & notifications
from .face_embedding import FaceEmbedding
from .attendance import AttendanceLog
from .notification import Notification

__all__ = [
    'db',
    'User',
    'Branch',
    'Section',
    'TeacherProfile',
    'Subject',
    'TimeSlot',
    'Schedule',
    'Student',
    'FaceEmbedding',
    'AttendanceLog',
    'Notification',
]
