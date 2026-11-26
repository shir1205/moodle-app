"""Analytics Router (Team 4 - Story #7: At-risk students, Story #37: Personal progress & grades)."""
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client, create_client

from rbac import UserRole, require_lecturer, require_roles

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Explicit RBAC dependency per Wiki matrix: student & admin only (blocks lecturer with 403)
require_student_or_admin = require_roles(UserRole.STUDENT, UserRole.ADMIN)


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


def _fetch_published_grades(
    supabase: Client,
) -> tuple[dict[str, dict[str, Any]], set[str]]:
    """
    Fetch published grades from public.submission_grades (published_at IS NOT NULL).
    Returns:
      - published_grades: mapping submission_id -> {grade, feedback, published_at}
      - unpublished_ids: submission_ids that exist in submission_grades with published_at IS NULL
    Falls back cleanly to empty dicts if submission_grades is blocked by RLS or unavailable.
    """
    published_grades: dict[str, dict[str, Any]] = {}
    unpublished_ids: set[str] = set()
    try:
        grades_res = (
            supabase.table("submission_grades")
            .select("submission_id, grade, feedback, published_at")
            .execute()
        )
        for grade_row in grades_res.data or []:
            sub_id = grade_row.get("submission_id")
            if not sub_id:
                continue

            published_at = grade_row.get("published_at")
            if published_at is None:
                unpublished_ids.add(sub_id)
                continue

            raw_grade = grade_row.get("grade")
            if raw_grade is None:
                continue
            try:
                grade_val = float(raw_grade)
            except (TypeError, ValueError):
                continue

            published_grades[sub_id] = {
                "grade": grade_val,
                "feedback": grade_row.get("feedback"),
                "published_at": published_at,
            }
    except Exception as e:
        print(
            "Warning: unable to fetch submission_grades (using submissions.grade fallback): "
            f"{e}"
        )

    return published_grades, unpublished_ids


def _resolve_published_grade(
    submission: dict[str, Any],
    published_grades: dict[str, dict[str, Any]],
    unpublished_ids: set[str],
) -> tuple[Optional[float], Optional[str], Optional[str]]:
    """
    Resolve (grade, feedback, published_at) for a single submission.
    Explicitly hides grades whose submission_id is marked unpublished (published_at IS NULL).
    """
    sub_id = submission.get("id")
    if sub_id and sub_id in unpublished_ids:
        return None, None, None

    if sub_id and sub_id in published_grades:
        entry = published_grades[sub_id]
        return entry["grade"], entry.get("feedback"), entry.get("published_at")

    # Fallback if submission_grades is blocked by RLS and submissions has a legacy grade field
    raw_grade = submission.get("grade")
    if raw_grade is None:
        return None, None, None
    try:
        return float(raw_grade), submission.get("feedback"), submission.get("updated_at")
    except (TypeError, ValueError):
        return None, None, None


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


@router.get("/me/progress")
async def get_my_progress(
    course_id: Optional[str] = None,
    current_user: dict = Depends(require_student_or_admin),
):
    """
    Story #37 (4.2.1): Return personal grades, average grade, and completion
    percentage strictly for the authenticated student.
    """
    student_id = current_user.get("user_id") or current_user.get("id")
    if not student_id:
        raise HTTPException(status_code=401, detail="לא ניתן לזהות את המשתמש המחובר")

    normalized_course_id = (
        course_id.strip()
        if course_id and course_id.strip() and course_id.strip().lower() != "all"
        else None
    )

    try:
        supabase = get_supabase()
        assignments_res = supabase.table("assignments").select("*").execute()
        # Filter submissions strictly by the authenticated user's ID
        submissions_res = (
            supabase.table("submissions")
            .select("*")
            .eq("student_id", student_id)
            .execute()
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (GET /analytics/me/progress): {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch student progress data from Supabase",
        )

    all_assignments = assignments_res.data or []
    student_submissions = [
        s for s in (submissions_res.data or []) if s.get("student_id") == student_id
    ]
    published_grades, unpublished_ids = _fetch_published_grades(supabase)

    all_published_assignments = _filter_assignments_for_student(
        all_assignments, student_id, course_id=None
    )
    available_courses = sorted(
        {
            a["course_id"]
            for a in all_published_assignments
            if a.get("course_id")
        }
    )

    relevant_assignments = (
        [a for a in all_published_assignments if a.get("course_id") == normalized_course_id]
        if normalized_course_id
        else all_published_assignments
    )

    # Map each assignment_id to the best/latest submission for the current student
    submission_by_assignment: dict[str, dict[str, Any]] = {}
    for sub in student_submissions:
        a_id = sub.get("assignment_id")
        if not a_id:
            continue
        existing = submission_by_assignment.get(a_id)
        if existing is None:
            submission_by_assignment[a_id] = sub
            continue

        # Prefer a submission with a published grade; otherwise prefer the latest submitted_at
        new_grade, _, _ = _resolve_published_grade(sub, published_grades, unpublished_ids)
        old_grade, _, _ = _resolve_published_grade(existing, published_grades, unpublished_ids)
        if new_grade is not None and old_grade is None:
            submission_by_assignment[a_id] = sub
        elif (sub.get("submitted_at") or "") > (existing.get("submitted_at") or ""):
            submission_by_assignment[a_id] = sub

    now_utc = datetime.now(timezone.utc)
    assignment_grades: list[dict[str, Any]] = []
    upcoming_assignments: list[dict[str, Any]] = []
    graded_values: list[float] = []
    completed_assignments_count = 0

    # Per-course aggregation across all relevant assignments
    course_buckets: dict[str, dict[str, Any]] = {}

    for assignment in relevant_assignments:
        a_id = assignment.get("id")
        if not a_id:
            continue

        a_course_id = assignment.get("course_id") or "general"
        bucket = course_buckets.setdefault(
            a_course_id,
            {
                "course_id": a_course_id,
                "total_assignments_count": 0,
                "completed_assignments_count": 0,
                "grades": [],
            },
        )
        bucket["total_assignments_count"] += 1

        sub = submission_by_assignment.get(a_id)
        is_submitted = (
            sub is not None
            and (sub.get("status") or "submitted").strip().lower() != "not_submitted"
        )
        if is_submitted:
            completed_assignments_count += 1
            bucket["completed_assignments_count"] += 1

        grade_val: Optional[float] = None
        feedback_val: Optional[str] = None
        published_at_val: Optional[str] = None
        if sub is not None:
            grade_val, feedback_val, published_at_val = _resolve_published_grade(
                sub, published_grades, unpublished_ids
            )
            if grade_val is not None:
                graded_values.append(grade_val)
                bucket["grades"].append(grade_val)

        max_grade_raw = assignment.get("max_grade")
        try:
            max_grade = float(max_grade_raw) if max_grade_raw is not None else 100.0
        except (TypeError, ValueError):
            max_grade = 100.0

        assignment_grades.append(
            {
                "assignment_id": a_id,
                "course_id": a_course_id,
                "assignment_title": assignment.get("title") or a_id,
                "due_date": assignment.get("due_date"),
                "max_grade": max_grade,
                "status": (sub.get("status") if sub else "not_submitted"),
                "submitted_at": sub.get("submitted_at") if sub else None,
                "student_grade": grade_val,
                "feedback": feedback_val,
                "published_at": published_at_val,
            }
        )

        due_dt = _parse_due_date(assignment.get("due_date"))
        if due_dt is not None and due_dt > now_utc:
            upcoming_assignments.append(
                {
                    "id": a_id,
                    "course_id": a_course_id,
                    "title": assignment.get("title") or a_id,
                    "due_date": assignment.get("due_date"),
                    "max_grade": max_grade,
                    "is_submitted": is_submitted,
                }
            )

    upcoming_assignments.sort(key=lambda item: item.get("due_date") or "")

    total_assignments_count = len(assignment_grades)
    completion_rate_percent = (
        min(100.0, round((completed_assignments_count / total_assignments_count) * 100, 1))
        if total_assignments_count > 0
        else 0.0
    )

    has_grades = len(graded_values) > 0
    student_average: Optional[float] = (
        round(sum(graded_values) / len(graded_values), 2) if has_grades else None
    )

    courses_summary: list[dict[str, Any]] = []
    for cid in sorted(course_buckets.keys()):
        b = course_buckets[cid]
        total_c = b["total_assignments_count"]
        comp_c = b["completed_assignments_count"]
        c_grades = b["grades"]
        courses_summary.append(
            {
                "course_id": cid,
                "total_assignments_count": total_c,
                "completed_assignments_count": comp_c,
                "completion_rate_percent": (
                    min(100.0, round((comp_c / total_c) * 100, 1)) if total_c > 0 else 0.0
                ),
                "graded_assignments_count": len(c_grades),
                "average_grade": (
                    round(sum(c_grades) / len(c_grades), 2) if c_grades else None
                ),
            }
        )

    return {
        "student_id": student_id,
        "course_id": normalized_course_id,
        "available_courses": available_courses,
        "completion_rate_percent": completion_rate_percent,
        "completed_assignments_count": completed_assignments_count,
        "total_assignments_count": total_assignments_count,
        "graded_assignments_count": len(graded_values),
        "student_average": student_average,
        "has_grades": has_grades,
        "message": None if has_grades else "טרם פורסמו ציונים עבורך בקורסים הנבחרים.",
        "courses_summary": courses_summary,
        "assignment_grades": assignment_grades,
        "upcoming_assignments": upcoming_assignments,
    }