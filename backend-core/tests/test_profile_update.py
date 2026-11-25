"""בדיקות לסיפור 62 - עדכון פרטי משתמש. Supabase מוחלף ב-Mock."""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app, create_access_token

client = TestClient(app)

UPDATED_ROW = {
    "id": "row-1",
    "email": "dana@demo.ac.il",
    "full_name": "דנה לוי",
    "role": "student",
    "department": "הנדסת תוכנה",
    "avatar_url": None,
    "created_at": "2026-11-01T09:00:00Z",
    "failed_login_attempts": 2,
    "locked_until": None,
}


def mock_supabase_returning(rows):
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = rows
    return mock_supabase


def auth_header(email="dana@demo.ac.il", role="student"):
    token = create_access_token(user_id="user-1", email=email, role=role)
    return {"Authorization": f"Bearer {token}"}


def test_update_profile_success():
    mock_supabase = mock_supabase_returning([UPDATED_ROW])

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.put(
            "/profile",
            json={"full_name": "  דנה לוי  ", "department": "הנדסת תוכנה"},
            headers=auth_header(),
        )

    assert response.status_code == 200
    profile = response.json()["profile"]
    assert profile["full_name"] == "דנה לוי"
    assert profile["department"] == "הנדסת תוכנה"
    # נשלחו לעדכון רק השדות המותרים, אחרי ניקוי רווחים
    mock_supabase.table.return_value.update.assert_called_once_with(
        {"full_name": "דנה לוי", "department": "הנדסת תוכנה"}
    )


def test_update_profile_only_own_user():
    """אבטחה: העדכון מתבצע רק על המשתמש שמזוהה בטוקן"""
    mock_supabase = mock_supabase_returning([UPDATED_ROW])

    with patch("main.get_supabase", return_value=mock_supabase):
        client.put("/profile", json={"full_name": "דנה לוי"}, headers=auth_header())

    mock_supabase.table.return_value.update.return_value.eq.assert_called_once_with(
        "email", "dana@demo.ac.il"
    )


def test_update_profile_cannot_change_role_or_email():
    """אבטחה: שדות כמו role ו-email מתעלמים מהם ולא נשלחים לעדכון"""
    mock_supabase = mock_supabase_returning([UPDATED_ROW])

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.put(
            "/profile",
            json={"full_name": "דנה לוי", "role": "admin", "email": "hacker@demo.ac.il"},
            headers=auth_header(),
        )

    assert response.status_code == 200
    sent = mock_supabase.table.return_value.update.call_args[0][0]
    assert "role" not in sent
    assert "email" not in sent


def test_update_profile_does_not_leak_security_fields():
    mock_supabase = mock_supabase_returning([UPDATED_ROW])

    with patch("main.get_supabase", return_value=mock_supabase):
        profile = client.put(
            "/profile", json={"full_name": "דנה לוי"}, headers=auth_header()
        ).json()["profile"]

    assert "failed_login_attempts" not in profile
    assert "locked_until" not in profile


def test_update_profile_empty_name_is_400():
    response = client.put("/profile", json={"full_name": "   "}, headers=auth_header())
    assert response.status_code == 400


def test_update_profile_too_long_is_400():
    response = client.put("/profile", json={"department": "א" * 101}, headers=auth_header())
    assert response.status_code == 400


def test_update_profile_nothing_to_update_is_400():
    response = client.put("/profile", json={}, headers=auth_header())
    assert response.status_code == 400


def test_update_profile_without_token_is_401():
    response = client.put("/profile", json={"full_name": "דנה לוי"})
    assert response.status_code == 401


def test_update_profile_user_not_found_is_404():
    mock_supabase = mock_supabase_returning([])

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.put(
            "/profile", json={"full_name": "רוח רפאים"}, headers=auth_header("ghost@demo.ac.il")
        )

    assert response.status_code == 404