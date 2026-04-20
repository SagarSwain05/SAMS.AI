#!/usr/bin/env python3
"""
simulate_attendance.py
══════════════════════════════════════════════════════════════════════════════
Generate 3 months of realistic period-wise attendance for ALL 675 students
across all 15 sections of Trident Academy of Technology.

Date range: 2026-02-02 (Monday) → 2026-04-18 (Friday = yesterday)
  ≈ 54 school days × 15 sections × 45 students × 6 subjects ≈ 218,700 records

Student attendance profiles (seeded by student_id for consistency):
  - 10% "at-risk"    → 55–67% base attendance
  - 20% "borderline" → 68–74%
  - 50% "good"       → 75–88%
  - 20% "excellent"  → 89–97%

Extra realism:
  - Sick weeks: 4% chance per student per week → entire week absent
  - Random weekly drift ±5%
  - recent 3 weeks: marked_by=face_recognition with confidence score
  - older records: marked_by=manual
  - late status: ~4% of "present" records

Run:
    cd /Users/sagarswain/StudentManagementSystem/backend
    source venv/bin/activate
    python simulate_attendance.py

Re-running is safe — it clears previous simulation data in the date range first.
══════════════════════════════════════════════════════════════════════════════
"""
import sys, os, random
from datetime import date, time as time_cls, timedelta, datetime

# ── Path + Flask setup ────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('FLASK_ENV', 'development')

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app import create_app
from app.models import db, Student, Section, Schedule, TimeSlot

app = create_app()

# ── Parameters ────────────────────────────────────────────────────────────────
START_DATE = date(2026, 2, 2)
END_DATE   = date(2026, 4, 18)  # yesterday (system goes live today Apr 19)

# Public holidays in India / college calendar (skip classes)
HOLIDAYS = {
    date(2026, 2, 19),  # Chhatrapati Shivaji Jayanti
    date(2026, 3, 10),  # Holi eve
    date(2026, 3, 25),  # Holi
    date(2026, 4, 6),   # Ram Navami
    date(2026, 4, 10),  # Good Friday
    date(2026, 4, 14),  # Ambedkar Jayanti / Dr. B.R. Ambedkar
}

BATCH_SIZE = 8_000

# ── Helpers ───────────────────────────────────────────────────────────────────

def school_days(start: date, end: date):
    d = start
    while d <= end:
        if d.weekday() < 5 and d not in HOLIDAYS:
            yield d
        d += timedelta(days=1)


def base_rate(student_id: int) -> float:
    """Deterministic attendance rate for a student (seeded by id)."""
    rng = random.Random(student_id * 31337 + 7919)
    bucket = rng.random()
    if bucket < 0.10:
        return rng.uniform(0.55, 0.67)   # at-risk
    elif bucket < 0.30:
        return rng.uniform(0.68, 0.74)   # borderline
    elif bucket < 0.80:
        return rng.uniform(0.75, 0.88)   # good
    else:
        return rng.uniform(0.89, 0.97)   # excellent


def day_record_time(start_time_str: str, offset_minutes: int = 5) -> time_cls:
    """Convert slot start_time string '10:00' to a time object."""
    try:
        h, m = map(int, start_time_str.split(':'))
        return time_cls(h, m + offset_minutes)
    except Exception:
        return time_cls(10, 5)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with app.app_context():
        print("=" * 60)
        print("  Trident Academy Attendance Simulator")
        print(f"  Range: {START_DATE} → {END_DATE}")
        print("=" * 60)

        # ── 1. Clear previous simulation data in range ────────────────────
        print("\n[1/5] Clearing previous simulation records…")
        result = db.session.execute(
            db.text(
                "DELETE FROM attendance_logs "
                "WHERE date >= :s AND date <= :e"
            ),
            {'s': START_DATE, 'e': END_DATE}
        )
        db.session.commit()
        print(f"      Removed {result.rowcount} old records")

        # ── 2. Load schedule data ─────────────────────────────────────────
        print("[2/5] Loading sections, schedules, students…")
        sections = Section.query.order_by(Section.global_index).all()

        # Load time slots for start-time lookup
        slots_by_id = {s.id: s for s in TimeSlot.query.all()}

        # sched_index: section_id → day_of_week → [(subject_id, slot_id)]
        sched_index: dict = {}
        for sched in Schedule.query.all():
            sched_index.setdefault(sched.section_id, {}) \
                       .setdefault(sched.day_of_week, []) \
                       .append((sched.subject_id, sched.time_slot_id))

        # student_index: section_id → [student_id, ...]
        student_index: dict = {}
        for stu in Student.query.all():
            if stu.section_id:
                student_index.setdefault(stu.section_id, []).append(stu.id)

        total_students = sum(len(v) for v in student_index.values())
        all_days = list(school_days(START_DATE, END_DATE))
        print(f"      Sections: {len(sections)}  |  Students: {total_students}  |  School days: {len(all_days)}")

        # ── 3. Pre-compute per-student base rates ─────────────────────────
        print("[3/5] Computing student attendance profiles…")
        profiles = {stu_id: base_rate(stu_id)
                    for stu_ids in student_index.values()
                    for stu_id in stu_ids}

        # Per-student "sick week" set: (student_id, iso_week) → bool
        sick_rng_master = random.Random(0xDEADBEEF)

        def is_sick(student_id: int, iso_week: int) -> bool:
            # Deterministic: seed from student + week
            r = random.Random(student_id * 999983 + iso_week * 7)
            return r.random() < 0.04  # 4% chance per student per week

        # ── 4. Generate records ───────────────────────────────────────────
        print("[4/5] Generating attendance records (this may take ~30 s)…")
        batch: list = []
        total_inserted = 0
        total_expected = sum(
            len(student_index.get(sec.id, [])) *
            len(sched_index.get(sec.id, {}).get(d.weekday(), []))
            for d in all_days
            for sec in sections
        )
        print(f"      Expected ≈ {total_expected:,} records")

        for day in all_days:
            dow = day.weekday()
            iso_week = day.isocalendar()[1]
            days_ago = (END_DATE - day).days

            for sec in sections:
                sec_id = sec.id
                day_scheds = sched_index.get(sec_id, {}).get(dow, [])
                if not day_scheds:
                    continue
                students_in_sec = student_index.get(sec_id, [])
                if not students_in_sec:
                    continue

                for stu_id in students_in_sec:
                    rate    = profiles.get(stu_id, 0.80)
                    sick    = is_sick(stu_id, iso_week)
                    day_rng = random.Random(stu_id * 179426549 + day.toordinal())

                    # Weekly drift: ±6%
                    week_rng = random.Random(stu_id * 104723 + iso_week)
                    weekly_drift = week_rng.uniform(-0.06, 0.06)
                    effective_rate = max(0.0, min(1.0, rate + weekly_drift))

                    for subj_id, slot_id in day_scheds:
                        if sick:
                            status = 'absent'
                            confidence = None
                            marked_by  = 'manual'
                        else:
                            roll = day_rng.random()
                            if roll < effective_rate * 0.96:
                                status = 'present'
                            elif roll < effective_rate:
                                status = 'late'
                            else:
                                status = 'absent'

                            if days_ago <= 21:
                                marked_by  = 'face_recognition'
                                confidence = (round(day_rng.uniform(0.81, 0.99), 3)
                                              if status == 'present' else None)
                            else:
                                marked_by  = 'manual'
                                confidence = None

                        # Time from slot start
                        slot = slots_by_id.get(slot_id)
                        rec_time = day_record_time(slot.start_time if slot else '10:00',
                                                   day_rng.randint(0, 12))

                        batch.append({
                            'student_id':       stu_id,
                            'subject_id':       subj_id,
                            'date':             day,
                            'time':             rec_time,
                            'status':           status,
                            'confidence_score': confidence,
                            'marked_by':        marked_by,
                            'entry_time':       None,
                            'exit_time':        None,
                            'notes':            None,
                            'created_at':       datetime.utcnow(),
                            'updated_at':       datetime.utcnow(),
                        })

                        if len(batch) >= BATCH_SIZE:
                            db.session.execute(
                                db.text(
                                    "INSERT INTO attendance_logs "
                                    "(student_id, subject_id, date, time, status, "
                                    " confidence_score, marked_by, entry_time, exit_time, "
                                    " notes, created_at, updated_at) "
                                    "VALUES (:student_id, :subject_id, :date, :time, :status, "
                                    " :confidence_score, :marked_by, :entry_time, :exit_time, "
                                    " :notes, :created_at, :updated_at)"
                                ),
                                batch
                            )
                            db.session.commit()
                            total_inserted += len(batch)
                            pct = total_inserted / max(total_expected, 1) * 100
                            print(f"      {total_inserted:>8,} / {total_expected:,}  ({pct:.1f}%)")
                            batch = []

        # Final batch
        if batch:
            db.session.execute(
                db.text(
                    "INSERT INTO attendance_logs "
                    "(student_id, subject_id, date, time, status, "
                    " confidence_score, marked_by, entry_time, exit_time, "
                    " notes, created_at, updated_at) "
                    "VALUES (:student_id, :subject_id, :date, :time, :status, "
                    " :confidence_score, :marked_by, :entry_time, :exit_time, "
                    " :notes, :created_at, :updated_at)"
                ),
                batch
            )
            db.session.commit()
            total_inserted += len(batch)

        # ── 5. Summary ────────────────────────────────────────────────────
        print(f"\n[5/5] ✓ Done!")
        print(f"      Total records inserted: {total_inserted:,}")
        print(f"      School days covered:    {len(all_days)}")
        print(f"      Students covered:       {total_students}")
        print()
        print("  Analytics and charts should now show 2-3 months of data.")
        print("  From today (Apr 19) onward, real recognition data takes over.")
        print("=" * 60)


if __name__ == '__main__':
    main()
