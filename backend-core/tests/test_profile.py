"""בדיקות לסיפור 61 - צפייה בפרטים האישיים. Supabase מוחלף ב-Mock."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import jwt
from fastapi.testclient import TestClient

from main import JWT_ALGORITHM, JWT_SECRET, app, create_access_token

client = TestClient(app)

DANA_ROW = {
    "id": "row-1",
    "email": "dana@demo.ac.il",
    "full_name": "דנה כהן",
    "role": "student",
    "department": "מדעי המחשב",
    "avatar_url": None,
    "created_at": "2026-11-01T09:00:00Z",
    "failed_login_attempts": 3,
    "locked_until": None,
}


def mock_supabase_with(rows):
    mock_supabase = MagicMock()
    query = mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value
    query.execute.return_value.data = rows
    return mock_supabase


def auth_header(email="dana@demo.ac.il"):
    token = create_access_token(user_id="user-1", email=email, role="student")
    return {"Authorization": f"Bearer {token}"}


def test_profile_returns_own_details():
    mock_supabase = mock_supabase_with([DANA_ROW])

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.get("/profile", headers=auth_header())

    assert response.status_code == 200
    profile = response.json()["profile"]
    assert profile["full_name"] == "דנה כהן"
    assert profile["email"] == "dana@demo.ac.il"
    assert profile["role"] == "student"
    assert profile["created_at"] == "2026-11-01T09:00:00Z"
    # המשתמש מזוהה לפי המייל שבטוקן בלבד
    mock_supabase.table.return_value.select.return_value.eq.assert_called_once_with(
        "email", "dana@demo.ac.il"
    )


def test_profile_does_not_leak_security_fields():
    """אבטחה: לא מחזירים מונה ניסיונות, נעילה או סיסמה"""
    mock_supabase = mock_supabase_with([DANA_ROW])

    with patch("main.get_supabase", return_value=mock_supabase):
        profile = client.get("/profile", headers=auth_header()).json()["profile"]

    assert "failed_login_attempts" not in profile
    assert "locked_until" not in profile
    assert "password" not in profile


def test_profile_without_token_is_401():
    response = client.get("/profile")
    assert response.status_code == 401


def test_profile_with_invalid_token_is_401():
    response = client.get("/profile", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_profile_with_expired_token_is_401():
    expired = jwt.encode(
        {
            "sub": "user-1",
            "email": "dana@demo.ac.il",
            "role": "student",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    response = client.get("/profile", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401


def test_profile_user_not_found_is_404():
    mock_supabase = mock_supabase_with([])

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.get("/profile", headers=auth_header("ghost@demo.ac.il"))

    assert response.status_code == 404