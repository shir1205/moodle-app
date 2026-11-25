import json
from fastapi.testclient import TestClient

import main as ai_main
from auth_middleware import get_current_user

client = TestClient(ai_main.app)


def _override_user():
    return {
        "user_id": "test-user-123",
        "id": "test-user-123",
        "email": "student@example.com",
        "role": "student",
    }


def test_feedback_requires_auth():
    ai_main.app.dependency_overrides.pop(get_current_user, None)
    resp = client.post(
        "/api/ai/feedback",
        json={"question": "מה זה סיבוכיות זמן?", "solution": "הזמן שלוקח לקוד לרוץ"},
    )
    assert resp.status_code == 401


def test_feedback_empty_fields_does_not_call_gemini(monkeypatch):
    ai_main.app.dependency_overrides[get_current_user] = _override_user
    called = {"count": 0}

    def _fake_ask(_prompt: str) -> str:
        called["count"] += 1
        return "{}"

    monkeypatch.setattr(ai_main, "ask_gemini", _fake_ask)

    resp = client.post(
        "/api/ai/feedback",
        json={"question": "   ", "solution": "פתרון כלשהו"},
    )
    assert resp.status_code == 400
    assert called["count"] == 0
    ai_main.app.dependency_overrides.clear()


def test_feedback_detects_logical_errors(monkeypatch):
    ai_main.app.dependency_overrides[get_current_user] = _override_user

    mock_payload = json.dumps(
        {
            "positive_points": ["ניסוח ברור של השלבים"],
            "logical_errors": [
                {
                    "issue": "תנאי עצירה חסר ברקורסיה",
                    "location": "שורה 2 בפתרון",
                    "explanation": "ללא תנאי עצירה הרקורסיה לא תעצור",
                    "fix_hint": "הוסף תנאי עצירה עבור n <= 0",
                }
            ],
            "improvement_suggestions": ["בדוק מקרה בסיס n=0"],
        }
    )
    monkeypatch.setattr(ai_main, "ask_gemini", lambda _prompt: mock_payload)

    resp = client.post(
        "/api/ai/feedback",
        json={
            "question": "כתוב פונקציה רקורסיבית לעצרת",
            "solution": "מחזיר n * fact(n-1)",
            "course_id": "CS101",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == "test-user-123"
    assert data["is_logical_valid"] is False
    assert data["is_fallback"] is False
    assert len(data["logical_errors"]) == 1
    assert data["logical_errors"][0]["issue"] == "תנאי עצירה חסר ברקורסיה"
    ai_main.app.dependency_overrides.clear()


def test_feedback_fallback_on_gemini_error(monkeypatch):
    ai_main.app.dependency_overrides[get_current_user] = _override_user

    def _failing_ask(_prompt: str) -> str:
        raise RuntimeError("Service unavailable")

    monkeypatch.setattr(ai_main, "ask_gemini", _failing_ask)

    resp = client.post(
        "/api/ai/feedback",
        json={"question": "שאלה לדוגמה", "solution": "פתרון לדוגמה"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_fallback"] is True
    ai_main.app.dependency_overrides.clear()