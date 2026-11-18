import pytest
import requests

# כתובות הבסיס של כל שירות כפי שהוגדרו בסביבת ה-Docker
SERVICES = {
    "core": "http://localhost:8001",
    "courses": "http://localhost:8002",
    "ai": "http://localhost:8003"
}

def test_all_services_health():
    """מוודא שכל המיקרו-שירותים באוויר ומגיבים לבקשות"""
    for name, url in SERVICES.items():
        response = requests.get(f"{url}/health")
        assert response.status_code == 200, f"Service {name} is down!"

class TestTeam1AuthAPI:
    """בדיקות אינטגרציה עבור מודול ההתחברות וה-JWT של צוות 1"""

    @pytest.fixture
    def valid_credentials(self):
        return {
            "email": "user@example.com",
            "password": "Password123!"
        }

    @pytest.fixture
    def invalid_credentials(self):
        return {
            "email": "wrong@example.com",
            "password": "wrongpassword"
        }

    def test_authentication_flow(self, valid_credentials):
        """ייבדק: התחברות משתמש וקבלת טוקן JWT"""
        url = f"{SERVICES['core']}/login"
        response = requests.post(url, json=valid_credentials, timeout=5)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data

    def test_auth_me_success(self, valid_credentials):
        """ייבדק: שליפת פרטי משתמש עם טוקן אימות תקין (GET /auth/me)"""
        login_url = f"{SERVICES['core']}/login"
        login_resp = requests.post(login_url, json=valid_credentials, timeout=5)
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        auth_url = f"{SERVICES['core']}/auth/me"
        headers = {"Authorization": f"Bearer {token}"}

        auth_resp = requests.get(auth_url, headers=headers, timeout=5)
        assert auth_resp.status_code == 200
        assert "email" in auth_resp.json()

    def test_login_invalid_credentials(self, invalid_credentials):
        """ייבדק: התחברות עם פרטים שגויים מחזירה 401 או 422"""
        url = f"{SERVICES['core']}/login"
        response = requests.post(url, json=invalid_credentials, timeout=5)
        assert response.status_code in [401, 422]

    def test_auth_me_missing_token(self):
        """ייבדק: ניסיון גישה לנתיב מאובטח ללא טוקן נדחה"""
        url = f"{SERVICES['core']}/auth/me"
        response = requests.get(url, timeout=5)
        assert response.status_code in [401, 422]

# ==========================================
# מקום לבדיקות אינטגרציה עתידיות (יושלם לאחר קבלת חוזי ה-API)
# ==========================================

def test_notifications_integration():
    """ייבדק: שליפת התראות עם טוקן אימות תקין (צוות 1 + צוות 4)"""
    pytest.skip("ממתינה ליישום ה-JWT ב-Router של צוות 4")

def test_courses_api():
    """ייבדק: שליפת רשימת קורסים והרשמה לקורס"""
    pytest.skip("ממתינה ל-Swagger של צוות 2")

def test_ai_assistant_query():
    """ייבדק: שליחת שאלה לעוזר החכם וקבלת תשובה"""
    pytest.skip("ממתינה ל-Swagger של צוות 3")