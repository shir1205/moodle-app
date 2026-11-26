"""Analytics Router (Team 4 - Story #7: Identify at-risk students)."""
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client, create_client

from rbac import require_lecturer

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def get_supabase() -> Client:
    """Connect to Supabase using credentials from the .env file."""
    url: Optional[str] = os.environ.get("SUPABASE_URL")
    key: Optional[str] = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("Supabase credentials not found in environment variables")
    return create_client(url, key)


def _extract_submission_grade(
    submission: dict[str, Any],
    grades_by_submission_id: Optional[dict[str, float]] = None,
) -> Optional[float]:
    """
    Extract grade for a submission from public.submission_grades (mapped by
    submission_id), falling back to submission.get("grade") if present.
    """
    submission_id = submission.get("id")
    if grades_by_submission_id and submission_id in grades_by_submission_id:
        return grades_by_submission_id[submission_id]

    raw_grade = submission.get("grade")
    if raw_grade is None:
        return None
    try:
        return float(raw_grade)
    except (TypeError, ValueError):
        return None


def _filter_assignments_for_student(
    assignments: list[dict[str, Any]],
    student_id: str,
    course_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    # TODO (Team 2 schema): Filter by student enrollments once Team 2 adds
    # 'courses' and 'enrollments' tables in Supabase.
    """
    del student_id  # Reserved for upcoming enrollments table lookup
    published = [
        a
        for a in assignments
        if (a.get("status") or "published").strip().lower() == "published"
    ]
    if course_id:
        return [a for a in published if a.get("course_id") == course_id]
    return published


def _parse_due_date(raw_due_date: Optional[str]) -> Optional[datetime]:
    if not raw_due_date:
        return None
    try:
        parsed = datetime.fromisoformat(raw_due_date.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


@router.get("/at-risk")
async def get_at_risk_students(
    course_id: Optional[str] = None,
    min_grade_threshold: float = Query(default=60.0, ge=0.0, le=100.0),
    missed_submissions_threshold: int = Query(default=2, ge=1),
    current_user: dict = Depends(require_lecturer),
):
    """Identify at-risk students based on low grade average or missed past-due assignments."""
    del current_user  # Enforced via rbac.require_lecturer (lecturer/admin)

    normalized_course_id = course_id.strip() if course_id and course_id.strip() else None

    try:
        supabase = get_supabase()
        users_res = supabase.table("users").select("id, email, full_name, role").execute()
        assignments_res = supabase.table("assignments").select("*").execute()
        submissions_res = supabase.table("submissions").select("*").execute()
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (GET /analytics/at-risk): {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch analytics data from Supabase",
        )

    users = users_res.data or []
    assignments = assignments_res.data or []
    submissions = submissions_res.data or []

    grades_by_submission_id: dict[str, float] = {}
    try:
        grades_res = (
            supabase.table("submission_grades")
            .select("submission_id, grade")
            .execute()
        )
        for grade_row in grades_res.data or []:
            sub_id = grade_row.get("submission_id")
            raw_grade = grade_row.get("grade")
            if sub_id and raw_grade is not None:
                try:
                    grades_by_submission_id[sub_id] = float(raw_grade)
                except (TypeError, ValueError):
                    continue
    except Exception as e:
        print(
            "Warning: unable to fetch submission_grades (using submissions.grade fallback): "
            f"{e}"
        )

    students = [
        u for u in users if (u.get("role") or "").strip().lower() == "student"
    ]
    assignment_by_id = {a.get("id"): a for a in assignments if a.get("id")}
    now_utc = datetime.now(timezone.utc)

    at_risk_students: list[dict[str, Any]] = []

    for student in students:
        student_id = student.get("id")
        if not student_id:
            continue

        relevant_assignments = _filter_assignments_for_student(
            assignments, student_id, normalized_course_id
        )
        relevant_assignment_ids = {
            a.get("id") for a in relevant_assignments if a.get("id")
        }

        student_submissions = [
            s
            for s in submissions
            if s.get("student_id") == student_id
            and (
                normalized_course_id is None
                or s.get("assignment_id") in relevant_assignment_ids
            )
        ]

        grades = [
            grade
            for sub in student_submissions
            if (grade := _extract_submission_grade(sub, grades_by_submission_id)) is not None
        ]
        average_grade: Optional[float] = (
            round(sum(grades) / len(grades), 2) if grades else None
        )

        submitted_assignment_ids = {
            s.get("assignment_id")
            for s in student_submissions
            if s.get("assignment_id")
        }

        missed_assignments_count = 0
        involved_courses: set[str] = set()

        for assignment in relevant_assignments:
            due_dt = _parse_due_date(assignment.get("due_date"))
            if due_dt is not None and due_dt < now_utc:
                if assignment.get("id") not in submitted_assignment_ids:
                    missed_assignments_count += 1
                    if assignment.get("course_id"):
                        involved_courses.add(assignment["course_id"])

        for sub in student_submissions:
            linked_assignment = assignment_by_id.get(sub.get("assignment_id"))
            if linked_assignment and linked_assignment.get("course_id"):
                involved_courses.add(linked_assignment["course_id"])

        is_low_grade = (
            average_grade is not None and average_grade < min_grade_threshold
        )
        is_missed_excessive = missed_assignments_count >= missed_submissions_threshold

        if not (is_low_grade or is_missed_excessive):
            continue

        risk_reasons: list[str] = []
        if is_low_grade:
            risk_reasons.append(
                f"ממוצע ציונים נמוך ({average_grade} < {min_grade_threshold})"
            )
        if is_missed_excessive:
            risk_reasons.append(
                f"אי-הגשת {missed_assignments_count} מטלות שמועדן חלף"
            )

        if (
            (is_low_grade and is_missed_excessive)
            or (average_grade is not None and average_grade < 50)
            or missed_assignments_count >= 3
        ):
            severity = "high"
        else:
            severity = "medium"

        sorted_courses = sorted(involved_courses)
        primary_course_id = normalized_course_id or (
            sorted_courses[0] if sorted_courses else None
        )

        at_risk_students.append(
            {
                "student_id": student_id,
                "full_name": student.get("full_name") or "",
                "email": student.get("email") or "",
                "average_grade": average_grade,
                "missed_assignments_count": missed_assignments_count,
                "risk_reasons": risk_reasons,
                "course_id": primary_course_id,
                "courses": sorted_courses,
                "severity": severity,
            }
        )

    return at_risk_students
