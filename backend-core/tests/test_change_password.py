"""בדיקות לסיפור 63 - שינוי סיסמה והתנתקות. Supabase מוחלף ב-Mock."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app, create_access_token

client = TestClient(app)


def auth_header(email="dana@demo.ac.il"):
    token = create_access_token(user_id="user-1", email=email, role="student")
    return {"Authorization": f"Bearer {token}"}


def mock_supabase(current_password_ok=True):
    supabase = MagicMock()
    if current_password_ok:
        supabase.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id="user-1", email="dana@demo.ac.il")
        )
    else:
        supabase.auth.sign_in_with_password.side_effect = Exception("Invalid login credentials")
    return supabase


def change(body, headers=None, supabase=None):
    with patch("main.get_supabase", return_value=supabase or mock_supabase()):
        return client.post("/change-password", json=body, headers=headers or auth_header())


def test_change_password_success():
    supabase = mock_supabase()
    response = change({"current_password": "OldPass123", "new_password": "NewPass456"}, supabase=supabase)

    assert response.status_code == 200
    assert response.json()["changed"] is True
    supabase.auth.sign_in_with_password.assert_called_once_with(
        {"email": "dana@demo.ac.il", "password": "OldPass123"}
    )
    supabase.auth.update_user.assert_called_once_with({"password": "NewPass456"})


def test_change_password_wrong_current_password_is_400_not_401():
    """400 ולא 401 - כדי שהממשק לא ינתק את המשתמש בגלל טעות בהקלדה"""
    supabase = mock_supabase(current_password_ok=False)
    response = change({"current_password": "Wrong123", "new_password": "NewPass456"}, supabase=supabase)

    assert response.status_code == 400
    assert response.json()["detail"] == "הסיסמה הנוכחית שגויה"
    supabase.auth.update_user.assert_not_called()


def test_change_password_weak_new_password_is_400():
    supabase = mock_supabase()
    for weak in ["short1", "onlyletters", "12345678"]:
        response = change({"current_password": "OldPass123", "new_password": weak}, supabase=supabase)
        assert response.status_code == 400
    supabase.auth.update_user.assert_not_called()


def test_change_password_same_as_current_is_400():
    response = change({"current_password": "SamePass123", "new_password": "SamePass123"})
    assert response.status_code == 400


def test_change_password_empty_current_is_400():
    response = change({"current_password": "", "new_password": "NewPass456"})
    assert response.status_code == 400


def test_change_password_uses_email_from_token_only():
    """אבטחה: הסיסמה משתנה רק למשתמש שבטוקן"""
    supabase = mock_supabase()
    change(
        {"current_password": "OldPass123", "new_password": "NewPass456"},
        headers=auth_header("noa@demo.ac.il"),
        supabase=supabase,
    )
    sent = supabase.auth.sign_in_with_password.call_args[0][0]
    assert sent["email"] == "noa@demo.ac.il"


def test_change_password_without_token_is_401():
    response = client.post(
        "/change-password", json={"current_password": "OldPass123", "new_password": "NewPass456"}
    )
    assert response.status_code == 401


def test_logout_success():
    response = client.post("/logout", headers=auth_header())
    assert response.status_code == 200
    assert response.json() == {"logged_out": True}


def test_logout_without_token_is_401():
    response = client.post("/logout")
    assert response.status_code == 401