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

# ==========================================
# מקום לבדיקות אינטגרציה עתידיות (יושלם לאחר קבלת חוזי ה-API)
# ==========================================

def test_authentication_flow():
    """ייבדק: התחברות משתמש וקבלת טוקן JWT"""
    pytest.skip("ממתינה ל-Swagger של צוות 1")

def test_notifications_integration():
    """ייבדק: שליפת התראות עם טוקן אימות תקין (צוות 1 + צוות 4)"""
    pytest.skip("ממתינה ל-JWT של צוות 1")

def test_courses_api():
    """ייבדק: שליפת רשימת קורסים והרשמה לקורס"""
    pytest.skip("ממתינה ל-Swagger של צוות 2")

def test_ai_assistant_query():
    """ייבדק: שליחת שאלה לעוזר החכם וקבלת תשובה"""
    pytest.skip("ממתינה ל-Swagger של צוות 3")