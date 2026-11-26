"""Unit tests for GET /analytics/me/progress (Team 4 - Story #37)."""
import sys
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import analytics_router
from auth_middleware import get_current_user


class _FakeQuery:
    def __init__(self, rows: list[dict], should_fail: bool = False):
        self._rows = list(rows)
        self._should_fail = should_fail

    def select(self, *args, **kwargs):
        return self

    def eq(self, column: str, value):
        self._rows = [r for r in self._rows if r.get(column) == value]
        return self

    def execute(self):
        if self._should_fail:
            raise RuntimeError("RLS policy denied access")
        return SimpleNamespace(data=self._rows)


class _FakeSupabase:
    def __init__(self, tables: dict[str, list[dict]], failing_tables: set[str] | None = None):
        self._tables = tables
        self._failing_tables = failing_tables or set()

    def table(self, name: str):
        return _FakeQuery(
            self._tables.get(name, []),
            should_fail=name in self._failing_tables,
        )


def _make_client(user_override: dict | None = None) -> TestClient:
    app = FastAPI()
    app.include_router(analytics_router.router)
    if user_override is not None:
        app.dependency_overrides[get_current_user] = lambda: user_override
    return TestClient(app)


SAMPLE_TABLES = {
    "assignments": [
        {
            "id": "a1",
            "course_id": "CS101",
            "title": "HW 1",
            "due_date": "2026-11-10T20:00:00Z",
            "max_grade": 100,
            "status": "published",
        },
        {
            "id": "a2",
            "course_id": "CS101",
            "title": "HW 2",
            "due_date": "2026-12-20T20:00:00Z",
            "max_grade": 100,
            "status": "published",
        },
        {
            "id": "a3",
            "course_id": "CS201",
            "title": "Lab 1",
            "due_date": "2026-12-25T20:00:00Z",
            "max_grade": 100,
            "status": "published",
        },
        {
            "id": "a_draft",
            "course_id": "CS101",
            "title": "Hidden Draft",
            "due_date": "2026-12-30T20:00:00Z",
            "max_grade": 100,
            "status": "draft",
        },
    ],
    "submissions": [
        {
            "id": "sub-1",
            "assignment_id": "a1",
            "student_id": "student-1",
            "status": "submitted",
            "submitted_at": "2026-11-09T10:00:00Z",
        },
        {
            "id": "sub-2",
            "assignment_id": "a2",
            "student_id": "student-1",
            "status": "submitted",
            "submitted_at": "2026-11-20T10:00:00Z",
        },
        {
            "id": "sub-other",
            "assignment_id": "a1",
            "student_id": "student-2",
            "status": "submitted",
            "submitted_at": "2026-11-09T11:00:00Z",
        },
    ],
    "submission_grades": [
        {
            "submission_id": "sub-1",
            "grade": 90,
            "feedback": "עבודה מצוינת",
            "published_at": "2026-11-12T12:00:00Z",
        },
        {
            "submission_id": "sub-2",
            "grade": 50,
            "feedback": "טיוטת ציון שלא פורסמה",
            "published_at": None,
        },
        {
            "submission_id": "sub-other",
            "grade": 40,
            "feedback": "של סטודנט אחר",
            "published_at": "2026-11-12T12:00:00Z",
        },
    ],
}


def test_me_progress_unauthenticated_returns_401():
    client = _make_client(user_override=None)
    resp = client.get("/analytics/me/progress")
    assert resp.status_code == 401


def test_me_progress_lecturer_forbidden_returns_403():
    client = _make_client(
        {"user_id": "lec-1", "id": "lec-1", "email": "lec@example.com", "role": "lecturer"}
    )
    resp = client.get("/analytics/me/progress")
    assert resp.status_code == 403


def test_me_progress_student_isolation_and_published_only(monkeypatch):
    monkeypatch.setattr(
        analytics_router, "get_supabase", lambda: _FakeSupabase(SAMPLE_TABLES)
    )
    client = _make_client(
        {"user_id": "student-1", "id": "student-1", "email": "s1@example.com", "role": "student"}
    )

    resp = client.get("/analytics/me/progress")
    assert resp.status_code == 200
    data = resp.json()

    assert data["student_id"] == "student-1"
    assert data["total_assignments_count"] == 3  # Draft excluded
    assert data["completed_assignments_count"] == 2
    assert data["completion_rate_percent"] == 66.7
    assert data["has_grades"] is True
    assert data["graded_assignments_count"] == 1  # sub-2 is unpublished, sub-other belongs to student-2
    assert data["student_average"] == 90.0
    assert data["available_courses"] == ["CS101", "CS201"]

    grades_by_a = {item["assignment_id"]: item for item in data["assignment_grades"]}
    assert grades_by_a["a1"]["student_grade"] == 90.0
    assert grades_by_a["a1"]["feedback"] == "עבודה מצוינת"
    assert grades_by_a["a2"]["student_grade"] is None  # Unpublished grade hidden


def test_me_progress_course_filter_and_admin_access(monkeypatch):
    monkeypatch.setattr(
        analytics_router, "get_supabase", lambda: _FakeSupabase(SAMPLE_TABLES)
    )
    client = _make_client(
        {"user_id": "student-1", "id": "student-1", "email": "admin@example.com", "role": "admin"}
    )

    resp = client.get("/analytics/me/progress?course_id=CS101")
    assert resp.status_code == 200
    data = resp.json()

    assert data["course_id"] == "CS101"
    assert data["total_assignments_count"] == 2
    assert data["completed_assignments_count"] == 2
    assert data["completion_rate_percent"] == 100.0
    assert data["student_average"] == 90.0


def test_me_progress_no_grades_returns_empty_message(monkeypatch):
    monkeypatch.setattr(
        analytics_router, "get_supabase", lambda: _FakeSupabase(SAMPLE_TABLES)
    )
    client = _make_client(
        {"user_id": "student-new", "id": "student-new", "email": "new@example.com", "role": "student"}
    )

    resp = client.get("/analytics/me/progress")
    assert resp.status_code == 200
    data = resp.json()

    assert data["has_grades"] is False
    assert data["student_average"] is None
    assert data["completed_assignments_count"] == 0
    assert data["completion_rate_percent"] == 0.0
    assert isinstance(data["message"], str) and len(data["message"]) > 0


def test_me_progress_rls_fallback_on_submission_grades(monkeypatch):
    monkeypatch.setattr(
        analytics_router,
        "get_supabase",
        lambda: _FakeSupabase(SAMPLE_TABLES, failing_tables={"submission_grades"}),
    )
    client = _make_client(
        {"user_id": "student-1", "id": "student-1", "email": "s1@example.com", "role": "student"}
    )

    resp = client.get("/analytics/me/progress")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_grades"] is False
    assert data["completed_assignments_count"] == 2