"""Unit tests for Story #7 (GET /analytics/at-risk). Supabase is mocked."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt
from fastapi.testclient import TestClient

from auth_middleware import JWT_ALGORITHM, JWT_SECRET
from main import app, create_access_token

client = TestClient(app)

LECTURER_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
STUDENT_LOW_GRADE_UUID = "11111111-1111-4111-8111-111111111101"
STUDENT_MISSED_UUID = "11111111-1111-4111-8111-111111111102"
STUDENT_HEALTHY_UUID = "11111111-1111-4111-8111-111111111103"


def auth_header(user_id: str = LECTURER_UUID, email: str = "michal@demo.ac.il", role: str = "lecturer"):
    token = create_access_token(user_id=user_id, email=email, role=role)
    return {"Authorization": f"Bearer {token}"}


def mock_supabase_tables(users=None, assignments=None, submissions=None, error=None):
    mock_supabase = MagicMock()
    table_map = {
        "users": users if users is not None else [],
        "assignments": assignments if assignments is not None else [],
        "submissions": submissions if submissions is not None else [],
    }

    def table_side_effect(table_name: str):
        table_mock = MagicMock()
        select_mock = table_mock.select.return_value
        if error is not None:
            select_mock.execute.side_effect = error
        else:
            select_mock.execute.return_value = SimpleNamespace(data=table_map.get(table_name, []))
        return table_mock

    mock_supabase.table.side_effect = table_side_effect
    return mock_supabase


def test_at_risk_identifies_low_grade_and_missed_assignments_and_excludes_healthy():
    now = datetime.now(timezone.utc)
    past_1 = (now - timedelta(days=10)).isoformat()
    past_2 = (now - timedelta(days=5)).isoformat()
    future_1 = (now + timedelta(days=7)).isoformat()

    users = [
        {"id": STUDENT_LOW_GRADE_UUID, "email": "low@demo.ac.il", "full_name": "דנה לוי", "role": "student"},
        {"id": STUDENT_MISSED_UUID, "email": "missed@demo.ac.il", "full_name": "אלון מזרחי", "role": "STUDENT"},
        {"id": STUDENT_HEALTHY_UUID, "email": "ok@demo.ac.il", "full_name": "נועה כהן", "role": "student"},
        {"id": LECTURER_UUID, "email": "michal@demo.ac.il", "full_name": "ד\"ר מיכל", "role": "lecturer"},
    ]
    assignments = [
        {"id": "a1", "course_id": "course-1", "due_date": past_1, "status": "published"},
        {"id": "a2", "course_id": "course-1", "due_date": past_2, "status": "published"},
        {"id": "a3", "course_id": "course-1", "due_date": future_1, "status": "published"},
        {"id": "a4", "course_id": "course-1", "due_date": past_1, "status": "draft"},
    ]
    submissions = [
        # Low-grade student submitted both past assignments, but average is 52.5 (< 60)
        {"id": "s1", "assignment_id": "a1", "student_id": STUDENT_LOW_GRADE_UUID, "grade": 50},
        {"id": "s2", "assignment_id": "a2", "student_id": STUDENT_LOW_GRADE_UUID, "grade": 55},
        # Missed-assignments student has 0 submissions -> 2 missed past-due published assignments
        # Healthy student submitted both past assignments with good grades (90, 85) -> NOT at risk
        {"id": "s3", "assignment_id": "a1", "student_id": STUDENT_HEALTHY_UUID, "grade": 90},
        {"id": "s4", "assignment_id": "a2", "student_id": STUDENT_HEALTHY_UUID, "grade": 85},
    ]

    mock_supabase = mock_supabase_tables(users=users, assignments=assignments, submissions=submissions)

    with patch("analytics_router.get_supabase", return_value=mock_supabase):
        response = client.get("/analytics/at-risk", headers=auth_header(role="lecturer"))

    assert response.status_code == 200
    data = response.json()
    returned_ids = {item["student_id"] for item in data}
    assert returned_ids == {STUDENT_LOW_GRADE_UUID, STUDENT_MISSED_UUID}
    assert STUDENT_HEALTHY_UUID not in returned_ids

    low_grade_item = next(item for item in data if item["student_id"] == STUDENT_LOW_GRADE_UUID)
    assert low_grade_item["full_name"] == "דנה לוי"
    assert low_grade_item["email"] == "low@demo.ac.il"
    assert low_grade_item["average_grade"] == 52.5
    assert low_grade_item["missed_assignments_count"] == 0
    assert any("ממוצע ציונים נמוך" in reason for reason in low_grade_item["risk_reasons"])
    assert "course-1" in low_grade_item["courses"]

    missed_item = next(item for item in data if item["student_id"] == STUDENT_MISSED_UUID)
    assert missed_item["average_grade"] is None
    assert missed_item["missed_assignments_count"] == 2
    assert any("אי-הגשת 2 מטלות" in reason for reason in missed_item["risk_reasons"])


def test_at_risk_returns_empty_list_when_all_students_healthy():
    now = datetime.now(timezone.utc)
    past_1 = (now - timedelta(days=4)).isoformat()

    users = [
        {"id": STUDENT_HEALTHY_UUID, "email": "ok@demo.ac.il", "full_name": "נועה כהן", "role": "student"},
    ]
    assignments = [
        {"id": "a1", "course_id": "course-1", "due_date": past_1, "status": "published"},
    ]
    submissions = [
        {"id": "s1", "assignment_id": "a1", "student_id": STUDENT_HEALTHY_UUID},
    ]

    mock_supabase = mock_supabase_tables(users=users, assignments=assignments, submissions=submissions)

    with patch("analytics_router.get_supabase", return_value=mock_supabase):
        response = client.get("/analytics/at-risk?course_id=course-1", headers=auth_header(role="lecturer"))

    assert response.status_code == 200
    assert response.json() == []


def test_at_risk_missing_invalid_or_expired_token_401():
    missing_resp = client.get("/analytics/at-risk")
    assert missing_resp.status_code == 401

    invalid_resp = client.get(
        "/analytics/at-risk",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert invalid_resp.status_code == 401

    expired_token = jwt.encode(
        {
            "sub": LECTURER_UUID,
            "email": "michal@demo.ac.il",
            "role": "lecturer",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    expired_resp = client.get(
        "/analytics/at-risk",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert expired_resp.status_code == 401


def test_at_risk_rbac_roles_403_and_200_case_insensitive():
    mock_supabase = mock_supabase_tables(users=[], assignments=[], submissions=[])

    for forbidden_role in ("student", "STUDENT", "ta", "TA"):
        with patch("analytics_router.get_supabase", return_value=mock_supabase):
            resp = client.get("/analytics/at-risk", headers=auth_header(role=forbidden_role))
        assert resp.status_code == 403
        assert resp.json()["detail"] == "אין הרשאה לבצע פעולה זו"

    for allowed_role in ("lecturer", "LECTURER", "admin", "ADMIN"):
        with patch("analytics_router.get_supabase", return_value=mock_supabase):
            resp = client.get("/analytics/at-risk", headers=auth_header(role=allowed_role))
        assert resp.status_code == 200
        assert resp.json() == []


def test_at_risk_supabase_error_returns_500():
    mock_supabase = mock_supabase_tables(error=RuntimeError("RLS policy denied"))

    with patch("analytics_router.get_supabase", return_value=mock_supabase):
        response = client.get("/analytics/at-risk", headers=auth_header(role="lecturer"))

    assert response.status_code == 500
    assert "Supabase" in response.json()["detail"]
