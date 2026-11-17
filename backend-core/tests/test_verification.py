"""בדיקות לסיפור 57 - אימות כתובת דוא"ל. Supabase מוחלף ב-Mock, אין צורך בחיבור אמיתי."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app, is_email_not_confirmed

client = TestClient(app)


class FakeAuthError(Exception):
    def __init__(self, message, status=400, code=""):
        super().__init__(message)
        self.status = status
        self.code = code


def test_verify_email_success():
    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.return_value = SimpleNamespace(
        user=SimpleNamespace(
            id="user-1", email="dana@demo.ac.il", email_confirmed_at="2026-11-17T10:00:00Z"
        )
    )

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post("/verify-email", json={"access_token": "valid-token"})

    assert response.status_code == 200
    assert response.json() == {"verified": True, "user_id": "user-1", "email": "dana@demo.ac.il"}
    mock_supabase.auth.get_user.assert_called_once_with("valid-token")


def test_verify_email_not_confirmed_yet():
    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.return_value = SimpleNamespace(
        user=SimpleNamespace(id="user-1", email="dana@demo.ac.il", email_confirmed_at=None)
    )

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post("/verify-email", json={"access_token": "valid-token"})

    assert response.status_code == 403


def test_verify_email_invalid_or_expired_token():
    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.side_effect = FakeAuthError("invalid JWT", 401)

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post("/verify-email", json={"access_token": "bad-token"})

    assert response.status_code == 400


def test_verify_email_empty_token():
    response = client.post("/verify-email", json={"access_token": "  "})
    assert response.status_code == 400


def test_resend_verification_success():
    mock_supabase = MagicMock()

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post("/resend-verification", json={"email": "dana@demo.ac.il"})

    assert response.status_code == 200
    assert response.json()["sent"] is True
    mock_supabase.auth.resend.assert_called_once_with(
        {
            "type": "signup",
            "email": "dana@demo.ac.il",
            "options": {"email_redirect_to": "http://localhost:3000/verify"},
        }
    )


def test_resend_verification_unknown_email_gives_same_answer():
    """אבטחה: לא חושפים אם המייל רשום במערכת"""
    mock_supabase = MagicMock()
    mock_supabase.auth.resend.side_effect = FakeAuthError("User not found", 400)

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post("/resend-verification", json={"email": "nobody@demo.ac.il"})

    assert response.status_code == 200
    assert response.json()["sent"] is True


def test_resend_verification_rate_limited():
    mock_supabase = MagicMock()
    mock_supabase.auth.resend.side_effect = FakeAuthError("Email rate limit exceeded", 429)

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post("/resend-verification", json={"email": "dana@demo.ac.il"})

    assert response.status_code == 429


def test_resend_verification_invalid_email():
    response = client.post("/resend-verification", json={"email": "not-an-email"})
    assert response.status_code == 400


def test_is_email_not_confirmed():
    assert is_email_not_confirmed(FakeAuthError("Email not confirmed", 400, "email_not_confirmed"))
    assert is_email_not_confirmed(FakeAuthError("Email not confirmed", 400))
    assert not is_email_not_confirmed(FakeAuthError("Invalid login credentials", 400))