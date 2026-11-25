"""Unit tests for Story #9 (POST /notifications/encouragement). Supabase is mocked."""
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt
from fastapi.testclient import TestClient

from auth_middleware import JWT_ALGORITHM, JWT_SECRET
from main import app, create_access_token

client = TestClient(app)

STUDENT_UUID = "11111111-2222-4333-8444-555555555555"
LECTURER_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"


def auth_header(user_id: str = LECTURER_UUID, email: str = "michal@demo.ac.il", role: str = "lecturer"):
    token = create_access_token(user_id=user_id, email=email, role=role)
    return {"Authorization": f"Bearer {token}"}


def mock_supabase_insert(returned_row=None, error=None):
    mock_supabase = MagicMock()
    insert_chain = mock_supabase.table.return_value.insert.return_value
    if error is not None:
        insert_chain.execute.side_effect = error
    else:
        insert_chain.execute.return_value = SimpleNamespace(
            data=[returned_row] if returned_row is not None else []
        )
    return mock_supabase


def test_send_encouragement_lecturer_success_201():
    expected_row = {
        "id": 101,
        "user_id": STUDENT_UUID,
        "title": "עידוד בקורס אלגוריתמים",
        "message": "כל הכבוד על ההתמדה, אשמח שנעבור יחד על המטלה הבאה.",
        "is_read": False,
        "link": "/courses/course-1",
        "created_at": "2026-11-25T12:00:00Z",
    }
    mock_supabase = mock_supabase_insert(returned_row=expected_row)

    with patch("notifications_router.get_supabase", return_value=mock_supabase):
        response = client.post(
            "/notifications/encouragement",
            json={
                "student_id": STUDENT_UUID,
                "title": "  עידוד בקורס אלגוריתמים  ",
                "message": "  כל הכבוד על ההתמדה, אשמח שנעבור יחד על המטלה הבאה.  ",
                "course_id": "course-1",
            },
            headers=auth_header(role="lecturer"),
        )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 101
    assert body["user_id"] == STUDENT_UUID
    assert body["is_read"] is False
    assert body["link"] == "/courses/course-1"

    mock_supabase.table.assert_called_once_with("notifications")
    inserted = mock_supabase.table.return_value.insert.call_args[0][0]
    assert inserted == {
        "user_id": str(uuid.UUID(STUDENT_UUID)),
        "title": "עידוד בקורס אלגוריתמים",
        "message": "כל הכבוד על ההתמדה, אשמח שנעבור יחד על המטלה הבאה.",
        "is_read": False,
        "link": "/courses/course-1",
    }


def test_send_encouragement_role_case_insensitive_and_admin_201():
    for role in ("LECTURER", "Lecturer", "admin", "ADMIN"):
        expected_row = {
            "id": 102,
            "user_id": STUDENT_UUID,
            "title": "פנייה אישית",
            "message": "אנחנו כאן לתמוך בך",
            "is_read": False,
            "link": "/custom/link",
            "created_at": "2026-11-25T12:05:00Z",
        }
        mock_supabase = mock_supabase_insert(returned_row=expected_row)

        with patch("notifications_router.get_supabase", return_value=mock_supabase):
            response = client.post(
                "/notifications/encouragement",
                json={
                    "student_id": STUDENT_UUID,
                    "title": "פנייה אישית",
                    "message": "אנחנו כאן לתמוך בך",
                    "course_id": "course-1",
                    "link": "/custom/link",
                },
                headers=auth_header(role=role),
            )

        assert response.status_code == 201
        assert response.json()["link"] == "/custom/link"


def test_send_encouragement_student_and_ta_forbidden_403():
    mock_supabase = mock_supabase_insert()

    for role in ("student", "STUDENT", "ta"):
        with patch("notifications_router.get_supabase", return_value=mock_supabase):
            response = client.post(
                "/notifications/encouragement",
                json={
                    "student_id": STUDENT_UUID,
                    "title": "כותרת",
                    "message": "תוכן הודעה",
                },
                headers=auth_header(role=role),
            )

        assert response.status_code == 403
        assert response.json()["detail"] == "אין הרשאה לבצע פעולה זו"

    mock_supabase.table.assert_not_called()


def test_send_encouragement_missing_invalid_or_expired_token_401():
    payload = {
        "student_id": STUDENT_UUID,
        "title": "כותרת",
        "message": "תוכן",
    }

    missing_resp = client.post("/notifications/encouragement", json=payload)
    assert missing_resp.status_code == 401

    invalid_resp = client.post(
        "/notifications/encouragement",
        json=payload,
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
    expired_resp = client.post(
        "/notifications/encouragement",
        json=payload,
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert expired_resp.status_code == 401

    missing_sub_token = jwt.encode(
        {
            "email": "michal@demo.ac.il",
            "role": "lecturer",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    missing_sub_resp = client.post(
        "/notifications/encouragement",
        json=payload,
        headers={"Authorization": f"Bearer {missing_sub_token}"},
    )
    assert missing_sub_resp.status_code == 401


def test_send_encouragement_validation_errors_422():
    invalid_payloads = [
        {"student_id": "", "title": "כותרת", "message": "תוכן"},
        {"student_id": "   ", "title": "כותרת", "message": "תוכן"},
        {"student_id": "user-student-2", "title": "כותרת", "message": "תוכן"},
        {"student_id": STUDENT_UUID, "title": "   ", "message": "תוכן"},
        {"student_id": STUDENT_UUID, "title": "כותרת", "message": ""},
    ]

    for payload in invalid_payloads:
        response = client.post(
            "/notifications/encouragement",
            json=payload,
            headers=auth_header(role="lecturer"),
        )
        assert response.status_code == 422


def test_send_encouragement_database_failure_500():
    mock_supabase_exc = mock_supabase_insert(error=RuntimeError("Supabase connection error"))
    with patch("notifications_router.get_supabase", return_value=mock_supabase_exc):
        response = client.post(
            "/notifications/encouragement",
            json={
                "student_id": STUDENT_UUID,
                "title": "כותרת",
                "message": "תוכן הודעה",
            },
            headers=auth_header(role="lecturer"),
        )
    assert response.status_code == 500

    mock_supabase_empty = mock_supabase_insert(returned_row=None)
    with patch("notifications_router.get_supabase", return_value=mock_supabase_empty):
        empty_resp = client.post(
            "/notifications/encouragement",
            json={
                "student_id": STUDENT_UUID,
                "title": "כותרת",
                "message": "תוכן הודעה",
            },
            headers=auth_header(role="lecturer"),
        )
    assert empty_resp.status_code == 500
