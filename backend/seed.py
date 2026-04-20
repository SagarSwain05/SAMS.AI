"""
Database Seeding Script
Creates demo data for testing the AI-Powered Attendance System
"""
import os
import sys
from datetime import datetime, timedelta
from random import choice, uniform, randint

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import db, User, Student, Subject, AttendanceLog, Notification


def seed_database():
    """Seed the database with demo data"""
    app = create_app()

    with app.app_context():
        print("🌱 Starting database seeding...")

        # Clear existing data
        print("Clearing existing data...")
        AttendanceLog.query.delete()
        Notification.query.delete()
        Student.query.delete()
        Subject.query.delete()
        User.query.delete()
        db.session.commit()
        print("✓ Existing data cleared")

        # Create Admin
        print("\nCreating admin...")
        admin1 = User(
            username='admin1',
            password='admin123',
            role='admin',
            name='System Administrator',
            email='admin@system.com'
        )

        db.session.add(admin1)
        db.session.commit()
        print(f"✓ Created admin user")

        # Create Teachers
        print("\nCreating teachers...")
        teacher1 = User(
            username='teacher1',
            password='password123',
            role='teacher',
            name='Dr. John Smith',
            email='john.smith@university.edu'
        )

        teacher2 = User(
            username='teacher2',
            password='password123',
            role='teacher',
            name='Prof. Sarah Johnson',
            email='sarah.johnson@university.edu'
        )

        db.session.add_all([teacher1, teacher2])
        db.session.commit()
        print(f"✓ Created {2} teachers")

        # Create Subjects
        print("\nCreating subjects...")
        subjects_data = [
            {'name': 'Data Structures', 'code': 'CS201', 'class_name': 'BTech CSE', 'section': 'A',
             'description': 'Introduction to fundamental data structures and algorithms'},
            {'name': 'Database Management', 'code': 'CS301', 'class_name': 'BTech CSE', 'section': 'A',
             'description': 'Relational database design and SQL'},
            {'name': 'Machine Learning', 'code': 'CS401', 'class_name': 'BTech CSE', 'section': 'A',
             'description': 'Introduction to ML algorithms and applications'},
            {'name': 'Web Development', 'code': 'CS302', 'class_name': 'BTech CSE', 'section': 'B',
             'description': 'Full-stack web development with modern frameworks'},
            {'name': 'Operating Systems', 'code': 'CS303', 'class_name': 'BTech CSE', 'section': 'B',
             'description': 'Process management, memory, and file systems'},
        ]

        subjects = []
        for subj_data in subjects_data:
            subject = Subject(**subj_data)
            subjects.append(subject)
            db.session.add(subject)

        db.session.commit()
        print(f"✓ Created {len(subjects)} subjects")

        # Create Students
        print("\nCreating students...")
        students_data = [
            ('Aarav Sharma', 'CS2024001', 'REG2024001', 'A', '9876543210'),
            ('Vivaan Patel', 'CS2024002', 'REG2024002', 'A', '9876543211'),
            ('Aditya Kumar', 'CS2024003', 'REG2024003', 'A', '9876543212'),
            ('Vihaan Singh', 'CS2024004', 'REG2024004', 'A', '9876543213'),
            ('Arjun Gupta', 'CS2024005', 'REG2024005', 'A', '9876543214'),
            ('Sai Reddy', 'CS2024006', 'REG2024006', 'A', '9876543215'),
            ('Ayaan Khan', 'CS2024007', 'REG2024007', 'A', '9876543216'),
            ('Krishna Rao', 'CS2024008', 'REG2024008', 'A', '9876543217'),
            ('Ishaan Verma', 'CS2024009', 'REG2024009', 'A', '9876543218'),
            ('Reyansh Nair', 'CS2024010', 'REG2024010', 'A', '9876543219'),
            ('Aaradhya Singh', 'CS2024011', 'REG2024011', 'A', '9876543220'),
            ('Ananya Iyer', 'CS2024012', 'REG2024012', 'A', '9876543221'),
            ('Diya Mehta', 'CS2024013', 'REG2024013', 'A', '9876543222'),
            ('Isha Joshi', 'CS2024014', 'REG2024014', 'A', '9876543223'),
            ('Kavya Desai', 'CS2024015', 'REG2024015', 'A', '9876543224'),
            ('Priya Agarwal', 'CS2024016', 'REG2024016', 'B', '9876543225'),
            ('Riya Sharma', 'CS2024017', 'REG2024017', 'B', '9876543226'),
            ('Sara Reddy', 'CS2024018', 'REG2024018', 'B', '9876543227'),
            ('Tanvi Kapoor', 'CS2024019', 'REG2024019', 'B', '9876543228'),
            ('Zara Patel', 'CS2024020', 'REG2024020', 'B', '9876543229'),
            ('Aryan Malhotra', 'CS2024021', 'REG2024021', 'B', '9876543230'),
            ('Kabir Choudhary', 'CS2024022', 'REG2024022', 'B', '9876543231'),
            ('Rohan Bansal', 'CS2024023', 'REG2024023', 'B', '9876543232'),
            ('Shaurya Pillai', 'CS2024024', 'REG2024024', 'B', '9876543233'),
            ('Yash Bhatia', 'CS2024025', 'REG2024025', 'B', '9876543234'),
        ]

        students = []
        for idx, (name, roll, reg, section, contact) in enumerate(students_data):
            # Create user account
            user = User(
                username=roll.lower(),
                password='student123',
                role='student',
                name=name,
                email=f"{roll.lower()}@student.university.edu"
            )
            db.session.add(user)
            db.session.flush()  # Get user ID

            # Create student profile
            student = Student(
                user_id=user.id,
                roll_number=roll,
                reg_number=reg,
                department='Computer Science Engineering',
                college='University Institute of Technology',
                class_name='BTech CSE',
                section=section,
                contact=contact
            )
            students.append(student)
            db.session.add(student)

        db.session.commit()
        print(f"✓ Created {len(students)} students")

        # Create Attendance Records
        print("\nCreating attendance records...")
        attendance_count = 0
        today = datetime.now().date()

        # Generate attendance for last 30 days
        for days_ago in range(30, 0, -1):
            date = today - timedelta(days=days_ago)

            # Skip weekends
            if date.weekday() >= 5:
                continue

            # Random subjects taught on this day (2-3 subjects per day)
            day_subjects = [choice(subjects) for _ in range(randint(2, 3))]

            for subject in day_subjects:
                # Get students for this section
                section_students = [s for s in students if s.section == subject.section]

                for student in section_students:
                    # 85% attendance rate (students occasionally absent)
                    if uniform(0, 1) > 0.15:
                        status = 'present'
                        confidence = uniform(0.88, 0.98)
                        marked_by = 'face_recognition'
                        entry_time = f"{choice([8, 9])}:{randint(0, 59):02d} AM"
                    else:
                        status = 'absent'
                        confidence = None
                        marked_by = 'manual'
                        entry_time = None

                    attendance = AttendanceLog(
                        student_id=student.id,
                        subject_id=subject.id,
                        date=date,
                        time=datetime.now().time(),
                        status=status,
                        confidence_score=confidence,
                        marked_by=marked_by,
                        entry_time=entry_time
                    )
                    db.session.add(attendance)
                    attendance_count += 1

        db.session.commit()
        print(f"✓ Created {attendance_count} attendance records")

        # Create Notifications
        print("\nCreating notifications...")
        notification_messages = [
            ("Low attendance alert", "Your attendance is below 75%. Please attend classes regularly.", "warning"),
            ("Test scheduled", "Mid-term exam scheduled for next week. Prepare accordingly.", "info"),
            ("Assignment due", "Submit your assignment by this Friday.", "alert"),
            ("Good attendance", "Great job! Your attendance is above 90%.", "success"),
            ("Class cancelled", "Tomorrow's lecture has been cancelled.", "info"),
        ]

        notifications_count = 0
        for student in students[:10]:  # Send notifications to first 10 students
            message, detail, ntype = choice(notification_messages)
            notification = Notification(
                student_id=student.id,
                message=f"{message}: {detail}",
                type=ntype,
                read_status=choice([True, False])
            )
            db.session.add(notification)
            notifications_count += 1

        db.session.commit()
        print(f"✓ Created {notifications_count} notifications")

        # Summary
        print("\n" + "="*60)
        print("✅ Database seeding completed successfully!")
        print("="*60)
        print(f"""
📊 Summary:
   - Teachers: 2
   - Students: {len(students)}
   - Subjects: {len(subjects)}
   - Attendance Records: {attendance_count}
   - Notifications: {notifications_count}

🔑 Login Credentials:

   Teachers:
   - Username: teacher1, Password: password123
   - Username: teacher2, Password: password123

   Students (examples):
   - Username: cs2024001, Password: student123
   - Username: cs2024002, Password: student123
   - Username: cs2024016, Password: student123

   (All student usernames are roll numbers in lowercase)

🚀 You can now test the API endpoints!
   - API Base: http://localhost:5001/api
   - Login: POST /api/auth/login
   - Students: GET /api/students
   - Attendance: GET /api/attendance
        """)


if __name__ == '__main__':
    seed_database()
