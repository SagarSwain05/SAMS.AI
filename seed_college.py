"""
seed_college.py
==============
Complete College Attendance Management System (CAMS) seeder.

Creates:
  • 1 College Admin
  • 7 Branches  (CSE, CST, CS-AIML, ETC, EEE, CIVIL, MECH)
  • 15 Sections (CSE:A/B/C, rest:A/B)
  • 7 Time Slots (10–11, 11–12, 12–1, BREAK 1–2, 2–3, 3–4, 4–5)
  • 42 Subjects  (6 per branch × 7 branches)
  • 35 Teachers  distributed across departments
  • 675 Students (45 per section × 15 sections)
  • 450 Schedule entries (15 sections × 5 days × 6 slots)
  • Credential files organised by role/branch/section

Schedule Algorithm
------------------
Section with global_index k, on day d (0=Mon…4=Fri), time slot s (0-5):
    subject_position = (s + d + k) % 6

This creates a rolling timetable with NO teacher overlap.
Teacher conflict code: (subject_index - global_index) % 6
A teacher can hold at most one assignment per conflict code.
"""

import os
import sys
import csv
import json
from datetime import datetime, date

# ─── Make sure we can import app from this script ───────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.models import (db, User, Branch, Section, Subject, TimeSlot,
                         Schedule, TeacherProfile, Student, Notification)

# ═══════════════════════════════════════════════════════════════════════════════
#  STATIC DATA
# ═══════════════════════════════════════════════════════════════════════════════

COLLEGE_NAME = "Trident Academy of Technology"
ACADEMIC_YEAR = "2024-25"
SEMESTER = 1

# ── Branches & their 6 subjects (index 0-5 is timetable position) ─────────────
BRANCH_DATA = [
    {
        "name": "Computer Science Engineering",
        "code": "CSE",
        "sections": ["A", "B", "C"],
        "subjects": [
            ("Mathematics I",          "CSE-MAT101", 4),
            ("Physics",                "CSE-PHY101", 4),
            ("Programming in C",       "CSE-PGC101", 4),
            ("Digital Electronics",    "CSE-DEL101", 4),
            ("English Communication",  "CSE-ENG101", 2),
            ("Engineering Drawing",    "CSE-EDR101", 2),
        ],
    },
    {
        "name": "Computer Science & Technology",
        "code": "CST",
        "sections": ["A", "B"],
        "subjects": [
            ("Mathematics I",          "CST-MAT101", 4),
            ("Physics",                "CST-PHY101", 4),
            ("Programming in C",       "CST-PGC101", 4),
            ("Data Structures",        "CST-DST101", 4),
            ("English Communication",  "CST-ENG101", 2),
            ("Digital Systems",        "CST-DSY101", 4),
        ],
    },
    {
        "name": "CS (Artificial Intelligence & ML)",
        "code": "CSAIML",
        "sections": ["A", "B"],
        "subjects": [
            ("Statistics & Probability", "AIM-STP101", 4),
            ("Linear Algebra",           "AIM-LAG101", 4),
            ("Python Programming",       "AIM-PYT101", 4),
            ("Introduction to AI",       "AIM-IAI101", 4),
            ("English Communication",    "AIM-ENG101", 2),
            ("Data Structures",          "AIM-DST101", 4),
        ],
    },
    {
        "name": "Electronics & Telecommunication Engineering",
        "code": "ETC",
        "sections": ["A", "B"],
        "subjects": [
            ("Mathematics I",          "ETC-MAT101", 4),
            ("Physics",                "ETC-PHY101", 4),
            ("Basic Electronics",      "ETC-BEL101", 4),
            ("Circuit Theory",         "ETC-CTH101", 4),
            ("English Communication",  "ETC-ENG101", 2),
            ("Engineering Drawing",    "ETC-EDR101", 2),
        ],
    },
    {
        "name": "Electrical & Electronics Engineering",
        "code": "EEE",
        "sections": ["A", "B"],
        "subjects": [
            ("Mathematics I",          "EEE-MAT101", 4),
            ("Physics",                "EEE-PHY101", 4),
            ("Electrical Circuits",    "EEE-ECT101", 4),
            ("Basic Electronics",      "EEE-BEL101", 4),
            ("English Communication",  "EEE-ENG101", 2),
            ("Engineering Drawing",    "EEE-EDR101", 2),
        ],
    },
    {
        "name": "Civil Engineering",
        "code": "CIVIL",
        "sections": ["A", "B"],
        "subjects": [
            ("Mathematics I",          "CIV-MAT101", 4),
            ("Physics",                "CIV-PHY101", 4),
            ("Engineering Mechanics",  "CIV-EMC101", 4),
            ("Surveying",              "CIV-SUR101", 4),
            ("English Communication",  "CIV-ENG101", 2),
            ("Engineering Drawing",    "CIV-EDR101", 2),
        ],
    },
    {
        "name": "Mechanical Engineering",
        "code": "MECH",
        "sections": ["A", "B"],
        "subjects": [
            ("Mathematics I",          "MEC-MAT101", 4),
            ("Physics",                "MEC-PHY101", 4),
            ("Thermodynamics",         "MEC-THD101", 4),
            ("Engineering Mechanics",  "MEC-EMC101", 4),
            ("English Communication",  "MEC-ENG101", 2),
            ("Engineering Drawing",    "MEC-EDR101", 2),
        ],
    },
]

# ── Time slots 10 AM – 5 PM (6 teaching + 1 break) ────────────────────────────
TIME_SLOT_DATA = [
    (1, "Period 1",    "10:00", "11:00", False),
    (2, "Period 2",    "11:00", "12:00", False),
    (3, "Period 3",    "12:00", "13:00", False),
    (0, "Lunch Break", "13:00", "14:00", True),
    (4, "Period 4",    "14:00", "15:00", False),
    (5, "Period 5",    "15:00", "16:00", False),
    (6, "Period 6",    "16:00", "17:00", False),
]

# ── 35 Teachers ───────────────────────────────────────────────────────────────
# dept_code maps to which branch's subjects they primarily teach
# sub_idx_pref: list of subject-index positions (0-5) they are qualified for
TEACHER_DATA = [
    # Mathematics Department (4 teachers) — teaches sub_idx=0 to CSE/CST/ETC/EEE/CIVIL/MECH
    #                                        OR sub_idx=0,1 to CSAIML (Stats/LinAlg)
    {"name": "Dr. Rajesh Kumar",    "emp": "TMAT001", "dept": "Mathematics",
     "qual": "PhD Mathematics",      "spec": "Linear Algebra, Calculus"},
    {"name": "Dr. Priya Sharma",    "emp": "TMAT002", "dept": "Mathematics",
     "qual": "PhD Mathematics",      "spec": "Statistics, Probability"},
    {"name": "Mr. Suresh Patel",    "emp": "TMAT003", "dept": "Mathematics",
     "qual": "M.Sc Mathematics",     "spec": "Applied Mathematics"},
    {"name": "Ms. Lakshmi Devi",    "emp": "TMAT004", "dept": "Mathematics",
     "qual": "M.Sc Mathematics",     "spec": "Discrete Mathematics"},

    # Physics Department (3 teachers) — teaches sub_idx=1 for CSE/CST/ETC/EEE/CIVIL/MECH
    {"name": "Dr. Amit Verma",      "emp": "TPHY001", "dept": "Physics",
     "qual": "PhD Physics",          "spec": "Quantum Mechanics, Optics"},
    {"name": "Dr. Kavitha Nair",    "emp": "TPHY002", "dept": "Physics",
     "qual": "PhD Physics",          "spec": "Electromagnetism"},
    {"name": "Mr. Deepak Iyer",     "emp": "TPHY003", "dept": "Physics",
     "qual": "M.Sc Physics",         "spec": "Classical Mechanics"},

    # English Department (3 teachers) — teaches sub_idx=4 for ALL branches
    {"name": "Ms. Anitha Rao",      "emp": "TENG001", "dept": "English",
     "qual": "MA English Literature","spec": "Technical Communication"},
    {"name": "Mr. Vikram Singh",    "emp": "TENG002", "dept": "English",
     "qual": "MA English",           "spec": "Business Communication"},
    {"name": "Ms. Geeta Pillai",    "emp": "TENG003", "dept": "English",
     "qual": "MA English Literature","spec": "Soft Skills, Communication"},

    # Drawing Department (2 teachers) — teaches sub_idx=5 for CSE/CST/ETC/EEE/CIVIL/MECH
    {"name": "Mr. Ramesh Gupta",    "emp": "TDRW001", "dept": "Drawing",
     "qual": "B.Arch",               "spec": "Engineering Drawing, CAD"},
    {"name": "Ms. Deepa Menon",     "emp": "TDRW002", "dept": "Drawing",
     "qual": "B.Arch",               "spec": "AutoCAD, Drafting"},

    # CSE Department (5 teachers) — CSE sub_idx=2(PGC), 3(DEL)
    {"name": "Dr. Sanjay Mishra",   "emp": "TCSE001", "dept": "CSE",
     "qual": "PhD Computer Science", "spec": "Algorithms, Data Structures"},
    {"name": "Ms. Pooja Agarwal",   "emp": "TCSE002", "dept": "CSE",
     "qual": "M.Tech CSE",           "spec": "Programming, DBMS"},
    {"name": "Mr. Rahul Chauhan",   "emp": "TCSE003", "dept": "CSE",
     "qual": "M.Tech CSE",           "spec": "Digital Logic, Microprocessors"},
    {"name": "Dr. Sneha Reddy",     "emp": "TCSE004", "dept": "CSE",
     "qual": "PhD Computer Science", "spec": "Software Engineering"},
    {"name": "Mr. Karthik Rajan",   "emp": "TCSE005", "dept": "CSE",
     "qual": "M.Tech CSE",           "spec": "Computer Networks"},

    # CST Department (3 teachers) — CST sub_idx=3(DST), 5(DSY)
    {"name": "Dr. Vinod Joshi",     "emp": "TCST001", "dept": "CST",
     "qual": "PhD Computer Science", "spec": "Data Structures, OS"},
    {"name": "Ms. Preethi Kumar",   "emp": "TCST002", "dept": "CST",
     "qual": "M.Tech IT",            "spec": "Digital Systems, VLSI"},
    {"name": "Mr. Naveen Sharma",   "emp": "TCST003", "dept": "CST",
     "qual": "M.Tech CSE",           "spec": "Computer Architecture"},

    # CS(AI/ML) Department (3 teachers) — CSAIML sub_idx=2(PYT),3(IAI),5(DST)
    {"name": "Dr. Ananya Krishnan", "emp": "TAIM001", "dept": "CSAIML",
     "qual": "PhD AI/ML",            "spec": "Machine Learning, Deep Learning"},
    {"name": "Mr. Rohit Gupta",     "emp": "TAIM002", "dept": "CSAIML",
     "qual": "M.Tech AI",            "spec": "Python, Data Science"},
    {"name": "Ms. Divya Pillai",    "emp": "TAIM003", "dept": "CSAIML",
     "qual": "M.Tech ML",            "spec": "Neural Networks, NLP"},

    # ETC Department (4 teachers) — ETC sub_idx=2(BEL), 3(CTH)
    {"name": "Dr. Manoj Yadav",     "emp": "TETC001", "dept": "ETC",
     "qual": "PhD Electronics",      "spec": "Analog Electronics, Signals"},
    {"name": "Ms. Sunita Jain",     "emp": "TETC002", "dept": "ETC",
     "qual": "M.Tech Electronics",   "spec": "Circuit Theory, EMI"},
    {"name": "Mr. Arun Kumar",      "emp": "TETC003", "dept": "ETC",
     "qual": "M.Tech EC",            "spec": "Digital Communications"},
    {"name": "Dr. Rekha Nair",      "emp": "TETC004", "dept": "ETC",
     "qual": "PhD Electronics",      "spec": "Microelectronics, Sensors"},

    # EEE Department (3 teachers) — EEE sub_idx=2(ECT), 3(BEL)
    {"name": "Dr. Suresh Babu",     "emp": "TEEE001", "dept": "EEE",
     "qual": "PhD Electrical Engg",  "spec": "Power Systems, Machines"},
    {"name": "Ms. Lavanya Raj",     "emp": "TEEE002", "dept": "EEE",
     "qual": "M.Tech EEE",           "spec": "Control Systems"},
    {"name": "Mr. Kishore Kumar",   "emp": "TEEE003", "dept": "EEE",
     "qual": "M.Tech EEE",           "spec": "Electrical Circuits, Electronics"},

    # CIVIL Department (3 teachers) — CIVIL sub_idx=2(EMC), 3(SUR)
    {"name": "Dr. Harish Patel",    "emp": "TCIV001", "dept": "CIVIL",
     "qual": "PhD Civil Engg",       "spec": "Structural Mechanics"},
    {"name": "Ms. Meena Sharma",    "emp": "TCIV002", "dept": "CIVIL",
     "qual": "M.Tech Civil",         "spec": "Surveying, GIS"},
    {"name": "Mr. Ravi Shankar",    "emp": "TCIV003", "dept": "CIVIL",
     "qual": "M.Tech Civil",         "spec": "Geotechnical Engineering"},

    # MECH Department (3 teachers) — MECH sub_idx=2(THD), 3(EMC)
    {"name": "Dr. Prakash Iyer",    "emp": "TMEC001", "dept": "MECH",
     "qual": "PhD Mechanical Engg",  "spec": "Thermodynamics, Heat Transfer"},
    {"name": "Ms. Gayathri Menon",  "emp": "TMEC002", "dept": "MECH",
     "qual": "M.Tech Mechanical",    "spec": "Fluid Mechanics, Turbomachinery"},
    {"name": "Mr. Vijay Kumar",     "emp": "TMEC003", "dept": "MECH",
     "qual": "M.Tech Mechanical",    "spec": "Manufacturing, CAD/CAM"},
]

# ── Indian student names pool ──────────────────────────────────────────────────
FIRST_NAMES_M = [
    "Arjun", "Rahul", "Aditya", "Rohan", "Vikram", "Amit", "Raj", "Kiran",
    "Sanjay", "Ravi", "Suresh", "Mohan", "Deepak", "Ankit", "Nikhil",
    "Akash", "Varun", "Harsh", "Neeraj", "Manish", "Ajay", "Abhishek",
    "Gaurav", "Tushar", "Yash", "Kunal", "Tarun", "Sahil", "Mayank", "Shivam",
]
FIRST_NAMES_F = [
    "Priya", "Sneha", "Pooja", "Anjali", "Riya", "Divya", "Kavita", "Meera",
    "Sita", "Geeta", "Ananya", "Lakshmi", "Pallavi", "Swati", "Neha",
    "Shreya", "Nisha", "Deepa", "Sunita", "Rekha", "Preethi", "Bhavna",
    "Komal", "Simran", "Isha", "Preeti", "Jyoti", "Mamta", "Reena", "Seema",
]
LAST_NAMES = [
    "Sharma", "Patel", "Kumar", "Singh", "Gupta", "Joshi", "Reddy", "Nair",
    "Menon", "Rao", "Verma", "Mishra", "Yadav", "Chauhan", "Tiwari",
    "Agarwal", "Mehta", "Shah", "Jain", "Pillai", "Iyer", "Krishnan",
]


# ═══════════════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def gen_student_name(seq: int) -> str:
    """Generate a unique-ish Indian student name from a sequence number."""
    fn_pool = FIRST_NAMES_M + FIRST_NAMES_F   # 60 first names
    first = fn_pool[seq % len(fn_pool)]
    last = LAST_NAMES[seq % len(LAST_NAMES)]
    # Avoid identical names by appending a middle initial for repeats
    mid_initials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    suffix = mid_initials[(seq // len(fn_pool)) % 26] if seq >= len(fn_pool) else ""
    return f"{first}{' ' + suffix + '.' if suffix else ''} {last}"


def section_display(branch_code: str, section_name: str) -> str:
    return f"{branch_code}-{section_name}"


# ═══════════════════════════════════════════════════════════════════════════════
#  SCHEDULE CONFLICT CHECKER
# ═══════════════════════════════════════════════════════════════════════════════

class TeacherConflictTracker:
    """
    Tracks which 'conflict slots' each teacher already occupies.
    Conflict slot = (subject_index - section_global_index) % 6

    Because of the rolling timetable design, two assignments conflict
    on all 5 days iff they share the same conflict slot value.
    A teacher can hold at most one assignment per value (6 total).
    """

    def __init__(self):
        # teacher_id -> set of conflict_code values (0-5) already taken
        self._used: dict[int, set] = {}

    def can_assign(self, teacher_db_id: int, subject_idx: int, section_k: int) -> bool:
        code = (subject_idx - section_k) % 6
        return code not in self._used.get(teacher_db_id, set())

    def assign(self, teacher_db_id: int, subject_idx: int, section_k: int):
        code = (subject_idx - section_k) % 6
        self._used.setdefault(teacher_db_id, set()).add(code)


# ═══════════════════════════════════════════════════════════════════════════════
#  SEEDING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def create_admin():
    existing = User.query.filter_by(username='college_admin').first()
    if existing:
        print("  [skip] Admin already exists")
        return existing
    admin = User(
        username='college_admin',
        password='Admin@2024',
        role='admin',
        name='College Administrator',
        email='admin@tat.edu.in',
    )
    db.session.add(admin)
    db.session.flush()
    print(f"  [+] Admin: college_admin")
    return admin


def create_branches_and_sections() -> dict:
    """Returns {branch_code: {'obj': Branch, 'sections': {sec_name: Section}}}"""
    result = {}
    global_idx = 0
    for bd in BRANCH_DATA:
        branch = Branch.query.filter_by(code=bd['code']).first()
        if not branch:
            branch = Branch(name=bd['name'], code=bd['code'])
            db.session.add(branch)
            db.session.flush()
            print(f"  [+] Branch: {bd['code']} – {bd['name']}")
        else:
            print(f"  [skip] Branch {bd['code']}")

        sec_map = {}
        for sec_name in bd['sections']:
            sec = Section.query.filter_by(branch_id=branch.id, name=sec_name).first()
            if not sec:
                sec = Section(
                    branch_id=branch.id,
                    name=sec_name,
                    current_semester=SEMESTER,
                    capacity=45,
                    room_number=f"{bd['code']}-{sec_name}-101",
                    global_index=global_idx,
                )
                db.session.add(sec)
                db.session.flush()
                print(f"    [+] Section {bd['code']}-{sec_name}  (k={global_idx})")
            else:
                sec.global_index = global_idx
                print(f"    [skip] Section {bd['code']}-{sec_name}")
            sec_map[sec_name] = sec
            global_idx += 1

        result[bd['code']] = {'obj': branch, 'sections': sec_map}
    return result


def create_time_slots() -> list:
    """Returns list of TimeSlot objects ordered by start_time."""
    slots = []
    for slot_num, label, start, end, is_break in TIME_SLOT_DATA:
        ts = TimeSlot.query.filter_by(label=label).first()
        if not ts:
            ts = TimeSlot(slot_number=slot_num, label=label,
                          start_time=start, end_time=end, is_break=is_break)
            db.session.add(ts)
            db.session.flush()
            print(f"  [+] TimeSlot: {label} ({start}-{end})")
        else:
            print(f"  [skip] TimeSlot {label}")
        slots.append(ts)
    return slots


def create_subjects(branches: dict) -> dict:
    """
    Returns {branch_code: [Subject, Subject, ...]} in subject_index order (0-5).
    """
    result = {}
    for bd in BRANCH_DATA:
        branch_obj = branches[bd['code']]['obj']
        subjects = []
        for idx, (name, code, credits) in enumerate(bd['subjects']):
            subj = Subject.query.filter_by(code=code).first()
            if not subj:
                subj = Subject(
                    name=name, code=code, credits=credits,
                    branch_id=branch_obj.id,
                    semester_number=SEMESTER,
                    subject_index=idx,
                    class_name=bd['code'],
                    description=f"Semester {SEMESTER} subject for {bd['code']}",
                )
                db.session.add(subj)
                db.session.flush()
                print(f"    [+] Subject [{bd['code']}][{idx}] {code} – {name}")
            else:
                subj.subject_index = idx
                subj.branch_id = branch_obj.id
                print(f"    [skip] Subject {code}")
            subjects.append(subj)
        result[bd['code']] = subjects
    return result


def create_teachers(branches: dict) -> list:
    """Creates 35 teacher users + profiles. Returns list of TeacherProfile."""
    profiles = []
    for td in TEACHER_DATA:
        user = User.query.filter_by(username=td['emp'].lower()).first()
        if not user:
            user = User(
                username=td['emp'].lower(),
                password='Teacher@2024',
                role='teacher',
                name=td['name'],
                email=f"{td['emp'].lower()}@tat.edu.in",
            )
            db.session.add(user)
            db.session.flush()

        profile = TeacherProfile.query.filter_by(employee_id=td['emp']).first()
        if not profile:
            branch_obj = None
            for b in branches.values():
                if b['obj'].code == td['dept']:
                    branch_obj = b['obj']
                    break
            profile = TeacherProfile(
                user_id=user.id,
                employee_id=td['emp'],
                branch_id=branch_obj.id if branch_obj else None,
                department=td['dept'],
                qualification=td['qual'],
                specialization=td['spec'],
                joining_date=date(2020, 6, 1),
            )
            db.session.add(profile)
            db.session.flush()
            print(f"  [+] Teacher: {td['emp']} – {td['name']} ({td['dept']})")
        else:
            print(f"  [skip] Teacher {td['emp']}")
        profiles.append(profile)
    return profiles


def assign_teachers_to_subjects(
        teacher_profiles: list,
        subjects_by_branch: dict,
        branches: dict,
) -> dict:
    """
    Returns {(branch_code, subject_idx): teacher_profile_id}

    Teacher pool per subject position:
      idx=0  Math / Stats       → TMAT*
      idx=1  Physics / LinAlg   → TPHY* / TMAT*
      idx=2  Branch-specific    → branch teacher
      idx=3  Branch-specific    → branch teacher
      idx=4  English            → TENG*
      idx=5  Drawing / DST      → TDRW* / branch teacher
    """
    # Build lookup: employee_id -> profile
    emp_to_profile = {p.employee_id: p for p in teacher_profiles}

    # Define pools per (branch_code, subject_idx)
    # Each pool lists employee IDs in preference order
    POOLS = {
        # ── CSE ──────────────────────────────────────────────────────────────
        ("CSE", 0): ["TMAT001", "TMAT002", "TMAT003", "TMAT004"],
        ("CSE", 1): ["TPHY001", "TPHY002", "TPHY003"],
        ("CSE", 2): ["TCSE001", "TCSE002", "TCSE003", "TCSE004", "TCSE005"],
        ("CSE", 3): ["TCSE003", "TCSE004", "TCSE005", "TCSE001", "TCSE002"],
        ("CSE", 4): ["TENG001", "TENG002", "TENG003"],
        ("CSE", 5): ["TDRW001", "TDRW002"],  # Engg Drawing
        # ── CST ──────────────────────────────────────────────────────────────
        ("CST", 0): ["TMAT001", "TMAT002", "TMAT003", "TMAT004"],
        ("CST", 1): ["TPHY001", "TPHY002", "TPHY003"],
        ("CST", 2): ["TCSE002", "TCSE003", "TCST001", "TCST002", "TCST003"],
        ("CST", 3): ["TCST001", "TCST002", "TCST003"],
        ("CST", 4): ["TENG001", "TENG002", "TENG003"],
        ("CST", 5): ["TCST002", "TCST003", "TCST001"],  # Digital Systems
        # ── CS(AI/ML) ────────────────────────────────────────────────────────
        ("CSAIML", 0): ["TMAT002", "TMAT001", "TMAT003", "TMAT004"],   # Stats
        ("CSAIML", 1): ["TMAT004", "TMAT003", "TMAT001", "TMAT002"],   # LinAlg
        ("CSAIML", 2): ["TAIM002", "TAIM003", "TAIM001"],               # Python
        ("CSAIML", 3): ["TAIM001", "TAIM003", "TAIM002"],               # AI
        ("CSAIML", 4): ["TENG002", "TENG001", "TENG003"],
        ("CSAIML", 5): ["TAIM003", "TAIM002", "TAIM001"],               # DST
        # ── ETC ──────────────────────────────────────────────────────────────
        ("ETC", 0): ["TMAT003", "TMAT004", "TMAT001", "TMAT002"],
        ("ETC", 1): ["TPHY003", "TPHY001", "TPHY002"],
        ("ETC", 2): ["TETC001", "TETC002", "TETC003", "TETC004"],
        ("ETC", 3): ["TETC002", "TETC003", "TETC004", "TETC001"],
        ("ETC", 4): ["TENG003", "TENG001", "TENG002"],
        ("ETC", 5): ["TDRW002", "TDRW001", "TETC004"],                  # Drawing; TETC004 as fallback
        # ── EEE ──────────────────────────────────────────────────────────────
        ("EEE", 0): ["TMAT004", "TMAT003", "TMAT001", "TMAT002"],
        ("EEE", 1): ["TPHY002", "TPHY001", "TPHY003"],
        ("EEE", 2): ["TEEE001", "TEEE002", "TEEE003"],
        ("EEE", 3): ["TETC001", "TETC004", "TEEE002", "TEEE003"],       # Basic Electronics shared
        ("EEE", 4): ["TENG001", "TENG003", "TENG002"],
        ("EEE", 5): ["TDRW001", "TDRW002", "TEEE003"],                  # Drawing; TEEE003 as fallback
        # ── CIVIL ─────────────────────────────────────────────────────────────
        ("CIVIL", 0): ["TMAT001", "TMAT002", "TMAT003", "TMAT004"],
        ("CIVIL", 1): ["TPHY001", "TPHY002", "TPHY003"],
        ("CIVIL", 2): ["TCIV001", "TCIV002", "TCIV003"],
        ("CIVIL", 3): ["TCIV002", "TCIV003", "TCIV001"],
        ("CIVIL", 4): ["TENG002", "TENG003", "TENG001"],
        ("CIVIL", 5): ["TDRW002", "TDRW001", "TCIV003"],                # Drawing; TCIV003 as fallback
        # ── MECH ──────────────────────────────────────────────────────────────
        ("MECH", 0): ["TMAT002", "TMAT003", "TMAT004", "TMAT001"],
        ("MECH", 1): ["TPHY001", "TPHY002", "TPHY003"],
        ("MECH", 2): ["TMEC001", "TMEC002", "TMEC003"],
        ("MECH", 3): ["TCIV001", "TMEC002", "TMEC003", "TMEC001"],      # Engg Mechanics shared
        ("MECH", 4): ["TENG003", "TENG001", "TENG002"],
        ("MECH", 5): ["TDRW001", "TDRW002", "TMEC003", "TMEC002"],      # Drawing; MECH teachers as fallback
    }

    tracker = TeacherConflictTracker()

    # section_teacher_map: (branch_code, section_name, subject_idx) -> teacher_profile
    assignment = {}

    for bd in BRANCH_DATA:
        bcode = bd['code']
        sections_info = branches[bcode]['sections']
        for sec_name, section_obj in sections_info.items():
            k = section_obj.global_index
            for sub_idx in range(6):
                pool = POOLS.get((bcode, sub_idx), [])
                assigned = None
                for emp_id in pool:
                    profile = emp_to_profile.get(emp_id)
                    if profile and tracker.can_assign(profile.id, sub_idx, k):
                        tracker.assign(profile.id, sub_idx, k)
                        assigned = profile
                        break
                if assigned is None:
                    # Global fallback: try ANY teacher who has the conflict code free
                    print(f"  [WARN] Pool exhausted for {bcode}-{sec_name} sub_idx={sub_idx} — trying global fallback")
                    for profile in teacher_profiles:
                        if tracker.can_assign(profile.id, sub_idx, k):
                            tracker.assign(profile.id, sub_idx, k)
                            assigned = profile
                            print(f"         → Assigned global fallback: {profile.employee_id}")
                            break

                if assigned is None:
                    # Last resort: first pool teacher, ignore conflict (log error)
                    print(f"  [ERROR] No conflict-free teacher found for {bcode}-{sec_name} sub_idx={sub_idx}")
                    for emp_id in pool:
                        assigned = emp_to_profile.get(emp_id)
                        if assigned:
                            break

                assignment[(bcode, sec_name, sub_idx)] = assigned

    return assignment


def create_schedules(
        branches: dict,
        subjects_by_branch: dict,
        teaching_slots: list,
        teacher_assignment: dict,
) -> None:
    """
    Creates Schedule rows using the rolling timetable formula:
      section k, day d, slot_position s → subject_idx = (s + d + k) % 6
    """
    # teaching_slots: only non-break slots, ordered by slot_number (1,2,3,4,5,6)
    teaching = sorted([ts for ts in teaching_slots if not ts.is_break],
                      key=lambda ts: ts.slot_number)

    days = range(5)   # 0=Mon … 4=Fri
    slots = range(6)  # slot positions 0-5

    existing = Schedule.query.count()
    if existing > 0:
        print(f"  [skip] Schedules already exist ({existing} rows)")
        return

    created = 0
    skipped = 0
    for bd in BRANCH_DATA:
        bcode = bd['code']
        sections_info = branches[bcode]['sections']
        branch_subjects = subjects_by_branch[bcode]   # list of 6 Subject objects

        for sec_name, section_obj in sections_info.items():
            k = section_obj.global_index
            for d in days:
                for s in slots:
                    sub_idx = (s + d + k) % 6
                    subject = branch_subjects[sub_idx]
                    teacher = teacher_assignment.get((bcode, sec_name, sub_idx))
                    if teacher is None:
                        skipped += 1
                        continue
                    ts = teaching[s]
                    sched = Schedule(
                        section_id=section_obj.id,
                        subject_id=subject.id,
                        teacher_id=teacher.id,
                        time_slot_id=ts.id,
                        day_of_week=d,
                        academic_year=ACADEMIC_YEAR,
                        semester=SEMESTER,
                        room_number=section_obj.room_number,
                    )
                    db.session.add(sched)
                    created += 1

    try:
        db.session.flush()
        print(f"  [+] Created {created} schedule entries (skipped {skipped})")
    except Exception as e:
        db.session.rollback()
        print(f"  [ERROR] Schedule flush failed: {e}")
        raise


def create_students(branches: dict) -> list:
    """
    Creates 45 students per section (15 sections × 45 = 675 students).
    Returns list of dicts for credential file generation.
    """
    records = []
    for bd in BRANCH_DATA:
        bcode = bd['code']
        branch_obj = branches[bcode]['obj']
        sections_info = branches[bcode]['sections']

        roll_counter = 1
        for sec_name in bd['sections']:  # preserve order A, B, C
            section_obj = sections_info[sec_name]
            for i in range(45):
                seq = (roll_counter - 1)
                full_name = gen_student_name(seq + (hash(bcode + sec_name) % 300))
                roll = f"{bcode}{2024}{roll_counter:03d}"
                reg = f"REG{bcode}2024{roll_counter:04d}"
                username = roll.lower()
                password = "Stud@2024"
                email = f"{username}@tat.edu.in"

                if Student.query.filter_by(roll_number=roll).first():
                    roll_counter += 1
                    records.append({
                        "branch": bcode, "section": sec_name,
                        "roll": roll, "name": full_name,
                        "username": username, "password": password,
                        "reg": reg,
                    })
                    continue

                user = User(
                    username=username,
                    password=password,
                    role='student',
                    name=full_name,
                    email=email,
                )
                db.session.add(user)
                db.session.flush()

                student = Student(
                    user_id=user.id,
                    roll_number=roll,
                    reg_number=reg,
                    department=bd['name'],
                    college=COLLEGE_NAME,
                    class_name=bcode,
                    section=sec_name,
                    branch_id=branch_obj.id,
                    section_id=section_obj.id,
                    current_semester=SEMESTER,
                )
                db.session.add(student)
                db.session.flush()

                records.append({
                    "branch": bcode, "section": sec_name,
                    "roll": roll, "name": full_name,
                    "username": username, "password": password,
                    "reg": reg,
                })
                roll_counter += 1

    print(f"  [+] Created/verified {len(records)} students")
    return records


# ═══════════════════════════════════════════════════════════════════════════════
#  CREDENTIAL FILE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def write_credentials(student_records: list, teacher_data_list: list,
                      branches: dict, teacher_assignment: dict) -> str:
    """Writes all credential files. Returns the root credentials folder path."""
    root = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'credentials')
    os.makedirs(root, exist_ok=True)

    # ── 1. Admin ──────────────────────────────────────────────────────────────
    admin_dir = os.path.join(root, 'admin')
    os.makedirs(admin_dir, exist_ok=True)
    with open(os.path.join(admin_dir, 'admin_credentials.txt'), 'w') as f:
        f.write(f"""
╔══════════════════════════════════════════════════════════════╗
║       COLLEGE ADMIN CREDENTIALS — TRIDENT ACADEMY OF TECHNOLOGY          ║
╚══════════════════════════════════════════════════════════════╝

Role       : College Administrator (SUPER ADMIN)
Username   : college_admin
Password   : Admin@2024
Email      : admin@tat.edu.in
Access     : Complete system — Add/Edit/Delete Students, Teachers,
             Branches, Sections, Subjects, Schedules, Attendance
Login URL  : http://localhost:5173
""".strip())
    print("  [+] Admin credentials written")

    # ── 2. Teachers ───────────────────────────────────────────────────────────
    teacher_dir = os.path.join(root, 'teachers')
    os.makedirs(teacher_dir, exist_ok=True)

    # Group by dept
    by_dept: dict = {}
    for td in teacher_data_list:
        by_dept.setdefault(td['dept'], []).append(td)

    all_teacher_rows = []
    for dept, teachers in by_dept.items():
        dept_file = os.path.join(teacher_dir, f"{dept}_teachers.csv")
        with open(dept_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "Employee ID", "Name", "Username", "Password",
                "Department", "Qualification", "Specialization", "Email"
            ])
            for td in teachers:
                row = [
                    td['emp'], td['name'], td['emp'].lower(), "Teacher@2024",
                    td['dept'], td['qual'], td['spec'],
                    f"{td['emp'].lower()}@tat.edu.in",
                ]
                writer.writerow(row)
                all_teacher_rows.append(row)

    # Master all-teachers file
    with open(os.path.join(teacher_dir, 'ALL_TEACHERS.csv'), 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            "Employee ID", "Name", "Username", "Password",
            "Department", "Qualification", "Specialization", "Email"
        ])
        for row in all_teacher_rows:
            writer.writerow(row)
    print(f"  [+] Teacher credentials written ({len(all_teacher_rows)} teachers)")

    # ── 3. Students ───────────────────────────────────────────────────────────
    student_dir = os.path.join(root, 'students')
    os.makedirs(student_dir, exist_ok=True)

    # Group by branch → section
    grouped: dict = {}
    for rec in student_records:
        grouped.setdefault(rec['branch'], {}).setdefault(rec['section'], []).append(rec)

    for branch_code, sections in grouped.items():
        branch_dir = os.path.join(student_dir, branch_code)
        os.makedirs(branch_dir, exist_ok=True)

        # Master file for the branch
        with open(os.path.join(branch_dir, f'{branch_code}_ALL.csv'), 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "Roll Number", "Reg Number", "Full Name",
                "Username", "Password", "Section", "Branch",
                "Semester", "Email"
            ])
            for sec_name in sorted(sections.keys()):
                for rec in sections[sec_name]:
                    writer.writerow([
                        rec['roll'], rec['reg'], rec['name'],
                        rec['username'], rec['password'],
                        sec_name, branch_code, SEMESTER,
                        f"{rec['username']}@tat.edu.in",
                    ])

        # Per-section files
        for sec_name, recs in sections.items():
            sec_file = os.path.join(branch_dir, f"Section_{sec_name}.csv")
            with open(sec_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Sr#", "Roll Number", "Reg Number", "Full Name",
                    "Username", "Password", "Branch-Section",
                    "Semester", "Email"
                ])
                for idx, rec in enumerate(recs, 1):
                    writer.writerow([
                        idx, rec['roll'], rec['reg'], rec['name'],
                        rec['username'], rec['password'],
                        f"{branch_code}-{sec_name}",
                        SEMESTER, f"{rec['username']}@tat.edu.in",
                    ])

    total_students = len(student_records)
    print(f"  [+] Student credentials written ({total_students} students)")

    # ── 4. Master index ───────────────────────────────────────────────────────
    with open(os.path.join(root, 'README.txt'), 'w') as f:
        f.write(f"""
╔══════════════════════════════════════════════════════════════════╗
║   TRIDENT ACADEMY OF TECHNOLOGY OF TECHNOLOGY — CREDENTIAL DIRECTORY          ║
╚══════════════════════════════════════════════════════════════════╝

Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
System    : College Attendance Management System (CAMS)
Login URL : http://localhost:5173

FOLDER STRUCTURE
─────────────────
credentials/
├── admin/
│   └── admin_credentials.txt        ← College Admin login
├── teachers/
│   ├── ALL_TEACHERS.csv             ← All 35 teachers (master)
│   ├── Mathematics_teachers.csv
│   ├── Physics_teachers.csv
│   ├── English_teachers.csv
│   ├── Drawing_teachers.csv
│   ├── CSE_teachers.csv
│   ├── CST_teachers.csv
│   ├── CSAIML_teachers.csv
│   ├── ETC_teachers.csv
│   ├── EEE_teachers.csv
│   ├── CIVIL_teachers.csv
│   └── MECH_teachers.csv
└── students/
    ├── CSE/  (Sections A, B, C — 45 each)
    ├── CST/  (Sections A, B)
    ├── CSAIML/
    ├── ETC/
    ├── EEE/
    ├── CIVIL/
    └── MECH/

DEFAULT PASSWORDS
─────────────────
Admin   : Admin@2024
Teachers: Teacher@2024
Students: Stud@2024

NOTE: Admin should change all passwords after first login.
      Admin distributes section CSV files to respective class teachers,
      who then hand individual credentials to each student.

TOTAL USERS
────────────
Admin    : 1
Teachers : 35
Students : {total_students} (across 15 sections)
""".strip())

    return root


# ═══════════════════════════════════════════════════════════════════════════════
#  TIMETABLE EXPORT (human-readable)
# ═══════════════════════════════════════════════════════════════════════════════

DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

def export_timetable(branches: dict, subjects_by_branch: dict,
                     teaching_slots: list, teacher_assignment: dict,
                     root_dir: str):
    """Writes a human-readable timetable CSV per branch/section."""
    tt_dir = os.path.join(root_dir, 'timetables')
    os.makedirs(tt_dir, exist_ok=True)

    teaching = sorted([ts for ts in teaching_slots if not ts.is_break],
                      key=lambda ts: ts.slot_number)
    slot_labels = [f"{ts.start_time}-{ts.end_time}" for ts in teaching]

    for bd in BRANCH_DATA:
        bcode = bd['code']
        sections_info = branches[bcode]['sections']
        branch_subjects = subjects_by_branch[bcode]

        for sec_name, section_obj in sections_info.items():
            k = section_obj.global_index
            fname = os.path.join(tt_dir, f"Timetable_{bcode}_{sec_name}.csv")
            with open(fname, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(
                    ['Day / Time'] +
                    slot_labels[:3] + ['LUNCH BREAK (13:00-14:00)'] + slot_labels[3:]
                )
                for d in range(5):
                    row = [DAY_NAMES[d]]
                    for s in range(3):
                        sub_idx = (s + d + k) % 6
                        subj = branch_subjects[sub_idx]
                        teacher = teacher_assignment.get((bcode, sec_name, sub_idx))
                        t_name = teacher.user.name.split()[-1] if teacher and teacher.user else '?'
                        row.append(f"{subj.code}\n({t_name})")
                    row.append('—')  # break column
                    for s in range(3, 6):
                        sub_idx = (s + d + k) % 6
                        subj = branch_subjects[sub_idx]
                        teacher = teacher_assignment.get((bcode, sec_name, sub_idx))
                        t_name = teacher.user.name.split()[-1] if teacher and teacher.user else '?'
                        row.append(f"{subj.code}\n({t_name})")
                    writer.writerow(row)
    print(f"  [+] Timetables exported to {tt_dir}/")


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    app = create_app()
    with app.app_context():
        print("\n" + "="*60)
        print("  CAMS — College Database Seeder")
        print("="*60)

        # Drop & recreate all tables for a clean seed
        print("\n[1/8] Recreating database tables …")
        db.drop_all()
        db.create_all()

        # ── Admin ────────────────────────────────────────────────────────────
        print("\n[2/8] Creating Admin …")
        create_admin()
        db.session.commit()

        # ── Structure ────────────────────────────────────────────────────────
        print("\n[3/8] Creating Branches & Sections …")
        branches = create_branches_and_sections()
        db.session.commit()

        # ── Time Slots ───────────────────────────────────────────────────────
        print("\n[4/8] Creating Time Slots …")
        all_time_slots = create_time_slots()
        db.session.commit()

        # ── Subjects ─────────────────────────────────────────────────────────
        print("\n[5/8] Creating Subjects …")
        subjects_by_branch = create_subjects(branches)
        db.session.commit()

        # ── Teachers ─────────────────────────────────────────────────────────
        print("\n[6/8] Creating Teachers …")
        teacher_profiles = create_teachers(branches)
        db.session.commit()

        # ── Teacher→Subject assignment ────────────────────────────────────────
        print("\n[6b] Assigning Teachers to Subjects (conflict-free) …")
        teacher_assignment = assign_teachers_to_subjects(
            teacher_profiles, subjects_by_branch, branches
        )

        # ── Schedules ─────────────────────────────────────────────────────────
        print("\n[7/8] Creating Schedules …")
        create_schedules(branches, subjects_by_branch,
                         all_time_slots, teacher_assignment)
        db.session.commit()

        # ── Students ──────────────────────────────────────────────────────────
        print("\n[8/8] Creating Students (675 students — 45 per section) …")
        student_records = create_students(branches)
        db.session.commit()

        # ── Credential files ──────────────────────────────────────────────────
        print("\n[+] Writing Credential Files …")
        cred_root = write_credentials(
            student_records, TEACHER_DATA, branches, teacher_assignment
        )

        # ── Timetable export ──────────────────────────────────────────────────
        print("\n[+] Exporting Timetables …")
        export_timetable(
            branches, subjects_by_branch,
            all_time_slots, teacher_assignment, cred_root
        )

        # ── Summary ───────────────────────────────────────────────────────────
        print("\n" + "="*60)
        print("  SEED COMPLETE — Summary")
        print("="*60)
        print(f"  Branches    : {Branch.query.count()}")
        print(f"  Sections    : {Section.query.count()}")
        print(f"  Time Slots  : {TimeSlot.query.count()}")
        print(f"  Subjects    : {Subject.query.count()}")
        print(f"  Teachers    : {TeacherProfile.query.count()}")
        print(f"  Schedules   : {Schedule.query.count()}")
        print(f"  Students    : {Student.query.count()}")
        print(f"  Total Users : {User.query.count()}")
        print(f"\n  Credentials : {cred_root}/")
        print(f"\n  Admin Login  → college_admin / Admin@2024")
        print(f"  Teacher Login→ tmat001 / Teacher@2024  (example)")
        print(f"  Student Login→ cse2024001 / Stud@2024  (example)")
        print("="*60 + "\n")


if __name__ == '__main__':
    main()
